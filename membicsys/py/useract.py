import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import py.dbacc as dbacc
import py.util as util
import re
import json
import urllib.parse     # to be able to use urllib.parse.quote
import io               # Image.open/save requires file-like access
from PIL import Image   # Only need Image from Pillow
import base64


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
    util.send_mail(muser["email"], "Activation Code for Membic",
                   "Welcome to Membic!\n\nYour activation code is\n\n" +
                   muser["actcode"] + "\n\n" +
                   "Paste this code into the activation area or go to " +
                   util.my_profile_url(muser) + "&actcode=" + muser["actcode"])


def verify_active_account(muser):
    if muser["status"] == "Active":
        return
    actcode = dbacc.reqarg("actcode")
    if not actcode:
        return  # not trying to activate
    if actcode == "requestresend":
        send_activation_code(muser)
        return
    if actcode == muser["actcode"]:
        muser["status"] = "Active"
        return
    raise ValueError("Activation code did not match")


memberassocs = ["Founder", "Moderator", "Member"]
followassocs = ["Following", "Unknown"]

def theme_association(theme, pid):
    if util.val_in_csv(pid, theme["founders"]):
        return "Founder"
    elif util.val_in_csv(pid, theme["moderators"]):
        return "Moderator"
    elif util.val_in_csv(pid, theme["members"]):
        return "Member"
    return "Unknown"


def assoc_level(assocstr):
    mls = {"Founder": 3,
           "Moderator": 2,
           "Member": 1,
           "Unknown": 0,
           "Following": -1}
    return mls[assocstr]


def subtoken(src, token):
    src = list(urllib.parse.quote(src))
    for i, c in enumerate(src):
        src[i] = token[ord(c) % len(token)]
    return ''.join(src)


# ras["assoc"] is a changed and valid association string.  prof["dsId"] is
# becoming a member or being removed as a member.
def verify_authorized_theme_member_change(muser, theme, prof, ras):
    ua = theme_association(theme, muser["dsId"])
    personal = muser["dsId"] == prof["dsId"]
    if ua == "Founder" and not personal:
        return True  # Founders can do anything with other members
    if ua != "Founder" and personal:
        if assoc_level(ras["assoc"]) <= 0:
            return True  # Any member can resign if they want
        if ras["assoc"] == "Member" and ras["fid"]:
            # check membership accept with founder authorization
            if theme_association(theme, ras["fid"]) != "Founder":
                raise ValueError("fid " + ras["fid"] + " is not a founder.")
            founder = dbacc.cfbk("MUser", "dsId", ras["fid"], required=True)
            ftok = util.token_for_user(founder)
            if subtoken(prof["email"], ftok) != ras["mtok"]:
                raise ValueError("mtok authorization value did not match")
            return True
    raise ValueError("Unauthorized Theme member change.")


def update_theme_membership(updt, prof, assoc):
    for an in memberassocs:
        field = an.lower() + "s"
        ids = util.csv_to_list(updt[field])
        try:
            ids.remove(prof["dsId"])
        except Exception:
            pass  # not found is ok, anything else is ok, not in list now.
        if an == assoc:
            ids.append(prof["dsId"])
        updt[field] = ",".join(ids)
    # logging.info("update_theme_membership Theme " + updt["dsId"] + 
    #              "\n  Founders: " + updt["founders"] +
    #              "\n  Moderators: " + updt["moderators"] +
    #              "\n  Members: " + updt["members"]);


def update_profile_association(prof, ao, ras):
    tid = ao["dsId"]
    # probably no need to preserve existing notices, so just create a
    # new association info object to store in the profile
    inf = {
        "lev": assoc_level(ras["assoc"]),
        "followmech": ras["fm"],
        "name": ao["name"],
        "hashtag": ao["hashtag"],
        "picture": ""}
    if ao["dsType"] == "Theme":
        inf["description"] = ao["description"];
        if ao["picture"]:
            inf["picture"] = ao["dsId"]
        inf["keywords"] = ao["keywords"]
    elif ao["dsType"] == "MUser":
        inf["description"] = ao["aboutme"]
        if ao["profpic"]:
            inf["picture"] = ao["dsId"]
        tid = "P" + tid
    ts = json.loads(prof["themes"] or "{}")
    ts[tid] = inf
    prof["themes"] = json.dumps(ts)
    return prof


def update_association(muser, ao, prof, ras):
    assoc = ras["assoc"]
    if not (assoc in memberassocs or assoc in followassocs):
        raise ValueError("Unknown association " + assoc)
    updt = None
    if ao["dsType"] == "Theme":
        prevassoc = theme_association(ao, prof["dsId"])
        if prevassoc != assoc and (prevassoc in memberassocs or
                                   assoc in memberassocs):
            verify_authorized_theme_member_change(muser, ao, prof, ras)
            update_theme_membership(ao, prof, assoc)
            updt = dbacc.write_entity(ao, vck=ao["modified"])
    if not updt and prof["dsId"] != muser["dsId"]:  # Not Founder and not self
        raise ValueError("Not authorized to update MUser " + prof["dsId"])
    prof = update_profile_association(prof, ao, ras)
    prof = dbacc.write_entity(prof, vck=prof["modified"])
    dbacc.entcache.cache_put(prof)  # so subsequent updates have correct vck
    return prof, updt


# Simple in this case means bold and italic tags only.  That allows some
# minor visual interest.  Can expand later if really necessary.
# test = "Try <i>this</i> as <br/><em>one</em>\n<b>test</b> case."
# re.sub(r"<(/?)([^>]*)>", r"<\1\2>", test)
def tagrepl(matchobj):
    tag = "<" + matchobj.group(1) + matchobj.group(2) + ">"
    if matchobj.group(2) == "i": return tag
    elif matchobj.group(2) == "b": return tag
    else: return ""

