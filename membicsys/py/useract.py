""" User initiated application actions """
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=import-error
#pylint: disable=missing-function-docstring
#pylint: disable=invalid-name
#pylint: disable=broad-except
#pylint: disable=logging-not-lazy
#pylint: disable=too-many-locals
#pylint: disable=line-too-long
#pylint: disable=too-many-lines
import logging
import flask
import py.dbacc as dbacc
import py.util as util
import re
import json
import urllib.parse     # to be able to use urllib.parse.quote
import io               # Image.open/save requires file-like access
from PIL import Image, ImageOps   # from Pillow
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


MEMBERASSOCS = ["Founder", "Moderator", "Member"]
FOLLOWASSOCS = ["Blocking", "Following", "Unknown"]

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
           "Following": -1,
           "Blocking": -2}
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
    founder = (ua == "Founder")
    personal = (muser["dsId"] == prof["dsId"])
    # Founders can change levels of other members but cannot resign themselves
    if founder and not personal:
        return True
    # Regular members may resign
    if personal and not founder and assoc_level(ras["assoc"]) < assoc_level(ua):
        return True
    raise ValueError("Unauthorized Theme member change.")


def update_theme_membership(updt, prof, assoc):
    for an in MEMBERASSOCS:
        field = an.lower() + "s"
        ids = util.csv_to_list(updt[field])
        try:
            ids.remove(prof["dsId"])
        except Exception:
            pass  # not found or whatever is ok. Verified not in list.
        if an == assoc:
            ids.append(prof["dsId"])
        updt[field] = ",".join(ids)
    # logging.info("update_theme_membership Theme " + updt["dsId"] +
    #              "\n  Founders: " + updt["founders"] +
    #              "\n  Moderators: " + updt["moderators"] +
    #              "\n  Members: " + updt["members"]);


def note_membership_change(muser, ao, prof, prevassoc, assoc):
    # prevassoc is the theme association, which is 0 if not a member.
    ale = {"dsType":"AdminLog",
           "letype":"Theme", "leid":ao["dsId"], "lename":ao["name"],
           "adminid":muser["dsId"], "adminname":muser["name"],
           "action":"Membership Change",
           "data":str(assoc_level(prevassoc)) + ":" + str(assoc_level(assoc)),
           "target":"MUser", "targid":prof["dsId"], "targname":prof["name"]}
    dbacc.write_entity(ale)


# This does not currently preserve existing notices.  If preservation is
# needed, then they need to be identified as ok in response to a level or
# follow mechanism change.
def update_profile_association(prof, ao, ras):
    tid = ao["dsId"]
    themes = json.loads(prof.get("themes") or "{}")
    previnf = themes.get(tid, {})
    previnf["followmech"] = previnf.get("followmech", "email")
    if ras.get("fm") == "nochange":
        ras["fm"] = previnf["followmech"]
    inf = {"lev": assoc_level(ras["assoc"]),
           "followmech": ras.get("fm", previnf["followmech"]),
           "name": ao["name"],
           "hashtag": ao["hashtag"],
           "picture": ""}
    if ao["dsType"] == "Theme":
        inf["description"] = ao["description"]
        if ao["picture"]:
            inf["picture"] = ao["dsId"]
        inf["keywords"] = ao["keywords"]
        cliset = json.loads(ao.get("cliset") or "{}")
        flags = cliset.get("flags", {})
        archived = flags.get("archived")
        if archived:
            inf["archived"] = archived
    elif ao["dsType"] == "MUser":
        inf["description"] = ao["aboutme"]
        if ao["profpic"]:
            inf["picture"] = ao["dsId"]
        tid = "P" + tid
    themes[tid] = inf
    prof["themes"] = json.dumps(themes)
    return prof


def update_audience_record(audrec):
    audrec["dsType"] = "Audience"
    audrec["modified"] = audrec.get("modified", "")
    recs = dbacc.query_entity(
        "Audience", "WHERE uid=" + audrec["uid"] + " AND srctype=\"" +
        audrec["srctype"] + "\" AND srcid=" + audrec["srcid"] + " LIMIT 1")
    if len(recs) > 0:  # note db info for update
        audrec["dsId"] = recs[0]["dsId"]
        audrec["modified"] = recs[0]["modified"]
    if audrec["lev"] > 0:  # contact from members may not be blocked
        audrec["blocked"] = ""
    return dbacc.write_entity(audrec, audrec["modified"])


