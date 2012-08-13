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
    mor.y = null;
    mor.colors = { bodybg: "#fffff6",
                   text: "#111111",
                   link: "#3150b2",
                   hover: "#3399cc" };
    mor.winw = 0;  //adjusted in mor.layout
    mor.winh = 0;
    mor.introtext = "";

    ////////////////////////////////////////
    //prototype mods and globals
    /////////////////////////////////////////

    if(!String.prototype.trim) {  //thanks to Douglas Crockford
        String.prototype.trim = function () {
            return this.replace(/^\s*(\S*(?:\s+\S+)*)\s*$/, "$1");
        };
    }


    ////////////////////////////////////////
    // general utility functions
    ////////////////////////////////////////

    //ATTENTION: need history pop

    //IE7 has no history.pushState, so route all stack pushes here
    mor.historyPush = function (data, title, url) {
        if(history && history.pushState &&
                                typeof history.pushState === 'function') {
            history.pushState(data, title, url); }
    };


    //shorthand to log text to the console
    mor.log = function (text) {
        try {
            if(console && console.log) {
                console.log(text); }
        } catch(problem) {  //most likely a bad IE console def, just skip it
        }
    };


    //when you really want the DOM element, not the library node wrapper
    mor.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    //output via the library so it can do housekeeping if it needs to
    mor.out = function (domid, html) {
        var node = mor.y.one("#" + domid);
        if(node) {
            node.setHTML(html); }
        else {
            mor.log("DOM id " + domid + " not available for output"); }
    };


    //factored method to handle a click with no propagation
    mor.onclick = function (divid, func) {
        var node = mor.y.one("#" + divid);
        node.on("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                func(); });
    };


    //factored method to handle a change with no propagation
    mor.onchange = function (divid, func) {
        var node = mor.y.one("#" + divid);
        node.on("change", function (e) {
                e.preventDefault();
                e.stopPropagation();
                func(); });
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


    //top level kickoff function called from index.html
    mor.init = function (Y) {
        var cdiv = mor.byId('contentdiv');
        if(!mor.introtext) {
            mor.introtext = cdiv.innerHTML; }
        mor.y = Y;
        mor.layout.init();
        mor.y.on("keypress", mor.globkey);
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
    mor.call = function (url, method, data, success, failure, errs) {
        mor.y.io(url, { method: method, data: data,
            on: { success: function (transid, resp) {
                        try {
                            resp = mor.y.JSON.parse(resp.responseText);
                        } catch (e) {
                            mor.log("JSON parse failure: " + e);
                            return failure("Bad data returned");
                        }
                        success(resp); },
                  failure: function (transid, resp) {
                        var code = resp.status, errtxt = resp.responseText;
                        if(!errs) {
                            errs = []; }
                        if(mor.y.Array.indexOf(errs, code) < 0) {
                            switch(code) {
                            case 401: return mor.login.logout();
                            case 500: return mor.crash(url, method, data,
                                                       code, errtxt);
                            } }
                        failure(code, errtxt); } } });
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
          "<a id=\"closedlg\" href=\"#close\">&lt;close&nbsp;&nbsp;X&gt;</a>" +
          "</div>" + html;
        mor.out('dlgdiv', html);
        mor.onclick('closedlg', closeDialog);
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
        mor.y.io(url, { method: 'GET',
            on: { complete: function (transid, resp) {
                        displayDocContent(url, resp.responseText); } } });
    },


    localDocLinks = function () {
        var nodelist = mor.y.all('a');
        nodelist.each(function (node) {
                var href = node.getAttribute("href");
                if(href && href.indexOf("docs/") === 0) {
                    node.on("click", function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            displayDoc(this.getAttribute("href")); }); 
                } });
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
            mor.y.on('windowresize', fullContentHeight);
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
        mor.y.Cookie.remove("myopenreviewsauth");
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
        mor.historyPush("", document.title, url); 
    },


    doneWorkingWithAccount = function () {
        var tag, redirect = findReturnToInHash();
        if(redirect) {
            redirect += "#" + authparamsfull();
            window.location.href = redirect; }
        tag = window.location.hash;
        if(tag.indexOf("#") === 0) {
            tag = tag.slice(1); }
        if(tag === "profile") {
            clearHash();
            mor.profile.display(); }
        else {
            //ATTENTION this should be going to mor.activity.display() but
            //currently testing profile so making that the default.
            mor.profile.display(); }
    },


    //On FF14 with noscript installed the cookie gets written as a
    //session cookie regardless of the expiration set here.  Same
    //result using Cookie.set, or just setting document.cookie
    //directly.  On FF14 without noscript, this works.  Just something
    //to be aware of...
    setAuthentication = function (method, token, name) {
        var expiration = new Date();
        expiration.setFullYear(expiration.getFullYear() + 1);
        authmethod = method;
        authtoken = token;
        authname = name;
        if(!findReturnToInHash()) {
            mor.y.Cookie.setSubs("myopenreviewsauth", 
                { method: authmethod, token: authtoken, name: authname },
                { expires: expiration }); }
        mor.login.updateAuthentDisplay();
    },


    readAuthCookie = function () {
        var authentication = mor.y.Cookie.getSubs("myopenreviewsauth");
        if(authentication) {
            authmethod = authentication.method;
            authtoken = authentication.token;
            authname = authentication.name; }
        mor.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    readURLHash = function () {
        var hash = window.location.hash, params, av, i, attr, val,
            token, method, name, returi, command, retval;
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
                } }  //end hash walk
            if(method && token && name) {
                setAuthentication(method, token, name);
                if(!returi) {  //back home so clean up the location bar
                    clearHash(); }
                retval = command || "done"; } }
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

    var

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
            writeNavDisplay(); }
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


    writeNavDisplay = function (pen) {
        var html;
        html = "<a href=\"#Profile\"" +
                 " title=\"Show profile for " + pen.name + "\"" +
                 " onclick=\"mor.profile.display();return false;\"" +
            ">" + pen.name + "</a>";
        mor.out('penhnamespan', html);
        html = mor.imglink("#Settings","Adjust settings for " + pen.name,
                           "mor.profile.settings()", "settings.png") +
            mor.imglink("#PenNames","Switch Pen Names",
                        "mor.profile.penswitch()", "pen.png");
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


    selectTab = function (tabid) {
        var i, ul, li;
        ul = mor.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = mor.skinner.darkbg(); }
        li = mor.byId(tabid);
        li.className = "selectedTab";
        li.style.backgroundColor = mor.colors.bodybg;
    },


    recent = function () {
        var html = "Recent activity display not implemented yet";
        selectTab("recentli");
        mor.out('profcontdiv', html);
    },


    best = function () {
        var html = "Top rated display not implemented yet";
        selectTab("bestli");
        mor.out('profcontdiv', html);
    },


    following = function () {
        var html = "Following display not implemented yet";
        selectTab("followingli");
        mor.out('profcontdiv', html);
    },


    followers = function () {
        var html = "Followers display not implemented yet";
        selectTab("followersli");
        mor.out('profcontdiv', html);
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
            tablink("Following", "mor.profile.following()") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers", "mor.profile.followers()") + 
          "</li>" +
        "</ul>";
        mor.out('proftabsdiv', html);
        recent();
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


    mainDisplay = function (pen) {
        var html;
        //redisplay the heading in case we just switched pen names
        //and this method is being called directly, rather than from
        //general nav clicks.
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
    };


    mor.profile = {
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            mor.pen.getPen(writeNavDisplay); },
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
        authorized: function (pen) {
            if(pen.mid || pen.gid || pen.fbid || pen.twid) {
                return true; }
            return false; },
        save: function () {
            mor.pen.getPen(saveEditedProfile); },
        setPenName: function () {
            mor.pen.getPen(setPenNameFromInput); },
        saveSettings: function () {
            mor.pen.getPen(savePenNameSettings); }
    };

} () );



