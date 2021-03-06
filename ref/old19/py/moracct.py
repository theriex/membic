import webapp2
import datetime
from google.appengine.ext import db
import logging
from google.appengine.api import mail
from Crypto.Cipher import AES
import base64
import httplib
import urllib
import time
import json
from google.appengine.api.datastore_types import Blob
import consvc
from google.appengine.api import urlfetch
from morutil import *
from cacheman import *
import string
import random
import os


class MORAccount(db.Model):
    """ An account used for settings and native authentication """
    email = db.EmailProperty()          # required unless 3rd party auth
    password = db.StringProperty(required=True)
    status = db.StringProperty()        # Pending|Active|Inactive|Unreachable
    authsrc = db.StringProperty()       # AA:id or empty if native
    authconf = db.StringProperty(indexed=False)  # auth support
    modified = db.StringProperty()      # isodate
    mailbounce = db.TextProperty(required=False)   # isodate1,isodate2...
    actsends = db.TextProperty(required=False)  # isodate;emaddr,d2;e2...
    actcode = db.StringProperty(indexed=False)  # account activation code
    invites = db.TextProperty(required=False)   # theme invites JSON
    lastpen = db.IntegerProperty(required=False, indexed=False)  # runtime use
    

def asciienc(val):
    val = unicode(val)
    return val.encode('utf8')


def pwd2key(password):
    """ make a password into an encryption key """
    pwd = unicode(password)
    pwd = asciienc(pwd)
    # passwords have a min length of 6 so get at least 32 by repeating it
    key = str(pwd) * 6
    key = key[:32]
    return key


def newtoken(emaddr, password):
    """ Make a new token value and return it """
    key = pwd2key(password)
    token = ":" + str(int(round(time.time()))) + ":" + asciienc(emaddr)
    token = token.rjust(48, 'X')
    token = token[:48]
    token = AES.new(key, AES.MODE_CBC).encrypt(token)
    token = base64.b64encode(token)
    # logging.info("newtoken post base64encode: " + token)
    # token = urllib.quote(token)
    # logging.info("newtoken post urllib quote: " + token)
    token = token.replace("+", "-")
    token = token.replace("/", "_")
    token = token.replace("=", ".")
    # logging.info("   newtoken url safe value: " + token)
    return token


def decodeToken(key, token):
    # logging.info("decodeToken initial token: " + token)
    token = token.replace("-", "+")
    token = token.replace("_", "/")
    token = token.replace(".", "=")
    # logging.info(" decodeToken base64 value: " + token)
    # unquote1 = urllib.unquote(token)
    # logging.info("decodeToken urllib unquote: " + token)
    token = base64.b64decode(token)
    token = AES.new(key, AES.MODE_CBC).decrypt(token)
    return token


def call_server(url, meth, params):
    headers = {"Content-type": "application/x-www-form-urlencoded",
               "Accept": "text/plain"}
    sidx = url.find("/", 9)
    site = url[0:sidx]
    if site.startswith('https'):
        server = site[8:]
        conn = httplib.HTTPSConnection(server)
    else:
        server = site[7:]
        conn = httplib.HTTPConnection(server)
    url = url[sidx:]
    conn.request(meth, url, params, headers)
    response = conn.getresponse()
    data = response.read()
    logging.info(site + url + " " + meth + " " + str(response.status) + 
                 "\n" + data)
    if response.status == 200:
        data = json.loads(data)
    else:
        data = None
    conn.close()
    return data


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
        return
    vq = VizQuery(MORAccount, "WHERE email=:1 LIMIT 1", emaddr)
    accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(accounts) > 0:  # return error, probably forgot they signed up
        handler.error(422)  # Unprocessable Entity
        handler.response.out.write("Email address used already")
        return False
    return emaddr


# This only does numeric values.  If you need string vals then the value
# processing needs to be extended to handle embedded quotes
def extract_json_value(key, json):
    key = "\"" + key + "\":"
    idx = json.find(key)
    val = None
    if idx >= 0:
        val = json[idx + len(key):]
        val = val.strip(" ")
        val = val[1:]  # remove opening quote
        idx = val.find("\"")
        val = val[0:idx]
    return val


