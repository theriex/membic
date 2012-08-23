import webapp2
import datetime
from google.appengine.ext import db
import logging
from google.appengine.api import mail
from Crypto.Cipher import AES
import base64
# import urllib
import time
import re
import json
from google.appengine.api.datastore_types import Blob

def pwd2key(password):
    """ make a password into an encryption key """
    # passwords have a min length of 6 so get at least 32 by repeating it
    key = password * 6
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


def authenticated(request):
    """ Return an account for the given auth type if the token is valid """
    type = request.get('am')
    username = request.get('an')
    token = request.get('at')
    if type == "mid":
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
            if now - secs > 3600:
                return False
            account._id = account.key().id() # normalized id access
            return account  # True
    # elif type == "fbid":
    #     # call to verify token, return a stub account if successful
    # elif type == "twid":
    #     # call to verify token, return a stub account if successful
    # elif type == "gid":
    #     # call to verify token, return a stub account if successful


def nowISO():
    """ Return the current time as an ISO string """
    now = datetime.datetime.utcnow()
    iso = str(now.year) + "-" + str(now.month).rjust(2, '0') + "-"
    iso += str(now.day).rjust(2, '0') + "T" + str(now.hour).rjust(2, '0')
    iso += ":" + str(now.minute).rjust(2, '0') + ":"
    iso += str(now.second).rjust(2, '0') + "Z"
    return iso


def canonize(strval):
    """ Convert to lower case and remove all whitespace """
    strval = re.sub(r"\s+", "", strval)
    strval = strval.lower();
    return strval


def writeJSONResponse(jsontxt, response):
    """ Factored method to write headers for JSON result """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Content-Type'] = 'application/json'
    response.out.write(jsontxt)


def returnJSON(response, queryResults, cursor="", checked=-1):
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
            # logging.info(prop + ": " + str(props[prop]))
        jsontxt = json.dumps(props, True)
        jsontxt = "{\"_id\":" + str(obj.key().id()) + ", " + jsontxt[1:]
        # logging.info(jsontxt)
        result += jsontxt
    if cursor or checked > 0:
        if result:
            result += ",\n "
        result += "{\"checked\":" + str(checked) + \
            ", \"cursor\":\"" + cursor + "\"}"
    result = "[" + result + "]"
    writeJSONResponse(result, response)


def intz(val):
    if not val:
        return 0
    return int(val)


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
        # logging.info("found " + str(found) + " for " + username)
        if found:
            token = newtoken(username, password)
            writeJSONResponse("[{\"token\":\"" + token + "\"}]", self.response)
        else:
            self.error(401)
            self.response.out.write("No match for those credentials")


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
                               ('/mailcred', MailCredentials),
                               ('/chgpwd', ChangePassword)], debug=True)

