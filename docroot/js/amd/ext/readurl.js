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


    valueForField = function (elem, field) {
        var idx, val;
        idx = elem.indexOf(field);
        if(idx >= 0) {
            val = elem.slice(idx + field.length);
            idx = val.indexOf("\"");
            if(idx >= 0) {  //double quote delimited
                val = val.slice(idx + 1);
                idx = val.indexOf("\"");
                if(idx >= 0) {
                    val = val.slice(0, idx);
                    return val; } }
            idx = val.indexOf("'");
            if(idx >= 0) {  //single quote delimited
                val = val.slice(idx + 1);
                idx = val.indexOf("'");
                if(idx >= 0) {
                    val = val.slice(0, idx);
                    return val; } } }
        return "";
    },


    elementForString = function (html, targetstr, elemtype) {
        var found = false, start, end, idx, str = "";
        idx = html.indexOf(targetstr);
        while(!found && idx >= 0) {
            start = html.lastIndexOf("<", idx);
            end = html.indexOf(">", idx);
            str = html.slice(start, end + 1);
            if(str.indexOf("<" + elemtype) === 0) {
                found = true; }
            else {
                found = false;
                idx = html.indexOf(targetstr, idx + 1); } }
        return str;
    },


    verifyFullURL = function (val, url) {
        var urlbase, idx;
        if(val.indexOf("http") >= 0) {
            return val; }
        urlbase = url.split("?")[0];
        idx = urlbase.lastIndexOf("/");
        if(idx > 9) {  //the slashes at the start don't count
            urlbase = urlbase.slice(0, idx); }
        idx = urlbase.lastIndexOf("/");
        if(idx <= 9) {
            urlbase += "/"; }
        return urlbase + val;
    },


    setImageURI = function (review, html, url) {
        var elem, val;
        elem = elementForString(html, "image_src", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
        elem = elementForString(html, "og:image", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
        elem = elementForString(html, "twitter:image", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
    },


    setCanonicalURL = function (review, html, url) {
        var elem, val;
        elem = elementForString(html, "canonical", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                review.url = verifyFullURL(val, url); } }
    },


    setReviewFields = function (review, html, url) {
        setImageURI(review, html, url);
        setCanonicalURL(review, html, url);
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

