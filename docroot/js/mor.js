/*global alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

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

    mor.sessiontoken = "";
    mor.sesscook = "morsession=";
    mor.dojo = null;  //library module holder
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
                mor.profile.setTab(state.tab);
                mor.profile.byprofid(state.profid);
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
        mor.dojo.on(node, ename, function (e) {
            e.preventDefault();
            e.stopPropagation();
            func(); });
    };


    //library support for factored event connection methods
    mor.onx = function (ename, divid, func) {
        var node = mor.dojo.dom.byId(divid);
        mor.onxnode(ename, node, func);
    };


    //factored method to handle a click with no propagation
    mor.onclick = function (divid, func) {
        mor.onx("click", divid, func);
    };


    //factored method to handle a change with no propagation
    mor.onchange = function (divid, func) {
        mor.onx("change", divid, func);
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
    },


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
    mor.init = function (dom, json, on, request, query, cookie, 
                         dijitreg, slider) {
        var cdiv = mor.byId('contentdiv');
        if(!mor.introtext) {  //capture original so we can revert as needed
            mor.introtext = cdiv.innerHTML; }
        mor.dojo = { dom: dom, json: json, on: on, ajax: request,
                     query: query, cookie: cookie, dijitreg: dijitreg, 
                     slider: slider };
        mor.layout.init();
        mor.dojo.on(document, 'keypress', mor.globkey);
        mor.dojo.on(window, 'popstate', mor.historyPop);
        mor.login.init();
        //mor.skinner.init();
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


    mor.checkrad = function (type, name, value, label) {
        var html;
        if(!label) {
            label = value.capitalize(); }
        html = "<input type=\"" + type + "\" name=\"" + name + "\" value=\"" +
            value + "\" id=\"" + value + "\"/>" + 
            "<label for=\"" + value + "\">" + label + "</label>";
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


    mor.authorized = function (pen) {
        if(pen && (pen.mid > 0 ||
                   pen.gid > 0 ||
                   pen.fbid > 0 ||
                   pen.twid > 0)) {
            return true; }
        return false;
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



////////////////////////////////////////
// m o r . l a y o u t
//
(function () {
    "use strict";

    var


    closeDialog = function () {
        mor.out('dlgdiv', "");
        mor.byId('dlgdiv').style.visibility = "hidden";
        mor.layout.adjust();
        mor.onescapefunc = null;
    },


    displayDocContent = function (url, html) {
        var bodyidx;
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        bodyidx = html.indexOf("<body>");
        if(bodyidx > 0) {
            html = html.slice(bodyidx + "<body>".length,
                              html.indexOf("</body")); }
        html = "<div id=\"closeline\">" +
          "<a id=\"closedlg\" href=\"#close\"" +
            " onclick=\"mor.layout.closeDialog();return false\">" + 
                 "&lt;close&nbsp;&nbsp;X&gt;</a>" +
          "</div>" + html;
        mor.out('dlgdiv', html);
        mor.onescapefunc = closeDialog;
    },


    //relative paths don't work when you are running file://...
    relativeToAbsolute = function (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    },


    displayDoc = function (url) {
        var html = "Fetching " + url + " ...";
        mor.out('dlgdiv', html);
        mor.byId('dlgdiv').style.visibility = "visible";
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        mor.call(url, 'GET', null,
                 function (resp) {
                     displayDocContent(url, resp); },
                 function (code, errtxt) {
                     displayDocContent(url, errtxt); });
    },


    attachDocLinkClick = function (node, link) {
        mor.onxnode("click", node, function (e) {
            displayDoc(link); });
    },


    localDocLinks = function () {
        var i, nodes = mor.dojo.query('a'), node, href;
        for(i = 0; nodes && i < nodes.length; i += 1) {
            node = nodes[i];
            href = node.href;
            //href may have been resolved from relative to absolute...
            if(href && href.indexOf("docs/") >= 0) {
                attachDocLinkClick(node, href); } }
    },


    //initialize the standard content display div areas.
    initContent = function () {
        var html, div;
        div = mor.byId('chead');
        if(!div) {
            html = "<div id=\"chead\">" +
              "<span id=\"penhnamespan\"> </span>" +
              "<span id=\"penhbuttonspan\"> </span>" +
              "<div id=\"acthdiv\"> </div>" +
              "<div id=\"revhdiv\"> </div>" +
            "</div>" +
            "<div id=\"cmain\"> </div>";
            mor.out('contentdiv', html);
            mor.profile.updateHeading();
            mor.activity.updateHeading();
            mor.review.updateHeading(); }
    },


    fullContentHeight = function () {
        var ch, filldiv, topdiv, chdiv, target;
        if(window.innerWidth && window.innerHeight) {
            mor.winw = window.innerWidth;
            mor.winh = window.innerHeight; }
        else if(document.compatMode === 'CSS1Compat' &&
                document.documentElement && 
                document.documentElement.offsetWidth) {
            mor.winw = document.documentElement.offsetWidth;
            mor.winh = document.documentElement.offsetHeight; }
        else if(document.body && document.body.offsetWidth) {
            mor.winw = document.body.offsetWidth;
            mor.winh = document.body.offsetHeight; }
        else {  //WTF, just guess.
            mor.winw = 240;
            mor.winh = 320; }
        filldiv = mor.byId("contentfill");
        ch = mor.byId("contentdiv").offsetHeight;
        target = mor.winh - 100;  //top padding and scroll
        if(ch < target) {
            filldiv.style.height = (target - ch) + "px"; }
        else {  //not filling, just leave a little separator space
            filldiv.style.height = "16px"; }
        topdiv = mor.byId("topdiv");
        target = mor.winw - 50;  //element width padding
        topdiv.style.width = target + "px";
        chdiv = mor.byId("chead");
        target = mor.winw - 120;  //Remo is 72px, 20px padding
        if(chdiv) {
            chdiv.style.width = target + "px"; }
    };


    mor.layout = {
        init: function () {
            mor.dojo.on(window, 'resize', fullContentHeight);
            localDocLinks();
            fullContentHeight(); },
        initContent: function () {
            initContent(); },
        adjust: function () {
            fullContentHeight(); },
        displayDoc: function (url) {
            displayDoc(url); },
        closeDialog: function () {
            closeDialog(); }
    };

} () );


////////////////////////////////////////
// m o r . l o g i n
//
(function () {
    "use strict";

    var loginprompt = "Please log in",
        authmethod = "",
        authtoken = "",
        authname = "",
        cookname = "myopenreviewsauth",
        cookdelim = "..morauth..",
        changepwdprompt = "Changing your login password",
        secsvr = "https://myopenreviews.appspot.com",
        mainsvr = "http://www.myopenreviews.com",


    secureURL = function (endpoint) {
        var url = window.location.href;
        if(url.indexOf("http://localhost:8080") === 0 ||   //local dev or
           url.indexOf("https://") === 0) {                //secure server
            url = endpoint; }  //relative path url ok, data is encrypted
        else {  //not secured, try via XDR although it may not work
            url = "https://myopenreviews.appspot.com/" + endpoint; }
        return url;
    },


    authparams = function () {
        var params = "am=" + authmethod + "&at=" + authtoken + 
                     "&an=" + mor.enc(authname);
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authmethod=" + authmethod + 
                     "&authtoken=" + authtoken + 
                     "&authname=" + mor.enc(authname);
        return params;
    },


    logout = function () {
        //remove the cookie
        mor.dojo.cookie(cookname, "", { expires: 0 });
        authmethod = "";
        authtoken = "";
        authname = "";
        mor.login.updateAuthentDisplay();
        mor.login.init();
    },


    findReturnToInHash = function () {
        var hash = window.location.hash, params, av, i, attr, val;
        if(hash) {
            if(hash.indexOf("#") === 0) {
                hash = hash.slice(1); }
            params = hash.split('&');
            for(i = 0; i < params.length; i += 1) {
                av = params[i].split('=');
                attr = av[0].toLowerCase();
                val = decodeURIComponent(av[1]);
                if(attr === "returnto") {
                    return val; } } }
    },


    clearHash = function () {
        var url = window.location.pathname + window.location.search;
        //note this is using the standard html5 history directly.  That's
        //a way to to clear the URL noise without a redirect triggering
        //a page refresh. 
        if(history && history.pushState && 
                      typeof history.pushState === 'function') {
            history.pushState("", document.title, url); }
    },


    doneWorkingWithAccount = function () {
        var tag, state, redirect = findReturnToInHash();
        if(redirect) {
            redirect += "#" + authparamsfull();
            window.location.href = redirect; }
        //no explicit redirect so check if directed by tag
        tag = window.location.hash;
        if(tag.indexOf("#") === 0) {
            tag = tag.slice(1); }
        if(tag === "profile") {
            clearHash();
            return mor.profile.display(); }
        //no tag redirect so check current state
        state = mor.currState();
        if(state) {
            if(state.view === "profile") {
                if(state.profid) {
                    return mor.profile.initWithId(state.profid); }
                return mor.profile.display(); }
            if(state.view === "activity") {
                return mor.activity.display(); }
            if(state.view === "review" && state.revid) {
                mor.review.initWithId(state.revid, state.mode); } }
        //do default display
        //ATTENTION this should be going to mor.activity.display() but
        //currently testing profile so making that the default.
        mor.profile.display();
    },


    //On FF14 with noscript installed the cookie gets written as a
    //session cookie regardless of the expiration set here.  Same
    //result using Cookie.set, or just setting document.cookie
    //directly.  On FF14 without noscript, this works.  Just something
    //to be aware of...
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        mor.dojo.cookie(cookname, cval, { expires: 60*60*24*365 });
        authmethod = method;
        authtoken = token;
        authname = name;
        mor.login.updateAuthentDisplay();
    },


    readAuthCookie = function () {
        var cval, mtn;
        cval = mor.dojo.cookie(cookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2]; }
        mor.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    readURLHash = function () {
        var hash = window.location.hash, params, av, i, attr, val,
            token, method, name, returi, command, view, profid, 
            revedit, retval;
        if(hash) {
            if(hash.indexOf("#") === 0) {
                hash = hash.slice(1); }
            params = hash.split('&');
            for(i = 0; i < params.length; i += 1) {
                av = params[i].split('=');
                attr = av[0].toLowerCase();
                val = decodeURIComponent(av[1]);
                switch(attr) {
                case "authtoken":
                case "at":  //lost encoding reading it out of URL, replace
                    token = mor.enc(val); break;
                case "authmethod":
                case "am":
                    method = val; break;
                case "authname":
                case "an":
                    name = val; break; 
                case "returnto":
                    returi = val; break;
                case "command":
                    command = val; break;
                case "view":
                    view = val; break;
                case "profid":
                    profid = parseInt(val, 10); break;
                case "revedit":
                    revedit = parseInt(val, 10); break;
                } }  //end hash walk
            if(method && token && name) {
                setAuthentication(method, token, name);
                retval = command || "done"; }
            if(!returi) {  //back home so clean up the location bar
                clearHash(); }
            if(view && profid) {
                mor.historyCheckpoint({ view: view, profid: profid }); }
            if(revedit) {
                mor.historyCheckpoint({ view: "review", mode: "edit", 
                                        revid: revedit }); } }
        return retval;
    },


    changePassword = function () {
        var pwd = mor.byId('npin').value, data, url;
        if(!pwd || !pwd.trim()) {
            changepwdprompt = "New password must have a value";
            return mor.login.displayChangePassForm(); }
        url = secureURL("chgpwd");
        data = "pass=" + mor.enc(pwd) + "&" + mor.login.authparams();
        mor.call(url, 'POST', data,
                 function (objs) {
                     setAuthentication("mid", objs[0].token, authname);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     changepwdprompt = errtxt;
                     mor.login.displayChangePassForm(); });
    },


    displayChangePassForm = function () {
        var html = "";
        if(secureURL("chgpwd") !== "chgpwd") {
            window.location.href = secsvr + "#returnto=" + mor.enc(mainsvr) +
                "&command=chgpwd&" + authparams(); }
        html += "<p>&nbsp;</p>" +  //make sure we are not too tight to top
        "<div id=\"chpstatdiv\">" + changepwdprompt + "</div>" +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">new password</td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" id=\"npin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"changebutton\">Change</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('contentdiv', html);
        mor.onclick('cancelbutton', doneWorkingWithAccount);
        mor.onclick('changebutton', changePassword);
        mor.onchange('npin', changePassword);
        mor.layout.adjust();
        mor.byId('npin').focus();
    },


    updateAuthentDisplay = function () {
        var html = "";
        mor.out('topdiv', html);
        if(authtoken) {
            //html += "Logged in ";
            //add "via facebook" or whoever based on authmethod
            //html += "as ";
            html += "<em>" + authname + "</em>";
            html += " &nbsp; <a id=\"logout\" href=\"logout\">logout</a>";
            if(authmethod === "mid") {
                html += " &nbsp; <a id=\"cpwd\" href=\"changepwd\">" + 
                    "change password</a>"; }
            mor.out('topdiv', html);
            mor.onclick('logout', logout);
            if(authmethod === "mid") {
                mor.onclick('cpwd', displayChangePassForm); } }
    },


    createAccount = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            maddr = mor.byId('emailin').value || "",
            data = "", url;
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        mor.out('newaccbuttonstd', "Creating new account...");
        data = mor.objdata({ user: username, pass: password, email: maddr });
        mor.call(url, 'POST', data, 
                 function (objs) {
                     setAuthentication("mid", objs[0].token, username);
                     //give new account save a chance to stabilize
                     setTimeout(mor.login.init, 700); },
                 function (code, errtxt) {
                     mor.out('maccstatdiv', errtxt); });
    },


    //Some people habitually use their email address as their username,
    //but if they forget their password it still has to be searched via
    //the email field, so copy it over.  They can fix it if not right.
    usernamechange = function () {
        var uname = mor.byId('userin').value;
        if(mor.isProbablyEmail(uname)) {
            mor.byId('emailin').value = uname; }
        mor.byId('passin').focus();
    },


    displayNewAccountForm = function () {
        var html = "";
        html += "<div id=\"maccstatdiv\">Creating a new account</div>" +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">username</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"userin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">password</td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" id=\"passin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">email</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"emailin\" size=\"30\"/></td>" +
            "<td align=\"left\">" + 
              "(optional - used if you forget your login)</td>" +
          "</tr>" +
          "<tr>" +
            "<td id=\"newaccbuttonstd\" colspan=\"2\" align=\"center\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"createbutton\">Create</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('logindiv', html);
        mor.onclick('cancelbutton', mor.login.init);
        mor.onclick('createbutton', createAccount);
        mor.onchange('userin', usernamechange);
        mor.onchange('passin', function () { mor.byId('emailin').focus(); });
        mor.onchange('emailin', createAccount);
        mor.layout.adjust();
        mor.byId('userin').focus();
    },


    dispEmailSent = function () {
        var html = "";
        html += "<p>Your account information has been emailed to <code>" +
        mor.byId('emailin').value + 
        "</code> and should arrive in a few " +
        "minutes.  If it doesn't show up, please </p>" +
        "<ol>" +
        "<li>Make sure you have entered your email address correctly" +
        "<li>Check your spam folder to see if the message was filtered out" +
        "<li>Verify the email address you entered is the same one you used" +
           " when you created your account." +
        "</ol>" +
        "<p>If you did not specify an email address when you created your " +
        "account, then your login information cannot be retrieved. </p>" +
        "<p><a id=\"retlogin\" href=\"return to login\">" +
        "return to login</a></p>";
        mor.out('logindiv', html);
        mor.onclick('retlogin', mor.login.init);
        mor.layout.adjust();
    },


    emailCredentials = function () {
        var eaddr = mor.byId('emailin').value,
            data = "";
        if(!eaddr || !eaddr.trim() || !mor.isProbablyEmail(eaddr)) {
            mor.out('emcrediv', "Please enter your email address");
            return; }  //nothing to send to
        mor.out('sendbuttons', "Sending...");
        data = "email=" + mor.enc(eaddr);
        mor.call("mailcred", 'POST', data,
                 function (objs) {
                     dispEmailSent(); },
                 function (code, errtxt) {
                     mor.out('emcrediv', errtxt); });
    },


    displayEmailCredForm = function () {
        var html = "";
        html += "<div id=\"emcrediv\">If you filled out your email address" +
        " when you created your account, then your username and password" +
        " can be mailed to you. </div>" +
        "<table>" + 
          "<tr>" +
            "<td align=\"right\">email</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"emailin\" size=\"30\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"sendbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"sendbutton\">Send</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('logindiv', html);
        mor.onclick('cancelbutton', mor.login.init);
        mor.onclick('sendbutton', emailCredentials);
        mor.onchange('emailin', emailCredentials);
        mor.layout.adjust();
        mor.byId('emailin').focus();
    },


    userpassLogin = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            url, data;
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('loginstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("login");
        data = mor.objdata({ user: username, pass: password });
        mor.call(url, 'POST', data,
                 function (objs) {
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     mor.out('loginstatdiv', "Login failed: " + errtxt); },
                 [401]);
    },


    displayLoginForm = function () {
        var cdiv, ldiv, html = "";
        cdiv = mor.byId('contentdiv');
        mor.out('contentdiv', mor.introtext);
        ldiv = document.createElement('div');
        ldiv.setAttribute('id','logindiv');
        cdiv.appendChild(ldiv);
        html +=  "<div id=\"loginstatdiv\">&nbsp;</div>" +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">username</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"userin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">password</td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" id=\"passin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\">" +
              "<a id=\"seclogin\" href=\"#secure login\"" +
                " title=\"How login credentials are handled securely\"" +
                " onclick=\"mor.layout.displayDoc('docs/seclogin.html');" +
                "return false;\">(secured)</a>" +
              "&nbsp;&nbsp;&nbsp;" +
              "<button type=\"button\" id=\"loginbutton\">Log in</button>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"left\">" +
              "<a id=\"macc\" href=\"create new account...\"" + 
                " title=\"Set up a new local login\"" +
              ">" + "Create a new account</a>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"left\">" +
              "<a id=\"forgot\" href=\"forgot credentials...\"" + 
                " title=\"Retrieve your credentials using the email you set\"" +
              ">" + "forgot my password</a>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('logindiv', html);
        mor.onclick('macc', displayNewAccountForm);
        mor.byId('seclogin').style.fontSize = "x-small";
        mor.byId('forgot').style.fontSize = "x-small";
        mor.onclick('forgot', displayEmailCredForm);
        mor.onclick('loginbutton', userpassLogin);
        mor.onchange('userin', function () { mor.byId('passin').focus(); });
        mor.onchange('passin', userpassLogin);
        mor.layout.adjust();
        if(authname) {
            mor.byId('userin').value = authname; }
        mor.byId('userin').focus();
        mor.out('loginstatdiv', loginprompt);
    };


    mor.login = {
        init: function () {
            var command = readURLHash();
            if(authtoken || readAuthCookie()) {
                if(command === "chgpwd") {
                    displayChangePassForm(); }
                else {
                    doneWorkingWithAccount(); } }
            else if(secureURL("login") === "login") {
                displayLoginForm(); }
            else {  //redirect to https server to start
                window.location.href = secsvr + "#returnto=" + 
                    mor.enc(mainsvr); } },
        updateAuthentDisplay: function () {
            updateAuthentDisplay(); },
        displayChangePassForm: function () {
            displayChangePassForm(); },
        authparams: function () {
            return authparams(); },
        logout: function () {
            logout(); }
    };

} () );



////////////////////////////////////////
// m o r . r e v i e w
//
(function () {
    "use strict";

    var //The pen name the user is currently logged in with.
        userpen = null,
        //The review currently being displayed or edited.  The pic field
        //is handled as a special case since it requires a form upload.
        review = {},
        //The error message from the previous server save call, if any.
        asyncSaveErrTxt = "",
        //Review type definitions always include the url field, it is
        //appended automatically if not explicitely listed elsewhere
        //in the type definition.  Field names are converted to lower
        //case with all spaces removed for use in storage, and
        //capitalized for use as labels.  Fields defined here also
        //need to be supported server side in the object model (rev.py)
        //
        //Definition guidelines:
        // 1. Too many fields makes it tedious to enter a review.  The
        //    goal here is to provide adequate identification for
        //    someone reading a review, not to be an item database.
        //    Links to item database entries can go in the url field.
        // 2. Default keywords should be widely applicable across the
        //    possible universe of reviews.  When practical, a keyword
        //    should describe your perception rather than being
        //    classificational (e.g. "Funny" rather than "Comedy").
        reviewTypes = [
          { type: "book", plural: "books", img: "TypeBook50.png",
            keyprompt: "Title of book being reviewed",
            key: "title", subkey: "author",
            fields: [ "publisher", "year" ],
            dkwords: [ "Fluff", "Light", "Heavy", "Kid Ok", 
                       "Educational", "Beach", "Travel", "Engaging" ] },
          { type: "movie", plural: "movies", img: "TypeMovie50.png",
            keyprompt: "Movie name",
            key: "title", //subkey
            fields: [ "year", "starring" ],
            dkwords: [ "Fluff", "Light", "Heavy", "Kid Ok", 
                       "Educational", "Cult", "Classic", "Funny", 
                       "Suspenseful" ] },
          { type: "video", plural: "videos", img: "TypeVideo50.png",
            keyprompt: "Link to video",
            key: "url", //subkey
            fields: [ "title", "artist" ],
            dkwords: [ "Light", "Heavy", "Kid Ok", "Educational", 
                       "Cult", "Funny", "Disturbing", "Trippy" ] },
          { type: "music", plural: "music", img: "TypeSong50.png",
            keyprompt: "Title of song, album, video, show or other release",
            key: "title", subkey: "artist",
            fields: [ "album", "year" ],
            dkwords: [ "Light", "Heavy", "Wakeup", "Travel", "Office", 
                       "Workout", "Dance", "Social", "Sex" ] },
          { type: "wine", plural: "wines", img: "TypeWine50.png",
            keyprompt: "Vineyard and type, and/or wine name",
            key: "name", //subkey
            fields: [ "year" ],
            dkwords: [ "Red", "White", "Light", "Robust", "Dry", "Fruity",
                       "Cheap", "Expensive" ] },
          { type: "beer", plural: "beers", img: "TypeBeer50.png",
            keyprompt: "Brewery and type or name of beer",
            key: "name", //subkey
            fields: [],
            dkwords: [ "Light", "Strong", "Traditional", "Experimental",
                       "Hoppy", "Fruity", "Sweet", "Cheap", "Expensive" ] },
          { type: "food", plural: "food", img: "TypeFood50.png",
            keyprompt: "Name of restaurant or dish",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Breakfast", "Lunch", "Dinner", "Snack", 
                       "Cheap", "Expensive", "Fast", "Slow", "Outdoor",
                       "Quiet", "Loud" ] },
          { type: "to do", plural: "things to do", img: "TypeBucket50.png",
            keyprompt: "Name of place, activity, or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Easy", "Advanced", "Kid Ok", "Cheap", "Expensive",
                       "Spring", "Summer", "Autumn", "Winter", "Anytime" ] }
          ],


    //rating is a value from 0 - 100.  Display is rounded to nearest value.
    starsImageHTML = function (rating) {
        var img, title, html;
        if(typeof rating === "string") {
            rating = parseInt(rating, 10); }
        if(!rating || typeof rating !== 'number' || rating < 5) {
            img = "ratstar0.png";
            title = "No stars"; }
        else if(rating < 15) {
            img = "ratstar05.png";
            title = "Half a star"; }
        else if(rating < 25) {
            img = "ratstar1.png";
            title = "One star"; }
        else if(rating < 35) {
            img = "ratstar15.png";
            title = "One and a half stars"; }
        else if(rating < 45) {
            img = "ratstar2.png";
            title = "Two stars"; }
        else if(rating < 55) {
            img = "ratstar25.png";
            title = "Two and a half stars"; }
        else if(rating < 65) {
            img = "ratstar3.png";
            title = "Three stars"; }
        else if(rating < 75) {
            img = "ratstar35.png";
            title = "Three and a half stars"; }
        else if(rating < 85) {
            img = "ratstar4.png";
            title = "Four stars"; }
        else if(rating < 95) {
            img = "ratstar45.png";
            title = "Four and a half stars"; }
        else {
            img = "ratstar5.png";
            title = "Five stars"; }
        html = "<img class=\"starsimg\" src=\"img/" + img + "\"" +
                   " title=\"" + title + "\" alt=\"" + title + "\"/>";
        return html;
    },


    //returns empty string if no image
    badgeImageHTML = function (type, withtext) {
        var label = type.plural.capitalize(), html = "";
        if(type.img) {
            html = "<img class=\"reviewbadge\"" +
                       " src=\"img/" + type.img + "\"" + 
                       " title=\"" + label + "\"" +
                       " alt=\"" + label + "\"" +
                "/>";
            if(withtext) {
                html += label; } }
        return html;
    },


    reviewTypeCheckboxesHTML = function (cboxgroup) {
        var i, tdc = 0, html = "<table>";
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            html += "<td>" + mor.checkbox(cboxgroup, 
                                          reviewTypes[i].plural, 
                                          badgeImageHTML(reviewTypes[i], 
                                                         true)) + 
                "</td>";
            tdc += 1;
            if(tdc === 4 || i === reviewTypes.length - 1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table>";
        return html;
    },


    findReviewType = function (type) {
        var i;
        type = type.toLowerCase();
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(reviewTypes[i].type === type ||
               reviewTypes[i].plural === type) {
                return reviewTypes[i]; } }
    },


    writeNavDisplay = function () {
        var html = "<a href=\"#Write a Review\"" +
                     " title=\"Review something\"" +
                     " onclick=\"mor.review.reset();return false;\"" +
            ">Write a Review</a>";
        mor.out('revhdiv', html);
    },


    readURL = function (url) {
        var input;
        if(!url) {
            input = mor.byId('urlin');
            if(input) {
                url = input.value; } }
        if(url) {
            //ATTENTION: Check configured connection services to see if
            //any of them know how to pull info from this url.
            alert("There is no registered connection service available yet " +
                  "that knows how to read " + url + ". Feel free to " +
                  "raise this as an issue if you think there should be one."); }
    },


    setType = function (type) {
        review.revtype = type;
        mor.review.display();
    },


    displayTypeSelect = function () {
        var i, tdc = 0, html;
        html = "<div id=\"revfdiv\" class=\"formstyle\" align=\"center\">" +
        "<ul class=\"reviewformul\">" +
            "<li>Paste a web address for what you are reviewing " + 
            "(if available)" + "<table><tr>" +
              "<td align=\"right\">URL</td>" +
              "<td align=\"left\">" +
                "<input type=\"text\" id=\"urlin\" size=\"40\"/></td>" +
              "<td>" +
                "<button type=\"button\" id=\"readurlbutton\"" +
                       " onclick=\"mor.review.readURL();return false;\"" +
                       " title=\"Read review form fields from pasted URL\"" +
                    ">Read</button>" +
                "</td>" +
            "</tr></table>" +
            "<li>Choose a review type</li>";
        html += "<table class=\"typebuttonstable\">";
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            html += "<td><button type=\"button\" id=\"type" + i + "\"" +
                               " onclick=\"mor.review.setType('" +
                                             reviewTypes[i].type + "');" +
                                            "return false;\"" +
                               " title=\"Create a " + reviewTypes[i].type + 
                                        " review\"" +
                         "><img class=\"reviewbadge\"" +
                              " src=\"img/" + reviewTypes[i].img + "\">" +
                reviewTypes[i].type + "</button></td>";
            tdc += 1;
            if(tdc === 4 || i === reviewTypes.length -1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table></ul></div>";
        mor.out('cmain', html);
        mor.byId('urlin').focus();
        mor.layout.adjust();
    },


    picUploadForm = function () {
        var odiv, html = "", revid = mor.instId(review);
        mor.review.save();  //save any outstanding edits
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + revid + "\"/>";
        html += "<input type=\"hidden\" name=\"penid\" value=\"" +
            review.penid + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#revedit=" + revid) + "\"/>";
        //build the rest of the form around that
        html = "<form action=\"/revpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            html +
            "<table>" +
              "<tr><td>Upload Review Pic</td></tr>" +
              "<tr><td><input type=\"file\" name=\"picfilein\"" + 
                                          " id=\"picfilein\"/></td></tr>" +
              "<tr><td align=\"center\">" +
                    "<input type=\"submit\" value=\"Upload\"/></td></tr>" +
            "</form>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "300px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = mor.cancelPicUpload;
        mor.byId('picfilein').focus();
    },


    picHTML = function (review, type, keyval, mode) {
        var html;
        if(!keyval) {
            return ""; }
        //if just viewing, the default is no pic, just space.  But
        //the layout should stay consistent, so use a placeholder image
        html = "img/emptyblankpic.png";
        if(mode === "edit") {
            //show placeholder outline pic they can click to upload
            html = "img/emptyprofpic.png"; }
        if(review.revpic) {
            //if a pic has been uploaded, use that
            html = "revpic?revid=" + mor.instId(review); }
        html = "<img class=\"revpic\" src=\"" + html + "\"";
        if(mode === "edit") {
            html += " onclick=mor.review.picUploadForm();return false;"; }
        html += "/>";
        return html;
    },


    errlabel = function (domid) {
        var elem = mor.byId(domid);
        elem.style.color = "red";
        if(elem.innerHTML.indexOf("*") < 0) {
            elem.innerHTML += "*"; }
    },


    formFieldLabelContents = function (fieldname) {
        var html = fieldname.capitalize();
        if(fieldname === "url") {
            html = "<img class=\"webjump\" src=\"img/wwwico.png\"/>URL"; }
        return html;
    },


    siteAbbrev = function (url) {
        var html, dotindex;
        if(!url) {
            return "?"; }
        dotindex = url.lastIndexOf(".");
        if(dotindex >= 0) {
            html = url.slice(dotindex, dotindex + 4); }
        else {
            html = url.slice(0, 4); }
        html = "<span class=\"webabbrev\">" + html + "</span>";
        return html;
    },


    graphicAbbrevSiteLink = function (url) {
        var html;
        if(!url) {
            return ""; }
        html = "<a href=\"" + url + "\"" + 
            " onclick=\"window.open('" + url + "');return false;\"" +
            " title=\"" + url + "\">" +
            "<img class=\"webjump\" src=\"img/wwwico.png\"/>" +
                siteAbbrev(url) + "</a>";
        return html;
    },


    keyFieldsValid = function (type, errors) {
        var input = mor.byId('keyin');
        if(!input || !input.value) {
            errlabel('keyinlabeltd');
            errors.push("Please specify a value for " + type.key); }
        else {
            review[type.key] = input.value; }
        if(type.subkey) {
            input = mor.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Please specify a value for " + type.subkey); }
            else {
                review[type.subkey] = input.value; } }
    },


    secondaryFieldsHTML = function (review, type, keyval, mode) {
        var html = "", i, field, fval;
        if(!keyval) {
            return html; }
        html += "<table>";
        for(i = 0; i < type.fields.length; i += 1) {
            field = type.fields[i];
            fval = review[field] || "";
            if(field !== "url") {
                html += "<tr>";
                if(mode === "edit") {
                    html += "<td align=\"right\">" + 
                        field.capitalize() + "</td>" +
                        "<td align=\"left\">" +
                            "<input type=\"text\" id=\"field" + i + "\"" + 
                                  " size=\"25\"" +
                                  " value=\"" + fval + "\"/></td>"; }
                else if(fval) {  //not editing and have value to display
                    html += "<td>" + fval + "</td>"; }
                html += "</tr>"; } }
        html += "</table>";
        return html;
    },


    secondaryFieldsValid = function (type, errors) {
        var input, i;
        //none of the secondary fields are required, so just note the values
        for(i = 0; i < type.fields.length; i += 1) {
            input = mor.byId("field" + i);
            if(input) {  //input field was displayed
                review[type.fields[i]] = input.value; } }
    },


    toggleKeyword = function (kwid) {
        var cbox, text, keyin, keywords, i, kw;
        cbox = mor.byId(kwid);
        text = "";
        keyin = mor.byId('keywordin');
        keywords = keyin.value.split(",");
        for(i = 0; i < keywords.length; i += 1) {
            kw = keywords[i].trim();
            if(kw === cbox.value) {
                kw = ""; }
            if(text) {  //have a keyword already
                text += ", "; }
            text += kw; }
        if(cbox.checked) {
            if(text) {
                text += ", "; }
            text += cbox.value; }
        keyin.value = text;
    },


    keywordCheckboxesHTML = function (type) {
        var i, tdc = 0, html = "";
        html += "<table>";
        for(i = 0; i < type.dkwords.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            html += "<td><input type=\"checkbox\"" +
                " name=\"dkw" + i + "\"" +
                " value=\"" + type.dkwords[i] + "\"" +
                " id=\"dkw" + i + "\"" + 
                " onchange=\"mor.review.toggleKeyword('dkw" + i + "');" +
                            "return false;\"";
            if(review.keywords.indexOf(type.dkwords[i]) >= 0) {
                html += " checked=\"checked\""; }
            html += "/>" +
                "<label for=\"dkw" + i + "\">" + 
                  type.dkwords[i] + "</label>" +
                "</td>";
            tdc += 1;
            if(tdc === 4 || i === type.dkwords.length - 1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table>";
        return html;
    },


    keywordsHTML = function (review, type, keyval, mode) {
        var html = "";
        if(!keyval) {
            return html; }
        if(mode === "edit") {
            html += keywordCheckboxesHTML(type) + 
                "Keywords: " +
                  "<input type=\"text\" id=\"keywordin\"" + 
                        " size=\"30\"" + 
                        " value=\"" + review.keywords + "\"/>"; }
        else { //not editing
            html += "<div class=\"csvstrdiv\">" + review.keywords + "</div>"; }
        return html;
    },


    keywordsValid = function (type, errors) {
        var input = mor.byId('keywordin');
        if(input) {
            review.keywords = input.value; }
    },


    //This should have a similar look and feel to the shoutout display
    reviewTextHTML = function (review, type, keyval, mode) {
        var html = "", fval, style, targetwidth;
        if(!keyval) {
            return html; }
        fval = review.text || "";
        targetwidth = Math.max((mor.winw - 350), 200);
        style = "color:" + mor.colors.text + ";" +
            "background-color:" + mor.skinner.lightbg() + ";" +
            "width:" + targetwidth + "px;";
        if(mode === "edit") {
            style += "height:120px;";
            html += "<textarea id=\"reviewtext\" class=\"shoutout\"" + 
                             " style=\"" + style + "\">" +
                fval + "</textarea>"; }
        else {
            style += "height:140px;overflow:auto;" + 
                "border:1px solid " + mor.skinner.darkbg() + ";";
            html += "<div id=\"reviewtext\" class=\"shoutout\"" +
                        " style=\"" + style + "\">" + 
                mor.linkify(fval) + "</div>"; }
        return html;
    },


    reviewTextValid = function (type, errors) {
        var input = mor.byId('reviewtext');
        if(input) {
            review.text = input.value; }
    },


    reviewFormButtonsHTML = function (review, type, keyval, mode) {
        var html = "";
        //user just chose type for editing
        if(!keyval) {
            mor.onescapefunc = mor.review.reset;
            html += "<button type=\"button\" id=\"cancelbutton\"" +
                " onclick=\"mor.review.reset();return false;\"" +
                ">Cancel</button>" + 
                "&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.save();return false;\"" +
                ">Create Review</button>"; }
        //have key fields and editing full review
        else if(mode === "edit") {
            html += "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.save();return false;\"" +
                ">Save</button>&nbsp;";
            if(keyval) {  //have at least minimally complete review..
                html += "<button type=\"button\" id=\"donebutton\"" +
                    " onclick=\"mor.review.save(true);return false;\"" +
                    ">Done</button>"; } }
        //reading a previously written review
        else if(review.penid === mor.instId(userpen)) {  //is review owner
            html += "<button type=\"button\" id=\"editbutton\"" +
                " onclick=\"mor.review.display();return false;\"" +
                ">Edit</button>"; }
        //reading a review written by someone else
        else {
            html += "<button type=\"button\" id=\"respondbutton\"" +
                " onclick=\"mor.review.respond();return false;\"" +
                ">Edit Your Review</button>"; }
        //space for save status messages underneath buttons
        html += "<br/><div id=\"revsavemsg\"></div>";
        return html;
    },


    sliderChange = function (value) {
        var html;
        //mor.log("sliderChange: " + value);
        review.rating = Math.round(value);
        html = starsImageHTML(review.rating);
        mor.out('stardisp', html);
    },


    makeRatingSlider = function (keyval) {
        //The dojo dijit/form/HorizontalSlider rating control
        var ratingSlider = mor.dojo.dijitreg.byId("ratslide");
        if(ratingSlider) {
            //kill the widget and any contained widgets, preserving DOM node
            ratingSlider.destroyRecursive(true); }
        if(!keyval) {  //no star value input yet
            return; }
        ratingSlider = new mor.dojo.slider({
            name: "ratslide",
            value: 80,
            minimum: 0,
            maximum: 100,
            intermediateChanges: true,
            style: "width:150px;",
            onChange: function (value) {
                sliderChange(value); } }, "ratslide");
        if(review.rating === null || review.rating < 0) { 
            review.rating = 80; }  //have to start somewhere...
        ratingSlider.set("value", review.rating);
        sliderChange(review.rating);
        return ratingSlider;
    },


    displayReviewForm = function (review, mode) {
        var html, type, keyval, fval, onchange;
        type = findReviewType(review.revtype);
        keyval = review[type.key];
        html = "<div class=\"formstyle\">" + 
            "<table class=\"revdisptable\" border=\"0\">";
        //labels for first line if editing
        if(mode === "edit") {
            html += "<tr>" +
                "<td></td>" +
                "<td id=\"keyinlabeltd\">" + 
                    formFieldLabelContents(type.key) + "</td>";
            if(type.subkey) {
                html += "<td id=\"subkeyinlabeltd\">" +
                    formFieldLabelContents(type.subkey) + "</td>"; }
            html += "</tr>"; }
        //first line of actual content
        html += "<tr><td><span id=\"stardisp\">" + 
            starsImageHTML(review.rating) + "</span>" + "&nbsp;" +
            badgeImageHTML(type) + "</td>";
        if(mode === "edit") {
            onchange = "mor.review.save();return false;";
            if(type.subkey) {
                onchange = "mor.byId('subkeyin').focus();return false;"; }
            fval = review[type.key] || "";
            html += "<td><input type=\"text\" id=\"keyin\" size=\"30\"" +
                              " onchange=\"" + onchange + "\"" + 
                              " value=\"" + fval + "\"></td>";
            if(type.subkey) {
                onchange = "mor.review.save();return false;";
                fval = review[type.subkey] || "";
                html += "<td><input type=\"text\" id=\"subkeyin\" size=\"30\"" +
                                  " onchange=\"" + onchange + "\"" +
                                  " value=\"" + fval + "\"/></td>"; } }
        else {  //not editing, read only display
            fval = review[type.key] || "";
            html += "<td align=\"middle\"><b>" + fval + "</b></td>";
            if(type.subkey) {
                fval = review[type.subkey] || "";
                html += "<td><i>" + fval + "</i></td>"; }
            if("url" !== type.key && "url" !== type.subkey) {
                fval = review.url || "";
                html += "<td>" + graphicAbbrevSiteLink(fval) + "</td>"; } }
        html += "</tr>";
        //slider rating control and url input if editing
        if(mode === "edit" && keyval) {
            fval = review.url || "";
            html += "<tr>" + 
                "<td colspan=\"2\" class=\"claro\">" +
                  "<div id=\"ratslide\"></div>" +
                "</td>" + 
                "<td>" +
                  formFieldLabelContents("url") + "<br/>" +
                  "<input type=\"text\" id=\"urlin\" size=\"30\"" +
                        " value=\"" + fval + "\"/>" +
                "</td>" +
                "</tr>"; }
        //text description line
        html += "<tr><td colspan=\"4\">" + 
            reviewTextHTML(review, type, keyval, mode) + "</td></tr>" +
            "</table><table class=\"revdisptable\" border=\"0\">";
        //pic, keywords, secondary fields, pic
        html += "<tr>" +
            "<td>" + picHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                keywordsHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                secondaryFieldsHTML(review, type, keyval, mode) + "</td>" +
            "</tr>";
        //buttons
        html += "<tr>" +
          "<td colspan=\"4\" align=\"center\" id=\"formbuttonstd\">" + 
            reviewFormButtonsHTML(review, type, keyval, mode) + "</td>" +
        "</tr>" +
        "</table></div>";
        mor.out('cmain', html);
        if(mode === "edit") {
            makeRatingSlider(keyval);
            if(!keyval) {
                mor.byId('keyin').focus(); }
            else if(mor.byId('subkeyin')) {
                mor.byId('subkeyin').focus(); }
            else {
                mor.byId('reviewtext').focus(); } }
        mor.layout.adjust();
    },


    cancelReview = function () {
        review = {};
        mor.onescapefunc = null; 
        mor.review.display();
    },


    saveReview = function (doneEditing) {
        var errors = [], i, errtxt = "", type, url, data;
        type = findReviewType(review.revtype);
        if(!type) {
            mor.out('revsavemsg', "Unknown review type");
            return; }
        keyFieldsValid(type, errors);
        secondaryFieldsValid(type, errors);
        keywordsValid(type, errors);
        reviewTextValid(type, errors);
        if(errors.length > 0) {
            for(i = 0; i < errors.length; i += 1) {
                errtxt += errors[i] + "<br/>"; }
            mor.out('revsavemsg', errtxt);
            return; }
        mor.out('formbuttonstd', "Saving...");
        mor.onescapefunc = null;
        url = "updrev?";
        if(!mor.instId(review)) {
            url = "newrev?";
            review.svcdata = ""; }
        data = mor.objdata(review);
        mor.call(url + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     mor.profile.resetReviews();
                     review = reviews[0];
                     if(doneEditing) {
                         mor.review.displayRead(); }
                     else {
                         mor.review.display(); } },
                 function (code, errtxt) {
                     asyncSaveErrTxt = "Save failed code: " + code + " " +
                         errtxt;
                     mor.review.display(); });
    },


    initWithId = function (revid, mode) {
        var params = "revid=" + revid;
        mor.call("revbyid?" + params, 'GET', null,
                 function (revs) {
                     if(revs.length > 0) {
                         review = revs[0];
                         if(mode === "edit") {
                             mor.review.display(); }
                         else {
                             mor.review.displayRead(); } }
                     else {
                         mor.err("initWithId found no review id " + revid); } },
                 function (code, errtxt) {
                     mor.err("initWithId failed code " + code + ": " +
                             errtxt); });
    },


    mainDisplay = function (pen, read) {
        userpen = pen;
        if(!review) {
            review = {}; }
        if(!review.penid) {
            review.penid = mor.instId(userpen); }
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(review); }
        else if(!review.revtype) {
            displayTypeSelect(); }
        else {
            displayReviewForm(review, "edit"); }
    };


    mor.review = {
        display: function () {
            mor.pen.getPen(mainDisplay); },
        displayRead: function () {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, true); }); },
        updateHeading: function () {
            writeNavDisplay(); },
        getReviewTypes: function () {
            return reviewTypes; },
        getReviewTypeByValue: function (val) {
            return findReviewType(val); },
        reviewTypeCheckboxesHTML: function (cboxgroup) {
            return reviewTypeCheckboxesHTML(cboxgroup); },
        badgeImageHTML: function (type) {
            return badgeImageHTML(type); },
        starsImageHTML: function (rating) {
            return starsImageHTML(rating); },
        readURL: function (url) {
            return readURL(url); },
        setType: function (type) {
            return setType(type); },
        picUploadForm: function () {
            picUploadForm(); },
        toggleKeyword: function (kwid) {
            toggleKeyword(kwid); },
        reset: function () {
            cancelReview(); },
        save: function (doneEditing) {
            saveReview(doneEditing); },
        setCurrentReview: function (revobj) {
            review = revobj; },
        initWithId: function (revid, mode) {
            initWithId(revid, mode); },
        respond: function () {
            mor.err("Not implemented yet"); },
        graphicAbbrevSiteLink: function (url) {
            return graphicAbbrevSiteLink(url); }
    };

} () );


////////////////////////////////////////
// m o r . a c t i v i t y
//
(function () {
    "use strict";

    var

    writeNavDisplay = function () {
        var html = "<a href=\"#Activity\"" +
                     " title=\"See what's been posted recently\"" + 
                     " onclick=\"mor.activity.display();return false;\"" +
            ">Activity</a>";
        mor.out('acthdiv', html);
    },


    mainDisplay = function (penName) {
        var html = "<p>Activity display not implemented yet</p>";
        mor.out('cmain', html);
        mor.layout.adjust();
    };

    
    mor.activity = {
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            writeNavDisplay(); }
    };

} () );



////////////////////////////////////////
// m o r . p r o f i l e
//
(function () {
    "use strict";

    var unspecifiedCityText = "City not specified",
        currtab,
        profpen,
        cachepens = [],
        //tab displays
        recRevState = {},
        topRevState = {},
        followingDisp,
        followerDisp,
        //search tab display
        searchparams = {},
        searchresults = [],
        searchcursor = "",
        searchtotal = 0,


    createOrEditRelationship = function () {
        mor.pen.getPen(function (pen) {
            mor.rel.reledit(pen, profpen); });
    },


    writeNavDisplay = function (pen) {
        var html, relationship, penid = mor.instId(pen),
            profdfunc = "mor.profile.display()";
        if(!mor.pen.getHomePen(penid)) {
            profdfunc = "mor.profile.byprofid(" + penid + ")"; }
        html = "<a href=\"#Profile\"" +
                 " title=\"Show profile for " + pen.name + "\"" +
                 " onclick=\"" + profdfunc + ";return false;\"" +
            ">" + pen.name + "</a>";
        mor.out('penhnamespan', html);
        if(mor.authorized(pen)) {
            html = mor.imglink("#Settings","Adjust settings for " + pen.name,
                               "mor.profile.settings()", "settings.png") +
                   mor.imglink("#PenNames","Switch Pen Names",
                               "mor.profile.penswitch()", "pen.png"); }
        else {
            relationship = mor.rel.outbound(mor.instId(pen));
            if(relationship) {
                html = mor.imglink("#Settings",
                                   "Adjust follow settings for " + pen.name,
                                   "mor.profile.relationship()", 
                                   "settings.png"); }
            else {
                html = mor.imglink("#Follow",
                                   "Follow " + pen.name,
                                   "mor.profile.relationship()",
                                   "plus.png"); }
            html += mor.imglink("#Home","Return to home profile",
                                "mor.profile.display()", "home.png"); }
        mor.out('penhbuttonspan', html);
    },


    setPenNameFromInput = function (pen) {
        var pennamein = mor.byId('pennamein');
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    savePenNameSettings = function (pen) {
        setPenNameFromInput(pen);
        mor.skinner.save(pen);
        mor.pen.updatePen(pen,
                          function () {
                              mor.layout.closeDialog();
                              mor.profile.display(); },
                          function (code, errtxt) {
                              mor.out('settingsmsgtd', errtxt); });
    },


    cancelPenNameSettings = function () {
        mor.skinner.cancel();
        mor.layout.closeDialog();
    },


    displayAuthSettings = function (domid, pen) {
        //dump checkboxes for authorizing access to this pen name via
        //alternate authentication methods
    },


    changeSettings = function (pen) {
        var html = "<table>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"pensettitletd\">" +
              "<h2>Settings for " + pen.name + "</h2>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsmsgtd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">Pen Name</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"pennamein\" size=\"25\"" + 
                    " value=\"" + pen.name + "\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsauthtd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsskintd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('dlgdiv', html);
        mor.onchange('pennamein', mor.profile.setPenName);
        mor.onclick('cancelbutton', cancelPenNameSettings);
        mor.onclick('savebutton', mor.profile.saveSettings);
        displayAuthSettings('settingssauthtd', pen);
        mor.skinner.init('settingsskintd', pen);
        mor.byId('dlgdiv').style.visibility = "visible";
        mor.onescapefunc = cancelPenNameSettings;
    },


    changeToSelectedPen = function () {
        var i, sel = mor.byId('penselect');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                if(sel.options[i].id === 'newpenopt') {
                    mor.pen.newPenName(mor.profile.display); }
                else {
                    mor.pen.selectPenByName(sel.options[i].value); }
                break; } }
    },


    changePens = function (pen) {
        var html = "", pens = mor.pen.getPenNames(), i;
        html += "<div id=\"proftoptive\">";  //re-use to keep same display
        html += "<span class=\"headingtxt\">Select Pen Name: </span>";
        html += "<select id=\"penselect\">";
        for(i = 0; i < pens.length; i += 1) {
            html += "<option id=\"" + mor.instId(pens[i]) + "\"";
            if(pens[i].name === pen.name) {
                html += " selected=\"selected\""; }
            html += ">" + pens[i].name + "</option>"; }
        html += "<option id=\"newpenopt\">New Pen Name</option>" +
            "</select>" +
            "&nbsp;" + 
            "<button type=\"button\" id=\"penselectok\">Ok</button>" +
            "</div>";
        mor.out('cmain', html);
        mor.layout.adjust();
        mor.onchange('penselect', changeToSelectedPen);
        mor.onclick('penselectok', changeToSelectedPen);
    },


    badgeDispHTML = function (hastop) {
        var html = "", i, values, type;
        values = hastop.split(",");
        for(i = 0; i < values.length; i += 1) {
            type = mor.review.getReviewTypeByValue(values[i]);
            html += mor.review.badgeImageHTML(type); }
        return html;
    },


    penListItemHTML = function (pen) {
        var penid = mor.instId(pen), picuri, hash, linktitle, html;
        hash = mor.objdata({ view: "profile", profid: penid });
        linktitle = mor.ellipsis(pen.shoutout, 75);
        if(!linktitle) {
            linktitle = "View profile for " + mor.enc(pen.name); }
        html = "<li>" +
            "<a href=\"#" + hash + "\"" +
            " onclick=\"mor.profile.changeid('" + penid + "');return false;\"" +
            " title=\"" + linktitle + "\">";
        picuri = "img/emptyprofpic.png";
        if(pen.profpic) {
            picuri = "profpic?profileid=" + penid; }
        html += "<img class=\"srchpic\" src=\"" + picuri + "\"/>" +
            "&nbsp;" + "<span class=\"penfont\">" + pen.name + 
            "</span>" + "</a>";
        if(pen.city) {
            html += " <span class=\"smalltext\">(" + pen.city + ")</span>"; }
        if(pen.hastop) {
            html += badgeDispHTML(pen.hastop); }
        html += "</li>";
        return html;
    },


    findPenInArray = function (id, pens) {
        var i;
        for(i = 0; pens && i < pens.length; i += 1) {
            if(mor.instId(pens[i]) === id) {
                return pens[i]; } }
    },


    cachedPen = function (id) {
        var pen;
        //check our own pens first, usually fewer of those
        if(!pen) {
            pen = findPenInArray(id, mor.pen.getPenNames()); }
        //check the current search results
        if(!pen) {
            pen = findPenInArray(id, searchresults); }
        //check the cached pens
        if(!pen) {
            pen = findPenInArray(id, cachepens); }
        return pen;
    },


    updateCache = function (pen) {
        var i, penid = mor.instId(pen);
        for(i = 0; i < searchresults.length; i += 1) {
            if(mor.instId(searchresults[i]) === penid) {
                searchresults[i] = pen;
                break; } }
        for(i = 0; i < cachepens.length; i += 1) {
            if(mor.instId(cachepens[i]) === penid) {
                cachepens[i] = pen;
                break; } }
    },


    findOrLoadPen = function (id, callback) {
        var pen, params;
        pen = cachedPen(id);
        if(pen) {
            return callback(pen); }
        params = "penid=" + id;
        mor.call("penbyid?" + params, 'GET', null,
                 function (pens) {
                     if(pens.length > 0) {
                         cachepens.push(pens[0]);
                         callback(pens[0]); }
                     else {
                         mor.err("findOrLoadPen found no pen id: " + id); } },
                 function (code, errtxt) {
                     mor.err("findOrLoadPen failed code " + code + ": " + 
                             errtxt); });
    },


    tablink = function (text, funcstr) {
        var html;
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        html = "<a href=\"#" + text + "\"" +
                 " title=\"Click to see " + text + "\"" +
                 " onclick=\"" + funcstr + "return false;\">" + 
               text + "</a>";
        return html;
    },


    selectTab = function (tabid, tabfunc) {
        var i, ul, li;
        ul = mor.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = mor.skinner.darkbg(); }
        li = mor.byId(tabid);
        li.className = "selectedTab";
        li.style.backgroundColor = mor.colors.bodybg;
        currtab = tabfunc;
        mor.historyCheckpoint({ view: "profile", profid: mor.instId(profpen),
                                tab: mor.profile.currentTabAsString() });

    },


    clearReviewDispState = function (dispState) {
        dispState.params = {};
        dispState.results = [];
        dispState.cursor = "";
        dispState.total = 0;
        dispState.initialized = false;
    },


    resetReviewDisplays = function () {
        clearReviewDispState(recRevState);
        recRevState.tab = "recent";
        clearReviewDispState(topRevState);
        topRevState.tab = "top";
    },


    readReview = function (revid) {
        var i, revobj;
        if(typeof revid !== "number") {
            revid = parseInt(revid, 10); }
        for(i = 0; !revobj && i < recRevState.results.length; i += 1) {
            if(mor.instId(recRevState.results[i]) === revid) {
                revobj = recRevState.results[i]; } }
        for(i = 0; !revobj && i < topRevState.results.length; i += 1) {
            if(mor.instId(topRevState.results[i]) === revid) {
                revobj = topRevState.results[i]; } }
        if(!revobj) {
            mor.log("readReview " + revid + " not found");
            return; }
        mor.review.setCurrentReview(revobj);
        mor.review.displayRead();
    },


    reviewItemHTML = function (revobj, penNameStr) {
        var revid, type, hash, html;
        revid = mor.instId(revobj);
        type = mor.review.getReviewTypeByValue(revobj.revtype);
        hash = mor.objdata({ view: "review", revid: revid });
        html = "<li>" + mor.review.starsImageHTML(revobj.rating) + 
            mor.review.badgeImageHTML(type) + "&nbsp;" +
            "<a href=\"#" + hash + "\"" +
              " onclick=\"mor.profile.readReview('" + revid + "');" + 
                         "return false;\"" +
              " title=\"See full review\">" + 
            revobj[type.key];
        if(type.subkey) {
            html += " <i>" + revobj[type.subkey] + "</i>"; }
        html += "</a>";
        if(revobj.url) {
            html += " &nbsp;" + mor.review.graphicAbbrevSiteLink(revobj.url); }
        html += "<br/><span class=\"revtextsummary\">" + 
            mor.ellipsis(revobj.text, 255) + "</span><br/>";
        if(penNameStr) {
            hash = mor.objdata({ view: "profile", profid: revobj.penid });
            html += "<a href=\"#" + hash + "\"" +
                " onclick=\"mor.profile.changeid('" + revobj.penid + "');" +
                           "return false;\"" +
                " title=\"Show profile for" + mor.enc(penNameStr) + "\">" +
                penNameStr + "</a>"; }
        html += "</li>";
        return html;
    },


    displayReviews = function (dispState, reviews) {
        var i, html = "<ul class=\"revlist\">";
        for(i = 0; i < dispState.results.length; i += 1) {
            html += reviewItemHTML(dispState.results[i]); }
        if(reviews) {  //have fresh search results
            dispState.cursor = "";
            for(i = 0; i < reviews.length; i += 1) {
                if(reviews[i].fetched) {
                    dispState.total += reviews[i].fetched;
                    html += "<div class=\"sumtotal\">" +
                        dispState.total + " reviews searched</div>";
                    if(reviews[i].cursor) {
                        dispState.cursor = reviews[i].cursor; }
                    break; }  //if no reviews, i will be left at zero
                dispState.results.push(reviews[i]);
                html += reviewItemHTML(reviews[i]); } }
        dispState.total = Math.max(dispState.total, dispState.results.length);
        if(dispState.total === 0) {
            html += "<li>No reviews</li>"; }
        html += "</ul>";
        if(dispState.cursor && i > 0) {
            html += "<a href=\"#continuesearch\"" +
                " onclick=\"mor.profile.revsmore('" + dispState.tab + "');" +
                           "return false;\"" +
                " title=\"More reviews\"" + ">more reviews...</a>"; }
        mor.out('profcontdiv', html);
        mor.layout.adjust();
    },


    findReviews = function (dispState) {
        var params;
        if(!dispState.params.penid) {
            dispState.params.penid = mor.instId(profpen); }
        params = mor.objdata(dispState.params) + "&" + mor.login.authparams();
        mor.call("srchrevs?" + params, 'GET', null,
                 function (revs) {
                     displayReviews(dispState, revs); },
                 function (code, errtxt) {
                     mor.out('profcontdiv', "findReviews failed code " + code +
                             " " + errtxt); });
    },


    fetchMoreReviews = function (tabname) {
        if(tabname === "recent") {
            findReviews(recRevState); }
        else if(tabname === "best") {
            findReviews(topRevState); }
        mor.err("fetchMoreReviews unknown tabname: " + tabname);
    },

        
    recent = function () {
        var html, temp, maxdate, mindate;
        selectTab("recentli", recent);
        if(recRevState && recRevState.initialized) {
            displayReviews(recRevState); }
        html = "Retrieving recent activity for " + profpen.name + "...";
        mor.out('profcontdiv', html);
        mor.layout.adjust();
        clearReviewDispState(recRevState);
        temp = recRevState;
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        recRevState.params.maxdate = maxdate.toISOString();
        recRevState.params.mindate = mindate.toISOString();
        recRevState.initialized = true; 
        findReviews(recRevState);
    },


    best = function () {
        var html = "Top rated display not implemented yet";
        selectTab("bestli", best);
        mor.out('profcontdiv', html);
        mor.layout.adjust();
    },


    following = function () {
        selectTab("followingli", following);
        if(!followingDisp) {  //different profile than last call..
            followingDisp = { profpen: profpen, direction: "outbound", 
                              divid: 'profcontdiv' }; }
        mor.rel.displayRelations(followingDisp);
    },


    followers = function () {
        selectTab("followersli", followers);
        if(!followerDisp) {  //different profile than last call..
            followerDisp = { profpen: profpen, direction: "inbound", 
                             divid: 'profcontdiv' }; }
        mor.rel.displayRelations(followerDisp);
    },


    readSearchParamsFromForm = function () {
        var checkboxes, options, i, since;
        searchparams.reqmin = [];
        checkboxes = document.getElementsByName("reqmin");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                searchparams.reqmin.push(checkboxes[i].value); } }
        options = mor.byId('srchactivesel').options;
        for(i = 0; i < options.length; i += 1) {
            if(options[i].selected) {
                switch(options[i].id) {
                case 'pastweek':
                    since = 7; break;
                case 'pastmonth':
                    since = 30; break;
                case 'pastyear':
                    since = 365; break;
                case 'whenever':
                    since = -1; break; }
                break; } }
        searchparams.activeDaysAgo = since;
        searchparams.includeFollowing = false;
        searchparams.includeBlocked = false;
        checkboxes = document.getElementsByName("srchinc");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(checkboxes[i].value === 'following') {
                    searchparams.includeFollowing = true; }
                if(checkboxes[i].value === 'blocked') {
                    searchparams.includeBlocked = true; } } }
    },


    setFormValuesFromSearchParams = function () {
        var i, options, since;
        if(searchparams.reqmin) {
            for(i = 0; i < searchparams.reqmin.length; i += 1) {
                mor.byId(searchparams.reqmin[i]).checked = true; } }
        if(searchparams.activeDaysAgo) {
            since = searchparams.activeDaysAgo;
            options = mor.byId('srchactivesel').options;
            for(i = 0; i < options.length; i += 1) {
                switch(options[i].id) {
                case 'pastweek':
                    options[i].selected = (since === 7); break;
                case 'pastmonth':
                    options[i].selected = (since === 30); break;
                case 'pastyear':
                    options[i].selected = (since === 365); break;
                case 'whenever':
                    options[i].selected = (since <= 0); break; } } }
        mor.byId('following').checked = searchparams.includeFollowing;
        mor.byId('blocked').checked = searchparams.includeBlocked;
    },


    //The server handles the "active since" restriction by checking
    //the "accessed" field, and the "top 20" restriction by testing
    //the "hastop" field.  However it does not handle joins across
    //relationships due to indexing overhead, so these are filtered
    //out here.
    filtered = function (pen) {
        var rel = mor.rel.outbound(mor.instId(pen));
        if(rel) {
            if(searchparams.includeFollowing && rel.status === "following") {
                return false; }
            if(searchparams.includeBlocked && rel.status === "blocked") {
                return false; }
            return true; }
        return false;
    },


    displaySearchResults = function (results) {
        var i, html = "<ul class=\"penlist\">";
        for(i = 0; i < searchresults.length; i += 1) {
            html += penListItemHTML(searchresults[i]); }
        searchcursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(results[i].fetched) {
                searchtotal += results[i].fetched;
                html += "<div class=\"sumtotal\">" + 
                    searchtotal + " pen names searched</div>";
                if(results[i].cursor) {
                    searchcursor = results[i].cursor; }
                break; }  //if no pen names, i will be left at zero
            if(!filtered(results[i])) {
                searchresults.push(results[i]);
                html += penListItemHTML(results[i]); } }
        html += "</ul>";
        if(searchcursor) {
            if(i > 0) {  //have more than just an empty result cursor..
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"mor.profile.srchmore();return false;\"" +
                  " title=\"Continue searching for more matching pen names\"" +
                    ">continue search...</a>"; }
            else { //auto-repeat search without creating a recursion stack
                setTimeout(mor.profile.srchmore, 10); } }
        mor.out('searchresults', html);
        mor.byId('srchbuttonspan').style.display = "inline";
        mor.out('srchmessagespan', "");
    },



    doPenSearch = function () {
        var params, qstr, time, t20, i;
        qstr = mor.byId('searchtxt').value;
        readSearchParamsFromForm();
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.byId('srchbuttonspan').style.display = "none";
        mor.out('srchmessagespan', "Searching...");
        params = mor.login.authparams() + "&qstr=" + mor.enc(qstr) +
            "&cursor=" + mor.enc(searchcursor);
        if(searchparams.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= searchparams.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + mor.enc(time); }
        if(searchparams.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < searchparams.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += searchparams.reqmin[i]; }
            params += "&t20=" + mor.enc(t20); }
        mor.call("srchpens?" + params, 'GET', null,
                 function (results) {
                     displaySearchResults(results); },
                 function (code, errtxt) {
                     mor.out('searchresults', 
                             "error code: " + code + " " + errtxt); });
    },


    startPenSearch = function () {
        searchresults = [];
        searchcursor = "";
        searchtotal = 0;
        mor.out('searchresults', "");
        doPenSearch();
    },


    displaySearchForm = function () {
        var html = "";
        selectTab("searchli", mor.profile.search);
        html += "<p>" +
            "<input type=\"text\" id=\"searchtxt\" size=\"40\"" +
                  " placeholder=\"name, city or shoutout partial text\"" +
                  " value=\"\"/>" +
            "&nbsp;" +
            "<span id=\"srchmessagespan\"> </span>" +
            "<span id=\"srchbuttonspan\">" +
              "<button type=\"button\" id=\"searchbutton\">Search</button>" +
            "</span>" +
            "&nbsp;" +
            "<span id=\"srchoptstoggle\" class=\"formstyle\">" + 
              "<a href=\"#options\"" +
                " title=\"advanced search options\"" +
                " onclick=\"mor.profile.togglesrchopts();return false;\"" +
              ">options</a>" +
            "</span>" +
            "</p>" +
            "<div id=\"searchoptionsdiv\" class=\"formstyle\">" +
            "<b>Must have reviewed their top 20</b>" +
            mor.review.reviewTypeCheckboxesHTML("reqmin") +
            "<b>Must have been active within the past</b>&nbsp;" + 
            "<select id=\"srchactivesel\">" +
              "<option id=\"whenever\">Whenever</option>" +
              "<option id=\"pastyear\" selected=\"selected\">Year</option>" +
              "<option id=\"pastmonth\">Month</option>" +
              "<option id=\"pastweek\">Week</option>" +
            "</select>" +
            "<br/>" +
            "<b>Include</b>&nbsp;" + 
            mor.checkbox("srchinc", "following") +
            mor.checkbox("srchinc", "blocked") +
            " <b> in the search results</b>" +
            "<br/>";
        html += "&nbsp;<br/></div>";
        html += "<div id=\"searchresults\"></div>";
        mor.out('profcontdiv', html);
        setFormValuesFromSearchParams();
        displaySearchResults([]);  //show previous results, if any
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.onchange('searchtxt', startPenSearch);
        mor.onclick('searchbutton', startPenSearch);
        mor.byId('searchtxt').focus();
        mor.layout.adjust();
    },


    toggleSearchOptions = function () {
        var sod = mor.byId('searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                sod.style.display = "block"; }
            else {
                sod.style.display = "none"; } }
        mor.layout.adjust();
    },


    displayTabs = function (pen) {
        var html;
        html = "<ul id=\"proftabsul\">" +
          "<li id=\"recentli\" class=\"selectedTab\">" + 
            tablink("Recent Activity", "mor.profile.recent()") + 
          "</li>" +
          "<li id=\"bestli\" class=\"unselectedTab\">" +
            tablink("Top Rated", "mor.profile.best()") + 
          "</li>" +
          "<li id=\"followingli\" class=\"unselectedTab\">" +
            tablink("Following (" + pen.following + ")", 
                    "mor.profile.following()") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers (" + pen.followers + ")", 
                    "mor.profile.followers()") + 
          "</li>" +
          "<li id=\"searchli\" class=\"unselectedTab\">" +
            tablink("Search", "mor.profile.search()") + 
          "</li>" +
        "</ul>";
        mor.out('proftabsdiv', html);
        if(!currtab) {
            currtab = recent; }
        currtab();
    },


    getCurrTabAsString = function () {
        if(currtab === recent) { return "recent"; }
        if(currtab === best) { return "best"; }
        if(currtab === following) { return "following"; }
        if(currtab === followers) { return "followers"; }
        if(currtab === mor.profile.search) { return "search"; }
        return "recent"; //default
    },


    setCurrTabFromString = function (tabstr) {
        switch(tabstr) {
        case "recent": currtab = recent; break;
        case "best": currtab = best; break;
        case "following": currtab = following; break;
        case "followers": currtab = followers; break;
        case "search": currtab = mor.profile.search; break;
        }
    },


    cancelProfileEdit = function () {
        mor.profile.updateHeading();
        mor.profile.display();
    },


    profEditFail = function (code, errtxt) {
        mor.out('sysnotice', errtxt);
    },


    saveEditedProfile = function (pen) {
        var elem;
        elem = mor.byId('profcityin');
        if(elem) {
            pen.city = elem.value; }
        elem = mor.byId('shouttxt');
        if(elem) {
            pen.shoutout = elem.value; }
        mor.pen.updatePen(pen, mor.profile.display, profEditFail);
    },


    displayProfEditButtons = function () {
        var html;
        if(mor.byId('profcancelb')) {
            return; }  //already have buttons
        html = "&nbsp;" +
            "<button type=\"button\" id=\"profcancelb\">Cancel</button>" +
            "&nbsp;" +
            "<button type=\"button\" id=\"profsaveb\">Save</button>";
        mor.out('profeditbspan', html);
        mor.onclick('profcancelb', cancelProfileEdit);
        mor.onclick('profsaveb', mor.profile.save);
    },


    styleShout = function (shout) {
        var target;
        shout.style.color = mor.colors.text;
        shout.style.backgroundColor = mor.skinner.lightbg();
        //80px left margin + 160px image + padding
        //+ balancing right margin space (preferable)
        //but going much smaller than the image is stupid regardless of
        //screen size
        target = Math.max((mor.winw - 350), 200);
        shout.style.width = target + "px";
    },


    editShout = function (pen) {
        var html, shout;
        html = "<textarea id=\"shouttxt\" class=\"shoutout\"></textarea>";
        mor.out('profshouttd', html);
        shout = mor.byId('shouttxt');
        styleShout(shout);
        shout.readOnly = false;
        shout.value = pen.shoutout;
        shout.focus();
        displayProfEditButtons();
    },


    displayShout = function (pen) {
        var html, shout;
        html = "<div id=\"shoutdiv\" class=\"shoutout\"></div>";
        mor.out('profshouttd', html);
        shout = mor.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + mor.colors.bodybg;
        mor.out('shoutdiv', mor.linkify(pen.shoutout));
        if(mor.profile.authorized(pen)) {
            mor.onclick('shoutdiv', function () {
                editShout(pen); }); }
    },



    saveUnlessShoutEdit = function () {
        if(mor.byId('shoutdiv')) {
            mor.profile.save(); }
    },


    editCity = function () {
        var val, html, elem;
        elem = mor.byId('profcityin');
        if(elem) {
            return; }  //already editing
        val = mor.byId('profcityspan').innerHTML;
        if(val === unspecifiedCityText) {
            val = ""; }
        html = "<input type=\"text\" id=\"profcityin\" size=\"25\"" +
                     " placeholder=\"City or Region\"" +
                     " value=\"" + val + "\"/>";
        mor.out('profcityspan', html);
        displayProfEditButtons();
        mor.onchange('profcityin', saveUnlessShoutEdit);
        mor.byId('profcityin').focus();
    },


    displayCity = function (pen) {
        var html = pen.city || unspecifiedCityText;
        mor.out('profcityspan', html);
        if(!pen.city) {
            mor.byId('profcityspan').style.color = "#CCCCCC"; }
        if(mor.profile.authorized(pen)) {
            mor.onclick('profcityspan', editCity); }
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var odiv, html = "";
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + 
            mor.instId(pen) + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#profile") + "\"/>";
        html = "<form action=\"/profpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            html +
            "<table>" +
              "<tr><td>Upload New Profile Pic</td></tr>" +
              "<tr><td><input type=\"file\" name=\"picfilein\"" + 
                                          " id=\"picfilein\"/></td></tr>" +
              "<tr><td align=\"center\">" +
                    "<input type=\"submit\" value=\"Upload\"/></td></tr>" +
            "</form>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = mor.cancelPicUpload;
        mor.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var html = "img/emptyprofpic.png";
        if(pen.profpic) {
            html = "profpic?profileid=" + mor.instId(pen); }
        html = "<img class=\"profpic\" src=\"" + html + "\"/>";
        mor.out('profpictd', html);
        if(mor.profile.authorized(pen)) {
            mor.onclick('profpictd', function () {
                if(mor.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    verifyStateVariableValues = function (pen) {
        if(profpen !== pen) {
            profpen = pen;
            followingDisp = null;
            followerDisp = null; }
        mor.historyCheckpoint({ view: "profile", profid: mor.instId(profpen),
                                tab: getCurrTabAsString() });
    },


    mainDisplay = function (pen) {
        var html;
        verifyStateVariableValues(pen);
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(pen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        mor.skinner.setColorsFromPen(pen);
        html = "<div id=\"proftopdiv\">" +
        "<table>" +
          "<tr>" +
            "<td id=\"sysnotice\" colspan=\"2\">" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profpictd\" rowspan=\"2\">" +
              "<img class=\"profpic\" src=\"img/emptyprofpic.png\"/>" +
            "</td>" +
            "<td id=\"profshouttd\">" +
              "<div id=\"shoutdiv\" class=\"shoutout\"></div>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profcitytd\">" +
              "<span id=\"profcityspan\"> </span>" +
              "<span id=\"profeditbspan\"> </span>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\">" +
              "<div id=\"proftabsdiv\"> </div>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\">" +
              "<div id=\"profcontdiv\"> </div>" +
            "</td>" +
          "</tr>" +
        "</table></div>";
        mor.out('cmain', html);
        displayShout(pen);
        displayCity(pen);
        displayPic(pen);
        displayTabs(pen);
        mor.layout.adjust();
    },


    displayProfileForId = function (id) {
        if(typeof id !== "number") {
            id = parseInt(id, 10); }
        resetReviewDisplays();
        findOrLoadPen(id, mainDisplay);
    };


    mor.profile = {
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            if(profpen) {
                writeNavDisplay(profpen); }
            else {
                mor.pen.getPen(writeNavDisplay); } },
        settings: function () {
            mor.pen.getPen(changeSettings); },
        penswitch: function () {
            mor.pen.getPen(changePens); },
        recent: function () {
            recent(); },
        best: function () {
            best(); },
        following: function () {
            following(); },
        followers: function () {
            followers(); },
        search: function () {
            displaySearchForm(); },
        togglesrchopts: function () {
            toggleSearchOptions(); },
        resetReviews: function () {
            resetReviewDisplays(); },
        authorized: function (pen) {
            if(pen.mid || pen.gid || pen.fbid || pen.twid) {
                return true; }
            return false; },
        save: function () {
            mor.pen.getPen(saveEditedProfile); },
        setPenName: function () {
            mor.pen.getPen(setPenNameFromInput); },
        saveSettings: function () {
            mor.pen.getPen(savePenNameSettings); },
        byprofid: function (id) {
            displayProfileForId(id); },
        changeid: function (id) {
            currtab = recent;
            displayProfileForId(id); },
        initWithId: function (id) {
            mor.pen.getPen(function (pen) { displayProfileForId(id); }); },
        setTab: function (tabstr) {
            setCurrTabFromString(tabstr); },
        srchmore: function () {
            doPenSearch(); },
        relationship: function () {
            createOrEditRelationship(); },
        retrievePen: function (id, callback) {
            return findOrLoadPen(id, callback); },
        penListItemHTML: function (pen) {
            return penListItemHTML(pen); },
        updateCache: function (pen) {
            updateCache(pen); },
        currentTabAsString: function () {
            return getCurrTabAsString(); },
        revsmore: function (tab) {
            return fetchMoreReviews(tab); },
        readReview: function (revid) {
            return readReview(revid); }
    };

} () );



////////////////////////////////////////
// m o r . p e n
//
(function () {
    "use strict";

    var penNames,
        currpen,
        returnFuncMemo,  //if a form display is needed


    //update the currently stored version of the pen.
    noteUpdatedPen = function (pen) {
        var i, penid = mor.instId(pen);
        for(i = 0; penNames && i < penNames.length; i += 1) {
            if(mor.instId(penNames[i]) === penid) {
                penNames[i] = pen;
                break; } }
        if(mor.instId(currpen) === penid) {
            currpen = pen; }
    },


    //returns the referenced pen if it is owned by the current user
    getHomePen = function (penid) {
        var i;
        for(i = 0; penNames && i < penNames.length; i += 1) {
            if(mor.instId(penNames[i]) === penid) {
                return penNames[i]; } }
    },


    serializeSettings = function (penName) {
        if(typeof penName.settings === 'object') {
            penName.settings = mor.dojo.json.stringify(penName.settings); }
    },


    deserializeSettings = function (penName) {
        var text, obj;
        if(!penName.settings) {
            penName.settings = {}; }
        else if(typeof penName.settings !== 'object') {
            try {  //extra vars help debug things like double encoding..
                text = penName.settings;
                obj = mor.dojo.json.parse(text);
                penName.settings = obj;
            } catch (e) {
                mor.log("deserializeSettings " + penName.name + ": " + e);
                penName.settings = {};
            } }
        if(typeof penName.settings !== 'object') {
            mor.log("Re-initializing penName settings.  Deserialized value " +
                    "was not an object: " + penName.settings);
            penName.settings = {}; }
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        mor.layout.initContent();  //may call for pen name retrieval...
        mor.rel.loadoutbound(currpen);
        callback(currpen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data;
        serializeSettings(pen);
        data = mor.objdata(pen);
        mor.call("updpen?" + mor.login.authparams(), 'POST', data,
                 function (updpens) {
                     currpen = updpens[0];
                     deserializeSettings(currpen);
                     callok(currpen); },
                 function (code, errtxt) {
                     callfail(code, errtxt); });
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name;
        name = mor.byId('pnamein').value;
        buttonhtml = mor.byId('formbuttons').innerHTML;
        mor.out('formbuttons', "Creating Pen Name...");
        newpen = {};
        newpen.name = name;
        if(currpen && currpen.settings) {
            newpen.settings = currpen.settings;
            serializeSettings(newpen); }
        data = mor.objdata(newpen);
        mor.call("newpen?" + mor.login.authparams(), 'POST', data,
                 function (newpens) {
                     currpen = newpens[0];
                     if(!penNames) {
                         penNames = []; }
                     penNames.push(currpen);
                     deserializeSettings(currpen);
                     returnCall(); },
                 function (code, errtxt) {
                     mor.out('penformstat', errtxt);
                     mor.out('formbuttons', buttonhtml); });
    },


    newPenNameDisplay = function (callback) {
        var html;
        returnFuncMemo = callback;
        html = "<p>Your pen name is a unique expression of style when presenting your views to the world. You can have separate pen names for each of your personas, revealing as much (or as little) about yourself as you want. Use your real name, or get creative...</p>" +
        "<div id=\"penformstat\">&nbsp;</div>" +
        "<table>" +
          "<tr>" +
            "<td class=\"formattr\">Pen Name</td>" +
            "<td class=\"formval\">" +
              "<input type=\"text\" id=\"pnamein\" size=\"34\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"formbuttons\"align=\"center\">" +
              "<button type=\"button\" id=\"createbutton\">Create</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('contentdiv', html);
        mor.onchange('pnamein', createPenName);
        mor.onclick('createbutton', createPenName);
        mor.layout.adjust();
        mor.byId('pnamein').focus();
    },


    selectPenByName = function (name) {
        var i;
        for(i = 0; i < penNames.length; i += 1) {
            if(penNames[i].name === name) {
                currpen = penNames[i];
                mor.skinner.setColorsFromPen(currpen);
                //update the accessed time so that the latest pen name is
                //chosen by default next time. 
                updatePenName(penNames[i], 
                              mor.profile.display, mor.profile.display);
                break; } }
    },


    chooseOrCreatePenName = function (callback) {
        var i, lastChosen = "0000-00-00T00:00:00Z";
        if(penNames.length === 0) {
            return newPenNameDisplay(callback); }
        for(i = 0; i < penNames.length; i += 1) {
            deserializeSettings(penNames[i]);
            if(penNames[i].accessed > lastChosen) {
                lastChosen = penNames[i].accessed;
                currpen = penNames[i]; } }
        mor.skinner.setColorsFromPen(currpen);
        returnCall(callback);
    },


    getPenName = function (callback) {
        var url;
        if(penNames) {
            chooseOrCreatePenName(callback); }
        mor.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        mor.layout.adjust();
        url = "mypens?" + mor.login.authparams();
        mor.call(url, 'GET', null,
                 function (pens) {
                     penNames = pens;
                     chooseOrCreatePenName(callback); },
                 function (code, errtxt) {
                     mor.out('contentdiv', 
                             "Pen name retrieval failed: " + errtxt); });
    };


    mor.pen = {
        getPen: function (callback) {
            if(currpen) {
                return returnCall(callback); }
            getPenName(callback); },
        updatePen: function (pen, callbackok, callbackfail) {
            updatePenName(pen, callbackok, callbackfail); },
        noteUpdatedPen: function (pen) {
            noteUpdatedPen(pen); },
        getPenNames: function () { 
            return penNames; },
        newPenName: function (callback) {
            newPenNameDisplay(callback); },
        selectPenByName: function (name) {
            selectPenByName(name); },
        getHomePen: function (penid) {
            return getHomePen(penid); }
    };

} () );



////////////////////////////////////////
// m o r . r e l
//
(function () {
    "use strict";

    var outboundRels,
        loadoutcursor,
        asyncLoadStarted,


    loadDisplayRels = function (dispobj) {
        var params, field;
        if(dispobj.direction === "outbound") {
            field = "originid"; }
        else { //inbound
            field = "relatedid"; }
        params = mor.login.authparams() + "&" + field + "=" +
            mor.instId(dispobj.profpen);
        if(dispobj.cursor) {
            params += "&cursor=" + dispobj.cursor; }
        else if(dispobj.offset) {
            params += "&offset=" + dispobj.offset; }
        mor.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i;
                     dispobj.rels = [];
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 dispobj.cursor = relationships[i].cursor; }
                             break; }
                         dispobj.rels.push(relationships[i]); }
                     mor.rel.displayRelations(dispobj); },
                 function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     mor.log(msg);
                     mor.err(msg); });
    },


    loadDisplayRelPens = function (dispobj) {
        var rel = dispobj.rels[dispobj.pens.length], id;
        if(dispobj.direction === "outbound") {
            id = rel.relatedid; }
        else { //inbound
            id = rel.originid; }
        mor.profile.retrievePen(id, function (pen) {
            dispobj.pens.push(pen);
            mor.rel.displayRelations(dispobj); });
    },


    //factored method to avoid a firebug stepping bug
    dumpPenItems = function (dispobj) {
        var i, html = "";
        for(i = 0; i < dispobj.pens.length; i += 1) {
            html += mor.profile.penListItemHTML(dispobj.pens[i]); }
        return html;
    },


    //offset, cursor, rels and pens stored in dispobj to preserve state
    displayRelatedPens = function (dispobj) {
        var html;
        if(!dispobj) {
            mor.err("displayRelatedPens called without display object");
            return; }
        html = "<ul class=\"penlist\">";
        //display whatever pens have been retrieved so far
        if(dispobj.rels) {
            if(dispobj.pens && dispobj.pens.length > 0) {
                html += dumpPenItems(dispobj); }
            else if(dispobj.rels.length === 0) {
                if(dispobj.direction === "outbound") {
                    html += "<li>Not following anyone</li>"; }
                else { //inbound
                    html += "<li>No followers</li>"; } }
            else {
                html += "<li>fetching pen names...</li>"; } }
        else {  //dump an interim placeholder while retrieving rels
            html += "<li>fetching relationships...</li>"; }
        html += "</ul>";
        //ATTENTION: need prev/next buttons for paging
        mor.out(dispobj.divid, html);
        //if any info needs to be filled in, then go get it...
        if(!dispobj.rels) { 
            return loadDisplayRels(dispobj); }
        if(!dispobj.pens) {
            dispobj.pens = []; }
        if(dispobj.rels.length !== dispobj.pens.length) {
            return loadDisplayRelPens(dispobj); }
    },


    setFormValuesFromRel = function (rel) {
        var mutes, i;
        if(rel.status === "blocked") {
            mor.byId('block').checked = true; }
        else {
            mor.byId('follow').checked = true; }
        if(rel.mute) {
            mutes = rel.mute.split(',');
            for(i = 0; i < mutes.length; i += 1) {
                mor.byId(mutes[i]).checked = true; } }
    },


    setRelFieldsFromFormValues = function (rel) {
        var checkboxes, i;
        if(mor.byId('follow').checked) {
            rel.status = "following"; }
        else if(mor.byId('block').checked) {
            rel.status = "blocked"; }
        else if(mor.byId('nofollow').checked) {
            rel.status = "nofollow"; }
        rel.mute = "";
        checkboxes = document.getElementsByName("mtype");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(rel.mute) {
                    rel.mute += ","; }
                rel.mute += checkboxes[i].value; } }
    },


    removeOutboundRel = function (rel) {
        var i, relid = mor.instId(rel);
        for(i = 0; i < outboundRels.length; i += 1) {
            if(mor.instId(outboundRels[i]) === relid) {
                break; } }
        if(i < outboundRels.length) {  //found it
            outboundRels.splice(i, 1); }
    },


    updateOutboundRel = function (rel) {
        var i, relid = mor.instId(rel);
        for(i = 0; i < outboundRels.length; i += 1) {
            if(mor.instId(outboundRels[i]) === relid) {
                outboundRels[i] = rel;
                break; } }
    },


    updateRelationship = function (rel) {
        var data = mor.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            mor.call("delrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         mor.pen.noteUpdatedPen(updates[0]);  //originator
                         mor.profile.updateCache(updates[1]); //related
                         removeOutboundRel(rel);              //relationship
                         mor.layout.closeDialog();
                         mor.profile.byprofid(mor.instId(updates[1])); },
                     function (code, errtxt) {
                         mor.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); }); }
        else { //update
            mor.call("updrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         updateOutboundRel(updates[0]);       //relationship
                         mor.layout.closeDialog();
                         mor.profile.byprofid(updates[0].relatedid); },
                     function (code, errtxt) {
                         mor.err("Relationship update failed code " + code +
                                 ": " + errtxt); }); }
    },


    //The data model supports a minimum rating cutoff, but until this
    //actually becomes useful in controlling activity noise it's being
    //ignored in the interest of getting fundamental features in place.
    displayRelationshipDialog = function (rel, related) {
        var html = "<table class=\"formstyle\">" +
          "<tr>" +
            "<td>" +
              "<b>Status</b> " + 
              mor.radiobutton("fstat", "follow") + "&nbsp;" +
              mor.radiobutton("fstat", "block") + "&nbsp;" +
              mor.radiobutton("fstat", "nofollow", "Stop Following") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td>" +
              "<b>Ignore all reviews from " + related.name + " about</b>" +
              mor.review.reviewTypeCheckboxesHTML("mtype") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('dlgdiv', html);
        setFormValuesFromRel(rel);
        mor.onclick('cancelbutton', mor.layout.closeDialog);
        mor.onclick('savebutton', function () {
            mor.out('settingsbuttons', "Saving...");
            setRelFieldsFromFormValues(rel);
            updateRelationship(rel); });
        mor.byId('dlgdiv').style.visibility = "visible";
        mor.onescapefunc = mor.layout.closeDialog;
    },


    findOutboundRelationship = function (relatedid) {
        var i;
        for(i = 0; outboundRels && i < outboundRels.length; i += 1) {
            if(outboundRels[i].relatedid === relatedid) {
                return outboundRels[i]; } }
    },


    createOrEditRelationship = function (originator, related) {
        var rel, newrel, data;
        rel = findOutboundRelationship(mor.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            newrel = {};
            newrel.originid = mor.instId(originator);
            newrel.relatedid = mor.instId(related);
            newrel.status = "following";
            newrel.mute = "";
            newrel.cutoff = 0;
            data = mor.objdata(newrel);
            mor.call("newrel?" + mor.login.authparams(), 'POST', data,
                     function (newrels) {
                         mor.pen.noteUpdatedPen(newrels[0]);  //originator
                         mor.profile.updateCache(newrels[1]); //related
                         outboundRels.push(newrels[2]);       //relationship
                         mor.profile.byprofid(mor.instId(newrels[1])); },
                     function (code, errtxt) {
                         mor.err("Relationship creation failed code " + code +
                                 ": " + errtxt); }); }
    },


    relationshipsLoadFinished = function (pen) {
        mor.profile.updateHeading();
    },


    loadOutboundRelationships = function (pen) {
        var params;
        params = mor.login.authparams() + "&originid=" + mor.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + mor.enc(loadoutcursor); }
        mor.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i;
                     loadoutcursor = "";
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 loadoutcursor = relationships[i].cursor; }
                             break; }
                         outboundRels.push(relationships[i]); }
                     if(loadoutcursor) {
                         setTimeout(function () {
                             loadOutboundRelationships(pen); }, 50); }
                     else {
                         relationshipsLoadFinished(pen); } },
                 function (code, errtxt) {
                     mor.log("loadOutboundRelationships errcode " + code +
                             ": " + errtxt);
                     alert("Sorry. Data error. Please reload the page"); });
    },


    //kick off loading all the outbound relationships, but do not
    //block since nobody wants to sit and wait for it.  Protect
    //against duplicate calls, since that can happen as closures
    //are establishing their state at startup.
    asyncLoadOutboundRelationships = function (pen) {
        if(asyncLoadStarted) {
            return; }
        asyncLoadStarted = true;
        setTimeout(function () {
            outboundRels = [];
            loadoutcursor = "starting";
            loadOutboundRelationships(pen); }, 500);
    };


    mor.rel = {
        reledit: function (from, to) {
            createOrEditRelationship(from, to); },
        outbound: function (relatedid) {
            return findOutboundRelationship(relatedid); },
        loadoutbound: function (pen) {
            asyncLoadOutboundRelationships(pen); },
        alloutbound: function () {
            return outboundRels; },
        displayRelations: function (dispobj) {
            return displayRelatedPens(dispobj); }
    };

} () );



////////////////////////////////////////
// m o r . s k i n n e r 
//
(function () {
    "use strict";

    var oldcolors,
        colorcontrols,
        presets = [ { name: "paper (warm)", id: "paperw", 
                      bodybg: "#fffff6", text: "#111111",
                      link: "#3150b2", hover: "#3399cc" },
                    { name: "paper (cool)", id: "paperc",
                      bodybg: "#f8f8f8", text: "#000000",
                      link: "#006666", hover: "#3399cc" },
                    { name: "sky", id: "sky",
                      bodybg: "#caf1f8", text: "#000000",
                      link: "#ae464b", hover: "#fc464b" },
                    { name: "pink", id: "pink",
                      bodybg: "#ffeef3", text: "#000000",
                      link: "#dd464b", hover: "#ff464b" },
                    { name: "matrix", id: "matrix",
                      bodybg: "#000000", text: "#00cc00",
                      link: "#006666", hover: "#3399cc" }
                  ],


    copycolors = function (colors) {
        var cc = { bodybg: colors.bodybg,
                   text: colors.text,
                   link: colors.link,
                   hover: colors.hover };
        return cc;
    },


    safeSetColorProp = function (rule, color) {
        if(rule.style.setProperty) {
            rule.style.setProperty('color', color, null); }
    },


    updateColors = function () {
        var rules, i;
        mor.byId('bodyid').style.backgroundColor = mor.colors.bodybg;
        mor.byId('bodyid').style.color = mor.colors.text;
        rules = document.styleSheets[0].cssRules;
        for(i = 0; rules && i < rules.length; i += 1) {
            if(mor.prefixed(rules[i].cssText, "A:link")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:visited")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:active")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:hover")) {
                safeSetColorProp(rules[i], mor.colors.hover); } }
    },


    cancelSkinChange = function () {
        mor.colors = oldcolors;
        updateColors();
    },


    saveSkinChangeSettings = function (pen) {
        pen.settings.colors = copycolors(mor.colors);
    },


    setColorsFromPen = function (pen) {
        if(pen && pen.settings && pen.settings.colors) {
            mor.colors = copycolors(pen.settings.colors);
            updateColors(); }
    },


    colorToColorArray = function (color) {
        var cvals;
        if(color.indexOf("#") >= 0) {
            color = color.slice(1); }
        color = color.toUpperCase();
        cvals = [ parseInt(color.slice(0,2), 16),
                  parseInt(color.slice(2,4), 16),
                  parseInt(color.slice(4,6), 16) ];
        return cvals;
    },


    colorArrayToColor = function (cvals) {
        var color = "#", val, i;
        for(i = 0; i < cvals.length; i += 1) {
            val = cvals[i].toString(16);
            if(val.length < 2) {
                val = "0" + val; }
            color += val; }
        return color;
    },


    cvalAdjust = function (cvals, index, bump) {
        cvals[index] += bump;
        if(cvals[index] > 255) { cvals[index] = 255; }
        if(cvals[index] < 0) { cvals[index] = 0; }
    },


    colorBump = function (colorfield, index, bump) {
        var color = mor.colors[colorfield], cvals;
        cvals = colorToColorArray(color);
        cvalAdjust(cvals, index, bump);
        color = colorArrayToColor(cvals);
        return color;
    },


    adjustColor = function (color, adj) {
        var cvals;
        cvals = colorToColorArray(color);
        cvalAdjust(cvals, 0, adj);
        cvalAdjust(cvals, 1, adj);
        cvalAdjust(cvals, 2, adj);
        color = colorArrayToColor(cvals);
        return color;
    },


    getLightBackground = function () {
        if(!mor.colors.lightbg) {
            mor.colors.lightbg = adjustColor(mor.colors.bodybg, 4); }
        return mor.colors.lightbg;
    },


    getDarkBackground = function () {
        if(!mor.colors.darkbg) {
            mor.colors.darkbg = adjustColor(mor.colors.bodybg, -6); }
        return mor.colors.darkbg;
    },


    safeSetColor = function (colorfield, domid, color) {
        var cvals, i;
        if(color.indexOf("#") === 0) {
            color = color.slice(1); }
        if(color.length === 3) {  //e.g. #ccc
            color = color.slice(0,1) + color.slice(0,1) +
                    color.slice(1,2) + color.slice(1,2) +
                    color.slice(2) + color.slice(2); }
        if(color.length !== 6) {
            alert("Not a valid html color code.");
            return; }
        cvals = colorToColorArray(color);
        for(i = 0; i < cvals.length; i += 1) {
            if(typeof cvals[i] !== "number" ||
               cvals[i] < 0 || cvals[i] > 255) {
                alert("Not a valid html color code.");
                return; } }
        color = colorArrayToColor(cvals);
        mor.colors[colorfield] = color;
        mor.byId(domid).value = color;
        updateColors();
    },


    colorControl = function (domid, colorfield) {
        mor.onx("change", domid, function (e) {
            var color = mor.byId(domid).value;
            e.preventDefault();
            e.stopPropagation();
            safeSetColor(colorfield, domid, color);
            updateColors(); });
        mor.onx("keypress", domid, function (e) {
            var outval = e.keyCode;
            switch(e.keyCode) {
            case 82:  //R - increase Red
                outval = colorBump(colorfield, 0, 1); break;
            case 114: //r - decrease Red
                outval = colorBump(colorfield, 0, -1); break;
            case 71:  //G - increase Green
                outval = colorBump(colorfield, 1, 1); break;
            case 103: //g - decrease Green
                outval = colorBump(colorfield, 1, -1); break;
            case 85:  //U - increase Blue
                outval = colorBump(colorfield, 2, 1); break;
            case 117: //u - decrease Blue
                outval = colorBump(colorfield, 2, -1); break;
            }
            if(typeof outval === "string") {
                e.preventDefault();
                e.stopPropagation();
                mor.colors[colorfield] = outval;
                mor.byId(domid).value = outval;
                updateColors(); } });
        colorcontrols.push([domid, colorfield]);
    },


   setControlValuesAndUpdate = function (colors) {
       var i, input;
       for(i = 0; i < colorcontrols.length; i += 1) {
           input = mor.byId(colorcontrols[i][0]);
           input.value = colors[colorcontrols[i][1]]; }
       mor.colors = copycolors(colors);
       updateColors();
   },


    setColorsFromPreset = function (pen) {
        var i, sel = mor.byId('presetsel');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                pen.settings.colorPresetId = presets[i].id;
                setControlValuesAndUpdate(presets[i]);
                break; } }
    },


    presetSelectorHTML = function (pen) {
        var html, i;
        html = "<table>" +
          "<tr>" + 
            "<td align=\"right\">Starting preset skin</td>" +
            "<td align=\"left\">" +
                "<select id=\"presetsel\">";
        for(i = 0; i < presets.length; i += 1) {
            html += "<option id=\"" + presets[i].id + "\"";
            if(pen && pen.settings.colorPresetId === presets[i].id) {
                html += " selected=\"selected\""; }
            html += ">" + 
                presets[i].name + "</option>"; }
        html += "</select>" +
          "</tr>" +
        "</table>";
        return html;
    },


    colorControlsHTML = function () {
        var link = "", hover = "", html;
        if(document.styleSheets[0].cssRules[0].style.setProperty) {
            link = "</td>" +
            "<td align=\"right\">link</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"linkin\" size=\"7\"" + 
                    " value=\"" + mor.colors.link + "\"/>" + 
                "</td>";
            hover = "</td>" +
            "<td align=\"right\">hover</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"hoverin\" size=\"7\"" + 
                    " value=\"" + mor.colors.hover + "\"/>" + 
                "</td>"; }
        html = "R/r, G/g, U/u to adjust Red/Green/Blue..." +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">background</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"bgbodyin\" size=\"7\"" + 
                    " value=\"" + mor.colors.bodybg + "\"/></td>" + 
            link + 
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">text</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"textcolin\" size=\"7\"" + 
                    " value=\"" + mor.colors.text + "\"/></td>" + 
            hover +
          "</tr>" +
        "</table>";
        return html;
    },


    displayDialog = function (domid, pen) {
        var html;
        oldcolors = copycolors(mor.colors);
        colorcontrols = [];
        html = presetSelectorHTML(pen) + colorControlsHTML();
        mor.out(domid, html);
        colorControl("bgbodyin", "bodybg");
        colorControl("textcolin", "text");
        if(document.styleSheets[0].cssRules[0].style.setProperty) {
            colorControl("linkin", "link");
            colorControl("hoverin", "hover"); }
        mor.onx('change', 'presetsel', function (e) {
            e.preventDefault();
            e.stopPropagation();
            mor.pen.getPen(setColorsFromPreset); });
    };


    mor.skinner = {
        init: function (domid, pen) {
            displayDialog(domid, pen); },
        cancel: function () {
            cancelSkinChange(); },
        save: function (pen) {
            saveSkinChangeSettings(pen); },
        setColorsFromPen: function (pen) {
            setColorsFromPen(pen); },
        lightbg: function () {
            return getLightBackground(); },
        darkbg: function () {
            return getDarkBackground(); }
    };

} () );

