/*global d3, jtminjsDecorateWithUtilities */
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


    displayChart = function () {
        var svg, xAxis, yAxis, series;
        chart = {width: 600, height: 400, offset: { x:20, y:20 }};
        chart.xscale = d3.time.scale().range([0, chart.width]);
        chart.yscale = d3.scale.linear().range([chart.height, 0]);
        series = makeChartSeries();
        svg = d3.select("#chartdiv")
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
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + chart.height + ")")
            .call(xAxis);
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);
        series.forEach(function (sdef) {
            svg.append("path")
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
        html = [["p", { style: "padding-left:40px;"},
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
        var html = ["table", {id: "sumtable"},
                    ["tr",
                     [["td", 
                       ["div", {id: "keysdiv"}]],
                      ["td",
                       ["div", {id: "agentsdiv"}]],
                      ["td", {valign: "top"},
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


    prepData = function () {
        stats.sort(function (a, b) {
            if(a.day < b.day) { return -1; }
            if(a.day > b.day) { return 1; }
            return 0; });
        stats.forEach(function (elem) {
            //default values in case any fields are missing, track min/max
            verifyKeyFields(elem);
            elem.postpens = elem.postpens || "";
            elem.refers = elem.refers || "";
            elem.agents = elem.agents || "";
            elem.calculated = elem.calculated || elem.day;
            //data conversions
            attributizeReferrals(elem);
            elem.day = new Date(elem.day); });
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
            li = [["span", {style: "display:inline-block;width:30px;" + 
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
        style = "list-style-type:none;padding-left:40px;";
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

