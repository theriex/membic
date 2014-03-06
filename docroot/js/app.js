/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, FB: false, navigator: false, require: false, jtminjsDecorateWithUtilities: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

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
    app.winw = 0;  //adjusted in app.layout
    app.winh = 0;
    app.introtext = "";
    app.authcookname = "myopenreviewauth";
    app.secsvr = "https://myopenreviews.appspot.com";
    app.mainsvr = "http://www.wdydfun.com";
    app.onescapefunc = null;  //app global escape key handler
    app.escapefuncstack = [];  //for levels of escaping


    ////////////////////////////////////////
    // application level functions
    ////////////////////////////////////////

    //app global key handling
    app.globkey = function (e) {
        if(e && e.keyCode === 27) {  //ESC
            if(app.onescapefunc) {
                jt.evtend(e);
                app.onescapefunc(); } }
    };


    app.cancelOverlay = function () {
        jt.out('overlaydiv', "");
        jt.byId('overlaydiv').style.visibility = "hidden";
        app.onescapefunc = null;
    };


    app.redirectToSecureServer = function (params) {
        var href, state;
        state = {};
        if(history && history.state) {
            state = history.state; }
        href = app.secsvr + "#returnto=" + jt.enc(app.mainsvr) + 
            "&logout=true";
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        href += "&" + jt.objdata(params);
        jt.out('contentfill', "Redirecting to secure server...");
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


    //secondary initialization load since single monolithic is dog slow
    app.init2 = function () {
        var cdiv;
        app.amdtimer.load.end = new Date();
        cdiv = jt.byId('contentdiv');
        jt.out('contentfill', " &nbsp; ");
        if(!app.introtext) {  //capture original so we can revert as needed
            app.introtext = cdiv.innerHTML; }
        app.layout.init();
        jt.on(document, 'keypress', app.globkey);
        jt.on(window, 'popstate', app.history.pop);
        if(document.referrer && document.referrer.indexOf("craigslist") > 0) {
            setTimeout(function () {
                jt.call('GET', "bytheway?referral=craigslist", null,
                        function () {
                            jt.log("noted craigslist referral"); },
                        app.failf); }, 2); }
        setTimeout(app.login.init, 10);
    };


    app.init = function () {
        var href = window.location.href,
            modules = [ "js/amd/layout", "js/amd/login", 
                        "js/amd/review", "js/amd/revresp", 
                        "js/amd/profile", "js/amd/activity", "js/amd/pen", 
                        "js/amd/rel", "js/amd/skinner", "js/amd/services", 
                        "js/amd/lcs", "js/amd/history", "js/amd/hinter",
                        "js/amd/ext/facebook", "js/amd/ext/twitter", 
                        "js/amd/ext/googleplus", "js/amd/ext/github",
                        "js/amd/ext/amazon", "js/amd/ext/email",
                        "js/amd/ext/readurl" ];
        if(href.indexOf("http://www.wdydfun.com") >= 0) {
            app.mainsvr = "http://www.wdydfun.com"; }
        if(href.indexOf("http://www.myopenreviews.com") >= 0) {
            app.mainsvr = "http://www.myopenreviews.com"; }
        if(href.indexOf("#") > 0) {
            href = href.slice(0, href.indexOf("#")); }
        if(href.indexOf("?") > 0) {
            href = href.slice(0, href.indexOf("?")); }
        jtminjsDecorateWithUtilities(jt);
        jt.out('contentfill', "loading modules...");
        app.amdtimer = {};
        app.amdtimer.load = { start: new Date() };
        jt.loadAppModules(app, modules, href, app.init2);
    };


    app.crash = function (code, errtxt, method, url, data) {
        var html, now, subj, body, emref, support;
        support = "theriex";
        support += "@gmail.com";
        now = new Date();
        subj = "Server crash";
        body = "Hey,\n\n" +
            "The server crashed.  Here are some details:\n\n" +
            "local time: " + now + "\n" +
            "method: " + method + "\n" +
            "url: " + url + "\n" +
            "data: " + data + "\n" +
            "code: " + code + "\n" +
            errtxt + "\n\n" +
            "Please fix this so it doesn't happen again.  If it is " +
            "anything more than a minor bug, open an issue on " +
            "https://github.com/theriex/myopenreviews/issues for " +
            "tracking purposes.\n\n" +
            "thanks,\n";
        emref = "mailto:" + support + "?subject=" + jt.dquotenc(subj) + 
            "&body=" + jt.dquotenc(body);
        html = [
            ["div", {id: "chead"}],
            ["div", {id: "cmain"},
             [["p", "The server just bonked."],
              ["p", 
               ["Sometimes this sort of thing can be fixed by hitting the " +
                "reload button in your browser.  If that doesn't work, " + 
                "then it would awesome if would please ",
                ["a", {href: emref},
                 "email support so we can fix it."]]]]]];
        html = jt.tac2html(html);
        jt.out('contentdiv', html);
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
            case 401: return app.login.logout();
            //   404 (not found) -> general error handling
            //   405 (GET instead of POST) -> general error handling
            //   412 (precondition failed) -> general error handling
            case 500: return app.crash(code, errtxt, method, url, data);
            default: failfunc(code, errtxt, method, url, data); } };
    };


    ////////////////////////////////////////
    // supplemental utility funtions
    ////////////////////////////////////////

    jt.imgntxt = function (imgfile, text, funcstr, href, 
                           title, cssclass, idbase, mcbfnstr) {
        var html, tblid = "", imgtdid = "", imgid = "", txttdid = "";
        if(imgfile && imgfile.indexOf("/") < 0) {
            imgfile = "img/" + imgfile; }
        title = title || "";
        cssclass = cssclass || "navico"; 
        mcbfnstr = mcbfnstr || "";
        if(idbase) {
            tblid = idbase + "table";
            imgtdid = idbase + "imgtd";
            imgid = idbase + "img";
            txttdid = idbase + "txttd"; }
        html = ["table", {id: tblid, cla: "buttontable", title: title,
                          onclick: jt.fs(funcstr)},
                ["tr",
                 [["td", {id: imgtdid},
                   ["img", {id: imgid, cla: cssclass, src: imgfile,
                            onmouseover: jt.fs(mcbfnstr + "('over')"),
                            onmouseout: jt.fs(mcbfnstr + "('out')")}]],
                  ["td", {id: txttdid, cla: "buttontabletexttd",
                          onmouseover: jt.fs(mcbfnstr + "('over')"),
                          onmouseout: jt.fs(mcbfnstr + "('out')")},
                   text]]]];
        html = jt.tac2html(html);
        return html;
    };


    jt.checkrad = function (type, name, value, label, checked, chgfstr) {
        var html;
        if(!label) {
            label = value.capitalize(); }
        html = [["input", {type: type, name: name, value: value, id: value,
                           checked: jt.toru(checked, "checked"), 
                           onchange: jt.fs(chgfstr)}],
                ["label", {fo: value}, label]];
        html = jt.tac2html(html);
        return html;
    };


    //Single checkbox onchange is not triggered on IE8 until the focus
    //leaves the checkbox.  For IE8, use onclick rather than onchange 
    //and redraw the checkbox from scratch with the new value.
    jt.checkbox = function (name, value, label, checked, chgfstr) {
        return jt.checkrad("checkbox", name, value, label, checked, chgfstr);
    };


    jt.radiobutton = function (name, value, label, checked, chgfstr) {
        return jt.checkrad("radio", name, value, label, checked, chgfstr);
    };


    //Referencing variables starting with an underscore causes jslint
    //complaints, but it still seems the clearest and safest way to
    //handle an ID value in the server side Python JSON serialization.
    //This utility method encapsulates the access, and provides a
    //single point of adjustment if the server side logic changes.
    jt.instId = function (obj) {
        var idfield = "_id";
        if(obj && obj.hasOwnProperty(idfield)) {
            return obj[idfield]; }
    };
    jt.setInstId = function (obj, idval) {
        var idfield = "_id";
        obj[idfield] = idval;
    };
    jt.isId = function (idval) {
        if(idval && typeof idval === 'string' && idval !== "0") {
            return true; }
        return false;
    };


    //Some things don't work in older browsers and need code
    //workarounds to degrade gracefully e.g. the background image.
    //IE8 is a known problem, but also older android browsers.  Better
    //to enumerate the ones that are probably good (those that are
    //consistently updated)
    jt.isLowFuncBrowser = function () {
        var nav;
        if(navigator) {
            nav = navigator;
            // alert("appCodeName: " + nav.appCodeName + "\n" +
            //       "appName: " + nav.appName + "\n" +
            //       "appVersion: " + nav.appVersion + "\n" +
            //       "platform: " + nav.platform + "\n" +
            //       "userAgent: " + nav.userAgent + "\n");
            if(nav.userAgent.indexOf("Firefox") >= 0) {
                return false; }
            if(nav.userAgent.indexOf("Chrome") >= 0) {
                return false; }
            if((nav.userAgent.indexOf("Safari") >= 0) &&
               (nav.userAgent.indexOf("CyanogenMod") < 0) &&
               (nav.userAgent.indexOf("Android") < 0)) {
                return false; } }
        return true;
    };


    jt.hex2rgb = function (hex) {
        var r, g, b;
        if(hex.indexOf("#") === 0) {
            hex = hex.slice(1); }
        r = hex.slice(0, 2);
        g = hex.slice(2, 4);
        b = hex.slice(4, 6);
        r = parseInt(r, 16);
        g = parseInt(g, 16);
        b = parseInt(b, 16);
        return String(r) + "," + g + "," + b;
    };


    jt.retry = function (rfunc, times) {
        var i;
        rfunc();
        if(times) {
            for(i = 0; i < times.length; i += 1) {
                setTimeout(rfunc, times[i]); } }
    };


} () );
