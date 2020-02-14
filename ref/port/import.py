import logging
logging.basicConfig(level=logging.DEBUG)
import dbacc
import os
import json


stats = {"MUser": 0, "MUser_Pics": 0}


def import_MUser(datdir, jd):
    impd = {}
    impd["importid"] = int(jd["gaeid"])
    msg = "  Adding MUser " + str(impd["importid"])
    existing = dbacc.cfbk("MUser", "importid", impd["importid"])
    if existing:
        impd["dsId"] = existing["dsId"]
        msg = "Updating" + msg[8:]
        msg +=" --> " + str(existing["dsId"])
    cfs = ["email", "phash", "status", "mailbounce", "actsends", "actcode",
           "altinmail", "name", "aboutme", "hashtag", "cliset", "coops",
           "created", "modified", "lastwrite"]
    for key in cfs:
        impd[key] = jd[key]
    # TODO: "profpic"
    # "preb" is not updated, rebuilt after membics loaded.
    dbacc.write_entity("MUser", impd)
    stats["MUser"] += 1
    logging.info(msg)


def import_Theme(datdir, jf):
    raise ValueError("import_Theme not implemented yet")


def import_Membic(datdir, jf):
    raise ValueError("import_Membic not implemented yet")


def isfile (path, f):
    if os.path.isfile(os.path.join(path, f)):
        return True
    return False


def data_import(datdir, entities):
    for entity in entities:
        datpath = os.path.join(datdir, entity.lower() + "s")
        dfs = [f for f in os.listdir(datpath) if isfile(datpath, f)]
        for df in dfs:
            with open(os.path.join(datpath, df)) as jf:
                jd = json.load(jf)
                if entity == "MUser":
                    import_MUser(datdir, jd)
                elif entity == "Theme":
                    import_Theme(datdir, jd)
                elif entity == "Membic":
                    import_Membic(datdir, jd)
                else:
                    raise ValueError("Unknown entity type: " + entity)


data_import("/general/dev/membicport", ["MUser", "Theme", "Membic"])



