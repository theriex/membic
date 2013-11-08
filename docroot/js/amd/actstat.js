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

    minMaxData = function () {
        var min, max;
        min = data.reduce(function (value, elem) {
            return Math.min(value, elem.active, elem.ttlrev, elem.onerev, 
                            elem.tworev, elem.morev); }, 1000000);
        max = data.reduce(function (value, elem) {
            return Math.max(value, elem.active, elem.ttlrev, elem.onerev, 
                            elem.tworev, elem.morev); }, 0);
        return [min, max];
    },


    makeLine = function (attr) {
        return d3.svg.line()
            .x(function (d) { return xscale(d.day); })
            .y(function (d) { return yscale(d[attr]); });
    },


    makeSeries = function () {
        var series = [
            { name: "active", color: "yellow",  width: "2px", dashes: "2,2" },
            { name: "ttlrev", color: "blue", width: "2px", dashes: "3,3" },
            { name: "onerev", color: "tan", width: "2px", dashes: "5,5"},
            { name: "tworev", color: "brown", width: "2px", dashes: "10,10" },
            { name: "morev", color: "black", width: "2px", dashes: "20,20"} ];
        return series;
    },


    showColorKeys = function (series) {
        var html = ["table",
                    [["tr",
                      [["td", 
                        [["span", {style: "color:" + series[0].color},
                          " ------ "],
                         series[0].name]],
                       ["td",
                        [["span", {style: "color:" + series[2].color},
                          " ------ "],
                         series[2].name]]]],
                     ["tr",
                      [["td",
                        [["span", {style: "color:" + series[1].color},
                          " ------ "],
                         series[1].name]],
                       ["td",
                        [["span", {style: "color:" + series[3].color},
                          " ------ "],
                         series[3].name]]]],
                     ["tr",
                      [["td"],
                       ["td",
                        [["span", {style: "color:" + series[4].color},
                          " ------ "],
                         series[4].name]]]]]];
        jt.out('useractdiv', jt.tac2html(html));
    },


    displayActivityGraph = function () {
        var svg, xAxis, yAxis, series;
        series = makeSeries();
        showColorKeys(series);
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
        yscale.domain(d3.extent(minMaxData(), function (d) { return d; }));
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
        var html = [], logins = {}, frequency, total = 0, sum = 0;
        data.forEach(function (datum) {
            var pens = datum.names.split(";");
            pens.forEach(function (name) {
                if(logins[name]) {
                    logins[name] += 1; }
                else {
                    logins[name] = 1; } }); });
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
        html = [["div",
                 "Average login frequency: " + (sum / total) + " days"],
                ["div", { style: "padding:0px 20px;" },
                 ["table",
                  html]]];
        jt.out('averagesdiv', jt.tac2html(html));
    },


    prepData = function () {
        data.sort(function (a, b) {
            if(a.day < b.day) { return -1; }
            if(a.day > b.day) { return 1; }
            return 0; });
        data.forEach(function (elem) {
            elem.day = new Date(elem.day); });
    },


    fetchDataAndDisplay = function () {
        data = [{"_id":"5838406743490560", "tworev": 0, "names": "Eric Parker", "active": 1, "day": "2013-11-01T00:00:00Z", "morev": 0, "onerev": 1, "calculated": "2013-11-05T23:56:45Z", "ttlrev": 1},
 {"_id":"5275456790069248", "tworev": 1, "names": "Eric Parker", "active": 1, "day": "2013-11-02T00:00:00Z", "morev": 0, "onerev": 1, "calculated": "2013-11-05T23:56:45Z", "ttlrev": 2},
 {"_id":"6401356696911872", "tworev": 0, "names": "Eric Parker", "active": 1, "day": "2013-11-03T00:00:00Z", "morev": 0, "onerev": 1, "calculated": "2013-11-05T23:56:45Z", "ttlrev": 1},
 {"_id":"4993981813358592", "tworev": 0, "names": "sbdesign;egaliani", "active": 2, "day": "2013-11-04T00:00:00Z", "morev": 0, "onerev": 2, "calculated": "2013-11-05T23:56:45Z", "ttlrev": 2}];
        prepData();
        displayActivityGraph();
        displayUserAverages();
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

