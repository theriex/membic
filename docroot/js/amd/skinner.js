/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . s k i n n e r 
//
define([], function () {
    "use strict";

    var oldcolors,
        colorcontrols,
        //Blue links are the most recognizable, they are not fun.
        presets = [ { name: "paper (warm)",   id: "paperw", 
                       bodybg: "#fffffc",   text: "#111111",
                      lightbg: "#fffffe", darkbg: "#9b9b9a",
                         link: "#441111",  hover: "#885555" },
                    { name: "paper (cool)",   id: "paperc",
                       bodybg: "#f8f8f8",   text: "#111111",
                      lightbg: "#fcfcfc", darkbg: "#a2a2a2",
                         link: "#006666",  hover: "#339999" },
                    { name: "slate",          id: "slate",
                       bodybg: "#ccdad9",   text: "#111111",
                      lightbg: "#d0deda", darkbg: "#72817f",
                         link: "#003300",  hover: "#447744" },
                    { name: "parchment",      id: "parchment",
                       bodybg: "#dfb374",   text: "#111111",
                      lightbg: "#ffefaf", darkbg: "#997335",
                         link: "#333300",  hover: "#666633" } ],


    copycolors = function (colors) {
        var cc = { bodybg: colors.bodybg,
                   lightbg: colors.lightbg,
                   darkbg: colors.darkbg,
                   text: colors.text,
                   link: colors.link,
                   hover: colors.hover };
        return cc;
    },


    safeSetColorProp = function (rule, color) {
        if(rule.style.setProperty) {
            rule.style.setProperty('color', color, null); }
    },


    colorToColorArray = function (color) {
        var cvals;
        if(color.indexOf("#") >= 0) {
            color = color.slice(1); }
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


    cvalAdjust = function (cvals, index, bump) {
        cvals[index] += bump;
        if(cvals[index] > 255) { cvals[index] = 255; }
        if(cvals[index] < 0) { cvals[index] = 0; }
    },


    adjustColor = function (color, adj) {
        var cvals;
        cvals = colorToColorArray(color);
        cvalAdjust(cvals, 0, adj);
        cvalAdjust(cvals, 1, adj);
        cvalAdjust(cvals, 2, adj);
        color = colorArrayToColor(cvals);
        return color;
    },


    getLightBackground = function () {
        if(!mor.colors.lightbg) {
            mor.colors.lightbg = adjustColor(mor.colors.bodybg, 4); }
        return mor.colors.lightbg;
    },


    getDarkBackground = function () {
        //with no texture overlay, -18 is about right, with a 66% opaque 
        //texture overlay this needs to be pretty significant
        if(!mor.colors.darkbg) {
            mor.colors.darkbg = adjustColor(mor.colors.bodybg, -56); }
        return mor.colors.darkbg;
    },


    updateColors = function () {
        var rules, i, elem, val, tabs = [ "recentli", "bestli", "followingli", 
                                          "followersli", "searchli" ];
        elem = mor.byId('bodyid');
        if(elem) {
            elem.style.color = mor.colors.text;
            elem.style.backgroundColor = mor.colors.bodybg; }
        elem = mor.byId('topsectiondiv');
        if(elem) {
            elem.style.backgroundColor = getLightBackground();
            val = "8px 8px 4px " + getDarkBackground();
            elem.style.boxShadow = val; }
        elem = mor.byId('shoutdiv');
        if(elem) {
            elem.style.backgroundColor = getLightBackground(); }
        for(i = 0; i < tabs.length; i += 1) {
            elem = mor.byId(tabs[i]);
            if(elem && elem.className === "unselectedTab") {
                elem.style.backgroundColor = getDarkBackground(); } }
        rules = document.styleSheets[0].cssRules;
        for(i = 0; rules && i < rules.length; i += 1) {
            if(mor.prefixed(rules[i].cssText, "A:link")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:visited")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:active")) {
                safeSetColorProp(rules[i], mor.colors.link); }
            else if(mor.prefixed(rules[i].cssText, "A:hover")) {
                safeSetColorProp(rules[i], mor.colors.hover); } }
    },


    cancelSkinChange = function () {
        mor.colors = oldcolors;
        updateColors();
    },


    saveSkinChangeSettings = function (pen) {
        pen.settings.colors = copycolors(mor.colors);
    },


    setColorsFromPen = function (pen) {
        if(!pen) {  //use default colors
            mor.colors = presets[0]; }
        else { //have pen
            if(!pen.settings) {  //use default colors
                mor.colors = presets[0]; }
            else { //have settings
                if(typeof pen.settings === 'string') {
                    mor.pen.deserializeFields(pen); }
                if(!pen.settings.colors) {  //use default colors
                    mor.colors = presets[0]; }
                else { //have colors
                    mor.colors = copycolors(pen.settings.colors); } } }
        updateColors();
    },


    colorBump = function (colorfield, index, bump) {
        var color = mor.colors[colorfield], cvals;
        cvals = colorToColorArray(color);
        cvalAdjust(cvals, index, bump);
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
        mor.onx("change", domid, function (e) {
            var color = mor.byId(domid).value;
            e.preventDefault();
            e.stopPropagation();
            safeSetColor(colorfield, domid, color);
            updateColors(); });
        mor.onx("keypress", domid, function (e) {
            var outval = e.charCode;
            switch(e.charCode) {
            case 82:  //R - increase Red
                outval = colorBump(colorfield, 0, 1); break;
            case 114: //r - decrease Red
                outval = colorBump(colorfield, 0, -1); break;
            case 71:  //G - increase Green
                outval = colorBump(colorfield, 1, 1); break;
            case 103: //g - decrease Green
                outval = colorBump(colorfield, 1, -1); break;
            case 85:  //U - increase Blue
                outval = colorBump(colorfield, 2, 1); break;
            case 117: //u - decrease Blue
                outval = colorBump(colorfield, 2, -1); break;
            }
            if(typeof outval === "string") {
                e.preventDefault();
                e.stopPropagation();
                mor.colors[colorfield] = outval;
                mor.byId(domid).value = outval;
                updateColors(); } });
        colorcontrols.push([domid, colorfield]);
    },


   setControlValuesAndUpdate = function (colors) {
       var i, input;
       for(i = 0; i < colorcontrols.length; i += 1) {
           input = mor.byId(colorcontrols[i][0]);
           input.value = colors[colorcontrols[i][1]]; }
       mor.colors = copycolors(colors);
       updateColors();
   },


    setColorsFromPreset = function (pen) {
        var i, sel = mor.byId('presetsel');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                pen.settings.colorPresetId = presets[i].id;
                setControlValuesAndUpdate(presets[i]);
                break; } }
    },


    toggleControls = function () {
        var txt = mor.byId('skinctrltoggle').innerHTML;
        if(txt === "show color controls") {
            mor.byId('colorctrlsdiv').style.display = "block";
            mor.out('skinctrltoggle', "hide color controls"); }
        else {
            mor.byId('colorctrlsdiv').style.display = "none";
            mor.out('skinctrltoggle', "show color controls"); }
    },


    presetSelectorHTML = function (pen) {
        var html, i, pid;
        html = "<table>" +
          "<tr>" + 
            "<td align=\"right\">Theme</td>" +
            "<td align=\"left\">" +
                "<select id=\"presetsel\">";
        for(i = 0; i < presets.length; i += 1) {
            pid = presets[i].id;
            html += "<option id=\"" + pid + "\"";
            if(pen && pen.settings && pen.settings.colorPresetId === pid) {
                html += " selected=\"selected\""; }
            html += ">" + 
                presets[i].name + "</option>"; }
        html += "</select></td>" +
            "<td>&nbsp;&nbsp;" + 
                "<a href=\"#toggleSkinControls\" id=\"skinctrltoggle\"" +
                  " class=\"permalink\"" + 
                  " onclick=\"mor.skinner.toggleControls();return false;\"" +
            ">show color controls</a></td>" +
          "</tr>" +
        "</table>";
        return html;
    },


    colorControlsHTML = function () {
        var link = "", hover = "", html, rules;
        rules = document.styleSheets[0].cssRules;
        if(rules && rules[0].style.setProperty) {
            link = "</td>" +
            "<td align=\"right\">link</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"linkin\" size=\"7\"" + 
                    " value=\"" + mor.colors.link + "\"/>" + 
                "</td>";
            hover = "</td>" +
            "<td align=\"right\">hover</td>" +
            "<td align=\"left\">" + 
              "<input type=\"text\" id=\"hoverin\" size=\"7\"" + 
                    " value=\"" + mor.colors.hover + "\"/>" + 
                "</td>"; }
        html = "<div id=\"colorctrlsdiv\" style=\"display:none;\">" +
            "<span class=\"smalltext\">" + 
              "R/r, G/g, U/u to adjust Red/Green/Blue...</span>" +
            "<table>" +
              "<tr>" +
                "<td align=\"right\">background</td>" +
                "<td align=\"left\">" + 
                  "<input type=\"text\" id=\"bgbodyin\" size=\"7\"" + 
                        " value=\"" + mor.colors.bodybg + "\"/></td>" + 
                link + 
              "</tr>" +
              "<tr>" +
                "<td align=\"right\">text</td>" +
                "<td align=\"left\">" + 
                  "<input type=\"text\" id=\"textcolin\" size=\"7\"" + 
                        " value=\"" + mor.colors.text + "\"/></td>" + 
                hover +
              "</tr>" +
            "</table></div>";
        return html;
    },


    displayDialog = function (domid, pen) {
        var html, rules;
        oldcolors = copycolors(mor.colors);
        colorcontrols = [];
        html = presetSelectorHTML(pen) + colorControlsHTML();
        mor.out(domid, html);
        colorControl("bgbodyin", "bodybg");
        colorControl("textcolin", "text");
        rules = document.styleSheets[0].cssRules;
        if(rules && rules[0].style.setProperty) {
            colorControl("linkin", "link");
            colorControl("hoverin", "hover"); }
        mor.onx('change', 'presetsel', function (e) {
            e.preventDefault();
            e.stopPropagation();
            mor.pen.getPen(setColorsFromPreset); });
    };


    return {
        init: function (domid, pen) {
            displayDialog(domid, pen); },
        cancel: function () {
            cancelSkinChange(); },
        save: function (pen) {
            saveSkinChangeSettings(pen); },
        setColorsFromPen: function (pen) {
            setColorsFromPen(pen); },
        lightbg: function () {
            return getLightBackground(); },
        darkbg: function () {
            return getDarkBackground(); },
        toggleControls: function () {
            toggleControls(); }
    };

});

