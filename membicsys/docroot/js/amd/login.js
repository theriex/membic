/*global confirm, window, document, history, app, jt */

/*jslint browser, white, fudge, for, long */

app.login = (function () {
    "use strict";

    var initialTopActionHTML = "";
    var cookdelim = "..membicauth..";
    var authobj = null;  //email, token, authId, status, altinmail, signInTS
    var actsent = null;


    function verifyUserInfo () {
        if(!authobj) {
            return jt.log("verifyUserInfo called without authentication"); }
        //If the user info was already loaded, then the displays are
        //probably up to date, but that's not guaranteed given server call
        //timing.  Best to just just redraw.
        app.refmgr.getFull("MUser", authobj.authId, function () {
            app.statemgr.redispatch(); });
    }


    function readAuthentCookie () {
        var ret = null;
        var cval = jt.cookie(app.authcookname);
        if(cval && cval.indexOf(cookdelim) < 0) {  //invalid delimiter
            jt.log("readAuthentCookie bad cookdelim, nuked cookie.");
            jt.cookie(app.authcookname, "", -1);
            cval = ""; }
        if(cval) {
            var mtn = cval.split(cookdelim);
            mtn[0] = mtn[0].replace("%40", "@");
            if(mtn[0].indexOf("@") < 0 || mtn[1].length < 20) {
                //might have been "undefined" or other bad value
                jt.log("readAuthentCookie bad name/token, nuked cookie.");
                jt.cookie(app.authcookname, "", -1);
                cval = ""; }
            else {
                ret = {authname:mtn[0], authtoken:mtn[1]}; } }
        return ret;
    }


    function setAuthentCookie (remove) {
        if(remove) {
            jt.cookie(app.authcookname, "", -1); }
        else {
            var cval = authobj.email + cookdelim + authobj.token;
            jt.cookie(app.authcookname, cval, 365); }
    }


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


    function errmsg (txt) {
        jt.out("topmessagelinediv", jt.tac2html(
            ["span", {cla:"errmsgtextspan"}, txt]));
    }


    //The login form must already exist in index.html for saved passwords
    //to work on some browsers.  This adds the detail.
    function displayLoginForm (params) {
        addParamValuesToLoginForm(params);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            errmsg(fixServerText(params.loginerr, params.emailin)); }
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


    function handleInitialParamSideEffects (params) {
        if(params.an && params.at) {
            setAuthentication(params.an, params.at); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //clean up the URL display
            clearParams(); }
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


    //This works in conjunction with the static undecorated form created by
    //start.py, decorating to provide login without page reload.  Submission
    //via the server is inneficient, but if necessary can be handled server
    //side by setting a cookie.
    function initLoginForm (restore) {
        if(initialTopActionHTML && !restore) {
            return; }  //login form was already set up, nothing to do.
        if(!initialTopActionHTML) {  //save so it can be restored on logout
            initialTopActionHTML = jt.byId("topactiondiv").innerHTML; }
        else if(restore) {
            jt.out("topactiondiv", initialTopActionHTML); }
        //decorate the plain HTML for processing
        jt.out("resetpassdiv", jt.tac2html(
            ["a", {id:"resetpw", href:"#resetpassword",
                   title:"Email a password reset link",
                   onclick:jt.fs("app.login.resetPassword()")},
             "reset password"]));
        jt.on("loginform", "submit", app.login.formSubmitOverride);
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
        //Secure site communications (https) are verified on init. Not
        //checking that again here.  Save the initial login form so it
        //can be restored on logout as needed.
        initLoginForm();
        //Always make the call to sign in.  If bad cookie or other issues
        //then deal with that immediately.
        app.login.signIn();
    },


    formSubmitOverride: function (event) {
        jt.evtend(event);
        app.login.signIn();
    },


    signIn: function (createNewAccount) {
        jt.out("topmessagelinediv", "");  //clear any previous login error
        var sav = readAuthentCookie() || {};
        var ps = {an:app.startParams.an || sav.authname || "",
                  at:app.startParams.at || sav.authtoken || "",
                  emailin:jt.safeget("emailin", "value") || "",
                  passin:jt.safeget("passin", "value")};
        if(createNewAccount) {
            if(!jt.isProbablyEmail(ps.emailin)) {
                return jt.out("topmessagelinediv", "Email address required"); }
            ps.newacct = true; }
        else if(!((ps.an || ps.emailin) && (ps.at || ps.passin))) {
            return; }  //not trying to sign in yet.
        jt.log("Signing in...");
        //Regardless of whether the signin call works or not, clear any auth
        //information passed in the URL parameters so it doesn't hang
        //around.  Already cleared from the URL in initial state dispatch.
        app.startParams.an = "";
        app.startParams.at = "";
        //This is a lightweight call to avoid the wait time associated with
        //downloading a full MUser instance.  The goal is to switch out of
        //the login form into the main interaction form to allow for writing
        //a membic as quickly as possible.  If the call succeeds, the result
        //object has the authentication token and privileged user info.
        jt.call("POST", app.dr("/api/signin"), jt.objdata(ps),
                function (result) {
                    authobj = result[0];
                    setAuthentCookie();
                    jt.out("topactiondiv", jt.tac2html(
                        [["div", {id:"topnavdiv"}],
                         ["div", {id:"newmembicdiv"}]]));
                    app.statemgr.updatenav();
                    app.membic.addMembic();
                    verifyUserInfo(); },
                function (code, errtxt) {
                    jt.log("authentication failure " + code + ": " + errtxt);
                    jt.out("topmessagelinediv", errtxt); },
                jt.semaphore("login.signIn"));
    },


    //If they are not logged in, then authobj is null.  Can be used as an
    //"isLoggedIn" check and/or for access to personal info.
    authenticated: function () { return authobj; },
    setAuthentication: function (obj) { 
        authobj = obj;
        setAuthentCookie();
    },
    authURL: function (apiurl) {
        return app.dr(apiurl) + "?an=" + authobj.email + "&at=" + authobj.token;
    },


    //Themes have custom keywords, profiles don't.  Otherwise the keywords
    //get restrictive and you end up wanting to create a separate account
    //for more diverse links.  Better to create a theme earlier on.
    accountSettingsHTML: function () {
        var prof = app.profile.myProfile();
        prof.cliset.embcolors = prof.cliset.embcolors || {};
        var emboHTML = [];
        var embcolors = prof.cliset.embcolors;
        app.pcd.embOverrides().forEach(function (od) {
            embcolors[od.name] = embcolors[od.name] || od.value;
            emboHTML.push(["div", {cla:"colorselectdiv"},
                           [["label", {fo:od.name + "in", cla:"colorlab"},
                             od.name.capitalize()],
                            ["input", {id:od.name + "in", cla:"colorin",
                                       type:"color", 
                                       value:embcolors[od.name]}]]]); });
        var statusHTML = jt.tac2html(
            [["span", {cla:"statlineval"}, authobj.status],
             " updated " + jt.colloquialDate(prof.modified, "compress", 
                                             "nodaily z2loc")]);
        var emburl = app.statemgr.urlForInstance(prof) + "?site=YOURSITE.COM";
        return jt.tac2html(
            ["div", {id:"accountsettingsformdiv"},
             [["div", {cla:"cbdiv"},
               [["label", {fo:"emailin", cla:"liflab"}, "Email"],
                ["input", {type:"email", cla:"lifin", id:"emailin",
                           value:authobj.email,
                           placeholder: "nospam@example.com"}]]],
              ["div", {cla:"cbdiv"},  //"passin" is reserved for login form
               [["label", {fo:"updpin", cla:"liflab"}, "Password"],
                ["input", {type:"password", cla:"lifin", id:"updpin"}]]],
              ["div", {cla:"cbdiv"},
               [["label", {fo:"altemin", cla:"liflab"}, "Alt&nbsp;Email"],
                ["input", {type:"email", cla:"lifin", id:"altemin",
                           value:authobj.altinmail || "",
                           placeholder:"alternate@example.com"}]]],
              ["div", {cla:"cbdiv"},
               ["div", {cla:"infolinediv"}, statusHTML]],
              ["div", {cla:"cbdiv"},
               [["label", {fo:"hashin", cla:"liflab"}, "Hashtag"],
                ["input", {type:"text", cla:"lifin", id:"hashin",
                           value:prof.hashtag || "",
                           placeholder:"uniquetext"}]]],
              ["div", {cla:"cbdiv"},
               ["div", {cla:"infolinediv"},
                ["Embed: ",
                 ["a", {href:emburl, title:"Embed this page in your website",
                        onclick:jt.fs("window.open('" + emburl + "')")},
                  emburl]]]],
              ["div", {cla:"cbdiv"},
               ["div", {id:"colorchoicesdiv"},
                emboHTML]],
              ["div", {cla:"cbdiv"},
               ["div", {cla:"infolinediv", id:"accsetinfdiv"}]],
              ["div", {id:"accountsettingsbuttonsdiv"},
               [["button", {type:"button", id:"accupdbutton",
                            onclick: jt.fs("app.login.updateAccount()")},
                 "Update"]]]]]);
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
            return initLoginForm("restore"); }
        //logged in...
        var navs = [
            {name:"Themes", im:"img/membiclogo.png", fs:"app.connect.display"},
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
        var prof = app.profile.myProfile();
        var pu = {dsType:"MUser", dsId:prof.dsId};
        pu.email = jt.byId("emailin").value.trim();
        if(!jt.isProbablyEmail(pu.email)) {
            return jt.out("accsetinfdiv", "Invalid email address"); }
        pu.password = jt.byId("updpin").value.trim();
        if(pu.email !== prof.email && !pu.password) {
            return jt.out("accsetinfdiv",
                          "Password required to change email."); }
        if(pu.email !== prof.email && !confirm("You will need to re-activate your account from your new email address " + pu.email)) {
            return; }  //continue editing.
        pu.altinmail = jt.byId("altemin").value.trim();
        if(pu.altinmail && !jt.isProbablyEmail(pu.altinmail)) {
            return jt.out("accsetinfdiv", "Invalid alternate email"); }
        pu.altinmail = pu.altinmail || "UNSET_VALUE";
        pu.hashtag = jt.byId("hashin").value.trim() || "UNSET_VALUE";
        pu.cliset = prof.cliset;  //unsaved changes in cached prof are ok
        app.pcd.embOverrides().forEach(function (od) {
            pu.cliset[od.name] = jt.byId(od.name + "in").value; });
        jt.out("accsetinfdiv", "Updating...");
        jt.byId("accupdbutton").disabled = true;
        app.profile.update(pu,
            function (prof) { //updated account already cached
                jt.out("accsetinfdiv", "Profile updated.");
                app.fork({descr:"Close account settings display", ms:800,
                          func:app.pcd.settings}); },
            function (code, errtxt) {
                jt.byId("accupdbutton").disabled = false;
                jt.out("accsetinfdiv", "Update failed code " + code + " " +
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
        app.verifyHome();
        if(errprompt) {
            jt.err(errprompt); }
        handleRedirectOrStartWork();
    },


    createAccount: function () {
        var emaddr = jt.byId("emailin").value;
        var password = jt.byId("passin").value;
        if(!emaddr || !emaddr.trim()) {
            errmsg("Please specify an email and password");
            jt.byId("emailin").focus();
            return; }
        if(!password || !password.trim()) {
            errmsg("Please specify a password");
            jt.byId("emailin").focus();
            return; }
        errmsg("");   //clear any previous message
        var buttonhtml = jt.byId("loginbuttonsdiv").innerHTML;
        jt.out("loginbuttonsdiv", "Creating new account...");
        emaddr = emaddr.toLowerCase();
        var data = jt.objdata({ emailin: emaddr, passin: password });
        jt.call("POST", secureURL("newacct"), data, 
                 function (objs) {
                     var html = "<p>Your account has been created." + 
                         " Welcome to the Membic community!</p>" +
                         "<p>Signing you in for the first time now...</p>";
                     jt.out("topactiondiv", html);
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
                     errmsg(errtxt);
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
            app.connect.keepdef();  //save the definition for general use
            //if pfoj is a theme or profile, view it (specified by the URL)
            if(app.pfoj && app.pfoj.dsType === "Theme") {
                state = {view:"theme", dsId:app.pfoj.dsId}; }
            else if(app.pfoj && app.pfoj.dsType === "MUser") {
                state = {view:"profile", dsId:app.pfoj.dsId}; }
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
            errmsg("Please fill in your email address...");
            return; }
        errmsg("Sending...");
        var data = "emailin=" + jt.enc(emaddr);
        jt.call("POST", "mailpwr", data,
                function (ignore /*objs*/) {
                    errmsg("");
                    displayEmailSent(); },
                app.failf(function (ignore /*code*/, errtxt) {
                    errmsg(errtxt); }),
                jt.semaphore("resetPassword"));
    }

};  //end of returned functions
}());

