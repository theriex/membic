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
from consvc import doOAuthGet
from google.appengine.api import urlfetch
from morutil import *


class MORAccount(db.Model):
    """ An account used for settings and native authentication """
    email = db.EmailProperty()          # required unless 3rd party auth
    password = db.StringProperty(required=True)
    authsrc = db.StringProperty()       # AA:id or empty if native
    modified = db.StringProperty()      # iso date
    lastsummary = db.StringProperty()   # iso date last summary run
    summaryfreq = db.StringProperty()   # daily, weekly, fortnightly, never
    summaryflags = db.StringProperty()  # sumiflogin, sumifnoact
    mailbounce = db.TextProperty()      # isodate1, isodate2...
    

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
    token = token.rjust(32, 'X')
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


def authenticated(request):
    """ Return an account for the given auth type if the token is valid """
    acctype = request.get('am')
    emaddr = request.get('an')  # may be alternate value for 3rd party auth
    token = request.get('at')
    toksec = request.get('as')
    logging.info("moracct.py authenticated acctype: " + acctype + ", emaddr: " +
                 emaddr + ", token: " + token + ", toksec: " + toksec)
    if acctype == "mid":
        emaddr = emaddr.lower()
        where = "WHERE email=:1 LIMIT 1"
        accounts = MORAccount.gql(where, emaddr)
        logging.info("moracct.py authenticated found " + str(accounts.count()) +
                     " accounts for emaddr: " + emaddr)
        for account in accounts:
            key = pwd2key(account.password)
            token = decodeToken(key, token)
            if not token:
                return False
            try:
                unidx = token.index(asciienc(emaddr))
            except:
                unidx = -1
            if unidx <= 2:
                return False
            secs = int(token[(token.index(":") + 1) : (unidx - 1)])
            now = int(round(time.time()))
            twelvehours = 12 * 60 * 60     # flip clock hope not active then
            tokenlife = 90 * 24 * 60 * 60
            if now - secs > tokenlife + twelvehours:
                return False
            account._id = account.key().id() # normalized id access
            return account  # True
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
        result = doOAuthGet("Twitter", svc, token, toksec)
        if result and result.status_code == 200:
            usertoks = emaddr.split(' ')
            useridstr = str(usertoks[0])
            source = "tw:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            account._id = intz(useridstr)
            return account
    elif acctype == "gsid":
        svc = "https://www.googleapis.com/oauth2/v1/tokeninfo"
        svc += "?access_token=" + token
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
        result = urlfetch.fetch(svc, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        ok = result and result.status_code == 200
        ok = ok and "1009259210423.apps.googleusercontent.com" in result.content
        if ok:
            usertoks = emaddr.split(' ')
            useridstr = str(usertoks[0])
            source = "gs:" + useridstr
            account = MORAccount(authsrc=source, password=token)
            #Google ID is too big for an int, so use the string value
            #equality comparison tests should still work consistently
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
        if(prop == "top20s"):
            props[prop] = quoteTop20IDs(props[prop])
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


def verify_secure_comms(handler, url):
    if url.startswith('https') or re.search("\:[0-9][0-9]80", url):
        return True
    handler.error(405)
    handler.response.out.write("request must be over https")
    return False


class CreateAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        emaddr = self.request.get('emailin') or ""
        emaddr = emaddr.lower()
        # something @ something . something
        if not re.match(r"[^@]+@[^@]+\.[^@]+", emaddr):
            self.error(412)
            self.response.out.write("invalid email address")
            return
        where = "WHERE email=:1 LIMIT 1"
        accounts = MORAccount.gql(where, emaddr)
        found = accounts.count()
        if found:  # return error. Client can choose to try login if they want
            self.error(412)
            self.response.out.write("Account exists already")
            return
        pwd = self.request.get('passin')
        if not pwd or len(pwd) < 6:
            self.error(412)
            self.response.out.write("Password must be at least 6 characters")
            return
        account = MORAccount(email=emaddr, password=pwd)
        account.authsrc = ""
        account.modified = nowISO()
        account.lastsummary = nowISO()
        account.summaryfreq = "weekly"
        account.summaryflags = ""
        account.mailbounce = ""
        account.put()  #nocache
        token = newtoken(emaddr, pwd)
        writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)


