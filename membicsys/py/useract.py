""" User initiated application actions """
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=import-error
#pylint: disable=missing-function-docstring
#pylint: disable=invalid-name
#pylint: disable=broad-except
#pylint: disable=logging-not-lazy
#pylint: disable=too-many-locals
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
import datetime


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


def verify_active_account(muser):
    if muser["status"] == "Active":
        return
    actcode = dbacc.reqarg("actcode")
    if not actcode:
        return  # not trying to activate
    if actcode == "requestresend":
        util.send_activation_code(muser)
        return
    if actcode == muser["actcode"]:
        muser["status"] = "Active"
        return
    raise ValueError("Activation code did not match")


MEMBERASSOCS = ["Founder", "Moderator", "Member"]
FOLLOWASSOCS = ["Following", "Unknown"]

def theme_association(theme, pid):
    if util.val_in_csv(pid, theme["founders"]):
        return "Founder"
    if util.val_in_csv(pid, theme["moderators"]):
        return "Moderator"
    if util.val_in_csv(pid, theme["members"]):
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
    for an in MEMBERASSOCS:
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
        inf["description"] = ao["description"]
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
    if not (assoc in MEMBERASSOCS or assoc in FOLLOWASSOCS):
        raise ValueError("Unknown association " + assoc)
    updt = None
    if ao["dsType"] == "Theme":
        prevassoc = theme_association(ao, prof["dsId"])
        if prevassoc != assoc and (prevassoc in MEMBERASSOCS or
                                   assoc in MEMBERASSOCS):
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
    if matchobj.group(2) == "i":
        return tag
    if matchobj.group(2) == "b":
        return tag
    return ""

def verify_simple_html(val):
    return re.sub(r"<(/?)([^>]*)>", tagrepl, val)


# Read the specified argument values into the given object.
def read_values(obj, fldspec):
    # Make an update log object just to show what the server actually got
    updlo = {"dsType":obj["dsType"], "dsId":obj.get("dsId", "")}
    obtype = obj["dsType"]
    for fld in fldspec["inflds"]:
        val = dbacc.reqarg(fld, obtype + "." + fld)
        if "special" in fldspec:
            if fld in fldspec["special"]:
                if fldspec["special"][fld] == "simplehtml":
                    val = verify_simple_html(val)
        # logging.debug("   read_values " + fld + ": " + str(val))
        if val and str(val).lower() == "unset_value":
            updlo[fld] = ""
            obj[fld] = ""
        elif val:  # Unchanged unless value given
            updlo[fld] = val
            obj[fld] = val
    logging.debug("read_values: " + json.dumps(updlo))


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


def set_dispafter(newmbc, muser):
    if newmbc.get("dsId") and newmbc.get("dispafter"):
        raise ValueError("set_dispafter reset of existing value")
    preb = json.loads(muser.get("preb", "[]"))
    if len(preb) == 0:  # first membic, no wait.
        newmbc["dispafter"] = dbacc.nowISO()
    else:  # set dispafter to be 24 hours after next most recent post
        disp = preb[0]["dispafter"] or preb[0]["created"]
        disp = dbacc.ISO2dt(disp)
        disp += datetime.timedelta(hours=24)
        disp = dbacc.dt2ISO(disp)
        newmbc["dispafter"] = max(disp, dbacc.nowISO())


def cankey_for_membic(newmbc):
    cankey = ""
    if newmbc["details"]:
        dets = json.loads(newmbc["details"])
        if "title" in dets:
            cankey = dets["title"]
        if not cankey and "name" in dets:
            cankey = dets["name"]
        if newmbc["revtype"] == "book" and "author" in dets:
            cankey += dets["author"]
        if newmbc["revtype"] == "music" and "artist" in dets:
            cankey += dets["artist"]
    if cankey:
        # whitespace and generally problematic characters
        cankey = re.sub(r'\s', '', cankey)
        cankey = re.sub(r'\"', '', cankey)
        cankey = re.sub(r'\.', '', cankey)
        # URI reserved delimiters
        cankey = re.sub(r'\:', '', cankey)
        cankey = re.sub(r'\/', '', cankey)
        cankey = re.sub(r'\?', '', cankey)
        cankey = re.sub(r'\#', '', cankey)
        cankey = re.sub(r'\[', '', cankey)
        cankey = re.sub(r'\]', '', cankey)
        cankey = re.sub(r'\@', '', cankey)
        # URI reserved sub delimiters
        cankey = re.sub(r'\!', '', cankey)
        cankey = re.sub(r'\$', '', cankey)
        cankey = re.sub(r'\&', '', cankey)
        cankey = re.sub(r'\'', '', cankey)
        cankey = re.sub(r'\(', '', cankey)
        cankey = re.sub(r'\)', '', cankey)
        cankey = re.sub(r'\*', '', cankey)
        cankey = re.sub(r'\+', '', cankey)
        cankey = re.sub(r'\,', '', cankey)
        cankey = re.sub(r'\;', '', cankey)
        cankey = re.sub(r'\=', '', cankey)
        cankey = cankey.lower()
    return cankey


