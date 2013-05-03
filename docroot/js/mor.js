/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, FB: false, navigator: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var mor = {};  //Top level function closure container

////////////////////////////////////////
// m o r   top level methods and variables
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    mor.dojo = null;  //library modules holder
    mor.colors = { bodybg: "#fffff6",
                   text: "#111111",
                   link: "#3150b2",
                   hover: "#3399cc" };
    mor.winw = 0;  //adjusted in mor.layout
    mor.winh = 0;
    mor.introtext = "";
    mor.authcookname = "myopenreviewsauth";
    mor.secsvr = "https://myopenreviews.appspot.com";
    mor.mainsvr = "http://www.myopenreviews.com";


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

    mor.historyTitle = function (state) {
        var title = document.title;
        return title;
    };


    mor.historyURL = function (state) {
        var url = window.location.href;
        return url;
    };


    //if the view or profid has changed, then push a history record.
    //if anything else has changed, replace the current history record.
    //otherwise no effect.
    mor.historyCheckpoint = function (pstate) {
        var hstate, title, url;
        if(history) {  //verify history object defined, otherwise skip
            hstate = history.state;
            if(!hstate || 
               hstate.view !== pstate.view || 
               hstate.profid !== pstate.profid) {
                if(history.pushState && 
                   typeof history.pushState === 'function') {
                    title = mor.historyTitle(pstate);
                    url = mor.historyURL(pstate);
                    history.pushState(pstate, title, url);
                    mor.log("history.pushState: " + 
                            mor.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = mor.historyTitle(pstate);
                    url = mor.historyURL(pstate);
                    history.replaceState(pstate, title, url);
                    mor.log("history.replaceState: " + 
                            mor.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    };


    mor.historyPop = function (event) {
        var state = event.state;
        mor.log("historyPop: " + mor.dojo.json.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(mor.isId(state.profid)) {
                    mor.profile.setTab(state.tab);
                    mor.profile.byprofid(state.profid); }
                break; 
            case "activity":
                mor.activity.display();
                break;
            } }
    };


    mor.currState = function () {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        return state;
    };


    //shorthand to log text to the console
    mor.log = function (text) {
        try {
            if(console && console.log) {
                console.log(text); }
        } catch(ignore) {  //most likely a bad IE console def, just skip it
        }
    };


    //factored method for error output.
    mor.err = function (text) {
        alert(text);
    };


    mor.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    mor.out = function (domid, html) {
        var node = mor.byId(domid);
        if(node) {
            node.innerHTML = html; }
        else {
            mor.log("DOM id " + domid + " not available for output"); }
    };


    //library support for factored event connection methods
    mor.onxnode = function (ename, node, func) {
        mor.dojo.on(node, ename, func);
    };


    //library support for factored event connection methods
    mor.onx = function (ename, divid, func) {
        var node = mor.dojo.dom.byId(divid);
        mor.onxnode(ename, node, func);
    };


    //factored method to handle a click with no propagation
    mor.onclick = function (divid, func) {
        mor.onx("click", divid, function (e) {
            e.preventDefault();
            e.stopPropagation();
            func(e); });
    };


    //factored method to handle a change with no propagation
    mor.onchange = function (divid, func) {
        mor.onx("change", divid, function (e) {
            e.preventDefault();
            e.stopPropagation();
            func(e); });
    };


    //general key handling
    mor.onescapefunc = null;
    mor.globkey = function (e) {
        if(e && e.keyCode === 27) {  //ESC
            if(mor.onescapefunc) {
                e.preventDefault();
                e.stopPropagation();
                mor.onescapefunc(); } }
    };


    mor.cancelPicUpload = function () {
        mor.out('overlaydiv', "");
        mor.byId('overlaydiv').style.visibility = "hidden";
        mor.onescapefunc = null;
    };


    mor.prefixed = function (string, prefix) {
        if(string && string.indexOf(prefix) === 0) {
            return true; }
        return false;
    };


    mor.ellipsis = function (string, length) {
        if(!string || typeof string !== "string") {
            return ""; }
        string = string.trim();
        if(string.length <= length) {
            return string; }
        string = string.slice(0, length - 3) + "...";
        return string;
    };


    mor.safestr = function (string) {
        if(!string) {
            return ""; }
        return String(string);
    };


    mor.parseParams = function () {
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


    mor.redirectToSecureServer = function (params) {
        var href, state;
        state = mor.currState();
        href = mor.secsvr + "#returnto=" + mor.enc(mor.mainsvr) + 
            "&logout=true";
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        href += "&" + mor.objdata(params);
        mor.out('contentfill', "Redirecting to secure server...");
        window.location.href = href;
    };


    mor.redirectIfNeeded = function () {
        var href = window.location.href;
        if(href.indexOf("http://www.myopenreviews.com") >= 0 &&
           href.indexOf("authtoken=") < 0 &&
           href.indexOf("at=") < 0 &&
           href.indexOf("AltAuth") < 0 &&
           (!mor.dojo.cookie(mor.authcookname))) {
            mor.redirectToSecureServer(mor.parseParams());
            return true; }
    };


    //secondary initialization load since single monolithic is dog slow
    mor.init2 = function (layout, login, review, profile, 
                         activity, pen, rel, skinner,
                         services, basicmod) {
        var cdiv = mor.byId('contentdiv');
        if(!mor.introtext) {  //capture original so we can revert as needed
            mor.introtext = cdiv.innerHTML; }
        //app module references
        mor.layout = layout;
        mor.login = login;
        mor.review = review;
        mor.profile = profile;
        mor.activity = activity;
        mor.pen = pen;
        mor.rel = rel;
        mor.skinner = skinner;
        mor.services = services;
        //app startup
        mor.layout.init();
        mor.dojo.on(document, 'keypress', mor.globkey);
        mor.dojo.on(window, 'popstate', mor.historyPop);
        mor.login.init();
        //mor.skinner.init();
        mor.basicmod = basicmod;
    };


    //faulting in the ext login modules here saves total load time
    mor.init1 = function (dom, json, on, request, 
                          query, cookie, domgeo) {
        mor.dojo = { dom: dom, json: json, on: on, request: request,
                     query: query, cookie: cookie, domgeo: domgeo };
        if(mor.redirectIfNeeded()) {
            return; }  //avoid app continue while redirect kicks in
        mor.out('contentfill', "loading MyOpenReviews...");
        mor.amdtimer.mor = { start: new Date() };
        require(mor.cdnconf,
                [ "amd/layout", "amd/login", "amd/review", "amd/profile",
                  "amd/activity", "amd/pen", "amd/rel", "amd/skinner",
                  "amd/services", "amd/basicmod", 
                  "ext/facebook", "ext/twitter", "ext/googleplus", 
                  "ext/github",
                  "dojo/domReady!" ],
                function (layout, login, review, profile, 
                          activity, pen, rel, skinner,
                          services, basicmod) {
                    mor.amdtimer.mor.end = new Date();
                    mor.out('contentfill', " &nbsp; ");
                    mor.init2(layout, login, review, profile, 
                              activity, pen, rel, skinner,
                              services, basicmod); }
               );
    };


    mor.init = function () {
        mor.amdtimer = {};
        mor.amdtimer.dojo = { start: new Date() };
        mor.out('contentfill', "loading libraries...");
        require(mor.cdnconf,
                [ "dojo/dom", "dojo/json", "dojo/on", "dojo/request",
                  "dojo/query", "dojo/cookie", "dojo/dom-geometry", 
                  "dojo/domReady!" ],
                function (dom, json, on, request, 
                          query, cookie, domgeo) {
                    mor.amdtimer.dojo.end = new Date();
                    mor.out('contentfill', " &nbsp; ");
                    mor.init1(dom, json, on, request, 
                              query, cookie, domgeo); }
               );
    };


    //shorthand to save typing and improve readability
    mor.enc = function (val) {
        val = val || "";
        if(typeof val === "string") {
            val = val.trim(); }
        return encodeURIComponent(val);
    };
    mor.dec = function (val) {
        val = val || "";
        if(typeof val === "string") {
            val = val.trim(); }
        try {
            val = decodeURIComponent(val);
        } catch (e) {
            mor.log("decodeURIComponent failure: " + e);
        }
        return val;
    };
    //if a string needs to be URL encoded and then stuffed inside of
    //single quotes, then you need to replace any embedded single
    //quotes to avoid terminating the string early.
    mor.embenc = function (val) {
        val = mor.enc(val);
        val = val.replace(/'/g,"%27");
        return val;
    };
    mor.dquotenc = function (val) {
        val = val.replace(/"/g,"&quot;");
        val = mor.enc(val);
        return val;
    };

    //if making an html attribute value by escaping double quotes,
    //then get rid of any double quotes in the contained value
    mor.ndq = function (val) {
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    //return true if the given text can be reasonably construed to be an
    //email address.
    mor.isProbablyEmail = function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
    };


    mor.crash = function (url, method, data, code, errtxt) {
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
        mor.out('contentdiv', html);
    };


    //factored method to deal with JSON parsing in success call.
    //ATTENTION Might be good to note if the last call was over a N
    //hours ago and just reload everything in that case.  Stale local
    //data sucks.
    mor.call = function (url, method, data, success, failure, errs) {
        var statcode, errtxt, start, now, delayms = 1200, temphtml;
        if(window.location.href.indexOf("localhost:8080") >= 0) {
            temphtml = mor.byId('logodiv').innerHTML;
            now = start = new Date().getTime();
            while(now - start < delayms) {
                now = new Date().getTime();
                mor.out('logodiv', "delay " + (now - start)); }
            mor.out('logodiv', temphtml); }
        mor.dojo.request(url, { method: method, data: data }).then(
            //successful call result processing function
            function (resp) {
                try {
                    resp = mor.dojo.json.parse(resp);
                } catch (e) {
                    mor.log("JSON parse failure: " + e);
                    return failure(415, resp);
                }
                success(resp); },
            //failed call result processing function
            function (resp) {
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
                    case 401: return mor.login.logout();
                    case 500: return mor.crash(url, method, data,
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
    mor.objdata = function (obj, skips) {
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
                    str += name + "=" + mor.enc(obj[name]); } } }
        return str;
    };


    //factored method to create an image link.  Some older browsers put
    //borders around these...
    mor.imglink = function (href, title, funcstr, imgfile, cssclass) {
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


    mor.imgntxt = function (imgfile, text, funcstr, href, title, cssclass) {
        var html;
        if(!cssclass) {
            cssclass = "navico"; }
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        if(imgfile.indexOf("/") < 0) {
            imgfile = "img/" + imgfile; }
        if(title) {
            title = "title=\"" + title + "\""; }
        else {
            title = ""; }
        html = "<table class=\"buttontable\" border=\"0\"" + 
                     " onclick=\"" + funcstr + "return false;\">" +
            "<tr>" +
              "<td>" +
                "<img class=\"" + cssclass + "\" src=\"" + imgfile + "\"" +
                    " border=\"0\"/></td>" +
              "<td class=\"buttontabletexttd\">" +
                  text + "</td>" +
            "</tr></table>";
        return html;
    };


    mor.checkrad = function (type, name, value, label, checked, chgfstr) {
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
    mor.checkbox = function (name, value, label) {
        return mor.checkrad("checkbox", name, value, label);
    };


    mor.radiobutton = function (name, value, label) {
        return mor.checkrad("radio", name, value, label);
    };


    //Referencing variables starting with an underscore causes jslint
    //complaints, but it still seems the clearest and safest way to
    //handle an ID value in the server side Python JSON serialization.
    //This utility method encapsulates the access, and provides a
    //single point of adjustment if the server side logic changes.
    mor.instId = function (obj) {
        var idfield = "_id";
        if(obj && obj.hasOwnProperty(idfield)) {
            return obj[idfield]; }
    };
    mor.setInstId = function (obj, idval) {
        var idfield = "_id";
        obj[idfield] = idval;
    };
    mor.isId = function (idval) {
        if(idval && typeof idval === 'string' && idval !== "0") {
            return true; }
        return false;
    };


    mor.makelink = function (url) {
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
    mor.linkify = function (txt) {
        if(!txt) {
            return ""; }
        txt = txt.replace(/https?:\S+/g, function(url) {
            return mor.makelink(url); });
        txt = txt.replace(/\n/g, "<br/>");
        return txt;
    };


    //Server creates a canonical key for a review if not sent.
    mor.canonize = function (txt) {
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


    mor.paramsToFormInputs = function (paramstr) {
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


    mor.paramsToObj = function (paramstr) {
        var comps, i, attval, obj = {}, idx = paramstr.indexOf("?");
        if(idx >= 0) {
            paramstr = paramstr.slice(idx + 1); }
        comps = paramstr.split("&");
        for(i = 0; i < comps.length; i += 1) {
            attval = comps[i].split("=");
            obj[attval[0]] = attval[1]; }
        return obj;
    };


    //Some things don't work in older browsers and need code workaround
    //to degrade gracefully.
    mor.isLowFuncBrowser = function () {
        if(navigator && 
           navigator.appName === "Microsoft Internet Explorer") {
            return true; }
        return false;
    };


} () );
