/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.decktheme = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var tty = 26,
        dc = null,
        dsp = null;


    ////////////////////////////////////////
    //base slide creation functions
    ////////////////////////////////////////

    function getThemeUseBulletFuncs () {
        var arrowmult = 0.5;
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "pt1", 
                                "Themes collect related membics",
                                timing, {x:dc.leftx, y:tty});
                d3ckit.showGraphic(context, "t1g", timing,
                                   {x:126, y:44, w:30, 
                                    href: "img/microsite.png"});
                timing.duration += Math.round(0.5 * timing.duration);
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.fadeElement(context, "pt1", timing, 0.0);
                d3ckit.showText(context, "pt2", "Anyone can create a theme",
                                timing, {x:dc.leftx, y:tty});
                d3ckit.showGraphic(context, "prof1", timing,
                                   {x:-74, y:40, w:40, 
                                    href: "img/profile.png"});
                d3ckit.transElement(context, "prof1", timing,
                                    {transform: "scale(-1,1)"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.drawArrow(context, "p1t1", timing,
                                 {x1:72, y1:59, x2:118, y2:59, 
                                  "marker-start": ""});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.showGraphic(context, "t2g", timing,
                                   {x:126, y:84, w:30, 
                                    href: "img/microsite.png"});
                d3ckit.drawArrow(context, "p1t2", timing, 
                                 {x1:72, y1:59, x2:119, y2:95, 
                                  "marker-start": ""});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.fadeElement(context, "pt2", timing, 0.0);
                d3ckit.showText(context, "pt3", "and collaborate with others",
                                timing, {x:dc.leftx, y:tty});
                d3ckit.showGraphic(context, "prof2", timing,
                                   {x:202, y:40, w:40, 
                                    href: "img/profile.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.drawArrow(context, "p2t1", timing, 
                                 {x1:206, y1:59, x2:162, y2:59, 
                                  "marker-start": ""});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.showGraphic(context, "prof3", timing,
                                   {x:202, y:80, w:40, 
                                    href: "img/profile.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(arrowmult);
                d3ckit.drawArrow(context, "p3t1", timing, 
                                 {x1:206, y1:99, x2:162, y2:99, 
                                  "marker-start": ""});
                d3ckit.drawArrow(context, "p3t2", timing,
                                 {x1:206, y1:99, x2:161, y2:68, 
                                  "marker-start": ""});
                timing.duration *= 2;  //let that sink in
                return d3ckit.totalTime(timing); }
        ];
    }


    function makeRoleDispFunc (roles, role, idx, f) {
        return function (context) {
            var pr, timing = d3ckit.timing(1.0);
            if(idx > 0) {
                pr = roles[idx - 1];
                d3ckit.transElement(context, pr.id, timing, 
                                    {tl:"0," + ((idx - 1) * f.yo), opa:f.op});
                pr.tls.forEach(function (ignore, si) {
                    d3ckit.transElement(context, pr.tidb + si, timing,
                                        {opa:0.0}); }); }
            d3ckit.transElement(context, role.id, timing,
                                {tl:"0," + (idx * f.yo), opa:1.0});
            role.tls.forEach(function (txt, si) {
                d3ckit.showText(context, role.tidb + si, txt, timing,
                                {x:f.x2, y:f.y + (si * f.yo),
                                 opacity:1.0, fw: "normal"}); });
            timing.duration += Math.round(0.6 * timing.duration);
            return d3ckit.totalTime(timing); };
    }


    function getMembershipBulletFuncs () {
        var f = {x:20, y:40, yo:26, op:0.4, x2:134},
            roles = [{id: "founders", title: "Founders", 
                      tidb: "fotxt", tls: ["can do anything"]},
                     {id: "moderators", title: "Moderators",
                      tidb: "motxt", tls: ["", "members who can",
                                           "remove innapropriate",
                                           "content"]},
                     {id: "members", title: "Members",
                      tidb: "metxt", tls: ["", "", "can post membics",
                                           "to the theme"]},
                     {id: "followers", title: "Followers",
                      tidb: "fwtxt", tls: ["", "", "",
                                           "interested readers"]}],
            bfs = [];
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            d3ckit.showText(context, "mlev", "Membership Levels", timing,
                            {x:f.x, y:f.y});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(0.5);
            d3ckit.transElement(context, "mlev", timing, {opa: 0.0});
            roles.forEach(function (role) {
                d3ckit.showText(context, role.id, role.title, timing,
                                {x:f.x, y:f.y, opa:f.op}); });
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            roles.forEach(function (role, idx) {
                d3ckit.transElement(context, role.id, timing,
                                    {tl:"0," + (idx * f.yo), opa:f.op}); });
            return d3ckit.totalTime(timing); });
        roles.forEach(function (role, idx) {
            bfs.push(makeRoleDispFunc(roles, role, idx, f)); });
        return bfs;
    }


    function getThemeProfileBulletFuncs () {
        var sc = {x:68, y:26, x2:72, y2:52, y3:78}, bb;
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tpic", "Theme picture", timing,
                                {x: sc.x, y:sc.y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tico", "or logo,", timing,
                                {x:92, y:sc.y2});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.transElement(context, "tpic", timing, 
                                    {tl:"-68,0", opa:0.0});
                d3ckit.transElement(context, "tico", timing,
                                    {tl:"-92,0", opa:0.0});
                d3ckit.drawBox(context, "picframe", timing, 
                               {x:10, y:10, w:50, stropa: 0.8});
                d3ckit.showGraphic(context, "imgtheme", timing,
                                   {x:10, y:10, w:50, 
                                    href: "img/microsite.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tname", "Theme Name", timing,
                                {x:sc.x2, y:sc.y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tdesc", "Description", timing,
                                {x:sc.x2, y:sc.y2, fs:"14px", fw:"normal"});
                bb = d3.select("#tdesc").node().getBBox();
                d3ckit.showText(context, "tsite", ", site,", timing,
                                {x:bb.x + bb.width, y:sc.y2,
                                 fs:"14px", fw:"normal"});
                d3ckit.showText(context, "tkeys", "custom keywords", timing,
                                {x:sc.x2, y:68, fs:"14px", fw:"normal"});
                timing.duration *= 2;  //extra pause, lots of words.
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.fadeElement(context, "tsite", timing, 0.0);
                d3ckit.fadeElement(context, "tkeys", timing, 0.0);
                d3ckit.showText(context, "pall", "All themes have a", timing,
                                {x:30, y:98});
                bb = d3.select("#pall").node().getBBox();
                d3ckit.showText(context, "pprm", "permalink", timing,
                         //italic and oblique render jerkily in Mac FF 49.02
                         //but still want the emphasis
                                {x:bb.x + bb.width + 6, y:98, fe:"italic"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "phash", "and optional #hashtag",
                                timing, {x:30, y:121});
                return d3ckit.totalTime(timing); }
        ];
    }


    function makeThemeTabFunc (tabs, tab, idx, tc, sc) {
        return function (context) {
            var pt, timing = d3ckit.timing();
            if(idx > 0) {
                pt = tabs[idx - 1];
                d3ckit.transElement(context, pt.gid, timing, {opa:sc.op});
                d3ckit.transElement(context, pt.ti, timing, {opa:0.0}); }
            if(tab.gid) {
                d3ckit.transElement(context, tab.gid, timing, {opa:1.0});
                d3ckit.showText(context, tab.ti, tab.txt, timing, tc); }
            return d3ckit.totalTime(timing); };
    }



    function getThemeComponentBulletFuncs () {
        var bfs = getThemeProfileBulletFuncs(),
            sc = {x:20, y:84, tw:40, op:0.4},
            tcs = {x:  20, y: 128, "text-anchor": "start"},
            tcm = {x: 130, y: 128, "text-anchor": "middle"},
            tce = {x: 244, y: 128, "text-anchor": "end"},
            tabs = [{gid: "tablatest", img: "img/tablatest.png",
                     ti: "tl", txt: "Recent theme membics"},
                    {gid: "tabtop", img: "img/top.png",
                     ti: "tt", txt: "Top theme membics"},
                    {gid: "tabsearch", img: "img/search.png",
                     ti: "ts", txt: "Search by text or keyword"},
                    {gid: "tabstats", img: "img/stats.png",
                     ti: "tn", txt: "Visual traffic analysis"},
                    {gid: "tabrss", img: "img/rssicon.png",
                     ti: "tr", txt: "RSS Newsfeed"},
                    {gid: "tabembed", img: "img/embed.png",
                     ti: "te", txt: "Embed in your website"}];
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            d3ckit.fadeElement(context, "pall", timing, 0.0);
            d3ckit.fadeElement(context, "pprm", timing, 0.0);
            d3ckit.fadeElement(context, "phash", timing, 0.0);
            tabs.forEach(function (tab, idx) {
                d3ckit.showGraphic(context, tab.gid, timing,
                                   {x:sc.x + (idx * sc.tw), y:sc.y, w:20,
                                    opacity:sc.op, href:tab.img}); });
            return d3ckit.totalTime(timing); });
        tabs.forEach(function (tab, idx) {
            var tc = tcm;
            if(idx === 0) {
                tc = tcs; }
            if(idx === tabs.length - 1) {
                tc = tce; }
            bfs.push(makeThemeTabFunc(tabs, tab, idx, tc, sc)); });
        return bfs;
    }


    function getTaglineBulletFuncs () {
        return [
            function (context) {
                var adjs = ["Microsite", "Plug-In", "Newsfeed", "Archive"],
                    timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "proftag1",
                                "Your Membic Theme", timing,
                                {x:50, y:dc.line3y});
                adjs.forEach(function (word, idx) {
                    var wd = Math.round(0.6 * timing.duration),
                        bb = {x:20, width:0};
                    if(idx > 0) {
                        bb = d3.select("#tagw" + (idx - 1)).node().getBBox(); }
                    if(idx < adjs.length - 1) {
                        word += ", "; }
                    else {
                        word += "."; }
                    d3ckit.showText(context, "tagw" + idx, word, 
                                    {delay: (idx + 1) * wd, duration: wd},
                                    {x:bb.x + bb.width, y:dc.line4y,
                                     "font-size": "14px", 
                                     "font-weight": "normal"}); });
                timing.duration *= 5;  //each word plus extra hold time
                return d3ckit.totalTime(timing); }
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    getSlides: function () {
        return [getThemeUseBulletFuncs(),
                getMembershipBulletFuncs(),
                getThemeComponentBulletFuncs(),
                getTaglineBulletFuncs()];
    },


    init: function (context) {
        var timing = d3ckit.timing(0.5);
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(context, "themetitle", "Themes", null,
                        {x:84, y:dc.titley, fs:dc.titlefs});
        return d3ckit.totalTime(timing);
    }

};  //end of returned functions
}());