def authenticate_account(account, emaddr, token):
    key = pwd2key(account.password)
    token = decodeToken(key, token)
    if not token:
        logging.info("authacc em+tok: Token decode failed")
        return None
    try:
        unidx = token.index(asciienc(emaddr))
    except:
        unidx = -1
    if unidx <= 2:
        logging.info("authacc em+tok: Token email address not matched")
        return None
    secs = int(token[(token.index(":") + 1) : (unidx - 1)])
    now = int(round(time.time()))
    twelvehours = 12 * 60 * 60     # flip clock, hope not using then
    tokenlife = 90 * 24 * 60 * 60
    if now - secs > tokenlife + twelvehours:
        raise ValueError("Token expired")  # verbatim match in other code
    account._id = account.key().id() # normalized id access
    return account


def authenticated_account_email_plus_token(emaddr, token):
    emaddr = normalize_email(emaddr)
    account = get_cached_instance(emaddr)
    # debuginfo("authacc em+tok: account: " + str(account))
    if account and isinstance(account, MORAccount):
        account = authenticate_account(account, emaddr, token)
        if account:
            return account
    bust_cache_key(emaddr)
    vq = VizQuery(MORAccount, "WHERE email=:1 LIMIT 1", emaddr)
    qres = cached_query(emaddr, vq, "", 1, MORAccount, False)
    for account in qres.objects:
        account = authenticate_account(account, emaddr, token)
        if account:
            # replace cached QueryResult with account for direct access
            logging.info("Caching account for " + emaddr)
            put_cached_instance(emaddr, account)
            return account
    logging.info("authacc em+tok: No account found")
    return None


