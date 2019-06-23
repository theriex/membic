/*jslint browser, white, fudge, this, for */
/*global app, jt */

app.profile = (function () {
    "use strict";

    var mypid = "";


    function displayProfileForId (profid) {
        if(!profid) {
            return app.profile.display(); }
        app.pcd.fetchAndDisplay("profile", profid);
    }


    function displayProfile () {
        if(mypid) {
            return app.pcd.fetchAndDisplay("profile", mypid); }
        var params = app.login.authparams() + jt.ts("&cb=", "second");
        jt.call("GET", "/getacct?" + params, null,
                function (accarr) {
                    mypid = accarr[0].instid;
                    app.lcs.put("profile", accarr[0]);
                    app.pcd.fetchAndDisplay("profile", mypid); },
                app.failf(function (code, errtxt) {
                    jt.err("Account retrieval failed: " + code + " " +
                           errtxt); }),
                jt.semaphore("profile.displayProfile"));
    }


    function updateProfile (obj, succf, failf) {
        jt.err("profile.updateProfile not implemented yet.");
    }


    function myProfile () {
        if(!mypid) {
            return null; }
        var pref = app.lcs.getRef("profile", mypid);
        return pref.profile || null;
    }


    function myName () {
        jt.err("profile.myName not implemented yet.");
    }


    function themeLevel (coopid) {
        if(!coopid) {
            return jt.log("profile.themeLevel no coopid given"); }
        var prof = myProfile();
        if(!prof) {
            return 0; }
        if(!prof.coops || !prof.coops[coopid]) {
            return 0; }
        return prof.coops[coopid];
    }


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
            prof.coops[ctmid] = lev; }
        //previously asociated and association level has changed
        else if(prof.coops[ctmid] && prof.coop[ctmid] !== lev) {
            changed = true;
            prof.coops[ctmid] = lev; }
        if(changed) {  //note update, but not critical or time dependent
            updateProfile(prof); }
    }


    function deserializeFields (prof) {
        app.lcs.reconstituteJSONObjectField("settings", prof);
        app.lcs.reconstituteJSONObjectField("coops", prof);
        app.lcs.reconstituteJSONObjectField("preb", prof);
    }


    return {
        byprofid: function (profid) { displayProfileForId(profid); },
        display: function () { displayProfile(); },
        update: function (obj, sf, xf) { updateProfile(obj, sf, xf); },
        myProfId: function () { return mypid; },
        myProfile: function () { return myProfile(); },
        myName: function () { return myName(); },
        themeLevel: function (coopid) { return themeLevel(coopid); },
        deserializeFields: function (prof) { deserializeFields(prof); }
    };
}());
