/*global jt, jtminjsDecorateWithUtilities, navigator */
/*jslint white, fudge */

//This is a degenerate standalone module used for testing.  Don't model it.
var clientcheck = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var 


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    navHTML = function () {
        var html = "No navigator information available.", nav;
        if(navigator) {
            nav = navigator;
            html = ["table",
                    [["tr",
                      [["td", {cla: "attrtd"}, "appCodeName:"],
                       ["td", {cla: "valtd"}, nav.appCodeName]]],
                     ["tr",
                      [["td", {cla: "attrtd"}, "appName:"],
                       ["td", {cla: "valtd"}, nav.appName]]],
                     ["tr",
                      [["td", {cla: "attrtd"}, "appVersion:"],
                       ["td", {cla: "valtd"}, nav.appVersion]]],
                     ["tr",
                      [["td", {cla: "attrtd"}, "platform:"],
                       ["td", {cla: "valtd"}, nav.platform]]],
                     ["tr",
                      [["td", {cla: "attrtd"}, "userAgent:"],
                       ["td", {cla: "valtd"}, nav.userAgent]]]]]; }
        return html;
    },


    clientInfoHTML = function () {
        var html;
        html = [["p", 
                 "Welcome to the client test page, here's your info:"],
                navHTML(),
                ["p",
                 "isLowFuncBrowser: " + jt.isLowFuncBrowser()],
                ["p",
                 "&nbsp;"],
                ["p",
                 "Please copy and paste the entire text of this page " +
                 "when emailing support"]];
        return html;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    run: function () {
        jtminjsDecorateWithUtilities(jt);
        jt.out('outputdiv', jt.tac2html(clientInfoHTML()));
    }

}; //end of returned functions
}());

