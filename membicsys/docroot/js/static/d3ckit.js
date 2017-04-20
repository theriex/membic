/*global window, d3, jt */
/*jslint browser, multivar, white, fudge */

/***********

Objects:
  - Display: Top level object passed to initDisplay.  Fields:
    - divid: id of div where the SVG should be
    - deckStartFunc: optional function to call on start (else autoplay)
    - deckFinishFunc: optional function to call ater last slide
    - decks: array of decks to play
  - Deck: Container for one or more slides.  Fields:
    - deckname: unique name used to identify the deck within the display
    - slides: array of slides (if not defined, initialized from getSlides call)
  - Slide: Array of one or more bullets
  - Bullet: A function that does something svg (text, graphics etc)
Each slide is treated as independent of sequencing, so bullet funcs for a
slide should only access elements introduced within that slide.  Bullet
functions may be called more than once if someone clicks to go back to the
previous point.

SlideFades are functions that visually clear the last displayed slide.  They
can be defined in a circular array and applied round robin to clear the
currently finished slide.  All SlideFades end with setting the finished
slide SVG g element to opacity 0.  Moving to the previous slide sets that
slide.g to 1.

A slide deck can be in "manual" mode where each slide is displayed in
response to click/space/enter, or it can be in "animate" mode where the
slideshow proceeds automatically.  The timing for each bullet is done
according to some multiple of a global tempo.  A muliplier of 1.0 means one
standard beat as defined in the display.  A g element is added for each
slide, and for each bullet within a slide.  Bullets are additive and cleaned
up when the slide is transitioned out.  If you reverse within a slide,
elements within the current bullet g are removed.

***********/

var d3ckit = {};

