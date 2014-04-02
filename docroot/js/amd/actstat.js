/*global d3: false, jtminjsDecorateWithUtilities: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//This is a degenerate module just used for reporting.  Don't model it.
var actstat = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var data = null,
        botids = [],
        jt = {},
        margin = { top: 20, right: 20, bottom: 40, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        xscale = d3.time.scale().range([0, width]),
        yscale = d3.scale.linear().range([height, 0]),
        sercoloridx = 0,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    seriesValue = function (series, datum) {
        var refs, i, refelems;
        if(datum.refers && datum.refers.indexOf(series.name) >= 0) {
            refs = datum.refers.split(",");
            for(i = 0; i < refs.length; i += 1) {
                refelems = refs[i].split(":");
                if(refelems[0] === series.name) {
                    return parseInt(refelems[1], 10); } } }
        return 0;
    },


    dataValue = function (datum, accessor) {
        if(typeof accessor === "string") {
            return datum[accessor]; }
        return seriesValue(accessor, datum);
    },


    makeLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return xscale(d.day); })
            .y(function (d) { return yscale(dataValue(d, attr)); });
    },


    showColorKeys = function (divid, keytitle, serieslayout) {
        var html = [];
        serieslayout.forEach(function (rowlayout) {
            var rowhtml = [];
            rowlayout.forEach(function (seriesdef) {
                seriesdef = seriesdef || { color: "white", name: "" };
                rowhtml.push(["td", {style: "padding:5px 20px;"},
                              [["span", {style: "color:" + seriesdef.color},
                                " -------- "],
                               ["span", {style: "display:inline-block;" +
                                                "width:20px;" + 
                                                "text-align:right;"},
                                seriesdef.total],
                               "&nbsp;",
                               ["a", {name: seriesdef.name,
                                      title: seriesdef.title},
                                seriesdef.name]]]); });
            html.push(["tr",
                       rowhtml]); });
        html = ["table",
                ["tr",
                 [["td", {cla: "titletxt"},
                   keytitle],
                  ["td",
                   ["table",
                    html]]]]];
        jt.out(divid, jt.tac2html(html));
    },


    makeSeriesDef = function (sname) {
        var scolor, colors = [ "red", "orange", "yellow", "green", "blue", 
                               "purple", "silver", "tan", "brown" ];
        scolor = colors[sercoloridx % colors.length];
        sercoloridx += 1;
        return { name: sname, width: "2px", dashes: "1, 1", 
                 color: scolor, total: 0,
                 title: "See mailsum.py bump_referral for key defs" };
    },


    //For more information on series, see mailsum.py bump_referral
    makeInquirySeries = function () {
        var series, i, refs, j, refelems, refname, refcount, sdef, result;
        series = {};
        series.clickthru = makeSeriesDef("clickthru");
        for(i = 0;i < data.length; i += 1) {
            if(data[i].clickthru) {
                series.clickthru.total += data[i].clickthru; }
            if(data[i].refers) {
                refs = data[i].refers.split(",");
                for(j = 0; j < refs.length; j += 1) {
                    refelems = refs[j].split(":");
                    refname = refelems[0];
                    refcount = parseInt(refelems[1], 10);
                    if(!series[refname]) {
                        series[refname] = makeSeriesDef(refname); }
                    series[refname].total += refcount; } } }
        result = [];
        for(sdef in series) {
            if(series.hasOwnProperty(sdef)) {
                result.push(series[sdef]); } }
        result.sort(function (a, b) {
            if(a.total > b.total) {
                return -1; }
            if(a.total < b.total) {
                return 1; }
            return 0; });
        return result;
    },


    minMaxInq = function (series) {
        var max;
        max = data.reduce(function (value, elem) {
            var i, elmax = 0;
            for(i = 0; i < series.length; i += 1) {
                elmax = Math.max(elmax, seriesValue(series[i], elem)); }
            return Math.max(value, elmax); }, 0);
        return [0, max];
    },


    rowify = function (series, cols) {
        var i, tdc = 0, rows = [], row = [];
        for(i = 0; i < series.length; i += 1) {
            if(tdc >= cols) {
                rows.push(row);
                row = [];
                tdc = 0; }
            row.push(series[i]);
            tdc += 1; }
        if(row.length > 0) {
            rows.push(row); }
        return rows;
    },


    displayInquiriesGraph = function () {
        var svg, xAxis, yAxis, series;
        series = makeInquirySeries();
        showColorKeys('inqactdiv', "Inquiries", rowify(series, 3));
        svg = d3.select('#inqactdiv')
            .data(data)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", 
                  "translate(" + margin.left + "," + margin.top + ")");
        xAxis = d3.svg.axis().scale(xscale).orient("bottom");
        yAxis = d3.svg.axis().scale(yscale).orient("left");
        xscale.domain(d3.extent(data, function (d) { return d.day; }));
        yscale.domain(d3.extent(minMaxInq(series), function (d) { return d; }));
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);
        series.forEach(function (sdef) {
            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("stroke", sdef.color)
                .attr("stroke-width", sdef.width)
                .attr("stroke-dasharray", sdef.dashes)
                .attr("d", makeLine(sdef)); });
    },


    isRealUserAgent = function (agentstr) {
        var i;
        if(!agentstr) {
            return false; }
        for(i = 0; i < botids.length; i += 1) {
            if(agentstr.indexOf(botids[i]) >= 0) {
                return false; } }
        return true;
    },


    classifyComponent = function (comps, comp) {
        var i, classified = false;
        //"other" is always last in the comps array 
        for(i = 0; !classified && i < comps.length; i += 1) {
            switch(comps[i].key) {
            case "touch":
                if(comp.key.indexOf("Mobi") >= 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "mouse":
                if(comp.key.indexOf("Mobi") < 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "iPhone":
                if(comp.key.indexOf("iPhone") >= 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "iPad":
                if(comp.key.indexOf("iPad") >= 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "Android":
                if(comp.key.indexOf("Android") >= 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "IE":
                if(comp.key.indexOf("MSIE") >= 0 ||
                   (comp.key.indexOf("Windows NT") >= 0 &&
                    comp.key.indexOf("rv:11") >= 0)) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "Safari":
                if(comp.key.indexOf("Safari/") >= 0 &&
                   comp.key.indexOf("Chrome/") < 0 &&
                   comp.key.indexOf("Chromium/") < 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "Firefox":
                if(comp.key.indexOf("Firefox/") >= 0 && 
                   comp.key.indexOf("Seamonkey/") < 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "Chrome":
                if(comp.key.indexOf("Chrome/") >= 0 && 
                   comp.key.indexOf("Chromium/") < 0) {
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break;
            case "other":  
                if(!classified) { //didn't match any previous cases...
                    comps[i].count += 1;
                    classifyComponent(comps[i].components, comp);
                    classified = true; }
                break; 
            default: //bump the leaf count if already there
                if(comps[i].key === comp.key) {
                    comps[i].count += 1;
                    classified = true; } } }
        if(!classified) {  //add leaf node
            comps.push(comp); }
    },


    classifyData = function (taxon) {
        data.forEach(function (datum) {
            var das;
            //the agent csv format was standardized 12/10/13, ignore previous
            if(datum.day.toISOString() > "2013-12-10T00:00:00Z") { 
                das = jt.safestr(datum.agents).split(",");
                das.forEach(function (agent) {
                    var comp;
                    agent = agent.trim();
                    if(isRealUserAgent(agent)) {
                        comp = { key: agent, count: 1 };  //leaf component
                        classifyComponent(taxon, comp); } }); } });
    },

                    
    sortTaxonomy = function (comps) {
        var i;
        if(!comps || comps.length === 0) {
            return; }
        comps.sort(function (a, b) {
            if(a.count < b.count) {
                return 1; }
            if(a.count > b.count) {
                return -1; }
            return 0; });
        for(i = 0; i < comps.length; i += 1) {
            sortTaxonomy(comps[i].components); }
    },
        

    hasSubLevelComponents = function (comps) {
        var i;
        for(i = 0; i < comps.length; i += 1) {
            if(comps[i].components && comps[i].components.length > 0) {
                return true; } }
        return false;
    },


    taxonomyHTML = function (comps, prefix) {
        var html = [], i, domid, sublist, li, style;
        prefix = prefix || "";
        for(i = 0; i < comps.length; i += 1) {
            sublist = "";
            domid = prefix + comps[i].key;
            if(comps[i].components && comps[i].components.length > 0) {
                sublist = taxonomyHTML(comps[i].components, domid); }
            li = [["span", {style: "display:inline-block;width:30px;" + 
                                   "text-align:right;" },
                   comps[i].count],
                  "&nbsp;",
                  comps[i].key];
            if(sublist) {
                li = ["a", {href: "#" + domid,
                            onclick: jt.fs("actstat.toggleAgents('" + 
                                           domid + "')")},
                      li]; }
            html.push(["li", 
                       [li,
                        sublist]]); }
        style = "list-style-type:none;padding-left:40px;";
        if(!hasSubLevelComponents(comps)) {
            style += "display:none;"; }
        html = ["ul", {id: prefix,
                       style: style},
                html];
        return html;
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
        sortTaxonomy(taxon);
        html = [["p", { style: "padding-left:40px;"},
                 "Agent summary:"],
                taxonomyHTML(taxon)];
        jt.out('agentsdiv', jt.tac2html(html));
    },


    makeActivitySeries = function () {
        var series = [
            {name: "active", color: "yellow",  width: "2px", dashes: "2,2"},
            {name: "ttlrev", color: "blue", width: "2px", dashes: "3,3"},
            {name: "onerev", color: "tan", width: "2px", dashes: "5,5"},
            {name: "tworev", color: "brown", width: "2px", dashes: "10,10"},
            {name: "morev", color: "black", width: "2px", dashes: "20,20"} ];
        return series;
    },


    minMaxAct = function () {
        var min, max;
        min = data.reduce(function (value, elem) {
            return Math.min(value, elem.active, elem.ttlrev, elem.onerev, 
                            elem.tworev, elem.morev); }, 1000000);
        max = data.reduce(function (value, elem) {
            return Math.max(value, elem.active, elem.ttlrev, elem.onerev, 
                            elem.tworev, elem.morev); }, 0);
        return [min, max];
    },


    displayActivityGraph = function () {
        var svg, xAxis, yAxis, series;
        series = makeActivitySeries();
        showColorKeys('useractdiv', "Interaction", [[series[0], series[2]],
                                                    [series[1], series[3]],
                                                    [null, series[4]]]);
        svg = d3.select("#useractdiv")
            .data(data)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", 
                  "translate(" + margin.left + "," + margin.top + ")");
        xAxis = d3.svg.axis().scale(xscale).orient("bottom");
        yAxis = d3.svg.axis().scale(yscale).orient("left");
        xscale.domain(d3.extent(data, function (d) { return d.day; }));
        yscale.domain(d3.extent(minMaxAct(), function (d) { return d; }));
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);
        series.forEach(function (sdef) {
            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("stroke", sdef.color)
                .attr("stroke-width", sdef.width)
                .attr("stroke-dasharray", sdef.dashes)
                .attr("d", makeLine(sdef.name)); });
    },


    displayUserAverages = function () {
        var html = [], logins = {}, name, frequency, 
            freqsum = 0, active = 0, flybys = 0;
        data.forEach(function (datum) {
            var pens = jt.safestr(datum.names).split(";");
            pens.forEach(function (name) {
                if(name) {  //possible empty string if no logins for the day
                    if(logins[name]) {
                        logins[name] += 1; }
                    else {
                        logins[name] = 1; } } }); });
        for(name in logins) {
            if(logins.hasOwnProperty(name)) {
                if(logins[name] > 1) {
                    frequency = Math.round(data.length / logins[name]);
                    active += 1;
                    freqsum += frequency;
                    html.push(["tr",
                               [["td", {style: "padding:0px 10px;"},
                                 name],
                                ["td", {align: "right"},
                                 frequency],
                                ["td",
                                 "days"]]]); }
                else {
                    flybys += 1; } } }
        html.sort(function (a, b) {
            var afreq = parseInt(a[1][1][2], 10),
                bfreq = parseInt(b[1][1][2], 10);
            if(afreq < bfreq) { return -1; }
            if(afreq > bfreq) { return 1; }
            return 0; });
        html = [["div",
                 "Window: " + data.length + " days.<br>" +
                 "Average login frequency: " + (freqsum / active) + " days"],
                ["div", { style: "padding:0px 20px;" },
                 ["table",
                  html]],
                ["div",
                 "Active: " + active + ", Flybys: " + flybys + 
                 ": " + (Math.round((active / (active + flybys)) * 100)) + 
                 "% participation"]];
        jt.out('averagesdiv', jt.tac2html(html));
    },


    attributizeReferrals = function (elem) {
        var refs = elem.refers.split(",");
        refs.forEach(function (ref) {
            var components = ref.split(":"),
                refername = components[0],
                refercount = parseInt(components[1], 10);
            elem[refername] = refercount; });
    },


    prepData = function () {
        data.sort(function (a, b) {
            if(a.day < b.day) { return -1; }
            if(a.day > b.day) { return 1; }
            return 0; });
        data.forEach(function (elem) {
            //default values in case fields are missing
            elem.logttl = elem.logttl || 0;
            elem.botttl = elem.botttl || 0;
            elem.refers = elem.refers || "";
            elem.clickthru = elem.clickthru || 0;
            elem.agents = elem.agents || "";
            //data conversions
            attributizeReferrals(elem);
            elem.day = new Date(elem.day); });
    },


    fetchBotListAndDisplayAgents = function () {
        jt.call('GET', "../botids", null,
                function (results) {
                    botids = results[0].botids.split(',');
                    displayAccessAgents(); },
                function (code, errtxt) {
                    jt.out('useractdiv', "botids failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchBotListAndDisplayAgents"));
    },


    fetchDataAndDisplay = function () {
        jt.out('useractdiv', "Fetching ActivityStat records");
        jt.call('GET', "../activity", null,
                function (actstats) {
                    data = actstats;
                    prepData();
                    displayInquiriesGraph();
                    fetchBotListAndDisplayAgents();
                    displayActivityGraph();
                    displayUserAverages(); },
                function (code, errtxt) {
                    jt.out('useractdiv', "fetch failed: " + code + 
                           " " + errtxt); },
                jt.semaphore("actstat.fetchDataAndDisplay"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

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

