import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import hashlib
import hmac
import re
import json
import base64
import py.dbacc as dbacc
import requests         # Fetch things over http in a reasonable way
import io               # Image.open/save requires file-like access
from PIL import Image   # Only need Image from Pillow


site_home = "https://membic.org"

def respond(contentstr, mimetype="text/html"):
    # flask.Response defaults to HTML mimetype, so just returning a string
    # from a flask endpoint will probably work.  Best to route everything
    # through here and set it explicitely just in case
    resp = flask.make_response(contentstr)
    resp.mimetype = mimetype
    return resp


def respJSON(jsontxt):
    return respond(jsontxt, mimetype="application/json")


def srverr(msg, code=400):
    # 400 Bad Request
    # 405 Method Not Allowed
    resp = flask.make_response(msg)
    resp.mimetype = "text/plain"
    resp.status_code = int(code)
    return resp


def serveValueError(ve, quiet=False):
    if not quiet:
        logging.exception("serveValueError")
    return srverr(str(ve))


def is_development_server():
    url = flask.request.url
    if re.search("\:\d{4}", url):
        return True
    return False


def secure(func):
    url = flask.request.url
    logging.debug("secure url: " + url)
    if url.startswith('https') or is_development_server():
        return func();
    return srverr("Request must be over https", 405)


# Apparently on some devices/browsers it is possible for the email
# address used for login to be sent encoded.  Decode and lowercase.
def normalize_email(emaddr):
    emaddr = emaddr.lower()
    emaddr = re.sub('%40', '@', emaddr)
    return emaddr


def val_in_csv(val, csv):
    if not csv:
        return False
    if csv == val:
        return True
    if csv.startswith(val + ","):
        return True
    index = csv.find("," + val)
    if index >= 0:
        return True
    return False


def csv_to_list(csv):
    if not csv or not csv.strip():  # trim string val just in case
        return []
    return csv.split(",")


def first_group_match(expr, text):
    m = re.match(expr, text)
    if m:
        return m.group(1)
    return None


def modcv(obj):  # cache bust value from object modified field
    return re.sub(r"[\-:]", "", obj["modified"])


def pdtdi(obj, cachev=""):  # parameterized dsType and dsId, with cache bust
    dtdi = "dt=" + obj["dsType"] + "&di=" + obj["dsId"]
    if not cachev:
        dtdi += "&v=" + modcv(obj)
    return dtdi


def get_connection_service(svcname):
    cs = dbacc.cfbk("ConnectionService", "name", svcname)
    if not cs:
        # create needed placeholder for administrators to update
        cs = dbacc.write_entity({"dsType": "ConnectionService",
                                 "name": svcname})
    return cs


def make_password_hash(emaddr, pwd, cretime):
    hasher = hmac.new(pwd.encode("utf8"), digestmod="sha512")
    hasher.update((emaddr + "_" + cretime).encode("utf8"))
    return hasher.hexdigest()


def token_for_user(muser):
    ts = get_connection_service("TokenSvc")
    hasher = hmac.new(ts["secret"].encode("utf8"), digestmod="sha512")
    hasher.update((muser["email"] + "_" + muser["phash"]).encode("utf8"))
    token = hasher.hexdigest()
    token = token.replace("+", "-")
    token = token.replace("/", "_")
    token = token.replace("=", ".")
    return token


def authenticate():
    emaddr = dbacc.reqarg("an", "MUser.email")
    if not emaddr:
        emaddr = dbacc.reqarg("emailin", "MUser.email")
    if not emaddr:
        raise ValueError("'an' or 'emailin' parameter required");
    emaddr = normalize_email(emaddr)
    muser = dbacc.cfbk("MUser", "email", emaddr)
    if not muser:
        raise ValueError(emaddr + " not found")
    reqtok = dbacc.reqarg("at", "string")
    if not reqtok:
        password = dbacc.reqarg("passin", "string")
        if not password:
            password = dbacc.reqarg("password", "string")
        if not password:
            raise ValueError("Access token or password required")
        phash = make_password_hash(emaddr, password, muser["created"])
        if phash == muser["phash"]:  # it's them, build a token to continue with
            reqtok = token_for_user(muser)
        else:
            logging.info(muser["email"] + " password hash did not match")
            logging.info("  MUser[\"phash\"]: " + muser["phash"])
            logging.info("    Server phash: " + phash)
    srvtok = token_for_user(muser)
    if reqtok != srvtok:
        logging.info(muser["email"] + " authenticated token did not match")
        logging.info("  reqtok: " + reqtok)
        logging.info("  srvtok: " + srvtok)
        raise ValueError("Wrong password")
    return muser, srvtok


