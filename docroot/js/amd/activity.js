/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

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
        activityMode = "amnew",  //other option is "amtop"
        topActivityType = "",  //book or whatever review type is selected
        topDispMax = 20,  //max top reviews to display


    activityLinkHTML = function () {
        var html = "<div class=\"topnavitemdiv\">" +
            app.imgntxt("friendact.png", "",
                        "app.activity.displayActive()",
                        "#Activity",
                        "See what's been posted recently") +
            "</div>";
        return html;
    },


    rememberedLinkHTML = function () {
        var html = "<div class=\"topnavitemdiv\">" +
            app.imgntxt("remembered.png", "",
                        "app.activity.displayRemembered()",
                        "#Remembered",
                        "Show reviews you have remembered") +
            "</div>";
        return html;
    },


    topTypeSelectorHTML = function () {
        var reviewTypes, i, typename, title, html;
        html = "<div id=\"toptypeseldiv\">";
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            title = typename.capitalize() + " reviews";
            html += "<img class=\"reviewbadge\"" +
                " src=\"img/" + reviewTypes[i].img + "\"" +
                " title=\"" + title + "\"" +
                " alt=\"" + title + "\"" +
                " onclick=\"app.activity.toptype('" + typename + "');" +
                           "return false;\"" +
                "/>"; }
        html += "</div>";
        return html;
    },


    writeNavDisplay = function (dispmode) {
        var html, url;
        if(dispmode === "activity") {
            if(activityMode === "amnew") {
                url = "rssact?pen=" + app.pen.currPenId();
                html = "New reviews from friends " +
                    app.imglink(url, "RSS feed for recent friend reviews",
                                "window.open('" + url + "')", 
                                "rssicon.png", "rssico") +
                    "<button type=\"button\" id=\"switchmodebutton\"" +
                    " onclick=\"app.activity.switchmode('amtop');" +
                               "return false;\"" +
                    " title=\"Show top rated reviews from friends\"" +
                    ">Show Top</button>"; }
            else if(activityMode === "amtop") {
                html = "Top reviews from friends " +
                    "<button type=\"button\" id=\"switchmodebutton\"" +
                    " onclick=\"app.activity.switchmode('amnew');" +
                               "return false;\"" +
                    " title=\"Show recent reviews from friends\"" +
                    ">Show Recent</button>" +
                    topTypeSelectorHTML(); } }
        else if(dispmode === "memo") {
            html = "Remembered reviews"; }
        app.out('centerhdiv', html);
    },


    searchOptionsHTML = function () {
        var html = "<div id=\"searchoptionsdiv\" class=\"formstyle\">" +
            "<i>Must have reviewed their top 20</i>" +
            app.review.reviewTypeCheckboxesHTML("reqmin") +
            "<i>Must have been active within the past</i>&nbsp;" + 
            "<select id=\"srchactivesel\">" +
              "<option id=\"whenever\">Whenever</option>" +
              "<option id=\"pastyear\" selected=\"selected\">Year</option>" +
              "<option id=\"pastmonth\">Month</option>" +
              "<option id=\"pastweek\">Week</option>" +
            "</select>" +
            "<br/>" +
            "<i>Include</i>&nbsp;" + 
            app.checkbox("srchinc", "following") +
            app.checkbox("srchinc", "blocked") +
            app.checkbox("srchinc", "lurkers") +
            " <i> in the search results</i>" +
            "<br/>&nbsp;<br/></div>";
        return html;
    },


    penNameSearchDialog = function () {
        var html;
        html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"app.layout.closeDialog();return false;\"" +
            ">&lt;close&nbsp;&nbsp;X&gt;</a></div>" + 
            "<div class=\"floatclear\"></div>" +
            "<div class=\"headingtxt\">" + 
            "Find pen names to follow</div>" +
            "<table class=\"searchtable\">" +
            "<tr>" +
              "<td class=\"formstyle\">" + 
                "<input type=\"text\" id=\"searchtxt\" size=\"40\"" +
                      " placeholder=\"Pen name, city, or profile comment...\"" +
                      " onchange=\"app.activity.startPenSearch();" + 
                                  "return false;\"" +
                      " value=\"\"/></td>" +
              "<td class=\"formstyle\">" +
                "<span id=\"srchbuttonspan\">" +
                  "<button type=\"button\" id=\"searchbutton\"" + 
                         " onclick=\"app.activity.startPenSearch();" + 
                                    "return false;\"" + 
                    ">Search</button></span></td></tr>" + 
            "<tr>" +
              "<td class=\"formstyle\" colspan=\"2\">" +
                "<span id=\"srchoptstoggle\" class=\"formstyle\">" + 
                  "<a href=\"#searchoptions\"" +
                    " id=\"srchoptstogglehref\"" +
                    " title=\"search options\"" +
                    " onclick=\"app.activity.togglesrchopts();return false;\"" +
                  ">show advanced search options</a></span></td></tr>" +
            "</table>" + searchOptionsHTML() +
            "<div id=\"searchresults\"></div>";
        app.out('dlgdiv', html);
        app.byId('dlgdiv').style.visibility = "visible";
        if(app.isLowFuncBrowser()) {
            app.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        app.onescapefunc = app.layout.closeDialog;
        app.byId('searchoptionsdiv').style.display = "none";
        app.byId('searchtxt').focus();
        //hit the search button for them so they don't have to figure out
        //pressing the button vs search options or what to type.
        setTimeout(app.activity.startPenSearch, 50);
    },


    toggleSearchOptions = function () {
        var sod = app.byId('searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                app.out('srchoptstogglehref', "hide advanced search options");
                sod.style.display = "block"; }
            else {
                app.out('srchoptstogglehref', "show advanced search options");
                sod.style.display = "none"; } }
        app.layout.adjust();
    },


    //When searching pen names, the server handles the "active since"
    //restriction by checking the "accessed" field, and the "top 20"
    //restriction by looking through those, however it does not
    //handle joins across relationships due to indexing overhead, so
    //those are filtered out here.
    penSearchFiltered = function (searchitem) {
        var params, pen, rel;
        params = app.pen.currPenRef().pensearch.params;
        pen = searchitem;
        rel = app.rel.outbound(app.instId(pen));
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
        pensearch = app.pen.currPenRef().pensearch;
        html = "<ul class=\"penlist\">";
        for(i = 0; i < pensearch.pens.length; i += 1) {
            html += app.profile.penListItemHTML(pensearch.pens[i]); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        pensearch.cursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                pensearch.total += results[i].fetched;
                html += "<div class=\"sumtotal\">" + 
                    pensearch.total + " pen names searched, " + 
                    (pensearch.total - pensearch.pens.length) +
                    " filtered.</div>";
                if(results[i].cursor) {
                    pensearch.cursor = results[i].cursor; }
                break; }  //if no results, i will be left at zero
            if(!penSearchFiltered(results[i])) {
                app.lcs.putPen(results[i]);
                pensearch.pens.push(results[i]);
                html += app.profile.penListItemHTML(results[i]); } }
        if(pensearch.pens.length === 0) {
            html += "<div class=\"sumtotal\">No pen names found</div>"; }
        html += "</ul>";
        if(pensearch.cursor) {
            if(i === 0 && pensearch.total < (pensearchmax * pensearch.reqs)) {
                setTimeout(app.activity.searchPens, 10); }  //auto-repeat search
            else {
                if(pensearch.total >= (pensearchmax * pensearch.reqs)) {
                    pensearch.reqs += 1; } 
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"app.activity.searchPens();" + 
                                     "return false;\"" +
                          " title=\"Continue searching for more pen names\"" +
                    ">continue search...</a>"; } }
        app.out('searchresults', html);
        app.byId("searchbutton").disabled = false;
    },


    readSearchParamsFromForm = function () {
        var pensearch, checkboxes, options, i, t20type, since;
        pensearch = app.pen.currPenRef().pensearch;
        pensearch.params.reqmin = [];
        checkboxes = document.getElementsByName("reqmin");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                t20type = app.review.getReviewTypeByValue(checkboxes[i].value);
                pensearch.params.reqmin.push(t20type.type); } }
        options = app.byId('srchactivesel').options;
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
        pensearch = app.pen.currPenRef().pensearch;
        readSearchParamsFromForm();
        app.out('srchoptstogglehref', "show advanced search options");
        app.byId('searchoptionsdiv').style.display = "none";
        app.byId("searchbutton").disabled = true;
        qstr = app.byId('searchtxt').value;
        params = app.login.authparams() + "&qstr=" + app.enc(qstr) +
            "&cursor=" + app.enc(pensearch.cursor);
        if(pensearch.params.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= pensearch.params.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + app.enc(time); }
        if(pensearch.params.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < pensearch.params.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += pensearch.params.reqmin[i]; }
            params += "&t20=" + app.enc(t20); }
        if(pensearch.params.includeLurkers) {
            params += "&lurkers=include"; }
        app.call("srchpens?" + params, 'GET', null,
                 function (results) {
                     displayPenSearchResults(results); },
                 function (code, errtxt) {
                     app.out('searchresults', 
                             "error code: " + code + " " + errtxt); },
                 critsec);
    },


    startPenSearch = function () {
        app.pen.currPenRef().pensearch = {
            params: {},
            pens: [],
            cursor: "",
            total: 0,
            requests: 1 };
        searchPens();
    },


    displayRemembered = function () {
        var penref, hint, html, i, revref, crid, friend, cfid, 
            params, critsec = "";
        penref = app.pen.currPenRef();
        if(penref.remembered) {
            hint = "If you see a review worth remembering, click its " + 
                "\"Remember\" button to keep a reference to it here.";
            html = "<ul class=\"revlist\">";
            if(!penref.remembered.length) {
                html += "<li>You have not remembered any reviews. " + 
                    hint + "</li>"; }
            else { //have remembered reviews for display
                for(i = 0; i < penref.remembered.length && i < 50; i += 1) {
                    revref = app.lcs.getRevRef(penref.remembered[i].revid);
                    if(revref.status === "not cached") {
                        crid = penref.remembered[i].revid;
                        html += "<li>Fetching Review " + crid + "...</li>";
                        break; }
                    if(!revref.rev.penNameStr) {
                        friend = app.lcs.getPenRef(revref.rev.penid).pen;
                        if(friend) {
                            revref.rev.penNameStr = friend.name; } }
                    if(!revref.rev.penNameStr) {
                        cfid = revref.rev.penid;
                        html += "<li>Fetching Pen Name " + cfid + "...</li>";
                        break; }
                    html += app.profile.reviewItemHTML(revref.rev, 
                                                   revref.rev.penNameStr); } }
            if(i < 3) {  //reinforce how to remember reviews
                html += "<li></li><li><span class=\"hintText\">" + hint + 
                    "</span></li>"; }
            html += "</ul>";
            app.out('revactdiv', html);
            app.layout.adjust();
            if(crid) {
                app.lcs.getRevFull(crid, displayRemembered); }
            if(cfid) {
                app.lcs.getPenFull(cfid, displayRemembered); } }
        else { //!penref.remembered
            app.out('revactdiv', "Fetching remembered reviews...");
            app.layout.adjust();
            params = "penid=" + app.instId(penref.pen) +
                "&" + app.login.authparams();
            app.call("srchremem?" + params, 'GET', null,
                     function (memos) {
                         penref.remembered = memos;
                         displayRemembered(); },
                     function (code, errtxt) {
                         app.err("displayRemembered failed " + code + 
                                 " " + errtxt); },
                     critsec); }
    },


    findUniqueRev = function (revrefs, revids) {
        var revref, i, j;
        for(i = 0; !revref && i < revids.length; i += 1) {
            revref = app.lcs.getRevRef(revids[i]);
            if(revref.status !== "ok" && revref.status !== "not cached") { 
                revref = null; }  //bad ids not valid for consideration
            else if(revref.rev) { 
                for(j = 0; j < revrefs.length; j += 1) {
                    if(revref.rev.cankey === revrefs[j].rev.cankey) {
                        revref = null;  //dupes not valid
                        break; } } } }
        return revref;
    },


    //find the next viable top review to add to the revrefs.  Returns
    //null if nothing left to find, revref otherwise.  The revref may
    //need to be resolved if not cached.
    nextTopRev = function (revrefs, penrefs) {
        var i, revref, startidx = 0, penidx, pen;
        if(revrefs.length > 0) {
            revref = revrefs[revrefs.length - 1];
            for(i = 0; i < penrefs.length; i += 1) {
                if(revref.rev.penid === app.instId(penrefs[i].pen)) {
                    break; } }
            startidx = i + 1; } //start after pen who did the last rev
        revref = null;
        for(i = 0; i < penrefs.length; i += 1) { 
            penidx = (i + startidx) % penrefs.length;
            pen = penrefs[penidx].pen;
            if(pen.top20s && pen.top20s[topActivityType]) {
                revref = findUniqueRev(revrefs, pen.top20s[topActivityType]);
                if(revref) {
                    break; } } }
        return revref;
    },



    //The outbound relationships are assumed to be loaded at this
    //point.  Rebuild the pen array every time, since they might have
    //blocked someone in the meantime and not much overhead if
    //everything is already cached.
    displayTopReviews = function () {
        var pens, i, penid, revs, revref, html;
        //get an array of friend pens
        pens = app.rel.outboundids();
        for(i = 0; i < pens.length; i += 1) {
            penid = pens[i];
            pens[i] = app.lcs.getPenRef(penid);
            if(pens[i].status === "not cached") {
                app.out('revactdiv', "Loading friends..." + (i+1));
                return app.lcs.getPenFull(penid, displayTopReviews); } }
        //sort them by modified (last login) with most recent first
        pens.sort(function (a, b) {
            if(a.pen && b.pen && a.pen.modified < b.pen.modified) {
                return 1; } //b is more recent, so a belongs to the right
            if(a.pen && b.pen && a.pen.modified > b.pen.modified) {
                return -1; }
            return 0; });
        //initialize the topActivityType if necessary
        for(i = 0; !topActivityType && i < pens.length; i += 1) {
            if(pens[i].pen && pens[i].pen.top20s 
               && pens[i].pen.top20s.latestrevtype) {
                topActivityType = pens[i].pen.top20s.latestrevtype; } }
        if(!topActivityType) {
            topActivityType = "book"; }
        //dump the reviews
        html = "<ul class=\"revlist\">";
        revs = [];
        while(revs.length < topDispMax) { 
            revref = nextTopRev(revs, pens);
            if(!revref) {  //no more reviews found, so done
                break; }
            if(revref.status === "not cached") {
                html += "<li>Fetching review " + revref.revid + "</li></ul>";
                app.out('revactdiv', html);
                return app.lcs.getRevFull(revref.revid, displayTopReviews); }
            if(revref.rev) {
                revs.push(revref);
                html += app.profile.reviewItemHTML(revref.rev, 
                                                   revref.penNameStr); } }
        if(revs.length === 0) {
            html += "<li>No " + topActivityType + " reviews found</li>"; }
        html += "</ul>";
        app.out('revactdiv', html);
    },


    moreRevsFromHTML = function (rev) {
        var html = "<li>" + "<div class=\"morerevs\">" +
            "<a href=\"#" + app.objdata({ view: "profile", 
                                          profid: rev.penid }) + "\"" +
              " onclick=\"app.profile.byprofid('" + rev.penid + 
                                               "', 'recent');" +
                         "return false;\"" +
              " title=\"Show recent reviews from " + 
                        app.ndq(rev.penNameStr) + "\"" + 
            ">" + "more reviews from " +
                app.ndq(rev.penNameStr) + " on " + 
                app.colloquialDate(app.ISOString2Day(rev.modified)) +
            "</a></div></li>";
        return html;
    },


    displayReviewActivity = function () {
        var actdisp, revrefs, rev, i, breakid, html, key, reps = {};
        app.byId('switchmodebutton').disabled = false;
        html = "<ul class=\"revlist\">";
        actdisp = app.pen.currPenRef().actdisp;
        revrefs = actdisp.revrefs;
        if(revrefs.length === 0) {
            html += "<li>None of the people you are following have posted any reviews recently.</li>"; }
        for(i = 0; i < revrefs.length; i += 1) {
            rev = revrefs[i].rev;
            key = rev.modified.slice(0, 10) + rev.penid;
            if(!reps[key] || reps[key] < 2) {  //display 2 revs/day/pen
                reps[key] = (reps[key] || 0) + 1;
                html += app.profile.reviewItemHTML(rev, rev.penNameStr); }
            else {
                reps[key] += 1;
                if(reps[key] === 3) {
                    html += moreRevsFromHTML(rev); } }
            if(!rev.penNameStr) {
                breakid = rev.penid;
                break; } }
        if(breakid) {  //need to fetch pen
            setTimeout(function () {
                app.lcs.getPenFull(breakid, function (penref) {
                    app.activity.notePenNameStr(penref.pen); }); },
                       50); }
        else {
            setTimeout(function () {
                app.lcs.verifyReviewLinks(displayReviewActivity); }, 250); }
        html += "</ul>";
        if(actdisp.cursor) {
            html += "<a href=\"#moreact\"" +
                " onclick=\"app.activity.moreact();return false;\"" +
                " title=\"More activity\"" + ">more activity...</a>"; }
        app.out('revactdiv', html);
        app.layout.adjust();
    },


    notePenNameStr = function (pen) {
        var i, pid, revrefs;
        revrefs = app.pen.currPenRef().actdisp.revrefs;
        pid = app.instId(pen);
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
        var rel = app.rel.outbound(rev.penid);
        if(rev.rating < rel.cutoff) {
            return true; }
        if(rel.mute && rel.mute.indexOf(rev.revtype) >= 0) {
            return true; }
        return false;
    },


    collectAndDisplayReviewActivity = function (results, continued) {
        var i, actdisp, revref;
        actdisp = app.pen.currPenRef().actdisp;
        if(!continued) { //prepend latest results
            for(i = results.length - 1; i >= 0; i -= 1) {
                if(results[i].fetched) {
                    if(results[i].cursor) {
                        actdisp.cursor = results[i].cursor;  } }
                else if(!filtered(results[i])) {
                    revref = app.lcs.putRev(results[i]);
                    actdisp.revrefs.unshift(revref); } } }
        else { //append results and track cursor (if any)
            actdisp.cursor = "";
            for(i = 0; i < results.length; i += 1) {
                if(results[i].fetched) {
                    if(results[i].cursor) {
                        actdisp.cursor = results[i].cursor;  } }
                else if(!filtered(results[i])) {
                    revref = app.lcs.putRev(results[i]);
                    actdisp.revrefs.push(revref); } } }
        if(actdisp.cursor && actdisp.revrefs.length === 0) {
            //auto find more activity without creating a recursion stack
            setTimeout(app.activity.moreact, 10); }
        displayReviewActivity();
    },


    doActivitySearch = function (continued) {
        var actdisp, time, penids, params, critsec = "";
        actdisp = app.pen.currPenRef().actdisp;
        penids = app.rel.outboundids();
        params = "penids=" + penids.join(',');
        if(!continued && actdisp.lastChecked) {
            params += "&since=" + actdisp.lastChecked.toISOString(); }
        else if(continued) {
            params += "&cursor=" + actdisp.cursor; }
        time = new Date().getTime();
        app.call("revact?" + params, 'GET', null,
                 function (results) {
                     time = new Date().getTime() - time;
                     app.log("revact returned in " + time/1000 + " seconds.");
                     actdisp.lastChecked = new Date();
                     collectAndDisplayReviewActivity(results, continued); },
                 function (code, errtxt) {
                     app.out('revactdiv', "error code: " + code + " " + 
                             errtxt); },
                 critsec);
    },


    searchPensLinkHTML = function () {
        return app.imgntxt("follow.png", "Find Pen Names", 
                           "app.activity.pensearchdialog()", 
                           "#findpens",
                           "Find pen names to follow");
    },


    bootActivityDisplay = function () {
        var penids, html, retry = false;
        writeNavDisplay("activity");
        app.byId('switchmodebutton').disabled = true;
        penids = app.rel.outboundids();
        if(penids.length === 0) {
            html = "<p>You are not following anyone.</p>" +
                "<p>To follow someone, click the follow icon next to their " + 
                "profile name.</p>" + searchPensLinkHTML(); }
        else if((penids[penids.length - 1] === "waiting") ||
                (penids[penids.length - 1] === "loading")) {
            retry = true;
            html = "Loading relationships..."; }
        else if(!app.pen.currPenRef().helpful) {
            html = "Loading helpful..."; }
        else {
            app.pen.currPenRef().actdisp = { 
                revrefs: [], 
                cursor: "" };
            html = "Loading activity..."; }
        app.out('revactdiv', html);
        app.layout.adjust();
        if(app.pen.currPenRef().actdisp) {
            doActivitySearch(); }
        else if(!app.pen.currPenRef().helpful) {
            app.review.loadHelpful(bootActivityDisplay); }
        else if(retry) {
            app.log("bootActivityDisplay retry: " + penids[penids.length - 1]);
            setTimeout(bootActivityDisplay, 100); }
    },


    verifyCoreDisplayElements = function () {
        var html, domelem = app.byId('revactdiv');
        if(!domelem) {
            html = "<div id=\"revactdiv\"></div>";
            if(!app.byId('cmain')) {
                app.layout.initContent(); }
            app.out('cmain', html); }
    },


    mainDisplay = function (dispmode) {
        var penref = app.pen.currPenRef();
        if(!penref) {
            setTimeout(function () {
                app.pen.getPen(function (pen) {
                    mainDisplay(dispmode); }); }, 100);
            return; }
        app.history.checkpoint({ view: dispmode });
        writeNavDisplay(dispmode);
        verifyCoreDisplayElements();
        if(dispmode === "memo") {
            displayRemembered(); }
        else {  //dispmode === "activity"
            if(activityMode === "amtop") {
                displayTopReviews(); }
            else {  //activityMode === "amnew"
                if(penref.actdisp) {
                    displayReviewActivity();
                    doActivitySearch(); }
                else {
                    bootActivityDisplay(); } } }
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
            mainDisplay("activity"); },
        displayRemembered: function () {
            mainDisplay("memo"); },
        switchmode: function (modestr) {
            activityMode = modestr;
            mainDisplay("activity"); },
        toptype: function (typestr) {
            topActivityType = typestr;
            mainDisplay("activity"); },
        startPenSearch: function () {
            startPenSearch(); },
        searchPens: function () {
            searchPens(); },
        reset: function () {
            app.pen.currPenRef().actdisp = null; }
    };

});

