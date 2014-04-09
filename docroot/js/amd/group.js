/*global alert: false, setTimeout: false, document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.group = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    //avoiding having any state variables to reset..
    var wizgrp = null,  //holds state until user cleared or written to db
        verifyCityNextFunc = null, //dialog callback 
        revfreqs = [{name: "2 Weeks", freq: 14, id: "freq14"},
                    {name: "Monthly", freq: 30, id: "freq30"},
                    {name: "2 Months", freq: 60, id: "freq60"},
                    {name: "3 Months", freq: 90, id: "freq90"},
                    {name: "6 Months", freq: 180, id: "freq180"},
                    {name: "Yearly", freq: 365, id: "freq365"}],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    deserializeAndLoadGroups = function (pen) {
        var i, groupref;
        pen.groups = pen.groups || [];
        if(typeof pen.pen.groups === "string") {
            pen.groups = pen.groups.split(","); }
        for(i = 0; i < pen.groups.length; i += 1) {
            if(typeof pen.groups[i] === "string") {
                groupref = app.lcs.getGroupRef(pen.groups[i]);
                if(groupref.group) {
                    pen.groups[i] = groupref.group; }
                else {
                    app.lcs.getGroupFull(pen.groups[i],
                                         deserializeAndLoadGroups);
                    return; } } }
        return pen.groups;
    },


    displayGroup = function () {
        jt.err("displayGroup not implemented yet");
    },


    cityValSelectHTML = function (cityvals) {
        var html, i;
        if(cityvals.length > 1) {
            html = [];
            for(i = 0; i < cityvals.length; i += 1) {
                html.push(["li",
                           [jt.radiobutton("citysel", "citysel" + i), i === 0,
                            "app.group.profCityCB('" + cityvals[i].trim() + 
                                                 "')"]]); }
            html = ["ul", {cla: "revlist"},
                    html]; }
        else {
            html = cityvals[0].trim(); }
        html = [["input", {type: "hidden", name: "hcityin", id: "hcityin",
                           value: cityvals[0].trim()}],
                html];
        return html;
    },


    niceCSV = function (csv) {
        var nice = "", elems, i;
        elems = csv.split(",");
        for(i = 0; i < elems.length; i += 1) {
            if(nice) {
                nice += ", "; }
            nice += elems[i].capitalize(); }
        return nice;
    },


    fieldTableRow = function (obj, fname, fdef) {
        var tds = [], opts = [], attrs, i, html = "";
        switch(fdef.type) {
        case "text":
            tds.push(["td", {cla: "tdnowrap"},
                      ["span", {cla: "secondaryfield"},
                       fname.capitalize()]]);
            if(fdef.edit) {
                tds.push(["td",
                          ["input", {type: "text", id: fname + "in",
                                     size: 25, value: obj[fname],
                                     onchange: fdef.onchange || ""}]]); }
            else {
                tds.push(["td", {cla: "tdwide"},
                          ["span", {cla: fdef.valclass || ""},
                           obj[fname]]]); }
            html = ["tr", tds];
            break;
        case "textarea":
            if(fdef.edit) {
                html = ["tr",
                        ["td", {colspan: 2},
                         [["div", {cla: "secondaryfield"},
                           fname.capitalize()],
                          ["textarea", {id: fname + "in",
                                        cla: "groupdescrtxt",
                                        style: "height:100px;"},
                           obj[fname] || ""]]]]; }
            else {
                html = ["tr",
                        ["td", {colspan: 2},
                         ["div", {cla: "groupdescrtxt", 
                                  style: "padding-left:10px;"},
                          obj[fname]]]]; }
            break;
        case "revtypesel":
            if(fdef.edit) {
                html = ["tr",
                        ["td", {colspan: 2},
                         [["div", {cla: "secondaryfield"},
                           fdef.printName || fname.capitalize()],
                          app.review.reviewTypeCheckboxesHTML(
                              "revtypesel")]]]; }
            else {
                html = ["tr",
                        [["td", {cla: "tdnowrap"},
                          ["span", {cla: "secondaryfield"},
                           fdef.printName || fname.capitalize()]],
                         ["td", {cla: "tdwide"},
                          ["span", {cla: fdef.valclass || ""},
                           niceCSV(obj[fname])]]]]; }
            break;
        case "frequency":
            tds.push(["td", {cla: "tdnowrap"},
                      ["span", {cla: "secondaryfield"},
                       fdef.printName || fname.capitalize()]]);
            if(fdef.edit) {
                for(i = 0; i < revfreqs.length; i += 1) {
                    attrs = {id: revfreqs[i].id};
                    if(obj[fname] === revfreqs[i].freq || 
                       (!obj[fname] && i === 1)) {
                        attrs.selected = "selected"; }
                    opts.push(["option", attrs, revfreqs[i].name]); }
                tds.push(["td", {cla: "tdwide"},
                          ["select", {id: fname + "sel"},
                           opts]]); }
            else {
                for(i = 0; i < revfreqs.length; i += 1) {
                    if(obj[fname] === revfreqs[i].freq ||
                       (!obj[fname] && i === 1)) {
                        tds.push(["td", {cla: "tdwide"},
                                  revfreqs[i].name]);
                        break; } } }
            html = ["tr", tds];
            break;
        default:
            jt.log("Unknown fieldTableRow type " + fdef.type); }
        return html;
    },


    fieldTableHTML = function (obj, fields, descrip) {
        var field, rows = [], html, described = false;
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit && !described) {
                    rows.push(["tr",
                               ["td", {colspan: 2},
                                descrip]]);
                    described = true; }
                rows.push(fieldTableRow(obj, field, fields[field])); } }
        if(!described) {
            rows.push(["tr",
                       ["td", {colspan: 2},
                        descrip]]); }
        html = ["table", {cla: "grpwiztable"},
                rows];
        return html;
    },


    buttonsHTML = function (buttons) {
        var i, html = [];
        for(i = 0; i < buttons.length; i += 1) {
            html.push(["button", {type: "button", 
                                  id: jt.canonize(buttons[i].name),
                                  onclick: jt.fs(buttons[i].fstr)},
                       buttons[i].name]); }
        html = ["div", {id: "primgroupbuttonsdiv"},
                html];
        return html;
    },


    adjustWidthsAndSetFocus = function (fields) {
        var field, elem, divpos;
        divpos = jt.geoPos(jt.byId("primgroupdlgdiv"));
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit && fields[field].type === "textarea") {
                    elem = jt.byId(field + "in");
                    elem.style.width = String(divpos.w - 40) + "px"; } } }
        for(field in fields) {
            if(fields.hasOwnProperty(field)) {
                if(fields[field].edit) {
                    elem = jt.byId(field + "in");
                    if(elem) {
                        elem.focus();
                        break; } } } }
    },


    showDialog = function (heading, descrip, obj, fields, buttons) {
        var fieldtable, buttonsdiv, html;
        fieldtable = fieldTableHTML(obj, fields, descrip);
        buttonsdiv = buttonsHTML(buttons);
        html = ["div", {id: "primgroupdlgdiv"},
                [fieldtable,
                 ["div", {id: "errmsgdiv"}, ""],
                 buttonsdiv]];
        html = app.layout.dlgwrapHTML(heading, html);
        app.layout.openDialog({y:140}, html, null,
                              function () {
                                  adjustWidthsAndSetFocus(fields); });
    },


    founderNoticeAndDisplay = function () {
        var heading, descrip;
        if(jt.instId(wizgrp)) {
            return displayGroup(); }
        heading = "Create Group: Founder Privileges";
        descrip = ["p",
                   "As the founder of " + wizgrp.name + ", you are authorized to accept or remove other members. You may also make changes to any part of the group description."];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: false, 
                               printName: "Review Types"},
                    revfreq: {type: "frequency", edit: false,
                              printName: "Review Frequency"}},
                   [{name: "Back", fstr: "app.group.promptForReviewFreq()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "Create Group", fstr: "app.group.saveGroup()"}]);
    },


    promptForPrimaryFields = function () {
        if(!wizgrp.name) {
            app.group.promptForName(); return; }
        if(!wizgrp.city && !wizgrp.cityunspecified) {
            app.group.promptForCity(); return; }
        if(!app.group.verifyGroupCityAndProfileMatch(wizgrp,
                                                     app.group.createGroup)) {
            return; }  //let the dialog do its work
        if(!wizgrp.description) {
            app.group.promptForDescription(); return; }
        if(!wizgrp.revtypes) {
            app.group.promptForReviewTypes(); return; }
        if(!wizgrp.revfreq) {
            app.group.promptForReviewFreq(); return; }
        founderNoticeAndDisplay();
    },


    readPrimaryFields = function () {
        var input, fields, i, cboxes, j, opts;
        fields = [{name: "name", required: true},
                  {name: "city", required: false},
                  {name: "description", required: true},
                  {name: "revtypes", required: true},
                  {name: "revfreq", required: true}];
        for(i = 0; i < fields.length; i += 1) {
            if(fields[i].name === "revtypes") {
                cboxes = document.getElementsByName("revtypesel");
                if(cboxes.length > 0) {
                    wizgrp.revtypes = "";
                    for(j = 0; j < cboxes.length; j += 1) {
                        if(cboxes[j].checked) {
                            if(wizgrp.revtypes) {
                                wizgrp.revtypes += ","; }
                            wizgrp.revtypes += cboxes[j].value; } }
                    if(!wizgrp.revtypes) {
                        jt.out('errmsgdiv', 
                               "At least one review type must be selected.");
                        return false; } } }
            else if(fields[i].name === "revfreq") {
                input = jt.byId("revfreqsel");
                if(input) {
                    opts = input.options;
                    for(i = 0; i < opts.length; i += 1) {
                        if(opts[i].selected) {
                            for(j = 0; j < revfreqs.length; j += 1) {
                                if(opts[i].id === revfreqs[j].id) {
                                    wizgrp.revfreq = revfreqs[j].freq;
                                    break; } } } } } }
            else {
                input = jt.byId(fields[i].name + "in");
                if(input) {
                    input = input.value;
                    if(fields[i].required && !input) {
                        jt.out('errmsgdiv', "A " + fields[i].name + 
                               " is required.");
                        return false; }
                    wizgrp[fields[i].name] = input; } } }
        return true;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    loadOutboundGroups: function () {
        var penref = app.pen.currPenRef();
        if(!penref || !penref.pen) {
            setTimeout(function () {
                jt.log("deserializeAndLoadGroups, no currPenRef yet...");
                app.pen.getPen(app.group.loadOutboundGroups); }, 100);
            return; }
        app.group.loadGroupsForPen(penref.pen);
    },


    loadGroupsForPen: function (pen, callback) {
        var groups = deserializeAndLoadGroups(pen);
        if(!groups) {
            setTimeout(function () {
                app.group.loadGroupsForPen(pen, callback); }, 200);
            return; }
        callback(pen);
    },


    promptForCity: function () {
        var heading, descrip;
        heading = "Create Group: City";
        wizgrp.cityunspecified = false;  //reset if called via back button
        descrip = ["p",
                   "If " + wizgrp.name + " will be reviewing local food, drinks, activities or other things involving physical venues in your area, then you should specify a city. Providing a city makes the group more attractive for local folks, and allows other people an opportunity to set up sister groups in other cities. Multiple cities can be separated by commas. You can also specify a region or country if appropriate. Where is this group based?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: true,
                           onchange: "app.group.createGroup()"}},
                   [{name: "Back", fstr: "app.group.promptForName()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.noteCity()"}]);
    },


    noteCity: function () {
        var city;
        city = jt.byId('cityin');
        if(city) {
            city = city.value;
            if(!city) {
                wizgrp.cityunspecified = true; } }
        app.group.createGroup();
    },


    promptForName: function () {
        var heading, descrip;
        heading = "Create Group: Name";
        descrip = ["p",
                   "Please choose a name for your group:"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: true, valclass: "grpnameval",
                           onchange: "app.group.createGroup()"}},
                   [{name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },
                   
    //This method is used by group setup and new membership
    verifyGroupCityAndProfileMatch: function (group, callback) {
        var city, penc, i, j, backb, html;
        verifyCityNextFunc = callback;
        city = group.city;
        if(!city) {
            return true; }  //nothing to check against
        if(city.indexOf(",") >= 0) {
            city = city.split(","); }
        else {
            city = [ city ]; }
        penc = app.pen.currPenRef().pen.city;
        if(penc) {
            if(penc.indexOf(",") >= 0) {
                penc = penc.split(","); }
            else {
                penc = [ penc ]; } }
        penc = penc || [];
        for(i = 0; i < city.length; i += 1) {
            for(j = 0; j < penc.length; j += 1) {
                if(jt.canonize(city[i]) === jt.canonize(penc[j])) {
                    return true; } } }  //have matching city
        backb = "";
        if(group === wizgrp) {
            backb = ["button", {type: "button", id: "backbutton",
                                onclick: jt.fs("app.group.promptForCity()")},
                     "Back"]; }
        html = ["div", {cla: "primgroupdlgdiv"},
                [["p",
                  "Your profile location does not match the group."],
                 ["table", {cla: "grpwiztable"},
                  ["tr",
                   [["td", "Add"],
                    ["td", cityValSelectHTML(city)],
                    ["td", "to your profile?"]]]],
                 ["div", {id: "errmsgdiv"}, ""],
                 ["div", {id: "primgroupbuttonsdiv"},
                  [backb,
                   ["button", {type: "button", id: "cancelbutton",
                               onclick: jt.fs("app.layout.closeDialog()")},
                    "Cancel"],
                   ["button", {type: "button", id: "okbutton",
                               onclick: jt.fs("app.group.setPenCity()")},
                    "OK"]]]]];
        html = app.layout.dlgwrapHTML(group.name + " City", html, null,
                                      function () {
                                          jt.byId('okbutton').focus(); });
        app.layout.openDialog({y:140}, html);
    },


    profCityCB: function (cityval) {
        jt.byId('hcityin').value = cityval;
    },


    setPenCity: function () {
        var pen, city;
        city = jt.byId('hcityin').value;
        pen = app.pen.currPenRef().pen;
        pen.city = pen.city || "";
        if(pen.city) {
            pen.city += ", "; }
        pen.city += city;
        app.pen.updatePen(pen, verifyCityNextFunc, app.failf);
    },


    promptForDescription: function () {
        var heading, descrip;
        heading = "Create Group: Description";
        descrip = ["p",
                   "What is this group all about? What kind of people are members? What sorts of reviews do members post?"];
        showDialog(heading, descrip, wizgrp, 
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: true}},
                   [{name: "Back", fstr: "app.group.promptForCity()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },
                   

    promptForReviewTypes: function () {
        var heading, descrip;
        heading = "Create Group: Review Types";
        descrip = ["p",
                   "What types of reviews will be accepted for sharing within this group?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: true, 
                               printName: "Review Types"}},
                   [{name: "Back", fstr: "app.group.promptForDescription()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },


    promptForReviewFreq: function () {
        var heading, descrip;
        heading = "Create Group: Review Frequency";
        descrip = ["p",
                   "You don't have to be a member to follow a group, but members are expected to contribute reviews.  How often should members of " + wizgrp.name + " post to remain in good standing?"];
        showDialog(heading, descrip, wizgrp,
                   {name: {type: "text", edit: false, valclass: "grpnameval"},
                    city: {type: "text", edit: false},
                    description: {type: "textarea", edit: false},
                    revtypes: {type: "revtypesel", edit: false, 
                               printName: "Review Types"},
                    revfreq: {type: "frequency", edit: true,
                              printName: "Review Frequency"}},
                   [{name: "Back", fstr: "app.group.promptForReviewTypes()"},
                    {name: "Cancel", fstr: "app.layout.closeDialog()"},
                    {name: "OK", fstr: "app.group.createGroup()"}]);
    },


    editGroup: function (group) {
        var name;
        wizgrp = {};
        for(name in group) {
            if(group.hasOwnProperty(name)) {
                wizgrp[name] = group[name]; } }
        promptForPrimaryFields();
    },


    createGroup: function () {
        if(!wizgrp) {
            wizgrp = { name: "", city: "", description: "", picture: "", 
                       revtypes: "", revfreq: "",
                       founders: "", seniors: "", members: "" }; }
        if(readPrimaryFields()) {
            promptForPrimaryFields(); }
    },


    saveGroup: function () {
        jt.out('primgroupbuttonsdiv', "Creating " + wizgrp.name + "...");
        //POST and then displayGroup
    }


}; //end of returned functions
}());

