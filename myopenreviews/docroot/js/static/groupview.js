/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static view.  Don't model it.
var fgfwebGroupview = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var group = null,
        revs = [],
        reloff = "..",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    noteRefer = function () {
        var btwimg;
        if(document.referrer) {
            btwimg = jt.byId('btwimg');
            if(btwimg) {
                btwimg.src = reloff + "/bytheimg?grpinqref=" + 
                    jt.enc(document.referrer); } }
    },


    groupShareButtonsHTML = function () {
        var surl, rssurl, desc, html;
        surl = window.location.href;
        if(surl.indexOf("#") >= 0) {
            surl = surl.slice(0, surl.indexOf("#")); }
        if(surl.indexOf("?") >= 0) {
            surl = surl.slice(0, surl.indexOf("?")); }
        rssurl = "../rssgrp?group=" + jt.instId(group);
        desc = "latest posts from " + group.name;   //text gets embedded
        html = app.layout.shareLinksHTML(surl, desc);
        html += jt.tac2html(
            ["&nbsp;",
             ["a", {href: "#embed", id: "embedlink",
                    title: "Embed dynamic group elements into another site",
                    onclick: jt.fs("fgfwebGroupview.showEmbed")},
              ["span", {cla: "embedlinktext"}, "{embed}"]],
             ["a", {href: rssurl, id: "rsslink",
                    title: "RSS feed for " + jt.ndq(group.name),
                    onclick: jt.fs("window.open('" + rssurl + "')")},
              ["img", {cla: "rssico", 
                       src: "img/rssicon.png"}]]]);
        return html;
    },



    displayGroup = function () {
        var groupid = jt.instId(group),
            iswide = window.innerWidth && window.innerWidth > 700,
            njspan, html;
        njspan = ["span", {id: "namejoinlinkspan"},
                  [["span", {id: "penhnamespan"},
                    group.name],
                   ["a", {href: "../#view=group&groupid=" + groupid,
                          title: "FGFweb Group", id: "sgrpjoinlink"},
                    "Join"]]];
        html = ["div", {cla: "sgrpdiv"},
                [["div", {cla: "getyoursdiv"},
                  ["a", {href: "../#view=group"},
                   "Start a group"]],
                 ["div", {cla: "sgpicdiv"},
                  ["img", {src: "../grppic?groupid=" + groupid,
                           alt: "no pic"}]],
                 ["div", {cla: "sjoinrssdiv"},
                  [(iswide? njspan : ""),
                   ["span", {id: "groupsharebuttonspan"},
                    groupShareButtonsHTML()]]],
                 ["div", {cla: "floatclear"}],
                 ["div", {id: "sgrpnamedescdiv"},
                  [["div",
                    (iswide? "" : njspan)],
                   ["div", {id: "groupdescdiv", cla: "groupdescrtxt"},
                    jt.linkify(group.description)]]]]];
        jt.out('groupdescrdiv', app.layout.rootLink(jt.tac2html(html)));
    },


    displayReviews = function () {
        var i, revitems = [], html;
        for(i = 0; i < revs.length; i += 1) {
            revitems.push(["li", app.review.staticReviewDisplay(revs[i])]); }
        if(!revitems.length) {
            revitems.push(["li", "No reviews posted"]); }
        html = ["div", {id: "sgrprevsdiv"},
                [["ul", {cla: "revlist"}, revitems],
                 ["div", {id: "sgrptagline"},
                  ["Go to ",
                   ["a", {href: "../#view=group&groupid=" + jt.instId(group)},
                    "FGFweb"],
                   " for membership information"]]]];
        jt.out('groupcontentdiv', app.layout.rootLink(jt.tac2html(html)));
    },


    readData = function () {
        group = app.layout.parseEmbeddedJSON(
            jt.byId('groupdatadiv').innerHTML);
        jt.out('groupdatadiv', "");
        revs = app.layout.parseEmbeddedJSON(
            jt.byId('grouprevdatadiv').innerHTML);
        jt.out('grouprevdatadiv', "");
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
            displayGroup(); }
        displayReviews();
        app.layout.fixTextureCover();
        if(headless) {
            jt.out('groupdescrdiv', "");
            jt.out('referdiv', "");
            jt.byId('groupcontentdiv').style.marginLeft = "0px"; }
    },


    showEmbed: function () {
        app.layout.showEmbed("emgroup/" + jt.canonize(group.name) + ".js",
                             "fgfwebgroup",
                             "displayGroup()");
    }

}; //end of returned functions
}());