# Returns a list of modified objects.  [MUser] if user changes follower
# association or fmech.  [MUser, Theme] if user resigns.  [Theme] if founder
# promotes or demotes someone.  The corresponding Audience record is also
# updated but not returned.  Only the Founder may change the audience view
# directly, and they already have their local updated copy.
def update_association(muser, ao, prof, ras):
    assoc = ras["assoc"]
    if not (assoc in MEMBERASSOCS or assoc in FOLLOWASSOCS):
        raise ValueError("Unknown association " + assoc)
    objs = []
    if muser["dsId"] == prof["dsId"]:  # update own following info
        update_profile_association(prof, ao, ras)
        prof = dbacc.write_entity(prof, vck=prof["modified"])
        dbacc.entcache.cache_put(prof)  # so subsequent updates have correct vck
        objs.append(prof)
    if ao["dsType"] == "Theme":  # update member info if resigning or founder
        prevassoc = theme_association(ao, prof["dsId"])
        if prevassoc != assoc and (prevassoc in MEMBERASSOCS or
                                   assoc in MEMBERASSOCS):
            verify_authorized_theme_member_change(muser, ao, prof, ras)
            update_theme_membership(ao, prof, assoc)
            ao = dbacc.write_entity(ao, vck=ao["modified"])
            if muser["dsId"] != prof["dsId"]:  # reflect follower info
                update_profile_association(prof, ao, ras)
                prof = dbacc.write_entity(prof, vck=prof["modified"])
                dbacc.entcache.cache_put(prof)  # latest for next fetch
            objs.append(ao)
            note_membership_change(muser, ao, prof, prevassoc, assoc)
    if len(objs) > 0:  # Note audience change
        update_audience_record({"uid":prof["dsId"], "name":prof["name"],
                                "srctype":ao["dsType"], "srcid":ao["dsId"],
                                "lev":assoc_level(ras["assoc"]),
                                "mech":ras["fm"]})
    return objs


def prep_simple_html(val):
    # On click to edit, the client will unpack existing html tags into their
    # html escapes.  Reconvert so the parsing can work off real tags.
    val = re.sub(r"&lt;", "<", val)
    val = re.sub(r"&gt;", ">", val)
    # Remove any <br> followed by an ending div tag to avoid double line breaks
    val = re.sub(r"\<br/?\>\s*\</div\>", "</div>", val)
    # Convert any remaining <br> into \n
    val = re.sub(r"\<br/?\>", "\n", val)
    # Firefox 77.0 will separate multi-line input into divs.  Convert to \n
    val = re.sub(r"\<div\>(.*?)\</div\>", r"\1\n", val).strip()
    # Allow a maximum of two newlines in a row (paragraph sep)
    val = re.sub(r"\n\n\n+", "\n\n", val)
    return val


# Simple in this case means bold and italic tags only.  That allows some
# minor visual interest.  Can expand later if really necessary.
def tagrepl(matchobj):
    tag = "<" + matchobj.group(1) + matchobj.group(2) + ">"
    if matchobj.group(2) == "i":
        return tag
    if matchobj.group(2) == "b":
        return tag
    return ""


def verify_simple_html(val):
    val = prep_simple_html(val)
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
                    logging.info("before verify_simple_html: " + val)
                    val = verify_simple_html(val)
        # logging.debug("   read_values " + fld + ": " + str(val))
        if val and str(val).lower() == "unset_value":
            updlo[fld] = ""
            obj[fld] = ""
        elif val:  # Unchanged unless value given
            updlo[fld] = val
            obj[fld] = val
    logging.info("read_values: " + json.dumps(updlo))


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
    preb = json.loads(muser.get("preb") or "[]")
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
    if newmbc.get("details"):
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


def verify_membic_title_simplehtml(newmbc):
    if not newmbc.get("details"):  # just in case somehow not available yet
        return
    dets = json.loads(newmbc["details"])
    for fld in ["title", "name"]:
        val = dets.get(fld)
        if val:
            val = verify_simple_html(val)
            val = re.sub(r"\n", " ", val)
            dets[fld] = val
    newmbc["details"] = json.dumps(dets)


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
    read_values(newmbc, {"inflds": paramfields,
                         "special": {"text": "simplehtml"}})
    verify_membic_title_simplehtml(newmbc)
    # showflds = ["dsType", "dsId", "ctmid", "penid", "srcrev"]
    # logging.debug("read_membic_data showflds newmbc:")
    # for fld in showflds:
    #     logging.debug("    " + fld + ": " + str(newmbc[fld]) + " " +
    #                   str(type(newmbc[fld])))
    newmbc["cankey"] = cankey_for_membic(newmbc)
    return newmbc, oldmbc


