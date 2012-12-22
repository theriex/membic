/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l o g i n
//
define([], function () {
    "use strict";

    var loginprompt = "Please log in, or use an existing social account",
        authmethod = "",
        authtoken = "",
        authname = "",
        morAccountId = 0,
        cookname = "myopenreviewsauth",
        cookdelim = "..morauth..",
        changepwdprompt = "Changing your login password",
        secsvr = "https://myopenreviews.appspot.com",
        mainsvr = "http://www.myopenreviews.com",
        altauths = [],


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


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie
        mor.dojo.cookie(cookname, "", { expires: 0 });
        authmethod = "";
        authtoken = "";
        authname = "";
        morAccountId = 0;
        mor.review.resetStateVars();
        mor.activity.resetStateVars();
        mor.profile.resetStateVars();
        mor.pen.resetStateVars();
        mor.rel.resetStateVars();
    },


    logout = function () {
        logoutWithNoDisplayUpdate();
        mor.historyCheckpoint({ view: "profile", profid: 0 });
        mor.login.updateAuthentDisplay();
        mor.login.init();
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


    parseHashParams = function () {
        var hash = window.location.hash, params = {}, avs, av, i;
        if(hash) {
            if(hash.indexOf("#") === 0) {
                hash = hash.slice(1); }
            avs = hash.split('&');
            for(i = 0; i < avs.length; i += 1) {
                av = avs[i].split('=');
                params[av[0]] = av[1]; } }
        return params;
    },


    doneWorkingWithAccount = function () {
        var tag, state, params = parseHashParams(), redurl;
        if(params.returnto) {
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            window.location.href = redurl; }
        //no explicit redirect, so check if directed by tag
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
        //go with default display
        mor.activity.display();
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
            html += "<div id=\"topnav\">" +
              "<table id=\"navdisplaytable\">" +
                "<tr>" +
                  "<td></td>" +
                  "<td rowspan=\"2\">" +
                    "<div id=\"profhdiv\">" +
                      "<span id=\"penhnamespan\"> </span>" +
                      "<span id=\"penhbuttonspan\"> </span>" +
                    "</div></td>" +
                  "<td>" +
                    "<div id=\"accountdiv\"></div> </td>" +
                "</tr>" +
                "<tr>" +
                  "<td><div id=\"acthdiv\"></div></td>" +
                  "<td><div id=\"revhdiv\"></div></td>" +
                "</tr>" +
              "</table></div>";
            mor.out('topdiv', html);
            //ATTENTION: add mini logo if 3rd party auth...
            html = "<em>" + authname + "</em>";
            html += " &nbsp; <a id=\"logout\" href=\"logout\">logout</a>";
            if(authmethod === "mid") {
                html += " &nbsp; <a id=\"cpwd\" href=\"changepwd\">" + 
                    "change password</a>"; }
            mor.out('accountdiv', html);
            mor.onclick('logout', logout);
            if(authmethod === "mid") {
                mor.onclick('cpwd', displayChangePassForm); } }
    },


    createAccount = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            maddr = mor.byId('emailin').value || "",
            data = "", url, buttonhtml;
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        buttonhtml = mor.byId('newaccbuttonstd').innerHTML;
        mor.out('newaccbuttonstd', "Creating new account...");
        data = mor.objdata({ user: username, pass: password, email: maddr });
        mor.call(url, 'POST', data, 
                 function (objs) {
                     setAuthentication("mid", objs[0].token, username);
                     //give new account save a chance to stabilize
                     setTimeout(mor.login.init, 700); },
                 function (code, errtxt) {
                     mor.out('maccstatdiv', errtxt);
                     mor.out('newaccbuttonstd', buttonhtml);  });
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
              "<button type=\"button\" id=\"cancelbutton\"" + 
                     " onclick=\"mor.login.init();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"createbutton\"" + 
                     " onclick=\"mor.login.createAccount();return false;\"" +
                ">Create</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('logindiv', html);
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


    loginButtonHTML = function () {
        var html = "<button type=\"button\" id=\"loginbutton\"" + 
                          " onclick=\"mor.login.upwlogin();return false;\"" +
            ">Log in</button>";
        return html;
    },


    userpassLogin = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            url, data;
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('loginstatdiv', "Please specify a username and password");
            return; }
        mor.out('loginbspan', "Logging in...");
        url = secureURL("login");
        data = mor.objdata({ user: username, pass: password });
        mor.call(url, 'POST', data,
                 function (objs) {
                     morAccountId = mor.instId(objs[0]);
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     mor.out('loginstatdiv', "Login failed: " + errtxt);
                     mor.out('loginbspan', loginButtonHTML()); },
                 [401]);
    },


    //all alternate login is done from the main server
    handleAlternateAuthentication = function (idx) {
        var redurl, params = parseHashParams();
        if(window.location.href.indexOf("localhost") >= 0) {
            mor.err("Not redirecting to main server off localhost. Confusing.");
            return; }
        if(window.location.href.indexOf(mainsvr) !== 0) {
            redurl = mainsvr + "#command=AltAuth" + (+idx);
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            setTimeout(function () {
                window.location.href = redurl; 
            }, 20); }
        else {  //we are on mainsvr at this point
            altauths[idx].authenticate(); }
    },


    redirectToSecureServer = function () {
        var href, state = mor.currState();
        href = secsvr + "#returnto=" + mor.enc(mainsvr) + "&logout=true";
        if(state && state.view === "profile" && state.profid) {
            href += "&reqprof=" + state.profid; }
        window.location.href = href;
    },


    displayAltAuthMethods = function () {
        var i, html;
        html = "<table>";
        for(i = 0; i < altauths.length; i += 1) {
            html += "<tr></td><a href=\"" + 
                altauths[i].loginurl + "\"" +
                " title=\"Log in via " + altauths[i].name + "\"" +
                " onclick=\"mor.login.altLogin(" + i + ");return false;\"" +
                "><img class=\"loginico\"" +
                     " src=\"" + altauths[i].iconurl + "\"" +
                     " border=\"0\"/> " + altauths[i].name + 
                "</a></td></tr>"; }
        html += "</table>";
        mor.out('altauthdiv', html);
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
            "<td rowspan=\"2\"><div id=\"altauthdiv\"></div></td>" +
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
              "<span id=\"loginbspan\">" +
                loginButtonHTML() + 
              "</span>" +
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
        mor.onchange('userin', function () { mor.byId('passin').focus(); });
        mor.onchange('passin', userpassLogin);
        mor.layout.adjust();
        if(authname) {
            mor.byId('userin').value = authname; }
        mor.byId('userin').focus();
        mor.out('loginstatdiv', loginprompt);
        displayAltAuthMethods();
    },


    handleRedirectOrStartWork = function () {
        var idx, params = parseHashParams();
        //set synonyms
        if(params.authmethod) { params.am = params.authmethod; }
        if(params.authtoken) { params.at = params.authtoken; }
        if(params.authname) { params.an = params.authname; }
        //do data directed side effects
        if(params.am && params.at && params.an) {  //have login info
            params.at = mor.enc(params.at);  //restore token encoding 
            setAuthentication(params.am, params.at, params.an); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //on home server, clean the location display
            clearHash(); }
        if(params.view && params.profid) {
            mor.historyCheckpoint({ view: params.view, 
                                    profid: parseInt(params.profid, 10) }); }
        else if(params.revedit) {
            mor.historyCheckpoint({ view: "review", mode: "edit",
                                    revid: parseInt(params.revedit, 10) }); }
        //figure out what to do next
        if(params.command && params.command.indexOf("AltAuth") === 0) {
            idx = params.command.slice("AltAuth".length);
            idx = parseInt(idx, 10);
            handleAlternateAuthentication(idx); }
        else if(authtoken || readAuthCookie()) {
            if(params.command === "chgpwd") {
                displayChangePassForm(); }
            else {  //return redirect or default processing
                doneWorkingWithAccount(); } }
        else if(secureURL("login") === "login") {
            displayLoginForm(); }
        else { 
            redirectToSecureServer(); }
    };


    return {
        init: function () {
            require([ "ext/facebook", "ext/twitter" ],
                    function (facebook, twitter) {
                        if(!mor.facebook) { mor.facebook = facebook; }
                        if(!mor.twitter) { mor.twitter = twitter; }
                        //altauths = [ facebook, twitter ];
                        altauths = [ facebook ];
                        handleRedirectOrStartWork(); }); },
        updateAuthentDisplay: function () {
            updateAuthentDisplay(); },
        displayChangePassForm: function () {
            displayChangePassForm(); },
        authparams: function () {
            return authparams(); },
        logout: function () {
            logout(); },
        altLogin: function (idx) {
            handleAlternateAuthentication(idx); },
        upwlogin: function () {
            userpassLogin(); },
        setAuth: function (method, token, name) {
            setAuthentication(method, token, name); },
        authComplete: function () {
            doneWorkingWithAccount(); },
        createAccount: function () {
            createAccount(); },
        getAuthMethod: function () { return authmethod; },
        getMORAccountId: function () { return morAccountId; },
        mainServer: mainsvr
    };

});

