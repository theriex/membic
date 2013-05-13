/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . y o u t u b e
//
define([], function () {
    "use strict";

    var svcName = "YouTube",    //ascii with no spaces, used as an id
        attribution = "<a href=\"http://www.youtube.com\"" +
            " title=\"The YouTube API was called to try save some typing\"" +
            ">delivered by YouTube</a>",


    //Attempt to parse the title.  Add smarts on case basis.  In
    //general, guessing artist, title is most likely due to players
    //organizing music by artist, then album, then title
    parseTitle = function (review) {
        var text;
        if(!review.title) {
            return; }
        text = review.title;
        //case: "artist - title"
        //e.g. http://www.youtube.com/watch?v=KnIJOO__jVo
        if(text.indexOf(" - ") > 0) {
            text = text.split(" - ", 2);
            review.artist = text[0].trim();
            review.title = text[1].trim(); }
        //case: "artist: title"
        //e.g. http://www.youtube.com/watch?v=tHOn093r-Ak
        else if(text.indexOf(": ") > 0) {
            text = text.split(": ", 2);
            review.artist = text[0].trim();
            review.title = text[1].trim(); }
    },


    setReviewFields = function (review, data) {
        review.revtype = "video";
        if(data && data.entry && data.entry.title) {
            review.title = data.entry.title.$t; }
        if(data && data.entry && data.entry.media$group &&
           data.entry.media$group.media$thumbnail &&
           data.entry.media$group.media$thumbnail.length &&
           data.entry.media$group.media$thumbnail.length > 0 &&
           data.entry.media$group.media$thumbnail[0]) {
            review.imguri = data.entry.media$group.media$thumbnail[0].url; }
        parseTitle(review);
    },


    //Use contentdiv for displays, call mor.review.display when done.
    //The review.url and other fields have already been set from the
    //params, so this only needs to fill out additional info.
    fetchData = function (review, url, params) {
        var urlobj = mor.paramsToObj(url),
            vid = urlobj.v, critsec = "";
        mor.out('contentdiv', "Reading details from YouTube...");
        url = "http://gdata.youtube.com/feeds/api/videos/" + vid + 
            "?v=2&alt=json";
        url = "jsonget?geturl=" + mor.enc(url);
        mor.call(url, 'GET', null,
                 function (json) {
                     setReviewFields(review, json);
                     mor.review.setAttribution(attribution);
                     mor.review.display(); },
                 function (code, errtxt) {
                     mor.err("YouTube data retrieval failed code " + 
                             code + ": " + errtxt);
                     mor.review.display(); },
                 critsec);
    };


    return {
        name: svcName,
        fetchData: function (review, url, params) {
            fetchData(review, url, params); }
    };

});