# Walk the old and new svcdata postctms to determine which themes should be
# affected and how.  Returns theme|verb indexed by theme dsId.
def make_theme_plan(newmbc, oldmbc):
    plan = {}
    # If previously posted, and not posted anymore, then delete.
    if oldmbc and oldmbc["svcdata"]:
        sd = json.loads(oldmbc["svcdata"])
        pts = sd.get("postctms", [])
        for postnote in pts:
            plan[str(postnote["ctmid"])] = {"action": "delete"}
    sd = json.loads(newmbc.get("svcdata") or "{}")
    pts = sd.get("postctms", [])
    # If there are posting themes specified, but the srcrev is any negative
    # value then there should be no theme posts. (-604 is marked as deleted)
    if newmbc.get("srcrev") and int(newmbc["srcrev"]) < 0:
        pts = []
    # Note existing and new posts specified
    for postnote in pts:
        ctmid = str(postnote["ctmid"])
        if plan.get(ctmid):
            plan[ctmid] = {"action": "edit"}
        else:
            plan[ctmid] = {"action": "add"}
    # Fetch affected themes for processing.  Referenced here and preb rebuild.
    for tid, dets in plan.items():
        dets["theme"] = dbacc.cfbk("Theme", "dsId", int(tid), required=True)
    # If a theme membic is being deleted or edited, then the user had write
    # access to the theme and is allowed to modify their previously posted
    # content.  Adding requires active theme membership.
    for tid, dets in plan.items():
        if dets["action"] == "add":
            if theme_association(dets["theme"], newmbc["penid"]) == "Unknown":
                raise ValueError("Not a member, so cannot post to Theme " +
                                 str(tid) + " " + dets["theme"]["name"])
            cliset = json.loads(dets["theme"].get("cliset") or "{}")
            flags = cliset.get("flags", {})
            archived = flags.get("archived", "")
            if archived:
                # err text contains "rchived Theme <ctmid>" for client
                raise ValueError("New posts not allowed for archived Theme " +
                                 str(tid) + " " + dets["theme"]["name"])
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
    svcdata = srcmbc.get("svcdata", {})  # may already be deserialized
    if isinstance(svcdata, str):
        svcdata = json.loads(svcdata)
    tmbc["svcdata"] = json.dumps(
        {"picdisp": svcdata.get("picdisp", "sitepic"),
         "mshares": svcdata.get("mshares", "")})
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
# note1: In the rare case that a previous processing crash resulted in a
# membic being written without the corresponding theme membics being
# updated, then the theme membics will be out of date and subsequent updates
# will fail a version check.  Since theme membics are completely derivative,
# a version check override won't clobber any data, and the integrity can be
# automatically recovered on a subsequent update.
def write_theme_membics(themeplan, newmbc):
    postctms = []
    for tid, dets in themeplan.items():
        tmbc = theme_membic_from_source_membic(dets["theme"], newmbc)
        if dets["action"] == "delete" and tmbc.get("dsId"):
            dbacc.delete_entity("Membic", tmbc.get("dsId"))
        else: # edit or add
            tmbc = dbacc.write_entity(tmbc, vck="override")  #note1
            postctms.append({"ctmid": tid, "name": dets["theme"]["name"],
                             "revid": str(tmbc["dsId"])})
        dets["membic"] = tmbc
    svcdata = json.loads(newmbc.get("svcdata") or "{}")
    svcdata["postctms"] = postctms
    newmbc["svcdata"] = json.dumps(svcdata)
    newmbc = dbacc.write_entity(newmbc, vck=newmbc["modified"])
    return newmbc


