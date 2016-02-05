/*global d3, stat, jt */
/*jslint browser, multivar, white, fudge */

stat.rc = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dispdiv = null,
        dat = null,
        rc = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    makeNodes = function () {
        rc.nodes = [];
        rc.nos = {};
        rc.nr = {min: 1, max: 1};
        dat.days.forEach(function (day) {
            if(day.refers) {
                if(typeof day.refers === "string") {
                    day.refers = day.refers.split(","); }
                day.refers.forEach(function (rv) {
                    var rves, node;
                    rves = rv.split(":");
                    if(rves.length === 2) {  //skip any bad entries
                        node = {id: rves[0],
                                name: jt.dec(rves[0]),
                                value: +rves[1]};
                        if(!rc.nos[node.id]) {
                            rc.nos[node.id] = node;
                            rc.nodes.push(node); }
                        else {
                            node = rc.nos[node.id];
                            node.value += +rves[1]; }
                        rc.nr.max = Math.max(rc.nr.max, node.value); } });
            } });
        rc.nodes = [{name: "testA", value: 4},
                    {name: "testB", value: 3},
                    {name: "testD", value: 1},
                    {name: "testE", value: 7},
                    {name: "testC", value: 2}];
    },


    computeDims = function () {
        var margin;
        margin = {top: 20, right: 20, bottom: 20, left: 20};
        //rc.diam = window.innerWidth - (margin.left + margin.right);
        rc.diam = 960;
        rc.margin = margin;
    },


    drawContents = function () {
        rc.nbs = rc.svg.selectAll(".node")
            .data(rc.bpack.nodes({children: rc.nodes})
                  .filter(function (d) { return !d.children; }))
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")"; });
        rc.nbs.append("title")
            .text(function (d) {
                return d.name + ": " + rc.format(d.value); });
        rc.nbs.append("circle")
            .attr("r", function (d) { 
                return d.r; })
            .style("fill", "orange");
        rc.nbs.append("text")
            .attr("dy", ".3em")
            .style("text-anchor", "middle")
            .text(function (d) { return d.name.substring(0, d.r / 3); });
    },
        

    drawChart = function () {
        computeDims();
        rc.format = d3.format(",d");
        rc.bpack = d3.layout.pack()
            .sort(null)
            .size([rc.diam, rc.diam])
            .padding(1.5);
        rc.svg = d3.select("#" + dispdiv).append("svg")
            .attr({"width": rc.diam, "height": rc.diam,
                   "preserveAspectRatio": "xMidYMid",
                   "class": "bubble"});
        rc.nodes.sort(function (a, b) {
            return a.name.localeCompare(b.name); });
        drawContents();
        d3.select(self.frameElement).style("height", rc.diam + "px");
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function (divid, data) {
        dispdiv = divid;
        dat = data;
        makeNodes();
        drawChart();
    }

}; //end of returned functions
}());

