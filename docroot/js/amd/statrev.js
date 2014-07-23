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


    readData = function () {
        var pgs, i;
        pen = app.layout.parseEmbeddedJSON(jt.byId('pendatadiv').innerHTML);
        jt.out('pendatadiv', "");
        rev = app.layout.parseEmbeddedJSON(jt.byId('revdatadiv').innerHTML);
        app.review.deserializeFields(rev);
        jt.out('revdatadiv', "");
        if(!jt.instId) {
            jt.instId = function (obj) {
                var idfield = "_id";
                if(obj && obj.hasOwnProperty(idfield)) {
                    return obj[idfield]; }
            }; }
        pgs = app.layout.parseEmbeddedJSON(jt.byId('groupdatadiv').innerHTML);
        for(i = 0; pgs && pgs.length && i < pgs.length; i += 1) {
            app.lcs.put("group", pgs[i]); }
        jt.out('groupdatadiv', "");
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
        var html, href;
        jtminjsDecorateWithUtilities(jt);
        readData();
        noteRefer();
        app.layout.fixTextureCover();
        html = ["div", {id: "statrevheadingdiv"},
                [["div", {id: "centerhdiv"},
                  [["span", {id: "penhnamespan"},
                    //no onclick handling, browser back button should work
                    ["a", {href: "../blogs/" + pen.name_c,
                           title: "Show blog for " + pen.name},
                     pen.name]]]]]];
        jt.out('siteproflinkdiv', jt.tac2html(html));
        html = ["div", {id: "statrevcontent"},
                app.review.staticReviewDisplay(rev, "none")];
        html = jt.tac2html(html);
        html = html.replace(/img\//g, "../img/");
        html = html.replace(/revpic\?/g, "../revpic?");
        jt.out('revcontentdiv', html);
        if(jt.cookie("myopenreviewauth")) {
            href = window.location.href;
            href = href.slice(0, href.lastIndexOf("/"));
            href = href.slice(0, href.lastIndexOf("/"));
            href += "/?view=review&penid=" + rev.penid + 
                "&revid=" + jt.instId(rev);
            window.location.href = href; }
        else {
            displayAds(); } //space available, and helps pay the server bills...
    }

}; //end of returned functions
}());