d3ckit = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var cc = {heightMultiple: 0.08, widthMultiple: 0.6,
              iconPadMultiple: 0.6,
              controls: {restart: true,    // |<  Start of deck
                         rewind: true,     // <<  Previous slide
                         previous: true,   // <   Previous bullet
                         playpause: true,  // > or || Next bullet or Pause
                         forward: true,    // >>  Next slide
                         exit: true}},     // >|  Last slide
        bto = null,    //bullet display sequencing timeout
        dds = null,    //local copy of display passed to initDisplay
        arropa = 0.8;  //tone down arrows slightly so not too stark


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function delayf (func, delay, currdeckidx) {
        delay = Math.round(delay);
        //jt.log("delayf: " + delay);
        if(bto) {
            jt.log("delayf already waiting, clear existing timeout first");
            return; }
        bto = setTimeout(function () {
            if(dds && dds.deckidx !== currdeckidx) {
                jt.log("delayf aborting, deckidx mismatch: " + currdeckidx + 
                       ", " + dds.deckidx);
                return; }  //the deck has changed in the meantime
            bto = null;
            func(); }, delay);
    }


    function appendLine (spec) {
        spec.y = cc.y + Math.round(0.5 * cc.h);
        spec.w = Math.round(0.9 * cc.icow);
        spec.h = Math.round(0.1 * cc.h);
        spec.fill = spec.fill || cc.ctrlcolor;
        if(typeof spec.opa !== "number") {
            spec.opa =  0.4; }
        spec.g.append("rect")
            .attr({"x": spec.x, "y": spec.y, "width": spec.w, "height": spec.h})
            .style({"fill": spec.fill, "fill-opacity": spec.opa,
                    "stroke": spec.fill});
    }


    function appendBar (spec) {
        spec.h = spec.h || cc.h;
        spec.y = spec.y || cc.y;
        spec.fill = spec.fill || cc.ctrlcolor;
        if(typeof spec.opa !== "number") {
            spec.opa =  0.4; }
        spec.g.append("rect")
            .attr({"x": spec.x, "y": spec.y, "width": spec.w, "height": spec.h})
            .style({"fill": spec.fill, "fill-opacity": spec.opa,
                    "stroke": spec.fill});
    }


    function appendTriangle (spec) {
        var midh, xoff;
        spec.h = spec.h || cc.h;
        spec.w = spec.w || Math.floor(cc.icow / 2);
        spec.y = spec.y || cc.y;
        midh = Math.round(spec.h / 2);
        xoff = spec.w;
        if(spec.orient === "right") {
            xoff *= -1; }
        spec.g.append("path")
            .attr("d", "M " + spec.x + " " + (spec.y + midh) +
                      " L " + (spec.x + xoff) + " " + spec.y +
                      " L " + (spec.x + xoff) + " " + (spec.y + spec.h) +
                      " Z")
            .style({"fill": cc.ctrlcolor, "fill-opacity": 0.4,
                    "stroke": cc.ctrlcolor});
    }


    function appendGroup (gname, title) {
        cc[gname] = cc.g.append("g")
            .attr("opacity", cc.opacitybase)
            .on("mouseover", function () { 
                cc[gname].attr("opacity", cc.opacityactive); })
            .on("mouseout", function () {
                cc[gname].attr("opacity", cc.opacitybase); })
            .on("click", d3ckit[gname]);
        cc[gname].append("svg:title").text(title);
    }


    function fadeOpaControls (ctrls, opa) {
        var oos = dds.opas;
        if(!ctrls) {
            ctrls = Object.keys(oos); }
        ctrls.forEach(function (key) {
            if(oos[key]) {
                oos[key].g.attr("opacity", opa); } });
    }


    function reflectPlayPause () {
        if(!dds.opas) {
            return; } //controls not initialized yet, so nothing to do
        fadeOpaControls(null, 0.0);  //hide all pause sensitive controls
        if(dds.paused === "pausing") {
            fadeOpaControls(["rwdis", "prevdis", "ppdis", "fwdis"], 1.0); }
        else if(dds.paused === "paused" || dds.dispmode !== "animate") {
            fadeOpaControls(["rwact", "prevact", "play", "fwact"], 1.0); }
        else {  //animate and not pausing in any way
            fadeOpaControls(["rwact", "prevact", "pause", "fwact"], 1.0); }
    }


    function initControlContextValues (cc) {
        cc.w = cc.w || Math.round(cc.widthMultiple * dds.dw);
        cc.h = cc.h || Math.floor(cc.heightMultiple * dds.dh);
        cc.x = cc.x || 3;  //just inside the edge
        cc.y = cc.y || dds.dh - cc.h;
        cc.ctrlcolor = cc.ctrlcolor || dds.textcolor;
        cc.opacitybase = 0.6;
        cc.opacityactive = 1.0;
        cc.numctrls = 0;
        Object.keys(cc.controls).forEach(function (ckey) {
            if(cc.controls[ckey]) {
                cc.numctrls += 1; }});
        cc.secw = Math.round(cc.w / cc.numctrls);
        cc.padw = Math.round(cc.secw * cc.iconPadMultiple);
        cc.icow = cc.secw - cc.padw;
        cc.mw = Math.floor(cc.icow / 2);  //mid width
        cc.qw = Math.floor(cc.icow / 4);     //quarter width
        dds.opas = dds.opas || {};
    }


    function displayControls () {
        var oc = 0, xb;
        initControlContextValues(cc);
        cc.g = dds.globg.append("g").attr("id", "d3ckitDisplayControls");
        cc.g.append("rect")
            .attr({"x": cc.x, "y": cc.y, "width": cc.w, "height": cc.h})
            .style({"fill": "white", "fill-opacity": 0.3});
        cc.bw = Math.round(0.15 * cc.icow);
        if(cc.controls.restart) {  //always active
            appendGroup("restart", "Restart");
            appendBar({g: cc.restart, w: cc.bw, x: cc.bw});
            appendTriangle({g: cc.restart, orient: "left", 
                            x: (3 * cc.bw)});
            oc += 1; }
        if(cc.controls.rewind) {  //"rewind" control disabled while pausing
            appendGroup("rewind", "Rewind");
            cc.rwact = cc.rewind.append("g").attr("opacity", 0.0);
            appendTriangle({g: cc.rwact, orient: "left", 
                            x: cc.x + (oc * cc.secw)});
            appendTriangle({g: cc.rwact, orient: "left", 
                            x: cc.x + (oc * cc.secw) + cc.mw});
            dds.opas.rwact = {g: cc.rwact, o: 0.0};
            cc.rwdis = cc.rewind.append("g").attr("opacity", 0.0);
            appendLine({g: cc.rwdis, x: cc.x + (oc * cc.secw)});
            dds.opas.rwdis = {g: cc.rwdis, o: 0.0};
            oc += 1; }
        if(cc.controls.previous) {  //"previous" control disabled while pausing
            appendGroup("previous", "Previous Slide");
            cc.prevact = cc.previous.append("g").attr("opacity", 0.0);
            appendTriangle({g: cc.prevact, orient: "left",
                            x: cc.x + (oc * cc.secw) + cc.qw});
            dds.opas.prevact = {g: cc.prevact, o: 0.0};
            cc.prevdis = cc.previous.append("g").attr("opacity", 0.0);
            appendLine({g: cc.prevdis, x: cc.x + (oc * cc.secw)});
            dds.opas.prevdis = {g: cc.prevdis, o: 0.0};
            oc += 1; }
        if(cc.controls.playpause) {  //"playpause" ctrl disabled while pausing
            appendGroup("playpause", "Play/Pause");
            cc.play = cc.playpause.append("g").attr("opacity", 0.0);
            xb = cc.x + (oc * cc.secw) + cc.padw;
            appendTriangle({g: cc.play, orient: "right",
                            x: xb + cc.qw + cc.bw});
            dds.opas.play = {g: cc.play, o: 0.0};
            cc.pause = cc.playpause.append("g").attr("opacity", 0.0);
            appendBar({g: cc.pause, w: cc.bw, x: xb - (2 * cc.bw)});
            appendBar({g: cc.pause, w: cc.bw, x: xb, fill: "none", opa: 0.0});
            appendBar({g: cc.pause, w: cc.bw, x: xb + (2 * cc.bw)});
            dds.opas.pause = {g: cc.pause, o: 0.0};
            cc.ppdis = cc.playpause.append("g").attr("opacity", 0.0);
            appendLine({g: cc.ppdis, x: xb - (2 * cc.bw)});
            dds.opas.ppdis = {g: cc.ppdis, o: 0.0};
            oc += 1; }
        if(cc.controls.forward) {  //"forward" ctrl disabled while pausing
            appendGroup("forward", "Fast Forward");
            cc.fwact = cc.forward.append("g").attr("opacity", 0.0);
            appendTriangle({g: cc.fwact, orient: "right",
                            x: cc.x + (oc * cc.secw) + cc.padw + cc.mw});
            appendTriangle({g: cc.fwact, orient: "right",
                            x: cc.x + (oc * cc.secw) + cc.padw + (2 * cc.mw)});
            dds.opas.fwact = {g: cc.fwact, o: 0.0};
            cc.fwdis = cc.forward.append("g").attr("opacity", 0.0);
            appendLine({g: cc.fwdis, x: cc.x + (oc * cc.secw)});
            dds.opas.fwdis = {g: cc.fwdis, o: 0.0};
            oc += 1; }
        if(cc.controls.exit) {
            appendGroup("exit", "Exit Slide Deck");
            xb = cc.x + (oc * cc.secw) + (2 * cc.padw);
            appendTriangle({g: cc.exit, orient: "right", x: xb});
            appendBar({g: cc.exit, w: cc.bw, x: xb + cc.bw});
            oc += 1; }
        reflectPlayPause();  //show active controls
    }


    function handleKeyDown (e) {
        if(e && (e.charChode || e.keyCode) && dds.cmap) {
            Object.keys(dds.cmap).forEach(function (cname) {
                dds.cmap[cname].forEach(function (ukey) {
                    var code, uc;
                    if(typeof ukey !== "string") {
                        code = ukey;
                        uc = ukey; }
                    else {
                        code = ukey.charCodeAt(0);
                        uc = ukey.toUpperCase().charCodeAt(0); }
                    if(e.charCode === code || e.keyCode === code ||
                       e.charChode === uc || e.keyCode === uc) {
                        d3ckit[cname]();
                        if(dds.eatCharEvents) {
                            if(e.preventDefault) {
                                e.preventDefault(); }
                            else {
                                e.returnValue = false; }
                            if(e.stopPropagation) {
                                e.stopPropagation(); }
                            else {
                                e.cancelBubble = true; } } } }); }); }
    }


    function handleKeyPress (e) {
        if(e && (e.charCode === 13 || e.keyCode === 13)) {  //ENTER
            d3ckit.playpause(); }
    }


    function makeMarkers () {  //call this function only once
        var defs = dds.svg.append("svg:defs");
        defs.append("svg:marker")
	        .attr({"id": "arrowend", "orient": "auto", "opacity": arropa,
                   "refX": 2, "refY": 4.4,
                   "markerWidth": 8, "markerHeight": 8})
	        .append("svg:path")
	        .attr("d", "M2,2 L2,7 L6,4 Z");
	    defs.append("svg:marker")
	        .attr({"id": "arrowstart", "orient": "auto", "opacity": arropa,
                   "refX": 6, "refY": 4.4,
                   "markerWidth": 8, "markerHeight": 8})
	        .append("svg:path")
	        .attr("d", "M6,2 L6,7 L2,4 Z");
    }


    function holdMinimumDivSize (divid) {
        var div = jt.byId(divid);
        div.style.minHeight = String(div.offsetHeight) + "px";
        div.style.minWidth = String(div.offsetWidth) + "px";
    }


    function currdeck () {
        return dds.decks[dds.deckidx];
    }


    function displayBullet () {
        var deck, slide, bullet, bid, ttlt;
        deck = currdeck();
        slide = deck.slides[deck.slideidx];
        bullet = slide[slide.bulletidx];
        //bullet.g may be left over from a previous display while the actual
        //g element has been removed.
        bid = slide.id + "B" + slide.bulletidx;
        //jt.log("displayBullet: " + bid);
        if(!jt.byId(bid)) {  //not already displayed
            bullet.g = slide.g.append("g");
            bullet.id = bid;
            bullet.undo = []; }
        ttlt = bullet(bullet);
        if((dds.dispmode === "animate") && !dds.paused) {
            delayf(function () { d3ckit.next(); }, ttlt, dds.deckidx); }
    }


    function defaultSlideFade (slide) {
        slide.g.transition().duration(dds.beatlen)
            .attr("opacity", 0.0);
    }


    function fadeSlide (slide) {
        dds.slideFades = dds.slideFades || [defaultSlideFade];
        dds.slideFadeIdx = dds.slideFadeIdx || 0;
        dds.slideFades[dds.slideFadeIdx](slide);
        dds.slideFadeIdx += 1;
        dds.slideFadeIdx = dds.slideFadeIdx % dds.slideFades.length;
    }


    function memoizeFadeElementUndo (context, id, opacity) {
        var timing = {delay:0, duration:dds.ffrwlen};
        opacity = 1.0 - opacity;
        context.undo.push(function () {
            d3ckit.fadeElement(context, id, timing, opacity); });
    }


    function memoizeTransElementUndo (context, id, attrs) {
        var timing = {delay:0, duration:dds.ffrwlen};
        context.undo.push(function () {
            d3ckit.transElement(context, id, timing, {
                transform: "translate(0,0)",
                opacity: 1.0 - attrs.opacity,
                fillopa: 1.0 - attrs.fillopa}); });
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    timing: function (multiple) {
        var ms;
        multiple = multiple || 1.0;
        ms = Math.round(multiple * dds.beatlen);
        return {delay:0, duration:ms};
    },


    totalTime: function (timing) {
        return timing.delay + timing.duration;
    },


    showText: function (context, id, str, timing, attrs) {
        var elem;
        timing = timing || d3ckit.timing();
        attrs = attrs || {};
        attrs["font-size"] = attrs.fs || attrs["font-size"] || "16px";
        attrs["font-weight"] = attrs.fw || attrs["font-weight"] || "bold";
        attrs["font-style"] = attrs.fe || attrs["font-style"] || "normal";
        attrs["text-anchor"] = attrs.ta || attrs["text-anchor"] || "start";
        if(typeof attrs.opa === "number") {
            attrs.opacity = attrs.opa; }
        if(typeof attrs.opacity !== "number") {
            attrs.opacity = 1.0; }
        elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = context.g.append("text")
                .attr({"id": id, 
                       "x": attrs.x || 140,
                       "y": attrs.y || 20,
                       "fill": dds.textcolor,
                       "opacity": 0.0,
                       "fill-opacity": 0.0})
                .style({"font-size": attrs["font-size"],
                        "font-weight": attrs["font-weight"],
                        "font-style": attrs["font-style"],
                        "text-anchor": attrs["text-anchor"]})
                .text(str); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("fill-opacity", attrs.opacity)
            .attr("opacity", attrs.opacity);
        return elem;
    },


    showGraphic: function (context, id, timing, attrs) {
        var elem;
        timing = timing || d3ckit.timing();
        elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = context.g.append("image")
                .attr({"xlink:href": attrs.href, "id": id,
                       "x": attrs.x, "y": attrs.y,
                       "width": (attrs.w || attrs.h || 50) + "px",
                       "height": (attrs.h || attrs.w) + "px",
                       "opacity": 0.0}); }
        if(typeof attrs.opacity !== "number") {
            attrs.opacity = 1.0; }
        elem.attr("opacity", 0.0)
            .transition().delay(timing.delay).duration(timing.duration)
            .attr("opacity", attrs.opacity);
        return elem;
    },


    //no starting opacity or previously faded elements will suddenly flash
    //back into existence before fading again.  referenced elements may be
    //from other bullets, so this memoizes an undo to invert the opacity.
    //if remove is true, then no undo is memoized.
    fadeElement: function (context, ids, timing, opacity, remove) {
        if(typeof ids === "string") {
            ids = [ids]; }
        ids.forEach(function (id) {
            var elem = d3.select("#" + id);
            if(!elem.empty()) {
                elem.transition().delay(timing.delay).duration(timing.duration)
                    .attr("opacity", opacity)
                    .attr("fill-opacity", opacity);
                if(remove) {
                    elem.remove(); }
                else {
                    memoizeFadeElementUndo(context, id, opacity); } } });
    },


    //similar to fadeElement but also handles coordinate translation. The
    //translation undo returns to 0,0.
    transElement: function (context, ids, timing, attrs) {
        if(typeof ids === "string") {
            ids = [ids]; }
        ids.forEach(function (id) {
            var elem = d3.select("#" + id);
            if(!elem.empty()) {
                attrs = attrs || {};
                if(attrs.tl) {
                    attrs.transform = "translate(" + attrs.tl + ")"; }
                attrs.transform = attrs.transform || "translate(0,0)";
                if(typeof attrs.opa === "number") {
                    attrs.opacity = attrs.opa; }
                if(typeof attrs.opacity !== "number") {
                    attrs.opacity = 1.0; }
                if(typeof attrs.fillopa !== "number") {
                    attrs.fillopa = attrs.opacity; }
                elem.transition().delay(timing.delay).duration(timing.duration)
                    .attr("transform", attrs.transform)
                    .attr("opacity", attrs.opacity)
                    .attr("fill-opacity", attrs.fillopa);
                memoizeTransElementUndo(context, id, attrs); } });
    },


    drawBox: function (context, id, timing, attrs) {
        var style = {}, elem;
        attrs = attrs || {};
        attrs.x = attrs.x || 0;
        attrs.y = attrs.y || 0;
        attrs.rx = attrs.rx || 0;
        attrs.ry = attrs.ry || 0;
        attrs.width = attrs.w || attrs.width || attrs.height;
        attrs.height = attrs.h || attrs.height || attrs.width;
        attrs.id = id;
        attrs.stropa = attrs.stropa || attrs["stroke-opacity"] || 0.5;
        attrs["stroke-opacity"] = 0.0;
        style.fill = attrs.fill || "none";
        style.stroke = attrs.stroke || dds.textcolor;
        elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = context.g.append("rect")
                .attr(attrs)
                .style(style); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("stroke-opacity", attrs.stropa);
    },


    drawArrow: function (context, id, timing, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            var mx, my, start = {x1: attrs.x1, y1: attrs.y1,
                                 x2: attrs.x1 + 1, y2: attrs.y1 + 1};
            if(attrs["marker-start"]) {
                mx = attrs.x1 + Math.round((attrs.x2 - attrs.x1) / 2);
                my = attrs.y1 + Math.round((attrs.y2 - attrs.y1) / 2);
                start.x1 = mx - 1;
                start.x2 = mx + 1;
                start.y1 = my - 1;
                start.y2 = my + 1; }
            elem = context.g.append("line")
                .attr({"id": id,
                       "x1": start.x1, "y1": start.y1,
                       "x2": start.x2, "y2": start.y2,
                       "marker-start": attrs["marker-start"],
                       "marker-end": "url(#arrowend)",
                       "opacity": 0.0,
                       "stroke-opacity": 0.0})
                .style({"stroke": dds.textcolor,
                        "stroke-width": 1.5,
                        "fill": "red"}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("x1", attrs.x1)
            .attr("x2", attrs.x2)
            .attr("y1", attrs.y1)
            .attr("y2", attrs.y2)
            .attr("opacity", arropa)
            .attr("stroke-opacity", arropa);
        return elem;
    },


    restart: function () {
        d3ckit.displayDeck();  //clears all display elements
    },


    rewind: function () {
        var deck, slide;
        if(dds.paused === "pausing") {
            return; }  //do nothing until pause settles
        if(dds.paused !== "paused") {
            dds.paused = "pausing";
            dds.afterpausing = d3ckit.rewind;
            reflectPlayPause();
            return; }
        deck = currdeck();
        if(deck.slideidx <= 0) {
            return; }  //no previous slide to display
        dds.beatlen = dds.ffrwlen;
        slide = deck.slides[deck.slideidx];
        slide.g.selectAll("*").remove();
        slide.forEach(function (bullet) {
            bullet.g = null; });
        deck.slideidx -= 1;
        slide.g.transition().duration(dds.beatlen)
            .attr("opacity", 1.0);
        dds.beatlen = dds.normlen;
    },


    previous: function () {
        var deck, slide, bullet;
        if(dds.paused === "pausing") {
            return; }  //do nothing until pause settles
        if(dds.paused !== "paused") {
            dds.paused = "pausing";
            dds.afterpausing = d3ckit.previous;
            reflectPlayPause();
            return; }
        deck = currdeck();
        slide = deck.slides[deck.slideidx];
        if(slide.bulletidx <= 0) {
            return; }  //no previous bullet to display
        dds.beatlen = dds.ffrwlen;
        bullet = slide[slide.bulletidx];
        bullet.undo.forEach(function (undof) { 
            undof();
        });
        bullet.g.selectAll("*").remove();
        slide.bulletidx -= 1;
        dds.beatlen = dds.normlen;
    },


    playpause: function () {
        //Toggling play|pause only makes sense when automatically playing,
        //otherwise it is equivalent to clicking next
        if(dds.dispmode !== "animate") {
            return d3ckit.next(); }
        //Actual pause happens after the current bullet func finishes.
        if(!dds.paused) {
            dds.paused = "pausing";
            reflectPlayPause(); }
        //Wait for pause to stabilize, regardless of any interim clicks
        if(dds.paused === "pausing") {
            return; }
        //After stable pause, resume play
        if(dds.paused === "paused") {
            dds.paused = false;
            reflectPlayPause();
            d3ckit.next(); }
    },


    next: function () {
        var deck, slide, pf;
        if(dds.dispmode === "animate" && dds.paused === "pausing") {
            dds.paused = "paused";
            reflectPlayPause();
            if(dds.afterpausing) { 
                pf = dds.afterpausing;
                dds.afterpausing = null;
                return pf(); }
            return; }
        deck = currdeck();
        if(!deck.started) {
            deck.started = true;
            deck.ig.transition().duration(dds.beatlen).attr("opacity", 0.0);
            return delayf(d3ckit.next, dds.beatlen, dds.deckidx); }
        slide = deck.slides[deck.slideidx];
        //more bullets on slide...
        if(slide.bulletidx < slide.length - 1) {
            slide.bulletidx += 1;
            return displayBullet(); }
        //more slides in deck...
        if(deck.slideidx < deck.slides.length - 1) {
            fadeSlide(slide);
            deck.slideidx += 1;
            slide = deck.slides[deck.slideidx];
            slide.bulletidx = 0;
            return displayBullet(); }
        //finished the deck.
        if(dds.deckFinishFunc) {
            return dds.deckFinishFunc(dds); }  //caller determines what next
        if(dds.deckidx < dds.decks.length - 1) {
            return d3ckit.nextDeck(); }  //default is next deck no loop
        reflectPlayPause(); 
    },


    forward: function () {
        var deck, slide;
        if(dds.paused === "pausing") {
            return; }  //do nothing until pause settles
        deck = currdeck;
        if(deck.slideidx >= deck.slides.length - 1) {
            return; }  //no next slide
        dds.beatlen = dds.ffrwlen;
        slide = deck.slides[deck.slideidx];
        slide.g.transition().duration(dds.beatlen)
            .attr("opacity", 0.0);
        dds.beatlen = dds.normlen;
        deck.slideidx += 1;
        slide = deck.slides[deck.slideidx];
        slide.bulletidx = -1;
        d3ckit.next();
    },


    exit: function () {
        d3ckit.nextDeck();
    },


    setKeyboardControls: function (cmap) {
        dds.cmap = cmap || {restart: ["r", "s"],
                            rewind: ["b"],
                            previous: ["p", 37, 38],  //left, up arrows
                            playpause: [" ", 39, 40], //right, down arrows
                            forward: ["f", "n"],
                            exit: ["x", "e"]};
        document.addEventListener("keydown", handleKeyDown);
    },


    enterKeyPlayPause: function () {
        document.addEventListener("keypress", handleKeyPress);
    },


    deckByName: function (deckname) {
        if(!dds.decksByName) {
            dds.decksByName = {};
            dds.decks.forEach(function (deck) {
                dds.decksByName[deck.deckname] = deck; }); }
        return dds.decksByName(deckname);
    },


    nextDeck: function (loop) {
        if(!loop && dds.deckidx >= dds.decks.length - 1) {
            return; }
        dds.deckidx += 1;
        dds.deckidx = dds.deckidx % dds.decks.length;
        d3ckit.displayDeck();
    },


    displayDeck: function (deckname) {
        var deck, itime;
        if(bto) {
            clearTimeout(bto);
            bto = null; }
        if(!deckname) {
            deckname = currdeck().deckname; }
        dds.decks.forEach(function (deckdef, idx) {
            if(deckdef.deckname === deckname) {
                dds.deckidx = idx;
                deck = deckdef; } });
        dds.cg.selectAll("*").remove();  //clear any previous displays
        deck.started = false;
        deck.g = dds.cg.append("g").attr("id", deck.deckname);
        deck.ig = deck.g.append("g")     //need a group for init stuff
            .attr("id", deck.deckname + "Init")
            .attr("opacity", 1.0);
        itime = deck.init({g:deck.ig}) || dds.beatlen;
        delayf(function () {
            deck.slides = deck.slides || deck.getSlides();
            deck.slides.forEach(function (slide, idx) {
                slide.g = deck.g.append("g")
                    .attr("id", deck.deckname + "Slide" + idx);
                slide.g.attr("opacity", 1.0);  //used for fadeout on completion
                slide.id = deck.deckname + "S" + idx;
                slide.bulletidx = -1; });
            deck.slideidx = 0;  //first call to next shows first bullet
            if(dds.deckStartFunc) {
                if(dds.dispmode === "animate") {
                    dds.paused = "paused"; }
                reflectPlayPause();
                dds.deckStartFunc(dds); }  //caller determines what to do next
            else {
                d3ckit.next(); }           //autoplay
        }, itime, dds.deckidx);
    },


    getControlContext: function () {
        return cc;
    },


    getDisplay: function () {
        return dds;
    },


    initDisplay: function (display) {
        dds = display;
        dds.normlen = dds.normlen || 1700;
        dds.ffrwlen = dds.ffrwlen || 100;  //sequenceable pseudo-instant
        dds.beatlen = dds.beatlen || dds.normlen;
        dds.margin = dds.margin || {top:5, right:5, bottom:5, left:5};
        dds.w = dds.w || 320;  //utility calcs are all based on a small phone 
        dds.h = dds.h || 186;  //display because easier to scale up smoothly
        dds.dw = dds.w - (dds.margin.left + dds.margin.right);  //display width
        dds.dh = dds.h - (dds.margin.top + dds.margin.bottom);  //display height
        dds.screencolor = dds.screencolor || "white";
        dds.textcolor = dds.textcolor || "black";
        dds.dispmode = dds.dispmode || "animate";  //"animate" or "manual"
        if(dds.bindkeycontrols || dds.dispmode === "manual") {
            dds.eatCharEvents = true;  //override post init if want propagation
            d3ckit.setKeyboardControls(dds.cmap); }
        dds.dc = {  //display constants for consistent slide presentations
            leftx:10,      //farthest comfortable left
            line1y:16,     //some arbitrary but consistent horizontal lines
            line2y:42,
            line3y:68,
            line4y:96,
            titley:68,
            titlefs:"24px"};
        //init working variables
        dds.w = 320;  //calcs are all based on a small phone display
        dds.h = 186;  //because easier to scale up smoothly
        dds.svgid = "d3ckitsvg" + jt.ts();  //unique and no async refs
        dds.deckidx = 0;
        //init display componenets
        holdMinimumDivSize(dds.divid);
        jt.out(dds.divid, "");  //completely clear the working div
        dds.svg = d3.select("#" + dds.divid).append("svg")
            .attr("viewBox", "0 0 " + dds.w + " " + dds.h)
            .attr("preserveAspectRatio", "xMidYMin meet")
            .attr("id", dds.svgid);
        dds.globg = dds.svg.append("g")
            .attr("id", "d3ckitglobg")
            .attr("transform", "translate(" + dds.margin.left + "," + 
                                              dds.margin.top + ")");
        if(dds.makeMarkers) {
            dds.makeMarkers(); }
        else {
            makeMarkers(); }
        dds.globg.append("rect")
            .attr({"x": 0, "y": 0, "width": dds.dw, "height": dds.dh})
            .style({"fill": dds.screencolor, "opacity": 0.4});
        dds.cg = dds.globg.append("g")   //general content g
            .attr("id", "d3ckitcontent");
        setTimeout(displayControls, Math.round(0.5 * dds.beatlen));
    }

};  //end of returned functions
}());


