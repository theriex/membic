import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import re

entdefs = {
    "MUser": {  # Membic User account.
        "importid": {"pt": "dbid", "dv": 0},
        "email": {"pt": "email", "dv": ""},
        "phash": {"pt": "string", "dv": ""},
        "status": {"pt": "string", "dv": ""},
        "mailbounce": {"pt": "string", "dv": ""},
        "actsends": {"pt": "string", "dv": ""},
        "actcode": {"pt": "string", "dv": ""},
        "altinmail": {"pt": "email", "dv": ""},
        "name": {"pt": "string", "dv": ""},
        "aboutme": {"pt": "string", "dv": ""},
        "hashtag": {"pt": "string", "dv": ""},
        "profpic": {"pt": "image", "dv": None},
        "cliset": {"pt": "string", "dv": ""},
        "coops": {"pt": "string", "dv": ""},
        "created": {"pt": "string", "dv": ""},
        "modified": {"pt": "string", "dv": ""},
        "lastwrite": {"pt": "string", "dv": ""},
        "preb": {"pt": "string", "dv": ""}
    },
    "Theme": {  # A cooperative theme.
        "importid": {"pt": "dbid", "dv": 0},
        "name": {"pt": "string", "dv": ""},
        "name_c": {"pt": "string", "dv": ""},
        "modhist": {"pt": "string", "dv": ""},
        "modified": {"pt": "string", "dv": ""},
        "lastwrite": {"pt": "string", "dv": ""},
        "hashtag": {"pt": "string", "dv": ""},
        "description": {"pt": "string", "dv": ""},
        "picture": {"pt": "image", "dv": None},
        "founders": {"pt": "string", "dv": ""},
        "moderators": {"pt": "string", "dv": ""},
        "members": {"pt": "string", "dv": ""},
        "seeking": {"pt": "string", "dv": ""},
        "rejects": {"pt": "string", "dv": ""},
        "adminlog": {"pt": "string", "dv": ""},
        "people": {"pt": "string", "dv": ""},
        "cliset": {"pt": "string", "dv": ""},
        "keywords": {"pt": "string", "dv": ""},
        "preb": {"pt": "string", "dv": ""}
    },
    "Membic": {  # A URL with a reason why it's memorable.
        "importid": {"pt": "dbid", "dv": 0},
        "url": {"pt": "string", "dv": ""},
        "rurl": {"pt": "string", "dv": ""},
        "revtype": {"pt": "string", "dv": ""},
        "details": {"pt": "string", "dv": ""},
        "penid": {"pt": "dbid", "dv": 0},
        "ctmid": {"pt": "dbid", "dv": 0},
        "rating": {"pt": "int", "dv": 0},
        "srcrev": {"pt": "dbid", "dv": 0},
        "cankey": {"pt": "string", "dv": ""},
        "modified": {"pt": "string", "dv": ""},
        "modhist": {"pt": "string", "dv": ""},
        "text": {"pt": "string", "dv": ""},
        "keywords": {"pt": "string", "dv": ""},
        "svcdata": {"pt": "string", "dv": ""},
        "revpic": {"pt": "image", "dv": None},
        "imguri": {"pt": "string", "dv": ""},
        "icdata": {"pt": "image", "dv": None},
        "icwhen": {"pt": "string", "dv": ""},
        "dispafter": {"pt": "string", "dv": ""},
        "penname": {"pt": "string", "dv": ""},
        "reacdat": {"pt": "string", "dv": ""}
    },
    "Overflow": {  # extra preb membics
        "dbkind": {"pt": "string", "dv": ""},
        "dbkeyid": {"pt": "dbid", "dv": 0},
        "overcount": {"pt": "int", "dv": 0},
        "preb": {"pt": "string", "dv": ""}
    },
    "MailNotice": {  # Broadcast email tracking
        "name": {"pt": "string", "dv": ""},
        "subject": {"pt": "string", "dv": ""},
        "uidcsv": {"pt": "string", "dv": ""},
        "lastupd": {"pt": "string", "dv": ""}
    },
    "ActivitySummary": {  # Stats by profile/theme
        "refp": {"pt": "string", "dv": ""},
        "tstart": {"pt": "string", "dv": ""},
        "tuntil": {"pt": "string", "dv": ""},
        "reqbyid": {"pt": "int", "dv": 0},
        "reqbyht": {"pt": "int", "dv": 0},
        "reqbypm": {"pt": "int", "dv": 0},
        "reqbyrs": {"pt": "int", "dv": 0},
        "reqdets": {"pt": "string", "dv": ""},
        "created": {"pt": "int", "dv": 0},
        "edited": {"pt": "int", "dv": 0},
        "removed": {"pt": "int", "dv": 0}
    },
    "ConnectionService": {  # Supporting service auth
        "name": {"pt": "string", "dv": ""},
        "ckey": {"pt": "string", "dv": ""},
        "secret": {"pt": "string", "dv": ""},
        "data": {"pt": "string", "dv": ""}
    }
}


