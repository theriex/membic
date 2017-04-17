/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge, for */

app.deckmembic = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dc = null,
        dsp = null;

    ////////////////////////////////////////
    //slide specific helper functions
    ////////////////////////////////////////

    function drawStars (timing, g) {
        var sx = 100, sy = 34, sr = 7, st, sd, soff, elem;
        st = Math.round(timing.duration / 5);
        sd = timing.delay + timing.duration;
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
        timing.duration *= 3;   //took 3 total steps to draw
    }


    function drawKeywords (timing, g) {
        var kx = 119, ky = 96, cbh = 10,
            cbx = kx - 17, cby = ky - cbh, cbd, elem, dds;
        dds = d3ckit.getDisplay();
        elem = d3.select("#cbrect");
        if(elem.empty()) {
            elem = g.append("rect")
                .attr({"x": cbx, "y": cby, "width": cbh, "height": cbh,
                       "id": "cbrect", "stroke-opacity": 0.0})
                .style({"fill": "none", "stroke": dds.textcolor}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("stroke-opacity", 0.5);
        d3ckit.showText(g, "cbkeywords", "Keywords", timing,
                        {x:kx, y:ky, "font-size":"14px"});
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
                .style({"fill": dds.textcolor, "stroke": dds.textcolor})
                .attr({"fill-opacity": 0.0, "stroke-opacity": 0.0}); }
        elem.transition().delay(timing.delay + cbd).duration(cbd)
            .attr("fill-opacity", 1.0)
            .attr("stroke-opacity", 1.0);
        timing.duration *= 2;  //took 2 total steps to draw
    }


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function getLinkComponentBulletFuncs () {
        var ad = {x:dc.leftx + 110, x2:140},
            ic = {w:20, x:dc.leftx + 104, y2:26, y3:52, y4:78};
        return [
            function (g) {
                var timing = d3ckit.timing(0.3);
                d3ckit.showText(g, "lcurl", "URL", timing,
                                {x:dc.leftx + 30, y:dc.line3y}); 
                d3ckit.showText(g, "lcor", "or", timing,
                                {x:dc.leftx + 74, y:dc.line3y, 
                                 "font-size":"14px"});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(g, "imgarticle", timing,
                                   {x:ic.x, y:ic.y2, w:ic.w, h:ic.w,
                                    href: "img/TypeArticle50.png"});
                d3ckit.showText(g, "ta", "Title, Author", timing,
                                {x:ad.x2, y:dc.line2y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgarticle", 0.0);
                d3ckit.showGraphic(g, "imgbook", timing,
                                   {x:ic.x, y:ic.y2, w:ic.w, h:ic.w,
                                    href: "img/TypeBook50.png"});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(g, "imgvideo", timing,
                                   {x:ic.x, y:ic.y3, w:ic.w, h:ic.w,
                                    href: "img/TypeVideo50.png"});
                d3ckit.showText(g, "tr", "Title, Artist", timing,
                                {x:ad.x2, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgvideo", 0.0);
                d3ckit.showGraphic(g, "imgmusic", timing,
                                   {x:ic.x, y:ic.y3, w:ic.w, h:ic.w,
                                    href: "img/TypeSong50.png"});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(g, "imgact", timing,
                                   {x:ic.x, y:ic.y4, w:ic.w, h:ic.w,
                                    href: "img/TypeActivity50.png"});
                d3ckit.showText(g, "na", "Name, Address", timing,
                                {x:ad.x2, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgact", 0.0);
                d3ckit.showGraphic(g, "imgyum", timing,
                                   {x:ic.x, y:ic.y4, w:ic.w, h:ic.w,
                                    href: "img/TypeYum50.png"});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgbook", 0.0);
                d3ckit.fadeElement(timing, "ta", 0.0);
                d3ckit.showText(g, "lcunique", "Unique", timing,
                                {x:ad.x2, y:dc.line2y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgmusic", 0.0);
                d3ckit.fadeElement(timing, "tr", 0.0);
                d3ckit.showText(g, "lcid", "Identifying", timing,
                                {x:ad.x2, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "imgyum", 0.0);
                d3ckit.fadeElement(timing, "na", 0.0);
                d3ckit.showText(g, "lcfields", "Fields", timing,
                                {x:ad.x2, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function () {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(timing, "lcor", 0.0);
                d3ckit.transElement(timing, "lcunique", {tl:"-93,8", opa:0.4});
                d3ckit.transElement(timing, "lcid",     {tl:"-93,0", opa:0.4});
                d3ckit.transElement(timing, "lcfields", {tl:"-93,-8", opa:0.4});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(g, "link", "Link", timing, {x:38, y:dc.line3y});
                d3ckit.fadeElement(timing, ["lcurl", "lcunique", "lcid", 
                                            "lcfields"], 0.0);
                d3ckit.drawBox(g, "linkframe", timing, 
                               {x:26, y:36, w:60, stropa:0.8});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.8);
                d3ckit.showText(g, "strel", "Relevance", timing, 
                                {x:100, y:46});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(g, "stimp", "Importance", timing, 
                                {x:100, y:66});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(g, "stqua", "Quality", timing, 
                                {x:100, y:86});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(g, "stpri", "Primacy", timing, 
                                {x:100, y:106});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(g, "staff", "Affinity", timing, 
                                {x:100, y:126});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(0.8);
                d3ckit.transElement(timing, "strel", {opa: 0.0, tl: "0,0"});
                d3ckit.transElement(timing, "stimp", {opa: 0.0, tl: "0,-20"});
                d3ckit.transElement(timing, "stqua", {opa: 0.0, tl: "0,-40"});
                d3ckit.transElement(timing, "stpri", {opa: 0.0, tl: "0,-60"});
                d3ckit.transElement(timing, "staff", {opa: 0.0, tl: "0,-80"});
                drawStars(timing, g);  //adjusts timing.duration
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(1.0);
                drawKeywords(timing, g);
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(g, "whymem", "Why is this memorable?", timing,
                                {x:100, y:72, fs:"14px", fe:"italic"});
                return d3ckit.totalTime(timing); }
        ];
    }


    function getTaglineBulletFuncs () {
        var ad = {x:dc.leftx + 20};
        return [
            function (g) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(g, "mmwhen", "When you find something", timing,
                                {x:ad.x, y:dc.line2y});
                d3ckit.showText(g, "mmworth", "worth remembering,", timing,
                                {x:ad.x, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (g) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(g, "mmake", "make a membic.", timing,
                                {x:ad.x, y:dc.line4y});
                d3ckit.showGraphic(g, "imgwrite", timing,
                                   {x:187, y:84, w:55, h:47,
                                    href: "img/writenew.png"});
                timing.duration *= 2;  //extra hold time at end
                return d3ckit.totalTime(timing); }
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    getSlides: function () {
        return [getLinkComponentBulletFuncs(),
                getTaglineBulletFuncs()];
    },


    init: function (g) {
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(g, "whatit", "What's a Membic?", null,
                        {x:32, y:dc.titley, fs:dc.titlefs});
    }

};  //end of returned functions
}());

