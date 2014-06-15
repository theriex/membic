/*global window: false, jtminjsDecorateWithUtilities: false, document: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var app = {},  //Global container for application level funcs and values
    jt = {},   //Global access to general utility methods
    adsbygoogle = null;

//This is a degenerate module for the static review display.  Don't model it.
var statrev = (function () {
    "use strict";


    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var pen = null,
        rev = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    noteRefer = function () {
        var btwimg;
        if(document.referrer) {
            btwimg = jt.byId('btwimg');
            if(btwimg) {
                btwimg.src = "../bytheimg?statinqref=" + 
                    jt.enc(document.referrer); } }
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
        rev = parseEmbeddedJSON(jt.byId('revdatadiv').innerHTML);
        jt.out('revdatadiv', "");
        if(!jt.instId) {
            jt.instId = function (obj) {
                var idfield = "_id";
                if(obj && obj.hasOwnProperty(idfield)) {
                    return obj[idfield]; }
            }; }
    },


    displayAds = function () {
        var adinfo, html;
        adinfo = { w: 320, h: 50, slotid: "2057962342" };
        if(window.innerWidth > 728) {
            jt.byId('adoutercontainerdiv').className = "stdadspacediv";
            adinfo = { w: 728, h: 90, slotid: "9581229144" }; }
        html = "<!-- statrevWide -->\n" +
            "<ins class=\"adsbygoogle\"\n" + 
            "     style=\"display:inline-block;width:$Wpx;height:$Hpx\"\n" +
            "     data-ad-client=\"ca-pub-3945939102920673\"\n" +
            "     data-ad-slot=\"$SLOTID\"></ins>\n";
        html = html.replace(/\$W/g, String(adinfo.w));
        html = html.replace(/\$H/g, String(adinfo.h));
        html = html.replace(/\$SLOTID/g, adinfo.slotid);
        jt.out('morgoogleads', html);
        adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {
    display: function () {
        var html;
        jtminjsDecorateWithUtilities(jt);
        readData();
        noteRefer();
        app.layout.fixTextureCover();
        html = ["div", {id: "statrevheadingdiv"},
                [["div", {cla: "getyoursdiv"},
                  ["a", {href: "../#view=profile"},
                   "Get your own review log"]],
                 ["div", {id: "centerhdiv"},
                  [["span", {id: "penhnamespan"},
                    //no onclick handling, browser back button should work
                    ["a", {href: "../blogs/" + pen.name_c,
                           title: "Show blog for " + pen.name},
                     pen.name]],
                   ["span", {id: "penhbuttonspan"},
                    ["a", {href: "../?view=review&penid=" + rev.penid + 
                                 "&revid=" + jt.instId(rev),
                           title: "Switch to application view"},
                     ["img", {cla: "navico", src: "../img/penname.png"}]]]]]]];
        jt.out('siteproflinkdiv', jt.tac2html(html));
        html = ["div", {id: "statrevcontent"},
                app.review.staticReviewDisplay(rev, "none")];
        html = jt.tac2html(html);
        html = html.replace(/img\//g, "../img/");
        html = html.replace(/revpic\?/g, "../revpic?");
        jt.out('revcontentdiv', html);
        displayAds();  //space available, and helps pay the server bills...
    }

}; //end of returned functions
}());