entkeys = {
    "MUser": [importid, email, altinmail, hashtag],
    "Theme": [importid, name_c, hashtag],
    "Membic": [importid],
    "Overflow": [],
    "MailNotice": [name],
    "ActivitySummary": [refp],
    "ConnectionService": [name]
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


# "cached fetch by key". Field must be primary key id or field declared to
# be unique.  entity name + the primary key id value = pcachekey
# memcache.set(cachekey, pickle.dumps(instance)
# for each of the entkey fields
#    memcache.set(entityname + obj.fieldval, cachekey)
# On cache_get, if the result is not a pickle serialized object then it is
# treated as a lookup key for secondary lookup to get to the cached obj.
def cfbk (entity, field, value):
    if field != 'dsId' and field not in entkeys[entity]:
        raise ValueError(field + " not a unique index for " + entity)
    # lookup in cache and return if found.  See notes on cache structure.
    # obj = SELECT ...
    # put_cache(obj)


# preferably specify the primary key id as the field.
def bust_cache(entity, idvalue):
    # lookup the cached instance, following to get to the primary key
    # instance as needed.  If found, pickle.loads the instance, go through
    # the entkeys fields and set all cache refs to ""


# Get a connection to the database.  May throw mysql.connector.Error
# https://dev.mysql.com/doc/connector-python/en/connector-python-connectargs.html
def get_mysql_connector():
    cnx = None
    cnx = mysql.connector.connect(user="root", # password="",
                                  host="127.0.0.1",
                                  database="membic_database")
    return cnx



# Write a new MUser row, using the given field values or defaults.
def insert_new_MUser(cnx, cursor, fields):
    stmt = (
        "INSERT INTO MUser (importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, coops, created, modified, lastwrite, preb) "
        "VALUES (%(importid)s, %(email)s, %(phash)s, %(status)s, %(mailbounce)s, %(actsends)s, %(actcode)s, %(altinmail)s, %(name)s, %(aboutme)s, %(hashtag)s, %(profpic)s, %(cliset)s, %(coops)s, %(created)s, %(modified)s, %(lastwrite)s, %(preb)s)")
    data = {
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
        'coops': fields.get("coops", entdefs["MUser"]["coops"]["dv"]),
        'created': fields.get("created", entdefs["MUser"]["created"]["dv"]),
        'modified': fields.get("modified", entdefs["MUser"]["modified"]["dv"]),
        'lastwrite': fields.get("lastwrite", entdefs["MUser"]["lastwrite"]["dv"]),
        'preb': fields.get("preb", entdefs["MUser"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified MUser row with the given field values.
def update_new_MUser(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE MUser SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new Theme row, using the given field values or defaults.
def insert_new_Theme(cnx, cursor, fields):
    stmt = (
        "INSERT INTO Theme (importid, name, name_c, modhist, modified, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, adminlog, people, cliset, keywords, preb) "
        "VALUES (%(importid)s, %(name)s, %(name_c)s, %(modhist)s, %(modified)s, %(lastwrite)s, %(hashtag)s, %(description)s, %(picture)s, %(founders)s, %(moderators)s, %(members)s, %(seeking)s, %(rejects)s, %(adminlog)s, %(people)s, %(cliset)s, %(keywords)s, %(preb)s)")
    data = {
        'importid': fields.get("importid", entdefs["Theme"]["importid"]["dv"]),
        'name': fields.get("name", entdefs["Theme"]["name"]["dv"]),
        'name_c': fields.get("name_c", entdefs["Theme"]["name_c"]["dv"]),
        'modhist': fields.get("modhist", entdefs["Theme"]["modhist"]["dv"]),
        'modified': fields.get("modified", entdefs["Theme"]["modified"]["dv"]),
        'lastwrite': fields.get("lastwrite", entdefs["Theme"]["lastwrite"]["dv"]),
        'hashtag': fields.get("hashtag", entdefs["Theme"]["hashtag"]["dv"]),
        'description': fields.get("description", entdefs["Theme"]["description"]["dv"]),
        'picture': fields.get("picture", entdefs["Theme"]["picture"]["dv"]),
        'founders': fields.get("founders", entdefs["Theme"]["founders"]["dv"]),
        'moderators': fields.get("moderators", entdefs["Theme"]["moderators"]["dv"]),
        'members': fields.get("members", entdefs["Theme"]["members"]["dv"]),
        'seeking': fields.get("seeking", entdefs["Theme"]["seeking"]["dv"]),
        'rejects': fields.get("rejects", entdefs["Theme"]["rejects"]["dv"]),
        'adminlog': fields.get("adminlog", entdefs["Theme"]["adminlog"]["dv"]),
        'people': fields.get("people", entdefs["Theme"]["people"]["dv"]),
        'cliset': fields.get("cliset", entdefs["Theme"]["cliset"]["dv"]),
        'keywords': fields.get("keywords", entdefs["Theme"]["keywords"]["dv"]),
        'preb': fields.get("preb", entdefs["Theme"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified Theme row with the given field values.
def update_new_Theme(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE Theme SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new Membic row, using the given field values or defaults.
def insert_new_Membic(cnx, cursor, fields):
    stmt = (
        "INSERT INTO Membic (importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, modified, modhist, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat) "
        "VALUES (%(importid)s, %(url)s, %(rurl)s, %(revtype)s, %(details)s, %(penid)s, %(ctmid)s, %(rating)s, %(srcrev)s, %(cankey)s, %(modified)s, %(modhist)s, %(text)s, %(keywords)s, %(svcdata)s, %(revpic)s, %(imguri)s, %(icdata)s, %(icwhen)s, %(dispafter)s, %(penname)s, %(reacdat)s)")
    data = {
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
        'modified': fields.get("modified", entdefs["Membic"]["modified"]["dv"]),
        'modhist': fields.get("modhist", entdefs["Membic"]["modhist"]["dv"]),
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
    cnx.commit()


# Update the specified Membic row with the given field values.
def update_new_Membic(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE Membic SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new Overflow row, using the given field values or defaults.
def insert_new_Overflow(cnx, cursor, fields):
    stmt = (
        "INSERT INTO Overflow (dbkind, dbkeyid, overcount, preb) "
        "VALUES (%(dbkind)s, %(dbkeyid)s, %(overcount)s, %(preb)s)")
    data = {
        'dbkind': fields.get("dbkind", entdefs["Overflow"]["dbkind"]["dv"]),
        'dbkeyid': fields.get("dbkeyid", entdefs["Overflow"]["dbkeyid"]["dv"]),
        'overcount': fields.get("overcount", entdefs["Overflow"]["overcount"]["dv"]),
        'preb': fields.get("preb", entdefs["Overflow"]["preb"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified Overflow row with the given field values.
def update_new_Overflow(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE Overflow SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new MailNotice row, using the given field values or defaults.
def insert_new_MailNotice(cnx, cursor, fields):
    stmt = (
        "INSERT INTO MailNotice (name, subject, uidcsv, lastupd) "
        "VALUES (%(name)s, %(subject)s, %(uidcsv)s, %(lastupd)s)")
    data = {
        'name': fields.get("name", entdefs["MailNotice"]["name"]["dv"]),
        'subject': fields.get("subject", entdefs["MailNotice"]["subject"]["dv"]),
        'uidcsv': fields.get("uidcsv", entdefs["MailNotice"]["uidcsv"]["dv"]),
        'lastupd': fields.get("lastupd", entdefs["MailNotice"]["lastupd"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified MailNotice row with the given field values.
def update_new_MailNotice(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE MailNotice SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new ActivitySummary row, using the given field values or defaults.
def insert_new_ActivitySummary(cnx, cursor, fields):
    stmt = (
        "INSERT INTO ActivitySummary (refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, created, edited, removed) "
        "VALUES (%(refp)s, %(tstart)s, %(tuntil)s, %(reqbyid)s, %(reqbyht)s, %(reqbypm)s, %(reqbyrs)s, %(reqdets)s, %(created)s, %(edited)s, %(removed)s)")
    data = {
        'refp': fields.get("refp", entdefs["ActivitySummary"]["refp"]["dv"]),
        'tstart': fields.get("tstart", entdefs["ActivitySummary"]["tstart"]["dv"]),
        'tuntil': fields.get("tuntil", entdefs["ActivitySummary"]["tuntil"]["dv"]),
        'reqbyid': fields.get("reqbyid", entdefs["ActivitySummary"]["reqbyid"]["dv"]),
        'reqbyht': fields.get("reqbyht", entdefs["ActivitySummary"]["reqbyht"]["dv"]),
        'reqbypm': fields.get("reqbypm", entdefs["ActivitySummary"]["reqbypm"]["dv"]),
        'reqbyrs': fields.get("reqbyrs", entdefs["ActivitySummary"]["reqbyrs"]["dv"]),
        'reqdets': fields.get("reqdets", entdefs["ActivitySummary"]["reqdets"]["dv"]),
        'created': fields.get("created", entdefs["ActivitySummary"]["created"]["dv"]),
        'edited': fields.get("edited", entdefs["ActivitySummary"]["edited"]["dv"]),
        'removed': fields.get("removed", entdefs["ActivitySummary"]["removed"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified ActivitySummary row with the given field values.
def update_new_ActivitySummary(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE ActivitySummary SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write a new ConnectionService row, using the given field values or defaults.
def insert_new_ConnectionService(cnx, cursor, fields):
    stmt = (
        "INSERT INTO ConnectionService (name, ckey, secret, data) "
        "VALUES (%(name)s, %(ckey)s, %(secret)s, %(data)s)")
    data = {
        'name': fields.get("name", entdefs["ConnectionService"]["name"]["dv"]),
        'ckey': fields.get("ckey", entdefs["ConnectionService"]["ckey"]["dv"]),
        'secret': fields.get("secret", entdefs["ConnectionService"]["secret"]["dv"]),
        'data': fields.get("data", entdefs["ConnectionService"]["data"]["dv"])}
    cursor.execute(stmt, data)
    cnx.commit()


# Update the specified ConnectionService row with the given field values.
def update_new_ConnectionService(cnx, cursor, fields):
    dsId = int(fields["dsId"])  # Verify int value
    stmt = ""
    for field in fields:
        if field != "dsId":
            if stmt:
                stmt += ", "
            stmt += field + "=(%(" + field + ")s"
    stmt = "UPDATE ConnectionService SET " + stmt + " WHERE dsId=" + dsId
    data = {}
    for field in fields:
        if field != "dsId":
            data[field] = fields[field]
    cursor.execute(stmt, data)
    cnx.commit()


# Write the specified entity kind from the dictionary of field values.  For
# any entity field not in the given dict, the existing entity field value
# will not be updated, and a default value will be used for create.
def write_entity(entity, fields):
    cnx = get_mysql_connector()
    if not cnx:
        raise ValueError("Database connection failed.")
    try:
        cursor = cnx.cursor()
        try:
            dsId = fields.get("dsId", 0)
            if dsId:
                if entity == "MUser":
                    return update_existing_MUser(cnx, cursor, dsId, fields)
                if entity == "Theme":
                    return update_existing_Theme(cnx, cursor, dsId, fields)
                if entity == "Membic":
                    return update_existing_Membic(cnx, cursor, dsId, fields)
                if entity == "Overflow":
                    return update_existing_Overflow(cnx, cursor, dsId, fields)
                if entity == "MailNotice":
                    return update_existing_MailNotice(cnx, cursor, dsId, fields)
                if entity == "ActivitySummary":
                    return update_existing_ActivitySummary(cnx, cursor, dsId, fields)
                if entity == "ConnectionService":
                    return update_existing_ConnectionService(cnx, cursor, dsId, fields)
            # No existing instance to update.  Insert new.
            if entity == "MUser":
                return return insert_new_MUser(cnx, cursor, fields)
            if entity == "Theme":
                return return insert_new_Theme(cnx, cursor, fields)
            if entity == "Membic":
                return return insert_new_Membic(cnx, cursor, fields)
            if entity == "Overflow":
                return return insert_new_Overflow(cnx, cursor, fields)
            if entity == "MailNotice":
                return return insert_new_MailNotice(cnx, cursor, fields)
            if entity == "ActivitySummary":
                return return insert_new_ActivitySummary(cnx, cursor, fields)
            if entity == "ConnectionService":
                return return insert_new_ConnectionService(cnx, cursor, fields)
        except mysql.connector.Error as e:
            raise ValueException("write_entity failed: " + str(e))
        finally:
            cursor.close()
    finally:
        cnx.close()


def query_MUser(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, coops, created, modified, lastwrite, preb"
    query += " FROM MUser " + where
    cursor.execute(query)
    for (dsId, importid, email, phash, status, mailbounce, actsends, actcode, altinmail, name, aboutme, hashtag, profpic, cliset, coops, created, modified, lastwrite, preb) in cursor:
        res.append({"importid": importid, "email": email, "phash": phash, "status": status, "mailbounce": mailbounce, "actsends": actsends, "actcode": actcode, "altinmail": altinmail, "name": name, "aboutme": aboutme, "hashtag": hashtag, "profpic": profpic, "cliset": cliset, "coops": coops, "created": created, "modified": modified, "lastwrite": lastwrite, "preb": preb})
    return res


def query_Theme(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "importid, name, name_c, modhist, modified, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, adminlog, people, cliset, keywords, preb"
    query += " FROM Theme " + where
    cursor.execute(query)
    for (dsId, importid, name, name_c, modhist, modified, lastwrite, hashtag, description, picture, founders, moderators, members, seeking, rejects, adminlog, people, cliset, keywords, preb) in cursor:
        res.append({"importid": importid, "name": name, "name_c": name_c, "modhist": modhist, "modified": modified, "lastwrite": lastwrite, "hashtag": hashtag, "description": description, "picture": picture, "founders": founders, "moderators": moderators, "members": members, "seeking": seeking, "rejects": rejects, "adminlog": adminlog, "people": people, "cliset": cliset, "keywords": keywords, "preb": preb})
    return res


def query_Membic(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, modified, modhist, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat"
    query += " FROM Membic " + where
    cursor.execute(query)
    for (dsId, importid, url, rurl, revtype, details, penid, ctmid, rating, srcrev, cankey, modified, modhist, text, keywords, svcdata, revpic, imguri, icdata, icwhen, dispafter, penname, reacdat) in cursor:
        res.append({"importid": importid, "url": url, "rurl": rurl, "revtype": revtype, "details": details, "penid": penid, "ctmid": ctmid, "rating": rating, "srcrev": srcrev, "cankey": cankey, "modified": modified, "modhist": modhist, "text": text, "keywords": keywords, "svcdata": svcdata, "revpic": revpic, "imguri": imguri, "icdata": icdata, "icwhen": icwhen, "dispafter": dispafter, "penname": penname, "reacdat": reacdat})
    return res


def query_Overflow(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "dbkind, dbkeyid, overcount, preb"
    query += " FROM Overflow " + where
    cursor.execute(query)
    for (dsId, dbkind, dbkeyid, overcount, preb) in cursor:
        res.append({"dbkind": dbkind, "dbkeyid": dbkeyid, "overcount": overcount, "preb": preb})
    return res


def query_MailNotice(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "name, subject, uidcsv, lastupd"
    query += " FROM MailNotice " + where
    cursor.execute(query)
    for (dsId, name, subject, uidcsv, lastupd) in cursor:
        res.append({"name": name, "subject": subject, "uidcsv": uidcsv, "lastupd": lastupd})
    return res


def query_ActivitySummary(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, created, edited, removed"
    query += " FROM ActivitySummary " + where
    cursor.execute(query)
    for (dsId, refp, tstart, tuntil, reqbyid, reqbyht, reqbypm, reqbyrs, reqdets, created, edited, removed) in cursor:
        res.append({"refp": refp, "tstart": tstart, "tuntil": tuntil, "reqbyid": reqbyid, "reqbyht": reqbyht, "reqbypm": reqbypm, "reqbyrs": reqbyrs, "reqdets": reqdets, "created": created, "edited": edited, "removed": removed})
    return res


def query_ConnectionService(cnx, cursor, where):
    query = "SELECT dsId, "
    query += "name, ckey, secret, data"
    query += " FROM ConnectionService " + where
    cursor.execute(query)
    for (dsId, name, ckey, secret, data) in cursor:
        res.append({"name": name, "ckey": ckey, "secret": secret, "data": data})
    return res


# Fetch instances of the specified entity kind for the given WHERE clause
# which will typically include ORDER BY and LIMIT clauses.
def query_entity(entity, where):
    res = []
    cnx = get_mysql_connector()
    if not cnx:
        raise ValueError("Database connection failed.")
    try:
        cursor = cnx.cursor()
        try:
            query = "SELECT dsId, "
            if entity == "MUser":
                return query_MUser(cnx, cursor, where)
            if entity == "Theme":
                return query_Theme(cnx, cursor, where)
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
            raise ValueException("query_entity failed: " + str(e))
        finally:
            cursor.close()
    finally:
        cnx.close()



