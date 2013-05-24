/*global require: false, console: false, process: false */
/*jslint white: true */
//For info, please see readme.txt

var morbuild = (function () {
    "use strict";

    var fs = require('fs'),
        cp = require('child_process'),
        readopt = { encoding: 'utf8' },
        writeopt = { encoding: 'utf8' },
        outsrc = "mor-source.js",
        outcomp = "../../docroot/js/mor-comp.js",


    getModuleFiles = function (nextfunc) {
        fs.readFile('../../docroot/js/mor.js', readopt, function (err, text) {
            var modules, i, modfile, fpath, modefs = [];
            if(err) {
                throw err; }
            text = text.slice(text.indexOf("mor.init1 = function"));
            text = text.slice(text.indexOf("require(mor.cdnconf,"));
            text = text.slice(text.indexOf("["));
            text = text.slice(1, text.indexOf("]"));
            modules = text.split(",");
            for(i = 0; i < modules.length; i += 1) {
                modfile = modules[i].trim();
                modfile = modfile.slice(1, modfile.length - 1);
                if(modfile.indexOf("amd/") === 0) {
                    fpath = "../../docroot/js/" + modfile + ".js";
                    modefs.push({ filepath: fpath, module: modfile }); }
                else if(modfile.indexOf("ext/") === 0) {
                    fpath = "../../docroot/js/amd/" + modfile + ".js";
                    modefs.push({ filepath: fpath, module: modfile }); } }
            nextfunc(modefs);
        });
    },


    appendSourceFile = function (modefs, index, nextfunc) {
        if(index < modefs.length) {
            fs.readFile(modefs[index].filepath, readopt, function (err, text) {
                var insidx;
                if(err) {
                    throw err; }
                insidx = text.indexOf("define(") + "define(".length;
                text = text.slice(0, insidx) + 
                    "\"" + modefs[index].module + "\", " +
                    text.slice(insidx);
                fs.appendFile(outsrc, text, writeopt, function (err) {
                    if(err) {
                        throw err; }
                    appendSourceFile(modefs, index + 1, nextfunc); }); }); }
        else { //all files appended
            console.log("Source files appended");
            nextfunc(); }
    },


    aggregateSource = function (modefs, nextfunc) {
        fs.writeFile(outsrc, "", writeopt, function (err) {
            if(err) {
                throw err; }
            appendSourceFile(modefs, 0, nextfunc);
        });
    },


    minifyAndDeploy = function () {
        var command, args;
        command = "java -jar compiler-latest/compiler.jar --js " + outsrc + 
            " --js_output_file " + outcomp;
        console.log(command);
        args = command.split(" ");
        cp.spawn(args[0], args.slice(1));
    },


    runbuild = function () {
        getModuleFiles(function (modefs) {
            aggregateSource(modefs, function () {
                minifyAndDeploy(); }); });
    },


    cleanbuild = function () {
        fs.writeFile(outcomp, "", writeopt, function (err) {
            if(err) {
                throw err; }
            console.log("cleared out " + outcomp); 
        });
        fs.writeFile(outsrc, "", writeopt, function (err) {
            if(err) {
                throw err; }
            console.log("cleared out " + outsrc);
        });
    };


    return {
        run: function () {
            runbuild(); },
        clean: function () {
            cleanbuild(); }
    };

} () );


if(process.argv[2] === "clean") {
    morbuild.clean(); }
else {
    morbuild.run(); }


