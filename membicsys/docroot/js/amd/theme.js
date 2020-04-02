/*global app, jt, confirm, window */

/*jslint browser, white, fudge, long */

app.theme = (function () {
    "use strict";

    //Fields that need to be deserialized after fetching.
    var serflds = ["adminlog", "people", "cliset", "preb"];


    //context for settings dialog and processing.  Set at start of display.
    var setctx = null;


    function profassoc (dsType, dsId) {
        var prof = app.profile.myProfile() || {};
        var themes = prof.themes || {};
        var tid = dsId;
        if(dsType === "MUser") {
            tid = "P" + dsId; }
        return themes[tid] || {};
    }


    function association (tpo) {
        if(!tpo || !tpo.dsId) {  //no association with undefined theme/prof
            return ""; }
        var authobj = app.login.authenticated()
        if(!authobj) {  //can't figure out any association if no user
            return ""; }
        var uid = authobj.authId;
        if(tpo.dsType === "Theme") {  //use authoritative lists if given
            if(tpo.founders.csvcontains(uid)) { return "Founder"; }
            if(tpo.moderators.csvcontains(uid)) { return "Moderator"; }
            if(tpo.members.csvcontains(uid)) { return "Member"; } }
        //not a theme, or uid not recorded in theme
        switch(profassoc(tpo.dsType, tpo.dsId).lev) {
        case 3: return "Founder";
        case 2: return "Moderator";
        case 1: return "Member";
        case -1: return "Following";
        default: return "Unknown"; }
    }


    function levelForAssoc (assoc) {
        switch(assoc) {
        case "Founder": return 3;
        case "Moderator": return 2;
        case "Member": return 1;
        case "Following": return -1;
        default: return 0; }
    }


    function subtoken (str, tok) {
        return jt.enc(str).split("")
            .map((c) => tok.charAt(c.codePointAt(0) % tok.length))
            .join("");
    }


    function emailOrRSSFollowHTML () {
        var rsshelpurl = "https://en.wikipedia.org/wiki/Web_feed";
        return jt.tac2html(
            ["div", {id:"followseldiv"},
             [["span", {id:"followselspan"}, "Follow via"],
              ["input", {type:"radio", name:"followmechins", value:"email",
                         checked:jt.toru(setctx.fm === "email"),
                         onchange:jt.fs("app.theme.relupd('','email')")}],
              ["label", {fo:"fmemin", title:"Follow new membics via email"},
               "Email"],
              ["input", {type:"radio", name:"followmechins", value:"RSS",
                         checked:jt.toru(setctx.fm === "RSS"),
                         onchange:jt.fs("app.theme.relupd('','RSS')")}],
              ["label", {fo:"fmrssin", title:"Follow new membics via RSS"},
              "RSS"],
              //not good to make labels into links, so provide as extra
              ["a", {href:rsshelpurl,
                     onclick:jt.fs("window.open('" + rsshelpurl + "')")},
               "web feed"]]]);
    }


    function memberSummaryHTML () {
        var html = []
        var mfs = ["founders", "moderators", "members"];
        mfs.forEach(function (field) {
            var misrc = app.dr("img/ts" + field.slice(0, field.length - 1) +
                               ".png");
            setctx.tpo[field].csvarray().forEach(function (pid) {
                //No relevant &cb= value for profile img. Using plain.
                var pisrc = app.dr("/api/obimg?dt=MUser&di=" + pid);
                var name = setctx.tpo.people[pid] || pid;
                var fst = jt.fs("app.statemgr.setState('MUser','" + pid + "')");
                if(pid !== app.profile.myProfile().dsId) {
                    html.push(["div", {cla:"tmemlinediv"},
                               ["a", {href:"#profile",
                                      title:"View profile for " + name,
                                      onclick:fst},
                                [["img", {cla:"tmemlineimg", src:misrc}],
                                 ["img", {cla:"tmemlineimg", src:pisrc}],
                                 name]]]); } }); });
        return jt.tac2html(html);
    }


    function founderSettingsHTML () {
        var ah = "";
        if(setctx.tpo.cliset && setctx.tpo.cliset.flags && 
           setctx.tpo.cliset.flags.archived) {
            ah = ["div", {cla:"tinfolinediv"},
                  "Archived " + setctx.tpo.cliset.flags.archived]; }
        return jt.tac2html(
            [["div", {id:"tmemlistdiv"},
              memberSummaryHTML()],
             ["div", {id:"tinfodiv"},
              ah],
             ["div", {id:"inviteformdiv"},
              [["div", {cla:"cbdiv"},
                [["label", {fo:"invemin", cla:"liflab",
                            title:"Member email for invite authentication"},
                  "Email"],
                 ["input", {type:"email", id:"invemin", cla:"lifin",
                            onchange:jt.fs("app.theme.inviteMemberLink()"),
                            placeholder:"authorized@example.com"}]]],
               ["div", {id:"inviteformbuttonsdiv", cla:"lifbuttonsdiv"},
                [["button", {type:"button",
                             onclick:"app.theme.inviteMemberLink()"},
                  "Make Invite"],
                 ["span", {id:"invlinkspan"}]]]]]]);
    }


    function memberSettingsHTML () {
        return jt.tac2html(
            [emailOrRSSFollowHTML(),
             ["div", {id:"assocbuttonsdiv"},
              [["button", {type:"button",
                           onclick:jt.fs("app.theme.relupd('Unknown')")},
                "Resign"]]]]);
    }


    //Possible to update immediately to following when they click the link,
    //but important for the user to confirm receiving email.
    function followSettingsHTML () {
        var bh = [
            ["button", {type:"button",
                        onclick:jt.fs("app.theme.relupd('Following')")},
             "Follow"]];
        if(setctx.assoc === "Following") {
            bh = [
                ["button", {type:"button",
                            onclick:jt.fs("app.theme.relupd('Unknown')")},
                 "Stop&nbsp;Following"],
                ["button", {type:"button",
                            onclick:jt.fs("app.theme.relupd('Following')")},
                 "Update&nbsp;Follow"]]; }
        return jt.tac2html(
            [emailOrRSSFollowHTML(),
             ["div", {id:"assocbuttonsdiv"}, bh]]);
    }


    function updateSettingsMenuHeading () {
        var link = {text:setctx.assoc + " Settings",
                    title:"Actions for " + setctx.assoc + " " + setctx.tpo.name,
                    src:"ts" + setctx.assoc.toLowerCase() + ".png"};
        if(setctx.assoc === "Unknown") {
            link.text = "Follow " + setctx.tpo.name;
            link.title = link.text;
            link.src = "blank.png"}
        else if(setctx.assoc === "Following") {
            link.text = "Following"; }  //"Settings" on the end gets confusing
        jt.out(setctx.mendivid, jt.tac2html(
            ["a", {href:"#relationship", title:link.title,
                   onclick:jt.fs("app.theme.connopt()")},
             [["img", {cla:"setassocimg", src:app.dr("img/" + link.src)}],
              ["span", {cla:"setassocspan"}, link.text]]]));
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    memberlev: function (tid) {
        if(!tid) {
            return 0; }
        var auth = app.login.authenticated();
        if(!auth) {
            return 0; }
        var theme = app.refmgr.cached("Theme", tid);
        if(theme) {
            if(theme.founders.csvcontains(auth.authId)) {
                return 3; }
            if(theme.moderators.csvcontains(auth.authId)) {
                return 2; }
            if(theme.members.csvcontains(auth.authId)) {
                return 1; } }
        //possibly theme not cached, possibly just following.
        var muser = app.refmgr.cached("MUser", auth.authId);
        if(muser) {
            theme = muser.themes[tid];
            if(theme) {
                return theme.lev || 0; } }
        return 0;
    },


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
        app.pcd.fetchAndDisplay("Theme", coopid, cmd);
    },


    updateCoop: function (coop, callok, callfail) {
        var data;
        app.coop.serializeFields(coop);
        data = jt.objdata(coop, ["preb", "revids"]) +
            "&profid=" + app.profile.myProfId();
        app.coop.deserializeFields(coop);  //if update fails or interim use
        jt.call("POST", "ctmdesc?" + app.login.authparams(), data,
                function (updcoops) {
                    app.refmgr.put(updcoops[0]);
                    app.profile.verifyMembership(updcoops[0]);
                    app.statemgr.setState(updcoops[0]);
                    app.refmgr.uncache("activetps", "411");
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
                               coopid:coop.dsId, seekerid:pseekid,
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


    confirmPostThrough: function (membic) {
        var retval = true;
        if(!membic.ctmids) {  //not posting through, so nothing to check
            return true; }
        var theme; var rejection;
        membic.ctmids.csvarray().every(function (ctmid) {
            theme = app.refmgr.cached("Theme", ctmid);
            if(theme && theme.adminlog) {
                theme.adminlog.every(function (logentry) {
                    if(logentry.action === "Removed Membic" &&
                       logentry.targid === membic.dsId &&
                       logentry.profid !== app.profile.myProfId()) {
                        rejection = logentry;
                        return false; }
                    return true; }); }
            if(rejection) {
                retval = confirm(rejection.pname + 
                                 " previously removed this membic from " + 
                                 theme.name + ". Reason: \"" + 
                                 rejection.reason + "\". Repost anyway?"); }
            return retval; });  //stop on first non-confirmed rejection
        return retval;
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
    },


    association: function (pto) { return association(pto); },


    //Called from settings, which are enabled only if profile is available.
    memberset: function (tpobj, mendiv, detdiv) {
        setctx = {tpo:tpobj, assoc:association(tpobj),
                  mendivid:mendiv, divid:detdiv,
                  ao:profassoc(tpobj.dsType, tpobj.dsId), fm:"email"}
        if(setctx.ao.followmech === "RSS") {
            setctx.fm = "RSS"; }
        updateSettingsMenuHeading();
        jt.out(detdiv, "");  //start with no content
    },


    connopt: function (show) {
        updateSettingsMenuHeading();
        var div = jt.byId(setctx.divid);
        if(!show && div.innerHTML && div.style.display === "block") {
            div.style.display = "none";  //toggle off
            return; }
        var html = "";
        switch(setctx.assoc) {
        case "Founder": html = founderSettingsHTML(); break;
        case "Moderator":  //fall through to Member
        case "Member": html = memberSettingsHTML(); break;
        case "Following":  //fall through to Unknown
        case "Unknown": html = followSettingsHTML(); }
        div.innerHTML = jt.tac2html(html);
        div.style.display = "block";
    },


    //Update and save the account only if an association is specified.  All
    //associations are authorized and maintained server side.  If the follow
    //mechanism is specified, update it in the context.
    relupd: function (assoc, fmech) {
        if(assoc) {    //update association if provided, otherwise use same
            setctx.assoc = assoc; }
        if(fmech) {    //update follow mechanism if provided, otherwise use same
            setctx.fm = fmech; }
        if(!assoc) {   //only call server if association was specified
            return; }  //otherwise interim UI update
        jt.out("assocbuttonsdiv", "Updating...");
        var authobj = app.login.authenticated();
        var data = jt.objdata(
            {an:authobj.email, at:authobj.token,          //user ident
             aot:setctx.tpo.dsType, aoi:setctx.tpo.dsId,  //association obj
             pid:app.profile.myProfile().dsId,            //association prof
             assoc:setctx.assoc, fm:setctx.fm});          //assoc and mech
        jt.call("POST", app.dr("/api/associate"), data,
                function (result) {  //prof, followed by theme if updated
                    result.forEach(function (obj) {
                        app.refmgr.put(app.refmgr.deserialize(obj)); });
                    if(app.samePO(setctx.tpo, result[result.length - 1])) {
                        setctx.tpo = result[result.length - 1]; }
                    app.theme.connopt(); },
                function (code, errtxt) {
                    //show the error occurred. User will have to toggle 
                    //settings to try again, which is what should happen.
                    jt.out("assocbuttonsdiv", "Update failed " + code + ": " +
                           errtxt); },
                jt.semaphore("theme.relupd"));
    },


    inviteMemberLink: function () {
        var email = jt.byId("invemin").value;
        if(!jt.isProbablyEmail(email)) {
            return jt.out("invlinkspan", ""); }
        var subj = "Membership invitation for " + setctx.tpo.name;
        var body = "This is an invitation from $MYNAME to join $MYTHEME as a contributing member.  As a member, you will be able to post membics from your own account to $MYTHEME.  Click this link to get membership access:\n\n$ACCLINK"
        body = body.replace(/\$MYNAME/g, app.profile.myProfile().name);
        body = body.replace(/\$MYTHEME/g, setctx.tpo.name);
        var authobj = app.login.authenticated();
        body = body.replace(/\$ACCLINK/g, app.dr(
            "?cmd=membership&tid=" + setctx.tpo.dsId +
                "&fid=" + authobj.authId +  //Founder dsId
                "&mtok=" + subtoken(email, authobj.token)));
        jt.out("invlinkspan", jt.tac2html(
            ["a", {href:"mailto:" + email + "?subject=" + jt.dquotenc(subj) +
                   "&body=" + jt.dquotenc(body) + "%0A%0A",
                   title:"Invite New Member"},
             "Send Invitation"]));
    },


    //Called while displaying the appropriate theme and after the new
    //member's profile has been loaded.
    addMember: function (extraobj) {
        var authobj = app.login.authenticated();
        var dispctx = app.pcd.getDisplayContext();
        var theme = dispctx.actobj.contextobj;
        var data = jt.objdata(
            {an:authobj.email, at:authobj.token, aot:"Theme", aoi:theme.dsId,
             pid:authobj.authId, assoc:"Member", fm:"email", 
             fid:extraobj.fid, mtok:extraobj.mtok});
        jt.call("POST", app.dr("/api/associate"), data,
                function (result) {  //prof, followed by theme if updated
                    result.forEach(function (obj) {
                        app.refmgr.put(app.refmgr.deserialize(obj)); });
                    app.theme.connopt("show"); },
                function (code, errtxt) {
                    jt.err("Membership failed " + code + ": " + errtxt); },
                jt.semaphore("theme.addMember"));
    }
            
}; //end of returned functions
}());
