/*global alert: false, document: false, app: false, jt: false, window: false  */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

// pen.stash (maintained by client)
//   key: ctm + coopid
//     posts: CSV of revids, most recent first. Not an array.
//     lastpost: ISO date string when most recent review was posted
// coop.adminlog (array of entries maintained by server)
//   when: ISO date
//   penid: admin that took the action
//   pname: name of admin that took the action
//   action: e.g. "Accepted Membership", "Removed Review", "Removed Member"
//   target: revid or penid of what or was affected
//   tname: name of pen or review that was affected
//   reason: text given as to why (required for removals)
app.coop = (function () {
    "use strict";

    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    bycoopid: function (coopid, tabname, expid) {
        app.pcd.fetchAndDisplay("coop", coopid, tabname, expid);
    },


    updateCoop: function (coop, callok, callfail) {
        var data = jt.objdata(coop, ["recent", "top20s", "revids"]) +
            "&penid=" + app.pen.myPenId();
        jt.call('POST', "ctmdesc?" + app.login.authparams(), data,
                function (updcoops) {
                    updcoops[0].recent = coop.recent;
                    app.lcs.put("coop", updcoops[0]);
                    callok(updcoops[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("coop.updateCoop"));
    },


    applyForMembership: function (coop, action, contf) {
        var data;
        data = "penid=" + app.pen.myPenId() + 
            "&coopid=" + jt.instId(coop) +
            "&action=" + action;
        jt.call('POST', "ctmmemapply?" + app.login.authparams(), data,
                function (updcoops) {
                    updcoops[0].recent = coop.recent;
                    app.lcs.put("coop", updcoops[0]);
                    contf(updcoops[0]); },
                function (code, errtxt) {
                    jt.err(action + " membership application failed code: " +
                           code + ": " + errtxt);
                    contf(); },
                jt.semaphore("coop.applyForMembership"));
    },


    processMembership: function (coop, action, seekerid, reason, contf) {
        var data;
        data = jt.objdata({action: action, penid: app.pen.myPenId(), 
                           coopid: jt.instId(coop), seekerid: seekerid,
                           reason: reason});
        jt.call('POST', "ctmmemprocess?" + app.login.authparams(), data,
                function (updcoops) {
                    updcoops[0].recent = coop.recent;
                    app.lcs.put("coop", updcoops[0]);
                    contf(updcoops[0]); },
                function (code, errtxt) {
                    jt.err("Membership processing failed code: " + code +
                           ": " + errtxt);
                    contf(); },
                jt.semaphore("coop.processMembership"));
    },


    membershipLevel: function (coop, penid) {
        if(!coop) {
            return 0; }
        coop.members = coop.members || "";
        coop.moderators = coop.moderators || "";
        coop.founders = coop.founders || "";
        penid = penid || app.pen.myPenId();
        if(coop.members.csvcontains(penid)) {
            return 1; }
        if(coop.moderators.csvcontains(penid)) {
            return 2; }
        if(coop.founders.csvcontains(penid)) {
            return 3; }
        return 0;
    },


    isSeeking: function (coop, penid) {
        if(!coop) {
            return 0; }
        penid = penid || app.pen.myPenId();
        if(coop.seeking && coop.seeking.csvcontains(penid)) {
            return true; }
        return false;
    },


    verifyPenStash: function (coop) {
        var penid, pen, key, pso, i, revref, revid, memlev, modified = false;
        penid = app.pen.myPenId();
        pen = app.pen.myPenName();
        if(!pen) {
            return; }
        key = "ctm" + jt.instId(coop);
        if(!pen.stash) {
            pen.stash = {};
            modified = true; }
        if(!pen.stash[key]) {
            pen.stash[key] = { posts: "", lastpost: "" };
            modified = true; }
        pso = pen.stash[key];
        if(!pso.posts && pso.lastpost) {
            pso.lastpost = "";
            modified = true; }
        if(!pso.name || pso.name !== coop.name) {
            pso.name = coop.name;
            modified = true; }
        memlev = app.coop.membershipLevel(coop, penid);
        if(!pso.memlev || pso.memlev !== memlev) {
            pso.memlev = memlev;
            modified = true; }
        for(i = 0; coop.recent && i < coop.recent.length; i += 1) {
            revref = app.lcs.getRef("rev", coop.recent[i]);
            if(revref.rev && revref.rev.penid === penid) {
                if(!pso.lastpost || revref.rev.modified > pso.lastpost) {
                    pso.lastpost = revref.rev.modified;
                    modified = true; }
                revid = jt.instId(revref.rev);
                if(!pso.posts.csvcontains(revid)) {
                    pso.posts = pso.posts.csvappend(revid);
                    modified = true; } } }
        if(modified) {
            app.pen.updatePen(
                pen,
                function (pen) {
                    jt.log("Pen stash updated for " + coop.name); },
                function (code, errtxt) {
                    jt.log("verifyPenStash " + code + ": " + errtxt); }); }
    },


    mayRemove: function (ctm, rev) {
        var penid;
        if(!rev || !ctm) {
            return false; }
        penid = app.pen.myPenId();
        if(rev.penid === penid || app.coop.membershipLevel(ctm, penid) > 1) {
            return true; }
        return false;
    },


    remove: function (ctmid, revid) {
        var removebutton, html, pos, rev, ctm, reason, data;
        removebutton = jt.byId('rdremb');
        if(removebutton) {
            removebutton.disabled = true;
            jt.out('rdremstatdiv', ""); }
        else {
            html = ["div", {id: "revdlgdiv"},
                    [["div", {id: "rdremstatdiv"}],
                     ["label", {fo: "reasonin", cla: "liflab"}, "Reason"],
                     ["input", {id: "reasonin", cla: "lifin", type: "text"}],
                     ["div", {id: "rdrembdiv", cla: "dlgbuttonsdiv"},
                      ["button", {type: "button", id: "rdremb",
                                  onclick: jt.fs("app.coop.remove('" + 
                                                 ctmid + "','" + revid + "')")},
                       "Remove"]]]];
            html = app.layout.dlgwrapHTML("Remove Coop Post", html);
            pos = jt.geoPos(jt.byId("rbd" + revid));
            return app.layout.openDialog(
                {x: pos.x - 40 , y: pos.y - 30},
                jt.tac2html(html), null, function() {
                    jt.byId('reasonin').focus(); }); }
        rev = app.lcs.getRef("rev", revid).rev;
        reason = jt.byId('reasonin').value.trim();
        if(!reason && rev.penid !== app.pen.myPenId()) {
            return jt.out('rdremstatdiv', "Reason required"); }
        jt.out('rdremstatdiv', "Removing...");
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid + 
            "&reason=" + jt.enc(reason);
        jt.call('POST', "delrev?" + app.login.authparams(), data,
                function (coops) {
                    ctm = app.lcs.getRef("coop", ctmid).coop;
                    if(ctm.recent && ctm.recent.indexOf(revid) >= 0) {
                        ctm.recent.splice(ctm.recent.indexOf(revid), 1); }
                    coops[0].recent = ctm.recent;
                    //top20s updated by server, rebuilt for display as needed
                    app.lcs.put("coop", coops[0]);
                    app.lcs.uncache("rev", revid);
                    app.layout.closeDialog();
                    app.pcd.display("coop", ctmid, "", coops[0]); },
                function (code, errtxt) {
                    removebutton.disabled = false;
                    jt.out('rdremstatdiv', "Removal failed code " + code +
                           ": " + errtxt); },
                jt.semaphore("coop.remove"));
    },


    serializeFields: function (ctm) {
        //top20s are maintained and rebuilt by the server, so
        //serializing is not strictly necessary, but it doesn't hurt.
        //ditto for adminlog and people
        if(typeof ctm.top20s === 'object') {
            ctm.top20s = JSON.stringify(ctm.top20s); }
        if(typeof ctm.adminlog === 'object') {
            ctm.adminlog = JSON.stringify(ctm.adminlog); }
        if(typeof ctm.people === 'object') {
            ctm.people = JSON.stringify(ctm.people); }
    },


    deserializeFields: function (ctm) {
        app.lcs.reconstituteJSONObjectField("top20s", ctm);
        app.lcs.reconstituteJSONObjectField("adminlog", ctm);
        app.lcs.reconstituteJSONObjectField("people", ctm);
    }

}; //end of returned functions
}());

