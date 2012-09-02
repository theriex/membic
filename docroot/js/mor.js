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
    mor.init = function (dom, json, on, request, query, cookie) {
        var cdiv = mor.byId('contentdiv');
        if(!mor.introtext) {  //capture original so we can revert as needed
            mor.introtext = cdiv.innerHTML; }
        mor.dojo = { dom: dom, json: json, on: on, ajax: request,
                     query: query, cookie: cookie };
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
                return mor.activity.display(); } }
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
            token, method, name, returi, command, view, profid, retval;
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
                } }  //end hash walk
            if(method && token && name) {
                setAuthentication(method, token, name);
                retval = command || "done"; }
            if(!returi) {  //back home so clean up the location bar
                clearHash(); }
            if(view && profid) {
                mor.historyCheckpoint({ view: view, profid: profid }); } }
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
        data = mor.objdata({ user: username, pass: password, email: maddr });
        mor.call(url, 'POST', data, 
                 function (objs) {
                     setAuthentication("mid", objs[0].token, username);
                     mor.login.init(); },
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
            "<td colspan=\"2\" align=\"center\">" +
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

    var reviewTypes = [
        { type: "book", plural: "books", img: "TypeBook50.png" },
        { type: "movie", plural: "movies", img: "TypeMovie50.png" },
        { type: "video", plural: "videos", img: "TypeVideo50.png" },
        { type: "music", plural: "music", img: "TypeSong50.png" },
        { type: "wine", plural: "wines", img: "TypeWine50.png" },
        { type: "beer", plural: "beers", img: "TypeBeer50.png" },
        { type: "food", plural: "food", img: "TypeFood50.png" },
        { type: "to do", plural: "things to do", img: "TypeBucket50.png" }
        ],


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
                     " onclick=\"mor.review.display();return false;\"" +
            ">Write a Review</a>";
        mor.out('revhdiv', html);
    },


    mainDisplay = function (penName) {
        var html = "<p>Writing a review is not implemented yet</p>";
        mor.out('cmain', html);
        mor.layout.adjust();
    };


    mor.review = {
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            writeNavDisplay(); },
        getReviewTypes: function () {
            return reviewTypes; },
        getReviewTypeByValue: function (val) {
            return findReviewType(val); },
        reviewTypeCheckboxesHTML: function (cboxgroup) {
            return reviewTypeCheckboxesHTML(cboxgroup); },
        badgeImageHTML: function (type) {
            return badgeImageHTML(type); }
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
        searchparams = {},
        searchresults = [],
        searchcursor = "",
        searchtotal = 0,
        currtab,
        profpen,
        cachepens = [],
        followingDisp,
        followerDisp,


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
            linktitle = "View profile for " + pen.name; }
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


    recent = function () {
        var html = "Recent activity display not implemented yet";
        selectTab("recentli", recent);
        mor.out('profcontdiv', html);
    },


    best = function () {
        var html = "Top rated display not implemented yet";
        selectTab("bestli", best);
        mor.out('profcontdiv', html);
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
        target = mor.winw - 350;
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


    cancelPicUpload = function () {
        mor.out('overlaydiv', "");
        mor.byId('overlaydiv').style.visibility = "hidden";
        mor.onescapefunc = null;
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var odiv, html = "", authfields, i, attval;
        authfields = mor.login.authparams().split("&");
        for(i = 0; i < authfields.length; i += 1) {
            attval = authfields[i].split("=");
            html += "<input type=\"hidden\" name=\"" + attval[0] + "\"" +
                                          " value=\"" + attval[1] + "\"/>"; }
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + 
            mor.instId(pen) + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#profile") + "\"/>";
        html = "<form action=\"/profpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            html +
            "<table>" +
              "<tr><td>Upload New Profile Pic</td></tr>" +
              "<tr><td><input type=\"file\" name=\"picfilein\"/></td></tr>" +
              "<tr><td align=\"center\">" +
                    "<input type=\"submit\" value=\"Upload\"/></td></tr>" +
            "</form>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = cancelPicUpload;
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
            return getCurrTabAsString(); }
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

