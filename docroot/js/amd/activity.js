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
//     reps: obj for tracking display of extra reviews per person per day
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
        topModeEnabled = false,   //need to finish loading basics first
        topActivityType = "",  //book or whatever review type is selected
        topDispMax = 20,  //max top reviews to display
        remActivityType = "",  //by default display all remembered reviews
        announcedismiss = false,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    revTypeSelectorHTML = function (funcname) {
        var reviewTypes, divc = [], i, typename, title, dispclass, csel, html;
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            title = typename.capitalize() + " reviews";
            dispclass = "reviewbadge";
            csel = topActivityType;
            if(funcname === "remtype") {
                csel = remActivityType; }
            if(typename === csel) {
                dispclass = "reviewbadgedis"; }
            divc.push(["img", {cla: dispclass,
                               src: "img/" + reviewTypes[i].img,
                               title: title, alt: title,
                               onclick: jt.fs("app.activity." + funcname +
                                              "('" + typename + "')")}]); }
        html = ["div", {id: "revtypeseldiv"}, divc];
        html = jt.tac2html(html);
        return html;
    },


    writeNavDisplay = function (dispmode) {
        var html, recent, top, url, rsslink, remall;
        if(dispmode === "activity") {
            if(activityMode === "amnew") {
                recent = ["span", {cla: "actmodesel"},
                          "Recent"];
                if(topModeEnabled) {
                    top = ["a", {href: "#", title: "Show top reviews",
                                 onclick: jt.fs("app.activity.switchmode" +
                                                "('amtop')")},
                           "Top"]; }
                else {
                    top = ["span", {cla: "actmodeseldis"},
                           "Top"]; } }
            else { //activityMode === "amtop"
                recent = ["a", {href: "#", title: "Show recent reviews",
                                onclick: jt.fs("app.activity.switchmode" + 
                                               "('amnew')")},
                          "Recent"];
                top = ["span", {cla: "actmodesel"},
                       "Top"]; }
            url = "rssact?pen=" + app.pen.currPenId();
            rsslink = ["a", {href: url, id: "rsslink",
                             title: "RSS feed for recent friend reviews",
                             onclick: jt.fs("window.open('" + url + "')")},
                       ["img", {cla: "rssico", src: "img/rssicon.png"}]];
            html = ["table",
                    ["tr",
                     [["td", {id: "toptd"}, top],
                      ["td", revTypeSelectorHTML("toptype")],
                      ["td", "|"],
                      ["td", recent],
                      ["td", rsslink]]]]; }
        else if(dispmode === "memo") {
            if(!remActivityType) {
                remall = ["span", {cla: "actmodesel"},
                          "All"]; }
            else {
                remall = ["a", {href: "#", title: "Show all remembered reviews",
                                onclick: jt.fs("app.activity.remtype('')")},
                          "All"]; }
            html = ["table",
                    ["tr",
                     [["td", "Remembered"],
                      ["td", {id: "alltd"}, remall],
                      ["td", revTypeSelectorHTML("remtype")]]]]; }
        html = jt.tac2html(html);
        app.layout.headingout(html);
        jt.out('rightcoldiv', "");
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
        var pensearch, params, pen, rel;
        pensearch = app.pen.currPenRef().pensearch || {};
        params = pensearch.params || {};
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
            params;
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
                    if(!remActivityType || 
                       revref.rev.revtype === remActivityType) {
                        remitems.push(app.profile.reviewItemHTML(
                            revref.rev, revref.rev.penNameStr)); } } }
            hint = "If you see a review worth remembering, click its " + 
                "\"Remember\" button to keep a reference to it here.";
            if(remitems.length === 0) {  //no reviews currently remembered
                remitems.push(["li", "You have not remembered any " + 
                               remActivityType +
                               (remActivityType ? " " : "") +
                               "reviews. " + hint]); }
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
                    jt.semaphore("activity.displayRemembered")); }
    },


    isLameTopRev = function (revrefs, revref) {
        var lame = false, i;
        //the review may not be cached yet, but if it is, then check
        //to see if it should be included in the results.
        if(revref.rev) { 
            if(!revref.rev.rating || revref.rev.rating < 69) {
                lame = true; }  //mediocre ratings not useful here
            for(i = 0; i < revrefs.length; i += 1) {
                if(revref.rev.cankey === revrefs[i].rev.cankey) {
                    lame = true;  //dupes not valid
                    break; } } }
        return lame;
    },


    findUniqueRev = function (revrefs, revids) {
        var revref, i;
        for(i = 0; !revref && i < revids.length; i += 1) {
            revref = app.lcs.getRevRef(revids[i]);
            if(!revref) {  //might be null if deleted...
                revref = null; }
            else if(revref.status !== "ok" && revref.status !== "not cached") { 
                revref = null; }  //bad ids not valid for consideration
            else if(revref.rev && isLameTopRev(revrefs, revref)) {
                revref = null; } }
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


    verifyPenNameStrFromCached = function (revref) {
        var penref;
        if(revref.rev && !revref.rev.penNameStr) {
            penref = app.lcs.getPenRef(revref.rev.penid);
            if(penref.pen) {  //should already be cached
                revref.rev.penNameStr = penref.pen.name; } }
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
            if(revref.rev && !isLameTopRev(revs, revref)) {
                verifyPenNameStrFromCached(revref);
                revs.push(revref);
                revitems.push(["li", app.profile.reviewItemHTML(revref.rev, 
                                                   revref.rev.penNameStr)]); } }
        if(revs.length === 0) {
            revitems.push(["li", "No " + topActivityType + " reviews found"]); }
        html = ["ul", {cla: "revlist"}, revitems];
        html = jt.tac2html(html);
        jt.out('revactdiv', html);
        app.layout.adjust();
        writeNavDisplay("activity");  //reflect the selected type
    },


    moreRevsFromHTML = function (key, rev) {
        var html = ["li",
                    ["div", {cla: "morerevs"},
                     ["a", {href: "#" + key,
                            onclick: jt.fs("app.activity.toggleExtraRevs('" +
                                           key + "')"),
                            id: "toga" + key},
                      "+ more reviews by " + jt.ndq(rev.penNameStr) + 
                      " from " + 
                      jt.colloquialDate(jt.ISOString2Day(rev.modified))]]];
        html = jt.tac2html(html);
        return html;
    },


    followNewTipstersAndRedisplay = function (tries, pens) {
        var i, contfunc, outrels = app.rel.outboundids();
        if(outrels.length >= 3 || tries >= 20) {  //done adding new followers
            app.activity.displayActive(); }
        else {  //follow someone
            contfunc = function (orgpen, relpen, newrel) {
                followNewTipstersAndRedisplay(tries + 1, pens); };
            for(i = 0; i < pens.length; i += 1) {
                if(jt.instId(pens[i]) && !penSearchFiltered(pens[i])) {
                    jt.out('revactdiv', "Following " + pens[i].name + "...");
                    app.rel.follow(pens[i], contfunc);
                    break; } }
            if(i === pens.length) {  //did not find anyone to follow
                app.activity.displayActive(); } }
    },


    autofollow = function () {
        jt.out('revactdiv', "Finding top tipsters...");
        jt.call('GET', "srchpens?" + app.login.authparams(), null,
                 function (results) {
                     jt.out('revactdiv', 
                            "Found " + results.length + " tipsters.");
                     followNewTipstersAndRedisplay(0, results); },
                 app.failf(function (code, errtxt) {
                     jt.out('searchresults', 
                             "error code: " + code + " " + errtxt); }),
                jt.semaphore("activity.autofollow"));
    },


    displayIntroductionsNotice = function () {
        var html;
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"},"Making Introductions For You"],
                ["p",
                 "To help start things off, wdydfun is now introducing you to some active members you might enjoy following. You can change who you are following anytime from your profile page."],
                ["div", {cla: "headingtxt"},
                 ["button", {type: "button", id: "introduceok",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null, 
                               function () {
                                   jt.byId('introduceok').focus(); });
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
                    [["tr",
                      [["td", text],
                       ["td", app.activity.searchPensLinkHTML()]]]]];
            html = jt.tac2html(html); }
        return html;
    },


    getFullRequestLinkHTML = function (penref, tlnk) {
        var linktxt = [];
        if(penref.pen.profpic) {
            linktxt.push(["img", {cla: "smallbadge", 
                                  src: "profpic?profileid=" + penref.penid}]);
            linktxt.push("&nbsp;"); }
        linktxt.push(penref.pen.name + " has requested a ");
        linktxt.push(tlnk);
        linktxt.push(" review");
        return linktxt;
    },


    updateReqLinkTxt = function (penref) {
        var reqlink, tlnk, html = "";
        reqlink = jt.byId("reqlink");
        if(reqlink) {
            if(penref.pen && reqlink.innerHTML.endsWith(" request")) {
                tlnk = reqlink.innerHTML.slice(0, (-1 * " request".length));
                html = jt.tac2html(getFullRequestLinkHTML(penref, tlnk)); }
            reqlink.innerHTML = html; }
    },


    activeRequestsLoadedHTML = function () {
        var reqs, i, rows = [], penref, rtype, tlnk, linktxt, html = "";
        reqs = app.pen.currPenRef().inreqs;
        for(i = 0; i < reqs.length && i < 3; i += 1) {
            rtype = app.review.getReviewTypeByValue(reqs[i].revtype);
            tlnk = ["span", {cla: "reqrevtypespan"},
                    [["img", {cla: "smallbadge", src: "img/" + rtype.img}],
                     "&nbsp;" + reqs[i].revtype]];
            linktxt = "";
            penref = app.lcs.getPenRef(reqs[i].fromid);
            if(penref.pen) {
                linktxt = getFullRequestLinkHTML(penref, tlnk); }
            else if(penref.status === "not cached") {
                linktxt = jt.tac2html(tlnk) + " request";
                app.lcs.getPenFull(reqs[i].fromid, updateReqLinkTxt); }
            rows.push(["li", {cla: "reqli"},
                       ["a", {id: "reqlink" + penref.penid,
                              href: "#request", title: "View request",
                              onclick: jt.fs("app.activity.showreq(" + 
                                             i + ")") },
                        linktxt]]); }
        if(rows.length > 0) {
            html = ["ul", {cla: "reqlist"},
                    rows]; }
        return jt.tac2html(html);
    },


    activeRequestsHTML = function () {
        var selfref, params, html = "";
        selfref = app.pen.currPenRef();
        if(!selfref.inreqs) {
            selfref.inreqs = [];  //don't loop on server call crash
            params = app.login.authparams() + "&toid=" + selfref.penid;
            jt.call('GET', "findreqs?" + params, null,
                    function (reqs) {
                        reqs.sort(function (a, b) {
                            if(a.modified > b.modified) { return -1; }
                            if(a.modified < b.modified) { return 1; }
                            return 0; });
                        selfref.inreqs = reqs;
                        jt.out("activereqsdiv", activeRequestsLoadedHTML()); },
                    app.failf,
                    jt.semaphore("activity.activeRequestsHTML")); }
        else { 
            html = activeRequestsLoadedHTML(); }
        return html;
    },


    announcementHTML = function () {
        var html = "", url, nowiso;
        if(!announcedismiss) {
            nowiso = new Date().toISOString();
            if(nowiso > "2014-02-11T00:00:00Z" && 
               nowiso < "2014-02-11T23:59:59Z") {
                url = "https://thedaywefightback.org";
                html = ["div", {cla: "announcecontent"},
                        [["a", {cla: "cmtdelex", id: "announcex", 
                                href: "#dismiss announcement",
                                onclick: jt.fs("app.activity.announcex()")},
                          "(x)&nbsp;"],
                         ["a", {href: url,
                                onclick: "window.open('" + url + "');" + 
                                         "return false;"},
                          "It's shutdown mass surveillance day! " + url]]];
                html = jt.tac2html(html); } }
        return html;
    },


    repkey = function (rev, rsq) {
        //day modified + repetition sequence number + who wrote it
        return rev.modified.slice(0, 10) + "_" + rsq + "_" + rev.penid;
    },


    dispRevActItemsHTML = function (actdisp) {
        var revrefs, rev, i, breakid, html = [], key, repobj, liato, rsq = 0;
        actdisp.reps = {};
        revrefs = actdisp.revrefs;
        if(revrefs.length === 0) {
            html.push(["li", "None of the people you are following have" + 
                            " posted any reviews recently."]); }
        for(i = 0; i < revrefs.length; i += 1) {
            rev = revrefs[i].rev;
            key = repkey(rev, rsq);
            actdisp.reps[key] = actdisp.reps[key] || { count: 0, hidden: [] };
            repobj = actdisp.reps[key];
            liato = { id: "li" + jt.instId(rev) };
            if(repobj.count < 2) {  //display latest 2 revs/day/pen
                liato.style = "";
                html.push(app.profile.reviewItemHTML(rev, rev.penNameStr)); }
            else {
                liato.style = "display:none;";
                repobj.hidden.push(jt.instId(rev));
                html.push(app.profile.reviewItemHTML(rev, rev.penNameStr,
                                                     liato)); }
            repobj.count += 1;
            if(repobj.count >= 3 && 
                   ((i >= revrefs.length - 1) ||
                    (i < revrefs.length - 1 &&
                     repkey(revrefs[i + 1].rev, rsq) !== key))) {
                rsq += 1;
                html.push(moreRevsFromHTML(key, rev)); }
            if(!rev.penNameStr) {
                breakid = rev.penid;
                break; } }
        if(breakid) {  //need to fetch pen
            setTimeout(function () {
                app.lcs.getPenFull(breakid, function (penref) {
                    app.activity.notePenNameStr(penref.pen); }); },
                       50); }
        else {  //redisplay if any review linkages have changed
            setTimeout(function () {
                app.lcs.verifyReviewLinks(
                    app.activity.displayReviewActivity); }, 
                       250); }
        return html;
    },


    displayReviewActivity = function () {
        var actdisp, itemhtml, html;
        topModeEnabled = true;
        writeNavDisplay("activity");
        actdisp = app.pen.currPenRef().actdisp;
        itemhtml = dispRevActItemsHTML(actdisp);
        html = [["div", {id: "announcementdiv"},
                 announcementHTML()],
                ["div", {id: "pendingqcsdiv"},
                 app.revresp.pendingCommentsHTML()],
                ["div", {id: "activereqsdiv"},
                 activeRequestsHTML()],
                ["ul", {cla: "revlist"}, 
                 itemhtml]];
        if(actdisp.cursor) {
            html.push(["a", {href: "#moreact",
                             onclick: jt.fs("app.activity.moreact()"),
                             title: "More activity"},
                       "more activity..."]); }
        else if(itemhtml.length < 3) {
            html.push(followMoreHTML(null, true)); }
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
        var actdisp, time, penids, params;
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
                jt.semaphore("activity.doActivitySearch"));
    },


    bootActivityDisplay = function () {
        var penids;
        topModeEnabled = false;
        writeNavDisplay("activity");
        penids = app.rel.outboundids();
        if(penids.length === 0) {
            jt.out('revactdiv', followMoreHTML(penids));
            app.layout.adjust(); }
        else if((penids[penids.length - 1] === "waiting") ||
                (penids[penids.length - 1] === "loading")) {
            jt.out('revactdiv', "Loading relationships...");
            app.layout.adjust();
            setTimeout(bootActivityDisplay, 100);
            return; }
        if(!app.pen.currPenRef().helpful) {
            jt.out('revactdiv', "Loading helpful...");
            app.layout.adjust();
            app.revresp.loadHelpful(bootActivityDisplay);
            return; }
        app.pen.currPenRef().actdisp = {
            revrefs: [], 
            cursor: "",
            reps: {} };
        if(penids.length > 0) {
            jt.out('revactdiv', "Loading activity...");
            app.layout.adjust();
            doActivitySearch(); }
        else { //not following anyone, make introductions
            displayIntroductionsNotice();
            autofollow(); }
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
            app.layout.updateNavIcons("memo");
            displayRemembered(); }
        else {  //dispmode === "activity"
            app.layout.updateNavIcons("activity");
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
                ["div", {cla: "headingtxt"},"Recommended pen names to follow"],
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
                   ["td", {cla: "formstyle", colspan: 2, align: "right"},
                    ["span", {id: "srchoptstoggle", cla: "formstyle"},
                     ["a", {href: "#searchoptions", id: "srchoptstogglehref",
                            title: "search options",
                            onclick: jt.fs("app.activity.togglesrchopts()")},
                      "show advanced search options"]]]]]],
                searchOptionsHTML(),
                ["div", {id: "searchresults"}]];
        html = jt.tac2html(html);
        app.layout.openDialog({x:180, y:140}, html);
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


    displayReviewActivity: function () {
        displayReviewActivity();
    },


    toggleExtraRevs: function (key) {
        var toga, repobj, disp, i, li;
        toga = jt.byId("toga" + key);
        if(toga) {
            repobj = app.pen.currPenRef().actdisp.reps[key];
            if(toga.text.indexOf("+ more") === 0) {
                disp = "block";
                toga.text = "- less" + toga.text.slice("+ more".length); }
            else {
                disp = "none";
                toga.text = "+ more" + toga.text.slice("- less".length); }
            for(i = 0; i < repobj.hidden.length; i += 1) {
                li = jt.byId("li" + repobj.hidden[i]);
                li.style.display = disp; } }
    },


    searchPensLinkHTML: function () {
        return jt.imgntxt("follow.png", "Find Recommended Pen Names",
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


    activityLinkHTML: function (mode) {
        var html, imgsrc = "friendact.png";
        if(!mode) {
            mode = app.layout.currnavmode(); }
        if(mode === "activity") {
            imgsrc = "friendactsel.png"; }
        html = ["div", {cla: "topnavitemdiv"},
                jt.imgntxt(imgsrc, "",
                           "app.activity.displayActive()",
                           "#Activity",
                           "Show reviews from friends")];
        html = jt.tac2html(html);
        return html;
    },


    rememberedLinkHTML: function (mode) {
        var html, imgsrc = "remembered.png";
        if(!mode) {
            mode = app.layout.currnavmode(); }
        if(mode === "memo") {
            imgsrc = "rememberedsel.png"; }
        html = ["div", {cla: "topnavitemdiv"},
                jt.imgntxt(imgsrc, "",
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
        activityMode = "amtop";
        topActivityType = typestr;
        mainDisplay("activity");
    },


    remtype: function (typestr) {
        remActivityType = typestr;
        writeNavDisplay("memo");
        displayRemembered();
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
        var pensearch, params, qstr, time, t20, i;
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
                jt.semaphore("activity.searchPens"));
    },


    reset: function () {
        app.pen.currPenRef().actdisp = null;
    },


    showreq: function (index) {
        var req, pen, keywords = "", titlehtml = [], rtype, html;
        req = app.pen.currPenRef().inreqs[index];
        pen = app.lcs.getPenRef(req.fromid).pen;
        rtype = app.review.getReviewTypeByValue(req.revtype);
        if(req.keywords) {
            keywords = "(" + req.keywords + ")"; }
        if(pen.profpic) {
            titlehtml.push(["img", {cla: "profpicsmall",
                                    src: "profpic?profileid=" +
                                          jt.instId(pen)}]);
            titlehtml.push("&nbsp;"); }
        titlehtml.push(pen.name + " has requested a ");
        titlehtml.push(["span", {cla: "reqrevtypespan"},
                        [["img", {cla: "revtypeimg", 
                                  src: "img/" + rtype.img}],
                         "&nbsp;" + req.revtype]]);
        titlehtml.push(" review");
        html = [
            ["div", {cla: "dlgclosex"},
             ["a", {id: "closedlg", href: "#close",
                    onclick: jt.fs("app.layout.closeDialog()")},
              "&lt;close&nbsp;&nbsp;X&gt;"]],
            ["div", {cla: "floatclear"}],
            ["div", {cla: "headingtxt"}, 
             titlehtml],
            ["div", {cla: "reqkeywordsdiv"},
             keywords],
            ["div", {id: "requestbuttonsdiv"},
             [["button", {type: "button", id: "cancelbutton",
                          onclick: jt.fs("app.layout.closeDialog()")},
               "Cancel"],
              "&nbsp;",
              ["button", {type: "button", id: "denyreqbutton",
                          onclick: jt.fs("app.activity.denyRequest(" + 
                                         index + ")")},
               "Deny Request"],
              "&nbsp;",
              ["button", {type: "button", id: "writereqrevbutton",
                          onclick: jt.fs("app.activity.writeReqRev(" +
                                         index + ")")},
               "Write Review"]]]];
        app.layout.openDialog({x:100, y:140}, jt.tac2html(html));
    },


    denyRequest: function (index) {
        var req, data;
        app.layout.closeDialog();
        req = app.pen.currPenRef().inreqs[index];
        app.pen.currPenRef().inreqs.splice(index, 1);
        req.status = "denied";
        data = jt.objdata(req);
        jt.call('POST', "updreq?" + app.login.authparams(), data,
                function (updreqs) {
                    app.activity.displayActive(); },
                app.failf,
                jt.semaphore("activity.denyRequest"));
    },


    //Write the requested review
    writeReqRev: function (index) {
        var req = app.pen.currPenRef().inreqs[index];
        app.layout.closeDialog();
        app.review.cancelReview(true, req.revtype);
    },


    fulfillRequests: function (review) {
        var reqs, i, data, keepgoingfunc;
        reqs = app.pen.currPenRef().inreqs;
        keepgoingfunc = function (newreqs) {
            app.activity.fulfillRequests(review); };
        for(i = 0; i < reqs.length; i += 1) {
            //matches even if the keywords aren't all accounted for.
            //Requestor can resubmit if they want more.
            if(reqs[i].revtype === review.revtype) {
                reqs[i].status = "fulfilled";
                data = jt.objdata(reqs[i]);
                app.pen.currPenRef().inreqs.splice(i, 1);
                //no semaphore. ok to be fulfilling several at once
                jt.call('POST', "updreq?" + app.login.authparams(), data,
                        keepgoingfunc,
                        app.failf);
                break; } }
    },


    announcex: function () {
        announcedismiss = true;
        jt.out('announcementdiv', "");
    }


}; //end of returned functions
}());


