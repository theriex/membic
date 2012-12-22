/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . t w i t t e r
//
define([], function () {
    "use strict";

    var svcName = "Twitter",  //no spaces in name, used as an id

    addProfileAuth = function (domid, pen) {
        mor.err("Not implemented yet");
    },

    authenticate = function () {
        mor.err("Not implemented yet");
    };

    return {
        loginurl: "https://www.twitter.com",
        name: svcName,  //no spaces in name, used as an id
        svcDispName: "Tweet",
        svcDesc: "Tweets a condensed review",
        iconurl: "img/tw_logo.png",
        authenticate: function () {
            authenticate(); },
        addProfileAuth: function (domid, pen) {
            addProfileAuth(domid, pen); }
    };

});

