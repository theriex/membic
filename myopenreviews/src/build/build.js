/*global require: false, console: false, process: false */
/*jslint white: true, regexp: true */
//For info, please see readme.txt

var build = (function () {
    "use strict";

    var fs = require('fs'),
        childproc = require('child_process'),
        readopt = { encoding: 'utf8' },
        writeopt = { encoding: 'utf8' },
        buildroot = "",
        docroot = "",
        outsrc = "module-source.js",
        outcomp = "/js/compiled.js",


    getModuleFiles = function (nextfunc) {
        fs.readFile(docroot + '/js/app.js', readopt, function (err, text) {
            var modules, i, modfile, fpath, modefs = [];
            if(err) {
                console.log("getModuleFiles reading app.js failed: " + err);
                throw err; }
            text = text.slice(text.indexOf("modules = "));
            text = text.slice(text.indexOf("["));
            text = text.slice(1, text.indexOf("]"));
            modules = text.split(",");
            for(i = 0; i < modules.length; i += 1) {
                modfile = modules[i].trim();
                modfile = modfile.slice(1, modfile.length - 1);
                fpath = docroot + "/" + modfile + ".js";
                modefs.push({ filepath: fpath, module: modfile }); }
            nextfunc(modefs);
        });
    },


    writeServerBuildVersion = function (buildstr) {
        fs.readFile(buildroot + "../py/moracct.py", readopt,
                    function (err, text) {
                        if(err) {
                            throw err; }
                        text = text.replace(/BUILDVERSIONSTRING/g, buildstr);
                        fs.writeFile(buildroot + "../py/moracct.py", 
                                     text, writeopt,
                                     function (err) {
                                         if(err) {
                                             throw err; } }); });
    },


    revertServerBuildVersion = function () {
        fs.readFile(buildroot + "../py/moracct.py", readopt,
                    function (err, text) {
                        if(err) {
                            throw err; }
                        text = text.replace(/BUILD....-..-..T..:..:......Z/g,
                                            "BUILDVERSIONSTRING");
                        fs.writeFile(buildroot + "../py/moracct.py",
                                     text, writeopt,
                                     function (err) {
                                         if(err) {
                                             throw err; } }); });
    },


    appendSourceFile = function (modefs, index, nextfunc) {
        if(index < modefs.length) {
            fs.readFile(modefs[index].filepath, readopt, function (err, text) {
                var buildstr;
                if(err) {
                    throw err; }
                if(modefs[index].filepath.indexOf("hinter.js") >= 0) {
                    buildstr = "BUILD" + new Date().toISOString();
                    writeServerBuildVersion(buildstr);
                    text = text.replace(/BUILDVERSIONSTRING/g, buildstr); }
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


    makeMinCommand = function (src, minf) {
        var command = "java -jar " + buildroot + 
            "/compiler-latest/compiler.jar --js " + src + 
            " --js_output_file " + minf;
        return command;
    },


    deploymentReminders = function () {
        var textlines = [
            "Reminders:",
            "  - It can take two deployments for a new release to stabilize.",
            "    do a second build/deploy cycle after a few minutes to ensure",
            "    things are stable."];
        console.log(textlines.join("\n"));
    },


    minifyAndDeploy = function () {
        var command, args, cp;
        command = makeMinCommand(outsrc, outcomp);
        console.log(command);
        args = command.split(" ");
        cp = childproc.spawn(args[0], args.slice(1));
        cp.on('close', deploymentReminders);
    },


    minifyjtmin = function () {
        var ref = docroot + "/js/jtmin.js",
            tmp = docroot + "/js/jtmin.src",
            command = "mv " +  ref + " " + tmp;
        childproc.exec(command, function () {
            var args;
            command = makeMinCommand(tmp, ref);
            console.log(command);
            args = command.split(" ");
            childproc.spawn(args[0], args.slice(1)); });
    },


    unminifyjtmin = function () {
        var ref = docroot + "/js/jtmin.js",
            tmp = docroot + "/js/jtmin.src",
            command;
        try { //copy minified to separate jtmin project to track changes
            command = "mv " + ref + " /general/dev/jtmin/jtminmin.js";
            childproc.exec(command, function () {
                try {
                    command = "mv " +  tmp + " " + ref;
                    childproc.exec(command, function () {
                        console.log("jtmin.js restored"); 
                        try { //copy source to separate jtmin project 
                            command = "cp " + ref + " /general/dev/jtmin/";
                            childproc.exec(command);
                        } catch(ignore) {
                        }
                    });
                } catch(ignore) {
                }
            });
        } catch(ignore) {
        }
    },


    minifyapp = function () {
        var ref = docroot + "/js/app.js",
            tmp = docroot + "/js/app.src",
            command = "mv " + ref + " " + tmp;
        childproc.exec(command, function () {
            var args;
            command = makeMinCommand(tmp, ref);
            console.log(command);
            args = command.split(" ");
            childproc.spawn(args[0], args.slice(1)); });
    },


    unminifyapp = function () {
        var ref = docroot + "/js/app.js",
            tmp = docroot + "/js/app.src",
            command = "mv " + tmp + " " + ref;
        try {
            childproc.exec(command, function () {
                console.log("app.js restored"); });
        } catch(ignore) {
        }
    },


    runbuild = function () {
        getModuleFiles(function (modefs) {
            aggregateSource(modefs, function () {
                minifyAndDeploy(); }); });
        minifyjtmin();
        minifyapp();
    },


    cleanbuild = function () {
        revertServerBuildVersion();
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
        unminifyjtmin();
        unminifyapp();
    },


    setDocroot = function (buildfile) {
        var path = buildfile.slice(0, -1 * "build.js".length);
        //console.log("path: " + path);
        buildroot = path;
        outsrc = buildroot + outsrc;
        docroot = path + "../../docroot";
        console.log("docroot: " + docroot);
        outcomp = docroot + outcomp;
        return docroot;
    };


    return {
        setDocroot: function (buildfile) {
            return setDocroot(buildfile); },
        run: function () {
            runbuild(); },
        clean: function () {
            cleanbuild(); }
    };

} () );


if(build.setDocroot(process.argv[1])) {
    if(process.argv[2] === "clean") {
        build.clean(); }
    else {
        build.run(); } }
else {
    console.log("Couldn't figure out docroot"); }

