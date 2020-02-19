import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import hashlib
import hmac
import re
import json
import py.dbacc as dbacc

def srverr(msg, code=400):
    # 400 Bad Request
    # 405 Method Not Allowed
    return msg, code


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


def get_connection_service(svcname):
    cs = dbacc.cfbk("ConnectionService", "name", svcname)
    if not cs:
        # create needed placeholder for administrators to update
        dbacc.write_entity("ConnectionService", {"name": svcname})
        cs = dbacc.cfbk("ConnectionService", "name", svcname)
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
        ovrf = dbacc.write_entity("Overflow", {
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
        where += " AND created > " + context["creb"]
    where += " ORDER BY modified ASC LIMIT " + str(chunk)
    membics = dbacc.query_entity("Membic", where)
    for membic in membics:
        add_membic_to_preb(context, membic)
    if len(membics) >= chunk:  # continue fetching more recent
        context["creb"] = membics[len(membics) - 1]["created"]
        rebuild_prebuilt(context)
    res = json.dumps(context["pbms"])
    logging.info("rebuild_prebuilt res: " + res[0:400])
    return context["pbms"]


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
        maxPerSweep = 1
        where = "WHERE preb IS NULL LIMIT " + str(maxPerSweep)
        msgs = []
        musers = dbacc.query_entity("MUser", where)
        for muser in musers:  # do users first so themes are more recent
            if len(msgs) >= maxPerSweep:
                break
            logging.info("prebsweep MUser " + muser["dsId"] + " " +
                         muser["modified"])
            muser["preb"] = rebuild_prebuilt({"entity":"MUser", "inst":muser,
                                              "pbms":[], "creb":""})
            dbacc.write_entity("MUser", muser, vck=muser["modified"])
            msgs.append("Rebuilt MUser.preb " + str(muser["dsId"]) + " " +
                        muser["email"])
        themes = dbacc.query_entity("Theme", where)
        for theme in themes:
            if len(msgs) >= maxPerSweep:
                break
            theme["preb"] = rebuild_prebuilt({"entity":"Theme", "inst":theme,
                                              "pbms":[], "creb":""})
            dbacc.write_entity("Theme", theme, vck=theme["modified"])
            msgs.append("Rebuilt Theme.preb " + str(theme["dsId"]) + " " +
                        theme["name"])
        if len(msgs) > maxPerSweep:
            msgs.append("SweepPrebuilt pass completed, run again")
        else:
            msgs.append("SweepPrebuilt completed")
    except ValueError as e:
        return serveValueError(e)
    return " <br>\n".join(msgs)

