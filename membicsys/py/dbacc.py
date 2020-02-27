########################################
#
#       D O   N O T   E D I T
#
# This file was written by makeMySQLCRUD.js.  Any changes should be made there.
#
########################################

import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re
import datetime
import json
import mysql.connector

# Reserved database fields used for every instance:
#  - dsId: a long int, possibly out of range of a javascript integer,
#    possibly non-sequential, uniquely identifying an entity instance.
#    The entity type + dsId uniquely identifies an object in the system.
#  - created: An ISO timestamp when the instance was first written.
#  - modified: An ISO timestamp followed by ';' followed by mod count.
dbflds = {"dsId": {"pt": "dbid", "un": True, "dv": 0}, 
          "created": {"pt": "string", "un": False, "dv": ""},
          "modified": {"pt": "string", "un": False, "dv": ""}}

entdefs = {
    "MUser": {  # Membic User account.
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "importid": {"pt": "dbid", "un": True, "dv": 0},
        "email": {"pt": "email", "un": True, "dv": ""},
        "phash": {"pt": "string", "un": False, "dv": ""},
        "status": {"pt": "string", "un": False, "dv": ""},
        "mailbounce": {"pt": "string", "un": False, "dv": ""},
        "actsends": {"pt": "string", "un": False, "dv": ""},
        "actcode": {"pt": "string", "un": False, "dv": ""},
        "altinmail": {"pt": "email", "un": True, "dv": ""},
        "name": {"pt": "string", "un": False, "dv": ""},
        "aboutme": {"pt": "string", "un": False, "dv": ""},
        "hashtag": {"pt": "string", "un": True, "dv": ""},
        "profpic": {"pt": "image", "un": False, "dv": None},
        "cliset": {"pt": "string", "un": False, "dv": ""},
        "themes": {"pt": "string", "un": False, "dv": ""},
        "lastwrite": {"pt": "string", "un": False, "dv": ""},
        "preb": {"pt": "string", "un": False, "dv": ""}
    },
    "Theme": {  # A cooperative theme.
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "importid": {"pt": "dbid", "un": True, "dv": 0},
        "name": {"pt": "string", "un": False, "dv": ""},
        "name_c": {"pt": "string", "un": True, "dv": ""},
        "lastwrite": {"pt": "string", "un": False, "dv": ""},
        "hashtag": {"pt": "string", "un": True, "dv": ""},
        "description": {"pt": "string", "un": False, "dv": ""},
        "picture": {"pt": "image", "un": False, "dv": None},
        "founders": {"pt": "string", "un": False, "dv": ""},
        "moderators": {"pt": "string", "un": False, "dv": ""},
        "members": {"pt": "string", "un": False, "dv": ""},
        "seeking": {"pt": "string", "un": False, "dv": ""},
        "rejects": {"pt": "string", "un": False, "dv": ""},
        "people": {"pt": "string", "un": False, "dv": ""},
        "cliset": {"pt": "string", "un": False, "dv": ""},
        "keywords": {"pt": "string", "un": False, "dv": ""},
        "preb": {"pt": "string", "un": False, "dv": ""}
    },
    "AdminLog": {  # Administrative actions log.
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "letype": {"pt": "string", "un": False, "dv": ""},
        "leid": {"pt": "dbid", "un": False, "dv": 0},
        "adminid": {"pt": "dbid", "un": False, "dv": 0},
        "adminname": {"pt": "string", "un": False, "dv": ""},
        "action": {"pt": "string", "un": False, "dv": ""},
        "targent": {"pt": "string", "un": False, "dv": ""},
        "targid": {"pt": "dbid", "un": False, "dv": 0},
        "targname": {"pt": "string", "un": False, "dv": ""},
        "reason": {"pt": "string", "un": False, "dv": ""}
    },
    "Membic": {  # A URL with a reason why it's memorable.
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "importid": {"pt": "dbid", "un": True, "dv": 0},
        "url": {"pt": "string", "un": False, "dv": ""},
        "rurl": {"pt": "string", "un": False, "dv": ""},
        "revtype": {"pt": "string", "un": False, "dv": ""},
        "details": {"pt": "string", "un": False, "dv": ""},
        "penid": {"pt": "dbid", "un": False, "dv": 0},
        "ctmid": {"pt": "dbid", "un": False, "dv": 0},
        "rating": {"pt": "int", "un": False, "dv": 0},
        "srcrev": {"pt": "dbid", "un": False, "dv": 0},
        "cankey": {"pt": "string", "un": False, "dv": ""},
        "text": {"pt": "string", "un": False, "dv": ""},
        "keywords": {"pt": "string", "un": False, "dv": ""},
        "svcdata": {"pt": "string", "un": False, "dv": ""},
        "revpic": {"pt": "image", "un": False, "dv": None},
        "imguri": {"pt": "string", "un": False, "dv": ""},
        "icdata": {"pt": "image", "un": False, "dv": None},
        "icwhen": {"pt": "string", "un": False, "dv": ""},
        "dispafter": {"pt": "string", "un": False, "dv": ""},
        "penname": {"pt": "string", "un": False, "dv": ""},
        "reacdat": {"pt": "string", "un": False, "dv": ""}
    },
    "Overflow": {  # extra preb membics
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "dbkind": {"pt": "string", "un": False, "dv": ""},
        "dbkeyid": {"pt": "dbid", "un": False, "dv": 0},
        "preb": {"pt": "string", "un": False, "dv": ""}
    },
    "MailNotice": {  # Broadcast email tracking
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "name": {"pt": "string", "un": True, "dv": ""},
        "subject": {"pt": "string", "un": False, "dv": ""},
        "uidcsv": {"pt": "string", "un": False, "dv": ""},
        "lastupd": {"pt": "string", "un": False, "dv": ""}
    },
    "ActivitySummary": {  # Stats by profile/theme
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "refp": {"pt": "string", "un": True, "dv": ""},
        "tstart": {"pt": "string", "un": False, "dv": ""},
        "tuntil": {"pt": "string", "un": False, "dv": ""},
        "reqbyid": {"pt": "int", "un": False, "dv": 0},
        "reqbyht": {"pt": "int", "un": False, "dv": 0},
        "reqbypm": {"pt": "int", "un": False, "dv": 0},
        "reqbyrs": {"pt": "int", "un": False, "dv": 0},
        "reqdets": {"pt": "string", "un": False, "dv": ""},
        "newmembics": {"pt": "int", "un": False, "dv": 0},
        "edited": {"pt": "int", "un": False, "dv": 0},
        "removed": {"pt": "int", "un": False, "dv": 0}
    },
    "ConnectionService": {  # Supporting service auth
        "dsId": {"pt": "dbid", "un": True, "dv": 0},
        "created": {"pt": "string", "un": False, "dv": ""},
        "modified": {"pt": "string", "un": False, "dv": ""},
        "name": {"pt": "string", "un": True, "dv": ""},
        "ckey": {"pt": "string", "un": False, "dv": ""},
        "secret": {"pt": "string", "un": False, "dv": ""},
        "data": {"pt": "string", "un": False, "dv": ""}
    }
}


entkeys = {
    "MUser": ["importid", "email", "altinmail", "hashtag"],
    "Theme": ["importid", "name_c", "hashtag"],
    "AdminLog": [],
    "Membic": ["importid"],
    "Overflow": [],
    "MailNotice": ["name"],
    "ActivitySummary": ["refp"],
    "ConnectionService": ["name"]
}


