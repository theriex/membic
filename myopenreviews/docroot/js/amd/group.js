/*global alert: false, document: false, app: false, jt: false, window: false  */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

// pen.stash (maintained by client)
//   key: grp + groupid
//     posts: CSV of revids, most recent first. Not an array.
//     lastpost: ISO date string when most recent review was posted
// group.adminlog (array of entries maintained by server)
//   when: ISO date
//   penid: admin that took the action
//   pname: name of admin that took the action
//   action: e.g. "Accepted Membership", "Removed Review", "Removed Member"
//   target: revid or penid of what or was affected
//   tname: name of pen or review that was affected
//   reason: text given as to why (required for removals)
app.group = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    //avoiding having any state variables to reset..
    var currgrpid = 0,
        wizgrp = null,  //going away...
        verifyCityNextFunc = null, //dialog callback 
        revfreqs = [{name: "2 weeks", freq: 14, id: "freq14"},
                    {name: "monthly", freq: 30, id: "freq30"},
                    {name: "2 months", freq: 60, id: "freq60"},
                    {name: "quarterly", freq: 90, id: "freq90"},
                    {name: "6 months", freq: 180, id: "freq180"},
                    {name: "yearly", freq: 365, id: "freq365"}],
        revPostTimeout = null,  //review group ref update write timer


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    currGroupRef = function (grpref, tabname) {
        if(grpref) {
            currgrpid = jt.instId(grpref.group); }
        grpref = grpref || app.lcs.getRef("group", currgrpid);
        grpref.dispstate = grpref.dispstate || { seltabname: 'latest',
                                                 revtype: "" };
        if(tabname) {
            grpref.dispstate.seltabname = tabname; }
        return grpref;
    },


    picImgSrc = function (group) {
        var src = "img/emptyprofpic.png";
        if(group.picture) {
            //fetch with mild cachebust in case recently modified
            src = "grppic?groupid=" + jt.instId(group) +
                "&modified=" + group.modified; }
        return src;
    },


    groupCalendarHTML = function (group) {
        //if the group has an associated calendar, provide a jump link
        //to it.  Best if the icon actually displays the current day,
        //so this will be some kind of overlay with clipped overflow.
        return "";
    },


    isFollowing = function (group) {
        var pen = app.pen.myPenName();
        if(pen.groups && pen.groups.csvcontains(jt.instId(pen))) {
            return true; }
        return false;
    },


    penBelongsToGroup = function (group, penid) {
        if(group.founders && group.founder.csvcontains(penid)) {
            return true; }
        if(group.moderators && group.moderators.csvcontains(penid)) {
            return true; }
        if(group.members && group.members.csvcontains(penid)) {
            return true; }
        return false;
    },


    groupSettingsHTML = function (group) {
        var html;
        if(!isFollowing(group) && !penBelongsToGroup(app.pen.myPenId())) {
            return ""; }
        html = ["a", {id: "profsettingslink", href: "#groupsettings",
                      onclick: jt.fs("app.group.settings()")},
                ["img", {cla: "reviewbadge",
                         src: "img/settings.png"}]];
        return jt.tac2html(html);
    },


    displayRecent = function (grpref) {
        var rt, ids, html, text, i, revid, pr, rev, params;
        grpref = currGroupRef(grpref);
        app.layout.displayTypes(displayRecent);
        rt = app.layout.getType();
        if(grpref.dispstate.recentids) {
            ids = grpref.dispstate.recentids;
            html = [];
            if(!ids.length) {
                text = "No recent " + app.typeOrBlank(rt) + " membics";
                html.push(["div", {cla: "fpinlinetextdiv"}, text]); }
            pr = null;
            for(i = 0; i < ids.length; i += 1) {
                revid = ids[i];
                rev = app.lcs.getRef("rev", revid).rev;
                if(rev && (rt === "all" || rt === rev.revtype)) {
                    html.push(app.activity.feedReviewHTML(
                        "grd", rev, app.review.isDupeRev(rev, pr), 
                        "app.group.toggleExpansion"));
                    pr = rev; } }
            jt.out('profcontdiv', jt.tac2html(html));
            return; }
        jt.out('profcontdiv', "Retrieving recent group membics");
        params = app.login.authparams() + "&grpid=" + jt.instId(grpref.group) +
            "&revtype=" + rt;
        jt.call('GET', "srchrevs?" + params, null,
                function (revs) {
                    if(grpref.dispstate.seltabname !== "latest") {
                        //switched tabs before data returned. Bail out.
                        return; }
                    revs = app.review.collateDupes(revs);
                    grpref.dispstate.recentids = [];
                    for(i = 0; i < revs.length; i += 1) {
                        grpref.dispstate.recentids.push(jt.instId(revs[i]));
                        app.lcs.put("rev", revs[i]); }
                    displayRecent(grpref); },
                app.failf(function (code, errtxt) {
                    jt.out('profcontdiv', "Group displayRecent failed code " +
                           code + ": " + errtxt); }),
                jt.semaphore("group.displayRecent"));
    },


    displayFavorites = function (grpref) {
        jt.out('profcontdiv', "Group displayFavorites not implemented yet.");
    },


    displaySearch = function (grpref) {
        jt.out('profcontdiv', "Group displaySearch not implemented yet.");
    },


    displayTab = function (tabname) {
        var grpref = currGroupRef();
        tabname = tabname || grpref.dispstate.seltabname || "latest";
        grpref.dispstate.seltabname = tabname;
        jt.byId('latestli').className = "unselectedTab";
        jt.byId('favoritesli').className = "unselectedTab";
        jt.byId('searchli').className = "unselectedTab";
        jt.byId(tabname + "li").className = "selectedTab";
        switch(tabname) {
        case "latest": return displayRecent(grpref);
        case "favorites": return displayFavorites(grpref);
        case "search": return displaySearch(grpref); }
    },


    membership = function (group) {
        var penid;
        if(!group) {
            group = wizgrp; }
        if(!group) {  //happens if called from static group display
            return ""; }
        if(group.membership) {  //already calculated, return that value
            return group.membership; }
        group.membership = "";
        penid = jt.instId(app.pen.myPenId());
        if(jt.idInCSV(penid, group.founders)) {
            group.membership = "Founder"; }
        else if(jt.idInCSV(penid, group.moderators)) {
            group.membership = "Moderator"; }
        else if(jt.idInCSV(penid, group.members)) {
            group.membership = "Member"; }
        return group.membership;
    },


    isApplying = function () {
        var penid = jt.instId(app.pen.myPenName());
        if(jt.idInCSV(penid, wizgrp.seeking)) {
            return true; }
        return false;
    },


    followsetHTML = function () {
        var html;
        if(isFollowing() || membership()) {
            html = ["a", {href: "#Settings", cla: "gold",
                          title: "Membership and follow settings",
                          onclick: jt.fs("app.group.settings()")},
                    [["img", {cla: "followingico",
                              src: "img/followset.png"}],
                      ""]]; }
        else {
            html = ["a", {href: "#Follow",
                          title: "Follow " + wizgrp.name,
                          onclick: jt.fs("app.group.follow()")},
                    [["img", {cla: "followico", id: "followbimg",
                              src: "img/follow.png"}],
                     "Follow"]]; }
        return jt.tac2html(html);
    },


    daysAgo = function (date) {
        var diff, now = new Date();
        if(typeof date === "string") {
            date = jt.ISOString2Day(date); }
        diff = now.getTime() - date.getTime();
        diff = Math.floor(diff / (24 * 60 * 60 * 1000));
        if(diff < 0) {    //happens if within first hour of next day
            diff = 0; }
        return diff;
    },


    postMessageHTML = function () {
        var key, stash, days, html;
        key = "grp" + jt.instId(wizgrp);
        stash = app.pen.myPenName().stash;
        html = "You haven't posted yet.";
        if(stash[key] && stash[key].lastpost) {
            days = daysAgo(stash[key].lastpost);
            switch(days) {
            case 0: html = "You posted today."; break;
            case 1: html = "You posted yesterday."; break;
            default: html = "You posted " + days + " days ago."; } }
        return html;
    },


    groupActionsHTML = function () {
        var lis = [], html = "";
        if(membership()) {
            lis.push(["li", postMessageHTML()]); }
        //Not duplicating the membership reject/accept notices and
        //processing here.  Seems better to centralize all notices
        //requiring attention on the main activity display.  If that
        //changes, or other notices are needed, this is where...
        if(lis.length > 0) {
            html = ["ul", {cla: "revlist"}, lis]; }
        return html;
    },


    verifyWorkingWizVars = function () {
        if(wizgrp) {  //don't attach temp vars to nothing
            wizgrp.pgsize = 20;
            wizgrp.revpage = wizgrp.revpage || 0;
            if(!wizgrp.revids) {
                if(!wizgrp.reviews) {
                    wizgrp.revids = []; }
                else {
                    wizgrp.revids = wizgrp.reviews.split(","); } } }
    },


    //Called *after* the current page of reviews are available. Sanity
    //checks the pen.stash values against what's available in the group.
    verifyStash = function (modf) {
        var pen, key, modified = false, psg, penid, end, i, revref, revid;
        pen = app.pen.myPenName();
        key = "grp" + jt.instId(wizgrp);
        if(!pen.stash) {
            modified = true;
            pen.stash = {}; }
        if(!pen.stash[key]) {
            modified = true;
            pen.stash[key] = { posts: "" }; }
        if(!pen.stash[key].posts && pen.stash[key].lastpost) {
            modified = true;  //either initialized, or last rev removed
            pen.stash[key].lastpost = ""; }
        psg = pen.stash[key];
        if(!psg.name || psg.name !== wizgrp.name) {
            psg.name = wizgrp.name;
            modified = true; }
        penid = jt.instId(pen);
        verifyWorkingWizVars();
        end = Math.min(wizgrp.pgsize, wizgrp.revids.length);
        for(i = 0; i < end; i += 1) {
            revref = app.lcs.getRef("rev", wizgrp.revids[i]);
            if(revref.rev && revref.rev.penid === penid) {
                if(!psg.lastpost || revref.rev.modified > psg.lastpost) {
                    psg.lastpost = revref.rev.modified;
                    modified = true; }
                revid = jt.instId(revref.rev);
                if(!jt.idInCSV(revid, psg.posts)) {
                    if(psg.posts) {
                        psg.posts += ","; }
                    psg.posts += revid;
                    modified = true; } } }
        if(modified) {
            app.pen.updatePen(pen, modf, app.failf); }
    },


    removeReviewFromStash = function (revid, contf) {
        var pen, key, revids, i, filtered = [];
        pen = app.pen.myPenName();
        key = "grp" + jt.instId(wizgrp);
        if(jt.idInCSV(revid, pen.stash[key].posts)) {
            revids = pen.stash[key].posts.split(",");
            for(i = 0; i < revids.length; i += 1) {
                if(revids[i] !== revid) {
                    filtered.push(revids[i]); } }
            pen.stash[key].posts = filtered.join(",");
            pen.stash[key].lastpost = "";  //rebuild in verifyStash
            app.pen.updatePen(pen, contf, app.failf); }
        else {  //might have removed someone else's review, rebuild display
            contf(); }
    },


    displayReviewList = function (lis) {
        jt.out('grouprevsdiv', jt.tac2html(
            ["ul", {cla: "revlist"}, lis]));
    },


    removefstr = function (group, revid) {
        var authorized = false, role, revref;
        if(!authorized) {
            role = membership(group);
            if(role === "Founder" || role === "Moderator") {
                authorized = true; } }
        if(!authorized) {
            revref = app.lcs.getRef("rev", revid);
            if(revref.rev.penid === jt.instId(app.pen.myPenName())) {
                authorized = true; } }
        if(authorized) {
            return "app.group.remrev('" + revid + "')"; }
        return "";
    },


    displayGroupReviews = function () {
        var end, i, revref, penref, pname, lis = [];
        verifyWorkingWizVars();
        end = Math.min((wizgrp.revpage + wizgrp.pgsize), wizgrp.revids.length);
        if(end === 0) {
            lis.push(["li", "No Reviews posted"]); }
        for(i = wizgrp.revpage; i < end; i += 1) {
            revref = app.lcs.getRef("rev", wizgrp.revids[i]);
            if(revref.status === "not cached") {
                lis.push(["li", "Fetching Review " + wizgrp.revids[i] + "..."]);
                displayReviewList(lis);
                return app.lcs.getFull("rev", wizgrp.revids[i], 
                                       displayGroupReviews); }
            if(revref.rev) {
                penref = app.lcs.getRef("pen", revref.rev.penid);
                if(penref.status === "not cached") {
                    lis.push(["li", "Fetching Pen Name " + revref.rev.penid + 
                              "..."]);
                    displayReviewList(lis);
                    return app.lcs.getFull("pen", revref.rev.penid,
                                           displayGroupReviews); }
                //no "via" byline when displaying within group
                pname = penref.pen.name;
                if(penref.penid === app.pen.myPenId()) {
                    pname = "you"; }
                lis.push(app.pgd.reviewItemHTML(revref.rev, pname,
                    null, removefstr(wizgrp, wizgrp.revids[i]))); } }
        displayReviewList(lis);
        //ATTENTION: paginate using wizgrp.revpage, 20 reviews at a time
        verifyStash(app.group.display);
    },


    memberNameHTML = function (edit, penid) {
        var penref = app.lcs.getRef("pen", penid);
        return jt.tac2html(
            ["span", {id: "memspan" + penid, cla: "memspan"},
             ["a", {href: "#member",
                    onclick: jt.fs("app.group.memedit(" + edit + ",'" +
                                   penid + "')")},
              penref.pen.name]]);
    },


    membersHTML = function (csv, edit, contf) {
        var penids, i, penref, html = "";
        if(!csv) {
            return "None"; }
        penids = csv.split(",");
        for(i = 0; i < penids.length; i += 1) {
            penref = app.lcs.getRef("pen", penids[i]);
            if(penref.status === "not cached") {
                if(html) {
                    html += ", "; }
                html += "Fetching Pen Name " + penids[i] + "...";
                return app.lcs.getFull("pen", penids[i], contf); }
            if(penref.pen) {
                if(html) {
                    html += ", "; }
                html += memberNameHTML(edit, penids[i]); } }
        return html;
    },


    memberInviteHTML = function (text) {
        var pen, subj, body;
        pen = app.pen.myPenName();
        subj = "invite for " + wizgrp.name;
        body = "Hi,\n\n" +
            "I'd like you to join \"" + wizgrp.name + "\" which is a review group I'm part of. Here's the description:\n\n" +
            wizgrp.description + "\n\n" +
            "I'm guessing you would have some great things to share, check it out and join if you can, it would be great to hear from you!\n\n" +
            "http://www.fgfweb.com/groups/" + wizgrp.name_c + "\n\n" +
            "cheers,\n" +
            pen.name;
        if(!text) {
            text = ["img", {src: "img/email.png"}]; }
        return ["a", {href: "mailto:?subject=" + jt.dquotenc(subj) +
                            "&body=" + jt.dquotenc(body) + "%0A",
                      title: "Invite a friend to join"},
                text];
    },


    displayGroupMembers = function () {
        var staturl = "http://www.fgfweb.com/groups/" + wizgrp.name_c;
        jt.out('groupmembersdiv', jt.tac2html(
            ["table", 
             [["tr",
               ["td", {colspan: 2, cla: "permalink"},
                ["Public site ",
                 ["a", {href: staturl, 
                        onclick: jt.fs("window.open('" + staturl + "')")},
                  staturl]]]],
              ["tr",
               [["td", {cla: "tdright"},
                 ["div", {cla: "memberstypeheadingdiv"},
                  memberInviteHTML("Invite a friend")]],
                ["td", 
                 ["div", {cla: "memberslistdiv"},
                  memberInviteHTML()]]]],
              ["tr",
               [["td", {cla: "tdright"}, 
                 ["div", {cla: "memberstypeheadingdiv"},
                  "Founders"]],
                ["td", 
                 ["div", {cla: "memberslistdiv"},
                  membersHTML(wizgrp.founders, 
                              false,
                              displayGroupMembers)]]]],
              ["tr",
               [["td", {cla: "tdright"}, 
                 ["div", {cla: "memberstypeheadingdiv"},
                  "Moderators"]],
                ["td", 
                 ["div", {cla: "memberslistdiv"},
                  membersHTML(wizgrp.moderators, 
                              membership() === "Founder",
                              displayGroupMembers)]]]],
              ["tr",
               [["td", {cla: "tdright"}, 
                 ["div", {cla: "memberstypeheadingdiv"},
                  "Members"]],
                ["td", 
                 ["div", {cla: "memberslistdiv"},
                  membersHTML(wizgrp.members, 
                              (membership() === "Founder" ||
                               membership() === "Moderator"),
                              displayGroupMembers)]]]]]]));
    },


    logactionHTML = function(log, redrawf) {
        var penref, text;
        switch(log.action) {
        case "Removed Review":
            return ["a", {href: "#review",
                          onclick: jt.fs("app.review.initWithId('" +
                                         log.target + "','read')")},
                    log.action];
        case "Denied Membership":
        case "Accepted Member":
        case "Removed Member":
            text = log.action;
            penref = app.lcs.getRef("pen", log.target);
            if(penref.status === "not cached") {
                window.setTimeout(function () {
                    app.lcs.getFull("pen", log.target, redrawf); },
                           700); }  //low priority fill in 
            if(penref.pen) {
                text = log.action.split(" ")[0] + " " + penref.pen.name; }
            return ["a", {href: "#" + jt.objdata({view: "profile",
                                                  profid: log.target}),
                          onclick: jt.fs("app.pen.bypenid('" +
                                         log.target + "')")},
                    text];
        default: return log.action; }
    },


    displayAdminLog = function () {
        var jsonobj, i, log, penref, rows = [];
        if(wizgrp.adminlog) {
            if(typeof wizgrp.adminlog === "string") {
                jsonobj = JSON || window.JSON;
                try {
                    wizgrp.adminlog = jsonobj.parse(wizgrp.adminlog);
                } catch(e) {
                    jt.log("adminlog not valid JSON.");
                    return "";
                } }
            for(i = 0; i < Math.min(wizgrp.adminlog.length, 20); i += 1) {
                log = wizgrp.adminlog[i];
                penref = app.lcs.getRef("pen", log.penid);
                if(penref.status === "not cached") {
                    break; }  //stop looping through, fetch and retry
                if(penref.pen) {
                    rows.push(
                        ["tr",
                         [["td", {cla: "secondaryfield"},
                           jt.colloquialDate(jt.ISOString2Day(log.when))],
                          ["td",
                           ["a", {href: "#" + jt.objdata({view: "profile",
                                                          profid: log.penid}),
                                  onclick: jt.fs("app.pen.bypenid('" +
                                                 log.penid + "')")},
                            penref.pen.name]],
                          ["td",
                           logactionHTML(log, displayAdminLog)],
                          ["td",  //might have %20 space encoding from server..
                            jt.dec(log.reason || "")]]]); } }
            if(penref && penref.status === "not cached") {
                //all admins will be loaded by the membership display, so
                //give that a chance to finish first.
                return window.setTimeout(function () {
                    app.lcs.getFull("pen", log.penid, displayAdminLog); },
                                  400); } }
        jt.out("groupadminlogdiv", jt.tac2html(
            ["table", {cla: "logdisptable"}, rows]));
    },


    displayGroupBody = function () {
        var html;
        if(wizgrp.dispmode === "members") {
            html = ["div", {id: "groupmaindiv"},
                    [["div", {id: "groupmembersdiv"}],
                     ["div", {id: "groupadminlogdiv"}]]];
            jt.out('cmain', jt.tac2html(html));
            displayGroupMembers();
            displayAdminLog(); }
        else {
            html = ["div", {id: "groupmaindiv"},
                    [["div", {id: "groupactionsdiv"},
                      groupActionsHTML()],
                     ["div", {id: "grouprevsdiv"}]]];
            jt.out('cmain', jt.tac2html(html));
            displayGroupReviews(); }
    },


    displayGroup = function (groupref) {
        var html, group;
        group = groupref.group;
        //same exact layout as a profile, so same css classes if possible
        html = ["div", {id: "profilediv"},
                [["div", {id: "profupperdiv"},
                  [["div", {id: "profpicdiv"},
                    ["img", {cla: "profpic", src: picImgSrc(group)}]],
                   ["div", {id: "profdescrdiv"},
                    [["div", {id: "profnamediv"},
                      [["a", {href: "#view=group&groupid=" + jt.instId(group),
                              onclick: jt.fs("app.group.blogconf()")},
                        ["span", {cla: "penfont"}, group.name]],
                       groupCalendarHTML(group),
                       groupSettingsHTML(group)]],
                     ["div", {id: "profshoutdiv"},
                      ["span", {cla: "shoutspan"}, 
                       jt.linkify(group.description || "")]]]]]],
                 ["div", {id: "workstatdiv"}],  //save button, update status
                 ["div", {id: "tabsdiv"},
                  ["ul", {id: "tabsul"},
                   [["li", {id: "latestli", cla: "unselectedTab"},
                     ["a", {href: "#latestmembics",
                            onclick: jt.fs("app.group.tabsel('latest')")},
                      ["img", {cla: "tabico", src: "img/tablatest.png"}]]],
                    ["li", {id: "favoritesli", cla: "unselectedTab"},
                     ["a", {href: "#favoritemembics",
                            onclick: jt.fs("app.group.tabsel('favorites')")},
                      ["img", {cla: "tabico", src: "img/helpfulq.png"}]]],
                    ["li", {id: "searchli", cla: "unselectedTab"},
                     ["a", {href: "#searchmembics",
                            onclick: jt.fs("app.group.tabsel('search')")},
                      ["img", {cla: "tabico", src: "img/search.png"}]]]]]],
                 ["div", {id: "profcontdiv"}]]];
        jt.out('contentdiv', jt.tac2html(html));
        displayTab();
    },


    copyGroup = function (group) {
        var groupid;
        //set or default all working field values
        wizgrp = { name: group.name || "",
                   city: group.city || "",
                   description: group.description || "",
                   picture: group.picture || "",
                   revtypes: group.revtypes || "",
                   revfreq: group.revfreq || "30",
                   founders: group.founders || "",
                   moderators: group.moderators || "",
                   members: group.members || "",
                   seeking: group.seeking || "",
                   rejects: group.rejects || "",
                   reviews: group.reviews || "",
                   modified: group.modified || "",
                   adminlog: group.adminlog || ""};
        wizgrp.name_c = group.name_c || jt.canonize(group.name);
        groupid = jt.instId(group);
        if(groupid) {
            jt.setInstId(wizgrp, groupid); }
    },


    cityValSelectHTML = function (cityvals) {
        var html, i;
        if(cityvals.length > 1) {
            html = [];
            for(i = 0; i < cityvals.length; i += 1) {
                html.push(["li",
                           [jt.radiobutton("citysel", "citysel" + i), i === 0,
                            "app.group.profCityCB('" + cityvals[i].trim() + 
                                                 "')"]]); }
            html = ["ul", {cla: "revlist"},
                    html]; }
        else {
            html = cityvals[0].trim(); }
        html = [["input", {type: "hidden", name: "hcityin", id: "hcityin",
                           value: cityvals[0].trim()}],
                html];
        return html;
    },


    fieldTableRow = function (obj, fname, fdef) {
        var tds = [], opts = [], attrs, i, html = "";
        switch(fdef.type) {
        case "text":
            tds.push(["td", {cla: "tdnowrap"},
                      ["span", {cla: "secondaryfield"},
                       fname.capitalize()]]);
            if(fdef.edit) {
                tds.push(["td",
                          ["input", {type: "text", id: fname + "in",
                                     size: 25, value: obj[fname],
                                     onchange: fdef.onchange || ""}]]); }
            else {
                tds.push(["td", {cla: "tdwide"},
                          ["span", {cla: fdef.valclass || ""},
                           obj[fname]]]); }
            html = ["tr", tds];
            break;
        case "textarea":
            if(fdef.edit) {
                html = ["tr",
                        ["td", {colspan: 2},
                         [["div", {cla: "secondaryfield"},
                           fname.capitalize()],
                          ["textarea", {id: fname + "in",
                                        cla: "groupdescrtxt",
                                        style: "height:100px;"},
                           obj[fname] || ""]]]]; }
            else {
                html = ["tr",
                        ["td", {colspan: 2},
                         ["div", {cla: "groupdescrtxt", 
                                  style: "padding-left:10px;"},
                          obj[fname]]]]; }
            break;
        case "revtypesel":
            //type selection is off the main display now
            html = "";
            break;
        case "frequency":
            tds.push(["td", {cla: "tdnowrap"},
                      ["span", {cla: "secondaryfield"},
                       fdef.printName || fname.capitalize()]]);
            if(fdef.edit) {
                for(i = 0; i < revfreqs.length; i += 1) {
                    attrs = {id: revfreqs[i].id};
                    if(jt.safeint(obj[fname]) === revfreqs[i].freq || 
                       (!obj[fname] && i === 1)) {
                        attrs.selected = "selected"; }
                    opts.push(["option", attrs, revfreqs[i].name]); }
                tds.push(["td", {cla: "tdwide"},
                          ["select", {id: fname + "sel"},
                           opts]]); }
            else {
                for(i = 0; i < revfreqs.length; i += 1) {
                    if(obj[fname] === revfreqs[i].freq ||
                       (!obj[fname] && i === 1)) {
                        tds.push(["td", {cla: "tdwide"},
                                  revfreqs[i].name]);
                        break; } } }
            html = ["tr", tds];
            break;
        default:
            jt.log("Unknown fieldTableRow type " + fdef.type); }
        return html;
    },


    fieldTableHTML = function (obj, fields, descrip) {
        var field, rows = [], html, described = false;
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit && !described) {
                    rows.push(["tr",
                               ["td", {colspan: 2},
                                descrip]]);
                    described = true; }
                rows.push(fieldTableRow(obj, field, fields[field])); } }
        if(!described) {
            rows.push(["tr",
                       ["td", {colspan: 2},
                        descrip]]); }
        html = ["table", {cla: "grpwiztable"},
                rows];
        return html;
    },


    buttonsHTML = function (buttons) {
        var i, html = [];
        for(i = 0; i < buttons.length; i += 1) {
            html.push(["button", {type: "button", 
                                  id: jt.canonize(buttons[i].name),
                                  onclick: jt.fs(buttons[i].fstr)},
                       buttons[i].name]); }
        html = ["div", {id: "primgroupbuttonsdiv"},
                html];
        return html;
    },


    adjustWidthsAndSetFocus = function (fields) {
        var field, elem, divpos;
        divpos = jt.geoPos(jt.byId("primgroupdlgdiv"));
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit && fields[field].type === "textarea") {
                    elem = jt.byId(field + "in");
                    elem.style.width = String(divpos.w - 40) + "px"; } } }
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit) {
                    elem = jt.byId(field + "in");
                    if(elem) {
                        elem.focus();
                        break; } } } }
    },


    showDialog = function (heading, descrip, obj, fields, buttons) {
        var fieldtable, buttonsdiv, html;
        fieldtable = fieldTableHTML(obj, fields, descrip);
        buttonsdiv = buttonsHTML(buttons);
        html = ["div", {id: "primgroupdlgdiv"},
                [fieldtable,
                 ["div", {id: "errmsgdiv"}, ""],
                 buttonsdiv]];
        html = app.layout.dlgwrapHTML(heading, html);
        app.layout.openDialog({y:140}, html, null,
                              function () {
                                  adjustWidthsAndSetFocus(fields); });
    },


    founderNoticeAndDisplay = function () {
        var heading, descrip;
        if(jt.instId(wizgrp)) {
            return displayGroup(); }
        heading = "Create Group: Founder Privileges";
        descrip = ["p",
                   "As the founder of " + wizgrp.name + ", you are authorized to accept or remove other members. You may also make changes to any part of the group description."];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: false, 
                               printName: "Review Types"},
                    revfreq: {type: "frequency", edit: false,
                              printName: "Review Frequency"}},
                   [{name: "Back", fstr: "app.group.promptForReviewFreq()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "Create Group", fstr: "app.group.saveGroup()"}]);
    },


    promptForPrimaryFields = function () {
        if(!wizgrp.name) {
            app.group.promptForName(); return; }
        if(!wizgrp.city && !wizgrp.cityunspecified) {
            app.group.promptForCity(); return; }
        if(!app.group.verifyGroupCityAndProfileMatch(wizgrp,
                                                     app.group.createGroup)) {
            return; }  //let the dialog do its work
        if(!wizgrp.description) {
            app.group.promptForDescription(); return; }
        if(!wizgrp.revtypes) {
            app.group.promptForReviewTypes(); return; }
        if(!wizgrp.revfreq) {
            app.group.promptForReviewFreq(); return; }
        founderNoticeAndDisplay();
    },


    getPrimaryFieldDefs = function () {
        return [{name: "name", required: true},
                {name: "city", required: false},
                {name: "description", required: true},
                {name: "revtypes", required: true},
                {name: "revfreq", required: true}];
    },


    readPrimaryFields = function (contf) {
        var input, fields, i, cboxes, j, opts, k, namecheck = false;
        fields = getPrimaryFieldDefs();
        for(i = 0; i < fields.length; i += 1) {
            if(fields[i].name === "revtypes") {
                cboxes = document.getElementsByName("revtypesel");
                if(cboxes.length > 0) {
                    wizgrp.revtypes = "";
                    for(j = 0; j < cboxes.length; j += 1) {
                        if(cboxes[j].checked) {
                            if(wizgrp.revtypes) {
                                wizgrp.revtypes += ","; }
                            wizgrp.revtypes += app.review.getReviewTypeByValue(
                                cboxes[j].value).type; } }
                    if(!wizgrp.revtypes) {
                        jt.out('errmsgdiv', 
                               "At least one review type must be selected.");
                        return false; } } }
            else if(fields[i].name === "revfreq") {
                input = jt.byId("revfreqsel");
                if(input) {
                    opts = input.options;
                    for(j = 0; j < opts.length; j += 1) {
                        if(opts[j].selected) {
                            for(k = 0; k < revfreqs.length; k += 1) {
                                if(opts[j].id === revfreqs[k].id) {
                                    wizgrp.revfreq = revfreqs[k].freq;
                                    break; } } } } } }
            else {
                input = jt.byId(fields[i].name + "in");
                if(input) {
                    input = input.value;
                    if(fields[i].required && !input) {
                        jt.out('errmsgdiv', "A " + fields[i].name + 
                               " is required.");
                        return false; }
                    wizgrp[fields[i].name] = input; } }
            //extra check to see if name already taken
            if(fields[i].name === "name" && wizgrp.name && 
                   (!wizgrp.name_c || 
                    jt.canonize(wizgrp.name) !== wizgrp.name_c)) {
                namecheck = true;
                break; } }
        if(namecheck) {
            namecheck = jt.canonize(wizgrp.name);
            jt.call('GET', "grpbyname?groupname=" + namecheck, null,
                    function (groups) {
                        if(groups.length > 0) {
                            jt.out('errmsgdiv', "That name is already taken");
                            return false; }
                        wizgrp.name_c = jt.canonize(wizgrp.name);
                        contf(); },
                    app.failf(function (code, errtxt) {
                        jt.out('errmsgdiv', "Name check failed " + code +
                               ": " + errtxt); }),
                    jt.semaphore("group.namecheck"));
            return false; }  //don't continue until callback checks out
        return true;
    },


    primaryFieldValuesChanged = function () {
        var prev = app.lcs.getRef("group", jt.instId(wizgrp)).group,
            fields = getPrimaryFieldDefs(), i, fieldname;
        for(i = 0; i < fields.length; i += 1) {
            fieldname = fields[i].name;
            if(wizgrp[fieldname] !== prev[fieldname]) {
                return true; } }
        return false;
    },

    getMembershipActions = function () {
        var act = {stat: "", actions: []};
        switch(membership()) {
        case "Founder":
            act.stat = "You are a founding member.";
            act.actions.push({href: "resign", text: "resign"});
            break;
        case "Moderator":
            if(isApplying()) {
                act.stat = "You are applying to become a Founder.";
                act.actions.push({href: "withdraw", 
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are a senior member.";
                act.actions.push({href: "apply", text: "Become a Founder"});
                act.actions.push({href: "resign", text: "resign"}); }
            break;
        case "Member":
            if(isApplying()) {
                act.stat = "You are applying for senior membership.";
                act.actions.push({href: "withdraw",
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are a member.";
                act.actions.push({href: "apply", 
                                  text: "Become a Moderator"});
                act.actions.push({href: "resign", text: "resign"}); }
            break;
        default:
            if(isApplying()) {
                act.stat = "You are applying for membership.";
                act.actions.push({href: "withdraw",
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are not a member yet.";
                act.actions.push({href: "apply", 
                                  text: "Become a Member"}); } }
        return act;
    },


    actionsHTML = function (act) {
        var linkfs, html = [], i, fdef;
        linkfs = {apply: {href: "#apply", fs: "app.group.reqmem()"},
                  withdraw: {href: "#withdraw", fs: "app.group.withdraw()"},
                  resign: {href: "#resign", fs: "app.group.resignconf()"}};
        for(i = 0; i < act.actions.length; i += 1) {
            fdef = linkfs[act.actions[i].href];
            if(fdef.href === "#apply") {
                html.push(["button", {type: "button",
                                      onclick: jt.fs(fdef.fs)},
                           act.actions[i].text]); }
            else {
                html.push(["span", {cla: "grpmemlinkspan"},
                           ["a", {href: fdef.href,
                                  onclick: jt.fs(fdef.fs)},
                            act.actions[i].text]]); } }
        return html;
    },


    membershipManagementHTML = function () {
        var act, html;
        act = getMembershipActions();
        html = actionsHTML(act);
        html = ["div", {id: "personalmembershipdiv"},
                [["div", {id: "memstatactdiv"},
                  ["table",
                   ["tr",
                    [["td",
                      ["span", {id: "grpmemstatspan"},
                       act.stat]],
                     ["td", {id: "grpmemacttd"},
                      html]]]]],
                 ["div", {id: "memactconfdiv"}]]];
        return html;
    },


    groupsForCurrentReview = function (callback) {
        var pen, rev, revid, groups = [], grpids, i, ref;
        pen = app.pen.myPenName();
        if(pen.groups) {
            rev = app.review.getCurrentReview();
            revid = jt.instId(rev);
            grpids = pen.groups.split(",");
            for(i = 0; i < grpids.length; i += 1) {
                ref = app.lcs.getRef("group", grpids[i]);
                if(ref.status === "not cached") {
                    return app.lcs.getFull("group", grpids[i], callback); }
                if(ref.group && membership(ref.group) &&
                   jt.idInCSV(rev.revtype, ref.group.revtypes) &&
                   !jt.idInCSV(revid, ref.group.reviews)) {
                    groups.push(ref.group); } } }
        return groups;
    },


    updateReviewGroupReference = function (revid, groupid) {
        var crev = app.review.getCurrentReview();
        if(jt.instId(crev) !== revid) {
            jt.log("updateReviewGroupReferences called with wrong review");
            return; }
        if(revPostTimeout) {
            window.clearTimeout(revPostTimeout);
            revPostTimeout = null; }
        crev.svcdata = crev.svcdata || {};
        crev.svcdata.postedgroups = crev.svcdata.postedgroups || [];
        if(crev.svcdata.postedgroups.indexOf(groupid) < 0) {
            crev.svcdata.postedgroups.push(groupid); }
        //Might be posting to several groups, so wait a few seconds before
        //writing the review again to try collect all of them.
        revPostTimeout = window.setTimeout(function () {
            app.review.save(true); }, 3000);
    },


    postReview = function (revid, groupid) {
        var data;
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid + 
            "&groupid=" + groupid;
        jt.call('POST', "grprev?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(app.lcs.put("group", groups[0]).group);
                    updateReviewGroupReference(revid, groupid);
                    verifyStash(function () {
                        jt.log("postReview updated pen.stash"); }); },
                app.failf(function (code, errtxt) {
                    jt.log("postReview failed " + code + ": " + errtxt); }),
                jt.semaphore("group.post" + revid + "." + groupid));
    },


    findSeekType = function (group, seekerid) {
        var seektype;
        seektype = { title: "Member",
                     rights: [
                         "Post reviews", 
                         "Remove their own reviews"] };
        if(jt.idInCSV(seekerid, group.members)) {
            seektype = { 
                title: "Moderator",
                rights: [
                    "Post reviews", 
                    "Remove innapropriate reviews posted by others",
                    "Accept or Reject new membership applications",
                    "Remove regular members that are not working out"]}; }
        else if(jt.idInCSV(seekerid, group.moderators)) {
            seektype = {
                title: "Founder",
                rights: [
                    "Post reviews", 
                    "Remove innapropriate reviews posted by others",
                    "Accept or Reject any membership applications",
                    "Remove any members that are not working out",
                    "Modify the group description",
                    "Have permanent membership"]}; }
        return seektype;
    },


    seekNoticeHTML = function (group, seekerpen) {
        var role, seektype, seekerid, i, groupid = jt.instId(group);
        role = membership(group);
        if(role !== "Founder" && role !== "Moderator") {
            return ""; }  //can't authorize new members, so no notices
        seekerid = jt.instId(seekerpen);
        seektype = findSeekType(group, seekerid);
        if(role === "Moderator" && seektype.title !== "Member") {
            return ""; }  //only founder may accept at higher levels
        for(i = 0; i < seektype.rights.length; i += 1) {
            seektype.rights[i] = ["li", seektype.rights[i]]; }
        return jt.tac2html(
            ["div", {id: "seekdiv" + seekerid, cla: "grpmemseekdiv"},
             [["a", {title: "Show profile for " + jt.ndq(seekerpen.name),
                     href: "#" + jt.objdata({view: "profile", 
                                             profid: seekerid}),
                     onclick: jt.fs("app.pen.bypenid('" +
                                    seekerid + "')")},
               seekerpen.name],
              " is applying to become a " + seektype.title.toLowerCase() + 
              " of ",
              ["a", {title: "Show " + jt.ndq(group.name),
                     href: "#" + jt.objdata({view: "group",
                                             groupid: groupid}),
                     onclick: jt.fs("app.group.bygroupid('" +
                                    groupid + "')")},
               group.name],
              ["div", {cla: "grprightsdiv"},
               ["As a " + seektype.title.toLowerCase() + ", " + 
                seekerpen.name + " may",
                ["ul", {cla: "grprightslist"}, 
                 seektype.rights]]],
              ["div", {id: "confirmdenydiv" + seekerid, cla: "grprightsdiv"}],
              ["div", {id: "seekarbdiv" + seekerid, cla: "grpmsgbuttonsdiv"},
               [["button", {type: "button",
                            onclick: jt.fs("app.group.confirmdenyseek('" + 
                                           groupid + "','" + seekerid + "')")},
                 "Deny"],
                ["button", {type: "button",
                            onclick: jt.fs("app.group.acceptseek('" +
                                           groupid + "','" + seekerid + "')")},
                 "Accept"]]]]]);
    },


    seekRejectHTML = function (group) {
        var groupid = jt.instId(group),
            seektype = findSeekType(group, app.pen.myPenId()),
            reason = "Some groups may be reluctant to admit you as a new member if they don't have an idea of the sorts of reviews you might be posting. You might try writing some reviews matching the group criteria and then re-apply. You can always go back and post your reviews to the group later after you are accepted.";
        if(seektype.title === "Moderator") {
            reason = "Granting privileges to manage other members and remove reviews from other people requires careful consideration. The founding members are not ready to grant these powers to you yet, but feel free to re-apply in the future."; }
        if(seektype.title === "Founder") {
            reason = "Becoming a founding member of the group essentially gives you full control over it. Some founders may not be comfortable with that at first, but over time might appreciate the help. Feel free to re-apply in the future."; }
        return jt.tac2html(
            ["div", {id: "seekdiv" + groupid, cla: "grpmemseekdiv"},
             [["Your " + seektype.title.toLowerCase() + "ship application to ",
               ["a", {title: "Show " + jt.ndq(group.name),
                      href: "#" + jt.objdata({view: "group",
                                              groupid: groupid}),
                      onclick: jt.fs("app.group.bygroupid('" +
                                     groupid + "')")},
                group.name],
               " was rejected."],
              ["div", {cla: "grprightsdiv"},
               reason],
              ["div", {id: "seekarbdiv" + groupid, cla: "grpmsgbuttonsdiv"},
               ["button", {type: "button",
                           onclick: jt.fs("app.group.rejectok('" +
                                          groupid + "')")},
                "Ok"]]]]);
    },


    groupFieldNoticesHTML = function (fetch, pen, group) {
        var penids, i, penref;
        if(group[fetch.field]) {
            penids = group[fetch.field].split(",");
            for(i = 0; i < penids.length; i += 1) {
                penref = app.lcs.getRef("pen", penids[i]);
                if(penref.status === "not cached") {
                    fetch.cacheMiss = true;
                    fetch.type = "pen";
                    fetch.id = penids[i];
                    break; }
                if(penref.pen) {
                    if(fetch.field === "seeking") {
                        fetch.html.push(seekNoticeHTML(group, penref.pen)); }
                    else if(fetch.field === "rejects" &&
                            penids[i] === jt.instId(pen)) {
                        fetch.html.push(seekRejectHTML(group)); } } } }
    },


    statsHTML = function (pen) {
        var key, temp, rows = [];
        key = "grp" + jt.instId(wizgrp);
        if(pen.stash[key]) {
            if(pen.stash[key].posts && pen.stash[key].posts.length > 0) {
                temp = pen.stash[key].posts.split(",").length;
                temp = (temp > 20) ? "20+" : temp;
                rows.push(["tr",
                           [["td", {cla: "tdright"}, "Posts:"],
                            ["td", temp]]]); }
            if(pen.stash[key].lastpost) {
                temp = jt.colloquialDate(jt.ISOString2Day(
                    pen.stash[key].lastpost));
                rows.push(["tr",
                           [["td", {cla: "tdright"}, "Latest:"],
                            ["td", temp]]]); } }
        if(!rows.length) {
            return "No posts."; }
        return ["table", rows];
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    bygroupid: function (groupid, tabname) {
        app.pgd.fetchAndDisplay("group", groupid, tabname);
    },


    tabsel: function (tabname) {
        app.history.checkpoint({ view: "group", 
                                 groupid: currgrpid,
                                 tab: tabname });
        displayTab(tabname);
    },


    toggleExpansion: function (prefix, revid) {
        jt.err("This should have been factored away");
    },


    //check everything below here to see if it can be removed

    promptForCity: function () {
        var heading, descrip;
        heading = "Create Group: City";
        wizgrp.cityunspecified = false;  //reset if called via back button
        descrip = ["p",
                   "If " + wizgrp.name + " will be reviewing local food, drinks, activities or other things involving physical venues in your area, then you should specify a city. Providing a city makes the group more attractive for local folks, and allows other people an opportunity to set up sister groups in other cities. Multiple cities can be separated by commas. You can also specify a region or country if appropriate. Where is this group based?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: true,
                           onchange: "app.group.createGroup()"}},
                   [{name: "Back", fstr: "app.group.promptForName()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.noteCity()"}]);
    },


    noteCity: function () {
        var city;
        city = jt.byId('cityin');
        if(city) {
            city = city.value;
            if(!city) {
                wizgrp.cityunspecified = true; } }
        app.group.createGroup();
    },


    promptForName: function () {
        var heading, descrip;
        heading = "Create Group: Name";
        descrip = ["p",
                   "Please choose a name for your group:"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: true, valclass: "grpnameval",
                           onchange: "app.group.createGroup()"}},
                   [{name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },
                   

    //This method is used by group setup and new membership
    verifyGroupCityAndProfileMatch: function (group, callback) {
        var city, penc, i, j, backb, html;
        verifyCityNextFunc = callback;
        city = group.city;
        if(!city) {
            return true; }  //nothing to check against
        if(city.indexOf(",") >= 0) {
            city = city.split(","); }
        else {
            city = [ city ]; }
        penc = app.pen.myPenName().city;
        if(penc) {
            if(penc.indexOf(",") >= 0) {
                penc = penc.split(","); }
            else {
                penc = [ penc ]; } }
        penc = penc || [];
        for(i = 0; i < city.length; i += 1) {
            for(j = 0; j < penc.length; j += 1) {
                if(jt.canonize(city[i]) === jt.canonize(penc[j])) {
                    return true; } } }  //have matching city
        backb = "";
        if(group === wizgrp) {
            backb = ["button", {type: "button", id: "backbutton",
                                onclick: jt.fs("app.group.promptForCity()")},
                     "Back"]; }
        html = ["div", {cla: "primgroupdlgdiv"},
                [["p",
                  "Your profile location does not match the group."],
                 ["table", {cla: "grpwiztable"},
                  ["tr",
                   [["td", "Add"],
                    ["td", cityValSelectHTML(city)],
                    ["td", "to your profile?"]]]],
                 ["div", {id: "errmsgdiv"}, ""],
                 ["div", {id: "primgroupbuttonsdiv"},
                  [backb,
                   ["button", {type: "button", id: "cancelbutton",
                               onclick: jt.fs("app.layout.closeDialog()")},
                    "Cancel"],
                   ["button", {type: "button", id: "okbutton",
                               onclick: jt.fs("app.group.setPenCity()")},
                    "OK"]]]]];
        html = app.layout.dlgwrapHTML(group.name + " City", html, null,
                                      function () {
                                          jt.byId('okbutton').focus(); });
        app.layout.openDialog({y:140}, html);
    },


    profCityCB: function (cityval) {
        jt.byId('hcityin').value = cityval;
    },


    setPenCity: function () {
        var pen, city;
        city = jt.byId('hcityin').value;
        pen = app.pen.myPenName();
        pen.city = pen.city || "";
        if(pen.city) {
            pen.city += ", "; }
        pen.city += city;
        app.pen.updatePen(pen, verifyCityNextFunc, app.failf);
    },


    promptForDescription: function () {
        var heading, descrip;
        heading = "Create Group: Description";
        descrip = ["p",
                   "What is this group all about? What kind of people are members? What sorts of reviews do members post?"];
        showDialog(heading, descrip, wizgrp, 
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: true}},
                   [{name: "Back", fstr: "app.group.promptForCity()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },
                   

    promptForReviewTypes: function () {
        var heading, descrip;
        heading = "Create Group: Review Types";
        descrip = ["p",
                   "What types of reviews will be accepted for sharing within this group?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: true, 
                               printName: "Review Types"}},
                   [{name: "Back", fstr: "app.group.promptForDescription()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },


    promptForReviewFreq: function () {
        var heading, descrip;
        heading = "Create Group: Review Frequency";
        descrip = ["p",
                   "You don't have to be a member to follow a group, but members are expected to contribute reviews.  How often should members of " + wizgrp.name + " post to remain in good standing?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: false, 
                               printName: "Review Types"},
                    revfreq: {type: "frequency", edit: true,
                              printName: "Review Frequency"}},
                   [{name: "Back", fstr: "app.group.promptForReviewTypes()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },


    editGroup: function (group) {
        copyGroup(group);
        promptForPrimaryFields();
    },


    createGroup: function () {
        if(!wizgrp) {
            wizgrp = { name: "", city: "", description: "", picture: "", 
                       revtypes: "", revfreq: "",
                       founders: "", moderators: "", members: "" }; }
        if(readPrimaryFields(app.group.createGroup)) {
            promptForPrimaryFields(); }
    },


    saveGroup: function (autostep) {
        var data, divid, buttonhtml;
        if(!jt.instId(wizgrp)) {
            divid = "primgroupbuttonsdiv";
            buttonhtml = jt.byId(divid).innerHTML;
            jt.out(divid, "Creating " + wizgrp.name + "..."); }
        else {
            divid = 'groupeditbuttonsdiv';
            buttonhtml = jt.byId(divid).innerHTML;
            jt.out(divid, "Saving..."); }
        //relying on server side validation for detailed checking
        app.onescapefunc = null;
        data = jt.objdata(wizgrp, ["revids"]) + 
            "&penid=" + app.pen.myPenId();
        jt.call('POST', "grpdesc?" + app.login.authparams(), data,
                function (groups) {
                    app.lcs.put("group", groups[0]);
                    copyGroup(groups[0]);
                    if(autostep === "uploadpic") {
                        window.setTimeout(app.group.picUploadForm, 200); }
                    displayGroup(); },
                app.failf(function (code, errtxt) {
                    jt.out(divid, buttonhtml);
                    jt.out('errmsgdiv', "Save failed code: " + code + 
                           " " + errtxt); }),
                jt.semaphore("group.save"));
    },


    updateGroup: function (group, callok, callfail) {
        var data = jt.objdata(group, ["recent", "top20s", "revids"]) +
            "&penid=" + app.pen.myPenId();
        jt.call('POST', "grpdesc?" + app.login.authparams(), data,
                function (updgroups) {
                    updgroups[0].recent = group.recent;
                    app.lcs.put("group", updgroups[0]);
                    callok(updgroups[0]); },
                app.failf(function (code, errtxt) {
                    callfail(code, errtxt); }),
                jt.semaphore("group.updateGroup"));
    },


    display: function () {
        displayGroup();
    },


    settings: function () {
        var html = [];
        jt.out('grouphbuttondiv', followsetHTML());  //if just followed..
        if(membership() === "Founder") {
            html.push(["div", {id: "chgrpdescrdiv", cla: "grpactiondiv"},
                       ["a", {href: "#changedescription",
                              onclick: jt.fs("app.group.changedescr()")},
                        "Change Group Description"]]); }
        if(!membership() && !isApplying() && isFollowing()) {
            html.push(["div", {id: "stopfollowingdiv", cla: "grpactiondiv"},
                       ["You are following. ",
                        ["a", {href: "#stopfollowing",
                               onclick: jt.fs("app.group.stopfollow()")},
                         "Stop Following"]]]); }
        if(isApplying()) {
            html.push(["div", {id: "memprocdiv", cla: "groupdescrtxt"},
                       "Membership processing depends on other people who may not log in every day. Your patience is appreciated."]); }
        html.push(membershipManagementHTML());
        html = ["div", {id: "groupsetdlgdiv"},
                html];
        html = app.layout.dlgwrapHTML(jt.tac2html(
            ["Settings: ",
             ["span", {cla: "penfont"},
              wizgrp.name]]), html);
        app.layout.openDialog({y:140}, html);
    },


    follow: function () {
        var pen = app.pen.myPenName();
        pen.groups = pen.groups || "";
        if(pen.groups) {
            pen.groups += ","; }
        pen.groups += jt.instId(wizgrp);
        app.pen.updatePen(pen, app.group.settings, app.failf);
    },


    stopfollow: function () {
        var pen, groupid, ids, i;
        app.layout.closeDialog();
        pen = app.pen.myPenName();
        pen.groups = pen.groups || "";
        if(pen.groups) {
            groupid = jt.instId(wizgrp);
            ids = pen.groups.split(",");
            pen.groups = "";
            for(i = 0; i < ids.length; i += 1) {
                if(ids[i] !== groupid) {
                    if(pen.groups) {
                        pen.groups += ","; }
                    pen.groups += ids[i]; } }
            app.pen.updatePen(pen, app.group.display, app.failf); }
    },


    changedescr: function () {
        var divpos, rswidth, lswidth;
        divpos = jt.geoPos(jt.byId("grouphdiv"));
        rswidth = String(Math.round((divpos.w - 20) / 2)) + "px";
        lswidth = String(jt.geoPos(jt.byId("gpicdiv")).w - 4) + "px";
        app.layout.closeDialog();
        jt.out('gcitydiv', jt.tac2html(
            ["input", {type: "text", id: "cityin",
                       style: "width:" + lswidth,
                       placeholder: "City or region",
                       value: wizgrp.city}]));
        jt.out('groupnamediv', jt.tac2html(
            ["input", {type: "text", id: "namein", 
                       style: "margin:2px;width:" + rswidth,
                       value: wizgrp.name}]));
        jt.out('groupdescdiv', jt.tac2html(
            ["textarea", {id: "descriptionin", cla: "groupdescrtxt",
                          style: "height:100px;"},
             wizgrp.description || ""]));
        jt.byId('descriptionin').style.width = rswidth;
        jt.out('grouprevtypesdiv', jt.tac2html(
            ["table", {cla: "grpwiztable groupdescrtxt"},
             fieldTableRow(wizgrp, "revtypes", 
                           {type: "revtypesel", edit: true, 
                            printName: "Review Types"})]));
        jt.out('groupfreqdispdiv', "");
        jt.out('memberspoststogglediv', "");
        jt.out('groupfreqeditdiv', jt.tac2html(
            ["table", {cla: "grpwiztable groupdescrtxt"},
             fieldTableRow(wizgrp, "revfreq",
                           {type: "frequency", edit: true,
                            printName: "Review Frequency"})]));
        jt.out('groupeditbuttonsdiv', jt.tac2html(
            [["button", {type: "button", id: "cancelbutton",
                         onclick: jt.fs("app.group.display()")},
              "Cancel"],
             ["button", {type: "button", id: "okbutton",
                         onclick: jt.fs("app.group.readandsave()")},
              "Save"]]));
    },


    readandsave: function () {
        if(readPrimaryFields(app.group.readandsave)) {
            app.group.saveGroup(); }
    },


    reqmem: function () {
        var memlev, msg, data;
        memlev = membership();
        if(!jt.byId("memactconfdiv").innerHTML &&  //no conf displayed yet
           (memlev === "Member" || memlev === "Moderator")) {
            msg = "As a Moderator, you are offering to help maintain the group by accepting new members, removing innapropriate reviews, and kicking out spammers. This is a position of trust and responsibility.";
            if(memlev === "Moderator") {
                msg = "As a Founder, you will become a permanent co-owner of the group, with full privileges and responsibilities for its continued operation. Some founders are comfortable with co-ownership, others are not."; }
            msg += " Are you sure you want to apply?";
            jt.out('memstatactdiv', "");
            jt.out('memactconfdiv', jt.tac2html(
                ["div", {cla: "grpconfmessage"},
                 [msg,
                  ["div", {id: "grpmemacttd", cla: "dlgbuttonsdiv"},
                   [["button", {type: "button",
                                onclick: jt.fs("app.group.settings()")},
                     "Cancel"],
                    ["button", {type: "button",
                                onclick: jt.fs("app.group.reqmem()")},
                     "Apply"]]]]])); }
        else { //confirmation already displayed if needed. update and redisplay
            jt.out('grpmemacttd', "Applying...");
            data = "penid=" + app.pen.myPenId() + 
                "&groupid=" + jt.instId(wizgrp);
            jt.call('POST', "grpmemapply?" + app.login.authparams(), data,
                    function (groups) {
                        copyGroup(app.lcs.put("group", groups[0]).group);
                        app.group.settings(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Membership application failed code: " + code + 
                               " " + errtxt);
                        app.group.settings(); }),
                    jt.semaphore("group.memapply")); }
    },


    withdraw: function () {
        var data;
        jt.out('grpmemacttd', "Withdrawing...");
        data = "penid=" + app.pen.myPenId() + 
            "&groupid=" + jt.instId(wizgrp);
        jt.call('POST', "grpmemwithdraw?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(app.lcs.put("group", groups[0]).group);
                    app.group.settings(); },
                app.failf(function (code, errtxt) {
                    jt.err("Membership withdrawal failed code: " + code + 
                           " " + errtxt);
                    app.group.settings(); }),
                jt.semaphore("group.memwithdraw"));
    },


    resignconf: function () {
        var msg, bname = "Resign", penid, data;
        msg = "Are you sure? Resigning your membership cannot be undone. You will have to re-apply to join the group if you want to post to it again in the future.";
        if(!jt.byId("memactconfdiv").innerHTML) {  //no conf displayed yet
            if(membership() === "Founder" && wizgrp.founders.indexOf(",") < 0) {
                msg = "Are you absolutely sure? As the only founder, this group will cease to exist when you leave. This operation cannot be undone.";
                if(wizgrp.moderators || wizgrp.members) {
                    msg += " If you announce in the group description your intention to dismantle the group, then you could provide an opportunity for others to apply as founders and continue the group."; }
                bname = "Resign and Delete Group"; }
            jt.out('memstatactdiv', "");
            jt.out('memactconfdiv', jt.tac2html(
                ["div", {cla: "grpconfmessage"},
                 [msg,
                  ["div", {id: "resignconfbdiv", cla: "dlgbuttonsdiv"},
                   [["button", {type: "button",
                                onclick: jt.fs("app.group.settings()")},
                     "Cancel"],
                    ["button", {type: "button",
                                onclick: jt.fs("app.group.resignconf()")},
                     bname]]]]])); }
        else { //confirmation already displayed, update and return to profile
            jt.out('resignconfbdiv', "Resigning...");
            penid = app.pen.myPenId();
            data = "penid=" + penid + "&groupid=" + jt.instId(wizgrp) + 
                "&removeid=" + penid;
            jt.call('POST', "grpmemremove?" + app.login.authparams(), data,
                    function (groups) {
                        app.layout.closeDialog();
                        if(groups && groups.length) {
                            copyGroup(app.lcs.put("group", groups[0]).group);
                            app.group.settings(); }
                        else {
                            app.lcs.rem("group", wizgrp);
                            app.pgd.display(); } },
                    app.failf(function (code, errtxt) {
                        jt.err("Resignation failed code: " + code + 
                               " " + errtxt);
                        app.group.settings(); }),
                    jt.semaphore("group.resign")); }
    },


    //Pic upload happens after the initial save from the wizard, so
    //the group always has an id for the server instance to hold the
    //pic data.  Since the pic upload is a full form submit requiring
    //the app to reconstruct its state from scratch on return, any
    //changed field values also need to be saved.
    picUploadForm: function () {
        var groupid;
        readPrimaryFields(app.group.picUploadForm);
        if(primaryFieldValuesChanged()) {
            if(jt.byId('groupeditbuttonsdiv').   //not already saving
                   innerHTML.indexOf("<button") >= 0) {
                return app.group.saveGroup("uploadpic"); }
            return; }  //already saving, upload pic when done
        groupid = jt.instId(wizgrp);
        app.layout.picUpload({ 
            endpoint: "/grppicupload",
            type: "Group",
            id: groupid,
            penid: app.pen.myPenId(),
            //not returning in edit mode since cancel not an option
            rethash: "#view=group&groupid=" + groupid,
            left: "70px", top: "140px"});
    },


    crevpost: function () {
        var html;
        html = ["div", {id: "primgroupdlgdiv"},
                ["No matching groups found for post.",
                 buttonsHTML(
                     [{name: "Ok", fstr: "app.layout.closeDialog()"}])]];
        html = app.layout.dlgwrapHTML("Post To Groups", html);
        app.layout.openDialog({y:140}, html, null,
                              function () {
                                  var elem = jt.byId('ok');
                                  elem.focus(); });
        app.group.currentReviewPostDialog();
    },


    currentReviewPostDialog: function () {
        var groups, i, groupid, trs = [], html;
        groups = groupsForCurrentReview(app.group.currentReviewPostDialog);
        if(!groups || !groups.length) {
            return; }
        for(i = 0; i < groups.length; i += 1) {
            groupid = jt.instId(groups[i]);
            trs.push(["tr",
                      [["td", {style: "vertical-align:middle;"},
                        ["div",
                         ["input", {type: "checkbox", name: "grp" + groupid,
                                    id: "grp" + groupid,
                                    value: "grp" + groupid}]]],
                       ["td", {cla: "tdwide"},
                        ["span", {id: "penhnamespan"},
                         ["label", {fo: "grp" + groupid}, 
                          groups[i].name]]]]]);
            trs.push(["tr",
                      [["td"],
                       ["td", 
                        ["div", {cla: "groupdescrtext"},
                         (groups[i].city ? "(" + groups[i].city + ") " : "") +
                         jt.ellipsis(groups[i].description, 120)]]]]); }
        html = ["div", {id: "primgroupdlgdiv"},
                [["table", {cla: "grpwiztable"}, 
                  trs],
                 buttonsHTML(
                     [{name: "Cancel", fstr: "app.layout.closeDialog()"},
                      {name: "Post", fstr: "app.group.postToGroups()"}])]];
        html = app.layout.dlgwrapHTML("Post To Groups?", html);
        app.layout.openDialog({y:140}, html, null,
                              function () {
                                  var elem = jt.byId('post');
                                  elem.focus(); });
    },
            

    postToGroups: function () {
        var groups, revid, i, groupid, cbox;
        jt.out('primgroupbuttonsdiv', "Processing...");
        groups = groupsForCurrentReview(app.group.postToGroups);
        if(!groups || !groups.length) {
            return; }
        revid = jt.instId(app.review.getCurrentReview());
        for(i = 0; i < groups.length; i += 1) {
            groupid = jt.instId(groups[i]);
            cbox = jt.byId("grp" + groupid);
            if(cbox && cbox.checked) {
                postReview(revid, groupid); } }
        app.layout.closeDialog();
    },


    remrev: function (revid) {
        var revref, penref, html;
        revref = app.lcs.getRef("rev", revid);
        if(!revref.rev) {
            //review should be cached since it was just displayed..
            jt.err("Could not find review " + revid + ".");
            return; }
        if(revref.rev.penid === jt.instId(app.pen.myPenName())) {
            html = ["div", {id: "reasondiv"},
                    ["div", {cla: "dlgprompt"},
                     "Are you sure you want to remove your review" + 
                     " from this group?"]]; }
        else {
            penref = app.lcs.getRef("pen", revref.rev.penid);
            html = ["div", {id: "reasondiv"},
                    [["div", {id: "reasonpromptdiv", cla: "dlgprompt"},
                      "Please tell " + penref.pen.name + 
                      " why their review is being removed:"],
                     ["input", {type: "text", id: "reasonin",
                                style: "width:90%;",
                                placeholder: "Reason for rejection"}]]]; }
        html = ["div", {id: "primgroupdlgdiv"},
                [html,
                 buttonsHTML(
                     [{name: "Cancel", fstr: "app.layout.closeDialog()"},
                      {name: "Remove", 
                       fstr: "app.group.removeReviewFromGroup('" + 
                           revid + "')"}])]];
        html = app.layout.dlgwrapHTML("Remove Review?", html);
        app.layout.openDialog({y:140}, html, null,
                              function () {
                                  var elem = jt.byId('reasonin');
                                  if(elem) {
                                      elem.focus(); }
                                  else {
                                      elem = jt.byId('remove');
                                      elem.focus(); } });
    },


    removeReviewFromGroup: function (revid) {
        var reason, data, groupid;
        reason = jt.byId('reasonin') || "";
        if(reason) {
            reason = reason.value;
            if(!reason) {
                jt.out('reasonpromptdiv', jt.tac2html(
                    [["span", {style: "color:red;"},
                      "*"],
                     jt.byId('reasonpromptdiv').innerHTML]));
                return; } }
        app.layout.closeDialog();
        groupid = jt.instId(wizgrp);
        reason = "Review rejected from " + wizgrp.name + ": " + reason;
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid + 
            "&groupid=" + groupid + "&reason=" + jt.enc(reason);
        jt.call('POST', "grpremrev?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(app.lcs.put("group", groups[0]).group);
                    removeReviewFromStash(revid, displayGroupBody); },
                app.failf(function (code, errtxt) {
                    jt.err("Remove review failed " + code + ": " + errtxt); }),
                jt.semaphore("group.remove" + revid + "." + groupid));
    },


    groupNoticesHTML: function (divid) {
        var pen, grpids, i, groupref, fetch = {cacheMiss: false, html: []};
        pen = app.pen.myPenName();
        if(pen.groups) {
            grpids = pen.groups.split(",");
            for(i = 0; !fetch.cacheMiss && i < grpids.length; i += 1) {
                groupref = app.lcs.getRef("group", grpids[i]);
                if(groupref.status === "not cached") {
                    fetch = { cacheMiss: true, type: "group", id: grpids[i] };
                    break; }
                if(groupref.group) {
                    if(!fetch.cacheMiss) {
                        fetch.field = "rejects";
                        groupFieldNoticesHTML(fetch, pen, groupref.group); }
                    if(!fetch.cacheMiss) {
                        fetch.field = "seeking";
                        groupFieldNoticesHTML(fetch, pen, groupref.group); } } }
            if(fetch.cacheMiss) {
                window.setTimeout(function () {
                    app.lcs.getFull(fetch.type, fetch.id,
                                    function () {
                                        app.group.groupNoticesHTML(divid); });
                }, 200); } }
        return jt.tac2html(fetch.html);
    },


    confirmdenyseek: function (groupid, seekerid) {
        var group, pen, seektype, reason, data;
        group = app.lcs.getRef("group", groupid).group;
        pen = app.lcs.getRef("pen", seekerid).pen;
        seektype = findSeekType(group, seekerid);
        reason = "Are you sure you want to deny basic membership to " + pen.name + "? If " + pen.name + " hasn't posted any helpful reviews, then you are probably right to deny their application. But if they have some decent reviews, you might want to give them a chance. Remember that you are authorized to remove any reviews they post, and you can terminate their membership if they don't work out.";
        if(seektype.title === "Moderator") {
            reason = "Are you sure you want to deny senior membership to " + pen.name + "? If you don't know who this is, or you don't trust them to help manage members and moderate reviews, then you should deny their application. However, if you trust this person, they might be able to help process new membership applications and filter out innapropriate reviews."; }
        if(seektype.title === "Founding Member") {
            reason = "Are you sure you want to deny founding membership to " + pen.name + "? A founding member effectively co-owns the group and cannot be removed. They have the same rights as you. If you have any doubts at all you should eny this application. However if dividing ownership responsibilities would help, and you fully trust " + pen.name + ", then you might consider this."; }
        if(!jt.byId("confirmdenydiv" + seekerid).innerHTML) {
            jt.out("confirmdenydiv" + seekerid, jt.tac2html(
                [reason,
                 ["div", {cla: "reasoninputdiv"},
                  ["input", {type: "text", id: "reasonin",
                             style: "width:90%;",
                             placeholder: "Reason for rejection"}]]]));
            jt.byId('reasonin').focus(); }
        else {
            jt.out("seekarbdiv" + seekerid, "Denying application...");
            data = "penid=" + app.pen.myPenId() +
                "&groupid=" + groupid + "&seekerid=" + seekerid +
                "&reason=" + jt.enc(jt.byId('reasonin').value.trim());
            jt.call('POST', "grpmemrej?" + app.login.authparams(), data,
                    function (groups) {
                        copyGroup(app.lcs.put("group", groups[0]).group);
                        jt.out("seekdiv" + seekerid, ""); },
                    app.failf(function (code, errtxt) {
                        jt.err("Deny application failed " + code + 
                               ": " + errtxt); }),
                    jt.semaphore("group.deny" + seekerid + "." + groupid)); }
    },


    acceptseek: function (groupid, seekerid) {
        var data;
        jt.out("seekarbdiv" + seekerid, "Accepting application...");
        data = "penid=" + app.pen.myPenId() +
            "&groupid=" + groupid + "&seekerid=" + seekerid;
        jt.call('POST', "grpmemyes?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(app.lcs.put("group", groups[0]).group);
                    jt.out("seekdiv" + seekerid, ""); },
                app.failf(function (code, errtxt) {
                    jt.err("Application acceptance failed " + code + 
                               ": " + errtxt); }),
                jt.semaphore("group.accept" + seekerid + "." + groupid));
    },


    rejectok: function (groupid) {
        var data;
        jt.out("seekarbdiv" + groupid, "");
        data = "penid=" + app.pen.myPenId() +
            "&groupid=" + groupid;
        jt.call('POST', "grprejok?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(app.lcs.put("group", groups[0]).group);
                    jt.out("seekdiv" + groupid, ""); },
                app.failf(function (code, errtxt) {
                    jt.err("Ackknowledgement failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("group.rejok" + groupid));
    },


    dispmode: function (mode) {
        wizgrp.dispmode = mode;
        displayGroup();
    },


    memedit: function (edit, penid) {
        var pen, data, buttons;
        pen = app.lcs.getRef("pen", penid).pen;
        buttons = "";
        if(edit) {
            buttons = ["button", {type: "button",
                                  onclick: jt.fs("app.group.memedit(true,'" + 
                                                 penid + "')")},
                       "Remove"]; }
        //show form
        if(!jt.byId("rmcdiv" + penid)) {
            jt.out("memspan" + penid, jt.tac2html(
                ["div", {cla: "membereditdiv"},
                 [["div", {cla: "dlgclosex"},
                   ["a", {href: "#close",
                          onclick: jt.fs("app.group.memeditcancel(" + edit +
                                         ",'" + penid + "')")},
                    "X"]],
                  ["div", {cla: "floatclear"}],
                  ["div", {cla: "grpmembernamediv"},
                   ["a", {title: "Show profile for " + jt.ndq(pen.name),
                          href: "#" + jt.objdata({view: "profile", 
                                                  profid: penid}),
                          onclick: jt.fs("app.pen.bypenid('" + 
                                         penid + "')")},
                    pen.name]],
                  ["div", {cla: "memberstatsdiv"}, statsHTML(pen)],
                  ["div", {id: "rmcdiv" + penid}],
                  ["div", {id: "rmbdiv" + penid, cla: "optionalbuttonsdiv"},
                   buttons]]])); }
        //show confirmation if remove button clicked
        else if(!jt.byId("rmcdiv" + penid).innerHTML) {
            jt.out("rmcdiv" + penid, jt.tac2html(
                ["Are you sure? Kicking someone out of the group is not something to be done lightly. " + pen.name + " will probably not appreciate it, and they will have to re-apply for membership before posting in the future. On the other hand if this person is damaging the reputation of the group directly or indirectly, then for the good of the group they should be removed.",
                 ["div", {id: "reasonrequireddiv", cla: "errmsgdiv"}],
                 ["div", {cla: "reasoninputdiv"},
                  ["input", {type: "text", id: "reasonin",
                             style: "width:90%;",
                             placeholder: "Reason for removal"}]]]));
            jt.byId('reasonin').focus(); }
        //make sure a reason is specified
        else if(!jt.byId('reasonin').value.trim()) {
            jt.out('reasonrequireddiv', "Please provide a reason");
            jt.byId('reasonin').focus(); }
        //remove the member
        else {
            jt.out("rmbdiv" + penid, "Removing...");
            data = "penid=" + app.pen.myPenId() + 
                "&groupid=" + jt.instId(wizgrp) + "&removeid=" + penid +
                "&reason=" + jt.enc(jt.byId('reasonin').value.trim());
            jt.call('POST', "grpmemremove?" + app.login.authparams(), data,
                    function (groups) {
                        copyGroup(app.lcs.put("group", groups[0]).group);
                        app.group.display(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Member removal failed code: " + code +
                               " " + errtxt);
                        //most likely removed already, rebuild the display
                        app.group.display(); }),
                    jt.semaphore("group.remove")); }
    },


    memeditcancel: function (edit, penid) {
        jt.out("memspan" + penid, memberNameHTML(edit, penid));
    },


    processMembership: function (group, action, seekerid, reason, contf) {
        var data;
        data = jt.objdata({action: action, penid: app.pen.myPenId(), 
                           groupid: jt.instId(group), seekerid: seekerid,
                           reason: reason});
        jt.call('POST', "grpmemprocess?" + app.login.authparams(), data,
                function (updgroups) {
                    updgroups[0].recent = group.recent;
                    app.lcs.put("group", updgroups[0]);
                    contf(updgroups[0]); },
                function (code, errtxt) {
                    jt.err("Membership processing failed code: " + code +
                           ": " + errtxt);
                    contf(); },
                jt.semaphore("group.processMembership"));
    },


    membershipLevel: function (group, penid) {
        if(!group) {
            return 0; }
        group.members = group.members || "";
        group.moderators = group.moderators || "";
        group.founders = group.founders || "";
        penid = penid || app.pen.myPenId();
        if(group.members.csvcontains(penid)) {
            return 1; }
        if(group.moderators.csvcontains(penid)) {
            return 2; }
        if(group.founders.csvcontains(penid)) {
            return 3; }
        return 0;
    },


    isSeeking: function (group, penid) {
        if(!group) {
            return 0; }
        penid = penid || app.pen.myPenId();
        if(group.seeking && group.seeking.csvcontains(penid)) {
            return true; }
        return false;
    },


    verifyPenStash: function (group) {
        var penid, pen, key, pso, i, revref, revid, memlev, modified = false;
        penid = app.pen.myPenId();
        pen = app.pen.myPenName();
        if(!pen) {
            return; }
        key = "grp" + jt.instId(group);
        if(!pen.stash) {
            pen.stash = {};
            modified = true; }
        if(!pen.stash[key]) {
            pen.stash[key] = { posts: "", lastpost: "" };
            modified = true; }
        pso = pen.stash[key];
        if(!pso.posts && pso.lastpost) {
            pso.lastpost = "";
            modified = true; }
        if(!pso.name || pso.name !== group.name) {
            pso.name = group.name;
            modified = true; }
        memlev = app.group.membershipLevel(group, penid);
        if(!pso.memlev || pso.memlev !== memlev) {
            pso.memlev = memlev;
            modified = true; }
        for(i = 0; group.recent && i < group.recent.length; i += 1) {
            revref = app.lcs.getRef("rev", group.recent[i]);
            if(revref.rev && revref.rev.penid === penid) {
                if(!pso.lastpost || revref.rev.modified > pso.lastpost) {
                    pso.lastpost = revref.rev.modified;
                    modified = true; }
                revid = jt.instId(revref.rev);
                if(!pso.posts.csvcontains(revid)) {
                    pso.posts = pso.posts.csvappend(revid);
                    modified = true; } } }
        if(modified) {
            app.pen.updatePen(
                pen,
                function (pen) {
                    jt.log("Pen stash updated for " + group.name); },
                function (code, errtxt) {
                    jt.log("group.verifyStash " + code + ": " + errtxt); }); }
    },


    mayRemove: function (grp, rev) {
        var penid;
        if(!rev || !grp) {
            return false; }
        penid = app.pen.myPenId();
        if(rev.penid === penid || app.group.membershipLevel(grp, penid) > 1) {
            return true; }
        return false;
    },


    remove: function (grpid, revid) {
        var removebutton, html, pos, rev, grp, reason, data;
        removebutton = jt.byId('rdremb');
        if(removebutton) {
            removebutton.disabled = true;
            jt.out('rdremstatdiv', ""); }
        else {
            html = ["div", {id: "revdlgdiv"},
                    [["div", {id: "rdremstatdiv"}],
                     ["label", {fo: "reasonin", cla: "liflab"}, "Reason"],
                     ["input", {id: "reasonin", cla: "lifin", type: "text"}],
                     ["div", {id: "rdrembdiv", cla: "dlgbuttonsdiv"},
                      ["button", {type: "button", id: "rdremb",
                                  onclick: jt.fs("app.group.remove('" + 
                                                 grpid + "','" + revid + "')")},
                       "Remove"]]]];
            html = app.layout.dlgwrapHTML("Remove Group Post", html);
            pos = jt.geoPos(jt.byId("rbd" + revid));
            return app.layout.openDialog(
                {x: pos.x - 40 , y: pos.y - 30},
                jt.tac2html(html), null, function() {
                    jt.byId('reasonin').focus(); }); }
        rev = app.lcs.getRef("rev", revid).rev;
        reason = jt.byId('reasonin').value.trim();
        if(!reason && rev.penid !== app.pen.myPenId()) {
            return jt.out('rdremstatdiv', "Reason required"); }
        jt.out('rdremstatdiv', "Removing...");
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid + 
            "&reason=" + jt.enc(reason);
        jt.call('POST', "delrev?" + app.login.authparams(), data,
                function (groups) {
                    grp = app.lcs.getRef("group", grpid).group;
                    if(grp.recent && grp.recent.indexOf(revid) >= 0) {
                        grp.recent.splice(grp.recent.indexOf(revid), 1); }
                    groups[0].recent = grp.recent;
                    //top20s updated by server, rebuilt for display as needed
                    app.lcs.put("group", groups[0]);
                    app.lcs.uncache("rev", revid);
                    app.layout.closeDialog();
                    app.pgd.display("group", grpid, "", groups[0]); },
                function (code, errtxt) {
                    removebutton.disabled = false;
                    jt.out('rdremstatdiv', "Removal failed code " + code +
                           ": " + errtxt); },
                jt.semaphore("group.remove"));
    },


    serializeFields: function (grp) {
        //top20s are maintained and rebuilt by the server, so
        //serializing is not strictly necessary, but it doesn't hurt.
        //ditto for adminlog and people
        if(typeof grp.top20s === 'object') {
            grp.top20s = JSON.stringify(grp.top20s); }
        if(typeof grp.adminlog === 'object') {
            grp.adminlog = JSON.stringify(grp.adminlog); }
        if(typeof grp.people === 'object') {
            grp.people = JSON.stringify(grp.people); }
    },


    deserializeFields: function (grp) {
        app.lcs.reconstituteJSONObjectField("top20s", grp);
        app.lcs.reconstituteJSONObjectField("adminlog", grp);
        app.lcs.reconstituteJSONObjectField("people", grp);
    }

}; //end of returned functions
}());

