/*global alert: false, document: false, app: false, jt: false, window: false  */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

// pen.stash (maintained by client)
//   key: grp + groupid
//     posts: CSV of revids, most recent first. Not an array.
//     lastpost: ISO date string when most recent review was posted
// group.adminlog (array of entries maintained by server)
//   when: ISO date
//   penid: admin that took the action
//   pname: name of admin that took the action
//   action: e.g. "Accepted Membership", "Removed Review", "Removed Member"
//   target: revid or penid of what or was affected
//   tname: name of pen or review that was affected
//   reason: text given as to why (required for removals)
app.group = (function () {
    "use strict";

    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    bygroupid: function (groupid, tabname, expid) {
        app.pgd.fetchAndDisplay("group", groupid, tabname, expid);
    },


    updateGroup: function (group, callok, callfail) {
        var data = jt.objdata(group, ["recent", "top20s", "revids"]) +
            "&penid=" + app.pen.myPenId();
        jt.call('POST', "grpdesc?" + app.login.authparams(), data,
                function (updgroups) {
                    updgroups[0].recent = group.recent;
                    app.lcs.put("group", updgroups[0]);
                    callok(updgroups[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("group.updateGroup"));
    },


    applyForMembership: function (group, action, contf) {
        var data;
        data = "penid=" + app.pen.myPenId() + 
            "&groupid=" + jt.instId(group) +
            "&action=" + action;
        jt.call('POST', "grpmemapply?" + app.login.authparams(), data,
                function (updgroups) {
                    updgroups[0].recent = group.recent;
                    app.lcs.put("group", updgroups[0]);
                    contf(updgroups[0]); },
                function (code, errtxt) {
                    jt.err(action + " membership application failed code: " +
                           code + ": " + errtxt);
                    contf(); },
                jt.semaphore("group.applyForMembership"));
    },


    processMembership: function (group, action, seekerid, reason, contf) {
        var data;
        data = jt.objdata({action: action, penid: app.pen.myPenId(), 
                           groupid: jt.instId(group), seekerid: seekerid,
                           reason: reason});
        jt.call('POST', "grpmemprocess?" + app.login.authparams(), data,
                function (updgroups) {
                    updgroups[0].recent = group.recent;
                    app.lcs.put("group", updgroups[0]);
                    contf(updgroups[0]); },
                function (code, errtxt) {
                    jt.err("Membership processing failed code: " + code +
                           ": " + errtxt);
                    contf(); },
                jt.semaphore("group.processMembership"));
    },


    membershipLevel: function (group, penid) {
        if(!group) {
            return 0; }
        group.members = group.members || "";
        group.moderators = group.moderators || "";
        group.founders = group.founders || "";
        penid = penid || app.pen.myPenId();
        if(group.members.csvcontains(penid)) {
            return 1; }
        if(group.moderators.csvcontains(penid)) {
            return 2; }
        if(group.founders.csvcontains(penid)) {
            return 3; }
        return 0;
    },


    isSeeking: function (group, penid) {
        if(!group) {
            return 0; }
        penid = penid || app.pen.myPenId();
        if(group.seeking && group.seeking.csvcontains(penid)) {
            return true; }
        return false;
    },


    verifyPenStash: function (group) {
        var penid, pen, key, pso, i, revref, revid, memlev, modified = false;
        penid = app.pen.myPenId();
        pen = app.pen.myPenName();
        if(!pen) {
            return; }
        key = "grp" + jt.instId(group);
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
        if(!pso.name || pso.name !== group.name) {
            pso.name = group.name;
            modified = true; }
        memlev = app.group.membershipLevel(group, penid);
        if(!pso.memlev || pso.memlev !== memlev) {
            pso.memlev = memlev;
            modified = true; }
        for(i = 0; group.recent && i < group.recent.length; i += 1) {
            revref = app.lcs.getRef("rev", group.recent[i]);
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
                    jt.log("Pen stash updated for " + group.name); },
                function (code, errtxt) {
                    jt.log("verifyPenStash " + code + ": " + errtxt); }); }
    },


    mayRemove: function (grp, rev) {
        var penid;
        if(!rev || !grp) {
            return false; }
        penid = app.pen.myPenId();
        if(rev.penid === penid || app.group.membershipLevel(grp, penid) > 1) {
            return true; }
        return false;
    },


    remove: function (grpid, revid) {
        var removebutton, html, pos, rev, grp, reason, data;
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
                                  onclick: jt.fs("app.group.remove('" + 
                                                 grpid + "','" + revid + "')")},
                       "Remove"]]]];
            html = app.layout.dlgwrapHTML("Remove Group Post", html);
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
                function (groups) {
                    grp = app.lcs.getRef("group", grpid).group;
                    if(grp.recent && grp.recent.indexOf(revid) >= 0) {
                        grp.recent.splice(grp.recent.indexOf(revid), 1); }
                    groups[0].recent = grp.recent;
                    //top20s updated by server, rebuilt for display as needed
                    app.lcs.put("group", groups[0]);
                    app.lcs.uncache("rev", revid);
                    app.layout.closeDialog();
                    app.pgd.display("group", grpid, "", groups[0]); },
                function (code, errtxt) {
                    removebutton.disabled = false;
                    jt.out('rdremstatdiv', "Removal failed code " + code +
                           ": " + errtxt); },
                jt.semaphore("group.remove"));
    },


    serializeFields: function (grp) {
        //top20s are maintained and rebuilt by the server, so
        //serializing is not strictly necessary, but it doesn't hurt.
        //ditto for adminlog and people
        if(typeof grp.top20s === 'object') {
            grp.top20s = JSON.stringify(grp.top20s); }
        if(typeof grp.adminlog === 'object') {
            grp.adminlog = JSON.stringify(grp.adminlog); }
        if(typeof grp.people === 'object') {
            grp.people = JSON.stringify(grp.people); }
    },


    deserializeFields: function (grp) {
        app.lcs.reconstituteJSONObjectField("top20s", grp);
        app.lcs.reconstituteJSONObjectField("adminlog", grp);
        app.lcs.reconstituteJSONObjectField("people", grp);
    }

}; //end of returned functions
}());

