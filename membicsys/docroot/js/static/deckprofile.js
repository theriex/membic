/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.deckprofile = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dc = null,
        dsp = null;


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function appendProfileIdentBulletFuncs (bfs) {
        var sc = {x:68, x2:72, namey:26},
            bb;
        bfs.push(function (context) {
            var timing = d3ckit.timing(0.6);
            d3ckit.showText(context, "ptpic", "Profile picture", timing,
                            {x:sc.x, y:sc.namey}); 
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(0.6);
            bb = d3.select("#ptpic").node().getBBox();
            d3ckit.showText(context, "ptico", ", icon,", timing,
                            {x:sc.x + bb.width, y:sc.namey}); 
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(0.8);
            d3ckit.showText(context, "ptrep", "representative", timing,
                            {x:sc.x, y:dc.line2y}); 
            bb = d3.select("#ptrep").node().getBBox();
            d3ckit.showText(context, "ptimg", "image", timing,
                            {x:bb.x + bb.width + 6, y:dc.line2y});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing();
            d3ckit.transElement(context, "ptpic", timing,
                                {tl: "-68,0", opa: 0.0});
            d3ckit.transElement(context, "ptico", timing,
                                {tl: "-183,0", opa: 0.0});
            d3ckit.transElement(context, "ptrep", timing,
                                {tl: "-68,0", opa: 0.0});
            d3ckit.transElement(context, "ptimg", timing,
                                {tl: "-190,0", opa: 0.0});
            d3ckit.drawBox(context, "picframe", timing, 
                           {x: 10, y: 10, w: 50, stropa: 0.8});
            d3ckit.showGraphic(context, "imgprof", timing,
                               {x: 4, y: 14, w: 55, h: 47,
                                href: "img/profile.png"});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing();
            d3ckit.showText(context, "pname", "Pen Name", timing,
                            {x:sc.x2, y:sc.namey}); 
            d3ckit.showText(context, "pnor", "or", timing,
                            {x:98, y:46}); 
            d3ckit.showText(context, "pnrn", "Real Name", timing,
                            {x:sc.x2, y:dc.line3y});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(0.6);
            d3ckit.transElement(context, "pnor", timing,
                                {tl: "0,-26", opa: 0.0});
            d3ckit.transElement(context, "pnrn", timing,
                                {tl: "0,-52", opa: 0.0});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing();
            d3ckit.showText(context, "pdesc", "Anything you want to say",
                            timing, {x:sc.x2, y:dc.line2y,
                                     "font-size": "14px", 
                                     "font-weight": "normal"});
            d3ckit.showText(context, "pdesc2", "about yourself (optional)",
                            timing, {x:sc.x2, y:dc.line2y + 16,
                                     "font-size": "14px", 
                                     "font-weight": "normal"});
            timing.duration *= 2;  //extra hold since lots of words
            return d3ckit.totalTime(timing); });
    }


    function makeProfTabFunc (tabs, tab, idx, tc, sc) {
        return function (context) {
            var pt, timing = d3ckit.timing();
            if(idx > 0) {
                pt = tabs[idx - 1];
                d3ckit.transElement(context, pt.gid, timing, {opa:sc.op});
                d3ckit.transElement(context, pt.ti, timing, {opa:0.0}); }
            if(tab.gid) {
                d3ckit.transElement(context, tab.gid, timing, {opa:1.0});
                d3ckit.showText(context, tab.ti, tab.txt, timing, tc); }
            return d3ckit.totalTime(timing); };
    }


    function appendProfileTabBulletFuncs (bulletfuncs) {
        var sc = {x:20, y:84, tw:40, op:0.4},
            tcs = {x:  20, y: 128, fw: "normal", ta: "start"},
            tcm = {x: 150, y: 128, fw: "normal", ta: "middle"},
            tce = {x: 238, y: 128, fw: "normal", ta: "end"},
            tabs = [{gid: "tablatest", img: "img/tablatest.png",
                     ti: "tl", txt: "Membics you've made recently"},
                    {gid: "tabtop", img: "img/top.png",
                     ti: "tt", txt: "Your top membics of all time"},
                    {gid: "tabmemo", img: "img/tabmemo.png",
                     ti: "tm", txt: "Remembered membics from others"},
                    {gid: "tabsearch", img: "img/search.png",
                     ti: "ts", txt: "Search your membics"},
                    {gid: "tabendo", img: "img/endorse.png",
                     ti: "te", txt: "Profiles you endorse"},
                    {gid: "tabtheme", img: "img/tabctms.png",
                     ti: "tc", txt: "Themes you contribute to"},
                    {gid: null}];
        bulletfuncs.push(function (context) {
            var timing = d3ckit.timing(0.4);
            tabs.forEach(function (tab, idx) {
                d3ckit.showGraphic(context, tab.gid, timing,
                                   {x:sc.x + (idx * sc.tw), y:sc.y, w:20, 
                                    opacity:sc.op, href: tab.img}); });
            return d3ckit.totalTime(timing); });
        tabs.forEach(function (tab, idx) {
            var tc = tcm;
            if(idx === 0) {
                tc = tcs; }
            if(idx === tabs.length - 1) {
                tc = tce; }
            bulletfuncs.push(makeProfTabFunc(tabs, tab, idx, tc, sc)); });
        return bulletfuncs;
    }


    function getTaglineBulletFuncs () {
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "proftag", 
                                "Augment your memory and share.", timing,
                                {x:20, y:dc.line3y});
                d3ckit.showGraphic(context, "proftagimg", timing,
                                   {x:120, y:80, w:55, h:47,
                                    href: "img/profile.png"});
                timing.duration *= 2;  //extra hold time at end
                return d3ckit.totalTime(timing); }
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    getSlides: function () {
        var firstSlideBullets = [];
        appendProfileIdentBulletFuncs(firstSlideBullets);
        appendProfileTabBulletFuncs(firstSlideBullets);
        return [firstSlideBullets,
                getTaglineBulletFuncs()];
    },


    init: function (context) {
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(context, "yourprof", "Your Profile", null,
                        {x:72, y:dc.titley, fs:dc.titlefs});
    }

};  //end of returned functions
}());