class GetToken(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        emaddr = self.request.get('emailin') or ""
        emaddr = emaddr.lower()
        password = self.request.get('passin')
        where = "WHERE email=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, emaddr, password)
        found = accounts.count()
        if found:
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
        url = self.request.url;
        if not verify_secure_comms(self, url):
            return
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = url
            if redurl.find("?") >= 0:
                redurl = redurl[0:redurl.find("?")]
            if redurl.rfind("/") > 8:  #https://...
                redurl = redurl[0:redurl.rfind("/")]
        if "%3A" in redurl:
            redurl = urllib.unquote(redurl)
        redurl += "#"
        email = self.request.get('emailin')
        if not email or len(email) < 1:
            redurl += "loginerr=" + "No email address specified"
        else:
            email = email.lower()
            password = self.request.get('passin')
            where = "WHERE email=:1 AND password=:2 LIMIT 1"
            accounts = MORAccount.gql(where, email, password)
            found = accounts.count()
            if found:
                token = newtoken(email, password)
                redurl += "authmethod=mid&authtoken=" + token
                redurl += "&authname=" + urllib.quote(asciienc(email))
            else:
                redurl += "emailin=" + email + "&loginerr=" +\
                    "No match for those credentials"
        # preserve any state information passed in the params so they can
        # continue on their way after ultimately loggin in.  If changing
        # these params, also check login.doneWorkingWithAccount
        command = self.request.get('command')
        if command and command != "chgpwd":
            redurl += "&command=" + command
        special = self.request.get('special')
        if special:
            redurl += "&special=" + special
        reqprof = self.request.get('reqprof')
        if reqprof:
            redurl += "&view=profile&profid=" + reqprof
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
        groupid = self.request.get('groupid')
        if groupid:
            redurl += "&groupid=" + groupid
        url = self.request.get('url')
        if url:
            redurl += "&url=" + urllib.quote(url)
        logging.info("TokenAndRedirect " + redurl);
        self.redirect(str(redurl))


class GetLoginID(webapp2.RequestHandler):
    def post(self):
        emaddr = self.request.get('emailin') or ""
        emaddr = emaddr.lower()
        password = self.request.get('passin')
        where = "WHERE email=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, emaddr, password)
        redurl = "http://www.fgfweb.com?mid="
        for account in accounts:
            redurl += str(account.key().id())
        self.redirect(redurl)
            

class MailCredentials(webapp2.RequestHandler):
    def post(self):
        eaddr = self.request.get('emailin')
        if eaddr:
            content = "You requested your password be mailed to you..."
            content += "\n\nFGFweb has looked up " + eaddr + " "
            eaddr = eaddr.lower()
            where = "WHERE email=:1 LIMIT 9"
            accounts = MORAccount.gql(where, eaddr)
            found = accounts.count()
            if found:
                content += "and your password is " + accounts[0].password
            else:
                content += "but found no matching accounts." +\
                    "\nEither you have not signed up yet, or you signed in" +\
                    " via a social net before and did not provide an" +\
                    " email address."
            content += "\n\nhttps://www.fgfweb.com\n\n"
            if re.search("\:[0-9][0-9]80", self.request.url):
                logging.info("Mail not sent to " + eaddr + " from local dev" +
                             "\n\n" + content)
            else:
                logging.info("mailing password to " + eaddr)
                # sender needs to be a valid email address.  This should
                # change to noreply@fgfweb.com if traffic gets bad
                mail.send_mail(
                    sender="FGFweb support <admin@fgfweb.com>",
                    to=eaddr,
                    subject="FGFweb account login",
                    body=content)
        writeJSONResponse("[]", self.response)


class ChangePassword(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not (url.startswith('https') or ":8080" in url):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        pwd = self.request.get('pass')
        if pwd and len(pwd) < 6:
            self.error(412)
            self.response.out.write("Password must be at least 6 characters")
            return
        account = authenticated(self.request)
        if account:
            if pwd:
                account.password = pwd
            mailval = (self.request.get('email') or "").lower()
            if not mailval:
                mailval = None
            account.email = mailval
            if not account.lastsummary:
                account.lastsummary = nowISO()
            account.summaryfreq = self.request.get('sumfreq') or "weekly"
            account.summaryflags = self.request.get('sumflags') or ""
            account.modified = nowISO()
            account.put()  #nocache
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
            returnJSON(self.response, [ account ])
        else:
            self.error(401)
            self.response.out.write("Authentication failed")


class GetBuildVersion(webapp2.RequestHandler):
    def get(self):
        writeTextResponse("BUILDVERSIONSTRING", self.response)


app = webapp2.WSGIApplication([('/newacct', CreateAccount),
                               ('/login', GetToken),
                               ('/redirlogin', TokenAndRedirect),
                               ('/mailcred', MailCredentials),
                               ('/chgpwd', ChangePassword),
                               ('/loginid', GetLoginID),
                               ('/getacct', GetAccount),
                               ('/buildverstr', GetBuildVersion)], debug=True)

