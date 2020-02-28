/*jslint browser, white, fudge, this, for, long */
/*global app, jt */

app.themes = (function () {
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
        jt.out("themedispstatdiv", "Fetching themes");
        var atr = app.refmgr.cached("activetps", "411");
        if(atr) {  //have cached recent
            //jt.log("using cached activetps");
            atfs = atr.modified.replace(/[\-:]/g,"");  //friendlier
            tps = mergePersonalThemesForAccess(atr.jtps); }
        else {  //no recent, go get it
            //jt.log("fetching activetps");
            jt.call("GET", "/api/recentactive" + jt.ts("?cb=", "minute"), null,
                    function (racs) {
                        jt.log("loaded activetps from /recentactive results");
                        app.refmgr.put(racs[0]);
                        app.themes.display(); },  //calls back into initVars
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
                    ["div", {id:"thlexdiv"}, headerLineExampleHTML()]]],
                  ["div", {id:"themedispstatdiv"}]]]]]; }
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
            var otm = {theme:"Theme", profile:"MUser"};
            imgsrc = "/api/obimg?dt=" + otm[tp.obtype] + "&di=" + tp.dsId
            var mod = tp.modified;
            if(atfs > mod) {
                mod = atfs; }
            imgsrc += "&cb=" + mod; }
        return imgsrc;
    }


    function writeThemeElements (state) {
        var elem;
        if(!state.cancelled && state.idx < state.tps.length) {
            var tp = state.tps[state.idx];
            var ocparams = "'" + tp.obtype + "','" + tp.dsId + "'";
            var oc = jt.fs("app.themes.show(" + ocparams + ")");
            var mc = jt.fs("app.themes.show(" + ocparams + ",'Settings')");
            var link = app.pcd.linkForThemeOrProfile(tp);
            elem = document.createElement("div");
            elem.className = "tplinkdiv";
            elem.id = "tplinkdiv" + tp.dsId;
            elem.innerHTML = jt.tac2html(
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
                   jt.linkify(tp.description)]]]);
            jt.byId("contentdiv").appendChild(elem);
            state.idx += 1;
            app.fork({descr:"writeThemeElements iteration",
                      func:function () {
                          writeThemeElements(state); },
                      ms:50}); }
        else if(!state.cancelled) {
            elem = document.createElement("div");
            elem.innerHTML = mdefhtml;
            jt.byId("contentdiv").appendChild(elem);
            if(jt.byId("thlanimdiv")) {  //only fork if animating
                app.fork({descr:"animate themes header line",
                          func:animateThemesHeaderLine,
                          ms:1200}); } }
    }


    function writeContent () {
        jt.out("themedispstatdiv", "Sorting themes");
        var themes = decorateAndSort();
        app.fork({descr:"Themes disp iterator start",
                  func:function () {
                      jt.out("themedispstatdiv", "");
                      var state = {tps:themes, idx:0};
                      app.loopers.push(state);
                      writeThemeElements(state); },
                  ms:50});
    }


    function displayMainContent () {
        jt.log("themes.displayMainContent starting");
        jt.out("logodiv", "");  //remove logo since displayed in nav
        app.stopLoopers();
        jt.out("contentdiv", jt.tac2html(themesHeadingLineHTML()));
        app.fork({descr:"themes display start",
                  func:function () {
                      if(initVars()) {  //have data to work with
                          app.history.checkpoint({view:"themes"});
                          writeContent(); } },
                  ms:50});
    }


    function showListing (obtype, dsId, command) {
        if(obtype === "profile") {
            return app.profile.byprofid(dsId, command); }
        return app.coop.bycoopid(dsId, "themes", command);
    }


    return {
        display: function display () { displayMainContent(); },
        show: function show (ty, id, cmd) { showListing(ty, id, cmd); },
        keepdef: function keepdef () { keepMembicDef(); }
    };
}());

