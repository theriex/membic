/*global app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
// PenName or Group common display functions.
//

app.pgd = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var //see verifyFunctionConnections for procesing switches
        dst = { type: "", id: "", tab: "", obj: null,
                pen: { desclabel: "About Me",
                       descplace: "Links to other public pages you have, favorite sayings...",
                       descfield: "shoutout",
                       piclabel: "Profile Pic",
                       picfield: "profpic",
                       picsrc: "profpic?profileid=",
                       accsrc: "#view=pen&penid=" },
                group: { desclabel: "Description",
                         descplace: "What this group is about, what's appropriate to post...",
                         descfield: "description", 
                         piclabel: "Group Pic",
                         picfield: "picture",
                         picsrc: "grppic?groupid=",
                         accsrc: "#view=group&groupid=" } },
        knowntabs = { latest:    { href: "#latestmembics", 
                                   img: "img/tablatest.png" },
                      favorites: { href: "#favoritemembics",
                                   img: "img/helpfulq.png" }, 
                      search:    { href: "#searchmembics",
                                   img: "img/search.png" }, 
                      groups:    { href: "#groupsfollowing",
                                   img: "img/tabgrps.png" },
                      calendar:  { href: "#groupcalendar",
                                   img: "calico" } },
        searchstate = { revtype: "all", qstr: "", 
                        init: false, inprog: false, revids: [] },
        grpmsgs = [
            {name: "Following",
             levtxt: "Following a group shows you are interested.",
             uptxt: "Only members may post to the group.",
             upbtn: "Apply for membership",
             cantxt: "You are applying for membership.",
             canbtn: "Withdraw membership application",
             restxt: "",
             resbtn: "Stop following",
             resconf: ""},

            {name: "Member",
             levtxt: "As a member, you may post to the group.",
             uptxt: "If you would like to help make sure posts are relevant, and help approve new members, you can apply to become a Moderator.",
             upbtn: "Apply to become a Moderator",
             cantxt: "You are applying to become a Moderator.",
             canbtn: "Withdraw Moderator application",
             restxt: "If you no longer wish to contribute, you can resign your membership and go back to just following the group.",
             resbtn: "Resign membership",
             resconf: "Are you sure you want to resign your membership?"},

            {name: "Moderator",
             levtxt: "As a Moderator, you can post to the group, remove membics that don't belong, and approve membership applications.",
             uptxt: "If you think it would be appropriate for you to be recognized as a permanent co-owner of the group, you can apply to become a Founder.",
             upbtn: "Apply to become a Founder",
             cantxt: "You are applying to become a Founder.",
             canbtn: "Withdraw your Founder application",
             restxt: "If you no longer wish to help moderate the group, you can resign as a Moderator and go back to being a regular member.",
             resbtn: "Resign as Moderator",
             resconf: "Are you sure you want to resign as moderator?"},

            {name: "Founder",
             levtxt: "As a Founder, you permanently have all group privileges available.",
             uptxt: "",
             upbtn: "",
             cantxt: "",
             canbtn: "",
             restxt: "If you want to relinquish ownership of this group, you can resign as a Founder and allow others to continue the group.",
             resbtn: "Resign as Founder",
             rescnf: "Are you sure you want to resign as Founder?"}],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    picImgSrc = function (obj) {
        var defs = dst[dst.type], 
            src = "img/emptyprofpic.png";
        if(obj[defs.picfield]) {  //e.g. pen.profpic
            //fetch with mild cachebust in case modified
            src = defs.picsrc + jt.instId(obj) +
                "&modified=" + obj.modified; }
        return src;
    },


    modButtonsHTML = function (obj) {
        var mypenid, mypen, html = "";
        mypenid = app.pen.myPenId();
        mypen = app.pen.myPenName();
        if(dst.type === "pen" && jt.instId(obj) === mypenid) {
            html = ["a", {id: "pgdsettingslink", href: "#pensettings",
                          onclick: jt.fs("app.pgd.settings()")},
                    ["img", {cla: "reviewbadge",
                             src: "img/settings.png"}]]; }
        if(dst.type === "group" && mypen) {
            if(!mypen.groups || !mypen.groups.csvcontains(jt.instId(obj))) {
                html = ["span", {id: "followbuttonspan"},
                        ["button", {type: "button", id: "followbutton",
                                    onclick: jt.fs("app.group.follow()")},
                         "Follow"]]; }
            else {
                html = ["a", {id: "pgdsettingslink", href: "#groupsettings",
                              onclick: jt.fs("app.pgd.settings()")},
                        ["img", {cla: "reviewbadge",
                                 src: "img/settings.png"}]]; } }
        return jt.tac2html(html);
    },


    membershipSettingsHTML = function () {
        var html, mlev, seeking;
        if(dst.type === "pen") {
            return ""; }
        mlev = app.group.membershipLevel(dst.obj);
        seeking = app.group.isSeeking(dst.obj);
        html = [];
        if(grpmsgs[mlev].uptxt && !seeking) {
            html.push(["div", {cla: "formline"},
                       [["div", {cla: "grplevtxt"},
                         grpmsgs[mlev].uptxt],
                        ["div", {cla: "formbuttonsdiv"},
                         ["button", {type: "button", id: "uplevelbutton",
                                     onclick: jt.fs("app.group.apply()")},
                          grpmsgs[mlev].upbtn]]]]); }
        if(seeking) {
            html.push(["div", {cla: "formline"},
                       [["div", {cla: "grplevtxt"},
                         grpmsgs[mlev].cantxt],
                        ["div", {cla: "formbuttonsdiv"},
                         ["button", {type: "button", id: "withdrawbutton",
                                     onclick: jt.fs("app.group.withdraw()")},
                          grpmsgs[mlev].canbtn]]]]); }
        else { //not seeking, show downlevel button
            html.push(["div", {cla: "formline"},
                       [["div", {cla: "grplevtxt"},
                         grpmsgs[mlev].restxt],
                        ["div", {cla: "formbuttonsdiv"},
                         ["button", {type: "button", id: "downlevelbutton",
                                     onclick: jt.fs("app.pgd.grpdownlev()")},
                          grpmsgs[mlev].resbtn]]]]); }
        html = [["div", {cla: "formline"},
                 [["label", {fo: "statval", cla: "liflab"}, "Status"],
                  ["a", {href: "#togglegroupstat",
                         onclick: jt.fs("app.layout.togdisp('grpstatdetdiv')")},
                   ["span", {id: "memlevspan"}, grpmsgs[mlev].name]]]],
                ["div", {cla: "formline", id: "grpstatdetdiv",
                         style: "display:none;"},
                 [["div", {cla: "formline"},
                   grpmsgs[mlev].levtxt],
                  html]]];
        return html;
    },


    monitorPicUpload = function () {
        var tgif, txt, defs;
        tgif = jt.byId('tgif');
        if(tgif) {
            txt = tgif.contentDocument || tgif.contentWindow.document;
            if(txt) {
                txt = txt.body.innerHTML;
                if(txt.indexOf("Done: ") === 0) {
                    defs = dst[dst.type];
                    dst.obj[defs.picfield] = dst.id;
                    dst.obj.modified = txt.slice("Done: ".length);
                    app.pgd.display(dst.type, dst.id, dst.tab, dst.obj);
                    return; }
                if(txt.indexOf("Error: ") === 0) {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(monitorPicUpload, 800); }
    },
    picSettingsHTML = function () {
        var html;
        if(dst.type === "group" && app.group.membershipLevel(dst.obj) < 3) {
            return ""; }
        html = [["label", {fo: "picuploadform", cla: "overlab"},
                  "Change Picture"],
                ["form", {action: "/picupload", method: "post",
                          enctype: "multipart/form-data", target: "tgif",
                          id: "picuploadform"},
                 [jt.paramsToFormInputs(app.login.authparams()),
                  jt.paramsToFormInputs("picfor=" + dst.type + 
                                        "&_id=" + dst.id +
                                        "&penid=" + app.pen.myPenId()),
                  ["div", {cla: "tablediv"},
                   [["div", {cla: "fileindiv"},
                     [["input", {type: "file", 
                                 name: "picfilein", id: "picfilein"}],
                      ["div", {id: "uploadbuttonsdiv"},
                       ["input", {type: "submit", cla: "formbutton",
                                  value: "Upload&nbsp;Picture"}]]]],
                    ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                ["iframe", {id: "tgif", name: "tgif", src: "/picupload",
                            style: "display:none"}]];
        return html;
    },
    picSettingsInit = function () {
        monitorPicUpload();
    },


    descripSettingsHTML = function () {
        var nh = "", defs, html;
        if(dst.type === "group") {
            if(app.group.membershipLevel(dst.obj) < 3) {
                return ""; }
            nh = ["div", {cla: "formline"},
                  [["label", {fo: "namein", cla: "liflab", id: "namelab"},
                    "Name"],
                   ["input", {id: "namein", cla: "lifin", type: "text",
                              value: dst.obj.name}]]]; }
        defs = dst[dst.type];
        html = [nh,
                ["div", {cla: "formline"},
                 ["label", {fo: "shouteditbox", cla: "overlab"}, 
                  defs.desclabel]],
                ["textarea", {id: "shouteditbox", cla: "dlgta"}],
                ["div", {id: "formstatdiv"}],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.pgd.saveDescription()")},
                  "Update Description"]]];
        return html;
    },
    descripSettingsInit = function () {
        var defs, namein, shout;
        defs = dst[dst.type];
        shout = jt.byId('shouteditbox');
        shout.readOnly = false;
        shout.value = dst.obj[defs.descfield];
        shout.placeholder = defs.descplace;
        //set the focus only if not already filled in
        namein = jt.byId('namein');
        if(namein && !namein.value) {
            namein.focus(); }
        else if(!shout.value) {
            shout.focus(); }
    },


    calendarSettingsHTML = function () {
        var html;
        if(dst.type !== "group" || app.group.membershipLevel(dst.obj) < 3) {
            return; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#togglecalembed",
                        onclick: jt.fs("app.layout.togdisp('grpcalembdiv')")},
                  ["span", {cla: "settingsexpandlinkspan"},
                   "Embedded Calendar"]],
                 ["div", {cla: "formline", id: "grpcalembdiv",
                          style: "display:none;"},
                  [["div", {cla: "formline"},
                    "If your group has an embeddable public calendar, paste the embed code below"],
                   ["textarea", {id: "calembedta", cla: "dlgta"}],
                   ["div", {cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "savecalbutton",
                                onclick: jt.fs("app.pgd.saveCalEmbed()")},
                     "Update Embed"]]]]]];
        return html;
    },
    calSettingsInit = function () {
        var ceta = jt.byId('calembedta');
        if(ceta) {
            ceta.readOnly = false;
            ceta.value = dst.obj.calembed;
            ceta.placeholder = "<iframe src=... code"; }
    },


    reminderSettingsHTML = function () {
        return "Reminder settings go here";
    },


    historyCheckpoint = function () {
        var histrec = { view: dst.type, tab: dst.tab };
        histrec[dst.type + "id"] = dst.id;
        app.history.checkpoint(histrec);
    },


    tabHTMLFromDef = function (tabname) {
        var ico, html;
        ico = ["img", {cla: "tabico", src: knowntabs[tabname].img}];
        if(knowntabs[tabname].img === "calico") {
            ico = ["div", {id: "calicodiv", cla: "tabico"},
                    [["div", {id: "calicoheaddiv"}],
                     ["div", {id: "caliconumdiv"},
                      new Date().getDate()]]]; }
        html = ["li", {id: tabname + "li", cla: "unselectedTab"},
                ["a", {href: knowntabs[tabname].href,
                       onclick: jt.fs("app.pgd.tabsel('" + tabname + "')")},
                 ico]];
        return html;
    },


    getRecentReviews = function () {
        var revs, rt, all, i;
        revs = app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent);
        rt = app.layout.getType();
        if(rt !== "all") {
            all = revs;
            revs = [];
            for(i = 0; i < all.length; i += 1) {
                if(all[i].revtype === rt) {
                    revs.push(all[i]); } } }
        return revs;
    },


    displayRecent = function () {
        app.review.displayReviews('pgdcontdiv', "pgd", getRecentReviews(), 
                                  "app.pgd.toggleRevExpansion", 
                                  (dst.type === "group"));
    },


    getFavoriteReviews = function () {
        var revids, rt, tops, types, i;
        tops = dst.obj.top20s || {};
        if(!tops.all) {
            tops.all = [];
            types = app.review.getReviewTypes();
            for(i = 0; i < types.length; i += 1) {
                rt = types[i].type;
                tops.all = tops.all.concat(tops[rt] || []); } }
        rt = app.layout.getType();
        revids = tops[rt] || [];
        return app.lcs.resolveIdArrayToCachedObjs("rev", revids);
    },


    displayFavorites = function () {
        app.review.displayReviews('pgdcontdiv', "pgd", getFavoriteReviews(),
                                  "app.pgd.toggleRevExpansion", 
                                  (dst.type === "group"));
    },


    displaySearch = function () {
        var html;
        html = [["div", {id: "pgdsrchdiv"},
                 ["input", {type: "text", id: "pgdsrchin", size: 40,
                            placeholder: "Membic title or name",
                            value: searchstate.qstr}]],
                ["div", {id: "pgdsrchdispdiv"}]];
        jt.out('pgdcontdiv', jt.tac2html(html));
        searchstate.init = true;
        app.pgd.searchReviews();
    },


    displayGroups = function (groupnames) {
        var html, gid, gname;
        if(!groupnames) {
            return app.pen.groupNames(dst.obj, "pgdcontdiv", displayGroups); }
        html = [];
        for(gid in groupnames) {
            if(groupnames.hasOwnProperty(gid)) {
                gname = groupnames[gid];
                html.push(["div", {cla: "grouplinkdiv"},
                           [["div", {cla: "fpprofdiv"},
                             ["img", {cla: "fpprofpic",
                                      alt: "no pic",
                                      src: dst.group.picsrc + gid}]],
                            ["a", {href: "groups/" + jt.canonize(gname),
                                   onclick: jt.fs("app.group.bygroupid('" +
                                                  gid + "')")},
                             ["span", {cla: "penfont"}, gname]]]]); } }
        html.push(["div", {cla: "pgdtext"},
                   [["div", {cla: "pgdtoggle"},
                     ["a", {href: "#findgroups",
                            onclick: jt.fs("app.pgd.toggleFindGroups()")},
                      "Find groups to follow"]],
                    ["div", {id: "findgrpdiv"}]]]);
        html.push(["div", {cla: "pgdtext"},
                   [["div", {cla: "pgdtoggle"},
                     ["a", {href: "#creategroup",
                            onclick: jt.fs("app.pgd.toggleCreateGroup()")},
                      "Create Group"]],
                    ["div", {id: "creategrpdiv"}]]]);
        jt.out('pgdcontdiv', jt.tac2html(html));
    },


    displayCalendar = function () {
        jt.out('pgdcontdiv', dst.obj.calembed);
    },


    tabsHTML = function (obj) {
        var html = [];
        html.push(tabHTMLFromDef("latest"));
        html.push(tabHTMLFromDef("favorites"));
        html.push(tabHTMLFromDef("search"));
        if(dst.type === "pen") {  //find or create group
            html.push(tabHTMLFromDef("groups")); }
        if(dst.type === "group") {
            html.push(tabHTMLFromDef("calendar")); }
        return html;
    },


    displayTab = function (tabname) {
        var kt, elem, dispfunc;
        tabname = tabname || "latest";
        for(kt in knowntabs) {
            if(knowntabs.hasOwnProperty(kt)) {
                elem = jt.byId(kt + "li");
                if(elem) {
                    elem.className = "unselectedTab"; } } }
        jt.byId(tabname + "li").className = "selectedTab";
        dst.tab = tabname;
        dispfunc = knowntabs[tabname].dispfunc;
        app.layout.displayTypes(dispfunc);  //connect type filtering
        dispfunc();
    },


    displayObject = function (obj) {
        var defs, html;
        dst.obj = obj;
        app.layout.cancelOverlay();  //close user menu if open
        app.layout.closeDialog();    //close search dialog if open
        historyCheckpoint();
        defs = dst[dst.type];
        html = ["div", {id: "pgdouterdiv"},
                [["div", {id: "pgdupperdiv"},
                  [["div", {id: "pgdpicdiv"},
                    ["img", {cla: "pgdpic", src: picImgSrc(obj)}]],
                   ["div", {id: "pgddescrdiv"},
                    [["div", {id: "pgdnamediv"},
                      [["a", {href: defs.accsrc + jt.instId(obj),
                              onclick: jt.fs("app.pgd.blogconf()")},
                        ["span", {cla: "penfont"}, obj.name]],
                       modButtonsHTML(obj)]],
                     ["div", {id: "ppgdshoutdiv"},
                      ["span", {cla: "shoutspan"}, 
                       jt.linkify(obj[defs.descfield] || "")]]]]]],
                 ["div", {id: "tabsdiv"},
                  ["ul", {id: "tabsul"},
                   tabsHTML(obj)]],
                 ["div", {id: "pgdcontdiv"}]]];
        jt.out('contentdiv', jt.tac2html(html));
        displayTab();
    },


    displayRetrievalWaitMessage = function (divid, dtype, id) {
        var mpi, msg;
        mpi = app.pen.myPenId();
        msg = "Retrieving " + dtype.capitalize() + " " + id + "...";
        if(dtype === "pen") {
            if((!id && !mpi) || (id && id === mpi)) {
                msg = "Retrieving your Pen Name..."; }
            else {
                msg = "Retriving Pen Name " + id + "..."; } }
        jt.out(divid, msg);
    },


    verifyFunctionConnections = function () {
        if(!dst.pen.objupdate) {
            dst.pen.objupdate = app.pen.updatePen;
            dst.group.objupdate = app.group.updateGroup; }
        if(!knowntabs.latest.dispfunc) {
            knowntabs.latest.dispfunc = displayRecent;
            knowntabs.favorites.dispfunc = displayFavorites;
            knowntabs.search.dispfunc = displaySearch;
            knowntabs.groups.dispfunc = displayGroups;
            knowntabs.calendar.dispfunc = displayCalendar; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    settings: function () {
        var html;
        html = ["div", {id: "pgdsettingsdlgdiv"},
                [["div", {cla: "pgdsectiondiv"},
                   membershipSettingsHTML()],
                 ["div", {cla: "pgdsectiondiv"},
                  picSettingsHTML()],
                 ["div", {cla: "pgdsectiondiv"},
                  descripSettingsHTML()],
                 ["div", {cla: "pgdsectiondiv"},
                  calendarSettingsHTML()],
                 ["div", {cla: "pgdsectiondiv"},
                  reminderSettingsHTML()]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   picSettingsInit();
                                   descripSettingsInit();
                                   calSettingsInit(); });
    },


    saveDescription: function () {
        var changed = false, defs, elem, val, okfunc, failfunc;
        jt.byId('okbutton').disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("namein");
        if(elem && elem.value && elem.value.trim()) {
            val = elem.value.trim();
            if(dst.obj.name !== val) {
                dst.obj.name = val;
                changed = true; } }
        elem = jt.byId('shouteditbox');
        if(elem && elem.value !== dst.obj[defs.descfield]) {
            dst.obj[defs.descfield] = elem.value;
            changed = true; }
        if(!changed) {
            return app.layout.cancelOverlay(); }
        if(changed) {
            okfunc = function (updobj) {
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pgd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId('okbutton').disabled = false;
                jt.out('formstatdiv', "Update failed code " + code + 
                       ": " + errtxt); };
            defs.objupdate(dst.obj, okfunc, failfunc); }
    },


    saveCalEmbed: function () {
        var defs, elem, okfunc, failfunc;
        jt.byId('savecalbutton').disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("calembedta");
        if(elem && elem.value !== dst.obj.calembed) {
            dst.obj.calembed = elem.value;
            okfunc = function (upobj) {
                dst.obj = upobj;
                app.layout.cancelOverlay();
                app.pgd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId('savecalbutton').disabled = false;
                jt.out('imgupstatdiv', "Update failed code " + code +
                       ": " + errtxt); };
            defs.objupdate(dst.obj, okfunc, failfunc); }
    },


    grpdownlev: function () {
        //confirm the action if needed
        //call group.resign or stop following depending on level.
        jt.err("pgd.grpdownlev not implemented yet");
    },


    blogconf: function () {
        //confirm we should open a new page with their blog view that
        //they can share publicly.  The href should also be that URL
        //since you have to be signed in to see someone's profile.
        jt.err("blogconf not implemented yet.");
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


    searchReviews: function () {
        var srchin, params;
        srchin = jt.byId("pgdsrchin");
        if(!srchin) {  //query input no longer on screen.  probably switched
            return; }  //tabs so just quit
        if(!searchstate.inprog && 
              (searchstate.init ||
               searchstate.revtype !== app.layout.getType() ||
               searchstate.qstr !== srchin.value)) {
            searchstate.qstr = srchin.value;
            searchstate.revtype = app.layout.getType();
            searchstate.inprog = true;
            searchstate.init = false;
            params = app.login.authparams() + 
                "&qstr=" + jt.enc(jt.canonize(searchstate.qstr)) +
                "&revtype=" + app.typeOrBlank(searchstate.revtype) +
                "&" + (dst.type === "group"? "grpid=" : "penid=") +
                jt.instId(dst.obj);
            jt.call('GET', "srchrevs?" + params, null,
                    function (revs) {
                        app.lcs.putAll("rev", revs);
                        searchstate.revs = revs;
                        searchstate.inprog = false;
                        app.review.displayReviews(
                            'pgdsrchdispdiv', "pgd", searchstate.revs, 
                            "app.pgd.toggleRevExpansion", 
                            (dst.type === "group"));
                        setTimeout(app.pgd.searchReviews, 400); },
                    app.failf(function (code, errtxt) {
                        jt.out('pgdsrchdispdiv', "searchReviews failed: " + 
                               code + " " + errtxt); }),
                    jt.semaphore("pgd.searchReviews")); }
        else {  //no change to search parameters yet, monitor
            setTimeout(app.pgd.searchReviews, 400); }
    },


    toggleRevExpansion: function (prefix, revid) {
        var revs;
        switch(dst.tab) {
        case "latest":
            revs = getRecentReviews();
            break;
        case "favorites":
            revs = getFavoriteReviews();
            break;
        case "search":
            revs = searchstate.revs;
            break;
        default:
            jt.err("pgd.toggleRevExpansion unknown tab " + dst.tab); }
        app.review.toggleExpansion(revs, prefix, revid);
    },


    toggleFindGroups: function () {
        var html;
        html = ["The best way to find groups is from the ",
                ["a", {href: "#home",
                       onclick: jt.fs("app.activity.displayFeed()")},
                 "main feed display."],
                " If a notable membic was posted to a group, click through and check it out.  If the group looks interesting, you can follow to prefer content posted from the group, then optionally apply for membership if you want to contribute."];
        if(!jt.byId("findgrpdiv").innerHTML) {
            jt.out('findgrpdiv', jt.tac2html(html)); }
        else {
            jt.out('findgrpdiv', ""); }
    },


    toggleCreateGroup: function () {
        var html;
        html = ["A group is a collection of membics related to a theme.  After creating a group, you can post any membic you write that matches the group criteria.  As the founder of a group, you have full privileges to accept other members and manage posts as you want.",
                ["div", {cla: "formbuttonsdiv"},
                 ["button", {type: "button", id: "creategroupbutton",
                             onclick: jt.fs("app.pgd.display('group')")},
                  "Create New Group"]]];
        if(!jt.byId("creategrpdiv").innerHTML) {
            jt.out('creategrpdiv', jt.tac2html(html)); }
        else {
            jt.out('creategrpdiv', ""); }
    },


    tabsel: function (tabname) {
        historyCheckpoint();  //history collapses tab changes
        displayTab(tabname);
    },


    display: function (dtype, id, tab, obj) {
        verifyFunctionConnections();
        dst.type = dtype || "pen";
        dst.id = id || (obj? jt.instId(obj) : "") || 
            (dst.type === "pen"? app.pen.myPenId() : "") || "";
        dst.tab = tab || "latest";
        if(obj) {
            return displayObject(obj); }
        if(dst.id) {
            return app.pgd.fetchAndDisplay(dst.type, dst.id, dst.tab); }
        jt.log("pgd.display called without an obj or id");
    },


    blockfetch: function (dtype, id, callback) {
        var objref, url, time;
        if(dtype === "pen" && !id) {
            id = app.pen.myPenId(); }
        objref = app.lcs.getRef(dtype, id);
        if(objref && objref[dtype] && objref[dtype].recent) {
            return callback(objref[dtype]); }
        displayRetrievalWaitMessage('contentdiv', dtype, id);
        url = "blockfetch?" + app.login.authparams();
        if(dtype === "pen" && id !== app.pen.myPenId()) {
            url += "&penid=" + id; }  //penid not specified if retrieving self
        if(dtype === "group") {
            url += "&grpid=" + id; }
        time = new Date().getTime();
        jt.call('GET', url, null,
                function (objs) {  // main obj + recent/top reviews
                    var obj, revs, i;
                    time = new Date().getTime() - time;
                    jt.log("blockfetch " + dtype + " " + id  + 
                           " returned in " + time/1000 + " seconds.");
                    if(!objs.length || !objs[0]) {
                        if(dtype === "pen") {
                            return app.pen.newPenName(callback); }
                        return app.crash(404, dtype.capitalize() + " " + id + 
                                         " not returned.", "GET", url); }
                    obj = objs[0];
                    if(dtype === "pen" && !app.pen.myPenId()) {
                        app.pen.setMyPenId(jt.instId(obj)); }
                    revs = objs.slice(1);
                    revs.sort(function (a, b) {
                        if(a.modified < b.modified) { return 1; }
                        if(a.modified > b.modified) { return -1; }
                        return 0; });
                    app.lcs.putAll("rev", revs);
                    for(i = 0; i < revs.length; i += 1) {
                        revs[i] = jt.instId(revs[i]); }
                    obj.recent = revs;  //ids resolved as needed for display
                    app.lcs.put(dtype, obj);
                    jt.log("blockfetch cached " + dtype + " " + jt.instId(obj));
                    callback(obj); },
                app.failf(function (code, errtxt) {
                    app.crash(code, errtxt, "GET", url, ""); }),
                jt.semaphore("pgd.fetchAndDisplay" + dtype + id));
    },


    fetchAndDisplay: function (dtype, id, tab) {
        app.pgd.blockfetch(dtype, id, function (obj) {
            app.pgd.display(dtype, id, tab || "", obj); });
    }

};  //end of returned functions
}());

