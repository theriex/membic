/*global window, jtminjsDecorateWithUtilities, document */
/*jslint white, fudge */

var membicEmbed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "",
        jt = {},
        embparams = {},
        framedim = {width: 320, height: 533},  //min cell phone display


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////


    computeFrameDimensions = function () {
        framedim.width = Math.max(framedim.width, window.innerWidth);
        framedim.height = Math.max(framedim.height, window.innerHeight);
        //width and/or height may be overridden in embed href params
        framedim.width = embparams.width || framedim.width;
        framedim.height = embparams.height || framedim.height;
    },


    writeEmbeddedContent = function () {
        var mdiv, src, html = [];
        mdiv = jt.byId('membicdiv');
        computeFrameDimensions(mdiv);
        src = siteroot + "?view=coop&coopid=" + embparams.coopid +
            "&site=" + jt.enc(window.location.href);
        if(embparams.css) {
            src += "&css=" + embparams.css; }
        html.push(["iframe", {id: "membiciframe", src: src,
                              seamless: "seamless", frameBorder: 0,
                              width: framedim.width,
                              height: framedim.height}]);
        jt.out('membicdiv', jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createCoopDisplay: function () {
        var href = document.getElementById('membicdiv').innerHTML;
        href = href.slice(href.indexOf("href=") + 6);
        href = href.slice(0, href.indexOf('"'));
        siteroot = href.slice(0, href.indexOf("?"));
        jtminjsDecorateWithUtilities(jt);
        href = href.slice(href.indexOf("?") + 1);
        if(href.indexOf("&amp;") >= 0) {
            href = href.replace(/&amp;/g, "&"); }
        embparams = jt.paramsToObj(href, embparams, "String");
        writeEmbeddedContent();
    }

};  //end of returned functions
}());

membicEmbed.createCoopDisplay();

