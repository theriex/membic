/*global app: false, jt: false */

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
                pen: { descfield: "shoutout", 
                       picfield: "profpic",
                       picsrc: "profpic?profileid=",
                       accsrc: "#view=pen&penid=" },
                group: { descfield: "description", 
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
                                   img: "img/tabgrps.png" } },


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
        var html = "";
        if(dst.type === "pen" && jt.instId(obj) === app.pen.myPenId()) {
            html = ["a", {id: "pgdsettingslink", href: "#pensettings",
                          onclick: jt.fs("app.pgp.settings()")},
                    ["img", {cla: "reviewbadge",
                             src: "img/settings.png"}]]; }
        //ATTENTION: group mod allowed? follow...
        return jt.tac2html(html);
    },


    historyCheckpoint = function () {
        var histrec = { view: dst.type, tab: dst.tab };
        histrec[dst.type + "id"] = dst.id;
        app.history.checkpoint(histrec);
    },


    tabHTMLFromDef = function (tabname) {
        var html;
        html = ["li", {id: tabname + "li", cla: "unselectedTab"},
                ["a", {href: knowntabs[tabname].href,
                       onclick: jt.fs("app.pgd.tabsel('" + tabname + "')")},
                 ["img", {cla: "tabico", src: knowntabs[tabname].img}]]];
        return html;
    },


    displayRecent = function () {
        var revs;
        revs = app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent);
        app.review.displayReviews('pgdcontdiv', "pgd", revs, 
                                  "app.pgd.toggleRevExpansion", 
                                  (dst.type === "group"));
    },


    displayFavorites = function () {
        jt.out('pgdcontdiv', "displayFavorites not implemented yet...");
    },


    displaySearch = function () {
        jt.out('pgdcontdiv', "displaySearch not implemented yet...");
    },


    displayGroups = function () {
        jt.out('pgdcontdiv', "displayGroups not implemented yet...");
    },


    tabsHTML = function (obj) {
        var html = [];
        html.push(tabHTMLFromDef("latest"));
        html.push(tabHTMLFromDef("favorites"));
        html.push(tabHTMLFromDef("search"));
        if(dst.type === "pen") {  //find or create group
            html.push(tabHTMLFromDef("groups")); }
        //ATTENTION: if a group has a google calendar, and we can
        //embed the contents in agenda form, then that's worth a tab
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


    verifyFunctionConnections = function () {
        if(!dst.pen.objfetch) {
            dst.pen.objfetch = app.pen.getPen;
            dst.group.objfetch = app.group.getGroup; }
        if(!knowntabs.latest.dispfunc) {
            knowntabs.latest.dispfunc = displayRecent;
            knowntabs.favorites.dispfunc = displayFavorites;
            knowntabs.search.dispfunc = displaySearch;
            knowntabs.groups.dispfunc = displayGroups; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    settings: function () {
        jt.err("pgd.settings not implemented yet");
    },


    blogconf: function () {
        //confirm we should open a new page with their blog view that
        //they can share publicly.  The href should also be that URL
        //since you have to be signed in to see someone's profile.
        jt.err("blogconf not implemented yet.");
    },


    toggleRevExpansion: function (prefix, revid) {
        var revs;
        switch(dst.tab) {
        case "latest":
            revs = app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent);
            break;
        default:
            jt.err("pgd.toggleRevExpansion unknown tab " + dst.tab); }
        app.review.toggleExpansion(revs, prefix, revid);
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
            return dst[dst.type].objfetch(dst.id, displayObject); }
        jt.log("pgd.display called without an obj or id");
    }

};  //end of returned functions
}());

