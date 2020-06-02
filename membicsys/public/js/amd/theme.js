/*global app, jt, confirm, window */

/*jslint browser, white, fudge, long */

app.theme = (function () {
    "use strict";

    //context for settings dialog and processing.  Set at start of display.
    var setctx = null;


    function nameForLevel (lev) {
        switch(lev) {
        case 3: return "Founder";
        case 2: return "Moderator";
        case 1: return "Member";
        case -1: return "Following";
        default: return "Unknown"; }
    }


    function levelForAssociationName (name) {
        switch(name) {
        case "Founder": return 3;
        case "Moderator": return 2;
        case "Member": return 1;
        case "Following": return -1;
        default: return 0; }
    }


    function profassoc (dsType, dsId) {
        var prof = app.login.myProfile() || {};
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
        return nameForLevel(profassoc(tpo.dsType, tpo.dsId).lev);
    }


    function followRSSLinkHTML () {
        if(setctx.fm !== "RSS") {
            return ""; }
        var authobj = app.login.authenticated();  //in settings, so auth avail
        var rssurl = "/feed" + app.statemgr.urlForInstance(setctx.tpo) +
            "?uid=" + authobj.authId;
        return jt.tac2html(
            ["Use your personalized web feed",
             ["br"],
             ["a", {href:rssurl,
                    onclick:jt.fs("window.open('" + rssurl + "')")},
              rssurl],
             ["br"],
             "to respond directly to posts"]);
    }


    function emailOrRSSFollowHTML () {
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
              ["label", {fo:"fmrssin", title:"Follow new membics via web feed"},
              "Web Feed"],
              ["div", {id:"folrssdiv"}, followRSSLinkHTML()]]]);
    }


    function assocActionButtonHTML () {
        var rxv = {btxt:"Archive",
                   fstr:jt.fs("app.theme.archive(true,'Archiving a theme prevents any new membic posts. Are you sure you want to archive " + jt.escq(setctx.tpo.name) + "?')")};
        if(setctx.tpo.cliset && setctx.tpo.cliset.flags && 
           setctx.tpo.cliset.flags.archived) {
            rxv = {btxt:"Re-Activate",
                   fstr:jt.fs("app.theme.archive(false,'Re-Activating " + jt.escq(setctx.tpo.name) + " will allow new membic posts from all members. Re-Activate?')")}; }
        var aas = {Founder:rxv,
                   Moderator:{
                       btxt:"Resign",
                       fstr:jt.fs("app.theme.relupd('Member','','If you resign as a moderator, you will still be able to post membics, but you will no longer be able to remove membics posted by others to " + jt.escq(setctx.tpo.name) + ". Are you sure you want to resign as a moderator?')")},
                   Member:{
                       btxt:"Resign",
                       fstr:jt.fs("app.theme.relupd('Following','','If you resign your membership, you will no longer be able to post membics to " + jt.escq(setctx.tpo.name) + ". Are you sure you want to resign?')")},
                   Following:{
                       btxt:"Stop&nbsp;Following",
                       fstr:jt.fs("app.theme.relupd('Unknown')")},
                   Unknown:{
                       btxt:"Follow",
                       fstr:jt.fs("app.theme.relupd('Following')")}};
        var aa = aas[setctx.assoc];
        return jt.tac2html(
            ["button", {type:"button", onclick:aa.fstr}, aa.btxt]);
    }


    function assocUpdateButtonHTML () {
        var html = "";
        if(!setctx.ao.followmech) {  //set the default value to track changes
            setctx.ao.followmech = "email"; }
        if(setctx.ao.followmech !== setctx.fm) {
            html = jt.tac2html(
                ["button", {type:"button",
                            onclick:jt.fs("app.theme.relupd('" + setctx.assoc +
                                          "')")},
                 "Update"]); }
        return html;
    }


    function updateSettingsMenuHeading () {
        var link = {text:setctx.assoc + " Settings",
                    title:"Actions for " + setctx.assoc + " ",
                    src:"ts" + setctx.assoc.toLowerCase() + ".png"};
        if(setctx.assoc === "Unknown") {
            link.text = "Follow " + jt.escq(setctx.tpo.name);
            link.title = link.text;
            link.src = "acbullet.png"; }
        else if(setctx.assoc === "Following") {
            link.text = "Following"; }  //"Settings" on the end gets confusing
        jt.out(setctx.mendivid, jt.tac2html(
            ["a", {href:"#relationship", title:link.title,
                   onclick:jt.fs("app.theme.connopt()")},
             [["img", {cla:"setassocimg", src:app.dr("img/" + link.src)}],
              ["span", {cla:"setassocspan"}, link.text]]]));
    }


    function blockHTML (f, idx) {
        var emb;
        if(f.blocked) {
            emb = ["img", {src:app.dr("img/emailgenprohib.png")}];
            if(app.theme.mayViewAudience() === "edit") {
                emb = ["a", {href:"#unblock" + f.uid, 
                             title:"allow email contact from " + f.name,
                             onclick:jt.fs("app.theme.blockFollower(" + idx +
                                           ",false)")}, emb]; } }
        else {
            emb = ["img", {src:app.dr("img/email.png")}];
            if(app.theme.mayViewAudience() === "edit") {
                emb = ["a", {href:"#block" + f.uid, 
                             title:"block email from " + f.name,
                             onclick:jt.fs("app.theme.blockFollower('" + idx +
                                           "',true)")}, emb]; } }
        return [emb, ["span", {id:"fblockstatspan" + idx}, ""]];
    }


    function displayAudience(co) {
        var levn = association(app.pcd.getDisplayContext().actobj.contextobj);
        var ams = [];
        co.followers.forEach(function (f, idx) {
            var assoc = nameForLevel(f.lev);
            if(levn === "Founder") {
                assoc = ["a", {href:"#association",
                               onclick:jt.fs("app.theme.chgassoc(" + idx + ")"),
                               title:"Change association for " + f.name},
                         assoc]; }
            var emb = blockHTML(f, idx);
            ams.push(["tr",
                      [["td",
                        ["a", {href:"#" + f.uid, 
                               title:"Show profile for " + f.name,
                               onclick:jt.fs("app.statemgr.setState('MUser','" +
                                             f.uid + "')")},
                         [["img", {cla:"followerimg",
                                   src:app.login.uidimgsrc(f.uid)}],
                          ["span", {cla:"followernamespan"}, f.name]]]],
                       ["td", 
                        ["span", {cla:"flevspan"},
                         assoc]],
                       ["td", {cla:"fmechtd"},
                        ["span", {cla:"fmechspan"}, f.mech]],
                       ["td", {cla:"fblocktd"},
                        ["span", {cla:"fblockspan",
                                  id:"fblockspan" + idx}, emb]]]]);
            ams.push(["tr",
                      ["td", {colspan:4},
                       ["div", {id:"audlevdiv" + idx, cla:"audlevdiv",
                                style:"display:none;"}]]]); });
        if(!ams.length) {
            jt.out("pcdaudcontdiv", "No followers seen yet."); }
        else {
            ams.splice(0, 0,
                       ["tr",
                        [["th", {colspan:2}, "Audience"],
                         ["th", ""],
                         ["th", ""]]]);
            jt.out("pcdaudcontdiv", jt.tac2html(
                ["table", {cla:"followerstable"}, ams])); }
    }


    function fetchAudienceInfo(dsType, dsId) {
        var authobj = app.login.authenticated();
        var url = app.dr("/api/audinf") + "?an=" + authobj.email + "&at=" +
            authobj.token + "&dsType=" + dsType + "&dsId=" + dsId +
            jt.ts("&cb=", "minute");  //use refmgr cache, not browser
        jt.call("GET", url, null,
                function (aios) {
                    app.refmgr.put(aios[0]);
                    displayAudience(aios[0]); },
                function(code, errtxt) {
                    jt.out("pcdaudcontdiv", "Audience fetch failed " + code +
                           ": " + errtxt); },
                jt.semaphore("theme.fetchAudienceInfo"));
    }


    function audObjType (dsType) {
        return dsType.toLowerCase() + "audience";
    }


    function fetchAndDisplayAudience (dsType, dsId) {
        var atn = audObjType(dsType);
        var co = app.refmgr.cached(atn, dsId);
        if(!co) {
            jt.out("pcdaudcontdiv", "Fetching audience details...");
            return app.fork({descr:"fetch " + atn + dsId, ms:50,
                             func:function () {
                                 fetchAudienceInfo(dsType, dsId); }}); }
        displayAudience(co);
    }


    function audLevelAdjustHTML (idx) {
        var obj = app.pcd.getDisplayContext().actobj.contextobj;
        var aud = app.refmgr.cached(audObjType(obj.dsType), obj.dsId);
        var follower = aud.followers[idx];
        var aas = {Founder:[],
                   Moderator:[
                       {btxt:"Demote to Member",
                        fstr:jt.fs("app.theme.levupd(" + idx + ",'Member','After removing " + jt.escq(follower.name) + " as a moderator, they will no longer be able to remove membics from other members. Demote?')")}],
                   Member:[
                       {btxt:"Promote to Moderator",
                        fstr:jt.fs("app.theme.levupd(" + idx + ",'Moderator','As a moderator, " + jt.escq(follower.name) + " can continue to post but will also be able to remove membics from other members. You should trust their judgement. Promote to moderator?')")},
                       {btxt:"Cancel Membership",
                        fstr:jt.fs("app.theme.levupd(" + idx + ",'Following','After removing membership, " + jt.escq(follower.name) + " will no longer be able to post membics to " + jt.escq(obj.name) + ", though they may still modify or remove any membics they have previously posted. Are you sure you want to cancel their membership?')")}],
                   Following:[
                       {btxt:"Grant Membership",
                        fstr:jt.fs("app.theme.levupd(" + idx + ",'Member','As a member, " + jt.escq(follower.name) + " will be able to post membics to " + jt.escq(obj.name) + ". Grant membership?')")}],
                   Unknown:[]};
        var html =[];
        aas[nameForLevel(follower.lev)].forEach(function (button) {
            if(html.length) {
                html.push("&nbsp;"); }
            html.push(["button", {type:"button", onclick:button.fstr},
                       button.btxt]); });
        return jt.tac2html(html);
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
        div.style.display = "block";
        div.innerHTML = jt.tac2html(
            ["div", {id:"memberactcontdiv"},
             [[emailOrRSSFollowHTML(),
               ["div", {id:"assocbuttonsdiv"},
                [assocActionButtonHTML(),
                 ["span", {id:"assocActButtonSpan"},
                  assocUpdateButtonHTML()]]]]]]);
    },


    //Update and save the account only if an association is specified.  All
    //associations are authorized and maintained server side.  If the follow
    //mechanism is specified, update it in the context.
    relupd: function (assoc, fmech, cfrm) {
        if(assoc) {    //update association if provided, otherwise use same
            setctx.assoc = assoc; }
        if(fmech) {    //update follow mechanism if provided, otherwise use same
            setctx.fm = fmech; }
        jt.out("folrssdiv", followRSSLinkHTML());
        jt.out("assocActButtonSpan", assocUpdateButtonHTML());
        if(!assoc) {   //only call server if association was specified
            return; }  //otherwise interim UI update
        if(cfrm && !confirm(cfrm)) {
            return; }
        jt.out("assocbuttonsdiv", "Updating...");
        var authobj = app.login.authenticated();
        var data = jt.objdata(
            {an:authobj.email, at:authobj.token,          //auth user ident
             aot:setctx.tpo.dsType, aoi:setctx.tpo.dsId,  //association obj
             pid:app.login.myProfile().dsId,              //association prof
             assoc:setctx.assoc, fm:setctx.fm});          //assoc and mech
        jt.call("POST", app.dr("/api/associate"), data,
                function (result) {  //prof, followed by theme if also updated
                    result.forEach(function (obj) {
                        obj = app.refmgr.put(app.refmgr.deserialize(obj));
                        if(app.samePO(setctx.tpo, obj)) {
                            setctx.tpo = obj; } });
                    setctx.ao = profassoc(setctx.tpo.dsType, setctx.tpo.dsId);
                    app.theme.connopt(); },
                function (code, errtxt) {
                    //show the error occurred. User will have to toggle 
                    //settings to try again, which is what should happen.
                    jt.out("assocbuttonsdiv", "Update failed " + code + ": " +
                           errtxt); },
                jt.semaphore("theme.relupd"));
    },


    //Update membership from the audience view.
    levupd: function (idx, association, cfrm) {
        if(!confirm(cfrm)) {
            return; }
        var authobj = app.login.authenticated();
        var theme = app.pcd.getDisplayContext().actobj.contextobj;
        var aud = app.refmgr.cached(audObjType(theme.dsType), theme.dsId);
        var amb = aud.followers[idx];
        jt.out("audlevdiv" + idx, "Updating " + theme.name + "...");
        var data = jt.objdata(
            {an:authobj.email, at:authobj.token, aot:"Theme", aoi:theme.dsId,
             pid:amb.uid, assoc:association, fm:amb.mech});
        jt.call("POST", app.dr("api/associate"), data,
                function (result) { //just the updated Theme.
                    app.refmgr.put(app.refmgr.deserialize(result[0]));
                    //Audience entry updated on server.  Update local record.
                    amb.lev = levelForAssociationName(association);
                    displayAudience(aud); },
                function (code, errtxt) {
                    jt.out("audlevdiv" + idx, "Update failed " + code + ": " +
                           errtxt); },
                jt.semaphore("theme.levupd"));
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
                    objs.forEach(function (obj) {
                        app.refmgr.put(app.refmgr.deserialize(obj)); });
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
    },


    mayViewAudience: function () {
        var authobj = app.login.authenticated();
        if(!authobj) {
            return false; }  //not logged in
        var ctx = app.pcd.getDisplayContext();
        if(!ctx || !ctx.actobj || !ctx.actobj.contextobj) {
            return false; }  //no context object
        ctx = ctx.actobj.contextobj;
        if(ctx.dsType === "MUser" && ctx.dsId === authobj.authId) {
            return "edit"; }  //may see audience for own profile
        if(ctx.dsType === "Theme") {
            var assoc = association(ctx);
            if(assoc === "Founder") {
                return "edit"; }
            if(assoc === "Moderator" || assoc === "Member") {
                return "view"; } }
        return false;
    },


    audience: function () {
        var div = jt.byId("pcdaudcontdiv");
        if(!div.innerHTML) {
            div.style.display = "none";  //toggled on in next step
            var obj = app.pcd.getDisplayContext().actobj.contextobj;
            fetchAndDisplayAudience(obj.dsType, obj.dsId); }
        if(div.style.display === "none") {
            div.style.display = "block"; }
        else {
            div.style.display = "none"; }
    },


    chgassoc: function (idx) {
        var div = jt.byId("audlevdiv" + idx);
        if(div.style.display === "none") {
            div.style.display = "block";
            div.innerHTML = audLevelAdjustHTML(idx); }
        else {
            div.style.display = "none"; }
    },


    blockFollower: function (idx, block, confirmed) {
        var obj = app.pcd.getDisplayContext().actobj.contextobj;
        var aud = app.refmgr.cached(audObjType(obj.dsType), obj.dsId);
        var f = aud.followers[idx];
        if(block) {
            f.blocked = "blocked"; } //authId|timestamp filled out on save
        else {
            f.blocked = ""; }
        var savebutton = jt.byId("fblockstatspan" + idx).innerHTML;
        jt.out("fblockspan" + idx, jt.tac2html(blockHTML(f, idx)));
        if(!confirmed) {
            if(savebutton) {
                jt.out("fblockstatspan" + idx, ""); }  //cancel save
            else {
                jt.out("fblockstatspan" + idx, jt.tac2html(
                    ["button", {type:"button",
                                onclick:jt.fs("app.theme.blockFollower(" + idx +
                                              "," + block + ",true)")},
                     "Save"])); } }
        else { //confirmed
            jt.out("fblockstatspan" + idx, "Saving...");
            var authobj = app.login.authenticated();
            var data = jt.objdata({an:authobj.email, at:authobj.token,
                                   srctype:obj.dsType, srcid:obj.dsId,
                                   uid:f.uid, blocked:f.blocked});
            jt.call("POST", app.dr("/api/audblock"), data,
                    function (fos) {
                        f.blocked = fos[0].blocked;
                        jt.out("fblockstatspan" + idx, ""); },
                    function (code, errtxt) {
                        jt.log("blockFollower " + code + " " + errtxt);
                        jt.out("fblockstatspan" + idx, "Failed.");
                        app.refmgr.uncache(audObjType(obj.dsType),
                                           obj.dsId); },
                    jt.semaphore("theme.blockFollower")); }
    },


    archive: function (setflag, confmsg) {
        if(!confirm(confmsg)) {
            return; }
        jt.out("assocbuttonsdiv", "Updating...");
        setctx.tpo.cliset = setctx.tpo.cliset || {};
        setctx.tpo.cliset.flags = setctx.tpo.cliset.flags || {};
        if(setflag) {
            setctx.tpo.cliset.flags.archived = new Date().toISOString(); }
        else {
            setctx.tpo.cliset.flags.archived = ""; }
        app.theme.update(setctx.tpo,
                         function (theme) {
                             setctx.tpo = theme;
                             //redraw settings to hide/display webfeed
                             app.pcd.settings("show"); },
                         function (code, errtxt) {  //same handling as relupd
                             jt.out("assocbuttonsdiv", "Update failed " + code +
                                    ": " + errtxt); });
    },


    nameForLevel: function (lev) { return nameForLevel(lev); }
            
}; //end of returned functions
}());
