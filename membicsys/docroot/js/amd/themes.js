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
        if(!tps && app.pfoj) {
            tps = app.pfoj;
            if(tps.obtype === "activetps") {
                tps = tps.jtps; }
            else {  //some other prefetch object, need to call server
                tps = null; } }
        if(!tps) {
            jt.call("GET", "/recentactive" + jt.ts("?cb=", "minute"), null,
                    function (tps) {
                        tps = tps[0].jtps;
                        app.themes.display(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Fetching recent active failed " + code + ": " +
                               errtxt)}),
                    jt.semaphore("themes.initVars"));
            return false; }
        return true;
    }


    function writeContent () {
        var html = [];
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
        initVars() && writeContent();
    }


    return {
        display: function display () { displayMainContent(); }
    };
}());