# unpack the preb, find the existing instance and update accordingly.  Not
# expecting to have to walk into overflows much for this, but recurse into
# those if found.  Create new overflow only if prepending, otherwise just
# insert in place.
def update_preb(obj, membic, verb):
    pm = util.make_preb_membic(membic)
    pbms = json.loads(obj.get("preb") or "[]")
    logging.info("update_preb len(pbms): " + str(len(pbms)))
    pbm = None
    idx = 0
    while idx < len(pbms):
        pbm = pbms[idx]
        if pbm["dsType"] == "Overflow":  # Continue searching older stuff
            obj = dbacc.cfbk("Overflow", "dsId", pbm["dsId"])
            return update_preb(obj, membic, verb)
        if (pbm["dsId"] == pm["dsId"]) or (pm["created"] > pbm["created"]):
            break  # at insertion point
        idx += 1
    dlp = ("update_preb " + obj["dsType"] + str(obj["dsId"]) + " " + verb +
           " idx: " + str(idx) + ", ")
    if pbm and pbm["dsId"] == pm["dsId"]:  # found existing instance
        if verb == "delete":
            logging.info(dlp + "existing popped")
            pbms.pop(idx)  # modify pbms removing indexed element
        else:  # "edit". Should not have found anything if "add" but treat same
            logging.info(dlp + "existing updated")
            pbms[idx] = pm
    else:  # no existing instance found
        if verb in ["add", "edit"]:
            if idx > 0:
                logging.info(dlp + "new inserted")
                pbms.insert(idx, pm)
            else:
                logging.info(dlp + "new prepended (via util)")
                util.add_membic_to_preb({"entity": obj["dsType"],
                                         "inst": obj,
                                         "pbms": pbms}, membic)
    obj["preb"] = json.dumps(pbms)
    if obj["dsType"] in ["MUser", "Theme"]:
        if((verb == "add") or (not obj.get("lastwrite"))):
            obj["lastwrite"] = pm["created"]
    return dbacc.write_entity(obj, vck=obj["modified"])


def update_membic_and_preb(muser, newmbc, oldmbc=None):
    themeplan = make_theme_plan(newmbc, oldmbc)
    # logpre = "membicsave dsId: " + str(newmbc["dsId"]) + " "
    # logging.info(logpre + "themeplan " + json.dumps(themeplan))
    vck = None
    if oldmbc:
        vck = oldmbc["modified"]
    newmbc = dbacc.write_entity(newmbc, vck)  # write main membic
    # Updating the theme membics modifies the source membic again to record
    # the posted themes in the svcdata.
    newmbc = write_theme_membics(themeplan, newmbc)
    # The user preb update is an add or an edit (change or marked as deleted).
    userprebv = "add"
    if oldmbc:
        userprebv = "edit"
    prof = update_preb(muser, newmbc, userprebv)
    dbacc.entcache.cache_put(prof)  # update cached reference
    # Theme preb updates directly follow the themeplan actions
    for _, dets in themeplan.items():
        update_preb(dets["theme"], dets["membic"], dets["action"])
    return util.safe_JSON(prof)


def walk_membics(context):
    if not context.get("chunk"):
        context["chunk"] = 100
    if not context.get("creb"):
        context["creb"] = "1970-01-01T00:00:00Z;1"
    where = (context["where"] + " AND created > \"" + context["creb"] + "\"" +
             " ORDER BY created ASC LIMIT " + str(context["chunk"]))
    membics = dbacc.query_entity("Membic", where)
    for membic in membics:
        context["func"](membic, context)
    if len(membics) >= context["chunk"]:  # probably more, get next chunk
        context["creb"] = membics[-1]["created"]
        walk_membics(context)
    return context


def replace_keyword(oldkw, newkw, kwrdcsv):
    spacesep = re.search(r",\s+", kwrdcsv)
    if spacesep:
        kwrdcsv = re.sub(r",\s+", ",", kwrdcsv)
    kwrds = kwrdcsv.split(",")
    kwrds = [newkw if kw == oldkw else kw for kw in kwrds]
    sep = ","
    if spacesep:
        sep = ", "
    return sep.join(kwrds)


# Makes sense to update each of the membics while iterating through here.
# In most cases it is going to be significantly less noise and work to
# rebuild the preb values completely afterwards rather than updating the
# prebs after each membic update.
def update_membic_keywords(membic, context):
    mkws = re.sub(r",\s+", ",", (membic.get("keywords") or ""))
    if not util.val_in_csv(context["oldkw"], mkws):
        return  # old keyword not in theme membic so nothing to do
    srcmbc = dbacc.cfbk("Membic", "dsId", membic["srcrev"], required=True)
    srcmbc["keywords"] = replace_keyword(context["oldkw"], context["newkw"],
                                         srcmbc["keywords"])
    srcmbc = dbacc.write_entity(srcmbc, vck=srcmbc["modified"])
    uid = str(membic["penid"])
    if not context["updusers"].get(uid):
        context["updusers"][uid] = 0  # note MUser for preb rebuild
    context["updusers"][uid] += 1     # update membics count for reporting
    svcdata = json.loads(srcmbc["svcdata"])
    for pn in svcdata["postctms"]:
        tmbc = dbacc.cfbk("Membic", "dsId", int(pn["revid"]), required=True)
        tmbc["keywords"] = replace_keyword(context["oldkw"], context["newkw"],
                                           tmbc["keywords"])
        tmbc = dbacc.write_entity(tmbc, vck=tmbc["modified"])
        if not context["updthemes"].get(pn["ctmid"]):
            context["updthemes"][pn["ctmid"]] = 0  # note Theme for preb rebuild
        context["updthemes"][pn["ctmid"]] += 1     # update reporting count


