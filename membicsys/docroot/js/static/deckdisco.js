/*global app, d3, d3ckit, window */
/*jslint browser, multivar, white, fudge */

app.deckdisco = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dc = null,
        dsp = null;


    ////////////////////////////////////////
    // base slide creation functions
    ////////////////////////////////////////

    function getIntroFramingBulletFuncs () {
        var sc = {x:30};
        return [
            function (context) {
                var timing = d3ckit.timing(0.6);
                d3ckit.showText(context, "fsn", "Find something new",
                                timing, {x:sc.x, y:dc.line2y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.8);
                d3ckit.showText(context, "ftm", "in the membic",
                                timing, {x:sc.x, y:dc.line3y});
                d3ckit.showText(context, "comm", "community",
                                timing, {x:sc.x, y:dc.line4y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showGraphic(context, "imgcommfeed", timing,
                                   {x:140, y:76, w:50,
                                    href: "img/membiclogo.png"});
                timing.duration *= 2;
                return d3ckit.totalTime(timing); }
        ];
    }


    function getMembicFeedbackBulletFuncs () {
        var sc = {x:80, y1:dc.line4y + 16, y2:dc.line5y + 16, gp:0.6,
                  smx:44, smy:96, smw:30, ax:40, ay:50, aw:40, ap:16};
        return [
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "rtm", "React to membics",
                                timing, {x:sc.x, y:sc.y1});
                d3ckit.showText(context, "fo", "from others",
                                timing, {x:sc.x, y:sc.y2});
                d3ckit.showGraphic(context, "imgstm", timing,
                                   {x:sc.smx, y:sc.smy, w:sc.smw,
                                    href: "img/stackedmenu.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(0.3);
                d3ckit.fadeElement(context, "rtm", timing, 0.4);
                d3ckit.fadeElement(context, "fo", timing, 0.4);
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showGraphic(context, "imghq", timing,
                                   {x:sc.ax, 
                                    y:sc.ay, w:sc.aw,
                                    href: "img/helpfulq.png"});
                d3ckit.showGraphic(context, "imgremq", timing,
                                   {x:sc.ax + (sc.aw + sc.ap), 
                                    y:sc.ay, w:sc.aw,
                                    href: "img/rememberq.png"});
                d3ckit.showGraphic(context, "imgwrq", timing,
                                   {x:sc.ax + (2 * (sc.aw + sc.ap)),
                                    y:sc.ay, w:sc.aw,
                                    href: "img/writereview.png"});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.fadeElement(context, "imgstm", timing, sc.gp);
                d3ckit.fadeElement(context, "imghq", timing, 0.0);
                d3ckit.fadeElement(context, "imgremq", timing, sc.gp);
                d3ckit.fadeElement(context, "imgwrq", timing, sc.gp);
                d3ckit.showGraphic(context, "imgh", timing,
                                   {x:sc.ax, 
                                    y:sc.ay, w:sc.aw,
                                    href: "img/helpful.png"});
                d3ckit.showText(context, "helpfuldesc", 
                                "Mark this membic as helpful",
                                timing, {x:30, y:dc.line2y});
                timing.duration *= 2;
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.fadeElement(context, "helpfuldesc", timing, 0.0);
                d3ckit.fadeElement(context, "imgh", timing, 0.0);
                d3ckit.fadeElement(context, "imghq", timing, sc.gp);
                d3ckit.fadeElement(context, "imgremq", timing, 0.0);
                d3ckit.showGraphic(context, "imgrem", timing,
                                   {x:sc.ax + (sc.aw + sc.ap), 
                                    y:sc.ay, w:sc.aw,
                                    href: "img/rememberedsel.png"});
                d3ckit.showText(context, "rememberdesc", 
                                "Remember this membic for later",
                                timing, {x:10, y:dc.line2y});
                timing.duration *= 2;
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.fadeElement(context, "rememberdesc", timing, 0.0);
                d3ckit.fadeElement(context, "imgrem", timing, 0.0);
                d3ckit.fadeElement(context, "imgremq", timing, sc.gp);
                d3ckit.fadeElement(context, "imgwrq", timing, sc.gp);
                d3ckit.showGraphic(context, "imgwr", timing,
                                   {x:sc.ax + (2 * (sc.aw + sc.ap)),
                                    y:sc.ay, w:sc.aw,
                                    href: "img/writereviewsel.png"});
                d3ckit.showText(context, "writedesc", 
                                "Write why this was memorable",
                                timing, {x:16, y:dc.line2y});
                timing.duration *= 2;
                return d3ckit.totalTime(timing); }
        ];
    }


    function makePrefDispFunc (levs, lev, idx, sc) {
        return function (context) {
            var pl, anchor = "start", timing = d3ckit.timing(1.0);
            if(idx > 0) {
                pl = levs[idx - 1];
                anchor = "middle";
                d3ckit.fadeElement(context, pl.id + "graphic", timing, sc.op);
                d3ckit.fadeElement(context, pl.id + "title", timing, 0.0);
                pl.tls.forEach(function (ignore, ti) {
                    d3ckit.fadeElement(context, pl.tidb + ti, timing, 0.0); });}
            d3ckit.fadeElement(context, lev.id + "graphic", timing, 1.0);
            d3ckit.showText(context, lev.id + "title", lev.title, timing,
                            {x:sc.x + (idx * sc.lw), y:sc.y2, opacity:1.0,
                             ta:anchor});
            lev.tls.forEach(function (txt, ti) {
                d3ckit.showText(context, lev.tidb + ti, txt, timing,
                                {x:sc.x, y:sc.y3 + (ti * sc.yo),
                                 opacity:1.0, fw:"normal", fs:"14px"}); });
            timing.duration *= 2;
            return d3ckit.totalTime(timing); 
        };
    }


    function getProfilePrioritizationBulletFuncs () {
        var levs = [{id: "promote", title: "Prefer", img: "promote.png",
                     tidb: "levpt", tls: ["Trust this person's membics",
                                          "and show their posts first."]},
                    {id: "endorse", title: "Endorse", img: "endorse.png",
                     tidb: "levet", tls: ["Trust this person's membics",
                                          "but don't sort their posts",
                                          "ahead of other people."]},
                    {id: "normal", title: "Normal", img: "noprefsq.png",
                     tidb: "levnt", tls: ["Don't do anything special",
                                          "with membics from this person."]},
                    {id: "bg", title: "Background", img: "background.png",
                     tidb: "levbt", tls: ["Sort this person's membics",
                                          "to the end."]},
                    {id: "block", title: "Block", img: "block.png",
                     tidb: "levxt", tls: ["Don't show any membics from",
                                          "this person at all ever."]}],
            sc = {x:32, y:20, lw:50, op:0.4, y2:62, y3:90, yo:20},
            bfs = [];
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            d3ckit.showText(context, "prefintro",
                            "Tune who you hear from",
                            timing, {x:sc.x, y:dc.line3y});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            levs.forEach(function (lev, idx) {
                d3ckit.showGraphic(context, lev.id + "graphic", timing,
                                    {x:sc.x + (idx * sc.lw), y:sc.y, 
                                     w:20, opacity:sc.op, 
                                     href: "img/" + lev.img}); });
            d3ckit.fadeElement(context, "prefintro", 
                               {delay:timing.duration,
                                duration:timing.duration}, 0.0);
            return d3ckit.totalTime(timing); });
        levs.forEach(function (lev, idx) {
            bfs.push(makePrefDispFunc(levs, lev, idx, sc)); });
        return bfs;
    }


    function makeTypeDispFunc (types, type, idx, sc) {
        return function (context) {
            var pt, timing = d3ckit.timing(1.0);
            if(idx > 0) {
                pt = types[idx - 1];
                d3ckit.fadeElement(context, pt.id + "graphic", timing, sc.op);
                pt.tls.forEach(function (ignore, ti) {
                    d3ckit.fadeElement(context, pt.id + "t" + ti, 
                                       timing, 0.0); }); }
            d3ckit.fadeElement(context, type.id + "graphic", timing, 1.0);
            type.tls.forEach(function (txt, ti) {
                d3ckit.showText(context, type.id + "t" + ti, txt, timing,
                                {x:140, ta:"middle", y:sc.y3 + (ti * sc.yo),
                                 opacity:1.0, fw:"normal", fs:"14px"}); });
            timing.duration *= 2;
            return d3ckit.totalTime(timing);
        };
    }


    function getTypeFilterBulletFuncs() {
        var types = [{id:"tbook", img:"TypeBook50.png",
                      tls:["Notable books for reference",
                           "and recommendation"]},
                     {id:"tarticle", img:"TypeArticle50.png",
                      tls:["Articles memorable for",
                           "information or insight"]},
                     {id:"tmovie", img:"TypeMovie50.png",
                      tls:["Movies, documentaries, and",
                           "series worth remembering"]},
                     {id:"tvideo", img:"TypeVideo50.png",
                      tls:["Videos worth keeping for",
                           "reference later"]},
                     {id:"tsong", img:"TypeSong50.png",
                      tls:["Songs or collections",
                           "recommended to the world"]},
                     {id:"tyum", img:"TypeYum50.png",
                      tls:["Food, drinks, provisioning,",
                           "bars, and eateries"]},
                     {id:"tact", img:"TypeActivity50.png",
                      tls:["Notable things to do",
                           "around town"]},
                     {id:"tother", img:"TypeOther50.png",
                      tls:["Everything else"]}],
            sc = {x:32, y:20, lw:30, op:0.4, y2:62, y3:dc.line3y, yo:20},
            bfs = [];
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            d3ckit.showText(context, "typesintro",
                            "Filter by type",
                            timing, {x:60, y:dc.line3y});
            return d3ckit.totalTime(timing); });
        bfs.push(function (context) {
            var timing = d3ckit.timing(1.0);
            types.forEach(function (type, idx) {
                d3ckit.showGraphic(context, type.id + "graphic", timing,
                                   {x:sc.x + (idx * sc.lw), y:sc.y,
                                    w:20, opacity:sc.op,
                                    href:"img/" + type.img}); });
            d3ckit.fadeElement(context, "typesintro",
                               {delay:timing.duration,
                                duration:timing.duration}, 0.0);
            return d3ckit.totalTime(timing); });
        types.forEach(function (type, idx) {
            bfs.push(makeTypeDispFunc(types, type, idx, sc)); });
        return bfs;
    }


    function getTaglineDisplayBulletFuncs () {
        return [
            function (context) {
                var timing = d3ckit.timing(0.5);
                d3ckit.showText(context, "tag1", "Membic", timing,
                                {x:50, y:dc.line3y});
                return d3ckit.totalTime(timing); },
            function (context) {
                var timing = d3ckit.timing(1.0);
                d3ckit.showText(context, "tag2", "Memory Communication", timing,
                                {x:50, y:dc.line4y, fs:"14px", fw:"normal"});
                timing.duration *= 2;
                return d3ckit.totalTime(timing); }
        ];
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    getSlides: function () {
        return [getIntroFramingBulletFuncs(),
                getMembicFeedbackBulletFuncs(),
                getProfilePrioritizationBulletFuncs(),
                getTypeFilterBulletFuncs(),
                getTaglineDisplayBulletFuncs()];
    },


    init: function (context) {
        var timing = d3ckit.timing(0.5);
        dsp = d3ckit.getDisplay();
        dc = dsp.dc;
        d3ckit.showText(context, "discovery", "Discovery", null,
                        {x:80, y:dc.titley, fs:dc.titlefs});
        return d3ckit.totalTime(timing);
    }


};  //end of returned functions
}());