def make_key(dsType, field, value):
    return dsType + "_" + field + "_" + value


def entkey_vals(inst):
    # dsId key holds the cached instance
    instkey = make_key(inst["dsType"], "dsId", inst["dsId"])
    keyvals = [{"key": instkey, "val": json.dumps(inst)}]
    # alternate entity keys point to the dsId key
    for field in entkeys[inst["dsType"]]:
        keyvals.append({"key": make_key(inst["dsType"], field, inst[field]),
                        "val": instkey})
    return keyvals


# Used to avoid repeated calls to the db for the same instance, especially
# within the same call to the webserver.  Time to live should be thought of
# as ranging from zero to at most a few minutes.
class EntityCache(object):
    entities = {}
    def cache_put(self, inst):
        if not inst or not inst["dsId"]:
            raise ValueError("Uncacheable instance: " + str(inst))
        for keyval in entkey_vals(inst):
            self.entities[keyval["key"]] = keyval["val"]
    def cache_get(self, entity, field, value):
        instkey = make_key(entity, field, value)
        if instkey not in self.entities:
            return None
        instval = self.entities[instkey]
        if field != "dsId":
            instval = self.entities[instval]
        return json.loads(instval)
    def cache_remove(self, inst):
        if inst:
            for keyval in entkey_vals(inst):
                self.entities.pop(keyval["key"], None)
entcache = EntityCache()


def reqarg(argname, fieldtype="string", required=False):
    argval = flask.request.args.get(argname)  # None if not found
    if not argval:
        argval = flask.request.form.get(argname)  # Ditto
    if required and not argval:
        raise ValueError("Missing required value for " + argname)
    dotidx = fieldtype.find('.')
    if dotidx > 0:
        entity = fieldtype[0:dotidx]
        fieldname = fieldtype[dotidx + 1:]
        fieldtype = entdefs[entity][fieldname]["pt"]
    if fieldtype == "email":
        emaddr = argval or ""
        emaddr = emaddr.lower()
        emaddr = re.sub('%40', '@', emaddr)
        if required and not re.match(r"[^@]+@[^@]+\.[^@]+", emaddr):
            raise ValueError("Invalid " + argname + " value: " + emaddr)
        return emaddr
    if fieldtype in ["string", "isodate", "isomod", 
                     "text", "json", "idcsv", "isodcsv", "gencsv", "url"]:
        return argval or ""
    if fieldtype == "image":
        return argval or None
    if fieldtype in ["dbid", "int"]:
        argval = argval or 0
        return int(argval)
    raise ValueError("Unknown type " + fieldtype + " for " + argname)


# "cached fetch by key". Field must be dsId or one of the entkeys.
def cfbk (entity, field, value):
    if field != 'dsId' and field not in entkeys[entity]:
        raise ValueError(field + " not a unique index for " + entity)
    ci = entcache.cache_get(entity, field, value)
    if ci:
        return ci
    vstr = str(value)
    if entdefs[entity][field]["pt"] not in ["dbid", "int"]:
        vstr = "\"" + value + "\""
    objs = query_entity(entity, "WHERE " + field + "=" + vstr + " LIMIT 1")
    if len(objs):
        entcache.cache_put(objs[0])
        return objs[0]
    return None


def bust_cache(inst):
    entcache.cache_remove(inst)


# Get a connection to the database.  May throw mysql.connector.Error
# https://dev.mysql.com/doc/connector-python/en/connector-python-connectargs.html
def get_mysql_connector():
    cnx = None
    cnx = mysql.connector.connect(user="root", # password="",
                                  host="127.0.0.1",
                                  database="membic_database")
    return cnx


# Given what should be a string value, remove preceding or trailing space.
# If unique is true, then treat values of "null" or "None" as "".
def trim_string_val(val, unique=False):
    val = val or ""
    val = val.strip()
    if val and unique:
        lowval = val.lower()
        if lowval in ["null", "none"]:
            val = ""
    return val


# Read the given field from the inst or the default values, then convert it
# from an app value to a db value.  All string values are trimmed since
# preceding or trailing space makes matching horrible and buggy.  The UI can
# add a trailing newline for long text if it wants.
def app2db_fieldval(entity, field, inst):
    if entity:
        pt = entdefs[entity][field]["pt"]
        unique = entdefs[entity][field]["un"]
        val = entdefs[entity][field]["dv"]
    else:
        pt = dbflds[field]["pt"]
        unique = dbflds[field]["un"]
        val = dbflds[field]["dv"]
    if field in inst:
        val = inst[field]
    # convert value based on type and whether the values are unique
    if pt in ["email", "string"]:
        val = val or ""
        val = trim_string_val(val, unique)  # trim all strings. See comment.
        if not val:
            val = None
    elif pt == "image":
        if not val:  # Empty data gets set to null
            val = None
    elif pt == "int":
        val = val or 0
        val = int(val)  # convert possible "0" value
    elif pt == "dbid":
        try:
            val = int(val)  # will fail on "", "null" or other bad values
        except ValueError:
            val = 0
        if unique and not val:  # null vals don't violate UNIQUE constraint
            val = None          # otherwise use 0 as val may be required
    return val


# Read the given field from the inst or the default values, then convert it
# from a db value to an app value.  "app" means the server side module
# calling this module, not the web client.  Image binary values and json
# field values are not decoded, but get safe defaults if NULL.  dbids are
# converted to strings.
def db2app_fieldval(entity, field, inst):
    if entity:
        pt = entdefs[entity][field]["pt"]
        val = entdefs[entity][field]["dv"]
    else:
        pt = dbflds[field]["pt"]
        val = dbflds[field]["dv"]
    if field in inst:
        val = inst[field]
    # convert value based on type
    if pt in ["email", "string"]:
        if not val:  # A null value gets set to the empty string
            val = ""
    elif pt == "image":
        if not val:  # A null value gets set to the empty string
            val = ""
    elif pt == "int":
        if not val:  # Convert null values to 0
            val = 0
    elif pt == "dbid":
        if not val:  # A zero or null value gets set to falsey empty string
            val = ""
        else:
            val = str(val)
    return val


def dt2ISO(dt):
    iso = str(dt.year) + "-" + str(dt.month).rjust(2, '0') + "-"
    iso += str(dt.day).rjust(2, '0') + "T" + str(dt.hour).rjust(2, '0')
    iso += ":" + str(dt.minute).rjust(2, '0') + ":"
    iso += str(dt.second).rjust(2, '0') + "Z"
    return iso


def nowISO():
    """ Return the current time as an ISO string """
    return dt2ISO(datetime.datetime.utcnow())


def initialize_timestamp_fields(fields, vck):
    ts = nowISO()
    if "created" not in fields or not fields["created"] or vck != "override":
        fields["created"] = ts
    if "modified" not in fields or not fields["modified"] or vck != "override":
        fields["modified"] = ts + ";1"


def verify_timestamp_fields(entity, dsId, fields, vck):
    if vck == "override" and "created" in fields and "modified" in fields:
        return  # skip query and use specified values
    if not vck or not vck.strip():
        raise ValueError("Version check required to update " + entity +
                         " " + str(dsId))
    existing = cfbk(entity, "dsId", dsId)
    if not existing:
        raise ValueError("Existing " + entity + " " + str(dsId) + " not found.")
    if vck != "override" and existing["modified"] != vck:
        raise ValueError("Update error. Outdated data given for " + entity +
                         " " + str(dsId) + ".")
    if "created" not in fields or not fields["created"] or vck != "override":
        fields["created"] = existing["created"]
    ver = 1
    mods = existing["modified"].split(";")
    if len(mods) > 1:
        ver = int(mods[1]) + 1
    if "modified" not in fields or not fields["modified"] or vck != "override":
        fields["modified"] = nowISO() + ";" + str(ver)


