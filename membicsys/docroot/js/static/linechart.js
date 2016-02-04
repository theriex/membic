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
        klo = 0.8,  //key label background color opacity


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    computeDims = function () {
        var margin;
        margin = {top: 10, right: 30, bottom: 40, left: 180};
        lc.width = window.innerWidth - (margin.left + margin.right);
        lc.h = Math.round(0.66 * lc.width);  //3-2 aspect ratio
        lc.h -= 40; //covers any exterior div padding
        lc.height = lc.h - (margin.top + margin.bottom);
        lc.margin = margin;
    },


    alternatingWeekBackgrounds = function () {
        var sundaycoords = [], 
            stats = dat.series[0].series,
            tickw = Math.round(lc.width / stats.length);
        stats.forEach(function (point, idx) {
            if(point.x.getDay() === 0) {  //Sunday
                sundaycoords.push(idx * tickw); } });
        if(sundaycoords[0] === 0) {  //first day was sunday, adjust x to
            sundaycoords[0] = 1; }   //avoid overwriting the y axis line
        else {  //add filler block before first sunday
            sundaycoords.unshift(1); }
        sundaycoords.forEach(function (x, idx) {
            var width = lc.width;
            if(idx < sundaycoords.length - 1) {
                width = sundaycoords[idx + 1] - x; }
            lc.svg.append("rect")
                .attr({"x": x, "y": 0, "width": width, "height": lc.height,
                       "fill": ((idx % 2)? "#ddd" : "#eee")})
                .append("title")
                .text((idx === sundaycoords.length - 1) ? "This week" :
                      "Week ending " + jt.colloquialDate(
                          lc.xscale.invert(x + width))); });
    },


    yValueGuideLines = function () {
        var dataFieldName = "__data__";
        lc.svg.selectAll("#yaxisid .tick").forEach(function (ticks) {
            ticks.forEach(function (tick) {
                var yc = lc.yscale(tick[dataFieldName]);
                lc.svg.append("line")
                    .attr({"x1": 0, "x2": lc.width, "y1": yc , "y2": yc})
                    .style("stroke-dasharray", "2,2")
                    .style("stroke", "#ccc"); }); });
    },


    highlightKey = function (keyid) {
        return function (/*g, i*/) {
            if(keyid) {
                lc.svg.selectAll(".keyback")
                    .style("opacity", 0.3);
                lc.svg.selectAll(".keyback" + keyid)
                    .style("opacity", klo);
                lc.svg.selectAll(".line")
                    .transition()
                    .style("opacity", 0.1);
                lc.svg.selectAll("." + keyid)
                    .transition()
                    .style("opacity", 1.0); }
            else {
                lc.svg.selectAll(".keyback")
                    .style("opacity", klo);
                lc.svg.selectAll(".line")
                    .transition()
                    .style("opacity", 1.0); } };
    },


    displayKey = function (key, index, indent) {
        var indw = 10, vsep = 10,
            kc = {x: (-1 * lc.margin.left) + (indw * indent), 
                  y: (30 * index) + vsep, 
                  w: 120 + ((dat.indmax - indent) * indw), h: 26},
            desc = key.desc + " peak: " + key.peak + ", foothill: " + key.peak2;
        lc.svg.append("rect")  //white background
            .attr({"x": kc.x, "y": kc.y, "width": kc.w, "height": kc.h})
            .style("fill", "#fff");
        lc.svg.append("rect")  //color background
            .attr({"x": kc.x, "y": kc.y, "width": kc.w, "height": kc.h,
                   "class": "keyback keyback" + key.id})
            .style({"fill": key.color, "opacity": klo});
        lc.svg.append("text")  //label
            .attr({"x": kc.x + 10, "y": kc.y + 18, "fill": "black"})
            .style({"font-size": "16px"})
            .text(key.name);
        lc.svg.append("rect")  //action overlay rect
            .attr({"x": kc.x, "y": kc.y, "width": kc.w, "height": kc.h + vsep,
                   "title": desc})
            .style({"fill": key.color, "opacity": 0.01})
            .on("mouseover", highlightKey(key.id))
            .on("mouseout", highlightKey());
    },


    lineClassesForKey = function (sdef) {
        var parent = sdef.parent,
            res = sdef.id;
        while(parent) {
            res += " " + parent.id;
            parent = parent.parent; }
        return res;
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
        alternatingWeekBackgrounds();
        yValueGuideLines();
        dat.series.forEach(function (sdef) {
            lc.svg.append("path")
                .datum(sdef.series)
                .attr({"class": "line " + lineClassesForKey(sdef), 
                       "stroke": sdef.color,
                       "fill": "none", "stroke-width": 3})
                .attr("d", d3.svg.line()
                      .x(function (d) { return lc.xscale(d.x); })
                      .y(function (d) { return lc.yscale(d.y); })); });
        stat.lc.displayKeys(lks, 0, 0);
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
    },


    displayKeys: function (keys, index, indent) {
        keys.forEach(function (key) {
            displayKey(key, index, indent);
            index += 1;
            if(key.children) {
                index = stat.lc.displayKeys(key.children, 
                                            index, indent + 1); } });
        return index;
    }

}; //end of returned functions
}());

