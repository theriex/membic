/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . s k i n n e r 
//
define([], function () {
    "use strict";

    var oldcolors,
        colorwidget,
        colorctrl,
        colorctrls = [ { id: "bodybg",  label: "background" },
                       { id: "darkbg",  label: "shadow" },
                       { id: "lightbg", label: "text area" },
                       { id: "text",    label: "text" },
                       { id: "link",    label: "link" },
                       { id: "hover",   label: "hover" } ],
        //Blue links are most recognizable, but they are not at all fun.
        //If changing the first (default) skin, change mor.css to match,
        //and verify statrev ads are compatible.
        presets = [ { name: "paper (warm)",   id: "paperw", 
                       bodybg: "#fffffc",   text: "#111111",
                      lightbg: "#fffffe", darkbg: "#9b9b9a",
                         link: "#521919",  hover: "#885555" },
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


    presetSelectorHTML = function (pen) {
        var html, i, pid;
        html = "<table>" +
          "<tr>" + 
            "<td align=\"right\">Display</td>" +
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


    swatchClick = function (index) {
        var currcolor, subtext;
        subtext = " <span class=\"smalltext\">" + 
            "(click only, drag disabled)</span>";
        if(!index) {
            index = 0; }
        if(typeof index === "string") {
            index = parseInt(index, 10); }
        colorctrl = colorctrls[index];
        mor.out('colortitlediv', colorctrl.label + subtext);
        currcolor = mor.colors[colorctrl.id];
        //this is how you are "supposed" to set the value but it doesn't work:
        //colorwidget.set('value', currcolor);
        //this sets the hex value field but the display doesn't update:
        //mor.byId('colorwidgetdiv').value = currcolor;
        //found this and it seems to work:
        colorwidget.setColor(currcolor, true);
    },


    createColorControls = function (Colorwidget) {
        var i, clabel, cid, html;
        html = "<table border=\"0\">";
        for(i = 0; i < colorctrls.length; i += 1) {
            clabel = colorctrls[i].label;
            cid = colorctrls[i].id;
            html += "<tr>" + 
                "<td class=\"colorattrtd\">" + clabel + "</td>" +
                "<td><div id=\"" + cid + "div\"" +
                        " class=\"colorswatch\"" + 
                        " onclick=\"mor.skinner.swatchClick('" + i + "');" +
                                   "return false;\"" +
                        " style=\"background:" + mor.colors[cid] + ";\"" +
                "></div>";
            if(i === 0) {
                html += "<td rowspan=\"" + colorctrls.length + "\"" + 
                           " valign=\"top\">" + 
                    "<div id=\"colortitlediv\"></div>" +
                    "<div id=\"colorwidgetdiv\"></div></td>"; }
            html += "</tr>"; }
        html += "</table>";
        mor.out('colorctrlsdiv', html);
        colorwidget = new Colorwidget(
            { onChange: function (val) {
                mor.byId(colorctrl.id + "div").style.backgroundColor = val;
                mor.colors[colorctrl.id] = val;
                updateColors(); } }, 'colorwidgetdiv');
        swatchClick(0);
    },


    toggleControls = function () {
        var txt, rules, html;
        txt = mor.byId('skinctrltoggle').innerHTML;
        if(txt === "show color controls") {
            rules = document.styleSheets[0].cssRules;
            if(rules && rules[0].style.setProperty) {
                mor.byId('colorctrlsdiv').style.display = "block";
                mor.out('skinctrltoggle', "hide color controls");
                html = mor.byId('colorctrlsdiv').innerHTML;
                if(!html) {  //not initialized yet
                    require(mor.cdnconf,
                            [ "dojox/widget/ColorPicker", "dojo/domReady!" ],
                            function (colorwidget) {
                                createColorControls(colorwidget); }); } }
            else {  //no support, display as disabled
                mor.byId('skinctrltoggle').style.color = "#666666"; } }
        else {
            mor.byId('colorctrlsdiv').style.display = "none";
            mor.out('skinctrltoggle', "show color controls"); }
    },


   setControlValuesAndUpdate = function (colors) {
       var html, i, div;
       mor.colors = copycolors(colors);
       updateColors();
       html = mor.byId('colorctrlsdiv').innerHTML;
       if(html) {  //color controls available
           for(i = 0; i < colorctrls.length; i += 1) {
               div = mor.byId(colorctrls[i].id + "div");
               div.style.backgroundColor = mor.colors[colorctrls[i].id]; }
           swatchClick(0); }
   },


    setColorsFromPreset = function (pen) {
        var i, sel = mor.byId('presetsel');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                pen.settings.colorPresetId = presets[i].id;
                setControlValuesAndUpdate(presets[i]);
                break; } }
    },


    displayDialog = function (domid, pen) {
        var html;
        oldcolors = copycolors(mor.colors);
        html = presetSelectorHTML(pen) + 
            //color controls are high overhead and initialized only when needed.
            "<div id=\"colorctrlsdiv\" style=\"display:none;\"></div>";
        mor.out(domid, html);
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
            toggleControls(); },
        swatchClick: function (index) {
            swatchClick(index); }
    };

});

