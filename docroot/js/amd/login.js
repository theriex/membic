/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false, require: false */

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
            url = glo.secsvr + "/" + endpoint; }
        return url;
    },


    authparams = function () {
        var params, sec; 
        params = "am=" + authmethod + "&at=" + authtoken + 
                 "&an=" + glo.enc(authname);
        sec = glo.dojo.cookie(authtoken);
        if(sec) {
            params += "&as=" + glo.enc(sec); }
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authmethod=" + authmethod + 
                     "&authtoken=" + authtoken + 
                     "&authname=" + glo.enc(authname);
        return params;
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie
        glo.dojo.cookie(glo.authcookname, "", { expires: -1 });
        authmethod = "";
        authtoken = "";
        authname = "";
        glo.review.resetStateVars();
        glo.profile.resetStateVars();
        glo.pen.resetStateVars();
        glo.rel.resetStateVars("logout");
    },


    logout = function () {
        var html;
        logoutWithNoDisplayUpdate();
        glo.profile.cancelPenNameSettings();  //close the dialog if it is up
        glo.historyCheckpoint({ view: "profile", profid: 0 });
        topworkdivcontents = "&nbsp;";  //clear out slideshow, won't fit.
        glo.login.updateAuthentDisplay();
        if(!glo.byId('logindiv')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            glo.out('contentdiv', html); }
        glo.login.init();
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
            params = glo.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            if(params.command === "chgpwd") {
                params.command = ""; }
            xpara = glo.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no explicit redirect, so check if directed by anchor tag
        if(params.anchor === "profile") {
            clearParams();
            return glo.profile.display(params.action, params.errmsg); }
        //no tag redirect so check current state
        state = glo.currState();
        if(state) {
            if(state.view === "profile") {
                if(state.profid) {
                    return glo.profile.byprofid(state.profid); }
                return glo.profile.display(); }
            if(state.view === "activity") {
                return glo.activity.displayActive(); }
            if(state.view === "review" && state.revid) {
                glo.review.initWithId(state.revid, state.mode,
                                      params.action, params.errmsg); } }
        //go with default display
        glo.activity.displayActive();
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (moracct.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        glo.dojo.cookie(glo.authcookname, cval, { expires: 365 });
        authmethod = method;
        authtoken = token;
        authname = name;
        glo.login.updateAuthentDisplay();
    },


    readAuthCookie = function () {
        var cval, mtn;
        cval = glo.dojo.cookie(glo.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2]; }
        glo.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    redirectToMainServer = function () {
        var url = glo.mainsvr;
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    updateAccount = function () {
        var sel, i, cboxes, csv, data, url, critsec = "";
        data = "email=" + glo.enc(glo.byId('emailin').value || "");
        if(authmethod === "mid") {
            data += "&pass=" + glo.enc(glo.byId('npin').value || ""); }
        sel = glo.byId('offsumsel');
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
        data += "&sumflags=" + glo.enc(csv);
        data += "&" + glo.login.authparams();
        url = secureURL("chgpwd");
        glo.call(url, 'POST', data,
                 function (objs) {
                     if(authmethod === "mid") {
                         setAuthentication("mid", objs[0].token, authname); }
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     glo.out('setstatdiv', "Account settings update failed: " +
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
            window.location.href = glo.secsvr + 
                "#returnto=" + glo.enc(glo.mainsvr) +
                "&command=chgpwd&" + authparams(); }
        glo.profile.cancelPenNameSettings();  //close the dialog if it is up
        glo.login.updateAuthentDisplay("hide");
        title = title.replace("$USERNAME", authname);
        glo.out('centerhdiv', title);
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
              glo.checkrad("checkbox", "summaryflags", "sumiflogin",
                           "Send summary even if site visited",
                           (account.summaryflags && 
                            account.summaryflags.indexOf('sumiflogin') >= 0)) +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td></td>" +
            "<td colspan=\"2\">" +
              glo.checkrad("checkbox", "summaryflags", "sumifnoact",
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
        glo.out('contentdiv', html);
        glo.onclick('chgpwbutton', updateAccount);
        glo.onclick('updembutton', updateAccount);
        glo.onclick('cancelbutton', redirectToMainServer);
        glo.onclick('savebutton', updateAccount);
        glo.layout.adjust();
        glo.byId('emailin').focus();
    },


    fetchAccAndUpdate = function () {
        var critsec = "";
        glo.call("getacct?" + authparams(), 'GET', null,
                 function (accarr) {
                     if(accarr.length > 0) {
                         displayUpdateAccountForm(accarr[0]); }
                     else {
                         glo.err("No account details available"); } },
                 function (code, errtxt) {
                     glo.err("Account details retrieval failed: " + code + 
                             " " + errtxt); },
                 critsec, null, [400, 404]);
    },


    loginInfoHTML = function (pen) {
        var html, iconurl;
        switch(authmethod) {
            case "mid": iconurl = "img/iconMOR.png"; break;
            case "fbid": iconurl = glo.facebook.iconurl; break;
            case "twid": iconurl = glo.twitter.iconurl; break;
            case "gsid": iconurl = glo.googleplus.iconurl; break;
            case "ghid": iconurl = glo.github.iconurl; break; }
        html = "<img class=\"loginico\" src=\"" + iconurl + "\" /> " +
            "<em>" + authname + "</em> &nbsp; " +
            "<a href=\"logout\" id=\"logout\"" + 
              " onclick=\"glo.login.logout();return false;\"" +
            ">Sign out</a>" +
            "&nbsp;|&nbsp;";
        if(authmethod === "mid") {
            html += "<a href=\"#AccountSettings\" id=\"accset\"" + 
                      " onclick=\"glo.login.displayUpdateAccountForm();" + 
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
            topworkdivcontents = glo.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {  //logged in, standard display
            html = "<div id=\"topactionsdiv\">" +
                  "<table id=\"topactionstable\" border=\"0\">" +
                    "<tr>" +
                      //"<td></td>" + 
                      "<td><div id=\"homepenhdiv\">" + 
                          //content from profile.updateTopActionDisplay
                          "</div></td>" + 
                      "<td><div id=\"rememberedhdiv\">" + 
                         glo.activity.rememberedLinkHTML() +
                          "</div></td>" + 
                      "<td><div id=\"settingsbuttondiv\">" + 
                          //content from profile.updateTopActionDisplay
                          "</div></td>" +
                    "</tr>" +
                    "<tr>" +
                      "<td><div id=\"writerevhdiv\">" + 
                         glo.review.reviewLinkHTML() +
                          "</div></td>" + 
                      "<td><div id=\"recentacthdiv\">" + 
                         glo.activity.activityLinkHTML() +
                          "</div></td>" + 
                    "</tr>" +
                  "</table>" +
                "</div>";
            glo.out('topworkdiv', html);
            if(!glo.byId('logoimg')) {
                glo.out('logodiv', "<img src=\"img/slides/logoMOR.png\"" +
                        " id=\"logoimg\" border=\"0\"/>"); }
            glo.byId('logoimg').style.width = "260px";
            glo.byId('logoimg').style.height = "120px";
            glo.byId('logodiv').style.width = "260px";
            glo.byId('topsectiondiv').style.height = "130px";  //same val below
            glo.byId('topworkdiv').style.marginLeft = "280px";
            glo.byId('mascotdiv').style.top = "135px";
            glo.layout.setTopPaddingAndScroll(130); }  //matches topsectiondiv
        else if(override === "hide") { 
            //html = "<img src=\"img/slides/slogan.png\" class=\"slideimg\"/>";
            html = "";
            glo.out('topworkdiv', html); }
        else {  //restore whatever was in index.html to begin with
            glo.out('topworkdiv', topworkdivcontents); }
    },


    createAccount = function () {
        var username = glo.byId('userin').value,
            password = glo.byId('passin').value,
            maddr = glo.byId('emailin').value || "",
            data = "", url, buttonhtml, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            glo.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        buttonhtml = glo.byId('newaccbuttonstd').innerHTML;
        glo.out('newaccbuttonstd', "Creating new account...");
        data = glo.objdata({ user: username, pass: password, email: maddr });
        glo.call(url, 'POST', data, 
                 function (objs) {
                     var html = "<p>Welcome " + username + "! Your account " +
                         "has been created. </p>" +
                         "<p>Signing in...</p>";
                     glo.out('logindiv', html);
                     //same flow here as userpassLogin, but db stable wait..
                     setAuthentication("mid", objs[0].token, username);
                     setTimeout(doneWorkingWithAccount, 3000); },
                 function (code, errtxt) {
                     glo.out('maccstatdiv', errtxt);
                     glo.out('newaccbuttonstd', buttonhtml);  },
                 critsec);
    },


    //Some people habitually use their email address as their username,
    //but if they forget their password it still has to be searched via
    //the email field, so copy it over.  They can fix it if not right.
    usernamechange = function () {
        var uname = glo.byId('userin').value;
        if(glo.isProbablyEmail(uname)) {
            glo.byId('emailin').value = uname; }
        glo.byId('passin').focus();
    },


    displayNewAccountForm = function () {
        var username, password, html;
        username = glo.safestr(glo.safeget('userin', "value"));
        password = glo.safestr(glo.safeget('passin', "value"));
        glo.out('centerhdiv', "Creating New Account");
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
                     " onclick=\"glo.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"createbutton\"" + 
                     " onclick=\"glo.login.createAccount();return false;\"" +
                ">Create</button>" +
            "</td>" +
          "</tr>" +
          emailStatementsRow() +
        "</table>";
        glo.out('logindiv', html);
        glo.onchange('userin', usernamechange);
        glo.onchange('passin', function () { glo.byId('emailin').focus(); });
        glo.onchange('emailin', createAccount);
        glo.layout.adjust();
        glo.byId('userin').focus();
    },


    dispEmailSent = function () {
        var html = "";
        html += "<p>Your account information has been emailed to <code>" +
        glo.byId('emailin').value + 
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
        glo.out('logindiv', html);
        glo.onclick('retlogin', glo.login.init);
        glo.layout.adjust();
    },


    emailCredentials = function () {
        var eaddr = glo.byId('emailin').value,
            data = "", critsec = "";
        if(!eaddr || !eaddr.trim() || !glo.isProbablyEmail(eaddr)) {
            glo.out('emcrediv', "Please enter your email address");
            return; }  //nothing to send to
        glo.out('sendbuttons', "Sending...");
        data = "email=" + glo.enc(eaddr);
        glo.call("mailcred", 'POST', data,
                 function (objs) {
                     dispEmailSent(); },
                 function (code, errtxt) {
                     glo.out('emcrediv', errtxt); },
                 critsec);
    },


    displayEmailCredForm = function () {
        var html = "";
        glo.out('centerhdiv', "Forgot Password");
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
                     " onclick=\"glo.login.clearinit();return false;\"" +
                ">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"sendbutton\">Send</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        glo.out('logindiv', html);
        glo.onclick('sendbutton', emailCredentials);
        glo.onchange('emailin', emailCredentials);
        glo.layout.adjust();
        glo.byId('emailin').focus();
    },


    loginButtonHTML = function () {
        var html = "<button type=\"button\" id=\"loginbutton\"" + 
                          " onclick=\"glo.login.upwlogin();return false;\"" +
            ">Sign in</button>";
        return html;
    },


    userpassLogin = function () {
        var username = glo.byId('userin').value,
            password = glo.byId('passin').value,
            url, data, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            glo.out('loginstatdiv', "Please specify a username and password");
            return; }
        glo.out('loginbspan', "Signing in...");
        url = secureURL("login");
        data = glo.objdata({ user: username, pass: password });
        glo.call(url, 'POST', data,
                 function (objs) {
                     //same flow here as createAccount
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 function (code, errtxt) {
                     glo.out('loginstatdiv', "Login failed: " + errtxt);
                     glo.out('loginbspan', loginButtonHTML()); },
                 critsec, null, [401]);
    },


    //all alternate login is done from the main server. 
    handleAlternateAuthentication = function (idx, params) {
        var redurl;
        if(!params) {
            params = glo.parseParams(); }
        if(window.location.href.indexOf("localhost") >= 0) {
            glo.err("Not redirecting to main server off localhost. Confusing.");
            return; }
        if(window.location.href.indexOf(glo.mainsvr) !== 0) {
            redurl = glo.mainsvr + "#command=AltAuth" + (+idx);
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            setTimeout(function () {
                window.location.href = redurl; 
            }, 20); }
        else {  //we are on glo.mainsvr at this point
            altauths[idx].authenticate(params); }
    },


    displayAltAuthMethods = function () {
        var i, viadisp, html, hrefs = [];
        for(i = 0; i < altauths.length; i += 1) {
            viadisp = altauths[i].loginDispName || altauths[i].name;
            html = "<a href=\"" + altauths[i].loginurl + "\"" +
                      " title=\"Sign in via " + viadisp + "\"" +
                      " onclick=\"glo.login.altLogin(" + i + ");" + 
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
        glo.out('centerhdiv', "");
        if(!glo.byId('logindiv') || !glo.byId('loginform')) {
            html = "<div id=\"logindiv\">" + loginhtml + "</div>";
            glo.out('contentdiv', html); }
        glo.byId('loginform').style.display = "block";
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
        glo.out('loginparaminputs', html);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            glo.out('loginstatdiv', params.loginerr); }
        glo.out('sittd', "Sign in directly...");
        glo.out('osacctd', "&nbsp;&nbsp;...or with your social account");
        glo.out('altauthmethods', displayAltAuthMethods());
        if(!glo.isLowFuncBrowser()) {
            html = "<div id=\"signinbuttondiv\"" +
                       " onclick=\"glo.byId('loginform').submit();\">" +
                  "<a title=\"Sign in via secure server\">Sign in</a>" +
                "</div>";
            glo.out('loginbtd', html); }
        html =  "<a id=\"macc\" href=\"create new account...\"" + 
                  " title=\"Create new native login\"" +
                  " onclick=\"glo.login.displayNewAccountForm();" + 
                             "return false;\"" +
            ">" + "Create a new account</a>";
        glo.out('macctd', html);
        html = "<a id=\"forgotpw\" href=\"forgot credentials...\"" + 
                 " title=\"Retrieve your credentials using the email" + 
                         " address you set for your account\"" +
            ">" + "forgot your password?</a>";
        glo.out('forgotpwtd', html);
        glo.onclick('forgotpw', displayEmailCredForm);
        glo.onchange('userin', function () { glo.byId('passin').focus(); });
        if(authname) {
            glo.byId('userin').value = authname; }
        glo.layout.adjust();
        glo.byId('userin').focus();
    },


    logLoadTimes = function () {
        var millis, timer = glo.amdtimer;
        millis = timer.dojo.end.getTime() - timer.dojo.start.getTime();
        glo.log("load dojo: " + millis);
        millis = timer.app.end.getTime() - timer.app.start.getTime();
        glo.log("load app: " + millis);
        millis = timer.ext.end.getTime() - timer.ext.start.getTime();
        glo.log("load ext: " + millis);
    },


    //On localhost, params are lost when the login form is displayed.
    //On the server, they are passed to the secure host and returned
    //post-login.  These are separate flows.  Not supporting a
    //separate param processing path just for local development.
    loggedInDoNextStep = function (params) {
        if(params.command === "chgpwd") {
            glo.login.displayUpdateAccountForm(); }
        else if(params.command === "helpful" ||
                params.command === "remember" ||
                params.command === "respond" ||
                (params.view === "review" && params.revid)) {
            glo.lcs.getPenFull(params.penid, function (penref) {
                glo.profile.verifyStateVariableValues(penref.pen);
                glo.review.initWithId(params.revid, "read", 
                                      params.command); }); }
        else if(params.url) {
            glo.review.readURL(glo.dec(params.url), params); }
        else if(typeof params.mid === "string") {  //empty string on failure
            glo.profile.addMyOpenReviewsAuthId(params.mid); }
        else {  //pass parameters along to the general processing next step
            doneWorkingWithAccount(params); }
    },


    handleRedirectOrStartWork = function () {
        var idx, params = glo.parseParams();
        //set synonyms
        if(params.authmethod) { params.am = params.authmethod; }
        if(params.authtoken) { params.at = params.authtoken; }
        if(params.authname) { params.an = params.authname; }
        //do data directed side effects
        if(params.am && params.at && params.an) {  //have login info
            params.at = glo.enc(params.at);  //restore token encoding 
            setAuthentication(params.am, params.at, params.an); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //on home server, clean the location display
            clearParams(); }
        if(params.view && params.profid) {
            glo.historyCheckpoint({ view: params.view, 
                                    profid: params.profid }); }
        else if(params.revedit) {
            glo.historyCheckpoint({ view: "review", mode: "edit",
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
            glo.redirectToSecureServer(params); }
    };


    return {
        init: function () {
            glo.out('contentfill', "loading login extensions...");
            if(!loginhtml) {  //save original html in case needed later
                loginhtml = glo.byId('logindiv').innerHTML; }
            glo.amdtimer.ext = { start: new Date() };
            require([ "ext/facebook", "ext/twitter", "ext/googleplus", 
                      "ext/github" ],
                    function (facebook, twitter, googleplus,
                              github) {
                        glo.amdtimer.ext.end = new Date();
                        glo.out('contentfill', " &nbsp; ");
                        logLoadTimes();
                        if(!glo.facebook) { glo.facebook = facebook; }
                        if(!glo.twitter) { glo.twitter = twitter; }
                        if(!glo.googleplus) { glo.googleplus = googleplus; }
                        if(!glo.github) { glo.github = github; }
                        //do not change this ordering. Some auths need to
                        //know their index param values.
                        altauths = [ facebook, twitter, googleplus,
                                     github ];
                        handleRedirectOrStartWork(); }); },
        clearinit: function () {
            glo.out('centerhdiv', "");
            glo.out('logindiv', "");
            glo.login.init(); },
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

