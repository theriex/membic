/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false, FB: false, navigator: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var glo = {};  //Global container for top level funcs and values

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
    //prototype mods and global overrides
    /////////////////////////////////////////

    if(!String.prototype.trim) {  //thanks to Douglas Crockford
        String.prototype.trim = function () {
            return this.replace(/^\s*(\S*(?:\s+\S+)*)\s*$/, "$1");
        };
    }


    if(!String.prototype.capitalize) { 
        String.prototype.capitalize = function () {
            return this.charAt(0).toUpperCase() + this.slice(1);
        };
    }


    if(!Array.prototype.indexOf) { 
        Array.prototype.indexOf = function (searchElement) {
            var i;
            if(this === null) {
                throw new TypeError(); }
            for(i = 0; i < this.length; i += 1) {
                if(this[i] === searchElement) {
                    return i; } }
            return -1;
        };
    }


    if(!Array.prototype.shuffle) {
        Array.prototype.shuffle = function () {
            var i, j, tmp;
            for(i = this.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                tmp = this[i];
                this[i] = this[j];
                this[j] = tmp; }
            return this;
        };
    }


    if(!Date.prototype.toISOString) {
        Date.prototype.toISOString = function() {
            function pad(n) { return n < 10 ? '0' + n : n; }
            return this.getUTCFullYear() + '-'
                + pad(this.getUTCMonth() + 1) + '-'
                + pad(this.getUTCDate()) + 'T'
                + pad(this.getUTCHours()) + ':'
                + pad(this.getUTCMinutes()) + ':'
                + pad(this.getUTCSeconds()) + 'Z';
        };
    }


    ////////////////////////////////////////
    // general utility functions
    ////////////////////////////////////////

    glo.historyTitle = function (state) {
        var title = document.title;
        return title;
    };


    glo.historyURL = function (state) {
        var url = window.location.href;
        return url;
    };


    //if the view or profid has changed, then push a history record.
    //if anything else has changed, replace the current history record.
    //otherwise no effect.
    glo.historyCheckpoint = function (pstate) {
        var hstate, title, url;
        if(history) {  //verify history object defined, otherwise skip
            hstate = history.state;
            if(!hstate 
               || hstate.view !== pstate.view 
               || hstate.profid !== pstate.profid
               || hstate.revid !== pstate.revid) {
                if(history.pushState && 
                   typeof history.pushState === 'function') {
                    title = glo.historyTitle(pstate);
                    url = glo.historyURL(pstate);
                    history.pushState(pstate, title, url);
                    glo.log("history.pushState: " + 
                            glo.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = glo.historyTitle(pstate);
                    url = glo.historyURL(pstate);
                    history.replaceState(pstate, title, url);
                    glo.log("history.replaceState: " + 
                            glo.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    };


    glo.historyPop = function (event) {
        var state = event.state;
        glo.log("historyPop: " + glo.dojo.json.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(glo.isId(state.profid)) {
                    glo.profile.byprofid(state.profid, state.tab); }
                break; 
            case "activity":
                glo.activity.displayActive();
                break;
            case "memo":
                glo.activity.displayRemembered();
                break;
            case "review":
                //the review was cached when previously viewed..
                glo.review.setCurrentReview(
                    glo.lcs.getRevRef(state.revid).rev);
                glo.review.displayRead();
                break;
            } }
    };


    glo.currState = function () {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        return state;
    };


    //shorthand to log text to the console
    glo.log = function (text) {
        try {
            if(console && console.log) {
                console.log(text); }
        } catch(ignore) {  //most likely a bad IE console def, just skip it
        }
    };


    //factored method for error output.
    glo.err = function (text) {
        alert(text);
    };


    glo.assert = function (testval) {
        if(!testval) {
            glo.err("An application integrity check has failed. Please reload the page in your browser.");
            throw("glo.assert"); }
    };


    glo.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    glo.out = function (domid, html) {
        var node = glo.byId(domid);
        if(node) {
            node.innerHTML = html; }
        else {
            glo.log("DOM id " + domid + " not available for output"); }
    };


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


    glo.prefixed = function (string, prefix) {
        if(string && string.indexOf(prefix) === 0) {
            return true; }
        return false;
    };


    glo.ellipsis = function (string, length) {
        if(!string || typeof string !== "string") {
            return ""; }
        string = string.trim();
        if(string.length <= length) {
            return string; }
        string = string.slice(0, length - 3) + "...";
        return string;
    };


    glo.safestr = function (string) {
        if(!string) {
            return ""; }
        return String(string);
    };


    glo.safeget = function (domid, field) {
        var elem = glo.byId(domid);
        if(elem) {
            return elem[field]; }
    };


    glo.parseParams = function () {
        var pstr = window.location.hash, params = {}, avs, av, i;
        if(pstr) {  //parse the hash params
            if(pstr.indexOf("#") === 0) {
                pstr = pstr.slice(1); }
            avs = pstr.split('&');
            for(i = 0; i < avs.length; i += 1) {
                av = avs[i].split('=');
                if(av.length > 1) {
                    params[av[0]] = av[1]; }
                else {
                    params.anchor = av[0]; } } }
        pstr = window.location.search;
        if(pstr) {
            if(pstr.indexOf("?") === 0) {
                pstr = pstr.slice(1); }
            avs = pstr.split('&');
            for(i = 0; i < avs.length; i += 1) {
                av = avs[i].split('=');
                params[av[0]] = av[1]; } }
        return params;
    };


    glo.redirectToSecureServer = function (params) {
        var href, state;
        state = glo.currState();
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
        if(href.indexOf("http://www.myopenreviews.com") >= 0 &&
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
                         services, lcs, basicmod) {
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
        //app startup
        glo.layout.init();
        glo.dojo.on(document, 'keypress', glo.globkey);
        glo.dojo.on(window, 'popstate', glo.historyPop);
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
                  "amd/services", "amd/lcs", "amd/basicmod", 
                  "ext/facebook", "ext/twitter", "ext/googleplus", 
                  "ext/github",
                  "dojo/domReady!" ],
                function (layout, login, review, profile, 
                          activity, pen, rel, skinner,
                          services, lcs, basicmod) {
                    glo.amdtimer.app.end = new Date();
                    glo.out('contentfill', " &nbsp; ");
                    glo.init2(layout, login, review, profile, 
                              activity, pen, rel, skinner,
                              services, lcs, basicmod); }
               );
    };


    glo.init = function () {
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


    //shorthand to save typing and improve readability
    glo.enc = function (val) {
        val = val || "";
        if(typeof val === "string") {
            val = val.trim(); }
        return encodeURIComponent(val);
    };
    glo.dec = function (val) {
        val = val || "";
        if(typeof val === "string") {
            val = val.trim(); }
        try {
            val = decodeURIComponent(val);
        } catch (e) {
            glo.log("decodeURIComponent failure: " + e);
        }
        return val;
    };
    //if a string needs to be URL encoded and then stuffed inside of
    //single quotes, then you need to replace any embedded single
    //quotes to avoid terminating the string early.
    glo.embenc = function (val) {
        val = glo.enc(val);
        val = val.replace(/'/g,"%27");
        return val;
    };
    glo.dquotenc = function (val) {
        val = val.replace(/"/g,"&quot;");
        val = glo.enc(val);
        return val;
    };

    //if making an html attribute value by escaping double quotes,
    //then get rid of any double quotes in the contained value
    glo.ndq = function (val) {
        if(!val) {
            return ""; }
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    //return true if the given text can be reasonably construed to be an
    //email address.
    glo.isProbablyEmail = function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
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


    //return the given object field and values as html POST data
    glo.objdata = function (obj, skips) {
        var str = "", name;
        if(!obj) {
            return ""; }
        if(!skips) {
            skips = []; }
        for(name in obj) {
            if(obj.hasOwnProperty(name)) {
                if(skips.indexOf(name) < 0) {
                    if(str) {
                        str += "&"; }
                    str += name + "=" + glo.enc(obj[name]); } } }
        return str;
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


    glo.makelink = function (url) {
        var html, suffix = "";
        if(!url) {
            return ""; }
        //strip any common trailing punctuation on the url if found
        if(/[\.\,\)]$/.test(url)) {
            suffix = url.slice(-1);
            url = url.slice(0, -1); }
        html = "<a href=\"" + url + "\" onclick=\"window.open('" + url +
            "');return false;\">" + url + "</a>" + suffix;
        return html;
    };


    //Make the text into display html.  Newlines become <br/>s and
    //urls become hrefs that open in a new window/tab.  Trying to
    //avoid complex regex since those are annoying to maintain.  Ok
    //with not automatically picking up on things that don't start
    //with "http".  Links other than web not desired.
    glo.linkify = function (txt) {
        if(!txt) {
            return ""; }
        txt = txt.replace(/https?:\S+/g, function(url) {
            return glo.makelink(url); });
        txt = txt.replace(/\n/g, "<br/>");
        return txt;
    };


    //Server creates a canonical key for a review if not sent.
    glo.canonize = function (txt) {
        var strval = txt || "";
        strval = strval.replace(/\s/g, "");
        strval = strval.replace(/\'/g, "");
        strval = strval.replace(/\"/g, "");
        strval = strval.replace(/\,/g, "");
        strval = strval.replace(/\./g, "");
        strval = strval.replace(/\!/g, "");
        strval = strval.toLowerCase();
        return strval;
    };


    glo.paramsToFormInputs = function (paramstr) {
        var html = "", fields, i, attval;
        if(!paramstr) {
            return ""; }
        fields = paramstr.split("&");
        for(i = 0; i < fields.length; i += 1) {
            attval = fields[i].split("=");
            html += "<input type=\"hidden\" name=\"" + attval[0] + "\"" +
                                          " value=\"" + attval[1] + "\"/>"; }
        return html;
    };


    glo.paramsToObj = function (paramstr) {
        var comps, i, attval, obj = {}, idx = paramstr.indexOf("?");
        if(idx >= 0) {
            paramstr = paramstr.slice(idx + 1); }
        comps = paramstr.split("&");
        for(i = 0; i < comps.length; i += 1) {
            attval = comps[i].split("=");
            obj[attval[0]] = attval[1]; }
        return obj;
    };


    glo.ISOString2Day = function (str) {
        var date, year, month, day;
        if(!str) {
            return new Date(); }
        year = parseInt(str.slice(0, 4), 10);
        month = parseInt(str.slice(5, 7), 10);
        day = parseInt(str.slice(8, 10), 10);
        date = new Date(year, month, day, 0, 0, 0, 0);
        return date;
    };


    glo.colloquialDate = function (date) {
        var days = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday',
                     'Thursday', 'Friday', 'Saturday', 'Sunday' ],
            months = [ "January", "February", "March", "April", "May", 
                       "June", "July", "August", "September", "October", 
                       "November", "December" ];
        return String(days[date.getUTCDay()]) + 
            ", " + String(months[date.getMonth()]) +
            " " + String(date.getUTCDate());
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
