/*global app, jt, confirm, window */

/*jslint browser, white, fudge, long */

// coop.adminlog (array of entries maintained by server)
//   when: ISO date
//   profid: admin that took the action
//   pname: name of admin that took the action
//   action: e.g. "Accepted Membership", "Removed Membic", "Removed Member"
//   target: revid or profid of what or was affected
//   tname: name of profile or review that was affected
//   reason: text given as to why (required for removals)
app.coop = (function () {
    "use strict";

    //Fields that need to be deserialized after fetching.
    var serflds = ["adminlog", "people", "cliset", "preb"];

    function historyCheckpointIfNeeded (coop) {
        //when creating a new theme, the history state will not have
        //been checkpointed because there was no id yet.
        var id = jt.instId(coop);
        var hs = app.history.currState();
        if(id && hs.view !== "coop") {
            hs = { view: "coop", coopid: id };
            app.history.checkpoint(hs); }
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    bycoopid: function (coopid, src, cmd) {
        var solopage = app.solopage();
        var cts = ["review", "membership"];
        if(cts.indexOf(src) >= 0 || solopage) {
            var ctype = "sitev";
            if(solopage) {
                    ctype = "permv"; }
            var data = jt.objdata({ctype:"Theme", parentid:coopid,
                                   field:ctype, profid:app.profile.myProfId(),
                                   refer:app.refer});
            app.fork({
                descr:"bump counters for access to theme " + coopid,
                func:function () {
                    jt.call("POST", "bumpmctr?" + app.login.authparams(), data,
                            function () {
                                app.refer = "";  //only count referrals once
                                jt.log("bumpmctr?" + data + " success"); },
                            function (code, errtxt) {
                                jt.log("bumpmctr?" + data + " failed " + 
                                       code + ": " + errtxt); }); },
                ms:800}); }  //longish delay to avoid blocking current work
        app.pcd.fetchAndDisplay("coop", coopid, cmd);
    },


    updateCoop: function (coop, callok, callfail) {
        var data;
        app.coop.serializeFields(coop);
        data = jt.objdata(coop, ["preb", "revids"]) +
            "&profid=" + app.profile.myProfId();
        app.coop.deserializeFields(coop);  //if update fails or interim use
        jt.call("POST", "ctmdesc?" + app.login.authparams(), data,
                function (updcoops) {
                    app.lcs.put("coop", updcoops[0]);
                    app.profile.verifyMembership(updcoops[0]);
                    historyCheckpointIfNeeded(updcoops[0]);
                    app.lcs.uncache("activetps", "411");
                    callok(updcoops[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("coop.updateCoop"));
    },


    applyForMembership: function (coop, memact, contf) {
        //action: apply, withdraw, accrej
        var data = jt.objdata({profid:app.profile.myProfId(),
                               action:memact, coopid:coop.instid});
        jt.call("POST", "ctmmemapply?" + app.login.authparams(), data,
                function (updobjs) {
                    app.lcs.addReplaceAll(updobjs);
                    //No profile.verifyMembership. notices possibly removed.
                    contf(updobjs[0]); },
                function (code, errtxt) {
                    jt.err("membership " + memact + " failed code: " +
                           code + ": " + errtxt);
                    contf(); },
                jt.semaphore("coop.applyForMembership"));
    },


    processMembership: function (coop, pact, pseekid, preason, contf) {
        //action: accept, reject, demote
        var data = jt.objdata({action:pact, profid:app.profile.myProfId(),
                               coopid:jt.instId(coop), seekerid:pseekid,
                               reason:preason});
        jt.call("POST", "ctmmemprocess?" + app.login.authparams(), data,
                function (updobjs) {
                    app.lcs.addReplaceAll(updobjs);
                    //No profile.verifyMembership. notices possibly removed.
                    contf(updobjs[0]); },
                function (code, errtxt) {
                    jt.err("Membership processing failed code: " + code +
                           ": " + errtxt);
                    contf(); },
                jt.semaphore("coop.processMembership"));
    },


    membershipLevel: function (coop, profid) {
        if(!coop) {
            return 0; }
        if(!profid || profid === "0") {
            profid = app.profile.myProfId(); }
        if(!profid) {
            return 0; }
        var fields = ["members", "moderators", "founders"];
        var lev = 0;
        fields.forEach(function (field, idx) {
            coop[field] = coop[field] || "";
            if(coop[field].csvcontains(profid)) {
                lev = idx + 1; } });  //member:1, moderator:2, founder:3
        return lev;
    },


    memberSummary: function (coop) {
        var summary = [];
        var fields = ["founders", "moderators", "members"];
        fields.forEach(function (field, idx) {
            coop[field].csvarruniq().forEach(function (pid) {
                var pname = coop.people[pid] || pid;
                summary.push({profid:pid, lev:(3 - idx), name:pname}); }); });
        return summary;
    },


    isSeeking: function (coop, profid) {
        if(!coop) {
            return 0; }
        profid = profid || app.profile.myProfId();
        if(coop.seeking && coop.seeking.csvcontains(profid)) {
            return true; }
        return false;
    },


    isRejected: function (coop, profid) {
        if(!coop) {
            return 0; }
        profid = profid || app.profile.myProfId();
        if(coop.rejects && coop.rejects.csvcontains(profid)) {
            return true; }
        return false;
    },


    confirmPostThrough: function (rev) {
        var retval = true;
        if(!rev.ctmids) {  //not posting through, so nothing to check
            return true; }
        var ref; var rejection;
        rev.ctmids.csvarray().every(function (ctmid) {
            ref = app.lcs.getRef("coop", ctmid);  //cached on rev edit
            if(ref && ref.coop && ref.coop.adminlog) {
                ref.coop.adminlog.every(function (logentry) {
                    if(logentry.action === "Removed Membic" &&
                       logentry.targid === jt.instId(rev) &&
                       logentry.profid !== app.profile.myProfId()) {
                        rejection = logentry;
                        return false; }
                    return true; }); }
            if(rejection) {
                retval = confirm(rejection.pname + 
                                 " previously removed this membic from " + 
                                 ref.coop.name + ". Reason: \"" + 
                                 rejection.reason + "\". Repost anyway?"); }
            return retval; });  //stop on first non-confirmed rejection
        return retval;
    },


    clearSysNotices: function () {
        jt.out("sysnoticediv", ""); 
    },


    hasFlag: function (ctm, flagname) {
        if(ctm && ctm.cliset && ctm.cliset.flags) {
            return ctm.cliset.flags[flagname]; }
        return false;
    },


    setFlag: function (ctm, flagname, value) {
        ctm.cliset = ctm.cliset || {};
        ctm.cliset.flags = ctm.cliset.flags || {};
        ctm.cliset.flags[flagname] = value;
    },


    serializeFields: function (ctm) {
        //Server-maintained fields are ignored in POST.  They are serialized
        //here for deserialize symmetry and informative transmission logs.
        serflds.forEach(function (field) {
            if(typeof ctm[field] === "object") {
                ctm[field] = JSON.stringify(ctm[field]); } });
    },


    deserializeFields: function (ctm) {
        serflds.forEach(function (field) {
            app.lcs.reconstituteJSONObjectField(field, ctm); });
    }

}; //end of returned functions
}());
