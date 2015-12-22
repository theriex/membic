/*global d3, jtminjsDecorateWithUtilities, window, epsankey */
/*jslint browser, white, fudge */

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
        kflds = [  //key fields for plot lines
            //visiting
            { name: "visits", color: "GoldenRod",
              desc: "The number of web app initializations where the user was not logged in (no cookie found). If this exceeds the number of logins, then there are people checking out the site without logging in." },
            { name: "clickthru", color: "orange",
              desc: "How many profiles or themes were accessed directly" },
            { name: "logins", color: "#ff8a00",
              desc: "The number of web app initializations where the user was logged in (via cookie or via token after logging in)." },
            //active read
            { name: "starred", color: "#0cff00",
              desc: "How many membics were starred" },
            { name: "remembered", color: "green",
              desc: "How many membics were remembered" },
            //active write
            { name: "responded", color: "#007da4",
              desc: "How many membics were created from other membics" },
            { name: "posters", color: "#00ffed",
              desc: "The number of pen names that posted membics" },
            { name: "membics", color: "blue",
              desc: "How many new membics were posted" },
            { name: "edits", color: "#009fff",
              desc: "How many existing membics were edited" },
            { name: "themeposts", color: "#7800ff",
              desc: "How many new theme posts were created" }],
        //closure level working vars
        alc,  //activity line chart


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayKeys = function () {
        kflds.forEach(function (kf, idx) {
            var descr, rc;
            descr = kf.desc + " (series min: " + kf.min + 
                ", series max: " + kf.max + ")";
            rc = {x: 40, y: (30 * idx) + 10, w: 100, h: 26};
            alc.svg.append("rect")
                .attr({"x": rc.x, "y": rc.y, "width": rc.w, "height": rc.h})
                .style("fill", kf.color);
            alc.svg.append("text")
                .attr({"x": rc.x + 10, "y": rc.y + 18, "fill": "black"})
                .text(kf.name);
            alc.svg.append("rect")
                .attr({"x": rc.x, "y": rc.y, "width": rc.w, "height": rc.h,
                       "title": descr})
                .style("fill", kf.color)
                .style("opacity", 0.01)
                //.style("fill", "none")
                .on("mouseover", actstat.sololine(kf.name))
                .on("mouseout", actstat.sololine()); });
    },


    makeChartLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return alc.xscale(d.day); })
            .y(function (d) { return alc.yscale(d[attr]); });
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
        mm.max *= 1.1;  //add minor headroom at the top of the chart
        return [mm.min, mm.max];
    },


    //aim for a nice 3-2 aspect ratio scaling to the screen width
    setChartWidthAndHeight = function (bottomrsrv, sidersrv, minw) {
        var over;
        bottomrsrv = bottomrsrv || 0;
        sidersrv = sidersrv || 50;
        minw = minw || 320;  //take the full width of a phone
        alc.width = (window.innerWidth - (3 * alc.offset.x)) - sidersrv;
        alc.height = Math.round((alc.width * 2) / 3);
        over = alc.height + bottomrsrv - window.innerHeight;
        if(over > 0) {
            alc.width -= Math.round((over * 3) / 2);
            alc.height = Math.round((alc.width * 2) / 3); }
        if(alc.width < minw) {
            alc.width = minw;
            alc.height = Math.round((alc.width * 2) / 3); }
        jt.byId('postersdiv').style.width = String(alc.width) + "px";
    },


    alternatingWeekBackgrounds = function () {
        var sundaycoords = [], tickw = Math.round(alc.width / stats.length);
        stats.forEach(function (stat, idx) {
            if(stat.day.getDay() === 0) {  //Sunday
                sundaycoords.push(idx * tickw); } });
        if(sundaycoords[0] === 0) {  //first day was sunday, adjust x to
            sundaycoords[0] = 1; }   //avoid overwriting the y axis line
        else {  //add filler block before first sunday
            sundaycoords.unshift(1); }
        sundaycoords.forEach(function (x, idx) {
            var width = alc.width;
            if(idx < sundaycoords.length - 1) {
                width = sundaycoords[idx + 1] - x; }
            alc.svg.append("rect")
                .attr("x", x)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", alc.height)
                .attr("fill", ((idx % 2)? "#ddd" : "#eee")); });
    },


    lineChartYAxisGuideLines = function () {
        alc.svg.selectAll("#yaxisid .tick").forEach(function (ticks) {
            ticks.forEach(function (tick) {
                var yc = alc.yscale(tick.__data__);
                alc.svg.append("line")
                    .attr({"x1": 0, "x2": alc.width, "y1": yc , "y2": yc})
                    .style("stroke-dasharray", "2,2")
                    .style("stroke", "#ccc"); }); });
    },


    displayLineChart = function () {
        alc = {offset: { x:30, y:20 }};
        setChartWidthAndHeight();
        alc.xscale = d3.time.scale().range([0, alc.width]);
        alc.yscale = d3.scale.pow().exponent(0.5).range([alc.height, 0]);
        alc.series = makeChartSeries();
        alc.svg = d3.select("#chartdiv")
            .data(stats)
            .append("svg")
            .attr("width", alc.width + (2 * alc.offset.x))
            .attr("height", alc.height + (2 * alc.offset.y))
            .append("g")
            .attr("transform",
                  "translate(" + alc.offset.x + "," + alc.offset.y + ")");
        alc.xAxis = d3.svg.axis().scale(alc.xscale).orient("bottom");
        alc.yAxis = d3.svg.axis().scale(alc.yscale).orient("left");
        alc.xscale.domain(d3.extent(stats, function (d) { return d.day; }));
        alc.yscale.domain(d3.extent(minMaxY(), function (d) { return d; }));
        alc.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + alc.height + ")")
            .call(alc.xAxis);
        alc.svg.append("g")
            .attr("class", "y axis")
            .attr("id", "yaxisid")
            .call(alc.yAxis);
        alternatingWeekBackgrounds();
        lineChartYAxisGuideLines();
        alc.series.forEach(function (sdef) {
            alc.svg.append("path")
                .datum(stats)
                .attr("class", "line " + sdef.name)
                .attr("stroke", sdef.color)
                .attr("stroke-width", sdef.width)
                .attr("stroke-dasharray", sdef.dashes)
                .attr("d", makeChartLine(sdef.name)); });
        displayKeys(alc.svg);
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
            { key: "touch", color: "blue", count: 0, components: [
                { key: "iPhone",  color: "#0099ff", count: 0, components: [] },
                { key: "iPad",    color: "#00d2ff", count: 0, components: [] },
                { key: "Android", color: "#9800ff", count: 0, components: [] },
                { key: "other",   color: "#6400ff", count: 0, components: [] }
            ]},
            { key: "mouse", color: "green", count: 0, components: [
                { key: "IE",      color: "#aff359", count: 0, components: [] },
                { key: "Safari",  color: "#97f359", count: 0, components: [] },
                { key: "Firefox", color: "#66ff00", count: 0, components: [] },
                { key: "Chrome",  color: "#00ff00", count: 0, components: [] },
                { key: "other",   color: "#e1f359", count: 0, components: [] }
            ]}];
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
            kf.min = Math.min(kf.min || 10000, stat[kf.name]);
            kf.max = Math.max(kf.max || 0, stat[kf.name]); });
    },


    nextDay = function (day) {
        day = new Date(jt.ISOString2Time(day));
        day = new Date(day.getTime() + (24 * 60 * 60 * 1000));
        day = new Date(day.getTime() - (day.getTimezoneOffset() * 60 * 1000));
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
                while(nextday < stat.day.slice(0, 10)) {
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
                    jt.out('chartdiv', "preparing data...");
                    stats = actstats;
                    prepData();
                    jt.out('chartdiv', "");
                    displayLineChart();
                    displayPosters();
                    fetchBotListAndDisplayAgents(); },
                function (code, errtxt) {
                    jt.out('averagesdiv', "fetch failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchDataAndDisplay"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    sololine: function (name) {
        return function (/*g, i*/) {
            if(name) {
                alc.svg.selectAll(".line")
                    .transition()
                    .style("opacity", 0.1);
                alc.svg.selectAll("." + name)
                    .transition()
                    .style("opacity", 1.0); }
            else {
                alc.svg.selectAll(".line")
                    .transition()
                    .style("opacity", 1.0); } };
    },


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

