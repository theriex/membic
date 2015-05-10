/*global setTimeout: false, window: false, document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display of recent posts from friends, remembered posts, and
// searching for pen names to follow.  Cached data off the current pen:
//
//   penref.actdisp:
//     revrefs: array of cached posts, most recent first
//     lastChecked: timestamp when recent posts were last fetched
//     cursor: cursor for continuing to load more activity
//     reps: obj for tracking display of extra posts per person per day
//
//   penref.pensearch:
//     params: parameters for search
//     pens: found pens 
//     cursor: cursor for continuing to load more matching pens
//     total: count of records searched so far
//     reqs: count of times the search was manually requested
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
        var params, revs, revids, i, revref;
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
                for(i = 0; i < revids.length; i += 1) {
                    revref = app.lcs.getRef("rev", revids[i]);
                    if(revref.status === "not cached") {
                        jt.out('feedrevsdiv', "Resolving membic " + revids[i]);
                        return app.lcs.getFull("rev", revids[i], 
                                               displayRemembered); }
                    if(revref.rev) {
                        revs.push(revref.rev); } }
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
        var cached, revs, revid, haveAlready, i, j;
        revs = [];
        cached = app.lcs.getCachedRecentReviews(feedtype, app.pen.myPenId());
        for(i = 0; i < cached.length; i += 1) {
            revid = jt.instId(cached[i]);
            haveAlready = false;
            for(j = 0; j < feedrevs.length; j += 1) {
                if(jt.instId(feedrevs[j]) === revid) {
                    haveAlready = true;
                    break; } }
            if(!haveAlready) {
                revs.push(cached[i]); } }
        revs = revs.concat(feedrevs);
        revs.sort(function (a, b) {
            if(a.modhist < b.modhist) { return 1; }
            if(a.modhist > b.modhist) { return -1; }
            return 0; });
        return revs;
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
        jt.out("contentdiv", jt.tac2html(["div", {id: "feedrevsdiv"}]));
        if(feeds[feedtype]) {
            feeds[feedtype] = mergePersonalRecent(feedtype, feeds[feedtype]);
            feeds[feedtype] = app.review.collateDupes(feeds[feedtype]);
            return app.review.displayReviews("feedrevsdiv", "afd", 
                                             feeds[feedtype],
                                             "app.activity.toggleExpansion",
                                             "author"); }
        jt.out('feedrevsdiv', "Fetching posts...");
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
                    feeds[feedtype] = mergePersonalRecent(feedtype, reviews);
                    feeds[feedtype] = app.review.collateDupes(feeds[feedtype]);
                    app.review.displayReviews("feedrevsdiv", "afd", 
                                              feeds[feedtype],
                                              "app.activity.toggleExpansion",
                                              "author"); },
                app.failf(function (code, errtxt) {
                    jt.out('feedrevsdiv', "error code: " + code + 
                           " " + errtxt); }),
                jt.semaphore("activity.displayFeed"));
    },


    updateFeeds: function (rev) {
        var revid, tname, revs, i, inserted, processed;
        revid = jt.instId(rev);
        //review might have changed types, so remove all first
        for(tname in feeds) {
            if(feeds.hasOwnProperty(tname)) {
                if(feeds[tname]) {  //extended tnames like memo may be null
                    revs = feeds[tname];
                    processed = [];
                    for(i = 0; i < revs.length; i += 1) {
                        if(jt.instId(revs[i]) !== revid) {
                            processed.push(revs[i]); } }
                    feeds[tname] = processed; } } }
        //insert rev appropriately based on creation time
        if(rev.srcrev >= 0 && !jt.isId(rev.grpid)) {  //not futbatch or grp copy
            for(tname in feeds) {
                if(feeds.hasOwnProperty(tname)) {
                    if(tname === "all" || tname === "memo" ||
                           tname === rev.revtype ) {
                        revs = feeds[tname];
                        processed = [];
                        inserted = false;
                        for(i = 0; i < revs.length; i += 1) {
                            if(rev.modhist >= revs[i].modhist && !inserted) {
                                processed.push(rev);
                                inserted = true; }
                            processed.push(revs[i]); }
                        feeds[tname] = processed; } } } }
        //might have been future before, or is future now.  Rebuild.
        if(feeds.future) {  //don't modify unless already initialized
            revs = feeds.future;
            processed = [];
            for(i = 0; i < revs.length; i += 1) {
                if(jt.instId(revs[i]) !== revid) {
                    processed.push(revs[i]); } }
            feeds.future = processed;
            if(rev.srcrev === -101) {
                revs = feeds.future;
                processed = [];
                inserted = false;
                for(i = 0; i < revs.length; i += 1) {
                    if(rev.modhist >= revs[i].modhist && !inserted) {
                        processed.push(rev);
                        inserted = true; }
                    processed.push(revs[i]); }
                feeds.future = processed; }
            feeds.remembered = null; } //trigger remerge and sort
    },


    displayActive: function () {
        mainDisplay("activity");
    },


    displayRemembered: function () {
        mainDisplay("memo");
    },


    feedReviewHTML: function (prefix, rev, hide, togcbn) {
        var revid, revdivid, maindivattrs, html;
        revid = jt.instId(rev);
        revdivid = prefix + revid;
        maindivattrs = {id: revdivid + "fpdiv", cla: "fpdiv"};
        if(hide) {
            maindivattrs.style = "display:none"; }
        html = ["div", maindivattrs,
                [["div", {cla: "fpprofdiv"},
                  ["a", {href: "#view=pen&penid=" + rev.penid,
                         onclick: jt.fs("app.pen.bypenid('" + 
                                        rev.penid + "')")},
                   ["img", {cla: "fpprofpic", 
                            src: "profpic?profileid=" + rev.penid,
                            title: jt.ndq(rev.penname),
                            alt: jt.ndq(rev.penname)}]]],
                 ["div", {cla: "fprevdiv", id: revdivid},
                  app.review.revdispHTML(prefix, revid, rev, togcbn)]]];
        return html;
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
    }


}; //end of returned functions
}());


