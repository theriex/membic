/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.deckprofile = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        hfs = null,
        //vals and logic assume viewbox width 320
        namey = 26,
        line2y = 52,
        line3y = 78;


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function profIdent () { var numsteps = 9; return {
        group: {id: "gPI"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gPI", x: 68}, ta;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "ptpic", f.g, "Profile picture", 
                         {x: f.x, y: namey}); 
            sv = hfs.step(2); //-------------------------------
            hfs.showText(sv, "ptico", f.g, ", icon,", 
                         {x: 183, y: namey}); 
            sv = hfs.step(3); //-------------------------------
            hfs.showText(sv, "ptrep", f.g, "representative", 
                         {x: f.x, y: line2y}); 
            hfs.showText(sv, "ptimg", f.g, "image", 
                         {x: 190, y: line2y}); 
            sv = hfs.step(4); //-------------------------------
            hfs.transElement(sv, "ptpic", {tl: "-68,0", opa: 0.0});
            hfs.transElement(sv, "ptico", {tl: "-183,0", opa: 0.0});
            hfs.transElement(sv, "ptrep", {tl: "-68,0", opa: 0.0});
            hfs.transElement(sv, "ptimg", {tl: "-190,0", opa: 0.0});
            hfs.drawBox(sv, "picframe", f.g, {x: 10, y: 10, w: 50, 
                                              stropa: 0.8});
            hfs.showGraphic(sv, "imgprof", f.g,
                            {x: 4, y: 14, w: 55, h: 47,
                             href: "img/profile.png"});
            sv = hfs.step(5); //-------------------------------
            f.x = 72;
            hfs.showText(sv, "pname", f.g, "Pen Name", {x: f.x, y: namey}); 
            hfs.showText(sv, "pnor", f.g, "or", {x: 98, y: line2y}); 
            hfs.showText(sv, "pnrn", f.g, "Real Name", {x: f.x, y: line3y}); 
            sv = hfs.step(7); //-------------------------------
            hfs.transElement(sv, "pnor", {tl: "0,-26", opa: 0.0});
            hfs.transElement(sv, "pnrn", {tl: "0,-52", opa: 0.0});
            sv = hfs.step(8); //-------------------------------
            ta = {x: f.x, y: line2y, "font-size": "14px", 
                  "font-weight": "normal"};
            hfs.showText(sv, "pdesc", f.g, "Anything you want to say", ta);
            ta.y += 16;
            hfs.showText(sv, "pdesc2", f.g, "about yourself (optional)", ta);
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gPI", 0.0);
        }
    }; }
        
        
    function profTabs () { var numsteps = 14; return {
        group: {id: "gPT"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {g: "gPT", x: 20, y: 84, tw: 40, op: 0.4},
                tcs = {x:  20, y: 128, "text-anchor": "start"},
                tcm = {x: 150, y: 128, "text-anchor": "middle"},
                tce = {x: 238, y: 128, "text-anchor": "end"},
                tabs = [{gid: "tablatest", img: "img/tablatest.png",
                         ti: "tl", txt: "Membics you've made recently"},
                        {gid: "tabtop", img: "img/top.png",
                         ti: "tt", txt: "Your top membics of all time"},
                        {gid: "tabmemo", img: "img/tabmemo.png",
                         ti: "tm", txt: "Remembered membics from others"},
                        {gid: "tabsearch", img: "img/search.png",
                         ti: "ts", txt: "Search your membics"},
                        {gid: "tabendo", img: "img/endorse.png",
                         ti: "te", txt: "Profiles you endorse"},
                        {gid: "tabtheme", img: "img/tabctms.png",
                         ti: "tc", txt: "Themes you contribute to"}];
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeInitGroup(sv, f.g, 1.0);
            tabs.forEach(function (tab, idx) {
                hfs.showGraphic(sv, tab.gid, f.g, 
                                {x: f.x + (idx * f.tw), y: f.y, w: 20, 
                                 opacity: f.op, href: tab.img}); });
            //steps 2, 4, 6...12
            tabs.forEach(function (tab, idx) {
                var pt, tc = tcm;
                if(idx === 0) {
                    tc = tcs; }
                if(idx === tabs.length - 1) {
                    tc = tce; }
                sv = hfs.step(2 + (2 * idx));
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
            hfs.fadeGroup(sv, "gPT", 0.0);
        }
    }; }


    function initSlides (d3ckitds) {
        ds = d3ckitds;
        hfs = d3ckit.slideHelperFunctions();
        ds.deck = [
            profIdent(),
            profTabs()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay) {
        if(window.d3 === undefined || d3ckit === undefined) {
            return setTimeout(function () {
                app.deckprofile.run(autoplay); }, 300); }
        ds = d3ckit.displaySettings();
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
