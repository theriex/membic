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
              w: 600, h: 342,          //default viewbox dims (MacAir max)
              margin: {top: 10, right: 10, bottom: 10, left: 10},
              normTransTime: 1600,
              fastTransTime: 200,  //essentially instant, but subdivisions > 0
              moviescreen: true, textcolor: "black",
              autoplay: false, paused: false,
              //working variables
              didx: -1, svgid: null, gs: {}, 
              cc: {heightMultiple: 0.03, widthMultiple: 0.2,
                   iconPadMultiple: 0.3}};


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


    function displayControls () {
        var cc = ds.cc, secw, barw, midw, qw, xbase;
        cc.w = cc.w || Math.round(cc.widthMultiple * ds.dw);
        cc.h = cc.h || Math.floor(cc.heightMultiple * ds.dh);
        cc.x = cc.x || 3;  //just inside the edge
        cc.y = cc.y || ds.dh - cc.h;
        cc.ctrlcolor = cc.ctrlcolor || ds.textcolor;
        cc.opacitybase = 0.6;
        cc.opacityactive = 1.0;
        secw = Math.round(cc.w / 5);
        cc.padw = Math.round(secw * cc.iconPadMultiple);
        cc.icow = secw - cc.padw;
        midw = Math.floor(ds.cc.icow / 2);
        qw = Math.floor(cc.icow / 4);
        cc.g = ds.cg.append("g");
        cc.g.append("rect")
            .attr({"x": cc.x, "y": cc.y, "width": cc.w, "height": cc.h})
            .style({"fill": "white", "fill-opacity": 0.3});
        //restart
        appendGroup("restart");
        barw = Math.round(0.15 * cc.icow);
        appendBar({g: cc.restart, w: barw, x: barw});
        appendTriangle({g: cc.restart, orient: "left", 
                        x: 2 * barw});
        //rewind
        appendGroup("rewind");
        appendTriangle({g: cc.rewind, orient: "left", 
                        x: cc.x + secw});
        appendTriangle({g: cc.rewind, orient: "left", 
                        x: cc.x + secw + midw});
        //previous
        appendGroup("previous");
        appendTriangle({g: cc.previous, orient: "left",
                        x: cc.x + (2 * secw) + qw});
        //playpause
        appendGroup("playpause");
        cc.play = cc.playpause.append("g").attr("opacity", 0.0);
        xbase = cc.x + (3 * secw) + cc.padw;
        appendTriangle({g: cc.play, orient: "right",
                        x: xbase + qw + barw});
        cc.pause = cc.playpause.append("g").attr("opacity", 0.0);
        appendBar({g: cc.pause, w: barw, x: xbase - barw});
        appendBar({g: cc.pause, w: barw, x: xbase, fill: "none", opa: 0.0});
        appendBar({g: cc.pause, w: barw, x: xbase + barw});
        reflectPlayPause();
        //forward
        appendGroup("forward");
        appendTriangle({g: cc.forward, orient: "right",
                        x: cc.x + (4 * secw) + (2 * cc.padw)});
        appendTriangle({g: cc.forward, orient: "right",
                        x: cc.x + (4 * secw) + (2 * cc.padw) + midw});
    }


    function autoplayAsNeeded () {
        if(ds.autoplay && !ds.paused) {
            delayf(function () {
                d3ckit.next(ds.normTransTime); },
                   ds.normTransTime, ds.svgid); }
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
            {creategroup: "worldg",
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
        if(slide.undo) {
            slide.undo(ds.transtime); }
        ds.didx -= 1;
        autoplayAsNeeded();
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
        var slide;
        if(ds.didx >= ds.deck.length - 1) {
            return; }  //already displayed last slide
        if(ds.autoplay && ds.paused) {
            return; }  //don't display next when paused
        ds.didx += 1;
        slide = ds.deck[ds.didx];
        if(slide.creategroup && !ds.gs[slide.creategroup]) {
            ds.gs[slide.creategroup] = ds.cg.append("g"); }
        if(slide.display) {
            slide.display(ds.transtime); }
        autoplayAsNeeded();
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


