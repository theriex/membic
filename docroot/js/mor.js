/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, FB: false */

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
                if(state.profid > 0) {
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
        } catch(problem) {  //most likely a bad IE console def, just skip it
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


    //top level kickoff function called from index.html
    mor.init = function (dom, json, on, request, 
                         query, cookie, dijitreg, 
                         slider, 
                         layout, login, review, profile, 
                         activity, pen, rel, skinner,
                         services, basicmod) {
        var cdiv = mor.byId('contentdiv');
        if(!mor.introtext) {  //capture original so we can revert as needed
            mor.introtext = cdiv.innerHTML; }
        mor.dojo = { dom: dom, json: json, on: on, ajax: request,
                     query: query, cookie: cookie, dijitreg: dijitreg, 
                     slider: slider };
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


    //shorthand to save typing and improve readability
    mor.enc = function (val) {
        val = val || "";
        if(typeof val === "string") {
            val = val.trim(); }
        return encodeURIComponent(val);
    };


    //return true if the given text can be reasonably construed to be an
    //email address.
    mor.isProbablyEmail = function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
    };


    mor.crash = function (url, method, data, code, errtxt) {
        var html = "<p>The server crashed.</p>" +
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
        "</ul>" +
        errtxt;
        mor.out('contentdiv', html);
    };


    //factored method to deal with JSON parsing in success call.
    //ATTENTION Might be good to note if the last call was over a N
    //hours ago and just reload everything in that case.  Stale local
    //data sucks.
    mor.call = function (url, method, data, success, failure, errs) {
        var statcode, errtxt;
        mor.dojo.ajax(url, { method: method, data: data }).then(
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
    mor.objdata = function (obj) {
        var str = "", name;
        if(!obj) {
            return ""; }
        for(name in obj) {
            if(obj.hasOwnProperty(name)) {
                if(str) {
                    str += "&"; }
                str += name + "=" + mor.enc(obj[name]); } }
        return str;
    };


    //factored method to create an image link.  Some older browsers put
    //borders around these...
    mor.imglink = function (href, title, funcstr, imgfile) {
        var html;
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        if(imgfile.indexOf("/") < 0) {
            imgfile = "img/" + imgfile; }
        html = "<a href=\"" + href + "\" title=\"" + title + "\"" +
                 " onclick=\"" + funcstr + "return false;\"" +
               "><img class=\"navico\" src=\"" + imgfile + "\"" +
                    " border=\"0\"/></a>";
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
        //you click on a label so not passing back any value.  
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


} () );
