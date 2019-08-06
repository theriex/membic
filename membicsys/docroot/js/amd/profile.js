/*jslint browser, white, fudge, this, for */
/*global app, jt */

app.profile = (function () {
    "use strict";

    var mypid = "";
    //The coops entry lev field and obtype fields are set separately.
    var ccfields = ["name", "hashtag", "description", "picture", "keywords"];
    var cpfields = ["name", "hashtag", "aboutme",     "profpic", ""];


    function displayProfileForId (profid, command) {
        if(!profid) {
            return app.profile.display(); }
        app.pcd.fetchAndDisplay("profile", profid, command);
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
                    jt.log("fetchProfile loaded profile");
                    prof = accarr[0];
                    mypid = prof.instid;
                    app.profile.deserializeFields(prof);
                    app.lcs.put("profile", prof);
                    callback(prof); },
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
        var updp = JSON.parse(JSON.stringify(obj));  //copy in case prof in use
        app.profile.serializeFields(updp);
        var skips = ["preb"];  //rebuilt server side as needed
        if(!updp.password) {  //don't try to update email without password
            skips.push("email"); }
        var data = jt.objdata(updp, skips) + "&" + app.login.authparams();
        jt.call("POST", "/updacc", data,
                function (profs) {
                    updp = profs[0];
                    app.lcs.put("profile", updp);
                    app.login.setAuth(updp.email, updp.token);
                    app.lcs.uncache("activetps", "411");
                    if(succf) {
                        succf(updp); } },
                function (code, errtxt) {
                    jt.log("updateProfile " + code + " " + errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("profile.updateProfile"));
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


    function makeCoopsEntry (cp, level) {
        var cc = {lev:level, obtype:cp.obtype};
        var mapfields = ccfields;
        if(cp.obtype === "MUser") {
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


    function keywordsForRevType (rt) {
        var kcsv = rt.dkwords.join(",");
        var prof = myProfile();
        if(prof && prof.cliset && prof.cliset.ctkeys) {
            kcsv = prof.cliset.ctkeys[rt.type] || kcsv; }
        return kcsv;
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
                var keycsv = kwu.recent[rev.revtype] || "";
                if(!keycsv.csvcontains(kwd)) {
                    keycsv = keycsv.csvappend(kwd);
                    kwu.recent[rev.revtype] = keycsv; } }); });
        return kwu;
    }


    function setNoUpdate (field, val) {
        var prof = myProfile();
        if(!prof) {  //not logged in, so nothing to do
            return; }
        prof.cliset = prof.cliset || {};
        prof.cliset[field] = val;
    }


    function getWithDefault (field, dval) {
        var prof = myProfile();
        dval = dval || null;
        if(!prof) {  //not logged in, so nothing to do
            return dval; }
        prof.cliset = prof.cliset || {};
        return prof.cliset[field] || dval;
    }


    function setFollow (val, obj, succf, failf) {
        var prof = myProfile();
        if(val) {  //-1 indicates following but not member
            prof.coops[obj.instid] = makeCoopsEntry(obj, val); }
        else if(prof.coops[obj.instid]) {
            //rather than setting lev to 0 and forcing explicit checking
            //everywhere for no benefit, just remove the entry.
            delete prof.coops[obj.instid]; }
        updateProfile(prof, succf, failf);
    }


    function serializeFields (prof) {
        if(typeof prof.cliset === "object") {
            prof.cliset = JSON.stringify(prof.cliset); }
        if(typeof prof.coops === "object") {
            prof.coops = JSON.stringify(prof.coops); }
        //preb is never sent for update since it is maintained on server
        //but serializing it here for symmetry
        if(typeof prof.preb === "object") {
            prof.preb = JSON.stringify(prof.preb); }
    }


    function deserializeFields (prof) {
        app.lcs.reconstituteJSONObjectField("cliset", prof);
        app.lcs.reconstituteJSONObjectField("coops", prof);
        app.lcs.reconstituteJSONObjectField("preb", prof);
    }


    return {
        byprofid: function (id, cmd) { displayProfileForId(id, cmd); },
        myProfId: function () { return mypid; },
        myProfile: function () { return myProfile(); },
        fetchProfile: function (cbf) { fetchProfile(cbf); },
        display: function () { displayProfile(); },
        update: function (obj, sf, xf) { updateProfile(obj, sf, xf); },
        themeLevel: function (coopid) { return themeLevel(coopid); },
        verifyMembership: function (coop) { verifyMembership(coop); },
        getKeywordUse: function (prof) { return getKeywordUse(prof); },
        keywordsForRevType: function (rt) { return keywordsForRevType(rt); },
        setnu: function (field, val) { setNoUpdate(field, val); },
        getwd: function (field, dval) { getWithDefault(field, dval); },
        follow: function (obj, sf, xf) { setFollow(-1, obj, sf, xf); },
        unfollow: function (obj, sf, xf) { setFollow(0, obj, sf, xf); },
        following: function (id) { return myProfile().coops[id]; },
        resetStateVars: function () { mypid = ""; },
        serializeFields: function (prof) { serializeFields(prof); },
        deserializeFields: function (prof) { deserializeFields(prof); }
    };
}());
