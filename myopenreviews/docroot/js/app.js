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
    app.minSideBySide = (320 + 320 + 10);  //smallest possible expanded display
    app.introtext = "";
    app.authcookname = "myopenreviewauth";
    app.secsvr = "https://www.fgfweb.com";
    app.mainsvr = "https://www.fgfweb.com";
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
        jt.out('contentdiv', "Redirecting to secure server...");
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
        var cdiv, ref;
        app.amdtimer.load.end = new Date();
        cdiv = jt.byId('contentdiv');
        jt.out('contentdiv', " &nbsp; ");
        if(!app.introtext) {  //capture original so we can revert as needed
            app.introtext = cdiv.innerHTML; }
        app.layout.init();
        jt.on(document, 'keypress', app.globkey);
        jt.on(window, 'popstate', app.history.pop);
        if(document.referrer) {
            ref = jt.enc(document.referrer);
            setTimeout(function () {
                jt.call('GET', "bytheway?referral=" + ref, null,
                        function () {
                            jt.log("noted referrer: " + document.referrer); },
                        app.failf); }, 2); }
        setTimeout(app.login.init, 10);
    };


    app.init = function () {
        var href = window.location.href,
            modules = [ "js/amd/layout", "js/amd/login", 
                        "js/amd/review",
                        "js/amd/profile", "js/amd/activity", "js/amd/pen", 
                        "js/amd/lcs", "js/amd/history",
                        "js/amd/group",
                        "js/amd/ext/amazon", "js/amd/ext/email",
                        "js/amd/ext/readurl" ];
        if(href.indexOf("https://") !== 0 && href.search(/:\d080/) < 0) {
            window.location.href = "https" + href.slice(4);   //switch to SSL
            return; }  //don't fire anything else off.
        if(href.indexOf("#") > 0) {
            href = href.slice(0, href.indexOf("#")); }
        if(href.indexOf("?") > 0) {
            href = href.slice(0, href.indexOf("?")); }
        jtminjsDecorateWithUtilities(jt);
        jt.out('contentdiv', "loading modules...");
        app.amdtimer = {};
        app.amdtimer.load = { start: new Date() };
        jt.loadAppModules(app, modules, href, app.init2, "?v=141109");
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
               [["It would be awesome if you could ",
                 ["a", {href: emref},
                  "email support to get this fixed."]]]]]]];
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
            case 401: 
                jt.log("app.failf 401, calling logout...");
                return app.login.logout("Please sign in");
            //   404 (not found) -> general error handling
            //   405 (GET instead of POST) -> general error handling
            //   412 (precondition failed) -> general error handling
            case 500: 
                return app.crash(code, errtxt, method, url, data);
            default: 
                failfunc(code, errtxt, method, url, data); } };
    };


    ////////////////////////////////////////
    // supplemental utility funtions
    ////////////////////////////////////////

    // see also: app.layout.commonUtilExtensions

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
                            onmouseover: jt.fs(mcbfnstr + "('over','" + 
                                               imgid + "')"),
                            onmouseout: jt.fs(mcbfnstr + "('out','" + 
                                              imgid + "')")}]],
                  ["td", {id: txttdid, cla: "buttontabletexttd",
                          onmouseover: jt.fs(mcbfnstr + "('over','" + 
                                             imgid + "')"),
                          onmouseout: jt.fs(mcbfnstr + "('out','" + 
                                            imgid + "')")},
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
                ["label", {fo: value, id: value + "label"}, label]];
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


    jt.idInCSV = function (id, csv) {
        if(csv && (csv.endsWith(id) || csv.indexOf(id + ",") >= 0)) {
            return true; }
    };


} () );