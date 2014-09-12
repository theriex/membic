/*global window: false, jtminjsDecorateWithUtilities: false, document: false, jt: false, app: false, wdydfunBlogview: false, WDYDFunEmbeddedBlogHTML: false, wdydfunGroupview: false, WDYDFunEmbeddedGroupHTML: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

//Stub module for including static blog or group content into any page.
//app, jt globals declared by blogview.js or groupview.js

var wdydfunEmbed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "http://www.wdydfun.com",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////


    scriptLoaded = function (src) {
        var elems, i;
        elems = document.getElementsByTagName("script");
        for(i = 0; elems && i < elems.length; i += 1) {
            if(elems[i].src && elems[i].src === src) {
                return true; } }
        return false;
    },


    loadScripts = function (scrnames, contf) {
        var i, src, elem, allLoaded;
        allLoaded = true;
        for(i = 0; i < scrnames.length; i += 1) {
            src = siteroot + "/js/" + scrnames[i];
            if(!scriptLoaded(src)) {
                allLoaded = false;
                elem = document.createElement("script");
                elem.onload = contf;
                elem.src = src;
                document.getElementsByTagName("body")[0].appendChild(elem);
                break; } }
        return allLoaded;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    displayBlog: function (obj) {
        if(obj && obj.siteroot) {
            siteroot = obj.siteroot; }
        if(loadScripts(["jtmin.js", "amd/blogview.js", "amd/layout.js",
                        "amd/profile.js", "amd/review.js", "amd/pen.js",
                        "amd/lcs.js"], wdydfunEmbed.displayBlog)) {
            jtminjsDecorateWithUtilities(jt);
            jt.out("wdydfunblog", WDYDFunEmbeddedBlogHTML);
            app.layout.setSiteRoot(siteroot);
            wdydfunBlogview.display("headless"); }
    },


    displayGroup: function (obj) {
        if(obj && obj.siteroot) {
            siteroot = obj.siteroot; }
        if(loadScripts(["jtmin.js", "amd/groupview.js", "amd/layout.js",
                        "amd/profile.js", "amd/review.js", "amd/pen.js",
                        "amd/lcs.js"], wdydfunEmbed.displayGroup)) {
            jtminjsDecorateWithUtilities(jt);
            jt.out("wdydfungroup", WDYDFunEmbeddedGroupHTML);
            app.layout.setSiteRoot(siteroot);
            wdydfunGroupview.display("headless"); }
    }

};  //end of returned functions
}());
