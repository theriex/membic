/*global setTimeout: false, window: false, document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
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

app.activity = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var pensearchmax = 1000,  //max records to read through automatically
        activityMode = "amnew",  //other option is "amtop"
        topActivityType = "",  //book or whatever review type is selected
        topDispMax = 20,  //max top reviews to display


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    topTypeSelectorHTML = function () {
        var reviewTypes, divc = [], i, typename, title, html;
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            title = typename.capitalize() + " reviews";
            divc.push(["img", {cla: "reviewbadge",
                               src: "img/" + reviewTypes[i].img,
                               title: title, alt: title,
                               onclick: jt.fs("app.activity.toptype('" + 
                                              typename + "')")}]); }
        html = ["div", {id: "toptypeseldiv"}, divc];
        html = jt.tac2html(html);
        return html;
    },


    writeNavDisplay = function (dispmode) {
        var html, url;
        if(dispmode === "activity") {
            if(activityMode === "amnew") {
                url = "rssact?pen=" + app.pen.currPenId();
                html = ["New reviews from friends ",
                        ["a", {href: url,
                               title: "RSS feed for recent friend reviews",
                               onclick: jt.fs("window.open('" + url + "')")},
                         ["img", {cla: "rssico", src: "img/rssicon.png"}]],
                        ["button", {type: "button", id: "switchmodebutton",
                                    onclick: jt.fs("app.activity.switchmode" +
                                                   "('amtop')"),
                                    title: "Show top rated reviews from" + 
                                          " friends"},
                         "Show Top"]];
                html = jt.tac2html(html); }
            else if(activityMode === "amtop") {
                html = ["Top reviews from friends ",
                        ["button", {type: "button", id: "switchmodebutton",
                                    onclick: jt.fs("app.activity.switchmode" +
                                                   "('amnew')"),
                                    title: "Show recent reviews from" +
                                          " friends"},
                         "Show Recent"]];
                html = jt.tac2html(html) + topTypeSelectorHTML(); } }
        else if(dispmode === "memo") {
            html = "Remembered reviews"; }
        jt.out('centerhdiv', html);
    },


    searchOptionsHTML = function () {
        var html;
        html = ["div", {id: "searchoptionsdiv", cla: "formstyle"},
                [["i", "Must have reviewed their top 20"],
                 app.review.reviewTypeCheckboxesHTML("reqmin"),
                 ["i", "Must have been active within the past"],
                 "&nbsp;",
                 ["select", {id: "srchactivesel"},
                  [["option", {id: "whenever"}, "Whenever"],
                   ["option", {id: "pastyear", selected: "selected"}, "Year"],
                   ["option", {id: "pastmonth"}, "Month"],
                   ["option", {id: "pastweek"}, "Week"]]],
                 ["br"],
                 ["i", "Include"],
                 "&nbsp;",
                 jt.checkbox("srchinc", "following"),
                 jt.checkbox("srchinc", "blocked"),
                 jt.checkbox("srchinc", "lurkers"),
                 ["i", " in the search results"],
                 ["br"],
                 "&nbsp;",
                 ["br"]]];
        html = jt.tac2html(html);
        return html;
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
        rel = app.rel.outbound(jt.instId(pen));
        if(rel) {
            if(params.includeFollowing && rel.status === "following") {
                return false; }
            if(params.includeBlocked && rel.status === "blocked") {
                return false; }
            return true; }
        return false;
    },


    displayPenSearchResults = function (results) {
        var pensearch, i, resitems = [], html;
        pensearch = app.pen.currPenRef().pensearch;
        for(i = 0; i < pensearch.pens.length; i += 1) {
            resitems.push(app.profile.penListItemHTML(pensearch.pens[i])); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        pensearch.cursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                pensearch.total += results[i].fetched;
                resitems.push(["div", {cla: "sumtotal"},
                               String(pensearch.total) + 
                               " pen names searched, " + 
                               (pensearch.total - pensearch.pens.length) +
                               " filtered."]);
                if(results[i].cursor) {
                    pensearch.cursor = results[i].cursor; }
                break; }  //if no results, i will be left at zero
            if(!penSearchFiltered(results[i])) {
                app.lcs.putPen(results[i]);
                pensearch.pens.push(results[i]);
                resitems.push(app.profile.penListItemHTML(results[i])); } }
        if(pensearch.pens.length === 0) {
            resitems.push(["div", {cla: "sumtotal"}, 
                           "No pen names found"]); }
        if(pensearch.cursor) {
            if(i === 0 && pensearch.total < (pensearchmax * pensearch.reqs)) {
                setTimeout(app.activity.searchPens, 10); }  //auto-repeat search
            else {
                if(pensearch.total >= (pensearchmax * pensearch.reqs)) {
                    pensearch.reqs += 1; } 
                resitems.push(
                    ["a", {href: "#continuesearch",
                           onclick: jt.fs("app.activity.searchPens()"),
                           title: "Continue searching for more pen names"},
                     "continue search..."]); } }
        html = ["ul", {cla: "penlist"}, resitems];
        html = jt.tac2html(html);
        jt.out('searchresults', html);
        jt.byId("searchbutton").disabled = false;
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
        options = jt.byId('srchactivesel').options;
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


    displayRemembered = function () {
        var penref, hint, remitems = [], html, i, revref, crid, friend, cfid, 
            params, critsec = "";
        penref = app.pen.currPenRef();
        if(penref.remembered) {
            for(i = 0; i < penref.remembered.length && i < 50; i += 1) {
                if(!penref.remembered[i].forgotten) {
                    revref = app.lcs.getRevRef(penref.remembered[i].revid);
                    if(revref.status === "not cached") {
                        crid = penref.remembered[i].revid;
                        remitems.push(["li",
                                       "Fetching Review " + crid + "..."]);
                        break; }
                    if(!revref.rev.penNameStr) {
                        friend = app.lcs.getPenRef(revref.rev.penid).pen;
                        if(friend) {
                            revref.rev.penNameStr = friend.name; } }
                    if(!revref.rev.penNameStr) {
                        cfid = revref.rev.penid;
                        remitems.push(["li", 
                                       "Fetching Pen Name " + cfid + "..."]);
                        break; }
                    //have review with associated pen name
                    remitems.push(app.profile.reviewItemHTML(revref.rev, 
                                                  revref.rev.penNameStr)); } }
            hint = "If you see a review worth remembering, click its " + 
                "\"Remember\" button to keep a reference to it here.";
            if(remitems.length === 0) {  //no reviews currently remembered
                remitems.push(["li", "You have not remembered any reviews. " +
                               hint]); }
            else if(i < 3) {  //reinforce how to remember reviews
                remitems.push(["li"]);
                remitems.push(["li", ["span", {cla: "hintText"}, hint]]); }
            html = ["ul", {cla: "revlist"}, remitems];
            html = jt.tac2html(html);
            jt.out('revactdiv', html);
            app.layout.adjust();
            if(crid) {
                app.lcs.getRevFull(crid, displayRemembered); }
            if(cfid) {
                app.lcs.getPenFull(cfid, displayRemembered); } }
        else { //!penref.remembered
            jt.out('revactdiv', "Fetching remembered reviews...");
            app.layout.adjust();
            params = "penid=" + jt.instId(penref.pen) +
                "&" + app.login.authparams();
            jt.call('GET', "srchremem?" + params, null,
                     function (memos) {
                         penref.remembered = memos;
                         displayRemembered(); },
                     app.failf(),
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
                if(revref.rev.penid === jt.instId(penrefs[i].pen)) {
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
        var pens, i, penid, revs, revref, revitems = [], html;
        //get an array of friend pens
        pens = app.rel.outboundids();
        for(i = 0; i < pens.length; i += 1) {
            penid = pens[i];
            pens[i] = app.lcs.getPenRef(penid);
            if(pens[i].status === "not cached") {
                jt.out('revactdiv', "Loading friends..." + (i+1));
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
        revs = [];
        while(revs.length < topDispMax) { 
            revref = nextTopRev(revs, pens);
            if(!revref) {  //no more reviews found, so done
                break; }
            if(revref.status === "not cached") {
                revitems.push(["li", "Fetching review " + revref.revid]);
                html = ["ul", {cla: "revlist"}, revitems];
                html = jt.tac2html(html);
                jt.out('revactdiv', html);
                return app.lcs.getRevFull(revref.revid, displayTopReviews); }
            if(revref.rev) {
                revs.push(revref);
                revitems.push(["li", app.profile.reviewItemHTML(revref.rev, 
                                                   revref.penNameStr)]); } }
        if(revs.length === 0) {
            revitems.push(["li", "No " + topActivityType + " reviews found"]); }
        html = ["ul", {cla: "revlist"}, revitems];
        html = jt.tac2html(html);
        jt.out('revactdiv', html);
    },


    moreRevsFromHTML = function (rev) {
        var html = ["li",
                    ["div", {cla: "morerevs"},
                     ["a", {href: "#" + jt.objdata({ view: "profile", 
                                                     profid: rev.penid }),
                            onclick: jt.fs("app.profile.byprofid('" + 
                                           rev.penid + "', 'recent')"),
                            title: "Show recent reviews from " + 
                                   jt.ndq(rev.penNameStr)},
                      "more reviews from " + jt.ndq(rev.penNameStr) + " on " + 
                      jt.colloquialDate(jt.ISOString2Day(rev.modified))]]];
        html = jt.tac2html(html);
        return html;
    },


    followMoreHTML = function (penids, lowactivity) {
        var html = "", text;
        if(penids && penids.length < 3) {
            text = "You are currently following " + penids.length +
                " pen names. <br/>Recommend following at least 3..."; }
        else {
            text = "To see more reviews, <br/>follow more pen names."; }
        if(text) {
            html = ["table", {id: "followmore", cla: "formstyle"},
                    ["tr",
                     [["td", text],
                      ["td", app.activity.searchPensLinkHTML()]]]];
            html = jt.tac2html(html); }
        return html;
    },


    displayReviewActivity = function () {
        var actdisp, revrefs, rev, i, breakid, html = [], key, reps = {};
        if(jt.byId('switchmodebutton')) {
            jt.byId('switchmodebutton').disabled = false; }
        actdisp = app.pen.currPenRef().actdisp;
        revrefs = actdisp.revrefs;
        if(revrefs.length === 0) {
            html.push(["li", "None of the people you are following have" + 
                            " posted any reviews recently."]); }
        for(i = 0; i < revrefs.length; i += 1) {
            rev = revrefs[i].rev;
            key = rev.modified.slice(0, 10) + rev.penid;
            if(!reps[key] || reps[key] < 2) {  //display 2 revs/day/pen
                reps[key] = (reps[key] || 0) + 1;
                html.push(app.profile.reviewItemHTML(rev, rev.penNameStr)); }
            else {
                reps[key] += 1;
                if(reps[key] === 3) {
                    html.push(moreRevsFromHTML(rev)); } }
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
        html = ["ul", {cla: "revlist"}, html];
        if(actdisp.cursor) {
            html = [html, 
                    ["a", {href: "#moreact",
                           onclick: jt.fs("app.activity.moreact()"),
                           title: "More activity"},
                     "more activity..."]]; }
        else if(revrefs.length < 3) {
            html = [html, followMoreHTML(null, true)]; }
        jt.out('revactdiv', jt.tac2html(html));
        app.layout.adjust();
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
        jt.call('GET', "revact?" + params, null,
                 function (results) {
                     time = new Date().getTime() - time;
                     jt.log("revact returned in " + time/1000 + " seconds.");
                     actdisp.lastChecked = new Date();
                     collectAndDisplayReviewActivity(results, continued); },
                 app.failf(function (code, errtxt) {
                     jt.out('revactdiv', "error code: " + code + " " + 
                             errtxt); }),
                 critsec);
    },


    bootActivityDisplay = function () {
        var penids, html, retry = false;
        writeNavDisplay("activity");
        jt.byId('switchmodebutton').disabled = true;
        penids = app.rel.outboundids();
        if(penids.length === 0) {
            html = followMoreHTML(penids); }
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
        jt.out('revactdiv', html);
        app.layout.adjust();
        if(app.pen.currPenRef().actdisp) {
            doActivitySearch(); }
        else if(!app.pen.currPenRef().helpful) {
            app.review.loadHelpful(bootActivityDisplay); }
        else if(retry) {
            jt.log("bootActivityDisplay retry: " + penids[penids.length - 1]);
            setTimeout(bootActivityDisplay, 100); }
        else {  //finished loading and content, but display could be slow
            setTimeout(app.layout.adjust, 100); }
    },


    verifyCoreDisplayElements = function () {
        var html, domelem = jt.byId('revactdiv');
        if(!domelem) {
            html = "<div id=\"revactdiv\"></div>";
            if(!jt.byId('cmain')) {
                app.layout.initContent(); }
            jt.out('cmain', html); }
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


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    updateHeading: function (mode) {
        writeNavDisplay(mode || "activity");
    },


    penNameSearchDialog: function () {
        var html, searchfunc = jt.fs("app.activity.startPenSearch()");
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"},"Find pen names to follow"],
                ["table", {cla: "searchtable"},
                 [["tr",
                   [["td", {cla: "formstyle"},
                     ["input", {type: "text", id: "searchtxt", size: "40",
                                placeholder: "Pen name, city, or profile" + 
                                            " comment...",
                                onchange: searchfunc, value: ""}]],
                    ["td", {cla: "formstyle"},
                     ["span", {id: "srchbuttonspan"},
                      ["button", {type: "button", id: "searchbutton",
                                  onclick: searchfunc},
                       "Search"]]]]],
                  ["tr",
                   ["td", {cla: "formstyle", colspan: 2},
                    ["span", {id: "srchoptstoggle", cla: "formstyle"},
                     ["a", {href: "#searchoptions", id: "srchoptstogglehref",
                            title: "search options",
                            onclick: jt.fs("app.activity.togglesrchopts()")},
                      "show advanced search options"]]]]]],
                searchOptionsHTML(),
                ["div", {id: "searchresults"}]];
        html = jt.tac2html(html);
        jt.out('dlgdiv', html);
        jt.byId('dlgdiv').style.visibility = "visible";
        if(jt.isLowFuncBrowser()) {
            jt.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        app.onescapefunc = app.layout.closeDialog;
        jt.byId('searchoptionsdiv').style.display = "none";
        jt.byId('searchtxt').focus();
        //hit the search button for them so they don't have to figure out
        //search options unless they want to.
        setTimeout(app.activity.startPenSearch, 50);
    },


    moreact: function () {
        doActivitySearch(true);
    },


    notePenNameStr: function (pen) {
        var i, pid, revrefs;
        revrefs = app.pen.currPenRef().actdisp.revrefs;
        pid = jt.instId(pen);
        for(i = 0; i < revrefs.length; i += 1) {
            if(revrefs[i].rev.penid === pid) {
                revrefs[i].rev.penNameStr = pen.name; } }
        displayReviewActivity();
    },


    searchPensLinkHTML: function () {
        return jt.imgntxt("follow.png", "Find Active Pen Names",
                          "app.activity.penNameSearchDialog()",
                          "#findpens",
                          "Find pen names to follow");
    },


    togglesrchopts: function () {
        var sod = jt.byId('searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                jt.out('srchoptstogglehref', "hide advanced search options");
                sod.style.display = "block"; }
            else {
                jt.out('srchoptstogglehref', "show advanced search options");
                sod.style.display = "none"; } }
        app.layout.adjust();
    },


    activityLinkHTML: function () {
        var html = ["div", {cla: "topnavitemdiv"},
                    jt.imgntxt("friendact.png", "",
                               "app.activity.displayActive()",
                               "#Activity",
                               "See what's been posted recently")];
        html = jt.tac2html(html);
        return html;
    },


    rememberedLinkHTML: function () {
        var html = ["div", {cla: "topnavitemdiv"},
                    jt.imgntxt("remembered.png", "",
                               "app.activity.displayRemembered()",
                               "#Remembered",
                               "Show reviews you have remembered")];
        html = jt.tac2html(html);
        return html;
    },


    displayActive: function () {
        mainDisplay("activity");
    },


    displayRemembered: function () {
        mainDisplay("memo");
    },


    switchmode: function (modestr) {
        activityMode = modestr;
        mainDisplay("activity");
    },


    toptype: function (typestr) {
        topActivityType = typestr;
        mainDisplay("activity");
    },


    startPenSearch: function () {
        app.pen.currPenRef().pensearch = {
            params: {},
            pens: [],
            cursor: "",
            total: 0,
            requests: 1 };
        app.activity.searchPens();
    },


    searchPens: function () {
        var pensearch, params, qstr, time, t20, i, critsec = "";
        pensearch = app.pen.currPenRef().pensearch;
        readSearchParamsFromForm();
        jt.out('srchoptstogglehref', "show advanced search options");
        jt.byId('searchoptionsdiv').style.display = "none";
        jt.byId("searchbutton").disabled = true;
        qstr = jt.byId('searchtxt').value;
        params = app.login.authparams() + "&qstr=" + jt.enc(qstr) +
            "&cursor=" + jt.enc(pensearch.cursor);
        if(pensearch.params.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= pensearch.params.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + jt.enc(time); }
        if(pensearch.params.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < pensearch.params.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += pensearch.params.reqmin[i]; }
            params += "&t20=" + jt.enc(t20); }
        if(pensearch.params.includeLurkers) {
            params += "&lurkers=include"; }
        jt.call('GET', "srchpens?" + params, null,
                 function (results) {
                     displayPenSearchResults(results); },
                 app.failf(function (code, errtxt) {
                     jt.out('searchresults', 
                             "error code: " + code + " " + errtxt); }),
                 critsec);
    },


    reset: function () {
        app.pen.currPenRef().actdisp = null;
    }


}; //end of returned functions
}());


