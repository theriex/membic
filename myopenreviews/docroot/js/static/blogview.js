/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4, regexp: true */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static blog view.  Don't model it.
var fgfwebLogview = (function () {
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


    getGreenLink = function () {
        var grlink = {href: "/#view=pen&penid=" + jt.instId(pen), 
                      text: "View Profile"};
        if(!jt.cookie("myopenreviewauth")) {  //not logged in
            grlink = {href: "/#view=pen", 
                      text: "Get your own membic log"}; }
        grlink.href = reloff + grlink.href;
        return grlink;
    },


    blogShareButtonsHTML = function () {
        var surl, rt, desc, html, rssurl;
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
        html = app.layout.shareLinksHTML(surl, desc);
        if(!rt) {
            rssurl = reloff + "/rsspen?pen=" + jt.instId(pen);
            html += jt.tac2html(
                ["&nbsp;",
                 ["a", {href: "#embed", id: "embedlink",
                        title: "Embed dynamic blog elements into another site",
                        onclick: jt.fs("fgfwebLogview.showEmbed")},
                  ["span", {cla: "embedlinktext"}, "{embed}"]],
                 ["a", {href: rssurl, id: "rsslink",
                        title: "RSS feed for " + jt.ndq(pen.name),
                        onclick: jt.fs("window.open('" + rssurl + "')")},
                  ["img", {cla: "rssico", 
                           src: "img/rssicon.png"}]]]); }
        return html;
    },


    displayName = function () {
        var grlink = getGreenLink(), 
            imgsrc, html;
        imgsrc = "img/emptyprofpic.png";
        if(pen.profpic) {
            imgsrc = "profpic?profileid=" + jt.instId(pen); }
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
                             onclick: jt.fs("fgfwebLogview.showRecent()"),
                             title: "Recent reviews"},
                       pen.name]],
                     "&nbsp;",
                     ["span", {id: "blogsharebuttonspan"},
                      blogShareButtonsHTML()]]],
                   ["div", {id: "blogbadgesdiv"},
                    app.profile.earnedBadgesHTML(
                        pen, "fgfwebLogview.showTop")],
                   ["div", {id: "blogshoutoutdiv"},
                    jt.linkify(pen.shoutout)]]]]];
        jt.out('siteproflinkdiv', app.layout.rootLink(jt.tac2html(html)));
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
            fgfwebLogview.showTop(type); });
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
            fgfwebLogview.showTop(type.type); }
    },


    displayReviews = function () {
        var i, artists = "", ld, sroot, profurl, html;
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
        profurl = "../#view=pen&penid=" + jt.instId(pen);
        sroot = app.layout.getSiteRoot();
        if(sroot && sroot.indexOf("..") < 0) {
            profurl = sroot + "/blogs/" + pen.name_c; }
        html = ["div", {id: "blogcontentdiv"},
                [["ul", {id: "reviewsul", cla: "revlist"}, revitems],
                 ["div",
                  ["Follow me on ",
                   ["a", {href: profurl},
                    "FGFweb"],
                   "!"]]]];
        jt.out('profcontentdiv', app.layout.rootLink(jt.tac2html(html)));
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

    display: function (headless) {
        jtminjsDecorateWithUtilities(jt);
        if(window.location.href.split("/").length > 3) {
            reloff = "../.."; }
        readData();
        if(!headless) {
            noteRefer();
            displayName(); }
        displayReviews();
        app.layout.fixTextureCover();
        showTop20IfSpecified();
        if(headless) {
            jt.out('siteproflinkdiv', "");
            jt.out('referdiv', "");
            jt.byId('blogcontentdiv').style.marginLeft = "0px"; }
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
        jt.out('reviewsul', app.layout.rootLink(jt.tac2html(lis)));
        setHash(type);
        jt.out('blogsharebuttonspan', 
               app.layout.rootLink(jt.tac2html(blogShareButtonsHTML())));
    },


    showRecent: function () {
        jt.out('reviewsul', app.layout.rootLink(jt.tac2html(revitems)));
        setHash("recent");
        jt.out('blogsharebuttonspan', 
               app.layout.rootLink(jt.tac2html(blogShareButtonsHTML())));
    },


    showEmbed: function () {
        app.layout.showEmbed("emblog/" + pen.name_c + ".js", 
                             "fgfweblog",
                             "displayBlog()");
    }

}; //end of returned functions
}());

