/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static blog view.  Don't model it.
var blogview = (function () {
    "use strict";


    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var pen = null,
        revs = [],
        reloff = "..",
        revitems = [],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    noteRefer = function () {
        var btwimg;
        if(document.referrer) {
            btwimg = jt.byId('btwimg');
            if(btwimg) {
                btwimg.src = reloff + "/bytheimg?bloginqref=" + 
                    jt.enc(document.referrer); } }
    },


    displayName = function () {
        var penid, imgsrc, rssurl, html, badges, grlink;
        badges = app.profile.earnedBadgesHTML(pen, "blogview.showTop");
        badges = badges.replace(/img\//g, reloff + "/img/");
        penid = jt.instId(pen);
        imgsrc = reloff + "/img/emptyprofpic.png";
        if(pen.profpic) {
            imgsrc = reloff + "/profpic?profileid=" + penid; }
        rssurl = reloff + "/rsspen?pen=" + penid;
        html = ["div", {cla: "blogidentdiv"},
                [["div", {id: "getyourscontainerdiv"}],
                 ["table",
                  [["tr",
                    [["td", {rowspan: 2},
                      ["img", {cla: "profpic", src: imgsrc}]],
                     ["td", {style: "padding:5px 10px;"},
                      [["span", {id: "penhnamespan"},
                        ["a", {href: "#recent",
                               onclick: jt.fs("blogview.showRecent()"),
                               title: "Recent reviews"},
                         pen.name]],
                       "&nbsp;",
                       ["a", {href: rssurl, id: "rsslink",
                              title: "RSS feed for " + jt.ndq(pen.name),
                              onclick: jt.fs("window.open('" + rssurl + "')")},
                        ["img", {cla: "rssico", 
                                 src: reloff + "/img/rssicon.png"}]]]]]],
                   ["tr",
                    //img extends into here
                    ["td", badges]],
                   ["tr",
                    [["td", {valign: "top"},
                      ["div", {id: "profcitydiv"},
                       ["span", {id: "profcityspan"},
                        pen.city || ""]]],
                     ["td",
                      jt.linkify(pen.shoutout)]]]]]]];
        jt.out('siteproflinkdiv', jt.tac2html(html));
        grlink = {href: "/#view=profile&profid=" + jt.instId(pen), 
                  text: "View Profile"};
        if(!jt.cookie("myopenreviewauth")) {
            grlink = {href: "/#view=profile", 
                      text: "Get your own review log"}; }
        grlink.href = reloff + grlink.href;
        jt.out('getyourscontainerdiv', jt.tac2html(
            ["div", {cla: "getyoursdiv"},
             ["a", {href: grlink.href,
                    onclick: jt.fs("window.open('" + grlink.href + "')")},
              grlink.text]]));
    },


    appendIfMissing = function (val, csv) {
        if(!csv) {
            return val; }
        if(csv.indexOf(val) === 0 || csv.indexOf(", " + val) > 0) {
            return csv; } //value already there
        return csv + ", " + val;
    },


    fixImageLinks = function (html) {
        html = html.replace(/img\//g, reloff + "/img/");
        html = html.replace(/revpic\?/g, reloff + "/revpic?");
        return html;
    },


    fetchAndInstantiate = function (type, trevs, i) {
        app.lcs.getFull("rev", trevs[i], function (revref) {
            trevs[i] = revref.rev;
            blogview.showTop(type); });
    },


    displayReviews = function () {
        var i, artists = "", ld, html;
        for(i = 0; i < revs.length; i += 1) {
            if(revs[i].revtype === "music" && revs[i].svcdata &&
               revs[i].svcdata.indexOf("\"batchUpdated\":\"" + 
                                       revs[i].modified + "\"") >= 0) {
                ld = revs[i].modified;
                artists = appendIfMissing(revs[i].artist, artists); }
            else {
                if(artists) {
                    revitems.push(
                        ["li",
                         [["div", {cla: "revtextsummary"},
                           jt.colloquialDate(jt.ISOString2Day(ld)) + 
                           "&nbsp;Playlist Update:"],
                          ["div", {cla: "revtextsummary",
                                   style: "padding:0px 0px 20px 97px;"},
                           artists]]]);
                    artists = ""; }
                revitems.push(["li",
                               app.review.staticReviewDisplay(revs[i])]); } }
        html = ["div", {id: "blogcontentdiv"},
                [["ul", {id: "reviewsul", cla: "revlist"}, revitems],
                 ["div",
                  ["Follow me on ",
                   ["a", {href: "../#view=profile&profid=" + jt.instId(pen)},
                    "WDYDFun"],
                   "!"]]]];
        jt.out('profcontentdiv', fixImageLinks(jt.tac2html(html)));
    },


    readData = function () {
        pen = app.layout.parseEmbeddedJSON(jt.byId('pendatadiv').innerHTML);
        jt.out('pendatadiv', "");
        revs = app.layout.parseEmbeddedJSON(jt.byId('revdatadiv').innerHTML);
        jt.out('revdatadiv', "");
        if(!jt.instId) {
            jt.instId = function (obj) {
                var idfield = "_id";
                if(obj && obj.hasOwnProperty(idfield)) {
                    return obj[idfield]; }
            }; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {
    display: function () {
        jtminjsDecorateWithUtilities(jt);
        if(window.location.href.split("/").length > 3) {
            reloff = "../.."; }
        readData();
        noteRefer();
        displayName();
        displayReviews();
        app.layout.fixTextureCover();
    },


    showTop: function (type) {
        var i, trevs, lis = [];
        if(pen.top20s) {
            if(typeof pen.top20s === "string") {
                pen.top20s = JSON.parse(pen.top20s); }
            trevs = pen.top20s[type];
            for(i = 0; trevs && i < trevs.length; i += 1) {
                if(typeof trevs[i] === "string") {
                    fetchAndInstantiate(type, trevs, i);
                    break; }
                lis.push(["li", app.review.staticReviewDisplay(trevs[i])]); } }
        jt.out('reviewsul', fixImageLinks(jt.tac2html(lis)));
    },


    showRecent: function () {
        jt.out('reviewsul', fixImageLinks(jt.tac2html(revitems)));
    }

}; //end of returned functions
}());

