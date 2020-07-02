""" General use functions not directly tied to specific user actions. """
#pylint: disable=import-error
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=line-too-long
#pylint: disable=missing-function-docstring
#pylint: disable=logging-not-lazy
#pylint: disable=broad-except
#pylint: disable=invalid-name
#pylint: disable=too-many-arguments
#pylint: disable=subprocess-run-check
import logging
import flask
import hmac
import re
import json
import base64
import py.mconf as mconf
import py.dbacc as dbacc
import requests         # Fetch things over http in a reasonable way
import io               # Image.open/save requires file-like access
from PIL import Image   # Only need Image from Pillow
import string
import random
import urllib.parse     # to be able to use urllib.parse.quote
from email.mime.text import MIMEText
import smtplib
import ssl
import os
import subprocess
import datetime


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


def serve_value_error(ve, quiet=False):
    if not quiet:
        logging.exception("serve_value_error")
    return srverr(str(ve))


# No terminating '/', caller always specifies for clarity.  It is probable
# that flask is running on its own port, with the web server providing proxy
# access to it, so port information is removed.
def site_home():
    url = flask.request.url
    elements = url.split("/")[0:3]
    if ":" in elements[2]:
        elements[2] = elements[2].split(":")[0]  # strip port info
    # replace port for local development.  Makes testing easier.
    if elements[2] in ["127.0.0.1", "localhost"]:
        elements[2] += ":8080"
    return "/".join(elements)


def is_development_server():
    info = {"isdev":False, "why":"No development conditions matched"}
    if flask.has_request_context():
        if re.search(r"\:\d{4}", flask.request.url):
            info["isdev"] = True
            info["why"] = "flask.request.url has a 4 digit port number)"
    elif os.environ["HOME"] != "/home/theriex":
        info["isdev"] = True
        info["why"] = ("\"HOME\" env var \"" + os.environ["HOME"] +
                       "\" != \"/home/theriex\")")  # deployment home dir
    if info["isdev"]:
        return info
    return False


def envinfo():
    # logging.debug("envinfo DEBUG level log test message")
    # logging.info("envinfo INFO level log test message")
    # logging.warning("envinfo WARNING test log message")
    # logging.error("envinfo ERROR test log message")
    loglev = logging.getLogger().getEffectiveLevel()
    info = {"devserver": is_development_server(),
            "loglev": {"levnum":loglev, "levname":logging.getLevelName(loglev)}}
    return info


def secure(func):
    url = flask.request.url
    logging.debug("secure url: " + url)
    if url.startswith('https') or is_development_server():
        return func()
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
    val = str(val)
    csv = str(csv)
    if csv == val:
        return True
    if csv.startswith(val + ","):
        return True
    index = csv.find("," + val)
    if index >= 0:
        return True
    return False


def csv_to_list(csv):
    if not csv:
        return []
    csv = str(csv)
    if not csv.strip():  # was all whitespace. treat as empty
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
        raise ValueError("'an' or 'emailin' parameter required")
    emaddr = normalize_email(emaddr)
    muser = dbacc.cfbk("MUser", "email", emaddr)
    if not muser:
        raise ValueError(emaddr + " not found")
    dbacc.entcache.cache_put(muser)  # will likely reference this again soon
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


def random_alphanumeric(length):
    chars = string.ascii_letters + string.digits
    val = "".join(random.choice(chars) for _ in range(length))
    return val


def in_terms_vio(entity, dsId, data=None):
    if not data:
        data = get_connection_service("termsvio")["data"]
    if val_in_csv(entity + ":" + dsId, data):
        return True
    return False


def make_preb_membic(membic):
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
    return memsum


def add_membic_to_preb(context, membic):
    pm = make_preb_membic(membic)
    prebsize = 200
    context["pbms"].insert(0, pm)  # dequeue.appendleft not worth convert
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

B64ENCTRANSPARENT4X4PNG = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e~\x00\x00\x00\x0cIDATx\x9cc`\xa0\x1c\x00\x00\x00D\x00\x01\xd7\xe3H\xfd\x00\x00\x00\x00IEND\xaeB`\x82'

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
    inst["icwhen"] = inst["icwhen"][0:120]  # truncate long errors
    dbacc.write_entity(inst, inst["modified"])


# If the caller is outside of the context of a web request, then the domain
# must be passed in.  The support address must be set up in the hosting env.
def send_mail(emaddr, subj, body, domain=None, sender="support", replyto=""):
    domain = domain or flask.request.url.split("/")[2]
    fromaddr = "@".join([sender, domain])
    emaddr = emaddr or fromaddr
    if is_development_server():
        logging.info("send_mail ignored dev server send to " + emaddr +
                     "\nsubj: " + subj +
                     "\nbody: " + body)
        return
    # On server, so avoid logging anything containing auth info.
    msg = MIMEText(body)
    msg["Subject"] = subj
    msg["From"] = fromaddr
    msg["To"] = emaddr
    if replyto:
        msg.add_header('reply-to', replyto)
    sctx = ssl.create_default_context()  # validate host and certificates
    # 465: secured with SSL. 587: not secured, but supports STARTTLS
    with smtplib.SMTP_SSL(mconf.email["smtp"], 465, context=sctx) as smtp:
        smtp.login(fromaddr, mconf.email[sender])
        smtp.sendmail(fromaddr, emaddr, msg.as_string())


