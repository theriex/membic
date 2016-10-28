/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge, for */

app.deckmembic = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        hfs = null,
        leftx = 10,         //vals and logic assume viewbox width 320
        line2y = 42,
        line3y = 68,
        line4y = 96;

    ////////////////////////////////////////
    //slide specific helper functions
    ////////////////////////////////////////

    function drawStars (timing, grpname) {
        var sx = 100, sy = 34, sr = 7, st, sd, g, soff, elem;
        st = Math.round(timing.duration / 5);
        sd = timing.delay + timing.duration;  //take 3 steps total to draw
        g = ds.gs[grpname];
        soff = [2, 19, 36, 53, 70];
        soff.forEach(function (offset, idx) {
            elem = d3.select("#goldcircle" + idx);
            if(elem.empty()) {
                elem = g.append("circle")
                    .attr({"id": "goldcircle" + idx, "class": "goldcircle",
                           "cx": sx + sr + offset, "cy": sy + sr + 1, "r": sr,
                           "opacity": 0.0})
                    .style({"fill": "#fed000"}); }
            elem.transition().delay(sd + (idx * st)).duration(st)
                .attr("opacity", 1.0); });
        elem = d3.select("#starsimage");
        if(elem.empty()) {
            elem = g.append("image")
                .attr({"xlink:href": "img/stars18ptCEmptyCenters.png",
                       "x": sx, "y": sy, "height": 15, "width": 85,
                       "id": "starsimage", "opacity": 0.0}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("opacity", 1.0);
    }


    function fadeStars (timing) {
        hfs.fadeElement(timing, "goldcircle0", 0.0, true);
        hfs.fadeElement(timing, "goldcircle1", 0.0, true);
        hfs.fadeElement(timing, "goldcircle2", 0.0, true);
        hfs.fadeElement(timing, "goldcircle3", 0.0, true);
        hfs.fadeElement(timing, "goldcircle4", 0.0, true);
        hfs.fadeElement(timing, "starsimage", 0.0, true);
    }


    function drawKeywords (timing, grpname) {
        var kx = 119, ky = 96, cbh = 10, g, 
            cbx = kx - 17, cby = ky - cbh, cbd, elem;
        g = ds.gs[grpname];
        elem = d3.select("#cbrect");
        if(elem.empty()) {
            elem = g.append("rect")
                .attr({"x": cbx, "y": cby, "width": cbh, "height": cbh,
                       "id": "cbrect", "stroke-opacity": 0.0})
                .style({"fill": "none", "stroke": ds.textcolor}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("stroke-opacity", 0.5);
        hfs.showText(timing, "cbkeywords", grpname, "Keywords",
                     {x: kx, y: ky, "font-size": "14px"});
        cbd = timing.duration;
        elem = d3.select("#cbcheckmark");
        if(elem.empty()) {
            elem = g.append("path")
                .attr("d", "M " + cbx +       " " + (cby + 3) + 
                          " L " + (cbx + 4) + " " + (cby + 9) +
                          " L " + (cbx + 12) + " " + (cby - 4) +
                          " L " + (cbx + 4) + " " + (cby + 5) + 
                          " Z")
                .attr("id", "cbcheckmark")
                .style({"fill": ds.textcolor, "stroke": ds.textcolor})
                .attr({"fill-opacity": 0.0, "stroke-opacity": 0.0}); }
        elem.transition().delay(timing.delay + cbd).duration(cbd)
            .attr("fill-opacity", 1.0)
            .attr("stroke-opacity", 1.0);
    }


    function fadeKeywords (timing) {
        hfs.fadeElement(timing, "cbcheckmark", 0.0, true);
        hfs.fadeElement(timing, "cbrect", 0.0, true);
        hfs.fadeElement(timing, "cbkeywords", 0.0, true);
    }


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
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "whatit", f.g, "What's a Membic?", 
                         {x: 32, y: line3y, fs: "24px"});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gTS", 0.0);
        }
    }; }
            


    function linkComponents () { var numsteps = 10; return {
        group: {id: "gLC"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f, ic;
            f = {x: leftx + 110, g: "gLC"};
            ic = {w: 20, x: leftx + 104, y2: 26, y3: 52, y4: 78};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gTS", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "lcurl", f.g, "URL", 
                         {x: leftx + 30, y: line3y}); 
            hfs.showText(sv, "lcor", f.g, "or", 
                         {x: leftx + 74, y: line3y, "font-size": "14px"}); 
            sv = hfs.step(2); //-------------------------------
            hfs.showGraphic(sv, "imgarticle", f.g,
                            {x: ic.x, y: ic.y2, w: ic.w, h: ic.w,
                             href: "img/TypeArticle50.png"});
            hfs.showText(sv, "ta", f.g, "Title, Author", {x: f.x2, y: line2y});
            sv = hfs.step(3); //-------------------------------
            hfs.fadeElement(sv, "imgarticle", 0.0);
            hfs.showGraphic(sv, "imgbook", f.g,
                            {x: ic.x, y: ic.y2, w: ic.w, h: ic.w,
                             href: "img/TypeBook50.png"});
            sv = hfs.step(4); //-------------------------------
            hfs.showGraphic(sv, "imgvideo", f.g,
                            {x: ic.x, y: ic.y3, w: ic.w, h: ic.w,
                             href: "img/TypeVideo50.png"});
            hfs.showText(sv, "tr", f.g, "Title, Artist", {x: f.x2, y: line3y});
            sv = hfs.step(5); //-------------------------------
            hfs.fadeElement(sv, "imgvideo", 0.0);
            hfs.showGraphic(sv, "imgmusic", f.g,
                            {x: ic.x, y: ic.y3, w: ic.w, h: ic.w,
                             href: "img/TypeSong50.png"});
            sv = hfs.step(6); //-------------------------------
            hfs.showGraphic(sv, "imgact", f.g,
                            {x: ic.x, y: ic.y4, w: ic.w, h: ic.w,
                             href: "img/TypeActivity50.png"});
            hfs.showText(sv, "na", f.g, "Name, Address", {x: f.x2, y: line4y});
            sv = hfs.step(7); //-------------------------------
            hfs.fadeElement(sv, "imgact", 0.0);
            hfs.showGraphic(sv, "imgyum", f.g,
                            {x: ic.x, y: ic.y4, w: ic.w, h: ic.w,
                             href: "img/TypeYum50.png"});
            sv = hfs.step(8); //-------------------------------
            hfs.fadeElement(sv, "imgbook", 0.0);
            hfs.fadeElement(sv, "ta", 0.0);
            hfs.showText(sv, "lcunique", f.g, "Unique", {x: f.x, y: line2y});
            //sv = hfs.step(9); //-------------------------------
            hfs.fadeElement(sv, "imgmusic", 0.0);
            hfs.fadeElement(sv, "tr", 0.0);
            hfs.showText(sv, "lcid", f.g, "Identifying", {x: f.x, y: line3y});
            //sv = hfs.step(10); //-------------------------------
            hfs.fadeElement(sv, "imgyum", 0.0);
            hfs.fadeElement(sv, "na", 0.0);
            hfs.showText(sv, "lcfields", f.g, "Fields", {x: f.x, y: line4y});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gLC", 0.0);
            hfs.transElement(sv, ["lcunique", "lcid", "lcfields"], {opa: 0.0});
            hfs.fadeGroup(sv, "gTS", 1.0);
        }
    }; }
            

    function membicComponents () { var numsteps = 14; return {
        group: {id: "gMC"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f;
            f = {x: leftx + 30, g: "gMC"};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeElement(sv, "lcor", 0.0);
            hfs.transElement(sv, "lcunique", {tl: "-93,8", opa: 0.4});
            hfs.transElement(sv, "lcid",     {tl: "-93,0", opa: 0.4});
            hfs.transElement(sv, "lcfields", {tl: "-93,-8", opa: 0.4});
            hfs.fadeInitGroup(sv, f.g, 1.0);
            sv = hfs.step(2); //-------------------------------
            hfs.showText(sv, "link", f.g, "Link", {x: 38, y: line3y});
            hfs.fadeGroup(sv, "gLC", 0.0);
            hfs.drawBox(sv, "linkframe", f.g, {x: 26, y: 36, w: 60, 
                                               stropa: 0.8});
            sv = hfs.step(3); //-------------------------------
            hfs.showText(sv, "strel", f.g, "Relevance",  {x: 100, y: 46});
            hfs.transElement(sv, "strel", {opa: 1.0, tl: "0,0"});
            sv = hfs.step(4); //-------------------------------
            hfs.showText(sv, "stimp", f.g, "Importance", {x: 100, y: 66});
            hfs.transElement(sv, "stimp", {opa: 1.0, tl: "0,0"});
            sv = hfs.step(5); //-------------------------------
            hfs.showText(sv, "stqua", f.g, "Quality",    {x: 100, y: 86});
            hfs.transElement(sv, "stqua", {opa: 1.0, tl: "0,0"});
            sv = hfs.step(6); //-------------------------------
            hfs.showText(sv, "stpri", f.g, "Primacy",    {x: 100, y: 106});
            hfs.transElement(sv, "stpri", {opa: 1.0, tl: "0,0"});
            sv = hfs.step(7); //-------------------------------
            hfs.showText(sv, "staff", f.g, "Affinity",   {x: 100, y: 126});
            hfs.transElement(sv, "staff", {opa: 1.0, tl: "0,0"});
            sv = hfs.step(8); //-------------------------------
            hfs.transElement(sv, "strel", {opa: 0.0, tl: "0,0"});
            hfs.transElement(sv, "stimp", {opa: 0.0, tl: "0,-20"});
            hfs.transElement(sv, "stqua", {opa: 0.0, tl: "0,-40"});
            hfs.transElement(sv, "stpri", {opa: 0.0, tl: "0,-60"});
            hfs.transElement(sv, "staff", {opa: 0.0, tl: "0,-80"});
            drawStars(sv, f.g);
            sv = hfs.step(10); //-------------------------------
            drawKeywords(sv, f.g);
            sv = hfs.step(12); //-------------------------------
            hfs.showText(sv, "whymem", f.g, "Why is this memorable?", 
                         {x: 100, y: 72, fs: "14px", fe: "italic"});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gMC", 0.0);
            hfs.fadeGroup(sv, "gLC", 1.0);
            hfs.fadeElement(sv, "lcor", 1.0);
            hfs.transElement(sv, "lcunique");
            hfs.transElement(sv, "lcid");
            hfs.transElement(sv, "lcfields");
            fadeStars(sv);
            fadeKeywords(sv);
            hfs.fadeElement(sv, "whymem", 0.0);
        }
    }; }


    function makeAMembic () { var numsteps = 6; return {
        group: {id: "gMM"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {x: 46, g: "gMM"};
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1); //-------------------------------
            hfs.fadeGroup(sv, "gMC", 0.0);
            hfs.fadeInitGroup(sv, f.g, 1.0);
            hfs.showText(sv, "mmwhen", f.g, 
                         "When you find something",
                         {x: f.x, y: line2y});
            hfs.showText(sv, "mmworth", f.g, 
                         "worth remembering,",
                         {x: f.x, y: line3y});
            sv = hfs.step(3); //-------------------------------
            hfs.showText(sv, "mmake", f.g, "make a membic.", 
                         {x: f.x, y: line4y});
            hfs.showGraphic(sv, "imgwrite", f.g,
                            {x: 187, y: 84, w: 55, h: 47,
                             href: "img/writenew.png"});
        },
        undo: function (transtime) {
            var sv;
            hfs.stepinit(transtime, numsteps);
            sv = hfs.step(1);
            hfs.fadeGroup(sv, "gMM", 0.0);
            hfs.fadeGroup(sv, "gMC", 1.0);
        }
    }; }


    function initSlides (d3ckitds) {
        ds = d3ckitds;
        hfs = d3ckit.slideHelperFunctions();
        ds.deck = [
            titleSplash(),
            linkComponents(),
            membicComponents(),
            makeAMembic()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay) {
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

