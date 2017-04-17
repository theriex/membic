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

    function drawStars (timing, context) {
        var sx = 100, sy = 34, sr = 7, st, sd, soff, elem;
        st = Math.round(timing.duration / 5);
        sd = timing.delay + timing.duration;
        soff = [2, 19, 36, 53, 70];
        soff.forEach(function (offset, idx) {
            elem = d3.select("#goldcircle" + idx);
            if(elem.empty()) {
                elem = context.g.append("circle")
                    .attr({"id": "goldcircle" + idx, "class": "goldcircle",
                           "cx": sx + sr + offset, "cy": sy + sr + 1, "r": sr,
                           "opacity": 0.0})
                    .style({"fill": "#fed000"}); }
            elem.transition().delay(sd + (idx * st)).duration(st)
                .attr("opacity", 1.0); });
        elem = d3.select("#starsimage");
        if(elem.empty()) {
            elem = context.g.append("image")
                .attr({"xlink:href": "img/stars18ptCEmptyCenters.png",
                       "x": sx, "y": sy, "height": 15, "width": 85,
                       "id": "starsimage", "opacity": 0.0}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("opacity", 1.0);
        timing.duration *= 3;   //took 3 total steps to draw
    }


    function drawKeywords (timing, context) {
        var kx = 119, ky = 96, cbh = 10,
            cbx = kx - 17, cby = ky - cbh, cbd, elem, dds;
        dds = d3ckit.getDisplay();
        elem = d3.select("#cbrect");
        if(elem.empty()) {
            elem = context.g.append("rect")
                .attr({"x": cbx, "y": cby, "width": cbh, "height": cbh,
                       "id": "cbrect", "stroke-opacity": 0.0})
                .style({"fill": "none", "stroke": dds.textcolor}); }
        elem.transition().delay(timing.delay).duration(timing.duration)
            .attr("stroke-opacity", 0.5);
        d3ckit.showText(context, "cbkeywords", "Keywords", timing,
                        {x:kx, y:ky, "font-size":"14px"});
        cbd = timing.duration;
        elem = d3.select("#cbcheckmark");
        if(elem.empty()) {
            elem = context.g.append("path")
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
            function (context) {
                var timing = d3ckit.timing(0.3);
                d3ckit.showText(context, "lcurl", "URL", timing,
                                {x:dc.leftx + 30, y:dc.line3y}); 
                d3ckit.showText(context, "lcor", "or", timing,
                                {x:dc.leftx + 74, y:dc.line3y, 
                                 "font-size":"14px"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(context, "imgarticle", timing,
                                   {x:ic.x, y:ic.y2, w:ic.w, h:ic.w,
                                    href: "img/TypeArticle50.png"});
                d3ckit.showText(context, "ta", "Title, Author", timing,
                                {x:ad.x2, y:dc.line2y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgarticle", timing, 0.0);
                d3ckit.showGraphic(context, "imgbook", timing,
                                   {x:ic.x, y:ic.y2, w:ic.w, h:ic.w,
                                    href: "img/TypeBook50.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(context, "imgvideo", timing,
                                   {x:ic.x, y:ic.y3, w:ic.w, h:ic.w,
                                    href: "img/TypeVideo50.png"});
                d3ckit.showText(context, "tr", "Title, Artist", timing,
                                {x:ad.x2, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgvideo", timing, 0.0);
                d3ckit.showGraphic(context, "imgmusic", timing,
                                   {x:ic.x, y:ic.y3, w:ic.w, h:ic.w,
                                    href: "img/TypeSong50.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(context, "imgact", timing,
                                   {x:ic.x, y:ic.y4, w:ic.w, h:ic.w,
                                    href: "img/TypeActivity50.png"});
                d3ckit.showText(context, "na", "Name, Address", timing,
                                {x:ad.x2, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgact", timing, 0.0);
                d3ckit.showGraphic(context, "imgyum", timing,
                                   {x:ic.x, y:ic.y4, w:ic.w, h:ic.w,
                                    href: "img/TypeYum50.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgbook", timing, 0.0);
                d3ckit.fadeElement(context, "ta", timing, 0.0);
                d3ckit.showText(context, "lcunique", "Unique", timing,
                                {x:ad.x2, y:dc.line2y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgmusic", timing, 0.0);
                d3ckit.fadeElement(context, "tr", timing, 0.0);
                d3ckit.showText(context, "lcid", "Identifying", timing,
                                {x:ad.x2, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "imgyum", timing, 0.0);
                d3ckit.fadeElement(context, "na", timing, 0.0);
                d3ckit.showText(context, "lcfields", "Fields", timing,
                                {x:ad.x2, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.fadeElement(context, "lcor", timing, 0.0);
                d3ckit.transElement(context, "lcunique", timing, 
                                    {tl:"-93,8", opa:0.4});
                d3ckit.transElement(context, "lcid", timing, 
                                    {tl:"-93,0", opa:0.4});
                d3ckit.transElement(context, "lcfields", timing, 
                                    {tl:"-93,-8", opa:0.4});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "link", "Link",
                                timing, {x:38, y:dc.line3y});
                d3ckit.fadeElement(context, ["lcurl", "lcunique", "lcid", 
                                             "lcfields"], timing, 0.0);
                d3ckit.drawBox(context, "linkframe", timing, 
                               {x:26, y:36, w:60, stropa:0.8});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.8);
                d3ckit.showText(context, "strel", "Relevance", timing, 
                                {x:100, y:46});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "stimp", "Importance", timing, 
                                {x:100, y:66});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "stqua", "Quality", timing, 
                                {x:100, y:86});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "stpri", "Primacy", timing, 
                                {x:100, y:106});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "staff", "Affinity", timing, 
                                {x:100, y:126});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.8);
                d3ckit.transElement(context, "strel", timing,
                                    {opa: 0.0, tl: "0,0"});
                d3ckit.transElement(context, "stimp", timing,
                                    {opa: 0.0, tl: "0,-20"});
                d3ckit.transElement(context, "stqua", timing,
                                    {opa: 0.0, tl: "0,-40"});
                d3ckit.transElement(context, "stpri", timing,
                                    {opa: 0.0, tl: "0,-60"});
                d3ckit.transElement(context, "staff", timing,
                                    {opa: 0.0, tl: "0,-80"});
                drawStars(timing, context);  //adjusts timing.duration
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                drawKeywords(timing, context);
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "whymem", "Why is this memorable?",
                                timing, {x:100, y:72, fs:"14px", fe:"italic"});
                return d3ckit.totalTime(timing); }
        ];
    }


    function getTaglineBulletFuncs () {
        var ad = {x:dc.leftx + 20};
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "mmwhen", "When you find something",
                                timing, {x:ad.x, y:dc.line2y});
                d3ckit.showText(context, "mmworth", "worth remembering,", 
                                timing, {x:ad.x, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "mmake", "make a membic.", timing,
                                {x:ad.x, y:dc.line4y});
                d3ckit.showGraphic(context, "imgwrite", timing,
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


    init: function (context) {
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(context, "whatit", "What's a Membic?", null,
                        {x:32, y:dc.titley, fs:dc.titlefs});
    }

};  //end of returned functions
}());

