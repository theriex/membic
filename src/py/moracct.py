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
import re
import json
from google.appengine.api.datastore_types import Blob
from consvc import doOAuthGet
from google.appengine.api import urlfetch


def pwd2key(password):
    """ make a password into an encryption key """
    pwd = str(password)
    # passwords have a min length of 6 so get at least 32 by repeating it
    key = str(pwd) * 6
    key = key[:32]
    return key


def newtoken(username, password):
    """ Make a new token value and return it """
    key = pwd2key(password)
    token = ":" + str(int(round(time.time()))) + ":" + username
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
    username = request.get('an')
    token = request.get('at')
    toksec = request.get('as')
    if acctype == "mid":
        where = "WHERE username=:1 LIMIT 1"
        accounts = MORAccount.gql(where, username)
        for account in accounts:
            key = pwd2key(account.password)
            token = decodeToken(key, token)
            unidx = token.index(username)
            if not token or unidx <= 2:
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
        usertoks = username.split(' ')
        useridstr = str(usertoks[0])
        data = call_server("https://graph.facebook.com/me?access_token=" +
                           token, 'GET', None)
        if data and str(data["id"]) == useridstr:
            account = MORAccount(username=useridstr, password=token)
            account._id = intz(useridstr)
            return account 
    elif acctype == "twid":
        svc = "https://api.twitter.com/1.1/account/verify_credentials.json"
        result = doOAuthGet("Twitter", svc, token, toksec)
        if result and result.status_code == 200:
            usertoks = username.split(' ')
            useridstr = str(usertoks[0])
            account = MORAccount(username=useridstr, password=token)
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
            usertoks = username.split(' ')
            useridstr = str(usertoks[0])
            account = MORAccount(username=useridstr, password=token)
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
            usertoks = username.split(' ')
            useridstr = str(usertoks[0])
            account = MORAccount(username=useridstr, password=token)
            account._id = intz(useridstr)
            return account
    else:
        logging.info("could not authenticate unknown account type: " + acctype)


def dt2ISO(dt):
    iso = str(dt.year) + "-" + str(dt.month).rjust(2, '0') + "-"
    iso += str(dt.day).rjust(2, '0') + "T" + str(dt.hour).rjust(2, '0')
    iso += ":" + str(dt.minute).rjust(2, '0') + ":"
    iso += str(dt.second).rjust(2, '0') + "Z"
    return iso


def nowISO():
    """ Return the current time as an ISO string """
    return dt2ISO(datetime.datetime.utcnow())


def canonize(strval):
    """ Convert to lower case and remove all whitespace """
    strval = re.sub(r"\s+", "", strval)
    strval = strval.lower();
    return strval


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


def returnJSON(response, queryResults, cursor="", fetched=-1):
    """ Factored method to return query results as JSON """
    result = ""
    for obj in queryResults:
        if result:
            result += ",\n "
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
        result += jsontxt
    if cursor or fetched > 0:
        if result:
            result += ",\n "
        result += "{\"fetched\":" + str(fetched) + \
            ", \"cursor\":\"" + cursor + "\"}"
    result = "[" + result + "]"
    writeJSONResponse(result, response)


def returnDictAsJSON(response, obj):
    """ Return a standard dictionary as a JSON encoded object """
    jsontxt = json.dumps(obj, True)
    # logging.info(jsontxt)
    writeJSONResponse("[" + jsontxt + "]", response)


def intz(val):
    if not val:
        return 0
    if isinstance(val, basestring) and val.startswith("\""):
        val = val[1:len(val) - 1]
    return int(val)


def safestr(val):
    if not val:
        return ""
    try:
        val = str(val)
    except:
        val = val.encode('ascii', 'xmlcharrefreplace')
    return val


def safeURIEncode(stringval, stripnewlines = False):
    if not stringval:
        stringval = ""
    if stripnewlines:
        stringval = ''.join(stringval.splitlines())
    return urllib.quote(stringval.encode("utf-8"))


class MORAccount(db.Model):
    """ An account used for local (as opposed to 3rd party) authentication """
    username = db.StringProperty(required=True)
    password = db.StringProperty(required=True)
    email = db.EmailProperty()
    modified = db.StringProperty()  # iso date


