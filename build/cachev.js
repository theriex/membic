/*jslint node, multivar, white, fudge */
/*property
    argv, cacheTagOverride, displayOnly, encoding, files, forEach, indexOf,
    init, isDirectory, lastIndexOf, length, log, match, mtime, push,
    readFileSync, readdirSync, refname, refs, replace, run, slice, sort,
    statSync, toISOString, writeFileSync
*/

//Check the modification time of the source files to determine an
//appropriate cache bust value for url references to those sources.
//Update source files providing the source urls so that browsers know
//to get any source that has changed.

var cachev = (function () {
    "use strict";

    var fs = require("fs"),
        readopt = {encoding: "utf8"},
        writeopt = {encoding: "utf8"},
        docroot = "",      //runtime
        othersources = ["css/site.css", "img/membiclogo.png"],
        otherrefs = ["css/site.css", "../src/py/start.py"],
        ignorefiles = ["compiled.js"],  //no path on these
        srcfiles = null,   //runtime discovered + othersources
        rfiles = null,     //runtime discovered + otherrefs
        updatesource = true,
        ctag = "";


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
        docroot = path + "../membicsys/docroot";
        //console.log("docroot: " + docroot);
        if(!srcfiles) {
            srcfiles = [];
            findSourceFiles(docroot + "/js");
            rfiles = srcfiles.slice();
            othersources.forEach(function (fname) {
                srcfiles.push(docroot + "/" + fname); });
            otherrefs.forEach(function (fname) {
                rfiles.push(docroot + "/" + fname); }); }
        return docroot;
    }


    function findRefs (refname) {
        var refobj = {refname: refname, files: []};
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


    function mostRecentlyModified () {
        var latest = (new Date(0)).toISOString();
        srcfiles.forEach(function (path) {
            var modtime = fs.statSync(path).mtime.toISOString();
            //console.log(path + " " + modtime);
            if(modtime > latest) {
                latest = modtime; } });
        return latest;
    }


    function updateCacheBustTags () {
        var re = /v=\d\d\d\d\d\d/g;
        if(!ctag) {
            ctag = mostRecentlyModified();
            ctag = ctag.slice(2,4) + ctag.slice(5,7) + ctag.slice(8,10); }
        if(ctag.indexOf("v=") !== 0) {
            ctag = "v=" + ctag; }
        if(!ctag.match(re)) {
            throw new TypeError("Invalid cache tag value: " + ctag); }
        console.log("Cache tag: " + ctag);
        rfiles.forEach(function (path) {
            var text, match;
            text = fs.readFileSync(path, readopt);
            match = text.match(re);
            if(match && match[0] !== ctag) {
                if(updatesource) {
                    text = text.replace(re, ctag);
                    fs.writeFileSync(path, text, writeopt);
                    console.log("Updated " + path); }
                else { 
                    console.log("Outdated " + path + " " + match[0]); } }});
    }


    return {
        init: function (thisfile) {
            return setDocroot(thisfile); },
        refs: function () {
            showSourceReferences(); },
        displayOnly: function () {
            updatesource = false; },
        cacheTagOverride: function (tagval) {
            ctag = tagval; },
        run: function () {
            updateCacheBustTags(); }
    };

} () );


if(cachev.init(process.argv[1])) {
    if(process.argv[2] === "refs") {
        cachev.refs(); }
    else if(process.argv[2] === "update") {
        cachev.run(); }
    else if(process.argv[2]) {  //assume cache tag value override
        cachev.cacheTagOverride(process.argv[2]);
        cachev.run(); }
    else {
        cachev.displayOnly();
        cachev.run(); } }
else {
    console.log("Couldn't figure out docroot."); }

