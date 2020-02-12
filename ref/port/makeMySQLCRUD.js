/*jslint node, white, fudge, long */

var ddefs = require("./datadefs");
var srcdir = "../../membicsys/py";
var fs = require("fs");

////////////////////////////////////////
// SQL code

function sqlType (fd) {
    if(ddefs.fieldIs(fd, "string")) {
        //string (email, isodate, isomod)
        //MySQL has some native support for email addresses and dates, but
        //any required value checking is done in the service API, not the db.
        return "VARCHAR(256)"; }
    if(ddefs.fieldIs(fd, "text")) {
        //text (json, idcsv, isodcsv, gencsv, url)
        //The maximum size of a LONGTEXT is 2^32 = 4,294,967,296 bytes.
        //MySQL has native support for JSON, but rather have that be opaque
        //and not take a hit from the computational overhead.
        return "LONGTEXT"; }
    if(ddefs.fieldIs(fd, "image")) {
        //The maximum size of a LONGBLOB is 2^32 = 4,294,967,296 bytes.
        return "LONGBLOB"; }
    if(ddefs.fieldIs(fd, "dbid")) {
        return "BIGINT"; }
    if(ddefs.fieldIs(fd, "int")) {
        return "INT"; }
}


function reqFlag (fd) {
    if(ddefs.fieldIs(fd, "required")) {
        return " NOT NULL"; }
    return "";
}


function uniqueFlag (fd) {
    if(ddefs.fieldIs(fd, "unique")) {
        return " UNIQUE"; }
    return "";
}


function indexClauses (edef) {
    var idxs = "";
    edef.queries = edef.queries || [];
    edef.queries.forEach(function (query) {
        var idxc = "";
        query.q.forEach(function (idxelem) {
            if(idxc) {
                idxc += ", "; }
            idxc += idxelem.f;
            if(idxelem.dir === "desc") {
                idxc += " DESC"; } });
        idxs += "  INDEX (" + idxc + "),\n"; });
    return idxs;
}


function createDatabaseSQL() {
    var sql = "";
    ddefs.dataDefinitions().forEach(function (edef) {
        sql += "CREATE TABLE " + edef.entity + " (  -- " + edef.descr + "\n";
        sql += "  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,\n";
        edef.fields.forEach(function (ed) {
            sql += "  " + ed.f + " " + sqlType(ed.d) + reqFlag(ed.d) +
                uniqueFlag(ed.d) + ",\n"; });
        sql += indexClauses(edef);
        sql += "  PRIMARY KEY (dsId)\n";
        sql += ");\n\n"; });
    fs.writeFileSync("createMySQLTables.sql", sql, "utf8");
}

////////////////////////////////////////
// Python code

function pyTypeForField (fd) {
    if(ddefs.fieldIs(fd.d, "email")) {
        return "email"; }
    if(ddefs.fieldIs(fd.d, "string") || ddefs.fieldIs(fd.d, "text")) {
        return "string"; }
    if(ddefs.fieldIs(fd.d, "image")) {
        return "image"; }
    if(ddefs.fieldIs(fd.d, "int")) {
        return "int"; }
    if(ddefs.fieldIs(fd.d, "dbid")) {
        return "dbid"; }
    return "UnkownPyType!";
}


function defValForPyType (pt) {
    switch(pt) {
    case "email": return "\"\"";
    case "string": return "\"\"";
    case "image": return "None";
    case "int": return "0";
    case "dbid": return "0";
    default: return "\"\""; }
}


function entityDefinitions () {
    var pyc = "";
    pyc += "entdefs = {\n";
    var definitions = ddefs.dataDefinitions();
    definitions.forEach(function (edef, eidx) {
        var ecomma = "";
        if(eidx < definitions.length - 1) {
            ecomma = ","; }
        pyc += "    \"" + edef.entity + "\": {  # " + edef.descr + "\n";
        edef.fields.forEach(function (fd, fidx) {
            var fcomma = "";
            if(fidx < edef.fields.length - 1) {
                fcomma = ","; }
            var pytype = pyTypeForField(fd);
            pyc += "        \"" + fd.f + "\": {" +
                "\"pt\": \"" + pytype + "\", " +
                "\"dv\": " + defValForPyType(pytype) + "}" +
                fcomma + "\n"; });
        pyc += "    }" + ecomma + "\n"; });
    pyc += "}\n";
    return pyc;
}