def administrator_auth():
    muser, srvtok = authenticate()
    cs = get_connection_service("Administrators")
    if not val_in_csv(muser["dsId"], cs["data"]):
        raise ValueError("Not authorized as admin")


def safe_JSON(obj, audience="public"):  # "private" includes personal info
    filtobj = dbacc.visible_fields(obj, audience)
    if obj["dsType"] == "MUser" and audience == "private":
        filtobj["token"] = token_for_user(obj)
    return json.dumps(filtobj)


def in_terms_vio(entity, dsId, data=None):
    if not data:
        data = get_connection_service("termsvio")["data"]
    if val_in_csv(entity + ":" + dsId, data):
        return True
    return False


def add_membic_to_preb(context, membic):
    prebsize = 200
    memsum = {}
    mflds = ["dsId", "dsType", "created", "modified", "url", "rurl", "revtype",
             "details", "penid", "ctmid", "rating", "srcrev", "cankey", "text", 
             "keywords", "svcdata", "imguri", "dispafter", "penname", "reacdat"]
    for mfld in mflds:
        memsum[mfld] = membic[mfld]
    jsonflds = ["details", "svcdata", "reacdat"]
    for jsonfield in jsonflds:
        memsum[jsonfield] = memsum[jsonfield] or "{}"
        memsum[jsonfield] = json.loads(memsum[jsonfield])
    if membic["revpic"]:
        memsum["revpic"] = membic["dsId"]
    # dequeue.appendleft is faster, but not worth the conversion
    context["pbms"].insert(0, memsum)
    if len(context["pbms"]) >= 2 * prebsize:
        ovrf = dbacc.write_entity({
            "dsType": "Overflow",
            "dbkind": context["entity"],
            "dbkeyid": context["inst"]["dsId"],
            "preb": json.dumps(context["pbms"][prebsize:])})
        context["pbms"] = context["pbms"][0:prebsize]
        ovrf["preb"] = ""  # Do not include in summary marker object
        context["pbms"].append(ovrf)


# Page through the membics for the given user or theme, rebuilding the
# context preb.  Normally each membic is added individually, this method
# supports a complete rebuild, like when the preb and associated overflows
# have been cleared from the database.
def rebuild_prebuilt(context):
    chunk = 100
    where = "WHERE ctmid=0 AND penid=" + str(context["inst"]["dsId"])
    if context["entity"] == "Theme":
        where = "WHERE ctmid=" + str(context["inst"]["dsId"])
    # Order by creation date, loading oldest first
    if context["creb"]:
        where += " AND created > \"" + context["creb"] + "\""
    where += " ORDER BY created ASC LIMIT " + str(chunk)
    logging.info("rebuild_prebuilt: " + where)
    membics = dbacc.query_entity("Membic", where)
    for membic in membics:
        add_membic_to_preb(context, membic)
    if len(membics) >= chunk:  # probably more to go fetch
        context["creb"] = context["pbms"][0]["created"]
        rebuild_prebuilt(context)


# lev -1 means following by email.  That's the default for a former theme
# member, and a preferred option for first associating with a theme.
# Preferable to update both the user and the theme as part of a single
# transaction, but not worth the overhead given likelihood and severity.
# This preserves any existing notices, but does not write or track them.
def verify_theme_muser_info(theme, userid, lev=-1):
    if val_in_csv(userid, theme["members"]):
        lev = 1
    elif val_in_csv(userid, theme["moderators"]):
        lev = 2
    elif val_in_csv(userid, theme["founders"]):
        lev = 3
    # Update the user
    muser = dbacc.cfbk("MUser", "dsId", userid)
    muser["themes"] = muser["themes"] or "{}"
    mti = json.loads(muser["themes"])
    currti = {}
    if theme["dsId"] in mti:
        currti = mti[theme["dsId"]]
    currti["lev"] = lev
    currti["obtype"] = "Theme"
    currti["name"] = theme["name"]
    currti["hashtag"] = theme["hashtag"]
    currti["keywords"] = theme["keywords"]
    if theme["picture"]:
        currti["picture"] = theme["dsId"]
    mti[theme["dsId"]] = currti
    muser["themes"] = json.dumps(mti)
    dbacc.write_entity(muser, vck=muser["modified"])
    # Update the theme
    theme["people"] = theme["people"] or "{}"
    people = json.loads(theme["people"])
    people[userid] = muser["name"]
    theme["people"] = json.dumps(people)
    theme = dbacc.write_entity(theme, vck=theme["modified"])
    return theme