def read_membic_data(muser):
    penname = muser["name"] or ("user" + muser["dsId"])
    emptyid = ""  # A dbid is 0 in the db, and "" in the app.
    newmbc = {"dsType": "Membic", "penid": muser["dsId"], "ctmid": emptyid,
              "penname": penname}
    paramfields = ["url", "rurl", "revtype", "details", "rating", "srcrev",
                   "text", "keywords", "svcdata", "imguri"]
    oldmbc = None
    dsId = dbacc.reqarg("dsId", "dbid")
    if dsId:
        oldmbc = dbacc.cfbk("Membic", "dsId", dsId)
        if oldmbc:
            copyflds = ["dsId", "importid", "revpic", "icdata", "icwhen",
                        "dispafter", "reacdat"] + paramfields
            for fld in copyflds:
                newmbc[fld] = oldmbc[fld]
    else: # new membic instance
        set_dispafter(newmbc, muser)
    read_values(newmbc, {"inflds": paramfields})
    # showflds = ["dsType", "dsId", "ctmid", "penid", "srcrev"]
    # logging.debug("read_membic_data showflds newmbc:")
    # for fld in showflds:
    #     logging.debug("    " + fld + ": " + str(newmbc[fld]) + " " +
    #                   str(type(newmbc[fld])))
    newmbc["cankey"] = cankey_for_membic(newmbc)
    return newmbc, oldmbc


# Walk the old and new svcdata postctms to determine which themes should be
# affected and how.
def make_theme_plan(newmbc, oldmbc):
    plan = {}
    if oldmbc and oldmbc["svcdata"]:
        sd = json.loads(oldmbc["svcdata"])
        pts = sd.get("postctms", [])
        for postnote in pts:
            plan[str(postnote["ctmid"])] = "delete"
    sd = json.loads(newmbc.get("svcdata", "{}"))
    pts = sd.get("postctms", [])
    # If the srcrev is -604, then it is marked as deleted.  For any negative
    # value there should be no theme posts.  srcrev is an int in the db but
    # a string here at app level.
    if newmbc.get("srcrev") and int(newmbc["srcrev"]) < 0:
        pts = []
    for postnote in pts:
        ctmid = str(postnote["ctmid"])
        if plan.get(ctmid):
            plan[ctmid] = "edit"
        else:
            plan[ctmid] = "add"
    return plan


# The source membic will already have been written to the db.  There may or
# may not be a corresponding theme membic.
def theme_membic_from_source_membic(theme, srcmbc):
    ctmid = theme["dsId"]
    srcrev = srcmbc["dsId"]
    tmbc = {"dsType":"Membic", "ctmid":ctmid, "srcrev":srcrev}
    where = "WHERE ctmid=" + str(ctmid) + " AND srcrev=" + str(srcrev)
    membics = dbacc.query_entity("Membic", where)
    if len(membics) > 0:
        tmbc = membics[0]
    tmbc["svcdata"] = ""   # srcrev not updated yet. Not used for theme display
    tmbc["icdata"] = None  # all image caching is off the source membic
    tmbc["importid"] = 0   # only the source membic is imported
    tmbc["icwhen"] = ""
    flds = ["url", "rurl", "revtype", "details", "penid",
            "rating", "cankey", "text", "keywords",
            "revpic", # copied for backward compatibility in case used
            "imguri", # used as indicator, client display references srcrev id
            "dispafter", "penname", "reacdat"]
    for fld in flds:
        tmbc[fld] = srcmbc.get(fld)
    return tmbc


# The themeplan provides the themes and actions as described by the data
# passed from the client.  The id of the theme membic needs to be looked up
# because it's not reasonable practice to simply trust what was sent from
# the client.  Neither is it reasonable to use the theme preb for reference
# because it is constructed from the source db records, so relying on it
# here would be circular logic.
#
# If a theme membic is being deleted or edited, then the user had write
# access to the theme, and is allowed to modify the content they previously
# posted.  If they are adding, verify their theme membership first.
#
# note1: In the rare case that a previous processing crash resulted in a
# membic being written without the corresponding theme membics being
# updated, then the theme membics will be out of date and subsequent updates
# will fail a version check.  Since theme membics are completely derivative,
# a version check override won't clobber any data, and the integrity can be
# automatically recovered on a subsequent update.
def write_theme_membics(themeplan, newmbc):
    for themeid, action in themeplan.items():
        if action == "add":
            theme = dbacc.cfbk("Theme", "dsId", int(themeid))
            if theme_association(theme, newmbc["penid"]) == "Unknown":
                raise ValueError("Not a member, so cannot post to Theme " +
                                 themeid + " " + theme["name"])
    postctms = []
    memos = {}  # remember themes and added theme membics for preb update
    for themeid, action in themeplan.items():
        theme = dbacc.cfbk("Theme", "dsId", int(themeid))
        tmbc = theme_membic_from_source_membic(theme, newmbc)  # existing or new
        if action == "delete" and tmbc.get("dsId"):
            dbacc.delete_entity("Membic", tmbc.get("dsId"))
        else: # edit or add
            # logging.info("write_theme_membics " + json.dumps(tmbc))
            tmbc = dbacc.write_entity(tmbc, vck="override")  #note1
            postctms.append({"ctmid": themeid, "name": theme["name"],
                             "revid": str(tmbc["dsId"])})
        memos[themeid] = {"theme":theme, "membic":tmbc}
    svcdata = json.loads(newmbc.get("svcdata", "{}"))
    svcdata["postctms"] = postctms
    newmbc["svcdata"] = json.dumps(svcdata)
    newmbc = dbacc.write_entity(newmbc, vck=newmbc["modified"])
    return newmbc, memos


