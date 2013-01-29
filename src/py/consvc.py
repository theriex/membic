import webapp2
from google.appengine.ext import db
from google.appengine.api import images
import logging

from time import time
from random import getrandbits
from hashlib import sha1
import hmac
from google.appengine.api import urlfetch
import urllib


class ConnectionService(db.Model):
    """ Connection tokens for other sites """
    # Unique name of this connection service
    name = db.StringProperty(required=True)
    # The consumer key for oauth1
    ckey = db.StringProperty(required=True)
    # The consumer secret for oauth1
    secret = db.StringProperty(required=True)


def getConnectionService(svcname):
    where = "WHERE name=:1 LIMIT 1"
    svcs = ConnectionService.gql(where, svcname)
    for svc in svcs:
        return svc
    # no service found, create a stub instance for later editing
    svc = ConnectionService(name=svcname, ckey="unknown", secret="unknown")
    svc.put()
    return svc


def enc(text):
    # explicitely pass an empty set of safe characters so forward slash
    # gets translated to "%
    return urllib.quote(str(text), "")


def makeParamHash(svc, request):
    # oauth parameters common to all calls:
    params = {
        "oauth_consumer_key": svc.ckey,
        "oauth_nonce": str(getrandbits(64)),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time())),
        "oauth_version": "1.0" }
    # include callback url if given.  This is encoded later
    callback = request.get('oauth_callback')
    if callback:
        params['oauth_callback'] = callback
    # include request token if given
    token = request.get('oauth_token')
    if token:
        params['oauth_token'] = token
    # include verifier if provided (necesssary for signing)
    verifier = request.get('oauth_verifier')
    if verifier:
        params['oauth_verifier'] = verifier
    # convert all param info into unicode if not already
    for k, v in params.items():
        if isinstance(v, unicode):
            params[k] = v.encode('utf8')
    return params


def addOAuthSig(meth, svc, toksec, url, params):
    # join all the parameters together 
    params_str = "&".join(["%s=%s" % (enc(k), enc(params[k]))
                           for k in sorted(params)])
    # logging.info("addOAuthSig params_str: " + params_str)
    # join the whole message together into a base string to be signed
    message = "&".join([meth, enc(url), enc(params_str)])
    # logging.info("base string for signature: " + message)
    # signing key is encoded consumer secret + "&" + encoded OAuth
    # token secret where the OAuth token secret may be an empty string
    key = "%s&%s" % (enc(svc.secret), enc(toksec))
    # logging.info("addOAuthSig key: " + key)
    # add the signature to the message parameters
    signature = hmac.new(key, message, sha1)
    b64digest = signature.digest().encode("base64").strip()
    #logging.info("base string signature: " + b64digest)
    params["oauth_signature"] = b64digest


def doOAuthCall(url, params, httpverb):
    authstr = ""
    for k in sorted(params):
        igparam = k.startswith('oauth_verifier')
        igparam = igparam or k.startswith('include_entities')
        if k.startswith('oauth_') and not igparam:
            if(authstr):
                authstr += ", "
            else:
                authstr = "OAuth "
            authstr += k + "=\"" + enc(params[k]) + "\""
    logging.info("doOAuthCall authstr: " + authstr)
    payload = None
    if 'oauth_verifier' in params:
        payload = "oauth_verifier=" + params['oauth_verifier']
    if httpverb == "GET":
        for k in sorted(params):
            if not k.startswith('oauth_'):
                if not "?" in url:
                    url += "?"
                else:
                    url += "&"
                url += k + "=" + enc(params[k])
    headers = { 'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authstr }
    logging.info("doOAuthCall url: " + url)
    result = urlfetch.fetch(url, payload=payload, method=httpverb, 
                            headers=headers,
                            allow_truncated=False, 
                            follow_redirects=True, 
                            deadline=10, 
                            validate_certificate=False)
    logging.info("doOAuthCall " + str(result.status_code) + ": " +
                 result.content)
    return result


def doOAuthGet(svcname, url, token, toksec):
    logging.info("doOAuthGet " + svcname + " " + url + " token: " + token + 
                 " toksec: " + toksec)
    svc = getConnectionService(svcname)
    params = {
        "oauth_consumer_key": svc.ckey,
        "oauth_nonce": str(getrandbits(64)),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time())),
        "oauth_version": "1.0",
        "oauth_token": token,
        "include_entities": "true" }
    addOAuthSig("GET", svc, toksec, url, params)
    return doOAuthCall(url, params, "GET")


def doOAuthPost(url, params):
    return doOAuthCall(url, params, "POST")


# params: name, oauth_callback, oauth_verifier
class OAuth1Call(webapp2.RequestHandler):
    def post(self):
        svcname = self.request.get('name')
        svcurl = self.request.get('url')
        toksec = self.request.get('toksec')
        if not toksec:
            toksec = ""
        logging.info("svcname: " + svcname)
        svc = getConnectionService(svcname)
        params = makeParamHash(svc, self.request)
        addOAuthSig("POST", svc, toksec, svcurl, params)
        result = doOAuthPost(svcurl, params)
        if result.status_code == 200:
            json = "[{\"content\":\"" + result.content + "\"}]"
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json)
        else:
            self.error(result.status_code)
            self.response.out.write(result.content)


class JSONGet(webapp2.RequestHandler):
    def get(self):
        geturl = self.request.get('geturl')
        whitelist = [ "https://www.googleapis.com",
                      "https://api.github.com",
                      "http://gdata.youtube.com" ]
        whitelisted = False
        for url in whitelist:
            if geturl.startswith(url):
                whitelisted = True
        if not whitelisted:
            self.error(403)
            self.response.out.write("Not a recognized ok endpoint")
            return
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
        result = urlfetch.fetch(geturl, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        if result.status_code == 200:
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(result.content)
        else:
            self.error(result.status_code)
            self.response.out.write(result.content)


class GitHubToken(webapp2.RequestHandler):
    def get(self):
        code = self.request.get('code')
        state = self.request.get('state')
        svc = getConnectionService("GitHub")
        url = "https://github.com/login/oauth/access_token"
        headers = { 'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json' }
        payload = "client_id=" + svc.ckey;
        payload += "&client_secret=" + svc.secret;
        payload += "&code=" + code
        payload += "&state=" + state
        result = urlfetch.fetch(url, payload=payload, method="POST",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        logging.info("doOAuthCall " + str(result.status_code) + ": " +
                     result.content)
        if result.status_code == 200:
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(result.content)
        else:
            self.error(result.status_code)
            self.response.out.write(result.content)


app = webapp2.WSGIApplication([('/oa1call', OAuth1Call),
                               ('/jsonget', JSONGet),
                               ('/githubtok', GitHubToken)], 
                              debug=True)

