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
        sql += "  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,\n";
        edef.fields.forEach(function (ed) {
            sql += "  " + ed.f + " " + sqlType(ed.d) + reqFlag(ed.d) +
                uniqueFlag(ed.d) + ",\n"; });
        sql += indexClauses(edef);
        sql += "  PRIMARY KEY (id)\n";
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
            pyc += "        \"" + fd.f + "\": {\"pt\": \"" + 
                pyTypeForField(fd) + "\"}" + fcomma + "\n"; });
        pyc += "    }" + ecomma + "\n"; });
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
    return pyc;
}


function createPythonDBAcc () {
    var pyc = "";
    pyc += "import logging\n";
    pyc += "logging.basicConfig(level=logging.DEBUG)\n";
    pyc += "import flask\n";
    pyc += "import re\n";
    pyc += "\n";
    pyc += entityDefinitions();
    pyc += "\n";
    pyc += "\n";
    pyc += helperFunctions();
    pyc += "\n";
    fs.writeFileSync(srcdir + "/dbacc.py", pyc, "utf8");
}


////////////////////////////////////////
// Write the files

createDatabaseSQL();
createPythonDBAcc();