def make_auth_obj(muser, srvtok):
    authobj = {"email": muser["email"],
               "token": srvtok,
               "authId": muser["dsId"],
               "status": muser["status"],
               "altinmail": muser["altinmail"],
               "signInTS": dbacc.nowISO()}
    return authobj


def my_login_url(muser, home=None):
    home = home or site_home()
    return (home + "/profile/" + muser["dsId"] +
            "?an=" + muser["email"] +
            "&at=" + token_for_user(muser))


def send_activation_code(muser):
    send_mail(muser["email"], "Activation Code for Membic",
              "Welcome to Membic!\n\nYour activation code is\n\n" +
              muser["actcode"] + "\n\n" +
              "Paste this code into the activation area or go to " +
              my_login_url(muser) + "&actcode=" + muser["actcode"])
    sendnote = dbacc.nowISO() + ";" + muser["email"]
    if muser["actsends"]:
        muser["actsends"] = sendnote + "," + muser["actsends"]
        if len(muser["actsends"]) > 3000:  # don't grow forever
            muser["actsends"] = muser["actsends"][0:3000] + "..."
    else:
        muser["actsends"] = sendnote
    muser = dbacc.write_entity(muser, vck=muser["modified"])
    return muser


# Return a dict of custom headers for the jsonget request based on the url.
def jsonget_api_headers(url):
    hd = None
    # client should have passed a proper URL, but match to verify.
    match = re.match(r"https://api.vimeo.com/videos/\d+", url)
    if match:
        cs = get_connection_service("vimeoAPI")
        if cs["secret"]:
            hd = {"Authorization": "bearer " + cs["secret"]}
    return hd


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
            body += my_login_url(muser) + "\n\n"
        else:
            body += "You do not have a profile set up for " + emaddr + ". "
            body += "Either you have not signed up yet, or you used "
            body += "a different email address.  To create a profile "
            body += "visit " + site_home() + "\n\n"
        subj = "Membic.org profile password reset"
        send_mail(emaddr, subj, body)
    except ValueError as e:
        return serve_value_error(e)
    return respJSON("[]")


# To manually rebuild an MUser or Theme
# DELETE FROM Overflow WHERE dbkind="<type>" AND dbkeyid=<id>
# UPDATE <type> SET preb=NULL WHERE dsId=<id>
def prebsweep():
    try:
        administrator_auth()
        max_per_sweep = 20
        msgs = []
        # sweep users first so themes are more recent
        for dbType, logfield in [("MUser", "email"), ("Theme", "name")]:
            where = "WHERE preb IS NULL LIMIT " + str(max_per_sweep)
            objs = dbacc.query_entity(dbType, where)
            for obj in objs:
                if len(msgs) >= max_per_sweep:
                    break
                context = {"entity":dbType, "inst":obj, "pbms":[], "creb":""}
                rebuild_prebuilt(context)
                obj["preb"] = json.dumps(context["pbms"])
                obj = dbacc.write_entity(obj, vck=obj["modified"])
                msgs.append("Rebuilt " + dbType + ".preb " + str(obj["dsId"]) +
                            " " + obj[logfield])
        if len(msgs) >= max_per_sweep:
            msgs.append("SweepPrebuilt pass completed, run again")
        else:
            msgs.append("SweepPrebuilt completed")
    except ValueError as e:
        return serve_value_error(e)
    return " <br>\n".join(msgs)


def supphelp():
    accurl = "Nope."
    try:
        administrator_auth()
        emaddr = dbacc.reqarg("email", "MUser.email", required=True)
        muser = dbacc.cfbk("MUser", "email", emaddr)
        accurl = my_login_url(muser) + "\n\n"
    except ValueError as e:
        return serve_value_error(e)
    return accurl


def obimg():
    # The client might make a call to get a pic for a profile which might
    # not have one.  Better to return a blank than an error in that case.
    imgdat = B64ENCTRANSPARENT4X4PNG
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
        return serve_value_error(e)
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
        return serve_value_error(e)
    return respJSON("[" + oj + "]")


# If a previous attempt to relay the image failed, then do not automatically
# repeat the attempted relay.  A development server not connected to the
# internet will end up with broken images, but for the live site a failure
# is typically due to server refusal, or a reference to a resource that is
# no longer available.  Asking for it again without looking into the
# situation further is not reasonable.
def imagerelay():
    imgdat = B64ENCTRANSPARENT4X4PNG
    try:
        mid = dbacc.reqarg("membicid", "dbid", required=True)
        inst = dbacc.cfbk("Membic", "dsId", mid)
        pre = "Membic " + str(mid)
        if not inst:
            logging.info("imagerelay " + pre + " not found")
            raise ValueError(pre + " not found.")
        imguri = inst.get("imguri")
        if not imguri:
            logging.info("imagerelay " + pre + " no imguri")
            raise ValueError(pre + " no imguri to relay.")
        if not inst["icdata"] and not ("_failed_" in inst["icwhen"] or
                                       "_unavailable_" in inst["icwhen"]):
            fetch_image_data(inst, imguri)
        if inst["icdata"]:
            imgdat = inst["icdata"]
            imgdat = base64.b64decode(imgdat)
    except ValueError as e:
        return serve_value_error(e)
    resp = flask.make_response(imgdat)
    resp.mimetype = "image/png"
    return resp