function entityKeyFields () {
    var pyc = "";
    pyc += "entkeys = {\n";
    var definitions = ddefs.dataDefinitions();
    definitions.forEach(function (edef, eidx) {
        var ecomma = "";
        if(eidx < definitions.length - 1) {
            ecomma = ","; }
        pyc += "    \"" + edef.entity + "\": ["
        var keyflds = "";
        edef.fields.forEach(function (fd) {
            if(ddefs.fieldIs(fd.d, "unique")) {
                if(keyflds) {
                    keyflds += ", "; }
                keyflds += fd.f; } });
        pyc += keyflds + "]" + ecomma + "\n"; });
    pyc += "}\n";
    return pyc;
}


function helperFunctions () {
    var pyc = "";
    pyc += "def reqarg(argname, fieldtype=\"string\", required=False):\n";
    pyc += "    argval = flask.request.args.get(argname)  # None if not found\n";
    pyc += "    if not argval:\n";
    pyc += "        argval = flask.request.form.get(argname)  # Ditto\n"
    pyc += "    if required and not argval:\n";
    pyc += "        raise ValueError(\"Missing required value for \" + argname)\n";
    pyc += "    dotidx = fieldtype.find('.')\n";
    pyc += "    if dotidx > 0:\n";
    pyc += "        entity = fieldtype[0:dotidx]\n";
    pyc += "        fieldname = fieldtype[dotidx + 1:]\n";
    pyc += "        fieldtype = entdefs[entity][fieldname][\"pt\"]\n";
    pyc += "    if fieldtype == \"email\":\n";
    pyc += "        emaddr = argval or \"\"\n";
    pyc += "        emaddr = emaddr.lower()\n";
    pyc += "        emaddr = re.sub('%40', '@', emaddr)\n";
    pyc += "        if required and not re.match(r\"[^@]+@[^@]+\\.[^@]+\", emaddr):\n";
    pyc += "            raise ValueError(\"Invalid \" + argname + \" value: \" + emaddr)\n";
    pyc += "        return emaddr\n";
    pyc += "    if fieldtype in [\"string\", \"isodate\", \"isomod\", \n";
    pyc += "                     \"text\", \"json\", \"idcsv\", \"isodcsv\", \"gencsv\", \"url\"]:\n";
    pyc += "        return argval or \"\"\n";
    pyc += "    if fieldtype == \"image\":\n";
    pyc += "        return argval or None\n";
    pyc += "    if fieldtype in [\"dbid\", \"int\"]:\n";
    pyc += "        argval = argval or 0\n";
    pyc += "        return int(argval)\n";
    pyc += "    raise ValueError(\"Unknown type \" + fieldtype + \" for \" + argname)\n";
    pyc += "\n"
    pyc += "\n"
    pyc += "# \"cached fetch by key\". Field must be primary key id or field declared to\n";
    pyc += "# be unique.  entity name + the primary key id value = pcachekey\n";
    pyc += "# memcache.set(cachekey, pickle.dumps(instance)\n";
    pyc += "# for each of the entkey fields\n";
    pyc += "#    memcache.set(entityname + obj.fieldval, cachekey)\n";
    pyc += "# On cache_get, if the result is not a pickle serialized object then it is\n";
    pyc += "# treated as a lookup key for secondary lookup to get to the cached obj.\n";
    pyc += "def cfbk (entity, field, value):\n";
    pyc += "    if field != 'dsId' and field not in entkeys[entity]:\n";
    pyc += "        raise ValueError(field + \" not a unique index for \" + entity)\n";
    pyc += "    # lookup in cache and return if found.  See notes on cache structure.\n";
    pyc += "    # obj = SELECT ...\n";
    pyc += "    # put_cache(obj)\n";
    pyc += "\n";
    pyc += "\n";
    pyc += "# preferably specify the primary key id as the field.\n";
    pyc += "def bust_cache(entity, idvalue):\n";
    pyc += "    # lookup the cached instance, following to get to the primary key\n";
    pyc += "    # instance as needed.  If found, pickle.loads the instance, go through\n";
    pyc += "    # the entkeys fields and set all cache refs to \"\"\n"
    pyc += "\n";
    pyc += "\n";
    pyc += "# Get a connection to the database.  May throw mysql.connector.Error\n";
    pyc += "# https://dev.mysql.com/doc/connector-python/en/connector-python-connectargs.html\n"
    pyc += "def get_mysql_connector():\n";
    pyc += "    cnx = None\n";
    pyc += "    cnx = mysql.connector.connect(user=\"root\", # password=\"\",\n";
    pyc += "                                  host=\"127.0.0.1\",\n";
    pyc += "                                  database=\"membic_database\")\n";
    pyc += "    return cnx\n";
    pyc += "\n";
    return pyc;
}


