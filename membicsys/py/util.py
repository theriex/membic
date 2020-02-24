import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import hashlib
import hmac
import re
import json
import py.dbacc as dbacc

site_home = "https://membic.org"

def respond(contentstr, mimetype="text/html"):
    # flask.Response defaults to HTML mimetype, so just returning a string
    # from a flask endpoint will probably work.  Best to route everything
    # through here and set it explicitely just in case
    resp = flask.make_response(contentstr)
    resp.mimetype = mimetype
    return resp


def srverr(msg, code=400):
    # 400 Bad Request
    # 405 Method Not Allowed
    resp = flask.make_response(msg)
    resp.mimetype = "text/plain"
    resp.status_code = int(code)
    return resp


def serveValueError(ve):
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
        raise ValueError("Invalid access credentials")
    return muser


def administrator_auth():
    muser = authenticate()
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
    appmem = dbacc.db2app_Membic(membic)
    mflds = ["dsId", "created", "modified", "url", "rurl", "revtype",
             "details", "penid", "ctmid", "rating", "srcrev", "cankey",
             "text", "keywords", "svcdata", "imguri", "dispafter", 
             "penname", "reacdat"]
    for mfld in mflds:
        memsum[mfld] = appmem[mfld]
    if appmem["revpic"]:
        memsum["revpic"] = appmem["dsId"]
    context["pbms"].append(memsum)
    if len(context["pbms"]) >= 2 * prebsize:
        ovrf = dbacc.write_entity({
            "dsType": "Overflow",
            "dbkind": context["entity"],
            "dbkeyid": context["inst"]["dsId"],
            "preb": json.dumps(context["pbms"][:prebsize])})
        context["pbms"] = context["pbms"][0:prebsize]
        context["pbms"].append(ovrf["dsId"])


# page through the reviews for the given user or theme.
def rebuild_prebuilt(context):
    chunk = 100
    where = "WHERE ctmid=0 AND penid=" + str(context["inst"]["dsId"])
    if context["entity"] == "Theme":
        where = "WHERE ctmid=" + str(context["inst"]["dsId"])
    # Order by creation date, loading oldest first
    if context["creb"]:
        where += " AND created > \"" + context["creb"] + "\""
    where += " ORDER BY modified ASC LIMIT " + str(chunk)
    logging.info("reuild_prebuilt: " + where)
    membics = dbacc.query_entity("Membic", where)
    for membic in membics:
        add_membic_to_preb(context, membic)
    if len(membics) >= chunk:  # continue fetching more recent
        context["creb"] = membics[len(membics) - 1]["created"]
        rebuild_prebuilt(context)
    res = json.dumps(context["pbms"])
    logging.info("rebuild_prebuilt res: " + res[0:400])
    context["pbms"] = res


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
    return "[]"


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
            muser["preb"] = context["pbms"]
            dbacc.write_entity(muser, vck=muser["modified"])
            msgs.append("Rebuilt MUser.preb " + str(muser["dsId"]) + " " +
                        muser["email"])
        themes = dbacc.query_entity("Theme", where)
        for theme in themes:
            if len(msgs) >= maxPerSweep:
                break
            context = {"entity":"Theme", "inst":theme, "pbms":[], "creb":""}
            rebuild_prebuilt(context)
            theme["preb"] = context["pbms"]
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

