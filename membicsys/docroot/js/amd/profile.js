/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.profile = (function () {
    "use strict";

    var mypid = "";
    //The coops entry lev field and dsType fields are set separately.
    var ccfields = ["name", "hashtag", "description", "picture", "keywords"];
    var cpfields = ["name", "hashtag", "aboutme",     "profpic", ""];


    function myProfile () {
        var authobj = app.login.authenticated();
        if(!authobj) {
            return null; }
        return app.refmgr.cached("MUser", authobj.authId);
    }


    //obj is NOT the current profile object, it consists of the identifying
    //object information (dsType and dsId) together with only the profile
    //fields and values to be updated.
    function updateProfile (obj, succf, failf) {
        if(!obj) {
            jt.log("profile.updateProfile called without update object");
            if(failf) {
                return failf(400, "No profile object to update"); }
            return; }  //nothing to do
        obj.dsType = "MUser";   //verify set in case creating new
        var authobj = app.login.authenticated();
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
                jt.semaphore("profile.updateProfile"));
    }


    function makeCoopsEntry (cp, level) {
        var cc = {lev:level, dsType:cp.dsType};
        var mapfields = ccfields;
        if(cp.dsType === "MUser") {
            mapfields = cpfields; }
        ccfields.forEach(function (field, idx) {
            var mapfield = mapfields[idx];
            if(mapfield) {
                cc[field] = cp[mapfield]; } });
        return cc;
    }


    function verifyCachedCoopInfo (prof, coop) {
        //lev value is handled by verifyMembership, not checked here.
        var changed = false;
        var cc = prof.coops[coop.instid];
        if(cc) {
            ccfields.forEach(function (field) {
                if(cc[field] !== coop[field]) {
                    changed = true;
                    cc[field] = coop[field]; } }); }
        return changed;
    }


    //The Coop membership update processing makes every effort to update
    //affected MUser objects, but it is not transactionally guaranteed, so
    //it is possible for profile to be out of sync.  Verify the membership
    //level and update the account if it doesn't match.
    function verifyMembership (coop) {
        var prof = myProfile();
        if(!prof) {  //not logged in, so nothing to do
            return; }
        var lev = app.coop.membershipLevel(coop, mypid);
        prof.coops = prof.coops || {};
        var changed = false;
        var ctmid = coop.instid;
        //not previously noted and associated with the coop now
        if(!prof.coops[ctmid] && lev) {
            changed = true;
            prof.coops[ctmid] = makeCoopsEntry(coop, lev); }
        //previously asociated
        else if(prof.coops[ctmid]) { //-1 or > 0
            var notices = prof.coops[ctmid].notices || [];
            if(lev) {  //new membership level supercedes previous value
                changed = true;
                prof.coops[ctmid] = makeCoopsEntry(coop, lev); }
            else {  //lev === 0 so resigned or kicked out
                if(prof.coops[ctmid].lev > 0) {  //was member, now following
                    changed = true;
                    prof.coops[ctmid] = makeCoopsEntry(coop, -1); } }
            prof.coops[ctmid].notices = notices; }
        changed = changed || verifyCachedCoopInfo(prof, coop);
        if(changed) {  //note update, but not critical or time dependent
            updateProfile(prof); }
    }


    function profimgsrc (muser) {
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
        if(userid) {
            return "/api/obimg?dt=MUser&di=" + userid + jt.ts("&cb=", "hour"); }
        return app.pcd.picImgSrc(muser);
    }


    //display the account activation code help dialog.
    function activationCodeHelp () {
        var subj = "Need help with activation code";
        var body = "Hi,\n\nI've waited several minutes, and checked my spam folder, but I still haven't received any activation code for my account.  Can you please look into this and help me get started?\n\nThanks\n";
        var txt = "An activation code was sent to " +
            app.login.authenticated().email + " when your email changed.  " +
            "If it's been a few minutes and you haven't received anything";
        var html = [
            ["p", txt],
            ["ol",
             [["li", "Make sure your email address is spelled correctly"],
              ["li", "Check your spam folder"]]],
            ["div", {id:"dlgmsgdiv"}],
            ["div", {cla:"dlgbuttonsdiv", id:"suppbuttonsdiv"},
             [["button", {type:"button", title:"Resend Activation Code",
                          onclick:jt.fs("app.profile.resendActivationCode()")},
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
    }


    function resendActivationCode () {
        //any account update while the account status is not active will
        //trigger an activation message.
        jt.byId("suppbuttonsdiv").style.display = "none";
        jt.out("dlgmsgdiv", "Resending activation code...");
        app.profile.update({actcode:"requestresend"},
            function () { //updated auth and account already cached
                jt.out("dlgmsgdiv", "Activation code sent to " + 
                       app.login.authenticated().email);
                app.fork({descr:"End account activation form", ms:800,
                          func:app.layout.closeDialog}); },
            function (code, errtxt) {
                jt.out("dlgmsgdiv", "Resend failed: " + code + " " +
                       errtxt);
                jt.byId("suppbuttonsdiv").style.display = "block"; });
    }


    return {
        profimgsrc: function (muser) { return profimgsrc(muser); },
        myProfId: function () { return mypid; },
        myProfile: function () { return myProfile(); },
        update: function (obj, sf, xf) { updateProfile(obj, sf, xf); },
        verifyMembership: function (coop) { verifyMembership(coop); },
        actCodeHelp: function () { activationCodeHelp(); },
        resendActivationCode: function () { resendActivationCode(); }
    };
}());