# Convert the given MUser inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_MUser(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["importid"] = app2db_fieldval("MUser", "importid", inst)
    cnv["email"] = app2db_fieldval("MUser", "email", inst)
    cnv["phash"] = app2db_fieldval("MUser", "phash", inst)
    cnv["status"] = app2db_fieldval("MUser", "status", inst)
    cnv["mailbounce"] = app2db_fieldval("MUser", "mailbounce", inst)
    cnv["actsends"] = app2db_fieldval("MUser", "actsends", inst)
    cnv["actcode"] = app2db_fieldval("MUser", "actcode", inst)
    cnv["altinmail"] = app2db_fieldval("MUser", "altinmail", inst)
    cnv["name"] = app2db_fieldval("MUser", "name", inst)
    cnv["aboutme"] = app2db_fieldval("MUser", "aboutme", inst)
    cnv["hashtag"] = app2db_fieldval("MUser", "hashtag", inst)
    cnv["profpic"] = app2db_fieldval("MUser", "profpic", inst)
    cnv["cliset"] = app2db_fieldval("MUser", "cliset", inst)
    cnv["themes"] = app2db_fieldval("MUser", "themes", inst)
    cnv["lastwrite"] = app2db_fieldval("MUser", "lastwrite", inst)
    cnv["preb"] = app2db_fieldval("MUser", "preb", inst)
    return cnv


# Convert the given MUser inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_MUser(inst):
    cnv = {}
    cnv["dsType"] = "MUser"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["importid"] = db2app_fieldval("MUser", "importid", inst)
    cnv["email"] = db2app_fieldval("MUser", "email", inst)
    cnv["phash"] = db2app_fieldval("MUser", "phash", inst)
    cnv["status"] = db2app_fieldval("MUser", "status", inst)
    cnv["mailbounce"] = db2app_fieldval("MUser", "mailbounce", inst)
    cnv["actsends"] = db2app_fieldval("MUser", "actsends", inst)
    cnv["actcode"] = db2app_fieldval("MUser", "actcode", inst)
    cnv["altinmail"] = db2app_fieldval("MUser", "altinmail", inst)
    cnv["name"] = db2app_fieldval("MUser", "name", inst)
    cnv["aboutme"] = db2app_fieldval("MUser", "aboutme", inst)
    cnv["hashtag"] = db2app_fieldval("MUser", "hashtag", inst)
    cnv["profpic"] = db2app_fieldval("MUser", "profpic", inst)
    cnv["cliset"] = db2app_fieldval("MUser", "cliset", inst)
    cnv["themes"] = db2app_fieldval("MUser", "themes", inst)
    cnv["lastwrite"] = db2app_fieldval("MUser", "lastwrite", inst)
    cnv["preb"] = db2app_fieldval("MUser", "preb", inst)
    return cnv


# Convert the given Theme inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_Theme(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["importid"] = app2db_fieldval("Theme", "importid", inst)
    cnv["name"] = app2db_fieldval("Theme", "name", inst)
    cnv["name_c"] = app2db_fieldval("Theme", "name_c", inst)
    cnv["lastwrite"] = app2db_fieldval("Theme", "lastwrite", inst)
    cnv["hashtag"] = app2db_fieldval("Theme", "hashtag", inst)
    cnv["description"] = app2db_fieldval("Theme", "description", inst)
    cnv["picture"] = app2db_fieldval("Theme", "picture", inst)
    cnv["founders"] = app2db_fieldval("Theme", "founders", inst)
    cnv["moderators"] = app2db_fieldval("Theme", "moderators", inst)
    cnv["members"] = app2db_fieldval("Theme", "members", inst)
    cnv["seeking"] = app2db_fieldval("Theme", "seeking", inst)
    cnv["rejects"] = app2db_fieldval("Theme", "rejects", inst)
    cnv["people"] = app2db_fieldval("Theme", "people", inst)
    cnv["cliset"] = app2db_fieldval("Theme", "cliset", inst)
    cnv["keywords"] = app2db_fieldval("Theme", "keywords", inst)
    cnv["preb"] = app2db_fieldval("Theme", "preb", inst)
    return cnv


# Convert the given Theme inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_Theme(inst):
    cnv = {}
    cnv["dsType"] = "Theme"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["importid"] = db2app_fieldval("Theme", "importid", inst)
    cnv["name"] = db2app_fieldval("Theme", "name", inst)
    cnv["name_c"] = db2app_fieldval("Theme", "name_c", inst)
    cnv["lastwrite"] = db2app_fieldval("Theme", "lastwrite", inst)
    cnv["hashtag"] = db2app_fieldval("Theme", "hashtag", inst)
    cnv["description"] = db2app_fieldval("Theme", "description", inst)
    cnv["picture"] = db2app_fieldval("Theme", "picture", inst)
    cnv["founders"] = db2app_fieldval("Theme", "founders", inst)
    cnv["moderators"] = db2app_fieldval("Theme", "moderators", inst)
    cnv["members"] = db2app_fieldval("Theme", "members", inst)
    cnv["seeking"] = db2app_fieldval("Theme", "seeking", inst)
    cnv["rejects"] = db2app_fieldval("Theme", "rejects", inst)
    cnv["people"] = db2app_fieldval("Theme", "people", inst)
    cnv["cliset"] = db2app_fieldval("Theme", "cliset", inst)
    cnv["keywords"] = db2app_fieldval("Theme", "keywords", inst)
    cnv["preb"] = db2app_fieldval("Theme", "preb", inst)
    return cnv


# Convert the given AdminLog inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_AdminLog(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["letype"] = app2db_fieldval("AdminLog", "letype", inst)
    cnv["leid"] = app2db_fieldval("AdminLog", "leid", inst)
    cnv["adminid"] = app2db_fieldval("AdminLog", "adminid", inst)
    cnv["adminname"] = app2db_fieldval("AdminLog", "adminname", inst)
    cnv["action"] = app2db_fieldval("AdminLog", "action", inst)
    cnv["targent"] = app2db_fieldval("AdminLog", "targent", inst)
    cnv["targid"] = app2db_fieldval("AdminLog", "targid", inst)
    cnv["targname"] = app2db_fieldval("AdminLog", "targname", inst)
    cnv["reason"] = app2db_fieldval("AdminLog", "reason", inst)
    return cnv


# Convert the given AdminLog inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_AdminLog(inst):
    cnv = {}
    cnv["dsType"] = "AdminLog"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["letype"] = db2app_fieldval("AdminLog", "letype", inst)
    cnv["leid"] = db2app_fieldval("AdminLog", "leid", inst)
    cnv["adminid"] = db2app_fieldval("AdminLog", "adminid", inst)
    cnv["adminname"] = db2app_fieldval("AdminLog", "adminname", inst)
    cnv["action"] = db2app_fieldval("AdminLog", "action", inst)
    cnv["targent"] = db2app_fieldval("AdminLog", "targent", inst)
    cnv["targid"] = db2app_fieldval("AdminLog", "targid", inst)
    cnv["targname"] = db2app_fieldval("AdminLog", "targname", inst)
    cnv["reason"] = db2app_fieldval("AdminLog", "reason", inst)
    return cnv


