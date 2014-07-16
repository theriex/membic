/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static view.  Don't model it.
var groupview = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var group = null,
        revs = [],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    noteRefer = function () {
        var btwimg;
        if(document.referrer) {
            btwimg = jt.byId('btwimg');
            if(btwimg) {
                btwimg.src = "../bytheimg?grpinqref=" + 
                    jt.enc(document.referrer); } }
    },


    displayGroup = function () {
        var groupid = jt.instId(group),
            rssurl = "../rssgrp?group=" + groupid,
            iswide = window.innerWidth && window.innerWidth > 700,
            njspan, html;
        njspan = ["span", {id: "namejoinlinkspan"},
                  [["span", {id: "penhnamespan"},
                    group.name],
                   ["a", {href: "../#view=group&groupid=" + groupid,
                          title: "WDYDFun Group", id: "sgrpjoinlink"},
                    "Join"]]];
        html = ["div", {cla: "sgrpdiv"},
                [["div", {cla: "getyoursdiv"},
                  ["a", {href: "../#view=profile"},
                   "Start a group"]],
                 ["div", {cla: "sgpicdiv"},
                  app.group.grpPicCityHTML(group, "sgpicdiv")],
                 ["div", {cla: "sjoinrssdiv"},
                  [(iswide? njspan : ""),
                   app.layout.shareLinksHTML(
                       window.location.href, 
                       "latest posts from " + group.name, //text gets embedded
                       "../"),
                   ["a", {href: rssurl, id: "rsslink",
                          title: "RSS feed for " + jt.ndq(group.name),
                          onclick: jt.fs("window.open('" + rssurl + "')")},
                    ["img", {cla: "rssico", 
                             src: "../img/rssicon.png"}]]]],
                 ["div", {cla: "floatclear"}],
                 ["div", {id: "sgrpnamedescdiv"},
                  [["div",
                    (iswide? "" : njspan)],
                   ["div", {id: "groupdescdiv", cla: "groupdescrtxt"},
                    jt.linkify(group.description)]]]]];
        jt.out('groupdescrdiv', jt.tac2html(html));
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
                    "WDYDFun"],
                   " for membership information"]]]];
        html = jt.tac2html(html);
        html = html.replace(/img\//g, "../img/");
        html = html.replace(/revpic\?/g, "../revpic?");
        jt.out('groupcontentdiv', html);
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
    display: function () {
        jtminjsDecorateWithUtilities(jt);
        readData();
        noteRefer();
        displayGroup();
        displayReviews();
        app.layout.fixTextureCover();
    }

}; //end of returned functions
}());
