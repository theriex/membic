/*global confirm, window, document, history, app, jt */

/*jslint browser, white, fudge, for, long */

app.login = (function () {
    "use strict";

    var authname = "";
    var authtoken = "";
    var cookdelim = "..membicauth..";
    var initialTopSectionHTML = "";
    var actsent = null;


    function secureURL (endpoint) {
        var url = window.location.href;
        var sm = url.match(/^https:\/\//);
        var dm = url.match(/:\d080/);
        //reject plain .com URL only, let subdirs and specific requests 
        //through to support any older embeddings or permalinks.
        var cm = url.match(/^https?:\/\/(www\.)?(membic.com)\/?$/);
        if((sm || dm) && !cm) {  //secure or dev but not .com
            url = endpoint; }  //relative path url ok, data is encrypted
        else {  //return secured URL for endpoint
            endpoint = endpoint || "";
            url = app.secsvr + "/" + endpoint; }
        return url;
    }


    function authparams (prefix) {
        var params = prefix || "";
        params += "an=" + jt.enc(authname) + "&at=" + authtoken;
        return params;
    }


    //Produces less cryptic params to read
    function authparamsfull () {
        var params = "authname=" + jt.enc(authname) + 
                     "&authtoken=" + authtoken;
        return params;
    }


    function logoutWithNoDisplayUpdate () {
        //remove the cookie and reset the app vars
        jt.cookie(app.authcookname, "", -1);
        authtoken = "";
        authname = "";
        app.review.resetStateVars();
        app.profile.resetStateVars();
        //no history clear, each display reacts to login state
    }


    function clearParams () {
        //this also clears any search parameters to leave a clean url.
        //that way a return call from someplace like twitter doesn't
        //keep token info and similar parameter stuff hanging around.
        var url = window.location.pathname;
        //note this is using the standard html5 history directly.  That's
        //a way to to clear the URL noise without a redirect triggering
        //a page refresh. 
        if(history && history.pushState && 
                      typeof history.pushState === "function") {
            history.pushState("", document.title, url); }
    }


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (muser.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    function setAuthentication (name, token, noupdate) {
        var cval = name + cookdelim + token;
        jt.cookie(app.authcookname, cval, 365);
        authtoken = token;
        authname = name;
        if(authname) {
            authname = authname.replace("%40", "@"); }
        if(!noupdate) {
            app.login.updateTopSection(); }
    }


    function displayEmailSent () {
        var html;
        html = [["p", 
                 [["Your account information has been emailed to "],
                  ["code", jt.byId("emailin").value],
                  [" and should arrive in a few minutes.  If it doesn't" + 
                   " show up, please"]]],
                ["ol",
                 [["li", "Make sure your email address is spelled correctly"],
                  ["li", "Check your spam folder"],
                  ["li", "Confirm the email address you entered is the same" +
                        " one you used when you created your account."]]],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Email Account Password", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId("okbutton").focus(); });
    }


    function onLoginEmailChange (e) {
        var passin;
        jt.evtend(e); 
        passin = jt.byId("passin");
        //Unbelievably, the passin field may not be available yet if
        //this is a browser autosubmit of saved credentials in Safari.
        //Don't create error noise in that case.
        if(passin) {
            passin.focus(); }
    }


    //webkit likes to escape at signs
    function fixEmailAddress (emaddr) {
        emaddr = emaddr.replace(/%40/g, "@");
        return emaddr;
    }


    //safari displays "No%20match%20for%20those%20credentials"
    //and even "No%2520match%2520for%2520those%2520credentials"
    function fixServerText (text, email) {
        if(!text) {
            text = ""; }
        text = text.replace(/%20/g, " ");
        text = text.replace(/%2520/g, " ");
        if(text.startsWith("Not registered")) {
            if(email) {
                email = fixEmailAddress(email); }
            text = (email || "Account") + " not found, click \"Create\""; }
        return text;
    }


    function setFocusOnEmailInput () {
        jt.retry(function () {  //setting the focus is not reliable
            var actel = document.activeElement;
            if(!actel || actel.id !== "emailin") {
                actel = jt.byId("emailin");
                if(actel) {
                    actel.focus();
                    jt.log("Set emailin focus..."); } }
            else {
                jt.log("emailin focus set already."); }
        }, [200, 400, 600]);
    }


    function addParamValuesToLoginForm (params) {
        var html = [];
        //add url parameters to pass through on form submit.  Except for
        //emailin, which should always be read from the form even if it
        //is passed back from the server for use in error handling.
        Object.keys(params).forEach(function (key) {
            if(key !== "emailin") {
                html.push(["input", {type:"hidden", name:key,
                                     value:params[key]}]); } });
        //The default display after login is what should happen, unless the
        //app was started from a link with an action.
        if(!params.returnto && app.originalhref.indexOf("action=follow") > 0) {
            html.push(["input", {type:"hidden", name:"returnto",
                                 value:app.originalhref}]); }
        jt.out("loginparaminputs", jt.tac2html(html));
    }


    function nextStepOrRestartAction () {
        var params = "";
        if(app.originalhref.indexOf("action=follow") > 0) {
            params = {returnto:app.originalhref}; }
        app.login.doNextStep(params);
    }


    //prefer output in the login form if available, otherwise use main stat div
    function loginstat (txt) {
        var loginstatformdiv = jt.byId("loginstatformdiv");
        if(loginstatformdiv) {
            jt.out("loginstatformdiv", jt.tac2html(
                ["span", {cla:"loginstatspan"}, txt]));
            return; }
        if(!txt) {
            //keep some text in the div so it doesn't collapse
            jt.out("loginstatdiv", "&nbsp;"); }
        else {
            //wrap the text so it can be offset from the background
            jt.out("loginstatdiv", jt.tac2html(
                ["span", {cla:"loginstatspan"}, txt])); }
    }


    //The login form must already exist in index.html for saved passwords
    //to work on some browsers.  This adds the detail.
    function displayLoginForm (params) {
        addParamValuesToLoginForm(params);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            loginstat(fixServerText(params.loginerr, params.emailin)); }
        if(authname) {
            jt.byId("emailin").value = authname; }
        if(params.emailin) {
            jt.byId("emailin").value = params.emailin; }
        //topsectiondiv content is now changed, save the updated for restore
        jt.on("emailin", "change", onLoginEmailChange);
        //Since this is an actual form, the default form action is
        //already triggered on return, and setting a handler
        //interferes with the Create Account button press.
        //jt.on("passin", "change", onLoginPasswordChange);
        setFocusOnEmailInput();
    }


    function actSendContactHTML () {
        var now = new Date();
        var mins = ((now.getHours() - actsent.getHours()) * 60) +
            (now.getMinutes() - actsent.getMinutes());
        var subj = "Account activation email";
        var body = "Hey,\n\n" +
            "I've been waiting over " + mins + " " +
            ((mins === 1) ? "minute" : "minutes") + 
            " for activation email to show up and still haven't received anything.  I've checked my spam folder and it's not there.  Would you please reply to this message and send me my activation code so I can post a membic?\n\n" +
            "Thanks!\n";
        var prof = app.profile.myProfile();
        if(prof) {
            body += prof.name + " (ProfileId: " + prof.instid + ")\n"; }
        var html = ["a", {href: "mailto:" + app.suppemail + "?subject=" + 
                          jt.dquotenc(subj) + "&body=" + jt.dquotenc(body)},
                    "Contact Support"];
        return html;
    }


    function activateButtonOrNoticeHTML (prof) {
        var html = ["button", {type:"button", id:"activatebutton",
                               onclick:jt.fs("app.login.sendActivation()")},
                    "Activate"];
        var sent = false;
        if(prof.actsends) {
            var sends = prof.actsends.split(",");
            sent = sends[sends.length - 1];
            sent = sent.split(";");
            if(sent[1] === prof.email && 
                   jt.timewithin(sent[0], "hours", 4)) {
                sent = sent[0]; }
            else {
                sent = false; } }
        if(sent) {
            actsent = new Date(sent);
            html = [["p", {cla:"actsendtxt"}, "You&apos;ve been waiting"],
                    ["div", {id:"actsendcounterdiv"}],
                    ["p", {cla:"actsendtxt"},
                     ["for activation mail to arrive.", ["br"],
                      "Still hasn&apos;t shown up?! Check your", ["br"],
                      "spam folder or ", 
                      ["span", {id:"actcontactlinkspan"}]]],
                    ["p", {cla:"actsendtxt"}, "&nbsp;"]];
            jt.out("accstatdetaildiv", jt.tac2html(html));
            html = ["span", {cla:"actmailtext"},
                    ["a", {href:"#activationmaildetails",
                           onclick: jt.fs("app.login.toggleactmaildet()")},
                     "mail sent"]]; }
        return html;
    }


    function writeUsermenuAccountFormElements (prof) {
        var html;
        if(prof.status === "Active") {
            html = [["span", {cla:"accstatvalspan"}, "Active"],
                    ["button", {type:"button", id:"deactivatebutton",
                                onclick:jt.fs("app.login.deactivateAcct()")},
                     "Deactivate"]]; }
        else { //Pending|Inactive|Unreachable
            html = [["span", {cla:"accstatvalspan"},
                     prof.status || "Pending"],
                    activateButtonOrNoticeHTML(prof)]; }
        //With an empty label, this line of the form gets skewed to
        //the left.  With visible text, the font height is off and the
        //vertical alignment looks bad.  Using a hard space as the label.
        jt.out("accstatusupdatediv", jt.tac2html(
            [["label", {fo:"emptyspace", cla:"liflab"}, "&nbsp;"],
             ["span", {id:"buttonornotespan"},
              html]]));
        //Just a single password entry field.  They can reset it if needed.
        jt.out("accpassupdatediv", jt.tac2html(
            [["label", {fo:"passin", cla:"liflab"}, "Password"],
             ["input", {type:"password", cla:"lifin", 
                        name:"passin", id:"passin"}]]));
        //Give a choice on how many posts before queueing them.
        jt.out("maxpostperdaydiv", jt.tac2html(
            [["label", {fo:"maxpdsel", cla:"liflab"}, "Feed"],
             ["select", {id:"maxpdsel"},
              [["option", {value:1}, 
                1],
               ["option", {selected:jt.toru(
                   app.profile.getwd("maxPostsPerDay", 1) === 2),
                           value:2}, 
                2]]],
             ["span", {cla:"accstatvalspan"}, "&nbsp;membic per day"]]));
    }


    function logLoadTimes () {
        var timer = app.amdtimer;
        var millis = timer.load.end.getTime() - timer.load.start.getTime();
        jt.log("load app: " + millis);
    }


    function loadThirdPartyUtilities () {
        //google fonts can occasionally be slow or unresponsive.  Load here to
        //avoid holding up app initialization
        var elem = document.createElement("link");
        elem.rel = "stylesheet";
        elem.type = "text/css";
        elem.href = "//fonts.googleapis.com/css?family=Open+Sans:400,700";
        document.head.appendChild(elem);
        jt.log("added stylesheet " + elem.href);
        //handwriting font for pen name display
        elem = document.createElement("link");
        elem.rel = "stylesheet";
        elem.type = "text/css";
        elem.href = "//fonts.googleapis.com/css?family=Shadows+Into+Light+Two";
        document.head.appendChild(elem);
        jt.log("added stylesheet " + elem.href);
        //The google places API doesn't like being loaded asynchronously so
        //leaving it last in the index file instead.
    }


    function loggedInDoNextStep (params) {
        //On localhost, params are lost when the login form is
        //displayed.  On the server, they are passed to the secure
        //host and returned post-login.  These are separate flows.
        //Not supporting a separate param processing path just for
        //local development.  This func is pretty much here to hold
        //this comment and prevent running around in circles for hours
        //trying to debug authentication passthroughs.
        app.login.doNextStep(params);
    }


    function applyCSSOverride (cssurl) {
        var csselem = document.createElement("link");
        csselem.rel = "stylesheet";
        csselem.type = "text/css";
        cssurl = jt.dec(cssurl);
        cssurl = cssurl.toLowerCase();
        if(cssurl.indexOf("http") < 0) {
            cssurl = "css/embed/" + cssurl + ".css"; }
        csselem.href = cssurl;
        document.head.appendChild(csselem);
    }


    function handleInitialParamSideEffects (params) {
        if(params.an && params.at) {
            setAuthentication(params.an, params.at); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //clean up the URL display
            clearParams(); }
        if(params.css) {
            applyCSSOverride(params.css); }
        //handle specific context requests
        else if(params.view === "about") {
            app.history.checkpoint({ view: "about" }); }
        else if(params.view && (params.coopid || params.hashtag || 
                                params.penid || params.profid)) {
            params.coopid = params.coopid || app.vanityStartId;
            app.history.checkpoint({ view: params.view, 
                                     penid: params.penid,
                                     profid: params.profid,
                                     coopid: params.coopid,
                                     tab: params.tab,
                                     expid: params.expid,
                                     action: params.action }); }
    }


    function saveTopSectionHTML () {
        if(initialTopSectionHTML) {
            return; }  //already have it
        //add any needed html to what was sourced from the server
        var html = ["a", {id:"resetpw", href:"#resetpassword",
                          title:"Email a password reset link",
                          onclick:jt.fs("app.login.resetPassword()")},
                    "reset password..."];
        jt.out("resetpassdiv", jt.tac2html(html));
        html = jt.byId("topsectiondiv").innerHTML;
        initialTopSectionHTML = html;
    }


    function handleRedirectOrStartWork () {
        var params = jt.parseParams("String");
        params.an = params.an || params.authname;
        params.at = params.at || params.authtoken;
        handleInitialParamSideEffects(params);
        //figure out what to do next
        if(authtoken || app.login.readAuthCookie()) {
            loggedInDoNextStep(params); }
        else if(secureURL("login") === "login") {
            displayLoginForm(params);
            app.login.doNextStep(params); }
        else { 
            if(app.haveReferrer()) {
                params.referral = jt.enc(document.referrer); }
            app.redirectToSecureServer(params); }
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        logLoadTimes();
        app.fork({descr:"dynamic fonts",
                  func:loadThirdPartyUtilities, ms:5});
        saveTopSectionHTML();
        handleRedirectOrStartWork();
    },


    accountSettingsHTML: function () {
        var html = ["div", {id:"accountsettingsformdiv"},
                    [["div", {cla:"lifsep"},
                      [["label", {fo:"emailin", cla:"liflab"}, "Email"],
                       ["input", {type:"email", cla:"lifin",
                                  name:"emailin", id:"emailin",
                                  value:authname,
                                  placeholder: "nospam@example.com"}]]],
                     ["div", {cla:"lifsep", id:"accstatusupdatediv"}],
                     ["div", {cla:"lifsep", id:"accstatdetaildiv"}],
                     ["div", {cla:"lifsep", id:"accpassupdatediv"}],
                     ["div", {cla:"lifsep", id:"maxpostperdaydiv"}],
                     ["div", {cla:"lifsep", id:"usermenustat"}],
                     ["div", {cla:"dlgbuttonsdiv"},
                      [["button", {type:"button", id:"accupdbutton",
                                   onclick: jt.fs("app.login.updateAccount()")},
                        "Update Personal"]]]]];
        return html;
    },


    accountSettingsInit: function () {
        var detdiv = jt.byId("accstatdetaildiv");
        if(!detdiv) { //form fields no longer displayed so nothing to do
            return; }
        detdiv.style.display = "none";
        app.profile.fetchProfile(function (prof) {
            writeUsermenuAccountFormElements(prof); });
    },


    displayActivationWaitTimer: function () {
        var ascdiv = jt.byId("actsendcounterdiv");
        if(ascdiv) {
            var diff = Date.now() - actsent.getTime();
            var hrs = Math.floor(diff / (60 * 60 * 1000));
            diff -= hrs * 60 * 60 * 1000;
            var mins = Math.floor(diff / (60 * 1000));
            diff -= mins * 60 * 1000;
            var secs = Math.floor(diff / 1000);
            var txt = String(hrs) + " " + ((hrs === 1) ? "hour" : "hours") +
                ", " + mins + " " + ((mins === 1) ? "minute" : "minutes") +
                ", " + secs + " " + ((secs === 1) ? "second" : "seconds");
            jt.out("actsendcounterdiv", txt);
            jt.out("actcontactlinkspan", jt.tac2html(actSendContactHTML()));
            app.fork({descr:"Activation wait time",
                      func:app.login.displayActivationWaitTimer,
                      ms:1000}); }
    },


    toggleactmaildet: function () {
        var detdiv = jt.byId("accstatdetaildiv");
        if(detdiv) {
            if(detdiv.style.display === "block") {
                detdiv.style.display = "none"; }
            else {
                detdiv.style.display = "block";
                app.login.displayActivationWaitTimer(); } }
    },


    deactivateAcct: function () {
        var emaddr = jt.byId("emailin").value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before deactivating.");
            return; }
        if(!confirm("If you want to re-activate your account after deactivating, you will need to confirm your email address again.")) {
            return; }
        jt.out("buttonornotespan", "Deactivating...");
        var params = app.login.authparams() + "&status=Inactive" + 
            jt.ts("&cb=", "second");
        jt.call("GET", "activate?" + params, null,
                function (accounts) {
                    app.lcs.put("profile", accounts[0]);
                    writeUsermenuAccountFormElements(accounts[0]); },
                app.failf(function (code, errtxt) {
                    jt.err("Deactivation failed " + code + ": " + errtxt);
                    writeUsermenuAccountFormElements(
                        app.profile.myProfile()); }),
                jt.semaphore("login.deactivateAcct"));
    },


    sendActivation: function (ignore /*status*/) {
        var emaddr = jt.byId("emailin").value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before activating.");
            return; }
        jt.out("buttonornotespan", "Sending...");
        jt.call("POST", "sendcode?" + app.login.authparams(), "",
                function (accounts) {
                    app.lcs.put("profile", accounts[0]);
                    writeUsermenuAccountFormElements(accounts[0]); },
                app.failf(function (code, errtxt) {
                    jt.err("Sending failed " + code + ": " + errtxt);
                    writeUsermenuAccountFormElements(
                        app.profile.myProfile()); }),
                jt.semaphore("login.sendActivation"));
    },


    updateTopSection: function () {
        if(!app.login.isLoggedIn()) {
            if(initialTopSectionHTML && !jt.byId("loginform")) {
                jt.out("topsectiondiv", initialTopSectionHTML); }
            return; }
        //logged in...
        var navs = [
            {name:"Themes", im:"img/membiclogo.png", fs:"app.themes.display"},
            {name:"Profile", im:"img/profile.png", fs:"app.profile.display"},
            {name:"Write", im:"img/writenew.png", fs:"app.review.start"}];
        var html = [];
        navs.forEach(function (nav, idx) {
            html.push(["button", {type:"button", onclick:jt.fs(nav.fs + "()")},
                       [["img", {cla:"navimg", src:nav.im}],
                        nav.name]]);
            if(idx < navs.length - 1) {
                html.push("&nbsp;&nbsp;&nbsp;&nbsp"); } });
        html = ["div", {id:"topnavdiv"}, html];
        jt.out("topsectiondiv", jt.tac2html(html));
    },


    updateAccount: function () {
        var emval = jt.byId("emailin").value.trim();
        if(!jt.isProbablyEmail(emval)) {
            return jt.out("usermenustat", "Invalid email address"); }
        var emold = app.profile.myProfile().email;
        var passval = jt.byId("passin").value.trim();
        if(!passval && emval !== emold) {
            return jt.out("usermenustat", "Password needed for email change"); }
        if(emval !== emold && !confirm("You will need to re-activate your account from your new email address " + emval)) {
            return; }
        var mpdsel = jt.byId("maxpdsel");
        var maxpd = Number(mpdsel.options[mpdsel.selectedIndex].value);
        app.profile.setnu("maxPostsPerDay", maxpd);
        jt.byId("accupdbutton").disabled = true;
        jt.out("usermenustat", "Updating personal info...");
        //account update also updates authent info.
        app.profile.update(
            {emailin:emval, passin:passval, 
             cliset:(app.profile.myProfile().cliset || "")},
            function (prof) { //updated account already cached
                //need to rebuild the displayed account info, status change..
                writeUsermenuAccountFormElements(prof);
                jt.byId("accupdbutton").disabled = false;
                jt.out("usermenustat", "Personal info updated."); },
            function (code, errtxt) {
                jt.byId("accupdbutton").disabled = false;
                jt.byId("usermenustat", "Update failed code " + code + " " +
                        errtxt); });
    },


    authparams: function (prefix) {
        return authparams(prefix);
    },


    isLoggedIn: function () {
        if(authname && authtoken) {
            return true; }
        return false;
    },


    readAuthCookie: function () {
        var cval = jt.cookie(app.authcookname);
        if(cval && cval.indexOf(cookdelim) < 0) {  //invalid delimiter
            jt.log("readAuthCookie bad cookdelim, nuked cookie.");
            jt.cookie(app.authcookname, "", -1);
            cval = ""; }
        if(cval) {
            var mtn = cval.split(cookdelim);
            mtn[0] = mtn[0].replace("%40", "@");
            if(mtn[0].indexOf("@") < 0 || mtn[1].length < 20) {
                //might have been "undefined" or other bad value
                jt.log("readAuthCookie bad name/token, nuked cookie.");
                jt.cookie(app.authcookname, "", -1);
                cval = ""; }
            else {
                authname = mtn[0];
                authtoken = mtn[1]; } }
        app.login.updateTopSection();
        return authtoken;  //true if set earlier
    },


    logout: function (errprompt) {
        app.layout.closeDialog();
        app.layout.cancelOverlay();
        logoutWithNoDisplayUpdate();
        app.login.updateTopSection();
        jt.out("sysnoticediv", "");
        app.verifyHome();
        if(errprompt) {
            jt.err(errprompt); }
        handleRedirectOrStartWork();
    },


    setAuth: function (name, token) {
        setAuthentication(name, token);
    },


    createAccount: function () {
        var emaddr = jt.byId("emailin").value;
        var password = jt.byId("passin").value;
        if(!emaddr || !emaddr.trim()) {
            loginstat("Please specify an email and password");
            jt.byId("emailin").focus();
            return; }
        if(!password || !password.trim()) {
            loginstat("Please specify a password");
            jt.byId("emailin").focus();
            return; }
        loginstat("");   //clear any previous message
        var buttonhtml = jt.byId("loginbuttonsdiv").innerHTML;
        jt.out("loginbuttonsdiv", "Creating new account...");
        emaddr = emaddr.toLowerCase();
        var data = jt.objdata({ emailin: emaddr, passin: password });
        jt.call("POST", secureURL("newacct"), data, 
                 function (objs) {
                     var html = "<p>Your account has been created." + 
                         " Welcome to the Membic community!</p>" +
                         "<p>Signing you in for the first time now...</p>";
                     jt.out("logindiv", html);
                     setAuthentication(emaddr, objs[0].token, "noupdate");
                     app.history.checkpoint({view:"profile"});
                     //Wait briefly to give the db a chance to stabilize.
                     //Without waiting, it won't work.  With waiting, it
                     //usually works, but not guaranteed.  User might have
                     //to login again, or reload the page if extreme lag.
                     app.fork({descr:"new account stabilization wait",
                               func:nextStepOrRestartAction,
                               ms:3000}); },
                 app.failf(function (ignore /*code*/, errtxt) {
                     loginstat(errtxt);
                     jt.out("loginbuttonsdiv", buttonhtml); }),
                jt.semaphore("login.createAccount"));
    },


    doNextStep: function (params) {
        if(!params) {
            params = jt.parseParams("String"); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            var redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            var xpara = jt.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no tag redirect so check current state.  State may be from history
        //pop or set by handleRedirectOrStartWork
        var state = app.history.currState();
        if(!state || !state.view) {
            jt.log("login.doNextStep determining default state");
            app.themes.keepdef();  //save the definition for general use
            //if pfoj is a theme or profile, view it (specified by the URL)
            if(app.pfoj && app.pfoj.dsType === "Theme") {
                state = {view:"coop", coopid:app.pfoj.dsId}; }
            else if(app.pfoj && app.pfoj.dsType === "MUser") {
                state = {view:"profile", profid:app.pfoj.dsId}; }
            else if(app.login.isLoggedIn()) {  //your profile is your home
                state = {view: "profile"}; }
            else {
                state = {view: "themes"}; } }
        if(params.url) {
            app.urlToRead = params.url; }
        app.login.updateTopSection();
        jt.log("login.doNextStep dispatching state " + JSON.stringify(state));
        app.history.dispatchState(state);
    },


    resetPassword: function () {
        var emaddr = jt.byId("emailin").value;
        if(!jt.isProbablyEmail(emaddr)) {
            loginstat("Please fill in your email address...");
            return; }
        loginstat("Sending...");
        var data = "emailin=" + jt.enc(emaddr);
        jt.call("POST", "mailpwr", data,
                function (ignore /*objs*/) {
                    loginstat("");
                    displayEmailSent(); },
                app.failf(function (ignore /*code*/, errtxt) {
                    loginstat(errtxt); }),
                jt.semaphore("resetPassword"));
    }

};  //end of returned functions
}());

