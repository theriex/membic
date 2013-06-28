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
        revcache = {},
        badrevids = [],
        dispmode = "activity",  //other value option is "memo"
        activityTitleText = "New reviews from friends",
        rememberedTitleText = "Remembered reviews",
        searchparams = {},
        searchresults = [],
        searchcursor = "",
        searchmax = 1000,  //max records to go through automatically
        searchtotal = 0,  //count of records searched so far
        searchrequests = 1,  //count of times the search was manually requested


    resetStateVars = function () {
        penids = null;
        revs = null;
        lastChecked = null;
        actcursor = "";
        revcache = {};
        badrevids = [];
        dispmode = "activity";
    },


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


    writeNavDisplay = function () {
        var html, url;
        if(dispmode === "activity") {
            url = "rssact?pen=" + mor.pen.currPenId();
            html = activityTitleText + " " + 
                mor.imglink(url, "RSS feed for recent friend reviews",
                            "window.open('" + url + "')", 
                            "rssicon.png", "rssico"); }
        else if(dispmode === "memo") {
            html = rememberedTitleText; }
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
        var pen, rel;
        pen = searchitem;
        rel = mor.rel.outbound(mor.instId(pen));
        if(rel) {
            if(searchparams.includeFollowing && rel.status === "following") {
                return false; }
            if(searchparams.includeBlocked && rel.status === "blocked") {
                return false; }
            return true; }
        return false;
    },


    displayPenSearchResults = function (results) {
        var i, html;
        html = "<ul class=\"penlist\">";
        for(i = 0; i < searchresults.length; i += 1) {
            html += mor.profile.penListItemHTML(searchresults[i]); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        searchcursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                searchtotal += results[i].fetched;
                html += "<div class=\"sumtotal\">" + 
                    searchtotal + " pen names searched</div>";
                if(results[i].cursor) {
                    searchcursor = results[i].cursor; }
                break; }  //if no results, i will be left at zero
            if(!penSearchFiltered(results[i])) {
                searchresults.push(results[i]);
                html += mor.profile.penListItemHTML(results[i]); } }
        if(searchresults.length === 0) {
            html += "<div class=\"sumtotal\">No pen names found</div>"; }
        html += "</ul>";
        if(searchcursor) {
            if(i === 0 && searchtotal < (searchmax * searchrequests)) {
                setTimeout(mor.activity.searchPens, 10); }  //auto-repeat search
            else {
                if(searchtotal >= (searchmax * searchrequests)) {
                    searchrequests += 1; } 
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"mor.activity.searchPens();" + 
                                     "return false;\"" +
                          " title=\"Continue searching for more pen names\"" +
                    ">continue search...</a>"; } }
        mor.out('searchresults', html);
        mor.byId("searchbutton").disabled = false;
    },


    readSearchParamsFromForm = function () {
        var checkboxes, options, i, t20type, since;
        searchparams.reqmin = [];
        checkboxes = document.getElementsByName("reqmin");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                t20type = mor.review.getReviewTypeByValue(checkboxes[i].value);
                searchparams.reqmin.push(t20type.type); } }
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
        searchparams.activeDaysAgo = since;
        searchparams.includeFollowing = false;
        searchparams.includeBlocked = false;
        searchparams.includeLurkers = false;
        checkboxes = document.getElementsByName("srchinc");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(checkboxes[i].value === 'following') {
                    searchparams.includeFollowing = true; }
                if(checkboxes[i].value === 'blocked') {
                    searchparams.includeBlocked = true; } 
                if(checkboxes[i].value === 'lurkers') {
                    searchparams.includeLurkers = true; } } }
    },


    searchPens = function () {
        var params, qstr, time, t20, i, critsec = "";
        readSearchParamsFromForm();
        mor.out('srchoptstogglehref', "show advanced search options");
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.byId("searchbutton").disabled = true;
        qstr = mor.byId('searchtxt').value;
        params = mor.login.authparams() + "&qstr=" + mor.enc(qstr) +
            "&cursor=" + mor.enc(searchcursor);
        if(searchparams.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= searchparams.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + mor.enc(time); }
        if(searchparams.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < searchparams.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += searchparams.reqmin[i]; }
            params += "&t20=" + mor.enc(t20); }
        if(searchparams.includeLurkers) {
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
        searchparams = {};
        searchresults = [];
        searchcursor = "";
        searchtotal = 0;
        searchrequests = 1;
        searchPens();
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
        var i, html, rev, crid, friend, cfid, maxdisp = 50, hint;
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
        if(i === maxdisp && maxdisp < 3) {  //after 3 times they should get it
            html += "<li></li><li>" + hint + "</li>"; }
        html += "</ul>";
        mor.out('revactdiv', html);
        mor.layout.adjust();
        if(crid) {
            setTimeout(function () {
                var critsec = "";
                mor.call("revbyid?revid=" + crid, 'GET', null,
                         function (revs) {
                             mor.activity.cacheReview(revs[0]);
                             mor.activity.display(); },
                         function (code, errtxt) {
                             mor.log("displayRemembered revbyid " + crid +
                                     " " + code + " " + errtxt);
                             badrevids.push(crid); },
                         critsec, null, [ 404 ]); },
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
        var time, params, critsec = "";
        params = "penids=" + penids.join(',');
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
        var html, retry = false;
        writeNavDisplay();
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
        pensearchdialog: function () {
            penNameSearchDialog(); },
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
            mor.pen.getPen(mainDisplay); },
        togglesrchopts: function () {
            toggleSearchOptions(); },
        startPenSearch: function () {
            startPenSearch(); },
        searchPens: function () {
            searchPens(); }
    };

});

