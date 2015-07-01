/*global window: false, jtminjsDecorateWithUtilities: false, document: false, jt: false, app: false, membicFrameDimensionsOverride: false */
/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

var membicEmbed = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var siteroot = "",
        jt = {},
        embparams = {},
        mdivs = {},
        framedim = {width: 320, height: 533},  //min cell phone display


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////


    scriptLoaded = function (src) {
        var elems, i;
        elems = document.getElementsByTagName("script");
        for(i = 0; elems && i < elems.length; i += 1) {
            if(elems[i].src && elems[i].src === src) {
                return true; } }
        return false;
    },


    loadScripts = function (scrnames, contf) {
        var i, src, elem, allLoaded;
        allLoaded = true;
        for(i = 0; i < scrnames.length; i += 1) {
            src = siteroot + "/js/" + scrnames[i];
            if(!scriptLoaded(src)) {
                allLoaded = false;
                elem = document.createElement("script");
                elem.onload = contf;
                elem.src = src;
                document.getElementsByTagName("body")[0].appendChild(elem);
                break; } }
        return allLoaded;
    },


    readMembicDivs = function () {
        var div;
        div = jt.byId('membiccssoverride');
        if(div) {
            mdivs.css = div.innerHTML;
            div.innerHTML = ""; }
    },


    computeFrameDimensions = function (mdiv) {
        var pos, contheight, height, width;
        pos = jt.geoPos(mdiv);
        contheight = document.body.scrollHeight + pos.x;
        contheight += 50;  //extra padding to help things work out
        height = window.innerHeight - contheight;
        width = document.body.offsetWidth;
        framedim.width = Math.max(framedim.width, width);
        framedim.height = Math.max(framedim.height, height);
        if(typeof membicFrameDimensionsOverride === "function") {
            membicFrameDimensionsOverride(framedim); }
    },


    writeEmbeddedContent = function () {
        var mdiv, src, html = [];
        mdiv = jt.byId('membiccoopdiv');
        computeFrameDimensions(mdiv);
        src = siteroot + "?" + jt.objdata(embparams);
        src += "&site=" + jt.enc(window.location.href);
        if(mdivs.css) {
            src += "&css=" + jt.enc(mdivs.css); }
        html.push(["iframe", {id: "membiciframe", src: src,
                              width: framedim.width,
                              height: framedim.height}]);
        jt.out('membiccoopdiv', jt.tac2html(html));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    createCoopDisplay: function (obj) {
        var href = document.getElementById('membiccoopdiv').innerHTML;
        href = href.slice(href.indexOf("href=") + 6);
        href = href.slice(0, href.indexOf('"'));
        siteroot = href.slice(0, href.indexOf("?"));
        if(loadScripts(["jtmin.js"], membicEmbed.createCoopDisplay)) {
            jtminjsDecorateWithUtilities(jt);
            embparams = jt.paramsToObj(href.slice(href.indexOf("?") + 1),
                                       embparams, "String");
            readMembicDivs();
            writeEmbeddedContent(); }
    }

};  //end of returned functions
}());

membicEmbed.createCoopDisplay();

