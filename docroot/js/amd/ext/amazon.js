/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . a m a z o n
//
define([], function () {
    "use strict";

    var svcName = "Amazon",    //ascii with no spaces, used as an id
        attribution = "<a href=\"http://www.amazon.com\"" +
            " title=\"The Amazon API was called to try save some typing\"" +
            ">delivered by Amazon</a>",


    extractField = function (field, xml) {
        var idx, tag = "<" + field + ">";
        idx = xml.indexOf(tag);
        if(idx < 0) {
            return ""; }
        xml = xml.slice(idx + tag.length);
        tag = "</" + field + ">";
        idx = xml.indexOf(tag);
        xml = xml.slice(0, idx);
        return xml;
    },


    setIfReturned = function (review, field, val) {
        if(val) {
            review[field] = val; }
    },


    setReviewFields = function (review, xml) {
        review.revtype = extractField("ProductGroup", xml).toLowerCase();
        if((review.revtype.indexOf("book") >= 0) ||
           (review.revtype.indexOf("audible") >= 0) ||
           (review.revtype.indexOf("text") >= 0) ||
           (review.revtype.indexOf("kindlestore") >= 0)) {
            review.revtype = "book"; }
        else if((review.revtype.indexOf("music") >= 0) ||
                (review.revtype.indexOf("classical") >= 0)) {
            review.revtype = "music"; }
        else if((review.revtype.indexOf("movie") >= 0) || 
                (review.revtype.indexOf("dvd") >= 0) ||
                (review.revtype.indexOf("tv series") >= 0) ||
                (review.revtype.indexOf("video") >= 0)) {
            review.revtype = "movie"; }
        review.imguri = extractField("URL", extractField("MediumImage", xml));
        review.url = extractField("DetailPageURL", xml);
        review.title = extractField("Title", xml);
        ////////////////////////////////////////
        //additional specialized fields for book:
        setIfReturned(review, "author", extractField("Author", xml));
        setIfReturned(review, "publisher", extractField("Publisher", xml));
        setIfReturned(review, "year", 
                      extractField("PublicationDate", xml).slice(0, 4));
        ////////////////////////////////////////
        //additional specialized fields for music:
        //artist: not always available.  Usually works for albums but may
        //not be given for single audio tracks
        setIfReturned(review, "artist", extractField("Artist", xml));
        //album: The Amazon page has a "From the Album..." link as
        //part of their description, but that info doesn't seem to be
        //available from the API (ep 2013-feb).
        //year: A song may have both a PublicationDate and a ReleaseDate
        //but the ReleaseDate takes precedence if specified.
        setIfReturned(review, "year", 
                      extractField("ReleaseDate", xml).slice(0, 4));
        ////////////////////////////////////////
        //additional specialized fields for movie:
        //year: ReleaseDate already set from above
        //starring: multiple Actor entries within ItemAttributes
        //Punting on this for now, see netflix.js comments
    },


    extractASIN = function (url) {
        var pieces = url.split("?");
        pieces = pieces[0].split("/");
        return pieces[pieces.length - 1];
    },


    fetchData = function (review, url, params) {
        var asin = extractASIN(url);
        mor.out('contentdiv', "Reading details from Amazon...");
        url = "amazoninfo?asin=" + asin;
        mor.call(url, 'GET', null,
                 function (json) {
                     setReviewFields(review, mor.dec(json[0].content));
                     mor.review.setAttribution(attribution);
                     mor.review.display(); },
                 function (code, errtxt) {
                     mor.err("Amazon data retrieval failed code " + 
                             code + ": " + errtxt);
                     mor.review.display(); });
    };


    return {
        name: svcName,
        fetchData: function (review, url, params) {
            fetchData(review, url, params); }
    };

});

