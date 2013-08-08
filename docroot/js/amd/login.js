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
        mor.profile.resetStateVars();
        mor.pen.resetStateVars();
        mor.rel.resetStateVars("logout");
    },


    logout = function () {
        var html;
        logoutWithNoDisplayUpdate();
        mor.profile.cancelPenNameSettings();  //close the dialog if it is up
        mor.historyCheckpoint({ view: "profile", profid: 0 });
        topworkdivcontents = "&nbsp;";  //clear out slideshow, won't fit.
        mor.login.updateAuthentDisplay();
        if(!mor.byId('logindiv')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            mor.out('contentdiv', html); }
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
                    return mor.profile.byprofid(state.profid); }
                return mor.profile.display(); }
            if(state.view === "activity") {
                return mor.activity.displayActive(); }
            if(state.view === "review" && state.revid) {
                mor.review.initWithId(state.revid, state.mode,
                                      params.action, params.errmsg); } }
        //go with default display
        mor.activity.displayActive();
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


    updateAccount = function () {
        var sel, i, cboxes, csv, data, url, critsec = "";
        data = "email=" + mor.enc(mor.byId('emailin').value || "");
        if(authmethod === "mid") {
            data += "&pass=" + mor.enc(mor.byId('npin').value || ""); }
        sel = mor.byId('offsumsel');
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
        data += "&sumflags=" + mor.enc(csv);
        data += "&" + mor.login.authparams();
        url = secureURL("chgpwd");
        mor.call(url, 'POST', data,
                 function (objs) {
                     if(authmethod === "mid") {
                         setAuthentication("mid", objs[0].token, authname); }
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     mor.out('setstatdiv', "Account settings update failed: " +
                             errtxt); },  //412 code not helpful
                 critsec, null, [405, 412]);
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
            window.location.href = mor.secsvr + 
                "#returnto=" + mor.enc(mor.mainsvr) +
                "&command=chgpwd&" + authparams(); }
        mor.profile.cancelPenNameSettings();  //close the dialog if it is up
        mor.login.updateAuthentDisplay("hide");
        title = title.replace("$USERNAME", authname);
        mor.out('centerhdiv', title);
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
              mor.checkrad("checkbox", "summaryflags", "sumiflogin",
                           "Send summary even if site visited",
                           (account.summaryflags && 
                            account.summaryflags.indexOf('sumiflogin') >= 0)) +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td></td>" +
            "<td colspan=\"2\">" +
              mor.checkrad("checkbox", "summaryflags", "sumifnoact",
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
        mor.out('contentdiv', html);
        mor.onclick('chgpwbutton', updateAccount);
        mor.onclick('updembutton', updateAccount);
        mor.onclick('cancelbutton', redirectToMainServer);
        mor.onclick('savebutton', updateAccount);
        mor.layout.adjust();
        mor.byId('emailin').focus();
    },


    fetchAccAndUpdate = function () {
        var critsec = "";
        mor.call("getacct?" + authparams(), 'GET', null,
                 function (accarr) {
                     if(accarr.length > 0) {
                         displayUpdateAccountForm(accarr[0]); }
                     else {
                         mor.err("No account details available"); } },
                 function (code, errtxt) {
                     mor.err("Account details retrieval failed: " + code + 
                             " " + errtxt); },
                 critsec, null, [400, 404]);
    },


    loginInfoHTML = function (pen) {
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
            ">Sign out</a>" +
            "&nbsp;|&nbsp;";
        if(authmethod === "mid") {
            html += "<a href=\"#AccountSettings\" id=\"accset\"" + 
                      " onclick=\"mor.login.displayUpdateAccountForm();" + 
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
            topworkdivcontents = mor.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {  //logged in, standard display
            html = "<div id=\"topactionsdiv\">" +
                  "<div id=\"settingsbuttondiv\">" + 
                    //filled in when pen name profile link filled in
                  "</div>" +
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
            if(!mor.byId('logoimg')) {
                mor.out('logodiv', "<img src=\"img/slides/logoMOR.png\"" +
                        " id=\"logoimg\" border=\"0\"/>"); }
            mor.byId('logoimg').style.width = "260px";
            mor.byId('logoimg').style.height = "120px";
            mor.byId('logodiv').style.width = "260px";
            mor.byId('topsectiondiv').style.height = "120px";
            mor.byId('topworkdiv').style.marginLeft = "280px";
            mor.byId('mascotdiv').style.top = "135px";
            mor.layout.setTopPaddingAndScroll(120); }
        else if(override === "hide") { 
            //html = "<img src=\"img/slides/slogan.png\" class=\"slideimg\"/>";
            html = "";
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
        var username, password, html;
        username = mor.safestr(mor.safeget('userin', "value"));
        password = mor.safestr(mor.safeget('passin', "value"));
        mor.out('centerhdiv', "Creating New Account");
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
                     " onclick=\"mor.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"createbutton\"" + 
                     " onclick=\"mor.login.createAccount();return false;\"" +
                ">Create</button>" +
            "</td>" +
          "</tr>" +
          emailStatementsRow() +
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
        "<li>Make sure your email address is spelled correctly" +
        "<li>Check your spam folder" +
        "<li>Confirm the email address you entered is the same one you used" +
           " when you created your account." +
        "</ol>" +
        "<p>If your account does not have an email address, " +
        "then your username and password cannot be retrieved. </p>" +
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
        mor.out('centerhdiv', "Forgot Password");
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
                     " onclick=\"mor.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"sendbutton\">Send</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('logindiv', html);
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
        if(!mor.byId('logindiv') || !mor.byId('loginform')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            mor.out('contentdiv', html); }
        mor.byId('loginform').style.display = "block";
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
        if(!mor.isLowFuncBrowser()) {
            html = "<div id=\"signinbuttondiv\"" +
                       " onclick=\"mor.byId('loginform').submit();\">" +
                  "<a title=\"Sign in via secure server\">Sign in</a>" +
                "</div>";
            mor.out('loginbtd', html); }
        html =  "<a id=\"macc\" href=\"create new account...\"" + 
                  " title=\"Create new native login\"" +
                  " onclick=\"mor.login.displayNewAccountForm();" + 
                             "return false;\"" +
            ">" + "Create a new account</a>";
        mor.out('macctd', html);
        html = "<a id=\"forgotpw\" href=\"forgot credentials...\"" + 
                 " title=\"Retrieve your credentials using the email" + 
                         " address you set for your account\"" +
            ">" + "forgot your password?</a>";
        mor.out('forgotpwtd', html);
        mor.onclick('forgotpw', displayEmailCredForm);
        mor.onchange('userin', function () { mor.byId('passin').focus(); });
        if(authname) {
            mor.byId('userin').value = authname; }
        mor.layout.adjust();
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
            mor.login.displayUpdateAccountForm(); }
        else if(params.command === "helpful" ||
                params.command === "remember" ||
                params.command === "respond" ||
                (params.view === "review" && params.revid)) {
            mor.lcs.getPenFull(params.penid, function (penref) {
                mor.profile.verifyStateVariableValues(penref.pen);
                mor.review.initWithId(params.revid, "read", 
                                      params.command); }); }
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
            if(!loginhtml) {  //save original html in case needed later
                loginhtml = mor.byId('logindiv').innerHTML; }
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
        clearinit: function () {
            mor.out('centerhdiv', "");
            mor.out('logindiv', "");
            mor.login.init(); },
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

});

