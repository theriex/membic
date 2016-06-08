/*global app, d3, d3ckit */
/*jslint browser, multivar, white, fudge, for */

app.intro = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ds = null,
        leftx = 50,         //vals and logic assume viewbox width 600
        rightx = 500,
        midx = 270,
        toptxty = 40,
        line2y = 80,
        arrowpad = 15,
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
                .style({"font-size": attrs["font-size"] || "16px",
                        "font-weight": attrs["font-weight"] || "bold",
                        "text-anchor": attrs["text-anchor"] || "middle"})
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
        var sx = 320, sy = 55, sr = 4, st, sd, g, soff, elem;
        st = Math.round(timing.duration / 5);
        sd = timing.delay + timing.duration;  //take 3 steps total to draw
        g = ds.gs[grpname];
        soff = [2, 13, 24, 36, 47];
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
                       "x": sx, "y": sy, "height": 10, "width": 56,
                       "id": "starsimage", "opacity": 0.0}) }
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
        var kx = 320, ky = 105, cbh = 6, g, 
            cbx = kx - 10, cby = ky - cbh, cbd, elem;
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
                     {x: kx, y: ky, "font-size": "10px", 
                      "text-anchor": "start"});
        cbd = timing.duration;
        elem = d3.select("#cbcheckmark");
        if(elem.empty()) {
            elem = g.append("path")
                .attr("d", "M " + cbx +       " " + (cby + 2) + 
                          " L " + (cbx + 2) + " " + (cby + 5) +
                          " L " + (cbx + 7) + " " + (cby - 1) +
                          " L " + (cbx + 2) + " " + (cby + 3) + 
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

    function membicComShowcases () { var numsteps = 2; return {
        group: {id: "gShowcases"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShowcases", 1.0);
            showTextElem(sv, "showcases", "gShowcases",
                         "Membic.com showcases what you found memorable.");
            //step(2) is just time to read what was just displayed
        }
    }; }


    function blogAndTop () { var numsteps = 3; return {
        group: {id: "gBetwBlog"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, mtxt;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gBetwBlog", 1.0);
            fadeGroup(sv, "gShowcases", 0.0);
            fadeGroup(sv, "gBetwBlog", 1.0);
            mtxt = d3.select("#showcases").node().getBBox();
            slideText(sv, "membicCom", "gBetwBlog", "Membic.com",
                      {x1: mtxt.x, y1: mtxt.y + 16, 
                       x2: midx - 58, y2: line2y,
                       "text-anchor": "start", "opacity": 0.8});
            showTextElem(step(2), "bbmText", "gBetwBlog",
                         "Think of it as something between a blog...");
            showTextElem(step(3), "blog", "gBetwBlog", "Blog", 
                         {x: leftx, y: line2y, "text-anchor": "start"});
        },
        undo: function (transtime) {
            stepinit(transtime, numsteps);
            fadeGroup(step(1), "gShowcases", 1.0);
            fadeGroup(step(1), "gBetwBlog", 0.0); 
        }
    }; }


    function blogAndTop2 () { var numsteps = 4; return {
        group: {id: "gBetwTop"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, mtxt, btxt, ttxt, ay;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gBetwTop", 1.0);
            fadeElement(step(1), "bbmText", 0.0);
            showTextElem(step(1), "bbmText2", "gBetwTop",
                         "...and your ultimate top 20 list.");
            ttxt = showTextElem(step(2), "top20",
                                "gBetwTop", "Top 20",
                                {x: rightx, y: line2y, "text-anchor": "end"});
            ttxt = ttxt.node().getBBox();
            mtxt = d3.select("#membicCom").node().getBBox();
            btxt = d3.select("#blog").node().getBBox();
            ay = arrowYFromBbox(mtxt);
            arrowConnect(step(3), "b2ma", "gBetwBlog",
                         {x1: btxt.x + btxt.width + arrowpad, y1: ay,
                          x2: mtxt.x - arrowpad, y2: ay});
            arrowConnect(step(3), "m2ta", "gBetwTop",
                         {x1: mtxt.x + mtxt.width + arrowpad, y1: ay,
                          x2: ttxt.x - arrowpad, y2: ay});
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gBetwTop", 0.0);
            fadeElement(sv, "b2ma", 0.0, true);
            fadeElement(sv, "m2ta", 0.0, true);
            sv = step(2);
            fadeElement(sv, "bbmText", 1.0);
            fadeElement(sv, "bbmText2", 0.0);
            fadeGroup(sv, "gBetwBlog", 1.0);
        }
    }; }


    function whenYouFind () { var numsteps = 10; return {
        group: {id: "gWhen"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, basex, icow = 30, padw = 10, icoy;
            basex = midx - 160; 
            icoy = line2y - Math.round(0.6 * icow);
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gWhen", 1.0);
            fadeGroup(sv, "gBetwBlog", 0.0);
            fadeGroup(sv, "gBetwTop", 0.0);
            showTextElem(sv, "whenyoufind", "gWhen",
                         "When you find something worth remembering");
            mtypes.forEach(function (mt, idx) {
                var stepbase = idx + 2;
                showGraphic(step(stepbase), "img" + mt.id, "gWhen",
                            {x: basex, y: icoy, w: icow, h: icow,
                             href: "img/" + mt.img});
                basex += icow + padw;
                showTextElem(step(stepbase), mt.id, "gWhen", mt.name,
                             {x: basex, y: line2y, "text-anchor": "start"});
                fadeElement(step(stepbase + 1), mt.id, 0.0); });
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeGroup(sv, "gWhen", 0.0);
            fadeGroup(sv, "gBetwBlog", 1.0);
            fadeGroup(sv, "gBetwTop", 1.0);
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
            showTextElem(sv, "makemembic", "gLink", "Make a Membic");
            sv = step(2);
            ds.gs.gWhen.transition().delay(sv.delay).duration(sv.duration)
                //transform and scale: scalex, 0, 0, scaley, transx, transy
                .attr("transform", "matrix(0.25,0,0,0.25,154,60)");
            sv = step(3);
            showBubble(sv, "linkbubble", "gLink",
                       {"cx": midx - 50, "cy": line2y,
                        "rx": 42, "ry": 16});
            showTextElem(sv, "linkbt", "gLink", "Link",
                         {x: 221, y: 86, "font-size": "18px"});
            showTextElem(sv, "whymem", "gLink", "+ Why Memorable",
                         {x: 362, y: 86, "font-size": "18px"});
            fadeGroup(step(4), "gWhen", 0.0);
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
            sv = step(2);
            ds.gs.gWhen.transition().delay(sv.delay).duration(sv.duration)
                .attr("transform", "matrix(1.0,0,0,1.0,0,0)");
        }
    }; }


    function membicShareSoc () { var numsteps = 7; return {
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
                    .attr("transform", "matrix(0.28,0,0,0.45,130,34)"); }
            sv = step(3);
            showBubble(sv, "membicbubble", "gShare",
                       {"cx": midx - 50, "cy": line2y - 10,
                        "rx": 48, "ry": 18});
            showTextElem(sv, "linkm", "gShare", "Membic",
                         {x: 221, y: 76, "font-size": "18px"});
            sv = step(4);
            fadeGroup(sv, "gLink", 0.0);
            arrowFlow(sv, "m2soc", "gShare",
                      {x1: 273, y1: 72, x2: 315, y2: 72});
            sv = step(5);
            showTextElem(sv, "othersoc", "gShare", "Other social media",
                         {x: 390, y: 76, "font-size": "12px"});
            ds.gs.gShare.transition().delay(sv.delay).duration(2 * sv.duration)
                .attr("transform", "translate(-50,0)");
            sv = step(6);
            ds.gs.gShare.append("image")
                .attr({"xlink:href": "img/socbwa2a.png",
                       "x": 457, "y": 66, "height": 12, "width": 12,
                       "id": "a2aimg", "opacity": 0.0})
                .transition().delay(sv.delay).duration(sv.duration)
                .attr("opacity", 1.0);
        },
        undo: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            ds.gs.gShare.transition().delay(sv.delay).duration(sv.duration)
                .attr("transform", "translate(0,0)");
            fadeGroup(sv, "gLink", 1.0);
            sv = step(2);
            fadeElement(sv, "membicbubble", 0.0);
            fadeElement(sv, "linkm", 0.0);
            fadeElement(sv, "m2soc", 0.0, true);
            fadeElement(sv, "othersoc", 0.0);
            fadeElement(sv, "a2aimg", 0.0, true);
            fadeGroup(sv, "gShare", 0.0);
            fadeElement(sv, "makemembic", 1.0);
            ds.gs.gLink.transition().delay(sv.delay).duration(sv.duration)
                .attr("transform", "matrix(1.0,0,0,1.0,0,0)");
        }
    }; }


    function membicShareProfile () { var numsteps = 5; return {
        group: {id: "gShareProf", parentgid: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv;
            stepinit(transtime, numsteps);
            sv = step(1);
            fadeInitGroup(sv, "gShareProf", 1.0);
            showTextElem(sv, "profile", "gShareProf", "Profile",
                         {x: 322, y: 121, "font-size": "12px"});
            arrowFlow(sv, "m2prof", "gShareProf",
                      {x1: 252, y1: 87, x2: 292, y2: 112});
            sv = step(2);
            showTextElem(sv, "recent", "gShareProf", "Recent",
                         {x: 370, y: 121, "font-size": "10px",
                          "text-anchor": "start"});
            arrowFlow(sv, "p2r", "gShareProf",
                      {x1: 348, y1: 117, x2: 361, y2: 117});
            sv = step(3);
            showTextElem(sv, "favorites", "gShareProf",
                         "Automatic top 20+",
                         {x: 370, y: 141, "font-size": "10px",
                          "text-anchor": "start"});
            arrowFlow(sv, "p2t", "gShareProf",
                      {x1: 348, y1: 117, x2: 363, y2: 133});
            sv = step(4);
            showTextElem(sv, "search", "gShareProf",
                         "Keyword search",
                         {x: 370, y: 161, "font-size": "10px",
                          "text-anchor": "start"});
            arrowFlow(sv, "p2s", "gShareProf",
                      {x1: 348, y1: 117, x2: 364, y2: 150});
        },
        undo: function (transtime) {
            stepinit(transtime, numsteps);
            fadeGroup(step(1), "gShareProf", 0.0);
        }
    }; }


    function membicShareCommunity () { var numsteps = 5; return {
        group: {id: "gShareComm", parentgid: "gShare"},
        transmult: numsteps,
        display: function (transtime) {
            var sv, icc = {x: 249, y: 152, w: 10, pad: 4, vpad: 6},
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
                      {x1: 224, y1: 92, x2: 224, y2: 133});
            showTextElem(sv, "community", "gShareComm", "Community",
                         {x: 226, y: 150, "font-size": "12px"});
            icons.forEach(function (ico, idx) {
                var liney = icc.y + (idx * (icc.w + icc.vpad));
                sv = step(2 + idx);
                arrowFlow(sv, "c2" + idx, "gShareComm",
                          {x1: 223, y1: 153,
                           x2: icc.x - 5 + ico.axp, 
                           y2: liney + ico.ayp});
                ds.gs.gShareComm.append("image")
                    .attr({"xlink:href": "img/" + ico.img,
                           "x": icc.x + (ico.imgxp || 0), 
                           "y": liney + (ico.imgyp || 0),
                           "height": icc.w, "width": icc.w, "opacity": 0.0})
                    .transition().delay(sv.delay).duration(sv.duration)
                    .attr("opacity", 1.0); 
                showTextElem(sv, ico.text, "gShareComm", ico.text,
                             {"x": icc.x + 12, "y": icc.y + (idx * 16) + 10,
                              "font-size": "10px", "text-anchor": "start"}); });
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
            ds.gs.gLogo.append("image")
                .attr({"xlink:href": "img/membiclogo.png",
                       "x": 114, "y": 43, "height": 112, "width": 112,
                       "opacity": 0.0})
                .transition().delay(sv.delay).duration(sv.duration)
                .attr("opacity", 1.0);
            showTextElem(sv, "mcom", "gLogo", "Membic.com",
                         {x: 240, y: 77, "text-anchor": "start"});
            fadeGroup(sv, "gShare", 0.0);
            sv = step(5);
            showTextElem(sv, "worthrem", "gLogo",
                         "When it's worth remembering,",
                         {x: 240, y: 97, "text-anchor": "start",
                          "font-size": "10px"});
            showTextElem(sv, "makemem", "gLogo",
                         "make a membic.",
                         {x: 240, y: 111, "text-anchor": "start",
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
            blogAndTop2(),
            whenYouFind(),
            makeMembic(),
            membicShareSoc(),
            membicShareProfile(),
            membicShareCommunity(),
            fadeToLogo()];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function () {
        ds = d3ckit.displaySettings();
        ds.svgsetupfunc = makeMarkers;
        initSlides(ds);
        ds.autoplay = true;
        //ds.normTransTime = 200;
        d3ckit.run();
    }


};  //end of returned functions
}());

