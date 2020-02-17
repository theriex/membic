import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re
import py.dbacc as dbacc

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
    

