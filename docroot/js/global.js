/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false, FB: false, navigator: false, require: false, jtminjsDecorateWithUtilities: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var glo = {};  //Global container for application level funcs and values

////////////////////////////////////////
// g l o
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    glo.dojo = null;  //library modules holder
    glo.colors = { bodybg: "#fffff6",
                   text: "#111111",
                   link: "#3150b2",
                   hover: "#3399cc" };
    glo.winw = 0;  //adjusted in glo.layout
    glo.winh = 0;
    glo.introtext = "";
    glo.authcookname = "myopenreviewauth";
    glo.secsvr = "https://myopenreviews.appspot.com";
    glo.mainsvr = "http://www.myopenreviews.com";


    ////////////////////////////////////////
    // general utility functions
    ////////////////////////////////////////

    //library support for factored event connection methods
    glo.onxnode = function (ename, node, func) {
        glo.dojo.on(node, ename, func);
    };


    //library support for factored event connection methods
    glo.onx = function (ename, divid, func) {
        var node = glo.dojo.dom.byId(divid);
        glo.onxnode(ename, node, func);
    };


    //factored method to handle a click with no propagation
    glo.onclick = function (divid, func) {
        glo.onx("click", divid, function (e) {
            e.preventDefault();
            e.stopPropagation();
            func(e); });
    };


    //factored method to handle a change with no propagation
    glo.onchange = function (divid, func) {
        glo.onx("change", divid, function (e) {
            e.preventDefault();
            e.stopPropagation();
            func(e); });
    };


    //general key handling
    glo.onescapefunc = null;
    glo.globkey = function (e) {
        if(e && e.keyCode === 27) {  //ESC
            if(glo.onescapefunc) {
                e.preventDefault();
                e.stopPropagation();
                glo.onescapefunc(); } }
    };


    glo.cancelPicUpload = function () {
        glo.out('overlaydiv', "");
        glo.byId('overlaydiv').style.visibility = "hidden";
        glo.onescapefunc = null;
    };


    glo.redirectToSecureServer = function (params) {
        var href, state;
        state = {};
        if(history && history.state) {
            state = history.state; }
        href = glo.secsvr + "#returnto=" + glo.enc(glo.mainsvr) + 
            "&logout=true";
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        href += "&" + glo.objdata(params);
        glo.out('contentfill', "Redirecting to secure server...");
        window.location.href = href;
    };


    glo.redirectIfNeeded = function () {
        var href = window.location.href;
        if(href.indexOf(glo.mainsvr) >= 0 &&
           href.indexOf("authtoken=") < 0 &&
           href.indexOf("at=") < 0 &&
           href.indexOf("AltAuth") < 0 &&
           (!glo.dojo.cookie(glo.authcookname))) {
            glo.redirectToSecureServer(glo.parseParams());
            return true; }
    };


    //secondary initialization load since single monolithic is dog slow
    glo.init2 = function (layout, login, review, profile, 
                         activity, pen, rel, skinner,
                         services, lcs, history, basicmod) {
        var cdiv = glo.byId('contentdiv');
        if(!glo.introtext) {  //capture original so we can revert as needed
            glo.introtext = cdiv.innerHTML; }
        //app module references
        glo.layout = layout;
        glo.login = login;
        glo.review = review;
        glo.profile = profile;
        glo.activity = activity;
        glo.pen = pen;
        glo.rel = rel;
        glo.skinner = skinner;
        glo.services = services;
        glo.lcs = lcs;
        glo.history = history;
        //app startup
        glo.layout.init();
        glo.dojo.on(document, 'keypress', glo.globkey);
        glo.dojo.on(window, 'popstate', glo.history.pop);
        glo.login.init();
        //glo.skinner.init();
        glo.basicmod = basicmod;
    };


    //faulting in the ext login modules here saves total load time
    glo.init1 = function (dom, json, on, request, 
                          query, cookie, domgeo) {
        glo.dojo = { dom: dom, json: json, on: on, request: request,
                     query: query, cookie: cookie, domgeo: domgeo };
        if(glo.redirectIfNeeded()) {
            return; }  //avoid app continue while redirect kicks in
        glo.out('contentfill', "loading MyOpenReviews...");
        glo.amdtimer.app = { start: new Date() };
        require(glo.cdnconf,
                [ "amd/layout", "amd/login", "amd/review", "amd/profile",
                  "amd/activity", "amd/pen", "amd/rel", "amd/skinner",
                  "amd/services", "amd/lcs", "amd/history", "amd/basicmod", 
                  "ext/facebook", "ext/twitter", "ext/googleplus", 
                  "ext/github",
                  "dojo/domReady!" ],
                function (layout, login, review, profile, 
                          activity, pen, rel, skinner,
                          services, lcs, history, basicmod) {
                    glo.amdtimer.app.end = new Date();
                    glo.out('contentfill', " &nbsp; ");
                    glo.init2(layout, login, review, profile, 
                              activity, pen, rel, skinner,
                              services, lcs, history, basicmod); }
               );
    };


    glo.init = function () {
        var href = window.location.href;
        if(href.indexOf("http://www.wdydfun.com") >= 0) {
            glo.mainsvr = "http://www.wdydfun.com"; }
        jtminjsDecorateWithUtilities(glo);
        glo.amdtimer = {};
        glo.amdtimer.dojo = { start: new Date() };
        glo.out('contentfill', "loading libraries...");
        require(glo.cdnconf,
                [ "dojo/dom", "dojo/json", "dojo/on", "dojo/request",
                  "dojo/query", "dojo/cookie", "dojo/dom-geometry", 
                  "dojo/domReady!" ],
                function (dom, json, on, request, 
                          query, cookie, domgeo) {
                    glo.amdtimer.dojo.end = new Date();
                    glo.out('contentfill', " &nbsp; ");
                    glo.init1(dom, json, on, request, 
                              query, cookie, domgeo); }
               );
    };


    glo.crash = function (url, method, data, code, errtxt) {
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
        glo.out('contentdiv', html);
    };


    //General processing of JSON server calls, with fallback error
    //handling.  Caller caches and manages result data, including
    //recognizing stale.
    glo.call = function (url, method, data, success, failure, 
                         lockvar, setup, errs) {
        var statcode, errtxt, start, now, delayms = 300, temphtml;
        if(lockvar === "processing") {
            glo.log(method + " " + url + " already in progress...");
            return; }
        lockvar = "processing";
        if(setup) {
            setup(); }
        //local delay to simulate actual site
        if(window.location.href.indexOf("localhost:8080") >= 0) {
            temphtml = glo.byId('logodiv').innerHTML;
            now = start = new Date().getTime();
            while(now - start < delayms) {
                now = new Date().getTime();
                glo.out('logodiv', "delay " + (now - start)); }
            glo.out('logodiv', temphtml); }
        glo.dojo.request(url, { method: method, data: data }).then(
            //successful call result processing function
            function (resp) {
                lockvar = "success";
                try {
                    resp = glo.dojo.json.parse(resp);
                } catch (e) {
                    glo.log("JSON parse failure: " + e);
                    return failure(415, resp);
                }
                success(resp); },
            //failed call result processing function
            function (resp) {
                lockvar = "failure";
                if(!errs) {
                    errs = []; }
                if(!statcode) {
                    //there is supposed to always be a code, but if there
                    //isn't, then unauthorized is probably the best reset
                    statcode = 401; 
                    //recover the status (at least on IE8)
                    if(resp.response && resp.response.status) {
                        statcode = resp.response.status; } }
                if(errs.indexOf(statcode) < 0) {
                    switch(statcode) {
                    case 401: return glo.login.logout();
                    case 500: return glo.crash(url, method, data,
                                               statcode, errtxt);
                    } }
                failure(statcode, errtxt); },
            //interim progress status update function
            function (evt) {
                if(evt && evt.xhr) {
                    statcode = evt.xhr.status;
                    errtxt = evt.xhr.responseText; }
                });
    };


    //factored method to create an image link.  Some older browsers put
    //borders around these...
    glo.imglink = function (href, title, funcstr, imgfile, cssclass) {
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


    glo.imgntxt = function (imgfile, text, funcstr, href, 
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


    glo.checkrad = function (type, name, value, label, checked, chgfstr) {
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
    glo.checkbox = function (name, value, label) {
        return glo.checkrad("checkbox", name, value, label);
    };


    glo.radiobutton = function (name, value, label, checked, chgfstr) {
        return glo.checkrad("radio", name, value, label, checked, chgfstr);
    };


    //Referencing variables starting with an underscore causes jslint
    //complaints, but it still seems the clearest and safest way to
    //handle an ID value in the server side Python JSON serialization.
    //This utility method encapsulates the access, and provides a
    //single point of adjustment if the server side logic changes.
    glo.instId = function (obj) {
        var idfield = "_id";
        if(obj && obj.hasOwnProperty(idfield)) {
            return obj[idfield]; }
    };
    glo.setInstId = function (obj, idval) {
        var idfield = "_id";
        obj[idfield] = idval;
    };
    glo.isId = function (idval) {
        if(idval && typeof idval === 'string' && idval !== "0") {
            return true; }
        return false;
    };


    //Some things don't work in older browsers and need code workarounds
    //to degrade gracefully.  Like the background texture.
    glo.isLowFuncBrowser = function () {
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
