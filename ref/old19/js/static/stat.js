/*global d3, jtminjsDecorateWithUtilities, window, epsankey */
/*jslint browser, white, fudge, multivar */

//This module forms a global root. Like app, but for stat displays.
var stat, 
    jt = {};
        
stat = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dat = null, params = {},
        lks = [  //line chart keys
            {name: "Visits", color: "#0000FF", //blue
             desc: "Total of all visits.",
             children: [
                 {name: "Site", color: "#0095ff", //lighter blue
                  desc: "Visits from within the site.",
                  children: [
                      {name: "Signed In", color: "#006cff", field: "sitek",
                       desc: "Signed-in site visitors."},
                      {name: "Guest", color: "#0047ff", field: "sitev",
                       desc: "Unknown site visitors."}]},
                 {name: "Permalink", color: "#be00ff", //purpleish
                  desc: "Visits via permalink or custom theme hashtag link.",
                  children: [
                      {name: "Signed In", color: "#9100ff", field: "permk",
                       desc: "Signed-in permalink visitors."},
                      {name: "Guest", color: "#5e00ff", field: "permv",
                       desc: "Unknown permalink visitors."}]},
                 {name: "RSS", color: "#000fff", //cyan
                  desc: "Visits via RSS readers."}]},
            {name: "Actions", color: "#00af02",  //green
             desc: "Total actions.",
             children: [
                 {name: "Starred", color: "#9cce00", field: "starred",
                  desc: "Total membics that were starred by other readers."},
                 {name: "Remembered", color: "#54ae00", field: "remembered",
                  desc: "Total membics remembered by other readers."},
                 {name: "Responded", color: "#00a62d", field: "responded",
                  desc: "Total membics written from yours."}]},
            {name: "Content", color: "#ff951e", //membic orange
             desc: "Total content creation and editing.",
             children: [
                 {name: "Created", color: "#fd700a", field: "membics",
                  desc: "Total membics created."},
                 {name: "Edited", color: "#fdba0a", field: "edits",
                  desc: "Total edits to existing membics."},
                 {name: "Removed", color: "#e27062", field: "removed",
                  desc: "Total theme posts removed."}]}],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    csvkey = function (elem) {
        return elem.slice(0, elem.indexOf(":"));
    },


    mergeCSVEntries = function (ca, cb) {
        var es = ca + "," + cb;
        es = es.split(",");
        es.sort();
        es = es.filter(function (entry, idx, arr) {
            return !idx || csvkey(arr[idx - 1]) !== csvkey(entry); });
        return es;
    },


    mergeCSVCounters = function (ca, cb) {
        var res, es;
        es = ca + "," + cb;
        es = es.split(",");
        es.sort(function (a, b) {
            return csvkey(a).localeCompare(csvkey(b)); });
        res = [];
        es.forEach(function (elem, idx, arr) {
            var acc, val;
            if(!idx || csvkey(arr[idx - 1]) !== csvkey(elem)) {
                res.push(elem); }
            else {
                acc = arr[idx - 1];
                acc = +(acc.slice(acc.indexOf(":") + 1));
                val = +(elem.slice(elem.indexOf(":") + 1));
                arr[idx - 1] = csvkey(elem) + ":" + (acc + val); }});
        return res;
    },


    combineDays = function () {
        dat.days = [];
        dat.raw.forEach(function (mc) {
            var prev = null;
            if(dat.days.length) {
                prev = dat.days[dat.days.length - 1]; }
            if(prev && prev.day.getTime() === mc.day.getTime()) {
                prev.sitev += mc.sitev || 0;
                prev.sitek += mc.sitek || 0;
                prev.permv += mc.permv || 0;
                prev.permk += mc.permk || 0;
                prev.rssv += mc.rssv || 0;
                prev.logvis = mergeCSVEntries(prev.logvis, mc.logvis);
                prev.refers = mergeCSVCounters(prev.refers, mc.refers);
                prev.agents = mergeCSVCounters(prev.agents, mc.agents);
                prev.membics += mc.membics || 0;
                prev.edits += mc.edits || 0;
                prev.removed += mc.removed || 0;
                prev.starred += mc.starred || 0;
                prev.remembered += mc.remembered || 0;
                prev.responded += mc.responded || 0; }
            else {
                dat.days.push(mc); } });
    },


    fillDays = function () {
        var start, now, end, filled = [], index = 0;
        start = dat.days[0].day.getTime();
        now = new Date();
        end = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        while(start < end) {
            if(dat.days[index].day.getTime() === start) {
                //jt.log(st + " pushing existing: " + dat.days[index].day);
                filled.push(dat.days[index]);
                if(index < dat.days.length - 1) {
                    index += 1; } }
            else {
                //jt.log(st + " pushing fill: " + new Date(start));
                filled.push({refp: "fill",
                             day: new Date(start),
                             modified: new Date(start),
                             sitev: 0,
                             sitek: 0,
                             permv: 0,
                             permk: 0,
                             rssv: 0,
                             logvis: "",
                             refers: "",
                             agents: "",
                             membics: 0,
                             edits: 0,
                             removed: 0,
                             starred: 0,
                             remembered: 0,
                             responded: 0}); }
            start += 24 * 60 * 60 * 1000; }
        dat.days = filled;
    },


    sumSeries = function (keys) {
        var res;
        keys.forEach(function (key, ki) {
            if(!ki) {  //copy the first key series values
                res = key.series.map(function (sc) {
                    return {x: sc.x, y: sc.y}; }); }
            else {     //sum accumulate any subsequent series values
                res.forEach(function (acc, idx) {
                    acc.y += key.series[idx].y || 0; }); } });
        return res;
    },


    prepData = function (mcs) {
        dat = {raw: mcs};
        dat.raw.forEach(function (counter) {
            counter.day = new Date(counter.day); });
        dat.raw.sort(function (a, b) {
            return a.day - b.day; });
        combineDays();
        fillDays();
        dat.ymax = 0;
        dat.indmax = 0;
        stat.createLineChartSeries(lks, null, 0);
        dat.lks = lks;
    },


    createCharts = function () {
        var title, html, mods = ["lc", "pc", "rc", "ac"];
        title = params.title || "";
        title = jt.dec(title);
        html = [];
        mods.forEach(function (mod) {
            html.push(["div", {id: mod + "div"}]); });
        html = ["div", {id: "chartsdiv"}, 
                [["div", {id: "chartstitlediv",
                          style: "text-align:center;font-size:xx-large;" +
                                 "font-weight:bold;"},
                  title],
                 html]];
        jt.out('dispdiv', jt.tac2html(html));
        mods.forEach(function (mod, idx) {
            var nextdiv = "";
            if(idx < mods.length - 1) {
                nextdiv = mods[idx + 1] + "div"; }
            stat[mod].display(mod + "div", dat, nextdiv); });
    },


    fetchDataAndDisplay = function () {
        var parstr = "";
        jt.out('dispdiv', "Fetching data...");
        params = jt.parseParams("String");
        if(params.ctype && params.parentid) {
            parstr ="?ctype=" + params.ctype + 
                "&parentid=" + params.parentid; }
        else if(params.coopid) {
            parstr ="?ctype=coop&parentid=" + params.coopid; }
        else if(params.penid) {
            parstr ="?ctype=pen&parentid=" + params.penid; }
        else {
            parstr ="?ctype=site&parentid=0"; }
        if(params.am && params.at && params.an) {  //auth info
            parstr += "&am=" + params.am + "&at=" + params.at + 
                "&an=" + params.an + "&penid=" + params.penid; }
        parstr += jt.ts("&cb=", "hour");
        jt.call('GET', "../getmctrs" + parstr, null,
                function(mcs) {
                    jt.out('dispdiv', "Preparing data...");
                    prepData(mcs);
                    createCharts(); },
                function (code, errtxt) {
                    jt.out('dispdiv', "Data fetch failed " + code + 
                           ": " + errtxt); },
                jt.semaphore("stat.fetchDataAndDisplay"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function () {
        jtminjsDecorateWithUtilities(jt);
        fetchDataAndDisplay();
    },

    createLineChartSeries: function (children, parent, indent) {
        children.forEach(function (key) {
            dat.series = dat.series || [];    //series array
            dat.sis = dat.sis || {};          //series by id (field or name)
            key.id = key.field || key.name;
            if(!dat.sis[key.id]) {
                dat.sis[key.id] = key;
                dat.series.push(key); }
            if(parent) {
                key.parent = parent; }
            if(key.children) {
                stat.createLineChartSeries(key.children, key, indent + 1);
                key.series = sumSeries(key.children); }
            else {
                key.series = dat.days.map(function (day) {
                    return {x: day.day, y: day[key.id] || 0}; }); }
            key.peak = 0;
            key.peak2 = 0;
            key.series.forEach(function (coord) {
                if(coord.y > key.peak) {
                    key.peak2 = key.peak;
                    key.peak = coord.y; }
                else if(coord.y > key.peak2) {
                    key.peak2 = coord.y; } });
            dat.ymax = Math.max(dat.ymax, key.peak);
            dat.indmax = Math.max(dat.indmax, indent); });
    }

}; //end of returned functions
}());
