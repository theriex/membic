import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re
import py.dbacc as dbacc

def srverr(msg, code=400):
    # 400 Bad Request
    # 405 Method Not Allowed
    return msg, code


def secure(func):
    url = flask.request.url
    if url.startswith('https') or re.search("\:[0-9][0-9]80", url):
        return func();
    return srverr("Request must be over https", 405)


def toklogin():
    muser = None
    try:
        emaddr = dbacc.reqarg("emailin", "MUser.email", True)
        logging.debug("Looking up " + emaddr);
        muser = dbacc.cfbk("MUser", "email", emaddr, True)
        # password = dbacc.reqarg("passin", "string", True)

    except ValueError as e:
        return srverr(str(e))
    return "[" + dbacc.safe_json(muser, "personal") + "]"
    

