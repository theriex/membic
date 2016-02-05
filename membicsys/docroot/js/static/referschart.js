/*global d3, stat, jt, window */
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
        // rc.nodes = [{name: "testA", value: 4},
        //             {name: "testB", value: 3},
        //             {name: "testD", value: 1},
        //             {name: "testE", value: 7},
        //             {name: "testC", value: 2}];
    },


    computeDims = function () {
        var margin;
        margin = {top: 10, right: 20, bottom: 10, left: 20};
        rc.diam = window.innerWidth - (margin.left + margin.right);
        rc.margin = margin;
    },


    adjustContentDisplay = function () {
        var miny = rc.diam,
            maxy = 0;
        rc.nodes.forEach(function (node) {
            var nodey = node.y - node.r;
            nodey = Math.floor(nodey) - rc.margin.top;
            miny = Math.min(miny, nodey);
            nodey = node.y + node.r;
            nodey = Math.ceil(nodey) + rc.margin.bottom;
            maxy = Math.max(maxy, nodey); });
        rc.bcon.attr("transform", "translate(0,-" + miny + ")");
        rc.svg.attr("height", maxy - miny);
    },


    drawContents = function () {
        rc.bcon = rc.svg.append("g")
            .attr("class", "nodecontainer");
        rc.nbs = rc.bcon.selectAll(".node")
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
            .style({"fill": "#fd700a", "stroke": "#b9100f"});
        rc.nbs.append("text")
            .attr("dy", ".3em")
            .style("text-anchor", "middle")
            .text(function (d) { return d.name.substring(0, d.r / 3); });
        adjustContentDisplay();
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
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function (divid, data) {
        dispdiv = divid;
        dat = data;
        makeNodes();
        if(rc.nodes && rc.nodes.length > 1) {
            drawChart(); }
    }

}; //end of returned functions
}());

