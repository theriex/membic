/*global define: false, console: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// A basic AMD module definition for test use.
//
define([], function () {
    "use strict";

    var logCount;

    return {
        logit: function () {
            if(!logCount) {
                logCount = 1; }
            else {
                logCount += 1; }
            console.log("basicmod logCount: " + logCount); }
    };
    
});

