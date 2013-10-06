/*global document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.skinner = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var oldcolors,
        cancelpen,
        colorctrls = [ { id: "bodybg",  label: "background" },
                       { id: "darkbg",  label: "shadow" },
                       { id: "lightbg", label: "text area" },
                       { id: "text",    label: "text" },
                       { id: "link",    label: "link" },
                       { id: "hover",   label: "hover" } ],
        //Blue links are most recognizable, but they are not at all fun.
        //If changing the first (default) skin, change site.css to match,
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


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    copycolors = function (colors) {
        var cc = { name: colors.name,
                   id: colors.id,
                   bodybg: colors.bodybg,
                   text: colors.text,
                   lightbg: colors.lightbg,
                   darkbg: colors.darkbg,
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
        if(!app.colors.lightbg) {
            app.colors.lightbg = adjustColor(app.colors.bodybg, 4); }
        return app.colors.lightbg;
    },


    getDarkBackground = function () {
        //with no texture overlay, -18 is about right, with a 66% opaque 
        //texture overlay this needs to be pretty significant
        if(!app.colors.darkbg) {
            app.colors.darkbg = adjustColor(app.colors.bodybg, -56); }
        return app.colors.darkbg;
    },


    updateColors = function () {
        var rules, i, elem, val, tabs = [ "recentli", "bestli", "followingli", 
                                          "followersli", "searchli" ];
        elem = jt.byId('bodyid');
        if(elem) {
            elem.style.color = app.colors.text;
            elem.style.backgroundColor = app.colors.bodybg; }
        elem = jt.byId('topsectiondiv');
        if(elem) {
            elem.style.backgroundColor = getLightBackground();
            val = "8px 8px 4px " + getDarkBackground();
            elem.style.boxShadow = val; }
        elem = jt.byId('shoutdiv');
        if(elem) {
            elem.style.backgroundColor = getLightBackground(); }
        for(i = 0; i < tabs.length; i += 1) {
            elem = jt.byId(tabs[i]);
            if(elem && elem.className === "unselectedTab") {
                elem.style.backgroundColor = getDarkBackground(); } }
        rules = document.styleSheets[0].cssRules;
        for(i = 0; rules && i < rules.length; i += 1) {
            if(jt.prefixed(rules[i].cssText, "A:link")) {
                safeSetColorProp(rules[i], app.colors.link); }
            else if(jt.prefixed(rules[i].cssText, "A:visited")) {
                safeSetColorProp(rules[i], app.colors.link); }
            else if(jt.prefixed(rules[i].cssText, "A:active")) {
                safeSetColorProp(rules[i], app.colors.link); }
            else if(jt.prefixed(rules[i].cssText, "A:hover")) {
                safeSetColorProp(rules[i], app.colors.hover); } }
    },


    presetSelectorHTML = function (pen) {
        var i, pid, sel, options = [], html;
        for(i = 0; i < presets.length; i += 1) {
            pid = presets[i].id;
            sel = pen && pen.settings && pen.settings.colorPresetId === pid;
            options.push(["option", {id: pid, 
                                     selected: jt.toru(sel, "selected")},
                          presets[i].name]); }
        html = ["table",
                ["tr",
                 [["td", {align: "right"}, "Display"],
                  ["td", {align: "left"},
                   ["select", {id: "presetsel"}, options]],
                  ["td",
                   ["&nbsp;&nbsp;",
                    ["a", {href: "#toggleSkinControls", id: "skinctrltoggle",
                           cla: "permalink",
                           onclick: jt.fs("app.skinner.toggleControls()")},
                     "show color controls"]]]]]];
        return jt.tac2html(html);
    },


    //This relies on html5 color input support, which at the time of
    //this writing was only available on Chrome and Opera.  If you
    //actually want to work with palettes, it might be best to use one
    //of those browsers.  May do a polyfill later, but detection of an
    //available native colorpicker is non-trivial.  Firefox dutifully
    //reports type as "color" even though it has no colorpicker.
    createColorControls = function () {
        var i, cid, rows = [];
        for(i = 0; i < colorctrls.length; i += 1) {
            cid = colorctrls[i].id;
            rows.push(
                ["tr",
                 [["td", {cla: "colorattrtd"}, 
                   colorctrls[i].label],
                  ["td", 
                   ["input", {type: "color", id: cid,
                              value: app.colors[cid],
                              onchange: jt.fs("app.skinner.onColorChange(" + 
                                              "'" + cid + "')")}]]]]); }
        jt.out('colorctrlsdiv', jt.tac2html(["table", rows]));
    },


   setControlValuesAndUpdate = function (colors) {
       var html, i, colorinput;
       app.colors = copycolors(colors);
       updateColors();
       html = jt.byId('colorctrlsdiv').innerHTML;
       if(html) {  //color controls available
           for(i = 0; i < colorctrls.length; i += 1) {
               colorinput = jt.byId(colorctrls[i].id);
               if(colorinput) {
                   colorinput.value = app.colors[colorctrls[i].id]; } } }
   },


    setColorsFromPreset = function (pen) {
        var i, sel = jt.byId('presetsel');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                cancelpen = pen;
                pen.settings.colorPresetId = presets[i].id;
                setControlValuesAndUpdate(presets[i]);
                break; } }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function (domid, pen) {
        var html;
        oldcolors = copycolors(app.colors);
        html = [presetSelectorHTML(pen),
                //high overhead color controls initialized only when needed.
                ["div", {id: "colorctrlsdiv", style: "display:none;"}]];
        jt.out(domid, jt.tac2html(html));
        jt.on('presetsel', 'change', function (e) {
            jt.evtend(e);
            app.pen.getPen(setColorsFromPreset); });
    },


    cancel: function () {
        if(oldcolors) {  //if spurious cancel call oldcolors may be undefined
            app.colors = oldcolors; }
        if(cancelpen && cancelpen.settings && 
           cancelpen.settings.colorPresetId) {
            cancelpen.settings.colorPresetId = oldcolors.id; }
        updateColors();
    },


    save: function (pen) {
        pen.settings.colors = copycolors(app.colors);
    },


    setColorsFromPen: function (pen) {
        if(!pen) {  //use default colors
            app.colors = presets[0]; }
        else { //have pen
            if(!pen.settings) {  //use default colors
                app.colors = presets[0]; }
            else { //have settings
                if(typeof pen.settings === 'string') {
                    app.pen.deserializeFields(pen); }
                if(!pen.settings.colors) {  //use default colors
                    app.colors = presets[0]; }
                else { //have colors
                    app.colors = copycolors(pen.settings.colors); } } }
        updateColors();
    },


    lightbg: function () {
        return getLightBackground();
    },


    darkbg: function () {
        return getDarkBackground();
    },


    toggleControls: function () {
        var txt, rules, html;
        txt = jt.byId('skinctrltoggle').innerHTML;
        if(txt === "show color controls") {
            rules = document.styleSheets[0].cssRules;
            if(rules && rules[0].style.setProperty) {
                jt.byId('colorctrlsdiv').style.display = "block";
                jt.out('skinctrltoggle', "hide color controls");
                html = jt.byId('colorctrlsdiv').innerHTML;
                if(!html) {  //not initialized yet
                    createColorControls(); } }
            else {  //no support, display as disabled
                jt.byId('skinctrltoggle').style.color = "#666666"; } }
        else {
            jt.byId('colorctrlsdiv').style.display = "none";
            jt.out('skinctrltoggle', "show color controls"); }
    },


    onColorChange: function (cid) {
        app.colors[cid] = jt.byId(cid).value;
        updateColors();
    }


};  //end of returned functions
}());

