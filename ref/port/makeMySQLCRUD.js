/*jslint node, white, fudge */

var ddefs = require("./datadefs");
var srcdir = "../../membicsys/py";
var fs = require("fs");


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
        idxs += "  INDEX (" + idxc + "),\n" });
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


createDatabaseSQL();
