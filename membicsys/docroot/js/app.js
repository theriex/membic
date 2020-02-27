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
    //app.hardhome = "https://membicsys.appspot.com";
    app.hardhome = "https://membic.org";
    app.secsvr = "https://" + window.location.hostname;
    app.mainsvr = "http://" + window.location.hostname;
    app.authcookname = "membicauth";
    app.suppemail = "membicsystem" + "@" + "gmail" + "." + "com";
    app.profdev = "epinova.com";
    app.onescapefunc = null;  //app global escape key handler
    app.escapefuncstack = [];  //for levels of escaping
    app.forks = [];  //tasks started through setTimeout
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
        if(!tobj.descr || !tobj.func || !tobj.ms) {
            jt.log("app.fork bad object descr: " + tobj.descr +
                   ", func: " + tobj.func +
                   ", ms: " + tobj.ms); }
        var forks = app.forks;
        if(forks.length && forks[forks.length - 1].descr === tobj.descr) {
            var ft = forks[forks.length - 1];
            ft.count = ft.count || 1;
            ft.count += 1; }
        else {
            forks.push(tobj); }
        return setTimeout(tobj.func, tobj.ms);
    };


    //Cancel any ongoing registered loops with timeouts.
    app.stopLoopers = function () {
        while(app.loopers.length > 0) {
            app.loopers.pop().cancelled = true; }
    };


    app.redirectToSecureServer = function (params) {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        var href = app.secsvr + "#returnto=" + jt.enc(app.mainsvr) + 
            "&logout=true";
        href = href.replace(/membic.com/ig, "membic.org");
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        href += "&" + jt.objdata(params);
        jt.out("contentdiv", "Redirecting to secure server...");
        window.location.href = href;
    };


    app.redirectIfNeeded = function () {
        var href = window.location.href;
        if(href.indexOf(app.mainsvr) >= 0 &&
           href.indexOf("authtoken=") < 0 &&
           href.indexOf("at=") < 0 &&
           href.indexOf("AltAuth") < 0 &&
           (!jt.cookie(app.authcookname))) {
            app.redirectToSecureServer(jt.parseParams());
            return true; }
    };


    app.redirect = function (href) {
        window.location.href = href;
    };


    app.verifyHome = function () {
        if(window.location.pathname !== "/" || 
           window.location.href.indexOf("?") >= 0 ||
           window.location.href.indexOf("#") >= 0) {
            window.location.href = "/"; }
    };


    app.hashtaghref = function () {
        var href = window.location.pathname;
        href = href.slice(1);  //remove initial slash
        if(href && href.indexOf(".") < 0 && href.indexOf("/") < 0) {
            return href; }
        return "";
    };


    app.solopage = function () {
        if(app.embedded ||
               window.location.href.indexOf("/t/") > 0 ||
               window.location.href.indexOf("/p/") > 0 ||
               app.hashtaghref()) {
            return true; }
        return false;
    };


    app.haveReferrer = function () {
        var knownaddrs = [{sub: "membic.org", maxidx: 12},
                          {sub: "membicsys.appspot.com", maxidx: 8}];
        var ref = document.referrer || "";
        ref = ref.toLowerCase();
        if(ref) {
            knownaddrs.every(function (ka) {
                var refidx = ref.indexOf(ka.sub);
                if(refidx >= 0 && refidx <= ka.maxidx) {
                    ref = "";
                    return false; }
                return true; }); }
        return ref;
    };


    //secondary initialization load since single monolithic is dog slow
    app.init2 = function () {
        app.amdtimer.load.end = new Date();
        jt.out("loadstatusdiv", "");  //done loading
        app.layout.init();
        jt.on(document, "keydown", app.globkey);
        jt.on(window, "popstate", app.history.pop);
        if(app.pfoj) {
            app.refmgr.deserialize(app.pfoj);
            app.refmgr.put(app.pfoj); }
        //bootstrap completed, end this thread and begin next phase
        app.fork({descr:"initial authentication",
                  func:app.login.init, ms:10});
        setTimeout(function () {
            jt.log("setTimeout forked tasks:");
            app.forks.forEach(function (tobj) {
                var txt = "    " + tobj.descr + " (" + tobj.ms + "ms)";
                if(tobj.count) {
                    txt += " " + tobj.count + "x"; }
                jt.log(txt); }); }, 30000);
    };


    app.secureURL = function (url) {
        var secbase = app.hardhome;
        if(url.indexOf(secbase) === 0 || url.search(/:\d080/) >= 0) {
            return url; }
        var idx = url.indexOf("/", 9);  //endpoint specified
        if(idx >= 0) {
            return secbase + url.slice(idx); }
        idx = url.indexOf("?");  //query specified
        if(idx >= 0) {
            return secbase + url.slice(idx); }
        idx = url.indexOf("#");  //hash specified
        if(idx >= 0) {
            return secbase + url.slice(idx); }
        return secbase;  //nothing specified, return plain site
    };


    app.init = function () {
        var href = window.location.href;
        //The ordering of the modules will encourage, but not guarantee, that
        //earlier modules will be available for reference across modules.  So
        //best not to reference other modules within top level module vars.
        var modules = [ "js/amd/themes", "js/amd/profile", "js/amd/membic",
                        "js/amd/layout", "js/amd/refmgr", "js/amd/history",
                        "js/amd/login", "js/amd/pcd", "js/amd/coop",
                        //"js/amd/ext/amazon", (not used right now)
                        "js/amd/ext/jsonapi",
                        "js/amd/ext/readurl" ];
        var securl = app.secureURL(href);
        if(securl !== href) {
            window.location.href = securl;  //redirect
            return; }  //don't fire anything else off
        jtminjsDecorateWithUtilities(jt);
        app.originalhref = href;
        if(href.indexOf("#") > 0) {
            href = href.slice(0, href.indexOf("#")); }
        if(href.indexOf("?") > 0) {
            href = href.slice(0, href.indexOf("?")); }
        if(app.solopage()) {
            jt.byId("topsectiondiv").style.display = "none";
            jt.byId("headingdiv").style.display = "none";
            jt.byId("bottomnav").style.display = "none";
            jt.byId("topsectiondiv").style.display = "none"; }
        jt.out("loadstatusdiv", "Loading app modules...");
        app.amdtimer = {};
        app.amdtimer.load = { start: new Date() };
        jt.loadAppModules(app, modules, href, app.init2, "?v=190921");
    };


    app.loadScript = function (logsrc, href, id) {
        var js;
        if(jt.byId(id)) {
            return; }  //already loaded. Might need to wait for it.
        if(logsrc) {
            jt.log(logsrc + " loading " + href); }
        if(!href.startsWith("http")) {
            href = jt.baseurl(window.location.href) + "/" + href; }
        if(href.indexOf("v=") < 0) {
            href += "?v=190921"; }
        js = document.createElement("script");
        //js.async = true;
        js.type = "text/javascript";
        js.id = id;
        js.src = href;
        document.body.appendChild(js);
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
        app.layout.cancelOverlay();
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
            [msg + ". ",
             ["a", {href:emref}, "Please tell the dev team."]]);
    };


    app.typeOrBlank = function (typename) {
        if(typename && typename !== "all") {
            return typename; }
        return "";
    };


    app.toggledivdisp = function (divid) {
        var div = jt.byId(divid);
        if(div) {
            if(div.style.display === "block") {
                div.style.display = "none"; }
            else {
                div.style.display = "block"; } }
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

