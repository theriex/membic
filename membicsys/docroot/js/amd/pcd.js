/*global app, jt, setTimeout, window, confirm, document, a2a, a2a_config */

/*jslint browser, multivar, white, fudge */

//////////////////////////////////////////////////////////////////////
// PenName or Coop common display functions.
//

app.pcd = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var //see verifyFunctionConnections for procesing switches
        dst = { type: "", id: "", tab: "", obj: null,
                pen: { desclabel: "About Me",
                       descplace: "Links to other public pages you have, favorite sayings...",
                       descfield: "shoutout",
                       piclabel: "Profile Pic",
                       picfield: "profpic",
                       picsrc: "profpic?profileid=",
                       accsrc: "?view=pen&penid=" },
                coop: { desclabel: "Description",
                         descplace: "What is this cooperative theme focused on? What's appropriate to post?",
                         descfield: "description", 
                         piclabel: "Theme Pic",
                         picfield: "picture",
                         picsrc: "ctmpic?coopid=",
                         accsrc: "?view=coop&coopid=" } },
        knowntabs = { latest:    { href: "#latestmembics", 
                                   img: "img/tablatest.png",
                                   mtitle: "My recent membics",
                                   otitle: "Recent membics"},
                      favorites: { href: "#favoritemembics",
                                   img: "img/top.png",
                                   mtitle: "My top membics",
                                   otitle: "Top membics"},
                      memo:      { href: "#rememberedmembics",
                                   img: "img/tabmemo.png",
                                   mtitle: "My remembered membics",
                                   otitle: "Remembered membics"},
                      search:    { href: "#searchmembics",
                                   img: "img/search.png",
                                   mtitle: "Search my membics",
                                   otitle: "Search membics from $NAME"},
                      prefpens:  { href: "#preferredpens",
                                   img: "img/prefer.png",
                                   mtitle: "People I prefer",
                                   otitle: "People $NAME prefers"},
                      coops:     { href: "#coopsfollowing",
                                   img: "img/tabctms.png",
                                   mtitle: "My Themes",
                                   otitle: "Themes followed by $NAME"},
                      calendar:  { href: "#coopcalendar",
                                   img: "calico",
                                   mtitle: "Event Calendar",
                                   otitle: "Event Calendar"} },
        srchst = { revtype: "all", qstr: "", status: "" },
        setdispstate = { infomode: "" },
        addToAnyScriptLoaded = false,
        ctmmsgs = [
            {name: "Following",
             levtxt: "Following shows you are interested in reading content from members writing on this theme.",
             uptxt: "Only members may post.",
             upbtn: "Apply for membership",
             cantxt: "You are applying for membership.",
             canbtn: "Withdraw membership application",
             rejtxt: "Your membership application was rejected.",
             rejbtn: "Ok rejection",
             restxt: "",
             resbtn: "Stop following",
             resconf: "",
             notice: "is applying for membership" },

            {name: "Member",
             levtxt: "As a member, you may post membics related to this theme.",
             uptxt: "If you would like to help make sure posts are relevant, and help approve new members, you can apply to become a Moderator.",
             upbtn: "Apply to become a Moderator",
             cantxt: "You are applying to become a Moderator.",
             canbtn: "Withdraw Moderator application",
             rejtxt: "Your Moderator application was rejected.",
             rejbtn: "Ok rejection",
             restxt: "If you no longer wish to contribute, you can resign your membership and go back to just following.",
             resbtn: "Resign membership",
             resconf: "Are you sure you want to resign your membership?",
             notice: "is applying to become a Moderator" },

            {name: "Moderator",
             levtxt: "As a Moderator, you can post, remove membics that don't belong, and approve membership applications.",
             uptxt: "If you think it would be appropriate for you to be recognized as a permanent co-owner of this cooperative theme, you can apply to become a Founder.",
             upbtn: "Apply to become a Founder",
             cantxt: "You are applying to become a Founder.",
             canbtn: "Withdraw your Founder application",
             rejtxt: "Your Founder application was rejected.",
             rejbtn: "Ok rejection",
             restxt: "If you no longer wish to help moderate, you can resign as a Moderator and go back to being a regular member.",
             resbtn: "Resign as Moderator",
             resconf: "Are you sure you want to resign as moderator?",
             notice: "is applying to become a Founder" },

            {name: "Founder",
             levtxt: "As a Founder, you permanently have all privileges available.",
             uptxt: "",
             upbtn: "",
             cantxt: "",
             rejtxt: "",
             rejbtn: "",
             canbtn: "",
             restxt: "If you no longer want ownership, you can resign as a Founder and allow others to continue the cooperative theme.",
             resbtn: "Resign as Founder",
             resconf: "Are you sure you want to resign as Founder?"}],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    getDirectLinkInfo = function () {
        var infobj = {title: "", url: "https://" + window.location.host};
        if(dst.type === "pen") {
            infobj.url += "/p/" + dst.id;
            infobj.title = "Direct profile URL:"; }
        else {
            infobj.url += "/t/" + dst.id;
            infobj.title = "Direct theme URL:"; }
        return infobj;
    },

    picImgSrc = function (obj) {
        var defs = dst[dst.type], 
            src = "img/nopicprof.png";
        if(obj[defs.picfield]) {  //e.g. pen.profpic
            //fetch with mild cachebust in case modified
            src = defs.picsrc + jt.instId(obj) +
                "&modified=" + obj.modified; }
        return src;
    },


    modButtonsHTML = function (obj) {
        var mypenid, mypen, objectid, html = "";
        if(app.solopage()) {
            return ""; }
        mypenid = app.pen.myPenId();
        mypen = app.pen.myPenName();
        objectid = jt.instId(obj);
        if(dst.type === "pen") {
            if(mypenid && objectid === mypenid) {
                html = ["a", {id: "pcdsettingslink", href: "#pensettings",
                              onclick: jt.fs("app.pcd.settings()")},
                        ["img", {cla: "reviewbadge",
                                 src: "img/settings.png"}]]; }
            else {
                html = ["a", {href: "#visprefs",
                              onclick: jt.fs("app.pen.visprefs('','" + 
                                             objectid + "','" + 
                                             jt.embenc(obj.name) + "')")},
                        ["img", {cla: "visprefimgprof", 
                                 src: app.pen.prefimg(objectid)}]]; } }
        else if(dst.type === "coop" && mypen) {
            if(jt.isId(objectid) && (!mypen.coops || 
                                     !mypen.coops.csvcontains(objectid))) {
                html = ["span", {id: "followbuttonspan"},
                        ["button", {type: "button", id: "followbutton",
                                    onclick: jt.fs("app.pcd.follow()")},
                         "Follow"]]; }
            else {
                html = ["a", {id: "pcdsettingslink", href: "#coopsettings",
                              onclick: jt.fs("app.pcd.settings()")},
                        ["img", {cla: "reviewbadge",
                                 src: "img/settings.png"}]]; } }
        return jt.tac2html(html);
    },


    accountInfoHTML = function () {
        var html = "";
        if(dst.type === "pen") {
            html = ["p", "Last modified " + 
                    jt.colloquialDate(jt.ISOString2Day(dst.obj.modified))]; }
        return jt.tac2html(html);
    },


    isMyMembershipAction = function (entry) {
        if(entry.targid === app.pen.myPenId() &&
           (entry.action.indexOf("Rejected") >= 0 ||
            entry.action.indexOf("Denied") >= 0 ||
            entry.action.indexOf("Accepted") >= 0 ||
            entry.action.indexOf("Demoted") >= 0)) {
            return true; }
        return false;
    },


    personalInfoButtonHTML = function () {
        var les, html;
        les = dst.obj.adminlog;
        html = "";
        if(les && les.length) {
            les.every(function (action) {
                if(isMyMembershipAction(action)) {
                    html = ["a", {href: "#myloginfo",
                              onclick: jt.fs("app.pcd.toggleCtmDet('mbinfo')")},
                            ["img", {cla: "myinfoimg", src: "img/info.png"}]];
                    return false; } //found my latest, end iteration
                return true; }); }
        return html;
    },


    membershipButtonLine = function (msgtxt, buttondivid, buttondeco, 
                                     buttonid, buttonfs, buttontxt) {
        var html;
        html = ["div", {cla: "formline"},
                [["div", {cla: "ctmlevtxt"},
                  msgtxt],
                 ["div", {cla: "formbuttonsdiv", id: buttondivid},
                  [buttondeco,
                   ["button", {type: "button", id: buttonid,
                               onclick: buttonfs},
                    buttontxt]]]]];
        return html;
    },


    membershipSettingsHTML = function () {
        var html, mlev, seeking, rejected;
        mlev = app.coop.membershipLevel(dst.obj);
        seeking = app.coop.isSeeking(dst.obj);
        rejected = app.coop.isRejected(dst.obj);
        html = [];
        //show application button if not in application process
        if(ctmmsgs[mlev].uptxt && !seeking && !rejected) {
            html.push(membershipButtonLine(
                ctmmsgs[mlev].uptxt, "memappbdiv", personalInfoButtonHTML(),
                "uplevelbutton", jt.fs("app.pcd.ctmmem('apply')"),
                ctmmsgs[mlev].upbtn)); }
        //show appropriate process button or default downlevel button
        if(rejected) {
            html.push(membershipButtonLine(
                ctmmsgs[mlev].rejtxt, "memappbdiv", personalInfoButtonHTML(),
                "accrejbutton", jt.fs("app.pcd.ctmmem('accrej')"),
                ctmmsgs[mlev].rejbtn)); }
        else if(seeking) {
            html.push(membershipButtonLine(
                ctmmsgs[mlev].cantxt, "memappbdiv", "",
                "withdrawbutton", jt.fs("app.pcd.ctmmem('withdraw')"),
                ctmmsgs[mlev].canbtn)); }
        else { //not seeking or rejected, show downlevel/resign button
            html.push(membershipButtonLine(
                ctmmsgs[mlev].restxt, "rsbdiv", "",
                "downlevelbutton", jt.fs("app.pcd.ctmdownlev()"),
                ctmmsgs[mlev].resbtn)); }
        html = [["div", {cla: "formline"},
                 [["label", {fo: "statval", cla: "liflab"}, "Status"],
                  ["a", {href: "#togglecoopstat",
                         onclick: jt.fs("app.layout.togdisp('ctmstatdetdiv')")},
                   ["span", {id: "memlevspan"}, 
                    (seeking? "Applying" : ctmmsgs[mlev].name)]]]],
                ["div", {cla: "formline", id: "ctmstatdetdiv",
                         style: "display:none;"},
                 [["div", {cla: "formline"},
                   ctmmsgs[mlev].levtxt],
                  html]]];
        return html;
    },


    membershipAppNoticeHTML = function (penid, name, mlev) {
        var html;
        html = ["div", {cla: "ctmmemdiv"},
                [["div", {cla: "fpprofdivsp"},
                  ["img", {cla: "fpprofpic",
                           src: "profpic?profileid=" + penid,
                           title: jt.ndq(name),
                           alt: "prof pic"}]],
                 ["a", {href: "view=pen&penid=" + penid,
                        onclick: jt.fs("app.pen.bypenid('" + penid + "')")},
                  ["span", {cla: "penflist"}, name]],
                 "&nbsp;" + ctmmsgs[mlev].notice,
                 ["div", {cla: "formline"}],
                 ["div", {cla: "formline", id: "reasondiv" + penid,
                          style: "display:none;"},
                  [["label", {fo: "reasonin" + penid, cla: "liflab",
                              id: "reasonlab" + penid},
                    "Reason"],
                   ["input", {id: "reasonin" + penid, cla: "lifin",
                              type: "text"}]]],
                 ["div", {cla: "formline inlinebuttonsdiv", 
                          id: "abdiv" + penid},
                  [["button", {type: "button", id: "rejectb" + penid,
                               onclick: jt.fs("app.pcd.memapp('reject" +
                                              "','" + penid + "')")},
                    "Reject"],
                   ["button", {type: "button", id: "acceptb" + penid,
                               onclick: jt.fs("app.pcd.memapp('accept" +
                                              "','" + penid + "')")},
                    "Accept"]]]]];
        return html;
    },


    outstandingApplicationsHTML = function () {
        var html, mlev, people;
        if(!dst.obj.seeking) {
            return ""; }
        mlev = app.coop.membershipLevel(dst.obj);
        if(mlev < 2) {
            return ""; }
        html = [];
        people = dst.obj.people || {};
        dst.obj.seeking.csvarray().forEach(function (penid) {
            var name, slev;
            name = people[penid] || penid;
            slev = app.coop.membershipLevel(dst.obj, penid);
            if(mlev > slev || mlev === 3) {
                html.push(membershipAppNoticeHTML(penid, name, slev)); } });
        return html;
    },


    adminLogTargetHTML = function (logentry) {
        var penid;
        if(logentry.action === "Removed Membic") {
            return logentry.tname; }
        if(logentry.action.startsWith("Resigned")) {
            return ""; }
        penid = logentry.targid;
        return ["a", {href: "view=pen&penid=" + penid,
                      onclick: jt.fs("app.pen.bypenid('" + penid + "')")},
                logentry.tname];
    },


    coopLogHTML = function (filter) {
        var les, html;
        les = dst.obj.adminlog;
        if(!les || !les.length) {
            return "No log entries"; }
        les = les.slice(0, 10);  //don't scroll forever
        html = [];
        les.forEach(function (logentry) {
            var penid;
            if(!filter || (filter === "membership" &&
                           isMyMembershipAction(logentry))) {
                penid = logentry.penid;
                html.push(
                    ["div", {cla: "adminlogentrydiv"},
                     [["span", {cla: "logdatestampspan"}, 
                       logentry.when.slice(0, 10) + ": "],
                      ["a", {href: "view=pen&penid=" + penid,
                             onclick: jt.fs("app.pen.bypenid('" + penid + 
                                            "')")},
                       ["span", {cla: "logdatestampspan"},
                        logentry.pname || penid]],
                      " " + logentry.action + " ",
                      adminLogTargetHTML(logentry),
                      (logentry.reason? ": " + logentry.reason : "")]]); } });
        return jt.tac2html(html);
    },


    coopMembershipLineHTML = function (field, penid, pname, mlev) {
        var html;
        if(field === "founders" || (field === "moderators" && mlev < 3) ||
                                   (field === "members" && mlev <= 1)) {
            html = ["div", {cla: "memlistdiv"},
                    [["div", {cla: "fpprofdivsp"},
                      ["img", {cla: "fpprofpic",
                               src: "profpic?profileid=" + penid,
                               alt: "prof pic"}]],
                     ["span", {cla: "penflist"}, pname]]]; }
        else {  //display modifiable member listing
            html = ["div", {cla: "formline", id: "memlistdiv" + penid},
                    [["div", {cla: "fpprofdivsp"},
                      ["img", {cla: "fpprofpic",
                               src: "profpic?profileid=" + penid,
                               alt: "prof pic"}]],
                     ["a", {href: "#demote",
                            onclick: jt.fs("app.layout.togdisp('memdemdiv" +
                                           penid + "')")},
                      ["span", {cla: "penflist"}, pname]],
                     ["div", {cla: "formline", id: "memdemdiv" + penid,
                              style: "display:none;"},
                      [["label", {fo: "reasonin" + penid, cla: "liflab",
                                  id: "reasonlab" + penid},
                        "Reason"],
                       ["input", {id: "reasonin" + penid, cla: "lifin",
                                  placeholder: "Reason required",
                                  type: "text"}],
                       ["div", {cla: "formline formbuttonsdiv", 
                                id: "memdembuttondiv" + penid},
                        ["button", {type: "button", id: "demoteb" + penid,
                                    onclick: jt.fs("app.pcd.memdem('" + 
                                                   penid + "')")},
                         "Demote"]]]]]]; }
        return html;
    },


    coopMembershipHTML = function () {
        var html, fields, mlev;
        mlev = app.coop.membershipLevel(dst.obj);
        html = [];
        fields = ["founders", "moderators", "members"];
        fields.forEach(function (field) {
            var people, penids = dst.obj[field].csvarray();
            if(penids.length) {
                html.push(["div", {cla: "formline"}, field.capitalize()]); }
            people = dst.obj.people || {};
            penids.forEach(function (penid) {
                var pname = people[penid] || penid;
                html.push(coopMembershipLineHTML(
                    field, penid, pname, mlev)); }); });
        html.push(["div", {cla: "formline"}, "&nbsp;"]); //final clear
        return jt.tac2html(html);
    },


    adminSettingsHTML = function () {
        var memsel = "", oah = "", html;
        if(dst.type === "coop") {
            oah = outstandingApplicationsHTML();
            if(app.coop.membershipLevel(dst.obj) >= 2) {
                memsel = [
                    "a", {href: "#memberinfo",
                          onclick: jt.fs("app.pcd.toggleCtmDet('members')")},
                    ["img", {cla: "ctmsetimg", src: "img/membership.png"}]]; } }
        html = [["div", {cla: "formline", id: "settingsinfolinediv"},
                 [["div", {id: "ctminfoseldiv"},
                   ["a", {href: "#actioninfo",
                          onclick: jt.fs("app.pcd.toggleCtmDet('info')")},
                    ["img", {cla: "ctmsetimg", src: "img/info.png"}]]],
                  ["div", {id: "meminfoseldiv",
                           style: (memsel? "" : "display:none;")}, memsel],
                  ["div", {id: "reloaddiv"}, 
                   ["a", {href: "?view=coop&coopid=" + jt.instId(dst.obj)},
                    ["img", {cla: "ctmsetimg", src: "img/reload.png"}]]]]],
                ["div", {cla: "formline"}, oah],
                ["div", {cla: "formline", id: "midispdiv",
                         style: "display:none;"}]];
        return html;
    },


    picSettingsHTML = function () {
        var html;
        if(!jt.hasId(dst.obj) ||
               (dst.type === "coop" && 
                app.coop.membershipLevel(dst.obj) < 3)) {
            return ""; }
        html = [["label", {fo: "picuploadform", cla: "overlab"},
                  "Change Picture"],
                ["form", {action: "/picupload", method: "post",
                          enctype: "multipart/form-data", target: "tgif",
                          id: "picuploadform"},
                 [jt.paramsToFormInputs(app.login.authparams()),
                  jt.paramsToFormInputs("picfor=" + dst.type + 
                                        "&_id=" + dst.id +
                                        "&penid=" + app.pen.myPenId()),
                  ["div", {cla: "tablediv"},
                   [["div", {cla: "fileindiv"},
                     [["input", {type: "file", 
                                 name: "picfilein", id: "picfilein"}],
                      ["div", {id: "uploadbuttonsdiv"},
                       ["input", {type: "submit", cla: "formbutton",
                                  value: "Upload&nbsp;Picture"}]]]],
                    ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                ["iframe", {id: "tgif", name: "tgif", src: "/picupload",
                            style: "display:none"}]];
        return html;
    },
    picSettingsInit = function () {
        app.pcd.monitorPicUpload();
    },


    descripSettingsHTML = function () {
        var nh = "", defs, html;
        if(dst.type === "coop") {
            if(app.coop.membershipLevel(dst.obj) < 3) {
                return ""; }
            nh = ["div", {cla: "formline"},
                  [["label", {fo: "namein", cla: "liflab", id: "namelab"},
                    "Name"],
                   ["input", {id: "namein", cla: "lifin", type: "text",
                              placeholder: "Theme name required",
                              value: dst.obj.name}]]]; }
        defs = dst[dst.type];
        html = [nh,
                ["div", {cla: "formline"},
                 ["label", {fo: "shouteditbox", cla: "overlab"}, 
                  defs.desclabel]],
                ["textarea", {id: "shouteditbox", cla: "dlgta"}],
                ["div", {id: "formstatdiv"}],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.pcd.saveDescription()")},
                  "Update Description"]]];
        return html;
    },
    descripSettingsInit = function () {
        var defs, namein, shout;
        defs = dst[dst.type];
        shout = jt.byId('shouteditbox');
        if(shout) {
            shout.readOnly = false;
            shout.value = dst.obj[defs.descfield];
            shout.placeholder = defs.descplace; }
        //set the focus only if not already filled in
        namein = jt.byId('namein');
        if(namein && !namein.value) {
            namein.focus(); }
        else if(shout && !shout.value) {
            shout.focus(); }
    },


    reviewTypeKeywordsHTML = function () {
        var kwu, html = [];
        app.pen.verifyStashKeywords(dst.obj);
        kwu = app.pen.getKeywordUse(dst.obj);
        app.review.getReviewTypes().forEach(function (rt) {
            html.push(
                ["div", {cla: "rtkwdiv", id: "rtkwdiv" + rt.type},
                 [["div", {cla: "formline"},
                   [["img", {cla: "reviewbadge", src: "img/" + rt.img}],
                    ["input", {id: "kwcsvin" + rt.type, cla: "keydefin", 
                               type: "text", placeholder: "Checkbox keywords",
                               value: dst.obj.stash.keywords[rt.type]}]]],
                  ["div", {cla: "formline"},
                   ["span", {cla: "kwcsvspan"},
                    [["span", {cla: "kwcsvlabel"}, "Recent:"],
                     jt.spacedCSV(kwu.recent[rt.type])]]],
                  ["div", {cla: "formline"},
                   ["span", {cla: "kwcsvspan"},
                    [["span", {cla: "kwcsvlabel"}, "Default:"],
                     jt.spacedCSV(kwu.system[rt.type])]]]]]); });
        return html;
    },


    themeKeywordsHTML = function () {
        var html;
        html = ["div", {cla: "rtkwdiv", id: "themekwdiv"},
                ["div", {cla: "formline"},
                 [["img", {cla: "reviewbadge", 
                           src: "ctmpic?" + dst.type + "id=" + dst.id}],
                  ["input", {id: "kwcsvin", cla: "keydefin",
                             type: "text", 
                             placeholder: "keywords separated by commas",
                             value: dst.obj.keywords}]]]];
        return html;
    },


    keywordSettingsHTML = function () {
        var label = "", html = "";
        switch(dst.type) {
        case "pen": 
            label = "Checkbox Keywords";
            html = reviewTypeKeywordsHTML(); 
            break;
        case "coop": 
            if(app.coop.membershipLevel(dst.obj) < 2) {
                return ""; }
            label = "Theme Keywords";
            html = themeKeywordsHTML();
            break;
        default: return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#togglecustomkeywords",
                        onclick: jt.fs("app.layout.togdisp('penkwdsdiv')")},
                  [["img", {cla: "ctmsetimg", src: "img/tag.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    label]]],
                 ["div", {cla: "formline", id: "penkwdsdiv",
                          style: "display:none;"},
                  [html,
                   ["div", {cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "updatekwdsdiv",
                                onclick: jt.fs("app.pcd.updateKeywords()")},
                     "Update Keywords"]]]]]];
        return html;
    },


    calendarIconHTML = function () {
        var html;
        html = ["div", {id: "calicodiv", cla: "tabico"},
                [["div", {id: "calicoheaddiv"}],
                 ["div", {id: "caliconumdiv"},
                  new Date().getDate()]]];
        return jt.tac2html(html);
    },


    calendarSettingsHTML = function () {
        var html;
        if(dst.type !== "coop" || app.coop.membershipLevel(dst.obj) < 3 ||
               !jt.isId(jt.instId(dst.obj))) {
            return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#togglecalembed",
                        onclick: jt.fs("app.layout.togdisp('ctmcalembdiv')")},
                  [calendarIconHTML(),
                   ["span", {cla: "settingsexpandlinkspan"},
                    "Embedded Calendar"]]],
                 ["div", {cla: "formline", id: "ctmcalembdiv",
                          style: "display:none;"},
                  [["div", {cla: "formline"},
                    "If this theme has an embeddable public calendar, paste the embed code here:"],
                   ["textarea", {id: "calembedta", cla: "dlgta"}],
                   ["div", {cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "savecalbutton",
                                onclick: jt.fs("app.pcd.saveCalEmbed()")},
                     "Update Embed"]],
                   ["div", {cla: "formline", id: "calembederrdiv"}]]]]];
        return html;
    },
    calSettingsInit = function () {
        var ceta = jt.byId('calembedta');
        if(ceta) {
            ceta.readOnly = false;
            ceta.value = dst.obj.calembed;
            ceta.placeholder = "<iframe src=... code"; }
    },


    rssSettingsHTML = function () {
        var sr, html;
        if(dst.type !== "coop" || !jt.isId(jt.instId(dst.obj))) {
            return ""; }
        sr = "https://feedly.com";  //sample RSS reader
        html = ["div", {cla: "formline"},
                [["a", {href: "#toggleRSS",
                        onclick: jt.fs("app.layout.togdisp('ctmrssdiv')")},
                  [["img", {cla: "ctmsetimg", src: "img/rssicon.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    "RSS"]]],
                 ["div", {cla: "formline", id: "ctmrssdiv",
                          style: "display:none;"},
                  [["div", {cla: "formline"},
                    [["RSS combines multiple sources into a single news feed. To follow posts for this theme with ",
                      ["a", {href: "#sampleRSSReader",
                             onclick: jt.fs("window.open('" + sr + "')")},
                       "an RSS reader"],
                      " use this URL:"],
                     ["div", {cla: "formline"}, 
                      ["textarea", {id: "rssurlta", cla: "dlgta"}]]]]]]]];
        return html;
    },
    rssSettingsInit = function () {
        var site, ta;
        site = window.location.href;
        if(site.endsWith("/")) {
            site = site.slice(0, -1); }
        ta = jt.byId('rssurlta');
        if(ta) {
            ta.readOnly = true;
            ta.value = site + "/rsscoop?coop=" + 
                jt.instId(dst.obj); }
    },


    soloSettingsHTML = function () {
        var html;
        if(dst.type !== "coop" || app.coop.membershipLevel(dst.obj) < 3 ||
               !jt.isId(jt.instId(dst.obj))) {
            return ""; }
        dst.obj.soloset = dst.obj.soloset || {};
        dst.obj.soloset.colors = dst.obj.soloset.colors ||
            [{name: "backgrnd", value: "#d8d8dd"},
             {name: "tab", value: "#789897"},
             {name: "link", value: "#521919"},
             {name: "hover", value: "#885555"}];
        html = [];
        dst.obj.soloset.colors.forEach(function (cdef) {
            html.push(["div", {cla: "formline"},
                       [["label", {fo: cdef.name + "in", cla: "liflab"},
                         cdef.name],
                        ["input", {id: cdef.name + "in", cla: "lifin",
                                   type: "color", value: cdef.value}]]]); });
        html = ["div", {cla: "formline"},
                [["a", {href: "#togglepermcolors",
                        onclick: jt.fs("app.layout.togdisp('ctmcolordiv')")},
                  [["img", {cla: "ctmsetimg", src: "img/colors.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    "Permalink Page Colors"]]],
                 ["div", {cla: "formline", id: "ctmcolordiv",
                          style: "display:none;"},
                  [html,
                   ["div", {cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "savecolorsbutton",
                                onclick: jt.fs("app.pcd.saveSoloColors()")},
                     "Update Colors"]],
                   ["div", {cla: "formline", id: "colorupderrdiv"}]]]]];
        return html;
    },


    embedSettingsHTML = function () {
        var html;
        if(dst.type !== "coop" || !jt.isId(jt.instId(dst.obj))) {
            return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#embed", onclick: jt.fs("app.pcd.embedHelp()")},
                  [["img", {cla: "ctmsetimg", src: "img/embed.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    "Embed Theme"]]]]];
        return html;
    },
    embedSettingsInit = function () {
        var site, ta;
        site = window.location.href;
        if(site.endsWith("/")) {
            site = site.slice(0, -1); }
        ta = jt.byId('ctmembedta');
        if(ta) {
            ta.readOnly = true;
            ta.value = "<div id=\"membicdiv\"><a href=\"" + site + 
                "?view=coop&coopid=" + dst.id + "&css=none\">" + 
                dst.obj.name + "</a></div>\n" +
                "<script src=\"" + site + "/js/embed.js\"></script>\n"; }
    },
    fillEmbedDialogAreas = function () {
        var dlo, site, ta = jt.byId("embdlta");
        site = window.location.href;
        if(site.endsWith("/")) {
            site = site.slice(0, -1); }
        if(ta) {
            dlo = getDirectLinkInfo();
            ta.readOnly = true;
            ta.value = dlo.url; }
        ta = jt.byId("embscrta");
        if(ta) {
            ta.readOnly = true;
            ta.value = "<div id=\"membicdiv\"><a href=\"" + site + 
                "?view=coop&coopid=" + dst.id + "&css=none\">" + 
                dst.obj.name + "</a></div>\n" +
                "<script src=\"" + site + "/js/embed.js\"></script>\n"; }
        ta = jt.byId("embwpta");
        if(ta) {
            ta.readOnly = true;
            ta.value = site + "/rsscoop?coop=" + jt.instId(dst.obj); }
    },


    permalinkInfoHTML = function () {
        var html;
        if(dst.type !== "coop" || app.coop.membershipLevel(dst.obj) < 3 ||
               !jt.isId(jt.instId(dst.obj))) {
            return ""; }
        html = ["a", {href: "solopageinfo",
                      onclick: jt.fs(
                          "app.layout.displayDoc('docs/themepage.html')")},
                ["&nbsp;",
                 ["img", {cla: "ctmsetimg", src: "img/info.png"}]]];
        return html;
    },


    signInToFollowHTML = function () {
        var html, url;
        //if they are logged in, then they will know enough to click
        //the membic icon to go to the main site.  No need for a message.
        if(app.login.isLoggedIn() || (dst.type !== "coop")) {
            return ""; }
        html = "Sign in to follow or join.<br/>";
        if(app.solopage()) {
            url = app.hardhome + "?view=coop&coopid=" + dst.id;
            html = ["a", {href: url, title: dst.obj.name + " full page",
                          onclick: jt.fs("window.open('" + url + "')")},
                    html]; }
        return html;
    },


    historyCheckpoint = function () {
        var histrec = { view: dst.type, tab: dst.tab };
        histrec[dst.type + "id"] = dst.id;
        app.history.checkpoint(histrec);
    },


    titleForTab = function (tab) {
        var title;
        if(app.pen.myPenId() === dst.id) {
            title = tab.mtitle; }
        else {
            title = tab.otitle;
            title = title.replace(/\$NAME/g, dst.obj.name); }
        return title;
    },


    tabHTMLFromDef = function (tabname) {
        var ico, html;
        ico = ["img", {cla: "tabico", src: knowntabs[tabname].img}];
        if(knowntabs[tabname].img === "calico") {
            ico = calendarIconHTML(); }
        html = ["li", {id: tabname + "li", cla: "unselectedTab"},
                ["a", {href: knowntabs[tabname].href,
                       title: titleForTab(knowntabs[tabname]),
                       onclick: jt.fs("app.pcd.tabsel('" + tabname + "')")},
                 ico]];
        return html;
    },


    getRecentReviews = function () {
        var revs, rt;
        revs = app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent);
        rt = app.layout.getType();
        if(rt !== "all") {
            revs = revs.filter(function (rev) {
                if(rev.revtype === rt) {
                    return true; } }); }
        return revs;
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayRecent = function (expid) {
        app.review.displayReviews('pcdcontdiv', "pcd", getRecentReviews(), 
                                  "app.pcd.toggleRevExpansion", 
                                  ((dst.type === "coop") && !app.solopage()));
        if(expid === "settings") {
            app.pcd.settings(dst.obj); }
        else if(expid) {
            app.pcd.toggleRevExpansion("pcd", expid); }
    },


    getFavoriteReviews = function () {
        var revids, rt, tops, revs;
        tops = dst.obj.top20s || {};
        if(!tops.all) {
            tops.all = [];
            app.review.getReviewTypes().forEach(function (rt) {
                tops.all = tops.all.concat(tops[rt.type] || []); });
            revs = app.lcs.resolveIdArrayToCachedObjs("rev", tops.all);
            revs.sort(function (a, b) {
                if(a.rating < b.rating) { return 1; }
                if(a.rating > b.rating) { return -1; }
                if(a.modified < b.modified) { return 1; }
                if(a.modified > b.modified) { return -1; }
                return 0; });
            tops.all = app.lcs.objArrayToIdArray(revs); }
        rt = app.layout.getType();
        revids = tops[rt] || [];
        return app.lcs.resolveIdArrayToCachedObjs("rev", revids);
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayFavorites = function () {
        app.review.displayReviews('pcdcontdiv', "pcd", getFavoriteReviews(),
                                  "app.pcd.toggleRevExpansion", 
                                  ((dst.type === "coop") && !app.solopage()));
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayRemembered = function () {
        app.activity.displayRemembered('pcdcontdiv');
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displaySearch = function () {
        var html;
        html = [["div", {id: "pcdsrchdiv"},
                 ["input", {type: "text", id: "pcdsrchin", size: 40,
                            placeholder: "Membic title or keyword",
                            value: srchst.qstr}]],
                ["div", {id: "pcdsrchdispdiv"}]];
        jt.out('pcdcontdiv', jt.tac2html(html));
        srchst.status = "initializing";
        app.pcd.searchReviews();
        jt.byId('pcdsrchin').focus();
    },


    //logic here needs to be the same as in rev.py is_matching_review
    isMatchingReview = function (qstr, rev) {
        var keywords;
        if(srchst.revtype !== "all" && srchst.revtype !== rev.revtype) {
            return false; }
        if(!qstr) {
            return true; }
        qstr = qstr.toLowerCase();
        if(rev.cankey.indexOf(qstr) >= 0) {
            return true; }
        keywords = rev.keywords || "";
        keywords = keywords.toLowerCase();
        if(keywords.indexOf(qstr) >= 0) {
            return true; }
        return false;
    },


    searchFilterReviews = function (revs, recent) {
        var merged = [], candidate;
        recent.sort(function (a, b) {
            if(a.modified > b.modified) { return -1; }
            if(a.modified < b.modified) { return 1; }
            return 0; });
        //both arrays are now sorted by modified in descending order
        while(revs.length || recent.length) {
            if(!recent.length || (revs.length && 
                                  revs[0].modified >= recent[0].modified)) {
                candidate = revs.shift(); }
            else {
                candidate = recent.shift(); }
            if(isMatchingReview(srchst.qstr, candidate)) {
                merged.push(candidate); } }
        return merged;
    },


    displaySearchResults = function () {
        app.review.displayReviews('pcdsrchdispdiv', "pcd", srchst.revs, 
                                  "app.pcd.toggleRevExpansion", 
                                  (dst.type === "coop"));
        srchst.status = "waiting";
        setTimeout(app.pcd.searchReviews, 400);
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayCalendar = function () {
        jt.out('pcdcontdiv', dst.obj.calembed);
    },


    tabsHTML = function () {
        var html = [];
        html.push(tabHTMLFromDef("latest"));
        html.push(tabHTMLFromDef("favorites"));
        if(!app.solopage() && dst.id === app.pen.myPenId()) {
            html.push(tabHTMLFromDef("memo")); }
        if(!app.solopage()) {
            html.push(tabHTMLFromDef("search")); }
        if(dst.type === "pen") {
            html.push(tabHTMLFromDef("prefpens"));
            html.push(tabHTMLFromDef("coops")); }
        if(dst.type === "coop" && dst.obj.calembed) {
            html.push(tabHTMLFromDef("calendar")); }
        return html;
    },


    displayTab = function (tabname, expid) {
        var dispfunc;
        tabname = tabname || "latest";
        Object.keys(knowntabs).forEach(function (kt) {
            var elem = jt.byId(kt + "li");
            if(elem) {
                elem.className = "unselectedTab"; } });
        jt.byId(tabname + "li").className = "selectedTab";
        dst.tab = tabname;
        historyCheckpoint();  //history collapses tab changes
        jt.out('tabtitlediv', titleForTab(knowntabs[tabname]));
        dispfunc = knowntabs[tabname].dispfunc;
        app.layout.displayTypes(dispfunc);  //connect type filtering
        if(jt.isId(jt.instId(dst.obj))) {
            return dispfunc(expid); }
        jt.out('pcdcontdiv', dst.type.capitalize() + " settings required");
        app.pcd.settings();
    },


    displayRSSAndHomeLinks = function () {
        var coords, absdiv, html, homeurl, rssurl;
        coords = jt.geoPos(jt.byId('tabsdiv'));
        absdiv = jt.byId('overlaydiv');
        absdiv.style.left = (dst.type === "pen"? "230px" : "130px");
        absdiv.style.top = String(coords.y - 10) + "px";
        absdiv.style.background = "transparent";
        absdiv.style.border = "none";
        absdiv.style.boxShadow = "none";
        absdiv.style.visibility = "visible";
        homeurl = app.hardhome + "?view=coop&coopid=" + dst.id;
        rssurl = app.hardhome + "/rsscoop?coop=" + dst.id;
        html = [["a", {href: homeurl, title: dst.obj.name + " full page",
                       onclick: jt.fs("window.open('" + homeurl + "')")},
                 ["img", {cla: "reviewbadge", src: "img/membiclogo.png"}]],
                "&nbsp; &nbsp;",
                ["a", {href: rssurl, title: dst.obj.name + " RSS feed",
                       onclick: jt.fs("window.open('" + rssurl + "')")},
                 ["img", {cla: "webjump", src: "img/rssicon.png"}]]];
        jt.out('overlaydiv', jt.tac2html(html));
    },


    backgroundVerifyObjectData = function () {
        var pen;
        if(dst.type === "coop" && jt.hasId(dst.obj)) {
            pen = app.pen.myPenName();
            if(app.coop.membershipLevel(dst.obj, app.pen.myPenId()) > 0 &&
               !(pen.coops && pen.coops.csvcontains(jt.instId(dst.obj)))) {
                app.pcd.follow(); } }
    },


    createColorOverrides = function () {
        var ckeys, sheet;
        if(!dst || !dst.obj || !dst.obj.soloset || ! dst.obj.soloset.colors) {
            return; }
        ckeys = { backgrnd: { sel: "body", attr: "background"},
                  tab: {sel: ".unselectedTab", attr: "background"},
                  link: {sel: "A:link,A:visited,A:active", attr: "color"},
                  hover: {sel: "A:hover", attr: "color"} };
        sheet = window.document.styleSheets[0];
        dst.obj.soloset.colors = dst.obj.soloset.colors || [];
        dst.obj.soloset.colors.forEach(function (cdef) {
            var sels = ckeys[cdef.name].sel.csvarray();
            sels.forEach(function (sel) {
                var rule = sel + " { " + ckeys[cdef.name].attr + ": " +
                    cdef.value + "; }";
                sheet.insertRule(rule, sheet.cssRules.length); }); });
    },


    changeSiteTabIcon = function () {
        var link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = "ctmpic?" + dst.type + "id=" + dst.id;
        document.getElementsByTagName('head')[0].appendChild(link);
    },


    displayObject = function (obj, expid) {
        var defs, html;
        obj = obj || dst.obj;
        dst.obj = obj;
        app.layout.cancelOverlay();  //close user menu if open
        app.layout.closeDialog();    //close search dialog if open
        historyCheckpoint();
        defs = dst[dst.type];
        html = ["div", {id: "pcdouterdiv"},
                [["div", {id: "pcdupperdiv"},
                  [["div", {id: "pcdpicdiv"},
                    ["img", {cla: "pcdpic", src: picImgSrc(obj)}]],
                   ["div", {id: "pcddescrdiv"},
                    [["div", {id: "pcdnamediv"},
                      [["a", {href: defs.accsrc + jt.instId(obj),
                              onclick: jt.fs("app.pcd.share()")},
                        [["span", {id: "namearrowspan", cla: "penbutton"}, 
                          ["img", {id: "pnarw", src: "img/arrow18right.png"}]],
                         ["span", {cla: "penfont"}, obj.name]]],
                       ["span", {cla: "penbutton"},
                        modButtonsHTML(obj)]]],
                     ["div", {id: "ppcdshoutdiv"},
                      ["span", {cla: "shoutspan"}, 
                       jt.linkify(obj[defs.descfield] || "")]]]]]],
                 ["div", {id: "tabsdiv"},
                  [["ul", {id: "tabsul"},
                    tabsHTML()],
                   ["div", {id: "tabtitlediv"}]]],
                 ["div", {id: "pcdcontdiv"}]]];
        jt.out('contentdiv', jt.tac2html(html));
        if(app.solopage()) {
            createColorOverrides();
            changeSiteTabIcon();
            displayRSSAndHomeLinks(); }
        setTimeout(backgroundVerifyObjectData, 100);
        displayTab(dst.tab, expid);
    },


    displayRetrievalWaitMessage = function (divid, dtype, id) {
        var mpi, msg;
        mpi = app.pen.myPenId();
        msg = "Retrieving " + dtype.capitalize() + " " + id + "...";
        if(dtype === "coop") {
            msg = "Retrieving cooperative theme " + id + "...";
            if(app.coopnames[id]) {
                msg = "Retrieving " + app.coopnames[id] + "..."; } }
        else if(dtype === "pen") {
            if((!id && !mpi) || (id && id === mpi)) {
                //"Retrieving your Pen Name" was kind of confusing
                //because they are just waiting for their content...
                msg = "Retrieving your membics..."; }
            else if(app.pennames[id]) {
                msg = "Retrieving " + app.pennames[id] + "..."; }
            else {
                msg = "Retrieving Pen Name " + id + "..."; } }
        app.displayWaitProgress(0, 750, divid, msg);
    },


    shareViaAddToAny = function (name, url) {
        var js;
        try {
            if(!addToAnyScriptLoaded) {
                //the script executes on load, so nothing left to do after
                //adding the script tag to the document
                js = document.createElement('script');
                //js.async = true;
                js.type = "text/javascript";
                js.src = "//static.addtoany.com/menu/page.js";
                document.body.appendChild(js);
                jt.log("addtoany script loaded");
                addToAnyScriptLoaded = true; }
            else {
                //reinitialize the sharing display via the API
                jt.log("resetting addtoany config variables and calling init");
                a2a_config.linkname = name;
                a2a_config.linkurl = url;
                a2a.init('page'); }
        } catch(e) {
            jt.log("shareViaAddToAny failed: " + e);
        }
        setTimeout(function () {
            //checking a2a_config === undefined does not work mac ff 42.0
            if(typeof a2a_config === 'undefined') {  //mac ff required test
                jt.out('a2abdiv', "Browser history must be enabled for share buttons"); } },
                   3500);
    },


    shareInviteHTML = function () {
        var html, mlev = app.coop.membershipLevel(dst.obj, app.pen.myPenId());
        //The solo page display uses the overlaydiv to provide RSS and 
        //site return links, so no invite or similar dialogs that use it.
        html = ["div", {id: "invitelinkdiv"},
                ["a", {href: "#invite",
                       onclick: jt.fs("app.coop.showInviteDialog(" + 
                                      mlev + ")")},
                 "Invite"]];
        return html;
    },


    sourceRevIds = function (revs, dtype, id) {
        var revids = [];
        revs.forEach(function (rev) {
            if(dtype !== "coop" || rev.ctmid === id) {
                revids.push(jt.instId(rev)); } });
        return revids;
    },


    verifyFunctionConnections = function () {
        if(!dst.pen.objupdate) {
            dst.pen.objupdate = app.pen.updatePen;
            dst.coop.objupdate = app.coop.updateCoop; }
        if(!knowntabs.latest.dispfunc) {
            knowntabs.latest.dispfunc = displayRecent;
            knowntabs.favorites.dispfunc = displayFavorites;
            knowntabs.memo.dispfunc = displayRemembered;
            knowntabs.search.dispfunc = displaySearch;
            knowntabs.prefpens.dispfunc = app.pcd.displayPrefPens;
            knowntabs.coops.dispfunc = app.pcd.displayCoops;
            knowntabs.calendar.dispfunc = displayCalendar; }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayPrefPens: function (prefpens) {
        var html = [];
        if(!prefpens || (typeof prefpens !== 'object')) {
            return app.pen.prefPens(dst.obj, "pcdcontdiv", 
                                    app.pcd.displayPrefPens); }
        Object.keys(prefpens).forEach(function (penid) {
            var pname = prefpens[penid];
            html.push(["div", {cla: "penlinkdiv"},
                       [["div", {cla: "fpprofdiv"},
                         ["img", {cla: "fpprofpic", alt: "no pic",
                                  src: dst.pen.picsrc + penid}]],
                        ["a", {href: "p/" + penid, cla: "leftspacelink",
                               onclick: jt.fs("app.pen.bypenid('" +
                                              penid + "')")},
                         ["span", {cla: "penfont"}, pname]]]]); });
        if(!html.length) {
            html.push(["div", {cla: "pcdtext"},
                       "No preferred people yet."]); }
        jt.out('pcdcontdiv', jt.tac2html(html));
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayCoops: function (coopnames) {
        var html = [];
        if(!coopnames || (typeof coopnames !== 'object')) {
            return app.pen.coopNames(dst.obj, "pcdcontdiv", 
                                     app.pcd.displayCoops); }
        Object.keys(coopnames).forEach(function (cid) {
            var coopname = coopnames[cid];
            html.push(["div", {cla: "cooplinkdiv"},
                       [["div", {cla: "fpprofdiv"},
                         ["img", {cla: "fpprofpic", alt: "no pic",
                                  src: dst.coop.picsrc + cid}]],
                        ["a", {href: "t/" + cid,
                               onclick: jt.fs("app.coop.bycoopid('" +
                                              cid + "')")},
                         ["span", {cla: "penfont"}, coopname]]]]); });
        if(app.pen.myPenId() === jt.instId(dst.obj)) {
            html.push(["div", {cla: "pcdtext"},
                       [["div", {cla: "pcdtoggle"},
                         ["a", {href: "#findcoops",
                                onclick: jt.fs("app.pcd.toggleFindCoops()")},
                          "Follow cooperative themes"]],
                        ["div", {id: "findctmdiv"}]]]);
            html.push(["div", {cla: "pcdtext"},
                       [["div", {cla: "pcdtoggle"},
                         ["a", {href: "#createcoop",
                                onclick: jt.fs("app.pcd.toggleCreateCoop()")},
                          "Create cooperative theme"]],
                        ["div", {id: "createctmdiv"}]]]); }
        if(!html.length) {
            html.push(["div", {cla: "pcdtext"}, 
                       "No theme memberships found."]); }
        jt.out('pcdcontdiv', jt.tac2html(html));
    },


    settings: function (obj) {
        var html;
        if(obj) {
            dst.obj = obj; }
        html = ["div", {id: "pcdsettingsdlgdiv"},
                [["div", {cla: "bumpedupwards"},
                  ["div", {cla: "headingtxt"}, "Settings"]],
                 ["div", {cla: "pcdsectiondiv"},
                  adminSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  (dst.type === "pen"? app.login.accountSettingsHTML()
                                     : membershipSettingsHTML())],
                 ["div", {cla: "pcdsectiondiv"},
                  picSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  descripSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  keywordSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  calendarSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  rssSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  soloSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  embedSettingsHTML()]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   app.login.accountSettingsInit();
                                   picSettingsInit();
                                   descripSettingsInit();
                                   calSettingsInit();
                                   rssSettingsInit();
                                   embedSettingsInit(); });
    },


    embedHelp: function () {
        var html, homeurl = app.hardhome + "?view=coop&coopid=" + dst.id;
        html = ["div", {id: "pcdembeddlgdiv"},
                //frame
                [["div", {cla: "pcdsectiondiv"},
                  ["You are welcome to embed the ",
                   ["a", {href: homeurl,
                          onclick: jt.fs("window.open('" + homeurl + "')")},
                    dst.obj.name + " direct theme page"],
                   " into your own site using your website management interface or JavaScript. To embed as a frame using your website management interface, use this direct URL:",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embdlta", cla: "embdlgta"}]]]],
                 //embed
                 ["div", {cla: "pcdsectiondiv"},
                  ["If you have an existing page where you want to insert the contents of " + dst.obj.name + ", paste in the following script where you want the content to appear:",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embscrta", cla: "embdlgta", rows: 4}]],
                   "When the embed.js script runs, it replaces the link with the contents of your theme."]],
                 //wordpress
                 ["div", {cla: "pcdsectiondiv"},
                  ["If you are using WordPress, content editing may prevent you from creating a frame or specifying a source for JavaScript.  In that case your best option may be to show recent membics for your theme via an RSS feed instead.  For example you might choose",
                   ["div", {cla: "embdlgline"},
                    "Customize | Widgets | Sidebar | Add a Widget | RSS"],
                   "then use the following URL:",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embwpta", cla: "embdlgta"}]]]],
                 //back
                 ["div", {cla: "pcdsectiondiv"},
                  ["a", {href: "#settings",
                         onclick: jt.fs("app.pcd.settings()")},
                   [["img", {src: "img/arrow18left.png"}],
                    " Return to Settings"]]]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   fillEmbedDialogAreas(); });
    },


    follow: function () {
        var pen, ctmid;
        if(dst.type === "coop" && jt.hasId(dst.obj)) {
            ctmid = jt.instId(dst.obj);
            pen = app.pen.myPenName();
            pen.coops = pen.coops || "";
            if(!pen.coops.csvcontains(ctmid)) {
                pen.coops = pen.coops.csvappend(ctmid);
                app.pen.updatePen(pen, app.pcd.redisplay, app.failf); } }
    },


    saveDescription: function () {
        var changed = false, defs, elem, val, okfunc, failfunc;
        jt.byId('okbutton').disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("namein");
        if(elem && elem.value && elem.value.trim()) {
            val = elem.value.trim();
            if(dst.obj.name !== val) {
                dst.obj.name = val;
                changed = true; } }
        elem = jt.byId('shouteditbox');
        if(elem && elem.value !== dst.obj[defs.descfield]) {
            dst.obj[defs.descfield] = elem.value;
            changed = true; }
        if(!changed) {
            return app.layout.cancelOverlay(); }
        if(changed) {
            okfunc = function (updobj) {
                if(dst.type === "coop") {
                    setTimeout(function () {
                        app.coop.verifyPenStash(dst.obj); }, 50); }
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId('okbutton').disabled = false;
                jt.out('formstatdiv', jt.errhtml("Update", code, errtxt)); };
            defs.objupdate(dst.obj, okfunc, failfunc); }
    },


    updateKeywords: function () {
        var val;
        if(dst.type === "pen") {
            app.review.getReviewTypes().forEach(function (rt) {
                val = jt.byId("kwcsvin" + rt.type).value;
                dst.obj.stash.keywords[rt.type] = val; });
            app.pen.updatePen(dst.obj, app.pcd.redisplay, app.failf); }
        else if(dst.type === "coop") {
            val = jt.byId("kwcsvin").value;
            dst.obj.keywords = val;
            app.coop.updateCoop(dst.obj, app.pcd.redisplay, app.failf); }
    },


    monitorPicUpload: function () {
        var tgif, txt, defs, mtag = "Done: ";
        tgif = jt.byId('tgif');
        if(tgif) {
            txt = tgif.contentDocument || tgif.contentWindow.document;
            if(txt && txt.body) {
                txt = txt.body.innerHTML;
                if(txt.indexOf(mtag) === 0) {
                    defs = dst[dst.type];
                    dst.obj[defs.picfield] = dst.id;
                    dst.obj.modified = txt.slice(mtag.length);
                    app.pcd.display(dst.type, dst.id, dst.tab, dst.obj);
                    return; }
                if(txt && txt.trim() && txt.trim() !== "Ready") {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(app.pcd.monitorPicUpload, 800); }
    },


    saveCalEmbed: function () {
        var defs, elem, okfunc, failfunc;
        jt.byId('savecalbutton').disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("calembedta");
        if(elem && elem.value !== dst.obj.calembed) {
            dst.obj.calembed = elem.value;
            okfunc = function (upobj) {
                dst.obj = upobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId('savecalbutton').disabled = false;
                jt.out('calembederrdiv', "Update failed code " + code +
                       ": " + errtxt); };
            defs.objupdate(dst.obj, okfunc, failfunc); }
    },


    saveSoloColors: function () {
        var defs = dst[dst.type];
        jt.byId('savecolorsbutton').disabled = true;
        dst.obj.soloset.colors.forEach(function (cdef, idx) {
            var color = jt.byId(cdef.name + "in").value;
            dst.obj.soloset.colors[idx].value = color; });
        defs.objupdate(dst.obj,
            function (updobj) {
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); },
            function (code, errtxt) {
                jt.byId('savecolorsbutton').disabled = false;
                jt.out('colorupderrdiv', "Update failed code " + code +
                       ": " + errtxt); });
    },


    ctmmem: function (action) {
        if(action === "apply") {
            jt.out("memappbdiv", "Applying..."); }
        else if(action === "withdraw") {
            jt.out("memappbdiv", "Withdrawing..."); }
        else if(action === "accrej") {
            jt.out("memappbdiv", "Acknowledging..."); }
        app.coop.applyForMembership(dst.obj, action, app.pcd.settings);
    },


    ctmdownlev: function () {
        var mlev, confmsg, pen;
        if(!jt.hasId(dst.obj)) {  //creating new coop and not instantiated yet
            app.layout.cancelOverlay();
            return app.pcd.display("pen", app.pen.myPenId(), "coops", 
                                   app.pen.myPenName()); }
        mlev = app.coop.membershipLevel(dst.obj);
        confmsg = ctmmsgs[mlev].resconf;
        if(confmsg && !confirm(confmsg)) {
            return; }
        if(mlev > 0) {
            jt.out('rsbdiv', "Resigning");
            app.coop.processMembership(dst.obj, "demote", app.pen.myPenId(),
                                        "", app.pcd.settings); }
        else {
            jt.out('rsbdiv', "Stopping");
            pen = app.pen.myPenName();
            pen.coops = pen.coops.csvremove(dst.id);
            app.pen.updatePen(pen, app.pcd.redisplay, app.failf); }
    },


    share: function () {
        var descrdiv, shurlspan, defs, html, dlo;
        descrdiv = jt.byId("ppcdshoutdiv");
        if(descrdiv) {
            defs = dst[dst.type];
            shurlspan = jt.byId("shurlspan");
            if(shurlspan) {
                jt.byId('pnarw').src = "img/arrow18right.png";
                jt.out("ppcdshoutdiv", jt.tac2html(
                    ["span", {cla: "shoutspan"}, 
                     jt.linkify(dst.obj[defs.descfield] || "")])); }
            else {
                dlo = getDirectLinkInfo();
                jt.byId('pnarw').src = "img/arrow18down.png";
                html = [
                    ["span", {cla: "shoutspan"},
                     signInToFollowHTML()],
                    ["div", {cla: "a2a_kit a2a_kit_size_32 a2a_default_style",
                             id: "a2abdiv"},
                     [["a", {cla: "a2a_dd",
                             href: "https://www.addtoany.com/share_save"}],
                      ["a", {cla: "a2a_button_facebook"}],
                      ["a", {cla: "a2a_button_twitter"}],
                      ["a", {cla: "a2a_button_google_plus"}],
                      ["a", {cla: "a2a_button_wordpress"}],
                      shareInviteHTML()]],
                    ["span", {cla: "shoutspan"}, dlo.title],
                    permalinkInfoHTML(),
                    ["br"],
                    ["span", {id: "shurlspan"},
                     ["a", {href: dlo.url,
                            onclick: jt.fs("window.open('" + dlo.url + "')")},
                      dlo.url]]];
                jt.out("ppcdshoutdiv", jt.tac2html(html));
                //make sure the above html is in place before loading
                //the autorun addtoany script. Break the control flow,
                //but not enough to be laggy if already loaded.
                setTimeout(function () {
                    shareViaAddToAny(dst.obj.name, dlo.url); }, 80); } }
    },


    reviewItemNameHTML: function (type, revobj) {
        var linktxt = "";
        if(type.subkey) {
            linktxt = "<i>" + jt.ellipsis(revobj[type.key], 60) + "</i> " +
                jt.ellipsis(revobj[type.subkey], 40); }
        else {
            linktxt = jt.ellipsis(revobj[type.key], 60); }
        return linktxt;
    },


    searchReviews: function () {
        var srchin, html;
        srchin = jt.byId("pcdsrchin");
        if(!srchin) {  //query input no longer on screen.  probably switched
            return; }  //tabs so just quit
        if(!app.login.isLoggedIn()) {
            jt.out('pcdsrchdispdiv', "Sign in to search");
            return; }
        if(!srchst.status !== "processing" && 
              (srchst.status === "initializing" ||
               srchst.revtype !== app.layout.getType() ||
               srchst.qstr !== srchin.value)) {
            srchst.status = "processing";
            srchst.qstr = srchin.value;
            srchst.revtype = app.layout.getType();
            srchst.revs = searchFilterReviews(srchst.revs || [], 
                app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent));
            displaySearchResults();  //clears the display if none matching
            if(!srchst.revs.length && dst.obj.recent.length >= 50) {
                //there are likely more revs on server, offer to go fetch
                html = ["div", {cla: "searchbuttondiv"},
                        ["button", {type: "button", id: "searchserverbutton",
                                    onclick: jt.fs("app.pcd.searchServer()")},
                         "Search Server"]];
                jt.out('pcdsrchdispdiv', jt.tac2html(html)); } }
        else {  //no change to search parameters yet, monitor
            setTimeout(app.pcd.searchReviews, 400); }
    },


    searchServer: function () {
        var params;
        app.displayWaitProgress(0, 1600, 'pcdsrchdispdiv', 
                                "Searching...",
                                "Many reviews or slow data connection...");
        params = app.login.authparams() + 
            "&qstr=" + jt.enc(jt.canonize(srchst.qstr)) +
            "&revtype=" + app.typeOrBlank(srchst.revtype) +
            "&" + (dst.type === "coop"? "ctmid=" : "penid=") +
            jt.instId(dst.obj) + jt.ts("&cb=", "hour");
        jt.call('GET', "srchrevs?" + params, null,
                function (revs) {
                    app.lcs.putAll("rev", revs);
                    srchst.revs = revs;
                    displaySearchResults(); },
                app.failf(function (code, errtxt) {
                    jt.out('pcdsrchdispdiv', "searchReviews failed: " + 
                           code + " " + errtxt); }),
                jt.semaphore("pcd.searchReviews"));
    },


    toggleRevExpansion: function (prefix, revid) {
        var revs;
        if(app.solopage()) {
            return window.open("?view=" + dst.type + "&" +
                               (dst.type === "coop"? "ctmid=" : "penid=") +
                               dst.id + "&tab=" + dst.tab + 
                               "&expid=" + revid); }
        switch(dst.tab) {
        case "latest":
            revs = getRecentReviews();
            break;
        case "favorites":
            revs = getFavoriteReviews();
            break;
        case "memo":
            revs = app.activity.getRememberedMembics();
            break;
        case "search":
            revs = srchst.revs;
            break;
        default:
            jt.err("pcd.toggleRevExpansion unknown tab " + dst.tab); }
        app.review.toggleExpansion(revs, prefix, revid);
    },


    toggleFindCoops: function () {
        var html;
        html = ["When you see something interesting in the ",
                ["a", {href: "#home",
                       onclick: jt.fs("app.activity.displayFeed()")},
                 ["community membics",
                  ["img", {src: "img/membiclogo.png", cla: "hthimg"}]]],
                ", click the title to see if it was posted to any cooperative themes. If it was, you can click through to the theme and follow it. After following, you can apply for membership if you want to contribute."];
        if(!jt.byId("findctmdiv").innerHTML) {
            jt.out('findctmdiv', jt.tac2html(html)); }
        else {
            jt.out('findctmdiv', ""); }
    },


    toggleCreateCoop: function () {
        var html;
        html = ["A cooperative theme holds a curated collection of membics contributed by one or more pen names. As a creating Founder, you will have full privileges to manage other members and posts as you want.",
                ["div", {cla: "formbuttonsdiv"},
                 ["button", {type: "button", id: "createcoopbutton",
                             onclick: jt.fs("app.pcd.display('coop')")},
                  "Create New Theme"]]];
        if(!jt.byId("createctmdiv").innerHTML) {
            jt.out('createctmdiv', jt.tac2html(html)); }
        else {
            jt.out('createctmdiv', ""); }
    },


    toggleCtmDet: function (ctype) {
        var midispdiv = jt.byId('midispdiv');
        if(ctype === "info" && (setdispstate.infomode !== "info" ||
                                !midispdiv.innerHTML)) {
            setdispstate.infomode = "info";
            jt.byId('midispdiv').style.display = "block";
            if(dst.type === "coop") {
                jt.out('midispdiv', coopLogHTML()); }
            else {
                jt.out('midispdiv', accountInfoHTML()); } }
        else if(ctype === "mbinfo" && (setdispstate.infomode !== "finfo" ||
                                       !midispdiv.innerHTML)) {
            setdispstate.infomode = "finfo";
            jt.byId('midispdiv').style.display = "block";
            jt.out('midispdiv', coopLogHTML("membership")); }
        else if(ctype === "members" && (setdispstate.infomode !== "members" ||
                                        !midispdiv.innerHTML)) {
            setdispstate.infomode = "members";
            jt.byId('midispdiv').style.display = "block";
            jt.out('midispdiv', coopMembershipHTML()); }
        else {
            app.layout.togdisp("midispdiv"); }
    },


    memapp: function (verb, penid) {
        var elem;
        switch(verb) {
        case "reject":
            elem = jt.byId("reasondiv" + penid);
            if(elem.style.display !== "block") {
                elem.style.display = "block";
                jt.byId("reasonin" + penid).focus(); }
            else {
                elem = jt.byId("reasonin" + penid);
                if(!elem.value || !elem.value.trim()) {
                    jt.byId("reasonlab" + penid).style.color = "red"; }
                else { //have reason
                    jt.out("abdiv" + penid, "Rejecting...");
                    app.coop.processMembership(dst.obj, verb, penid, 
                                                elem.value.trim(),
                                                app.pcd.settings); } }
            break;
        case "accept":
            jt.out("abdiv" + penid, "Accepting...");
            app.coop.processMembership(dst.obj, verb, penid, "", 
                                        app.pcd.settings);
            break;
        default:
            jt.log("pcd.memapp unknown verb: " + verb); }
    },


    memdem: function (penid) {
        var elem;
        elem = jt.byId("reasonin" + penid);
        if(elem && elem.value.trim()) {
            jt.out("memdembuttondiv" + penid, "Demoting...");
            app.coop.processMembership(dst.obj, "demote", penid, 
                                        elem.value.trim(),
                                        app.pcd.settings); }
    },


    tabsel: function (tabname) {
        displayTab(tabname);
    },


    display: function (dtype, id, tab, obj, expid) {
        verifyFunctionConnections();
        dst.type = dtype || "pen";
        dst.id = id || (obj? jt.instId(obj) : "") || 
            (dst.type === "pen"? app.pen.myPenId() : "") || "";
        dst.tab = tab || "latest";
        if(obj) {
            return displayObject(obj, expid); }
        if(dst.id) {
            return app.pcd.fetchAndDisplay(dst.type, dst.id, dst.tab); }
        if(dtype === "coop") {  //creating new coop
            dst.obj = { name: "", description: "", 
                        people: {}, founders: app.pen.myPenId() };
            dst.obj.people[app.pen.myPenId()] = app.pen.myPenName().name;
            return displayObject(dst.obj); }
        jt.err("pcd.display called with inadequate data");
    },


    redisplay: function () {
        app.pcd.display(dst.type, dst.id, dst.tab, dst.obj);
    },


    resetState: function () {
        dst.type = "";
        dst.id = "";
        dst.tab = "";
        dst.obj = null;
        srchst = { revtype: "all", qstr: "", status: "" };
        setdispstate = { infomode: "" };
    },


    getDisplayState: function () {
        return dst;
    },


    blockfetch: function (dtype, id, callback, divid) {
        var objref, url, time;
        divid = divid || 'contentdiv';
        if(dtype === "pen" && !id) {
            id = app.pen.myPenId(); }
        objref = app.lcs.getRef(dtype, id);
        if(objref && objref[dtype] && objref[dtype].recent) {
            return callback(objref[dtype]); }
        displayRetrievalWaitMessage(divid, dtype, id);
        url = "blockfetch?" + app.login.authparams();
        if(dtype === "pen" && id !== app.pen.myPenId()) {
            url += "&penid=" + id; }  //penid not specified if retrieving self
        if(dtype === "coop") {
            url += "&ctmid=" + id; }
        url += jt.ts("&cb=", "hour");
        time = new Date().getTime();
        jt.call('GET', url, null,
                function (objs) {  // main obj + recent/top reviews
                    var obj, revs;
                    time = new Date().getTime() - time;
                    jt.log("blockfetch " + dtype + " " + id  + 
                           " returned in " + time/1000 + " seconds.");
                    jt.out(divid, "");
                    if(!objs.length || !objs[0]) {
                        if(dtype === "pen") {
                            return app.pen.newPenName(callback); }
                        app.lcs.tomb(dtype, id, "blockfetch failed");
                        return callback(null); }
                    obj = objs[0];  //PenName or Coop instance
                    revs = objs.slice(1);
                    revs.sort(function (a, b) {
                        if(a.modified < b.modified) { return 1; }
                        if(a.modified > b.modified) { return -1; }
                        return 0; });
                    app.lcs.putAll("rev", revs);
                    obj.recent = sourceRevIds(revs, dtype, id);
                    app.lcs.put(dtype, obj);
                    app.login.noteAccountInfo(obj);
                    jt.log("blockfetch cached " + dtype + " " + jt.instId(obj));
                    if(dtype === "coop") {
                        app.coop.verifyPenStash(obj); }
                    callback(obj); },
                app.failf(function (code, errtxt) {
                    jt.log("blockfetch " + code + ": " + errtxt);
                    callback(null); }),
                jt.semaphore("pcd.blockfetch" + dtype + id));
    },


    fetchAndDisplay: function (dtype, id, tab, expid) {
        app.pcd.blockfetch(dtype, id, function (obj) {
            if(!obj) {
                jt.log("pcd.fetchAndDisplay no obj");
                return app.activity.redisplay(); }
            app.pcd.display(dtype, id, tab || "", obj, expid); });
    }

};  //end of returned functions
}());

