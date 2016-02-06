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
        taxon = [{id: "root", name: "Agents", children: [
            {id: "point", name: "Point", children: []},
            {id: "touch", name: "Touch", children: []},
            {id: "rss", name: "RSS", children: []},
            {id: "bot", name: "Bot", children: []},
            {id: "other", name: "Other", children: []}]}],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    aggregateAgents = function () {
        ac.ags = [];
        ac.aos = {};
        ac.ar = {min: 1, max: 1};
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
                                count: +aves[1]};
                        if(!ac.aos[node.id]) {
                            ac.aos[node.id] = node;
                            ac.ags.push(node); }
                        else {
                            node = ac.aos[node.id];
                            node.count += +aves[1]; }
                        ac.ar.max = Math.max(ac.ar.max, node.count); } });
            } });
    },


    isKnownBot = function (name) {
        var ts = ["AhrefsBot", "Baiduspider", "ezooms.bot",
                  "AppEngine-Google", "Googlebot", "YandexImages", 
                  "crawler.php"];
        return !ts.every(function (botstr) {
            return name.indexOf(botstr) < 0; });
    },


    isKnownRSS = function (name) {
        var ts = ["netvibes.com", "feedly.com"];
        return !ts.every(function (rssa) {
            return name.indexOf(rssa) < 0; });
    },


    isKnownTouchDevice = function (name) {
        var ts = ["Android", "Phone", "iPod", "iPad"];
        return !ts.every(function (ds) {
            return name.indexOf(ds) < 0; });
    },


    isKnownPointingDevice = function (name) {
        var ts = ["Windows", "Mac", "Linux"];
        return !ts.every(function (ds) {
            return name.indexOf(ds) < 0; });
    },


    classifyAgents = function () {
        ac.agc = {};  //agent classifications
        taxon[0].children.forEach(function (cat) {
            ac.agc[cat.id] = cat.children; });
        ac.ags.forEach(function (agent) {
            if(isKnownBot(agent.name)) {
                ac.agc.bot.push(agent); }
            else if(isKnownRSS(agent.name)) {
                ac.agc.rss.push(agent); }
            else if(isKnownTouchDevice(agent.name)) {  //test before point
                ac.agc.touch.push(agent); }
            else if(isKnownPointingDevice(agent.name)) {
                ac.agc.point.push(agent); }
            else {
                ac.agc.other.push(agent); } });
    },


    dataDebugHTML = function () {
        var html = [];
        ac.nodes.forEach(function (node, idx) {
            html.push(["div", {cla: "dbgdatdiv"},
                       node.nodenumber + ": " + node.name]); });
        ac.links.forEach(function (link) {
            html.push(["div", {cla: "dbgdatdiv"},
                       String(link.source) + " -> " + link.target +
                       " value: " + link.value]); });
        return html;
    },


    sumCounts = function (tn) {
        tn.count = tn.count || 1;
        if(tn.children) {
            tn.children.forEach(function (child) {
                child.parent = tn;
                tn.count += sumCounts(child); }); }  //NOT out of scope
        return tn.count;
    },


    taxonTreeHTML = function (taxon, html, indent) {
        taxon.forEach(function (tn) {
            html.push(["div", {cla: "tndiv", 
                               style: "padding-left:" + (10 * indent) + "px;"},
                       tn.name + ": " + tn.count]);
            if(tn.children) {
                taxonTreeHTML(tn.children,  //NOT out of scope
                              html, indent + 1); } });
        return html;
    },


    makeNodes = function (taxon) {
        taxon.forEach(function (tn) {
            var name = tn.name, 
                pidx = name.indexOf("(");
            if(pidx > 0) {
                name = name.slice(pidx + 1); }
            name = jt.ellipsis(name, 30)
            tn.nodenumber = ac.nodenumber;
            ac.nodenumber += 1;
            ac.nodes.push({name: name, title: tn.name, 
                           nodenumber: tn.nodenumber}); });
        taxon.forEach(function (tn) {
            if(tn.children) {
                makeNodes(tn.children); } });  //NOT out of scope
    },


    makeLinks = function (taxon) {
        taxon.forEach(function (tn) {
            var link;
            if(tn.parent) {
                link = {source: tn.parent.nodenumber,
                        target: tn.nodenumber,
                        value: tn.count};
                if(tn.children && tn.children.length) {
                    link.value -= 1; }
                ac.links.push(link); } });
        taxon.forEach(function (tn) {
            if(tn.children) {
                makeLinks(tn.children); } });  //NOT out of scope
    },


    prepData = function () {
        aggregateAgents();
        classifyAgents();
        sumCounts(taxon[0]);
        jt.out(dispdiv, jt.tac2html(taxonTreeHTML(taxon, [], 0)));
        ac.nodes = [];
        ac.nodenumber = 0;
        makeNodes(taxon, 0);
        ac.links = [];
        makeLinks(taxon);
        jt.out(dispdiv, jt.tac2html(dataDebugHTML()));
    },


    computeDims = function () {
        var margin;
        margin = {top: 10, right: Math.round(0.20 * window.innerWidth), 
                  bottom: 40, left: 30};
        ac.width = Math.round(0.75 * window.innerWidth) - margin.left;
        ac.h = Math.round(0.66 * ac.width);  //3-2 aspect ratio
        ac.h -= 40; //covers any exterior div padding
        ac.height = ac.h - (margin.top + margin.bottom);
        ac.margin = margin;
    },


    drawContents = function () {
        ac.gls = ac.svg.append("g").selectAll(".link")
            .data(ac.links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", ac.path)
            .style("stroke-width", function (d) { return Math.max(1, d.dy); })
            .style({"fill": "none", "stroke": "#000", "stroke-opacity": 0.2})
            .on("mouseover", function () { this.style.strokeOpacity = 0.4; })
            .on("mouseout", function () { this.style.strokeOpacity = 0.2; })
            .sort(function (a, b) { return b.dy - a.dy; });
        ac.gls.append("title")
            .text(function (d) { 
                return "(" + d.value + ") " + d.target.title; });
        ac.gns = ac.svg.append("g").selectAll(".node")
            .data(ac.nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) { 
                return "translate(" + d.x + "," + d.y + ")"; })
            .call(d3.behavior.drag()
                  .origin(function (d) { return d; })
                  .on("dragstart", function () { 
                      this.parentNode.appendChild(this); })
                  .on("drag", stat.ac.dragmove));
        ac.gns.append("rect")
            .attr("height", function (d) { return d.dy; })
            .attr("width", ac.sankey.nodeWidth())
            .style("fill", function (d) { return d.color || "blue"; })
            .style("stroke", function (d) { return d3.rgb(d.color).darker(2); })
            .style({"cursor": "move", "fill-opacity": 0.9, 
                    "shape-rendering": "crispEdges"})
            .append("title")
            .text(function (d) { return "(" + d.value + ") " + d.title; });
        ac.gns.append("text")
            .attr("x", 6 + ac.sankey.nodeWidth())
            .attr("y", function (d) { return d.dy / 2; })
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .attr("transform", null)
            .style({"pointer-events": "none", "text-shadow": "0 1px 0 #fff"})
            .text(function (d) { return d.name; });
    },


    drawChart = function () {
        computeDims();
        jt.out(dispdiv, "");
        ac.svg = d3.select("#" + dispdiv).append("svg")
            //.style("background", "#fff")
            .attr("width", ac.width)
            .attr("height", ac.height)
            .append("g")
            .attr("transform", "translate(" + ac.margin.left + "," + 
                                              ac.margin.top + ")");
        ac.sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .size([ac.width - (ac.margin.left + ac.margin.right), 
                   ac.height - (ac.margin.top + ac.margin.bottom)])
            .nodes(ac.nodes)
            .links(ac.links)
            .layout(32);
        ac.path = ac.sankey.link();
        drawContents();
    };


    ////////////////////////////////////////
    // global functionality
    ////////////////////////////////////////
return {

    display: function (divid, data) {
        dispdiv = divid;
        dat = data;
        prepData();
        drawChart();
    },


    dragmove: function (d) {
        d.y = Math.min(ac.height - d.dy, d3.event.y);  //bottom bounded
        d.y = Math.max(0, d.y);  //top bounded
        d3.select(this).attr(
            "transform", "translate(" + d.x + "," + d.y + ")");
        ac.sankey.relayout();
        ac.gls.attr("d", ac.path);
    }


}; //end of returned functions
}());

