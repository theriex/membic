/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . a c t i v i t y
//
define([], function () {
    "use strict";

    var penids, //outbound relationships for the current pen
        revs, 
        lastChecked, 
        actcursor = "",
        actsrchtotal = 0,
        revcache = {},
        badrevids = [],
        dispmode = "activity",  //other value option is "memo"
        activityTitleText = "Recent friend activity",
        rememberedTitleText = "Remembered reviews",


    resetStateVars = function () {
        penids = null;
        revs = null;
        lastChecked = null;
        actcursor = "";
        actsrchtotal = 0;
        revcache = {};
        badrevids = [];
        dispmode = "activity";
    },


    activityLinkHTML = function () {
        var html = "<a href=\"#Activity\"" +
                     " title=\"See what's been posted recently\"" + 
                     " onclick=\"mor.activity.displayActive();" + 
                                "return false;\"" +
            ">" + activityTitleText + "</a>";
        return html;
    },


    rememberedLinkHTML = function () {
        var html = "<a href=\"#Remembered\"" +
                     " title=\"Show remembered reviews\"" +
                     " onclick=\"mor.activity.displayRemembered();" + 
                                "return false;\"" +
            ">" + rememberedTitleText + "</a>";
        return html;
    },


    writeNavDisplay = function () {
        var html, url;
        if(dispmode === "activity") {
            url = "rssact?pen=" + mor.pen.currPenId();
            html = activityTitleText + " " + 
                mor.imglink(url, "Activity RSS Feed",
                            "window.open('" + url + "')", 
                            "rssicon.png", "rssico"); }
        else if(dispmode === "memo") {
            html = rememberedTitleText; }
        mor.out('centerhdiv', html);
    },


    //Do async since setting up the display involves async processing and
    //the browser has a tendency to skip the call.
    penNameSearch = function () {
        setTimeout(function () {
            mor.profile.setTab("search");
            mor.profile.display(); }, 50);
    },


    findReview = function (revid) {
        var i;
        if(revcache[revid]) {
            return revcache[revid]; }
        for(i = 0; revid && revs && i < revs.length; i += 1) {
            if(mor.instId(revs[i]) === revid) {
                return revs[i]; } }
    },


    displayRemembered = function (pen) {
        var i, html, rev, crid, friend, cfid, maxdisp = 50;
        mor.pen.deserializeFields(pen);
        html = "<ul class=\"revlist\">";
        if(!pen.revmem || !pen.revmem.remembered || 
           !pen.revmem.remembered.length) {
            html += "<li>You have not remembered any reviews. If you " +
                "see a review worth remembering, click the \"Remember\" " +
                "button for it and it will show up here.</li>"; }
        else {
            maxdisp = Math.min(maxdisp, pen.revmem.remembered.length);
            for(i = 0; i < maxdisp; i += 1) {
                rev = findReview(pen.revmem.remembered[i]);
                if(!rev) {
                    if(badrevids.indexOf(pen.revmem.remembered[i]) >= 0) {
                        maxdisp += 1; }
                    else {
                        crid = pen.revmem.remembered[i];
                        html += "<li>Fetching Review " + crid + "...</li>";
                        break; } }
                else {
                    if(!rev.penNameStr) {
                        friend = mor.profile.getCachedPen(rev.penid);
                        if(friend) {
                            rev.penNameStr = friend.name; } }
                    if(!rev.penNameStr) {
                        cfid = rev.penid;
                        html += "<li>Fetching Pen Name " + cfid + "...</li>";
                        break; }
                    html += mor.profile.reviewItemHTML(rev, 
                                                       rev.penNameStr); } } }
        html += "</ul>";
        mor.out('revactdiv', html);
        mor.layout.adjust();
        if(crid) {
            setTimeout(function () {
                mor.call("revbyid?revid=" + crid, 'GET', null,
                         function (revs) {
                             mor.activity.cacheReview(revs[0]);
                             mor.activity.display(); },
                         function (code, errtxt) {
                             mor.log("displayRemembered revbyid " + crid +
                                     " " + code + " " + errtxt);
                             badrevids.push(crid); },
                         [ 404 ]); },
                       50); }
        if(cfid) {
            setTimeout(function () {
                mor.profile.retrievePen(cfid, mor.activity.display); },
                       50); }
    },


    displayReviewActivity = function () {
        var i, breakid, html = "<ul class=\"revlist\">";
        if(revs.length === 0) {
            html += "<li>No review activity</li>"; }
        for(i = 0; i < revs.length; i += 1) {
            html += mor.profile.reviewItemHTML(revs[i], revs[i].penNameStr);
            if(!revs[i].penNameStr) {
                breakid = revs[i].penid;
                break; } }
        if(breakid) {
            setTimeout(function () {
                mor.profile.retrievePen(breakid, 
                                        mor.activity.notePenNameStr); },
                       50); }
        html += "</ul>";
        if(actcursor) {
            html += "<a href=\"#moreact\"" +
                " onclick=\"mor.activity.moreact();return false;\"" +
                " title=\"More activity\"" + ">more activity...</a>"; }
        mor.out('revactdiv', html);
        mor.layout.adjust();
    },


    notePenNameStr = function (pen) {
        var i, pid = mor.instId(pen);
        for(i = 0; i < revs.length; i += 1) {
            if(revs[i].penid === pid) {
                revs[i].penNameStr = pen.name; } }
        displayReviewActivity();
    },


    //The outbound relationships are loaded at this point, otherwise
    //the pen ids would not have been available for the query.  If
    //saving review activity to local storage, the relationships will
    //also have to be saved.
    filtered = function (rev) {
        var rel = mor.rel.outbound(rev.penid);
        if(rev.rating < rel.cutoff) {
            return true; }
        if(rel.mute && rel.mute.indexOf(rev.revtype >= 0)) {
            return true; }
        return false;
    },


    collectAndDisplayReviewActivity = function (results, continued) {
        var i;
        if(!continued) { //prepend latest results
            for(i = 0; i < results.length; i += 1) {
                if(!results[i].fetched && !filtered(results[i])) {
                    revs.unshift(results[i]); } } }
        else { //append results and track cursor (if any)
            actcursor = "";
            for(i = 0; i < results.length; i += 1) {
                if(results[i].fetched) {
                    actsrchtotal += results[i].fetched;
                    if(results[i].cursor) {
                        actcursor = results[i].cursor;  } }
                else if(!filtered(results[i])) {
                    revs.push(results[i]); } } }
        if(actcursor && revs.length === 0) {
            //auto find more activity without creating a recursion stack
            setTimeout(mor.activity.moreact, 10); }
        displayReviewActivity();
    },


    doActivitySearch = function (continued) {
        var time, params = "penids=" + penids.join(',');
        if(!continued && lastChecked) {
            params += "&since=" + lastChecked.toISOString(); }
        if(continued) {
            params += "&cursor=" + actcursor; }
        time = new Date().getTime();
        mor.call("revact?" + params, 'GET', null,
                 function (results) {
                     time = new Date().getTime() - time;
                     mor.log("revact returned in " + time/1000 + " seconds.");
                     lastChecked = new Date();
                     collectAndDisplayReviewActivity(results, continued); },
                 function (code, errtxt) {
                     mor.out('revactdiv', "error code: " + code + " " + 
                             errtxt); });
    },


    searchPensLinkHTML = function () {
        var html = "<a href=\"#searchpens\"" +
                     " onclick=\"mor.activity.searchpens();return false;\"" +
            ">Search pen names</a>";
        return html;
    },


    bootActivityDisplay = function () {
        var html, retry = false;
        writeNavDisplay();
        penids = mor.rel.outboundids();
        if(penids.length === 0) {
            html = "You are not following anyone. " + 
                searchPensLinkHTML(); }
        else if((penids[penids.length - 1] === "waiting") ||
                (penids[penids.length - 1] === "loading")) {
            retry = true;
            html = "Loading relationships..."; }
        else {
            revs = [];
            html = "Loading activity..."; }
        mor.out('revactdiv', html);
        mor.layout.adjust();
        if(revs) {
            doActivitySearch(true); }
        if(retry) {
            setTimeout(bootActivityDisplay, 500); }
    },


    verifyCoreDisplayElements = function () {
        var html, domelem = mor.byId('revactdiv');
        if(!domelem) {
            html = "<div id=\"revactdiv\"></div>";
            if(!mor.byId('cmain')) {
                mor.layout.initContent(); }
            mor.out('cmain', html); }
    },


    mainDisplay = function (pen) {
        //ATTENTION: read revs from local storage..
        mor.historyCheckpoint({ view: "activity" });
        writeNavDisplay();
        verifyCoreDisplayElements();
        if(dispmode === "memo") {
            displayRemembered(pen); }
        else if(revs) {
            displayReviewActivity();
            doActivitySearch(); }
        else {
            bootActivityDisplay(); }
    };

    
    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            writeNavDisplay(); },
        searchpens: function () {
            penNameSearch(); },
        moreact: function () {
            doActivitySearch(); },
        notePenNameStr: function (pen) {
            notePenNameStr(pen); },
        findReview: function (revid) {
            return findReview(revid); },
        cacheReview: function (rev) {
            revcache[mor.instId(rev)] = rev; },
        searchPensLinkHTML: function () {
            return searchPensLinkHTML(); },
        activityLinkHTML: function () {
            return activityLinkHTML(); },
        rememberedLinkHTML: function () {
            return rememberedLinkHTML(); },
        displayActive: function () {
            dispmode = "activity";
            mor.pen.getPen(mainDisplay); },
        displayRemembered: function () {
            dispmode = "memo";
            mor.pen.getPen(mainDisplay); }
    };

});

