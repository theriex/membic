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
        revsrchstate = null,
        lastInLinkType = "helpful",
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
                attrobj = { cla: "reviewbadge bbk" +
                                 app.layout.badgeDrawer(pen, typename), 
                            src: imgsrc, title: label, alt: label};
                if(clickable) {
                    attrobj.onclick = jt.fs("app.profile.showTopRated('" +
                                            typename + "')"); }
                html.push(["span", {cla: "badgespan"},
                           ["img", attrobj]]); } }
        return jt.tac2html(html);
    },


    displayProfileHeadingName = function (homepen, dispen, directive) {
        var html, id, name;
        id = jt.instId(dispen);
        name = dispen.name;
        if(directive === "nosettings") {
            name = ["a", {href: "#view=profile&profid=" + id,
                          title: "Show profile for " + name,
                          onclick: jt.fs("app.profile.byprofid('" + id + 
                                         "')")},
                    name]; }
        html = ["div", {id: "profhdiv"},
                ["table",
                 ["tr",
                  [["td", {id: "profbadgestd"},
                    earnedBadgesHTML(dispen, true)],
                   ["td", {id: "penhnametd"},
                    ["span", {id: "penhnamespan"},
                     name]],
                   ["td",
                    ["div", {id: "penhbuttondiv"},
                     " "]]]]]];
        html = jt.tac2html(html);
        app.layout.headingout(html);
    },


    displayProfileHeading = function (homepen, dispen, directive) {
        var html, id, name, relationship;
        displayProfileHeadingName(homepen, dispen, directive);
        if(directive === "nosettings") {
            return; }
        id = jt.instId(dispen);
        name = dispen.name;
        html = "";
        if(jt.instId(homepen) !== jt.instId(dispen)) {
            if(app.rel.relsLoaded()) {
                relationship = app.rel.outbound(id);
                app.profile.verifyStateVariableValues(dispen);
                if(relationship) {
                    html = ["a", {href: "#Settings", cla: "gold", 
                                  title: "Adjust follow settings for " + name,
                                  onclick: jt.fs("app.profile.relationship()")},
                            [["img", {cla: "followingico", 
                                      src: "img/followset.png"}],
                             ""]]; }
                else {
                    html = ["a", {href: "#Follow",
                                  title: "Follow " + name + " reviews",
                                  onclick: jt.fs("app.profile.relationship()")},
                            [["img", {cla: "followico", id: "followbimg",
                                      src: "img/follow.png"}],
                             "Follow"]]; }
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
        app.profile.updateTopActionDisplay(homepen);
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
                [["span", {id: "writingas"}, 
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
                ["table", {id: "pensettingstable"},
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
                   ["td", 
                    ["div", {id: "accountdiv"},
                     app.login.loginInfoHTML(pen)]]],
                  ["tr",
                   ["td", {colspan: 2, id: "settingsauthtd"}]],
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
            jt.byId('settingsnavimg').src = "img/settingsel.png";
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
            "cheers,\n" +
            mepen.name;
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
        if(rrs.total > 0) {
            html.push(["div", {cla: "tabcontentheadertext"},
                       "Reviews from you in the past " + recencyDays + 
                       " days"]); }
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
        var params;
        params = jt.objdata(rrs.params) + "&" + app.login.authparams();
        if(rrs.cursor) {
            params += "&cursor=" + jt.enc(rrs.cursor); }
        jt.call('GET', "srchrevs?" + params, null,
                function (revs) {
                    if(profpenref.profstate.seltabname !== "recent") {
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
        var html, i, reviewTypes, typename, label, imgsrc, pen, prefixstr;
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
            label = "No " + reviewTypes[i].type.capitalize() + " reviews.";
            if(pen.top20s[typename]) {
                if(pen.top20s[typename].length >= 20) {
                    label = prefixstr + reviewTypes[i].type.capitalize() +
                        " reviews."; }
                else if(pen.top20s[typename].length >= 1) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].type.capitalize() + " reviews."; } }
            html.push(["img", {cla: "reviewbadge", id: "rtsimg" + typename,
                               src: imgsrc, title: label, alt: label,
                               onmouseover: jt.fs("app.profile.mrollrts('" +
                                                  typename + "','over')"),
                               onmouseout: jt.fs("app.profile.mrollrts('" +
                                                 typename + "','out')"),
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


    displayAllRevs = function () {
        var html, state;
        state = profpenref.profstate.allRevsState;
        if(!state) {
            state = profpenref.profstate.allRevsState = {
                inputId: "allrevsrchin",
                outdivId: "allrevdispdiv",
                revrendf: function (state, type, review) {
                    return app.profile.reviewItemHTML(review); },
                revtype: profpenref.profstate.revtype,
                srchval: "",
                preserve: true }; }
        if(state.revtype !== profpenref.profstate.revtype) {
            resetSearchStateInterimResults(state);
            state.revtype = profpenref.profstate.revtype; }
        html = [["div", {id: "revTypeSelectorDiv"},
                 revTypeSelectorHTML("app.profile.revsearchIfTypeChange")],
                ["div", {id: "allrevsrchdiv"},
                 ["input", {type: "text", id: state.inputId, size: 40,
                            placeholder: "Review title or name",
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
                     String(revsrchstate.total) + " reviews searched"]);
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
                                        "matching reviews"},
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


    writeFollowTabContent = function (penref) {
        var tabtxt, html;
        if(penref.profstate.foltabmode === "following") {
            tabtxt = "Following&nbsp;(" + penref.pen.following + ")";
            if(app.winw < 600) {
                tabtxt = String(penref.pen.following); }
            html = ["a", {href: "#following",
                          title: "Click to see who you are following",
                          onclick: jt.fs("app.profile.tabselect('following')")},
                    [["img", {cla: "tabico", src: "img/following.png"}],
                     "&nbsp;" + tabtxt]]; }
        else {
            tabtxt = "Followers&nbsp;(" + penref.pen.followers + ")";
            if(app.winw < 600) {
                tabtxt = String(penref.pen.followers); }
            html = ["a", {href: "#followers",
                          title: "Click to see who is following you",
                          onclick: jt.fs("app.profile.tabselect('followers')")},
                    [["img", {cla: "tabico", src: "img/follow.png"}],
                     "&nbsp;" + tabtxt]]; }
        jt.out('followli', jt.tac2html(html));
    },


    niceTabStyling = function () {
        var css = "background:#CCCCCC;";
        if(jt.isLowFuncBrowser()) {
            return css; }
        css = "background:" + app.skinner.darkbg() + "px;" +
            " background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(rgba(255, 255, 255, .15)), to(rgba(0, 0, 0, .25))), -webkit-gradient(linear, left top, right bottom, color-stop(0, rgba(255, 255, 255, 0)), color-stop(0.5, rgba(255, 255, 255, .1)), color-stop(0.501, rgba(255, 255, 255, 0)), color-stop(1, rgba(255, 255, 255, 0)));" +
            " background: -moz-linear-gradient(top, rgba(255, 255, 255, .15), rgba(0, 0, 0, .25)), -moz-linear-gradient(left top, rgba(255, 255, 255, 0), rgba(255, 255, 255, .1) 50%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0));" +
            " background: linear-gradient(top, rgba(255, 255, 255, .15), rgba(0, 0, 0, .25)), linear-gradient(left top, rgba(255, 255, 255, 0), rgba(255, 255, 255, .1) 50%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0));";
        return css;
    },


    noTabStyling = function () {
        var css = "background: 0;";
        return css;
    },


    displayTabs = function (penref) {
        var html;
        verifyProfileState(penref);
        if(!penref.profstate.foltabmode) {
            penref.profstate.foltabmode = "following";
            if(app.pen.currPenRef() === penref) {
                penref.profstate.foltabmode = "followers"; } }
        html = ["table",  //hiding in a table to avoid phone text autozoom
                ["tr",
                 ["td",
                  ["ul", {id: "proftabsul"},
                   [["li", {id: "recentli", cla: "selectedTab"},
                     ["a", {href: "#recentreviews",
                            title: "Click to see recent reviews",
                            onclick: jt.fs("app.profile.tabselect('recent')")},
                      "Latest"]],
                    ["li", {id: "bestli", cla: "unselectedTab"},
                     ["a", {href: "#bestreviews",
                            title: "Click to see top rated",
                            onclick: jt.fs("app.profile.tabselect('best')")},
                      app.winw > 600 ? "Top&nbsp;Rated" : "Top"]],
                    ["li", {id: "allrevsli", cla: "unselectedTab"},
                     ["a", {href: "#allreviews",
                            title: "Click to see all reviews",
                            onclick: jt.fs("app.profile.tabselect('allrevs')")},
                      app.winw > 600 ? "All&nbsp;Reviews": "All"]],
                    ["li", {id: "followli", cla: "unselectedTab"}]]]]]];
        jt.out('proftabsdiv', jt.tac2html(html));
        writeFollowTabContent(penref);
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
        shout.style.color = app.colors.text;
        shout.style.backgroundColor = app.skinner.lightbg();
        //rightcoldiv - profpersonaldiv - profshoutdiv - 2*shoutdiv|shoutout
        shout.style.width = "130px";
        shout.style.padding = "5px 8px";
    },


    editShout = function (pen) {
        var html, shout;
        html = ["textarea", {id: "shouttxt", cla: "shoutout"}];
        jt.out('profshoutdiv', jt.tac2html(html));
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
        text = "No profile details";
        if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
            text = "Your website(s), Twitter handle, shoutouts..."; }
        text = ["span", {style: "color:" + greytxt + ";"}, text];
        text = jt.tac2html(text);
        html = ["div", {id: "shoutdiv", cla: "shoutout"}];
        jt.out('profshoutdiv', jt.tac2html(html));
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
        odiv.style.left = jt.byId('contentdiv').offsetWidth + "px";
        odiv.style.top = "130px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = app.skinner.lightbg();
        app.onescapefunc = app.cancelOverlay;
        jt.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var modauth, imgsrc, html, picdiv;
        modauth = profileModAuthorized(pen);
        imgsrc = "img/emptyprofpic.png";
        if(modauth && !pen.profpic) {
            picdiv = jt.byId('profpicdiv');
            picdiv.style.background = "url('" + imgsrc + "') no-repeat";
            picdiv.style.backgroundSize = "125px 125px";
            html = ["div", {id: "picplaceholderdiv"},
                    "Click to upload a pic of you, your avatar," +
                    " your goldfish..."]; }
        else { //have pic, or not authorized to upload
            if(pen.profpic) {
                imgsrc = "profpic?profileid=" + jt.instId(pen); }
            html = ["img", {cla: "profpic", src: imgsrc}]; }
        jt.out('profpicdiv', jt.tac2html(html));
        if(modauth) {
            jt.on('profpicdiv', 'click', function (e) {
                jt.evtend(e);
                if(jt.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    revimpactHTML = function (homepen, dispen) {
        var linksum, html = "";
        if(jt.instId(homepen) === jt.instId(dispen)) {
            linksum = app.pen.currPenRef().linksummary;
            if(linksum) {
                html = ["div", {id: "inlinkdiv"},
                        ["table",
                         [["tr",
                           [["td", {align: "left"}, 
                             ["img", {cla: "reviewbadge",
                                      src: "img/friendresp.png"}]],
                            ["td", {align: "right"}, 
                             ["a", {href: "#helpful",
                                    onclick: jt.fs("app.profile.displayResp('" +
                                                   "helpful')")},
                              "helpful:"]],
                            ["td", {cla: "inbct"},
                             String(linksum.helpsrc) + "/" +
                             String(linksum.helpful)]]],
                          ["tr",
                           [["td", {colspan: 2, align: "right"}, 
                             ["a", {href: "#remembered",
                                    onclick: jt.fs("app.profile.displayResp('" +
                                                   "remembered')")},
                              "remembered:"]],
                            ["td", {cla: "inbct"},
                             String(linksum.remsrc) + "/" + 
                             String(linksum.remembered)]]],
                          ["tr",
                           [["td", {colspan: 2, align: "right"},
                             ["a", {href: "#corresponding",
                                    onclick: jt.fs("app.profile.displayResp('" +
                                                   "corresponding')")},
                              "corresponding:"]],
                            ["td", {cla: "inbct"},
                             String(linksum.correspsrc) + "/" + 
                             String(linksum.corresponding)]]]]]]; } }
        return html;
    },


    inviteHTML = function () {
        var html = "";
        if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
            html = ["a", {id: "commbuild", href: "#invite",
                          onclick: jt.fs("app.profile.invite()")},
                    [["img", {cla: "reviewbadge", src: "img/follow.png"}],
                     "Send Invite"]]; }
        return html;
    },


    createGroupHTML = function () {
        var html = "";
        if(jt.instId(profpenref.pen) === app.pen.currPenId()) {
            html = ["a", {id: "creategroup", href: "#creategroup",
                          onclick: jt.fs("app.profile.createGroup()")},
                    [["img", {cla: "reviewbadge", src: "img/group.png"}],
                     "Create Group"]]; }
        return html;
    },


    clickspan = function (html, funcstr) {
        html = ["span", {cla: "clickspan", onclick: funcstr},
                html];
        return jt.tac2html(html);
    },


    tabswitch = function (tabname) {
        var i, ul, li;
        ul = jt.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.cssText = niceTabStyling(); }
        li = jt.byId(tabname + "li");
        if(!li && tabname.indexOf("follow") >= 0) {
            profpenref.profstate.foltabmode = tabname;
            writeFollowTabContent(profpenref);
            li = jt.byId("followli"); }
        li.className = "selectedTab";
        li.style.cssText = noTabStyling();
        li.style.backgroundColor = "transparent";
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
        app.layout.updateNavIcons("profile");
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        app.skinner.setColorsFromPen(homepen);
        if(!app.layout.haveContentDivAreas()) { //change pw kills it
            app.layout.initContentDivAreas(); }
        html = ["div", {id: "proftopdiv"},
                [["div", {id: "profparticipatediv"},
                  [["div", {id: "sysnotice"}],
                   ["div", {id: "proftabsdiv"}],
                   ["div", {id: "profcontdiv"}]]]]];
        jt.out('cmain', jt.tac2html(html));
        html = ["div", {id: "profpersonaldiv"},
                [["div", {id: "profpicdiv"},
                  ["img", {cla: "profpic", src: "img/emptyprofpic.png"}]],
                 ["div", {id: "profcitydiv"},
                  [["span", {id: "profcityspan"}],
                   ["span", {id: "profeditbspan"}]]],
                 ["div", {id: "profshoutdiv"},
                  ["div", {id: "shoutdiv", cla: "shoutout"}]],
                 ["div", {id: "wdydfunblogdiv"},
                  ["a", {href: "blogs/" + dispen.name_c,
                         onclick: jt.fs("window.open('blogs/" + 
                                        dispen.name_c + "')")},
                   "wdydfun blog"]],
                 ["div", {id: "profrevimpactdiv"},
                  revimpactHTML(homepen, dispen)],
                 ["div", {id: "profinvitediv"},
                  inviteHTML()],
                 ["div", {id: "creategroupdiv"},
                  createGroupHTML()]]];
        jt.out('rightcoldiv', jt.tac2html(html));
        jt.byId('rightcoldiv').style.display = "block";
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
        revsrchstate = null;
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
        verifyProfileState(profpenref);
        if(tabname) {
            profpenref.profstate.seltabname = tabname; }
        else {
            tabname = profpenref.profstate.seltabname; }
        tabswitch(tabname);
        app.history.checkpoint({ view: "profile", 
                                 profid: jt.instId(profpenref.pen),
                                 tab: tabname });
        refreshContentDisplay();
        app.layout.adjust();
    },


    displayResp: function (inlinktype) {
        var inlinks, i, revitems = [], revref, html = "";
        if(!inlinktype || typeof inlinktype !== "string") {
            inlinktype = lastInLinkType; }
        lastInLinkType = inlinktype;
        tabswitch('recent');
        inlinks = app.pen.currPenRef().inlinks;
        if(!inlinks || inlinks.length === 0) {
            revitems.push(["li", "No reviews found"]); }
        for(i = 0; inlinks && i < inlinks.length; i += 1) {
            if(inlinks[i][inlinktype]) {
                revref = app.lcs.getRevRef(inlinks[i].revid);
                if(revref.rev) {
                    revitems.push(app.profile.reviewItemHTML(revref.rev)); }
                else if(revref.status === "not cached") {
                    revitems.push(["li", "Fetching review " +
                                   inlinks[i].revid + "..."]);
                    break; } } }
        switch(inlinktype) {
          case 'helpful': 
            html = "Reviews that have been helpful to other people"; break;
          case 'remembered':
            html = "Reviews other people have remembered"; break;
          case 'corresponding':
            html = "Reviews of things other people also reviewed"; break; }
        html = [["div", {cla: "tabcontentheadertext"},
                 html],
                ["ul", {cla: "revlist"}, revitems]];
        jt.out('profcontdiv', jt.tac2html(html));
        app.layout.adjust();
        if(inlinks && i < inlinks.length) { //didn't have all revs
            app.lcs.getRevFull(inlinks[i].revid, app.profile.displayResp); }
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
        app.layout.updateNavIcons("review");
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


    reviewItemHTML: function (revobj, penNameStr, liattrobj) {
        var revid = jt.instId(revobj), 
            type = app.review.getReviewTypeByValue(revobj.revtype), 
            linkref = "statrev/" + revid, 
            linkclass = app.revresp.foundHelpful(revid)? "rslcbold" : "rslc",
            linktxt = app.profile.reviewItemNameHTML(type, revobj),
            divattrs = {cla: "revtextsummary", 
                        style: "padding:0px 0px 0px 97px;"},
            jump = "", byline = "", keywords = "", revtext = "", html,
            revclick = jt.fs("app.profile.readReview('" + revid + "')");
        if(app.winw < 700) {
            divattrs.style = "padding:0px 0px 0px 10px;"; }
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
            revtext = ["div", divattrs,
                       jt.ellipsis(revobj.text, 255)]; }
        html = ["li", liattrobj,
                [clickspan(app.review.starsImageHTML(revobj.rating), revclick),
                 clickspan(app.review.badgeImageHTML(type), revclick),
                 "&nbsp;",
                 ["a", {id: "lihr" + revid, cla: linkclass, 
                        href: linkref, title: "See full review",
                        onclick: revclick},
                  linktxt],
                 jump,
                 ["div", divattrs,
                  [byline,
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
        html = ["input", {type: "text", id: "profcityin", size: 16,
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
        if(srchstate) {
            app.profile.clearRevSearch();  //clear any outstanding timeouts
            revsrchstate = srchstate;
            app.profile.clearRevSearch();  //reset and init as needed
            if(revsrchstate.revs.length > 0) {  //skip initial db call
                displayRevSearchResults([]);
                monitorRevSearchValue(); }
            else {
                setTimeout(app.profile.revsearch, 50); }
            return; }
        //verify not already searching what is being requested
        if(revsrchstate.inprog &&
               revsrchstate.inprog.revtype === revsrchstate.revtype &&
               revsrchstate.inprog.srchval === revsrchstate.srchval &&
               revsrchstate.inprog.cursor === revsrchstate.cursor) {
            return; }
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
            "&revtype=" + revsrchstate.revtype +
            "&penid=" + penid +
            "&maxdate=" + revsearchMaxDate() + 
            "&mindate=1970-01-01T00:00:00Z" + 
            "&cursor=" + jt.enc(revsrchstate.cursor);
        jt.call('GET', "srchrevs?" + params, null,
                function (results) { 
                    app.lcs.putRevs(results);
                    displayRevSearchResults(results);
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
            displayAllRevs(); }
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
    },


    updateTopActionDisplay: function (pen, mode) {
        var html, imgsrc = "profile.png";
        if(!jt.byId('homepenhdiv')) {
            app.login.updateAuthentDisplay(); }
        if(!mode) {
            mode = app.layout.currnavmode(); }
        if(mode === "profile") {
            imgsrc = "profilesel.png"; }
        html = ["div", {cla: "topnavitemdiv"},
                jt.imgntxt(imgsrc, "",
                           "app.profile.display()",
                           "#view=profile&profid=" + jt.instId(pen),
                           "Show profile for " + pen.name + " (you)",
                           "naviconospace", "navprof", 
                           "app.profile.mrollp")];
        jt.out('homepenhdiv', jt.tac2html(html));
        html = jt.imgntxt("settings.png", "", 
                          "app.profile.settings()",
                          "#Settings",
                          "Adjust your profile settings",
                          "naviconospace", "settingsnav",
                          "app.profile.mrollset");
        jt.out('settingsbuttondiv', html);
        displayInboundLinkIndicator();
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


    createGroup: function () {
        jt.err("New feature. Not implemented yet. Soon...")
    },


};  //end of returned functions
}());