function writeInsertFunction (edef) {
    var pyc = "";
    pyc += "# Write a new " + edef.entity + " row, using the given field values or defaults.\n";
    pyc += "def insert_new_" + edef.entity + "(cnx, cursor, fields):\n";
    pyc += "    stmt = (\n";
    pyc += "        \"INSERT INTO " + edef.entity + " (";
    edef.fields.forEach(function (fd, idx) {
        if(idx) {
            pyc += ", "; }
        pyc += fd.f; });
    pyc += ") \"\n";
    pyc += "        \"VALUES (";
    edef.fields.forEach(function (fd, idx) {
        if(idx) {
            pyc += ", "; }
        pyc += "%(" + fd.f + ")s"; });
    pyc += ")\")\n";
    pyc += "    data = {\n";
    edef.fields.forEach(function (fd, idx) {
        if(idx) {
            pyc += ",\n"; }
        pyc += "        '" + fd.f + "': fields.get(\"" + fd.f + "\", " +
            "entdefs[\"" + edef.entity + "\"][\"" + fd.f + "\"][\"dv\"])"; });
    pyc += "}\n";
    pyc += "    cursor.execute(stmt, data)\n";
    pyc += "    cnx.commit()\n";
    return pyc;
}


function writeUpdateFunction (edef) {
    var pyc = "";
    pyc += "# Update the specified " + edef.entity + " row with the given field values.\n";
    pyc += "def update_new_" + edef.entity + "(cnx, cursor, fields):\n";
    pyc += "    dsId = int(fields[\"dsId\"])  # Verify int value\n";
    pyc += "    stmt = \"\"\n";
    pyc += "    for field in fields:\n";
    pyc += "        if field != \"dsId\":\n";
    pyc += "            if stmt:\n";
    pyc += "                stmt += \", \"\n";
    pyc += "            stmt += field + \"=(%(\" + field + \")s\"\n";
    pyc += "    stmt = \"UPDATE " + edef.entity + " SET \" + stmt + \" WHERE dsId=\" + dsId\n";
    pyc += "    data = {}\n";
    pyc += "    for field in fields:\n";
    pyc += "        if field != \"dsId\":\n";
    pyc += "            data[field] = fields[field]\n";
    pyc += "    cursor.execute(stmt, data)\n";
    pyc += "    cnx.commit()\n";
    return pyc;
}


