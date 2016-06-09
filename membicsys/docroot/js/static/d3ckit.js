/*global window, d3, jt */
/*jslint browser, multivar, white, fudge */

var d3ckit = {};

d3ckit = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = {deck: [],                //slides to display. see makeDemoDeck
              dispdivid: "d3ckitdiv",  //svg will take 100% of this space
              w: 320, h: 190,  //phone optimized, MacAir fullscreen ok
              margin: {top: 5, right: 5, bottom: 5, left: 5},
              normTransTime: 800,      //basic 2 step display and read: 1600
              fastTransTime: 100,      //essentially instant, but sequenceable
              moviescreen: true, textcolor: "black",
              autoplay: false, paused: false,
              //working variables
              didx: -1, svgid: null, gs: {}, 
              cc: {heightMultiple: 0.08, widthMultiple: 0.6,
                   iconPadMultiple: 0.6,
                   controls: {restart: true, rewind: true, previous: true,
                              playpause: true, forward: true}}};


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function svgDisplayActive () {
        return jt.byId(ds.svgid); 
    }


    function delayf (func, delay, currsvgid) {
        setTimeout(function () {
            if(ds.svgid !== currsvgid || !svgDisplayActive()) {
                return; }
            func(); }, delay);
    }


    function appendBar (spec) {
        spec.h = spec.h || ds.cc.h;
        spec.y = spec.y || ds.cc.y;
        spec.fill = spec.fill || ds.cc.ctrlcolor;
        spec.opa = spec.opa || 0.4;
        spec.g.append("rect")
            .attr({"x": spec.x, "y": spec.y, "width": spec.w, "height": spec.h})
            .style({"fill": spec.fill, "fill-opacity": spec.opa,
                    "stroke": spec.fill});
    }


    function appendTriangle (spec) {
        var midh, xoff;
        spec.h = spec.h || ds.cc.h;
        spec.w = spec.w || Math.floor(ds.cc.icow / 2);
        spec.y = spec.y || ds.cc.y;
        midh = Math.round(spec.h / 2);
        xoff = spec.w;
        if(spec.orient === "right") {
            xoff *= -1; }
        spec.g.append("path")
            .attr("d", "M " + spec.x + " " + (spec.y + midh) +
                      " L " + (spec.x + xoff) + " " + spec.y +
                      " L " + (spec.x + xoff) + " " + (spec.y + spec.h) +
                      " Z")
            .style({"fill": ds.cc.ctrlcolor, "fill-opacity": 0.4,
                    "stroke": ds.cc.ctrlcolor});
    }


    function appendGroup (gname) {
        ds.cc[gname] = ds.cc.g.append("g")
            .attr("opacity", ds.cc.opacitybase)
        .on("mouseover", function () { 
            ds.cc[gname].attr("opacity", ds.cc.opacityactive); })
        .on("mouseout", function () {
            ds.cc[gname].attr("opacity", ds.cc.opacitybase); })
        .on("click", d3ckit[gname]);
    }


    function reflectPlayPause () {
        if(ds.autoplay && !ds.paused) {
            ds.cc.play.attr("opacity", 0.0);
            ds.cc.pause.attr("opacity", 1.0); }
        else {
            ds.cc.play.attr("opacity", 1.0);
            ds.cc.pause.attr("opacity", 0.0); }
    }


    function initControlContextValues (cc) {
        cc.w = cc.w || Math.round(cc.widthMultiple * ds.dw);
        cc.h = cc.h || Math.floor(cc.heightMultiple * ds.dh);
        cc.x = cc.x || 3;  //just inside the edge
        cc.y = cc.y || ds.dh - cc.h;
        cc.ctrlcolor = cc.ctrlcolor || ds.textcolor;
        cc.opacitybase = 0.6;
        cc.opacityactive = 1.0;
        cc.numctrls = 0;
        Object.keys(cc.controls).forEach(function (ckey) {
            if(cc.controls[ckey]) {
                cc.numctrls += 1; }});
        cc.secw = Math.round(cc.w / cc.numctrls);
        cc.padw = Math.round(cc.secw * cc.iconPadMultiple);
        cc.icow = cc.secw - cc.padw;
        cc.mw = Math.floor(ds.cc.icow / 2);  //mid width
        cc.qw = Math.floor(cc.icow / 4);     //quarter width
    }


    function displayControls () {
        var cc = ds.cc, oc = 0, xb;
        initControlContextValues(cc);
        cc.g = ds.cg.append("g");
        cc.g.append("rect")
            .attr({"x": cc.x, "y": cc.y, "width": cc.w, "height": cc.h})
            .style({"fill": "white", "fill-opacity": 0.3});
        if(cc.controls.restart) {
            appendGroup("restart");
            cc.bw = Math.round(0.15 * cc.icow);
            appendBar({g: cc.restart, w: cc.bw, x: cc.bw});
            appendTriangle({g: cc.restart, orient: "left", 
                            x: 2 * cc.bw});
            oc += 1; }
        if(cc.controls.rewind) {
            appendGroup("rewind");
            appendTriangle({g: cc.rewind, orient: "left", 
                            x: cc.x + (oc * cc.secw)});
            appendTriangle({g: cc.rewind, orient: "left", 
                            x: cc.x + (oc * cc.secw) + cc.mw});
            oc += 1; }
        if(cc.controls.previous) {
            appendGroup("previous");
            appendTriangle({g: cc.previous, orient: "left",
                            x: cc.x + (oc * cc.secw) + cc.qw});
            oc += 1; }
        if(cc.controls.playpause) {
            appendGroup("playpause");
            cc.play = cc.playpause.append("g").attr("opacity", 0.0);
            xb = cc.x + (oc * cc.secw) + cc.padw;
            appendTriangle({g: cc.play, orient: "right",
                            x: xb + cc.qw + cc.bw});
            cc.pause = cc.playpause.append("g").attr("opacity", 0.0);
            appendBar({g: cc.pause, w: cc.bw, x: xb - cc.bw});
            appendBar({g: cc.pause, w: cc.bw, x: xb, fill: "none", opa: 0.0});
            appendBar({g: cc.pause, w: cc.bw, x: xb + cc.bw});
            reflectPlayPause();
            oc += 1; }
        if(cc.controls.forward) {
            appendGroup("forward");
            appendTriangle({g: cc.forward, orient: "right",
                            x: cc.x + (oc * cc.secw) + (2 * cc.padw)});
            appendTriangle({g: cc.forward, orient: "right",
                            x: cc.x + (oc * cc.secw) + (2 * cc.padw) + cc.mw});
            oc += 1; }
    }


    function autoplayAsNeeded (delaytime) {
        if(ds.autoplay && !ds.paused) {
            delayf(function () {
                d3ckit.next(ds.transtime); }, delaytime, ds.svgid); }
    }


    function makeDemoDeck () {
        var deck = [
            //slide 0
            {display: function (transtime) {
                var text = d3.select("#hello");
                if(text.empty()) {
                    text = ds.cg.append("text")
                        .attr({"id": "hello", "x": 20, "y": 40, 
                               "fill": ds.textcolor, "fill-opacity": 0.0})
                        .style({"font-size": "18px", "font-weight": "bold",
                                "text-anchor": "left"})
                        .text("Hello"); }
                text.transition().duration(transtime / 2)
                    .attr("fill-opacity", 1.0); } },
            //slide 1
            {group: {id: "worldg"},
             display: function (transtime) {
                 var text = d3.select("#world");
                 if(text.empty()) {
                     text = ds.gs.worldg.append("text")
                         .attr({"id": "world", "x": 20, "y": 60, 
                                "fill": ds.textcolor, "fill-opacity": 0.0})
                         .style({"font-size": "18px", "font-weight": "bold",
                                 "text-anchor": "left"})
                         .text("World!"); }
                 text.transition().duration(transtime / 2)
                     .attr("fill-opacity", 1.0); },
             undo: function (transtime) {
                 d3.select("#world")
                     .transition().duration(transtime / 2)
                     .attr("fill-opacity", 0.0); } },
            //slide 2
            {display: function (transtime) {
                ds.gs.worldg.attr("transform", "translate(0,0)")
                    .transition().duration(transtime / 4)
                    .attr("transform", "translate(0,20)");
                var text = d3.select("#slideware");
                if(text.empty()) {
                    text = ds.cg.append("text")
                        .attr({"id": "slideware", "x": 20, "y": 60, 
                               "fill": ds.textcolor, "fill-opacity": 0.0})
                        .style({"font-size": "18px", "font-weight": "bold",
                                "text-anchor": "left"})
                        .text("D3 Slideware"); }
                text.transition().duration(transtime / 2)
                    .attr("fill-opacity", 1.0); },
             undo: function (transtime) {
                ds.gs.worldg.attr("transform", "translate(0,20)")
                    .transition().duration(transtime / 4)
                    .attr("transform", "translate(0,0)");
                 d3.select("#slideware")
                     .transition().duration(transtime / 2)
                     .attr("fill-opacity", 0.0); } }];
        return deck;
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    displaySettings: function () {
        return ds;
    },


    restart: function (running) {
        jt.out(ds.dispdivid, "");  //clear any previous output
        ds.svgid = "d3ckitsvg" + jt.ts();
        ds.didx = -1;
        ds.gs = {};
        if(!running) {
            d3ckit.run(); }
    },


    rewind: function () {
        var ts = ds.transtime;
        ds.transtime = ds.fastTransTime;
        d3ckit.previous();
        ds.transtime = ts;
    },


    previous: function () {
        var slide;
        if(ds.didx <= 0) {
            return; }
        slide = ds.deck[ds.didx];
        slide.transmult = slide.transmult || 1;
        if(slide.undo) {
            slide.undo(Math.round(slide.transmult * ds.transtime)); }
        ds.didx -= 1;
        ds.paused = true;
        reflectPlayPause();
    },


    playpause: function () {
        if(!ds.autoplay) {
            return d3ckit.next(); }
        ds.paused = !ds.paused;
        reflectPlayPause();
        if(!ds.paused) {
            return d3ckit.next(); }
    },


    next: function () {
        var slide, gd, pg, vg;
        if(ds.didx >= ds.deck.length - 1) {
            if(ds.endfunc) {
                return ds.endfunc(); }
            return; }  //already displayed last slide
        if(ds.autoplay && ds.paused) {
            return; }  //don't display next when paused
        ds.didx += 1;
        slide = ds.deck[ds.didx];
        if(slide.group) {
            gd = slide.group;   //easier to read
            vg = d3.select("#" + gd.id);
            if(vg.empty()) {    //need to create
                pg = ds.cg;     //default parent is the general content group
                if(gd.parentgid) {
                    pg = d3.select("#" + gd.parentgid); }
                if(gd.zbefore) {
                    vg = pg.insert("g", "#" + gd.zbefore); }
                else {
                    vg = pg.append("g"); }
                vg.attr("id", gd.id);
                ds.gs[gd.id] = vg; } }
        slide.transmult = slide.transmult || 1;
        if(slide.display) {
            slide.display(Math.round(slide.transmult * ds.transtime)); }
        autoplayAsNeeded(slide.transmult * ds.transtime);
    },


    forward: function () {
        var ts = ds.transtime;
        ds.transtime = ds.fastTransTime;
        d3ckit.playpause();
        ds.transtime = ts;
    },


    run: function () {
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(d3ckit.run, 300); }
        d3ckit.restart(true);
        ds.transtime = ds.transtime || ds.normTransTime;
        if(!ds.deck || !ds.deck.length) {
            ds.deck = makeDemoDeck(); }
        ds.dw = ds.w - (ds.margin.left + ds.margin.right);
        ds.dh = ds.h - (ds.margin.top + ds.margin.bottom);
        ds.svg = d3.select("#" + ds.dispdivid).append("svg")
            .attr("viewBox", "0 0 " + ds.w + " " + ds.h)
            .attr("preserveAspectRatio", "xMidYMin meet")
            .attr("id", ds.svgid);
        ds.globg = ds.svg.append("g")
            .attr("transform", "translate(" + ds.margin.left + "," + 
                                              ds.margin.top + ")");
        if(ds.svgsetupfunc) {  //hook point for appending svg:marker or whatever
            ds.svgsetupfunc(); }
        if(ds.moviescreen) {
            ds.globg.append("rect")
                .attr({"x": 0, "y": 0, "width": ds.dw, "height": 24})
                .style({"fill": "white", "opacity": 0.4})
                .transition().duration(ds.transtime).ease("exp")
                .attr("height", ds.dh); }
        ds.cg = ds.globg.append("g");  //general content group
        delayf(displayControls, ds.transtime, ds.svgid);
        if(ds.autoplay) {
            delayf(d3ckit.next, ds.transtime, ds.svgid); }
    }

};  //end of returned functions
}());