class WriteAccount(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not (url.startswith('https') or url.startswith('http://localhost')):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        user = self.request.get('user')
        if len(user) > 18:
            self.error(412)
            self.response.out.write("username must be 18 characters or less")
            return
        where = "WHERE username=:1 LIMIT 1"
        accounts = MORAccount.gql(where, user)
        found = accounts.count()
        if found:
            self.error(412)
            self.response.out.write("The account name " + user + 
                                    " is already taken")
            return
        pwd = self.request.get('pass')
        if not pwd or len(pwd) < 6:
            self.error(412)
            self.response.out.write("Password must be at least 6 characters")
            return
        acct = MORAccount(username=user, password=pwd)
        email = self.request.get('email')
        if email:
            acct.email = email
        acct.modified = nowISO()
        acct.put()
        token = newtoken(user, pwd)
        writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)


class GetToken(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not (url.startswith('https') or url.startswith('http://localhost')):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        username = self.request.get('user')
        password = self.request.get('pass')
        where = "WHERE username=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, username, password)
        found = accounts.count()
        # logging.info("GetToken found " + str(found) + " for " + username)
        if found:
            token = newtoken(username, password)
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
        if not (url.startswith('https') or ":8080" in url):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.myopenreviews.com"
        if "http%3A" in redurl:
            redurl = urllib.unquote(redurl)
        redurl += "#"
        username = self.request.get('userin')
        password = self.request.get('passin')
        where = "WHERE username=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, username, password)
        found = accounts.count()
        if found:
            token = newtoken(username, password)
            redurl += "authmethod=mid&authtoken=" + token
            redurl += "&authname=" + username
        else:
            redurl += "loginerr=" + "No match for those credentials"
        # if changing these params, also check login.doneWorkingWithAccount
        command = self.request.get('command')
        if command and command != "chgpwd":
            redurl += "&command=" + command
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
        url = self.request.get('url')
        if url:
            redurl += "&url=" + urllib.quote(url)
        logging.info("TokenAndRedirect " + redurl);
        self.redirect(str(redurl))


class GetLoginID(webapp2.RequestHandler):
    def post(self):
        username = self.request.get('userin')
        password = self.request.get('passin')
        where = "WHERE username=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, username, password)
        redurl = "http://www.myopenreviews.com?mid="
        for account in accounts:
            redurl += str(account.key().id())
        self.redirect(redurl)
            

class MailCredentials(webapp2.RequestHandler):
    def post(self):
        eaddr = self.request.get('email')
        if eaddr:
            where = "WHERE email=:1 LIMIT 1"
            accounts = MORAccount.gql(where, eaddr)
            for account in accounts:
                logging.info("mailing " + account.username + 
                             " credentials to " + account.email)
                content = "Username: " + account.username
                content += "\nPassword: " + account.password + "\n"
                # sender needs to be a valid email address.  This should
                # change to noreply@myopenreviews.com if traffic gets bad
                if not self.request.url.startswith('http://localhost'):
                    mail.send_mail(
                        sender="MyOpenReviews support <theriex@gmail.com>",
                        to=account.email,
                        subject="MyOpenReviews account login",
                        body=content)
        writeJSONResponse("[]", self.response)


class ChangePassword(webapp2.RequestHandler):
    def post(self):
        url = self.request.url;
        if not (url.startswith('https') or url.startswith('http://localhost')):
            self.error(405)
            self.response.out.write("request must be over https")
            return
        pwd = self.request.get('pass')
        if not pwd or len(pwd) < 6:
            self.error(412)
            self.response.out.write("Password must be at least 6 characters")
            return
        account = authenticated(self.request)
        if pwd and account:
            email = self.request.get('email')
            if email:
                account.email = email
            account.modified = nowISO()
            account.password = pwd
            account.put()
            token = newtoken(account.username, account.password)
            writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)
        else:
            self.error(401)
            self.response.out.write("Authentication failed")



app = webapp2.WSGIApplication([('/newacct', WriteAccount),
                               ('/login', GetToken),
                               ('/redirlogin', TokenAndRedirect),
                               ('/mailcred', MailCredentials),
                               ('/chgpwd', ChangePassword),
                               ('/loginid', GetLoginID)], debug=True)

