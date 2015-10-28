/*global d3, jtminjsDecorateWithUtilities, window */
/*jslint white, fudge */

//This is a degenerate module just used for reporting.  Don't model it.
var actstat;
actstat = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var jt = {},
        botids = [],
        stats = null,
        // colors = [ "Maroon", "Crimson", "red", "Salmon",
        //            "OrangeRed", "orange", "GoldenRod", "yellow",
        //            "Chartreuse", "green", "DarkGreen", "LightSeaGreen",
        //            "blue", "purple", "Indigo", "DarkViolet",
        //            "Fuchsia", "silver", "DarkKhaki", "SlateGray" ],
        //key fields for plot lines
        kflds = [
            { name: "visits", color: "yellow", min: 0, max: 0,
              desc: "The number of web app initializations where the user was not logged in (no cookie found). If this exceeds the number of logins, then there are people checking out the site without logging in." },
            { name: "logins", color: "orange", min: 0, max: 0,
              desc: "The number of web app initializations where the user was logged in (via cookie or via token after logging in)." },
            { name: "posters", color: "red", min: 0, max: 0,
              desc: "The number of pen names that posted membics" },
            { name: "membics", color: "DarkGreen", min: 0, max: 0,
              desc: "How many new membics were posted" },
            { name: "edits", color: "LightSeaGreen", min: 0, max: 0,
              desc: "How many existing membics were edited" },
            { name: "themeposts", color: "blue", min: 0, max: 0,
              desc: "How many new theme posts were created" },
            { name: "starred", color: "purple", min: 0, max: 0,
              desc: "How many membics were starred" },
            { name: "remembered", color: "violet", min: 0, max: 0,
              desc: "How many membics were remembered" },
            { name: "responded", color: "Fuchsia", min: 0, max: 0,
              desc: "How many membics were created from other membics" },
            { name: "clickthru", color: "GoldenRod", min: 0, max: 0,
              desc: "How many profiles or themes were accessed directly" }],
        //closure level working vars
        chart,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    makeChartLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return chart.xscale(d.day); })
            .y(function (d) { return chart.yscale(d[attr]); });
    },


    makeChartSeries = function () {
        var series = [];
        kflds.forEach(function (kf) {
            series.push({name: kf.name, color: kf.color,
                         width: "2px", dashes: "1, 0"}); });
        return series;
    },


    minMaxY = function () {
        var mm = { min: 1000000, max: 0 };
        mm = kflds.reduce(function (pval, kf) {
            return { min: Math.min(pval.min, kf.min),
                     max: Math.max(pval.max, kf.max) }; }, mm);
        return [mm.min, mm.max];
    },


    setChartWidthAndHeight = function (keyreserve, minw) {
        var over;
        minw = minw || 320;  //take the full width of a phone
        chart.width = window.innerWidth - (3 * chart.offset.x);
        chart.height = Math.round((chart.width * 2) / 3);
        over = chart.height + keyreserve - window.innerHeight;
        if(over > 0) {
            chart.width -= Math.round((over * 3) / 2);
            chart.height = Math.round((chart.width * 2) / 3); }
        if(chart.width < minw) {
            chart.width = minw;
            chart.height = Math.round((chart.width * 2) / 3); }
        jt.byId('sumdiv').style.width = String(chart.width) + "px";
    },


    alternatingWeekBackgrounds = function (viz) {
        var sundaycoords = [], tickw = Math.round(chart.width / stats.length);
        stats.forEach(function (stat, idx) {
            if(stat.day.getDay() === 0) {  //Sunday
                sundaycoords.push(idx * tickw); } });
        if(sundaycoords[0] === 0) {  //first day was sunday, adjust x to
            sundaycoords[0] = 1; }   //avoid overwriting the y axis line
        else {  //add filler block before first sunday
            sundaycoords.unshift(1); }
        sundaycoords.forEach(function (x, idx) {
            var width = chart.width;
            if(idx < sundaycoords.length - 1) {
                width = sundaycoords[idx + 1] - x; }
            viz.append("rect")
                .attr("x", x)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", chart.height)
                .attr("fill", ((idx % 2)? "#ddd" : "#eee")); });
    },


    displayChart = function () {
        var viz, xAxis, yAxis, series;
        chart = {offset: { x:30, y:20 }};
        setChartWidthAndHeight(360);
        chart.xscale = d3.time.scale().range([0, chart.width]);
        chart.yscale = d3.scale.linear().range([chart.height, 0]);
        series = makeChartSeries();
        viz = d3.select("#chartdiv")
            .data(stats)
            .append("svg")
            .attr("width", chart.width + (2 * chart.offset.x))
            .attr("height", chart.height + (2 * chart.offset.y))
            .append("g")
            .attr("transform",
                  "translate(" + chart.offset.x + "," + chart.offset.y + ")");
        xAxis = d3.svg.axis().scale(chart.xscale).orient("bottom");
        yAxis = d3.svg.axis().scale(chart.yscale).orient("left");
        chart.xscale.domain(d3.extent(stats, function (d) { return d.day; }));
        chart.yscale.domain(d3.extent(minMaxY(), function (d) { return d; }));
        viz.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + chart.height + ")")
            .call(xAxis);
        viz.append("g")
            .attr("class", "y axis")
            .call(yAxis);
        alternatingWeekBackgrounds(viz);
        series.forEach(function (sdef) {
            viz.append("path")
                .datum(stats)
                .attr("class", "line")
                .attr("stroke", sdef.color)
                .attr("stroke-width", sdef.width)
                .attr("stroke-dasharray", sdef.dashes)
                .attr("d", makeChartLine(sdef.name)); });
    },


    displayKeys = function () {
        var html = [];
        kflds.forEach(function (kf) {
            html.push(["tr",
                       [["td", {style: "background-color:" + kf.color + ";" +
                                       "padding:5px 10px;" +
                                       "cursor:crosshair;",
                                title: kf.desc},
                         kf.name],
                        ["td", {cla: "rtxt"}, String(kf.min)],
                        ["td", {cla: "rtxt"}, String(kf.max)]]]); });
        html = ["table", {id: "keytable"},
                html];
        jt.out('keysdiv', jt.tac2html(html));
    },


    isRealUserAgent = function (agentstr) {
        var ir = true;
        if(!agentstr) {
            return false; }
        botids.every(function (botid) {
            if(agentstr.indexOf(botid) >= 0) {
                ir = false;
                return false; }
            return true; });
        return ir;
    },


    classifyData = function (taxon) {
        stats.forEach(function (datum) {
            var das;
            //the agent csv format was standardized 12/10/13, ignore previous
            if(datum.day.toISOString() > "2013-12-10T00:00:00Z") { 
                das = jt.safestr(datum.agents).split(",");
                das.forEach(function (agent) {
                    var comp;
                    agent = agent.trim();
                    if(isRealUserAgent(agent)) {
                        comp = { key: agent, count: 1 };  //leaf component
                        actstat.classifyComponent(taxon, comp); } }); } });
    },

                    
    //key-count-components
    displayAccessAgents = function () {
        var taxon, html;
        taxon = [ 
            { key: "touch", count: 0, components: [
                { key: "iPhone",  count: 0, components: [] },
                { key: "iPad",    count: 0, components: [] },
                { key: "Android", count: 0, components: [] },
                { key: "other",   count: 0, components: [] }]},
            { key: "mouse", count: 0, components: [
                { key: "IE",      count: 0, components: [] },
                { key: "Safari",  count: 0, components: [] },
                { key: "Firefox", count: 0, components: [] },
                { key: "Chrome",  count: 0, components: [] },
                { key: "other",   count: 0, components: [] }]}];
        classifyData(taxon);
        actstat.sortTaxonomy(taxon);
        html = [["p", { style: "padding-left:5px;"},
                 "Agent summary:"],
                actstat.taxonomyHTML(taxon)];
        jt.out('agentsdiv', jt.tac2html(html));
    },


    fetchBotListAndDisplayAgents = function () {
        jt.call('GET', "../botids", null,
                function (results) {
                    botids = results[0].botids.split(',');
                    displayAccessAgents(); },
                function (code, errtxt) {
                    jt.out('agentsdiv', "botids failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchBotListAndDisplayAgents"));
    },


    displayPosters = function () {
        var pcounts = {}, pca = [], html = "";
        stats.forEach(function (stat) {
            stat.postpens.csvarray().forEach(function (poster) {
                var idname = poster.split(":"),
                    penid = idname[0],
                    penname = idname[1];
                if(pcounts[penid]) {
                    pcounts[penid].count += 1; }
                else {
                    pcounts[penid] = { count: 1, name: penname }; } }); });
        Object.keys(pcounts).forEach(function (penid) {
            pca.push({penid: penid, count: pcounts[penid].count, 
                      penname: pcounts[penid].name}); });
        pca.sort(function (a, b) {
            if(a.count < b.count) { return -1; }
            if(a.count > b.count) { return 1; }
            return 0; });
        pca.forEach(function (pref) {
            if(html) {
                html += ", "; }
            html += pref.penname; });
        jt.out('postersdiv', "<p>Posters: " + html + "</p>");
    },


    displaySummary = function () {
        var html = ["table", {id: "sumtable",
                              style: "margin:auto;"},
                    ["tr",
                     [["td", {style: "background:#eee;"},
                       ["div", {id: "keysdiv"}]],
                      ["td", {valign: "top", style: "background:#ddd;"},
                       ["div", {id: "agentsdiv"}]],
                      ["td", {valign: "top", style: "background:#eee;"},
                       ["div", {id: "postersdiv"}]]]]];
        jt.out('sumdiv', jt.tac2html(html));
        displayKeys();
        fetchBotListAndDisplayAgents();
        displayPosters();
    },


    hasSubLevelComponents = function (comps) {
        var hasem = false;
        comps.every(function (comp) {
            if(comp.components && comp.components.length > 0) {
                hasem = true;
                return false; }
            return true; });
        return hasem;
    },


    attributizeReferrals = function (elem) {
        var refs = elem.refers.split(",");
        refs.forEach(function (ref) {
            var components = ref.split(":"),
                refername = components[0],
                refercount = parseInt(components[1], 10);
            elem[refername] = refercount; });
    },


    verifyKeyFields = function (stat) {
        kflds.forEach(function (kf) {
            stat[kf.name] = stat[kf.name] || 0;
            kf.min = Math.min(kf.min, stat[kf.name]);
            kf.max = Math.max(kf.max, stat[kf.name]); });
    },


    nextDay = function (day) {
        day = new Date(jt.ISOString2Time(day));
        day = new Date(day.getTime() + (24 * 60 * 60 * 1000));
        day = day.toISOString();
        return day;
    },


    prepData = function () {
        var filled = [];
        stats.sort(function (a, b) {
            if(a.day < b.day) { return -1; }
            if(a.day > b.day) { return 1; }
            return 0; });
        stats.forEach(function (stat) {
            var nextday;
            if(!filled.length) {
                filled.push(stat); }
            else {
                nextday = nextDay(filled[filled.length - 1].day);
                while(nextday < stat.day) {
                    filled.push({day: nextday});
                    nextday = nextDay(filled[filled.length - 1].day); }
                filled.push(stat); } });
        stats = filled;
        stats.forEach(function (stat) {
            //default values if missing
            verifyKeyFields(stat);  //also tracks min/max
            stat.postpens = stat.postpens || "";
            stat.refers = stat.refers || "";
            stat.agents = stat.agents || "";
            stat.calculated = stat.calculated || stat.day;
            //data conversions
            attributizeReferrals(stat);
            stat.day = jt.ISOString2Time(stat.day); });
    },


    fetchDataAndDisplay = function () {
        var nowISO = new Date().toISOString();
        jt.out('chartdiv', "Fetching ActivityStat records");
        jt.call('GET', "../activity?cb=" + nowISO, null,
                function (actstats) {
                    jt.out('chartdiv', "");
                    stats = actstats;
                    prepData();
                    displayChart();
                    displaySummary(); },
                function (code, errtxt) {
                    jt.out('averagesdiv', "fetch failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchDataAndDisplay"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    taxonomyHTML: function (comps, prefix) {
        var html = [], style;
        prefix = prefix || "";
        comps.forEach(function (comp) {
            var domid, sublist, li;
            domid = prefix + comp.key;
            sublist = "";
            if(comp.components && comp.components.length > 0) {
                sublist = actstat.taxonomyHTML(comp.components, domid); }
            li = [["span", {style: "display:inline-block;" + 
                                   "text-align:right;" },
                   comp.count],
                  "&nbsp;",
                  comp.key];
            if(sublist) {
                li = ["a", {href: "#" + domid,
                            onclick: jt.fs("actstat.toggleAgents('" + 
                                           domid + "')")},
                      li]; }
            html.push(["li", 
                       [li,
                        sublist]]); });
        style = "list-style-type:none;padding-left:10px;";
        if(!hasSubLevelComponents(comps)) {
            style += "display:none;"; }
        html = ["ul", {id: prefix,
                       style: style},
                html];
        return html;
    },


    sortTaxonomy: function (comps) {
        if(!comps || comps.length === 0) {
            return; }
        comps.sort(function (a, b) {
            if(a.count < b.count) {
                return 1; }
            if(a.count > b.count) {
                return -1; }
            return 0; });
        comps.forEach(function (comp) {
            actstat.sortTaxonomy(comp.components); });
    },
        

    classifyComponent: function (taxonomy, comp) {
        var classified = false;
        //"other" is always last in the top level array of the taxonomy
        taxonomy.every(function (taxon) {
            switch(taxon.key) {
            case "touch":
                if(comp.key.indexOf("Mobi") >= 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "mouse":
                if(comp.key.indexOf("Mobi") < 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "iPhone":
                if(comp.key.indexOf("iPhone") >= 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "iPad":
                if(comp.key.indexOf("iPad") >= 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "Android":
                if(comp.key.indexOf("Android") >= 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "IE":
                if(comp.key.indexOf("MSIE") >= 0 ||
                   (comp.key.indexOf("Windows NT") >= 0 &&
                    comp.key.indexOf("rv:11") >= 0)) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "Safari":
                if(comp.key.indexOf("Safari/") >= 0 &&
                   comp.key.indexOf("Chrome/") < 0 &&
                   comp.key.indexOf("Chromium/") < 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "Firefox":
                if(comp.key.indexOf("Firefox/") >= 0 && 
                   comp.key.indexOf("Seamonkey/") < 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "Chrome":
                if(comp.key.indexOf("Chrome/") >= 0 && 
                   comp.key.indexOf("Chromium/") < 0) {
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            case "other":  
                if(!classified) { //didn't match any previous cases...
                    taxon.count += 1;
                    actstat.classifyComponent(taxon.components, comp);
                    classified = true; }
                break;
            default: //bump the leaf count if already there
                if(taxon.key === comp.key) {
                    taxon.count += 1;
                    classified = true; } }
            if(classified) {  //done iterating
                return false; } 
            return true; });
        if(!classified) {  //add leaf node
            taxonomy.push(comp); }
    },


    toggleAgents: function (key) {
        var ul = jt.byId(key);
        if(ul) {
            if(ul.style.display === "none") {
                ul.style.display = "block"; }
            else {
                ul.style.display = "none"; } }
    },


    display: function () {
        jtminjsDecorateWithUtilities(jt);
        fetchDataAndDisplay();
    }

}; //end of returned functions
}());

