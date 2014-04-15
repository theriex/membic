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
                groupref = app.lcs.getRef("group", pen.groups[i]);
                if(groupref.group) {
                    pen.groups[i] = groupref.group; }
                else {
                    app.lcs.getFull("group", pen.groups[i],
                                    deserializeAndLoadGroups);
                    return; } } }
        return pen.groups;
    },


    membership = function () {
        var penid;
        if(wizgrp.membership) {
            return wizgrp.membership; }
        wizgrp.membership = "";
        penid = jt.instId(app.pen.currPenRef().pen);
        if(jt.idInCSV(penid, wizgrp.founders)) {
            wizgrp.membership = "Founder"; }
        else if(jt.idInCSV(penid, wizgrp.seniors)) {
            wizgrp.membership = "Senior"; }
        else if(jt.idInCSV(penid, wizgrp.members)) {
            wizgrp.membership = "Member"; }
        return wizgrp.membership;
    },


    isApplying = function () {
        var penid = jt.instId(app.pen.currPenRef().pen);
        if(jt.idInCSV(penid, wizgrp.seeking)) {
            return true; }
        return false;
    },


    //pen.groups is deserialized when the pen is loaded..
    isFollowing = function () {
        var groupid, groups, i;
        groupid = jt.instId(wizgrp);
        groups = app.pen.currPenRef().pen.groups;
        for(i = 0; i < groups.length; i += 1) {
            if(jt.instId(groups[i]) === groupid) {
                return true; } }
        return false;
    },


    followsetHTML = function () {
        var html;
        if(isFollowing() || membership()) {
            html = ["a", {href: "#Settings", cla: "gold",
                          title: "Membership and follow settings",
                          onclick: jt.fs("app.group.adjust()")},
                    [["img", {cla: "followingico",
                              src: "img/followset.png"}],
                      ""]]; }
        else {
            html = ["a", {href: "#Follow",
                          title: "Follow " + wizgrp.name,
                          onclick: jt.fs("app.group.follow()")},
                    [["img", {cla: "followico", id: "followbimg",
                              src: "img/follow.png"}],
                     "Follow"]]; }
        return jt.tac2html(html);
    },


    groupActionsHTML = function () {
        var html = [];
        //how long since they last posted?
        //ATTENTION: list outstanding applications with reject/accept
        return html;
    },


    groupReviewsHTML = function () {
        var html = "reviews go here";
        //ATTENTION: paginate using wizgrp.revpage, 20 reviews at a time
        //like activity display (no "via" here)
        //will need to include group reviews with "via" into activity
        //["ul", {cla: "revlist"},
        return html;
    },


    revTypesDispHTML = function () {
        var html = [], i, reviewTypes, typename;
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(jt.idInCSV(typename, wizgrp.revtypes)) {
                html.push(["span", {cla: "badgespan"},
                           ["img", {cla: "reviewbadge",
                                    src: "img/" + reviewTypes[i].img}]]); } }
        return html;
    },


    frequencyName = function () {
        var i;
        for(i = 0; i < revfreqs.length; i += 1) {
            if(wizgrp.revfreq <= revfreqs[i].freq) {
                return revfreqs[i].name; } }
        return "";
    },


    displayGroupHeading = function () {
        var imgsrc, html;
        imgsrc = "../img/emptyprofpic.png";
        if(wizgrp.picture) {
            imgsrc = "../grppic?groupid=" + jt.instId(wizgrp); }
        html = ["div", {id: "grouphdiv"},
                ["table",
                 ["tr",
                  [["td",
                    ["div", {id: "gpcdiv"},
                     [["div", {id: "gpicdiv"},
                       ["img", {cla: "profpic", src: imgsrc}]],
                      ["div", {id: "gcitydiv", cla: "groupcity"},
                       wizgrp.city]]]],
                   ["td", {cla: "tdwide"},
                    ["div", {id: "gndbdiv"},
                     [["div", {id: "grouphdiv"},
                       ["table",
                        ["tr",
                         [["td", {id: "grouphnametd"},
                           ["span", {id: "penhnamespan"},
                            wizgrp.name]],
                          ["td",
                           ["div", {id: "grouphbuttondiv"},
                            followsetHTML()]]]]]],
                      ["div", {id: "groupdescdiv", cla: "groupdescrtxt"},
                        jt.linkify(wizgrp.description)],
                      ["div", {id: "typefreqdiv"},
                       ["table",
                        ["tr",
                         [["td", {id: "grouprevtypestd"},
                           ["div", {id: "grouprevtypesdiv"},
                            revTypesDispHTML()]],
                          ["td", {id: "groupfreqtd"},
                           ["div", {id: "groupfreqdispdiv"},
                            ["span", {cla: "groupcity"},
                             frequencyName()]]]]]]],
                      ["div", {id: "groupfreqeditdiv"}],
                      ["div", {id: "errmsgdiv"}],
                      ["div", {id: "groupeditbuttonsdiv"},
                       ""]]]]]]]];
        app.layout.headingout(jt.tac2html(html));
    },


    displayGroupBody = function () {
        var html;
        html = ["div", {id: "groupmaindiv"},
                [["div", {id: "groupactionsdiv"},
                  groupActionsHTML()],
                 ["div", {id: "grouprevsdiv"},
                  groupReviewsHTML()]]];
        jt.out('cmain', jt.tac2html(html));
        app.layout.adjust();
    },


    displayGroup = function () {
        app.layout.closeDialog();
        jt.out('rightcoldiv', "");
        jt.byId('rightcoldiv').style.display = "none";
        displayGroupHeading();
        displayGroupBody();
        //if we are coming in from url parameters, it is possible to end 
        //up with the profile heading overwriting the group heading.
        setTimeout(displayGroupHeading, 400);
    },


    copyGroup = function (group) {
        var groupid;
        //set or default all working field values
        wizgrp = { name: group.name || "",
                   city: group.city || "",
                   description: group.description || "",
                   picture: group.picture || "",
                   revtypes: group.revtypes || "",
                   revfreq: group.revfreq || "30",
                   founders: group.founders || "",
                   seniors: group.seniors || "",
                   members: group.members || "",
                   seeking: group.seeking || "",
                   reviews: group.reviews || "",
                   modified: group.modified || ""};
        wizgrp.name_c = group.name_c || jt.canonize(group.name);
        groupid = jt.instId(group);
        if(groupid) {
            jt.setInstId(wizgrp, groupid); }
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
                              "revtypesel", null, obj[fname])]]]; }
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
                    if(jt.safeint(obj[fname]) === revfreqs[i].freq || 
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
                            wizgrp.revtypes += app.review.getReviewTypeByValue(
                                cboxes[j].value).type; } }
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
    },


    membershipManagementHTML = function () {
        var linkfs, act, html = [], i, fdef;
        linkfs = {apply: {href: "#apply", fs: "app.group.reqmem()"},
                  withdraw: {href: "#withdraw", fs: "app.group.withdraw()"},
                  resign: {href: "#resign", fs: "app.group.resignconf()"}};
        act = {stat: "", actions: []};
        switch(membership()) {
        case "Founder":
            act.stat = "You are a founding member.";
            act.actions.push({href: "resign", text: "resign"});
            break;
        case "Senior":
            if(isApplying()) {
                act.stat = "You are applying to become a Founder.";
                act.actions.push({href: "withdraw", 
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are a senior member.";
                act.actions.push({href: "apply", text: "Become a Founder"});
                act.actions.push({href: "resign", text: "resign"}); }
            break;
        case "Member":
            if(isApplying()) {
                act.stat = "You are applying for senior membership.";
                act.actions.push({href: "withdraw",
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are a member.";
                act.actions.push({href: "apply", 
                                  text: "Become a Senior Member"});
                act.actions.push({href: "resign", text: "resign"}); }
            break;
        default:
            if(isApplying()) {
                act.stat = "You are applying for membership.";
                act.actions.push({href: "withdraw",
                                  text: "Withdraw Application"}); }
            else {
                act.stat = "You are not a member yet.";
                act.actions.push({href: "apply", 
                                  text: "Become a Member"}); } }
        for(i = 0; i < act.actions.length; i += 1) {
            fdef = linkfs[act.actions[i].href];
            if(fdef.href === "#apply") {
                html.push(["button", {type: "button",
                                      onclick: jt.fs(fdef.fs)},
                           act.actions[i].text]); }
            else {
                html.push(["span", {cla: "grpmemlinkspan"},
                           ["a", {href: fdef.href,
                                  onclick: jt.fs(fdef.fs)},
                            act.actions[i].text]]); } }
        html = ["div", {id: "personalmembershipdiv"},
                ["table",
                 ["tr",
                  [["td",
                    ["span", {id: "grpmemstatspan"},
                     act.stat]],
                   ["td",
                    html]]]]];
        return html;
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
        copyGroup(group);
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
        var data, divid, buttonhtml;
        if(!jt.instId(wizgrp)) {
            divid = "primgroupbuttonsdiv";
            buttonhtml = jt.byId(divid).innerHTML;
            jt.out(divid, "Creating " + wizgrp.name + "..."); }
        else {
            divid = 'groupeditbuttonsdiv';
            buttonhtml = jt.byId(divid).innerHTML;
            jt.out(divid, "Saving..."); }
        //relying on server side validation for detailed checking
        app.onescapefunc = null;
        data = jt.objdata(wizgrp) + 
            "&penid=" + app.pen.currPenRef().penid;
        jt.call('POST', "grpdesc?" + app.login.authparams(), data,
                function (groups) {
                    copyGroup(groups[0]);
                    displayGroup(); },
                app.failf(function (code, errtxt) {
                    jt.out(divid, buttonhtml);
                    jt.out('errmsgdiv', "Save failed code: " + code + 
                           " " + errtxt); }),
                jt.semaphore("group.save"));
    },


    display: function () {
        displayGroup();
    },


    bygroupid: function (groupid) {
        app.layout.closeDialog(); //close group search dialog if open
        app.pen.getPen(function (pen) {  //not already loaded if by url param
            app.lcs.getFull("group", groupid, function (groupref) {
                //ATTENTION: history needs to support this...
                app.history.checkpoint({ view: "group", 
                                         groupid: jt.instId(wizgrp)});
                copyGroup(groupref.group);
                displayGroup(); }); });
    },


    adjust: function () {
        var html = [];
        if(membership() === "Founder") {
            html.push(["div", {id: "chgrpdescrdiv"},
                       ["a", {href: "#changedescription",
                              onclick: jt.fs("app.group.changedescr()")},
                        "Change Group Description"]]); }
        html.push(membershipManagementHTML());
        html = ["div", {id: "groupsetdlgdiv"},
                html];
        html = app.layout.dlgwrapHTML("Settings: " + wizgrp.name, html);
        app.layout.openDialog({y:140}, html);
    },


    follow: function () {
        jt.err("follow not implemented yet");
    },


    changedescr: function () {
        var divpos, rswidth, lswidth;
        divpos = jt.geoPos(jt.byId("grouphdiv"));
        rswidth = String(Math.round((divpos.w - 20) / 2)) + "px";
        lswidth = String(jt.geoPos(jt.byId("gpicdiv")).w - 4) + "px";
        app.layout.closeDialog();
        jt.out('grouphbuttondiv', "");
        jt.out('gcitydiv', jt.tac2html(
            ["input", {type: "text", id: "cityin",
                       style: "width:" + lswidth,
                       placeholder: "City or region",
                       value: wizgrp.city}]));
        jt.out('penhnamespan', jt.tac2html(
            ["input", {type: "text", id: "namein", 
                       style: "width:" + rswidth,
                       value: wizgrp.name}]));
        jt.out('groupdescdiv', jt.tac2html(
            ["textarea", {id: "descriptionin", cla: "groupdescrtxt",
                          style: "height:100px;"},
             wizgrp.description || ""]));
        jt.byId('descriptionin').style.width = rswidth;
        jt.out('grouprevtypesdiv', jt.tac2html(
            ["table", {cla: "grpwiztable groupdescrtxt"},
             fieldTableRow(wizgrp, "revtypes", 
                           {type: "revtypesel", edit: true, 
                            printName: "Review Types"})]));
        jt.out('groupfreqdispdiv', "");
        jt.out('groupfreqeditdiv', jt.tac2html(
            ["table", {cla: "grpwiztable groupdescrtxt"},
             fieldTableRow(wizgrp, "revfreq",
                           {type: "frequency", edit: true,
                            printName: "Review Frequency"})]));
        jt.out('groupeditbuttonsdiv', jt.tac2html(
            [["button", {type: "button", id: "cancelbutton",
                         onclick: jt.fs("app.group.display()")},
              "Cancel"],
             ["button", {type: "button", id: "okbutton",
                         onclick: jt.fs("app.group.readandsave()")},
              "Save"]]));
    },


    readandsave: function () {
        if(readPrimaryFields()) {
            app.group.saveGroup(); }
    },


    reqmem: function () {
        //request membership at the next level from current
        jt.err("reqmem not implemented yet");
    },


    withdraw: function () {
        //withdraw membership application. Ask for patience in confirmation.
        jt.err("withdraw not implemented yet");
    },


    resignconf: function () {
        //delete the group when the last founder leaves.  Need to be able
        //to re-use the names without it being a hassle.
        //resign membership (big warning if last founder, esp if seniors)
        //are you sure, common reasons, have to re-apply etc.
        jt.err("resignconf not implemented yet");
    }


}; //end of returned functions
}());

