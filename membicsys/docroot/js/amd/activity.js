/*global setTimeout, window, document, app, jt */

/*jslint browser, multivar, white, for */

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


    mergeAndDisplayReviews = function (feedtype, revs) {
        var data = jt.objdata({ctype: "Site", parentid: 0,
                               field: "sitev", penid: app.pen.myPenId(),
                               refer: app.refer}), html;
        setTimeout(function () {
            jt.call('POST', "bumpmctr?" + app.login.authparams(), data,
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
        feeds[feedtype] = app.review.collateDupes(feeds[feedtype]);
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
        jt.out('themesdiv', jt.tac2html(html));
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
               ["img", {src: "img/membiclogo.png?v=160824", 
                        cla: "intxtico"}]]]]];
        return html;
    },


    displayActivityPostsWaitMessage = function () {
        var msg;
        msg = "Fetching posts...";
        if(app.login.isLoggedIn()) {
            msg = "Fetching posts according to your preferences..."; }
        app.displayWaitProgress(0, 850, 'contentdiv', msg);
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
        jt.call('GET', "revfeed?" + params, null,
                function (reviews) {
                    time = new Date().getTime() - time;
                    jt.log("revfeed returned in " + time/1000 + " seconds.");
                    app.lcs.putAll("rev", reviews);
                    feedmeta.stale = feedmeta.stale || 
                        new Date().getTime() + (60 * 60 * 1000);
                    mergeAndDisplayReviews(feedtype, reviews); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "revfeed failed code " + code + 
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
        if(rev.srcrev >= 0 && !jt.isId(rev.ctmid)) {  //not futbatch or ctm copy
            Object.keys(feeds).forEach(function (feedkey) {
                if(feedupdt.indexOf(feedkey) >= 0) {
                    feeds[feedkey] = app.activity.insertOrUpdateRev(
                            feeds[feedkey], rev); }}); }
        //add to future feed if this was a future review
        if(rev.srcrev === -101) {
            if(feeds.future) {  //already loaded
                feeds.future = app.activity.insertOrUpdateRev(
                    feeds.future, rev); }
            else {
                params = app.login.authparams() + "&penid=" + 
                    app.pen.myPenId() + jt.ts("&cb=", "second");
                jt.call('GET', "fetchprerevs?" + params, null,
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
                jt.call('GET', "fetchprerevs?" + params, null,
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
            feeds.remembered = app.review.collateDupes(revs); }
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
        revactdiv = jt.byId('revactdiv');
        if(revactdiv) {
            html = revactdiv.innerHTML;
            if(html.indexOf("Loading ") === 0) {
                bootmon.count += 1; 
                switch(bootmon.count) {
                case 1:
                    html += "<br/>Slow server day...";
                    jt.out('revactdiv', html);
                    bootmon.tout = setTimeout(app.activity.bootMonitor, 2000);
                    return;
                case 2:
                    html += "<br/>...Like really slow...";
                    jt.out('revactdiv', html);
                    bootmon.tout = setTimeout(app.activity.bootMonitor, 2000);
                    return;
                default:
                    html += "<br/><br/>Ok, there's no way this should" +
                        " take this long. <br/>" +
                        "Try hitting the reload button on your browser.";
                    jt.out('revactdiv', html); } } }
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
    }


}; //end of returned functions
}());
