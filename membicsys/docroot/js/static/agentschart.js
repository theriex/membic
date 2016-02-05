/*global d3, stat, jt, window */
/*jslint browser, multivar, white, fudge */

stat.ac = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dispdiv = null,
        dat = null,
        ac = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    makeNodes = function () {
        ac.nodes = [];
        ac.nos = {};
        ac.nr = {min: 1, max: 1};
        dat.days.forEach(function (day) {
            if(day.agents) {
                if(typeof day.agents === "string") {
                    day.agents = day.agents.split(","); }
                day.agents.forEach(function (av) {
                    var aves, node;
                    aves = av.split(":");
                    if(aves.length === 2) {  //skip any degenerate entries
                        node = {id: aves[0],
                                name: jt.dec(aves[0]),
                                value: +aves[1]};
                        if(!ac.nos[node.id]) {
                            ac.nos[node.id] = node;
                            ac.nodes.push(node); }
                        else {
                            node = ac.nos[node.id];
                            node.value += +aves[1]; }
                        ac.nr.max = Math.max(ac.nr.max, node.value); } });
            } });
        // ac.nodes = [{name: "testA", value: 4},
        //             {name: "testB", value: 3},
        //             {name: "testD", value: 1},
        //             {name: "testE", value: 7},
        //             {name: "testC", value: 2}];
    },


    computeDims = function () {
        var margin;
        margin = {top: 10, right: 20, bottom: 10, left: 20};
        ac.diam = window.innerWidth - (margin.left + margin.right);
        ac.margin = margin;
    },


    drawContents = function () {
        ac.bcon = ac.svg.append("g")
            .attr("class", "nodecontainer");
        ac.nbs = ac.bcon.selectAll(".node")
            .data(ac.bpack.nodes({children: ac.nodes})
                  .filter(function (d) { return !d.children; }))
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")"; });
        ac.nbs.append("title")
            .text(function (d) {
                return d.name + ": " + ac.format(d.value); });
        ac.nbs.append("circle")
            .attr("r", function (d) { 
                return d.r; })
            .style({"fill": "#fd700a", "stroke": "#b9100f"});
        ac.nbs.append("text")
            .attr("dy", ".3em")
            .style("text-anchor", "middle")
            .text(function (d) { return d.name.substring(0, d.r / 3); });
    },
        

    drawChart = function () {
        computeDims();
        ac.format = d3.format(",d");
        ac.bpack = d3.layout.pack()
            .sort(null)
            .size([ac.diam, ac.diam])
            .padding(1.5);
        ac.svg = d3.select("#" + dispdiv).append("svg")
            .attr({"width": ac.diam, "height": ac.diam,
                   "preserveAspectRatio": "xMidYMid",
                   "class": "bubble"});
        ac.nodes.sort(function (a, b) {
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
        if(ac.nodes && ac.nodes.length > 1) {
            drawChart(); }
    }

}; //end of returned functions
}());

