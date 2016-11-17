/*global document */
/*jslint white, fudge */

var membicEmbedBoot = (function () {
    "use strict";

    var siteroot;

return {

    loadAndRun: function () {
        var elem, href;
        href = document.getElementById('membicdiv').innerHTML;
        href = href.slice(href.indexOf("href=") + 6);
        href = href.slice(0, href.indexOf('"'));
        siteroot = href.slice(0, href.indexOf("?"));
        elem = document.createElement("script");
        elem.src = siteroot + "/js/jtmin.js?v=161117";
        document.getElementsByTagName("body")[0].appendChild(elem);
        elem = document.createElement("script");
        elem.src = siteroot + "/js/embedrun.js?v=161117";
        document.getElementsByTagName("body")[0].appendChild(elem);
    }

};  //end of returned functions
}());

membicEmbedBoot.loadAndRun();

