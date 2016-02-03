/*global stat, jt */
/*jslint browser, multivar, white, fudge */

stat.lc = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dispdiv = null,
        dat = null,
        lks = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    drawChart = function () {
        jt.out(dispdiv, "Line chart goes here");
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function (divid, data, keydefs) {
        dispdiv = divid;
        dat = data;
        lks = keydefs;
        drawChart();
    }

}; //end of returned functions
}());

