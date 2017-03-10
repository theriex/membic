/*global app, jt, confirm, window */

/*jslint browser, multivar, white, fudge */

// pen.stash (maintained by client)
//   key: ctm + coopid
//     posts: CSV of revids, most recent first. Not an array.
//     lastpost: ISO date string when most recent review was posted
// coop.adminlog (array of entries maintained by server)
//   when: ISO date
//   penid: admin that took the action
//   pname: name of admin that took the action
//   action: e.g. "Accepted Membership", "Removed Membic", "Removed Member"
//   target: revid or penid of what or was affected
//   tname: name of pen or review that was affected
//   reason: text given as to why (required for removals)
app.coop = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var srvctms = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    followerEmailLinkHTML = function (mlev) {
        var dst, subj, body, href, html, 
            involv = mlev? "I'm writing" : "I've found";
        dst = app.pcd.getDisplayState();
        subj = "Invitation to follow " + dst.obj.name;
        body = "Hi,\n\n" +
            involv + " a theme on membic.com called \"" + dst.obj.name + "\", that I thought you might be interested in. If you join membic.com, you can follow for easy access to the latest and greatest posts. Check out the theme at\n\n" +
            app.secsvr + "?view=coop&coopid=" + dst.id + "\n\n" +
            "Hope you like it!\n\n";
        href = "mailto:?subject=" + jt.dquotenc(subj) +
            "&body=" + jt.dquotenc(body);
        html = ["a", {href: href},
                [["img", {src: "img/email.png", cla: "inlineimg"}],
                 ["span", {cla: "emlinktext"},
                  "Invite"]]];
        return html;
    },


    emailInviteLinkHTML = function (emaddr) {
        var dst, subj, body, href, html;
        dst = app.pcd.getDisplayState();
        subj = "Invitation to join " + dst.obj.name;
        body = "Hi,\n\n" +
            "I'm writing a cooperative theme on membic.com called \"" + dst.obj.name + "\", and I would like to invite you to join me as a contributing member. I value your thoughts and knowledge, and I think our combined membics would be useful to us and other people. You can check out the theme at\n\n" +
            app.secsvr + "/t/" + dst.id + "\n\n" +
            "I've approved your membership, and you should already have received an acceptance link and any other needed account information from " + app.suppemail + ". I'm guessing you probably have some membics you could write just from recent memory, it would be awesome to see those included.\n\n" +
            "Here's some background in case it helps: A membic is a short structured summary of something worth remembering. Membics are quick to create, but have enough information to support collaborative memory. \"" + dst.obj.name + "\" is a collaborative memory space where we control membership and all posted membics. My hope is this will grow into a highly useful resource for us and for others interested what we choose to post. For more details, go to https://www.membic.com and click the \"About\" link at the bottom of the page.\n\n" +
            "Looking forward to building \"" + dst.obj.name + "\" with you!\n\n" +
            "thanks,\n\n";
        href = "mailto:" + emaddr + "?subject=" + jt.dquotenc(subj) + 
            "&body=" + jt.dquotenc(body);
        html = ["a", {href: href},
                [["img", {src: "img/email.png", cla: "inlineimg"}],
                 ["span", {cla: "emlinktext"},
                  "Send Invitation"]]];
        return html;
    },


    displayInviteDialog = function (invite, invidx) {
        var html;
        html = ["div", {id: "coopinvitedlgdiv"},
                ["div", {cla: "pcdsectiondiv"},
                 [["p", {cla: "dlgpara"},
                   [["span", {cla: "penflist"}, invite.penname],
                    " has invited you to become a member of ",
                    ["em", invite.coopname],
                    "."]],
                  ["p", {cla: "dlgpara"},
                   "Accept this membership invitation to access " + invite.coopname + " from the themes tab on your profile, and enable the option to post through to " + invite.coopname + " when you write or edit a membic."],
                  ["div", {id: "errmsgdiv", cla: "dlgpara"}],
                  ["div", {cla: "dlgbuttonsdiv", id: "invitebuttondiv"},
                   [["button", {type: "button", id: "membrejectbutton",
                                onclick: jt.fs("app.coop.accrejInvite(" +
                                               invidx + ",'Reject')")},
                     "Reject"],
                    ["button", {type: "button", id: "membacceptbutton",
                                onclick: jt.fs("app.coop.accrejInvite(" +
                                               invidx + ",'Accept')")},
                     "Accept"]]]]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html));
    },


    historyCheckpointIfNeeded = function (coop) {
        //when creating a new theme, the history state will not have
        //been checkpointed because there was no id yet.
        var id = jt.instId(coop), 
            hs = app.history.currState();
        if(id && hs.view !== "coop") {
            hs = { view: "coop", coopid: id };
            app.history.checkpoint(hs); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    bycoopid: function (coopid, src, tabname, expid) {
        var solopage, cts, data, ctype;
        solopage = app.solopage();
        cts = ["review", "membership"];
        if(cts.indexOf(src) >= 0 || solopage) {
            ctype = solopage ? "permv" : "sitev";
            data = jt.objdata({ctype: "Theme", parentid: coopid,
                               field: ctype, penid: app.pen.myPenId(),
                               refer: app.refer});
            setTimeout(function () {
                jt.call("POST", "bumpmctr?" + app.login.authparams(), data,
                        function () {
                            app.refer = "";  //only count referrals once
                            jt.log("bumpmctr?" + data + " success"); },
                        function (code, errtxt) {
                            jt.log("bumpmctr?" + data + " failed " + 
                                   code + ": " + errtxt); }); },
                       20); }
        app.pcd.fetchAndDisplay("coop", coopid, tabname, expid);
    },


    updateCoop: function (coop, callok, callfail) {
        var data;
        app.coop.serializeFields(coop);
        data = jt.objdata(coop, ["recent", "top20s", "revids"]) +
            "&penid=" + app.pen.myPenId();
        app.coop.deserializeFields(coop);  //if update fails or interim use
        jt.call("POST", "ctmdesc?" + app.login.authparams(), data,
                function (updcoops) {
                    historyCheckpointIfNeeded(updcoops[0]);
                    app.coop.noteUpdatedCoop(updcoops[0], coop);
                    callok(updcoops[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("coop.updateCoop"));
    },


    noteUpdatedCoop: function (updcoop, currcoop) {
        app.coop.rememberThemeName(updcoop);
        if(!currcoop) {
            currcoop = (app.lcs.getRef("coop", jt.instId(updcoop))).coop; }
        //only cache if we have the recent reviews, that way we know we
        //still need to do a blockfetch for all the data.
        if(currcoop) {
            updcoop.recent = currcoop.recent;
            app.lcs.put("coop", updcoop); }
    },


    showInviteDialog: function (mlev, inviteobj) {
        var email = "", action, html = [];
        //action is either the db update button or sending mail
        if(!inviteobj) {
            action = ["button", {type: "button", id: "memapprovebutton",
                                 onclick: jt.fs("app.coop.updateInvite(" + 
                                                mlev + ")")},
                      "Pre-Approve Membership"]; }
        else {
            email = inviteobj.email;
            action = emailInviteLinkHTML(inviteobj.email); }
        html.push(["div", {cla: "pcdsectiondiv"},
                  [["h4", "Invite Follower"],
                   ["p", {cla: "dlgpara"},
                    "To invite someone to follow <em>" + app.pcd.getDisplayState().obj.name + "</em>, send them a mail message with the theme name and link."],
                   ["div", {cla: "dlgbuttonsdiv", id: "invitefollowdiv"},
                    followerEmailLinkHTML(mlev)]]]);
        if(mlev >= 2) { //Founder
            html.push(["div", {cla: "pcdsectiondiv"},
                       [["h4", "Invite Member"],
                        ["p", {cla: "dlgpara"}, 
                         "To invite someone as a contributing member, pre-approve their membership and then send them a mail message."],
                        ["div", {cla: "formline"},
                         [["label", {fo: "emailin", cla: "liflab"}, "Email"],
                          ["input", {id: "emailin", cla: "lifin", type: "email",
                                     value: email, disabled: jt.toru(inviteobj),
                                     placeholder: "user@example.com"}]]],
                        ["div", {id: "errmsgdiv", cla: "dlgpara"}],
                        ["div", {cla: "dlgbuttonsdiv", id: "invitebuttondiv"},
                         action]]]); }
        html = ["div", {id: "coopinvitedlgdiv"}, html];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html));
    },


    updateInvite: function (mlev) {
        var buttonhtml, email, data;
        email = jt.byId("emailin").value;
        if(!jt.isProbablyEmail(email)) {
            return; }
        buttonhtml = jt.byId("invitebuttondiv").innerHTML;
        jt.out("invitebuttondiv", "Approving Membership...");
        jt.byId("emailin").disabled = true;
        data = "penid=" + app.pen.myPenId() + "&email=" + email +
            "&coopid=" + app.pcd.getDisplayState().id;
        jt.call("POST", "invitebymail?" + app.login.authparams(), data,
                function (invites) {
                    app.coop.showInviteDialog(mlev, invites[0]); },
                app.failf(function (code, errtxt) {
                    jt.out("errmsgdiv", "Invite failed " + code + 
                           ": " + errtxt);
                    jt.out("invitebuttondiv", buttonhtml); }),
                jt.semaphore("coop.updateInvite"));
    },


    accrejInvite: function (invidx, action) {
        var invite, data;
        invite = app.login.accountInfo("invites")[invidx];
        if(action === "Reject" && !confirm("You will need to re-apply or be invited again to become a member of " + invite.coopname + ". Are you sure you want to reject membership?")) {
            return; }
        invite.processed = true;  //don't loop forever
        data = "penid=" + app.pen.myPenId() + "&coopid=" + invite.coopid + 
            "&inviterpenid=" + invite.penid + "&action=" + action;
        jt.call("POST", "acceptinvite?" + app.login.authparams(), data,
                function (updobjs) {
                    if(action === "Accept") {
                        app.pen.noteUpdatedPen(updobjs[0]);
                        app.coop.noteUpdatedCoop(updobjs[1]);
                        app.coop.verifyPenStash(updobjs[1]); }
                    app.layout.cancelOverlay();
                    app.coop.processInvites(); },  //in case there are more
                app.failf(function (code, errtxt) {
                    jt.out("errmsgdiv", "Invite processing failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("coop.accrejInvite"));
    },


    processInvites: function () {
        var invites;
        invites = app.login.accountInfo("invites") || [];
        invites.some(function (invite, invidx) {
            if(!invite.processed) {
                displayInviteDialog(invite, invidx);
                return true; }
            return false; });
    },


    applyForMembership: function (coop, action, contf) {
        var data;
        data = "penid=" + app.pen.myPenId() + 
            "&coopid=" + jt.instId(coop) +
            "&action=" + action;
        jt.call("POST", "ctmmemapply?" + app.login.authparams(), data,
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
        jt.call("POST", "ctmmemprocess?" + app.login.authparams(), data,
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
        if(!penid || penid === "0") {
            penid = app.pen.myPenId(); }
        coop.members = coop.members || "";
        coop.moderators = coop.moderators || "";
        coop.founders = coop.founders || "";
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


    isRejected: function (coop, penid) {
        if(!coop) {
            return 0; }
        penid = penid || app.pen.myPenId();
        if(coop.rejects && coop.rejects.csvcontains(penid)) {
            return true; }
        return false;
    },


    verifyPenStash: function (coop) {
        var penid, pen, key, pso, memlev, modified = false;
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
        if(coop.recent) {
            coop.recent.forEach(function (recentid) {
                var revref = app.lcs.getRef("rev", recentid);
                if(revref.rev && revref.rev.penid === penid) {
                    if(!pso.lastpost || revref.rev.modified > pso.lastpost) {
                        pso.lastpost = revref.rev.modified;
                        modified = true; }
                    if(!pso.posts.csvcontains(recentid)) {
                        pso.posts = pso.posts.csvappend(recentid);
                        modified = true; } } }); }
        if(modified) {
            app.pen.updatePen(
                pen,
                function (ignore /*pen*/) {
                    jt.log("Pen stash updated for " + coop.name); },
                function (code, errtxt) {
                    jt.log("verifyPenStash " + code + ": " + errtxt); }); }
    },


    remove: function (ctmid, revid) {
        var removebutton, html, pos, rev, ctm, reason, data;
        removebutton = jt.byId("rdremb");
        if(removebutton) {
            removebutton.disabled = true;
            jt.out("rdremstatdiv", ""); }
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
            html = app.layout.dlgwrapHTML("Remove Theme Post", html);
            pos = jt.geoPos(jt.byId("rbd" + revid));
            return app.layout.openDialog(
                {x: pos.x - 40 , y: pos.y - 30},
                jt.tac2html(html), null, function() {
                    jt.byId("reasonin").focus(); }); }
        rev = app.lcs.getRef("rev", revid).rev;
        reason = jt.byId("reasonin").value.trim();
        if(!reason && rev.penid !== app.pen.myPenId()) {
            removebutton.disabled = false;
            return jt.out("rdremstatdiv", "Reason required"); }
        jt.out("rdremstatdiv", "Removing...");
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid + 
            "&reason=" + jt.enc(reason);
        jt.call("POST", "delrev?" + app.login.authparams(), data,
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
                    jt.out("rdremstatdiv", "Removal failed code " + code +
                           ": " + errtxt); },
                jt.semaphore("coop.remove"));
    },


    faultInPostThroughCoops: function (rev) {
        if(!rev || !rev.svcdata || ! rev.svcdata.postctms) {
            return; }  //nothing to do
        rev.svcdata.postctms.forEach(function (postlog) {
            var ref = app.lcs.getRef("coop", postlog.ctmid);
            if(!ref.coop && ref.status === "not cached") {
                app.pcd.blockfetch("coop", postlog.ctmid, function (coop) {
                    jt.log("Faulted in " + coop.name); }, "statdiv"); } });
    },


    rememberThemeName: function (ctm, fillonly) {
        var ctmid = ctm.ctmid || jt.instId(ctm);
        if(!fillonly || !app.coopnames[ctmid]) {
            app.coopnames[ctmid] = ctm.name;
            app.cooptags[ctmid] = ctm.hashtag || ""; }
    },


    confirmPostThrough: function (rev) {
        var retval = true;
        if(!rev.ctmids) {  //not posting through, so nothing to check
            return true; }
        rev.ctmids.csvarray().every(function (ctmid) {
            var ref, rejection;
            ref = app.lcs.getRef("coop", ctmid);  //cached on rev edit
            if(ref && ref.coop && ref.coop.adminlog) {
                ref.coop.adminlog.every(function (logentry) {
                    if(logentry.action === "Removed Membic" &&
                       logentry.targid === jt.instId(rev) &&
                       logentry.penid !== app.pen.myPenId()) {
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


    systemNotices: function () {
        var sysmsg, html, pen, fault = 0, mn, statdivid = "quiet";
        sysmsg = "";
        mn = "New membership applications for $THEME";
        html = [];
        pen = app.pen.myPenName();
        if(pen && pen.stash) {
            Object.keys(pen.stash).forEach(function (key) {
                var st, link;
                if(key.startsWith("ctm") && pen.stash[key].memlev >= 2) {
                    st = app.lcs.getRef("coop", pen.stash[key].ctmid);
                    if(!st.coop && st.status === "not cached") {
                        fault = pen.stash[key].ctmid; }
                    else if(st.coop && st.coop.seeking) {
                        link = ["a", {href: "#themesettings",
                                      onclick: jt.fs("app.coop.bycoopid('" +
                                                     st.coopid + "'" +
                                                     ",'sysnotice',''" +
                                                     ",'settings')")},
                                st.coop.name];
                        link = mn.replace(/\$THEME/g, jt.tac2html(link));
                        html.push(["div", {cla: "membershipnoticediv"},
                                   link]); } } }); }
        if(sysmsg || html.length > 0) {
            statdivid = "sysnoticefetchstatdiv";
            html = [["div", {cla: "dlgclosex"},
                     ["a", {id: "closesysnotices", href: "#close", 
                            onclick: jt.fs("app.coop.clearSysNotices()")},
                      "&lt;close&nbsp;&nbsp;X&gt;&nbsp;"]],
                    ["div", {id: "sysnoticecontentdiv"},
                     [html,
                      ["div", {id: "sysnoticefetchstatdiv"}]]]]; }
        jt.out("sysnoticediv", jt.tac2html(html));
        if(fault) {  //load missing theme and redisplay notices
            app.pcd.blockfetch("coop", fault, app.coop.systemNotices,
                               statdivid); }
    },


    hasFlag: function (ctm, flagname) {
        if(ctm && ctm.soloset && ctm.soloset.flags) {
            return ctm.soloset.flags[flagname]; }
        return false;
    },


    setFlag: function (ctm, flagname, value) {
        ctm.soloset = ctm.soloset || {};
        ctm.soloset.flags = ctm.soloset.flags || {};
        ctm.soloset.flags[flagname] = value;
    },


    isArchived: function (ctmid) {
        var obj = app.lcs.getRef("coop", ctmid);
        if(obj) {
            obj = obj.coop;
            return app.coop.hasFlag(obj, "archived"); }
        if(srvctms) {
            srvctms.forEach(function (csum) {
                if(csum.ctmid === ctmid) {
                    obj = csum; } });
            if(obj) {
                return app.coop.hasFlag(obj, "archived"); } }
        return false;
    },


    srvctms: function () {
        return srvctms;
    },


    getThemeSummaries: function (contf) {
        if(srvctms) {
            return contf(srvctms); }
        jt.call("GET", "ctmstats", null,
                function (summaries) {
                    summaries.forEach(function (cs) {
                        app.lcs.rjof("top20s", cs);
                        app.lcs.rjof("soloset", cs); });
                    srvctms = summaries;
                    app.activity.displayThemes(); },
                app.failf(function (code, errtxt) {
                    jt.log("ctmstats retrieval call failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("coop.ctmstats"));
    },


    serializeFields: function (ctm) {
        //top20s are maintained and rebuilt by the server, so
        //serializing is not strictly necessary, but it doesn't hurt.
        //ditto for adminlog and people
        if(typeof ctm.top20s === "object") {
            ctm.top20s = JSON.stringify(ctm.top20s); }
        if(typeof ctm.adminlog === "object") {
            ctm.adminlog = JSON.stringify(ctm.adminlog); }
        if(typeof ctm.people === "object") {
            ctm.people = JSON.stringify(ctm.people); }
        if(typeof ctm.soloset === "object") {
            ctm.soloset = JSON.stringify(ctm.soloset); }
    },


    deserializeFields: function (ctm) {
        app.lcs.reconstituteJSONObjectField("top20s", ctm);
        app.lcs.reconstituteJSONObjectField("adminlog", ctm);
        app.lcs.reconstituteJSONObjectField("people", ctm);
        app.lcs.reconstituteJSONObjectField("soloset", ctm);
    }

}; //end of returned functions
}());