# Convert the given Membic inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_Membic(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["importid"] = app2db_fieldval("Membic", "importid", inst)
    cnv["url"] = app2db_fieldval("Membic", "url", inst)
    cnv["rurl"] = app2db_fieldval("Membic", "rurl", inst)
    cnv["revtype"] = app2db_fieldval("Membic", "revtype", inst)
    cnv["details"] = app2db_fieldval("Membic", "details", inst)
    cnv["penid"] = app2db_fieldval("Membic", "penid", inst)
    cnv["ctmid"] = app2db_fieldval("Membic", "ctmid", inst)
    cnv["rating"] = app2db_fieldval("Membic", "rating", inst)
    cnv["srcrev"] = app2db_fieldval("Membic", "srcrev", inst)
    cnv["cankey"] = app2db_fieldval("Membic", "cankey", inst)
    cnv["text"] = app2db_fieldval("Membic", "text", inst)
    cnv["keywords"] = app2db_fieldval("Membic", "keywords", inst)
    cnv["svcdata"] = app2db_fieldval("Membic", "svcdata", inst)
    cnv["revpic"] = app2db_fieldval("Membic", "revpic", inst)
    cnv["imguri"] = app2db_fieldval("Membic", "imguri", inst)
    cnv["icdata"] = app2db_fieldval("Membic", "icdata", inst)
    cnv["icwhen"] = app2db_fieldval("Membic", "icwhen", inst)
    cnv["dispafter"] = app2db_fieldval("Membic", "dispafter", inst)
    cnv["penname"] = app2db_fieldval("Membic", "penname", inst)
    cnv["reacdat"] = app2db_fieldval("Membic", "reacdat", inst)
    return cnv


# Convert the given Membic inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_Membic(inst):
    cnv = {}
    cnv["dsType"] = "Membic"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["importid"] = db2app_fieldval("Membic", "importid", inst)
    cnv["url"] = db2app_fieldval("Membic", "url", inst)
    cnv["rurl"] = db2app_fieldval("Membic", "rurl", inst)
    cnv["revtype"] = db2app_fieldval("Membic", "revtype", inst)
    cnv["details"] = db2app_fieldval("Membic", "details", inst)
    cnv["penid"] = db2app_fieldval("Membic", "penid", inst)
    cnv["ctmid"] = db2app_fieldval("Membic", "ctmid", inst)
    cnv["rating"] = db2app_fieldval("Membic", "rating", inst)
    cnv["srcrev"] = db2app_fieldval("Membic", "srcrev", inst)
    cnv["cankey"] = db2app_fieldval("Membic", "cankey", inst)
    cnv["text"] = db2app_fieldval("Membic", "text", inst)
    cnv["keywords"] = db2app_fieldval("Membic", "keywords", inst)
    cnv["svcdata"] = db2app_fieldval("Membic", "svcdata", inst)
    cnv["revpic"] = db2app_fieldval("Membic", "revpic", inst)
    cnv["imguri"] = db2app_fieldval("Membic", "imguri", inst)
    cnv["icdata"] = db2app_fieldval("Membic", "icdata", inst)
    cnv["icwhen"] = db2app_fieldval("Membic", "icwhen", inst)
    cnv["dispafter"] = db2app_fieldval("Membic", "dispafter", inst)
    cnv["penname"] = db2app_fieldval("Membic", "penname", inst)
    cnv["reacdat"] = db2app_fieldval("Membic", "reacdat", inst)
    return cnv


# Convert the given Overflow inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_Overflow(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["dbkind"] = app2db_fieldval("Overflow", "dbkind", inst)
    cnv["dbkeyid"] = app2db_fieldval("Overflow", "dbkeyid", inst)
    cnv["preb"] = app2db_fieldval("Overflow", "preb", inst)
    return cnv


# Convert the given Overflow inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_Overflow(inst):
    cnv = {}
    cnv["dsType"] = "Overflow"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["dbkind"] = db2app_fieldval("Overflow", "dbkind", inst)
    cnv["dbkeyid"] = db2app_fieldval("Overflow", "dbkeyid", inst)
    cnv["preb"] = db2app_fieldval("Overflow", "preb", inst)
    return cnv


# Convert the given MailNotice inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_MailNotice(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["name"] = app2db_fieldval("MailNotice", "name", inst)
    cnv["subject"] = app2db_fieldval("MailNotice", "subject", inst)
    cnv["uidcsv"] = app2db_fieldval("MailNotice", "uidcsv", inst)
    cnv["lastupd"] = app2db_fieldval("MailNotice", "lastupd", inst)
    return cnv


# Convert the given MailNotice inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_MailNotice(inst):
    cnv = {}
    cnv["dsType"] = "MailNotice"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["name"] = db2app_fieldval("MailNotice", "name", inst)
    cnv["subject"] = db2app_fieldval("MailNotice", "subject", inst)
    cnv["uidcsv"] = db2app_fieldval("MailNotice", "uidcsv", inst)
    cnv["lastupd"] = db2app_fieldval("MailNotice", "lastupd", inst)
    return cnv


# Convert the given ActivitySummary inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_ActivitySummary(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["refp"] = app2db_fieldval("ActivitySummary", "refp", inst)
    cnv["tstart"] = app2db_fieldval("ActivitySummary", "tstart", inst)
    cnv["tuntil"] = app2db_fieldval("ActivitySummary", "tuntil", inst)
    cnv["reqbyid"] = app2db_fieldval("ActivitySummary", "reqbyid", inst)
    cnv["reqbyht"] = app2db_fieldval("ActivitySummary", "reqbyht", inst)
    cnv["reqbypm"] = app2db_fieldval("ActivitySummary", "reqbypm", inst)
    cnv["reqbyrs"] = app2db_fieldval("ActivitySummary", "reqbyrs", inst)
    cnv["reqdets"] = app2db_fieldval("ActivitySummary", "reqdets", inst)
    cnv["newmembics"] = app2db_fieldval("ActivitySummary", "newmembics", inst)
    cnv["edited"] = app2db_fieldval("ActivitySummary", "edited", inst)
    cnv["removed"] = app2db_fieldval("ActivitySummary", "removed", inst)
    return cnv


# Convert the given ActivitySummary inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_ActivitySummary(inst):
    cnv = {}
    cnv["dsType"] = "ActivitySummary"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["refp"] = db2app_fieldval("ActivitySummary", "refp", inst)
    cnv["tstart"] = db2app_fieldval("ActivitySummary", "tstart", inst)
    cnv["tuntil"] = db2app_fieldval("ActivitySummary", "tuntil", inst)
    cnv["reqbyid"] = db2app_fieldval("ActivitySummary", "reqbyid", inst)
    cnv["reqbyht"] = db2app_fieldval("ActivitySummary", "reqbyht", inst)
    cnv["reqbypm"] = db2app_fieldval("ActivitySummary", "reqbypm", inst)
    cnv["reqbyrs"] = db2app_fieldval("ActivitySummary", "reqbyrs", inst)
    cnv["reqdets"] = db2app_fieldval("ActivitySummary", "reqdets", inst)
    cnv["newmembics"] = db2app_fieldval("ActivitySummary", "newmembics", inst)
    cnv["edited"] = db2app_fieldval("ActivitySummary", "edited", inst)
    cnv["removed"] = db2app_fieldval("ActivitySummary", "removed", inst)
    return cnv


