/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l o g i n
//
define([], function () {
    "use strict";

    var authmethod = "",
        authtoken = "",
        authname = "",
        cookdelim = "..morauth..",
        topworkdivcontents = "",
        changepwdprompt = "Changing your login credentials",
        altauths = [],
        loginhtml = "",


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
        var params, sec; 
        params = "am=" + authmethod + "&at=" + authtoken + 
                 "&an=" + mor.enc(authname);
        sec = mor.dojo.cookie(authtoken);
        if(sec) {
            params += "&as=" + mor.enc(sec); }
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
        mor.dojo.cookie(mor.authcookname, "", { expires: -1 });
        authmethod = "";
        authtoken = "";
        authname = "";
        mor.review.resetStateVars();
        mor.activity.resetStateVars();
        mor.profile.resetStateVars();
        mor.pen.resetStateVars();
        mor.rel.resetStateVars();
    },


    logout = function () {
        logoutWithNoDisplayUpdate();
        mor.profile.cancelPenNameSettings();  //close the dialog if it is up
        mor.historyCheckpoint({ view: "profile", profid: 0 });
        mor.login.updateAuthentDisplay();
        mor.login.init();
    },


    clearParams = function () {
        //this also clears any search parameters to leave a clean url.
        //that way a return call from someplace like twitter doesn't
        //keep token info and similar parameter stuff hanging around.
        var url = window.location.pathname;
        //note this is using the standard html5 history directly.  That's
        //a way to to clear the URL noise without a redirect triggering
        //a page refresh. 
        if(history && history.pushState && 
                      typeof history.pushState === 'function') {
            history.pushState("", document.title, url); }
    },


    doneWorkingWithAccount = function (params) {
        var state, redurl, xpara;
        if(!params) {
            params = mor.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            if(params.command === "chgpwd") {
                params.command = ""; }
            xpara = mor.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no explicit redirect, so check if directed by anchor tag
        if(params.anchor === "profile") {
            clearParams();
            return mor.profile.display(params.action, params.errmsg); }
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
                mor.review.initWithId(state.revid, state.mode,
                                      params.action, params.errmsg); } }
        //go with default display
        mor.activity.display();
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (moracct.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        mor.dojo.cookie(mor.authcookname, cval, { expires: 365 });
        authmethod = method;
        authtoken = token;
        authname = name;
        mor.login.updateAuthentDisplay();
    },


    readAuthCookie = function () {
        var cval, mtn;
        cval = mor.dojo.cookie(mor.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2]; }
        mor.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    redirectToMainServer = function () {
        var url = "http://www.myopenreviews.com";
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    changePassword = function () {
        var pwd, email, data, url, critsec = "";
        pwd = mor.byId('npin').value;
        if(!pwd || !pwd.trim()) {
            changepwdprompt = "New password must have a value";
            return mor.login.displayChangePassForm(); }
        email = mor.byId('npemailin').value;
        url = secureURL("chgpwd");
        data = "pass=" + mor.enc(pwd) + "&email=" + mor.enc(email) +
            "&" + mor.login.authparams();
        mor.call(url, 'POST', data,
                 function (objs) {
                     setAuthentication("mid", objs[0].token, authname);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     changepwdprompt = errtxt;
                     mor.login.displayChangePassForm(); },
                 critsec);
    },


    displayChangePassForm = function () {
        var html = "";
        if(secureURL("chgpwd") !== "chgpwd") {
            window.location.href = mor.secsvr + 
                "#returnto=" + mor.enc(mor.mainsvr) +
                "&command=chgpwd&" + authparams(); }
        mor.login.updateAuthentDisplay("hide");
        html += "<p>&nbsp;</p>" +  //make sure we are not too tight to top
        "<div id=\"chpstatdiv\">" + changepwdprompt + "</div>" +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">username</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" size=\"20\"" + 
                    " value=\"" + authname + "\" disabled=\"disabled\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">new password</td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" id=\"npin\" size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">email</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"npemailin\" size=\"30\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" class=\"actbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"changebutton\">Change</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('contentdiv', html);
        mor.onclick('cancelbutton', redirectToMainServer);
        mor.onclick('changebutton', changePassword);
        mor.layout.adjust();
        mor.byId('npin').focus();
    },


    loginInfoHTML = function () {
        var html, iconurl;
        switch(authmethod) {
            case "mid": iconurl = "img/iconMOR.png"; break;
            case "fbid": iconurl = mor.facebook.iconurl; break;
            case "twid": iconurl = mor.twitter.iconurl; break;
            case "gsid": iconurl = mor.googleplus.iconurl; break;
            case "ghid": iconurl = mor.github.iconurl; break; }
        html = "<img class=\"loginico\" src=\"" + iconurl + "\" /> " +
            "<em>" + authname + "</em> &nbsp; " +
            "<a href=\"logout\" id=\"logout\"" + 
              " onclick=\"mor.login.logout();return false;\"" +
            ">sign out</a>";
        if(authmethod === "mid") {
            html += " &nbsp; " + 
                "<a href=\"changepwd\" id=\"cpwd\"" + 
                  " onclick=\"mor.login.displayChangePassForm();" + 
                             "return false;\"" + 
                ">change password</a>"; }
        return html;
    },


    //create the logged-in display areas
    updateAuthentDisplay = function (override) {
        var html = "";
        if(!topworkdivcontents) {
            topworkdivcontents = mor.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {  //logged in, standard display
            html = "<div id=\"topactionsdiv\">" +
                  "<table id=\"topactionstable\" border=\"0\">" +
                    "<tr>" +
                      "<td><div id=\"homepenhdiv\"></div></td>" + 
                      "<td><div id=\"recentacthdiv\">" + 
                         mor.activity.activityLinkHTML() +
                          "</div></td>" + 
                    "</tr>" +
                    "<tr>" +
                      "<td><div id=\"writerevhdiv\">" + 
                         mor.review.reviewLinkHTML() +
                          "</div></td>" + 
                      "<td><div id=\"rememberedhdiv\">" + 
                         mor.activity.rememberedLinkHTML() +
                          "</div></td>" + 
                    "</tr>" +
                  "</table>" +
                "</div>";
            mor.out('topworkdiv', html);
            mor.byId('logoimg').style.width = "260px";
            mor.byId('logoimg').style.height = "120px";
            mor.byId('logodiv').style.width = "260px";
            mor.byId('topsectiondiv').style.height = "120px";
            mor.byId('topworkdiv').style.marginLeft = "280px";
            mor.byId('mascotdiv').style.top = "135px";
            mor.layout.setTopPaddingAndScroll(250); }
        else if(override === "hide") {  //slogan slide only, others are big
            html = "<img src=\"img/slides/slogan.png\" class=\"slideimg\"/>";
            mor.out('topworkdiv', html); }
        else {  //restore whatever was in index.html to begin with
            mor.out('topworkdiv', topworkdivcontents); }
    },


    createAccount = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            maddr = mor.byId('emailin').value || "",
            data = "", url, buttonhtml, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        buttonhtml = mor.byId('newaccbuttonstd').innerHTML;
        mor.out('newaccbuttonstd', "Creating new account...");
        data = mor.objdata({ user: username, pass: password, email: maddr });
        mor.call(url, 'POST', data, 
                 function (objs) {
                     var html = "<p>Welcome " + username + "! Your account " +
                         "has been created. </p>" +
                         "<p>Signing in...</p>";
                     mor.out('logindiv', html);
                     //same flow here as userpassLogin, but db stable wait..
                     setAuthentication("mid", objs[0].token, username);
                     setTimeout(doneWorkingWithAccount, 3000); },
                 function (code, errtxt) {
                     mor.out('maccstatdiv', errtxt);
                     mor.out('newaccbuttonstd', buttonhtml);  },
                 critsec);
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
            "<td align=\"right\"><label for=\"userin\">username</label></td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" name=\"username\" id=\"userin\"" + 
                    " size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\"><label for=\"passin\">password</label></td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" name=\"password\" id=\"passin\"" + 
                    " size=\"20\"/></td>" +
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
            data = "", critsec = "";
        if(!eaddr || !eaddr.trim() || !mor.isProbablyEmail(eaddr)) {
            mor.out('emcrediv', "Please enter your email address");
            return; }  //nothing to send to
        mor.out('sendbuttons', "Sending...");
        data = "email=" + mor.enc(eaddr);
        mor.call("mailcred", 'POST', data,
                 function (objs) {
                     dispEmailSent(); },
                 function (code, errtxt) {
                     mor.out('emcrediv', errtxt); },
                 critsec);
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
            ">Sign in</button>";
        return html;
    },


    userpassLogin = function () {
        var username = mor.byId('userin').value,
            password = mor.byId('passin').value,
            url, data, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            mor.out('loginstatdiv', "Please specify a username and password");
            return; }
        mor.out('loginbspan', "Signing in...");
        url = secureURL("login");
        data = mor.objdata({ user: username, pass: password });
        mor.call(url, 'POST', data,
                 function (objs) {
                     //same flow here as createAccount
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     mor.out('loginstatdiv', "Login failed: " + errtxt);
                     mor.out('loginbspan', loginButtonHTML()); },
                 critsec, null, [401]);
    },


    //all alternate login is done from the main server. 
    handleAlternateAuthentication = function (idx, params) {
        var redurl;
        if(!params) {
            params = mor.parseParams(); }
        if(window.location.href.indexOf("localhost") >= 0) {
            mor.err("Not redirecting to main server off localhost. Confusing.");
            return; }
        if(window.location.href.indexOf(mor.mainsvr) !== 0) {
            redurl = mor.mainsvr + "#command=AltAuth" + (+idx);
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            setTimeout(function () {
                window.location.href = redurl; 
            }, 20); }
        else {  //we are on mor.mainsvr at this point
            altauths[idx].authenticate(params); }
    },


    displayAltAuthMethods = function () {
        var i, viadisp, html, hrefs = [];
        for(i = 0; i < altauths.length; i += 1) {
            viadisp = altauths[i].loginDispName || altauths[i].name;
            html = "<a href=\"" + altauths[i].loginurl + "\"" +
                      " title=\"Sign in via " + viadisp + "\"" +
                      " onclick=\"mor.login.altLogin(" + i + ");" + 
                                 "return false;\"" +
                "><img class=\"loginico\"" +
                     " src=\"" + altauths[i].iconurl + "\"" +
                     " border=\"0\"/> " +
                "</a>";
            hrefs.push(html); }
        hrefs.shuffle();
        html = "";
        for(i = 0; i < hrefs.length; i += 1) {
            html += "<span class=\"altauthspan\">" + hrefs[i] + "</span>"; }
        return html;
    },


    displayLoginForm = function (params) {
        var name, html = "";
        mor.out('centerhdiv', "");
        mor.byId('loginform').style.display = "inline";
        if(!loginhtml) {  //save original html in case needed later
            loginhtml = mor.byId('logindiv').innerHTML; }
        if(!mor.byId('logindiv')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            mor.out('contentdiv', html); }
        //add url parameters to pass through on form submit
        html = "";
        for(name in params) {
            if(params.hasOwnProperty(name)) {
                html += "<input type=\"hidden\" name=\"" + name + "\"" +
                              " value=\"" + params[name] + "\"/>"; } }
        if(!params.returnto) {
            //window.location.origin is webkit only
            html += "<input type=\"hidden\" name=\"returnto\"" + 
                          " value=\"" + window.location.protocol + "//" + 
                                        window.location.host + "\"/>"; }
        mor.out('loginparaminputs', html);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            mor.out('loginstatdiv', params.loginerr); }
        mor.out('sittd', "Sign in directly...");
        mor.out('osacctd', "&nbsp;&nbsp;...or with your social account");
        mor.out('altauthmethods', displayAltAuthMethods());
        html = "<a id=\"seclogin\" href=\"#secure login\"" +
                 " title=\"How login credentials are handled securely\"" +
                 " onclick=\"mor.layout.displayDoc('docs/seclogin.html');" +
                            "return false;\">(secured)</a>";
        mor.out('secexp', html);
        mor.byId('seclogin').style.fontSize = "x-small";
        html =  "<a id=\"macc\" href=\"create new account...\"" + 
                  " title=\"Set up a new local login\"" +
            ">" + "Create a new account</a>";
        mor.out('macctd', html);
        mor.onclick('macc', displayNewAccountForm);
        html = "<a id=\"forgotpw\" href=\"forgot credentials...\"" + 
                 " title=\"Retrieve your credentials using the email" + 
                         " address you set for your account\"" +
            ">" + "forgot your password?</a>";
        mor.out('forgotpwtd', html);
        mor.byId('forgotpw').style.fontSize = "x-small";
        mor.onclick('forgotpw', displayEmailCredForm);
        mor.onchange('userin', function () { mor.byId('passin').focus(); });
        mor.layout.adjust();
        if(authname) {
            mor.byId('userin').value = authname; }
        mor.byId('userin').focus();
    },


    logLoadTimes = function () {
        var millis, timer = mor.amdtimer;
        millis = timer.dojo.end.getTime() - timer.dojo.start.getTime();
        mor.log("load dojo: " + millis);
        millis = timer.mor.end.getTime() - timer.mor.start.getTime();
        mor.log("load mor: " + millis);
        millis = timer.ext.end.getTime() - timer.ext.start.getTime();
        mor.log("load ext: " + millis);
    },


    //On localhost, params are lost when the login form is displayed.
    //On the server, they are passed to the secure host and returned
    //post-login.  These are separate flows.  Not supporting a
    //separate param processing path just for local development.
    loggedInDoNextStep = function (params) {
        if(params.command === "chgpwd") {
            displayChangePassForm(); }
        else if(params.command === "remember" || 
                params.command === "respond" ||
                (params.view === "review" && params.revid)) {
            mor.profile.retrievePen(params.penid, function (pen) {
                mor.profile.verifyStateVariableValues(pen);
                mor.review.initWithId(params.revid, "read", params.command); 
            }); }
        else if(params.url) {
            mor.review.readURL(mor.dec(params.url), params); }
        else if(typeof params.mid === "string") {  //empty string on failure
            mor.profile.addMyOpenReviewsAuthId(params.mid); }
        else {  //pass parameters along to the general processing next step
            doneWorkingWithAccount(params); }
    },


    handleRedirectOrStartWork = function () {
        var idx, params = mor.parseParams();
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
            clearParams(); }
        if(params.view && params.profid) {
            mor.historyCheckpoint({ view: params.view, 
                                    profid: params.profid }); }
        else if(params.revedit) {
            mor.historyCheckpoint({ view: "review", mode: "edit",
                                    revid: params.revedit }); }
        //figure out what to do next
        if(params.command && params.command.indexOf("AltAuth") === 0) {
            idx = params.command.slice("AltAuth".length);
            handleAlternateAuthentication(idx, params); }
        else if(params.state && params.state.indexOf("AltAuth") === 0) {
            idx = params.state.slice("AltAuth".length, "AltAuth".length + 1);
            handleAlternateAuthentication(idx, params); }
        else if(authtoken || readAuthCookie()) {  //already logged in...
            loggedInDoNextStep(params); }
        else if(secureURL("login") === "login") {
            displayLoginForm(params); }
        else { 
            mor.redirectToSecureServer(params); }
    };


    return {
        init: function () {
            mor.out('contentfill', "loading login extensions...");
            mor.amdtimer.ext = { start: new Date() };
            require([ "ext/facebook", "ext/twitter", "ext/googleplus", 
                      "ext/github" ],
                    function (facebook, twitter, googleplus,
                              github) {
                        mor.amdtimer.ext.end = new Date();
                        mor.out('contentfill', " &nbsp; ");
                        logLoadTimes();
                        if(!mor.facebook) { mor.facebook = facebook; }
                        if(!mor.twitter) { mor.twitter = twitter; }
                        if(!mor.googleplus) { mor.googleplus = googleplus; }
                        if(!mor.github) { mor.github = github; }
                        //do not change this ordering. Some auths need to
                        //know their index param values.
                        altauths = [ facebook, twitter, googleplus,
                                     github ];
                        handleRedirectOrStartWork(); }); },
        updateAuthentDisplay: function (override) {
            updateAuthentDisplay(override); },
        displayChangePassForm: function () {
            displayChangePassForm(); },
        authparams: function () {
            return authparams(); },
        readAuthCookie: function () {
            return readAuthCookie(); },
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
        loginInfoHTML: function () {
            return loginInfoHTML(); }
    };

});

