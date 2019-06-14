import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api.datastore_types import Blob
import logging
from cacheman import *  # cached_* VizQuery
from Crypto.Hash import HMAC, SHA512
import consvc
import morutil
import string
import random
import os

class MUser(db.Model):
    """ Membic User account, authentication and data """
    # auth and setup
    email = db.EmailProperty(required=True)
    phash = db.StringProperty(required=True)
    status = db.StringProperty()    # Pending|Active|Inactive|Unreachable
    mailbounce = db.TextProperty(required=False)   # isodate1,isodate2...
    actsends = db.TextProperty(required=False)  # isodate;emaddr,d2;e2...
    actcode = db.StringProperty(indexed=False)  # account activation code
    # app data
    hashtag = db.StringProperty()   # personal theme direct access
    profpic = db.BlobProperty()     # used for theme, and coop posts
    settings = db.TextProperty()    # JSON skin, keys, descrip, full name...
    coops = db.TextProperty()       # JSON following, invites
    created = db.StringProperty()   # isodate
    modified = db.StringProperty()  # isodate
    accessed = db.StringProperty()  # isodate
    preb = db.TextProperty()        # JSON membics for display, overflow link


def verify_secure_comms(handler, url):
    if url.startswith('https') or re.search("\:[0-9][0-9]80", url):
        return True
    morutil.srverr(handler, 405, "request must be over https")
    return False


# Apparently on some devices/browsers it is possible for the email
# address used for login to be sent encoded.  Decode and lowercase.
def normalize_email(emaddr):
    emaddr = emaddr.lower()
    emaddr = re.sub('%40', '@', emaddr)
    return emaddr


def valid_email_address(emaddr):
    # something @ something . something
    if not re.match(r"[^@]+@[^@]+\.[^@]+", emaddr):
        return False
    return True


def valid_new_email_address(handler, emaddr):
    if not (valid_email_address(emaddr)):
        handler.error(412)  # precondition failed
        handler.response.out.write("Invalid email address")
        return False
    vq = VizQuery(MUser, "WHERE email=:1 LIMIT 1", emaddr)
    accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(accounts) > 0:   # return error, probably forgot they signed up
        handler.error(422)  # Unprocessable Entity
        handler.response.out.write("Email address used already")
        return False
    return emaddr


def account_from_email(emaddr):
    emaddr = emaddr or ""
    emaddr = normalize_email(emaddr)
    # logging.info("account_from_email looking up " + emaddr)
    where = "WHERE email=:1 LIMIT 1"
    vq = VizQuery(MUser, where, emaddr)
    qres = cached_query(emaddr, vq, "", 1, MUser, True)
    if len(qres.objects) > 0:
        return qres.objects[0]
    return None


def valid_password_format(handler, pwd):
    if len(pwd) < 6:
        morutil.srverr(handler, 412, "Password must be at least 6 characters")
        return False
    return True


def make_password_hash(emaddr, pwd, cretime):
    hmac = HMAC.new(pwd.encode("utf8"), digestmod=SHA512)
    hmac.update((emaddr + "_" + cretime).encode("utf8"))
    return hmac.hexdigest()
    

def token_for_user(muser):
    ts = consvc.get_connection_service("TokenSvc")
    hmac = HMAC.new(ts.secret.encode("utf8"), digestmod=SHA512)
    hmac.update((muser.email + "_" + muser.phash).encode("utf8"))
    token = hmac.hexdigest()
    token = token.replace("+", "-")
    token = token.replace("/", "_")
    token = token.replace("=", ".")
    return token


# previous versions used an authentication method "am" parameter with values
# like fbid/twid/gsid/ghid.  "mid" was native.  Only native now.
def authenticated(request):
    """ Return an account for the given auth type if the token is valid """
    emaddr = normalize_email(request.get('an') or "")
    reqtok = request.get('at')
    muser = account_from_email(emaddr)
    if not muser:
        logging.info("authenticated muser not found")
        return None
    srvtok = token_for_user(muser)
    if reqtok != srvtok:
        logging.info("authenticated token did not match")
        logging.info("  reqtok: " + reqtok)
        logging.info("  srvtok: " + srvtok)
        return None
    logging.info("moracct.py authenticated " + emaddr)
    return muser


def random_alphanumeric(length):
    chars = string.ascii_letters + string.digits
    val = "".join(random.choice(chars) for _ in range(length))
    return val
    