# Convert the given ConnectionService inst dict from app values to db values.  Removes
# the dsType field to avoid trying to write it to the db.
def app2db_ConnectionService(inst):
    cnv = {}
    cnv["dsId"] = None
    if "dsId" in inst:
        cnv["dsId"] = app2db_fieldval(None, "dsId", inst)
    cnv["created"] = app2db_fieldval(None, "created", inst)
    cnv["modified"] = app2db_fieldval(None, "modified", inst)
    cnv["name"] = app2db_fieldval("ConnectionService", "name", inst)
    cnv["ckey"] = app2db_fieldval("ConnectionService", "ckey", inst)
    cnv["secret"] = app2db_fieldval("ConnectionService", "secret", inst)
    cnv["data"] = app2db_fieldval("ConnectionService", "data", inst)
    return cnv


# Convert the given ConnectionService inst dict from db values to app values.  Adds the
# dsType field for general app processing.
def db2app_ConnectionService(inst):
    cnv = {}
    cnv["dsType"] = "ConnectionService"
    cnv["dsId"] = db2app_fieldval(None, "dsId", inst)
    cnv["created"] = db2app_fieldval(None, "created", inst)
    cnv["modified"] = db2app_fieldval(None, "modified", inst)
    cnv["name"] = db2app_fieldval("ConnectionService", "name", inst)
    cnv["ckey"] = db2app_fieldval("ConnectionService", "ckey", inst)
    cnv["secret"] = db2app_fieldval("ConnectionService", "secret", inst)
    cnv["data"] = db2app_fieldval("ConnectionService", "data", inst)
    return cnv


def dblogmsg(op, entity, res):
    log_summary_flds = {
        "MUser": ["email", "name"],
        "Theme": ["name"],
        "Membic": ["url", "penname", "penid", "ctmid"],
        "ConnectionService": ["name"]}
    if op != "QRY":
        res = [res]
    for obj in res:
        msg = "db" + op + " " + entity + " " + obj["dsId"]
        if entity in log_summary_flds:
            for field in log_summary_flds[entity]:
                msg += " " + obj[field]
        logging.info(msg)


