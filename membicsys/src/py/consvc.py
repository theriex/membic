import webapp2
from google.appengine.ext import db
from google.appengine.api import images
import logging

from time import time
from random import getrandbits
from hashlib import sha1
from hashlib import sha256
import hmac
from google.appengine.api import urlfetch
import urllib
import datetime
from base64 import b64encode
from cacheman import *
from google.appengine.api import memcache


class ConnectionService(db.Model):
    """ Connection tokens for other sites """
    # Unique name of this connection service
    name = db.StringProperty(required=True)
    # The consumer key for oauth1
    ckey = db.StringProperty(required=True)
    # The consumer secret for oauth1
    secret = db.StringProperty(required=True)


class GenObj:
    def __init__(self, **kwds):
        self.__dict__.update(kwds)


def getConnectionService(svcname):
    cskey = svcname
    where = "WHERE name = :1 LIMIT 1"
    csquery = ConnectionService.gql(where, svcname)
    qres = cached_query(cskey, csquery, "", 5, ConnectionService, False)
    for svc in qres.objects:
        return svc
    # no service found, create a stub instance for later editing
    svc = ConnectionService(name=svcname, ckey="unknown", secret="unknown")
    cached_put(svc)
    reset_cached_query(cskey)
    return svc


def enc(text):
    # explicitely pass an empty set of safe characters so forward slash
    # gets translated to "%
    return urllib.quote(str(text), "")


def zulunowts():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")


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
    try:
        result = urlfetch.fetch(url, payload=payload, method=httpverb, 
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
    except Exception as e:
        result = GenObj(status_code = 503, 
                        content = "urlfetch.fetch failed: " + str(e) )
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


def callAmazon(handler, svc, params):
    tosign = "GET\n" + "webservices.amazon.com\n" + "/onca/xml\n" + params
    # the secret comes out of the db as unicode, force it to string
    key = "%s" % (enc(svc.secret))
    sig = b64encode(hmac.new(key, tosign, sha256).digest())
    url = "http://webservices.amazon.com/onca/xml?" + params
    url += "&Signature=" + enc(sig)
    headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    try:
        result = urlfetch.fetch(url, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
        if result.status_code == 200:
            json = "[{\"content\":\"" + enc(result.content) + "\"}]"
            handler.response.headers['Content-Type'] = 'application/json'
            handler.response.out.write(json)
        else:
            handler.error(result.status_code)
            handler.response.out.write(result.content)
    except Exception as e:
        code = 409      # conflict
        if "Deadline" in str(e):
            code = 408  # request timeout
        handler.error(code)
        handler.response.out.write(str(e))


def simple_fetchurl(handler, geturl):
    if not geturl:
        handler.error(400)
        handler.response.out.write("No URL specified")
        return None
    headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    try: 
        result = urlfetch.fetch(geturl, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False, 
                                follow_redirects=True, 
                                deadline=10, 
                                validate_certificate=False)
    except Exception as e:
        handler.error(400)
        handler.response.out.write("simple_fetchurl " + str(e) + 
                                   " fetching " + geturl)
        return None
    # The journal Nature returns a 401 when you are not logged in, but
    # displays the abstract which is what is wanted.  So 401 errors
    # need to succeed if there is a result.  Generally a 401 should
    # probably not pass back to the caller as that would be
    # interpreted as them not being logged in to membic...
    if not result or (result.status_code != 200 and result.status_code != 401):
        logging.info("simple_fetchurl failed status_code " + 
                     str(result.status_code) + ": " + str(result))
        handler.error(result.status_code)
        handler.response.out.write(result.content)
        return None
    return result


# Returning an image directly to a browser doesn't work unless it is
# transformed first, and if transforming anyway, may as well dump it
# out in PNG format.  If the image is being cached, then it is subject
# to the 1mb max cacheable string length, and in general it doesn't
# make any sense to be passing large images around so restricting to
# 125px wide.
def prepare_image(img):
    maxwidth = 125
    if img.width > maxwidth:
        img.resize(width=maxwidth)  # height adjusted automatically to match
    else:
        # at least one transform required so do a dummy crop
        img.crop(0.0, 0.0, 1.0, 1.0)
    img = img.execute_transforms(output_encoding=images.PNG)
    return img


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
    # basically this is a server endpoint to enable cross-site calls
    def get(self):
        geturl = self.request.get('geturl')
        whitelist = [ "https://www.googleapis.com",
                      "https://api.github.com",
                      "http://gdata.youtube.com",
                      "http://odata.netflix.com" ]
        whitelisted = False
        for url in whitelist:
            if geturl.startswith(url):
                whitelisted = True
        if not whitelisted:
            self.error(403)
            self.response.out.write("Not a recognized ok endpoint")
            return
        result = simple_fetchurl(self, geturl)
        if result:
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(result.content)


class TwitterTokenCallback(webapp2.RequestHandler):
    def get(self):
        params = ["oauth_token", "oauth_token_secret", 
                  "oauth_callback_confirmed", "oauth_verifier"]
        url = "https://www.membic.com/#command=AltAuth1"
        for param in params:
            url += "&" + param + "=" + self.request.get(param)
        logging.info("TwitterTokenCallback url: " + url);
        self.redirect(str(url))


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


# The GitHub OAuth callback requires a subdirectory off the main site.
# This provides that endpoint, translating the parameters and calling
# back into the main site.
class GitHubCallback(webapp2.RequestHandler):
    def get(self):
        code = self.request.get('code')
        state = self.request.get('state')
        logging.info("GitHubCallback state: " + state + ", code: " + code)
        url = "https://www.membic.com/#command=AltAuth3" +\
            "&state=" + state + "&code=" + code
        self.redirect(str(url))


class AmazonInfo(webapp2.RequestHandler):
    def get(self):
        # acc = authenticated(self.request)
        # if not acc:
        #     self.error(401)
        #     self.response.out.write("Authentication failed")
        #     return
        # logging.info("referer: " + self.request.referer)
        # logging.info("request: " + str(self.request))
        asin = self.request.get('asin')
        svc = getConnectionService("Amazon")
        # Note the parameters must be in sorted order with url encoded vals
        params = "AWSAccessKeyId=" + svc.ckey
        params += "&AssociateTag=membic-20"
        params += "&Condition=All"
        params += "&IdType=ASIN"
        params += "&ItemId=" + asin
        params += "&Operation=ItemLookup"
        params += "&ResponseGroup=Images%2CItemAttributes%2COffers"
        params += "&Service=AWSECommerceService"
        params += "&Timestamp=" + enc(zulunowts())
        params += "&Version=2011-08-01"
        callAmazon(self, svc, params)


class AmazonSearch(webapp2.RequestHandler):
    def get(self):
        # acc = authenticated(self.request)
        # if not acc:
        #     self.error(401)
        #     self.response.out.write("Authentication failed")
        #     return
        # logging.info("referer: " + self.request.referer)
        # logging.info("request: " + str(self.request))
        revtype = self.request.get('revtype')
        srchtxt = self.request.get('search')
        amznidx = ""
        if revtype == "book":
            amznidx = "Books"
        elif revtype == "movie":
            amznidx = "DVD"
        elif revtype == "music":
            amznidx = "Music"  # album oriented, but tolerable results
        if not amznidx:
            json = "[{\"content\":\"\"}]"
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json)
            return
        svc = getConnectionService("Amazon")
        # Params must be in sorted order with url encoded vals
        params = "AWSAccessKeyId=" + svc.ckey
        params += "&AssociateTag=membic-20"
        params += "&Keywords=" + enc(srchtxt)
        params += "&Operation=ItemSearch"
        params += "&SearchIndex=" + amznidx
        params += "&Service=AWSECommerceService"
        params += "&Timestamp=" + enc(zulunowts())
        params += "&Version=2011-08-01"
        callAmazon(self, svc, params);


class URLContents(webapp2.RequestHandler):
    def get(self):
        # acc = authenticated(self.request)
        # if not acc:
        #     self.error(401)
        #     self.response.out.write("Authentication failed")
        #     return
        logging.info("referer: " + self.request.referer)
        logging.info("request: " + str(self.request))
        result = simple_fetchurl(self, self.request.get('url'))
        if result:
            json = "[{\"content\":\"" + enc(result.content) + "\"}]"
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json)


