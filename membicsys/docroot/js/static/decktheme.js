/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.decktheme = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        hfs = null,
        tty = 26,
        line3y = 78;
        //vals and logic assume viewbox width 320


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function titleSplash () { var numsteps = 2; return {
        group: {id: "gTS"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gTS"};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gMM", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "whatit", f.g, "Themes", 
                         {x: 84, y: line3y, fs: "24px"});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gTS", 0.0);
        }
    }; }


    function profTheme () { var numsteps = 12; return {
        group: {id: "gPT"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gPT", x: 20};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gTS", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "pt1", f.g, "Themes collect related membics", 
                         {x: f.x - 10, y: tty}); 
            hfs.showGraphic(sv, "t1g", f.g,
                            {x: 126, y: 44, w: 30, href: "img/microsite.png"});
            sv = hfs.step(3); //-------------------------------
            hfs.fadeElement(sv, "pt1", 0.0);
            hfs.showText(sv, "pt2", f.g, "Anyone can create a theme",
                         {x: f.x, y: tty}); 
            hfs.showGraphic(sv, "prof1", f.g,
                            {x: -74, y: 40, w: 40, href: "img/profile.png"});
            hfs.transElement(sv, "prof1", {transform: "scale(-1,1)"});
            sv = hfs.step(4); //-------------------------------
            hfs.drawArrow(sv, "p1t1", f.g, {
                x1: 72, y1: 59, x2: 118, y2: 59, "marker-start": ""});
            sv = hfs.step(5); //-------------------------------
            hfs.showGraphic(sv, "t2g", f.g,
                            {x: 126, y: 84, w: 30, href: "img/microsite.png"});
            hfs.drawArrow(sv, "p1t2", f.g, {
                x1: 72, y1: 59, x2: 119, y2: 95, "marker-start": ""});
            sv = hfs.step(7); //-------------------------------
            hfs.fadeElement(sv, "pt2", 0.0);
            hfs.showText(sv, "pt3", f.g, "and collaborate with others",
                         {x: f.x, y: tty}); 
            hfs.showGraphic(sv, "prof2", f.g,
                            {x: 202, y: 40, w: 40, href: "img/profile.png"});
            sv = hfs.step(8); //-------------------------------
            hfs.drawArrow(sv, "p2t1", f.g, {
                x1: 206, y1: 59, x2: 162, y2: 59, "marker-start": ""});
            sv = hfs.step(9); //-------------------------------
            hfs.showGraphic(sv, "prof3", f.g,
                            {x: 202, y: 80, w: 40, href: "img/profile.png"});
            sv = hfs.step(10); //-------------------------------
            hfs.drawArrow(sv, "p3t1", f.g, {
                x1: 206, y1: 99, x2: 162, y2: 99, "marker-start": ""});
            hfs.drawArrow(sv, "p3t2", f.g, {
                x1: 206, y1: 99, x2: 161, y2: 68, "marker-start": ""});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gPT", 0.0);
            hfs.fadeGroup(sv, "gTS", 1.0);
        }
    }; }


    function membership () { var numsteps = 16; return {
        group: {id: "gMB"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gMB", x: 20, y: 40, yo: 26, op: 0.4, x2: 134},
                roles = [{id: "founders", title: "Founders", 
                          tidb: "fotxt", tls: ["can do anything"]},
                         {id: "moderators", title: "Moderators",
                          tidb: "motxt", tls: ["are members who",
                                               "can also remove",
                                               "inappropriate",
                                               "content"]},
                         {id: "members", title: "Members",
                          tidb: "metxt", tls: ["", "can post membics",
                                               "to the theme"]},
                         {id: "followers", title: "Followers",
                          tidb: "fwtxt", tls: ["", "are interested in",
                                               "reading posted",
                                               "membics"]}];
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gPT", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "mlev", f.g, "Membership Levels",
                         {x: f.x, y: f.y});
            sv = hfs.step(2); //-------------------------------
            hfs.transElement(sv, "mlev", {opa: 0.0});
            roles.forEach(function (role) {
                hfs.showText(sv, role.id, f.g, role.title,
                             {x: f.x, y: f.y, opa: f.op}); });
            sv = hfs.step(3); //-------------------------------
            roles.forEach(function (role, idx) {
                hfs.transElement(sv, role.id, {tl: "0," + (idx * f.yo),
                                               opa: f.op}); });
            //steps 4, 7, 10, 13
            roles.forEach(function (role, idx) {
                var pr;
                sv = hfs.step(4 + (3 * idx));
                if(idx > 0) {
                    pr = roles[idx - 1];
                    hfs.transElement(sv, pr.id, {tl: "0," + ((idx - 1) * f.yo),
                                                 opa: f.op});
                    pr.tls.forEach(function (ignore, si) {
                        hfs.transElement(sv, pr.tidb + si, {opa: 0.0}); }); }
                hfs.transElement(sv, role.id, {tl: "0," + (idx * f.yo),
                                               opa: 1.0});
                role.tls.forEach(function (txt, si) {
                    hfs.showText(sv, role.tidb + si, f.g, txt,
                                 {x: f.x2, y: f.y + (si * f.yo),
                                  opacity: 1.0, fw: "normal"}); }); 
            });
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gPT", 1.0);
            hfs.fadeGroup(sv, "gMB", 0.0);
        }
    }; }


    function themeIdent () { var numsteps = 12; return {
        group: {id: "gTD"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gTD", x: 68, y: 26, y2: 52, y3: 78}, bb;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gMB", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "tpic", f.g, "Theme picture", 
                         {x: f.x, y: f.y}); 
            sv = hfs.step(2); //-------------------------------
            hfs.showText(sv, "tico", f.g, "or logo,", 
                         {x: 92, y: f.y2}); 
            sv = hfs.step(4); //-------------------------------
            hfs.transElement(sv, "tpic", {tl: "-68,0", opa: 0.0});
            hfs.transElement(sv, "tico", {tl: "-92,0", opa: 0.0});
            hfs.drawBox(sv, "picframe", f.g, {x: 10, y: 10, w: 50, 
                                              stropa: 0.8});
            hfs.showGraphic(sv, "imgtheme", f.g,
                            {x: 10, y: 10, w: 50, href: "img/microsite.png"});
            sv = hfs.step(5); //-------------------------------
            f.x = 72;
            hfs.showText(sv, "tname", f.g, "Theme Name", {x: f.x, y: f.y});
            sv = hfs.step(6); //-------------------------------
            hfs.showText(sv, "tdesc", f.g, "Description",
                         {x: f.x, y: f.y2, fs: "14px", fw: "normal"});
            bb = d3.select("#tdesc").node().getBBox();
            hfs.showText(sv, "tsite", f.g, ", site,",
                         {x: bb.x + bb.width, y: f.y2, 
                          fs: "14px", fw: "normal"});
            hfs.showText(sv, "tkeys", f.g, "custom keywords",
                         {x: f.x, y: 68, fs: "14px", fw: "normal"});
            sv = hfs.step(8); //-------------------------------
            hfs.fadeElement(sv, "tsite", 0.0);
            hfs.fadeElement(sv, "tkeys", 0.0);
            hfs.showText(sv, "pall", f.g, "All themes have a",
                         {x: 30, y: 98});
            bb = d3.select("#pall").node().getBBox();
            hfs.showText(sv, "pprm", f.g, "permalink",
                         //italic and oblique render jerkily in Mac FF 49.02
                         //but still want the emphasis
                         {x: bb.x + bb.width + 6, y: 98, fe: "italic"});
            sv = hfs.step(10); //-------------------------------
            hfs.showText(sv, "phash", f.g, "and optional #hashtag",
                         {x: 30, y: 121});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gMB", 1.0);
            hfs.fadeGroup(sv, "gTD", 0.0);
        }
    }; }



    function themeTabs () { var numsteps = 20; return {
        group: {id: "gTT"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gTT", x: 20, y: 84, tw: 40, op: 0.4},
                tcs = {x:  20, y: 128, "text-anchor": "start"},
                tcm = {x: 130, y: 128, "text-anchor": "middle"},
                tce = {x: 244, y: 128, "text-anchor": "end"},
                tabs = [{gid: "tablatest", img: "img/tablatest.png",
                         ti: "tl", txt: "Recent theme membics"},
                        {gid: "tabtop", img: "img/top.png",
                         ti: "tt", txt: "Top theme membics"},
                        {gid: "tabsearch", img: "img/search.png",
                         ti: "ts", txt: "Search theme membics"},
                        {gid: "tabstats", img: "img/stats.png",
                         ti: "tn", txt: "Visual traffic analysis"},
                        {gid: "tabrss", img: "img/rssicon.png",
                         ti: "tr", txt: "RSS Newsfeed"},
                        {gid: "tabembed", img: "img/embed.png",
                         ti: "te", txt: "Embed in your website"}];
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeElement(sv, "pall", 0.0);
            hfs.fadeElement(sv, "pprm", 0.0);
            hfs.fadeElement(sv, "phash", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            tabs.forEach(function (tab, idx) {
                hfs.showGraphic(sv, tab.gid, f.g, 
                                {x: f.x + (idx * f.tw), y: f.y, w: 20, 
                                 opacity: f.op, href: tab.img}); });
            //steps 2, 5, 8...
            tabs.forEach(function (tab, idx) {
                var pt, tc = tcm;
                if(idx === 0) {
                    tc = tcs; }
                if(idx === tabs.length - 1) {
                    tc = tce; }
                sv = hfs.step(2 + (3 * idx));
                if(idx > 0) {
                    pt = tabs[idx - 1];
                    hfs.transElement(sv, pt.gid, {opa: f.op});
                    hfs.transElement(sv, pt.ti, {opa: 0.0}); }
                hfs.transElement(sv, tab.gid, {opa: 1.0});
                hfs.showText(sv, tab.ti, f.g, tab.txt, tc); });
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeElement(sv, "te", 0.0);
            hfs.fadeGroup(sv, "gTT", 0.0);
            hfs.fadeElement(sv, "pall", 1.0);
            hfs.fadeElement(sv, "pprm", 1.0);
            hfs.fadeElement(sv, "phash", 1.0);
        }
    }; }


    function initSlides (d3ckitds) {
        ds = d3ckitds;
        hfs = d3ckit.slideHelperFunctions();
        ds.deck = [
            titleSplash(),
            profTheme(),
            membership(),
            themeIdent(),
            themeTabs()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay) {
        ds = d3ckit.displaySettings();
        ds.screencolor = "#ffffee";
        initSlides(ds);
        ds.normTransTime = 1000;
        if(autoplay) {
            ds.autoplay = true;
            ds.cc.widthMultiple /= 2;
            ds.cc.controls.rewind = false;
            ds.cc.controls.forward = false; }
        else {
            d3ckit.setKeyboardControls();
            d3ckit.enterKeyPlayPause();
            ds.eatCharEvents = true; }
        d3ckit.run();
    }

};  //end of returned functions
}());
