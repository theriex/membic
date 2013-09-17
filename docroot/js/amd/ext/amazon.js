/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

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
        if(idx < 0) {  //simple tag not found
            tag = "<" + field + " ";
            idx = xml.indexOf(tag);
            if(idx < 0) {  //tag with attributes not found either
                return ""; }
            xml = xml.slice(idx + tag.length);
            idx = xml.indexOf(">");
            xml = xml.slice(idx + 1); }
        else { //simple tag found
            xml = xml.slice(idx + tag.length); }
        tag = "</" + field + ">";
        idx = xml.indexOf(tag);
        xml = xml.slice(0, idx);
        return xml;
    },


    setIfReturned = function (review, field, val) {
        if(val) {
            review[field] = val; }
    },


    setIfFound = function (review, field, vals) {
        if(vals && vals.length > 0) {
            review[field] = vals.join(", "); }
    },


    extractElements = function (field, xml) {
        var fields, i, btag, etag, bidx, eidx, value, results = [];
        fields = field.split(".");
        for(i = 0; i < fields.length - 1; i += 1) {
            xml = extractField(fields[i], xml); }
        field = fields[fields.length - 1];
        btag = "<" + field + ">";
        etag = "</" + field + ">";
        bidx = xml.indexOf(btag);
        while(bidx >= 0) {
            eidx = xml.indexOf(etag);
            value = xml.slice(bidx + btag.length, eidx);
            results.push(value);
            xml = xml.slice(eidx + etag.length);
            bidx = xml.indexOf(btag); }
        return results;
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
        setIfFound(review, "starring",
                   extractElements("ItemLookupResponse.Items.Item" + 
                                   ".ItemAttributes.Actor", xml));
    },


    extractASIN = function (url) {
        var pieces = url.split("?");
        pieces = pieces[0].split("/");
        pieces = pieces[pieces.length - 1].split("%");
        return pieces[0];
    },


    fetchData = function (review, url, params) {
        var critsec = "", asin = extractASIN(url);
        app.out('contentdiv', "Reading details from Amazon...");
        url = "amazoninfo?asin=" + asin;
        app.call('GET', url, null,
                 function (json) {
                     setReviewFields(review, app.dec(json[0].content));
                     app.review.setAttribution(attribution);
                     app.review.display(); },
                 app.failf(function (code, errtxt) {
                     app.err("Amazon data retrieval failed code " + 
                             code + ": " + errtxt);
                     app.review.display(); }),
                 critsec);
    };


    return {
        name: svcName,
        fetchData: function (review, url, params) {
            fetchData(review, url, params); }
    };

});

