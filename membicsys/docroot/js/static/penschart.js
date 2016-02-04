/*global d3, stat, jt */
/*jslint browser, multivar, white, fudge */

stat.pc = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dispdiv = null,
        dat = null,
        pc = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    makeNodes = function () {
        pc.nodes = [];
        pc.nos = {};
        pc.nr = {min: 1, max: 1};
        dat.days.forEach(function (day) {
            if(day.logvis) {
                if(typeof day.logvis === "string") {
                    day.logvis = day.logvis.split(","); }
                day.logvis.forEach(function (lv) {
                    var lves, node;
                    lves = lv.split(":");
                    if(lves.length === 2) {
                        node = {id: "pen" + lves[0],
                                penid: lves[0],
                                penname: jt.dec(lves[1]),
                                url: "../?view=pen&penid=" + lves[0],
                                count: 1};
                        if(!pc.nos[node.id]) {
                            pc.nos[node.id] = node;
                            pc.nodes.push(node); }
                        else {
                            node = pc.nos[node.id];
                            node.count += 1;
                            pc.nr.max = Math.max(pc.nr.max, node.count); } } });
                } });
    },


    drawChart = function () {
        var html = [];
        pc.nodes.sort(function (a, b) {
            return b.count - a.count; });
        pc.xscale = d3.scale.linear()
            .range([10, 32])   //font-size in px
            .domain([pc.nr.min, pc.nr.max]);
        pc.nodes.forEach(function (node, idx) {
            html.push(["a", {href: "#" + node.url,
                             onclick: jt.fs("window.open('" + node.url + "')")},
                       ["span", {cla: "penlinkspan", 
                                 style: "font-size:" + pc.xscale(node.count) + 
                                        "px;"},
                        node.penname + 
                        ((idx + 1 < pc.nodes.length)? ", " : " ")]]); });
        jt.out(dispdiv, jt.tac2html(html));
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

