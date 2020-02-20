import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re
import py.dbacc as dbacc
import py.util as util

def toklogin():
    muser = None
    try:
        muser = util.authenticate()
    except ValueError as e:
        return srverr(str(e))
    return "[" + dbacc.safe_json(muser, "personal") + "]"
    