def verify_simple_html(val):
    return re.sub(r"<(/?)([^>]*)>", tagrepl, val)


# Read the specified argument values into the given object.
def read_values(obj, fldspec):
    obtype = obj["dsType"]
    for fld in fldspec["inflds"]:
        val = dbacc.reqarg(fld, obtype + "." + fld)
        if "special" in fldspec:
            if fld in fldspec["special"]:
                if fldspec["special"][fld] == "simplehtml":
                    val = verify_simple_html(val)
        logging.debug("   read_values " + fld + ": " + val)
        if val and val.lower() == "unset_value":
            obj[fld] = ""
        elif val:  # Unchanged unless value given
            obj[fld] = val


def verify_theme_name(prevnamec, theme):
    if not theme["name"]:
        raise ValueError("Theme name required.")
    # Remove all whitespace from name and convert to lower case
    cn = re.sub(r"\s+", "", theme["name"]).lower()
    if not cn:
        raise ValueError("Theme name must have a value.")
    if cn != prevnamec:
        othertheme = dbacc.cfbk("Theme", "name_c", cn)
        if othertheme:
            raise ValueError("Another theme is already using that name.")
    theme["name_c"] = cn



##################################################
#
# API entrypoints
#
##################################################

# If a new email address is being specified, then a password is required so
# that there is something to build a new access token with, but it's not like
# the password has to match what they previously entered.
def accupd():
    res = ""
    try:
        muser, srvtok = util.authenticate()
        verify_active_account(muser)
        prevemail = muser["email"]
        prevalt = muser["altinmail"]
        prevhash = muser["hashtag"]
        read_values(muser, {"inflds": ["email", "altinmail", "name", "aboutme",
                                       "hashtag", "cliset"],
                            "special": {"aboutme": "simplehtml"}});
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
        dbacc.entcache.cache_put(muser)  # will likely reference this again soon
        res = (json.dumps(util.make_auth_obj(muser, srvtok)) +
               "," + util.safe_JSON(muser))
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


def themeupd():
    res = ""
    try:
        muser, srvtok = util.authenticate()
        verify_active_account(muser)
        dsId = dbacc.reqarg("dsId", "dbid")
        if dsId:
            theme = dbacc.cfbk("Theme", "dsId", dsId, required=True)
            if theme_association(theme, muser["dsId"]) != "Founder":
                raise ValueError("Not Founder of " + theme["name"])
        else:  # making a new instance
            theme = {"dbType":"Theme", "hashtag":"", "name":"", "name_c":"",
                     "modified":""}
        prevhash = theme["hashtag"]
        prevnamec = theme["name_c"]
        read_values(theme, {"inflds": ["name", "hashtag", "description",
                                       "cliset", "keywords"],
                            "special": {"description": "simplehtml"}});
        verify_theme_name(prevnamec, theme)
        if theme["hashtag"] and theme["hashtag"] != prevhash:
            verify_hashtag(theme["hashtag"])
        # Only founder is updating, so not bothering with version check
        theme = dbacc.write_entity(theme, vck=theme["modified"])
        res = util.safe_JSON(theme)
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


def associate():
    res = ""
    try:
        muser, srvtok = util.authenticate()
        verify_active_account(muser)
        aot = dbacc.reqarg("aot", "string", required=True)
        aoi = dbacc.reqarg("aoi", "dbid", required=True)
        ao = dbacc.cfbk(aot, "dsId", aoi, required=True)
        pid = dbacc.reqarg("pid", "dbid", required=True)
        prof = dbacc.cfbk("MUser", "dsId", pid, required=True)
        ras = {"assoc": dbacc.reqarg("assoc", "string", required=True),
               "fm": dbacc.reqarg("fm", "string", required=True),
               # member invite authorization request attributes
               "fid": dbacc.reqarg("fid", "dbid"),
               "mtok": dbacc.reqarg("mtok", "string")}
        prof, theme = update_association(muser, ao, prof, ras)
        res = util.safe_JSON(prof)
        if theme:
            res += "," + util.safe_JSON(theme)
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


# flask.request.method always returns "GET".  Test for file content.
def uploadimg():
    picfile = flask.request.files.get("picfilein")
    if not picfile:
        logging.debug("uploadimg Ready")
        return util.respond("Ready", mimetype="text/plain")
    try:
        muser, srvtok = util.authenticate()
        dsType = dbacc.reqarg("dsType", "string", required=True)
        dsId = dbacc.reqarg("dsId", "dbid", required=True)
        logging.debug(muser["email"] + " uploadimg image for " + dsType +
                      " " + str(dsId))
        if dsType == "MUser" and str(dsId) == muser["dsId"]:
            updobj = muser
            # account does not need to be active to upload a profile pic
            picfld = "profpic"
        else:  # treat as Theme
            verify_active_account(muser)
            updobj = dbacc.cfbk("Theme", "dsId", dsId, required=True)
            if theme_association(updobj, muser["dsId"]) != "Founder":
                raise ValueError("Only Founders may upload an image")
            picfld = "picture"
        # nginx local dev: picfile is a FileStorage object.
        img = Image.open(picfile)
        sizemaxdims = 400, 400   # max allowed width/height for thumbnail resize
        img.thumbnail(sizemaxdims)   # modify, preserving aspect ratio
        bbuf = io.BytesIO()          # file-like object for save
        img.save(bbuf, format="PNG")
        updobj[picfld] = base64.b64encode(bbuf.getvalue())
        updobj = dbacc.write_entity(updobj, updobj["modified"])
        if dsType == "MUser":
            dbacc.entcache.cache_put(muser)  # update cached reference
    except ValueError as e:
        return util.srverr(str(e))
    return util.respond("Done: " + updobj["modified"], mimetype="text/plain")
