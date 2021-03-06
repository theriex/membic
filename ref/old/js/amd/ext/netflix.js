/*global app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.netflix = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "Netflix",    //ascii with no spaces, used as an id
        attribution = "<a href=\"http://www.netflix.com\"" + 
                        " title=\"Review details retrieved from Netflix\"" +
                      ">delivered by Netflix</a>",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    setReviewFields = function (review, data) {
        var elem;
        review.revtype = "movie";
        if(data && data.d && data.d.results && data.d.results.length > 0) {
            elem = data.d.results[0]; }
        if(!elem) {
            jt.err("Empty data returned from Netflix");
            return; }
        //Use the canonical URL as listed in the database.  The raw URL
        //set from the parameters has tracking IDs and other spurious info
        //that makes it harder to read and may possibly interfere with a
        //different user clicking through on the link.
        review.url = elem.Url;
        //Use the name as listed on Netflix.  Easier to reference.
        review.title = elem.Name;
        //The year is occasionally important to identify a re-release
        review.year = elem.ReleaseYear;
        //It is possible to retrieve the elem.Cast contents by
        //appending "&$expand=Cast" to the API call, which returns the
        //first 10-12 cast members, but it is not always in expected
        //priority order.  This is not a critically important field,
        //and it seems like the filling this out might create more
        //noise than it's worth.  Listing 10 people under "starring"
        //is bad.  Listing the wrong top 3 is bad.  Rather leave it
        //blank.  The primary intent of the starring field is where it
        //really matters in terms of your impression of the movie, so
        //let the user fill it out if they want.
        if(elem.BoxArt) {
            review.imguri = elem.BoxArt.SmallUrl || 
                elem.BoxArt.MediumUrl || 
                elem.BoxArt.LargeUrl || 
                elem.BoxArt.HighDefinitionUrl; }
    },


    extractMovieId = function (url) {
        var pieces = url.split("?");
        pieces = pieces[0].split("/");
        return pieces[pieces.length - 1];
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    name: svcName,


    //Uses contentdiv for interim display information, calls
    //app.review.display on completion.  The review.url and other
    //fields have already been set from the params, so this function
    //only needs to fill out additional info.
    fetchData: function (review, url, params) {
        var movieId = extractMovieId(url);
        jt.out('contentdiv', "Reading details from Netflix...");
        url = "http://odata.netflix.com/Catalog/Titles" + 
            "?$filter=NetflixApiId%20eq%20" + 
            "'http://api.netflix.com/catalog/titles/movies/" + movieId + "'" +
            "&$format=json";
        url = "jsonget?geturl=" + jt.enc(url);
        jt.call('GET', url, null,
                 function (json) {
                     setReviewFields(review, json);
                     app.review.setAttribution(attribution);
                     app.review.display(); },
                 app.failf(function (code, errtxt) {
                     jt.err("Netflix data retrieval failed code " +
                             code + ": " + errtxt);
                     app.review.display(); }),
                jt.semaphore("netflix.fetchData"));
    }


};  //end of returned functions
}());

