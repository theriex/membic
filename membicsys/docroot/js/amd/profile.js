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


    function myProfile () {
        if(!mypid) {
            return null; }
        var pref = app.lcs.getRef("profile", mypid);
        return pref.profile || null;
    }


    function fetchProfile (callback) {
        var prof = myProfile();
        if(prof) {
            return callback(prof); }
        var params = app.login.authparams() + jt.ts("&cb=", "second");
        jt.call("GET", "/getacct?" + params, null,
                function (accarr) {
                    mypid = accarr[0].instid;
                    app.lcs.put("profile", accarr[0]);
                    callback(accarr[0]); },
                function (code, errtxt) {
                    jt.log("Account retrieval failed: " + code + " " + errtxt);
                    callback(null); },
                jt.semaphore("profile.fetchProfile"));
    }


    function displayProfile () {
        fetchProfile(function () {  //prof object cached
            app.pcd.fetchAndDisplay("profile", mypid); });
    }


    //obj may be either full profile or abbreviated obj with email/password
    function updateProfile (obj, succf, failf) {
        if(!obj) {
            obj = myProfile(); }
        if(!obj) {
            if(failf) {
                return failf(400, "No profile object to update"); }
            return; }  //nothing to do
        var data = jt.objdata(obj) + "&" + app.login.authparams()
        jt.call("POST", "/updacc", data,
                function (updprof) {
                    app.login.setAuth(updprof.email, updprof.token);
                    if(succf) {
                        succf(updprof); } },
                function (code, errtxt) {
                    jt.log("updateProfile " + code + " " + errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("profile.updateProfile"));
    }


    function myName () {
        jt.err("profile.myName not implemented yet.");
    }


    function themeLevel (coopid) {
        if(!coopid) {
            jt.log("profile.themeLevel no coopid given");
            return 0; }
        var prof = myProfile();
        if(!prof) {
            return 0; }
        if(!prof.coops || !prof.coops[coopid]) {
            return 0; }
        return prof.coops[coopid];
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
            prof.coops[ctmid] = lev; }
        //previously asociated
        else if(prof.coops[ctmid]) { //-1 or > 0
            if(lev) {  //new membership level supercedes previous value
                changed = true;
                prof.coops[ctmid] = lev; }
            else {  //lev === 0 so resigned or kicked out
                if(prof.coops[ctmid] > 0) {  //was member, switch to following
                    changed = true;
                    prof.coops[ctmid] = -1; } } }
        if(changed) {  //note update, but not critical or time dependent
            updateProfile(prof); }
    }


    function verifyStashKeywords (prof) {
        prof.stash = prof.stash || {};
        prof.stash.keywords = prof.stash.keywords || {};
        app.review.getReviewTypes().forEach(function (rt) {
            if(!prof.stash.keywords[rt.type]) {
                prof.stash.keywords[rt.type] = rt.dkwords.join(", "); } });
    }


    function getKeywordUse (prof) {
        var kwu = {recent:{}, system:{}};
        app.review.getReviewTypes().forEach(function (rt) {
            kwu.recent[rt.type] = "";
            kwu.system[rt.type] = rt.dkwords.join(","); });
        prof.preb = prof.preb || [];
        prof.preb.forEach(function (rev) {
            var kwds = rev.keywords || "";
            kwds.csvarray().forEach(function (kwd) {
                var keycsv = kwu.recent[rev.revtype];
                if(!keycsv.csvcontains(kwd)) {
                    keycsv = keycsv.csvappend(kwd);
                    kwu.recent[rev.revtype] = keycsv; } }); });
        return kwu;
    }


    function setNoUpdate (field, val) {
        var prof = myProfile();
        if(!prof) {  //not logged in, so nothing to do
            return; }
        prof.settings = prof.settings || {};
        prof.settings[field] = val;
    }


    function getWithDefault (field, dval) {
        var prof = myProfile();
        dval = dval || null;
        if(!prof) {  //not logged in, so nothing to do
            return dval; }
        prof.settings = prof.settings || {};
        return prof.settings[field] || dval;
    }


    function deserializeFields (prof) {
        app.lcs.reconstituteJSONObjectField("settings", prof);
        app.lcs.reconstituteJSONObjectField("coops", prof);
        app.lcs.reconstituteJSONObjectField("preb", prof);
    }


    return {
        byprofid: function (profid) { displayProfileForId(profid); },
        myProfId: function () { return mypid; },
        myProfile: function () { return myProfile(); },
        fetchProfile: function (cbf) { fetchProfile(cbf); },
        display: function () { displayProfile(); },
        update: function (obj, sf, xf) { updateProfile(obj, sf, xf); },
        myName: function () { return myName(); },
        themeLevel: function (coopid) { return themeLevel(coopid); },
        verifyStashKeywords: function (prof) { verifyStashKeywords(prof); },
        verifyMembership: function (coop) { verifyMembership(coop); },
        getKeywordUse: function (prof) { return getKeywordUse(prof); },
        setnu: function (field, val) { setNoUpdate(field, val); },
        getwd: function (field, dval) { getWithDefault(field, dval); },
        resetStateVars: function () { mypid = ""; },
        deserializeFields: function (prof) { deserializeFields(prof); }
    };
}());
