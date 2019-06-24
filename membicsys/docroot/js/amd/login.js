/*global confirm, window, document, history, app, jt */

/*jslint browser, white, fudge, for, multivar */

app.login = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var authname = "",
        authtoken = "",
        moracct = null,
        cookdelim = "..morauth..",
        initialTopSectionHTML = "",
        toprightdivcontents = "",
        loginhtml = "",
        actsent = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    secureURL = function (endpoint) {
        var url = window.location.href,
            sm = url.match(/^https:\/\//),
            dm = url.match(/:\d080/),
            //reject plain .com URL only, let subdirs and specific requests 
            //through to support any older embeddings or permalinks.
            cm = url.match(/^https?:\/\/(www\.)?(membic.com)\/?$/);
        if((sm || dm) && !cm) {  //secure or dev but not .com
            url = endpoint; }  //relative path url ok, data is encrypted
        else {  //return secured URL for endpoint
            endpoint = endpoint || "";
            url = app.secsvr + "/" + endpoint; }
        return url;
    },


    authparams = function () {
        var params = "an=" + jt.enc(authname) + "&at=" + authtoken;
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authname=" + jt.enc(authname) + 
                     "&authtoken=" + authtoken;
        return params;
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie and reset the app vars
        jt.cookie(app.authcookname, "", -1);
        authtoken = "";
        authname = "";
        moracct = null;
        app.review.resetStateVars();
        app.pen.resetStateVars();
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
                      typeof history.pushState === "function") {
            history.pushState("", document.title, url); }
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (moracct.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (name, token) {
        var cval = name + cookdelim + token;
        jt.cookie(app.authcookname, cval, 365);
        authtoken = token;
        authname = name;
        if(authname) {
            authname = authname.replace("%40", "@"); }
        app.login.updateTopSection();
    },


    displayEmailSent = function () {
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
    },


    onLoginEmailChange = function (e) {
        var passin;
        jt.evtend(e); 
        passin = jt.byId("passin");
        //Unbelievably, the passin field may not be available yet if
        //this is a browser autosubmit of saved credentials in Safari.
        //Don't create error noise in that case.
        if(passin) {
            passin.focus(); }
    },


    //webkit likes to escape at signs
    fixEmailAddress = function (emaddr) {
        emaddr = emaddr.replace(/%40/g, "@");
        return emaddr;
    },


    //safari displays "No%20match%20for%20those%20credentials"
    //and even "No%2520match%2520for%2520those%2520credentials"
    fixServerText = function (text, email) {
        if(!text) {
            text = ""; }
        text = text.replace(/%20/g, " ");
        text = text.replace(/%2520/g, " ");
        if(text.startsWith("Not registered")) {
            if(email) {
                email = fixEmailAddress(email); }
            text = (email || "Account") + " not found, click \"Create\""; }
        return text;
    },


    setFocusOnEmailInput = function () {
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
    },



    verifyCoreLoginForm = function () {
        var html;
        if(!jt.byId("logindiv") || !jt.byId("loginform")) {
            html = jt.tac2html(["div", {id: "logindiv"}, loginhtml]);
            jt.out("toprightdiv", html); }
    },


    addParamValuesToLoginForm = function (params) {
        var state, returl, html = [];
        //add url parameters to pass through on form submit.  Except for
        //emailin, which should always be read from the form even if it
        //is passed back from the server for use in error handling.
        Object.keys(params).forEach(function (name) {
            if(name !== "emailin") {
                html.push(["input", {type: "hidden", name: name,
                                     value: params[name]}]); } });
        if(!params.returnto) { //window.location.origin is webkit only..
            returl = window.location.protocol + "//" + 
                window.location.host;
            state = app.history.currState();
            if(state.view === "coop") {
                returl += "?view=coop&coopid=" + state.coopid; }
            html.push(["input", {type: "hidden", name: "returnto",
                                 value: returl}]); }
        jt.out("loginparaminputs", jt.tac2html(html));
    },


    //prefer output in the login form if available, otherwise use main stat div
    loginstat = function (txt) {
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
    },


    //The login form must already exist in index.html for saved passwords
    //to work on some browsers.  This adds the detail.
    displayLoginForm = function (params) {
        var html;
        verifyCoreLoginForm();
        addParamValuesToLoginForm(params);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            loginstat(fixServerText(params.loginerr, params.emailin)); }
        html = ["a", {id:"resetpw", href:"#resetpassword",
                      title:"Email a password reset link",
                      onclick:jt.fs("app.login.resetPassword()")},
                "reset password..."];
        jt.out("resetpassdiv", jt.tac2html(html));
        if(authname) {
            jt.byId("emailin").value = authname; }
        if(params.emailin) {
            jt.byId("emailin").value = params.emailin; }
        jt.on("emailin", "change", onLoginEmailChange);
        //Since this is an actual form, the default form action is
        //already triggered on return, and setting a handler
        //interferes with the Create Account button press.
        //jt.on("passin", "change", onLoginPasswordChange);
        setFocusOnEmailInput();
    },


    actSendContactHTML = function () {
        var now, mins, subj, body, html;
        now = new Date();
        mins = ((now.getHours() - actsent.getHours()) * 60) +
            (now.getMinutes() - actsent.getMinutes());
        subj = "Account activation email";
        body = "Hey,\n\n" +
            "I've been waiting over " + mins + " " +
            ((mins === 1) ? "minute" : "minutes") + 
            " for activation email to show up and still haven't received anything.  I've checked my spam folder and it's not there.  Would you please reply to this message and send me my activation code so I can post a membic?\n\n" +
            "Thanks!\n" +
            app.pen.myPenName().name + "\n";
        html = ["a", {href: "mailto:" + app.suppemail + "?subject=" + 
                      jt.dquotenc(subj) + "&body=" + jt.dquotenc(body)},
                "Contact Support"];
        return html;
    },


    activateButtonOrNoticeHTML = function (prof) {
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
    },


    writeUsermenuAccountFormElements = function (prof) {
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
            [["label", {fo:"maxpdsel", cla:"liflab"}, "Queuing"],
             ["select", {id:"maxpdsel"},
              [["option", {value:1}, 1],
               ["option", {selected:jt.toru(app.pen.maxPostsPerDay() === 2),
                           value:2}, 2]]],
             ["span", {cla:"accstatvalspan"}, "&nbsp;(per day)"]]));
    },


    readUsermenuAccountForm = function () {
        var ua, elem;
        ua = { email: moracct.email,
               penName: moracct.penName };
        ua.email = jt.byId("emailin").value.trim();
        if(!jt.isProbablyEmail(ua.email)) {
            return jt.out("usermenustat", "Invalid email address"); }
        if(ua.email !== moracct.email &&
           (!confirm("You will need to sign in again and re-activate your account from your new email address. Setting your email address to " + ua.email))) {
            return; }
        if(jt.byId("passin").value) {
            ua.password = jt.byId("passin").value.trim(); }
        elem = jt.byId("maxpdsel");
        ua.maxpd = +(elem.options[elem.selectedIndex].value);
        ua.penName = jt.byId("accpenin").value;
        return ua;
    },


    getAccountInfoFromPenStash = function () {
        var mypen = app.pen.myPenName();
        if(mypen && mypen.stash && mypen.stash.account) {
            moracct = mypen.stash.account; }
    },


    setPenStashFromAccountInfo = function (acct) {
        var mypen = app.pen.myPenName();
        if(mypen && mypen.stash && mypen.stash.account) {
            mypen.stash.account = acct; }
    },


    logLoadTimes = function () {
        var millis, timer = app.amdtimer;
        millis = timer.load.end.getTime() - timer.load.start.getTime();
        jt.log("load app: " + millis);
    },


    loadThirdPartyUtilities = function () {
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
    },


    loggedInAuthentDisplay = function () {
        var mypen, html;
        mypen = app.pen.myPenName();
        //if no pen name, then the app is prompting for that and there
        //is no authenticated menu displayed.
        if(mypen) {
            html = ["div", {id:"infosignoutdiv"},
                    [["a", {id: "introa", href: "#intro", title: "Information",
                            onclick: jt.fs(
                                "app.layout.displayDoc('docs/about.html')")},
                      ["img", {id: "infoimg", src: "img/infotrim.png",
                               style: "opacity:0.8;"}]],
                     ["a", {href: "#SignOut",
                            onclick: jt.fs("app.login.logout()")},
                      ["span", {cla: "taslinkspan"},
                       "Sign out"]]]];
            jt.out("toprightdiv", jt.tac2html(html));
            html = [["div", {id: "topbuttonsdiv"},
                     [["a", {href: "#profile", cla: "topbuttonlink",
                             title: "Your membics",
                             onclick: jt.fs("app.login.topnav('mymembics')")},
                       ["img", {cla: "topbuttonimg",
                                src: "img/profile.png"}]],
                      ["a", {href: "#write", cla: "topbuttonlink",
                             title: "Make a membic",
                             onclick: jt.fs("app.login.topnav('write')")},
                       ["img", {cla: "topbuttonimg",
                                src: "img/writenew.png"}]]]]];
            jt.byId("topactionsdiv").style.display = "inline-block";
            jt.out("topactionsdiv", jt.tac2html(html)); }
    },


    loggedInDoNextStep = function (params) {
        //On localhost, params are lost when the login form is
        //displayed.  On the server, they are passed to the secure
        //host and returned post-login.  These are separate flows.
        //Not supporting a separate param processing path just for
        //local development.  This func is pretty much here to hold
        //this comment and prevent running around in circles for hours
        //trying to debug authentication passthroughs.
        app.login.doNextStep(params);
    },


    applyCSSOverride = function (cssurl) {
        var csselem = document.createElement("link");
        csselem.rel = "stylesheet";
        csselem.type = "text/css";
        cssurl = jt.dec(cssurl);
        cssurl = cssurl.toLowerCase();
        if(cssurl.indexOf("http") < 0) {
            cssurl = "css/embed/" + cssurl + ".css"; }
        csselem.href = cssurl;
        document.head.appendChild(csselem);
    },


    handleInitialParamSideEffects = function (params) {
        if(params.an && params.at) {
            setAuthentication(params.an, params.at); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //clean up the URL display
            clearParams(); }
        if(params.css) {
            applyCSSOverride(params.css); }
        //handle specific context requests
        if(params.view === "profsetpic") {
            app.history.checkpoint({ view: "profsetpic" }); }
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
    },


    handleRedirectOrStartWork = function () {
        var params = jt.parseParams();
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
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        logLoadTimes();
        app.fork({descr:"dynamic fonts",
                  func:loadThirdPartyUtilities, ms:5});
        if(!loginhtml) {  //save original html in case needed later
            loginhtml = jt.byId("logindiv").innerHTML; }
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
                      [["button", {type:"button", id:"okbutton",
                                   onclick: jt.fs("app.login.updateAccount()")},
                        "Update Personal"]]]]];
        return html;
    },


    accountSettingsInit: function () {
        var params, detdiv = jt.byId("accstatdetaildiv");
        if(!detdiv) { //form fields no longer displayed so nothing to do
            return; }
        detdiv.style.display = "none";
        app.profile.fetchProfile(function (prof) {
            writeUsermenuAccountFormElements(prof); });
    },


    displayActivationWaitTimer: function () {
        var ascdiv = jt.byId("actsendcounterdiv"),
            diff, hrs, mins, secs, txt;
        if(ascdiv) {
            diff = Date.now() - actsent.getTime();
            hrs = Math.floor(diff / (60 * 60 * 1000));
            diff -= hrs * 60 * 60 * 1000;
            mins = Math.floor(diff / (60 * 1000));
            diff -= mins * 60 * 1000;
            secs = Math.floor(diff / 1000);
            txt = String(hrs) + " " + ((hrs === 1) ? "hour" : "hours") +
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
        var params, emaddr = jt.byId("emailin").value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before deactivating.");
            return; }
        if(confirm("If you want to re-activate your account after deactivating, you will need to confirm your email address again.")) {
            jt.out("buttonornotespan", "Deactivating...");
            params = app.login.authparams() + "&status=Inactive" + 
                jt.ts("&cb=", "second");
            jt.call("GET", "activate?" + params, null,
                    function (accounts) {
                        moracct = accounts[0];
                        writeUsermenuAccountFormElements(moracct); },
                    app.failf(function (code, errtxt) {
                        jt.err("Deactivation failed " + code + ": " + errtxt);
                        writeUsermenuAccountFormElements(moracct); }),
                    jt.semaphore("login.deactivateAcct")); }
    },


    sendActivation: function (ignore /*status*/) {
        var emaddr = jt.byId("emailin").value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before activating.");
            return; }
        jt.out("buttonornotespan", "Sending...");
        jt.call("POST", "sendcode?" + app.login.authparams(), "",
                function (accounts) {
                    moracct = accounts[0];
                    writeUsermenuAccountFormElements(moracct); },
                app.failf(function (code, errtxt) {
                    jt.err("Sending failed " + code + ": " + errtxt);
                    writeUsermenuAccountFormElements(moracct); }),
                jt.semaphore("login.sendActivation"));
    },


    updateTopSection: function () {
        if(!initialTopSectionHTML) {
            initialTopSectionHTML = jt.byId("topsectiondiv").innerHTML; }
        if(!app.login.isLoggedIn()) {
            return jt.out("topsectiondiv", initialTopSectionHTML); }
        var sep = "&nbsp;&nbsp;|&nbsp;&nbsp";
        var html = ["div", {id:"topnavdiv"}, [
            ["a", {href:"#Themes",
                   onclick:jt.fs("app.themes.display()")},
             [["img", {cla:"navimg", src:"img/membiclogo.png"}],
              "Themes"]],
            sep,
            ["a", {href:"#Profile",
                   onclick:jt.fs("app.profile.display()")},
             [["img", {cla:"navimg", src:"img/profile.png"}],
              "Profile"]],
            sep,
            ["a", {href:"#Membic",
                   onclick:jt.fs("app.review.start()")},
             [["img", {cla:"navimg", src:"img/writenew.png"}],
              "Membic"]]]];
        jt.out("topsectiondiv", jt.tac2html(html));
    },


    //create the logged-in display areas
    updateAuthentDisplay: function (override) {
        if(!toprightdivcontents) {
            toprightdivcontents = jt.byId("toprightdiv").innerHTML; }
        if(authtoken && override !== "hide") {
            loggedInAuthentDisplay(); }
        else if(override === "hide") { 
            setTimeout(app.login.verifyAuthentHideOk, 8000);
            jt.out("toprightdiv", ""); }
        else {  //restore whatever was in index.html to begin with
            jt.out("toprightdiv", toprightdivcontents); }
    },


    //Hiding the authent area permanently is a bad idea if app comms screw
    //up and normal call flow is disrupted.  Only allowed if new pen.
    verifyAuthentHideOk: function () {
        jt.log("verifyAuthentHideOk called");
        if(!jt.byId("infosignoutdiv") && !jt.byId("createpndiv") && 
           !jt.byId("npaadiv")) {
            jt.out("toprightdiv", jt.tac2html(
                ["a", {href:"https://membic.org",
                       onclick:jt.fs("window.location.reload()")},
                 "&nbsp; Refresh Sign In &nbsp;"])); }
    },


    redirhome: function (e) {
        var url = app.mainsvr;
        jt.evtend(e);
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    topnav: function (bname) {
        app.verifyHome();
        jt.byId("infoimg").style.display = "initial";  //verify available
        switch(bname) {
        case "remembered":
            return app.activity.displayRemembered();
        case "write":
            return app.review.start();
        case "mymembics":
            return app.pcd.display("pen"); }
    },


    nukeAppData: function () {
        app.activity.resetAllFeeds();
        app.pcd.resetState();
        app.lcs.nukeItAll();
    },


    updateAccount: function () {
        var ua, data, contf = app.pcd.display;
        ua = readUsermenuAccountForm();
        //moracct.penName may not be populated if brand new
        if(ua.penName !== app.pen.myPenName().name) {
            if(!confirm("Theme action logs and older membics may still reference your previous pen name \"" + moracct.penName + "\".")) {
                return; } }
        if(ua.penName !== app.pen.myPenName().name ||
               ua.maxpd !== app.pen.maxPostsPerDay()) {
            app.pen.maxPostsPerDay(ua.maxpd);
            contf = function () {
                app.pen.getPen("", function (pen) {
                    pen.name = ua.penName;
                    app.pen.updatePen(
                        pen,
                        function (ignore /*penref*/) {
                            app.login.updateTopSection();
                            app.login.nukeAppData();
                            app.history.dispatchState(); },
                        function (code, errtxt) {
                            jt.out("usermenustat", "Pen name update failed " + 
                                   code + ": " + errtxt); }); }); }; }
        else if(ua.password) {
            if(!confirm("The next time you sign in, you will need to use your updated password.")) {
                return; } }
        if(ua.email === moracct.email && !ua.password) {
            contf(); }  //nothing changed
        else {  //account info changed
            if(ua.email !== moracct.email) {
                contf = app.login.logout; }
            data = jt.objdata(ua) + "&" + authparams();
            jt.log("updacc data: " + data);
            jt.call("POST", secureURL("updacc"), data,
                    function (objs) {
                        setAuthentication(authname, objs[0].token);
                        setPenStashFromAccountInfo(objs[0]);
                        moracct = null;  //reset so they log in again
                        contf(); },
                    app.failf(function (code, errtxt) {
                        jt.out("setstatdiv", "Account update failed " +
                               code + ": " + errtxt); }),
                    jt.semaphore("login.updateAccount")); }
    },


    authparams: function () {
        return authparams();
    },


    isLoggedIn: function () {
        if(authname && authtoken) {
            return true; }
        return false;
    },


    noteAccountInfo: function (pen) {
        //only have stash.account if it is the pen you logged in with
        if(pen && pen.stash && pen.stash.account) {
            moracct = pen.stash.account;
            app.pen.setMyPenId(jt.instId(pen)); }
    },


    noteUpdatedAccountInfo: function (account) {
        moracct = account;
    },


    accountInfo: function (fieldname) {
        var pen;
        if(moracct) {
            return moracct[fieldname]; }
        pen = app.pen.myPenName();
        if(pen && pen.stash && pen.stash.account) {
            app.login.noteAccountInfo(pen);
            return moracct[fieldname]; }
        return "";
    },


    readAuthCookie: function () {
        var cval, mtn;
        cval = jt.cookie(app.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authname = mtn[0].replace("%40", "@");
            authtoken = mtn[1]; }
        app.login.updateTopSection();
        return authtoken;  //true if set earlier
    },


    logout: function (errprompt) {
        app.layout.closeDialog();
        app.layout.cancelOverlay();
        logoutWithNoDisplayUpdate();
        app.history.checkpoint({ view: "profile", profid: 0 });
        app.login.updateTopSection();
        jt.out("sysnoticediv", "");
        jt.out("topactionsdiv", "");
        jt.byId("topactionsdiv").style.display = "none";
        app.login.init();
        if(errprompt) {
            jt.err(errprompt); }
        app.verifyHome();
    },


    setAuth: function (method, token, name) {
        setAuthentication(method, token, name);
    },


    //Return point for 3rd party auth completion
    authComplete: function () {
        var params;
        //any original params probably didn't make it through the 3rd
        //party auth calls, but capture them in case they did.
        params = jt.parseParams();
        //kick off the pen access time update, hinter etc.
        loggedInDoNextStep(params);
    },


    createAccount: function () {
        var emaddr, password, data, url, buttonhtml;
        emaddr = jt.byId("emailin").value;
        password = jt.byId("passin").value;
        if(!emaddr || !emaddr.trim()) {
            loginstat("Please specify an email and password");
            jt.byId("emailin").focus();
            return; }
        if(!password || !password.trim()) {
            loginstat("Please specify a password");
            jt.byId("emailin").focus();
            return; }
        loginstat("");   //clear any previous message
        buttonhtml = jt.byId("loginbuttonsdiv").innerHTML;
        jt.out("loginbuttonsdiv", "Creating new account...");
        emaddr = emaddr.toLowerCase();
        data = jt.objdata({ emailin: emaddr, passin: password });
        url = secureURL("newacct");
        jt.call("POST", url, data, 
                 function (objs) {
                     var html = "<p>Your account has been created." + 
                         " Welcome to the Membic community!</p>" +
                         "<p>Signing you in for the first time now...</p>";
                     jt.out("logindiv", html);
                     setAuthentication("mid", objs[0].token, emaddr);
                     //Wait briefly to give the db a chance to stabilize.
                     //Without waiting, it won't work.  With waiting, it
                     //usually works, but not guaranteed.  User might have
                     //to login again, or reload the page if extreme lag.
                     app.fork({descr:"new account stabilization wait",
                               func:app.login.doNextStep,
                               ms:3000}); },
                 app.failf(function (ignore /*code*/, errtxt) {
                     loginstat(errtxt);
                     jt.out("loginbuttonsdiv", buttonhtml); }),
                jt.semaphore("login.createAccount"));
    },


    doNextStep: function (params) {
        var state, redurl, xpara;
        if(!params) {
            params = jt.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            xpara = jt.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no tag redirect so check current state.  State may be from history
        //pop or set by handleRedirectOrStartWork
        state = app.history.currState();
        if(!state || !state.view) {
            if(app.login.isLoggedIn()) {  //your profile is your home
                state = {view: "profile"}; }
            else if(app.pfoj && app.pfoj.obtype === "Coop") {
                state = {view:"coop", coopid:app.pfoj.instid}; }
            else if(app.pfoj && app.pfoj.obtype === "MUser") {
                state = {view:"profile", profid:app.pfoj.instid}; }
            else {
                state = {view: "themes"}; } }
        if(params.url) {
            app.activity.setURLToRead(params.url); }
        app.login.updateTopSection()
        app.history.dispatchState(state);
    },


    resetPassword: function () {
        var emaddr, data;
        emaddr = jt.byId("emailin").value;
        if(!jt.isProbablyEmail(emaddr)) {
            loginstat("Please fill in your email address...");
            return; }
        loginstat("Sending...");
        data = "emailin=" + jt.enc(emaddr);
        jt.call("POST", "mailcred", data,
                function (ignore /*objs*/) {
                    loginstat("");
                    displayEmailSent(); },
                app.failf(function (ignore /*code*/, errtxt) {
                    loginstat(errtxt); }),
                jt.semaphore("resetPassword"));
    }

};  //end of returned functions
}());