def authenticated(request):
    """ Return an account for the given auth type if the token is valid """
    acctype = request.get('am')
    if not acctype:
        return None
    emaddr = request.get('an')  # may be alternate value for 3rd party auth
    token = request.get('at')
    toksec = request.get('as')
    logging.info("moracct.py authenticated acctype: " + acctype + ", emaddr: " +
                 emaddr + ", token: " + token + ", toksec: " + toksec)
    if acctype == "mid":
        return authenticated_account_email_plus_token(emaddr, token)
    elif acctype == "fbid":
        usertoks = emaddr.split(' ')
        useridstr = str(usertoks[0])
        data = call_server("https://graph.facebook.com/me?access_token=" +
                           token, 'GET', None)
        if data and str(data["id"]) == useridstr:
            source = "fb:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            account._id = intz(useridstr)
            return account 
    elif acctype == "twid":
        svc = "https://api.twitter.com/1.1/account/verify_credentials.json"
        result = consvc.doOAuthGet("Twitter", svc, token, toksec)
        if result and (result.status_code == 200 or
                       result.status_code == 429 or 
                       result.status_code == 420):
            usertoks = emaddr.split(' ')
            useridstr = str(usertoks[0])
            source = "tw:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            account._id = intz(useridstr)
            return account
    elif acctype == "gsid":
        svc = "https://www.googleapis.com/plus/v1/people/me"
        svc += "?access_token=" + token
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
        result = urlfetch.fetch(svc, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        if result and result.status_code == 200:
            useridstr = extract_json_value("id", result.content)
            source = "gs:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            #Google ID is too big for an int, so use the string value.
            #Equality comparison tests should still work consistently
            account._id = useridstr
            return account
    elif acctype == "ghid":
        svc = "https://api.github.com/user?access_token=" + token
        headers = { 'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json' }
        result = urlfetch.fetch(svc, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        if result and result.status_code == 200:
            usertoks = emaddr.split(' ')
            useridstr = str(usertoks[0])
            source = "gh:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            account._id = intz(useridstr)
            return account
    else:
        logging.info("could not authenticate unknown account type: " + acctype)


def writeTextResponse(text, response):
    """ Factored method to write headers for plain text result """
    response.headers['Content-Type'] = 'text/plain'
    response.out.write(text)


def writeJSONResponse(jsontxt, response):
    """ Factored method to write headers for JSON result """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Content-Type'] = 'application/json'
    response.out.write(jsontxt)


def quoteTop20IDs(top20s):
    """ Quote the numeric ID refs so client gets string ID values """
    t20dict = {}
    if top20s:
        t20dict = json.loads(top20s)
    for revtype in t20dict:
        if revtype != "latestrevtype":
            stringifiedIDs = []
            t20ids = t20dict[revtype]
            for t20id in t20ids:
                stringifiedIDs.append(str(t20id))
            t20dict[revtype] = stringifiedIDs
    return json.dumps(t20dict)


def obj2JSON(obj):
    """ Factored method return a database object as JSON text """
    props = db.to_dict(obj)
    # logging.info("props: " + str(props))
    for prop, val in props.iteritems():
        if(isinstance(val, Blob)):
            props[prop] = str(obj.key().id())
        # javascript integer value cannot hold database integer value..
        if(isinstance(val, (int, long)) and (prop.endswith("id"))):
            props[prop] = str(props[prop])
        if(prop == "srcrev"):
            props[prop] = str(props[prop])
        if(prop == "top20s"):
            props[prop] = quoteTop20IDs(props[prop])
        if(prop == "preb" or prop == "preb2"):
            props[prop] = ""
        # logging.info(prop + ": " + str(props[prop]))
    jsontxt = json.dumps(props, True)
    jsontxt = "{\"_id\":\"" + str(obj.key().id()) + "\", " + jsontxt[1:]
    # logging.info(jsontxt)
    return jsontxt


def qres2JSON(queryResults, cursor="", fetched=-1, itemsep="\n"):
    """ Factored method to return query results as JSON """
    result = ""
    for obj in queryResults:
        if result:
            result += "," + itemsep + " "
        result += obj2JSON(obj)
    if cursor or fetched > 0:
        if result:
            result += "," + itemsep + " "
        result += "{\"fetched\":" + str(fetched) + \
            ", \"cursor\":\"" + cursor + "\"}"
    result = "[" + result + "]"
    return result


def returnJSON(response, queryResults, cursor="", fetched=-1):
    """ Factored method to respond back with JSON query results """
    result = qres2JSON(queryResults, cursor, fetched)
    writeJSONResponse(result, response)


def returnDictAsJSON(response, obj):
    """ Return a standard dictionary as a JSON encoded object """
    jsontxt = json.dumps(obj, True)
    # logging.info(jsontxt)
    writeJSONResponse("[" + jsontxt + "]", response)


def safe_json_loads(jstr):
    val = {}
    if not jstr:
        return val
    try:
        val = json.loads(jstr)
    except Exception as e:
        logging.info("safe_json_loads ignoring exception: " + str(e) +
                     "\njstr: " + jstr)
    return val


def safestr(val):
    if not val:
        return ""
    try:
        #str(val) yields ascii only. Review names are not all english.
        val = unicode(val)
    except Exception as e:
        logging.info("safestr exception: " + str(e))
        val = val.encode('ascii', 'xmlcharrefreplace')
        logging.info("safestr fallback encoding: " + val)
    return val


def onelinestr(val):
    val = safestr(val);
    val = val.replace("\n", " ")
    if len(val) > 255:
        val = val[:255]
    return val


def safeURIEncode(stringval, stripnewlines = False):
    if not stringval:
        stringval = ""
    if stripnewlines:
        stringval = ''.join(stringval.splitlines())
    return urllib.quote(stringval.encode("utf-8"))


# debug output doesn't show up in development log view, so this dumps it
# out at info level while making it easy to find and clean up noise later
def debuginfo(text):
    logging.info(text)


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


def login_token_parameters(email, password):
    token = newtoken(email, password)
    params = "authmethod=mid&authtoken=" + token +\
        "&authname=" + urllib.quote(asciienc(email))
    return params


def verify_secure_comms(handler, url):
    if url.startswith('https') or re.search("\:[0-9][0-9]80", url):
        return True
    handler.error(405)
    handler.response.out.write("request must be over https")
    return False


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


def send_activation_code(handler, account):
    account.actcode = random_alphanumeric(30)
    if account.actsends:
        account.actsends += ","
    else:
        account.actsends = ""
    account.actsends += nowISO() + ";" + account.email
    account.put()
    bust_cache_key(account.email)
    # host_url is a field that Request inherits from WebOb
    url = handler.request.host_url + "/activate?key=" +\
        str(account.key().id()) + "&code=" + account.actcode
    logging.info("Activate " + account.email + ": " + url)
    mailtxt = "Hello,\n\nWelcome to membic.org! Please click this link to confirm your email address and activate your account:\n\n" + url + "\n\n"
    mailgun_send(handler, account.email, "Account activation", mailtxt)
    return account


class CreateAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        emaddr = self.request.get('emailin') or ""
        emaddr = normalize_email(emaddr)
        if not valid_new_email_address(self, emaddr):
            return
        pwd = self.request.get('passin')
        if not pwd or len(pwd) < 6:
            self.error(412)
            self.response.out.write("Password must be at least 6 characters")
            return
        account = MORAccount(email=emaddr, password=pwd)
        account.authsrc = ""
        account.modified = nowISO()
        account.mailbounce = ""
        account.authconf = ""
        account.put()  #nocache
        # force retrieval to hopefully minimize lag finding the new instance
        account = MORAccount.get_by_id(int(account.key().id()))
        bust_cache_key(account.email)
        token = newtoken(emaddr, pwd)
        writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)


class GetToken(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        emaddr = self.request.get('emailin') or ""
        emaddr = normalize_email(emaddr)
        password = self.request.get('passin')
        where = "WHERE email=:1 AND password=:2 LIMIT 1"
        vq = VizQuery(MORAccount, where, emaddr, password)
        accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(accounts) > 0:
            token = newtoken(emaddr, password)
            if self.request.get('format') == "record":
                writeTextResponse("token: " + token + "\n", 
                                  self.response)
            else:
                writeJSONResponse("[{\"token\":\"" + token + "\"}]", 
                                  self.response)
        else:
            self.error(401)
            self.response.out.write("No match for those credentials")


class TokenAndRedirect(webapp2.RequestHandler):
    def post(self):
        requrl = self.request.url;
        if not verify_secure_comms(self, requrl):
            return
        redurl = make_redirect_url_base(self.request.get('returnto'), requrl)
        email = self.request.get('emailin') or ""
        email = normalize_email(email)
        password = self.request.get('passin') or ""
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            redurl += "loginerr=" + "Please enter a valid email address"
        else:  # have valid email
            bust_cache_key(email)  # autologin has already failed
            vq = VizQuery(MORAccount, "WHERE email=:1 LIMIT 1", email)
            qres = cached_query(email, vq, "", 1, MORAccount, False)
            if len(qres.objects) == 0:
                redurl += "emailin=" + email + "&loginerr=Not registered"
            elif qres.objects[0].password != password:
                redurl += "emailin=" + email + "&loginerr=Wrong password"
            else:
                redurl += login_token_parameters(email, password)
        # preserve any state information passed in the params so they can
        # continue on their way after ultimately logging in.  If changing
        # these params, also check login.doNextStep
        command = self.request.get('command')
        if command and command != "chgpwd":
            redurl += "&command=" + command
        special = self.request.get('special')
        if special:
            redurl += "&special=" + special
        reqprof = self.request.get('reqprof')
        if reqprof:
            redurl += "&view=pen&penid=" + reqprof
        view = self.request.get('view')
        if view:
            redurl += "&view=" + view
        profid = self.request.get('profid')
        if profid:
            redurl += "&profid=" + profid
        penid = self.request.get('penid')
        if penid:
            redurl += "&penid=" + penid
        revid = self.request.get('revid')
        if revid:
            redurl += "&revid=" + revid
        coopid = self.request.get('coopid')
        if coopid:
            redurl += "&coopid=" + coopid
        tab = self.request.get('tab')
        if tab:
            redurl += "&tab=" + tab
        url = self.request.get('url')
        if url:
            redurl += "&url=" + urllib.quote(url)
        logging.info("TokenAndRedirect " + redurl);
        self.redirect(str(redurl))


class MailCredentials(webapp2.RequestHandler):
    def post(self):
        eaddr = self.request.get('emailin')
        if eaddr:
            content = "You requested your password be mailed to you..."
            content += "\n\nThe membic system has looked up " + eaddr + " "
            eaddr = eaddr.lower()
            vq = VizQuery(MORAccount, "WHERE email=:1 LIMIT 9", eaddr)
            accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, 
                                deadline=10)
            if len(accounts) > 0:
                content += "and your password is " + accounts[0].password
            else:
                content += "but found no matching accounts." +\
                    "\nEither you have not signed up yet, or you used" +\
                    " a different email address."
            content += "\n\nhttps://www.membic.org\n\n"
            mailgun_send(self, eaddr, "Membic.org account login", content)
        writeJSONResponse("[]", self.response)


class UpdateAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not (url.startswith('https') or ":8080" in url):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        pwd = self.request.get('password')
        if pwd and len(pwd) < 6:
            self.error(412)  # precondition failed
            self.response.out.write("Password must be at least 6 characters")
            return
        account = authenticated(self.request)
        if account:
            mailaddresschanged = False
            if pwd:
                account.password = pwd
            emaddr = self.request.get('email') or account.email
            emaddr = normalize_email(emaddr)
            if emaddr != account.email:
                if not valid_new_email_address(self, emaddr):
                    return srverr(self, 400, "Invalid email address")
                account.email = emaddr
                account.status = "Pending"
                account.actsends = ""
                account.actcode = ""
                mailaddresschanged = True
            account.modified = nowISO()
            account.authconf = account.authconf or ""
            account.put()  #nocache
            bust_cache_key(account.email)
            # retrieve updated version so all calls from here on will find it
            account = MORAccount.get_by_id(account.key().id())
            token = newtoken(account.email, account.password)
            writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)
        else:
            self.error(401)
            self.response.out.write("Authentication failed")