def mailgun_send(handler, eaddr, subj, body):
    if ((not os.getenv('SERVER_SOFTWARE', '').startswith('Google App Engine/'))
        or (handler and re.search("\:[0-9][0-9]80", handler.request.url))):
        logging.info("Mail not sent to " + eaddr + " from local dev" +
                     "\n\n" + body)
        return
    mg = consvc.get_connection_service("mailgun");
    authkey = base64.b64encode("api:" + mg.ckey)
    # urlencode converts to ascii. passing unicode text crashes it.
    params = urllib.urlencode({
            'from': 'Membic Notifier <noreply@membic.org>',
            'to': eaddr.encode('utf-8'),
            'subject': subj.encode('utf-8'),
            'text': body.encode('utf-8')})
    headers = {'Authorization': 'Basic {0}'.format(authkey),
               'Content-Type': 'application/x-www-form-urlencoded'}
    conn = httplib.HTTPSConnection("api.mailgun.net", 443)
    conn.request('POST', '/v3/mg.membic.org/messages', params, headers)
    response = conn.getresponse()
    logging.info("mgsi " + eaddr + " " + subj + " " + str(response.status) + 
                 " " + str(response.reason))
    data = response.read()
    logging.info("mgsi " + eaddr + " data: " + str(data))
    conn.close()


# Caller sets the actcode before calling, and updates the db after. Email
# delivery can be delayed, so the code is not reset each time.
def send_activation_code(handler, account):
    if account.actsends:
        account.actsends += ","
    else:
        account.actsends = ""
    account.actsends += nowISO() + ";" + account.email
    # host_url is a field that Request inherits from WebOb
    url = handler.request.host_url + "/activate?key=" +\
        str(account.key().id()) + "&code=" + account.actcode +\
        "&an=" + account.email + "&at=" + token_for_user(account)
    logging.info("Activate " + account.email + ": " + url)
    mailtxt = "Hello,\n\nWelcome to membic.org! Please click this link to confirm your email address and activate your account:\n\n" + url + "\n\n"
    mailgun_send(handler, account.email, "Account activation", mailtxt)
    return account


def reset_email_verification(handler, account):
    account.status = "Pending"
    account.mailbounce = ""
    account.actsends = ""
    account.actcode = random_alphanumeric(30)
    if not account.is_saved():
        account.put()  # need account.key().id() for activation mail
    send_activation_code(handler, account)


# Password is required for updating email since we need to rebuild phash
# before rebuilding the access token.
def update_email_and_password(handler, account):
    req = handler.request
    emaddr = req.get('email') or req.get("emailin") or ""
    emaddr = normalize_email(emaddr)
    pwd = req.get("password") or req.get("passin") or ""
    if not emaddr and not pwd and account.email != "placeholder":
        return True  # not updating credentials so done
    # updating email+password or password
    if emaddr and emaddr != account.email and not pwd:
        morutil.srverr(handler, 400, "Password required to change email")
        return False
    if not valid_password_format(handler, pwd):
        return False  # error already reported
    changedemail = False
    if emaddr != account.email:
        if not valid_new_email_address(handler, emaddr):
            return False  # error already reported
        account.email = emaddr
        emailchanged = True
    account.phash = make_password_hash(account.email, pwd, account.created)
    if emailchanged:
        reset_email_verification(handler, account)
    return True


def verify_hashtag_db(handler, dbobj, dbclass):
    # fetch first two instances to ensure there isn't a conflict in the db
    # due to update latency or some other strange circumstance
    vq = VizQuery(dbclass, "WHERE hashtag = :1", dbobj.hashtag)
    objs = vq.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    clear = True
    for obj in objs:
        if obj.key().id() != dbobj.key().id():
            clear = False  # other dbobject has same hashtag
    return clear


def is_valid_hashtag(hashtag):
    # alphabetic character, followed by alphabetic chars or numbers
    #   1. start of string
    #   2. not a non-alphanumeric, not a number and not '_'
    #   3. any alphanumeric character.  Underscores ok.
    #   4. continue to end of string
    return re.match(r"\A[^\W\d_][\w]*\Z", hashtag)


def verify_valid_unique_hashtag(handler, dbobj):
    if not is_valid_hashtag(dbobj.hashtag):
        morutil.srverr(handler, 400, "Invalid hashtag.")
        return False
    cached = memcache.get(dbobj.hashtag)
    if cached:
        ces = cached.split(":")
        if ces[0] != dbobj.kind() or ces[1] != str(dbobj.key().id()):
            morutil.srverr(handler, 400, "Hashtag is already in use.")
            return False
        return True  # cached current object with hashtag so probably ok
    # not cached, look for matching Coop or MUser
    if (not verify_hashtag_db(handler, dbobj, Coop) or
        not verify_hashtag_db(handler, dbobj, MUser)):
        morutil.srverr(handler, 400, "Hashtag already used by someone else.")
        return False
    return True


