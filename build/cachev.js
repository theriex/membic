/*jslint node, multivar, white, fudge */

//Check the modification time of the source files to determine an
//appropriate cache bust value for url references to those sources.
//Update source files providing the source urls so that browsers know
//to get any source that has changed.

var cachev = (function () {
    "use strict";

    var fs = require("fs"),
        readopt = {encoding: "utf8"},
        //writeopt = {encoding: "utf8"},
        //buildroot = "",    //runtime
        docroot = "",      //runtime
        othersources = ["css/site.css", "img/membiclogo.png"],
        otherrefs = ["../src/py/start.py"],
        ignorefiles = ["compiled.js"],  //no path on these
        srcfiles = null,   //runtime
        updatesource = true;


    function findSourceFiles(dir) {
        var files = fs.readdirSync(dir);
        if(files && files.length) {
            files.forEach(function (fname) {
                var stats, path;
                path = dir + "/" + fname;
                stats = fs.statSync(path);
                if(stats.isDirectory()) {
                    findSourceFiles(path); }
                else if((fname.indexOf(".") !== 0) &&
                        (fname.slice(-3) === ".js") &&
                        (ignorefiles.indexOf(fname) < 0)) {
                    srcfiles.push(path); } }); }
    }


    function setDocroot (thisfile) {
        var basename = "cachev.js",
            path = thisfile.slice(0, -1 * basename.length);
        //console.log("path: " + path);
        //buildroot = path;
        docroot = path + "../membicsys/docroot";
        //console.log("docroot: " + docroot);
        if(!srcfiles) {
            srcfiles = [];
            othersources.forEach(function (fname) {
                srcfiles.push(docroot + "/" + fname); });
            findSourceFiles(docroot + "/js"); }
        return docroot;
    }


    function findRefs (refname) {
        var refobj, rfiles;
        refobj = {refname: refname, files: []};
        rfiles = [];
        otherrefs.forEach(function (fname) {
            rfiles.push(docroot + "/" + fname); });
        srcfiles.forEach(function (path) {
            rfiles.push(path); });
        rfiles.forEach(function (path) {
            var fname, ext, text;
            fname = path.slice(path.lastIndexOf("/") + 1);
            ext = fname.slice(fname.lastIndexOf(".") + 1);
            if(ext === "js" || ext === "css" || ext === "py") {
                text = fs.readFileSync(path, readopt);
                if(text.indexOf(refname) >= 0) {
                    refobj.files.push(path); } } });
        return refobj;
    }


    function showSourceReferences () {
        var refs = [];
        srcfiles.forEach(function (path) {
            var fname = path.slice(path.lastIndexOf("/") + 1);
            refs.push(findRefs(fname)); });
        refs.sort(function (a, b) {
            if(a.refname < b.refname) { return -1; }
            if(a.refname > b.refname) { return 1; }
            return 0; });
        refs.forEach(function (ref) {
            var refcsv = "";
            ref.files.forEach(function (path) {
                var fname = path.slice(path.lastIndexOf("/") + 1);
                if(refcsv) {
                    refcsv += ", "; }
                refcsv += fname; });
            if(refcsv) {
                console.log("    " + ref.refname + " [" + refcsv + "]"); } });
    }


    return {
        init: function (thisfile) {
            return setDocroot(thisfile); },
        refs: function () {
            showSourceReferences(); },
        displayOnly: function () {
            updatesource = false; },
        run: function () {
            console.log("Not implemented yet."); }
    };

} () );


if(cachev.init(process.argv[1])) {
    if(process.argv[2] === "refs") {
        cachev.refs(); }
    else if(process.argv[2] === "display") {
        cachev.displayOnly();
        cachev.run(); }
    else {
        cachev.run(); } }
else {
    console.log("Couldn't figure out docroot."); }

