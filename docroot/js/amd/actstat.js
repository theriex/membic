/*global d3: false, jtminjsDecorateWithUtilities: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//This is a degenerate module just used for reporting.  Don't model it.
var actstat = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var data = null,
        jt = {},
        margin = { top: 20, right: 20, bottom: 40, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        xscale = d3.time.scale().range([0, width]),
        yscale = d3.scale.linear().range([height, 0]),


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    makeLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return xscale(d.day); })
            .y(function (d) { return yscale(d[attr]); });
    },


    showColorKeys = function (divid, serieslayout) {
        var html = [];
        serieslayout.forEach(function (rowlayout) {
            var rowhtml = [];
            rowlayout.forEach(function (seriesdef) {
                seriesdef = seriesdef || { color: "white", name: "" };
                rowhtml.push(["td", {style: "padding:5px 20px;"},
                              [["span", {style: "color:" + seriesdef.color},
                                " -------- "],
                               seriesdef.name]]); });
            html.push(["tr",
                       rowhtml]); });
        html = ["table",
                html];
        jt.out(divid, jt.tac2html(html));
    },


    makeInquirySeries = function () {
        var series = [  //see also mailsum.py bump_referral_count
            {name: "clickthru", color: "red", width: "2px", dashes: "2, 5"},
            {name: "facebook", color: "blue", width: "2px", dashes: "2, 2"},
            {name: "twitter", color: "green", width: "2px", dashes: "3, 3"},
            {name: "googleplus", color: "purple", width: "2px", dashes: "5, 5"},
            {name: "craigslist", color: "yellow", width: "2px", dashes: "4, 4"},
            {name: "other", color: "tan", width: "2px", dashes: "1, 1"} ];
        return series;
    },


    minMaxInq = function (series) {
        var min, max;
        min = data.reduce(function (value, elem) {
            return Math.min(value, elem.clickthru, elem.facebook, elem.twitter,
                            elem.googleplus, elem.craigslist, elem.other); }, 
                          1000000);
        max = data.reduce(function (value, elem) {
            return Math.max(value, elem.clickthru, elem.facebook, elem.twitter,
                            elem.googleplus, elem.craigslist, elem.other); }, 
                          0);
        return [min, max];
    },


    displayInquiriesGraph = function () {
        var svg, xAxis, yAxis, series;
        series = makeInquirySeries();
        showColorKeys('inqactdiv', [[series[0], series[1]],
                                    [series[4], series[2]],
                                    [series[5], series[3]]]);
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
                .attr("d", makeLine(sdef.name)); });
    },


    displayAccessAgents = function () {
        var html = [], agents = {}, agent;
        data.forEach(function (datum) {
            var das = jt.safestr(datum.agents).split("~");
            das.forEach(function (agent) {
                if(agent) {
                    if(agents[agent]) {
                        agents[agent] += 1; }
                    else {
                        agents[agent] = 1; } } }); });
        for(agent in agents) {
            if(agents.hasOwnProperty(agent)) {
                if(agents[agent] > 1) {
                    html.push(["tr",
                               [["td",
                                 agents[agent]],
                                ["td",
                                 agent]]]); } } }
        html.sort(function (a, b) {  //descending...
            if(a[1][0][1] > b[1][0][1]) { return -1; }
            if(a[1][0][1] < b[1][0][1]) { return 1; }
            return 0; });
        html = ["table",
                html];
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
        showColorKeys('useractdiv', [[series[0], series[2]],
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
        var html = [], logins = {}, name, frequency, total = 0, sum = 0;
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
                frequency = Math.round(data.length / logins[name]);
                total += 1;
                sum += frequency;
                html.push(["tr",
                           [["td", {style: "padding:0px 10px;"},
                             name],
                            ["td",
                             frequency],
                            ["td",
                             "days"]]]); } }
        html.sort(function (a, b) {
            var afreq = parseInt(a[1][1][1], 10),
                bfreq = parseInt(b[1][1][1], 10);
            if(afreq < bfreq) { return -1; }
            if(afreq > bfreq) { return 1; }
            return 0; });
        html = [["div",
                 "Window: " + data.length + " days.<br>" +
                 "Average login frequency: " + (sum / total) + " days"],
                ["div", { style: "padding:0px 20px;" },
                 ["table",
                  html]]];
        jt.out('averagesdiv', jt.tac2html(html));
    },


    attributizeReferrals = function (elem) {
        var refs = makeInquirySeries();
        refs.forEach(function (seriesdef) {
            elem[seriesdef.name] = elem[seriesdef.name] || 0; });
        refs = elem.refers.split(",");
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


    fetchDataAndDisplay = function () {
        var critsec = "";
        jt.out('useractdiv', "Fetching ActivityStat records");
        jt.call('GET', "../activity", null,
                function (actstats) {
                    data = actstats;
                    prepData();
                    displayInquiriesGraph();
                    displayAccessAgents();
                    displayActivityGraph();
                    displayUserAverages(); },
                function (code, errtxt) {
                    jt.out('useractdiv', "fetch failed: " + code + 
                           " " + errtxt); },
                critsec);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function () {
        jtminjsDecorateWithUtilities(jt);
        fetchDataAndDisplay();
    }

}; //end of returned functions
}());

