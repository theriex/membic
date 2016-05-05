/*global window, document, app, jt, d3 */
/*jslint browser, multivar, white, fudge, for */

app.anime = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var ast = { width: 300, height: 170, textcolor: "black" },
        defaultTransitionTime = 1600 /*1600*/,
        svgid = "animsvg";


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function animationDisplayActive () {
        if(jt.byId(svgid)) {
            return true; }
        return false;
    }


    function delayf (func, delay, currsvgid) {
        setTimeout(function () {
            if(svgid !== currsvgid || !animationDisplayActive()) {
                return; }
            func(); }, delay);
    }


    function hideStaticComponents () {
        jt.byId("linkpluswhyspan").style.display = "none";
        jt.byId("membicsitespan").style.display = "none";
        jt.byId("themesitespan").style.display = "none";
        jt.byId("introductionli").style.display = "none";
        jt.byId("originli").style.display = "none";
    }


    function initSubgroups () {
        ast.gmpost = ast.gcontent.append("g");
        ast.gmembic = ast.gcontent.append("g");
        ast.gmembic.append("ellipse")
            .attr({"cx": 128, 
                   "cy": 70, 
                   "rx": 120,
                   "ry": 64,
                   "id": "membicbubble",
                   "fill-opacity": 0.0, "stroke-opacity": 0.0})
            .style({"fill": "#fd700a", "stroke": "#b9100f"});
        ast.gmf = ast.gmembic.append("g");
        ast.glnk = ast.gmf.append("g");
    }


    function nextAnimationSequence (fseq) {
        if(!animationDisplayActive()) { 
            return; }
        if(!fseq || !fseq.length) {
            return; }
        (fseq.shift())(fseq);
    }


    function displayTitle (fseq) {
        var mt, bb;
        mt = ast.svg.append("text")
            .attr({"x": 5, "y": 18, "fill-opacity": 1.0,
                   "fill": ast.textcolor})
            .style({"font-size": "16px", "font-weight": "bold",
                    "text-anchor": "left"})
            .text("membic:")
            .transition().duration(3 * defaultTransitionTime)
            .attr("fill-opacity", 0.0);
        bb = mt.node().getBBox();
        ast.svg.append("text")
            .attr({"x": bb.x + bb.width, "y": 18, "fill-opacity": 1.0,
                   "fill": ast.textcolor})
            .style({"font-size": "16px", "font-weight": "normal",
                    "text-anchor": "left"})
            .text("Link + Why Memorable")
            .transition().duration(3 * defaultTransitionTime)
            .attr("fill-opacity", 0.0);
        delayf(function () {
            nextAnimationSequence(fseq); }, defaultTransitionTime, svgid);
    }


    function fadeReplaceText(tid, txt, delay) {
        var fadeout = Math.round(0.2 * delay),
            fadein = Math.round(0.4 * delay),
            dt = jt.byId(tid);
        if(!dt) {
            return; }
        dt = dt.innerHTML || "";
        if(txt !== dt) {  //text to display has changed
            d3.select("#" + tid).transition().duration(fadeout)
                .attr("fill-opacity", 0.0);
            delayf(function () {
                jt.out(tid, txt);
                d3.select("#" + tid).transition().duration(fadein)
                    .attr("fill-opacity", 1.0); }, fadeout, svgid); }
    }


    function displayMembicTypes (fseq, lay, mts) {
        var mt, fadeout, fadein, i, txt;
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
        lay.gico.append("image")
            .attr({"xlink:href": "img/" + mt.img, 
                   "x": mt.imgc.x, "y": mt.imgc.y,
                   "height": String(lay.icosize) + "px",
                   "width": String(lay.icosize) + "px",
                   "opacity": 0.0})
            .transition().duration(Math.round(0.2 * mt.delay ))
            .attr("opacity", 1.0);
        for(i = 0; i < 4; i += 1) {
            txt = "";
            if((i >= mt.fo) && ((i - mt.fo) < mt.fields.length)) {
                txt = mt.fields[i - mt.fo]; }
            fadeReplaceText("lctxt" + i, txt, mt.delay); }
        delayf(function () {
            displayMembicTypes(fseq, lay, mts.slice(1)); }, mt.delay, svgid);
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
                       "y": lay.topm + ((i + 1) * lay.yh) - 12, 
                       "id": "lctxt" + i, "fill": ast.textcolor,
                       "fill-opacity": 1.0})
                .style({"font-size": "16px", "font-weight": "bold",
                        "text-anchor": "middle"})
                .text(""); }
        ast.fatlay = lay;
        return lay;
    }


    function displayIdentFieldsAndTypes (fseq) {
        var lay = initFieldsAndTypesLayout(),
            basetime = defaultTransitionTime,
            tlong = Math.round(2 * basetime),
            tshort = Math.round(0.4 * basetime),
            tnorm = Math.round(1.4 * basetime),
            clock = {p1: {x: lay.leftm + (2 * lay.xw),
                          y: lay.topm + (0 * lay.yh)},
                     p2: {x: lay.leftm + (3 * lay.xw),
                          y: lay.topm + (1 * lay.yh)},
                     p4: {x: lay.leftm + (3 * lay.xw),
                          y: lay.topm + (2 * lay.yh)},
                     p5: {x: lay.leftm + (2 * lay.xw),
                          y: lay.topm + (3 * lay.yh)},
                     p7: {x: lay.leftm + (1 * lay.xw),
                          y: lay.topm + (3 * lay.yh)},
                     p8: {x: lay.leftm + (0 * lay.xw),
                          y: lay.topm + (2 * lay.yh)},
                     pA: {x: lay.leftm + 0 * lay.xw,
                          y: lay.topm + 1 * lay.yh},
                     pB: {x: lay.leftm + (1 * lay.xw),
                          y: lay.topm + (0 * lay.yh)}};
        displayMembicTypes(fseq, lay, 
            [{fields: ["Title", "Author", "Publisher", "Year"],
              fo: 0, delay: tlong, img: "TypeBook50.png", imgc: clock.pA},
             {fields: ["Title", "Author", "Publisher", "Year"],
              fo: 0, delay: tshort, img: "TypeArticle50.png", imgc: clock.p8},
             {fields: ["Title", "Artist", "Album", "Year"],
              fo: 0, delay: tnorm, img: "TypeSong50.png", imgc: clock.p2},
             {fields: ["Title", "Year", "Starring"],
              fo: 0, delay: tnorm, img: "TypeMovie50.png", imgc: clock.p4},
             {fields: ["Title", "Artist"],
              fo: 1, delay: tnorm, img: "TypeVideo50.png", imgc: clock.pB},
             {fields: ["Name", "Address"],
              fo: 1, delay: tshort, img: "TypeActivity50.png", imgc: clock.p1},
             {fields: ["Name", "Address"],
              fo: 1, delay: tshort, img: "TypeYum50.png", imgc: clock.p7},
             {fields: ["Name", "URL"],
              fo: 1, delay: tnorm, img: "TypeOther50.png", imgc: clock.p5}]);
    }


    function collapseTypesToLink (fseq) {
        var transtime = defaultTransitionTime;
        ast.fatlay.glnk.transition().duration(transtime)
            //transform and scale: scalex, 0, 0, scaley, transx, transy
            .attr("transform", "matrix(0.5,0,0,0.25,10,50)");
        ast.fatlay.gico.transition().duration(transtime)
            .attr("transform", "matrix(0.5,0,0,0.3,36,60)");
        ast.fatlay.gico.attr("opacity", 1.0)
            .transition().delay(transtime).duration(transtime)
            .attr("opacity", 0.0);
        ast.fatlay.gtxt.attr("opacity", 1.0)
            .transition().delay(transtime).duration(transtime)
            .attr("opacity", 0.0);
        d3.select("#linktxt").transition().delay(transtime).duration(transtime)
            .attr("fill-opacity", 1.0);
        delayf(function () {
            nextAnimationSequence(fseq); }, 2 * transtime, svgid);
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
        var transtime = defaultTransitionTime, kx = 76, ky = 101;
        ast.gmf.append("text")
            .attr({"x": 59, "y": 41, "fill": ast.textcolor})
            .style({"font-size": "18px", "font-weight": "bold",
                    "text-anchor": "left"})
            .text("Why memorable?");
        delayf(function () {
            drawStars(transtime); }, transtime, svgid);
        delayf(function () {
            ast.gmf.append("rect")
                .attr({"x": kx, "y": ky, "width": 10, "height": 10})
                .style({"fill": "none", "stroke": ast.textcolor});
            ast.gmf.append("text")
                .attr({"x": kx + 16, "y": ky + 11, "fill": ast.textcolor})
                .style({"font-size": "18px", "font-weight": "bold",
                        "text-anchor": "left", "opacity": 0.8})
                .text("keywords"); }, 2 * transtime, svgid);
        delayf(function () {
            ast.gmf.append("path")
                .attr("d", "M " + kx +        " " + (ky + 3) + 
                          " L " + (kx + 4) +  " " + (ky + 9) +
                          " L " + (kx + 10) + " " + ky +
                          " L " + (kx + 4) +  " " + (ky + 5) + " Z")
                .style({"fill": ast.textcolor, "stroke": ast.textcolor}); },
                   2.8 * transtime, svgid);
        d3.select("#membicbubble").transition()
            .delay(3 * transtime).duration(transtime)
            .attr({"fill-opacity": 0.4, "stroke-opacity": 0.4});
        delayf(function () {
            nextAnimationSequence(fseq); }, 4 * transtime, svgid);
    }


    function collapseFieldsToMembic (fseq) {
        var transtime = defaultTransitionTime;
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
        delayf(function () {
            nextAnimationSequence(fseq); }, 2 * transtime, svgid);
    }


    function displayMembicPostLabel (label) {
        ast.gmpost.append("text")
            .attr({"x": label.x, "y": label.y, id: "mpl" + label.text,
                   "fill": ast.textcolor})
            .style({"font-size": "14px", "font-weight": "bold",
                    "text-anchor": "middle", "opacity": 1.0})
            .text(label.text);
    }


    function displayMembicPostIcon (label, icoidx, transtime) {
        var bbx, sx, padx = 3, icow = 18, icodef;
        icodef = label.icons[icoidx];
        bbx = d3.select("#mpl" + label.text).node().getBBox();
        sx = bbx.x + bbx.width + padx + (icoidx * (icow + padx));
        transtime = 0.8 * transtime;  //hold stable icon at end
        ast.gmpost.append("text")
            .attr({"x": sx, "y": label.y, "fill": ast.textcolor,
                   "fill-opacity": 1.0})
            .style({"font-size": "12px", "font-weight": "bold",
                    "text-anchor": "left"})
            .text(icodef.text)
            .transition().duration(transtime)
            .attr("fill-opacity", 0.0);
        if(icodef.img === "rssicon.png") {
            sx += 2;
            icow -= 4; }
        ast.gmpost.append("image")
            .attr({"xlink:href": "img/" + icodef.img,
                   "x": sx, "y": bbx.y, "width": icow, "height": icow,
                   "id": "ico" + label.text + icoidx, "opacity": 0.0})
            .transition().duration(transtime)
            .attr("opacity", 1.0);
    }


    function fadeLabel (label, transtime) {
        d3.select("#mpl" + label.text).attr("fill-opacity", 1.0)
            .transition().delay(transtime).duration(transtime)
            .attr("fill-opacity", 0.7);
        label.icons.forEach(function (icon, idx) {
            d3.select("#ico" + label.text + idx)
                .transition().delay(transtime).duration(transtime)
                .attr("opacity", 0.7); });
    }


    function displayMembicPostingLabels (fseq, labels, labidx, icoidx) {
        var transtime = Math.round(0.9 * defaultTransitionTime), label;
        labidx = labidx || 0;
        icoidx = icoidx || 0;
        if(labidx < labels.length) {
            label = labels[labidx];
            if(!label.displayed) {
                displayMembicPostLabel(label);
                label.displayed = true; }
            else {
                displayMembicPostIcon(label, icoidx, transtime);
                icoidx += 1;
                if(icoidx >= label.icons.length) {
                    fadeLabel(label, transtime);
                    labidx += 1;
                    icoidx = 0; } }
            if(label.text === "Social") {
                transtime = Math.round(0.4 * transtime); }
            delayf(function () {
                displayMembicPostingLabels(fseq, labels, labidx, icoidx); }, 
                       transtime, svgid); }
        else {
            nextAnimationSequence(fseq); }
    }


    function membicPosting (fseq) {
        var fcx = 140, fcy = 29, fch = 36,
            labels = [
                {x: fcx, y: fcy, text: "Community", icons: [
                    {text: "Prefer", img: "prefer.png"},
                    {text: "Normal", img: "nopref.png"},  //subst endorse
                    {text: "Background", img: "background.png"},
                    {text: "Block", img: "block.png"}]},
                {x: fcx, y: fcy + fch, text: "Profile", icons: [
                    {text: "Recent", img: "tablatest.png"},
                    {text: "Favorites", img: "top.png"},
                    {text: "Search", img: "search.png"}]},
                {x: fcx, y: fcy + (2 * fch), text: "Theme", icons: [
                    {text: "Permalink", img: "permalink.png"},
                    {text: "Newsfeed", img: "rssicon.png"},
                    {text: "Embed", img: "embed50.png"},
                    {text: "Microsite", img: "microsite.png"}]},
                {x: fcx, y: fcy + (3 * fch), text: "Social", icons: [
                    {text: "Twitter", img: "tw_logo.png"},
                    {text: "Facebook", img: "f_logo.png"},
                    {text: "Pinterest", img: "p_logo.png"},
                    {text: "Tumblr", img: "t_logo.png"},
                    {text: "More...", img: "ellipsis.png"}]}];
        displayMembicPostingLabels(fseq, labels, 0, 0);
    }


    function morphToLogo (fseq) {
        var transtime = defaultTransitionTime;
        ast.gmpost.transition().duration(transtime)
            //transform and scale: scalex, 0, 0, scaley, transx, transy
            .attr("transform", "matrix(0.2,0,0,0.15,10,15)");
        ast.gmpost.attr("opacity", 1.0)
            .transition().delay(transtime).duration(transtime / 2)
            .attr("opacity", 0.0);
        ast.gmembic.transition().duration(transtime)
            .attr("transform", "matrix(0.34,0,0,0.26,10,10)");
        ast.gmembic.attr("opacity", 1.0)
            .transition().delay(transtime).duration(transtime)
            .attr("opacity", 0.0);
        ast.gcontent.append("image")
            .attr({"xlink:href": "img/membiclogo.png", 
                   "x": 3, "y": 2, "width": "100px", "height": "100px"})
            .attr("opacity", 0.0)
            .transition().delay(transtime).duration(transtime)
            .attr("opacity", 0.8);
        delayf(function () {
            nextAnimationSequence(fseq); }, 2 * transtime, svgid);
    }


    function shrinkAway (fseq) {
        var transtime = defaultTransitionTime;
        ast.svg.transition().duration(transtime)
            .attr("transform", "scale(0,0)");
        delayf(function () {
            nextAnimationSequence(fseq); }, transtime, svgid);
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
        jt.byId("linkpluswhyspan").style.display = "initial";
        jt.byId('membicsitespan').style.display = "initial";
        jt.byId('themesitespan').style.display = "initial";
        jt.out("aadiv", jt.tac2html(html));
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    reset: function () {
        jt.out("aadiv", "");  //clear any previous output
        svgid = "animsvg" + jt.ts();
    },

    run: function () {
        return;  //not ready for production yet
        if(window.d3 === undefined) {  //wait until loaded
            return setTimeout(app.anime.run, 300); }
        //jt.err("Starting animation...");
        app.anime.reset();
        hideStaticComponents();
        ast.svg = d3.select("#aadiv").append("svg")
            .attr({"width": ast.width, "height": ast.height, "id": svgid})
            .append("g")
            .attr("transform", "translate(10,0)");
        ast.svg.append("rect")
            .attr({"x": 0, "y": 0, "width": ast.width, "height": 24})
            .style({"fill": "white", "opacity": 0.4})
            .transition().duration(defaultTransitionTime).ease("exp")
            .attr("height", ast.height);
        ast.gcontent = ast.svg.append("g");  //overall content display
        initSubgroups();
        nextAnimationSequence([displayTitle,
                               displayIdentFieldsAndTypes,
                               collapseTypesToLink,
                               membicFields,
                               collapseFieldsToMembic,
                               membicPosting,
                               morphToLogo,
                               shrinkAway,
                               endDisplay]);
    }

};  //end of returned functions
}());

