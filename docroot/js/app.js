/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false, FB: false, navigator: false, require: false, jtminjsDecorateWithUtilities: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {};  //Global container for application level funcs and values

////////////////////////////////////////
// g l o
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    app.dojo = null;  //library modules holder
    app.colors = { bodybg: "#fffff6",
                   text: "#111111",
                   link: "#3150b2",
                   hover: "#3399cc" };
    app.winw = 0;  //adjusted in app.layout
    app.winh = 0;
    app.introtext = "";
    app.authcookname = "myopenreviewauth";
    app.secsvr = "https://myopenreviews.appspot.com";
    app.mainsvr = "http://www.myopenreviews.com";
    app.onescapefunc = null;  //app global escape key handler


    ////////////////////////////////////////
    // general utility functions
    ////////////////////////////////////////

    //app global key handling
    app.globkey = function (e) {
        if(e && e.keyCode === 27) {  //ESC
            if(app.onescapefunc) {
                app.evtend(e);
                app.onescapefunc(); } }
    };


    app.cancelOverlay = function () {
        app.out('overlaydiv', "");
        app.byId('overlaydiv').style.visibility = "hidden";
        app.onescapefunc = null;
    };


    app.redirectToSecureServer = function (params) {
        var href, state;
        state = {};
        if(history && history.state) {
            state = history.state; }
        href = app.secsvr + "#returnto=" + app.enc(app.mainsvr) + 
            "&logout=true";
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        href += "&" + app.objdata(params);
        app.out('contentfill', "Redirecting to secure server...");
        window.location.href = href;
    };


    app.redirectIfNeeded = function () {
        var href = window.location.href;
        if(href.indexOf(app.mainsvr) >= 0 &&
           href.indexOf("authtoken=") < 0 &&
           href.indexOf("at=") < 0 &&
           href.indexOf("AltAuth") < 0 &&
           (!app.dojo.cookie(app.authcookname))) {
            app.redirectToSecureServer(app.parseParams());
            return true; }
    };


    //secondary initialization load since single monolithic is dog slow
    app.init2 = function (layout, login, review, profile, 
                         activity, pen, rel, skinner,
                         services, lcs, history, basicmod) {
        var cdiv = app.byId('contentdiv');
        if(!app.introtext) {  //capture original so we can revert as needed
            app.introtext = cdiv.innerHTML; }
        //app module references
        app.layout = layout;
        app.login = login;
        app.review = review;
        app.profile = profile;
        app.activity = activity;
        app.pen = pen;
        app.rel = rel;
        app.skinner = skinner;
        app.services = services;
        app.lcs = lcs;
        app.history = history;
        //app startup
        app.layout.init();
        app.on(document, 'keypress', app.globkey);
        app.on(window, 'popstate', app.history.pop);
        app.login.init();
        //app.skinner.init();
        app.basicmod = basicmod;
    };


    //faulting in the ext login modules here saves total load time
    app.init1 = function (dom, json, on, request, 
                          query, cookie, domgeo) {
        app.dojo = { dom: dom, json: json, on: on, request: request,
                     query: query, cookie: cookie, domgeo: domgeo };
        if(app.redirectIfNeeded()) {
            return; }  //avoid app continue while redirect kicks in
        app.out('contentfill', "loading MyOpenReviews...");
        app.amdtimer.app = { start: new Date() };
        require(app.cdnconf,
                [ "amd/layout", "amd/login", "amd/review", "amd/profile",
                  "amd/activity", "amd/pen", "amd/rel", "amd/skinner",
                  "amd/services", "amd/lcs", "amd/history", "amd/basicmod", 
                  "ext/facebook", "ext/twitter", "ext/googleplus", 
                  "ext/github",
                  "dojo/domReady!" ],
                function (layout, login, review, profile, 
                          activity, pen, rel, skinner,
                          services, lcs, history, basicmod) {
                    app.amdtimer.app.end = new Date();
                    app.out('contentfill', " &nbsp; ");
                    app.init2(layout, login, review, profile, 
                              activity, pen, rel, skinner,
                              services, lcs, history, basicmod); }
               );
    };


    app.init = function () {
        var href = window.location.href;
        if(href.indexOf("http://www.wdydfun.com") >= 0) {
            app.mainsvr = "http://www.wdydfun.com"; }
        jtminjsDecorateWithUtilities(app);
        app.amdtimer = {};
        app.amdtimer.dojo = { start: new Date() };
        app.out('contentfill', "loading libraries...");
        require(app.cdnconf,
                [ "dojo/dom", "dojo/json", "dojo/on", "dojo/request",
                  "dojo/query", "dojo/cookie", "dojo/dom-geometry", 
                  "dojo/domReady!" ],
                function (dom, json, on, request, 
                          query, cookie, domgeo) {
                    app.amdtimer.dojo.end = new Date();
                    app.out('contentfill', " &nbsp; ");
                    app.init1(dom, json, on, request, 
                              query, cookie, domgeo); }
               );
    };


    app.crash = function (code, errtxt, method, url, data) {
        var html = "<div id=\"chead\"> </div><div id=\"cmain\">" + 
        "<p>The server crashed.</p>" +
        "<p>If you want to help out, copy the contents of this page and " +
        "post it to " +
        "<a href=\"https://github.com/theriex/myopenreviews/issues\" " +
        "onclick=\"window.open('https://github.com/theriex/myopenreviews/" +
        "issues');return false\">open issues</a>.  Otherwise reload the " +
        "page in your browser and see if it happens again...</p>" +
        "<ul>" +
        "<li>method: " + method +
        "<li>url: " + url +
        "<li>data: " + data +
        "<li>code: " + code +
        "</ul></div>" +
        errtxt;
        app.out('contentdiv', html);
    };


    app.failf = function (failfunc) {
        if(!failfunc) {
            failfunc = function (code, errtxt, method, url, data) {
                app.log(app.safestr(code) + " " + method + " " + url + 
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


    //factored method to create an image link.  Some older browsers put
    //borders around these...
    app.imglink = function (href, title, funcstr, imgfile, cssclass) {
        var html;
        if(!cssclass) {
            cssclass = "navico"; }
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        if(imgfile.indexOf("/") < 0) {
            imgfile = "img/" + imgfile; }
        html = "<a href=\"" + href + "\" title=\"" + title + "\"" +
                 " onclick=\"" + funcstr + "return false;\"" +
               "><img class=\"" + cssclass + "\" src=\"" + imgfile + "\"" +
                    " border=\"0\"/></a>";
        return html;
    };


    app.imgntxt = function (imgfile, text, funcstr, href, 
                            title, cssclass, idbase) {
        var html, tblid = "", imgtdid = "", imgid = "", txttdid = "";
        if(!cssclass) {
            cssclass = "navico"; }
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        if(imgfile && imgfile.indexOf("/") < 0) {
            imgfile = "img/" + imgfile; }
        if(title) {
            title = " title=\"" + title + "\""; }
        else {
            title = ""; }
        if(idbase) {
            tblid = " id=\"" + idbase + "table\"";
            imgtdid = " id=\"" + idbase + "imgtd\"";
            imgid = " id=\"" + idbase + "img\"";
            txttdid = " id=\"" + idbase + "txttd\""; }
        html = "<table" + tblid + " class=\"buttontable\" border=\"0\"" + 
                       title + " onclick=\"" + funcstr + "return false;\">" +
            "<tr>" +
              "<td" + imgtdid + ">" +
                "<img" + imgid + " class=\"" + cssclass + "\" src=\"" + 
                     imgfile + "\"" + " border=\"0\"/></td>" +
              "<td" + txttdid + " class=\"buttontabletexttd\">" +
                  text + "</td>" +
            "</tr></table>";
        return html;
    };


    app.checkrad = function (type, name, value, label, checked, chgfstr) {
        var html;
        if(!label) {
            label = value.capitalize(); }
        html = "<input type=\"" + type + "\" name=\"" + name + "\" value=\"" +
            value + "\" id=\"" + value + "\"";
        if(checked) {
            html += " checked=\"checked\""; }
        //the source element for the change event is unreliable if 
        //you click on a label, so not passing back any value.  
        //Change listener will need to check what is selected.
        if(chgfstr) {
            html += " onchange=\"" + chgfstr + "();return false;\""; }
        html += "/>" + "<label for=\"" + value + "\">" + label + "</label>";
        return html;
    };


    //factored method to create a checkbox with a label.
    app.checkbox = function (name, value, label) {
        return app.checkrad("checkbox", name, value, label);
    };


    app.radiobutton = function (name, value, label, checked, chgfstr) {
        return app.checkrad("radio", name, value, label, checked, chgfstr);
    };


    //Referencing variables starting with an underscore causes jslint
    //complaints, but it still seems the clearest and safest way to
    //handle an ID value in the server side Python JSON serialization.
    //This utility method encapsulates the access, and provides a
    //single point of adjustment if the server side logic changes.
    app.instId = function (obj) {
        var idfield = "_id";
        if(obj && obj.hasOwnProperty(idfield)) {
            return obj[idfield]; }
    };
    app.setInstId = function (obj, idval) {
        var idfield = "_id";
        obj[idfield] = idval;
    };
    app.isId = function (idval) {
        if(idval && typeof idval === 'string' && idval !== "0") {
            return true; }
        return false;
    };


    //Some things don't work in older browsers and need code workarounds
    //to degrade gracefully.  Like the background texture.
    app.isLowFuncBrowser = function () {
        var nav;
        if(navigator) {
            nav = navigator;
            // alert("appCodeName: " + nav.appCodeName + "\n" +
            //       "appName: " + nav.appName + "\n" +
            //       "appVersion: " + nav.appVersion + "\n" +
            //       "platform: " + nav.platform + "\n" +
            //       "userAgent: " + nav.userAgent + "\n");
            if(nav.appName === "Microsoft Internet Explorer") {
                return true; } }
        return false;
    };


} () );
