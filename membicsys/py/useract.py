import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import py.dbacc as dbacc
import py.util as util
import re
import json

def membicsave():
    res = ""
    try:
        muser, srvtok = util.authenticate()
        raise ValueError("membicsave not implemented yet")
    except ValueError as e:
        return srverr(str(e))
    return "[" + res + "]"
    

def verify_unused_email_address(emaddr, fpn="Email"):
    if(dbacc.cfbk("MUser", "email", emaddr) or 
       dbacc.cfbk("MUser", "altinmail", emaddr)):
        raise ValueError(fpn + " " + emaddr + " already in use.")


def verify_hashtag(hashtag):
    # alphabetic character, followed by alphabetic chars or numbers
    #   1. start of string
    #   2. not a non-alphanumeric, not a number and not '_'
    #   3. any alphanumeric character.  Underscores ok.
    #   4. continue to end of string
    if not re.match(r"\A[^\W\d_][\w]*\Z", hashtag):
        raise ValueError("Invalid hashtag value, letters and numbers only.")
    if(dbacc.cfbk("MUser", "hashtag", hashtag) or
       dbacc.cfbk("Theme", "hashtag", hashtag)):
        raise ValueError("Hashtag " + hashtag + " already in use")


def send_activation_code(muser):
    util.send_mail(muser.email, "Activation Code for Membic",
                   "Welcome to Membic!\n\nYour activation code is\n\n" +
                   muser.actcode + "\n\n" +
                   "Paste this code into the activation area or go to " +
                   util.my_profile_url(muser) + "&actcode=" + muser.actcode)


# If a new email address is being specified, then a password is required so
# that there is something to build a new access token with.  It's not like
# the password has to match what they previously entered.
def accupd():
    res = ""
    inflds = ["email", "altinmail", "name", "aboutme", "hashtag", "cliset"]
    try:
        muser, srvtok = util.authenticate()
        prevemail = muser["email"]
        prevalt = muser["altinmail"]
        prevhash = muser["hashtag"]
        for fld in inflds:
            val = dbacc.reqarg(fld, "MUser." + fld)
            logging.debug("   accupd " + fld + ": " + val)
            if val and val.lower() == "unset_value":
                muser[fld] = ""
            elif val:  # Unchanged unless value given
                muser[fld] = val
        val = dbacc.reqarg("password")
        if not val and muser["email"] != prevemail:
            raise ValueError("Password required to change email address.")
        if muser["email"] != prevemail:
            verify_unused_email_address(muser["email"])
            muser["status"] = "Pending"
            muser["actcode"] = util.random_alphanumeric(6)
            send_activation_code(muser)
        if val:  # update the hash so they can login with new password
            muser["phash"] = util.make_password_hash(muser["email"], val,
                                                     muser["created"])
            srvtok = util.token_for_user(muser)
        if muser["altinmail"] and muser["altinmail"] != prevalt:
            verify_unused_email_address(muser["altinmail"], "Alternate Email")
        if muser["hashtag"] and muser["hashtag"] != prevhash:
            verify_hashtag(muser["hashtag"])
        # Could force caller to pass modified, but they are the only one
        # updating so more likely to get in the way if they image upload.
        muser = dbacc.write_entity(muser, vck=muser["modified"])
        res = (json.dumps(util.make_auth_obj(muser, srvtok)) +
               "," + util.safe_JSON(muser))
    except ValueError as e:
        return util.srverr(str(e))
    return "[" + res + "]"
