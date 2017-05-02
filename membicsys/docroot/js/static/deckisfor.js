/*global app, jt, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge, for */

app.deckisfor = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dc = null,
        dsp = null,
        context = null,
        wm = null,
        qs = null;

    ////////////////////////////////////////
    // slide helper functions
    ////////////////////////////////////////

    function displayButton (bt, wo, clickf) {
        var bb, timing = d3ckit.timing(1.0);
        wo.pad = 2;
        wo.opb = 0.8;
        wo.opa = 1.0;
        wo.g = context.g.append("g")
            .attr("opacity", 0.0)
            .on("mouseover", function () { 
                wo.g.attr("opacity", wo.opa); })
            .on("mouseout", function () {
                wo.g.attr("opacity", wo.opb); })
            .on("click", clickf);
        wo.back = wo.g.append("rect")
            .attr("class", "rectbb")
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("x", wo.x)
            .attr("y", wo.y)
            .attr("height", 10)
            .attr("width", 10);
        wo.text = wo.g.append("text")
            .attr("class", "rectbt")
            .attr("text-anchor", "middle")
            .attr("fill", dsp.textcolor)
            .attr("x", wo.x)
            .attr("y", wo.y)
            .attr("font-size", 12)
            .text(bt);
        bb = wo.text.node().getBBox();
        wo.back
            .attr("x", bb.x - wo.pad)
            .attr("y", bb.y - wo.pad)
            .attr("height", bb.height + (2 * wo.pad))
            .attr("width", bb.width + (2 * wo.pad));
        wo.g.transition().duration(timing.duration)
            .attr("opacity", wo.opb);
    }


    function displayButtons (question, bline) {
        var cs = {x1:80, x2:180, y:dc["line" + bline + "y"]};
        switch(question.t) {
        case "q":
            displayButton("No", {x:cs.x1, y:cs.y}, function () {
                wm.n[question.id] = question.id;
                question.displayed = true;
                app.deckisfor.nextQuestion(); });
            displayButton("Yes", {x:cs.x2, y:cs.y}, function () {
                wm.y[question.id] = question.id;
                question.displayed = true;
                app.deckisfor.nextQuestion(); });
            break;
        case "a":
            displayButton("Reset Answers", {x:cs.x1, y:cs.y}, function () {
                wm = {y:{}, n:{}, a:{}};
                qs.forEach(function (q) { q.displayed = false; });
                app.deckisfor.nextQuestion(); });
            displayButton("Next", {x:cs.x2, y:cs.y}, function () {
                question.displayed = true;
                wm.a[question.id] = question.id;
                app.deckisfor.nextQuestion(); });
            break;
        default:
            jt.log("displayButtons unknown question type: " + question.t); }
    }


    function lineify (text, ww) {
        var lines = [], line = "", words = text.split(" ");
        words.forEach(function (word) {
            if(line && line.length + word.length >= ww) {
                lines.push(line);
                line = ""; }
            if(line) {
                line += " "; }
            line += word; });
        lines.push(line);
        return lines;
    }


    function displayText (question) {
        var fs, linoff, lines, timing;
        fs = 16;
        lines = lineify(question.txt, 28);
        if(lines.length > 4) {
            fs = 14;
            lines = lineify(question.txt, 34); }
        switch(lines.length) {
        case 1: linoff = 3; break;
        case 2: linoff = 2; break;
        case 3: linoff = 2; break;
        default: linoff = 1; }
        timing = d3ckit.timing(1.0);
        lines.forEach(function (line, idx) {
            d3ckit.showText(context, question.id + "_t" + idx, line, timing,
                            {x:dc.tmidx, y:dc["line" + (linoff + idx) + "y"],
                             fs:fs, ta:"middle"}); });
        return linoff + lines.length;
    }


    function displayQuestion (question) {
        var bline;
        context.g.selectAll("*").remove();  //button click faded if existing
        bline = displayText(question);
        displayButtons(question, bline);
    }


    function conditionsMet (question) {
        var conds, retval = false;
        question.m = question.m || "";
        conds = question.m.csvarray();
        question.mlen = conds.length;
        if(!conds.length) {   //empty match condition always eligible
            retval = true; }
        conds.forEach(function (condition) {
            var cc = condition.split(":"),
                ct = cc[0],
                cv = cc[1],
                negate = false,
                wmt;
            if(ct.startsWith("!")) {
                negate = true;
                question.mlen -= 1;  //negative matches don't prioritize
                ct = ct.slice(1); }
            wmt = wm[ct];
            if(!wmt) {
                jt.log("Bad condition construct: " + condition); }
            else {
                if(wmt[cv] || (cv === "*" && Object.keys(wmt).length > 0)) {
                    retval = true; }
                if(negate) {
                    retval = !retval; } } });
        return retval;
    }


    function nextQuestion () {
        var cands = [];
        qs.forEach(function (question, idx) {
            question.qidx = idx;
            if(!question.displayed && conditionsMet(question)) {
                cands.push(question); } });
        if(!cands.length) {
            return d3ckit.next(); }
        cands.sort(function (a, b) {
            if(a.mlen > b.mlen) { return -1; }
            if(a.mlen < b.mlen) { return 1; }
            if(a.qidx < b.qidx) { return -1; }
            if(a.qidx > b.qidx) { return 1; }
            return 0; });
        displayQuestion(cands[0]);
    }


    function runQuestions () {
        qs = [
            //web site
            {t:"q", id:"website", m:"", txt:"Do you have a web site?"},
            {t:"q", id:"siterefs", m:"y:website", txt:"Does your site provide reference links to articles, books, or videos?"},
            {t:"q", id:"refsupd", m:"y:siterefs", txt:"Are the links regularly updated and easy for visitors to search?"},
            {t:"a", id:"incinstead", m:"n:refsupd", txt:"Replacing your reference links page with a membic theme keeps it up to date and looking great."},
            {t:"q", id:"potentrefs", m:"n:siterefs", txt:"Are there articles, books, videos or other links that could be helpful to people visiting your site?"},
            {t:"a", id:"startrefs", m:"y:potentrefs", txt:"You can add depth and interest to your site by embedding a membic theme with helpful links."},

            //reading or research group
            {t:"q", id:"readgroup", m:"", txt:"Are you part of a reading or research group?"},
            {t:"q", id:"grpshare", m:"y:readgroup", txt:"Would it help your group to easily share links to articles, books, videos and other resources?"},
            {t:"a", id:"grptheme", m:"y:grpshare", txt:"A membic theme is an easy and powerful way for groups to share and manage helpful reference links."},

            //helpful individual, thought leader
            {t:"q", id:"findlinks", m:"", txt:"Do you regularly find articles, books, or videos that could be helpful or interesting to other people?"},
            {t:"q", id:"soclinks", m:"y:findlinks", txt:"Do you share these links on social media?"},
            {t:"q", id:"socadd", m:"y:soclinks", txt:"Would it be helpful to automatically maintain a searchable site and newsfeed for the links you share?"},
            {t:"a", id:"refsite", m:"y:socadd", txt:"Making a membic when sharing a link gets you an archive and newsfeed in addition to your social media presence."},
            {t:"q", id:"refshare", m:"n:soclinks", txt:"Would it be helpful to have a site to share and search these links?"},
            {t:"a", id:"sharesite", m:"y:refshare", txt:"A membic theme gets you a newsfeed and archive for the helpful links you find."},

            //failouts
            {t:"a", id:"not4u", m:"!a:*", txt:"Nope. It doesn't look like membic is for you. Thanks for stopping by."}];
        wm = wm || {y:{}, n:{}, a:{}};
        nextQuestion();
    }


    function startQuestions (con) {
        context = con;
        runQuestions();
        return -1;  //halts autoplay
    }


    function getTaglineBulletFuncs () {
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tbt1", "Membic saves and displays",
                                timing, {x:dc.tmidx, ta:"middle", y:dc.line2y});
                d3ckit.showText(context, "tbt2", "helpful reference links.",
                                timing, {x:dc.tmidx, ta:"middle", y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "tbt3", "For you, ",
                                timing, {x:44, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5),
                    bb = d3.select("#tbt3").node().getBBox();
                d3ckit.showText(context, "tbt4", "your groups,",
                                timing, {x:bb.x + bb.width + 5, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tbt5", "and your websites.",
                                timing, {x:dc.tmidx, ta:"middle", y:dc.line5y});
                timing.duration *= 2;  //extra hold time at end
                return d3ckit.totalTime(timing); }
        ];
    }
    

    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    nextQuestion: function () {
        nextQuestion();
    },


    getSlides: function () {
        return [[startQuestions],
                getTaglineBulletFuncs()];
    },


    init: function (context) {
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(context, "isfor", "Is this for me?", null,
                        {x:32, y:dc.titley, fs:dc.titlefs});
    }

};  //end of returned functions
}());

