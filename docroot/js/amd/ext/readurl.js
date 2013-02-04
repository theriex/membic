/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */


//This is a catchall reader that does the best it can to fill out some
//of the review fields using information generally available from any
//url.  If there are standards for declaring media that are in general
//use, this is the place to support them.  Anything specific to a URL
//belongs in a separate reader.
////////////////////////////////////////
// m o r . r e a d u r l
//
define([], function () {
    "use strict";

    var svcName = "URLReader",  //ascii with no spaces, used as an id
        //no attribution since no API provided.

    readHREF = function (html) {
        var idx, href;
        idx = html.indexOf("href");
        if(idx >= 0) {
            href = html.slice(idx + "href".length);
            idx = href.indexOf("\"");
            if(idx >= 0) {
                href = href.slice(idx + 1);
                idx = href.indexOf("\"");
                if(idx >= 0) {
                    href = href.slice(0, idx);
                    return href; } } }
    },


    setImageURI = function (review, html, url) {
        var found = false, start, end, idx, str;
        idx = html.indexOf("image_src");
        while(!found && idx >= 0) {
            start = html.lastIndexOf("<", idx);
            end = html.indexOf(">", idx);
            str = html.slice(start, end + 1);
            if(str.indexOf("<link ") === 0) {
                found = true;
                review.imguri = readHREF(str); }
            else {
                found = false;
                idx = html.indexOf("image_src", idx + 1); } }
    },


    setReviewFields = function (review, html, url) {
        setImageURI(review, html, url);
    },


    fetchData = function (review, url, params) {
        var geturl;
        mor.out('contentdiv', "Reading details from " + url + " ...");
        geturl = "urlcontents?url=" + mor.enc(url);
        mor.call(geturl, 'GET', null,
                 function (json) {
                     setReviewFields(review, mor.dec(json[0].content), url);
                     mor.review.display(); },
                 function (code, errtxt) {
                     mor.err("General URL retrieval failed code " + 
                             code + ": " + errtxt);
                     mor.review.display(); });
    };


    return {
        name: svcName,
        fetchData: function (review, url, params) {
            fetchData(review, url, params); }
    };

});

