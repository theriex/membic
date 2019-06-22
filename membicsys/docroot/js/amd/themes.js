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
                        app.lcs.put("activetps", racs[0])
                        app.themes.display(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Fetching recent active failed " + code + ": " +
                               errtxt)}),
                    jt.semaphore("themes.initVars"));
            return false; }
        return true;
    }


    function decorateAndSort () {
        //if logged in, tag with "M" for member etc.
        jt.log("themes.decorateAndSort not implemented yet");
    }


    function writeContent () {
        var html = [];
        decorateAndSort();
        tps.forEach(function (tp) {
            var imgsrc = "img/blank.png";
            if(tp.pic) {
                if(tp.obtype === "theme") {
                    imgsrc = "ctmpic?coopid=" + tp.instid; }
                else if(tp.obtype === "profile") {
                    imgsrc = "profpic?profileid=" + tp.instid; } }
            var oc = jt.fs("app.themes.show('" + tp.obtype + "','" + 
                           tp.instid + "')");
            var link = "/" + tp.hashtag;
            html.push(["div", {cla:"tplinkdiv", id:"tplinkdiv" + tp.instid},
                       [["div", {cla:"tplinkpicdiv"},
                         ["a", {href:link, onclick:oc},
                          ["img", {src:imgsrc}]]],
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


    function showListing (obtype, instid) {
        if(obtype === "profile") {
            return app.profile.byprofid(profid); }
        return app.coop.bycoopid(instid);
    }


    return {
        display: function display () { displayMainContent(); },
        show: function show (obtype, instid) { showListing(obtype, instid); }
    };
}());

