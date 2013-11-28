/*global alert: false, setTimeout: false, window: false, document: false, history: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.login = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var authmethod = "",
        authtoken = "",
        authname = "",
        cookdelim = "..morauth..",
        topworkdivcontents = "",
        altauths = [],
        loginhtml = "",
        sumfreqs = [ "daily", "weekly", "fortnightly", "never" ],
        sumlabels = [ "Daily", "Weekly", "Fortnightly", "Never" ],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

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
                 "&an=" + jt.enc(authname);
        sec = jt.cookie(authtoken);
        if(sec) {
            params += "&as=" + jt.enc(sec); }
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authmethod=" + authmethod + 
                     "&authtoken=" + authtoken + 
                     "&authname=" + jt.enc(authname);
        return params;
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie
        jt.cookie(app.authcookname, "", -1);
        authmethod = "";
        authtoken = "";
        authname = "";
        app.review.resetStateVars();
        app.profile.resetStateVars();
        app.pen.resetStateVars();
        app.rel.resetStateVars("logout");
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
            params = jt.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.special === "nativeonly") {
                redurl += "&special=nativeonly"; }
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            if(params.command === "chgpwd") {
                params.command = ""; }
            xpara = jt.objdata(params, ["logout", "returnto"]);
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
                return app.review.initWithId(state.revid, state.mode,
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
        jt.cookie(app.authcookname, cval, 365);
        authmethod = method;
        authtoken = token;
        authname = name;
        app.login.updateAuthentDisplay();
    },


    emailStatementsRow = function () {
        var html = ["tr",
                    ["td", {colspan: 3, align: "center"},
                     ["p", "wdydfun will <em>not</em> share your email " +
                       " or spam you."]]];
        html = jt.tac2html(html);
        return html;
    },


    dispEmailSent = function () {
        var html;
        html = [["p", 
                 [["Your account information has been emailed to "],
                  ["code", jt.byId('emailin').value],
                  [" and should arrive in a few minutes.  If it doesn't" + 
                   " show up, please"]]],
                ["ol",
                 [["li", "Make sure your email address is spelled correctly"],
                  ["li", "Check your spam folder"],
                  ["li", "Confirm the email address you entered is the same" +
                        " one you used when you created your account."]]],
                ["p", "If your account does not have an email address," +
                     " then your username and password cannot be retrieved."],
                ["p",
                 ["a", {id: "retlogin", href: "return to login",
                        onclick: jt.fs("app.login.init()")},
                  "return to login"]]];
        html = jt.tac2html(html);
        jt.out('logindiv', html);
        app.layout.adjust();
    },


    freqopts = function (sumfreqs, account) {
        var opts = [], i, selected, html;
        if(!account.summaryfreq) {
            account.summaryfreq = "weekly"; }
        for(i = 0; i < sumfreqs.length; i += 1) {
            selected = jt.toru((account.summaryfreq === sumfreqs[i]),
                               "selected");
            opts.push(["option", {id: sumfreqs[i], selected: selected},
                       sumlabels[i]]); }
        html = ["select", {id: "offsumsel"}, opts];
        html = jt.tac2html(html);
        return html;
    },


    hasflag = function (account, flag) {
        return (account.summaryflags &&
                account.summaryflags.indexOf(flag) >= 0);
    },


    //all alternate login is done from the main server. 
    handleAlternateAuthentication = function (idx, params) {
        var redurl;
        if(!params) {
            params = jt.parseParams(); }
        if(window.location.href.indexOf("localhost") >= 0) {
            jt.err("Not redirecting to main server off localhost. Confusing.");
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
            html = [["a", {href: altauths[i].loginurl,
                           title: "Sign in via " + viadisp,
                           onclick: jt.fs("app.login.altLogin(" + i + ")")},
                     ["img", {cla: "loginico", src: altauths[i].iconurl}]],
                    " "];
            hrefs.push(jt.tac2html(html)); }
        hrefs.shuffle();
        html = [];
        for(i = 0; i < hrefs.length; i += 1) {
            html.push(["span", {cla: "altauthspan"}, hrefs[i]]); }
        html = jt.tac2html(html);
        return html;
    },


    onLoginUserNameChange = function (e) {
        jt.evtend(e); 
        jt.byId('passin').focus();
    },


    //safari displays "No%20match%20for%20those%20credentials"
    //and even "No%2520match%2520for%2520those%2520credentials"
    fixServerText = function (text) {
        if(!text) {
            text = ""; }
        text = text.replace(/%20/g, " ");
        text = text.replace(/%2520/g, " ");
        return text;
    },


    displayLoginForm = function (params) {
        var name, html;
        jt.out('centerhdiv', "");
        if(!jt.byId('logindiv') || !jt.byId('loginform')) {
            html = jt.tac2html(["div", {id: "logindiv"}, loginhtml]);
            jt.out('contentdiv', html); }
        jt.byId('loginform').style.display = "block";
        html = [];
        //add url parameters to pass through on form submit
        for(name in params) {
            if(params.hasOwnProperty(name)) {
                html.push(["input", {type: "hidden", name: name,
                                     value: params[name]}]); } }
        if(!params.returnto) {
            //window.location.origin is webkit only
            html.push(["input", {type: "hidden", name: "returnto",
                                 value: window.location.protocol + "//" + 
                                        window.location.host}]); }
        jt.out('loginparaminputs', jt.tac2html(html));
        //decorate contents and connect additional actions
        if(params.loginerr) {
            jt.out('loginstatdiv', fixServerText(params.loginerr)); }
        if(params.special === "nativeonly") {
            jt.out('sittd', "Native wdydfun login:");
            jt.out('osacctd', "");
            jt.out('altauthmethods', ""); }
        else {  //regular login
            jt.out('sittd', "Sign in directly...");
            jt.out('osacctd', "&nbsp;&nbsp;...or with your social account");
            jt.out('altauthmethods', displayAltAuthMethods()); }
        if(!jt.isLowFuncBrowser()) {  //upgrade the sign in button look
            html = ["div", {id: "signinbuttondiv",
                            onclick: "jt.byId('loginform').submit();"},
                    ["a", {title: "Sign in via secure server"}, "Sign in"]];
            jt.out('loginbtd', jt.tac2html(html)); }
        html = ["a", {id: "macc", href: "create new account...",
                      title: "Create new native login",
                      onclick: jt.fs("app.login.displayNewAccountForm()")},
                "Create a new account"];
        jt.out('macctd', jt.tac2html(html));
        html = ["a", {id: "forgotpw", href: "forgot credentials...",
                      title: "Retrieve your credentials using the email" + 
                            " address you set for your account",
                      onclick: jt.fs("app.login.displayEmailCredForm()")},
                "forgot your password?"];
        jt.out('forgotpwtd', jt.tac2html(html));
        jt.on('userin', 'change', onLoginUserNameChange);
        if(authname) {
            jt.byId('userin').value = authname; }
        app.layout.adjust();
        jt.byId('userin').focus();
    },


    logLoadTimes = function () {
        var millis, timer = app.amdtimer;
        millis = timer.load.end.getTime() - timer.load.start.getTime();
        jt.log("load app: " + millis);
    },


    addNativeAuthToPen = function (params) {
        var url, critsec = "";
        jt.out('contentdiv', "Verifying account");
        url = "getacct?am=" + params.am + "&at=" + params.at +
            "&an=" + jt.enc(params.an);
        jt.call('GET', url, null,
                function (accarr) {
                    var mid;
                    if(accarr.length > 0) {
                        mid = jt.instId(accarr[0]); }
                    app.profile.addMORAuthId(mid); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "Account verification failed"); }),
                critsec);
    },


    //On localhost, params are lost when the login form is displayed.
    //On the server, they are passed to the secure host and returned
    //post-login.  These are separate flows.  Not supporting a
    //separate param processing path just for local development.
    loggedInDoNextStep = function (params) {
        //Need to note login, but definitely don't hold up display work
        setTimeout(function () {
            var data = "penid=" + app.pen.currPenId(), 
                critsec = "";
            jt.call('POST', "penacc?" + app.login.authparams(), data,
                    function () {
                        jt.log("Pen access time updated"); },
                    app.failf(),
                    critsec); }, 4000);
        if(params.command === "chgpwd") {
            app.login.displayUpdAccForm(); }
        else if(params.command === "helpful" ||
                params.command === "remember" ||
                params.command === "respond" ||
                (params.view === "review" && params.revid)) {
            setTimeout(function () {
                jt.call('GET', "/bytheway?clickthrough=review", null,
                        function () {
                            jt.log("noted review clickthrough"); },
                        app.failf); }, 200);
            app.lcs.getPenFull(params.penid, function (penref) {
                app.profile.verifyStateVariableValues(penref.pen);
                app.review.initWithId(params.revid, "read", 
                                      params.command); }); }
        else if(params.url) {
            app.review.readURL(jt.dec(params.url), params); }
        else if(params.special === "nativeonly") {
            addNativeAuthToPen(params); }
        else {  //pass parameters along to the general processing next step
            doneWorkingWithAccount(params); }
    },


    handleRedirectOrStartWork = function () {
        var idx, params = jt.parseParams();
        //set synonyms
        if(params.authmethod) { params.am = params.authmethod; }
        if(params.authtoken) { params.at = params.authtoken; }
        if(params.authname) { params.an = params.authname; }
        //do data directed side effects
        if(params.am && params.at && params.an && !params.special) {
            params.at = jt.enc(params.at);  //restore token encoding 
            setAuthentication(params.am, params.at, params.an); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //on home server, clean the location display
            clearParams(); }
        if(params.view && params.profid) {
            setTimeout(function () {
                jt.call('GET', "/bytheway?clickthrough=profile", null,
                        function () {
                            jt.log("noted profile clickthrough"); },
                        app.failf); }, 200);
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
        else if(authtoken || app.login.readAuthCookie()) {
            loggedInDoNextStep(params); }
        else if(secureURL("login") === "login") {
            displayLoginForm(params); }
        else { 
            app.redirectToSecureServer(params); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        if(!loginhtml) {  //save original html in case needed later
            loginhtml = jt.byId('logindiv').innerHTML; }
        logLoadTimes();
        //do not change this ordering. Some auths leverage their index
        altauths = [ app.facebook, app.twitter, app.googleplus, app.github ];
        handleRedirectOrStartWork();
    },


    clearinit: function () {
        jt.out('centerhdiv', "");
        jt.out('logindiv', "");
        app.login.init();
    },


    //create the logged-in display areas
    updateAuthentDisplay: function (override) {
        var html;
        if(!topworkdivcontents) {
            topworkdivcontents = jt.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {  //logged in, standard display
            html = ["div", {id: "topactionsdiv"},
                    ["table", {id: "topactionstable"},
                     [["tr",
                       [["td",
                         //div filled by profile.updateTopActionDisplay
                         ["div", {id: "homepenhdiv"}, ""]],
                        ["td",
                         ["div", {id: "rememberedhdiv"},
                          app.activity.rememberedLinkHTML()]],
                        ["td", {rowspan: 2},
                         //div filled by profile.updateTopActionDisplay
                         ["div", {id: "settingsbuttondiv"}, ""]]]],
                      ["tr",
                       [["td",
                         ["div", {id: "writerevhdiv"},
                          app.review.reviewLinkHTML()]],
                        ["td",
                         ["div", {id: "recentacthdiv"},
                          app.activity.activityLinkHTML()]]]]]]];
            html = jt.tac2html(html);
            jt.out('topworkdiv', html);
            if(!jt.byId('logoimg')) {
                html = ["img", {src: "img/wdydfun.png", id: "logoimg"}];
                html = jt.tac2html(html);
                jt.out('logodiv', html); }
            jt.byId('logoimg').style.width = "260px";
            jt.byId('logoimg').style.height = "120px";
            jt.byId('logodiv').style.width = "260px";
            jt.byId('topsectiondiv').style.height = "130px";  //same val below
            jt.byId('topworkdiv').style.marginLeft = "280px";
            jt.byId('mascotdiv').style.top = "135px";
            app.layout.setTopPaddingAndScroll(130); }  //matches topsectiondiv
        else if(override === "hide") { 
            jt.out('topworkdiv', ""); }
        else {  //restore whatever was in index.html to begin with
            jt.out('topworkdiv', topworkdivcontents); }
    },


    redirhome: function (e) {
        var url = app.mainsvr;
        jt.evtend(e);
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    updacc: function () {
        var sel, i, cboxes, csv, data, url, critsec = "";
        data = "email=" + jt.enc(jt.safeget('emailin', 'value'));
        if(authmethod === "mid") {
            data += "&pass=" + jt.enc(jt.safeget('npin', 'value')); }
        sel = jt.byId('offsumsel');
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
        data += "&sumflags=" + jt.enc(csv);
        data += "&" + authparams();
        url = secureURL("chgpwd");
        jt.call('POST', url, data,
                 function (objs) {
                     if(authmethod === "mid") {
                         setAuthentication("mid", objs[0].token, authname); }
                     doneWorkingWithAccount(); },
                 app.failf(function (code, errtxt) {
                     jt.out('setstatdiv', "Account settings update failed: " +
                             errtxt); }),
                 critsec);
    },


    displayUpdAccForm: function (account) {
        var rows = [], html, title = "Account settings for $USERNAME", 
            critsec = "";
        if(account) {
            if(secureURL("chgpwd") !== "chgpwd") { //redirect if needed
                window.location.href = app.secsvr + 
                    "#returnto=" + jt.enc(app.mainsvr) +
                    "&command=chgpwd&" + authparams(); }
            app.profile.cancelPenNameSettings();  //close dialog if up
            app.login.updateAuthentDisplay("hide");
            title = title.replace("$USERNAME", authname);
            jt.out('centerhdiv', title);
            rows.push(["tr",
                       ["td", {colspan: 3},
                        ["div", {id: "setstatdiv"}]]]);
            if(authmethod === "mid") {
                rows.push(["tr",
                           [["td", {align: "right"}, "New Password"],
                            ["td", {align: "left"}, 
                             ["input", {type: "password", id: "npin", 
                                        size: 25}]],
                            ["td", {align: "left"},
                             ["button", {type: "button", id: "chgpwbutton",
                                         onclick: jt.fs("app.login.updacc()")},
                              "Change Password"]]]]); }
            rows.push(["tr",
                       [["td", {align: "right"}, "E-mail"],
                        ["td", {align: "left"}, 
                         ["input", {type: "email", id: "emailin", 
                                    size: 25, value: (account.email || "")}]],
                        ["td", {align: "left"},
                         ["button", {type: "button", id: "updembutton",
                                     onclick: jt.fs("app.login.updacc()")},
                          "Update E-mail"]]]]);
            rows.push(["tr",
                       [["td", {align: "right"}, "Offline Summary"],
                        ["td", {align: "left"}, 
                         freqopts(sumfreqs, account)]]]);
            rows.push(["tr",
                       [["td"],
                        ["td", {colspan: 2},
                         jt.checkbox("summaryflags", "sumiflogin",
                                     "Send summary even if site visited",
                                     hasflag(account, 'sumiflogin'))]]]);
            rows.push(["tr",
                       [["td"],
                        ["td", {colspan: 2},
                         jt.checkbox("summaryflags", "sumifnoact",
                                 "Send summary even if no reviews from friends",
                                     hasflag(account, 'sumifnoact'))]]]);
            rows.push(["tr",
                       ["td", {colspan: 2, align: "center", cla: "actbuttons"},
                        [["button", {type: "button", id: "cancelbutton",
                                     onclick: jt.fs("app.login.redirhome()")},
                          "Cancel"],
                         "&nbsp;",
                         ["button", {type: "button", id: "savebutton",
                                     onclick: jt.fs("app.login.updacc()")},
                          "Save"]]]]);
            rows.push(emailStatementsRow());
            html = ["table", {id: "loginform", cla: "formstyle"}, rows];
            html = jt.tac2html(html);
            jt.out('contentdiv', html);
            app.layout.adjust();
            jt.byId('emailin').focus(); }
        else {  //no account given, go get it.
            jt.call('GET', "getacct?" + authparams(), null,
                    function (accarr) {
                        if(accarr.length > 0) {
                            app.login.displayUpdAccForm(accarr[0]); }
                        else {
                            jt.err("No account details available"); } },
                    app.failf(function (code, errtxt) {
                        jt.err("Account details retrieval failed: " + code + 
                               " " + errtxt); }),
                    critsec); }
    },


    //Some people habitually use their email address as their username,
    //but if they forget their password it still has to be searched via
    //the email field, so copy it over.  They can fix it if not right.
    onUserNameChange: function () {
        var uname;
        uname = jt.byId('userin').value;
        if(jt.isProbablyEmail(uname)) {
            jt.byId('emailin').value = uname; }
        jt.byId('passin').focus();
    },


    onPasswordChange: function () {
        jt.byId('emailin').focus();
    },


    onEmailChange: function () {
        app.login.createAccount();
    },


    displayNewAccountForm: function () {
        var username, password, html;
        username = jt.safestr(jt.safeget('userin', "value"));
        password = jt.safestr(jt.safeget('passin', "value"));
        jt.out('centerhdiv', "Creating New Account");
        html = ["table", {id: "loginform", cla: "formstyle"},
                [["tr",
                  ["td", {colspan: 2, align: "center"},
                   ["div", {id: "maccstatdiv"}]]],
                 ["tr",
                  [["td", {align: "right"},
                    ["label", {fo: "userin"}, "username"]],
                   ["td", {align: "left"},
                    ["input", {type: "text", name: "username", id: "userin",
                               onchange: jt.fs("app.login.onUserNameChange()"),
                               size: 20, value: username}]]]],
                 ["tr",
                  [["td", {align: "right"},
                    ["label", {fo: "passin"}, "password"]],
                   ["td", {align: "left"},
                    ["input", {type: "password", name: "password", id: "passin",
                               onchange: jt.fs("app.login.onPasswordChange()"),
                               size: 20, value: password}]]]],
                 ["tr",
                  [["td", {align: "right"},
                    ["label", {fo: "emailin"}, "email"]],
                   ["td", {align: "left"},
                    ["input", {type: "email", name: "emailin", id: "emailin", 
                               onchange: jt.fs("app.login.onEmailChange()"),
                               size: 30}]]]],
                 ["tr",
                  ["td", {colspan: 2, align: "center", cla: "actbuttons",
                          id: "newaccbuttonstd"},
                   [["button", {type: "button", id: "cancelbutton",
                                onclick: jt.fs("app.login.clearinit()")},
                     "Cancel"],
                    "&nbsp;",
                    ["button", {type: "button", id: "createbutton",
                                onclick: jt.fs("app.login.createAccount()")},
                     "Create"]]]],
                 emailStatementsRow()]];
        html = jt.tac2html(html);
        jt.out('logindiv', html);
        app.layout.adjust();
        jt.byId('userin').focus();
    },


    displayEmailCredForm: function () {
        var html;
        jt.out('centerhdiv', "Forgot Password");
        html = ["table", {id: "loginform", cla: "formstyle"},
                [["tr", 
                  ["td", {colspan: 2},
                   ["div", {id: "emcrediv"},
                    ["Enter the email address for your account",
                     ["br"],
                     "to have your username and password emailed to you."]]]],
                 ["tr",
                  [["td", {align: "right"},
                    ["label", {fo: "emailin"}, "email"]],
                   ["td", {align: "left"},
                    ["input", {type: "email", name: "emailin", id: "emailin",
                               onchange: jt.fs("app.login.emailCredentials()"),
                               size: 30}]]]],
                 ["tr",
                  ["td", {colspan: 2, align: "center", id: "sendbuttons"},
                   [["button", {type: "button", id: "cancelbutton",
                                onclick: jt.fs("app.login.clearinit()")},
                     "Cancel"],
                    "&nbsp;",
                    ["button", {type: "button", id: "sendbutton",
                                onclick: jt.fs("app.login.emailCredentials()")},
                     "Send"]]]]]];
        html = jt.tac2html(html);
        jt.out('logindiv', html);
        app.layout.adjust();
        jt.byId('emailin').focus();
    },


    authparams: function () {
        return authparams();
    },


    readAuthCookie: function () {
        var cval, mtn;
        cval = jt.cookie(app.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2]; }
        app.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    logout: function () {
        var html;
        logoutWithNoDisplayUpdate();
        app.profile.cancelPenNameSettings();  //close the dialog if it is up
        app.history.checkpoint({ view: "profile", profid: 0 });
        topworkdivcontents = "&nbsp;";  //clear out slideshow, won't fit.
        app.login.updateAuthentDisplay();
        if(!jt.byId('logindiv')) {
            html = ["div", {id: "logindiv"}, loginhtml];
            html = jt.tac2html(html);
            jt.out('contentdiv', html); }
        app.login.init();
    },


    altLogin: function (idx) {
        handleAlternateAuthentication(idx);
    },


    upwlogin: function () {
        var username = jt.byId('userin').value,
            password = jt.byId('passin').value,
            url, data, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            jt.out('loginstatdiv', "Please specify a username and password");
            return; }
        jt.out('loginbspan', "Signing in...");
        url = secureURL("login");
        data = jt.objdata({ user: username, pass: password });
        jt.call('POST', url, data,
                 function (objs) {
                     //same flow here as createAccount
                     setAuthentication("mid", objs[0].token, username);
                     doneWorkingWithAccount(); },
                 //no app.failf because need to handle 401 here
                 function (code, errtxt) {
                     var html;
                     jt.out('loginstatdiv', "Login failed: " + errtxt);
                     html = ["button", {type: "button", id: "loginbutton",
                                        onclick: jt.fs("app.login.upwlogin()")},
                             "Sign in"];
                     jt.out('loginbspan', jt.tac2html(html)); },
                 critsec);
    },


    setAuth: function (method, token, name) {
        setAuthentication(method, token, name);
    },


    authComplete: function () {
        doneWorkingWithAccount();
    },


    createAccount: function () {
        var username = jt.byId('userin').value,
            password = jt.byId('passin').value,
            maddr = jt.byId('emailin').value || "",
            data = "", url, buttonhtml, critsec = "";
        if(!username || !password || !username.trim() || !password.trim()) {
            jt.out('maccstatdiv', "Please specify a username and password");
            return; }
        url = secureURL("newacct");
        buttonhtml = jt.byId('newaccbuttonstd').innerHTML;
        jt.out('newaccbuttonstd', "Creating new account...");
        data = jt.objdata({ user: username, pass: password, email: maddr });
        jt.call('POST', url, data, 
                 function (objs) {
                     var html = "<p>Welcome " + username + "! Your account " +
                         "has been created. </p>" +
                         "<p>Signing in...</p>";
                     jt.out('logindiv', html);
                     //same flow here as upwlogin, but db stable wait..
                     setAuthentication("mid", objs[0].token, username);
                     setTimeout(doneWorkingWithAccount, 3000); },
                 app.failf(function (code, errtxt) {
                     jt.out('maccstatdiv', errtxt);
                     jt.out('newaccbuttonstd', buttonhtml); }),
                 critsec);
    },


    getAuthMethod: function () { 
        return authmethod; 
    },


    accountSettingsLinkHTML: function (pen) {
        var html, msgtxt;
        if(authmethod === "mid") {
            html = ["a", {href: "#AccountSettings", id: "accset",
                          onclick: jt.fs("app.login.displayUpdAccForm()")},
                    "Account settings"]; }
        else {  //not logged in natively
            if(pen.mid && pen.mid !== "0") {  //have native login authorization
                msgtxt = "You need to sign in to wdydfun directly to change" +
                    " your account settings.\\n" + 
                    "Pardon the inconvenience, it\\'s a security thing...";
                html = ["a", {href: "#AccountSettings", id: "accset",
                              onclick: jt.fs("alert('" + msgtxt + "')")},
                        "Account settings"]; }
            else {
                msgtxt = "To access cool features like a weekly activity" +
                    " summary, you first\\n" + 
                    "need to authorize wdydfun access for " + pen.name + ".";
                html = ["a", {href: "#AccountSettings", id: "accset",
                              onclick: jt.fs("alert('" + msgtxt + "')")},
                        "Account settings"]; } }
        return jt.tac2html(html);
    },


    loginInfoHTML: function (pen) {
        var html, iconurl;
        switch(authmethod) {
            case "mid": iconurl = "img/iconwdydfun.png"; break;
            case "fbid": iconurl = app.facebook.iconurl; break;
            case "twid": iconurl = app.twitter.iconurl; break;
            case "gsid": iconurl = app.googleplus.iconurl; break;
            case "ghid": iconurl = app.github.iconurl; break; }
        html = [["img", {cla: "loginico", src: iconurl}],
                ["em", authname],
                " &nbsp; ",
                ["a", {href: "logout", id: "logout",
                       onclick: jt.fs("app.login.logout()")},
                 "Sign out"]];
        html = jt.tac2html(html);
        return html;
    },


    emailCredentials: function () {
        var eaddr = jt.byId('emailin').value,
            data = "", critsec = "";
        if(!eaddr || !eaddr.trim() || !jt.isProbablyEmail(eaddr)) {
            jt.out('emcrediv', "Please enter your email address");
            return; }  //nothing to send to
        jt.out('sendbuttons', "Sending...");
        data = "email=" + jt.enc(eaddr);
        jt.call('POST', "mailcred", data,
                 function (objs) {
                     dispEmailSent(); },
                 app.failf(function (code, errtxt) {
                     jt.out('emcrediv', errtxt); }),
                 critsec);
    }


};  //end of returned functions
}());

