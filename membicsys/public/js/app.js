/*global window, document, history, jtminjsDecorateWithUtilities */

/*jslint browser, white, fudge, for, long */

var app = {};  //Global container for application level funcs and values
var jt = {};   //Global access to general utility methods

////////////////////////////////////////
// g l o
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    app.colors = { bodybg: "#fffff6",
                   text: "#111111",
                   link: "#3150b2",
                   hover: "#3399cc" };
    //app.embedded is set in start.py
    app.winw = 0;  //adjusted in app.layout
    app.winh = 0;
    app.onescapefunc = null;  //app global escape key handler
    app.escapefuncstack = [];  //for levels of escaping
    app.forks = {};  //tasks started through setTimeout
    app.wait = {divid:"", timeout:null};
    app.urlToRead = "";
    app.loopers = [];  //zero or more workhorse loop state objects


    ////////////////////////////////////////
    // application level functions
    ////////////////////////////////////////

    //app global key handling
    app.globkey = function (e) {
        var tempf;
        if(e && (e.charCode === 27 || e.keyCode === 27)) {  //ESC
            if(app.onescapefunc) {
                jt.evtend(e);
                tempf = app.onescapefunc;
                app.onescapefunc = null;
                if(app.escapefuncstack.length > 0) {
                    app.onescapefunc = app.escapefuncstack.pop(); }
                tempf(); } }
    };


    app.fork = function (tobj) {
        //By convention all the setTimeout calls are routed through here to
        //provide an easy overview of all the async tasks invoked on
        //startup.  Could add timing and hang recovery as needed.
        if(!tobj.descr || !tobj.func || !tobj.ms) {
            jt.log("app.fork bad object descr: " + tobj.descr +
                   ", func: " + tobj.func +
                   ", ms: " + tobj.ms); }
        if(!app.forks[tobj.descr]) {
            app.forks[tobj.descr] = {descr:tobj.descr, count:0}; }
        var forknote = app.forks[tobj.descr];
        forknote.count += 1;
        forknote.latest = new Date().toISOString();
        //showing each fork produces a lot of lines from filtering membics
        //jt.log("app.fork " + tobj.descr + " " + tobj.ms + "ms");
        return setTimeout(tobj.func, tobj.ms);
    };


    app.solopage = function () {
        return app.embedded;
    };


    //Post module load app initialization.  startParams.go directives are
    //processed in the initial display, and on statemgr.redispatch after the
    //user is authenticated.
    app.init2 = function () {
        app.amdtimer.load.end = new Date();
        jt.log("load app: " + (app.amdtimer.load.end.getTime() - 
                               app.amdtimer.load.start.getTime()));
        jt.out("loadstatusdiv", "");  //done loading
        jt.on(document, "keydown", app.globkey);
        jt.on(window, "popstate", app.statemgr.pop);
        //break out dynamic processing to give the static content a chance
        //to actually display. Just downloaded a bunch, show some screen.
        app.fork({descr:"App Start", ms:80, func:function () {
            //Save initial params before clearing the URL via setState.
            app.startParams = jt.parseParams("String");
            app.layout.init();
            app.fork({descr:"lightweight authentication",
                      func:app.login.init, ms:10});
            app.fork({descr:"fork summary", ms:10000, func:function () {
                var txt = "app.fork work summary:";
                Object.keys(app.forks).forEach(function (fkey) {
                    var forknote = app.forks[fkey];
                    txt += "\n    " + forknote.latest + " " + forknote.count +
                        " " + forknote.descr; });
                jt.log(txt); }});
            app.refmgr.deserialize(app.pfoj);
            app.refmgr.put(app.pfoj);
            app.statemgr.setState(app.pfoj, null, {go:app.startParams.go,
                                                   forceReplace:true}); }});
    };


    app.init = function () {
        //Server setup should already have redirected http to https, but
        //double check in case that setup fails.  No insecure pw forms.
        var ox = window.location.href;
        if((ox.toLowerCase().indexOf("https:") !== 0) &&
           (ox.search(/:\d080/) < 0)) {  //local dev
            window.location.href = "https:" + ox.slice(ox.indexOf("/"));
            return; }  //stop and let the redirect happen.
        app.docroot = ox.split("/").slice(0, 3).join("/") + "/";
        jtminjsDecorateWithUtilities(jt);
        if(app.solopage()) {  //hide framing content if embedded or standalone
            //temporarily hide the top to avoid blinking content
            jt.byId("topsectiondiv").style.display = "none";
            jt.byId("bottomnav").style.display = "none"; }
        //No load-time interdependencies between modules.
        var modules = [ "js/amd/login", "js/amd/connect", "js/amd/membic",
                        "js/amd/layout", "js/amd/refmgr", "js/amd/statemgr",
                        "js/amd/pcd", "js/amd/theme",
                        //"js/amd/ext/amazon", (not used right now)
                        "js/amd/ext/jsonapi",
                        "js/amd/ext/readurl" ];
        jt.out("loadstatusdiv", "Loading app modules...");
        app.amdtimer = {};
        app.amdtimer.load = { start: new Date() };
        jt.loadAppModules(app, modules, app.docroot, app.init2, "?v=201120");
    };


    //app.docroot is initialized with a terminating '/' so it can be
    //concatenated directly with a relative path, but remembering and
    //relying on whether a slash is required is annoying.  Double slashes
    //are usually handled properly but can be a source of confusion, so this
    //strips off any preceding slash in the relpath.
    app.dr = function (relpath) {
        if(relpath.startsWith("/")) {
            relpath = relpath.slice(1); }
        return app.docroot + relpath;
    };


    app.samePO = function (a, b) {
        if(!a || !b) {
            return false; }
        if(a.dsType === b.dsType && a.dsId === b.dsId) {
            return true; }
        return false;
    };


    //Return the argument list as a string of arguments suitable for appending
    //to onwhatever function text.
    app.paramstr = function (args) {
        var ps = "";
        if(args && args.length) {
            ps = args.reduce(function (acc, arg) {
                if((typeof arg === "string") && (arg !== "event")) {
                    arg = "'" + arg + "'"; }
                return acc + "," + arg; }, ""); }
        return ps;
    };


    app.crash = function (code, errtxt, method, url, data) {
        var now = new Date();
        var subj = "App crash";
        var body = "method: " + method + "\n" +
            "url: " + url + "\n" +
            "data: " + data + "\n" +
            "code: " + code + "\n" +
            errtxt + "\n\n";
        jt.log("app.crash " + body);
        body = "Hey,\n\n" +
            "The app crashed.  Here are some details:\n\n" +
            "local time: " + now + "\n" + body +
            "Please fix this so it doesn't happen again.  If it is " +
            "anything more than a minor bug, open an issue on " +
            "https://github.com/theriex/membic/issues for " +
            "tracking purposes.\n\n" +
            "thanks,\n";
        var emref = "mailto:" + app.suppemail + "?subject=" + 
            jt.dquotenc(subj) + "&body=" + jt.dquotenc(body);
        var html = ["div", {id: "bonkmain"},
                [["p", "The app just bonked."],
                 ["p", 
                  [["It would be awesome if you could ",
                    ["a", {href: emref},
                     "email support to get this fixed."]]]]]];
        html = jt.tac2html(html);
        jt.out("contentdiv", html);
        app.layout.closeDialog();
    };


    app.failf = function (failfunc) {
        if(!failfunc) {
            failfunc = function (code, errtxt, method, url, data) {
                jt.log(jt.safestr(code) + " " + method + " " + url + 
                       " " + data + " " + errtxt); }; }
        return function (code, errtxt, method, url, data) {
            switch(code) {
            //   400 (bad request) -> general error handling
            //If the user has attempted to do something unauthorized,
            //then it's most likely because their session has expired
            //or they logged out and are trying to resubmit an old
            //form.  The appropriate thing is to redo the login.
            case 401: 
                jt.log("app.failf 401, calling logout...");
                return app.login.logout(errtxt || "Please sign in");
            //   404 (not found) -> general error handling
            //   405 (GET instead of POST) -> general error handling
            //   412 (precondition failed) -> general error handling
            case 503:
                jt.err("Server quota exceeded, some operations may not be available for the rest of the day");
                return failfunc(code, errtxt, method, url, data);
            case 500: 
                return app.crash(code, errtxt, method, url, data);
            default: 
                failfunc(code, errtxt, method, url, data); } };
    };


    app.failmsg = function (errmsg) {
        var subj = errmsg;
        var body = "Hey,\n\n" +
            "At around server time " + (new Date().toISOString()) +
            " I got the following error message: " + errmsg + 
            "\n\nI'm sending it along so you can look into it.\n\n" +
            "thanks,\n";
        var emref = "mailto:" + app.suppemail + "?subject=" + 
            jt.dquotenc(subj) + "&body=" + jt.dquotenc(body);
        return jt.tac2html(
            [errmsg + ". ",
             ["a", {href:emref}, "Please tell the dev team."]]);
    };


    app.verifyNoEmbeddedHTML = function (obj, fields, errors, allowed) {
        errors = errors || [];
        fields.forEach(function (fld) {
            var val = obj[fld];
            if(allowed) {  //remove basic tags from check.  No attributes
                allowed.forEach(function (tag) {
                    val = val.replace(new RegExp("<" + tag + ">","ig"), "");
                    val = val.replace(new RegExp("</" + tag + ">", "ig"),
                                      ""); }); }
            if(val && val.match(/<\S/)) {
                errors.push(fld + " has HTML in it (found \"<\")"); } });
        return errors;
    };


    ////////////////////////////////////////
    // supplemental utility funtions
    ////////////////////////////////////////

    // see also: app.layout.commonUtilExtensions

    jt.retry = function (rfunc, times) {
        var i;
        rfunc();
        if(times) {
            for(i = 0; i < times.length; i += 1) {
                setTimeout(rfunc, times[i]); } }
    };


    jt.setdims = function (elem, dim) {
        if(typeof elem === "string") {
            elem = jt.byId(elem); }
        if(elem) {
            if(dim.x) {
                elem.style.left = dim.x + "px"; }
            if(dim.y) {
                elem.style.top = dim.y + "px"; }
            if(dim.w) {
                elem.style.width = dim.w + "px"; }
            if(dim.h) {
                elem.style.height = dim.h + "px"; } }
    };


    jt.spacedCSV = function (csv) {
        var spaced = "";
        csv.csvarray().forEach(function (val) {
            val = val.trim();
            if(val) {
                if(spaced) {
                    spaced += ", "; }
                spaced += val; } });
        return spaced;
    };


    jt.baseurl = function (url) {
        var idx = url.indexOf("/", 9);
        if(idx >= 0) {
            url = url.slice(0, idx); }
        idx = url.indexOf("#");
        if(idx >= 0) {
            url = url.slice(0, idx); }
        idx = url.indexOf("?");
        if(idx >= 0) {
            url = url.slice(0, idx); }
        return url;
    };

}());