class ImageRelay(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        url = self.request.get('url')
        if not revid or not url:
            self.error(400)
            self.response.out.write("Both revid and url are required")
            return
        logging.info("ImageRelay revid: " + str(revid) + ", url: " + url)
        img = memcache.get(url)
        if img:
            img = pickle.loads(img)
            logging.info("ImageRelay retrieved from cache")
        else:
            headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
            try:
                result = urlfetch.fetch(url, payload=None, method="GET",
                                        headers=headers,
                                        allow_truncated=False, 
                                        follow_redirects=True, 
                                        deadline=10, 
                                        validate_certificate=False)
                if result:
                    logging.info("ImageRelay urlfetch successful")
                    img = images.Image(result.content)
                    logging.info("ImageRelay image constructed")
                    img = prepare_image(img)
                    memcache.set(url, pickle.dumps(img))
            except Exception as e:
                img = None
                logging.info("ImageRelay urlfetch exception: " + str(e))
            if not img:
                # hex values for a 4x4 transparent PNG created with GIMP:
                imgstr = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e\x7e\x00\x00\x00\x06\x62\x4b\x47\x44\x00\xff\x00\xff\x00\xff\xa0\xbd\xa7\x93\x00\x00\x00\x09\x70\x48\x59\x73\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07\x74\x49\x4d\x45\x07\xdd\x0c\x02\x11\x32\x1f\x70\x11\x10\x18\x00\x00\x00\x0c\x69\x54\x58\x74\x43\x6f\x6d\x6d\x65\x6e\x74\x00\x00\x00\x00\x00\xbc\xae\xb2\x99\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa0\x1c\x00\x00\x00\x44\x00\x01\x06\xc0\x57\xa2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"
                img = images.Image(imgstr)
                img.resize(width=4, height=4)
                img = img.execute_transforms(output_encoding=images.PNG)
        if img:
            self.response.headers['Content-Type'] = "image/png"
            self.response.out.write(img)



app = webapp2.WSGIApplication([('.*/oa1call', OAuth1Call),
                               ('.*/jsonget', JSONGet),
                               ('.*/twtok', TwitterTokenCallback),
                               ('.*/githubtok', GitHubToken),
                               ('.*/githubcb', GitHubCallback),
                               ('.*/amazoninfo', AmazonInfo),
                               ('.*/amazonsearch', AmazonSearch),
                               ('.*/urlcontents', URLContents),
                               ('.*/imagerelay', ImageRelay)], 
                              debug=True)

