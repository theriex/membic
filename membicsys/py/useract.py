import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import py.dbacc as dbacc
import py.util as util

def membicsave():
    res = ""
    try:
        muser, srvtok = util.authenticate()
        raise ValueError("membicsave not implemented yet")
    except ValueError as e:
        return srverr(str(e))
    return "[" + res + "]"
    

