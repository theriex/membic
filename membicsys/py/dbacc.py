import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re

entdefs = {
    "MUser": {  # Membic User account.
        "importid": {"pt": "dbid"},
        "email": {"pt": "email"},
        "phash": {"pt": "string"},
        "status": {"pt": "string"},
        "mailbounce": {"pt": "string"},
        "actsends": {"pt": "string"},
        "actcode": {"pt": "string"},
        "altinmail": {"pt": "email"},
        "name": {"pt": "string"},
        "aboutme": {"pt": "string"},
        "hashtag": {"pt": "string"},
        "profpic": {"pt": "image"},
        "cliset": {"pt": "string"},
        "coops": {"pt": "string"},
        "created": {"pt": "string"},
        "modified": {"pt": "string"},
        "lastwrite": {"pt": "string"},
        "preb": {"pt": "string"}
    },
    "Theme": {  # A cooperative theme.
        "importid": {"pt": "dbid"},
        "name": {"pt": "string"},
        "name_c": {"pt": "string"},
        "modhist": {"pt": "string"},
        "modified": {"pt": "string"},
        "lastwrite": {"pt": "string"},
        "hashtag": {"pt": "string"},
        "description": {"pt": "string"},
        "picture": {"pt": "image"},
        "founders": {"pt": "string"},
        "moderators": {"pt": "string"},
        "members": {"pt": "string"},
        "seeking": {"pt": "string"},
        "rejects": {"pt": "string"},
        "adminlog": {"pt": "string"},
        "people": {"pt": "string"},
        "cliset": {"pt": "string"},
        "keywords": {"pt": "string"},
        "preb": {"pt": "string"}
    },
    "Membic": {  # A URL with a reason why it's memorable.
        "importid": {"pt": "dbid"},
        "revtype": {"pt": "string"},
        "penid": {"pt": "dbid"},
        "ctmid": {"pt": "dbid"},
        "rating": {"pt": "int"},
        "srcrev": {"pt": "dbid"},
        "cankey": {"pt": "string"},
        "modified": {"pt": "string"},
        "modhist": {"pt": "string"},
        "text": {"pt": "string"},
        "keywords": {"pt": "string"},
        "svcdata": {"pt": "string"},
        "revpic": {"pt": "image"},
        "imguri": {"pt": "string"},
        "icdata": {"pt": "image"},
        "icwhen": {"pt": "string"},
        "dispafter": {"pt": "string"},
        "penname": {"pt": "string"},
        "reacdat": {"pt": "string"},
        "name": {"pt": "string"},
        "title": {"pt": "string"},
        "url": {"pt": "string"},
        "rurl": {"pt": "string"},
        "artist": {"pt": "string"},
        "author": {"pt": "string"},
        "publisher": {"pt": "string"},
        "album": {"pt": "string"},
        "starring": {"pt": "string"},
        "address": {"pt": "string"},
        "year": {"pt": "string"}
    },
    "Overflow": {  # extra preb membics
        "dbkind": {"pt": "string"},
        "dbkeyid": {"pt": "dbid"},
        "overcount": {"pt": "int"},
        "preb": {"pt": "string"}
    },
    "MailNotice": {  # Broadcast email tracking
        "name": {"pt": "string"},
        "subject": {"pt": "string"},
        "uidcsv": {"pt": "string"},
        "lastupd": {"pt": "string"}
    },
    "ActivitySummary": {  # Stats by profile/theme
        "refp": {"pt": "string"},
        "tstart": {"pt": "string"},
        "tuntil": {"pt": "string"},
        "reqbyid": {"pt": "int"},
        "reqbyht": {"pt": "int"},
        "reqbypm": {"pt": "int"},
        "reqbyrs": {"pt": "int"},
        "reqdets": {"pt": "string"},
        "created": {"pt": "int"},
        "edited": {"pt": "int"},
        "removed": {"pt": "int"}
    },
    "ConnectionService": {  # Supporting service auth
        "name": {"pt": "string"},
        "ckey": {"pt": "string"},
        "secret": {"pt": "string"},
        "data": {"pt": "string"}
    }
}


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

