/*global app, jt, confirm, window */

/*jslint browser, white, fudge, long */

app.theme = (function () {
    "use strict";

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
        var authobj = app.login.authenticated();
        if(!authobj) {  //can't figure out any association if no user
            return ""; }
        var uid = authobj.authId;
        if(tpo.dsType === "Theme") {  //use authoritative lists if given
            if(tpo.founders.csvcontains(uid)) { return "Founder"; }
            if(tpo.moderators.csvcontains(uid)) { return "Moderator"; }
            if(tpo.members.csvcontains(uid)) { return "Member"; } }
        //Either tpo is not a theme, or they are no longer listed as a
        //member. Treat as a profile lookup in either case.
        switch(profassoc(tpo.dsType, tpo.dsId).lev) {
        case 3: return "Founder";
        case 2: return "Moderator";
        case 1: return "Member";
        case -1: return "Following";
        default: return "Unknown"; }
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
        var html = [];
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
            link.src = "blank.png"; }
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

    association: function (pto) { return association(pto); },


    //Called from settings, which are enabled only if profile is available.
    memberset: function (tpobj, mendiv, detdiv) {
        setctx = {tpo:tpobj, assoc:association(tpobj),
                  mendivid:mendiv, divid:detdiv,
                  ao:profassoc(tpobj.dsType, tpobj.dsId), fm:"email"};
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
        case "Unknown": html = followSettingsHTML(); break; }
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
        var body = "This is an invitation from $MYNAME to join $MYTHEME as a contributing member.  As a member, you will be able to post membics from your own account to $MYTHEME.  Click this link to get membership access:\n\n$ACCLINK";
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
    },


    update: function (obj, succf, failf) {
        if(!obj) {
            jt.log("theme.update called without update object");
            if(failf) {
                return failf(400, "No theme object to update"); }
            return; }  //nothing to do
        obj.dsType = "Theme";  //verify set in case creating new
        var url = app.login.authURL("/api/themeupd");
        jt.call("POST", url, app.refmgr.postdata(obj),
                function (objs) {
                    app.refmgr.put(app.refmgr.deserialize(objs[0]));
                    app.refmgr.uncache("activetps", "411");
                    if(succf) {
                        succf(objs[0]); } },
                function (code, errtxt) {
                    jt.log("app.theme.update " + code + " " + errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("theme.update"));
    },


    settingsUpdate: function () {
        var theme = app.pcd.getDisplayContext().actobj.contextobj;
        var tu = {dsType:"Theme", dsId:theme.dsId};
        app.pcd.readCommonSettingsFields(tu, theme);  //hashtag, colors
        tu.keywords = jt.byId("kwrdsin").value.trim() || "UNSET_VALUE";
        app.theme.update(tu,
            function (theme) { //updated theme already cached
                jt.out("settingsinfdiv", "Updated " + theme.name + ".");
                app.fork({descr:"Close theme settings display", ms:800,
                          func:app.statemgr.redispatch}); },
            function (code, errtxt) {
                jt.byId("settingsupdbutton").disabled = false;
                jt.out("settingsinfdiv", "Update failed code " + code + " " +
                        errtxt); });
    }
            
}; //end of returned functions
}());
