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

    var dat = null,
        lks = [  //line chart keys
            {name: "Visits", color: "#0000FF", //blue
             desc: "Total visits.",
             children: [
                 {name: "Site", color: "#0095ff", //lighter blue
                  desc: "Visits from within the site.",
                  children: [
                      {name: "Signed In", color: "#006cff", field: "sitek",
                       desc: "Signed-in site visitors."},
                      {name: "Guest", color: "#0047ff", field: "sitev",
                       desc: "Unknown site visitors."}]},
                 {name: "Permalink", color: "#be00ff", //purpleish
                  desc: "Visits via permalink.",
                  children: [
                      {name: "Signed In", color: "#9100ff", field: "permk",
                       desc: "Signed-in permalink visitors."},
                      {name: "Guest", color: "#5e00ff", field: "permv",
                       desc: "Unknown permalink visitors."}]},
                 {name: "RSS", color: "#00fff", //cyan
                  desc: "Visits via RSS readers."}]},
            {name: "Actions", color: "#00ff00",  //bright green
             desc: "Total actions.",
             children: [
                 {name: "Starred", color: "#fff900", field: "starred",
                  desc: "Total membics that were starred by other readers."},
                 {name: "Remembered", color: "#7bff00", field: "remembered",
                  desc: "Total membics remembered by other readers."},
                 {name: "Responded", color: "#00ff45", field: "responded",
                  desc: "Total membics written from yours."}]},
            {name: "Content", color: "#ff951e", //membic orange
             desc: "Total content creation and editing.",
             children: [
                 {name: "Created", color: "#fd700a", field: "membics",
                  desc: "Total membics created."},
                 {name: "Edited", color: "#fdba0a", field: "edits",
                  desc: "Total membics edited."},
                 {name: "Removed", color: "#ee3f3b", field: "removed",
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
        var start, end, filled = [], index = 0, st;
        start = dat.days[0].day.getTime();
        end = new Date().getTime() - (24 * 60 * 60 * 1000);
        while(start < end) {
            st = new Date(start);
            if(dat.days[index].day.getTime() === start) {
                jt.log(st + " pushing existing: " + dat.days[index].day);
                filled.push(dat.days[index]);
                if(index < dat.days.length - 1) {
                    index += 1; } }
            else {
                jt.log(st + " pushing fill: " + new Date(start));
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
        stat.createLineChartSeries(lks);
    },


    createCharts = function () {
        var html;
        html = ["div", {id: "chartsdiv"},
                ["div", {id: "lcdiv"}]];
        jt.out('dispdiv', jt.tac2html(html));
        stat.lc.display("lcdiv", dat, lks);
    },


    fetchDataAndDisplay = function () {
        var params;
        jt.out('dispdiv', "Fetching data...");
        params = jt.parseParams("String");
        if(params.coopid) {
            params = "?ctype=coop&parentid=" + params.coopid; }
        else if(params.penid) {
            params = "?ctype=pen&parentid=" + params.penid; }
        else {
            params = "?ctype=site&parentid=0"; }
        params += jt.ts("&cb=", "hour")
        jt.call('GET', "../getmctrs" + params, null,
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

    createLineChartSeries: function (children, parent) {
        children.forEach(function (key) {
            var locymax;
            dat.series = dat.series || [];    //series array
            dat.sis = dat.sis || {};          //series by id (field or name)
            key.id = key.field || key.name;
            if(!dat.sis[key.id]) {
                dat.sis[key.id] = key;
                dat.series.push(key); }
            if(parent) {
                key.parent = parent; }
            if(key.children) {
                stat.createLineChartSeries(key.children, key);
                key.series = sumSeries(key.children); }
            else {
                key.series = dat.days.map(function (day) {
                    return {x: day.day, y: day[key.id] || 0}; }); }
            locymax = key.series.reduce(function (pv, ce) {
                return Math.max(pv, ce.y); }, 0);
            dat.ymax = Math.max(dat.ymax, locymax); });
    }

}; //end of returned functions
}());
