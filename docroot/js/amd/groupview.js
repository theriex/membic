/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {};   //Global access to general utility methods

//This is a degenerate module used for the static blog view.  Don't model it.
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
        var groupid, rssurl, namespan, width, html;
        groupid = jt.instId(group);
        rssurl = "../rssgrp?group=" + groupid;
        namespan = ["span", {id: "penhnamespan"},
                     group.name];
        width = window.innerWidth;  //usually defined..
        html = ["div", {cla: "sgrpdiv"},
                [["div", {cla: "sgpicdiv"},
                  app.group.grpPicCityHTML(group, "sgpicdiv")],
                 ["div", {cla: "sjoinrssdiv"},
                  [(width > 700 ? namespan : ""),
                   ["a", {href: "../#view=group&groupid=" + groupid,
                          title: "WDYDFun Group", id: "sgrpjoinlink"},
                    "Join"],
                   ["a", {href: rssurl, id: "rsslink",
                          title: "RSS feed for " + jt.ndq(group.name),
                          onclick: jt.fs("window.open('" + rssurl + "')")},
                    ["img", {cla: "rssico", 
                             src: "../img/rssicon.png"}]]]],
                 ["div", {cla: "floatclear"}],
                 ["div", {id: "sgrpnamedescdiv"},
                  [["div",
                    (!(width > 700) ? namespan : "")],
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
        jt.out('grouprevsdiv', html);
    },


    parseEmbeddedJSON = function (text) {
        var obj, jsonobj = JSON || window.JSON;
        if(!jsonobj) {
            jt.err("JSON not supported, please use a modern browser"); }
        text = text.trim();
        text = text.replace(/\n/g, "\\n");
        obj = jsonobj.parse(text);
        return obj;
    },


    readData = function () {
        group = parseEmbeddedJSON(jt.byId('groupdatadiv').innerHTML);
        jt.out('groupdatadiv', "");
        revs = parseEmbeddedJSON(jt.byId('grouprevsdiv').innerHTML);
        jt.out('grouprevsdiv', "");
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
