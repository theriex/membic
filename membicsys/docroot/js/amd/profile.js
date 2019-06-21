/*jslint browser, white, fudge, this, for */
/*global app, jt */

app.profile = (function () {
    "use strict";

    var mypid = "";


    function displayProfileForId (profid) {
        app.pcd.fetchAndDisplay("profile", profid);
    }


    function displayProfile () {
        jt.log("profile.displayProfile not implemented yet.");
    }


    function updateProfile (obj, succf, failf) {
        jt.log("profile.updateProfile not implemented yet.");
    }


    function myName () {
        jt.log("profile.myName not implemented yet.");
    }


    return {
        byprofid: function (profid) { displayProfileForId(profid); },
        display: function () { displayProfile(); },
        update: function (obj, sf, xf) { updateProfile(obj, sf, xf); },
        myProfId: function () { return mypid; },
        myName: function () { return myName(); }
    };
}());
