/*global setTimeout, window, document, app, jt */

/*jslint white for */

//////////////////////////////////////////////////////////////////////
// Display of recent posts from friends, remembered posts.  
//

app.activity = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var feeds = {},
        bootmon = { tout: null, count: 0 },


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayRemembered = function (filtertype) {
        var params, revs, revids;
        jt.out("contentdiv", jt.tac2html(["div", {id: "feedrevsdiv"}]));
        filtertype = filtertype || app.layout.getType();
        if(!feeds.remembered) {
            if(!feeds.future) {
                jt.out('feedrevsdiv', "Fetching future reviews...");
                params = app.login.authparams() + "&penid=" + 
                    app.pen.myPenId();
                jt.call('GET', "fetchprerevs?" + params, null,
                        function (reviews) {
                            app.lcs.putAll("rev", reviews);
                            feeds.future = reviews;
                            displayRemembered(); },
                        app.failf(function (code, errtxt) {
                            jt.out('feedrevsdiv', "Error code: " + code + 
                                   ": " + errtxt); }),
                        jt.semaphore("activity.displayRemembered"));
                return; }
            if(!feeds.memo) { //resolve remembered reviews
                jt.out('feedrevsdiv', "Resolving remembered reviews...");
                revs = [];
                revids = app.pen.myPenName().remembered.csvarray();
                if(!revids.every(function (cv) {
                    var revref = app.lcs.getRef("rev", cv);
                    if(revref.status === "not cached") {
                        jt.out('feedrevsdiv', "Resolving membic " + cv);
                        app.lcs.getFull("rev", cv, displayRemembered);
                        return false; }
                    if(revref.rev) {
                        revs.push(revref.rev); }
                    return true; })) { 
                    return; }  //not every ref fetched yet
                feeds.memo = revs; }
            jt.out('feedrevsdiv', "Merging and sorting...");
            revs = feeds.future.concat(feeds.memo);
            revs.sort(function (a, b) {
                if(a.modified < b.modified) { return 1; }
                if(a.modified > b.modified) { return -1; }
                return 0; });
            feeds.remembered = app.review.collateDupes(revs); }
        app.layout.displayTypes(displayRemembered, filtertype);
        revs = app.review.filterByRevtype(feeds.remembered, filtertype);
        app.review.displayReviews("feedrevsdiv", "rrd", revs,
                                  "app.activity.toggleExpansion", "author",
                                  "Click the main icon, then click the remember button for any membic you want to keep in your memory.");
    },


    mergePersonalRecent = function (feedtype, feedrevs) {
        var cached, revid;
        cached = app.lcs.getCachedRecentReviews(feedtype, app.pen.myPenId());
        //non-destructively merge in recent stuff without negatively
        //impacting the existing server sort order.
        cached.forEach(function (cacheval, cacheidx) {
            revid = jt.instId(cacheval);
            feedrevs.every(function (feedrev) {
                if(jt.instId(feedrev) === revid) {
                    return false; }  //already have the value, done iterating
                if(feedrev.modhist < cacheval.modhist) {
                    feedrevs.splice(cacheidx, 0, cacheval);
                    return false; }  //new value inserted, done iterating
                return true; });  //continue iterating
            //If no existing reviews, prepend the value.
            if(!feedrevs.length) {
                feedrevs.splice(0, 0, cacheval); } });
        return feedrevs;
    },


    bootMonitor = function () {
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
                    bootmon.tout = setTimeout(bootMonitor, 2000);
                    return;
                case 2:
                    html += "<br/>...Like really slow...";
                    jt.out('revactdiv', html);
                    bootmon.tout = setTimeout(bootMonitor, 2000);
                    return;
                default:
                    html += "<br/><br/>Ok, there's no way this should" +
                        " take this long. <br/>" +
                        "Try hitting the reload button on your browser.";
                    jt.out('revactdiv', html); } } }
    },


    mergeAndDisplayReviews = function (feedtype, revs) {
        jt.out("contentdiv", jt.tac2html(["div", {id: "feedrevsdiv"}]));
        feeds[feedtype] = mergePersonalRecent(feedtype, revs);
        feeds[feedtype] = app.review.collateDupes(feeds[feedtype]);
        return app.review.displayReviews("feedrevsdiv", "afd", 
                                         feeds[feedtype],
                                         "app.activity.toggleExpansion",
                                         "author");
    },


    mainDisplay = function (dispmode) {
        app.history.checkpoint({ view: dispmode });
        if(dispmode === "memo") {
            displayRemembered(); }
        else {  //dispmode === "activity", activityMode === "amnew"
            app.activity.displayFeed(); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    displayFeed: function (feedtype) {
        var params, time;
        feedtype = feedtype || "all";
        app.layout.displayTypes(app.activity.displayFeed, feedtype);
        app.history.checkpoint({ view: "activity" });
        if(feeds[feedtype]) {
            return mergeAndDisplayReviews(feedtype, feeds[feedtype]); }
        jt.out('contentdiv', "Fetching posts...");
        if(app.login.isLoggedIn()) {
            jt.out('contentdiv', 
                   "Fetching posts according to your preferences..."); }
        params = app.login.authparams();
        if(params) {
            params += "&penid=" + app.pen.myPenId() + "&"; }
        params += "revtype=" + feedtype;
        time = new Date().getTime();
        jt.call('GET', "revfeed?" + params, null,
                function (reviews) {
                    time = new Date().getTime() - time;
                    jt.log("revfeed returned in " + time/1000 + " seconds.");
                    app.lcs.putAll("rev", reviews);
                    mergeAndDisplayReviews(feedtype, reviews); },
                app.failf(function (code, errtxt) {
                    jt.out('feedrevsdiv', "error code: " + code + 
                           " " + errtxt); }),
                jt.semaphore("activity.displayFeed"));
    },


    redisplay: function () {
        var rts = app.review.getReviewTypes();
        rts.forEach(function (rt) {
            feeds[rt.type] = null; });
        feeds.all = null;
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
        var revid = jt.instId(rev), feedupdt = ["all", "memo", rev.revtype];
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
            feeds.future = app.activity.insertOrUpdateRev(
                feeds.future, rev);
            feeds.remembered = null; } //trigger remerge and sort
    },


    displayActive: function () {
        mainDisplay("activity");
    },


    displayRemembered: function () {
        mainDisplay("memo");
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


    resetRememberedFeed: function () {
        feeds.remembered = null;
        feeds.memo = null;
    },


    resetAllFeeds: function () {
        feeds = {};
    }


}; //end of returned functions
}());