# hex values for a 4x4 transparent PNG created with GIMP:
blank4x4imgstr = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e\x7e\x00\x00\x00\x06\x62\x4b\x47\x44\x00\xff\x00\xff\x00\xff\xa0\xbd\xa7\x93\x00\x00\x00\x09\x70\x48\x59\x73\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07\x74\x49\x4d\x45\x07\xdd\x0c\x02\x11\x32\x1f\x70\x11\x10\x18\x00\x00\x00\x0c\x69\x54\x58\x74\x43\x6f\x6d\x6d\x65\x6e\x74\x00\x00\x00\x00\x00\xbc\xae\xb2\x99\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa0\x1c\x00\x00\x00\x44\x00\x01\x06\xc0\x57\xa2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"


# Fetch the image, convert to a thumbnail png, write base64 encoded value to
# icdata, write timestamp to icwhen.  If the request fails, this writes a
# tombstone marker to icwhen so we don't keep trying dead links.
# Request error codes:
#   400: You want what?  No clue.
#   403: Unauthorized.  We don't like you.
#   404: Reliably, permanently unavailable
#   410: Literally gone.  Deleted.
#   503: Archived, don't like your IP/agent whatever.  Unavailable.
# PIL failures can happen if a request claims to have succeeded, but returns
# error text instead of binary data. Regardless, if PIL can't figure it out,
# it's not available.
# The request processing crashes if the server is unknown, or the request is
# redirected to a secure site with a bad cert, or it was a CDN or cached
# static resource that is no longer being maintained.  These are issues that
# would also cause a browser to complain.  While the situation may be due to
# a network disruption or server outage, it's probably a dead link.  These
# are flagged as "_unavailable_" rather than "_failed_", but they are
# treated the same way.  If running the server offline during development,
# it is possible to get a lot of these errors, but resource fetching works
# differently when running locally anyway so that's tolerable.
def fetch_image_data(inst, imgsrc):
    pre = inst["dsType"] + " " + str(inst["dsId"]) + " "
    try:
        resp = requests.get(imgsrc)
        reqc = resp.status_code
        if reqc == 200:
            try:
                # resp.content will not open if b64decoded. Ok to read.
                img = Image.open(io.BytesIO(resp.content))
                sizemaxdims = 160, 160       # max allowed dims for thumbnail
                img.thumbnail(sizemaxdims)   # modify, preserving aspect ratio
                bbuf = io.BytesIO()          # file-like object for save
                img.save(bbuf, format="PNG")
                bval = bbuf.getvalue()
                inst["icdata"] = base64.b64encode(bval)
                inst["icwhen"] = dbacc.nowISO()
            except Exception as e2:
                inst["icwhen"] = dbacc.nowISO() + "_failed_PIL_" + str(e2)
        else:
            inst["icwhen"] = dbacc.nowISO() + "_failed_" + str(reqc)
    except Exception as e:
        inst["icwhen"] = dbacc.nowISO() + "_unavailable_" + str(e)
    inst["icwhen"] = inst["icwhen"][0:120];  # truncate long errors
    dbacc.write_entity(inst, inst["modified"])



def send_mail(emaddr, subj, body):
    if is_development_server():
        logging.info("send_mail ignored dev server send to " + emaddr +
                     "\nsubj: " + subj +
                     "\nbody: " + body)
        return
    raise ValueError("send_mail not connected to server mail")
    


##################################################
#
# API entrypoints
#
##################################################

def mailpwr():
    try:
        emaddr = dbacc.reqarg("emailin", "MUser.email", required=True)
        body = "You asked to reset your membic account password.\n\n"
        muser = dbacc.cfbk("MUser", "email", emaddr)
        if muser:
            body += "Use this link to access the settings for your profile: "
            body += "https://membic.org?view=profile"
            body += "&an=" + emaddr + "&at=" + token_for_user(muser) + "\n\n"
        else:
            body += "You do not have a profile set up for " + emaddr + ". "
            body += "Either you have not signed up yet, or you used "
            body += "a different email address.  To create a profile "
            body += "visit https://membic.org\n\n"
        subj = "Membic.org profile password reset"
        send_mail(emaddr, subj, body)
    except ValueError as e:
        return serveValueError(e)
    return respJSON("[]")


