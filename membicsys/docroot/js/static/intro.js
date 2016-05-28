/*global app, d3ckit*/
/*jslint browser, multivar, white, fudge, for */

app.intro = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var slides = [];


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    function initSlides (ds) {
        ds.deck = slides;
    }


    ////////////////////////////////////////
    // public functions
    ////////////////////////////////////////
return {

    run: function () {
        var ds = d3ckit.displaySettings();
        initSlides(ds);
        ds.autoplay = true;
        d3ckit.run();
    }


};  //end of returned functions
}());

