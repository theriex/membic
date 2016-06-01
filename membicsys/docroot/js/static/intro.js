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
        arrowopa = 0.6;
    

    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

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


    function showTextElem (delaytime, duratime, id, grpname, str, attrs) {
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
                .style({"font-size": "16px", 
                        "font-weight": attrs["font-weight"] || "bold",
                        "text-anchor": attrs["text-anchor"] || "middle"})
                .text(str); }
        elem.transition().delay(delaytime).duration(duratime)
            .attr("fill-opacity", attrs.opacity || 1.0)
            .attr("opacity", attrs.opacity || 1.0);
        return elem;
    }


    function fadeGroup (delaytime, duratime, grpname, startopa, endopa) {
        ds.gs[grpname].attr("opacity", startopa)
            .transition().delay(delaytime).duration(duratime)
            .attr("opacity", endopa);
    }


    function arrowYFromBbox (bbox) {
        return bbox.y + Math.round(0.56 * bbox.height);
    }


    function arrowConnect (delaytime, duratime, id, grpname, attrs) {
        var elem = d3.select("#" + id);
        if(elem.empty()) {
            elem = ds.gs[grpname].append("line")
                .attr({"id": id,
                       "x1": attrs.x1, "y1": attrs.y1,
                       "x2": attrs.x2, "y2": attrs.y2,
                       "marker-start": "url(#arrowstart)",
                       "marker-end": "url(#arrowend)"})
                .style({"stroke": ds.textcolor,
                        "stroke-width": 1.5,
                        "stroke-opacity": arrowopa,
                        "fill": "red"}); }
        return elem;
    }


    function fadeElement (delaytime, duratime, id, startopa, endopa, remove) {
        var elem = d3.select("#" + id);
        if(!elem.empty()) {
            elem.attr("opacity", startopa)
                .attr("fill-opacity", startopa)
                .transition().delay(delaytime).duration(duratime)
                .attr("opacity", endopa)
                .attr("fill-opacity", endopa);
            if(remove) {
                elem.remove(); } }
    }


    function membicComShowcases () { return {
        creategroup: "gShowcases",
        display: function (transtime) {
            showTextElem(0, transtime / 2, "showcases", "gShowcases",
                         "Membic.com showcases what you found memorable.");
        }
    }; }


    function blogAndTop () { return {
        creategroup: "gBetwBlog",
        display: function (transtime) {
            var elem, mtxt, btxt, ay;
            fadeGroup(0, transtime / 2, "gShowcases", 1.0, 0.0);
            fadeGroup(0, transtime / 2, "gBetwBlog", 0.0, 1.0);
            showTextElem(0, transtime / 2, "bbmText", "gBetwBlog",
                         "Think of it as something between a blog...");
            mtxt = showTextElem(0, transtime / 2, "membicCom", 
                                "gBetwBlog", "membic.com", 
                                {x: midx, y: line2y, opacity: arrowopa});
            btxt = showTextElem(transtime / 4, transtime / 2, "blog", 
                                "gBetwBlog", "Blog", 
                                {x: leftx, y: line2y, "text-anchor": "left"});
            mtxt = mtxt.node().getBBox();
            btxt = btxt.node().getBBox();
            ay = arrowYFromBbox(mtxt);
            arrowConnect(transtime / 4, transtime / 2, "b2ma", "gBetwBlog",
                         {x1: btxt.x + btxt.width + arrowpad, y1: ay,
                          x2: mtxt.x - arrowpad, y2: ay});
        },
        undo: function (transtime) {
            fadeElement(0, transtime / 4, "b2ma", 1.0, 0.0, true);
            fadeGroup(0, transtime / 2, "gShowcases", 0.0, 1.0);
            fadeGroup(0, transtime / 2, "gBetwBlog", 1.0, 0.0); }
    }; }


    function blogAndTop2 () { return {
        creategroup: "gBetwTop",
        display: function (transtime) {
            var elem, mtxt, ttxt, ay;
            fadeGroup(0, transtime / 2, "gBetwTop", 0.0, 1.0);
            fadeElement(0, transtime / 2, "bbmText", 1.0, 0.0);
            showTextElem(0, transtime / 2, "bbmText2", "gBetwTop",
                         "...and your ultimate automatic top 20 list.");
            mtxt = d3.select("#membicCom").node().getBBox();
            ttxt = showTextElem(transtime / 4, transtime / 2, "top20",
                                "gBetwTop", "Top 20",
                                {x: rightx, y: line2y, "text-anchor": "end"});
            ttxt = ttxt.node().getBBox();
            ay = arrowYFromBbox(mtxt);
            arrowConnect(transtime / 4, transtime / 2, "m2ta", "gBetwTop",
                         {x1: mtxt.x + mtxt.width + arrowpad, y1: ay,
                          x2: ttxt.x - arrowpad, y2: ay});
        },
        undo: function (transtime) {
            fadeGroup(0, transtime / 2, "gBetwTop", 1.0, 0.0);
            fadeElement(0, transtime / 2, "bbmText", 0.0, 1.0);
            fadeElement(0, transtime / 2, "bbmText2", 1.0, 0.0);
            fadeElement(0, transtime / 4, "m2ta", 1.0, 0.0, true);
            fadeGroup(0, transtime / 2, "gBetwBlog", 0.0, 1.0); }
    }; }
            

    function initSlides (d3ckitds) {
        ds = d3ckitds;
        ds.deck = [
            membicComShowcases(),
            blogAndTop(),
            blogAndTop2()];
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

