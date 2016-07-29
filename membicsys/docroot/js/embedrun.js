/*global window, jtminjsDecorateWithUtilities, document */
/*jslint browser, multivar, white, fudge */

var membicEmbed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "",
        jt = {},
        embparams = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////


    writeEmbeddedContent = function () {
        var mdiv, src, html = [];
        mdiv = jt.byId("membicdiv");
        mdiv.style.height = "100%";
        src = siteroot + "?view=coop&coopid=" + embparams.coopid +
            "&site=" + jt.enc(window.location.href);
        if(embparams.css) {
            src += "&css=" + embparams.css; }
        //Not possible to calculate hard width and height because
        //membicdiv may not have content yet, or may be display:none.
        //That produces only zero values to work with.
        html.push(["iframe", {id: "membiciframe", src: src,
                              style: "position:relative;height:100%;width:100%",
                              seamless: "seamless", frameBorder: 0}]);
        jt.out("membicdiv", jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createCoopDisplay: function () {
        var href = document.getElementById("membicdiv").innerHTML;
        href = href.slice(href.indexOf("href=") + 6);
        href = href.slice(0, href.indexOf("\""));
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