function entityWriteFunction () {
    var pyc = "";
    var definitions = ddefs.dataDefinitions();
    definitions.forEach(function (edef) {
        pyc += writeInsertFunction(edef) + "\n\n" +
            writeUpdateFunction(edef) + "\n\n"; });
    pyc += "# Write the specified entity kind from the dictionary of field values.  For\n"
    pyc += "# any entity field not in the given dict, the existing entity field value\n"
    pyc += "# will not be updated, and a default value will be used for create.\n"
    pyc += "def write_entity(entity, fields):\n";
    pyc += "    cnx = get_mysql_connector()\n";
    pyc += "    if not cnx:\n";
    pyc += "        raise ValueError(\"Database connection failed.\")\n";
    pyc += "    try:\n";
    pyc += "        cursor = cnx.cursor()\n";
    pyc += "        try:\n";
    pyc += "            dsId = fields.get(\"dsId\", 0)\n";
    pyc += "            if dsId:\n";
    definitions.forEach(function (edef) {
        pyc += "                if entity == \"" + edef.entity + "\":\n";
        pyc += "                    return update_existing_" + edef.entity + "(cnx, cursor, dsId, fields)\n"; });
    pyc += "            # No existing instance to update.  Insert new.\n";
    definitions.forEach(function (edef) {
        pyc += "            if entity == \"" + edef.entity + "\":\n";
        pyc += "                return return insert_new_" + edef.entity + "(cnx, cursor, fields)\n"; });
    pyc += "        except mysql.connector.Error as e:\n";
    pyc += "            raise ValueException(\"write_entity failed: \" + str(e))\n";
    pyc += "        finally:\n";
    pyc += "            cursor.close()\n";
    pyc += "    finally:\n";
    pyc += "        cnx.close()\n";
    return pyc;
}


function writeQueryFunction (edef) {
    var pyc = "";
    pyc += "def query_" + edef.entity + "(cnx, cursor, where):\n";
    pyc += "    query = \"SELECT dsId, \"\n";
    var fcsv = "";
    edef.fields.forEach(function (fd) {
        if(fcsv) {
            fcsv += ", "; }
        fcsv += fd.f; });
    pyc += "    query += \"" + fcsv + "\"\n";
    pyc += "    query += \" FROM " + edef.entity + " \" + where\n";
    pyc += "    cursor.execute(query)\n";
    pyc += "    for (dsId, " + fcsv + ") in cursor:\n";
    var oes = "";
    edef.fields.forEach(function (fd) {
        if(oes) {
            oes += ", "; }
        oes += "\"" + fd.f + "\": " + fd.f; });
    pyc += "        res.append({" + oes + "})\n";
    pyc += "    return res\n";
    return pyc;
}


function entityQueryFunction () {
    var pyc = "";
    var definitions = ddefs.dataDefinitions();
    definitions.forEach(function (edef) {
        pyc += writeQueryFunction(edef) + "\n\n"; });
    pyc += "# Fetch instances of the specified entity kind for the given WHERE clause\n";
    pyc += "# which will typically include ORDER BY and LIMIT clauses.\n";
    pyc += "def query_entity(entity, where):\n";
    pyc += "    res = []\n";
    pyc += "    cnx = get_mysql_connector()\n";
    pyc += "    if not cnx:\n";
    pyc += "        raise ValueError(\"Database connection failed.\")\n";
    pyc += "    try:\n";
    pyc += "        cursor = cnx.cursor()\n";
    pyc += "        try:\n";
    pyc += "            query = \"SELECT dsId, \"\n";
    var definitions = ddefs.dataDefinitions();
    definitions.forEach(function (edef) {
        pyc += "            if entity == \"" + edef.entity + "\":\n";
        pyc += "                return query_" + edef.entity + "(cnx, cursor, where)\n"; });
        pyc += "        except mysql.connector.Error as e:\n";
        pyc += "            raise ValueException(\"query_entity failed: \" + str(e))\n";
        pyc += "        finally:\n";
        pyc += "            cursor.close()\n";
        pyc += "    finally:\n";
        pyc += "        cnx.close()\n";
    return pyc;
}


function createPythonDBAcc () {
    var pyc = "";
    pyc += "import logging\n";
    pyc += "logging.basicConfig(level=logging.DEBUG)\n";
    pyc += "import flask\n";
    pyc += "import re\n";
    pyc += "\n";
    pyc += entityDefinitions() + "\n\n";
    pyc += entityKeyFields() + "\n\n";
    pyc += helperFunctions() + "\n\n";
    pyc += entityWriteFunction() + "\n\n";
    pyc += entityQueryFunction() + "\n\n";
    pyc += "\n";
    fs.writeFileSync(srcdir + "/dbacc.py", pyc, "utf8");
}


////////////////////////////////////////
// Write the files

createDatabaseSQL();
createPythonDBAcc();
