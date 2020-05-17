/*global confirm, window, document, history, app, jt */

/*jslint browser, white, fudge, for, long */

app.login = (function () {
    "use strict";

    var initialTopActionHTML = "";
    var authobj = null;  //email, token, authId, status, altinmail, signInTS


    function fullProfile() {
        var prof = app.login.myProfile();
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


    //Not using window.localStorage because it is insecure.  Both a
    //SameSite=Strict cookie and localStorage may fail on localhost:8080.
    var authPersist = {
        delim: "..membicauth..",
        sname: "membicauth",
        save: function () {
            try {
                jt.cookie(authPersist.sname,
                          authobj.email + authPersist.delim + authobj.token,
                          //The cookie is rewritten each login.  Good to
                          //expire if inactive as the security and storage
                          //options continue to evolve.
                          30);
                jt.log("authPersist.save success");
            } catch (e) {
                jt.log("authPersist.save exception: " + e); } },
        read: function () {
            var ret = null;
            try {
                ret = jt.cookie(authPersist.sname);  //ret null if not found
                if(ret) {
                    if(ret.indexOf(authPersist.delim) < 0) {
                        jt.log("authPersist.read clearing " + ret + ": " +
                               authPersist.delim + " delimiter not found.");
                        authPersist.clear();
                        ret = null; }
                    else {
                        ret = ret.split(authPersist.delim);
                        ret[0] = ret[0].replace("%40", "@");
                        if(!jt.isProbablyEmail(ret[0]) || ret[1].length < 20) {
                            jt.log("authPersist.read clearing bad values: " +
                                   ret[0] + ", " + ret[1]);
                            authPersist.clear();
                            ret = null; }
                        else {
                            jt.log("authPersist.read success");
                            ret = {authname:ret[0], authtoken:ret[1]}; } } }
            } catch (e) {
                jt.log("authPersist.read exception: " + e);
                ret = null;
            }
            return ret; },
        clear: function () {
            try {
                jt.cookie(authPersist.sname, "", -1);
            } catch (e) {
                jt.log("authPersist.clear exception: " + e); } }
    };
        

    function displayEmailSent () {
        var html;
        html = [["p", 
                 [["Your account information has been emailed to "],
                  ["code", jt.byId("emailin").value],
                  [" and should arrive in a few minutes.  If it doesn't" + 
                   " show up, please"]]],
                ["ol",
                 [["li", "Make sure your email address is spelled correctly."],
                  ["li", "Check your spam folder."],
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
    //start.py, decorating to provide login without page reload.
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
        authPersist.save();
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
        //Always make the call to sign in.  If the authentication did not
        //persist or there are other issues, deal with that immediately.
        app.login.signIn();
    },


    formSubmitOverride: function (event) {
        jt.evtend(event);
        app.login.signIn();
    },


    signIn: function () {
        jt.out("topmessagelinediv", "");  //clear any previous login error
        var sav = authPersist.read() || {};
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


    //display the account activation code help dialog.
    actCodeHelp: function () {
        var subj = "Need help with activation code";
        var body = "Hi,\n\nI've waited several minutes, and checked my spam folder, but I still haven't received any activation code for my account.  Can you please look into this and help me get started?\n\nThanks\n";
        var txt = "An activation code was sent to " +
            app.login.authenticated().email + " when your email changed.  " +
            "If it's been a few minutes and you haven't received anything";
        var html = [
            ["p", txt],
            ["ol",
             [["li", "Make sure your email address is spelled correctly."],
              ["li", "Check your spam folder."]]],
            ["div", {id:"dlgmsgdiv"}],
            ["div", {cla:"dlgbuttonsdiv", id:"suppbuttonsdiv"},
             [["button", {type:"button", title:"Resend Activation Code",
                          onclick:jt.fs("app.login.resendActivationCode()")},
               "Resend&nbsp;Code"],
              ["a", {href:"mailto:" + app.suppemail + "?subject=" +
                     jt.dquotenc(subj) + "&body=" + jt.dquotenc(body) +
                     "%0A%0A"}, "Contact Support"]]],
            ["div", {cla:"dlgbuttonsdiv"},
             ["button", {type:"button", id:"okbutton",
                         onclick:jt.fs("app.layout.closeDialog()")},
              "OK"]]];
        html = app.layout.dlgwrapHTML("Account Activation Help", html);
        app.layout.openDialog({y:40}, jt.tac2html(html), null,
                              function () {
                                  jt.byId("okbutton").focus(); });
    },


    //Any account update while the account status is not active will
    //trigger an activation message.
    resendActivationCode: function () {
        jt.byId("suppbuttonsdiv").style.display = "none";
        jt.out("dlgmsgdiv", "Resending activation code...");
        app.login.updateProfile({actcode:"requestresend"},
            function () { //updated auth and account already cached
                jt.out("dlgmsgdiv", "Activation code sent to " +
                       app.login.authenticated().email);
                app.fork({descr:"End account activation form", ms:800,
                          func:app.layout.closeDialog}); },
            function (code, errtxt) {
                jt.out("dlgmsgdiv", "Resend failed: " + code + " " +
                       errtxt);
                jt.byId("suppbuttonsdiv").style.display = "block"; });
    },


    //If you are not logged in, then authobj is null.  Can be used as an
    //"isLoggedIn" check and/or for access to personal info.
    authenticated: function () { return authobj; },
    setAuthentication: function (obj) { 
        authobj = obj;
        authPersist.save();
    },
    authURL: function (apiurl) {
        return app.dr(apiurl) + "?an=" + authobj.email + "&at=" + authobj.token;
    },
    fullProfile: function () { return fullProfile(); },
    myProfile: function () { 
        if(!authobj) {
            return null; }
        return app.refmgr.cached("MUser", authobj.authId);
    },


    profimgsrc: function (muser) {
        var userid = "";
        if(!muser) {  //assume for self if nothing passed in
            var auth = app.login.authenticated();
            if(auth) {
                muser = app.refmgr.cached("MUser", auth.authId); } }
        else if(muser && typeof muser === "string") {
            userid = muser;
            muser = app.refmgr.cached("MUser", muser); }
        //Not having a user for a given id may simply mean they're not
        //cached.  Better to take a chance they have a pic uploaded.
        if(!muser && userid) {
            return "/api/obimg?dt=MUser&di=" + userid + jt.ts("&cb=", "hour"); }
        return app.pcd.picImgSrc(muser);
    },


    rebuildContext: function () {
        app.membic.addMembic();    //update account activation area
        app.statemgr.redispatch(); //rebuild pcd display and settings context
    },


    //obj is NOT the current profile object, it consists of the identifying
    //object information (dsType and dsId) together with only the profile
    //fields and values to be updated.
    updateProfile: function (obj, succf, failf) {
        if(!obj) {
            jt.log("login.updateProfile called without update object");
            if(failf) {
                return failf(400, "No profile object to update"); }
            return; }  //nothing to do
        obj.dsType = "MUser";   //verify set in case creating new
        if(authobj) {
            obj.dsId = authobj.authId; }
        var url = app.login.authURL("/api/accupd");
        jt.call("POST", url, app.refmgr.postdata(obj),
                function (objs) { //authobj, MUser
                    app.login.setAuthentication(objs[0]);
                    app.refmgr.put(app.refmgr.deserialize(objs[1]));
                    //might have changed profile/theme follow/membership
                    app.refmgr.uncache("activetps", "411");
                    if(succf) {
                        succf(objs[1]); } },
                function (code, errtxt) {
                    jt.log("updateProfile " + code + " " + errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("login.updateProfile"));
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
        var mic = jt.byId("mailincb").checked;
        if(mic) {  //enable mail-ins
            pu.cliset = prof.cliset;
            pu.cliset.mailins = "enabled"; }
        else {  //disable if previously set, otherwise leave unset
            if(prof.cliset.mailins) {
                pu.cliset = prof.cliset;
                pu.cliset.mailins = "disabled"; } }
        pu.altinmail = jt.byId("altemin").value.trim();
        if(pu.altinmail && !jt.isProbablyEmail(pu.altinmail)) {
            return jt.out("settingsinfdiv", "Invalid alternate email"); }
        pu.altinmail = pu.altinmail || "UNSET_VALUE";
        app.pcd.readCommonSettingsFields(pu, prof);
        jt.out("settingsinfdiv", "Updating...");
        jt.byId("settingsupdbutton").disabled = true;
        app.login.updateProfile(pu,
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
        authPersist.clear();
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
        jt.call("POST", app.dr("/api/newacct"), data,
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
        jt.call("POST", app.dr("/api/mailpwr"), data,
                function (ignore /*objs*/) {
                    errmsg("");
                    displayEmailSent(); },
                app.failf(function (ignore /*code*/, errtxt) {
                    errmsg(errtxt); }),
                jt.semaphore("resetPassword"));
    }

};  //end of returned functions
}());
