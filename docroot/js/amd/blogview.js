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


    fixImageLinks = function (html) {
        html = html.replace(/img\//g, reloff + "/img/");
        html = html.replace(/revpic\?/g, reloff + "/revpic?");
        return html;
    },


    getGreenLink = function () {
        var grlink = {href: "/#view=profile&profid=" + jt.instId(pen), 
                      text: "View Profile"};
        if(!jt.cookie("myopenreviewauth")) {  //not logged in
            grlink = {href: "/#view=profile", 
                      text: "Get your review log"}; }
        grlink.href = reloff + grlink.href;
        return grlink;
    },


    blogShareButtonsHTML = function () {
        var surl, rt, desc, html;
        surl = window.location.href;
        if(surl.indexOf("#") >= 0) {
            rt = surl.slice(surl.indexOf("#") + 1);
            surl = surl.slice(0, surl.indexOf("#")); }
        if(surl.indexOf("?") >= 0) {
            if(!rt) {
                rt = surl.slice(surl.indexOf("?") + "?type=".length); }
            surl = surl.slice(0, surl.indexOf("?")); }
        if(rt === "recent") {
            rt = ""; }
        if(rt) {
            surl += "?type=" + rt; }
        desc = "latest reviews from " + pen.name;  //text gets embedded
        if(rt) {
            desc = "top " + rt + " reviews from " + pen.name; }
        html = app.layout.shareLinksHTML(surl, desc, reloff + "/");
        return html;
    },


    displayName = function () {
        var penid = jt.instId(pen), 
            grlink = getGreenLink(), 
            rssurl = reloff + "/rsspen?pen=" + penid,
            imgsrc, html;
        imgsrc = reloff + "/img/emptyprofpic.png";
        if(pen.profpic) {
            imgsrc = reloff + "/profpic?profileid=" + penid; }
        html = ["div", {cla: "blogidentdiv"},
                [["div", {id: "getyourscontainerdiv"},
                  ["div", {cla: "getyoursdiv"},
                   ["a", {href: grlink.href,
                          onclick: jt.fs("window.open('" + grlink.href + "')")},
                    grlink.text]]],
                 ["div", {id: "blogimagecontainerdiv"},
                  [["img", {cla: "profpic", src: imgsrc}],
                   ["div", {id: "profcitydiv"},
                    ["span", {id: "profcityspan"},
                     pen.city || ""]]]],
                 ["div", {id: "blogheadingmaindiv"},
                  [["div", {id: "blognamediv"},
                    [["span", {id: "penhnamespan"},
                      ["a", {href: "#recent",
                             onclick: jt.fs("blogview.showRecent()"),
                             title: "Recent reviews"},
                       pen.name]],
                     "&nbsp;",
                     ["span", {id: "blogsharebuttonspan"},
                      blogShareButtonsHTML()],
                     ["a", {href: rssurl, id: "rsslink",
                            title: "RSS feed for " + jt.ndq(pen.name),
                            onclick: jt.fs("window.open('" + rssurl + "')")},
                      ["img", {cla: "rssico", 
                               src: reloff + "/img/rssicon.png"}]]]],
                   ["div", {id: "blogbadgesdiv"},
                    fixImageLinks(app.profile.earnedBadgesHTML(
                        pen, "blogview.showTop"))],
                   ["div", {id: "blogshoutoutdiv"},
                    jt.linkify(pen.shoutout)]]]]];
        jt.out('siteproflinkdiv', jt.tac2html(html));
    },


    appendIfMissing = function (val, csv) {
        if(!csv) {
            return val; }
        if(csv.indexOf(val) === 0 || csv.indexOf(", " + val) > 0) {
            return csv; } //value already there
        return csv + ", " + val;
    },


    fetchAndInstantiate = function (type, trevs, i) {
        app.lcs.getFull("rev", trevs[i], function (revref) {
            trevs[i] = revref.rev;
            blogview.showTop(type); });
    },


    setHash = function (type) {
        var url, hashidx;
        url = window.location.href;
        hashidx = url.indexOf("#");
        if(hashidx >= 0) {
            url = url.slice(0, hashidx); }
        if(type) {
            url += "#" + type; }
        window.location.href = url;
    },


    //Top reviews for a given review type can be specified either via
    //?type=book or #book.  The hash tag takes precedence.
    showTop20IfSpecified = function () {
        var type, idx;
        idx = window.location.href.indexOf("?");
        if(idx >= 0) {
            type = window.location.href.slice(idx + "?type=".length);
            idx = type.indexOf("#");
            if(idx >= 0) {
                type = type.slice(0, idx); } }
        idx = window.location.href.indexOf("#");
        if(idx >= 0) {
            type = window.location.href.slice(idx + 1); }
        if(type && type !== "recent") {
            type = app.review.getReviewTypeByValue(type);
            blogview.showTop(type.type); }
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
        showTop20IfSpecified();
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
        setHash(type);
        jt.out('blogsharebuttonspan', jt.tac2html(blogShareButtonsHTML()));
    },


    showRecent: function () {
        jt.out('reviewsul', fixImageLinks(jt.tac2html(revitems)));
        setHash("recent");
        jt.out('blogsharebuttonspan', jt.tac2html(blogShareButtonsHTML()));
    }

}; //end of returned functions
}());