class GetAccount(webapp2.RequestHandler):
    def get(self):
        account = authenticated(self.request)
        if account:
            account.password = "WriteOnlyFieldCannotBeEmptySoUsePlaceholder"
            account.actcode = ""  # don't show activation code to client
            returnJSON(self.response, [ account ])
        else:
            self.error(401)
            self.response.out.write("Authentication failed")


class SendActivationCode(webapp2.RequestHandler):
    def post(self):
        account = authenticated(self.request)
        if not account:
            self.error(401)
            self.response.out.write("SendActivationCode authentication failed")
            return
        account = send_activation_code(self, account)
        returnJSON(self.response, [ account ])


class ActivateAccount(webapp2.RequestHandler):
    def get(self):
        key = self.request.get('key')
        if key:
            key = int(key)
            code = self.request.get('code')
            if not code:
                self.error(412)
                self.response.out.write("No activation code given")
                return
            account = MORAccount.get_by_id(key)
            if not account:
                self.error(404)
                self.response.out.write("Account " + key + " not found")
                return
            if account.actcode != code:
                self.error(412)
                self.response.out.write("Activation code does not match")
                return
            account.status = "Active"
            account.put()
            bust_cache_key(account.email)
            self.response.headers['Content-Type'] = 'text/html'
            self.response.out.write("<!DOCTYPE html>\n<html>\n<head>\n<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">\n<title>membic.org Account Activation</title>\n</head>\n<body>\n<p>Your account has been activated!</p><p><a href=\"../?view=profsetpic\"><h2>Return to membic.org site</h2></a></p>\n</body></html>")
            return
        # no key, retrieve authenticated account
        account = authenticated(self.request)
        status = self.request.get('status')
        if not account or status != "Inactive":
            self.error(412)
            self.response.out.write("Invalid account deactivation")
            return
        account.status = "Inactive"
        account.actcode = ""
        account.actsends = ""
        account.put()
        bust_cache_key(account.email)
        returnJSON(self.response, [ account ])


class GetBuildVersion(webapp2.RequestHandler):
    def get(self):
        writeTextResponse("BUILDVERSIONSTRING", self.response)


app = webapp2.WSGIApplication([('.*/newacct', CreateAccount),
                               ('.*/toklogin', GetToken),
                               ('.*/redirlogin', TokenAndRedirect),
                               ('.*/mailcred', MailCredentials),
                               ('.*/updacc', UpdateAccount),
                               ('.*/getacct', GetAccount),
                               ('.*/sendcode', SendActivationCode),
                               ('.*/activate', ActivateAccount),
                               ('.*/buildverstr', GetBuildVersion)], 
                              debug=True)

