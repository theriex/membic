/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge, for */

app.deckmembic = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        leftx = 10,         //vals and logic assume viewbox width 320
        midx = 140,
        toptxty = 20,
        line2y = 42,
        line3y = 68,
        line4y = 96,
        arrowopa = 0.8,
        stepv = {delay: 0, duration: 0, transtime: 800, numsteps: 2};

    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function stepinit (transtime, numsteps) {
        stepv.delay = 0;
        stepv.duration = 0;
        stepv.transtime = transtime;
        stepv.numsteps = numsteps;
    }


    function step (stepnum) {
        var steptime = Math.round(stepv.transtime / stepv.numsteps);
        stepv.delay = Math.max(0, stepnum - 1) * steptime;
        stepv.duration = steptime;
        return {delay: stepv.delay, duration: stepv.duration};
    }


    function makeMarkers () {
        var defs = ds.svg.append("svg:defs");
        defs.append("svg:marker")
	        .attr({"id": "arrowend", "orient": "auto", "opacity": arrowopa,
                   "refX": 2, "refY": 4.4,
                   "markerWidth": 8, "markerHeight": 8})
	        .append("svg:path")
	        .attr("d", "M2,2 L2,7 L6,4 Z");
	    defs.append("svg:marker")
	        .attr({"id": "arrowstart", "orient": "auto", "opacity": arrowopa,
                   "refX": 6, "refY": 4.4,
                   "markerWidth": 8, "markerHeight": 8})
	        .append("svg:path")
	        .attr("d", "M6,2 L6,7 L2,4 Z");
    }


    function showTextElem (timing, id, grpname, str, attrs) {
        var elem = d3.select("#" + id);
        attrs = attrs || {};
        if(elem.empty()) {
            elem = ds.gs[grpname].append("text")
                .attr({"id": id, 
                       "x": attrs.x || midx,
                       "y": attrs.y || toptxty,
                       "fill": ds.textcolor,
                       "opacity": 0.0,
                       "fill-opacity": 0.0})
                .style({"font-size": (attrs["font-size"] || "16px"),
                        "font-weight": (attrs["font-weight"] || "bold"),
                        "font-style": (attrs["font-style"] || "normal"),
                        "text-anchor": (attrs["text-anchor"] || "middle")})
                .text(str); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("fill-opacity", attrs.opacity || 1.0)
            .attr("opacity", attrs.opacity || 1.0);
        return elem;
    }


    function showLeftText (timing, id, grpname, str, attrs) {
        attrs = attrs || {};
        attrs["text-anchor"] = "left";
        showTextElem(timing, id, grpname, str, attrs);
    }


    function fadeInitGroup (timing, grpname, opacity) {
        if(ds.gs[grpname]) {
            ds.gs[grpname].attr("opacity", 0.0)
                .transition().delay(timing.delay).duration(timing.duration)
                .attr("opacity", opacity); }
    }


    function fadeGroup (timing, grpname, opacity) {
        if(ds.gs[grpname]) {
            ds.gs[grpname]
                .transition().delay(timing.delay).duration(timing.duration)
                .attr("opacity", opacity); }
    }


    function transElement (timing, id, attrs) {
        var elem = d3.select("#" + id);
        if(!elem.empty()) {
            attrs = attrs || {};
            if(attrs.tl) {
                attrs.transform = "translate(" + attrs.tl + ")"; }
            if(typeof attrs.opa === "number") {
                attrs.opacity = attrs.opa; }
            attrs.transform = attrs.transform || "translate(0,0)";
            if(typeof attrs.opacity !== "number") {
                attrs.opacity = 1.0; }
            if(typeof attrs.fillopa !== "number") {
                attrs.fillopa = attrs.opacity; }
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("transform", attrs.transform)
                .attr("opacity", attrs.opacity)
                .attr("fill-opacity", attrs.fillopa); }
    }


    //no starting opacity because that causes elements to suddenly re-appear
    function fadeElement (timing, id, opacity, remove) {
        var elem = d3.select("#" + id);
        if(!elem.empty()) {
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("opacity", opacity)
                .attr("fill-opacity", opacity);
            if(remove) {
                elem.remove(); } }
    }


    function showGraphic (timing, id, grpname, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = ds.gs[grpname].append("image")
                .attr({"xlink:href": attrs.href, "id": id,
                       "x": attrs.x, "y": attrs.y,
                       "width": attrs.w + "px",
                       "height": attrs.h + "px",
                       "opacity": 0.0}); }
        elem.attr("opacity", 0.0)
            .transition().delay(timing.delay).duration(timing.duration)
            .attr("opacity", attrs.opacity || 1.0);
        return elem;
    }


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


    function drawBox (timing, id, grpname, attrs) {
        var style = {}, g, elem;
        attrs = attrs || {};
        attrs.x = attrs.x || 0;
        attrs.y = attrs.y || 0;
        attrs.width = attrs.w || attrs.width || attrs.height;
        attrs.height = attrs.h || attrs.height || attrs.width;
        attrs.id = id;
        attrs.stropa = attrs.stropa || attrs["stroke-opacity"] || 0.5;
        attrs["stroke-opacity"] = 0.0;
        style.fill = attrs.fill || "none";
        style.stroke = attrs.stroke || ds.textcolor;
        g = ds.gs[grpname];
        elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = g.append("rect")
                .attr(attrs)
                .style(style); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("stroke-opacity", attrs.stropa);
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
        showTextElem(timing, "cbkeywords", grpname, "Keywords",
                     {x: kx, y: ky, "font-size": "14px", 
                      "text-anchor": "start"});
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


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function linkComponents () { var numsteps = 10; return {
        group: {id: "gLC"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f, ic;
            f = {x: leftx + 110, g: "gLC"};
            ic = {w: 20, x: leftx + 104, y2: 26, y3: 52, y4: 78};
            stepinit(transtime, numsteps);
            sv = step(1); //-------------------------------
            fadeInitGroup(sv, f.g, 1.0);
            showLeftText(sv, "lcurl", f.g, "URL", 
                         {x: leftx + 30, y: line3y}); 
            showLeftText(sv, "lcor", f.g, "or", 
                         {x: leftx + 74, y: line3y, "font-size": "14px"}); 
            sv = step(2); //-------------------------------
            showGraphic(sv, "imgarticle", f.g,
                        {x: ic.x, y: ic.y2, w: ic.w, h: ic.w,
                         href: "img/TypeArticle50.png"});
            showLeftText(sv, "ta", f.g, "Title, Author", {x: f.x2, y: line2y});
            sv = step(3); //-------------------------------
            fadeElement(sv, "imgarticle", 0.0);
            showGraphic(sv, "imgbook", f.g,
                        {x: ic.x, y: ic.y2, w: ic.w, h: ic.w,
                         href: "img/TypeBook50.png"});
            sv = step(4); //-------------------------------
            showGraphic(sv, "imgvideo", f.g,
                        {x: ic.x, y: ic.y3, w: ic.w, h: ic.w,
                         href: "img/TypeVideo50.png"});
            showLeftText(sv, "tr", f.g, "Title, Artist", {x: f.x2, y: line3y});
            sv = step(5); //-------------------------------
            fadeElement(sv, "imgvideo", 0.0);
            showGraphic(sv, "imgmusic", f.g,
                        {x: ic.x, y: ic.y3, w: ic.w, h: ic.w,
                         href: "img/TypeSong50.png"});
            sv = step(6); //-------------------------------
            showGraphic(sv, "imgact", f.g,
                        {x: ic.x, y: ic.y4, w: ic.w, h: ic.w,
                         href: "img/TypeActivity50.png"});
            showLeftText(sv, "na", f.g, "Name, Address", {x: f.x2, y: line4y});
            sv = step(7); //-------------------------------
            fadeElement(sv, "imgact", 0.0);
            showGraphic(sv, "imgyum", f.g,
                        {x: ic.x, y: ic.y4, w: ic.w, h: ic.w,
                         href: "img/TypeYum50.png"});
            sv = step(8); //-------------------------------
            fadeElement(sv, "imgbook", 0.0);
            fadeElement(sv, "ta", 0.0);
            showLeftText(sv, "lcunique", f.g, "Unique", {x: f.x, y: line2y});
            //sv = step(9); //-------------------------------
            fadeElement(sv, "imgmusic", 0.0);
            fadeElement(sv, "tr", 0.0);
            showLeftText(sv, "lcid", f.g, "Identifying", {x: f.x, y: line3y});
            //sv = step(10); //-------------------------------
            fadeElement(sv, "imgyum", 0.0);
            fadeElement(sv, "na", 0.0);
            showLeftText(sv, "lcfields", f.g, "Fields", {x: f.x, y: line4y});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gLC", 0.0);
        }
    }; }
            

    function membicComponents () { var numsteps = 14; return {
        group: {id: "gMC"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f;
            f = {x: leftx + 30, g: "gMC"};
            stepinit(transtime, numsteps);
            sv = step(1); //-------------------------------
            fadeElement(sv, "lcor", 0.0);
            transElement(sv, "lcunique", {tl: "-93,8", opa: 0.4});
            transElement(sv, "lcid",     {tl: "-93,0", opa: 0.4});
            transElement(sv, "lcfields", {tl: "-93,-8", opa: 0.4});
            fadeInitGroup(sv, f.g, 1.0);
            sv = step(2); //-------------------------------
            showLeftText(sv, "link", f.g, "Link", {x: 38, y: line3y});
            fadeGroup(sv, "gLC", 0.0);
            drawBox(sv, "linkframe", f.g, {x: 26, y: 36, w: 60, stropa: 0.8});
            sv = step(3); //-------------------------------
            showLeftText(sv, "strel", f.g, "Relevance",  {x: 100, y: 46});
            sv = step(4); //-------------------------------
            showLeftText(sv, "stimp", f.g, "Importance", {x: 100, y: 66});
            sv = step(5); //-------------------------------
            showLeftText(sv, "stqua", f.g, "Quality",    {x: 100, y: 86});
            sv = step(6); //-------------------------------
            showLeftText(sv, "stpri", f.g, "Primacy",    {x: 100, y: 106});
            sv = step(7); //-------------------------------
            showLeftText(sv, "staff", f.g, "Affinity",   {x: 100, y: 126});
            sv = step(8); //-------------------------------
            transElement(sv, "strel", {opa: 0.0, tl: "0,0"});
            transElement(sv, "stimp", {opa: 0.0, tl: "0,-20"});
            transElement(sv, "stqua", {opa: 0.0, tl: "0,-40"});
            transElement(sv, "stpri", {opa: 0.0, tl: "0,-60"});
            transElement(sv, "staff", {opa: 0.0, tl: "0,-80"});
            drawStars(sv, f.g);
            sv = step(10); //-------------------------------
            drawKeywords(sv, f.g);
            sv = step(12); //-------------------------------
            showLeftText(sv, "whymem", f.g, "Why is this memorable?", 
                         {x: 100, y: 72, 
                          "font-style": "italic"});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gMC", 0.0);
            fadeGroup(sv, "gLC", 1.0);
            fadeElement(sv, "lcor", 1.0);
            transElement(sv, "lcunique");
            transElement(sv, "lcid");
            transElement(sv, "lcfields");
        }
    }; }


    function makeAMembic () { var numsteps = 3; return {
        group: {id: "gMM"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, f = {x: 46, g: "gMM"};
            stepinit(transtime, numsteps);
            sv = step(1); //-------------------------------
            fadeGroup(sv, "gMC", 0.0);
            fadeInitGroup(sv, f.g, 1.0);
            showLeftText(sv, "mmwhen", f.g, 
                         "When you find something",
                         {x: f.x, y: line2y});
            showLeftText(sv, "mmworth", f.g, 
                         "worth remembering,",
                         {x: f.x, y: line3y});
            sv = step(3); //-------------------------------
            showLeftText(sv, "mmake", f.g, "make a membic.", 
                         {x: f.x, y: line4y});
            showGraphic(sv, "imgwrite", f.g,
                        {x: 187, y: 84, w: 55, h: 47,
                         href: "img/writenew.png"});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gMM", 0.0);
            fadeGroup(sv, "gMC", 1.0);
        }
    }; }


    function initSlides (d3ckitds) {
        ds = d3ckitds;
        ds.deck = [
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
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(function () {
                app.deckmembic.run(autoplay); }, 300); }
        ds = d3ckit.displaySettings();
        ds.svgsetupfunc = makeMarkers;
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

