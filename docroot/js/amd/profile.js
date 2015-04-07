/*global alert: false, confirm: false, setTimeout: false, window: false, document: false, app: false, jt: false, JSON: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display a pen name and provide for updating settings.  Cached data
// off the currently displayed pen name reference:
//
//   penref.profstate:
//     seltabname: name of selected display tab
//     revtype: name of selected review type
//     searchState:
//       srchval: the search query value
//       cursor: cursor for continuing to load more matching reviews
//       total: count of reviews searched
//       reqs: count of times the search was manually requested
//       revs: matching fetched reviews
//       autopage: timeout for auto paging to max when no matches found
//       querymon: timeout for monitoring the query input string
//     recentRevState:
//       params: parameters for search
//       results: recent reviews found
//       cursor: cursor for continuing to load more recent reviews
//       total: count of records searched so far
//

app.profile = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var profpenref,
        authtypes = { mid: "FGFweb",
                      gsid: "Google+",
                      fbid: "Facebook",
                      twid: "Twitter",
                      ghid: "GitHub" },
        revsrchstate = null,
        recencyDays = 30,
        dayMillis = 24 * 60 * 60 * 1000,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    verifyProfileState = function (penref) {
        if(!penref) {
            penref = profpenref; }
        if(penref.pen && typeof penref.pen.top20s === "string") {
            penref.pen.top20s = JSON.parse(penref.pen.top20s); }
        if(!penref.profstate) {
            penref.profstate = { seltabname: 'latest',
                                 revtype: "" }; }
        if(!penref.profstate.revtype) {
            penref.profstate.revtype = 'all'; }
    },


    //Drop all cached information from the given penref and rebuild
    //it.  The state should be dropped if a review was created or
    //updated.  It does not yet make sense to attempt to recompute
    //things locally in addition to on the server.  Ultimately saving
    //a review might insert/replace the newrev from the recent
    //reviews, insert into state if matched, and reload the top20s
    //(if the pen wasn't just loaded).  For now this just clears the
    //local cache to trigger a rebuild.
    resetReviewDisplays = function (penref) {
        penref.profstate = null;
        verifyProfileState(penref);
    },


    tallyInLinks = function (penref) {
        var linksummary, inlinks, i;
        linksummary = { helpful: 0, helpsrc: 0, 
                        remembered: 0, remsrc: 0,
                        corresponding: 0, correspsrc: 0 };
        inlinks = penref.inlinks;
        for(i = 0; i < inlinks.length; i += 1) {
            if(inlinks[i].helpful) {
                linksummary.helpful += inlinks[i].helpful.
                    split(",").length;
                linksummary.helpsrc += 1; }
            if(inlinks[i].remembered) {
                linksummary.remembered += inlinks[i].remembered.
                    split(",").length;
                linksummary.remsrc += 1; }
            if(inlinks[i].corresponding) {
                linksummary.corresponding += inlinks[i].corresponding.
                    split(",").length;
                linksummary.correspsrc += 1; } }
        return linksummary;
    },


    displayInboundLinkIndicator = function () {
        var penref, html = "", count;
        penref = app.pen.currPenRef();
        if(!penref.linksummary) {
            if(!penref.inlinks) {
                //fetch is low prio, don't compete with startup processing
                setTimeout(function () {
                    var params;
                    params = "penid=" + jt.instId(penref.pen) + "&" + 
                        app.login.authparams();
                    jt.call('GET', "inlinks?" + params, null,
                            function (inlinks) {
                                penref.inlinks = inlinks;
                                displayInboundLinkIndicator(); },
                            app.failf,
                            jt.semaphore("profile.dispInbLinkInd")); }, 1200);
                return; }
            penref.linksummary = tallyInLinks(penref); }
        count = penref.linksummary.helpful + penref.linksummary.remembered +
            penref.linksummary.corresponding;
        if(count) {
            html = ["a", {href: "#profile",
                          onclick: jt.fs("app.profile.display()")},
                    ["span", {cla: "inlinkspan",
                              title: "helpful: " + 
                                  penref.linksummary.helpful +
                                  ", remembered: " + 
                                  penref.linksummary.remembered + 
                                  ", corresponding: " +
                                  penref.linksummary.corresponding},
                    String(count)]];
            html = jt.tac2html(html); }
        jt.out('profstarhdiv', html);
    },


    displayAuthSettings = function (domid, pen) {
        var html;
        if(pen.pen) {  //got a penref, adjust accordingly
            pen = pen.pen; }
        html = [
            "Access \"" + pen.name + "\" via: ",
            ["table",
             [["tr",
               [["td",  //native app
                 [["input", {type: "checkbox", name: "aamid", id: "aamid",
                             value: authtypes.mid,
                             checked: jt.toru(jt.isId(pen.mid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "mid','" + domid + "')")}],
                  ["label", {fo: "aamid"}, authtypes.mid]]]]],
              ["tr",
               [["td", {cla: "authcbtd"},  //Facebook
                 [["input", {type: "checkbox", name: "aafbid", id: "aafbid",
                             value: authtypes.fbid,
                             checked: jt.toru(jt.isId(pen.fbid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "fbid','" + domid + "')")}],
                  ["label", {fo: "aafbid"}, authtypes.fbid]]],
                ["td", {cla: "authcbtd"},  //Twitter
                 [["input", {type: "checkbox", name: "aatwid", id: "aatwid",
                             value: authtypes.twid,
                             checked: jt.toru(jt.isId(pen.twid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "twid','" + domid + "')")}],
                  ["label", {fo: "aatwid"}, authtypes.twid]]]]],
              ["tr",
               [["td", {cla: "authcbtd"},  //Google+
                 [["input", {type: "checkbox", name: "aagsid", id: "aagsid",
                             value: authtypes.gsid,
                             checked: jt.toru(jt.isId(pen.gsid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "gsid','" + domid + "')")}],
                  ["label", {fo: "aagsid"}, authtypes.gsid]]],
                ["td", {cla: "authcbtd"},  //GitHub
                 [["input", {type: "checkbox", name: "aaghid", id: "aaghid",
                             value: authtypes.ghid,
                             checked: jt.toru(jt.isId(pen.ghid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "ghid','" + domid + "')")}],
                  ["label", {fo: "aaghid"}, authtypes.ghid]]]]]]]];
        jt.out(domid, jt.tac2html(html));
    },


    addMORAuth = function (domid, pen) {
        jt.out(domid, "Logging in via fgfweb...");
        app.redirectToSecureServer({special: "nativeonly"});
    },


    handleAuthChangeToggle = function (pen, authtype, domid) {
        var action = "remove", methcount, previd;
        if(jt.byId("aa" + authtype).checked) {
            action = "add"; }
        if(action === "remove") {
            methcount = (pen.mid? 1 : 0) +
                (pen.gsid? 1 : 0) +
                (pen.fbid? 1 : 0) +
                (pen.twid? 1 : 0) +
                (pen.ghid? 1 : 0);
            if(methcount < 2) {
                alert("You must have at least one authentication type.");
                jt.byId("aa" + authtype).checked = true;
                return;  } 
            if(authtype === app.login.getAuthMethod()) {
                alert("You can't remove the authentication you are " +
                      "currently logged in with.");
                jt.byId("aa" + authtype).checked = true;
                return;  } 
            if(confirm("Remove access to \"" + pen.name + "\" from " +
                       authtypes[authtype] + "?")) {
                jt.out(domid, "Updating...");
                previd = pen[authtype];
                pen[authtype] = 0;
                app.pen.updatePen(pen,
                                  function (updpen) {
                                      displayAuthSettings(domid, updpen); },
                                  function (code, errtxt) {
                                      jt.err("handleAuthChangeToggle error " +
                                              code + ": " + errtxt);
                                      pen[authtype] = previd;
                                      displayAuthSettings(domid, pen); }); }
            else {
                jt.byId("aa" + authtype).checked = true; } }
        else if(action === "add") {
            switch(authtype) {
            case "mid": 
                addMORAuth(domid, pen); break;
            case "fbid": 
                app.facebook.addProfileAuth(domid, pen); break;
            case "twid":
                app.twitter.addProfileAuth(domid, pen); break;
            case "gsid":
                app.googleplus.addProfileAuth(domid, pen); break;
            case "ghid":
                app.github.addProfileAuth(domid, pen); break;
            } }
    },


    findOrLoadPen = function (penid, callback) {
        app.lcs.getFull("pen", penid, function (penref) {
            callback(penref.pen); });
    },


    profileItemHTML = function (rev) {
        var html, revid = jt.instId(rev), prefix = "prd";
        html = ["div", {cla: "profrevdiv", id: prefix + revid},
                app.review.revdispHTML(prefix, revid, rev)];
        return html;
    },


    typematchProfileItemHTML = function (rev) {
        var revtype = app.layout.getType();
        if(revtype === "all" || revtype === rev.revtype) {
            return profileItemHTML(rev); }
        return "";
    },


    typeOrBlank = function (typename) {
        if(typename && typename !== "all") {
            return typename; }
        return "";
    },


    displayRecentReviews = function (rrs, reviews) {
        var revtype, revitems = [], i, text, html, fetched;
        revtype = app.layout.getType();
        if(!rrs.results) {
            rrs.results = []; }
        for(i = 0; i < rrs.results.length; i += 1) {
            revitems.push(typematchProfileItemHTML(rrs.results[i])); }
        if(reviews) {  //have fresh search results
            rrs.cursor = "";
            for(i = 0; i < reviews.length; i += 1) {
                if(reviews[i].fetched) {
                    fetched = reviews[i].fetched;
                    if(typeof fetched === "number" && fetched >= 0) {
                        rrs.total += reviews[i].fetched;
                        revitems.push(["div", {cla: "sumtotal"},
                                       String(rrs.total) + 
                                       " membics searched"]); }
                    if(reviews[i].cursor) {
                        rrs.cursor = reviews[i].cursor; }
                    break; }  //if no reviews, i will be left at zero
                app.lcs.put("rev", reviews[i]);  //ensure cached
                rrs.results.push(reviews[i]);
                revitems.push(typematchProfileItemHTML(reviews[i])); } }
        rrs.total = Math.max(rrs.total, rrs.results.length);
        if(rrs.total === 0) {
            text = "No recent " + typeOrBlank(revtype) + " membics";
            if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
                text += " " + app.review.reviewLinkHTML(); }
            revitems.push(["div", {cla: "fpinlinetextdiv"}, text]); }
        html = [];
        if(rrs.total > 0) {
            html.push(["div", {cla: "tabcontentheadertext"},
                       "Membics in the past " + recencyDays + " days"]); }
        html.push(["div", {cla: "profilereviewsdiv"}, revitems]);
        if(rrs.cursor) {
            if(i === 0 && rrs.results.length === 0) {
                if(rrs.total < 2000) {  //auto-repeat search
                    setTimeout(app.profile.revsmore, 10); } 
                else {
                    html.push(["div", {cla: "fpinlinetextdiv"},
                               "No recent membics, only batch updates."]); } }
            else {
                html.push(["a", {href: "#continuesearch",
                                 onclick: jt.fs("app.profile.revsmore()"),
                                 title: "More membics"},
                           "more membics..."]); } }
        jt.out('profcontdiv', jt.tac2html(html));
    },


    //It is possible have created a new review and not have it be
    //found by the search processing due to database lag.  Walk the
    //cache to make sure there is nothing newer there.  Do not fault
    //in anything older than a day since the db should have been
    //stable by then and pulling older stuff from the cache ends up
    //displaying things that aren't actually recent.
    sanityCompleteRevsViaCache = function(rrs, revs) {
        var modified = new Date().getTime();
        modified -= dayMillis;
        modified = new Date(modified).toISOString();
        if(revs && revs.length > 0) {
            modified = revs[0].modified; }
        rrs.results = app.lcs.findNewerReviews(rrs.params.penid, modified);
    },


    findRecentReviews = function (rrs) {  //recentRevState
        var params;
        params = jt.objdata(rrs.params) + "&" + app.login.authparams();
        if(rrs.cursor) {
            params += "&cursor=" + jt.enc(rrs.cursor); }
        jt.call('GET', "srchrevs?" + params, null,
                function (revs) {
                    if(profpenref.profstate.seltabname !== "latest") {
                        //switched tabs before we came back. Bail out.
                        profpenref.profstate.recentRevState = null;
                        return; }
                    sanityCompleteRevsViaCache(rrs, revs);
                    displayRecentReviews(rrs, revs); },
                app.failf(function (code, errtxt) {
                    jt.out('profcontdiv', "findRecentReviews failed code " + 
                           code + " " + errtxt); }),
                jt.semaphore("profile.findRecentReviews"));
    },


    displayRecent = function () {
        var rrs, html, maxdate, mindate;
        app.layout.displayTypes(displayRecent);
        if(profpenref.profstate.recentRevState) {
            return displayRecentReviews(profpenref.profstate.recentRevState); }
        html = "Retrieving recent activity for " + profpenref.pen.name + "...";
        jt.out('profcontdiv', html);
        profpenref.profstate.recentRevState = rrs = { 
            params: {},
            cursor: "",
            results: [],
            total: 0 };
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (recencyDays * dayMillis));
        rrs.params.maxdate = maxdate.toISOString();
        rrs.params.mindate = mindate.toISOString();
        rrs.params.penid = jt.instId(profpenref.pen);
        findRecentReviews(rrs);
    },


    revTypeSelectorImgSrc = function (typename, selected) {
        var type;
        if(selected || typename === profpenref.profstate.revtype) {
            return "img/merit/Merit" + typename.capitalize() + "20.png"; }
        type = app.review.getReviewTypeByValue(typename);
        return "img/" + type.img;
    },


    revTypeSelectorHTML = function (clickfuncstr) {
        var html, i, reviewTypes, typename, label, imgsrc, pen, prefixstr,
            tlink = { tabname: "allrevs", dispname: "All"};
        prefixstr = "Top 20 ";
        if(clickfuncstr && clickfuncstr.indexOf("Top") < 0) {
            prefixstr = "20+ "; }
        pen = profpenref.pen;
        html = [];
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            imgsrc = revTypeSelectorImgSrc(typename);
            label = "No " + reviewTypes[i].type.capitalize() + " membics";
            if(pen.top20s[typename]) {
                if(pen.top20s[typename].length >= 20) {
                    label = prefixstr + reviewTypes[i].type.capitalize() +
                        " membics"; }
                else if(pen.top20s[typename].length >= 1) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].type.capitalize() + " membics"; } }
            html.push(["img", {cla: "reviewbadge", id: "rtsimg" + typename,
                               src: imgsrc, title: label, alt: label,
                               onmouseover: jt.fs("app.profile.mrollrts('" +
                                                  typename + "','over')"),
                               onmouseout: jt.fs("app.profile.mrollrts('" +
                                                 typename + "','out')"),
                               onclick: jt.fs(clickfuncstr + "('" + 
                                              typename + "')")}]); }
        if(clickfuncstr && clickfuncstr.indexOf("revsearch") >= 0) {
            tlink = { tabname: "best", dispname: "Top" }; }
        html = ["table", {id: "revtypeseltable"},
                ["tr",
                 [["td", {cla: (app.winw < 400 ? "tdwide" : "")}, html],
                  ["td", " | "],
                  ["td",
                   ["div", {id: "showalltoplinkdiv", cla: "tabmodediv"},
                    ["a", {href: "#toggleshowalltop",
                           onclick: jt.fs("app.profile.tabsel('" +
                                          tlink.tabname + "')")},
                     "Show " + tlink.dispname]]]]]];
        return jt.tac2html(html);
    },


    fetchAllFavorites = function () {
        var t20, params;
        t20 = profpenref.pen.top20s || {};
        t20.all = t20.all || [];
        t20.all = t20.all.concat(t20.book || []);
        t20.all = t20.all.concat(t20.movie || []);
        t20.all = t20.all.concat(t20.video || []);
        t20.all = t20.all.concat(t20.music || []);
        t20.all = t20.all.concat(t20.food || []);
        t20.all = t20.all.concat(t20.drink || []);
        t20.all = t20.all.concat(t20.activity || []);
        t20.all = t20.all.concat(t20.other || []);
        profpenref.pen.top20s = t20;
        params = "revids=" + t20.all.join(",") + "&" + app.login.authparams();
        jt.call('GET', "revbyid?" + params, null,
                function (revs) {
                    app.lcs.putAll("rev", revs);
                    profpenref.pen.top20s.all.sort(function (a, b) {
                        var rra, rrb;
                        rra = app.lcs.getRef("rev", a);
                        rrb = app.lcs.getRef("rev", b);
                        if(rra.rev && !rrb.rev) { return -1; }
                        if(rrb.rev && !rra.rev) { return 1; }
                        if(rra.rev.modified > rrb.rev.modified) { return -1; }
                        if(rra.rev.modified < rrb.rev.modified) { return 1; }
                        return 0; });
                    app.profile.refresh(); },
                app.failf(function (code, errtxt) {
                    jt.out('profcontdiv', "fetchAllFavorites failed code " +
                           code + ": " + errtxt); }),
                jt.semaphore("profile.fetchAllFavorites"));
    },


    displayFavorites = function () {
        var revtype, revs = [], text, revitems = [], html, i, revref;
        app.layout.displayTypes(displayFavorites);
        revtype = app.layout.getType();
        if(!profpenref.pen.top20s || !profpenref.pen.top20s.all) {
            html = ["div", {cla: "profilereviewsdiv"},
                    ["div", {cla: "fpinlinetextdiv"}, "Fetching favorites..."]];
            jt.out('profcontdiv', jt.tac2html(html));
            return fetchAllFavorites(); }
        if(profpenref.pen.top20s) {
            revs = profpenref.pen.top20s[revtype] || []; }
        if(revs.length === 0) {
            text = "No top " + typeOrBlank(revtype) + " membics";
            if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
                text += " " + app.review.reviewLinkHTML(); } }
        else { //have at least one membic
            text = "Favorite " + typeOrBlank(revtype) + " membics"; }
        revitems.push(["div", {cla: "fpinlinetextdiv"}, text]);
        for(i = 0; i < revs.length; i += 1) {
            revref = app.lcs.getRef("rev", revs[i]);
            if(revref.rev) {
                revitems.push(profileItemHTML(revref.rev)); }
            //if revref.status deleted or other error, then just skip it
            else if(revref.status === "not cached") {
                revitems.push(["div", {cla: "fpinlinetextdiv"},
                               "Fetching membic " + revs[i] + "..."]);
                break; } }
        html = ["div", {cla: "profilereviewsdiv"}, revitems];
        jt.out('profcontdiv', jt.tac2html(html));
        if(i < revs.length) { //didn't make it through, fetch and redisplay
            app.lcs.getFull("rev", revs[i], displayFavorites); }
    },


    atMaxAutoRevSearch = function () {
        var maxauto = 1000,
            ttl = revsrchstate.total,
            contreqs = revsrchstate.reqs;
        if(ttl >= (maxauto * contreqs)) {
            return true; }
        return false;
    },


    //It is totally possible change the srchval faster than calls to
    //the server can keep up.  That means returned data processing can
    //get overlapped.  Refusing to react to input until the previous
    //server call finishes is annoying, so verify the data here.
    sanityPush = function (revs, rev, srchval) {
        var i, revid;
        if(rev.cankey.indexOf(jt.canonize(srchval)) < 0) {
            return false; }
        revid = jt.instId(rev);
        for(i = 0; i < revs.length; i += 1) {
            if(jt.instId(revs[i]) === revid) {  //dupe
                return false; } }
        revs.push(rev);
        return rev;
    },


    resetSearchStateInterimResults = function (state) {
        revsrchstate.revs = [];
        revsrchstate.cursor = "";
        revsrchstate.total = 0;
        revsrchstate.reqs = 1;
    },


    displaySearch = function () {
        var html, state;
        app.layout.displayTypes(displaySearch);
        state = profpenref.profstate.searchState || {
            inputId: "profsrchin",
            outdivId: "profsrchdispdiv",
            revrendf: function (state, type, review) {
                return profileItemHTML(review); },
            revtype: app.layout.getType(),
            srchval: "",
            preserve: true };
        if(state.revtype !== app.layout.getType()) {
            resetSearchStateInterimResults(state);
            state.revtype = app.layout.getType(); }
        html = [["div", {id: "profsrchdiv"},
                 ["input", {type: "text", id: state.inputId, size: 40,
                            placeholder: "Membic title or name",
                            value: state.srchval}]],
                ["div", {id: state.outdivId}]];
        jt.out('profcontdiv', jt.tac2html(html));
        jt.byId(state.inputId).focus();
        app.profile.revsearch(state);
    },


    displayRevSearchResults = function (results) {
        var revs = [], revitems = [], type, html, i;
        //sanity check all existing reviews match the current state
        for(i = 0; i < revsrchstate.revs.length; i += 1) {
            sanityPush(revs, revsrchstate.revs[i], revsrchstate.srchval); }
        revsrchstate.revs = revs;
        //list previously fetched matching reviews
        type = app.review.getReviewTypeByValue(revsrchstate.revtype);
        for(i = 0; i < revsrchstate.revs.length; i += 1) {
            revitems.push(revsrchstate.revrendf(revsrchstate, type, 
                                                revsrchstate.revs[i])); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        revsrchstate.cursor = "";  //used, so reset
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                revsrchstate.total += results[i].fetched;
                revitems.push(
                    ["div", {id: "revsrchcountdiv", cla: "sumtotal"},
                     String(revsrchstate.total) + " membics searched"]);
                if(results[i].cursor) {
                    revsrchstate.cursor = results[i].cursor; }
                break; }  //leave i at its current value
            if(sanityPush(revsrchstate.revs, results[i], 
                          revsrchstate.srchval)) {
                revitems.push(revsrchstate.revrendf(revsrchstate, type,
                                                    results[i])); } }
        html = [];
        html.push(["ul", {cla: "revlist"}, revitems]);
        if(revsrchstate.cursor) {
            if(i === 0 && !atMaxAutoRevSearch()) {
                //auto-repeat the search to try get a result to display.
                revsrchstate.autopage = 
                    window.setTimeout(app.profile.revsearch, 100); }
            else {
                if(atMaxAutoRevSearch()) {  //they continued search manually
                    revsrchstate.reqs += 1; }
                html.push(["a", {id: "contlinkhref", href: "#continuesearch",
                                 onclick: jt.fs("app.profile.revsearch()"),
                                 title: "Continue searching for more " + 
                                        "matching membics"},
                           "continue search..."]); } }
        jt.out(revsrchstate.outdivId, jt.tac2html(html));
    },


    monitorRevSearchValue = function () {
        var srchin, qstr = "";
        srchin = jt.byId(revsrchstate.inputId);
        if(!srchin) {  //probably switched tabs, quit
            return; }
        qstr = srchin.value;
        if(qstr !== revsrchstate.srchval) {
            app.profile.clearRevSearch();
            resetSearchStateInterimResults();
            revsrchstate.srchval = qstr;
            app.profile.revsearch(); }
        else {
            revsrchstate.querymon = setTimeout(monitorRevSearchValue, 400); }
    },


    //keep maxdate consistent to give server cache a consistent key
    revsearchMaxDate = function () {
        var now = new Date(), 
            nowiso = now.toISOString(),
            state = revsrchstate;
        if(!state.maxdate || nowiso >= state.maxdateExpires) {
            state.maxdate = nowiso;
            state.maxdateExpires = 
                new Date(now.getTime() + (60 * 60 * 1000)).toISOString(); }
        return state.maxdate;
    },


    displayGroups = function () {
        app.group.displayGroups(profpenref.pen, "profcontdiv");
    },


    profileModAuthorized = function (pen) {
        if(jt.isId(pen.mid) || jt.isId(pen.gsid) || jt.isId(pen.fbid) || 
           jt.isId(pen.twid) || jt.isId(pen.ghid)) {
            return true; }
        return false;
    },


    profEditFail = function (code, errtxt) {
        jt.out('sysnotice', errtxt);
    },


    saveEditedProfile = function (pen) {
        var elem;
        elem = jt.byId('profcityin');
        if(elem) {
            pen.city = elem.value; }
        elem = jt.byId('shouttxt');
        if(elem) {
            pen.shoutout = elem.value; }
        app.pen.updatePen(pen, app.profile.display, profEditFail);
    },


    byLineHTML = function (revobj, penNameStr) {
        var byline, revref, vialink = "";
        byline = ["span", {cla: "blrevdate"},
                  jt.colloquialDate(revobj.modified, true)];
        if(penNameStr) {
            revref = app.lcs.getRef("rev", revobj);
            if(revref && revref.viagname && !jt.byId('groupnamediv')) {
                vialink = 
                    [" (via ",
                     ["a", {title: "Show " + jt.ndq(revref.viagname),
                            href: "#" + jt.objdata({view: "group",
                                                    groupid: revref.viagid}),
                            onclick: jt.fs("app.group.bygroupid('" +
                                           revref.viagid + "')")},
                      revref.viagname],
                     ")"]; }
            byline = ["span", {cla: "byline"},
                      [["a", {title: "Show profile for " + jt.ndq(penNameStr),
                              href: "#" + jt.objdata({view: "profile", 
                                                      profid: revobj.penid }),
                              onclick: jt.fs("app.profile.byprofid('" +
                                             revobj.penid + "')")},
                        penNameStr],
                       " &middot; ",
                       byline,
                       vialink]]; }
        return byline;
    },


    clickspan = function (html, funcstr) {
        html = ["span", {cla: "clickspan", onclick: funcstr},
                html];
        return jt.tac2html(html);
    },


    displayTab = function (tabname) {
        tabname = tabname || profpenref.profstate.seltabname || "latest";
        profpenref.profstate.seltabname = tabname;
        jt.byId('latestli').className = "unselectedTab";
        jt.byId('favoritesli').className = "unselectedTab";
        jt.byId('groupsli').className = "unselectedTab";
        jt.byId('searchli').className = "unselectedTab";
        jt.byId(tabname + "li").className = "selectedTab";
        switch(tabname) {
        case "latest": return displayRecent();
        case "favorites": return displayFavorites();
        case "search": return displaySearch();
        case "groups": return displayGroups(); }
    },


    picImgSrc = function (pen) {
        var src = "img/emptyprofpic.png";
        if(pen.profpic) {
            //fetch with mild cachebust in case modified
            src = "profpic?profileid=" + jt.instId(pen) +
                "&modified=" + pen.modified; }
        return src;
    },


    profSettingsHTML = function (pen) {
        var html;
        if(!profileModAuthorized(pen)) {
            return ""; }
        html = ["a", {id: "profsettingslink", href: "#profilesettings",
                      onclick: jt.fs("app.profile.settings()")},
                ["img", {cla: "reviewbadge",
                         src: "img/settings.png"}]];
        return jt.tac2html(html);
    },


    monitorPicUpload = function () {
        var tgif, txt;
        tgif = jt.byId('tgif');
        if(tgif) {
            txt = tgif.contentDocument || tgif.contentWindow.document;
            if(txt) {
                txt = txt.body.innerHTML;
                if(txt.indexOf("Done: ") === 0) {
                    profpenref.pen.profpic = jt.instId(profpenref.pen);
                    profpenref.pen.modified = txt.slice("Done: ".length);
                    app.profile.display();
                    return; }
                if(txt.indexOf("Error: ") === 0) {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(monitorPicUpload, 800); }
    },


    mainDisplay = function (homepen, dispen, action, errmsg) {
        var html;
        if(!dispen) {
            dispen = homepen; }
        app.profile.verifyStateVariableValues(dispen);  //sets profpenref
        app.history.checkpoint({ view: "profile", 
                                 profid: jt.instId(profpenref.pen),
                                 tab: profpenref.profstate.seltabname });
        html = ["div", {id: "profilediv"},
                [["div", {id: "profupperdiv"},
                  [["div", {id: "profpicdiv"},
                    ["img", {cla: "profpic", src: picImgSrc(dispen)}]],
                   ["div", {id: "profdescrdiv"},
                    [["div", {id: "profnamediv"},
                      [["a", {href: "#view=profile&profid=" + jt.instId(dispen),
                              onclick: jt.fs("app.profile.blogconf()")},
                        ["span", {cla: "penfont"}, dispen.name]],
                       profSettingsHTML(dispen)]],
                     ["div", {id: "profshoutdiv"},
                      ["span", {cla: "shoutspan"}, 
                       jt.linkify(dispen.shoutout || "")]]]]]],
                 ["div", {id: "workstatdiv"}],  //save button, update status
                 ["div", {id: "tabsdiv"},
                  ["ul", {id: "tabsul"},
                   [["li", {id: "latestli", cla: "unselectedTab"},
                     ["a", {href: "#latestmembics",
                            onclick: jt.fs("app.profile.tabsel('latest')")},
                      ["img", {cla: "tabico", src: "img/tablatest.png"}]]],
                    ["li", {id: "favoritesli", cla: "unselectedTab"},
                     ["a", {href: "#favoritemembics",
                            onclick: jt.fs("app.profile.tabsel('favorites')")},
                      ["img", {cla: "tabico", src: "img/helpfulq.png"}]]],
                    ["li", {id: "searchli", cla: "unselectedTab"},
                     ["a", {href: "#searchmembics",
                            onclick: jt.fs("app.profile.tabsel('search')")},
                      ["img", {cla: "tabico", src: "img/search.png"}]]],
                    ["li", {id: "groupsli", cla: "unselectedTab"},
                     ["a", {href: "#groupsfollowing",
                            onclick: jt.fs("app.profile.tabsel('groups')")},
                      ["img", {cla: "tabico", src: "img/tabgrps.png"}]]]]]],
                 ["div", {id: "profcontdiv"}]]];
        jt.out('contentdiv', jt.tac2html(html));
        displayTab();
        if(errmsg) {
            jt.err("Previous processing failed: " + errmsg); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        profpenref = null;
        revsrchstate = null;
    },


    display: function (action, errmsg) {
        app.layout.cancelOverlay();
        app.pen.getPen(function (homepen) {
            mainDisplay(homepen, null, action, errmsg); });
    },


    refresh: function () {
        app.pen.getPen(function (homepen) {
            mainDisplay(homepen, profpenref.pen); });
    },


    setSelectedTab: function (tabname) {
        verifyProfileState(profpenref);
        profpenref.profstate.seltabname = tabname;
    },


    tabsel: function (tabname) {
        verifyProfileState(profpenref);
        app.history.checkpoint({ view: "profile", 
                                 profid: jt.instId(profpenref.pen),
                                 tab: tabname });
        displayTab(tabname);
    },


    resetReviews: function () {
        resetReviewDisplays(app.pen.currPenRef());
    },


    save: function () {
        app.pen.getPen(saveEditedProfile);
    },


    byprofid: function (id, tabname) {
        app.layout.closeDialog(); //close pen name search dialog if open
        app.profile.resetStateVars();
        findOrLoadPen(id, function (dispen) {
            if(tabname) {
                app.profile.verifyStateVariableValues(dispen);
                verifyProfileState(profpenref);
                profpenref.profstate.seltabname = tabname; }
            if(app.login.isLoggedIn()) {
                app.pen.getPen(function (homepen) {
                    mainDisplay(homepen, dispen); }); }
            else {
                mainDisplay(null, dispen); } });
    },


    relationship: function () {
        app.revresp.clearAbuse(profpenref.pen, function () {
            app.rel.reledit(app.pen.currPenRef().pen, profpenref.pen); });
    },


    penListItemHTML: function (pen) {
        var penid, picuri, hash, linktitle, city = "", html;
        penid = jt.instId(pen);
        //empytprofpic.png looks like big checkboxes, use blank instead
        picuri = "img/blank.png";
        if(pen.profpic) {
            picuri = "profpic?profileid=" + penid; }
        hash = jt.objdata({ view: "profile", profid: penid });
        linktitle = jt.ellipsis(pen.shoutout, 75);
        if(!linktitle) {  //do not encode pen name here.  No "First%20Last"..
            linktitle = "View profile for " + pen.name; }
        if(pen.city) {
            city = jt.tac2html(["span", {cla: "smalltext"},
                                " (" + pen.city + ")"]); }
        html = ["li",
                [["a", {href: "#" + hash, title: linktitle,
                        onclick: jt.fs("app.profile.byprofid('" + 
                                       penid + "')")},
                  [["img", {cla: "srchpic", src: picuri}],
                   "&nbsp;",
                   ["span", {cla: "penfont"}, pen.name]]],
                 ["span", {cla: "smalltext"}, city],
                 app.profile.earnedBadgesHTML(pen, false)]];
        html = jt.tac2html(html);
        return html;
    },


    revsmore: function () {
        findRecentReviews(profpenref.profstate.recentRevState);
    },


    readReview: function (revid) {
        var revobj;
        revobj = app.lcs.getRef("rev", revid).rev;
        //Make some noise if you can't find it rather than being a dead link
        if(!revobj) {
            jt.err("readReview " + revid + " not found");
            return; }
        app.history.checkpoint({ view: "review", mode: "display",
                                 revid: revid });
        app.review.setCurrentReview(revobj);
        app.review.displayRead();
    },


    reviewItemNameHTML: function (type, revobj) {
        var linktxt = "";
        if(type.subkey) {
            linktxt = "<i>" + jt.ellipsis(revobj[type.key], 60) + "</i> " +
                jt.ellipsis(revobj[type.subkey], 40); }
        else {
            linktxt = jt.ellipsis(revobj[type.key], 60); }
        return linktxt;
    },


    reviewItemHTML: function (revobj, penNameStr, liattrobj, remfstr) {
        var revid = jt.instId(revobj), 
            type = app.review.getReviewTypeByValue(revobj.revtype), 
            linkref = "statrev/" + revid, 
            linkclass = app.revresp.foundHelpful(revid)? "rslcbold" : "rslc",
            divattrs = {cla: "revtextsummary", 
                        style: "padding:0px 0px 0px 97px;"},
            revclick = jt.fs("app.profile.readReview('" + revid + "')"),
            keywords = "", revtext = "", remove = "",
            html;
        if(app.winw < 700) {
            divattrs.style = "padding:0px 0px 0px 10px;"; }
        if(remfstr) {
            remove = ["a", {href: "#remove", onclick: jt.fs(remfstr)},
                      ["img", {cla: "removeico", src: "img/remove.png"}]]; }
        if(revobj.keywords) {
            keywords += ": " + jt.ellipsis(revobj.keywords, 100); }
        if(revobj.text) {
            revtext = ["div", divattrs,
                       jt.ellipsis(revobj.text, 255)]; }
        html = ["li", liattrobj,
                [clickspan(app.review.starsImageHTML(revobj), revclick),
                 clickspan(app.review.badgeImageHTML(type), revclick),
                 "&nbsp;",
                 ["a", {id: "lihr" + revid, cla: linkclass, 
                        href: linkref, title: "See full membic",
                        onclick: revclick},
                  app.profile.reviewItemNameHTML(type, revobj)],
                 "&nbsp;" + app.review.jumpLinkHTML(revobj, type),
                 ["div", divattrs,
                  [remove,
                   byLineHTML(revobj, penNameStr),
                   clickspan(keywords, revclick),
                   clickspan(app.review.linkCountHTML(revid), revclick)]],
                 clickspan(revtext, revclick)]];
        html = jt.tac2html(html);
        return html;
    },


    toggleAuth: function (authtype, domid) {
        app.pen.getPen(function (pen) { 
            handleAuthChangeToggle(pen, authtype, domid); });
    },


    displayAuthSettings: function (domid, pen) {
        displayAuthSettings(domid, pen);
    },


    verifyStateVariableValues: function (pen) {
        profpenref = app.lcs.getRef("pen", pen);
        verifyProfileState(profpenref);
    },


    saveIfNotShoutEdit: function () {
        if(jt.byId('shoutdiv')) {
            app.profile.save(); }
    },


    clearRevSearch: function () {
        if(revsrchstate) {
            if(revsrchstate.autopage) {
                window.clearTimeout(revsrchstate.autopage);
                revsrchstate.autopage = null; }
            if(revsrchstate.querymon) {
                window.clearTimeout(revsrchstate.querymon);
                revsrchstate.querymon = null; } }
        else {
            revsrchstate = {}; }
        if(!revsrchstate.revs || !revsrchstate.preserve) {
            revsrchstate.revs = []; }
        if(!revsrchstate.cursor || !revsrchstate.preserve) {
            revsrchstate.cursor = ""; }
        if(!revsrchstate.total || !revsrchstate.preserve) {
            revsrchstate.total = 0; }
        if(!revsrchstate.reqs || !revsrchstate.preserve) {
            revsrchstate.reqs = 1; }
        //inputId managed by caller
        //outdivId managed by caller
        //revrendf managed by caller
        //revtype managed by caller
        //srchval managed by caller
    },


    revsearch: function (srchstate) {
        var penid, params;
        if(srchstate) {  //clear work and init revsrchstate
            app.profile.clearRevSearch();  //clear any outstanding timeouts
            revsrchstate = srchstate;
            app.profile.clearRevSearch();  //reset and init as needed
            if(revsrchstate.revs.length > 0) {  //skip initial db call
                displayRevSearchResults([]);
                monitorRevSearchValue(); }
            else {
                setTimeout(app.profile.revsearch, 50); }
            return; }
        if(revsrchstate.inprog &&  //verify not already searching...
               revsrchstate.inprog.revtype === revsrchstate.revtype &&
               revsrchstate.inprog.srchval === revsrchstate.srchval &&
               revsrchstate.inprog.cursor === revsrchstate.cursor) {
            return; }
        //ready to start search
        revsrchstate.inprog = { revtype: revsrchstate.revtype,
                                srchval: revsrchstate.srchval,
                                cursor: revsrchstate.cursor };
        if(!jt.byId("revsrchcountdiv")) {
            jt.out(revsrchstate.outdivId, jt.tac2html(
                ["div", {cla: "sumtotal"},
                 "Searching..."])); }
        if(jt.byId("contlinkhref")) {
            jt.byId("contlinkhref").onclick = "";
            jt.out("contlinkhref", "continuing..."); }
        //make the call
        penid = jt.instId(app.pen.currPenRef().pen);
        if(profpenref && profpenref.pen) {
            penid = jt.instId(profpenref.pen); }
        params = app.login.authparams() +
            "&qstr=" + jt.enc(jt.canonize(revsrchstate.srchval)) +
            "&revtype=" + typeOrBlank(revsrchstate.revtype) +
            "&penid=" + penid +
            "&maxdate=" + revsearchMaxDate() + 
            "&mindate=1970-01-01T00:00:00Z" + 
            "&cursor=" + jt.enc(revsrchstate.cursor);
        jt.call('GET', "srchrevs?" + params, null,
                function (results) { 
                    app.lcs.putAll("rev", results);
                    displayRevSearchResults(results);
                    profpenref.profstate.searchState = revsrchstate;
                    monitorRevSearchValue(); },
                app.failf(function (code, errtxt) {
                    jt.err("revsearch call died code: " + code + " " +
                           errtxt); }),
                jt.semaphore("profile.revsearch"));
    },


    revsearchIfTypeChange: function (revtype) {
        if(profpenref.profstate.revtype !== revtype) {
            profpenref.profstate.revtype = revtype;
            jt.out('revTypeSelectorDiv', 
                   revTypeSelectorHTML("app.profile.revsearchIfTypeChange"));
            displaySearch(); }
    },


    readPenNameIn: function (pen) {
        var pennamein = jt.byId('pennamein');
        if(!pen) {
            pen = profpenref.pen; }
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    cancelProfileEdit: function () {
        app.profile.display();
    },


    displayingSelf: function () {
        var cpr = app.pen.currPenRef();
        if(profpenref && profpenref.pen && cpr && cpr.pen === profpenref.pen) {
            return true; }
        return false;
    },


    getProfilePenReference: function () {
        return profpenref;
    },


    mrollp: function (mouse) {
        if(mouse === "over") {
            jt.byId('navprofimg').src = "img/profilesel.png"; }
        else { //"out"
            if(app.layout.currnavmode() === "profile") {
                jt.byId('navprofimg').src = "img/profilesel.png"; }
            else {
                jt.byId('navprofimg').src = "img/profile.png"; } }
    },


    mrollset: function (mouse) {
        if(mouse === "over") {
            jt.byId('settingsnavimg').src = "img/settingsel.png"; }
        else { //"out"
            if(jt.byId('pensettingstable')) {
                jt.byId('settingsnavimg').src = "img/settingsel.png"; }
            else {
                jt.byId('settingsnavimg').src = "img/settings.png"; } }
    },


    mrollrts: function (typename, mouse) {
        var src;
        if(mouse === "over") {
            src = revTypeSelectorImgSrc(typename, true); }
        else {
            src = revTypeSelectorImgSrc(typename); }
        jt.byId("rtsimg" + typename).src = src;
    },


    earnedBadgesHTML: function (pen, showtopfname) {
        var html, i, reviewTypes, typename, label, imgsrc, attrobj;
        html = [];
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            imgsrc = app.layout.badgeImgSrc(pen, typename);
            if(imgsrc) {
                label = "Top 20 " + reviewTypes[i].plural.capitalize();
                if(pen.top20s[typename].length < 20) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].plural.capitalize(); }
                attrobj = { cla: "reviewbadge bbk" +
                                 app.layout.badgeDrawer(pen, typename), 
                            src: imgsrc, title: label, alt: label};
                if(showtopfname) {
                    attrobj.onclick = jt.fs(showtopfname + "('" +
                                            typename + "')"); }
                html.push(["span", {cla: "badgespan"},
                           ["img", attrobj]]); } }
        return jt.tac2html(html);
    },


    uploadProfPic: function () {
        //display the form with an iframe target and monitor upload
        jt.err("uploadProfPic not implemented yet.");
    },


    blogconf: function () {
        //confirm we should open a new page with their blog view which
        //they can share publicly.  The href should also be that URL
        //since you have to be signed in to see someone's profile.
        jt.err("blogconf not implemented yet.");
    },


    settings: function () {
        var html;
        html = ["div", {id: "profsettingsdlgdiv"},
                [["label", {fo: "picuploadform", cla: "overlab"},
                  "Profile Picture"],
                 ["form", {action: "/profpicupload", method: "post",
                           enctype: "multipart/form-data", target: "tgif",
                           id: "picuploadform"},
                  [["input", {type: "hidden", name: "_id", 
                              value: jt.instId(profpenref.pen)}],
                   jt.paramsToFormInputs(app.login.authparams()),
                   ["div", {cla: "tablediv"},
                    [["div", {cla: "fileindiv"},
                      [["input", {type: "file", 
                                  name: "picfilein", id: "picfilein"}],
                       ["div", {id: "uploadbuttonsdiv"},
                        ["input", {type: "submit", cla: "formbutton",
                                   value: "Upload&nbsp;Picture"}]]]],
                     ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                 ["iframe", {id: "tgif", name: "tgif", src: "/profpicupload",
                             style: "display:none"}],
                 ["div", {cla: "formline"},
                  ["label", {fo: "shouteditbox", cla: "overlab"},
                   "Shoutout"]],
                 ["textarea", {id: "shouteditbox", cla: "dlgta"}],
                 ["div", {cla: "formstatdiv"}],
                 ["div", {cla: "dlgbuttonsdiv"},
                  ["button", {type: "button", id: "okbutton",
                              onclick: jt.fs("app.profile.saveSettings()")},
                   "Update Text"]]]];
        app.layout.openOverlay({x:10, y:80}, html, null,
                               function () {
                                   var shout = jt.byId('shouteditbox');
                                   shout.readOnly = false;
                                   shout.value = profpenref.pen.shoutout;
                                   shout.placeholder = "Links to other public pages you have, favorite sayings, etc...";
                                   shout.focus();
                                   monitorPicUpload(); });
    },


    saveSettings: function () {
        var elem, pen = profpenref.pen, changed = false;
        elem = jt.byId('shouteditbox');
        if(elem && elem.value !== pen.shoutout) {
            pen.shoutout = elem.value;
            changed = true; }
        if(changed) {
            app.pen.updatePen(pen, app.profile.display,
                              function (code, errtxt) {
                                  jt.out('formstatdiv', "Update failed code " +
                                         code + ": " + errtxt); }); }
        else {
            app.layout.cancelOverlay(); }
    }

};  //end of returned functions
}());

