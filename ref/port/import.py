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
# A few straggling unconverted penids found in theme membics.  Convert now
idmaps = {"MUser": {}, "Theme": {}, "Membic": {},
          "altkey": {"10017": "6642146358591488"}}
mcv = {"orphms":[], "remapped":0}
mpt = {"ompts":[], "remapped":0}


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
    impd = {"dsType": entity, "importid": jd["gaeid"]}
    msg = "  Adding " + entity + " " + impd["importid"]
    existing = dbacc.cfbk(entity, "importid", impd["importid"])
    if existing:
        impd["dsId"] = existing["dsId"]
        msg = "Updating" + msg[8:]
        msg +=" --> " + str(existing["dsId"])
    # logging.info(msg)
    for key in cfs:
        impd[key] = jd[key]
    if picfield in jd and jd[picfield]:
        impd[picfield] = load_pic(datdir, jd[picfield])
        stats[entity + "_pics"] += 1
    upd = dbacc.write_entity(impd, vck="override")
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


def copy_membic_fields(impd, jd, datdir):
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


def make_membic_details(impd, jd):
    dets = {}
    detfs = ["name", "title", "artist", "author", "publisher", "album", 
             "starring", "address", "year"]
    for key in detfs:
        if key in jd:
            dets[key] = jd[key]
    impd["details"] = json.dumps(dets)


def show_postctms_orphans():
    msg = "Remapped postctms for " + str(mpt["remapped"]) + " membics. " +\
          str(len(mpt["ompts"])) + " orphan Membics left over:"
    for om in mpt["ompts"]:
        msg += "\n    Membic " + om["dsId"] + " " + om["svcdata"]
        svcdata = om["svcdata"] or "{}"
        svcdata = json.loads(svcdata)
        svcdata["postctms"] = []
        om["svcdata"] = json.dumps(svcdata)
        dbacc.write_entity(om, vck="override")
    logging.info(msg + "\nCleared out the postctms info for those.")


def can_convert_postctms(membic):
    svcdata = membic["svcdata"] or "{}"
    try:
        svcdata = json.loads(svcdata)
    except Exception as e:
        return False  # leave it for orphan analysis later
    if "postctms" not in svcdata:
        return True
    postctms = svcdata["postctms"] or []
    for pt in postctms:
        if((pt["ctmid"] not in idmaps["Theme"]) or 
           (pt["revid"] not in idmaps["Membic"])):
            return False  # mapped id not available
    return True


def do_postctms_conversion(membic):
    svcdata = membic["svcdata"] or "{}"
    svcdata = json.loads(svcdata)
    if "postctms" not in svcdata or len(svcdata["postctms"]) == 0:
        return  # nothing to convert
    postctms = svcdata["postctms"] or []
    for pt in postctms:
        pt["ctmid"] = idmaps["Theme"][pt["ctmid"]]
        pt["revid"] = idmaps["Membic"][pt["revid"]]
    svcdata["postctms"] = postctms
    membic["svcdata"] = json.dumps(svcdata)
    # input("do_postctms_conversion converted: " + membic["svcdata"])
    mpt["remapped"] += 1


def convert_membic_postctms(membic):
    if membic["svcdata"] == "[object Object]":
        membic["svcdata"] = ""  # data was lost in original db
    orphans = []
    if can_convert_postctms(membic):
        do_postctms_conversion(membic)
    else:
        orphans.append(membic)
    for om in mpt["ompts"]:  # retry previous that couldn't be mapped
        if can_convert_postctms(om):
            do_postctms_conversion(om)
            dbacc.write_entity(om, vck="override")
        else:
            orphans.append(om)
    mpt["ompts"] = orphans


def remap_membic_ctmid_penid(upd):
    ctmid = upd["ctmid"]
    if ctmid and not ctmid.startswith("0"):
        upd["ctmid"] = idmaps["Theme"][ctmid]  # Themes already loaded
    penid = upd["penid"]
    if penid in idmaps["altkey"]:
        penid = idmaps["altkey"][penid]
    upd["penid"] = idmaps["MUser"][penid]
    upd = dbacc.write_entity(upd, vck=upd["modified"])
    idmaps["Membic"][upd["importid"]] = upd["dsId"]
    mcv["remapped"] += 1


def membic_desc_string(membic):
    ms = "Membic " + membic["dsId"] + " importid: " + membic["importid"] +\
         ", penid: " + membic["penid"] + ", ctmid: " + membic["ctmid"] +\
         ", srcrev: " + membic["srcrev"]
    return ms


def show_srcrev_orphans():
    msg = "Remapped penid/ctmid/srcrev for " + str(mcv["remapped"]) +\
          " membics. " + str(len(mcv["orphms"])) + " orphan Membics left over:"
    for om in mcv["orphms"]:
        msg += "\n    " + membic_desc_string(om)
    # msg += "\nmapped keys:"
    # for key in idmaps["Membic"]:
    #     msg += " " + key + ":" + idmaps["Membic"][key]
    logging.info(msg + "\n")
    # input("Press enter to continue")


# Deal with srcrev, ctmid, penid field values.
def remap_membic_refs(upd):
    srcrev = upd["srcrev"]
    if srcrev and not (srcrev.startswith("0") or srcrev.startswith("-")):
        if srcrev not in idmaps["Membic"]:  # no remap available
            mcv["orphms"].append(upd)   # orphaned for now
            # show_srcrev_orphans()
            return  # try remap it again later
        upd["srcrev"] = idmaps["Membic"][srcrev]
    remap_membic_ctmid_penid(upd)
    orphans = []
    for om in mcv["orphms"]:
        if om["srcrev"] in idmaps["Membic"]:
            om["srcrev"] = idmaps["Membic"][om["srcrev"]]
            logging.info("Fixing orphan " + membic_desc_string(om))
            # input(str(len(mcv["orphms"])) + " to go...")
            remap_membic_ctmid_penid(om)
        else:
            orphans.append(om)  # try again next time
    mcv["orphms"] = orphans


def import_Membic(datdir, jd):
    convert_modhist_modified(jd)
    impd = {"dsType": "Membic", "importid": jd["instid"]}
    msg = "  Adding Membic " + impd["importid"]
    existing = dbacc.cfbk("Membic", "importid", impd["importid"])
    if existing:
        impd["dsId"] = existing["dsId"]
        msg = "Updating" + msg[8:]
        msg +=" --> " + str(existing["dsId"])
    # logging.info(msg)
    copy_membic_fields(impd, jd, datdir)
    make_membic_details(impd, jd)
    convert_membic_postctms(impd)
    upd = dbacc.write_entity(impd, vck="override")
    stats["Membic"] += 1
    remap_membic_refs(upd)


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
    show_srcrev_orphans()
    show_postctms_orphans()
    logging.info(str(stats))


data_import("/general/dev/membicport", ["MUser", "Theme", "Membic"])