def prebsweep():
    try:
        admin = administrator_auth()
        maxPerSweep = 20
        where = "WHERE preb IS NULL LIMIT " + str(maxPerSweep)
        msgs = []
        musers = dbacc.query_entity("MUser", where)
        for muser in musers:  # do users first so themes are more recent
            if len(msgs) >= maxPerSweep:
                break
            logging.info("prebsweep MUser " + muser["dsId"] + " " +
                         muser["modified"])
            context = {"entity":"MUser", "inst":muser, "pbms":[], "creb":""}
            rebuild_prebuilt(context)
            muser["preb"] = json.dumps(context["pbms"])
            dbacc.write_entity(muser, vck=muser["modified"])
            msgs.append("Rebuilt MUser.preb " + str(muser["dsId"]) + " " +
                        muser["email"])
        themes = dbacc.query_entity("Theme", where)
        for theme in themes:
            if len(msgs) >= maxPerSweep:
                break
            context = {"entity":"Theme", "inst":theme, "pbms":[], "creb":""}
            rebuild_prebuilt(context)
            theme["preb"] = json.dumps(context["pbms"])
            dbacc.write_entity(theme, vck=theme["modified"])
            msgs.append("Rebuilt Theme.preb " + str(theme["dsId"]) + " " +
                        theme["name"])
        if len(msgs) >= maxPerSweep:
            msgs.append("SweepPrebuilt pass completed, run again")
        else:
            msgs.append("SweepPrebuilt completed")
    except ValueError as e:
        return serveValueError(e)
    return " <br>\n".join(msgs)


def obimg():
    # The client might make a call to get a pic for a profile which might
    # not have one.  Better to return a blank than an error in that case.
    imgdat = blank4x4imgstr
    try:
        dsType = dbacc.reqarg("dt", "string", required=True)
        dsId = dbacc.reqarg("di", "string", required=True)
        inst = dbacc.cfbk(dsType, "dsId", dsId)
        if inst:
            picfldmap = {"Theme": "picture",
                         "MUser": "profpic",
                         "Membic": "revpic"}
            imgdat = inst[picfldmap[dsType]]
            imgdat = base64.b64decode(imgdat)
    except ValueError as e:
        return serveValueError(e)
    resp = flask.make_response(imgdat)
    resp.mimetype = "image/png"
    return resp


def fetchobj():
    oj = ""
    try:
        dsType = dbacc.reqarg("dt", "string", required=True)
        dsId = dbacc.reqarg("di", "string", required=True)
        inst = dbacc.cfbk(dsType, "dsId", dsId)
        if not inst:
            raise ValueError(dsType + " " + dsId + " not found")
        oj = safe_JSON(inst)
    except ValueError as e:
        return serveValueError(e)
    return respJSON("[" + oj + "]")


def imagerelay():
    imgdat = blank4x4imgstr
    try:
        mid = dbacc.reqarg("membicid", "dbid", required=True)
        inst = dbacc.cfbk("Membic", "dsId", mid)
        pre = "Membic " + str(mid) + " "
        if not inst:
            raise ValueError(pre + "not found")
        if inst["svcdata"]:
            svcdata = json.loads(inst["svcdata"])
            if "picdisp" in svcdata:
                if svcdata["picdisp"] != "sitepic":
                    raise ValueError(pre + "picdisp not sitepic: " + 
                                     svcdata["picdisp"])
        imguri = inst["imguri"]
        if not inst["icdata"] and not ("_failed_" in inst["icwhen"] or
                                       "_unavailable_" in inst["icwhen"]):
            fetch_image_data(inst, imguri)
            if not inst["icdata"]:
                raise ValueError(pre + "unable to relay data")
        imgdat = inst["icdata"]
        imgdat = base64.b64decode(imgdat)
    except ValueError as e:
        return serveValueError(e)
    resp = flask.make_response(imgdat)
    resp.mimetype = "image/png"
    return resp


def signin():
    oj = ""
    try:
        muser, srvtok = authenticate()
        authobj = {"email": muser["email"],
                   "token": srvtok,
                   "authId": muser["dsId"],
                   "status": muser["status"],
                   "altinmail": muser["altinmail"],
                   "signInTS": dbacc.nowISO()}
        oj = json.dumps(authobj)
    except ValueError as e:
        logging.info("signin failed: " + str(e));
        return serveValueError(e, quiet=True)
    return respJSON("[" + oj + "]")