# unpack the preb, find the existing instance and update accordingly.  Not
# expecting to have to walk into overflows much for this, but recurse into
# those if found.  Create new overflow only if prepending, otherwise just
# insert in place.
def update_preb(obj, membic, verb):
    pm = util.make_preb_membic(membic)
    pbms = json.loads(obj.get("preb", "[]"))
    pbm = None
    idx = 0
    while idx < len(pbms):
        pbm = pbms[idx]
        if pbm["dsType"] == "Overflow":  # Continue searching older stuff
            obj = dbacc.cfbk("Overflow", "dsId", pbm["dsId"])
            return update_preb(obj, membic, verb)
        if pbm["dsId"] == pm["dsId"] or pm["created"] > pbm["created"]:
            break  # at insertion point
        idx += 1
    dlp = ("update_preb " + obj["dsType"] + str(obj["dsId"]) + " " + verb +
           " idx: " + str(idx) + ", ")
    if pbm and pbm["dsId"] == pm["dsId"]:  # found existing instance
        if verb == "delete":
            logging.debug(dlp + "existing popped")
            pbms.pop(idx)  # modify pbms removing indexed element
        else:  # "edit". Should not have found anything if "add" but treat same
            logging.debug(dlp + "existing updated")
            pbms[idx] = pm
    else:  # no existing instance found
        if verb in ["add", "edit"]:
            if idx > 0:
                logging.debug(dlp + "new inserted")
                pbms.insert(idx, pm)
            else:
                logging.debug(dlp + "new prepended (via util)")
                util.add_membic_to_preb({"entity": obj["dsType"],
                                         "inst": obj,
                                         "pbms": pbms}, membic)
    obj["preb"] = json.dumps(pbms)
    return dbacc.write_entity(obj, vck=obj["modified"])


def update_membic_and_preb(muser, newmbc, oldmbc=None):
    themeplan = make_theme_plan(newmbc, oldmbc)
    # logpre = "membicsave dsId: " + str(newmbc["dsId"]) + " "
    # logging.info(logpre + "themeplan " + json.dumps(themeplan))
    vck = None
    if oldmbc:
        vck = oldmbc["modified"]
    newmbc = dbacc.write_entity(newmbc, vck)  # write main membic
    # Updating the theme membics triggers a second membic update to
    # record the themes it was posted to.  The themeId/themeMembic map
    # is returned as memos for preb update reference.
    newmbc, memos = write_theme_membics(themeplan, newmbc)
    # logging.info(logpre + "membics written, updating preb")
    userprebv = "add"
    if oldmbc:
        userprebv = "edit"
    prof = update_preb(muser, newmbc, userprebv)
    dbacc.entcache.cache_put(prof)  # update cached reference
    res = util.safe_JSON(prof)
    for themeid, action in themeplan.items():
        memo = memos[themeid]
        update_preb(memo["theme"], memo["membic"], action)
    return res


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
                            "special": {"aboutme": "simplehtml"}})
        val = dbacc.reqarg("password")
        if not val and muser["email"] != prevemail:
            raise ValueError("Password required to change email address.")
        if muser["email"] != prevemail:
            verify_unused_email_address(muser["email"])
            muser["status"] = "Pending"
            muser["actcode"] = util.random_alphanumeric(6)
            util.send_activation_code(muser)
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
        muser, _ = util.authenticate()
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
                            "special": {"description": "simplehtml"}})
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
        muser, _ = util.authenticate()
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
        muser, _ = util.authenticate()
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


# This endpoint returns the authorized MUser with their updated preb.  It is
# up to the caller to refetch any outdated themes.  The Themes to be posted
# to (if any) are read from svcdata.postctms, which is then completely
# rebuilt to ensure it accurately reflects the state of the db after the
# updates have been written.
#
# To minimize risk to data integrity, the algo first updates the Membic
# data, then updates the affected MUser/Theme/Overflow preb data.  In the
# event of a crash, the preb data can be rebuilt by a db admin.
def membicsave():
    res = ""
    try:
        muser, _ = util.authenticate()
        newmbc, oldmbc = read_membic_data(muser)
        res = update_membic_and_preb(muser, newmbc, oldmbc)
    except ValueError as e:
        return util.srverr(str(e))
    return "[" + res + "]"
