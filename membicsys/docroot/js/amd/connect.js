/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.connect = (function () {
    "use strict";

    var mdefhtml = "";
    var tps = null;  //theme/prof summaries array, start.py json_for_theme_prof
    var atfs = "";  //activetps fetch time stamp


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
        tps = null;  //reset local cached array each time to use latest
        atfs = "";
        jt.out("contentdiv", "Fetching Themes and Profiles");
        var atr = app.refmgr.cached("activetps", "411");
        if(atr) {  //have cached recent
            //jt.log("using cached activetps");
            atfs = atr.modified.replace(/[\-:]/g,"");  //friendlier
            tps = mergePersonalThemesForAccess(atr.jtps); }
        else {  //no recent, go get it
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


    function decorateAndSort () {
        var decos = tps;
        var prof = app.profile.myProfile();
        if(prof && prof.coops) {
            decos = [];
            tps.forEach(function (tp) {
                var d = JSON.parse(JSON.stringify(tp));
                if(prof.coops[d.dsId]) {
                    d.lev = prof.coops[d.dsId].lev; }
                decos.push(d); }); }
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
        if(prof && prof.coops) {
            img = "tsnoassoc.png";
            if(prof.coops[tp.dsId]) {
                switch(prof.coops[tp.dsId].lev) {
                case -1: img = "tsfollowing.png"; break;
                case 1: img = "tsmember.png"; break;
                case 2: img = "tsmoderator.png"; break;
                case 3: img = "tsfounder.png"; break; } } }
        img = app.dr("img/" + img);
        return img;
    }


    function imageSourceForListing (tp) {
        var imgsrc = app.dr("img/blank.png");
        if(tp.pic) {
            var otm = {theme:"Theme", profile:"MUser"};
            imgsrc = "/api/obimg?dt=" + otm[tp.obtype] + "&di=" + tp.dsId;
            var mod = tp.modified;
            if(atfs > mod) {
                mod = atfs; }
            imgsrc += "&cb=" + mod; }
        return imgsrc;
    }


    function searchMatch (item, fist) {
        if(!fist.matchCriteriaSpecified || item.dsType === "MembicDefinition") {
            return true; }
        //item structure from start.py json_for_theme_prof
        var fields = ["dsId", "obtype", "modified", "lastwrite", "hashtag",
                      "name", "description"];
        return fields.some((field) => item[field].indexOf(fist.qstr) >= 0);
    }


    function itemHTML (item) {
        if(item.dsType === "MembicDefinition") {
            return mdefhtml; }
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
        if(initVars()) {  //have data to work with
            var themes = decorateAndSort();
            themes.push({dsType:"MembicDefinition"});
            app.statemgr.setState("activetps", "411");
            app.pcd.setPageActions({itlist:themes,
                                    itmatchf:searchMatch,
                                    itdispf:itemHTML}); }
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

