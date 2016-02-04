/*global d3, stat, jt, window */
/*jslint browser, multivar, white, fudge */

stat.lc = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dispdiv = null,
        dat = null,
        lks = null,
        lc = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    computeDims = function () {
        var margin;
        margin = {top: 40, right: 30, bottom: 40, left: 30};
        lc.w = window.innerWidth;
        lc.h = Math.round(0.66 * lc.w);  //3-2 aspect ratio
        lc.width = lc.w - (margin.left + margin.right);
        lc.height = lc.h - (margin.top + margin.bottom);
        lc.margin = margin;
    },


    drawChart = function () {
        computeDims();
        lc.xscale = d3.time.scale()
            .range([0, lc.width])
            .domain(d3.extent(dat.series[0].series, function (d) { 
                return d.x; }));
        lc.yscale = d3.scale.pow().exponent(0.5)
            .range([lc.height, 0])
            .domain([0, dat.ymax]);
        lc.svg = d3.select("#" + dispdiv).append("svg")
            .attr({"width": lc.width, "height": lc.h,
                   "preserveAspectRatio": "xMidYMid"})
            .append("g")
            .attr("transform",
                  "translate(" + lc.margin.left + "," + lc.margin.top + ")");
        lc.xAxis = d3.svg.axis().scale(lc.xscale).orient("bottom");
        lc.yAxis = d3.svg.axis().scale(lc.yscale).orient("left");
        lc.svg.append("g")
            .attr({"class": "x axis", "fill": "none", "stroke": "#000"})
            .attr("transform", "translate(0," + lc.height + ")")
            .call(lc.xAxis);
        lc.svg.append("g")
            .attr({"class": "y axis", "fill": "none", "stroke": "#000"})
            .attr("id", "yaxisid")
            .call(lc.yAxis);
        //alternatingWeekBackgrounds();
        //lineChartYAxisGuideLines();
        dat.series.forEach(function (sdef) {
            lc.svg.append("path")
                .datum(sdef.series)
                .attr({"class": "line " + sdef.id, "stroke": sdef.color,
                       "fill": "none", "stroke-width": 3})
                .attr("d", d3.svg.line()
                      .x(function (d) { return lc.xscale(d.x); })
                      .y(function (d) { return lc.yscale(d.y); })); });
        //displayKeys(alc.svg);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function (divid, data, keydefs) {
        dispdiv = divid;
        dat = data;
        lks = keydefs;
        drawChart();
    }

}; //end of returned functions
}());

