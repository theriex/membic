/*global window, document, app, jt, d3 */
/*jslint browser, multivar, white, fudge, for */

app.anime = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ast = { width: 300, height: 180, textcolor: "black" };


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function hideStaticComponents () {
        jt.byId("linkpluswhyspan").style.display = "none";
        jt.byId("themesitespan").style.display = "none";
        jt.byId("introductionli").style.display = "none";
        jt.byId("originli").style.display = "none";
    }


    function nextAnimationSequence (fseq) {
        if(!fseq || !fseq.length) {
            return; }
        (fseq.shift())(fseq);
    }


    function displayMembicTypes (fseq, lay, mts) {
        var mt, fm = 2, i;
        if(!mts || !mts.length) {
            lay.bubble.attr({"fill-opacity": 0.0, "stroke-opacity": 0.0})
                .transition().duration(800)
                .attr({"fill-opacity": 0.4, "stroke-opacity": 0.4});
            lay.glnk.append("text")
                .attr({"x": 84, "y": 110, "fill-opacity": 0,
                       "id": "linktxt", "fill": ast.textcolor})
                .style({"font-size": "56px", "font-weight": "bold",
                        "text-anchor": "middle"})
                .text("Link");
            return nextAnimationSequence(fseq); }
        mt = mts[0];
        if(!mt.initialized) {
            for(i = 0; i < 4; i += 1) {
                jt.out("lctxt" + i, ""); }
            lay.gtxt.attr("opacity", 1.0);
            mt.delay /= 10;  //temporary development speedup
            mt.fidx = 0;
            mt.initialized = true; }
        if(mt.fidx < mt.fields.length) {
            jt.out("lctxt" + mt.fo, mt.fields[mt.fidx]); }
        mt.fidx += 1;
        mt.fo += 1;
        if(mt.fidx < mt.fields.length) {
            setTimeout(function () {
                displayMembicTypes(fseq, lay, mts); }, mt.delay); }
        else {
            lay.gtxt.attr("opacity", 1.0)
                .transition().duration(fm * mt.delay)
                .attr("opacity", 0.0);
            lay.gico.append("image")
                .attr({"xlink:href": "img/" + mt.img, 
                       "x": mt.imgc.x, "y": mt.imgc.y,
                       "height": String(lay.icosize) + "px",
                       "width": String(lay.icosize) + "px"})
                .attr("opacity", 0.0)
                .transition().duration(fm * mt.delay)
                .attr("opacity", 1.0);
            setTimeout(function () {
                displayMembicTypes(fseq, lay, mts.slice(1)); }, 
                       (fm + 1) * mt.delay); }
    }


    function initFieldsAndTypesLayout () {
        var i, lay = {icosize: 30, padx: 6, pady: 3, fldw: 80, 
                      leftm: 10, topm: 28};
        lay.rw = (2 * (lay.icosize + lay.padx)) + lay.fldw + lay.padx;
        lay.xw = Math.round(lay.rw / 4);
        lay.yh = lay.icosize + lay.pady;
        lay.glnk = ast.glnk;
        lay.bubble = lay.glnk.append("ellipse")
            .attr({"cx": lay.leftm + (2 * lay.xw) - lay.padx, 
                   "cy": lay.topm + (2 * lay.yh) - lay.pady, 
                   "rx": (2 * lay.xw) + lay.padx,
                   "ry": (2 * lay.yh) + lay.pady,
                   "fill-opacity": 0.0, "stroke-opacity": 0.0})
            .style({"fill": "#fd700a", "stroke": "#b9100f"});
        lay.gtxt = lay.glnk.append("g"); 
        lay.gico = lay.glnk.append("g");
        for(i = 0; i < 4; i += 1) {
            lay.gtxt.append("text")
                .attr({"x": lay.leftm + (2 * lay.xw) - lay.padx, 
                       "y": lay.topm + ((i + 1) * lay.yh) - lay.pady - 4, 
                       "id": "lctxt" + i, "fill": ast.textcolor})
                .style({"font-size": "16px", "font-weight": "bold",
                        "text-anchor": "middle"})
                .text(""); }
        ast.fatlay = lay;
        return lay;
    }


    function displayIdentFieldsAndTypes (fseq) {
        var lay = initFieldsAndTypesLayout();
        displayMembicTypes(fseq, lay, 
            [{fields: ["Title", "Author", "Publisher", "Year"],
              fo: 0, delay: 600, img: "TypeBook50.png", imgc: {
                  x: lay.leftm + 0 * lay.xw,
                  y: lay.topm + 1 * lay.yh}},
             {fields: ["Title", "Author", "Publisher", "Year"],
              fo: 0, delay: 300, img: "TypeArticle50.png", imgc: {
                  x: lay.leftm + (0 * lay.xw),
                  y: lay.topm + (2 * lay.yh)}},
             {fields: ["Title", "Year", "Starring"],
              fo: 0, delay: 400, img: "TypeMovie50.png", imgc: {
                  x: lay.leftm + (3 * lay.xw),
                  y: lay.topm + (1 * lay.yh)}},
             {fields: ["Title", "Artist"],
              fo: 1, delay: 400, img: "TypeVideo50.png", imgc: {
                  x: lay.leftm + (3 * lay.xw),
                  y: lay.topm + (2 * lay.yh)}},
             {fields: ["Title", "Artist", "Album", "Year"],
              fo: 0, delay: 400, img: "TypeSong50.png", imgc: {
                  x: lay.leftm + (1 * lay.xw),
                  y: lay.topm + (3 * lay.yh)}},
             {fields: ["Name", "Address"],
              fo: 1, delay: 400, img: "TypeYum50.png", imgc: {
                  x: lay.leftm + (2 * lay.xw),
                  y: lay.topm + (3 * lay.yh)}},
             {fields: ["Name", "Address"],
              fo: 1, delay: 400, img: "TypeActivity50.png", imgc: {
                  x: lay.leftm + (1 * lay.xw),
                  y: lay.topm + (0 * lay.yh)}},
             {fields: ["Name"],
              fo: 1, delay: 400, img: "TypeOther50.png", imgc: {
                  x: lay.leftm + (2 * lay.xw),
                  y: lay.topm + (0 * lay.yh)}}]);
    }


    function collapseTypesToLink (fseq) {
        var transtime = 123;
        ast.fatlay.glnk.transition().duration(transtime)
            //transform and scale: scalex, 0, 0, scaley, transx, transy
            .attr("transform", "matrix(0.5,0,0,0.25,10,50)");
        ast.fatlay.gico.transition().duration(transtime)
            .attr("transform", "matrix(0.5,0,0,0.3,36,60)")
        ast.fatlay.gico.attr("opacity", 1.0)
            .transition().delay(transtime).duration(transtime)
            .attr("opacity", 0.0);
        d3.select("#linktxt").transition().delay(transtime).duration(transtime)
            .attr("fill-opacity", 1.0);
        setTimeout(function () {
            nextAnimationSequence(fseq); }, 2 * transtime);
    }


    function drawStars (transtime) {
        var sx = 140, sy = 64, sw = 14, st = transtime / 5;
        ast.gmf.append("rect")
            .attr({"x": sx + 2, "y": sy, "width": sw, "height": 15})
            .style({"fill": "#fed000"})
            .attr("opacity", 0.0)
            .transition().duration(st)
            .attr("opacity", 1.0);
        ast.gmf.append("rect")
            .attr({"x": sx + 18, "y": sy, "width": sw, "height": 15})
            .style({"fill": "#fed000"})
            .attr("opacity", 0.0)
            .transition().delay(st).duration(st)
            .attr("opacity", 1.0);
        ast.gmf.append("rect")
            .attr({"x": sx + 35, "y": sy, "width": sw, "height": 15})
            .style({"fill": "#fed000"})
            .attr("opacity", 0.0)
            .transition().delay(2 * st).duration(st)
            .attr("opacity", 1.0);
        ast.gmf.append("rect")
            .attr({"x": sx + 52, "y": sy, "width": sw, "height": 15})
            .style({"fill": "#fed000"})
            .attr("opacity", 0.0)
            .transition().delay(3 * st).duration(st)
            .attr("opacity", 1.0);
        ast.gmf.append("rect")
            .attr({"x": sx + 69, "y": sy, "width": sw, "height": 15})
            .style({"fill": "#fed000"})
            .attr("opacity", 0.0)
            .transition().delay(4 * st).duration(st)
            .attr("opacity", 1.0);
        ast.gmf.append("image")
            .attr({"xlink:href": "img/stars18ptCEmptyCenters.png",
                   "x": sx, "y": sy, "height": 15, "width": 85})
            .style({"opacity": 1.0});
    }


    function membicFields (fseq) {
        var transtime = 123, kx = 76, ky = 101;
        ast.gmf.append("text")
            .attr({"x": 59, "y": 41, "fill": ast.textcolor})
            .style({"font-size": "18px", "font-weight": "bold",
                    "text-anchor": "left"})
            .text("Why memorable?");
        setTimeout(function () {
            drawStars(transtime); }, transtime);
        setTimeout(function () {
            ast.gmf.append("rect")
                .attr({"x": kx, "y": ky, "width": 10, "height": 10})
                .style({"fill": "none", "stroke": ast.textcolor});
            ast.gmf.append("text")
                .attr({"x": kx + 16, "y": ky + 11, "fill": ast.textcolor})
                .style({"font-size": "18px", "font-weight": "bold",
                        "text-anchor": "left", "opacity": 0.8})
                .text("keywords"); }, 2 * transtime);
        setTimeout(function () {
            ast.gmf.append("path")
                .attr("d", "M " + kx +        " " + (ky + 3) + 
                          " L " + (kx + 4) +  " " + (ky + 9) +
                          " L " + (kx + 10) + " " + ky +
                          " L " + (kx + 4) +  " " + (ky + 5) + " Z")
                .style({"fill": ast.textcolor, "stroke": ast.textcolor}); },
                   2.8 * transtime);
        d3.select("#membicbubble").transition()
            .delay(3 * transtime).duration(transtime)
            .attr({"fill-opacity": 0.4, "stroke-opacity": 0.4});
        setTimeout(function () {
            nextAnimationSequence(fseq); }, 4 * transtime);
    }


    function collapseFieldsToMembic (fseq) {
        var transtime = 123;
        ast.gmembic.transition().duration(transtime)
            //transform and scale: scalex, 0, 0, scaley, transx, transy
            .attr("transform", "matrix(0.3,0,0,0.22,10,10)");
        ast.gmf.attr("opacity", 1.0)
            .transition().duration(transtime)
            .attr("opacity", 0.0);
        ast.gmembic.append("text")
            .attr({"x": 128, "y": 90, "fill-opacity": 0,
                   "id": "linktxt", "fill": ast.textcolor})
            .style({"font-size": "56px", "font-weight": "bold",
                    "text-anchor": "middle"})
            .text("Membic")
            .transition().duration(transtime)
            .attr("fill-opacity", 1.0);
        setTimeout(function () {
            nextAnimationSequence(fseq); }, 2 * transtime);
    }


    function membicPosting (fseq) {
        jt.byId("linkpluswhyspan").style.display = "initial";
    }


    function endDisplay () {
        var html = ["div", {style: "font-size:x-small;" + 
                                   "padding:0px 0px 8px 0px;"},
          [["a", {href: "#replay", onclick: jt.fs("app.anime.run()")},
            "REPLAY"],
           " | ",
           ["a", {href: "#origin", 
                  onclick: jt.fs("app.layout.displayDoc('docs/origin.html')")},
            "ORIGIN"],
           " | ",
           ["a", {href: "#intro",
                  onclick: jt.fs("window.open('" + 
              "https://membic.wordpress.com/2016/02/17/introducing-membic')")},
            "INTRODUCTION"]]];
        //jt.out("aadiv", jt.tac2html(html));
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function () {
        //return;  //not ready for production yet
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(app.anime.run, 300); }
        //jt.err("Starting animation...");
        hideStaticComponents();
        ast.svg = d3.select("#aadiv").append("svg")
            .attr({"width": ast.width, "height": ast.height})
            .append("g")
            .attr("transform", "translate(10,0)");
        ast.svg.append("rect")
            .attr({"x": 0, "y": 0, "width": ast.width, "height": ast.height})
            .style({"fill": "white", "opacity": 0.8});  //TODO: 0.4
        ast.gcontent = ast.svg.append("g");  //overall content display
        ast.gmembic = ast.gcontent.append("g");
        ast.gmembic.append("ellipse")
            .attr({"cx": 128, 
                   "cy": 70, 
                   "rx": 120,
                   "ry": 64,
                   "id": "membicbubble",
                   "fill-opacity": 0.0, "stroke-opacity": 0.0})
            .style({"fill": "#fd700a", "stroke": "#b9100f"});
        ast.gmf = ast.gmembic.append("g")
        ast.glnk = ast.gmf.append("g");
        nextAnimationSequence([displayIdentFieldsAndTypes,
                               collapseTypesToLink,
                               membicFields,
                               collapseFieldsToMembic,
                               membicPosting,
                               endDisplay]);
    }

};  //end of returned functions
}());

