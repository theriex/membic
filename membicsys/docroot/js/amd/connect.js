/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.connect = (function () {
    "use strict";

    var mdefhtml = "";


    function keepMembicDef () {
        var defdiv = jt.byId("membicdefinitiondiv");
        if(!mdefhtml && defdiv) {
            mdefhtml = defdiv.innerHTML; }
    }


    function inSummary (ctmid, summaries) {
        return summaries.find(function (tpsum) {
            return tpsum.dsId === ctmid; });
    }


    function mergePersonalThemesForAccess (summaries) {
        var prof = app.profile.myProfile();
        if(!prof) {
            return summaries; }
        Object.keys(prof.coops).forEach(function (ctmid) {
            var pc = prof.coops[ctmid];
            if(pc.dsType === "Theme" && pc.lev >= 1 &&
               !inSummary(ctmid, summaries)) {
                var pcsum = {dsId:ctmid, obtype:"theme", modified:"",
                             lastwrite:"", hashtag:pc.hashtag,
                             picture:pc.picture, name:pc.name, 
                             description:pc.description};
                switch(pc.lev) {
                case 1: pcsum.members = prof.dsId; break;
                case 2: pcsum.moderators = prof.dsId; break;
                case 3: pcsum.founders = prof.dsId; break; }
                summaries.push(pcsum); } });
        return summaries;
    }


    function initVars () {
        jt.out("contentdiv", "Fetching Themes and Profiles");
        var atr = app.refmgr.cached("activetps", "411");
        if(!atr) {  //no recent, go get it
            //jt.log("fetching activetps");
            jt.call("GET", "/api/recentactive" + jt.ts("?cb=", "minute"), null,
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


    //Return a display summary item built from the user theme association.
    function themeSummaryItem (tid, uto, tso) {
        var user = app.profile.myProfile();  //defintely available, have assocs
        if(!tso) {
            tso = app.refmgr.cached("Theme", tid);
            if(!tso) {
                tso = {description:"",
                       founders:"",
                       moderators:"",
                       members:"",
                       rejects:"",
                       seeking:"",
                       lastwrite:user.lastWrite,
                       modified:user.modified};
                switch(uto.lev) {
                    case 3: tso.founders = user.dsId; break;
                    case 2: tso.moderators = user.dsId; break;
                    case 1: tso.members = user.dsId; break; } } }
        return {description:tso.description,
                dsId:tid,
                hashtag:uto.hashtag,
                founders:tso.founders,
                moderators:tso.moderators,
                members:tso.members,
                rejects:tso.rejects,
                seeking:tso.seeking,
                lastwrite:tso.lastwrite,
                modified:tso.modified,
                name:tso.name || uto.name,
                obtype:"theme",
                pic:tso.pic || uto.picture,
                lev:uto.lev};
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
        var user = app.profile.myProfile();
        if(user && user.themes) {  //include personal stuff.  See note.
            decos = [];
            var allobjs = {};
            tps.forEach(function (tp) {  //copy in all public listings
                if(tp.dsType !== "MembicDefinition") {
                    if(user.themes[tp.dsId]) {
                        tp.lev = user.themes[tp.dsId].lev; }
                    allobjs[tp.obtype + tp.dsId] = tp; } });
            Object.keys(user.themes).forEach(function (key) {  //verify user's
                var ident = "theme" + key;
                allobjs[ident] = themeSummaryItem(key, user.themes[key],
                                                  allobjs[ident]); });
            allobjs["profile" + user.dsId].lev = 0.5;  //last before general
            Object.keys(allobjs).forEach(function (key) {  //convert to array
                decos.push(allobjs[key]); }); }
        decos.sort(function (a, b) {
            if(a.lev && !b.lev) { return -1; }  //lev val beats missing
            if(!a.lev && b.lev) { return 1; }
            if(a.lev && b.lev && a.lev !== b.lev) { return b.lev - a.lev; }
            if(a.lastwrite < b.lastwrite) { return 1; }
            if(a.lastwrite > b.lastwrite) { return -1; }
            return 0; });
        return decos;
    }


    function imgForAssocLev (tp) {
        var img = "blank.png";
        var prof = app.profile.myProfile();
        if(prof) {
            if(prof.themes && prof.themes[tp.dsId]) {
                switch(prof.themes[tp.dsId].lev) {
                case -1: img = "tsfollowing.png"; break;
                case 1: img = "tsmember.png"; break;
                case 2: img = "tsmoderator.png"; break;
                case 3: img = "tsfounder.png"; break; } }
            else if(tp.obtype === "profile" && prof.dsId === tp.dsId) {
                img = "tsfounder.png"; } }
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


    function displayMainContent () {
        jt.log("connect.displayMainContent starting");
        app.pcd.setPageDescription({picsrc:app.dr("img/membiclogo.png"),
                                    disptype:"app",
                                    exturl:"/",
                                    name:"Membic",
                                    descr:"Blog your memorable links"});
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
        keepdef: function keepdef () { keepMembicDef(); }
    };
}());

