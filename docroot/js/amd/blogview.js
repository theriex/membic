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


    appendIfMissing = function (val, csv) {
        if(!csv) {
            return val; }
        if(csv.indexOf(val) === 0 || csv.indexOf(", " + val) > 0) {
            return csv; } //value already there
        return csv + ", " + val;
    },


    displayReviews = function () {
        var i, revitems = [], artists = "", ld, html;
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
        app.layout.fixTextureCover();
    }

}; //end of returned functions
}());

