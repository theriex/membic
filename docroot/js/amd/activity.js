/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . a c t i v i t y
//
// Display of recent reviews from friends, remembered reviews, and
// searching for pen names to follow.  Cached data off the current pen:
//
//   penref.actdisp:
//     revrefs: array of cached reviews, most recent first
//     lastChecked: timestamp when recent reviews were last fetched
//     cursor: cursor for continuing to load more activity
//
//   penref.pensearch:
//     params: parameters for search
//     pens: found pens 
//     cursor: cursor for continuing to load more matching pens
//     total: count of records searched so far
//     reqs: count of times the search was manually requested
//

define([], function () {
    "use strict";

    var pensearchmax = 1000,  //max records to read through automatically


    activityLinkHTML = function () {
        var html = "<div class=\"topnavitemdiv\">" +
            mor.imgntxt("friendact.png", "Friend Reviews",
                        "mor.activity.displayActive()",
                        "#Activity",
                        "See what's been posted recently") +
            "</div>";
        return html;
    },


    rememberedLinkHTML = function () {
        var html = "<div class=\"topnavitemdiv\">" +
            mor.imgntxt("remembered.png", "Remembered Reviews",
                        "mor.activity.displayRemembered()",
                        "#Remembered",
                        "Show remembered reviews") +
            "</div>";
        return html;
    },


    writeNavDisplay = function (dispmode) {
        var html, url;
        if(dispmode === "activity") {
            url = "rssact?pen=" + mor.pen.currPenId();
            html = "New reviews from friends " + 
                mor.imglink(url, "RSS feed for recent friend reviews",
                            "window.open('" + url + "')", 
                            "rssicon.png", "rssico"); }
        else if(dispmode === "memo") {
            html = "Remembered reviews"; }
        mor.out('centerhdiv', html);
    },


    searchOptionsHTML = function () {
        var html = "<div id=\"searchoptionsdiv\" class=\"formstyle\">" +
            "<i>Must have reviewed their top 20</i>" +
            mor.review.reviewTypeCheckboxesHTML("reqmin") +
            "<i>Must have been active within the past</i>&nbsp;" + 
            "<select id=\"srchactivesel\">" +
              "<option id=\"whenever\">Whenever</option>" +
              "<option id=\"pastyear\" selected=\"selected\">Year</option>" +
              "<option id=\"pastmonth\">Month</option>" +
              "<option id=\"pastweek\">Week</option>" +
            "</select>" +
            "<br/>" +
            "<i>Include</i>&nbsp;" + 
            mor.checkbox("srchinc", "following") +
            mor.checkbox("srchinc", "blocked") +
            mor.checkbox("srchinc", "lurkers") +
            " <i> in the search results</i>" +
            "<br/>&nbsp;<br/></div>";
        return html;
    },


    penNameSearchDialog = function () {
        var html;
        html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"mor.layout.closeDialog();return false;\"" +
            ">&lt;close&nbsp;&nbsp;X&gt;</a></div>" + 
            "<div class=\"floatclear\"></div>" +
            "<div class=\"headingtxt\">" + 
            "Find pen names to follow</div>" +
            "<table class=\"searchtable\">" +
            "<tr>" +
              "<td class=\"formstyle\">" + 
                "<input type=\"text\" id=\"searchtxt\" size=\"40\"" +
                      " placeholder=\"Pen name, city, or profile comment...\"" +
                      " onchange=\"mor.activity.startPenSearch();" + 
                                  "return false;\"" +
                      " value=\"\"/></td>" +
              "<td class=\"formstyle\">" +
                "<span id=\"srchbuttonspan\">" +
                  "<button type=\"button\" id=\"searchbutton\"" + 
                         " onclick=\"mor.activity.startPenSearch();" + 
                                    "return false;\"" + 
                    ">Search</button></span></td></tr>" + 
            "<tr>" +
              "<td class=\"formstyle\" colspan=\"2\">" +
                "<span id=\"srchoptstoggle\" class=\"formstyle\">" + 
                  "<a href=\"#searchoptions\"" +
                    " id=\"srchoptstogglehref\"" +
                    " title=\"search options\"" +
                    " onclick=\"mor.activity.togglesrchopts();return false;\"" +
                  ">show advanced search options</a></span></td></tr>" +
            "</table>" + searchOptionsHTML() +
            "<div id=\"searchresults\"></div>";
        mor.out('dlgdiv', html);
        mor.byId('dlgdiv').style.visibility = "visible";
        if(mor.isLowFuncBrowser()) {
            mor.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        mor.onescapefunc = mor.layout.closeDialog;
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.byId('searchtxt').focus();
    },


    toggleSearchOptions = function () {
        var sod = mor.byId('searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                mor.out('srchoptstogglehref', "hide advanced search options");
                sod.style.display = "block"; }
            else {
                mor.out('srchoptstogglehref', "show advanced search options");
                sod.style.display = "none"; } }
        mor.layout.adjust();
    },


    //When searching pen names, the server handles the "active since"
    //restriction by checking the "accessed" field, and the "top 20"
    //restriction by looking through those, however it does not
    //handle joins across relationships due to indexing overhead, so
    //those are filtered out here.
    penSearchFiltered = function (searchitem) {
        var params, pen, rel;
        params = mor.pen.currPenRef().pensearch.params;
        pen = searchitem;
        rel = mor.rel.outbound(mor.instId(pen));
        if(rel) {
            if(params.includeFollowing && rel.status === "following") {
                return false; }
            if(params.includeBlocked && rel.status === "blocked") {
                return false; }
            return true; }
        return false;
    },


    displayPenSearchResults = function (results) {
        var pensearch, i, html;
        pensearch = mor.pen.currPenRef().pensearch;
        html = "<ul class=\"penlist\">";
        for(i = 0; i < pensearch.pens.length; i += 1) {
            html += mor.profile.penListItemHTML(pensearch.pens[i]); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        pensearch.cursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                pensearch.total += results[i].fetched;
                html += "<div class=\"sumtotal\">" + 
                    pensearch.total + " pen names searched</div>";
                if(results[i].cursor) {
                    pensearch.cursor = results[i].cursor; }
                break; }  //if no results, i will be left at zero
            if(!penSearchFiltered(results[i])) {
                mor.lcs.putPen(results[i]);
                pensearch.pens.push(results[i]);
                html += mor.profile.penListItemHTML(results[i]); } }
        if(pensearch.pens.length === 0) {
            html += "<div class=\"sumtotal\">No pen names found</div>"; }
        html += "</ul>";
        if(pensearch.cursor) {
            if(i === 0 && pensearch.total < (pensearchmax * pensearch.reqs)) {
                setTimeout(mor.activity.searchPens, 10); }  //auto-repeat search
            else {
                if(pensearch.total >= (pensearchmax * pensearch.reqs)) {
                    pensearch.reqs += 1; } 
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"mor.activity.searchPens();" + 
                                     "return false;\"" +
                          " title=\"Continue searching for more pen names\"" +
                    ">continue search...</a>"; } }
        mor.out('searchresults', html);
        mor.byId("searchbutton").disabled = false;
    },


    readSearchParamsFromForm = function () {
        var pensearch, checkboxes, options, i, t20type, since;
        pensearch = mor.pen.currPenRef().pensearch;
        pensearch.params.reqmin = [];
        checkboxes = document.getElementsByName("reqmin");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                t20type = mor.review.getReviewTypeByValue(checkboxes[i].value);
                pensearch.params.reqmin.push(t20type.type); } }
        options = mor.byId('srchactivesel').options;
        for(i = 0; i < options.length; i += 1) {
            if(options[i].selected) {
                switch(options[i].id) {
                case 'pastweek':
                    since = 7; break;
                case 'pastmonth':
                    since = 30; break;
                case 'pastyear':
                    since = 365; break;
                case 'whenever':
                    since = -1; break; }
                break; } }
        pensearch.params.activeDaysAgo = since;
        pensearch.params.includeFollowing = false;
        pensearch.params.includeBlocked = false;
        pensearch.params.includeLurkers = false;
        checkboxes = document.getElementsByName("srchinc");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(checkboxes[i].value === 'following') {
                    pensearch.params.includeFollowing = true; }
                if(checkboxes[i].value === 'blocked') {
                    pensearch.params.includeBlocked = true; } 
                if(checkboxes[i].value === 'lurkers') {
                    pensearch.params.includeLurkers = true; } } }
    },


    searchPens = function () {
        var pensearch, params, qstr, time, t20, i, critsec = "";
        pensearch = mor.pen.currPenRef().pensearch;
        readSearchParamsFromForm();
        mor.out('srchoptstogglehref', "show advanced search options");
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.byId("searchbutton").disabled = true;
        qstr = mor.byId('searchtxt').value;
        params = mor.login.authparams() + "&qstr=" + mor.enc(qstr) +
            "&cursor=" + mor.enc(pensearch.cursor);
        if(pensearch.params.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= pensearch.params.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + mor.enc(time); }
        if(pensearch.params.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < pensearch.params.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += pensearch.params.reqmin[i]; }
            params += "&t20=" + mor.enc(t20); }
        if(pensearch.params.includeLurkers) {
            params += "&lurkers=include"; }
        mor.call("srchpens?" + params, 'GET', null,
                 function (results) {
                     displayPenSearchResults(results); },
                 function (code, errtxt) {
                     mor.out('searchresults', 
                             "error code: " + code + " " + errtxt); },
                 critsec);
    },


    startPenSearch = function () {
        mor.pen.currPenRef().pensearch = {
            params: {},
            pens: [],
            cursor: "",
            total: 0,
            requests: 1 };
        searchPens();
    },


    displayRemembered = function (pen) {
        var i, html, revref, crid, friend, cfid, maxdisp = 50, hint;
        hint = "If you see a review worth remembering, click its " + 
            "\"Remember\" button to keep a reference to it here.";
        mor.pen.deserializeFields(pen);
        html = "<ul class=\"revlist\">";
        if(!pen.revmem || !pen.revmem.remembered || 
           !pen.revmem.remembered.length) {
            html += "<li>You have not remembered any reviews. " + hint + 
                "</li>"; }
        else {
            maxdisp = Math.min(maxdisp, pen.revmem.remembered.length);
            for(i = 0; i < maxdisp; i += 1) {
                revref = mor.lcs.getRevRef(pen.revmem.remembered[i]);
                if(revref.status !== "ok" && revref.status !== "not cached") {
                    maxdisp += 1; }  //ignore deleted review
                else {
                    if(!revref.rev) {
                        crid = pen.revmem.remembered[i];
                        html += "<li>Fetching Review " + crid + "...</li>";
                        break; }
                    if(!revref.rev.penNameStr) {
                        friend = mor.lcs.getPenRef(revref.rev.penid).pen;
                        if(friend) {
                            revref.rev.penNameStr = friend.name; } }
                    if(!revref.rev.penNameStr) {
                        cfid = revref.rev.penid;
                        html += "<li>Fetching Pen Name " + cfid + "...</li>";
                        break; }
                    html += mor.profile.reviewItemHTML(revref.rev, 
                                                revref.rev.penNameStr); } } }
        if(i === maxdisp && maxdisp < 3) {  //after 3 times they should get it
            html += "<li></li><li>" + hint + "</li>"; }
        html += "</ul>";
        mor.out('revactdiv', html);
        mor.layout.adjust();
        if(crid) {
            mor.lcs.getRevFull(crid, mor.activity.displayRemembered); }
        if(cfid) {
            setTimeout(function () {
                mor.lcs.getPenFull(cfid, function (penref) {
                    mor.activity.displayRemembered(penref.pen); }); },
                       50); }
    },


    moreRevsFromHTML = function (rev) {
        var html = "<li>" + "<div class=\"morerevs\">" +
            "<a href=\"#" + mor.objdata({ view: "profile", 
                                          profid: rev.penid }) + "\"" +
              " onclick=\"mor.profile.byprofid('" + rev.penid + 
                                               "', 'recent');" +
                         "return false;\"" +
              " title=\"Show recent reviews from " + 
                        mor.ndq(rev.penNameStr) + "\"" + 
            ">" + "more reviews from " +
                mor.ndq(rev.penNameStr) + " on " + 
                mor.colloquialDate(mor.ISOString2Day(rev.modified)) +
            "</a></div></li>";
        return html;
    },


    displayReviewActivity = function () {
        var actdisp, revrefs, rev, i, breakid, html, key, reps = {};
        html = "<ul class=\"revlist\">";
        actdisp = mor.pen.currPenRef().actdisp;
        revrefs = actdisp.revrefs;
        if(revrefs.length === 0) {
            html += "<li>None of the people you are following have posted any reviews recently.</li>"; }
        for(i = 0; i < revrefs.length; i += 1) {
            rev = revrefs[i].rev;
            key = rev.modified.slice(0, 10) + rev.penid;
            if(!reps[key] || reps[key] < 2) {  //display 2 revs/day/pen
                reps[key] = (reps[key] || 0) + 1;
                html += mor.profile.reviewItemHTML(rev, rev.penNameStr); }
            else {
                reps[key] += 1;
                if(reps[key] === 3) {
                    html += moreRevsFromHTML(rev); } }
            if(!rev.penNameStr) {
                breakid = rev.penid;
                break; } }
        if(breakid) {
            setTimeout(function () {
                mor.lcs.getPenFull(breakid, function (penref) {
                    mor.activity.notePenNameStr(penref.pen); }); },
                       50); }
        html += "</ul>";
        if(actdisp.cursor) {
            html += "<a href=\"#moreact\"" +
                " onclick=\"mor.activity.moreact();return false;\"" +
                " title=\"More activity\"" + ">more activity...</a>"; }
        mor.out('revactdiv', html);
        mor.layout.adjust();
    },


    notePenNameStr = function (pen) {
        var i, pid, revrefs;
        revrefs = mor.pen.currPenRef().actdisp.revrefs;
        pid = mor.instId(pen);
        for(i = 0; i < revrefs.length; i += 1) {
            if(revrefs[i].rev.penid === pid) {
                revrefs[i].rev.penNameStr = pen.name; } }
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
        if(rel.mute && rel.mute.indexOf(rev.revtype) >= 0) {
            return true; }
        return false;
    },


    collectAndDisplayReviewActivity = function (results, continued) {
        var i, actdisp, revref;
        actdisp = mor.pen.currPenRef().actdisp;
        if(!continued) { //prepend latest results
            for(i = results.length - 1; i >= 0; i -= 1) {
                if(results[i].fetched) {
                    if(results[i].cursor) {
                        actdisp.cursor = results[i].cursor;  } }
                else if(!filtered(results[i])) {
                    revref = mor.lcs.putRev(results[i]);
                    actdisp.revrefs.unshift(revref); } } }
        else { //append results and track cursor (if any)
            actdisp.cursor = "";
            for(i = 0; i < results.length; i += 1) {
                if(results[i].fetched) {
                    if(results[i].cursor) {
                        actdisp.cursor = results[i].cursor;  } }
                else if(!filtered(results[i])) {
                    revref = mor.lcs.putRev(results[i]);
                    actdisp.revrefs.push(revref); } } }
        if(actdisp.cursor && actdisp.revrefs.length === 0) {
            //auto find more activity without creating a recursion stack
            setTimeout(mor.activity.moreact, 10); }
        displayReviewActivity();
    },


    doActivitySearch = function (continued) {
        var actdisp, time, penids, params, critsec = "";
        actdisp = mor.pen.currPenRef().actdisp;
        penids = mor.rel.outboundids();
        params = "penids=" + penids.join(',');
        if(!continued && actdisp.lastChecked) {
            params += "&since=" + actdisp.lastChecked.toISOString(); }
        else if(continued) {
            params += "&cursor=" + actdisp.cursor; }
        time = new Date().getTime();
        mor.call("revact?" + params, 'GET', null,
                 function (results) {
                     time = new Date().getTime() - time;
                     mor.log("revact returned in " + time/1000 + " seconds.");
                     actdisp.lastChecked = new Date();
                     collectAndDisplayReviewActivity(results, continued); },
                 function (code, errtxt) {
                     mor.out('revactdiv', "error code: " + code + " " + 
                             errtxt); },
                 critsec);
    },


    searchPensLinkHTML = function () {
        return mor.imgntxt("follow.png", "Find Pen Names", 
                           "mor.activity.pensearchdialog()", 
                           "#findpens",
                           "Find pen names to follow");
    },


    bootActivityDisplay = function () {
        var penids, html, retry = false;
        writeNavDisplay("activity");
        penids = mor.rel.outboundids();
        if(penids.length === 0) {
            html = "<p>You are not following anyone.</p>" +
                "<p>To follow someone, click the follow icon next to their " + 
                "profile name.</p>" + searchPensLinkHTML(); }
        else if((penids[penids.length - 1] === "waiting") ||
                (penids[penids.length - 1] === "loading")) {
            retry = true;
            html = "Loading relationships..."; }
        else {
            mor.pen.currPenRef().actdisp = { 
                revrefs: [], 
                cursor: "" };
            html = "Loading activity..."; }
        mor.out('revactdiv', html);
        mor.layout.adjust();
        if(mor.pen.currPenRef().actdisp) {
            doActivitySearch(); }
        if(retry) {
            setTimeout(bootActivityDisplay, 100); }
    },


    verifyCoreDisplayElements = function () {
        var html, domelem = mor.byId('revactdiv');
        if(!domelem) {
            html = "<div id=\"revactdiv\"></div>";
            if(!mor.byId('cmain')) {
                mor.layout.initContent(); }
            mor.out('cmain', html); }
    },


    mainDisplay = function (pen, dispmode) {
        mor.historyCheckpoint({ view: dispmode });
        writeNavDisplay(dispmode);
        verifyCoreDisplayElements();
        if(dispmode === "memo") {
            displayRemembered(pen); }
        else {  //dispmode === "activity"
            if(mor.pen.currPenRef().actdisp) {
                displayReviewActivity();
                doActivitySearch(); }
            else {
                bootActivityDisplay(); } }
    };

    
    return {
        updateHeading: function (mode) {
            writeNavDisplay(mode || "activity"); },
        pensearchdialog: function () {
            penNameSearchDialog(); },
        moreact: function () {
            doActivitySearch(true); },
        notePenNameStr: function (pen) {
            notePenNameStr(pen); },
        searchPensLinkHTML: function () {
            return searchPensLinkHTML(); },
        togglesrchopts: function () {
            toggleSearchOptions(); },
        activityLinkHTML: function () {
            return activityLinkHTML(); },
        rememberedLinkHTML: function () {
            return rememberedLinkHTML(); },
        displayActive: function () {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, "activity"); }); },
        displayRemembered: function () {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, "memo"); }); },
        startPenSearch: function () {
            startPenSearch(); },
        searchPens: function () {
            searchPens(); },
        reset: function () {
            mor.pen.currPenRef().actdisp = null; }
    };

});