////////////////////////////////////////
// m o r . p e n
//
(function () {
    "use strict";

    var penNames,
        currpen,
        returnFunc,


    serializeSettings = function (penName) {
        if(typeof penName.settings === 'object') {
            penName.settings = mor.y.JSON.stringify(penName.settings); }
    },


    deserializeSettings = function (penName) {
        var text, obj;
        if(!penName.settings) {
            penName.settings = {}; }
        else if(typeof penName.settings !== 'object') {
            try {  //extra vars help debug things like double encoding..
                text = penName.settings;
                obj = mor.y.JSON.parse(text);
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


    returnCall = function () {
        var callback = returnFunc;
        mor.layout.initContent();  //may call for pen name retrieval...
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


    newPenNameDisplay = function () {
        var html;
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


    chooseOrCreatePenName = function () {
        var i, lastChosen = "0000-00-00T00:00:00Z";
        if(penNames.length === 0) {
            return newPenNameDisplay(); }
        for(i = 0; i < penNames.length; i += 1) {
            deserializeSettings(penNames[i]);
            if(penNames[i].accessed > lastChosen) {
                lastChosen = penNames[i].accessed;
                currpen = penNames[i]; } }
        mor.skinner.setColorsFromPen(currpen);
        returnCall(currpen);
    },


    getPenName = function () {
        var url;
        if(penNames) {
            chooseOrCreatePenName(); }
        mor.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        mor.layout.adjust();
        url = "mypens?" + mor.login.authparams();
        mor.call(url, 'GET', null,
                 function (pens) {
                     penNames = pens;
                     chooseOrCreatePenName(); },
                 function (code, errtxt) {
                     mor.out('contentdiv', 
                             "Pen name retrieval failed: " + errtxt); });
    };


    mor.pen = {
        getPen: function (callback) {
            returnFunc = callback;
            if(currpen) {
                return returnCall(); }
            getPenName(); },
        updatePen: function (pen, callbackok, callbackfail) {
            updatePenName(pen, callbackok, callbackfail); },
        getPenNames: function () { 
            return penNames; },
        newPenName: function (callback) {
            returnFunc = callback;
            newPenNameDisplay(); },
        selectPenByName: function (name) {
            selectPenByName(name); }
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
        if(pen && pen.settings.colors) {
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
        var node = mor.y.one("#" + domid);
        node.on("change", function (e) {
                var color = mor.byId(domid).value;
                e.preventDefault();
                e.stopPropagation();
                safeSetColor(colorfield, domid, color);
                updateColors(); });
        node.on("keypress", function (e) {
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
        mor.y.one("#presetsel").on("change", function (e) {
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

