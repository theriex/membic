/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4, regexp: true */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static blog view.  Don't model it.
var wdydfunBlogview = (function () {
    "use strict";


    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var pen = null,
        revs = [],
        reloff = "..",
        siteroot = "",
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
        html = html.replace(/profpic\?/g, reloff + "/profpic?");
        if(!siteroot) {
            siteroot = "http://www.wdydfun.com";
            if(window.location.href.indexOf("http://localhost:8080") === 0) {
                siteroot = "http://localhost:8080"; }
            if(window.location.href.indexOf(siteroot) === 0) {
                siteroot = reloff; } } 
        html = html.replace(/src="(http)?([^"]*)/g, function (a, b, c) { 
            if(!b) {
                return "src=\"" + siteroot + c.slice(reloff.length); }
            return "src=\"" + b + c; });
        if(siteroot) { //fix specific problematic non-img references
            html = html.replace(/..\/statrev/g, siteroot + "/statrev");
            html = html.replace(/..\/\?/g, siteroot + "?"); }
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
                        onclick: jt.fs("wdydfunBlogview.showEmbed")},
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
                             onclick: jt.fs("wdydfunBlogview.showRecent()"),
                             title: "Recent reviews"},
                       pen.name]],
                     "&nbsp;",
                     ["span", {id: "blogsharebuttonspan"},
                      blogShareButtonsHTML()]]],
                   ["div", {id: "blogbadgesdiv"},
                    app.profile.earnedBadgesHTML(
                        pen, "wdydfunBlogview.showTop")],
                   ["div", {id: "blogshoutoutdiv"},
                    jt.linkify(pen.shoutout)]]]]];
        jt.out('siteproflinkdiv', fixImageLinks(jt.tac2html(html)));
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
            wdydfunBlogview.showTop(type); });
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
            wdydfunBlogview.showTop(type.type); }
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
        html = "../#view=profile&profid=" + jt.instId(pen);
        if(siteroot && siteroot.indexOf("..") < 0) {
            html = siteroot + "/blogs/" + pen.name_c; }
        html = ["div", {id: "blogcontentdiv"},
                [["ul", {id: "reviewsul", cla: "revlist"}, revitems],
                 ["div",
                  ["Follow me on ",
                   ["a", {href: html},
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

    setSiteRoot: function (val) {
        siteroot = val; },


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
        jt.out('reviewsul', fixImageLinks(jt.tac2html(lis)));
        setHash(type);
        jt.out('blogsharebuttonspan', 
               fixImageLinks(jt.tac2html(blogShareButtonsHTML())));
    },


    showRecent: function () {
        jt.out('reviewsul', fixImageLinks(jt.tac2html(revitems)));
        setHash("recent");
        jt.out('blogsharebuttonspan', 
               fixImageLinks(jt.tac2html(blogShareButtonsHTML())));
    },


    showEmbed: function () {
        var embedtxt, html;
        embedtxt = "<div id=\"wdydfunblog\" style=\"background:#ddd;width:70%;margin-left:10%;\"></div>\n" +
            "<script src=\"http://www.wdydfun.com/emblog/" + pen.name_c + ".js\"></script>\n" +
            "<script src=\"http://www.wdydfun.com/js/embed.js\"></script>\n" +
            "<script>\n" +
            "  wdydfunEmbed.displayBlog();\n" +
            "</script>\n";
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "To embed this review blog content into another web page, copy and paste this code:"],
                 ["textarea", {id: "tascr", cla: "shoutout"}],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.layout.closeDialog()")},
                   "OK"]]]];
        app.layout.openDialog({y:140}, jt.tac2html(html), null,
                              function () {
                                  var tascr = jt.byId('tascr');
                                  tascr.style.width = "95%";
                                  tascr.style.marginLeft = "2%";
                                  tascr.value = embedtxt;
                                  jt.byId('tipok').focus(); });
        
    }

}; //end of returned functions
}());

