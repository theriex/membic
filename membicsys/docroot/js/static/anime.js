/*global window, document, app, jt, d3 */
/*jslint browser, multivar, white, fudge, for */

app.anime = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ast = { width: 300, height: 180 };


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
                       "id": "linktxt", "fill": lay.fillc})
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
                      leftm: 10, topm: 28, fillc: "black"};
        lay.rw = (2 * (lay.icosize + lay.padx)) + lay.fldw + lay.padx;
        lay.xw = Math.round(lay.rw / 4);
        lay.yh = lay.icosize + lay.pady;
        lay.glnk = ast.svg.append("g");
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
                       "id": "lctxt" + i, "fill": lay.fillc})
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
        var transtime = 1000;
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
        return;  //not ready for production yet
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
            .style({"fill": "white", "opacity": 0.4});
        nextAnimationSequence([displayIdentFieldsAndTypes,
                               collapseTypesToLink,
                               endDisplay]);
    }

};  //end of returned functions
}());

