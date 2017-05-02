/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge, for */

app.intro = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        leftx = 10,         //vals and logic assume viewbox width 320
        rightx = 300,
        midx = 140,
        toptxty = 20,
        line2y = 42,
        line3y = 68,
        line4y = 96,
        arrowpad = 7,
        arrowopa = 0.8,
        bubbleopa = 0.6,
        stepv = {delay: 0, duration: 0, transtime: 800, numsteps: 2},
        mtypes = [
         {id: "book", name: "A Book", img: "TypeBook50.png"},
         {id: "article", name: "Article", img: "TypeArticle50.png"},
         {id: "movie", name: "Movie", img: "TypeMovie50.png"},
         {id: "video", name: "Video", img: "TypeVideo50.png"},
         {id: "song", name: "Song or Album", img: "TypeSong50.png"},
         {id: "yum", name: "Eat or Drink", img: "TypeYum50.png"},
         {id: "activity", name: "Activity or Place", img: "TypeActivity50.png"},
         {id: "other", name: "Any other URL", img: "TypeOther50.png"}];
    

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


    function slideText (timing, id, grpname, str, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            attrs.x1 = Math.round(attrs.x1);
            attrs.y1 = Math.round(attrs.y1);
            elem = ds.gs[grpname].append("text")
                .attr({"id": id, 
                       "x": attrs.x2,
                       "y": attrs.y2,
                       "fill": ds.textcolor, 
                       "opacity": attrs.opacity || 1.0,
                       "fill-opacity": attrs.opacity || 1.0})
                .style({"font-size": (attrs["font-size"] || "16px"), 
                        "font-weight": (attrs["font-weight"] || "bold"),
                        "text-anchor": (attrs["text-anchor"] || "middle")})
                .text(str); }
        elem.attr("transform", "translate(" + 
                  (-1 * (attrs.x2 - attrs.x1)) + "," + 
                  (-1 * (attrs.y2 - attrs.y1)) + ")")
            .transition().delay(timing.delay).duration(timing.duration)
            .attr("transform", "translate(0,0)");
        return elem;
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


    function arrowYFromBbox (bbox) {
        return bbox.y + Math.round(0.56 * bbox.height);
    }


    function drawArrow (timing, id, grpname, attrs) {
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
            elem = ds.gs[grpname].append("line")
                .attr({"id": id,
                       "x1": start.x1, "y1": start.y1,
                       "x2": start.x2, "y2": start.y2,
                       "marker-start": attrs["marker-start"],
                       "marker-end": "url(#arrowend)",
                       "opacity": 0.0,
                       "stroke-opacity": 0.0})
                .style({"stroke": ds.textcolor,
                        "stroke-width": 1.5,
                        "fill": "red"}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("x1", attrs.x1)
            .attr("x2", attrs.x2)
            .attr("y1", attrs.y1)
            .attr("y2", attrs.y2)
            .attr("opacity", arrowopa)
            .attr("stroke-opacity", arrowopa);
        return elem;
    }


    function arrowConnect (timing, id, grpname, attrs) {
        attrs["marker-start"] = "url(#arrowstart)";
        return drawArrow(timing, id, grpname, attrs);
    }


    function arrowFlow (timing, id, grpname, attrs) {
        attrs["marker-start"] = "";
        return drawArrow(timing, id, grpname, attrs);
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


    function fadeElems (timing, opacity, ids) {
        ids.forEach(function (id) {
            fadeElement(timing, id, opacity); });
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


    function showBubble (timing, id, grpname, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = ds.gs[grpname].append("ellipse")
                .attr({"id": id, "cx": attrs.cx, "cy": attrs.cy,
                       "rx": attrs.rx, "ry": attrs.ry,
                       "fill-opacity": 0.0, "stroke-opacity": 0.0,
                       "opacity": 0.0})
                .style({"fill": "#fd700a", "stroke": "#b9100f"}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("opacity", 1.0)
            .attr("fill-opacity", bubbleopa)
            .attr("stroke-opacity", bubbleopa);
        return elem;
    }


    function showRect (timing, id, grpname, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = ds.gs[grpname].append("rect")
                .attr({"id": id, "x": attrs.x, "y": attrs.y, 
                       "width": attrs.w, "height": attrs.h,
                       "rx": (attrs.rx || 0), "ry": (attrs.ry || 0),
                       "stroke-opacity": 0.0, "fill-opacity": 0.0})
                .style({"fill": (attrs.fill || "#789897"), 
                        "stroke": (attrs.stroke || ds.textcolor)}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("fill-opacity", (attrs.opacity || 1.0))
            .attr("stroke-opacity", (attrs.opacity || 1.0));
    }


    function showTextLines (timing, grpname, attrs, tes) {
        var sv = {delay: timing.delay, 
                  duration: Math.round(timing.duration / tes.length)};
        tes.forEach(function (elem, idx) {
            var ap = {x: attrs.x, y: attrs.y + (idx * attrs.lineheight),
                      "font-size": attrs["font-size"],
                      "font-weight": attrs["font-weight"],
                      "text-anchor": attrs["text-anchor"],
                      "font-style": attrs["font-style"]},
                ss = {delay: sv.delay + (idx * sv.duration),
                      duration: sv.duration};
            if(elem.img) {
                showGraphic(ss, elem.id + "img", grpname, 
                            {href: "img/" + elem.img, 
                             x: attrs.x, 
                             y: ap.y - (Math.floor(0.65 * attrs.lineheight)),
                             w: attrs.imgw, h: attrs.imgw});
                ap.x += attrs.imgw + 2; }
            showTextElem(ss, elem.id, grpname, elem.txt, ap); });
    }


    ////////////////////////////////////////
    //slide specific helper functions
    ////////////////////////////////////////

    function drawStars (timing, grpname) {
        var sx = 148, sy = 41, sr = 7, st, sd, g, soff, elem;
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
        var elem = d3.selectAll(".goldcircle");
        if(!elem.empty()) {
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("opacity", 0.0); }
        elem = d3.select("#starsimage");
        if(!elem.empty()) {
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("opacity", 0.0); }
    }


    function drawKeywords (timing, grpname) {
        var kx = 168, ky = 96, cbh = 10, g, 
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


    function fadeKeywords (timing) {
        var elem = d3.select("#cbrect");
        if(!elem.empty()) {
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("stroke-opacity", 0.0); }
        fadeElement(timing, "cbkeywords", 0.0);
        elem = d3.select("#cbcheckmark");
        if(!elem.empty()) {
            elem.transition().delay(timing.delay).duration(timing.duration)
                .attr("fill-opacity", 0.0)
                .attr("stroke-opacity", 0.0); }
    }


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function membicComShowcases () { var numsteps = 4; return {
        group: {id: "gShowcases"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShowcases", 1.0);
            showTextElem(sv, "showcases", "gShowcases",
                         "Membic.com showcases");
            showTextElem(sv, "whatyoufound", "gShowcases",
                         "what you found memorable.", {y: line2y});
            //remaining steps are time to read what was just displayed
        }
    }; }


    function blogAndTop () { var numsteps = 8; return {
        group: {id: "gBetw"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, mtxt, btxt, ttxt, ay;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gBetw", 1.0);
            fadeGroup(sv, "gShowcases", 0.0);
            mtxt = d3.select("#showcases").node().getBBox();
            mtxt = slideText(sv, "membicCom", "gBetw", "Membic.com",
                             {x1: mtxt.x, y1: mtxt.y + 16, 
                              x2: midx - 52, y2: line3y,
                              "text-anchor": "start", "opacity": 0.8});
            sv = step(2);
            showTextElem(sv, "bbmText", "gBetw",
                         "Think of it as something");
            showTextElem(sv, "bbmTextb", "gBetw",
                         "between a blog...", {y: line2y});
            sv = step(3);
            btxt = showTextElem(sv, "blog", "gBetw", "Blog", 
                                {x: leftx, y: line3y, "text-anchor": "start"});
            sv = step(4);
            fadeElement(sv, "bbmText", 0.0);
            fadeElement(sv, "bbmTextb", 0.0);
            showTextElem(sv, "bbmText2", "gBetw",
                         "...and your ultimate top 20 list");
            sv = step(5);
            ttxt = showTextElem(sv, "top20", "gBetw", "Top 20",
                                {x: rightx, y: line3y, "text-anchor": "end"});
            sv = step(6);
            mtxt = mtxt.node().getBBox();
            btxt = btxt.node().getBBox();
            ttxt = ttxt.node().getBBox();
            ay = arrowYFromBbox(mtxt);
            arrowConnect(sv, "b2ma", "gBetw",
                         {x1: btxt.x + btxt.width + arrowpad, y1: ay,
                          x2: mtxt.x - arrowpad, y2: ay});
            arrowConnect(sv, "m2ta", "gBetw",
                         {x1: mtxt.x + mtxt.width + arrowpad, y1: ay,
                          x2: ttxt.x - arrowpad, y2: ay});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gBetw", 0.0);
            fadeElement(sv, "b2ma", 0.0, true);
            fadeElement(sv, "m2ta", 0.0, true);
            sv = step(2);
            fadeElement(sv, "bbmText2", 0.0);
            fadeElement(sv, "blog", 0.0);
            fadeElement(sv, "top20", 0.0);
            fadeGroup(step(1), "gShowcases", 1.0);
        }
    }; }


    function whenYouFind () { var numsteps = 10; return {
        group: {id: "gWhen"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, basex, icow = 30, padw = 5, icoy;
            basex = leftx; 
            icoy = line3y - Math.round(0.6 * icow);
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gWhen", 1.0);
            fadeGroup(sv, "gBetw", 0.0);
            showTextElem(sv, "whenyoufind", "gWhen",
                         "When you find something");
            showTextElem(sv, "worthrem", "gWhen", "worth remembering", 
                         {y: line2y});
            mtypes.forEach(function (mt, idx) {
                var stepbase = idx + 2;
                showGraphic(step(stepbase), "img" + mt.id, "gWhen",
                            {x: basex, y: icoy, w: icow, h: icow,
                             href: "img/" + mt.img});
                basex += icow + padw;
                showTextElem(step(stepbase), mt.id, "gWhen", mt.name,
                             {x: midx, y: line4y, "text-anchor": "middle",
                              "font-size": "14px"});
                fadeElement(step(stepbase + 1), mt.id, 0.0); });
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gWhen", 0.0);
            fadeGroup(sv, "gBetw", 1.0);
        }
    }; }


    function makeMembic () { var numsteps = 8; return {
        group: {id: "gLink", zbefore: "gWhen"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gLink", 1.0);
            fadeElement(sv, "whenyoufind", 0.0);
            fadeElement(sv, "worthrem", 0.0);
            showTextElem(sv, "makemembic", "gLink", "Make a Membic");
            sv = step(2);
            ds.gs.gWhen.transition().delay(sv.delay).duration(sv.duration)
                //transform and scale: scalex, 0, 0, scaley, transx, transy
                .attr("transform", "matrix(0.25,0,0,0.25,18,52)");
            sv = step(3);
            fadeGroup(sv, "gWhen", 0.0);
            showBubble(sv, "linkbubble", "gLink",
                       {"cx": midx - 86, "cy": line3y,
                        "rx": 36, "ry": 16});
            showTextElem(sv, "linkbt", "gLink", "Link",
                         {x: 56, y: 75, "font-size": "18px"});
            showTextElem(sv, "whymem", "gLink", "+ Why Memorable",
                         {x: 185, y: 75, "font-size": "18px"});
            drawStars(step(5), "gLink");  //3 stage display
            drawKeywords(step(7), "gLink"); //2 stage display
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeElement(sv, "linkbubble", 0.0);
            fadeElement(sv, "linkbt", 0.0);
            fadeElement(sv, "whymem", 0.0);
            fadeStars(sv);
            fadeKeywords(sv);
            fadeGroup(sv, "gLink", 0.0);
            fadeGroup(sv, "gWhen", 1.0);
            fadeElement(sv, "whenyoufind", 1.0);
            fadeElement(sv, "worthrem", 1.0);
            sv = step(2);
            ds.gs.gWhen.transition().delay(sv.delay).duration(sv.duration)
                .attr("transform", "matrix(1.0,0,0,1.0,0,0)");
        }
    }; }


    function membicShareSoc () { var numsteps = 6; return {
        group: {id: "gShare", zbefore: "gWhen"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShare", 1.0);
            fadeElement(sv, "makemembic", 0.0);
            showTextElem(sv, "share", "gShare", "...and share");
            sv = step(2);
            if(ds.gs.gLink) {
                ds.gs.gLink.transition().delay(sv.delay).duration(sv.duration)
                    //transform and scale: scalex, 0, 0, scaley, transx, transy
                    .attr("transform", "matrix(0.28,0,0,0.45,14,16)"); }
            sv = step(3);
            showBubble(sv, "membicbubble", "gShare",
                       {"cx": 62, "cy": 47, "rx": 48, "ry": 18});
            showTextElem(sv, "linkm", "gShare", "Membic",
                         {x: 62, y: 53, "font-size": "18px"});
            sv = step(4);
            fadeGroup(sv, "gLink", 0.0);
            arrowFlow(sv, "m2soc", "gShare",
                      {x1: 114, y1: 48, x2: 157, y2: 48});
            sv = step(5);
            showTextElem(sv, "othersoc", "gShare", "Social media",
                         {x: 221, y: 53, "font-size": "14px"});
            sv = step(6);
            showGraphic(sv, "a2aimg", "gShare", 
                        {x: 276, y: 41, w: 12, h: 12,
                         href: "img/socbwa2a.png"});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gLink", 1.0);
            sv = step(2);
            fadeElement(sv, "membicbubble", 0.0);
            fadeElement(sv, "linkm", 0.0);
            fadeElement(sv, "m2soc", 0.0, true);
            fadeElement(sv, "othersoc", 0.0);
            fadeElement(sv, "a2aimg", 0.0);
            fadeGroup(sv, "gShare", 0.0);
            fadeElement(sv, "makemembic", 1.0);
            ds.gs.gLink.transition().delay(sv.delay).duration(sv.duration)
                .attr("transform", "matrix(1.0,0,0,1.0,0,0)");
        }
    }; }


    function membicShareProfile () { var numsteps = 6; return {
        group: {id: "gShareProf", parentgid: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, coords = {x: 204, y: 76},
                tabs = [{id: "recent", img: "tablatest.png", txt: "Latest"},
                        {id: "top", img: "top.png", txt: "Top"},
                        {id: "search", img: "search.png", txt: "Search"}];
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShareProf", 1.0);
            arrowFlow(sv, "m2prof", "gShareProf",
                      {x1: 99, y1: 62, x2: 134, y2: 77});
            sv = step(2);
            showTextElem(sv, "profile", "gShareProf", "Profile",
                         {x: 170, y: 86, "font-size": "14px"});
            tabs.forEach(function (tab, idx) {
                sv = step(3 + idx);
                showRect(sv, tab.id + "back", "gShareProf", 
                         {x: coords.x - 1, y: coords.y - 1, w: 14, h: 14,
                          rx: 4, ry: 4, fill: "#789897", opacity: 0.5});
                showGraphic(sv, tab.id + "ico", "gShareProf",
                            {href: "img/" + tab.img,
                             x: coords.x, y: coords.y, w: 12, h: 12});
                showTextElem(sv, tab.id, "gShareProf", tab.txt,
                             {x: coords.x + 16, y: coords.y + 9, 
                              "font-size": "10px", "text-anchor": "start"});
                coords.y += 16; });
        },
        undo: function (transtime) {
            stepinit(transtime, numsteps);
            fadeGroup(step(1), "gShareProf", 0.0);
        }
    }; }


    function membicShareCommunity () { var numsteps = 7; return {
        group: {id: "gShareComm", parentgid: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShareComm", 1.0);
            arrowFlow(sv, "m2theme", "gShareComm",
                      {x1: 83, y1: 67, x2: 104, y2: 102});
            sv = step(2);
            showTextElem(sv, "themes", "gShareComm", "Themes",
                         {x: 137, y: 121, "font-size": "14px"});
            sv = step(3);
            arrowFlow(sv, "m2comm", "gShareComm",
                      {x1: 61, y1: 68, x2: 61, y2: 128});
            sv = step(4);
            showTextElem(sv, "community", "gShareComm", "Community",
                         {x: 67, y: 146, "font-size": "14px"});
        },
        undo: function (transtime) {
            stepinit(transtime, numsteps);
            fadeGroup(step(1), "gShareComm", 0.0);
        }
    }; }


    function communityTheme () { var numsteps = 10; return {
        group: {id: "gCommTheme"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, tattrs, 
                td = {x1: 35, x2: 165, y: 35, fs: "12px"},
                bgr = {r: 3, fill: "#fd700a", stroke: "#b9100f", opa: 0.6};
            stepinit(transtime, numsteps);
            sv = step(1);
            td.yorg = td.y;
            fadeInitGroup(sv, "gCommTheme", 1.0);
            fadeGroup(sv, "gShare", 0.0);
            showRect(sv, "commback", "gCommTheme", 
                     {x: td.x1 - 3, y: 4, w: 95, h: 18, rx: bgr.r, ry: bgr.r,
                      fill: bgr.fill, stroke: bgr.stroke, opacity: bgr.opa});
            showRect(sv, "themeback", "gCommTheme", 
                     {x: td.x2 - 3, y: 4, w: 69, h: 18, rx: bgr.r, ry: bgr.r,
                      fill: bgr.fill, stroke: bgr.stroke, opacity: bgr.opa});
            slideText(sv, "commtitle", "gCommTheme", "Community",
                      {x1: 22, y1: 146, x2: td.x1, y2: 18,
                       "font-size": "14px", "text-anchor": "start"});
            slideText(sv, "themestitle", "gCommTheme", "Themes",
                      {x1: 106, y1: 121, x2: td.x2, y2: 18, 
                       "font-size": "14px", "text-anchor": "start"});
            //Community column display
            sv = step(2);
            tattrs = function (xpos) {
                return {x: xpos, y: td.y, "font-size": td.fs, lineheight: 14,
                        "text-anchor": "start", 
                        "font-weight": (td["font-weight"] || "normal"),
                        imgw: 10}; };
            showTextElem(sv, "openacc", "gCommTheme", "Open access",
                         tattrs(td.x1));
            sv = step(3);
            td.fs = "10px"; td.x1 += 10; td.y += 16;
            td["font-weight"] = "bold";
            showTextLines(sv, "gCommTheme", tattrs(td.x1), [
                {img: "promote.png", id: "prefer", txt: "Prefer"},
                {img: "endorse.png", id: "endorse", txt: "Endorse"},
                {img: "background.png", id: "background", txt: "Background"},
                {img: "block.png", id: "block", txt: "Block"}]);
            sv = step(4);
            td.fs = "12px"; td.x1 -= 10; td.y += 59;
            td["font-weight"] = "normal";
            showTextElem(sv, "whycomm", "gCommTheme", "See what people",
                         tattrs(td.x1));
            td.y += 13;
            showTextElem(sv, "whycomm2", "gCommTheme", "are finding",
                         tattrs(td.x1 + 13));
            //Theme column display
            sv = step(6);
            td.fs = "12px"; td.y = td.yorg;
            showTextElem(sv, "membacc", "gCommTheme", "Membership access",
                         tattrs(td.x2));
            sv = step(7);
            td.fs = "10px"; td.x2 += 10; td.y += 16;
            td["font-weight"] = "bold";
            showTextLines(sv, "gCommTheme", tattrs(td.x2), [
                {id: "founder", txt: "Founder"},
                {id: "moderator", txt: "Moderator"},
                {id: "member", txt: "Member"},
                {id: "follower", txt: "Follower"}]);
            sv = step(8);
            td.fs = "12px"; td.x2 -= 10; td.y += 59;
            td["font-weight"] = "normal";
            showTextElem(sv, "whytheme", "gCommTheme", "Collect related",
                         tattrs(td.x2));
            td.y += 13;
            showTextElem(sv, "whytheme2", "gCommTheme", "membics",
                         tattrs(td.x2 + 13));
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gCommTheme", 0.0);
            fadeGroup(sv, "gShare", 1.0);
            fadeElems(sv, 0.0, [
                "openacc", "prefer", "endorse", "background", "block",
                "preferimg", "endorseimg", "backgroundimg", "blockimg",
                "whycomm", "whycomm2",
                "membacc", "founder", "moderator", "member", "follower",
                "whytheme", "whytheme2"]);
        }
    }; }


    function themeFeatures () { var numsteps = 10; return {
        group: {id: "gTheme"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, fattrs = {x: 120, y: 47, "font-size": "12px",
                              lineheight: 18, "text-anchor": "start",
                              imgw: 12},
                features = [
                    {img: "embed.png", id: "embed", txt: "Embeddable"},
                    {img: "rssicon.png", id: "rss", txt: "Newsfeed"},
                    {img: "stats.png", id: "stats", txt: "Stats"},
                    {img: "tablatest.png", id: "threcent", txt: "Latest"},
                    {img: "top.png", id: "thtop", txt: "Top"},
                    {img: "search.png", id: "thsearch", txt: "Search"}];
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gTheme", 1.0);
            fadeGroup(sv, "gCommTheme", 0.0);
            slideText(sv, "tftitle", "gTheme", "Theme",
                      {x1: 165, y1: 18, x2: 38, y2: 53,
                       "font-size": "14px", "text-anchor": "start"});
            sv = step(2);
            fadeElement(sv, "tftitle", 0.0);
            showTextElem(sv, "tftbig", "gTheme", "Theme",
                         {x: 30, y: 53, "text-anchor": "start",
                          "font-size": "18px"});
            showGraphic(sv, "microsite", "gTheme",
                        {href: "img/microsite.png",
                         x: 52, y: 57, w: 25, h: 25});
            sv = step(3);
            showTextElem(sv, "acctheme", "gTheme", 
                         "Access by permalink or hashtag",
                         {"font-size": "12px"});
            sv = step(4);
            sv.duration *= features.length;
            showTextLines(sv, "gTheme", fattrs, features);
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gTheme", 0.0);
            fadeGroup(sv, "gCommTheme", 1.0);
            fadeElement(sv, "tftitle", 1.0);
            fadeElems(sv, 0.0, ["tftbig", "microsite", "acctheme", 
                                "embed", "rss", "stats", "threcent", "thtop", 
                                "thsearch"]);
        }
    }; }


    function fadeToLogo () { var numsteps = 8; return {
        group: {id: "gLogo", zbefore: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            sv.duration *= 3;
            fadeInitGroup(sv, "gLogo", 1.0);
            fadeGroup(sv, "gTheme", 0.0);
            showGraphic(sv, "membiclogo", "gLogo",
                        {href: "img/membiclogo.png?v=170502",
                         x: 6, y: 20, w: 112, h: 112});
            showTextElem(sv, "mcom", "gLogo", "Membic.com",
                         {x: 125, y: 53, "text-anchor": "start",
                          "font-size": "18px"});
            sv = step(5);
            showTextElem(sv, "whenit", "gLogo",
                         "When it's worth remembering,",
                         {x: 125, y: 79, "text-anchor": "start",
                          "font-size": "10px"});
            showTextElem(sv, "makemem", "gLogo",
                         "make a membic.",
                         {x: 125, y: 93, "text-anchor": "start",
                          "font-size": "10px"});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeElems(sv, 0.0, ["whenit", "makemem"]);
            fadeGroup(sv, "gLogo", 0.0);
            fadeGroup(sv, "gTheme", 1.0);
        }
    }; }


    function initSlides (d3ckitds) {
        ds = d3ckitds;
        ds.deck = [
            membicComShowcases(),
            blogAndTop(),
            whenYouFind(),
            makeMembic(),
            membicShareSoc(),
            membicShareProfile(),
            membicShareCommunity(),
            communityTheme(),
            themeFeatures(),
            fadeToLogo()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay, endfunc) {
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(function () {
                app.intro.run(autoplay, endfunc); }, 300); }
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
        ds.endfunc = endfunc;
        d3ckit.run();
    },


    furl: function () {
        d3.select("#" + ds.svgid).transition().duration(ds.transtime)
            .attr("transform", "scale(0,0)");
    }        


};  //end of returned functions
}());