# It is possible to delete all the Overflow instances for the given type in
# a single SQL statement. Using the dbacc interface to keep the persistence
# localized.  Usually not too many Overflows.
def nuke_and_rebuild_preb(dsType, dsId):
    dbo = dbacc.cfbk(dsType, "dsId", dsId, required=True)
    where = "WHERE dbkind=\"" + dsType + "\" AND dbkeyid=" + str(dsId)
    for over in dbacc.query_entity("Overflow", where):
        dbacc.delete_entity("Overflow", over["dsId"])
    context = {"entity":dsType, "inst":dbo, "pbms":[], "creb":""}
    util.rebuild_prebuilt(context)
    dbo["preb"] = json.dumps(context["pbms"])
    dbo = dbacc.write_entity(dbo, vck=dbo["modified"])
    return dbo


def change_membic_keywords(tid, oldkw, newkw):
    msgs = ["walk_membics start"]
    context = walk_membics({"where": "WHERE ctmid=" + str(tid),
                            "func": update_membic_keywords,
                            "oldkw": oldkw, "newkw": newkw,
                            "updthemes": {}, "updusers": {}})
    msgs.append("walk_membics complete, rebuilding changed containers")
    for dbt, cfld in [("MUser", "updusers"), ("Theme", "updthemes")]:
        for dsId, count in context[cfld].items():
            dbo = nuke_and_rebuild_preb(dbt, int(dsId))
            msgs.append("Rebuilt preb for " + dbt + " " + str(dsId) + " (" +
                        dbo["name"] + ") " + str(count) + " membics updated")
    return "<br/>\n".join(msgs)


def send_mshare_email(muser, membic, recip, subj, body):
    # don't attempt to guess the recipient name from their email.  Worse
    # than nothing.
    body = body.replace("$NAME", recip.get("name", ""))
    # verify sig so the recipient knows who actually sent the mail and who
    # they sent it as so the reply-to is not surprising.
    sig = muser.get("name", "") + "\n" + muser["email"]
    if sig not in body:
        body += "\n" + sig + "\n"
    # Provide an "unsubscribe" block/follow link without any direct access
    # credentials, since the recipient might forward the shared mail to
    # others.  The recipient is *probably* reading their email as html, but
    # could be text.
    bfl = "To block $SENDER from sending you any further membic share email, click this link: $RESPURL"
    bfl = bfl.replace("$SENDER", muser["name"])
    bfl = bfl.replace("$RESPURL", util.site_home() + "/irsp/block?msid=" +
                      membic["dsId"] + "&em=" +
                      urllib.parse.quote(muser["email"]))
    body += "\n\n" + bfl
    util.send_mail(recip["email"], subj, body, replyto=muser["email"])


def verify_mshare_content(txt, membic=None, unquote=True):
    if unquote:
        txt = urllib.parse.unquote(txt)
    txt = verify_simple_html(txt)  # strip any embedded html
    hrefcount = len(re.findall(r"https?://", txt, flags=re.IGNORECASE))
    if not membic and hrefcount > 0:
        raise ValueError("No href allowed in subject")
    if membic and hrefcount > 1:
        raise ValueError("Only one href allowed in message body")
    if membic:
        url = membic.get("url") or membic.get("rurl")
        if url not in txt:
            raise ValueError("Membic url not found in message body")
    return txt


def following_or_blocking(muser, membic):
    themes = json.loads(muser.get("themes") or "{}")
    refs = ["P" + membic["penid"]]
    tid = membic.get("ctmid", "")
    if tid:
        refs.append(tid)
    for refid in refs:
        logging.info("processing refid " + refid)
        refobj = themes.get(refid)
        if refobj and refobj.get("lev"):  # have non-zero assoc
            return True
    return False


