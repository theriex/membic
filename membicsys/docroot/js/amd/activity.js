/*global setTimeout, window, document, app, jt */

/*jslint browser, multivar, white, fudge, for */

//////////////////////////////////////////////////////////////////////
// Display of recent posts from friends, remembered posts.  
//

app.activity = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var feeds = {},  //all keys are arrays of membics
        feedmeta = {},
        bootmon = { tout: null, count: 0 },
        memodiv = "",
        urlToRead = "",
        hidemine = 0,
        lastDisplayFeedtype = "all",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    //Non-destructively merge in recent personal membics into the
    //server main feed, without messing up the server display order.
    //The main feed is ordered by creation time not modification time,
    //so that people are not tempted to modify their membics just to
    //keep them at the top of the display.
    mergePersonalRecent = function (feedtype, feedrevs) {
        var revs = [], frcsv = "", mr, mridx = 0;
        if(!app.pen.myPenId()) {
            return feedrevs; }  //no personal membics to merge in
        feedrevs.forEach(function (fr) {  //build the id lookup reference list
            var frid = jt.instId(fr);
            if(!frcsv.csvcontains(frid)) {
                frcsv = frcsv.csvappend(frid); } });
        mr = app.lcs.getCachedRecentReviews(feedtype, app.pen.myPenId());
        mr.sort(function (a, b) {
            if(a.modified < b.modified) { return 1; }
            if(a.modified > b.modified) { return -1; }
            return 0; });
        feedrevs.forEach(function (fr) {
            //push everything local that's newer and not in server list
            while(mridx < mr.length && 
                      mr[mridx].modhist > fr.modhist &&
                      !frcsv.csvcontains(jt.instId(mr[mridx]))) {
                revs.push(mr[mridx]);
                mridx += 1; }
            revs.push(fr); });
        return revs;
    },


    collateMultiMembics = function (revs) {
        var result = [], j;
        revs.forEach(function (rev, i) {
            if(rev) {  //not previously set to null
                result.push(rev);
                //collate remaining revs
                for(j = i + 1; j < revs.length; j += 1) {
                    if(app.review.isDupeRev(revs[j], rev)) {
                        result.push(revs[j]);
                        revs[j] = null; } } } });
        return result;
    },


    quadImageHTML = function (img, stylestr) {
        var html = "img/nopicprof.png";
        if(img && img.src) {
            html = img.src; }
        html = ["img", {src: html, style: stylestr}];
        return html;
    },


    quadifyImages = function (imgs, stylestr) {
        var quad;
        stylestr = stylestr || "";
        quad = [quadImageHTML(imgs[0], stylestr), 
                quadImageHTML(null, stylestr),
                quadImageHTML(null, stylestr),
                quadImageHTML(imgs[imgs.length - 1], stylestr)];
        if(imgs.length > 2) {
            quad[1] = quadImageHTML(imgs[1], stylestr); }
        if(imgs.length > 3) {
            quad[2] = quadImageHTML(imgs[2], stylestr); }
        return quad;
    },


    writeMultiMembicImageDiv = function (multis, mark) {
        var imgs = [], loaded = true, rid, pd, stylestr, html;
        if(jt.byId("profdivmulti" + jt.instId(multis[0]))) {
            return; }  //already done
        multis.forEach(function (rev) {
            var profdiv, img;
            profdiv = jt.byId("profdiv" + jt.instId(rev));
            if(!profdiv) {  //might not have made screen length cutoff
                loaded = false; }
            else {
                img = profdiv.getElementsByTagName("img");
                img = (img && img.length)? img[0] : null;
                if(img && img.src.indexOf(mark) >= 0) {
                    loaded = false; }
                imgs.push(img); } });
        if(!loaded) {
            return; }
        rid = jt.instId(multis[0]);
        pd = jt.byId("profdiv" + rid);
        stylestr = "max-width:" + Math.floor(pd.offsetWidth / 2) + "px;" +
                   "max-height:" + Math.floor(pd.offsetHeight / 2) + "px;";
        imgs = quadifyImages(imgs, stylestr);
        stylestr = "width:" + pd.offsetWidth + "px;" +
                   "height:" + pd.offsetHeight + "px;" + 
                   "overflow:hidden;";
        html = [["div", {id: "profdivmulti" + rid, 
                         //Don't allow clicking compound images display to
                         //expand. Expectation is that clicking it again will 
                         //unexpand and it links to the profile instead.
                         // onclick: jt.fs("app.activity.toggleExpansion('" + 
                         //                prefix + "','" + rid + "')"),
                         style: stylestr + "display:block;"},
                 [imgs[0], imgs[1], imgs[2], imgs[3]]],
                ["div", {id: "profdivorig" + rid,
                         style: stylestr + "display:none;"},
                 pd.innerHTML]];
        pd.innerHTML = jt.tac2html(html);
    },


    mergeAndDisplayReviews = function (feedtype, revs) {
        var data = jt.objdata({ctype: "Site", parentid: 0,
                               field: "sitev", penid: app.pen.myPenId(),
                               refer: app.refer}), html;
        setTimeout(function () {
            jt.call("POST", "bumpmctr?" + app.login.authparams(), data,
                    function () {
                        app.refer = "";  //only count referrals once
                        jt.log("bumpmctr?" + data + " success"); },
                    function (code, errtxt) {
                        jt.log("bumpctr?" + data + " failed " + 
                               code + ": " + errtxt); }); },
                   300);
        if(urlToRead) {
            if(!app.pen.myPenId()) {
                jt.err("You must be signed in to make a membic from a url parameter."); }
            else {
                setTimeout(function () {
                    app.review.readURL(jt.dec(urlToRead));
                    urlToRead = ""; }, 400); } }
        html = "";
        if(app.pen.myPenId()) {
            lastDisplayFeedtype = feedtype;
            html = [["input", {type: "checkbox", id: "hideminecb",
                               onclick: jt.fsd("app.activity.toggleShowMine()"),
                               checked: jt.toru(hidemine)}],
                    "hide mine"]; }
        html = [["div", {cla: "disptitlediv"}, 
                 ["COMMUNITY MEMBICS ",
                  html,
                  " | ",
                  ["a", {title: "Show recently active themes",
                         href: "#THEMES",
                         onclick: jt.fs("app.activity.displayThemes()")},
                   "THEMES"]]],
                ["div", {id: "feedrevsdiv"}]];
        jt.out("contentdiv", jt.tac2html(html));
        feeds[feedtype] = mergePersonalRecent(feedtype, revs);
        feeds[feedtype] = collateMultiMembics(feeds[feedtype]);
        return app.review.displayReviews("feedrevsdiv", "afd", 
                                         feeds[feedtype],
                                         "app.activity.toggleExpansion",
                                         (hidemine? "notself" : "author"));
    },


    writeThemesFromDisplayMembics = function (membics) {
        var themes = {}, tlist = [], html = [];
        membics.forEach(function (membic) {
            var pts = jt.saferef(membic, "svcdata.?postctms") || [];
            pts.forEach(function (pn) {
                var ctmid = pn.ctmid;
                if(!themes[ctmid]) {
                    themes[ctmid] = {
                        ctmid: ctmid,
                        name: app.coopnames[ctmid] || pn.name,
                        count: 0}; }
                themes[ctmid].count += 1; }); });
        Object.keys(themes).forEach(function (ctmid) { 
            tlist.push(themes[ctmid]); });
        tlist.sort(function (a, b) { return b.count - a.count; });
        tlist.forEach(function (theme) {
            var imgsrc = "ctmpic?coopid=" + theme.ctmid;
            html.push(["div", {cla: "themetilewrapper", 
                               id: "themetile" + theme.ctmid},
                       ["div", {cla: "themetile"}, 
                        ["a", {title: "Open " + theme.name,
                               href: "/t/" + theme.ctmid,
                               onclick: jt.fs("app.activity.selectTheme('" +
                                              theme.ctmid + "')")},
                         [["div", {cla: "themetilepicdiv"},
                           ["img", {cla: "pcdpic", src: imgsrc}]],
                          ["div", {cla: "themetiletitlediv"},
                           theme.name],
                          ["div", {cla: "themetilecountdiv"},
                           theme.count]]]]]); });
        jt.out("themesdiv", jt.tac2html(html));
    },


    noRememberedHintHTML = function () {
        var html = [
            ["p", 
             ["To remember a membic, click its title, then click ",
              ["img", {src: "img/rememberq.png", cla: "intxtico"}],
              " to add it to your memory."]],
            ["p", 
             ["a", {href: "#maindisp",
                    onclick: jt.fs("app.activity.displayFeed('all')")},
              ["Return to community membics",
               ["img", {src: "img/membiclogo.png?v=161205", 
                        cla: "intxtico"}]]]]];
        return html;
    },


    displayActivityPostsWaitMessage = function () {
        var msg;
        msg = "Fetching posts...";
        if(app.login.isLoggedIn()) {
            msg = "Fetching posts according to your preferences..."; }
        app.displayWaitProgress(0, 850, "contentdiv", msg);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    displayFeed: function (feedtype) {
        var params, time;
        app.verifyHome();
        feedtype = feedtype || "all";
        app.layout.displayTypes(app.activity.displayFeed, feedtype);
        app.history.checkpoint({ view: "activity" });
        if(feedmeta.stale && feedmeta.stale < new Date().getTime()) {
            feedmeta.stale = 0;
            feeds = {}; }
        if(feeds[feedtype]) {
            return mergeAndDisplayReviews(feedtype, feeds[feedtype]); }
        displayActivityPostsWaitMessage();
        params = app.login.authparams();
        if(params) {
            params += "&penid=" + app.pen.myPenId() + "&"; }
        params += "revtype=" + feedtype + jt.ts("&cb=","hour");
        time = new Date().getTime();
        jt.call("GET", "revfeed?" + params, null,
                function (reviews) {
                    time = new Date().getTime() - time;
                    jt.log("revfeed returned in " + time/1000 + " seconds.");
                    app.lcs.putAll("rev", reviews);
                    feedmeta.stale = feedmeta.stale || 
                        new Date().getTime() + (60 * 60 * 1000);
                    mergeAndDisplayReviews(feedtype, reviews); },
                app.failf(function (code, errtxt) {
                    jt.out("contentdiv", "revfeed failed code " + code + 
                           ": " + errtxt); }),
                jt.semaphore("activity.displayFeed"));
    },


    displayThemes: function () {
        var html;
        html = [["div", {cla: "disptitlediv"},
                 ["COMMUNITY ",
                  ["a", {title: "Show recent community membics",
                         href: "#COMMUNITY",
                         onclick: jt.fs("app.activity.displayFeed()")},
                   "MEMBICS"],
                  " | ",
                  "THEMES"]],
                ["div", {id: "themesdiv"}]];
        jt.out("contentdiv", jt.tac2html(html));
        writeThemesFromDisplayMembics(feeds.all);
    },


    reinit: function () {
        var rts = app.review.getReviewTypes();
        rts.forEach(function (rt) {
            feeds[rt.type] = null; });
        feeds.all = null;
    },


    redisplay: function () {
        app.activity.reinit();
        app.activity.displayFeed();
    },


    insertOrUpdateRev: function (revs, updrev) {
        var i, inserted, processed;
        processed = [];
        inserted = false;
        //this loop can be rewritten using array methods after findIndex
        //becomes generally available.
        for(i = 0; i < revs.length; i += 1) {
            if(updrev.modhist >= revs[i].modhist && !inserted) {
                processed.push(updrev);
                inserted = true; }
            processed.push(revs[i]); }
        if(!inserted) {  //empty list or older than end of list
            processed.push(updrev); }
        return processed;
    },


    updateFeeds: function (rev) {
        var revid = jt.instId(rev), params,
            feedupdt = ["all", "memo", rev.revtype];
        //review might have changed types, so remove all first
        Object.keys(feeds).forEach(function (feedkey) {
            feeds[feedkey] = feeds[feedkey].filter(function (rev) {
                return jt.instId(rev) !== revid; }); });
        //insert rev appropriately based on creation time
        if(jt.strNonNeg(rev.srcrev) && !jt.isId(rev.ctmid)) {
            //not future, batch, marked as deleted or theme post
            Object.keys(feeds).forEach(function (feedkey) {
                if(feedupdt.indexOf(feedkey) >= 0) {
                    feeds[feedkey] = app.activity.insertOrUpdateRev(
                            feeds[feedkey], rev); }}); }
        //add to future feed if this was a future review
        if(rev.srcrev === "-101") {
            if(feeds.future) {  //already loaded
                feeds.future = app.activity.insertOrUpdateRev(
                    feeds.future, rev); }
            else {
                params = app.login.authparams() + "&penid=" + 
                    app.pen.myPenId() + jt.ts("&cb=", "second");
                jt.call("GET", "fetchprerevs?" + params, null,
                        function (reviews) {
                            app.lcs.putAll("rev", reviews);
                            feeds.future = reviews;
                            feeds.future = app.activity.insertOrUpdateRev(
                                feeds.future, rev); },
                        app.failf(function (code, errtxt) {
                            jt.log("updateRemembered fetchprerevs: " + code + 
                                   ": " + errtxt); }),
                        jt.semaphore("activity.updateRemembered")); }
            feeds.remembered = null; } //force remerge and sort next access
    },


    displayActive: function () {
        app.activity.displayFeed();
    },


    getRememberedMembics: function () {
        var revs = app.review.filterByRevtype(feeds.remembered,
                                              app.layout.getType());
        return revs;
    },


    displayRemembered: function (divid) {
        var params, revs, revids;
        memodiv = divid || memodiv;
        if(!feeds.remembered) {
            if(!feeds.future) {
                jt.out(memodiv, "Fetching future membics...");
                params = app.login.authparams() + "&penid=" + 
                    app.pen.myPenId() + jt.ts("&cb=", "second");
                jt.call("GET", "fetchprerevs?" + params, null,
                        function (reviews) {
                            app.lcs.putAll("rev", reviews);
                            feeds.future = reviews;
                            app.activity.displayRemembered(); },
                        app.failf(function (code, errtxt) {
                            jt.out(memodiv, "Error code: " + code + 
                                   ": " + errtxt); }),
                        jt.semaphore("activity.displayRemembered"));
                return; }
            if(!feeds.memo) { //resolve remembered reviews
                jt.out(memodiv, "Resolving remembered membics...");
                revs = [];
                revids = app.pen.myPenName().remembered.csvarray();
                if(!revids.every(function (cv) {
                    var revref = app.lcs.getRef("rev", cv);
                    if(revref.status === "not cached") {
                        jt.out(memodiv, "Resolving membic " + cv);
                        app.lcs.getFull("rev", cv, 
                                        app.activity.displayRemembered);
                        return false; }
                    if(revref.rev) {
                        revs.push(revref.rev); }
                    return true; })) { 
                    return; }  //not every ref fetched yet
                feeds.memo = revs; }
            jt.out(memodiv, "Merging and sorting...");
            revs = feeds.future.concat(feeds.memo);
            revs.sort(function (a, b) {
                if(a.modified < b.modified) { return 1; }
                if(a.modified > b.modified) { return -1; }
                return 0; });
            feeds.remembered = collateMultiMembics(revs); }
        revs = app.activity.getRememberedMembics();
        app.review.displayReviews(memodiv, "rrd", revs,
                                  "app.activity.toggleExpansion", "author",
                                  noRememberedHintHTML());
    },


    toggleExpansion: function (prefix, revid) {
        var revs;
        if(prefix === "afd") {  //activity feed display
            revs = feeds[app.layout.getType()]; }
        else if(prefix === "rrd") {  //remembered reviews display
            revs = app.review.filterByRevtype(feeds.remembered, 
                                              app.layout.getType()); }
        app.review.toggleExpansion(revs, prefix, revid);
    },


    bootMonitor: function () {
        var revactdiv, html;
        revactdiv = jt.byId("revactdiv");
        if(revactdiv) {
            html = revactdiv.innerHTML;
            if(html.indexOf("Loading ") === 0) {
                bootmon.count += 1; 
                switch(bootmon.count) {
                case 1:
                    html += "<br/>Slow server day...";
                    jt.out("revactdiv", html);
                    bootmon.tout = setTimeout(app.activity.bootMonitor, 2000);
                    return;
                case 2:
                    html += "<br/>...Like really slow...";
                    jt.out("revactdiv", html);
                    bootmon.tout = setTimeout(app.activity.bootMonitor, 2000);
                    return;
                default:
                    html += "<br/><br/>Ok, there's no way this should" +
                        " take this long. <br/>" +
                        "Try hitting the reload button on your browser.";
                    jt.out("revactdiv", html); } } }
    },


    resetRememberedFeed: function () {
        feeds.remembered = null;
        feeds.memo = null;
    },


    resetAllFeeds: function () {
        feeds = {};
    },


    setURLToRead: function (url) {
        urlToRead = url;
    },


    toggleShowMine: function () {
        hidemine = !hidemine;
        app.review.displayReviews("feedrevsdiv", "afd", 
                                  feeds[lastDisplayFeedtype],
                                  "app.activity.toggleExpansion",
                                  (hidemine? "notself" : "author"));
    },


    selectTheme: function (ctmid) {
        var tiles = [], i, tile;
        if(document.querySelectorAll) {
            tiles = document.querySelectorAll(".themetilewrapper") || []; }
        for(i = 0; i < tiles.length; i += 1) {  //no forEach for node list
            tile = tiles[i];
            if(tile.id !== "themetile" + ctmid) {
                tile.style.display = "none"; } }
        app.pcd.display("coop", ctmid);
    },


    indicateMultiMembics: function (revs, mark) {
        var multis = [];
        revs.forEach(function (rev) {
            if(multis.length === 0) {
                multis[0] = rev; }
            else {
                if(app.review.isDupeRev(rev, multis[0])) {
                    multis.push(rev); }
                else if(multis.length === 1) {
                    multis[0] = rev; }
                else { 
                    writeMultiMembicImageDiv(multis, mark);
                    multis = [rev]; } } });
    },


    showMultiMembicImage: function (revid, display) {
        var elem = jt.byId("profdivmulti" + revid);
        if(elem) {
            if(display) {
                elem.style.display = "block";
                jt.byId("profdivorig" + revid).style.display = "none"; }
            else {
                elem.style.display = "none";
                jt.byId("profdivorig" + revid).style.display = "block"; } }
    }



}; //end of returned functions
}());
