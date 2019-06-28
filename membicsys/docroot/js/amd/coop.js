/*global app, jt, confirm, window */

/*jslint browser, white, fudge, long */

// prof.stash (maintained by client)
//   key: ctm + coopid
//     posts: CSV of revids, most recent first. Not an array.
//     lastpost: ISO date string when most recent review was posted
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

    function followerEmailLinkHTML (mlev) {
        var dst = app.pcd.getDisplayState();
        var subj = "Invitation to follow " + dst.obj.name;
        var involv = "I've found";
        if(mlev) {
            involv = "I'm writing"; }
        var body = "Hi,\n\n" +
            involv + " a theme on membic.org called \"" + dst.obj.name + "\", that I thought you might be interested in. If you join membic.org, you can follow for easy access to the latest and greatest posts. Check out the theme at\n\n" +
            app.secsvr + "?view=coop&coopid=" + dst.id + "\n\n" +
            "Hope you like it!\n\n";
        var link = "mailto:?subject=" + jt.dquotenc(subj) +
            "&body=" + jt.dquotenc(body);
        var html = ["a", {href:link},
                    [["img", {src:"img/email.png", cla:"inlineimg"}],
                     ["span", {cla:"emlinktext"},
                      "Invite"]]];
        return html;
    }


    function emailInviteLinkHTML (emaddr) {
        var dst = app.pcd.getDisplayState();
        var subj = "Invitation to join " + dst.obj.name;
        var body = "Hi,\n\n" +
            "I'm writing a cooperative theme on membic.org called \"" + dst.obj.name + "\", and I would like to invite you to join me as a contributing member. I value your thoughts and knowledge, and I think our combined membics would be useful to us and other people. You can check out the theme at\n\n" +
            app.secsvr + "/t/" + dst.id + "\n\n" +
            "I've approved your membership, and you should already have received an acceptance link and any other needed account information from " + app.suppemail + ". If you can't find that, use the \"reset password\" link on the login form to get in. I'm guessing you probably have some membics you could write just from recent memory, it would be awesome to see those included.\n\n" +
            "A membic is a link plus a reason why it is memorable. \"" + dst.obj.name + "\" is a collaborative memory space where we control membership and all posted membics. My hope is this will grow into a highly useful resource for us and for others interested what we choose to post. For more info, go to https://www.membic.org\n\n" +
            "Looking forward to building \"" + dst.obj.name + "\" with you!\n\n" +
            "thanks,\n\n";
        var link = "mailto:" + emaddr + "?subject=" + jt.dquotenc(subj) + 
            "&body=" + jt.dquotenc(body);
        var html = ["a", {href:link},
                    [["img", {src:"img/email.png", cla:"inlineimg"}],
                     ["span", {cla:"emlinktext"},
                      "Send Invitation"]]];
        return html;
    }


    function displayInviteDialog (invite, invidx) {
        var html;
        html = ["div", {id: "coopinvitedlgdiv"},
                ["div", {cla: "pcdsectiondiv"},
                 [["p", {cla: "dlgpara"},
                   [["span", {cla: "profflist"}, invite.profname],
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
    }


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

    bycoopid: function (coopid, src, tabname, expid) {
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
                descr:"bump counters theme solopage",
                func:function () {
                    jt.call("POST", "bumpmctr?" + app.login.authparams(), data,
                            function () {
                                app.refer = "";  //only count referrals once
                                jt.log("bumpmctr?" + data + " success"); },
                            function (code, errtxt) {
                                jt.log("bumpmctr?" + data + " failed " + 
                                       code + ": " + errtxt); }); },
                ms:20}); }
        app.pcd.fetchAndDisplay("coop", coopid, tabname, expid);
    },


    updateCoop: function (coop, callok, callfail) {
        var data;
        app.coop.serializeFields(coop);
        data = jt.objdata(coop, ["preb", "top20s", "revids"]) +
            "&profid=" + app.profile.myProfId();
        app.coop.deserializeFields(coop);  //if update fails or interim use
        jt.call("POST", "ctmdesc?" + app.login.authparams(), data,
                function (updcoops) {
                    app.lcs.put("coop", updcoops[0]);
                    app.profile.verifyMembership(updcoops[0]);
                    historyCheckpointIfNeeded(updcoops[0]);
                    callok(updcoops[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("coop.updateCoop"));
    },


    showInviteDialog: function (mlev, inviteobj) {
        var email = ""; var action; var html = [];
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
        var email = jt.byId("emailin").value;
        if(!jt.isProbablyEmail(email)) {
            return; }
        var buttonhtml = jt.byId("invitebuttondiv").innerHTML;
        jt.out("invitebuttondiv", "Approving Membership...");
        jt.byId("emailin").disabled = true;
        var data = "profid=" + app.profile.myProfId() + "&email=" + email +
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
        var invite = app.login.accountInfo("invites")[invidx];
        if(action === "Reject" && !confirm("You will need to re-apply or be invited again to become a member of " + invite.coopname + ". Are you sure you want to reject membership?")) {
            return; }
        invite.processed = true;  //don't loop forever
        var data = "profid=" + app.profile.myProfId() + "&coopid=" + invite.coopid + "&inviterprofid=" + invite.profid + "&action=" + action;
        jt.call("POST", "acceptinvite?" + app.login.authparams(), data,
                function (updobjs) {
                    if(action === "Accept") {
                        app.lcs.put("profile", updobjs[0]);
                        app.lcs.put("coop", updobjs[1]);
                        app.profile.verifyMembership(updobjs[1]); }
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
        data = "profid=" + app.profile.myProfId() + "&coopid=" + jt.instId(coop) + "&action=" + action;
        jt.call("POST", "ctmmemapply?" + app.login.authparams(), data,
                function (updcoops) {
                    app.lcs.put("coop", updcoops[0]);
                    app.profile.verifyMembership(updobjs[0]);
                    contf(updcoops[0]); },
                function (code, errtxt) {
                    jt.err(action + " membership application failed code: " +
                           code + ": " + errtxt);
                    contf(); },
                jt.semaphore("coop.applyForMembership"));
    },


    processMembership: function (coop, pact, pseekid, preason, contf) {
        var data = jt.objdata({action:pact, profid:app.profile.myProfId(),
                               coopid:jt.instId(coop), seekerid:pseekid,
                               reason:preason});
        jt.call("POST", "ctmmemprocess?" + app.login.authparams(), data,
                function (updcoops) {
                    app.lcs.put("coop", updcoops[0]);
                    app.profile.verifyMembership(updobjs[0]);
                    contf(updcoops[0]); },
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


    remove: function (ctmid, revid) {
        var removebutton = jt.byId("rdremb");
        if(removebutton) {
            removebutton.disabled = true;
            jt.out("rdremstatdiv", ""); }
        else {
            var html = ["div", {id:"revdlgdiv"},
                        [["div", {id:"rdremstatdiv"}],
                         ["label", {fo:"reasonin", cla:"liflab"}, "Reason"],
                         ["input", {id:"reasonin", cla:"lifin", type:"text"}],
                         ["div", {id:"rdrembdiv", cla:"dlgbuttonsdiv"},
                          ["button", {type:"button", id:"rdremb",
                                      onclick:jt.fs("app.coop.remove('" + 
                                                     ctmid + "','" + revid + 
                                                    "')")},
                           "Remove"]]]];
            html = app.layout.dlgwrapHTML("Remove Theme Post", html);
            var pos = jt.geoPos(jt.byId("rbd" + revid));
            return app.layout.openDialog(
                {x: pos.x - 40 , y: pos.y - 30},
                jt.tac2html(html), null, function() {
                    jt.byId("reasonin").focus(); }); }
        var rev = app.lcs.getRef("rev", revid).rev;
        var reason = jt.byId("reasonin").value.trim();
        if(!reason && rev.profid !== app.profile.myProfId()) {
            removebutton.disabled = false;
            return jt.out("rdremstatdiv", "Reason required"); }
        jt.out("rdremstatdiv", "Removing...");
        var data = "profid=" + app.profile.myProfId() + "&revid=" + revid + 
            "&reason=" + jt.enc(reason);
        jt.call("POST", "delrev?" + app.login.authparams(), data,
                function (coops) {
                    app.lcs.put("coop", coops[0]);
                    app.layout.closeDialog();
                    app.pcd.display("coop", ctmid, "", coops[0]); },
                function (code, errtxt) {
                    removebutton.disabled = false;
                    jt.out("rdremstatdiv", "Removal failed code " + code +
                           ": " + errtxt); },
                jt.semaphore("coop.remove"));
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
        if(ctm && ctm.soloset && ctm.soloset.flags) {
            return ctm.soloset.flags[flagname]; }
        return false;
    },


    setFlag: function (ctm, flagname, value) {
        ctm.soloset = ctm.soloset || {};
        ctm.soloset.flags = ctm.soloset.flags || {};
        ctm.soloset.flags[flagname] = value;
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
        app.lcs.reconstituteJSONObjectField("preb", ctm);
    }

}; //end of returned functions
}());
