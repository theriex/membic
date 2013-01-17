/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . a c t i v i t y
//
define([], function () {
    "use strict";

    var penids, 
        revs, 
        lastChecked, 
        actcursor = "",
        actsrchtotal = 0,


    resetStateVars = function () {
        penids = null;
        revs = null;
        lastChecked = null;
        actcursor = "";
        actsrchtotal = 0;
    },


    writeNavDisplay = function () {
        var html = "<a href=\"#Activity\"" +
                     " title=\"See what's been posted recently\"" + 
                     " onclick=\"mor.activity.display();return false;\"" +
            ">Activity</a>";
        mor.out('acthdiv', html);
        mor.byId('acthdiv').style.visibility = "visible";
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
        for(i = 0; revid && revs && i < revs.length; i += 1) {
            if(mor.instId(revs[i]) === revid) {
                return revs[i]; } }
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
        var params = "penids=" + penids.join(',');
        if(!continued && lastChecked) {
            params += "&since=" + lastChecked.toISOString(); }
        if(continued) {
            params += "&cursor=" + actcursor; }
        mor.call("revact?" + params, 'GET', null,
                 function (results) {
                     lastChecked = new Date();
                     collectAndDisplayReviewActivity(results, continued); },
                 function (code, errtxt) {
                     mor.out('revactdiv', "error code: " + code + " " + 
                             errtxt); });
    },


    bootActivityDisplay = function () {
        var html, retry = false;
        penids = mor.rel.outboundids();
        if(penids.length === 0) {
            html = "You are not following anyone." + 
                " <a href=\"#searchpens\"" +
                " onclick=\"mor.activity.searchpens();return false;\"" +
                ">Search pen names</a>"; }
        else if(typeof penids[penids.length - 1] !== 'number') {
            //most likely penids === ["loading"]...
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
            mor.out('cmain', html); }
    },


    mainDisplay = function (pen) {
        //ATTENTION: read revs from local storage..
        mor.historyCheckpoint({ view: "activity" });
        verifyCoreDisplayElements();
        if(revs) {
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
            return findReview(revid); }
    };

});