# Write a new MUser row, using the given field values or defaults.
def insert_new_MUser(cnx, cursor, fields):
    fields = app2db_MUser(fields)
    stmt = (
        "INSERT INTO MUser (created, modified, importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, themes, lastwrite, preb) "
        "VALUES (%(created)s, %(modified)s, %(importid)s, %(email)s, %(phash)s, %(status)s, %(mailbounce)s, %(actsends)s, %(actcode)s, %(altinmail)s, %(name)s, %(aboutme)s, %(hashtag)s, %(profpic)s, %(cliset)s, %(themes)s, %(lastwrite)s, %(preb)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'importid': fields.get("importid", entdefs["MUser"]["importid"]["dv"]),
        'email': fields.get("email", entdefs["MUser"]["email"]["dv"]),
        'phash': fields.get("phash", entdefs["MUser"]["phash"]["dv"]),
        'status': fields.get("status", entdefs["MUser"]["status"]["dv"]),
        'mailbounce': fields.get("mailbounce", entdefs["MUser"]["mailbounce"]["dv"]),
        'actsends': fields.get("actsends", entdefs["MUser"]["actsends"]["dv"]),
        'actcode': fields.get("actcode", entdefs["MUser"]["actcode"]["dv"]),
        'altinmail': fields.get("altinmail", entdefs["MUser"]["altinmail"]["dv"]),
        'name': fields.get("name", entdefs["MUser"]["name"]["dv"]),
        'aboutme': fields.get("aboutme", entdefs["MUser"]["aboutme"]["dv"]),
        'hashtag': fields.get("hashtag", entdefs["MUser"]["hashtag"]["dv"]),
        'profpic': fields.get("profpic", entdefs["MUser"]["profpic"]["dv"]),
        'cliset': fields.get("cliset", entdefs["MUser"]["cliset"]["dv"]),
        'themes': fields.get("themes", entdefs["MUser"]["themes"]["dv"]),
        'lastwrite': fields.get("lastwrite", entdefs["MUser"]["lastwrite"]["dv"]),
        'preb': fields.get("preb", entdefs["MUser"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_MUser(fields)
    dblogmsg("ADD", "MUser", fields)
    bust_cache(fields)
    return fields


# Update the specified MUser row with the given field values.
def update_existing_MUser(cnx, cursor, fields, vck):
    fields = app2db_MUser(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE MUser SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("MUser update received outdated data.")
    cnx.commit()
    fields = db2app_MUser(fields)
    bust_cache(fields)
    dblogmsg("UPD", "MUser", fields)
    return fields


# Write a new Theme row, using the given field values or defaults.
def insert_new_Theme(cnx, cursor, fields):
    fields = app2db_Theme(fields)
    stmt = (
        "INSERT INTO Theme (created, modified, importid, name, name_c, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, people, cliset, keywords, preb) "
        "VALUES (%(created)s, %(modified)s, %(importid)s, %(name)s, %(name_c)s, %(lastwrite)s, %(hashtag)s, %(description)s, %(picture)s, %(founders)s, %(moderators)s, %(members)s, %(seeking)s, %(rejects)s, %(people)s, %(cliset)s, %(keywords)s, %(preb)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'importid': fields.get("importid", entdefs["Theme"]["importid"]["dv"]),
        'name': fields.get("name", entdefs["Theme"]["name"]["dv"]),
        'name_c': fields.get("name_c", entdefs["Theme"]["name_c"]["dv"]),
        'lastwrite': fields.get("lastwrite", entdefs["Theme"]["lastwrite"]["dv"]),
        'hashtag': fields.get("hashtag", entdefs["Theme"]["hashtag"]["dv"]),
        'description': fields.get("description", entdefs["Theme"]["description"]["dv"]),
        'picture': fields.get("picture", entdefs["Theme"]["picture"]["dv"]),
        'founders': fields.get("founders", entdefs["Theme"]["founders"]["dv"]),
        'moderators': fields.get("moderators", entdefs["Theme"]["moderators"]["dv"]),
        'members': fields.get("members", entdefs["Theme"]["members"]["dv"]),
        'seeking': fields.get("seeking", entdefs["Theme"]["seeking"]["dv"]),
        'rejects': fields.get("rejects", entdefs["Theme"]["rejects"]["dv"]),
        'people': fields.get("people", entdefs["Theme"]["people"]["dv"]),
        'cliset': fields.get("cliset", entdefs["Theme"]["cliset"]["dv"]),
        'keywords': fields.get("keywords", entdefs["Theme"]["keywords"]["dv"]),
        'preb': fields.get("preb", entdefs["Theme"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_Theme(fields)
    dblogmsg("ADD", "Theme", fields)
    bust_cache(fields)
    return fields


# Update the specified Theme row with the given field values.
def update_existing_Theme(cnx, cursor, fields, vck):
    fields = app2db_Theme(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE Theme SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("Theme update received outdated data.")
    cnx.commit()
    fields = db2app_Theme(fields)
    bust_cache(fields)
    dblogmsg("UPD", "Theme", fields)
    return fields


# Write a new AdminLog row, using the given field values or defaults.
def insert_new_AdminLog(cnx, cursor, fields):
    fields = app2db_AdminLog(fields)
    stmt = (
        "INSERT INTO AdminLog (created, modified, letype, leid, adminid, adminname, action, targent, targid, targname, reason) "
        "VALUES (%(created)s, %(modified)s, %(letype)s, %(leid)s, %(adminid)s, %(adminname)s, %(action)s, %(targent)s, %(targid)s, %(targname)s, %(reason)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'letype': fields.get("letype", entdefs["AdminLog"]["letype"]["dv"]),
        'leid': fields.get("leid", entdefs["AdminLog"]["leid"]["dv"]),
        'adminid': fields.get("adminid", entdefs["AdminLog"]["adminid"]["dv"]),
        'adminname': fields.get("adminname", entdefs["AdminLog"]["adminname"]["dv"]),
        'action': fields.get("action", entdefs["AdminLog"]["action"]["dv"]),
        'targent': fields.get("targent", entdefs["AdminLog"]["targent"]["dv"]),
        'targid': fields.get("targid", entdefs["AdminLog"]["targid"]["dv"]),
        'targname': fields.get("targname", entdefs["AdminLog"]["targname"]["dv"]),
        'reason': fields.get("reason", entdefs["AdminLog"]["reason"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_AdminLog(fields)
    dblogmsg("ADD", "AdminLog", fields)
    bust_cache(fields)
    return fields


# Update the specified AdminLog row with the given field values.
def update_existing_AdminLog(cnx, cursor, fields, vck):
    fields = app2db_AdminLog(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE AdminLog SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("AdminLog update received outdated data.")
    cnx.commit()
    fields = db2app_AdminLog(fields)
    bust_cache(fields)
    dblogmsg("UPD", "AdminLog", fields)
    return fields


# Write a new Membic row, using the given field values or defaults.
def insert_new_Membic(cnx, cursor, fields):
    fields = app2db_Membic(fields)
    stmt = (
        "INSERT INTO Membic (created, modified, importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat) "
        "VALUES (%(created)s, %(modified)s, %(importid)s, %(url)s, %(rurl)s, %(revtype)s, %(details)s, %(penid)s, %(ctmid)s, %(rating)s, %(srcrev)s, %(cankey)s, %(text)s, %(keywords)s, %(svcdata)s, %(revpic)s, %(imguri)s, %(icdata)s, %(icwhen)s, %(dispafter)s, %(penname)s, %(reacdat)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'importid': fields.get("importid", entdefs["Membic"]["importid"]["dv"]),
        'url': fields.get("url", entdefs["Membic"]["url"]["dv"]),
        'rurl': fields.get("rurl", entdefs["Membic"]["rurl"]["dv"]),
        'revtype': fields.get("revtype", entdefs["Membic"]["revtype"]["dv"]),
        'details': fields.get("details", entdefs["Membic"]["details"]["dv"]),
        'penid': fields.get("penid", entdefs["Membic"]["penid"]["dv"]),
        'ctmid': fields.get("ctmid", entdefs["Membic"]["ctmid"]["dv"]),
        'rating': fields.get("rating", entdefs["Membic"]["rating"]["dv"]),
        'srcrev': fields.get("srcrev", entdefs["Membic"]["srcrev"]["dv"]),
        'cankey': fields.get("cankey", entdefs["Membic"]["cankey"]["dv"]),
        'text': fields.get("text", entdefs["Membic"]["text"]["dv"]),
        'keywords': fields.get("keywords", entdefs["Membic"]["keywords"]["dv"]),
        'svcdata': fields.get("svcdata", entdefs["Membic"]["svcdata"]["dv"]),
        'revpic': fields.get("revpic", entdefs["Membic"]["revpic"]["dv"]),
        'imguri': fields.get("imguri", entdefs["Membic"]["imguri"]["dv"]),
        'icdata': fields.get("icdata", entdefs["Membic"]["icdata"]["dv"]),
        'icwhen': fields.get("icwhen", entdefs["Membic"]["icwhen"]["dv"]),
        'dispafter': fields.get("dispafter", entdefs["Membic"]["dispafter"]["dv"]),
        'penname': fields.get("penname", entdefs["Membic"]["penname"]["dv"]),
        'reacdat': fields.get("reacdat", entdefs["Membic"]["reacdat"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_Membic(fields)
    dblogmsg("ADD", "Membic", fields)
    bust_cache(fields)
    return fields


# Update the specified Membic row with the given field values.
def update_existing_Membic(cnx, cursor, fields, vck):
    fields = app2db_Membic(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE Membic SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("Membic update received outdated data.")
    cnx.commit()
    fields = db2app_Membic(fields)
    bust_cache(fields)
    dblogmsg("UPD", "Membic", fields)
    return fields


# Write a new Overflow row, using the given field values or defaults.
def insert_new_Overflow(cnx, cursor, fields):
    fields = app2db_Overflow(fields)
    stmt = (
        "INSERT INTO Overflow (created, modified, dbkind, dbkeyid, preb) "
        "VALUES (%(created)s, %(modified)s, %(dbkind)s, %(dbkeyid)s, %(preb)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'dbkind': fields.get("dbkind", entdefs["Overflow"]["dbkind"]["dv"]),
        'dbkeyid': fields.get("dbkeyid", entdefs["Overflow"]["dbkeyid"]["dv"]),
        'preb': fields.get("preb", entdefs["Overflow"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_Overflow(fields)
    dblogmsg("ADD", "Overflow", fields)
    bust_cache(fields)
    return fields


# Update the specified Overflow row with the given field values.
def update_existing_Overflow(cnx, cursor, fields, vck):
    fields = app2db_Overflow(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE Overflow SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("Overflow update received outdated data.")
    cnx.commit()
    fields = db2app_Overflow(fields)
    bust_cache(fields)
    dblogmsg("UPD", "Overflow", fields)
    return fields


# Write a new MailNotice row, using the given field values or defaults.
def insert_new_MailNotice(cnx, cursor, fields):
    fields = app2db_MailNotice(fields)
    stmt = (
        "INSERT INTO MailNotice (created, modified, name, subject, uidcsv, lastupd) "
        "VALUES (%(created)s, %(modified)s, %(name)s, %(subject)s, %(uidcsv)s, %(lastupd)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'name': fields.get("name", entdefs["MailNotice"]["name"]["dv"]),
        'subject': fields.get("subject", entdefs["MailNotice"]["subject"]["dv"]),
        'uidcsv': fields.get("uidcsv", entdefs["MailNotice"]["uidcsv"]["dv"]),
        'lastupd': fields.get("lastupd", entdefs["MailNotice"]["lastupd"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_MailNotice(fields)
    dblogmsg("ADD", "MailNotice", fields)
    bust_cache(fields)
    return fields


# Update the specified MailNotice row with the given field values.
def update_existing_MailNotice(cnx, cursor, fields, vck):
    fields = app2db_MailNotice(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE MailNotice SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("MailNotice update received outdated data.")
    cnx.commit()
    fields = db2app_MailNotice(fields)
    bust_cache(fields)
    dblogmsg("UPD", "MailNotice", fields)
    return fields


# Write a new ActivitySummary row, using the given field values or defaults.
def insert_new_ActivitySummary(cnx, cursor, fields):
    fields = app2db_ActivitySummary(fields)
    stmt = (
        "INSERT INTO ActivitySummary (created, modified, refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, newmembics, edited, removed) "
        "VALUES (%(created)s, %(modified)s, %(refp)s, %(tstart)s, %(tuntil)s, %(reqbyid)s, %(reqbyht)s, %(reqbypm)s, %(reqbyrs)s, %(reqdets)s, %(newmembics)s, %(edited)s, %(removed)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'refp': fields.get("refp", entdefs["ActivitySummary"]["refp"]["dv"]),
        'tstart': fields.get("tstart", entdefs["ActivitySummary"]["tstart"]["dv"]),
        'tuntil': fields.get("tuntil", entdefs["ActivitySummary"]["tuntil"]["dv"]),
        'reqbyid': fields.get("reqbyid", entdefs["ActivitySummary"]["reqbyid"]["dv"]),
        'reqbyht': fields.get("reqbyht", entdefs["ActivitySummary"]["reqbyht"]["dv"]),
        'reqbypm': fields.get("reqbypm", entdefs["ActivitySummary"]["reqbypm"]["dv"]),
        'reqbyrs': fields.get("reqbyrs", entdefs["ActivitySummary"]["reqbyrs"]["dv"]),
        'reqdets': fields.get("reqdets", entdefs["ActivitySummary"]["reqdets"]["dv"]),
        'newmembics': fields.get("newmembics", entdefs["ActivitySummary"]["newmembics"]["dv"]),
        'edited': fields.get("edited", entdefs["ActivitySummary"]["edited"]["dv"]),
        'removed': fields.get("removed", entdefs["ActivitySummary"]["removed"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_ActivitySummary(fields)
    dblogmsg("ADD", "ActivitySummary", fields)
    bust_cache(fields)
    return fields


# Update the specified ActivitySummary row with the given field values.
def update_existing_ActivitySummary(cnx, cursor, fields, vck):
    fields = app2db_ActivitySummary(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE ActivitySummary SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("ActivitySummary update received outdated data.")
    cnx.commit()
    fields = db2app_ActivitySummary(fields)
    bust_cache(fields)
    dblogmsg("UPD", "ActivitySummary", fields)
    return fields


# Write a new ConnectionService row, using the given field values or defaults.
def insert_new_ConnectionService(cnx, cursor, fields):
    fields = app2db_ConnectionService(fields)
    stmt = (
        "INSERT INTO ConnectionService (created, modified, name, ckey, secret, data) "
        "VALUES (%(created)s, %(modified)s, %(name)s, %(ckey)s, %(secret)s, %(data)s)")
    data = {
        'created': fields.get("created"),
        'modified': fields.get("modified"),
        'name': fields.get("name", entdefs["ConnectionService"]["name"]["dv"]),
        'ckey': fields.get("ckey", entdefs["ConnectionService"]["ckey"]["dv"]),
        'secret': fields.get("secret", entdefs["ConnectionService"]["secret"]["dv"]),
        'data': fields.get("data", entdefs["ConnectionService"]["data"]["dv"])}
    cursor.execute(stmt, data)
    fields["dsId"] = cursor.lastrowid
    cnx.commit()
    fields = db2app_ConnectionService(fields)
    dblogmsg("ADD", "ConnectionService", fields)
    bust_cache(fields)
    return fields


# Update the specified ConnectionService row with the given field values.
def update_existing_ConnectionService(cnx, cursor, fields, vck):
    fields = app2db_ConnectionService(fields)
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:  # only updating the fields passed in
        if stmt:
            stmt += ", "
        stmt += field + "=(%(" + field + ")s)"
    stmt = "UPDATE ConnectionService SET " + stmt + " WHERE dsId=" + str(dsId)
    if vck != "override":
        stmt += " AND modified=\"" + vck + "\""
    data = {}
    for field in fields:
        data[field] = fields[field]
    cursor.execute(stmt, data)
    if cursor.rowcount < 1 and vck != "override":
        raise ValueError("ConnectionService update received outdated data.")
    cnx.commit()
    fields = db2app_ConnectionService(fields)
    bust_cache(fields)
    dblogmsg("UPD", "ConnectionService", fields)
    return fields


# Write the given dict/object based on the dsType.  Binary field values must
# be base64.b64encode.  Unspecified fields are set to default values for a
# new instance, and left alone on update.  For update, the verification
# check value must match the modified value of the existing instance.
def write_entity(inst, vck="1234-12-12T00:00:00Z"):
    cnx = get_mysql_connector()
    if not cnx:
        raise ValueError("Database connection failed.")
    try:
        cursor = cnx.cursor()
        try:
            entity = inst.get("dsType", None)
            dsId = inst.get("dsId", 0)
            if dsId:
                verify_timestamp_fields(entity, dsId, inst, vck)
                if entity == "MUser":
                    return update_existing_MUser(cnx, cursor, inst, vck)
                if entity == "Theme":
                    return update_existing_Theme(cnx, cursor, inst, vck)
                if entity == "AdminLog":
                    return update_existing_AdminLog(cnx, cursor, inst, vck)
                if entity == "Membic":
                    return update_existing_Membic(cnx, cursor, inst, vck)
                if entity == "Overflow":
                    return update_existing_Overflow(cnx, cursor, inst, vck)
                if entity == "MailNotice":
                    return update_existing_MailNotice(cnx, cursor, inst, vck)
                if entity == "ActivitySummary":
                    return update_existing_ActivitySummary(cnx, cursor, inst, vck)
                if entity == "ConnectionService":
                    return update_existing_ConnectionService(cnx, cursor, inst, vck)
            # No existing instance to update.  Insert new.
            initialize_timestamp_fields(inst, vck)
            if entity == "MUser":
                return insert_new_MUser(cnx, cursor, inst)
            if entity == "Theme":
                return insert_new_Theme(cnx, cursor, inst)
            if entity == "AdminLog":
                return insert_new_AdminLog(cnx, cursor, inst)
            if entity == "Membic":
                return insert_new_Membic(cnx, cursor, inst)
            if entity == "Overflow":
                return insert_new_Overflow(cnx, cursor, inst)
            if entity == "MailNotice":
                return insert_new_MailNotice(cnx, cursor, inst)
            if entity == "ActivitySummary":
                return insert_new_ActivitySummary(cnx, cursor, inst)
            if entity == "ConnectionService":
                return insert_new_ConnectionService(cnx, cursor, inst)
        except mysql.connector.Error as e:
            raise ValueError from e
        finally:
            cursor.close()
    finally:
        cnx.close()


def query_MUser(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, themes, lastwrite, preb"
    query += " FROM MUser " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, themes, lastwrite, preb) in cursor:
        inst = {"dsType": "MUser", "dsId": dsId, "created": created, "modified": modified, "importid": importid, "email": email, "phash": phash, "status": status, "mailbounce": mailbounce, "actsends": actsends, "actcode": actcode, "altinmail": altinmail, "name": name, "aboutme": aboutme, "hashtag": hashtag, "profpic": profpic, "cliset": cliset, "themes": themes, "lastwrite": lastwrite, "preb": preb}
        inst = db2app_MUser(inst)
        res.append(inst)
    dblogmsg("QRY", "MUser", res)
    return res


def query_Theme(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "importid, name, name_c, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, people, cliset, keywords, preb"
    query += " FROM Theme " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, importid, name, name_c, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, people, cliset, keywords, preb) in cursor:
        inst = {"dsType": "Theme", "dsId": dsId, "created": created, "modified": modified, "importid": importid, "name": name, "name_c": name_c, "lastwrite": lastwrite, "hashtag": hashtag, "description": description, "picture": picture, "founders": founders, "moderators": moderators, "members": members, "seeking": seeking, "rejects": rejects, "people": people, "cliset": cliset, "keywords": keywords, "preb": preb}
        inst = db2app_Theme(inst)
        res.append(inst)
    dblogmsg("QRY", "Theme", res)
    return res


def query_AdminLog(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "letype, leid, adminid, adminname, action, targent, targid, targname, reason"
    query += " FROM AdminLog " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, letype, leid, adminid, adminname, action, targent, targid, targname, reason) in cursor:
        inst = {"dsType": "AdminLog", "dsId": dsId, "created": created, "modified": modified, "letype": letype, "leid": leid, "adminid": adminid, "adminname": adminname, "action": action, "targent": targent, "targid": targid, "targname": targname, "reason": reason}
        inst = db2app_AdminLog(inst)
        res.append(inst)
    dblogmsg("QRY", "AdminLog", res)
    return res


def query_Membic(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat"
    query += " FROM Membic " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat) in cursor:
        inst = {"dsType": "Membic", "dsId": dsId, "created": created, "modified": modified, "importid": importid, "url": url, "rurl": rurl, "revtype": revtype, "details": details, "penid": penid, "ctmid": ctmid, "rating": rating, "srcrev": srcrev, "cankey": cankey, "text": text, "keywords": keywords, "svcdata": svcdata, "revpic": revpic, "imguri": imguri, "icdata": icdata, "icwhen": icwhen, "dispafter": dispafter, "penname": penname, "reacdat": reacdat}
        inst = db2app_Membic(inst)
        res.append(inst)
    dblogmsg("QRY", "Membic", res)
    return res


def query_Overflow(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "dbkind, dbkeyid, preb"
    query += " FROM Overflow " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, dbkind, dbkeyid, preb) in cursor:
        inst = {"dsType": "Overflow", "dsId": dsId, "created": created, "modified": modified, "dbkind": dbkind, "dbkeyid": dbkeyid, "preb": preb}
        inst = db2app_Overflow(inst)
        res.append(inst)
    dblogmsg("QRY", "Overflow", res)
    return res


def query_MailNotice(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "name, subject, uidcsv, lastupd"
    query += " FROM MailNotice " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, name, subject, uidcsv, lastupd) in cursor:
        inst = {"dsType": "MailNotice", "dsId": dsId, "created": created, "modified": modified, "name": name, "subject": subject, "uidcsv": uidcsv, "lastupd": lastupd}
        inst = db2app_MailNotice(inst)
        res.append(inst)
    dblogmsg("QRY", "MailNotice", res)
    return res


def query_ActivitySummary(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, newmembics, edited, removed"
    query += " FROM ActivitySummary " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, newmembics, edited, removed) in cursor:
        inst = {"dsType": "ActivitySummary", "dsId": dsId, "created": created, "modified": modified, "refp": refp, "tstart": tstart, "tuntil": tuntil, "reqbyid": reqbyid, "reqbyht": reqbyht, "reqbypm": reqbypm, "reqbyrs": reqbyrs, "reqdets": reqdets, "newmembics": newmembics, "edited": edited, "removed": removed}
        inst = db2app_ActivitySummary(inst)
        res.append(inst)
    dblogmsg("QRY", "ActivitySummary", res)
    return res


def query_ConnectionService(cnx, cursor, where):
    query = "SELECT dsId, created, modified, "
    query += "name, ckey, secret, data"
    query += " FROM ConnectionService " + where
    cursor.execute(query)
    res = []
    for (dsId, created, modified, name, ckey, secret, data) in cursor:
        inst = {"dsType": "ConnectionService", "dsId": dsId, "created": created, "modified": modified, "name": name, "ckey": ckey, "secret": secret, "data": data}
        inst = db2app_ConnectionService(inst)
        res.append(inst)
    dblogmsg("QRY", "ConnectionService", res)
    return res


# Fetch all instances of the specified entity kind for the given WHERE
# clause.  The WHERE clause should include a LIMIT, and should only match on
# indexed fields and/or declared query indexes.  For speed and general
# compatibility, only one inequality operator should be used in the match.
def query_entity(entity, where):
    cnx = get_mysql_connector()
    if not cnx:
        raise ValueError("Database connection failed.")
    try:
        cursor = cnx.cursor()
        try:
            if entity == "MUser":
                return query_MUser(cnx, cursor, where)
            if entity == "Theme":
                return query_Theme(cnx, cursor, where)
            if entity == "AdminLog":
                return query_AdminLog(cnx, cursor, where)
            if entity == "Membic":
                return query_Membic(cnx, cursor, where)
            if entity == "Overflow":
                return query_Overflow(cnx, cursor, where)
            if entity == "MailNotice":
                return query_MailNotice(cnx, cursor, where)
            if entity == "ActivitySummary":
                return query_ActivitySummary(cnx, cursor, where)
            if entity == "ConnectionService":
                return query_ConnectionService(cnx, cursor, where)
        except mysql.connector.Error as e:
            raise ValueError from e
        finally:
            cursor.close()
    finally:
        cnx.close()


def visible_MUser_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        if fld == "email" and audience != "private":
            continue
        if fld == "phash":
            continue
        if fld == "status" and audience != "private":
            continue
        if fld == "mailbounce":
            continue
        if fld == "actsends":
            continue
        if fld == "actcode":
            continue
        if fld == "altinmail" and audience != "private":
            continue
        if fld == "profpic":
            val = obj["dsId"]
        filtobj[fld] = val
    return filtobj


def visible_Theme_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        if fld == "picture":
            val = obj["dsId"]
        filtobj[fld] = val
    return filtobj


def visible_AdminLog_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        filtobj[fld] = val
    return filtobj


def visible_Membic_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        if fld == "revpic":
            val = obj["dsId"]
        if fld == "icdata":
            val = obj["dsId"]
        filtobj[fld] = val
    return filtobj


def visible_Overflow_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        filtobj[fld] = val
    return filtobj


def visible_MailNotice_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        filtobj[fld] = val
    return filtobj


def visible_ActivitySummary_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        filtobj[fld] = val
    return filtobj


def visible_ConnectionService_fields(obj, audience):
    filtobj = {}
    for fld, val in obj.items():
        filtobj[fld] = val
    return filtobj


# Return a copied object with only the fields appropriate to the audience.
# Specifying audience="private" includes peronal info.  The given obj is
# assumed to already have been through db2app conversion.  Image fields are
# converted to dsId values for separate download.
def visible_fields(obj, audience="public"):
    if obj["dsType"] == "MUser":
        return visible_MUser_fields(obj, audience)
    if obj["dsType"] == "Theme":
        return visible_Theme_fields(obj, audience)
    if obj["dsType"] == "AdminLog":
        return visible_AdminLog_fields(obj, audience)
    if obj["dsType"] == "Membic":
        return visible_Membic_fields(obj, audience)
    if obj["dsType"] == "Overflow":
        return visible_Overflow_fields(obj, audience)
    if obj["dsType"] == "MailNotice":
        return visible_MailNotice_fields(obj, audience)
    if obj["dsType"] == "ActivitySummary":
        return visible_ActivitySummary_fields(obj, audience)
    if obj["dsType"] == "ConnectionService":
        return visible_ConnectionService_fields(obj, audience)
    raise ValueError("Unknown object dsType: " + obj["dsType"])