def signin():
    oj = ""
    try:
        muser, srvtok = authenticate()
        authobj = make_auth_obj(muser, srvtok)
        oj = json.dumps(authobj)
    except ValueError as e:
        logging.info("signin failed: " + str(e))
        return serve_value_error(e, quiet=True)
    return respJSON("[" + oj + "]")


def newacct():
    oj = ""
    try:
        emaddr = dbacc.reqarg("emailin", "MUser.email", required=True)
        existing = dbacc.cfbk("MUser", "email", emaddr)
        if existing:
            raise ValueError("Already have an account with that email")
        existing = dbacc.cfbk("MUser", "altinmail", emaddr)
        if existing:
            raise ValueError("An account has this alternate email")
        pwd = dbacc.reqarg("passin", "string", required=True)
        muser = {"dsType":"MUser", "email":emaddr, "phash":"temporary",
                 "status":"Pending", "actcode":random_alphanumeric(6)}
        logging.info("newacct creating MUser for " + emaddr)
        muser = dbacc.write_entity(muser)    # sets created timestamp
        logging.info("newacct timestamps initialized MUser " + muser["dsId"])
        muser["phash"] = make_password_hash(emaddr, pwd, muser["created"])
        # write updated phash so it is preserved if email goes wrong
        muser = dbacc.write_entity(muser, vck=muser["modified"])
        logging.info("newacct phash set MUser " + muser["dsId"])
        muser = send_activation_code(muser)  # must activate before writing
        logging.info("newacct activation mail sent MUser " + muser["dsId"])
        authobj = make_auth_obj(muser, token_for_user(muser))
        oj = json.dumps(authobj)
    except ValueError as e:
        logging.info("newacct failed: " + str(e))
        return serve_value_error(e, quiet=True)
    return respJSON("[" + oj + "]")


def log_urlcontents(url, mech, start, resp):
    end = datetime.datetime.utcnow()
    with open(mconf.logsdir + "urlcontents_" + dbacc.nowISO(), 'w') as f:
        f.write(mech + " " + url + "\n")
        f.write("Elapsed time: " + str(end - start) + "\n")
        f.write("Response content:\n")
        f.write(resp)


def urlcontents():
    ench = ""
    try:
        authenticate()  # must be signed in to fetch url info
        url = dbacc.reqarg("url", "string", required=True)
        fetchmech = dbacc.reqarg("fetchmech", "string")
        start = datetime.datetime.utcnow()
        if fetchmech.startswith("urlcontents"):
            logging.info("urlcontents file " + fetchmech)
            with open(mconf.logsdir + fetchmech, 'r') as f:
                content = f.read()
            ench = "{\"content\":\"" + urllib.parse.quote(content) + "\"}"
        elif fetchmech == "curl":
            logging.info("urlcontents (curl) " + url)
            result = subprocess.run(["curl", url], stdout=subprocess.PIPE)
            resp = result.stdout.decode('utf-8')
            log_urlcontents(url, "curl", start, resp)
            ench = "{\"content\":\"" + urllib.parse.quote(resp) + "\"}"
        else:
            logging.info("urlcontents " + url)
            resp = requests.get(url)
            if resp.status_code != 200:
                srverr(resp.text, resp.status_code)
            log_urlcontents(url, "requests", start, resp.text)
            ench = "{\"content\":\"" + urllib.parse.quote(resp.text) + "\"}"
    except ValueError as e:
        logging.info("urlcontents failed: " + str(e))
        return serve_value_error(e)
    return respJSON("[" + ench + "]")


def jsonget():
    ench = ""
    try:
        authenticate()  # must be signed in to fetch url info
        url = dbacc.reqarg("url", "string", required=True)
        headerdict = jsonget_api_headers(url)
        if not headerdict:
            raise ValueError("No API headers known for " + url)
        logging.info("jsonget " + url)
        resp = requests.get(url, headers=headerdict)
        if resp.status_code != 200:
            srverr(resp.text, resp.status_code)
        ench = resp.text
    except ValueError as e:
        logging.info("jsonget failed: " + str(e))
        return serve_value_error(e)
    return respJSON(ench)


def uncache():
    try:
        dt = dbacc.reqarg("dt", "string", required=True)
        di = dbacc.reqarg("di", "dbid", required=True)
        obj = dbacc.cfbk(dt, "dsId", di, required=True)
        dbacc.entcache.cache_remove(obj)
    except ValueError as e:
        return serve_value_error(e)
    return "uncached " + dt + str(di)
