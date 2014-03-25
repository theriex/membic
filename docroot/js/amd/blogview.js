/*global window: false, jtminjsDecorateWithUtilities: false */
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


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayName = function () {
        var penid, imgsrc, html;
        penid = jt.instId(pen);
        imgsrc = "../img/emptyprofpic.png";
        if(pen.profpic) {
            imgsrc = "../profpic?profileid=" + penid; }
        html = ["table",
                [["tr",
                  [["td",
                    ["img", {cla: "profpic", src: imgsrc}]],
                   ["td", {style: "padding:5px 10px;"},
                    ["span", {id: "penhnamespan"},
                     ["a", {href: "../#view=profile&profid=" + penid,
                            title: "Show profile for " + pen.name},
                      pen.name]]]]],
                 ["tr",
                  [["td",
                    ["div", {id: "profcitydiv"},
                     ["span", {id: "profcityspan"},
                      pen.city || ""]]],
                   ["td",
                    jt.linkify(pen.shoutout)]]]]];
        jt.out('siteproflinkdiv', jt.tac2html(html));
    },


    displayReviews = function () {
        var i, type, revid, jump, revitems = [], html;
        for(i = 0; i < revs.length; i += 1) {
            revid = jt.instId(revs[i]);
            type = app.review.getReviewTypeByValue(revs[i].revtype);
            jump = "";
            if(revs[i].url) {
                jump = " &nbsp;" + app.review.jumpLinkHTML(revs[i].url); }
            revitems.push(
                ["li",
                 [["div", {cla: "revtextsummary"},
                   jt.colloquialDate(jt.ISOString2Day(revs[i].modified)) +
                   "&nbsp;" + revs[i].keywords],
                  app.review.starsImageHTML(revs[i].rating),
                  app.review.badgeImageHTML(type),
                  "&nbsp;",
                  ["a", {cla: "rslc", href: "../statrev/" + revid},
                   app.profile.reviewItemNameHTML(type, revs[i])],
                  jump,
                  ["div", {cla: "revtextsummary"},
                   [["div", {style:"float:left;padding:0px 10px 0px 0px;"}, 
                     app.review.picHTML(revs[i], type)],
                    ["div", {style: "padding:10px;"},
                     jt.linkify(revs[i].text)]]],
                  ["div", {style: "clear:both;"}]]]); }
        html = ["div", {id: "blogcontentdiv"},
                ["ul", {cla: "revlist"}, revitems]];
        html = jt.tac2html(html);
        html = html.replace(/img\//g, "../img/");
        jt.out('revdatadiv', html);
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
        pen = parseEmbeddedJSON(jt.byId('pendatadiv').innerHTML);
        jt.out('pendatadiv', "");
        revs = parseEmbeddedJSON(jt.byId('revdatadiv').innerHTML);
        jt.out('revdatadiv', "");
        if(!jt.instId) {
            jt.instId = function (obj) {
                var idfield = "_id";
                if(obj && obj.hasOwnProperty(idfield)) {
                    return obj[idfield]; }
            }; }
        if(!jt.isLowFuncBrowser) {
            jt.isLowFuncBrowser = function () {
                return false;
            }; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {
    display: function () {
        jtminjsDecorateWithUtilities(jt);
        readData();
        displayName();
        displayReviews();
    }

}; //end of returned functions
}());

