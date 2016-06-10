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
                .style({"font-size": "16px", 
                        "font-weight": attrs["font-weight"] || "bold",
                        "text-anchor": attrs["text-anchor"] || "middle"})
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
                    .attr("transform", "matrix(0.28,0,0,0.45,14,34)"); }
            sv = step(3);
            showBubble(sv, "membicbubble", "gShare",
                       {"cx": 62, "cy": 65, "rx": 48, "ry": 18});
            showTextElem(sv, "linkm", "gShare", "Membic",
                         {x: 62, y: 71, "font-size": "18px"});
            sv = step(4);
            fadeGroup(sv, "gLink", 0.0);
            arrowFlow(sv, "m2soc", "gShare",
                      {x1: 114, y1: 66, x2: 157, y2: 66});
            sv = step(5);
            showTextElem(sv, "othersoc", "gShare", "Social media",
                         {x: 221, y: 71, "font-size": "14px"});
            sv = step(6);
            showGraphic(sv, "a2aimg", "gShare", 
                        {x: 278, y: 58, w: 16, h: 16,
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


    function membicShareProfile () { var numsteps = 8; return {
        group: {id: "gShareProf", parentgid: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShareProf", 1.0);
            arrowFlow(sv, "m2prof", "gShareProf",
                      {x1: 99, y1: 80, x2: 128, y2: 95});
            showTextElem(step(2), "profile", "gShareProf", "Profile",
                         {x: 164, y: 105, "font-size": "14px"});
            arrowFlow(step(3), "p2r", "gShareProf",
                      {x1: 192, y1: 101, x2: 206, y2: 95});
            showTextElem(step(4), "recent", "gShareProf", "Discovery log",
                         {x: 214, y: 96, "font-size": "10px",
                          "text-anchor": "start"});
            arrowFlow(step(5), "p2t", "gShareProf",
                      {x1: 192, y1: 101, x2: 207, y2: 109});
            showTextElem(step(6), "favorites", "gShareProf", "Auto top 20",
                         {x: 214, y: 115, "font-size": "10px",
                          "text-anchor": "start"});
            arrowFlow(step(7), "p2s", "gShareProf",
                      {x1: 192, y1: 101, x2: 209, y2: 123});
            showTextElem(step(8), "search", "gShareProf", "Keyword search",
                         {x: 214, y: 134, "font-size": "10px",
                          "text-anchor": "start"});
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
            var sv, icc = {x: 97, y: 139, w: 16, pad: 2},
                icons = [
                    {text: "Prefer", img: "promote.png", axp: 0, ayp: 4,
                     imgxp: 2, imgyp: 1},
                    {text: "Endorse", img: "endorse.png", axp: 1, ayp: 2},
                    {text: "Background", img: "background.png", axp: 1, ayp: 0},
                    {text: "Block", img: "block.png", axp: 2, ayp: -2}];
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShareComm", 1.0);
            arrowFlow(sv, "m2comm", "gShareComm",
                      {x1: 61, y1: 86, x2: 85, y2: 120});
            sv = step(2);
            showTextElem(sv, "community", "gShareComm", "Community",
                         {x: 133, y: 136, "font-size": "14px"});
            icons.forEach(function (ico, idx) {
                var xpos = icc.x + (idx * (icc.w + icc.pad));
                if(xpos === icc.x) {  //adjust first icon over slightly
                    xpos += 4; }
                showGraphic(step(3 + idx), "commico" + idx, "gShareComm",
                            {href: "img/" + ico.img,
                             x: xpos, y: icc.y, w: icc.w, h: icc.w}); });
        },
        undo: function (transtime) {
            stepinit(transtime, numsteps);
            fadeGroup(step(1), "gShareComm", 0.0);
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
            showGraphic(sv, "membiclogo", "gLogo",
                        {href: "img/membiclogo.png",
                         x: 7, y: 38, w: 112, h: 112});
            showTextElem(sv, "mcom", "gLogo", "Membic.com",
                         {x: 125, y: 71, "text-anchor": "start",
                          "font-size": "18px"});
            fadeGroup(sv, "gShare", 0.0);
            sv = step(5);
            showTextElem(sv, "whenit", "gLogo",
                         "When it's worth remembering,",
                         {x: 125, y: 97, "text-anchor": "start",
                          "font-size": "10px"});
            showTextElem(sv, "makemem", "gLogo",
                         "make a membic.",
                         {x: 125, y: 111, "text-anchor": "start",
                          "font-size": "10px"});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeElement(sv, "worthrem", 0.0);
            fadeElement(sv, "makemem", 0.0);
            fadeGroup(sv, "gLogo", 0.0);
            fadeGroup(sv, "gShare", 1.0);
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
            fadeToLogo()
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function (autoplay, endfunc) {
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(app.intro.run, 300); }
        ds = d3ckit.displaySettings();
        ds.svgsetupfunc = makeMarkers;
        initSlides(ds);
        if(autoplay) {
            ds.autoplay = true;
            ds.cc.widthMultiple /= 2;
            ds.cc.controls.rewind = false;
            ds.cc.controls.forward = false; }
        ds.endfunc = endfunc;
        d3ckit.run();
    },


    furl: function () {
        d3.select("#" + ds.svgid).transition().duration(ds.transtime)
            .attr("transform", "scale(0,0)");
    }        


};  //end of returned functions
}());

