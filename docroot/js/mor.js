/*global alert: false, console: false, escape: false, unescape: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

var mor = {};  //Top level function closure container

////////////////////////////////////////
// m o r   top level methods and variables
//
(function () {
    "use strict";

    ////////////////////////////////////////
    // app variables
    ////////////////////////////////////////

    mor.sessiontoken = "";
    mor.sesscook = "morsession=";
    mor.y = null;
    mor.colors = { bodybg: "#f6f6f6",
                   text: "#000000" };

    ////////////////////////////////////////
    // general utility functions
    ////////////////////////////////////////

    //TODO: history push/pop
    //TODO: window resize adjustment

    //shorthand to log text to the console
    mor.log = function (text) {
        try {
            if(console && console.log) {
                console.log(text); }
        } catch(problem) {  //most likely a bad IE console def, just skip it
        }
    };


    //when you really want the DOM element, not the library node wrapper
    mor.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    //output via the library so it can do housekeeping if it needs to
    mor.out = function (html, domid) {
        var node = mor.y.one("#" + domid);
        if(node) {
            node.setHTML(html); }
        else {
            mor.log("DOM id " + domid + " not available for output"); }
    };


    //factored method to handle a click with no propagation
    mor.click = function (divid, func) {
        var node = mor.y.one("#" + divid);
        node.on("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                func(); });
    };


    //top level kickoff function called from index.html
    mor.init = function (Y) {
        mor.y = Y;
        mor.layout.init();
        mor.skinner.init();
    };

} () );



////////////////////////////////////////
// m o r . l a y o u t
//
(function () {
    "use strict";

    var


    fullContentHeight = function () {
        var ch = mor.byId("content").offsetHeight,
            wh = window.innerHeight - 110,
            filldiv = mor.byId("contentfill");
        if(ch < wh) {
            filldiv.style.height = (wh - ch) + "px"; }
    };


    mor.layout = {
        init: function () {
            mor.y.on('windowresize', fullContentHeight);
            fullContentHeight(); }
    };

} () );



////////////////////////////////////////
// m o r . s k i n n e r 
//
(function () {
    "use strict";

    var oldcolors,


    copycolors = function (colors) {
        var cc = { bodybg: colors.bodybg,
                   text: colors.text };
        return cc;
    },


    updateColors = function () {
        mor.byId('bodyid').style.backgroundColor = mor.colors.bodybg;
        mor.byId('bodyid').style.color = mor.colors.text;
    },


    dialogCancel = function () {
        var div = mor.byId('dlgdiv');
        mor.colors = oldcolors;
        updateColors();
        div.style.visibility = "hidden";
    },


    dialogOk = function () {
        var div = mor.byId('dlgdiv');
        div.style.visibility = "hidden";
    },


    colorToColorArray = function (color) {
        var cvals;
        color = color.toUpperCase();
        cvals = [ parseInt(color.slice(0,2), 16),
                  parseInt(color.slice(2,4), 16),
                  parseInt(color.slice(4,6), 16) ];
        return cvals;
    },


    colorArrayToColor = function (cvals) {
        var color = "#", val, i;
        for(i = 0; i < cvals.length; i += 1) {
            val = cvals[i].toString(16);
            if(val.length < 2) {
                val = "0" + val; }
            color += val; }
        return color;
    },


    colorAdjust = function (colorfield, index, bump) {
        var color = mor.colors[colorfield], cvals;
        color = color.slice(1);   //remove leading "#"
        cvals = colorToColorArray(color);
        cvals[index] += bump;
        if(cvals[index] > 255) { cvals[index] = 255; }
        if(cvals[index] < 0) { cvals[index] = 0; }
        color = colorArrayToColor(cvals);
        return color;
    },


    safeSetColor = function (colorfield, domid, color) {
        var cvals, i;
        if(color.indexOf("#") === 0) {
            color = color.slice(1); }
        if(color.length === 3) {  //e.g. #ccc
            color = color.slice(0,1) + color.slice(0,1) +
                    color.slice(1,2) + color.slice(1,2) +
                    color.slice(2) + color.slice(2); }
        if(color.length !== 6) {
            alert("Not a valid html color code.");
            return; }
        cvals = colorToColorArray(color);
        for(i = 0; i < cvals.length; i += 1) {
            if(typeof cvals[i] !== "number" ||
               cvals[i] < 0 || cvals[i] > 255) {
                alert("Not a valid html color code.");
                return; } }
        color = colorArrayToColor(cvals);
        mor.colors[colorfield] = color;
        mor.byId(domid).value = color;
        updateColors();
    },


    colorControl = function (domid, colorfield) {
        var node = mor.y.one("#" + domid);
        node.on("change", function (e) {
                var color = mor.byId(domid).value;
                e.preventDefault();
                e.stopPropagation();
                safeSetColor(colorfield, domid, color);
                updateColors(); });
        node.on("keypress", function (e) {
                var outval = e.keyCode;
                switch(e.keyCode) {
                case 82:  //R - increase Red
                    outval = colorAdjust(colorfield, 0, 1); break;
                case 114: //r - decrease Red
                    outval = colorAdjust(colorfield, 0, -1); break;
                case 71:  //G - increase Green
                    outval = colorAdjust(colorfield, 1, 1); break;
                case 103: //g - decrease Green
                    outval = colorAdjust(colorfield, 1, -1); break;
                case 85:  //U - increase Blue
                    outval = colorAdjust(colorfield, 2, 1); break;
                case 117: //u - decrease Blue
                    outval = colorAdjust(colorfield, 2, -1); break;
                }
                if(typeof outval === "string") {
                    e.preventDefault();
                    e.stopPropagation();
                    mor.colors[colorfield] = outval;
                    mor.byId(domid).value = outval;
                    updateColors(); } });
    },


    displayDialog = function () {
        var html, div;
        oldcolors = copycolors(mor.colors);
        html = "<p id=\"directions\">" + 
            "R/r, G/g, U/u to adjust Red/Green/Blue...</p>" +
        "<table>" +
          "<tr>" +
            "<td align=\"right\">background</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"bgbodyin\" size=\"7\"" + 
                    " value=\"" + mor.colors.bodybg + "\"/>" + 
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">text</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"textcolin\" size=\"7\"" + 
                    " value=\"" + mor.colors.text + "\"/>" + 
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\">" + 
              "<button type=\"button\" id=\"skincancel\">Cancel</button>" +
              "<button type=\"button\" id=\"skinok\">Ok</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out(html, 'dlgdiv');
        div = mor.byId('dlgdiv');
        div.style.visibility = "visible";
        mor.click('skincancel', dialogCancel);
        mor.click('skinok', dialogOk);
        colorControl("bgbodyin", "bodybg");
        colorControl("textcolin", "text");
    },


    createSkinnerLink = function () {
        var html;
        html = "<a href=\"skinit.html\" id=\"skinit\">skin it</a>";
        mor.out(html, 'topdiv');
        mor.click('skinit', displayDialog);
    };


    mor.skinner = {
        init: function () {
            createSkinnerLink(); }
    };

} () );

