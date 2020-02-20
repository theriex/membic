import logging
logging.basicConfig(level=logging.DEBUG)
import os
import json
import base64
# These imports require ln -s ../../membicsys/py py
import py.dbacc as dbacc
import py.util as util

stats = {"MUser": 0, "MUser_pics": 0, "Theme": 0, "Theme_pics": 0,
         "Membic": 0, "Membic_pics": 0, "misspics":[]}
idmaps = {"MUser": {}, "Theme": {}}

def load_pic(datdir, oid):
    fspec = os.path.join(datdir, "pics", oid + ".png")
    bdat = None
    try:
        with open(fspec, 'rb') as imagefile:
            bdat = imagefile.read()
        return base64.b64encode(bdat)
    except FileNotFoundError:
        logging.warning("Ignoring bad pic reference for " + oid)
        stats["misspics"].append(fspec)
        return None


def import_basic(datdir, jd, entity, picfield, cfs):
    impd = {}
    impd["importid"] = int(jd["gaeid"])
    msg = "  Adding " + entity + " " + str(impd["importid"])
    existing = dbacc.cfbk(entity, "importid", impd["importid"])
    if existing:
        impd["dsId"] = existing["dsId"]
        msg = "Updating" + msg[8:]
        msg +=" --> " + str(existing["dsId"])
    logging.info(msg)
    for key in cfs:
        impd[key] = jd[key]
    if picfield in jd and jd[picfield]:
        impd[picfield] = load_pic(datdir, jd[picfield])
        stats[entity + "_pics"] += 1
    upd = dbacc.write_entity(entity, impd, vck="override")
    idmaps[entity][upd["importid"]] = upd["dsId"]
    stats[entity] += 1
    return upd


def import_MUser(datdir, jd):
    # "preb" is not updated, rebuilt after membics loaded.
    import_basic(datdir, jd, "MUser", "profpic", [
        "email", "phash", "status", "mailbounce", "actsends", "actcode",
        "altinmail", "name", "aboutme", "hashtag", "cliset", "coops",
        "created", "modified", "lastwrite"])


def convert_modhist_modified(jd):
    if "modhist" in jd and jd["modhist"]:
        if ';' in jd["modhist"]:
            mhs = jd["modhist"].split(";")
            jd["created"] = mhs[0]
            jd["modified"] = jd["modified"] + ";" + mhs[1]
        else:
            jd["modified"] = jd["modhist"]
    # themes came in with modhist null, so copy created from modified
    elif "modified" in jd and "created" not in jd:
        jd["created"] = jd["modified"] + ";1"


def remap_idcsv(csv):
    remapped = []
    for impid in util.csv_to_list(csv):
        if impid in idmaps["MUser"]:
            remapped.append(idmaps["MUser"][impid])
    return ",".join(remapped)


def import_Theme(datdir, jd):
    convert_modhist_modified(jd)
    # not importing "people" since rebuilt below
    upd = import_basic(datdir, jd, "Theme", "picture", [
        "name", "name_c", "created", "modified", "lastwrite", "hashtag",
        "description", "founders", "moderators", "members", "seeking",
        "rejects", "cliset", "keywords"])
    memcsvs = ["founders", "moderators", "members", "seeking", "rejects"]
    for fld in memcsvs:
        upd[fld] = remap_idcsv(upd[fld])
        userids = util.csv_to_list(upd[fld])
        for userid in userids:
            upd = util.verify_theme_muser_info(upd, userid)


def import_Membic(datdir, jd):
    convert_modhist_modified(jd)
    impd = {}
    impd["importid"] = int(jd["instid"])
    msg = "  Adding Membic " + str(impd["importid"])
    existing = dbacc.cfbk("Membic", "importid", impd["importid"])
    if existing:
        impd["dsId"] = existing["dsId"]
        msg = "Updating" + msg[8:]
        msg +=" --> " + str(existing["dsId"])
    logging.info(msg)
    cfs = ["url", "rurl", "revtype", "penid", "ctmid", "rating", "srcrev",
           "cankey", "modified", "created", "text", "keywords", "svcdata",
           "imguri", "dispafter", "penname"]
    for key in cfs:
        if key in jd:
            impd[key] = jd[key]
    # reacdat is an empty placeholder
    if "revpic" in jd and jd["revpic"]:
        impd["revpic"] = load_pic(datdir, jd["revpic"])
        stats["Membic_pics"] += 1
    # icwhen and icdata are initially empty.
    dets = {}
    detfs = ["name", "title", "artist", "author", "publisher", "album", 
             "starring", "address", "year"]
    for key in detfs:
        if key in jd:
            dets[key] = jd[key]
    impd["details"] = json.dumps(dets)
    dbacc.write_entity("Membic", impd, vck="override")
    stats["Membic"] += 1


def isfile (path, f):
    if os.path.isfile(os.path.join(path, f)):
        return True
    return False


def data_import(datdir, entities):
    for entity in entities:
        datpath = os.path.join(datdir, entity.lower() + "s")
        dfs = [f for f in os.listdir(datpath) if isfile(datpath, f)]
        for df in dfs:
            if df.find(".json") < 0:
                continue
            with open(os.path.join(datpath, df)) as jf:
                try:
                    jd = json.load(jf)
                except Exception as e:
                    logging.warning("JSON load failure: " + str(jf))
                    raise ValueError from e
                if entity == "MUser":
                    import_MUser(datpath, jd)
                elif entity == "Theme":
                    import_Theme(datpath, jd)
                elif entity == "Membic":
                    import_Membic(datpath, jd)
                else:
                    raise ValueError("Unknown entity type: " + entity)
    logging.info(str(stats))


data_import("/general/dev/membicport", ["MUser", "Theme", "Membic"])

