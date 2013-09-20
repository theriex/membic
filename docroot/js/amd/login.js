/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

app.login = (function () {
    "use strict";

    var authmethod = "",
        authtoken = "",
        authname = "",
        cookdelim = "..morauth..",
        topworkdivcontents = "",
        altauths = [],
        loginhtml = "",
        sumfreqs = [ "daily", "weekly", "fortnightly", "never" ],
        sumlabels = [ "Daily", "Weekly", "Fortnightly", "Never" ],


    secureURL = function (endpoint) {
        var url = window.location.href;
        if(url.indexOf(":8080") > 0 ||           //local dev or
           url.indexOf("https://") === 0) {      //secure server
            url = endpoint; }  //relative path url ok, data is encrypted
        else {  //not secured, try via XDR although it may not work
            url = app.secsvr + "/" + endpoint; }
        return url;
    },


    authparams = function () {
        var params, sec; 
        params = "am=" + authmethod + "&at=" + authtoken + 
                 "&an=" + app.enc(authname);
        sec = app.cookie(authtoken);
        if(sec) {
            params += "&as=" + app.enc(sec); }
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authmethod=" + authmethod + 
                     "&authtoken=" + authtoken + 
                     "&authname=" + app.enc(authname);
        return params;
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie
        app.cookie(app.authcookname, "", -1);
        authmethod = "";
        authtoken = "";
        authname = "";
        app.review.resetStateVars();
        app.profile.resetStateVars();
        app.pen.resetStateVars();
        app.rel.resetStateVars("logout");
    },


    logout = function () {
        var html;
        logoutWithNoDisplayUpdate();
        app.profile.cancelPenNameSettings();  //close the dialog if it is up
        app.history.checkpoint({ view: "profile", profid: 0 });
        topworkdivcontents = "&nbsp;";  //clear out slideshow, won't fit.
        app.login.updateAuthentDisplay();
        if(!app.byId('logindiv')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            app.out('contentdiv', html); }
        app.login.init();
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
            params = app.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            if(params.command === "chgpwd") {
                params.command = ""; }
            xpara = app.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no explicit redirect, so check if directed by anchor tag
        if(params.anchor === "profile") {
            clearParams();
            return app.profile.display(params.action, params.errmsg); }
        //no tag redirect so check current state
        state = app.history.currState();
        if(state) {
            if(state.view === "profile") {
                if(state.profid) {
                    return app.profile.byprofid(state.profid); }
                return app.profile.display(); }
            if(state.view === "activity") {
                return app.activity.displayActive(); }
            if(state.view === "review" && state.revid) {
                app.review.initWithId(state.revid, state.mode,
                                      params.action, params.errmsg); } }
        //go with default display
        app.activity.displayActive();
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (moracct.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        app.cookie(app.authcookname, cval, 365);
        authmethod = method;
        authtoken = token;
        authname = name;
        app.login.updateAuthentDisplay();
    },


    readAuthCookie = function () {
        var cval, mtn;
        cval = app.cookie(app.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2]; }
        app.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    redirectToMainServer = function (e) {
        var url = app.mainsvr;
        app.evtend(e);
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    updateAccount = function (e) {
        var sel, i, cboxes, csv, data, url, critsec = "";
        app.evtend(e);
        data = "email=" + app.enc(app.byId('emailin').value || "");
        if(authmethod === "mid") {
            data += "&pass=" + app.enc(app.byId('npin').value || ""); }
        sel = app.byId('offsumsel');
        for(i = 0; i < sumfreqs.length; i += 1) {
            if(sel.options[i].selected) {
                data += "&sumfreq=" + sumfreqs[i];
                break; } }
        csv = "";
        cboxes = document.getElementsByName("summaryflags");
        for(i = 0; i < cboxes.length; i += 1) {
            if(cboxes[i].checked) {
                if(csv) {
                    csv += ","; }
                csv += cboxes[i].value; } }
        data += "&sumflags=" + app.enc(csv);
        data += "&" + app.login.authparams();
        url = secureURL("chgpwd");
        app.call('POST', url, data,
                 function (objs) {
                     if(authmethod === "mid") {
                         setAuthentication("mid", objs[0].token, authname); }
                     doneWorkingWithAccount(); },
                 app.failf(function (code, errtxt) {
                     app.out('setstatdiv', "Account settings update failed: " +
                             errtxt); }),
                 critsec);
    },


    emailStatementsRow = function () {
        var html = "<tr>" + 
            "<td colspan=\"3\" align=\"center\">" +
              "<p>MyOpenReviews will not share your email address. </p>" +
              "<p>MyOpenReviews will respect your inbox. </p>" +
            "</td>" +
          "</tr>";
        return html;
    },


    displayUpdateAccountForm = function (account) {
        var html = "", i, title = "Account settings for $USERNAME";
        if(secureURL("chgpwd") !== "chgpwd") {
            window.location.href = app.secsvr + 
                "#returnto=" + app.enc(app.mainsvr) +
                "&command=chgpwd&" + authparams(); }
        app.profile.cancelPenNameSettings();  //close the dialog if it is up
        app.login.updateAuthentDisplay("hide");
        title = title.replace("$USERNAME", authname);
        app.out('centerhdiv', title);
        html += "<table id=\"loginform\" class=\"formstyle\">" +
            "<tr><td colspan=\"3\"><div id=\"setstatdiv\"></div></td></tr>";
        if(authmethod === "mid") {
            html += "<tr>" +
                "<td align=\"right\">New Password</td>" +
                "<td align=\"left\">" +
                  "<input type=\"password\" id=\"npin\" size=\"25\"/></td>" +
                "<td align=\"left\">" +
                  "<button type=\"button\" id=\"chgpwbutton\"" + 
                ">Change Password</button>" +
                "</tr>"; }
        html += "<tr>" +
            "<td align=\"right\">E-mail</td>" +
            "<td align=\"left\">" +
              "<input type=\"email\" id=\"emailin\" size=\"25\"" + 
                    " value=\"" + (account.email || "") + "\"" +
                "/></td>" +
            "<td align=\"left\">" +
              "<button type=\"button\" id=\"updembutton\"" +
                ">Update E-mail</button>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">Offline Summary</td>" +
            "<td align=\"left\">" +
              "<select id=\"offsumsel\">";
        for(i = 0; i < sumfreqs.length; i += 1) {
            html += "<option id=\"" + sumfreqs[i] + "\"";
            if(!account.summaryfreq) {
                account.summaryfreq = "weekly"; }
            if(account.summaryfreq === sumfreqs[i]) {
                html += " selected=\"selected\""; }
            html += ">" + sumlabels[i] + "</option>"; }
        html += "</select></td>" +
          "</tr>" +
          "<tr>" +
            "<td></td>" +
            "<td colspan=\"2\">" +
              app.checkrad("checkbox", "summaryflags", "sumiflogin",
                           "Send summary even if site visited",
                           (account.summaryflags && 
                            account.summaryflags.indexOf('sumiflogin') >= 0)) +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td></td>" +
            "<td colspan=\"2\">" +
              app.checkrad("checkbox", "summaryflags", "sumifnoact",
                           "Send summary even if no reviews from friends",
                           (account.summaryflags && 
                            account.summaryflags.indexOf('sumifnoact') >= 0)) +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" class=\"actbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
          emailStatementsRow() +
        "</table>";
        app.out('contentdiv', html);
        app.on('chgpwbutton', 'click', updateAccount);
        app.on('updembutton', 'click', updateAccount);
        app.on('cancelbutton', 'click', redirectToMainServer);
        app.on('savebutton', 'click', updateAccount);
        app.layout.adjust();
        app.byId('emailin').focus();
    },


    fetchAccAndUpdate = function () {
        var critsec = "";
        app.call('GET', "getacct?" + authparams(), null,
                 function (accarr) {
                     if(accarr.length > 0) {
                         displayUpdateAccountForm(accarr[0]); }
                     else {
                         app.err("No account details available"); } },
                 app.failf(function (code, errtxt) {
                     app.err("Account details retrieval failed: " + code + 
                             " " + errtxt); }),
                 critsec);
    },


    loginInfoHTML = function (pen) {
        var html, iconurl;
        switch(authmethod) {
            case "mid": iconurl = "img/iconMOR.png"; break;
            case "fbid": iconurl = app.facebook.iconurl; break;
            case "twid": iconurl = app.twitter.iconurl; break;
            case "gsid": iconurl = app.googleplus.iconurl; break;
            case "ghid": iconurl = app.github.iconurl; break; }
        html = "<img class=\"loginico\" src=\"" + iconurl + "\" /> " +
            "<em>" + authname + "</em> &nbsp; " +
            "<a href=\"logout\" id=\"logout\"" + 
              " onclick=\"app.login.logout();return false;\"" +
            ">Sign out</a>" +
            "&nbsp;|&nbsp;";
        if(authmethod === "mid") {
            html += "<a href=\"#AccountSettings\" id=\"accset\"" + 
                      " onclick=\"app.login.displayUpdateAccountForm();" + 
                                 "return false;\"" + 
                ">Account settings</a>"; }
        else {
            html += "<a class=\"greytxt\" id=\"accset\"" +
                      " onclick=\"alert('Sign out and login via MyOpenReviews" +
                                      " to access your account settings');" +
                                 "return false;\"" +
                ">Account settings</a>"; }
        return html;
    },


    //create the logged-in display areas
    updateAuthentDisplay = function (override) {
        var html = "";
        if(!topworkdivcontents) {
            topworkdivcontents = app.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {  //logged in, standard display
            html = "<div id=\"topactionsdiv\">" +
                  "<table id=\"topactionstable\" border=\"0\">" +
                    "<tr>" +
                      //"<td></td>" + 
                      "<td><div id=\"homepenhdiv\">" + 
                          //content from profile.updateTopActionDisplay
                          "</div></td>" + 
                      "<td><div id=\"rememberedhdiv\">" + 
                         app.activity.rememberedLinkHTML() +
                          "</div></td>" + 
                      "<td><div id=\"settingsbuttondiv\">" + 
                          //content from profile.updateTopActionDisplay
                          "</div></td>" +
                    "</tr>" +
                    "<tr>" +
                      "<td><div id=\"writerevhdiv\">" + 
                         app.review.reviewLinkHTML() +
                          "</div></td>" + 
                      "<td><div id=\"recentacthdiv\">" + 
                         app.activity.activityLinkHTML() +
                          "</div></td>" + 
                    "</tr>" +
                  "</table>" +
                "</div>";
            app.out('topworkdiv', html);
            if(!app.byId('logoimg')) {
                app.out('logodiv', "<img src=\"img/slides/logoMOR.png\"" +
                        " id=\"logoimg\" border=\"0\"/>"); }
            app.byId('logoimg').style.width = "260px";
            app.byId('logoimg').style.height = "120px";
            app.byId('logodiv').style.width = "260px";
            app.byId('topsectiondiv').style.height = "130px";  //same val below
            app.byId('topworkdiv').style.marginLeft = "280px";
            app.byId('mascotdiv').style.top = "135px";
            app.layout.setTopPaddingAndScroll(130); }  //matches topsectiondiv
        else if(override === "hide") { 
            //html = "<img src=\"img/slides/slogan.png\" class=\"slideimg\"/>";
            html = "";
            app.out('topworkdiv', html); }
        else {  //restore whatever was in index.html to begin with
            app.out('topworkdiv', topworkdivcontents); }
    },


    createAccount = function () {
        var username = app.byId('userin').value,
            password = app.byId('passin').value,
            maddr = app.byId('emailin').value || "",
            data = "", url, buttonhtml, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            app.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        buttonhtml = app.byId('newaccbuttonstd').innerHTML;
        app.out('newaccbuttonstd', "Creating new account...");
        data = app.objdata({ user: username, pass: password, email: maddr });
        app.call('POST', url, data, 
                 function (objs) {
                     var html = "<p>Welcome " + username + "! Your account " +
                         "has been created. </p>" +
                         "<p>Signing in...</p>";
                     app.out('logindiv', html);
                     //same flow here as userpassLogin, but db stable wait..
                     setAuthentication("mid", objs[0].token, username);
                     setTimeout(doneWorkingWithAccount, 3000); },
                 app.failf(function (code, errtxt) {
                     app.out('maccstatdiv', errtxt);
                     app.out('newaccbuttonstd', buttonhtml); }),
                 critsec);
    },


    //Some people habitually use their email address as their username,
    //but if they forget their password it still has to be searched via
    //the email field, so copy it over.  They can fix it if not right.
    onUserNameChange = function (e) {
        var uname;
        app.evtend(e);
        uname = app.byId('userin').value;
        if(app.isProbablyEmail(uname)) {
            app.byId('emailin').value = uname; }
        app.byId('passin').focus();
    },


    onPasswordChange = function (e) {
        app.evtend(e);
        app.byId('emailin').focus();
    },


    onEmailChange = function (e) {
        app.evtend(e);
        createAccount();
    },


    displayNewAccountForm = function () {
        var username, password, html;
        username = app.safestr(app.safeget('userin', "value"));
        password = app.safestr(app.safeget('passin', "value"));
        app.out('centerhdiv', "Creating New Account");
        html = "<table id=\"loginform\" class=\"formstyle\">" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\">" + 
              "<div id=\"maccstatdiv\"></div></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\"><label for=\"userin\">username</label></td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" name=\"username\" id=\"userin\"" + 
                    " size=\"20\" value=\"" + username + "\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\"><label for=\"passin\">password</label></td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" name=\"password\" id=\"passin\"" + 
                    " size=\"20\" value=\"" + password + "\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">email</td>" +
            "<td align=\"left\">" +
              "<input type=\"email\" id=\"emailin\" size=\"30\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" class=\"actbuttons\"" + 
               " id=\"newaccbuttonstd\" >" +
              "<button type=\"button\" id=\"cancelbutton\"" + 
                     " onclick=\"app.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"createbutton\"" + 
                     " onclick=\"app.login.createAccount();return false;\"" +
                ">Create</button>" +
            "</td>" +
          "</tr>" +
          emailStatementsRow() +
        "</table>";
        app.out('logindiv', html);
        app.on('userin', 'change', onUserNameChange);
        app.on('passin', 'change', onPasswordChange);
        app.on('emailin', 'change', onEmailChange);
        app.layout.adjust();
        app.byId('userin').focus();
    },


    onReturnToLogin = function (e) {
        app.evtend(e);
        app.login.init();
    },


    dispEmailSent = function () {
        var html = "";
        html += "<p>Your account information has been emailed to <code>" +
        app.byId('emailin').value + 
        "</code> and should arrive in a few " +
        "minutes.  If it doesn't show up, please </p>" +
        "<ol>" +
        "<li>Make sure your email address is spelled correctly" +
        "<li>Check your spam folder" +
        "<li>Confirm the email address you entered is the same one you used" +
           " when you created your account." +
        "</ol>" +
        "<p>If your account does not have an email address, " +
        "then your username and password cannot be retrieved. </p>" +
        "<p><a id=\"retlogin\" href=\"return to login\">" +
        "return to login</a></p>";
        app.out('logindiv', html);
        app.on('retlogin', 'click', onReturnToLogin);
        app.layout.adjust();
    },


    emailCredentials = function () {
        var eaddr = app.byId('emailin').value,
            data = "", critsec = "";
        if(!eaddr || !eaddr.trim() || !app.isProbablyEmail(eaddr)) {
            app.out('emcrediv', "Please enter your email address");
            return; }  //nothing to send to
        app.out('sendbuttons', "Sending...");
        data = "email=" + app.enc(eaddr);
        app.call('POST', "mailcred", data,
                 function (objs) {
                     dispEmailSent(); },
                 app.failf(function (code, errtxt) {
                     app.out('emcrediv', errtxt); }),
                 critsec);
    },


    onCredEmailSend = function (e) {
        app.evtend(e);
        emailCredentials();
    },


    displayEmailCredForm = function () {
        var html = "";
        app.out('centerhdiv', "Forgot Password");
        html += "<table id=\"loginform\" class=\"formstyle\">" + 
          "<tr>" +
            "<td colspan=\"2\">" +
              "<div id=\"emcrediv\">" + 
                "Enter the email address for you account" +
                " and your username and password will be mailed to you." + 
              "</div></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">email</td>" +
            "<td align=\"left\">" +
              "<input type=\"email\" id=\"emailin\" size=\"30\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"sendbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\"" + 
                     " onclick=\"app.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"sendbutton\">Send</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        app.out('logindiv', html);
        app.on('sendbutton', 'click', onCredEmailSend);
        app.on('emailin', 'change', onCredEmailSend);
        app.layout.adjust();
        app.byId('emailin').focus();
    },


    loginButtonHTML = function () {
        var html = "<button type=\"button\" id=\"loginbutton\"" + 
                          " onclick=\"app.login.upwlogin();return false;\"" +
            ">Sign in</button>";
        return html;
    },


    userpassLogin = function () {
        var username = app.byId('userin').value,
            password = app.byId('passin').value,
            url, data, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            app.out('loginstatdiv', "Please specify a username and password");
            return; }
        app.out('loginbspan', "Signing in...");
        url = secureURL("login");
        data = app.objdata({ user: username, pass: password });
        app.call('POST', url, data,
                 function (objs) {
                     //same flow here as createAccount
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 //no app.failf because need to handle 401 here
                 function (code, errtxt) {
                     app.out('loginstatdiv', "Login failed: " + errtxt);
                     app.out('loginbspan', loginButtonHTML()); },
                 critsec);
    },


    //all alternate login is done from the main server. 
    handleAlternateAuthentication = function (idx, params) {
        var redurl;
        if(!params) {
            params = app.parseParams(); }
        if(window.location.href.indexOf("localhost") >= 0) {
            app.err("Not redirecting to main server off localhost. Confusing.");
            return; }
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            redurl = app.mainsvr + "#command=AltAuth" + (+idx);
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            setTimeout(function () {
                window.location.href = redurl; 
            }, 20); }
        else {  //we are on app.mainsvr at this point
            altauths[idx].authenticate(params); }
    },


    displayAltAuthMethods = function () {
        var i, viadisp, html, hrefs = [];
        for(i = 0; i < altauths.length; i += 1) {
            viadisp = altauths[i].loginDispName || altauths[i].name;
            html = "<a href=\"" + altauths[i].loginurl + "\"" +
                      " title=\"Sign in via " + viadisp + "\"" +
                      " onclick=\"app.login.altLogin(" + i + ");" + 
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


    onLoginUserNameChange = function (e) {
        app.evtend(e); 
        app.byId('passin').focus();
    },


    onForgotPassword = function (e) {
        app.evtend(e);
        displayEmailCredForm();
    },


    displayLoginForm = function (params) {
        var name, html = "";
        app.out('centerhdiv', "");
        if(!app.byId('logindiv') || !app.byId('loginform')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            app.out('contentdiv', html); }
        app.byId('loginform').style.display = "block";
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
        app.out('loginparaminputs', html);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            app.out('loginstatdiv', params.loginerr); }
        app.out('sittd', "Sign in directly...");
        app.out('osacctd', "&nbsp;&nbsp;...or with your social account");
        app.out('altauthmethods', displayAltAuthMethods());
        if(!app.isLowFuncBrowser()) {
            html = "<div id=\"signinbuttondiv\"" +
                       " onclick=\"app.byId('loginform').submit();\">" +
                  "<a title=\"Sign in via secure server\">Sign in</a>" +
                "</div>";
            app.out('loginbtd', html); }
        html =  "<a id=\"macc\" href=\"create new account...\"" + 
                  " title=\"Create new native login\"" +
                  " onclick=\"app.login.displayNewAccountForm();" + 
                             "return false;\"" +
            ">" + "Create a new account</a>";
        app.out('macctd', html);
        html = "<a id=\"forgotpw\" href=\"forgot credentials...\"" + 
                 " title=\"Retrieve your credentials using the email" + 
                         " address you set for your account\"" +
            ">" + "forgot your password?</a>";
        app.out('forgotpwtd', html);
        app.on('forgotpw', 'click', onForgotPassword);
        app.on('userin', 'change', onLoginUserNameChange);
        if(authname) {
            app.byId('userin').value = authname; }
        app.layout.adjust();
        app.byId('userin').focus();
    },


    logLoadTimes = function () {
        var millis, timer = app.amdtimer;
        millis = timer.app.end.getTime() - timer.app.start.getTime();
        app.log("load app: " + millis);
    },


    //On localhost, params are lost when the login form is displayed.
    //On the server, they are passed to the secure host and returned
    //post-login.  These are separate flows.  Not supporting a
    //separate param processing path just for local development.
    loggedInDoNextStep = function (params) {
        if(params.command === "chgpwd") {
            app.login.displayUpdateAccountForm(); }
        else if(params.command === "helpful" ||
                params.command === "remember" ||
                params.command === "respond" ||
                (params.view === "review" && params.revid)) {
            app.lcs.getPenFull(params.penid, function (penref) {
                app.profile.verifyStateVariableValues(penref.pen);
                app.review.initWithId(params.revid, "read", 
                                      params.command); }); }
        else if(params.url) {
            app.review.readURL(app.dec(params.url), params); }
        else if(typeof params.mid === "string") {  //empty string on failure
            app.profile.addMyOpenReviewsAuthId(params.mid); }
        else {  //pass parameters along to the general processing next step
            doneWorkingWithAccount(params); }
    },


    handleRedirectOrStartWork = function () {
        var idx, params = app.parseParams();
        //set synonyms
        if(params.authmethod) { params.am = params.authmethod; }
        if(params.authtoken) { params.at = params.authtoken; }
        if(params.authname) { params.an = params.authname; }
        //do data directed side effects
        if(params.am && params.at && params.an) {  //have login info
            params.at = app.enc(params.at);  //restore token encoding 
            setAuthentication(params.am, params.at, params.an); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //on home server, clean the location display
            clearParams(); }
        if(params.view && params.profid) {
            app.history.checkpoint({ view: params.view, 
                                     profid: params.profid }); }
        else if(params.revedit) {
            app.history.checkpoint({ view: "review", mode: "edit",
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
            app.redirectToSecureServer(params); }
    };


    return {
        init: function () {
            if(!loginhtml) {  //save original html in case needed later
                loginhtml = app.byId('logindiv').innerHTML; }
            logLoadTimes();
            //do not change this ordering. Some auths leverage their index
            altauths = [ app.facebook, app.twitter, app.googleplus, 
                         app.github ];
            handleRedirectOrStartWork(); },
        clearinit: function () {
            app.out('centerhdiv', "");
            app.out('logindiv', "");
            app.login.init(); },
        updateAuthentDisplay: function (override) {
            updateAuthentDisplay(override); },
        displayUpdateAccountForm: function () {
            fetchAccAndUpdate(); },
        displayNewAccountForm: function () {
            displayNewAccountForm(); },
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
        loginInfoHTML: function (pen) {
            return loginInfoHTML(pen); }
    };

}());