def process_mshare(muser, membic, sendto, subj, body):
    sendmax = 5
    uids = util.csv_to_list(sendto)
    if len(uids) > sendmax:
        raise ValueError("Maximum " + str(sendmax) + " sends per share.")
    if not muser.get("name"):
        raise ValueError("You need to set your profile name.")
    # The subject and body of the mail can be edited by the sender, and are
    # then delivered by the client for processing.  Do some basic
    # verification of url, html embedding and so forth.  The "unsubscribe"
    # link is appended by send_mshare_email
    subj = verify_mshare_content(subj)
    body = verify_mshare_content(body, membic)
    svcdata = json.loads(membic.get("svcdata") or "{}")
    mshares = util.csv_to_list(svcdata.get("mshares", ""))
    mshids = [x.split(";")[0] for x in mshares]
    for uid in uids:
        if uid in mshids:
            logging.info("process_mshare already sent to " + uid)
            continue   # previously sent, so don't send again.
        recip = dbacc.cfbk("MUser", "dsId", uid)
        if not recip:
            logging.info("process_mshare no recipient " + uid)
            continue   # shouldn't happen, if it does, don't send or record
        try:
            if not following_or_blocking(recip, membic):
                send_mshare_email(muser, membic, recip, subj, body)
            mshares.append(uid + ";" + dbacc.nowISO())
        except Exception as e:
            logging.error("process_mshare mail send failed: " + str(e))
    svcdata["mshares"] = ",".join(mshares)
    membic["svcdata"] = json.dumps(svcdata)
    return membic


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
        util.verify_active_account(muser, lax=True)
        prevemail = muser["email"]
        prevalt = muser["altinmail"]
        prevhash = muser["hashtag"]
        read_values(muser, {"inflds": ["email", "altinmail", "name", "aboutme",
                                       "hashtag", "cliset", "perset"],
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


# Returns the updated Theme first, followed by the updated founder profile.
# MUser.themes should reflect changed followmech, name, hashtag,
# description, keywords and archive status
def themeupd():
    res = ""
    try:
        muser, _ = util.authenticate()
        util.verify_active_account(muser)
        dsId = dbacc.reqarg("dsId", "dbid")
        if dsId:
            theme = dbacc.cfbk("Theme", "dsId", dsId, required=True)
            if theme_association(theme, muser["dsId"]) != "Founder":
                raise ValueError("Not Founder of " + theme["name"])
        else:  # making a new instance
            theme = {"dsType":"Theme", "hashtag":"", "name":"", "name_c":"",
                     "founders":str(muser["dsId"]), "modified":""}
        prevhash = theme["hashtag"]
        prevnamec = theme["name_c"]
        read_values(theme, {"inflds": ["name", "hashtag", "description",
                                       "cliset", "keywords"],
                            "special": {"description": "simplehtml"}})
        verify_theme_name(prevnamec, theme)
        if theme["hashtag"] and theme["hashtag"] != prevhash:
            verify_hashtag(theme["hashtag"])
        theme = dbacc.write_entity(theme, vck=theme["modified"])
        # Note updated information in founder themes listing
        update_profile_association(muser, theme, {"assoc": "Founder"})
        muser = dbacc.write_entity(muser, vck=muser["modified"])
        dbacc.entcache.cache_put(muser)  # subsequent updates need correct vck
        res = ",".join([util.safe_JSON(obj) for obj in [theme, muser]])
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


def associate():
    res = ""
    try:
        muser, _ = util.authenticate()
        util.verify_active_account(muser)
        aot = dbacc.reqarg("aot", "string", required=True)
        aoi = dbacc.reqarg("aoi", "dbid", required=True)
        ao = dbacc.cfbk(aot, "dsId", aoi, required=True)
        pid = dbacc.reqarg("pid", "dbid", required=True)
        prof = dbacc.cfbk("MUser", "dsId", pid, required=True)
        ras = {"assoc": dbacc.reqarg("assoc", "string", required=True),
               "fm": dbacc.reqarg("fm", "string", required=True)}
        objs = update_association(muser, ao, prof, ras)
        objs = [util.safe_JSON(obj) for obj in objs]
        res = ",".join(objs)
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


# flask.request.method always returns "GET".  Test for file content.
def uploadimg():
    picfile = flask.request.files.get("picfilein")
    if not picfile:
        logging.info("uploadimg Ready")
        return util.respond("Ready", mimetype="text/plain")
    try:
        muser, _ = util.authenticate()
        dsType = dbacc.reqarg("dsType", "string", required=True)
        dsId = dbacc.reqarg("dsId", "dbid", required=True)
        logging.info(muser["email"] + " uploadimg image for " + dsType +
                     " " + str(dsId))
        if dsType == "MUser" and str(dsId) == muser["dsId"]:
            updobj = muser
            # account does not need to be active to upload a profile pic
            picfld = "profpic"
        elif dsType == "Membic":
            util.verify_active_account(muser)
            updobj = dbacc.cfbk("Membic", "dsId", dsId, required=True)
            if updobj["penid"] != muser["dsId"]:
                raise ValueError("Can only upload image to your own membic")
            picfld = "revpic"
        else:  # treat as Theme
            util.verify_active_account(muser)
            updobj = dbacc.cfbk("Theme", "dsId", dsId, required=True)
            if theme_association(updobj, muser["dsId"]) != "Founder":
                raise ValueError("Only Founders may upload an image")
            picfld = "picture"
        # nginx local dev: picfile is a FileStorage object.
        img = Image.open(picfile)
        img = ImageOps.exif_transpose(img)  # correct vertical orientation
        sizemaxdims = 400, 400   # max allowed width/height for thumbnail resize
        img.thumbnail(sizemaxdims)   # modify, preserving aspect ratio
        bbuf = io.BytesIO()          # file-like object for save
        img.save(bbuf, format="PNG")
        updobj[picfld] = base64.b64encode(bbuf.getvalue())
        updobj = dbacc.write_entity(updobj, updobj["modified"])
        if dsType == "MUser":
            dbacc.entcache.cache_put(muser)  # update cached reference
    except ValueError as e:
        logging.info("uploadimg error: " + str(e))
        return util.srverr(str(e))
    logging.info("uploadimg Done")
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


# Like membicsave, except called by an administrator passing the membicid.
# Typically used after making a change to a membic in the database.
# ?an=adminemail&at=token&membicid=1234[&verb=urlreset]
def rebmembic():
    try:
        util.administrator_auth()
        mid = dbacc.reqarg("membicid", "dbid", required=True)
        membic = dbacc.cfbk("Membic", "dsId", int(mid), required=True)
        muser = dbacc.cfbk("MUser", "dsId", membic["penid"], required=True)
        verb = dbacc.reqarg("verb", "string")
        if verb == "urlreset":   # undo everything done by url reader(s)
            membic["url"] = ""   # set from rurl by reader
            svcdata = json.loads(membic.get("svcdata") or "{}")
            svcdata["urlreader"] = ""
            membic["svcdata"] = json.dumps(svcdata)
            membic["imguri"] = ""
            membic["details"] = json.dumps({"title": membic["rurl"]})
        update_membic_and_preb(muser, membic, membic)
    except ValueError as e:
        return util.serve_value_error(e)
    return "rebmembic updated Membic " + str(mid)


# Return the followers for the given theme or profile as specified in the
# dsType and dsId parameters. Only available for your own profile or a theme
# you are a member of.  All members can see the followers, but only founders
# may block.
def audinf():
    res = ""
    try:
        muser, _ = util.authenticate()
        dsType = dbacc.reqarg("dsType", "string", required=True)
        dsId = str(dbacc.reqarg("dsId", "dbid", required=True))
        if dsType == "MUser" and str(muser["dsId"]) != dsId:
            raise ValueError("You may only view audience for your own profile")
        if dsType == "Theme":
            theme = dbacc.cfbk("Theme", "dsId", dsId, required=True)
            if assoc_level(theme_association(theme, muser["dsId"])) <= 0:
                raise ValueError("Only Theme members may view audience")
        where = "WHERE srctype=\"" + dsType + "\" AND srcid=" + dsId
        fwrs = dbacc.query_entity("Audience", where)
        res = json.dumps({"dsType":dsType.lower() + "audience",
                          "dsId":str(dsId), "followers":fwrs})
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


def audblock():
    res = ""
    try:
        muser, _ = util.authenticate()
        srctype = dbacc.reqarg("srctype", "string", required=True)
        srcid = str(dbacc.reqarg("srcid", "dbid", required=True))
        uid = dbacc.reqarg("uid", "dbid", required=True)
        blocked = dbacc.reqarg("blocked", "string")
        if srctype not in ["MUser", "Theme"]:
            raise ValueError("Invalid srctype: " + srctype)
        if srctype == "MUser":
            if srcid != muser["dsId"]:
                raise ValueError("Not your profile.")
        else:  # Theme
            theme = dbacc.cfbk("Theme", "dsId", srcid, required=True)
            if theme_association(theme, muser["dsId"]) != "Founder":
                raise ValueError("Only Founder may block.")
        updos = dbacc.query_entity(
            "Audience", "WHERE srctype=\"" + srctype + "\" AND srcid=" +
            srcid + " AND uid=" + str(uid) + " LIMIT 1")
        if len(updos) < 1:
            raise ValueError("Follower record not found.")
        frec = updos[0]
        if blocked:
            frec["blocked"] = muser["dsId"] + "|" + dbacc.nowISO()
        else:
            frec["blocked"] = ""
        frec = dbacc.write_entity(frec, frec["modified"])
        res = json.dumps(frec)
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + res + "]")


# Find or make user given an email address.  Must be signed in.  Returns
# public user information.  Used for sharing membics outside of current
# followers, providing a mechanism for the recipient to block any further
# contact from the sender as wanted.
def fmkuser():
    try:
        muser, _ = util.authenticate()
        name = dbacc.reqarg("name", "string", required=True)
        email = dbacc.reqarg("email", "string", required=True)
        fmu = dbacc.cfbk("MUser", "email", email)
        stat = "fmkuser found "
        if not fmu:  # make a new user. see util.py newacct
            stat = "fmkuser created "
            cliset = {"contactfrom": (muser["dsId"] + ":" + muser["name"] +
                                      " <" + muser["email"] + ">")}
            fmu = {"dsType":"MUser", "email":email, "phash":"temporary",
                   "status":"Pending", "actcode":util.random_alphanumeric(6),
                   "name":name, "cliset":json.dumps(cliset)}
            fmu = dbacc.write_entity(fmu)       # set created timestamp
            pwd = util.random_alphanumeric(12)  # user will need to reset
            fmu["phash"] = util.make_password_hash(fmu["email"], pwd,
                                                   fmu["created"])
            fmu = dbacc.write_entity(fmu, vck=fmu["modified"])
        logging.info(stat + fmu["email"] + " (" + fmu["name"] + ")")
    except ValueError as e:
        return util.srverr(str(e))
    return util.respJSON("[" + util.safe_JSON(fmu) + "]")


def mshare():
    res = ""
    try:
        muser, _ = util.authenticate()
        sendto = dbacc.reqarg("sendto", "string", required=True)
        subj = verify_simple_html(dbacc.reqarg("subj", "string", required=True))
        body = verify_simple_html(dbacc.reqarg("body", "string", required=True))
        mid = dbacc.reqarg("mid", "string", required=True)
        msgmbc = dbacc.cfbk("Membic", "dsId", mid, required=True)
        srcmbc = msgmbc
        # Theme membics may not be updated directly, all changes to source.
        if srcmbc.get("ctmid"):
            srcmbc = dbacc.cfbk("Membic", "dsId", srcmbc["srcrev"],
                                required=True)
        updmbc = process_mshare(muser, srcmbc.copy(), sendto, subj, body)
        res = update_membic_and_preb(muser, updmbc, srcmbc)
    except ValueError as e:
        return util.srverr(str(e))
    return "[" + res + "]"


# Administrator utility to change a theme keyword, update all membics to
# reflect the change, and rebuild preb for the theme and affected users.
# This is a heavyweight operation and can potentially collide with ongoing
# updates from the app.  The affected users need to not be editing.  While
# the preb is being rebuilt, an overflow might be missing and could result
# in a call from the app looking for a missing dsId.  Should clear up on
# a full browser reload.
def chgtkw():
    try:
        util.administrator_auth()
        msgs = []
        tid = dbacc.reqarg("tid", "dbid", required=True)
        theme = dbacc.cfbk("Theme", "dsId", int(tid), required=True)
        oldkw = dbacc.reqarg("oldkw", "string", required=True)
        newkw = dbacc.reqarg("newkw", "string", required=True)
        tln = "Theme " + str(tid) + " (" + theme["name"] + ")"
        msgs.append("chgtkw \"" + oldkw + "\" -> \"" + newkw + "\" " + tln)
        logging.info(msgs[0])
        updkwrds = replace_keyword(oldkw, newkw, theme["keywords"])
        msgs.append("old keywords: " + theme["keywords"])
        msgs.append("new keywords: " + updkwrds)
        if updkwrds != theme["keywords"]:
            theme["keywords"] = updkwrds
            dbacc.write_entity(theme, theme["modified"])
            msgs.append(tln + " updated")
        else:
            msgs.append(tln + " keywords unchanged")
        msgs.append(change_membic_keywords(int(tid), oldkw, newkw))
        msgs.append("chgtkw completed")
    except ValueError as e:
        return util.serve_value_error(e)
    return "<br/>\n".join(msgs)
