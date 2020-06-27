/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.connect = (function () {
    "use strict";

    var mdefhtml = "";


    //The last element in the static server content is a definition of
    //"Membic (noun): A link with a reason why it is memorable".  That's
    //good descriptive info, and it makes a good footer indicating the end
    //of content.  With a dynamic display, it can be annoying to have the
    //definition show up by itself as if it is the only thing matching a
    //search string, so it is not being used right now.  Leaving the method
    //here in case there is a need for it.
    function keepMembicDef () {
        var defdiv = jt.byId("membicdefinitiondiv");
        if(!mdefhtml && defdiv) {
            mdefhtml = defdiv.innerHTML; }
    }


    function initVars () {
        jt.out("contentdiv", "Fetching Themes and Profiles");
        var atr = app.refmgr.cached("activetps", "411");
        if(!atr) {  //no recent, go get it
            //jt.log("fetching activetps");
            var url = app.dr("/api/recentactive") + jt.ts("?cb=", "minute");
            jt.call("GET", url, null,
                    function (racs) {
                        jt.log("activetps cached from api/recentactive");
                        app.refmgr.put(racs[0]);
                        app.connect.display(); },  //calls back into initVars
                    app.failf(function (code, errtxt) {
                        jt.err("Fetching recent active failed " + code + ": " +
                               errtxt); }),
                    jt.semaphore("connect.initVars"));
            return false; }
        return true;
    }


    function verifyUserSummaryItem (user, key, allobjs) {
        var obinf = {obtype:"theme", dsType:"Theme", dsId:key};
        if(key.startsWith("P")) {
            obinf = {obtype:"profile", dsType:"MUser", dsId:key.slice(1)}; }
        var uinf = user.themes[key];
        var si = allobjs[obinf.obtype + obinf.dsId];
        if(!si) {  //build a summary item object from user info
            si = {dsId:obinf.dsId,
                  dsType:obinf.dsType,
                  obtype:obinf.obtype,
                  modified:user.modified,
                  lastwrite:user.lastWrite,
                  hashtag:uinf.hashtag || "",
                  pic:uinf.pic,
                  name:uinf.name,
                  description:""};  //no description in user info
            if(obinf.obtype === "theme") {
                si.founders = "";
                si.moderators = "";
                si.members = "";
                switch(uinf.lev) {
                case 3: si.founders = user.dsId; break;
                case 2: si.moderators = user.dsId; break;
                case 1: si.members = user.dsId; break; } }
            var cached = app.refmgr.cached(obinf.dsType, obinf.dsId);
            if(cached) {  //override the guessed values with cached values
                var copyfields = ["picture", "modified", "lastwrite", 
                                  "hashtag", "name", "description"];
                if(obinf.dsType === "MUser") {
                    copyfields[0] = "profpic"; }
                copyfields.forEach(function (fld) {
                    si[fld] = cached[fld]; }); }
            allobjs[obinf.obtype + obinf.dsId] = si; }
        si.sprio = 0;  //In case still in uinf and no longer associated
        if(uinf.lev) { //-1 (following) or positive value
            si.sprio = 1;  //convert lev -1 (following) to sort priority 1
            switch(uinf.lev) {  //bump other lev values up to match
            case 1: si.sprio = 2; break;
            case 2: si.sprio = 3; break;
            case 3: si.sprio = 4; break; } }
    }


    //The user's own profile is only included in allobjs if they are in good
    //standing and have written something recently.  Always use the info
    //from their own profile to ensure the display is up to date.
    //Prioritize their profile summary item higher than zero but lower than
    //everything else.
    function verifyPersonalProfileSummaryItem (user, allobjs) {
        allobjs["profile" + user.dsId] = {
            obtype:"profile", dsType:"MUser", dsId:user.dsId,
            modified:user.modified, lastwrite:user.lastWrite,
            name:user.name || "New User " + user.dsId,
            description:user.aboutme || "No description provided",
            hashtag:user.hashtag || "", pic:user.profpic,
            sprio:0.5};
    }


    //The connect display is the primary path for seeing and accessing your
    //themes, so they all have to be displayed first, even if they didn't
    //make the main public list.  A founder should be able to mark the theme
    //archived, at which point it would not be displayed unless they
    //switched "show archived" in the settings.  Your themes are listed
    //before your profile, because your profile can be directly accessed
    //from the top button.  Your own profile goes after all the themes and
    //other profiles you are associated with, serving as a delimiter.
    function decorateAndSort () {
        var tps = app.refmgr.cached("activetps", "411").jtps;
        var decos = tps;
        var user = app.login.myProfile();
        if(user && user.themes) {  //include personal stuff.  See note.
            decos = [];
            var allobjs = {};
            tps.forEach(function (tp) {  //copy in all listed themes/profiles
                if(tp.dsType !== "MembicDefinition") {
                    tp.sprio = 0;
                    allobjs[tp.obtype + tp.dsId] = tp; } });
            //verify everything the user knows about is included and prioritized
            Object.keys(user.themes).forEach(function (key) {
                verifyUserSummaryItem(user, key, allobjs); });
            //verify the user's own profile is included and prioritized
            verifyPersonalProfileSummaryItem(user, allobjs);
            Object.keys(allobjs).forEach(function (key) {  //convert to array
                decos.push(allobjs[key]); }); }
        decos.sort(function (a, b) {
            if(a.sprio !== b.sprio) {
                return b.sprio - a.sprio; }
            if(a.lastwrite < b.lastwrite) { return 1; }
            if(a.lastwrite > b.lastwrite) { return -1; }
            return 0; });
        return decos;
    }


    function imgForAssocLev (tp) {
        var img = "blank.png";
        switch(app.theme.association(tp)) {
        case "Founder": img = "tsfounder.png"; break;
        case "Moderator": img ="tsmoderator.png"; break;
        case "Member": img = "tsmember.png"; break;
        case "Following": img = "tsfollowing.png"; break; }
        var prof = app.login.myProfile();
        if(prof && prof.dsId === tp.dsId && tp.obtype === "profile") {
            img = "tsfounder.png"; }
        img = app.dr("img/" + img);
        return img;
    }


    function imageSourceForListing (tp) {
        var imgsrc = app.dr("img/blank.png");
        var activitymod = app.refmgr.cached("activetps", "411").modified;
        if(tp.pic) {
            var otm = {theme:"Theme", profile:"MUser"};
            imgsrc = "/api/obimg?dt=" + otm[tp.obtype] + "&di=" + tp.dsId;
            var mod = tp.modified;
            if(activitymod > mod) {   //use most recent known timestamp to
                mod = activitymod; }  //avoid churn or stale
            imgsrc += "&cb=" + mod; }
        return imgsrc;
    }


    function searchMatch (item, fist) {
        if(!fist.qstr || item.dsType === "MembicDefinition") {
            return true; }
        //item structure from start.py json_for_theme_prof
        var fields = ["dsId", "obtype", "modified", "lastwrite", "hashtag",
                      "name", "description"];
        return fields.some((field) => item[field].indexOf(fist.qstr) >= 0);
    }


    function itemHTML (item) {
        if(item.dsType === "MembicDefinition") {
            return mdefhtml; }
        item.dsType = item.dsType || app.pcd.fetchType(item.obtype);
        app.statemgr.notehash(item);
        var ocparams = "'" + item.obtype + "','" + item.dsId + "'";
        var ocfs = jt.fs("app.connect.show(" + ocparams + ")");
        var sfs = jt.fs("app.connect.show(" + ocparams + ",'Settings')");
        var link = app.pcd.linkForThemeOrProfile(item);
        return jt.tac2html(
            ["div", {cla:"tplinkdiv"},
             [["div", {cla:"tplinkpicdiv"},
               [["a", {href:link, onclick:ocfs},
                 ["img", {src:imageSourceForListing(item),
                          cla:"tplinkpicimg"}]],
                ["a", {href:link, onclick:sfs, cla:"tpmemlink"},
                 ["img", {src:imgForAssocLev(item),
                          cla:"tplinkmemimg"}]]]],
              ["div", {cla:"tplinkdescdiv"},
               [["span", {cla:"tplinknamespan"},
                 ["a", {href:link, onclick:ocfs}, item.name]],
                " ",  //avoids awkward lack of sensible word wrap line breaks
                jt.linkify(item.description)]]]]);
    }


    function membicDescripHTML () {
        var displinks = [];
        return jt.tac2html(
            ["A better way to share memorable links.",
             ["div", {id:"membicdescrlinksdiv"},
              displinks]]);
    }


    function displayMainContent () {
        jt.log("connect.displayMainContent starting");
        app.pcd.setPageDescription(
            {picsrc:app.dr("img/membiclogo.png"),
             disptype:"app",
             exturl:"/",
             name:"Membic",
             descr: membicDescripHTML()});
        var sf = "";
        var authobj = app.login.authenticated();
        if(authobj) {
            sf = "app.pcd.settings()"; }
        if(initVars()) {  //have data to work with
            var themes = decorateAndSort();
            themes.push({dsType:"MembicDefinition"});
            app.statemgr.setState("activetps", "411");
            app.pcd.setPageActions({itlist:themes,
                                    itmatchf:searchMatch,
                                    itdispf:itemHTML,
                                    setfstr:sf}); }
    }


    function showListing (obtype, dsId, cmd) {
        app.statemgr.setState(obtype, dsId, {command:cmd});
    }


    return {
        display: function display () { displayMainContent(); },
        show: function show (ty, id, cmd) { showListing(ty, id, cmd); },
        //not currently used, but keep for now.  See function comment.
        keepdef: function keepdef () { keepMembicDef(); }
    };
}());

