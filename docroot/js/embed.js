/*global window: false, jtminjsDecorateWithUtilities: false, document: false, wdydfunBlogview: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

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
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    displayBlog: function (obj) {
        var scrnames = ["jtmin.js", "amd/blogview.js", "amd/layout.js",
                        "amd/profile.js", "amd/review.js", "amd/pen.js",
                        "amd/lcs.js"], i, src, elem, allLoaded;
        if(obj && obj.siteroot) {
            siteroot = obj.siteroot; }
        allLoaded = true;
        for(i = 0; i < scrnames.length; i += 1) {
            src = "http://localhost:8080/js/" + scrnames[i];
            if(!scriptLoaded(src)) {
                allLoaded = false;
                elem = document.createElement("script");
                elem.onload = wdydfunEmbed.displayBlog;
                elem.src = src;
                document.getElementsByTagName("body")[0].appendChild(elem);
                break; } }
        if(allLoaded) {
            jtminjsDecorateWithUtilities(jt);
            jt.out("wdydfunblog", WDYDFunEmbeddedBlogHTML);
            wdydfunBlogview.setSiteRoot(siteroot);
            wdydfunBlogview.display("headless"); }
    }

};  //end of returned functions
}());