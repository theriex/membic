/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.themes = (function () {
    "use strict";

    var mdefhtml = "";
    var tps = null;
    var atfs = "";  //activetps fetch time stamp


    function keepMembicDef () {
        var defdiv = jt.byId("membicdefinitiondiv");
        if(!mdefhtml && defdiv) {
            mdefhtml = defdiv.innerHTML; }
    }


    function initVars () {
        tps = null;  //reset local cached array each time to use latest
        atfs = "";
        var atr = app.lcs.getRef("activetps", "411");
        if(atr.activetps) {  //have cached recent
            //jt.log("using cached activetps");
            atfs = atr.activetps.modified.replace(/[\-:]/g,"");  //friendlier
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
            if(prof.coops[tp.instid]) {
                switch(prof.coops[tp.instid].lev) {
                case -1: img = "tsfollowing.png"; break;
                case 1: img = "tsmember.png"; break;
                case 2: img = "tsmoderator.png"; break;
                case 3: img = "tsfounder.png"; break; } } }
        img = "img/" + img;
        return img;
    }


    function headerLineExampleHTML () {
        var exs = [{ext:"Site",
                    exus:["https://epinova.com/?view=news",
                          "https://klsuyemoto.net/index.html?sd=html&fn=links.html"],
                    bt:"Add a reading page",
                    bu:"https://membic.wordpress.com/2019/08/02/adding-a-reading-page-to-your-site/"},
                   {ext:"Blog",
                    exus:["https://theriex.wordpress.com/"],
                    bt:"Feed your blog",
                    bu:"https://membic.wordpress.com/2019/08/03/feed-your-blog/"},
                   {ext:"Social",
                    exus:["https://twitter.com/theriex"],
                    bt:"Post to social media",
                    bu:"https://membic.wordpress.com/2017/01/23/connecting-membic-to-hootsuite/"}];
        var html = [];
        exs.forEach(function (ex) {
            var url = ex.exus[Math.floor(Math.random() * ex.exus.length)];
            html.push(["tr", [
                ["td", ["a", {href:url,
                              onclick:jt.fs("window.open('" + url + "')")},
                        ex.ext]],
                ["td", ["a", {href:ex.bu,
                              onclick:jt.fs("window.open('" + ex.bu + "')")},
                        ex.bt]]]]); });
        html = [["table", {cla:"thlextable"},
                 [["thead", ["tr", [["th", "sample"], ["th", "how to"]]]],
                  ["tbody", html]]],
                ["div", {cla:"thlhelpdiv"},
                 ["To list your site in these samples, or get help setting up, ",
                  ["a", {href:"mailto:eric@" + app.profdev + "?subject=" +
                         jt.dquotenc("Help with membic feeds")},
                   "email Eric"]]]];
        return html;
    }


    function themesHeadingLineHTML () {
        //The height of the heading line varies based on whether they are
        //logged in or not, and is always smaller than the regular listings.
        var html = ["div", {cla:"tplinkdiv", style:"min-height:50px;"}, [
            ["div", {cla:"tplinkpicdiv"},
             ["img", {src:"img/membiclogo.png", style:"max-height:50px;"}]],
            ["div", {cla:"thdcontdiv", id:"thlanimdiv"},
             [["b", "Read and feed"],
              ["span", {id:"thlsitespan"}],
              ["span", {id:"thlblogspan"}],
              ["span", {id:"thlsmspan"}],
              ["div", {id:"thlexdiv"}]]]]];
        if(app.login.isLoggedIn()) {
            var blogurl = "https://membic.wordpress.com/2019/08/05/when-to-make-a-membic-theme/";
            html = ["div", {cla:"tplinkdiv", style:"min-height:30px;"}, [
                ["div", {cla:"tplinkpicdiv"},
                 ["img", {src:"img/plus.png", style:"max-height:30px;"}]],
                ["div", {cla:"thdcontdiv"},
                 [["a", {href:"#NewTheme",
                         onclick:jt.fs("app.pcd.display('coop')")},
                   "Create Theme"],
                  ["span", {cla:"moreinfospan"},
                   ["a", {href:"#moreinfo",
                          onclick:jt.fs("app.toggledivdisp('moreinfodiv')")},
                    "more info"]],
                  ["div", {id:"moreinfodiv", style:"display:none;"},
                   [["a", {href:blogurl,
                           onclick:jt.fs("window.open('" + blogurl + "')")},
                     "Read when and why you might want to create a theme"],
                    ["div", {cla:"thlhelpdiv"},
                     "Connect your membic feeds:"],
                    ["div", {id:"thlexdiv"}, headerLineExampleHTML()]]]]]]]; }
        return jt.tac2html(html);
    }


    function displayHeaderLineExamples () {
        jt.out("thlexdiv", jt.tac2html(headerLineExampleHTML()));
    }


    function animateThemesHeaderLine () {
        var elem = jt.byId("thlanimdiv");
        if(!elem) {  //animated header line not displayed
            return; }
        var spandat = [{id:"thlsitespan", html:", your site"},
                       {id:"thlblogspan", html:", your blog"},
                       {id:"thlsmspan", html:", social media."}];
        var idx;
        for(idx = 0; idx < spandat.length; idx += 1) {
            elem = jt.byId(spandat[idx].id);
            if(!elem.innerHTML) {
                elem.innerHTML = spandat[idx].html;
                app.fork({descr:"animate theme header line " + spandat[idx].id,
                          func:animateThemesHeaderLine, ms:800});
                return; } }
        app.fork({descr:"animate theme header line examples",
                  func:displayHeaderLineExamples, ms:1000});
    }


    function imageSourceForListing (tp) {
        var imgsrc = "img/blank.png";
        if(tp.pic) {
            if(tp.obtype === "theme") {
                imgsrc = "ctmpic?coopid=" + tp.instid; }
            else if(tp.obtype === "profile") {
                imgsrc = "profpic?profileid=" + tp.instid; }
            //Add a cache bust for the img source in case a new image was
            //uploaded and the activetps refetched.  Otherwise stale.
            if(atfs) {
                imgsrc += "&cb=" + atfs; } }
        return imgsrc;
    }


    function writeContent () {
        var html = [];
        html.push(themesHeadingLineHTML());
        decorateAndSort().forEach(function (tp) {
            var ocparams = "'" + tp.obtype + "','" + tp.instid + "'";
            var oc = jt.fs("app.themes.show(" + ocparams + ")");
            var mc = jt.fs("app.themes.show(" + ocparams + ",'Settings')");
            var link = "/" + tp.hashtag;
            html.push(["div", {cla:"tplinkdiv", id:"tplinkdiv" + tp.instid},
                       [["div", {cla:"tplinkpicdiv"},
                         [["a", {href:link, onclick:oc},
                           ["img", {src:imageSourceForListing(tp), 
                                    cla:"tplinkpicimg"}]],
                          ["a", {href:link, onclick:mc, cla:"tpmemlink"},
                           ["img", {src:imgForAssocLev(tp), 
                                    cla:"tplinkmemimg"}]]]],
                        ["div", {cla:"tplinkdescdiv"},
                         [["span", {cla:"tplinknamespan"},
                           ["a", {href:link, onclick:oc}, tp.name]],
                          jt.linkify(tp.description)]]]]); });
        jt.out("contentdiv", jt.tac2html(html) + mdefhtml);
        app.fork({descr:"animate themes header line",
                  func:animateThemesHeaderLine,
                  ms:1200});
    }


    function displayMainContent () {
        jt.out("logodiv", "");  //remove logo since displayed in nav
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
        show: function show (ty, id, cmd) { showListing(ty, id, cmd); },
        keepdef: function keepdef () { keepMembicDef(); }
    };
}());

