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

    feedReviewHTML = function (rev) {
        var revid, prefix, revdivid, html;
        revid = jt.instId(rev);
        prefix = "rdd";
        revdivid = prefix + revid;
        html = ["div", {cla: "fpdiv"},
                [["div", {cla: "fpprofdiv"},
                  ["a", {href: "#view=profile&profid=" + rev.penid,
                         onclick: jt.fs("app.profile.byprofid('" + 
                                        rev.penid + "')")},
                   ["img", {cla: "fpprofpic", 
                            src: "profpic?profileid=" + rev.penid,
                            title: jt.ndq(rev.penname),
                            alt: jt.ndq(rev.penname)}]]],
                 ["div", {cla: "fprevdiv", id: revdivid},
                  app.review.revdispHTML(prefix, revid, rev)]]];
        return html;
    },


    displayFeedReviews = function (feedtype, feedrevs) {
        var type, i, html = [];
        if(!feedrevs || feedrevs.length === 0) {
            if(feedtype === "all") {
                html = "No items found."; }
            else {
                type = app.review.getReviewTypeByValue(feedtype);
                html = "No " + type.plural + " found."; } }
        for(i = 0; i < feedrevs.length; i += 1) {
            html.push(feedReviewHTML(feedrevs[i])); }
        jt.out('feedrevsdiv', jt.tac2html(html));
    },


    displayRemembered = function (filtertype) {
        var params, revs, revids, i, revref;
        jt.out("contentdiv", jt.tac2html(["div", {id: "feedrevsdiv"}]));
        filtertype = filtertype || app.layout.getType();
        if(!feeds.remembered) {
            if(!feeds.future) {
                jt.out('feedrevsdiv', "Fetching future reviews...");
                params = app.login.authparams() + "&penid=" + 
                    app.pen.currPenId();
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
                revids = app.pen.currPenRef().pen.remembered.csvarray();
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
            feeds.remembered = revs; }
        app.layout.displayTypes(displayRemembered, filtertype);
        revs = feeds.remembered;
        if(filtertype && filtertype !== "all") {
            revs = [];
            for(i = 0; i < feeds.remembered.length; i += 1) {
                if(feeds.remembered[i].revtype === filtertype) {
                    revs.push(feeds.remembered[i]); } } }
        displayFeedReviews(filtertype, revs);
    },


    mergePersonalRecent = function (feedtype, feedrevs) {
        var cached, revs, revid, haveAlready, i, j;
        revs = [];
        cached = app.lcs.getCachedRecentReviews(feedtype, app.pen.currPenId());
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
        var penref = app.pen.currPenRef();
        if(!penref) {
            setTimeout(function () {
                app.pen.getPen(function (pen) {
                    mainDisplay(dispmode); }); }, 100);
            return; }
        app.history.checkpoint({ view: dispmode });
        app.login.updateAuthentDisplay();
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
        var revs, params, time;
        feedtype = feedtype || "all";
        app.layout.displayTypes(app.activity.displayFeed, feedtype);
        app.history.checkpoint({ view: "activity" });
        jt.out("contentdiv", jt.tac2html(["div", {id: "feedrevsdiv"}]));
        if(feeds[feedtype]) {
            revs = mergePersonalRecent(feedtype, feeds[feedtype]);
            return displayFeedReviews(feedtype, revs); }
        jt.out('feedrevsdiv', "Fetching posts...");
        params = app.login.authparams();
        if(params) {
            params += "&penid=" + app.pen.currPenId() + "&"; }
        params += "revtype=" + feedtype;
        time = new Date().getTime();
        jt.call('GET', "revfeed?" + params, null,
                function (reviews) {
                    time = new Date().getTime() - time;
                    jt.log("revfeed returned in " + time/1000 + " seconds.");
                    app.lcs.putAll("rev", reviews);
                    feeds[feedtype] = reviews;
                    revs = mergePersonalRecent(feedtype, feeds[feedtype]);
                    displayFeedReviews(feedtype, revs); },
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
        if(rev.srcrev >= 0 && !rev.grpid) {  //not future/batch or group copy
            for(tname in feeds) {
                if(feeds.hasOwnProperty(tname)) {
                    if(tname === "all" || tname === rev.revtype) {
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
        if(app.login.isLoggedIn()) {
            //Do not close the "making introductions" dialog automatically
            //or it gets replaced by the next hint, which looks bad.
            //app.layout.closeDialog();
            mainDisplay("activity"); }
    },


    displayRemembered: function () {
        //Mirror the behavior of displayActive.
        //app.layout.closeDialog();
        mainDisplay("memo");
    },


    resetRememberedFeed: function () {
        feeds.remembered = null;
        feeds.memo = null;
    }


}; //end of returned functions
}());


