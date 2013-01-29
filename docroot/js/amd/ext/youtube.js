/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . y o u t u b e
//
define([], function () {
    "use strict";

    var svcName = "YouTube",    //ascii with no spaces, used as an id
        iconurl = "http://www.youtube.com/favicon.ico",


    setReviewFields = function (review, data) {
        var text;
        review.revtype = "video";
        if(data && data.entry && data.entry.title) {
            review.title = data.entry.title.$t; }
        if(data && data.entry && data.entry.media$group &&
           data.entry.media$group.media$thumbnail &&
           data.entry.media$group.media$thumbnail.length &&
           data.entry.media$group.media$thumbnail.length > 0 &&
           data.entry.media$group.media$thumbnail[0]) {
            review.imguri = data.entry.media$group.media$thumbnail[0].url; }
        //attempt to parse the title.  Add smarts on case basis.
        text = review.title;
        if(text && text.indexOf(" - ") > 0) {
            text = text.split(" - ");
            if(text.length === 2) {
                //guessing artist - title is slightly more popular due
                //to organizing music by artist, then album, then title
                //case: http://www.youtube.com/watch?v=KnIJOO__jVo
                review.artist = text[0].trim();
                review.title = text[1].trim(); } }
    },


    //Use contentdiv for displays, call mor.review.display when done.
    //The review.url and other fields have already been set from the
    //params, so this only needs to fill out additional info.
    initReview = function (review, url, params) {
        var urlobj = mor.paramsToObj(url),
            vid = urlobj.v;
        mor.out('contentdiv', "Reading details from YouTube...");
        url = "http://gdata.youtube.com/feeds/api/videos/" + vid + 
            "?v=2&alt=json";
        url = "jsonget?geturl=" + mor.enc(url);
        mor.call(url, 'GET', null,
                 function (json) {
                     setReviewFields(review, json);
                     mor.review.display(); },
                 function (code, errtxt) {
                     mor.err("YouTube data retrieval failed code " + 
                             code + ": " + errtxt);
                     mor.review.display(); });
    };


    return {
        name: svcName,
        iconurl: iconurl,
        initReview: function (review, url, params) {
            initReview(review, url, params); }
    };

});


