/*global alert: false, confirm: false, setTimeout: false, window: false, document: false, app: false, jt: false, JSON: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// Display a pen name and provide for updating settings.  Cached data
// off the currently displayed pen name reference:
//
//   penref.profstate:
//     seltabname: name of selected display tab
//     revtype: name of selected review type (shared by best and allrevs)
//     allRevsState:
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

    var greytxt = "#999999",
        unspecifiedCityText = "City not specified",
        profeditfield = "",
        profpenref,
        authtypes = { mid: "wdydfun",
                      gsid: "Google+",
                      fbid: "Facebook",
                      twid: "Twitter",
                      ghid: "GitHub" },



    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    verifyProfileState = function (penref) {
        if(!penref) {
            penref = profpenref; }
        if(penref.pen && typeof penref.pen.top20s === "string") {
            penref.pen.top20s = JSON.parse(penref.pen.top20s); }
        if(!penref.profstate) {
            penref.profstate = { seltabname: 'recent',
                                 revtype: "" }; }
        if(!penref.profstate.revtype && penref.pen && penref.pen.top20s) {
            penref.profstate.revtype = penref.pen.top20s.latestrevtype; }
        if(!penref.profstate.revtype) {
            penref.profstate.revtype = 'book'; }
    },


    //Drop all cached information from the given penref and rebuild
    //it.  The state should be dropped if a review was created or
    //updated.  It does not yet make sense to attempt to recompute
    //things locally in addition to on the server.  Ultimately saving
    //a review might insert/replace the newrev from the recent
    //reviews, insert into allrevs if matched, and reload the top20s
    //(if the pen wasn't just loaded).  For now this just clears the
    //local cache to trigger a rebuild.
    resetReviewDisplays = function (penref) {
        penref.profstate = null;
        verifyProfileState(penref);
    },


    displayInboundLinkIndicator = function () {
        var penref, html = "", linksummary, i, count;
        penref = app.pen.currPenRef();
        if(!penref.linksummary) {
            if(!penref.inlinks) {
                //fetch is low prio, don't compete with startup processing
                setTimeout(function () {
                    var params, critsec;
                    params = "penid=" + jt.instId(penref.pen) + "&" + 
                        app.login.authparams();
                    critsec = critsec || "";
                    jt.call('GET', "inlinks?" + params, null,
                            function (inlinks) {
                                penref.inlinks = inlinks;
                                displayInboundLinkIndicator(); },
                            app.failf,
                            critsec); }, 1200);
                return; }
            linksummary = {helpful: 0, remembered: 0, corresponding: 0};
            for(i = 0; i < penref.inlinks.length; i += 1) {
                if(penref.inlinks[i].helpful) {
                    linksummary.helpful += 
                        penref.inlinks[i].helpful.split(",").length; }
                if(penref.inlinks[i].remembered) {
                    linksummary.remembered += 
                        penref.inlinks[i].remembered.split(",").length; }
                if(penref.inlinks[i].corresponding) {
                    linksummary.corresponding +=
                        penref.inlinks[i].corresponding.split(",").length; } }
            penref.linksummary = linksummary; }
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


    updateTopActionDisplay = function (pen) {
        var html;
        if(!jt.byId('homepenhdiv')) {
            app.login.updateAuthentDisplay(); }
        html = ["div", {cla: "topnavitemdiv"},
                jt.imgntxt("profile.png", "",
                           "app.profile.display()",
                           "#view=profile&profid=" + jt.instId(pen),
                           "Show profile for " + pen.name + " (you)",
                           "naviconospace")];
        jt.out('homepenhdiv', jt.tac2html(html));
        html = jt.imgntxt("settings.png", "", 
                          "app.profile.settings()",
                          "#Settings",
                          "Adjust your profile settings",
                          "naviconospace");
        jt.out('settingsbuttondiv', html);
        displayInboundLinkIndicator();
    },


    displayProfileHeading = function (homepen, dispen, directive) {
        var html, id, name, linksum, relationship;
        id = jt.instId(dispen);
        name = dispen.name;
        html = ["div", {id: "profhdiv"},
                ["table",
                 ["tr",
                  [["td",
                    ["span", {id: "penhnamespan"},
                     ["a", {href: "#view=profile&profid=" + id,
                            title: "Show profile for " + name,
                            onclick: jt.fs("app.profile.byprofid('" + id + 
                                           "')")},
                      name]]],
                   ["td",
                    ["div", {id: "penhbuttondiv"},
                     " "]]]]]];
        html = jt.tac2html(html);
        jt.out('centerhdiv', html);
        if(directive === "nosettings") {
            return; }
        html = "";
        if(jt.instId(homepen) === jt.instId(dispen)) {
            linksum = app.pen.currPenRef().linksummary;
            if(linksum) {
                html = ["div", {id: "inlinkdiv"},
                        ["table",
                         [["tr",
                           [["td", {align: "right"}, "helpful:"],
                            ["td", String(linksum.helpful)]]],
                          ["tr",
                           [["td", {align: "right"}, "remembered:"],
                            ["td", String(linksum.remembered)]]],
                          ["tr",
                           [["td", {align: "right"}, "corresponding:"],
                            ["td", String(linksum.corresponding)]]]]]];
                html = jt.tac2html(html); } }
        else if(jt.instId(homepen) !== jt.instId(dispen)) {
            if(app.rel.relsLoaded()) {
                relationship = app.rel.outbound(id);
                app.profile.verifyStateVariableValues(dispen);
                if(relationship) {
                    html = ["a", {href: "#Settings",
                                  title: "Adjust follow settings for " + name,
                                  onclick: jt.fs("app.profile.relationship()")},
                            ["img", {cla: "navico", 
                                     src: "img/settingsinv.png"}]]; }
                else {
                    html = ["a", {href: "#Follow",
                                  title: "Follow " + name + " reviews",
                                  onclick: jt.fs("app.profile.relationship()")},
                            [["img", {cla: "navico", id: "followbimg",
                                      src: "img/follow.png"}],
                             "follow"]]; }
                html = jt.tac2html(html); }
            else {  
                //Happens if you go directly to someone's profile via url
                //and rels are loading slowly.  Not known if you are following
                //them yet.  The heading updates after the rels are loaded.
                html = "..."; } }
        jt.out('penhbuttondiv', html);
    },


    writeNavDisplay = function (homepen, dispen, directive) {
        if(!dispen) {
            dispen = homepen; }
        updateTopActionDisplay(homepen);
        displayProfileHeading(homepen, dispen, directive);
    },


    savePenNameSettings = function (e) {
        var pen;
        jt.evtend(e);
        pen = app.pen.currPenRef().pen;
        app.profile.readPenNameIn(pen);
        app.skinner.save(pen);
        app.pen.updatePen(pen,
                          function () {
                              app.layout.closeDialog();
                              app.profile.display(); },
                          function (code, errtxt) {
                              jt.out('settingsmsgtd', errtxt); });
    },


    displayAuthSettings = function (domid, pen) {
        var html;
        if(pen.pen) {  //got a penref, adjust accordingly
            pen = pen.pen; }
        html = [
            ["div", {id: "accountdiv"},
             app.login.loginInfoHTML(pen)],
            "Access \"" + pen.name + "\" via: ",
            ["table",
             [["tr",
               [["td",  //native app
                 [["input", {type: "checkbox", name: "aamid", id: "aamid",
                             value: authtypes.mid,
                             checked: jt.toru(jt.isId(pen.mid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "mid','" + domid + "')")}],
                  ["label", {fo: "aamid"}, authtypes.mid]]],
                ["td",  //Account settings link
                 app.login.accountSettingsLinkHTML(pen)]]],
              ["tr",
               [["td",  //Facebook
                 [["input", {type: "checkbox", name: "aafbid", id: "aafbid",
                             value: authtypes.fbid,
                             checked: jt.toru(jt.isId(pen.fbid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "fbid','" + domid + "')")}],
                  ["label", {fo: "aafbid"}, authtypes.fbid]]],
                ["td",  //Twitter
                 [["input", {type: "checkbox", name: "aatwid", id: "aatwid",
                             value: authtypes.twid,
                             checked: jt.toru(jt.isId(pen.twid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "twid','" + domid + "')")}],
                  ["label", {fo: "aatwid"}, authtypes.twid]]]]],
              ["tr",
               [["td",  //Google+
                 [["input", {type: "checkbox", name: "aagsid", id: "aagsid",
                             value: authtypes.gsid,
                             checked: jt.toru(jt.isId(pen.gsid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "gsid','" + domid + "')")}],
                  ["label", {fo: "aagsid"}, authtypes.gsid]]],
                ["td",  //GitHub
                 [["input", {type: "checkbox", name: "aaghid", id: "aaghid",
                             value: authtypes.ghid,
                             checked: jt.toru(jt.isId(pen.ghid), "checked"),
                             onchange: jt.fs("app.profile.toggleAuth('" +
                                             "ghid','" + domid + "')")}],
                  ["label", {fo: "aaghid"}, authtypes.ghid]]]]]]]];
        jt.out(domid, jt.tac2html(html));
    },


    addMORAuth = function (domid, pen) {
        jt.out(domid, "Logging in via wdydfun...");
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


    penSelectHTML = function (pen) {
        var opts = [], html, pens = app.pen.getPenNames(), i;
        for(i = 0; i < pens.length; i += 1) {
            opts.push(["option", {id: jt.instId(pens[i]),
                                  selected: jt.toru((pens[i].name === pen.name),
                                                    "selected")},
                       pens[i].name]); }
        opts.push(["option", {id: "newpenopt"}, "New Pen Name"]);
        html = ["div", {id: "penseldiv"},
                [["span", {cla: "headingtxt"}, 
                  ["Writing as ",
                   ["select", {id: "penselect",
                               onchange: jt.fs("app.profile.switchPen()")},
                    opts]]],
                 "&nbsp;",
                 ["button", {type: "button", id: "penselectok",
                             onclick: jt.fs("app.profile.switchPen()")},
                  "go"]]];
        return jt.tac2html(html);
    },


    changeSettings = function (pen) {
        var html;
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.profile.cancelPenNameSettings()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["table",
                 [["tr",
                   ["td", {colspan: 2, align: "left", id: "pensettitletd"},
                    penSelectHTML(pen)]],
                  ["tr",
                   ["td", {colspan: 2, id: "settingsmsgtd"}]],
                  ["tr",
                   [["td", {rowspan: 2, align: "right", valign: "top"},
                     ["img", {src: "img/penname.png", alt: "Pen Name"}]],
                    ["td", {align: "left"},
                     ["input", {type: "text", id: "pennamein", size: 25,
                                onchange: jt.fs("app.profile.readPenNameIn()"),
                                value: pen.name}]]]],
                  ["tr",
                   //td from previous row extends into here
                   ["td", {id: "settingsauthtd"}]],
                  ["tr",
                   ["td", {colspan: 2, id: "settingsskintd"}]],
                  ["tr",
                   ["td", {colspan: 2, id: "consvcstd"}]],
                  ["tr",
                   ["td", {colspan: 2, align: "center", id: "settingsbuttons"},
                    ["button", {type: "button", id: "savebutton"},
                     "Save"]]]]]];
        app.layout.openDialog({x:280, y:20}, jt.tac2html(html), function () {
            jt.on('savebutton', 'click', savePenNameSettings);
            displayAuthSettings('settingsauthtd', pen);
            app.services.display('consvcstd', pen);
            app.skinner.init('settingsskintd', pen); });
    },


    mailButtonHTML = function () {
        var html, href, subj, body, types, revchecks, i, ts, mepen;
        mepen = app.pen.currPenRef().pen;
        subj = "Sharing experiences through reviews";
        body = "Hi,\n\n" +
            "Please join wdydfun so I can read reviews from you";
        revchecks = document.getElementsByName("invrevcb");
        types = "";
        for(i = 0; i < revchecks.length; i += 1) {
            if(revchecks[i].checked) {
                if(types) {
                    types += ","; }
                types += revchecks[i].value; } }
        if(types) {
            ts = types.split(",");
            types = "";
            for(i = 0; i < ts.length; i += 1) {
                if(i > 0) {
                    if(i === ts.length - 1) {
                        types += " and "; }
                    else {
                        types += ", "; } }
                types += ts[i]; }
            body += ", especially about " + types + "."; }
        else {
            body += "!"; }
        body += "\n\n" +
            "Here's a direct link to my profile:\n\n" +
            "    " + app.mainsvr + "/#view=profile&profid=" +
            jt.instId(mepen) + "\n\n" +
            "After you have a pen name, click the follow link on my " + 
            "profile so I can find you and follow back. " + 
            "\n\n" +
            "cheers,\n";
        href = "mailto:?subject=" + jt.dquotenc(subj) + 
            "&body=" + jt.dquotenc(body) + "%0A";
        html = app.services.serviceLinkHTML(href, "", "shareico", 
                                            "Invite via eMail",
                                            "img/email.png");
        return html;
    },


    findOrLoadPen = function (penid, callback) {
        app.lcs.getPenFull(penid, function (penref) {
            callback(penref.pen); });
    },


    displayRecentReviews = function (rrs, reviews) {
        var revitems = [], i, text, html, fetched;
        if(!rrs.results) {
            rrs.results = []; }
        for(i = 0; i < rrs.results.length; i += 1) {
            revitems.push(app.profile.reviewItemHTML(rrs.results[i])); }
        if(reviews) {  //have fresh search results
            rrs.cursor = "";
            for(i = 0; i < reviews.length; i += 1) {
                if(reviews[i].fetched) {
                    fetched = reviews[i].fetched;
                    if(typeof fetched === "number" && fetched >= 0) {
                        rrs.total += reviews[i].fetched;
                        revitems.push(["div", {cla: "sumtotal"},
                                       String(rrs.total) + 
                                       " reviews searched"]); }
                    if(reviews[i].cursor) {
                        rrs.cursor = reviews[i].cursor; }
                    break; }  //if no reviews, i will be left at zero
                app.lcs.putRev(reviews[i]);  //ensure cached
                rrs.results.push(reviews[i]);
                revitems.push(app.profile.reviewItemHTML(reviews[i])); } }
        rrs.total = Math.max(rrs.total, rrs.results.length);
        if(rrs.total === 0) {
            text = "No recent reviews.";
            if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
                text += " " + app.review.reviewLinkHTML(); }
            revitems.push(["li", text]); }
        html = [];
        html.push(["ul", {cla: "revlist"}, revitems]);
        if(rrs.cursor) {
            if(i === 0 && rrs.results.length === 0) {
                if(rrs.total < 2000) {  //auto-repeat search
                    setTimeout(app.profile.revsmore, 10); } 
                else {
                    html.push("No recent reviews found" + 
                              ", only batch updates."); } }
            else {
                html.push(["a", {href: "#continuesearch",
                                 onclick: jt.fs("app.profile.revsmore()"),
                                 title: "More reviews"},
                           "more reviews..."]); } }
        jt.out('profcontdiv', jt.tac2html(html));
        app.layout.adjust();
        setTimeout(function () {
            app.lcs.verifyReviewLinks(app.profile.refresh); }, 250);
    },


    //It is possible have created a new review and not have it be
    //found by the search processing due to database lag.  Walk the 
    //cache to make sure there is nothing newer there.
    sanityCompleteRevsViaCache = function(rrs, revs) {
        var modified = "2012-10-10T00:00:00Z";
        if(revs && revs.length > 0) {
            modified = revs[0].modified; }
        rrs.results = app.lcs.findNewerReviews(rrs.params.penid, modified);
    },


    findRecentReviews = function (rrs) {  //recentRevState
        var params, critsec;
        params = jt.objdata(rrs.params) + "&" + app.login.authparams();
        if(rrs.cursor) {
            params += "&cursor=" + jt.enc(rrs.cursor); }
        critsec = critsec || "";
        jt.call('GET', "srchrevs?" + params, null,
                 function (revs) {
                     sanityCompleteRevsViaCache(rrs, revs);
                     displayRecentReviews(rrs, revs); },
                 app.failf(function (code, errtxt) {
                     jt.out('profcontdiv', "findRecentReviews failed code " + 
                             code + " " + errtxt); }),
                 critsec);
    },


    displayRecent = function () {
        var rrs, html, maxdate, mindate;
        if(profpenref.profstate.recentRevState) {
            return displayRecentReviews(profpenref.profstate.recentRevState); }
        html = "Retrieving recent activity for " + profpenref.pen.name + "...";
        jt.out('profcontdiv', html);
        app.layout.adjust();
        profpenref.profstate.recentRevState = rrs = { 
            params: {},
            cursor: "",
            results: [],
            total: 0 };
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        rrs.params.maxdate = maxdate.toISOString();
        rrs.params.mindate = mindate.toISOString();
        rrs.params.penid = jt.instId(profpenref.pen);
        findRecentReviews(rrs);
    },


    revTypeSelectorHTML = function (clickfuncstr) {
        var html, i, reviewTypes, typename, label, dispclass, pen, prefixstr;
        prefixstr = "Top 20 ";
        if(clickfuncstr && clickfuncstr.indexOf("Top") < 0) {
            prefixstr = "20+ "; }
        pen = profpenref.pen;
        html = [];
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            dispclass = "reviewbadge";
            if(typename === profpenref.profstate.revtype) {
                dispclass = "reviewbadgedis"; }
            label = "No " + reviewTypes[i].type.capitalize() + " reviews.";
            if(pen.top20s[typename]) {
                if(pen.top20s[typename].length >= 20) {
                    label = prefixstr + reviewTypes[i].type.capitalize() +
                        " reviews."; }
                else if(pen.top20s[typename].length >= 1) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].type.capitalize() + " reviews."; } }
            html.push(["img", {cla: dispclass, 
                               src: "img/" + reviewTypes[i].img,
                               title: label, alt: label,
                               onclick: jt.fs(clickfuncstr + "('" + 
                                              typename + "')")}]); }
        return jt.tac2html(html);
    },


    displayBest = function () {
        var state, revs = [], text, revitems = [], html, i, revref;
        state = profpenref.profstate;
        if(profpenref.pen.top20s) {
            revs = profpenref.pen.top20s[state.revtype] || []; }
        if(revs.length === 0) {
            text = "No top rated " + state.revtype + " reviews.";
            if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
                text += " " + app.review.reviewLinkHTML(); }
            revitems.push(["li", text]); }
        for(i = 0; i < revs.length; i += 1) {
            revref = app.lcs.getRevRef(revs[i]);
            if(revref.rev) {
                revitems.push(app.profile.reviewItemHTML(revref.rev)); }
            //if revref.status deleted or other error, then just skip it
            else if(revref.status === "not cached") {
                revitems.push(["li", "Fetching review " + revs[i] + "..."]);
                break; } }
        html = [["div", {id: "revTypeSelectorDiv"},
                 revTypeSelectorHTML("app.profile.showTopRated")],
                ["ul", {cla: "revlist"}, revitems]];
        jt.out('profcontdiv', jt.tac2html(html));
        app.layout.adjust();
        if(i < revs.length) { //didn't make it through, fetch and redisplay
            app.lcs.getRevFull(revs[i], displayBest); }
        else {
            setTimeout(function () {
                app.lcs.verifyReviewLinks(app.profile.refresh); }, 250); }
    },


    clearAllRevProfWorkState = function () {
        var state = profpenref.profstate.allRevsState;
        //does not reset allRevsState.srchval or revtype
        if(state && state.autopage) {
            window.clearTimeout(state.autopage);
            state.autopage = null; }
        if(state && state.querymon) {
            window.clearTimeout(state.querymon);
            state.querymon = null; }
        state.cursor = "";
        state.total = 0;
        state.reqs = 1;
        state.revs = [];
    },


    allrevMaxAutoSearch = function () {
        var maxauto = 1000,
            ttl = profpenref.profstate.allRevsState.total,
            contreqs = profpenref.profstate.allRevsState.reqs;
        if(ttl >= (maxauto * contreqs)) {
            return true; }
        return false;
    },


    listAllRevs = function (results) {
        var revitems = [], html, i, state = profpenref.profstate.allRevsState;
        for(i = 0; i < state.revs.length; i += 1) {
            revitems.push(app.profile.reviewItemHTML(state.revs[i])); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        state.cursor = "";  //used, so reset
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                state.total += results[i].fetched;
                revitems.push(["div", {cla: "sumtotal"},
                               String(state.total) + " reviews searched"]);
                if(results[i].cursor) {
                    state.cursor = results[i].cursor; }
                break; }  //leave i at its current value
            state.revs.push(results[i]);
            revitems.push(app.profile.reviewItemHTML(results[i])); }
        html = [];
        html.push(["ul", {cla: "revlist"}, revitems]);
        if(state.cursor) {
            if(i === 0 && !allrevMaxAutoSearch()) {
                //auto-repeat the search to try get a result to display
                state.autopage = window.setTimeout(app.profile.searchAllRevs,
                                                   10); }
            else {
                if(allrevMaxAutoSearch()) {  //they continued search manually
                    state.reqs += 1; }
                html.push(["a", {href: "#continuesearch",
                                 onclick: jt.fs("app.profile.searchAllRevs()"),
                                 title: "Continue searching for more " + 
                                        "matching reviews"},
                           "continue search..."]); } }
        jt.out('allrevdispdiv', jt.tac2html(html));
        setTimeout(function () {
            app.lcs.verifyReviewLinks(app.profile.refresh); }, 250);
    },


    monitorAllRevQuery = function () {
        var state, srchin, qstr = "";
        state = profpenref.profstate;
        srchin = jt.byId('allrevsrchin');
        if(!srchin) {  //probably switched tabs, quit
            return; }
        qstr = srchin.value;
        if(qstr !== state.allRevsState.srchval) {
            if(state.allRevsState.querymon) {
                window.clearTimeout(state.allRevsState.querymon);
                state.allRevsState.querymon = null; }
            app.profile.searchAllRevs(); }
        else {
            state.allRevsState.querymon = setTimeout(monitorAllRevQuery, 400); }
    },


    displayAllRevs = function () {
        var html, state;
        state = profpenref.profstate.allRevsState;
        if(!state) {
            state = profpenref.profstate.allRevsState = {
                srchval: "",
                revs: [],
                cursor: "",
                total: 0,
                reqs: 1 }; }
        html = [["div", {id: "revTypeSelectorDiv"},
                 revTypeSelectorHTML("app.profile.searchRevsIfTypeChange")],
                ["div", {id: "allrevsrchdiv"},
                 ["input", {type: "text", id: "allrevsrchin", size: 40,
                            placeholder: "Review title or name",
                            value: state.srchval,
                            onchange: jt.fs("app.profile.allrevs()")}]],
                ["div", {id: "allrevdispdiv"}]];
        jt.out('profcontdiv', jt.tac2html(html));
        jt.byId('allrevsrchin').focus();
        if(state.revs.length > 0) {
            listAllRevs([]);  //display previous results
            monitorAllRevQuery(); }
        else {
            clearAllRevProfWorkState();
            app.profile.searchAllRevs(); }
    },


    displayFollowing = function () {
        app.rel.displayRelations(profpenref.pen, "outbound", "profcontdiv");
        app.layout.adjust();
    },


   displayFollowers = function () {
        app.rel.displayRelations(profpenref.pen, "inbound", "profcontdiv");
        app.layout.adjust();
    },


    setCurrTabFromString = function (tabstr) {
        var profstate;
        verifyProfileState(profpenref);
        profstate = profpenref.profstate;
        switch(tabstr) {
        case "recent": profstate.seltabname = "recent"; break;
        case "best": profstate.seltabname = "best"; break;
        case "allrevs": profstate.seltabname = "allrevs"; break;
        case "following": profstate.seltabname = "following"; break;
        case "followers": profstate.seltabname = "followers"; break;
        }
    },


    refreshContentDisplay = function () {
        switch(profpenref.profstate.seltabname) {
        case "recent": displayRecent(); break;
        case "best": displayBest(); break;
        case "allrevs": displayAllRevs(); break;
        case "following": displayFollowing(); break;
        case "followers": displayFollowers(); break;
        }
    },


    displayTabs = function (penref) {
        var html;
        verifyProfileState(penref);
        html = ["ul", {id: "proftabsul"},
                [["li", {id: "recentli", cla: "selectedTab"},
                  ["a", {href: "#recentreviews",
                         title: "Click to see recent reviews",
                         onclick: jt.fs("app.profile.tabselect('recent')")},
                   "Recent Reviews"]],
                 ["li", {id: "bestli", cla: "unselectedTab"},
                  ["a", {href: "#bestreviews",
                         title: "Click to see top rated",
                         onclick: jt.fs("app.profile.tabselect('best')")},
                   "Top Rated"]],
                 ["li", {id: "allrevsli", cla: "unselectedTab"},
                  ["a", {href: "#allreviews",
                         title: "Click to see all reviews",
                         onclick: jt.fs("app.profile.tabselect('allrevs')")},
                   "All Reviews"]],
                 ["li", {id: "followingli", cla: "unselectedTab"},
                  ["a", {href: "#following",
                         title: "Click to see who you are following",
                         onclick: jt.fs("app.profile.tabselect('following')")},
                   "Following (" + penref.pen.following + ")"]],
                 ["li", {id: "followersli", cla: "unselectedTab"},
                  ["a", {href: "#followers",
                         title: "Click to see who is following you",
                         onclick: jt.fs("app.profile.tabselect('followers')")},
                   "Followers (" + penref.pen.followers + ")"]]]];
        jt.out('proftabsdiv', jt.tac2html(html));
        app.profile.tabselect();
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


    displayProfEditButtons = function () {
        var html;
        if(jt.byId('profcancelb')) {
            return; }  //already have buttons
        html = ["&nbsp;",
                ["button", {type: "button", id: "profcancelb",
                            onclick: jt.fs("app.profile.cancelProfileEdit()")},
                 "Cancel"],
                "&nbsp;",
                ["button", {type: "button", id: "profsaveb",
                            onclick: jt.fs("app.profile.save()")},
                 "Save"]];
        jt.out('profeditbspan', jt.tac2html(html));
    },


    styleShout = function (shout) {
        var target;
        shout.style.color = app.colors.text;
        shout.style.backgroundColor = app.skinner.lightbg();
        //80px left margin + 160px image + padding
        //+ balancing right margin space (preferable)
        //but going much smaller than the image is stupid regardless of
        //screen size
        target = Math.max((app.winw - 350), 200);
        target = Math.min(target, 600);
        shout.style.width = target + "px";
        shout.style.padding = "5px 8px";
        //modify profcontdiv so it balances the text area size.  This is
        //needed so IE8 doesn't widen profpictd unnecessarily.
        target += jt.byId('profpictd').offsetWidth;
        target += 50;  //arbitrary extra to cover padding
        jt.byId('profcontdiv').style.width = String(target) + "px";
    },


    editShout = function (pen) {
        var html, shout;
        html = ["textarea", {id: "shouttxt", cla: "shoutout"}];
        jt.out('profshouttd', jt.tac2html(html));
        shout = jt.byId('shouttxt');
        styleShout(shout);
        if(!jt.isLowFuncBrowser()) {
            shout.style.backgroundColor = "rgba(" + 
                jt.hex2rgb(app.skinner.lightbg()) + ",0.6)"; }
        shout.readOnly = false;
        shout.value = pen.shoutout;
        shout.focus();
        displayProfEditButtons();
    },


    displayShout = function (pen) {
        var html, shout, text;
        text = "No additional information about " + pen.name;
        if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
            text = "Anything you would like to say to everyone (link to your site, twitter handle, favorite quote, shoutouts, interests...)"; }
        text = ["span", {style: "color:" + greytxt + ";"}, text];
        text = jt.tac2html(text);
        html = ["div", {id: "shoutdiv", cla: "shoutout"}];
        jt.out('profshouttd', jt.tac2html(html));
        shout = jt.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        if(!jt.isLowFuncBrowser()) {
            shout.style.backgroundColor = "rgba(" + 
                jt.hex2rgb(app.skinner.lightbg()) + ",0.3)"; }
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + app.colors.bodybg;
        text = jt.linkify(pen.shoutout) || text;
        jt.out('shoutdiv', text);
        if(profileModAuthorized(pen)) {
            jt.on('shoutdiv', 'click', function (e) {
                jt.evtend(e);
                editShout(pen); }); }
    },



    displayCity = function (pen) {
        var html;
        if(!pen.city) { 
            jt.byId('profcityspan').style.color = greytxt; }
        html = pen.city || unspecifiedCityText;
        if(profileModAuthorized(pen)) {
            html = ["a", {href: "#edit city", title: "Edit city",
                          id: "profcitya",
                          onclick: jt.fs("app.profile.editCity()"),
                          style: jt.toru(!pen.city, 
                                         "color:" + greytxt + ";")},
                    html]; }
        jt.out('profcityspan', jt.tac2html(html));
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var inputs, html, odiv;
        inputs = [
            jt.paramsToFormInputs(app.login.authparams()),
            ["input", {type: "hidden", name: "_id", 
                       value: jt.instId(pen)}],
            ["input", {type: "hidden", name: "returnto", 
                       value: jt.enc(window.location.href) + "#profile"}]];
        html = ["form", {action: "/profpicupload",
                         enctype: "multipart/form-data", method: "post"},
                [["div", {id: "closeline"},
                  ["a", {id: "closedlg", href: "#close",
                         onclick: jt.fs("app.cancelOverlay()")},
                   "&lt;close&nbsp;&nbsp;X&gt;"]],
                 inputs,
                 ["table",
                  [["tr", 
                    ["td", 
                     "Upload New Profile Pic"]],
                   ["tr", 
                    ["td", 
                     ["input", {type: "file", name: "picfilein", 
                                id: "picfilein"}]]],
                   ["tr", 
                    ["td", {align: "center"},
                     ["input", {type: "submit", value: "Upload"}]]]]]]];
        jt.out('overlaydiv', jt.tac2html(html));
        odiv = jt.byId('overlaydiv');
        odiv.style.left = "70px";
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = app.skinner.lightbg();
        app.onescapefunc = app.cancelOverlay;
        jt.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var html = "img/emptyprofpic.png";
        if(pen.profpic) {
            html = "profpic?profileid=" + jt.instId(pen); }
        html = ["img", {cla: "profpic", src: html}];
        jt.out('profpictd', jt.tac2html(html));
        if(profileModAuthorized(pen)) {
            jt.on('profpictd', 'click', function (e) {
                jt.evtend(e);
                if(jt.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    earnedBadgesHTML = function (pen, clickable) {
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
                attrobj = { cla: "reviewbadge", src: imgsrc,
                            title: label, alt: label};
                if(clickable) {
                    attrobj.onclick = jt.fs("app.profile.showTopRated('" +
                                            typename + "')"); }
                html.push(["img", attrobj]); } }
        return jt.tac2html(html);
    },


    proftopdivHTML = function () {
        var html;
        html = ["div", {id: "proftopdiv"},
                ["table", {id: "profdisptable"},
                 [["tr",
                   ["td", {id: "sysnotice", colspan: 3}]],
                  ["tr",
                   [["td", {id: "profpictd", rowspan: 3},
                     ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]],
                    ["td", {id: "profcitytd"},
                     [["span", {id: "profcityspan"}],
                      ["span", {id: "profeditbspan"}]]]]],
                  ["tr",
                   ["td", {id: "profshouttd", colspan: 2, valign: "top"},
                    ["div", {id: "shoutdiv", cla: "shoutout"}]]],
                  ["tr",
                   [["td", {id: "profbadgestd"}],
                    ["td", {id: "profcommbuildtd"}]]],
                  ["tr",
                   ["td", {colspan: 3},
                    ["div", {id: "proftabsdiv"}]]],
                  ["tr",
                   ["td", {colspan: 3},
                    ["div", {id: "profcontdiv"}]]]]]];
        return jt.tac2html(html);
    },


    mainDisplay = function (homepen, dispen, action, errmsg) {
        var html;
        if(!dispen) {
            dispen = homepen; }
        app.profile.verifyStateVariableValues(dispen);  //sets profpenref
        if(action === "penfinder") {
            profpenref.profstate.seltabname = "following"; }
        app.history.checkpoint({ view: "profile", 
                                 profid: jt.instId(profpenref.pen),
                                 tab: profpenref.profstate.seltabname });
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(homepen, dispen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        app.skinner.setColorsFromPen(homepen);
        html = proftopdivHTML();
        if(!app.layout.haveContentDivAreas()) { //change pw kills it
            app.layout.initContentDivAreas(); }
        jt.out('cmain', html);
        if(app.winw > 850 && jt.byId('profdisptable')) {
            jt.byId('profdisptable').style.marginLeft = "8%"; }
        jt.out('profbadgestd', earnedBadgesHTML(dispen, true));
        if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
            html = ["a", {id: "commbuild", href: "#invite",
                          onclick: jt.fs("app.profile.invite()")},
                    [["img", {cla: "reviewbadge", src: "img/follow.png"}],
                     "Invite a friend"]];
            jt.out('profcommbuildtd', jt.tac2html(html)); }
        displayShout(dispen);
        displayCity(dispen);
        displayPic(dispen);
        displayTabs(profpenref);
        app.layout.adjust();
        if(errmsg) {
            jt.err("Previous processing failed: " + errmsg); }
        if(profeditfield === "city") {
            app.profile.editCity(); }
        else if(action === "penfinder") {
            app.activity.penNameSearchDialog(); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        profpenref = null;
    },


    display: function (action, errmsg) {
        app.pen.getPen(function (homepen) {
            mainDisplay(homepen, null, action, errmsg); });
    },


    updateHeading: function () {  //called during startup
        app.pen.getPen(function (homepen) {
            writeNavDisplay(homepen, profpenref && profpenref.pen); });
    },


    refresh: function () {
        app.pen.getPen(function (homepen) {
            mainDisplay(homepen, profpenref.pen); });
    },


    settings: function () {
        app.pen.getPen(changeSettings);
    },


    tabselect: function (tabname) {
        var i, ul, li;
        verifyProfileState(profpenref);
        if(tabname) {
            profpenref.profstate.seltabname = tabname; }
        else {
            tabname = profpenref.profstate.seltabname; }
        ul = jt.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = app.skinner.darkbg(); }
        li = jt.byId(tabname + "li");
        li.className = "selectedTab";
        li.style.backgroundColor = "transparent";
        app.history.checkpoint({ view: "profile", 
                                 profid: jt.instId(profpenref.pen),
                                 tab: tabname });
        refreshContentDisplay();
    },


    resetReviews: function () {
        resetReviewDisplays(app.pen.currPenRef());
    },


    save: function () {
        profeditfield = "";
        app.pen.getPen(saveEditedProfile);
    },


    byprofid: function (id, tabname) {
        app.layout.closeDialog(); //close pen name search dialog if open
        app.profile.resetStateVars();
        findOrLoadPen(id, function (dispen) {
            if(tabname) {
                app.profile.verifyStateVariableValues(dispen);
                setCurrTabFromString(tabname); }
            app.pen.getPen(function (homepen) {
                mainDisplay(homepen, dispen); }); });
    },


    relationship: function () {
        app.revresp.clearAbuse(profpenref.pen, function () {
            app.rel.reledit(app.pen.currPenRef().pen, profpenref.pen); });
    },


    switchPen: function () {
        var i, sel = jt.byId('penselect'), temp = "";
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                //do not call cancelPenNameSettings before done accessing
                //the selection elementobjects or IE8 has issues.
                if(sel.options[i].id === 'newpenopt') {
                    app.profile.cancelPenNameSettings("Creating pen name...");
                    app.pen.newPenName(app.profile.display); }
                else {
                    temp = sel.options[i].value;
                    app.profile.cancelPenNameSettings("Switching pen names...");
                    app.pen.selectPenByName(temp); }
                break; } }
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
                 earnedBadgesHTML(pen, false)]];
        html = jt.tac2html(html);
        return html;
    },


    revsmore: function () {
        findRecentReviews(profpenref.profstate.recentRevState);
    },


    readReview: function (revid) {
        var revobj;
        revobj = app.lcs.getRevRef(revid).rev;
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


    reviewItemHTML: function (revobj, penNameStr) {
        var revid, type, linkref, linkclass, linktxt, jump = "", byline = "", 
            keywords = "", revtext = "", html;
        revid = jt.instId(revobj);
        type = app.review.getReviewTypeByValue(revobj.revtype);
        linkref = "statrev/" + revid;
        linkclass = app.revresp.foundHelpful(revid)? "rslcbold" : "rslc";
        linktxt = app.profile.reviewItemNameHTML(type, revobj);
        if(revobj.url) {
            jump = " &nbsp;" + app.review.jumpLinkHTML(revobj.url); }
        if(penNameStr) {
            byline = ["review by ",
                      ["a", {title: "Show profile for " + jt.ndq(penNameStr),
                             href: "#" + jt.objdata({view: "profile", 
                                                     profid: revobj.penid }),
                             onclick: jt.fs("app.profile.byprofid('" +
                                            revobj.penid + "')")},
                       penNameStr]]; }
        if(revobj.keywords) {
            if(penNameStr) {
                keywords += ": "; }
            keywords += jt.ellipsis(revobj.keywords, 100); }
        if(revobj.text) {
            revtext = ["div", {cla: "revtextsummary"},
                       jt.ellipsis(revobj.text, 255)]; }
        html = ["li",
                [app.review.starsImageHTML(revobj.rating),
                 app.review.badgeImageHTML(type),
                 "&nbsp;",
                 ["a", {id: "lihr" + revid, cla: linkclass, 
                        href: linkref, title: "See full review",
                        onclick: jt.fs("app.profile.readReview('" + 
                                       revid + "')")},
                  linktxt],
                 jump,
                 ["div", {cla: "revtextsummary"},
                  [byline,
                   keywords,
                   app.review.linkCountHTML(revid)]],
                 revtext]];
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


    addMORAuthId: function(mid) {
        app.pen.getPen(function (pen) {
            var previd;
            if(!mid) {
                jt.err("No account ID received.");
                app.profile.display(); }
            else {
                previd = pen.mid;
                pen.mid = mid;
                app.pen.updatePen(pen,
                                  function (updpen) {
                                      changeSettings(updpen); },
                                  function (code, errtxt) {
                                      jt.err("addMORAuthId error " +
                                             code + ": " + errtxt);
                                      pen.mid = previd;
                                      app.profile.display(); }); }
        });
    },


    writeNavDisplay: function (homepen, dispen, directive) {
        writeNavDisplay(homepen, dispen, directive);
    },


    verifyStateVariableValues: function (pen) {
        profpenref = app.lcs.getPenRef(pen);
        verifyProfileState(profpenref);
    },


    cancelPenNameSettings: function (actionTxt) {
        app.skinner.cancel();
        app.layout.closeDialog();
        if(actionTxt && typeof actionTxt === "string") {
            //nuke the main display as we are about to rebuild contents
            jt.out('centerhdiv', "");
            jt.out('cmain', actionTxt); }
    },


    saveIfNotShoutEdit: function () {
        if(jt.byId('shoutdiv')) {
            app.profile.save(); }
    },


    editCity: function () {
        var val, html, elem;
        elem = jt.byId('profcityin');
        if(elem) {
            return; }  //already editing
        val = jt.byId('profcityspan').innerHTML;
        //IE8 actually capitalizes the the HTML for you. Sheesh.
        if(val.indexOf("<a") === 0 || val.indexOf("<A") === 0) {
            val = jt.byId('profcitya').innerHTML; }
        if(val === unspecifiedCityText) {
            val = ""; }
        html = ["input", {type: "text", id: "profcityin", size: 25,
                          placeholder: "City, township, or region", value: val,
                          onchange: jt.fs("app.profile.saveIfNotShoutEdit()")}];
        jt.out('profcityspan', jt.tac2html(html));
        displayProfEditButtons();
        jt.byId('profcityin').focus();
    },


    invitecboxchange: function () {
        jt.out('mailbspan', mailButtonHTML());
    },


    //Reading people's email contacts feels creepy to me. Saving email
    //entered by friends seems presumptuous. Automatically creating an
    //account might seem nice the first time, but not if they already
    //have an account (or the click the setup link more than
    //once). The invitee might want to use a different email address
    //than the one for the invite.
    invite: function () {
        var html;
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"},
                 "Invite a friend... build your community!"],
                ["table", {cla: "formstyle"},
                 [["tr",
                   ["td", {style: "width:400px;"},
                    [["p",
                      ["span", {cla: "secondaryfield"},
                       "Use this form to generate an email you can " +
                       "edit and send..."]]]]],
                  ["tr",
                   ["td", 
                      "Particularly interested in reviews of"]],
                  ["tr",
                   ["td", {id: "invtypestd"},
                    app.review.reviewTypeCheckboxesHTML("invrevcb",
                        jt.fs("app.profile.invitecboxchange()"))]],
                  ["tr",
                   ["td", {align: "center"},
                    ["span", {id: "mailbspan"},
                     mailButtonHTML()]]]]]];
        app.layout.openDialog({x:220, y:140}, jt.tac2html(html));
    },


    showTopRated: function (typename) {
        verifyProfileState(profpenref);
        profpenref.profstate.revtype = typename;
        app.profile.tabselect("best");
    },


    searchAllRevs: function (revtype) {
        var state, qstr, maxdate, mindate, params, critsec;
        state = profpenref.profstate;
        if(revtype) {
            if(state.revtype !== revtype) {
                state.revtype = revtype;
                jt.out('revTypeSelectorDiv', 
                    revTypeSelectorHTML("app.profile.searchRevsIfTypeChange"));
                clearAllRevProfWorkState(); } }
        else {
            revtype = state.revtype; }
        qstr = jt.byId('allrevsrchin').value;
        if(qstr !== state.allRevsState.srchval) {
            state.allRevsState.srchval = qstr;
            clearAllRevProfWorkState(); }
        maxdate = (new Date()).toISOString();
        mindate = (new Date(0)).toISOString();
        params = app.login.authparams() +
            "&qstr=" + jt.enc(jt.canonize(qstr)) +
            "&revtype=" + revtype +
            "&penid=" + jt.instId(profpenref.pen) +
            "&maxdate=" + maxdate + "&mindate=" + mindate +
            "&cursor=" + jt.enc(state.allRevsState.cursor);
        critsec = critsec || "";
        jt.call('GET', "srchrevs?" + params, null,
                 function (results) { 
                     app.lcs.putRevs(results);
                     listAllRevs(results);
                     monitorAllRevQuery(); },
                 app.failf(function (code, errtxt) {
                     jt.err("searchAllRevs call died code: " + code + " " +
                             errtxt); }),
                 critsec);
    },


    searchRevsIfTypeChange: function (revtype) {
        if(profpenref.profstate.revtype !== revtype) {
            app.profile.searchAllRevs(revtype); }
    },


    readPenNameIn: function (pen) {
        var pennamein = jt.byId('pennamein');
        if(!pen) {
            pen = profpenref.pen; }
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    setEditField: function (fieldname) {
        profeditfield = fieldname;
    },


    cancelProfileEdit: function () {
        profeditfield = "";
        app.profile.updateHeading();
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
    }


};  //end of returned functions
}());

