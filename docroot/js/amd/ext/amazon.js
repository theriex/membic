/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . a m a z o n
//
define([], function () {
    "use strict";

    var svcName = "Amazon",    //ascii with no spaces, used as an id
        attribution = "<a href=\"http://www.netflix.com\"" +
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


    setReviewFields = function (review, xml) {
        review.revtype = extractField("ProductGroup", xml).toLowerCase();
        review.imguri = extractField("URL", extractField("MediumImage", xml));
        review.title = extractField("Title", xml);
        review.url = extractField("DetailPageURL", xml);
        review.author = extractField("Author", xml);
        review.publisher = extractField("Publisher", xml);
        review.year = extractField("PublicationDate", xml).slice(0, 4);
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