def uncache_hashtag(dbobj):
    if not dbobj.hashtag:
        return
    memcache.set(dbobj.hashtag, "")


def cache_hashtag(dbobj):
    if not dboj.hashtag:
        return
    memcache.set(dbobj.hashtag, dbobj.kind() + ":" + str(dbobj.key().id()))


def update_account_fields(handler, muser):
    hashtag = handler.request.get("hashtag") or ""
    hashtag = hashtag.lower()
    if hashtag and hashtag != muser.hashtag:
        uncache_hashtag(muser)
        muser.hashtag = hashtag
        if not verify_valid_unique_hashtag(handler, muser):
            return False  # error already reported
    # profpic uploaded separately
    muser.settings = handler.request.get("settings") or ""
    muser.coops = str(handler.request.get('coops')) or ""
    return True


def make_redirect_url_base(returnto, requrl):
    redurl = returnto
    if not redurl:
        redurl = requrl
        if redurl.find("?") >= 0:
            redurl = redurl[0:redurl.find("?")]
        if redurl.rfind("/") > 8:  #https://...
            redurl = redurl[0:redurl.rfind("/")]
    if "%3A" in redurl:
        redurl = urllib.unquote(redurl)
    redurl += "#"
    return redurl


class CreateAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        muser = MUser(email="placeholder", phash="whatever")  # corrected below
        cretime = nowISO()
        muser.created = cretime
        muser.modified = cretime
        muser.accessed = cretime
        if not update_email_and_password(self, muser):
            return  # error already reported
        if not update_account_fields(self, muser):
            return  # error already reported
        muser.preb = ""
        muser.profpic = None
        muser.put()  #nocache
        # force retrieval to hopefully minimize lag finding the new instance
        muser = MUser.get_by_id(int(muser.key().id()))
        bust_cache_key(muser.email)  # known but not cached. probably overkill
        token = token_for_user(muser)
        morutil.srvJSON(self, "[{\"token\":\"" + token + "\"}]")


class GetToken(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        emaddr = normalize_email(self.request.get('emailin') or "")
        muser = account_from_email(emaddr)
        if not muser:
            morutil.srverr(self, 401, "No account found for " + emaddr +  ".")
            return
        password = self.request.get('passin')
        ph = make_password_hash(emaddr, pwd, muser.created)
        if ph != muser.phash:
            morutil.srverr(self, 401, "No match for those credentials")
            return
        token = token_for_user(muser)
        if self.request.get('format') == "record":
            writeTextResponse("token: " + token + "\n", self.response)
        else:
            morutil.srvJSON(self, "[{\"token\":\"" + token + "\"}]")


class TokenAndRedirect(webapp2.RequestHandler):
    def post(self):
        requrl = self.request.url;
        if not verify_secure_comms(self, requrl):
            return
        redurl = make_redirect_url_base(self.request.get('returnto'), requrl)
        emaddr = normalize_email(self.request.get('emailin') or "")
        if not re.match(r"[^@]+@[^@]+\.[^@]+", emaddr):
            redurl += "loginerr=" + "Please enter a valid email address"
        else:  # have valid email
            bust_cache_key(emaddr)  # autologin has already failed
            muser = account_from_email(emaddr)
            if not muser:
                redurl += "emailin=" + email + "&loginerr=No account found"
            else:
                password = self.request.get('passin') or ""
                ph = make_password_hash(emaddr, pwd, muser.created)
                if ph != muser.phash:
                    redurl += "emailin=" + email + "&loginerr=Wrong password"
                else:
                    redurl += login_token_parameters(email, password)
        # preserve any state information passed in the params so they can
        # continue on their way after ultimately logging in.  If changing
        # these params, also check login.doNextStep
        command = self.request.get('command')
        if command and command != "chgpwd":
            redurl += "&command=" + command
        reqprof = self.request.get('reqprof')
        if reqprof:
            redurl += "&view=pen&penid=" + reqprof
        url = self.request.get('url')
        if url:
            redurl += "&url=" + urllib.quote(url)
        ps = ["special", "view", "profid", "penid", "revid", "coopid", "tab"]
        for param in ps:
            spec = self.request.get(param)
            if spec:
                redurl += "&" + param + "=" + spec
        logging.info("TokenAndRedirect " + redurl);
        self.redirect(str(redurl))


# This emails a link to access the app via the same token stored in the
# cookie or local storage.  The link will work until they change their
# password.  Client can choose convenience or immediate reset.
class MailPasswordReset(webapp2.RequestHandler):
    def post(self):
        eaddr = normalize_email(self.request.get('emailin') or "")
        if eaddr:
            content = "You requested your password be reset...\n\n"
            vq = VizQuery(MORAccount, "WHERE email=:1 LIMIT 9", eaddr)
            accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, 
                                deadline=10)
            if len(accounts) > 0:
                muser = accounts[0]
                content += "Use this link to access your account, then change "
                content += "your password in the settings: "
                content += "https://www.membic.org?view=profile"
                content += "&an=" + eaddr + "&at=" + token_for_user(muser)
                content += "\n\n"
            else:
                content += "The membic system found no account matching "
                content += eaddr + "\n"
                content += "Either you have not signed up yet, or you used "
                content += "a different email address.  To create an account "
                content += "visit https://www.membic.org\n\n"
            subj = "Membic.org account password reset"
            mailgun_send(self, eaddr, subj, content)
        morutil.srvJSON(self, "[]")


class UpdateAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, requrl):
            return  # error already reported
        account = authenticated(self.request)
        if not account:
            return morutil.srverr(self, 401, "Authentication failed")
        if not update_email_and_password(self, account):
            return  # error already reported
        if not update_account_fields(self, account):
            return  # error already reported
        account.modified = nowISO()
        account.put()  #nocache
        bust_cache_key(account.email)
        # retrieve updated version so subsequent calls get latest
        account = MORAccount.get_by_id(account.key().id())
        cache_hashtag(account)
        token = token_for_user(account)
        morutil.srvJSON(self, "[{\"token\":\"" + token + "\"}]")


class GetAccount(webapp2.RequestHandler):
    def get(self):
        account = authenticated(self.request)
        if not account:
            return morutil.srverr(self, 401, "Authentication failed")
        # actcode is delivered via activation email only
        morutil.srvObjs(self, [account], filts=["actcode"])


class SendActivationCode(webapp2.RequestHandler):
    def post(self):
        muser = authenticated(self.request)
        if not muser:
            return morutil.srverr(self, 401, "Authentication for send failed")
        if not muser.actcode:  # probably deactivated previously
            logging.info("SendActivationCode resetting actcode for MUser " +
                         str(muser.key().id()) + " (" + muser.email + ")")
            muser.actcode = random_alphanumeric(30)
        send_activation_code(self, muser)  # updates actsends
        muser.put()  #nocache
        bust_cache_key(account.email)
        # actcode is delivered via activation email only
        morutil.srvObjs(self.response, [muser], filts=["actcode"])


class ActivateAccount(webapp2.RequestHandler):
    def get(self):
        key = self.request.get('key')
        if key:
            code = self.request.get('code')
            if not code:
                return morutil.srverr(self, 412, "No activation code given")
            account = MUser.get_by_id(int(key))
            if not account:
                return morutil.srverr(self, 404, "Account key " + key + 
                                      " not found")
            if account.actcode != code:
                return morutil.srverr(self, 412, "Activation code not matched")
            account.status = "Active"
            account.put()
            bust_cache_key(account.email)
            self.response.headers['Content-Type'] = 'text/html'
            self.response.out.write("<!DOCTYPE html>\n<html>\n<head>\n<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">\n<title>membic.org Account Activation</title>\n</head>\n<body>\n<p>Your account has been activated!</p><p><a href=\"../?view=profsetpic\"><h2>Return to membic.org site</h2></a></p>\n</body></html>")
            return
        # no key, confirm account deactivation
        account = authenticated(self.request)
        status = self.request.get('status')
        if not account or status != "Inactive":
            return morutil.srverr(self, 412, "Invalid account deactivation")
        account.status = status  # Inactive
        account.actcode = ""
        account.actsends = ""
        account.put()
        bust_cache_key(account.email)
        morutil.srvObjs(self, [account])


app = webapp2.WSGIApplication([('.*/newacct', CreateAccount),
                               ('.*/toklogin', GetToken),
                               ('.*/redirlogin', TokenAndRedirect),
                               ('.*/mailpwr', MailPasswordReset),
                               ('.*/updacc', UpdateAccount),
                               ('.*/getacct', GetAccount),
                               ('.*/sendcode', SendActivationCode),
                               ('.*/activate', ActivateAccount)],
                              debug=True)
