/*global window, document, app, jt, d3 */
/*jslint browser, multivar, white, fudge, for */

app.anime = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ast = { phase: "init" },


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    hideStaticComponents = function () {
        jt.byId("linkpluswhyspan").style.display = "none";
        jt.byId("themesitespan").style.display = "none";
        jt.byId("introductionli").style.display = "none";
        jt.byId("originli").style.display = "none";
    },


    displayMembicTypes = function (lay, mts) {
        var mt, fm = 2, i;
        if(!mts || !mts.length) {
            return; }
        mt = mts[0];
        if(!mt.initialized) {
            for(i = 0; i < 4; i += 1) {
                jt.out("lctxt" + i, ""); }
            lay.gtxt.attr("opacity", 1.0);
            mt.fidx = 0;
            mt.initialized = true; }
        if(mt.fidx < mt.fields.length) {
            jt.out("lctxt" + mt.fo, mt.fields[mt.fidx]); }
        mt.fidx += 1;
        mt.fo += 1;
        if(mt.fidx < mt.fields.length) {
            setTimeout(function () {
                displayMembicTypes(lay, mts); }, mt.delay); }
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
                displayMembicTypes(lay, mts.slice(1)); }, 
                       (fm + 1) * mt.delay); }
    },


    displayLinkConcept = function () {
        var i, lay = {icosize: 30, padx: 6, pady: 3, txtw: 80, 
                      leftm: 10, topm: 5, fillc: "black"};
        lay.rw = (2 * (lay.icosize + lay.padx)) + lay.txtw + lay.padx;
        lay.xw = Math.round(lay.rw / 4);
        lay.yh = lay.icosize + lay.pady;
        lay.gtxt = ast.svg.append("g");
        lay.gico = ast.svg.append("g");
        for(i = 0; i < 4; i += 1) {
            lay.gtxt.append("text")
                .attr({"x": lay.leftm + (2 * lay.xw), 
                       "y": ((i + 1) * lay.yh), 
                       "id": "lctxt" + i, "fill": lay.fillc})
                .style({"font-size": "16px", "font-weight": "bold",
                        "text-anchor": "middle"})
                .text(""); }
        displayMembicTypes(
            lay, [{fields: ["Title", "Author", "Publisher", "Year"],
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
    },


    endDisplay = function () {
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
        jt.out("aadiv", jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    run: function () {
        return;  //not ready for production yet
        if(typeof d3 === 'undefined') {  //wait until loaded
            return setTimeout(app.anime.run, 300); }
        hideStaticComponents();
        ast.width = 300;
        ast.height = 160;
        ast.svg = d3.select("#aadiv").append("svg")
            .attr({"width": ast.width, "height": ast.height})
            .append("g")
            .attr("transform", "translate(10,0)");
        ast.svg.append("rect")
            .attr({"x": 0, "y": 0, "width": ast.width, "height": ast.height})
            .style({"fill": "white", "opacity": 0.4});
        displayLinkConcept();
        //endDisplay();
    }

};  //end of returned functions
}());



