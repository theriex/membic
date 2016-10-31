/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.deckdisco = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        hfs = null;
        //vals and logic assume viewbox width 320


    ////////////////////////////////////////
    // base slide creation functions
    ////////////////////////////////////////

    function community () { var numsteps = 5; return {
        group: {id: "gMC"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gMC", x: 26, y: 26, y2: 52}, bb;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "ct1", f.g, "Discover themes", 
                         {x: f.x, y: f.y}); 
            sv = hfs.step(2); //-------------------------------
            bb = d3.select("#ct1").node().getBBox();
            hfs.showText(sv, "ct2", f.g, ", and people,", 
                         {x: bb.x + bb.width, y: f.y}); 
            sv = hfs.step(3); //-------------------------------
            hfs.showText(sv, "ct3", f.g, "in the membic community", 
                         {x: f.x, y: f.y2});
            sv = hfs.step(4); //-------------------------------
            hfs.showGraphic(sv, "cg", f.g,
                            {x: 186, y: 60, w: 30, href: "img/membiclogo.png"});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gMC", 0.0);
        }
    }; }


    function endorse () { var numsteps = 20; return {
        group: {id: "gME"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gME", x: 32, y: 20, lw: 50, op: 0.4,
                         y2: 62, y3: 90, yo: 20},
                levs = [{id: "promote", title: "Prefer", img: "promote.png",
                         tidb: "levpt", tls: ["Trust this person's membics",
                                              "and show their posts first."]},
                        {id: "endorse", title: "Endorse", img: "endorse.png",
                         tidb: "levet", tls: ["Trust this person's membics",
                                              "but don't sort their posts",
                                              "ahead of other people."]},
                        {id: "normal", title: "Normal", img: "noprefsq.png",
                         tidb: "levnt", tls: ["Don't do anything special",
                                              "with membics from this person."]},
                        {id: "bg", title: "Background", img: "background.png",
                         tidb: "levbt", tls: ["Sort this person's membics",
                                              "to the end."]},
                        {id: "block", title: "Block", img: "block.png",
                         tidb: "levxt", tls: ["Don't show any membics from",
                                              "this person at all ever."]},
                        {id: null}];
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gMC", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            levs.forEach(function (lev, idx) {
                if(lev.id) {
                    hfs.showGraphic(sv, lev.id + "graphic", f.g,
                                    {x: f.x + (idx * f.lw), y: f.y, 
                                     w: 20, opacity: f.op, 
                                     href: "img/" + lev.img}); } });
            //steps 2, 5, 8...
            levs.forEach(function (lev, idx) {
                var pl, anchor = "start";
                sv = hfs.step(2 + (4 * idx));
                if(idx > 0) {
                    pl = levs[idx - 1];
                    anchor = "middle";
                    hfs.transElement(sv, pl.id + "graphic", {opa: f.op});
                    hfs.transElement(sv, pl.id + "title", {opa: 0.0});
                    pl.tls.forEach(function (ignore, ti) {
                        hfs.transElement(sv, pl.tidb + ti, {opa: 0.0}); }); }
                if(lev.id) {
                    hfs.transElement(sv, lev.id + "graphic", {opa: 1.0});
                    hfs.showText(sv, lev.id + "title", f.g, lev.title,
                                 {x: f.x + (idx * f.lw), y: f.y2, 
                                  opacity: 1.0, ta: anchor});
                    lev.tls.forEach(function (txt, ti) {
                        hfs.showText(sv, lev.tidb + ti, f.g, txt,
                                     {x: f.x, y: f.y3 + (ti * f.yo),
                                      opacity: 1.0, fw: "normal", 
                                      fs: "14px"}); }); } });
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gME", 0.0);
            hfs.fadeGroup(sv, "gMC", 1.0);
        }
    }; }


    function actions () { var numsteps = 16; return {
        group: {id: "gMA"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gMA", x: 60, y: 70, lw: 70,
                         y2: 62, y3: 21, yo: 20},
                acts = [{id: "star", title: "Star", 
                         img1: "helpfulq.png", img2: "helpful.png", 
                         tidb: "acth", tls: ["\"Star\" to let the writer know",
                                             "this membic was helpful,",
                                             "interesting, or important"]},
                        {id: "memo", title: "Remember",
                         img1: "rememberq.png", img2: "remembered.png",
                         tidb: "actr", tls: ["",
                                             "\"Remember\" to save this membic",
                                             "for quick reference later"]},
                        {id: "write", title: "Write",
                         img1: "writereview.png", img2: "writenew.png",
                         tidb: "actw", tls: ["",
                                             "\"Write\" to make your own",
                                             "membic for this link"]},
                        {id: null}];
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gME", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showGraphic(sv, "burger", f.g, 
                            {x: 48, y: 111, w: 20, 
                             href: "img/stackedmenu.png"});
            hfs.showText(sv, "clicktitle", f.g, 
                         "Membic action menu", {x: 72, y: 128});
            sv = hfs.step(2); //-------------------------------
            hfs.transElement(sv, ["clicktitle", "burger"], {opa: 0.4});
            acts.forEach(function (act, idx) {
                var yadj = (idx? f.y : f.y - 3);
                if(act.id) {
                    hfs.showGraphic(sv, act.id + "img1", f.g,
                                    {x: f.x + (idx * f.lw), y: yadj, w: 40,
                                     href: "img/" + act.img1}); 
                    hfs.showGraphic(sv, act.id + "img2", f.g,
                                    {x: f.x + (idx * f.lw), y: yadj, w: 40,
                                     href: "img/" + act.img2,
                                     opacity: 0.0}); } });
            //steps 3, 7...15
            acts.forEach(function (act, idx) {
                var pa;
                sv = hfs.step(3 + (4 * idx));
                if(idx > 0) {
                    pa = acts[idx - 1];
                    hfs.transElement(sv, pa.id + "img1", {opa: 1.0});
                    hfs.transElement(sv, pa.id + "img2", {opa: 0.0});
                    pa.tls.forEach(function (ignore, ti) {
                        hfs.transElement(sv, pa.tidb + ti, {opa: 0.0}); }); }
                if(act.id) {
                    hfs.transElement(sv, act.id + "img1", {opa: 0.0});
                    hfs.transElement(sv, act.id + "img2", {opa: 1.0});
                    act.tls.forEach(function (txt, ti) {
                        hfs.showText(sv, act.tidb + ti, f.g, txt,
                                     {x: f.x, y: f.y3 + (ti * f.yo),
                                      opacity: 1.0, fw: "normal",
                                      fs: "14px"}); }); } });
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gME", 1.0);
            hfs.fadeGroup(sv, "gMA", 0.0);
        }
    }; }


    function getStarted () { var numsteps = 12; return {
        group: {id: "gGS"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gGS", x:140, y: 40, yo: 20};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gMA", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "gstitle", f.g, 
                         "Getting started", {x: 76, y: 20});
            sv = hfs.step(2); //-------------------------------
            hfs.transElement(sv, "gstitle", {opa: 0.4});
            hfs.showGraphic(sv, "rbimg", f.g, {x: 127, y: 29, w: 20, 
                                               href: "img/TypeBook50.png"});
            hfs.showText(sv, "rb", f.g, "Any books you", {x: 78, y: 70});
            hfs.showText(sv, "rb2", f.g, "would recommend?", {x: 62, y: 90});
            sv = hfs.step(4); //-------------------------------
            hfs.transElement(sv, ["rb", "rbimg", "rb2"], {opa: 0.0});
            hfs.showGraphic(sv, "actimg", f.g, 
                            {x: 127, y: 29, w: 20,
                             href: "img/TypeActivity50.png"});
            hfs.showText(sv, "act", f.g, "Fun things around town?", 
                         {x: 44, y: 70});
            sv = hfs.step(6); //-------------------------------
            hfs.transElement(sv, ["act", "actimg"], {opa: 0.0});
            hfs.showGraphic(sv, "yumimg", f.g,
                            {x: 127, y: 29, w: 20,
                             href: "img/TypeYum50.png"});
            hfs.showText(sv, "yum", f.g, "Great food or drinks?", 
                         {x: 54, y: 70});
            sv = hfs.step(8); //-------------------------------
            hfs.transElement(sv, ["yum", "yumimg"], {opa: 0.0});
            hfs.showGraphic(sv, "vidimg", f.g,
                            {x: 115, y: 29, w: 20,
                             href: "img/TypeVideo50.png"});
            hfs.showGraphic(sv, "musimg", f.g,
                            {x: 137, y: 29, w: 20,
                             href: "img/TypeSong50.png"});
            hfs.showText(sv, "ent", f.g, "Videos or music?", {x: 70, y: 70});
            sv = hfs.step(9); //-------------------------------
            hfs.transElement(sv, ["vidimg", "musimg"], {tl: "-10,0"});
            hfs.showGraphic(sv, "movimg", f.g,
                            {x: 147, y: 29, w: 20,
                             href: "img/TypeMovie50.png"});
            hfs.showText(sv, "ent2", f.g, "Movies?", {x: 101, y: 90});
            sv = hfs.step(11); //-------------------------------
            hfs.transElement(sv, ["vidimg", "musimg", "movimg", "ent", "ent2"], 
                             {opa: 0.0});
            hfs.showGraphic(sv, "artimg", f.g,
                            {x: 137, y: 29, w: 20,
                             href: "img/TypeArticle50.png"});
            hfs.showText(sv, "art", f.g, "What's the most informative", 
                         {x: 35, y: 70});
            hfs.showText(sv, "art2", f.g, "article you've read in the", 
                         {x: 51, y: 90});
            hfs.showText(sv, "art3", f.g, "past two weeks?", 
                         {x: 83, y: 110});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.transElement(sv, ["artimg", "art", "art2", "art3"], {opa: 0.0});
            hfs.fadeGroup(sv, "gMA", 1.0);
            hfs.fadeGroup(sv, "gGS", 0.0);
        }
    }; }



    function initSlides (d3ckitds) {
        ds = d3ckitds;
        hfs = d3ckit.slideHelperFunctions();
        ds.deck = [
            community(),
            endorse(),
            actions(),
            getStarted()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay) {
        ds = d3ckit.displaySettings();
        ds.screencolor = "#f8f0f5";
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
