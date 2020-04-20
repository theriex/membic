/*global confirm, window, document, history, app, jt */

/*jslint browser, white, fudge, for, long */

app.login = (function () {
    "use strict";

    var initialTopActionHTML = "";
    var cookdelim = "..membicauth..";
    var authobj = null;  //email, token, authId, status, altinmail, signInTS


    function fullProfile() {
        var prof = app.profile.myProfile();
        prof.email = authobj.email;
        prof.status = authobj.status;
        prof.altinmail = authobj.altinmail;
        return prof;
    }


    function verifyUserInfo () {
        if(!authobj) {
            return jt.log("verifyUserInfo called without authentication"); }
        //If the user info was already loaded, then the displays are
        //probably up to date, but that's not guaranteed given server call
        //timing.  Best to just just redraw.
        app.refmgr.getFull("MUser", authobj.authId, function (muser) {
            if(app.startParams.cmd === "membership" && app.startParams.tid) {
                app.statemgr.setState("Theme", app.startParams.tid, 
                                      {cmd:"membership",
                                       fid:app.startParams.fid,
                                       mtok:app.startParams.mtok}); }
            else if(authobj.status === "Pending") {
                //If they have not activated their account yet, then go to
                //their empty profile so they can take the next step without
                //having to navigate.
                app.statemgr.setState("MUser", muser.dsId); }
            else {  //redisplay now that user info is available
                app.statemgr.redispatch(); } });
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


    function errmsg (txt) {
        jt.out("topmessagelinediv", jt.tac2html(
            ["span", {cla:"errmsgtextspan"}, txt]));
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


    function successfulSignIn (resultarray) {
        authobj = resultarray[0];
        setAuthentCookie();
        jt.out("topmessagelinediv", "");
        jt.out("topactiondiv", jt.tac2html(
            [["div", {id:"topnavdiv"}],
             ["div", {id:"newmembicdiv"}]]));
        app.statemgr.updatenav();  //display appropriate nav button
        app.membic.addMembic();    //start membic creation or verify account
        verifyUserInfo();          //fetch full profile if needed
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


    signIn: function () {
        jt.out("topmessagelinediv", "");  //clear any previous login error
        var sav = readAuthentCookie() || {};
        var ps = {an:app.startParams.an || sav.authname || "",
                  at:app.startParams.at || sav.authtoken || "",
                  emailin:jt.safeget("emailin", "value") || "",
                  passin:jt.safeget("passin", "value")};
        if(!((ps.an || ps.emailin) && (ps.at || ps.passin))) {
            return; }  //not trying to sign in yet.
        jt.out("topmessagelinediv", "Signing in...");
        jt.byId("topsectiondiv").style.cursor = "wait";
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
                    jt.byId("topsectiondiv").style.cursor = "default";
                    successfulSignIn(result); },
                function (code, errtxt) {
                    jt.byId("topsectiondiv").style.cursor = "default";
                    jt.log("authentication failure " + code + ": " + errtxt);
                    jt.out("topmessagelinediv", errtxt); },
                jt.semaphore("login.signIn"));
    },


    //If you are not logged in, then authobj is null.  Can be used as an
    //"isLoggedIn" check and/or for access to personal info.
    authenticated: function () { return authobj; },
    setAuthentication: function (obj) { 
        authobj = obj;
        setAuthentCookie();
    },
    authURL: function (apiurl) {
        return app.dr(apiurl) + "?an=" + authobj.email + "&at=" + authobj.token;
    },
    fullProfile: function () { return fullProfile(); },


    rebuildContext: function () {
        app.membic.addMembic();    //update account activation area
        app.statemgr.redispatch(); //rebuild pcd display and settings context
    },


    updateAccount: function () {
        var prof = fullProfile();
        var pu = {dsType:"MUser", dsId:prof.dsId};
        pu.email = jt.byId("emailin").value.trim();
        if(!jt.isProbablyEmail(pu.email)) {
            return jt.out("settingsinfdiv", "Invalid email address"); }
        pu.password = jt.byId("updpin").value.trim();
        if(pu.email !== prof.email && !pu.password) {
            return jt.out("settingsinfdiv",
                          "Password required to change email."); }
        if(pu.email !== prof.email && !confirm("You will need to re-activate your account from your new email address " + pu.email)) {
            return; }  //continue editing.
        pu.altinmail = jt.byId("altemin").value.trim();
        if(pu.altinmail && !jt.isProbablyEmail(pu.altinmail)) {
            return jt.out("settingsinfdiv", "Invalid alternate email"); }
        pu.altinmail = pu.altinmail || "UNSET_VALUE";
        app.pcd.readCommonSettingsFields(pu, prof);
        jt.out("settingsinfdiv", "Updating...");
        jt.byId("settingsupdbutton").disabled = true;
        app.profile.update(pu,
            function () { //updated account already cached
                jt.out("settingsinfdiv", "Profile updated.");
                app.fork({descr:"Close account settings display", ms:800,
                          func:app.login.rebuildContext}); },
            function (code, errtxt) {
                jt.byId("settingsupdbutton").disabled = false;
                jt.out("settingsinfdiv", "Update failed code " + code + " " +
                        errtxt); });
    },


    logout: function () {
        jt.cookie(app.authcookname, "", -1);
        authobj = null;  //clears all personal info, cache is public only
        initLoginForm(true);
        app.statemgr.redispatch();
    },


    createAccount: function () {
        var emaddr = jt.byId("emailin").value;
        if(!jt.isProbablyEmail(emaddr)) {
            jt.out("topmessagelinediv", "Please enter a valid email address");
            return; }
        var password = jt.byId("passin").value;
        if(!password || !password.trim()) {
            jt.out("topmessagelinediv", "Please enter a password");
            return; }
        jt.out("topmessagelinediv", "Creating account.."); 
        jt.byId("topsectiondiv").style.cursor = "wait";
        var data = jt.objdata({emailin:emaddr, passin:password});
        jt.call("POST", app.dr("api/newacct"), data,
                function (result) {
                    jt.byId("topsectiondiv").style.cursor = "default";
                    successfulSignIn(result); },
                function (code, errtxt) {
                    jt.byId("topsectiondiv").style.cursor = "default";
                    jt.log("authentication failure " + code + ": " + errtxt);
                    jt.out("topmessagelinediv", errtxt); },
                jt.semaphore("login.createAccount"));
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

