/*jslint browser, white, fudge, this, for */
/*global app, jt */

app.themes = (function () {
    "use strict";

    var mdefhtml = "";
    var tps = null;


    function initVars () {
        var defdiv = jt.byId("membicdefinitiondiv");
        if(!mdefhtml && defdiv) {
            mdefhtml = defdiv.innerHTML; }
        tps = null;  //reset local cached array each time to use latest
        var atr = app.lcs.getRef("activetps", "411");
        if(atr.activetps) {  //have cached recent
            //jt.log("using cached activetps");
            tps = atr.activetps.jtps; }
        else {  //no recent, go get it
            //jt.log("fetching activetps");
            jt.call("GET", "/recentactive" + jt.ts("?cb=", "minute"), null,
                    function (racs) {
                        app.lcs.put("activetps", racs[0]);
                        app.themes.display(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Fetching recent active failed " + code + ": " +
                               errtxt); }),
                    jt.semaphore("themes.initVars"));
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
                if(prof.coops[d.instid]) {
                    d.lev = prof.coops[d.instid].lev; }
                decos.push(d); }); }
        decos.sort(function (a, b) {
            if(a.lev && !b.lev) { return -1; }  //lev val beats missing
            if(!a.lev && b.lev) { return 1; }
            if(a.lev && b.lev && a.lev !== b.lev) { return b.lev - a.lev; }
            if(a.modified < b.modified) { return -1; }
            if(a.modified > b.modified) { return 1; }
            return 0; });
        return decos;
    }


    function imgForAssocLev (tp) {
        var img = "blank.png";
        var prof = app.profile.myProfile();
        if(prof && prof.coops) {
            img = "tsnoassoc.png";
            if(prof.coops[tp.instid]) {
                switch(prof.coops[tp.instid].lev) {
                case -1: img = "tsfollowing.png"; break;
                case 1: img = "tsmember.png"; break;
                case 2: img = "tsmoderator.png"; break;
                case 3: img = "tsfounder.png"; break; } } }
        img = "img/" + img;
        return img;
    }


    function writeContent () {
        var html = [];
        decorateAndSort().forEach(function (tp) {
            var imgsrc = "img/blank.png";
            if(tp.pic) {
                if(tp.obtype === "theme") {
                    imgsrc = "ctmpic?coopid=" + tp.instid; }
                else if(tp.obtype === "profile") {
                    imgsrc = "profpic?profileid=" + tp.instid; } }
            var ocparams = "'" + tp.obtype + "','" + tp.instid + "'";
            var oc = jt.fs("app.themes.show(" + ocparams + ")");
            var mc = jt.fs("app.themes.show(" + ocparams + ",'Settings')");
            var link = "/" + tp.hashtag;
            html.push(["div", {cla:"tplinkdiv", id:"tplinkdiv" + tp.instid},
                       [["div", {cla:"tplinkpicdiv"},
                         [["a", {href:link, onclick:oc},
                           ["img", {src:imgsrc, cla:"tplinkpicimg"}]],
                          ["a", {href:link, onclick:mc, cla:"tpmemlink"},
                           ["img", {src:imgForAssocLev(tp), 
                                    cla:"tplinkmemimg"}]]]],
                        ["div", {cla:"tplinkdescdiv"},
                         [["span", {cla:"tplinknamespan"},
                           ["a", {href:link, onclick:oc}, tp.name]],
                          jt.ellipsis(tp.description, 255)]]]]); });
        jt.out("contentdiv", jt.tac2html(html) + mdefhtml);
    }


    function displayMainContent () {
        if(initVars()) {  //have data to work with
            app.history.checkpoint({view:"themes"});
            writeContent(); }
    }


    function showListing (obtype, instid, command) {
        if(obtype === "profile") {
            return app.profile.byprofid(instid, command); }
        return app.coop.bycoopid(instid, "themes", command);
    }


    return {
        display: function display () { displayMainContent(); },
        show: function show (ty, id, cmd) { showListing(ty, id, cmd); }
    };
}());

