/*global app, jt, window, confirm, document */

/*jslint browser, multivar, white, fudge, for */

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
                profile: { desclabel: "About Me",
                           descplace: "A message for visitors to your profile. Any links you want to share?",
                           descfield: "aboutme",
                           piclabel: "Profile Pic",
                           picfield: "profpic",
                           picsrc: "profpic?profileid=" },
                coop: { desclabel: "Description",
                        descplace: "What is this cooperative theme focused on? What's appropriate to post?",
                        descfield: "description", 
                        piclabel: "Theme Pic",
                        picfield: "picture",
                        picsrc: "ctmpic?coopid=" } },
        srchst = { mtypes:"", kwrds:"", mode:"nokeys", qstr:"", status:"" },
        setdispstate = { infomode: "" },
        standardOverrideColors = [
            {name:"tab", value:"#ffae50", sel:".tablinksel", attr:"background"},
            {name:"link", value:"#84521a", sel: "A:link,A:visited,A:active", 
             attr:"color"},
            {name:"hover", value:"#a05705", sel:"A:hover", attr:"color"}],
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

    getDirectLinkInfo = function (usehashtag) {
        //var infobj = {title: "", url: "https://" + window.location.host};
        var infobj = {title: "", url: app.hardhome};
        if(dst.type === "pen") {
            infobj.url += "/p/" + dst.id;
            infobj.title = "Direct profile URL:"; }
        else if(usehashtag && dst.obj && dst.obj.hashtag) {
            infobj.url += "/" + dst.obj.hashtag;
            infobj.title = "Custom direct theme URL:"; }
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
        if(app.solopage()) {
            return ""; }
        var html = "";
        if(dst.type === "profile") {
            if(obj.instid === app.profile.myProfId()) {
                html = ["a", {id:"pcdsettingslink", href:"#profilesettings",
                              title:"Profile Settings",
                              onclick:jt.fs("app.pcd.settings()")},
                        ["img", {cla:"reviewbadge",
                                 src:"img/settings.png"}]]; } }
        else if(dst.type === "coop" && app.profile.myProfId()) {
            if(obj.instid && app.profile.themeLevel(obj.instid)) {
                html = ["a", {id:"pcdsettingslink", href:"#coopsettings",
                              title: "Theme settings",
                              onclick:jt.fs("app.pcd.settings()")},
                        ["img", {cla:"reviewbadge",
                                 src:"img/settings.png"}]]; }
            else {
                html = ["span", {id:"followbuttonspan"},
                        ["button", {type:"button", id:"followbutton",
                                    onclick:jt.fs("app.pcd.follow()")},
                         "Follow"]]; } }
        return jt.tac2html(html);
    },


    accountInfoHTML = function () {
        var html = "";
        if(dst.type === "pen") {
            html = ["p", "Last modified " + 
                    jt.colloquialDate(jt.isoString2Day(dst.obj.modified))]; }
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
                        onclick: jt.fs("app.pen.bypenid('" + penid + 
                                       "','membapp')")},
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
                      onclick: jt.fs("app.pen.bypenid('" + penid + 
                                     "','adminlog')")},
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
            var people, penids = dst.obj[field].csvarruniq();
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


    statSummaryHTML = function () {
        var html, dat = dst.obj.mctr;
        if(!dat) {
            return "No stats available."; }
        html = ["table", {style: "margin:auto;"},
                [["tr",
                  [["td", {style: "text-align:right;padding-right:10px;"}, 
                    "Visits Today:"],
                   ["td", ["em", String((dat.sitev || 0) + (dat.sitek || 0) +
                                        (dat.permv || 0) + (dat.permk || 0) +
                                        (dat.rssv || 0))]]]],
                 ["tr",
                  [["td", {style: "text-align:right;padding-right:10px;"}, 
                    "Membics:"],
                   ["td", ["em", String(dat.membics || 0)]]]],
                 ["tr",
                  [["td", {style: "text-align:right;padding-right:10px;"}, 
                    "Actions:"],
                   ["td", ["em", String((dat.starred || 0) +
                                 (dat.remembered || 0) +
                                 (dat.responded || 0))]]]]]];
        return jt.tac2html(html);
    },


    statsDisplayHTML = function () {
        var sumh, html;
        if(dst.obj.mctr) { 
            sumh = statSummaryHTML(); }
        else {
            sumh = "fetching stats...";
            app.fork({
                descr:"stats data retrieval",
                func:function () {  //fetch after initial display finished
                    var params = app.login.authparams() + "&ctype=" + dst.type +
                        "&parentid=" + dst.id + jt.ts("&cb=", "minute");
                    jt.call("GET", "currstats?" + params, null,
                            function (mctrs) {
                                dst.obj.mctr = mctrs[0];
                                jt.out("statsumdiv", statSummaryHTML()); },
                            app.failf(function (code, errtxt) {
                                jt.out("statsumdiv", "currstats failed " +
                                       code + ": " + errtxt); }),
                            jt.semaphore("pcd.fetchStats")); },
                ms:200}); }
        html = ["div", {id: "statsdisplaydiv"},
                [["div", {id: "statsumdiv"}, sumh],
                 ["div", {cla: "formbuttonsdiv", id: "statsvisbdiv"},
                  ["button", {type: "button",
                              onclick: jt.fs("window.open('/docs/stat.html" +
                                             "?ctype=" + dst.type +
                                             "&parentid=" + dst.id + 
                                             "&" + app.login.authparams() +
                                             "&penid=" + app.pen.myPenId() +
                                             "&title=" + jt.enc(dst.obj.name) +
                                             "')")},
                   "Visualize All"]]]];
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
                           style: (memsel? "" : "display:none;")}, 
                   memsel],
                  ["div", {id: "reloaddiv",
                           style: (memsel? "" : "display:none;")},
                   ["a", {href: "?view=coop&coopid=" + jt.instId(dst.obj)},
                    ["img", {cla: "ctmsetimg", src: "img/reload.png"}]]],
                  ["div", {id: "statsdiv"},
                   ["a", {href: "#stats",
                          onclick: jt.fs("app.pcd.toggleCtmDet('stats')")},
                    ["img", {cla: "ctmsetimg", src: "img/stats.png"}]]]]],
                ["div", {cla: "formline"}, oah],
                ["div", {cla: "formline", id: "midispdiv",
                         style: "display:none;"}]];
        return html;
    },


    getPicInfo = function () {
        var pi = {havepic: false, src: "img/nopicprof.png"};
        if(dst.type === "pen") {
            pi.lab = "Upload a profile picture!";
            pi.exp = "An image for your profile helps people identify membics you write. Choose something unique that visually represents you.";
            if(dst.obj.profpic) {
                pi.havepic = true;
                pi.lab = "Change Profile Picture";
                pi.src = picImgSrc(dst.obj); } }
        else if(dst.type === "coop") {
            pi.lab = "Upload a theme logo or picture!";
            pi.exp = "Themes with an image look much better and are easier to find in the theme overview.";
            if(dst.obj.picture) {
                pi.havepic = true;
                pi.lab = "Change Theme Logo or Picture";
                pi.src = picImgSrc(dst.obj); } }
        pi.lab = [pi.lab + " ",
                  ["a", {href: "#WhyPic",
                         onclick: jt.fs("app.toggledivdisp('whypicdiv')")},
                   ["i", "Why?"]]];
        pi.src += jt.ts((pi.src.indexOf("?") >= 0? "&" : "?") + "cb=", 
                        dst.obj.modified);
        return pi;
    },


    picFileSelChange = function () {
        var fv = jt.byId("picfilein").value;
        //chrome yields a value like "C:\\fakepath\\circuit.png"
        fv = fv.split("\\").pop();
        jt.out("picfilelab", fv);
        jt.byId("picfilelab").className = "filesellab2";
        jt.byId("upldsub").style.visibility = "visible";
    },


    picSettingsHTML = function () {
        var pinf, html;
        if(!jt.hasId(dst.obj) ||
               (dst.type === "coop" && 
                app.coop.membershipLevel(dst.obj) < 3)) {
            return ""; }
        pinf = getPicInfo();
        html = [["label", {fo: "picuploadform", cla: "overlab",
                           style: (pinf.havepic? "display:none;" : "")},
                 pinf.lab],
                ["div", {id: "whypicdiv", cla: "formline", 
                         style: "display:none;"},
                 ["div", {cla: "fieldexpdiv"}, pinf.exp]],
                ["form", {action: "/picupload", method: "post",
                          enctype: "multipart/form-data", target: "tgif",
                          id: "picuploadform"},
                 [jt.paramsToFormInputs(app.login.authparams()),
                  jt.paramsToFormInputs("picfor=" + dst.type + 
                                        "&_id=" + dst.id +
                                        "&penid=" + app.pen.myPenId()),
                  ["div", {cla: "ptddiv"},
                   [["img", {id: "upldpicimg", cla: "profimgdis",
                             src: pinf.src}],
                    ["div", {id: "upldpicform", cla: "picsideform"},
                     [["div", {cla: "fileindiv"},
                       [["input", {type: "file", cla: "hidefilein",
                                   name: "picfilein", id: "picfilein"}],
                        ["label", {fo: "picfilein", cla: "filesellab",
                                   id: "picfilelab"},
                         "Choose&nbsp;Image"],
                        ["div", {cla: "picsideformbuttonsdiv"},
                         ["input", {type: "submit", cla: "formbutton",
                                    style: "visibility:hidden;",
                                    onclick: jt.fs("app.pcd.upsub()"),
                                    id: "upldsub", value: "Upload"}]]]]]],
                    ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                ["iframe", {id: "tgif", name: "tgif", src: "/picupload",
                            style: "display:none"}]];
        return html;
    },
    picSettingsInit = function () {
        jt.on("picfilein", "change", picFileSelChange);
        app.pcd.monitorPicUpload();
    },


    descripSettingsHTML = function () {
        var nh = "", ht = "", ark = "", html;
        if(dst.type === "coop") {
            if(app.coop.membershipLevel(dst.obj) < 3) {
                return ""; }
            nh = ["div", {cla: "formline"},
                  [["label", {fo: "namein", cla: "liflab", id: "namelab"},
                    "Name"],
                   ["input", {id: "namein", cla: "lifin", type: "text",
                              placeholder: "Theme name required",
                              value: dst.obj.name}]]];
            ht = ["div", {cla: "formline"},
                  [["label", {fo: "hashin", cla: "liflab", id: "hashlab"},
                    "Hashtag&nbsp;#"],
                   ["input", {id: "hashin", cla: "lifin", type: "text",
                              placeholder: "Optional",
                              value: dst.obj.hashtag}]]];
            ark = ["div", {cla:"formline"},
                   [["input", {type:"checkbox", id:"arkcb", value:"archived",
                               checked:jt.toru(
                                   app.coop.hasFlag(dst.obj, "archived"))}],
                    ["label", {fo:"arkcb"}, "Archive (no further posts)"]]]; }
        html = [nh,
                //Label conflicts visually with placeholder text when
                //empty and is unnecessary if value specified.
                //Removed to reduce visual clutter
                // ["div", {cla: "formline"},
                //  ["label", {fo: "shouteditbox", cla: "overlab"}, 
                //   defs.desclabel]],
                ["textarea", {id: "shouteditbox", cla: "dlgta"}],
                ht,
                ark,
                ["div", {id: "formstatdiv"}],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.pcd.saveDescription()")},
                  (jt.hasId(dst.obj)? "Update Description" : "Create Theme")]]];
        return html;
    },
    descripSettingsInit = function () {
        var defs, namein, shout;
        defs = dst[dst.type];
        shout = jt.byId("shouteditbox");
        if(shout) {
            shout.readOnly = false;
            shout.value = dst.obj[defs.descfield];
            shout.placeholder = defs.descplace; }
        //set the focus only if not already filled in
        namein = jt.byId("namein");
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
                 [["img", {cla: "reviewbadge", src: picImgSrc(dst.obj)}],
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
            if(!jt.hasId(dst.obj) || app.coop.membershipLevel(dst.obj) < 2) {
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


    mailinSettingsHTML = function () {
        var html, subj, body, mh;
        if(dst.type !== "pen" || !jt.hasId(dst.obj)) {
            return ""; }
        dst.obj.stash = dst.obj.stash || {};
        dst.obj.stash.mailins = dst.obj.stash.mailins || "";
        subj = "Membic Title or URL or Description";
        body = "Membic URL and/or Description";
        mh = "mailto:membic@membicsys.appspotmail.com?subject=" + 
            jt.dquotenc(subj) + "&body=" + jt.dquotenc(body);
        html = ["div", {cla:"formline"},
                [["a", {href:"#togglemailinsettings",
                        onclick:jt.fs("app.layout.togdisp('mailinsdiv')")},
                  [["img", {cla:"ctmsetimg", src:"img/emailbw22.png"}],
                   ["span", {cla:"settingsexpandlinkspan"},
                    "Mail-In Membics"]]],
                 ["div", {cla:"formline", id:"mailinsdiv",
                          style:"display:none;"},
                  ["div", {cla:"rtkwdiv", id:"mailinaccsdiv"},
                   [["div", {cla:"formline"},
                     ["Authorized ",
                     ["a", {href:mh}, "mail-in membic "],
                      "addresses (separate multiple accounts with commas)."]],
                    ["div", {cla:"formline"},
                     ["input", {id:"emaddrin", cla:"keydefin", type:"text",
                                placeholder:"myaccount@example.com",
                                value:dst.obj.stash.mailins}]],
                    ["div", {cla:"dlgbuttonsdiv"},
                     ["button", {type:"button", id:"updatemiab",
                                 onclick:jt.fs("app.pcd.updateMailins()")},
                      "Update Mail-Ins"]]]]]]];
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
        if(dst.type !== "coop" || !jt.hasId(dst.obj) || 
               app.coop.membershipLevel(dst.obj) < 3) {
            return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#togglecalembed",
                        onclick: jt.fs("app.layout.togdisp('ctmcalembdiv')")},
                  [calendarIconHTML(),
                   ["span", {cla: "settingsexpandlinkspan"},
                    "Include Calendar"]]],
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
        var ceta = jt.byId("calembedta");
        if(ceta) {
            ceta.readOnly = false;
            ceta.value = dst.obj.calembed;
            ceta.placeholder = "<iframe src=... code"; }
    },


    rssSettingsHTML = function () {
        var html;
        if(dst.type !== "coop" || !jt.hasId(dst.obj)) {
            return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#rss", onclick: jt.fs("app.pcd.rssHelp()")},
                  [["img", {cla: "ctmsetimg", src: "img/rssicon.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    "RSS Feed"]]]]];
        return html;
    },
    fillRSSDialogAreas = function () {
        var furl, ta;
        furl = window.location.href;
        if(furl.endsWith("/")) {
            furl = furl.slice(0, -1); }
        furl += "/rsscoop?coop=" + jt.instId(dst.obj);
        ta = jt.byId("rssbta");
        if(ta) {
            ta.readOnly = true;
            ta.value = furl; }
        ta = jt.byId("rsscta");
        if(ta) {
            ta.readOnly = true;
            ta.value = furl + "&ts=st&ds=dvrk"; }
        ta = jt.byId("rssota");
        if(ta) {
            ta.readOnly = true;
            ta.value = furl + "&ts=sdvtvrk"; }
    },


    soloSettingsHTML = function () {
        var html;
        if(dst.type !== "coop" || app.coop.membershipLevel(dst.obj) < 3 ||
               !jt.hasId(dst.obj)) {
            return ""; }
        dst.obj.soloset = dst.obj.soloset || {};
        if(!dst.obj.soloset.colors || Array.isArray(dst.obj.soloset.colors)) {
            dst.obj.soloset.colors = {};
            standardOverrideColors.forEach(function (soc) {
                dst.obj.soloset.colors[soc.name] = soc.value; }); }
        html = [];
        standardOverrideColors.forEach(function (soc) {
            var colorval = dst.obj.soloset.colors[soc.name] || soc.value;
            html.push(["div", {cla: "formline"},
                       [["label", {fo: soc.name + "in", cla: "liflab"},
                         soc.name],
                        ["input", {id: soc.name + "in", cla: "lifin",
                                   type: "color", value: colorval}]]]); });
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
        if(dst.type !== "coop" || !jt.hasId(dst.obj)) {
            return ""; }
        html = ["div", {cla: "formline"},
                [["a", {href: "#embed", onclick: jt.fs("app.pcd.embedHelp()")},
                  [["img", {cla: "ctmsetimg", src: "img/embed.png"}],
                   ["span", {cla: "settingsexpandlinkspan"},
                    "Embed Theme"]]]]];
        return html;
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
        ta = jt.byId("embifta");
        if(ta) {
            ta.readOnly = true;
            ta.value = "<iframe id=\"membiciframe\" src=\"" + app.hardhome +
                "/e/" + dst.id + "?site=YOURSITE.COM\" " +
                "style=\"position:relative;height:100%;width:100%\" " +
                "seamless=\"seamless\" frameborder=\"0\"/></iframe>"; }
        ta = jt.byId("embwpta");
        if(ta) {
            ta.readOnly = true;
            ta.value = site + "/rsscoop?coop=" + jt.instId(dst.obj); }
    },


    alternateDisplayHTML = function () {
        var url, html, href = window.location.href;
        if(href.match(/\/[t|p]\//) || (dst.obj && dst.obj.hashtag &&
                             (href.indexOf("/" + dst.obj.hashtag) > 0))) {
            url = app.hardhome + "?view=" + dst.type + "&" + dst.type + "id" +
                "=" + jt.instId(dst.obj);
            html = [["a", {href: url.url,
                           onclick: jt.fs("window.open('" + url + "')")},
                     ["img", {src:"img/membiclogo.png", cla:"reviewbadge"}]],
                    "&nbsp;"]; }

        else {
            url = getDirectLinkInfo(true).url;
            html = ["span", {id: "shurlspan"},
                    ["a", {href: url.url,
                           onclick: jt.fs("window.open('" + url + "')")},
                     url]]; }
        return html;
    },


    permalinkInfoHTML = function () {
        var url, html;
        if(dst.type !== "coop" || !dst.obj || !jt.hasId(dst.obj)) {
            html = ""; }
        else if(app.coop.membershipLevel(dst.obj) < 3) {
            url = app.hardhome + "/rsscoop?" + dst.type + "=" + 
                jt.instId(dst.obj);
            html = ["a", {href:url, 
                          onclick:jt.fs("window.open('" + url + "')")},
                    ["img", {cla: "ctmsetimg", src: "img/rssicon.png"}]]; }
        else {
            html = ["a", {href:"#solopageinfo", 
                          onclick: jt.fs("app.layout.displayDoc('" + 
                                         "docs/themepage.html',true)")},
                    ["img", {cla: "ctmsetimg", src: "img/info.png"}]]; }
        return ["&nbsp;", html];
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
        var histrec = { view: dst.type };
        if(dst.type === "coop" && !dst.id) {
            //don't push a theme history with no id. Can't restore it.
            return; }
        histrec[dst.type + "id"] = dst.id;
        app.history.checkpoint(histrec);
    },


    titleForTab = function (tab, homelink) {
        var title, name, url;
        if(app.pen.myPenId() === dst.id) {
            title = tab.mtitle; }
        else {
            title = tab.otitle;
            name = dst.obj.name;
            if(homelink && dst.type === "coop") {
                url = app.secsvr + "?view=coop&coopid=" + dst.id;
                name = "<a href=\"" + url + "\" onclick=\"window.open('" + 
                    url + "');return false\">" + name + "</a>"; }
            title = title.replace(/\$NAME/g, name); }
        return title;
    },


    getRecentReviews = function () {
        var revs, rt;
        revs = app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent);
        rt = app.layout.getType();
        if(rt !== "all") {
            revs = revs.filter(function (rev) {
                if(rev.revtype === rt) {
                    return true; } }); }
        revs.sort(function (a, b) {
            if(a.modhist > b.modhist) { return -1; }
            if(a.modhist < b.modhist) { return 1; }
            return 0; });
        return revs;
    },


    //Called from displayTab
    displayRecent = function (expid) {
        app.review.displayReviews("pcdcontdiv", "pcdr", getRecentReviews(), 
                                  "app.pcd.toggleRevExpansion", 
                                  (dst.type === "coop"));
        if(expid === "settingspic") {
            if(!app.pen.myPenName().profpic) {
                jt.err("To post, you need a picture to show which membics are yours."); }
            app.pcd.settings(dst.obj); }
        else if(expid === "settings") {
            app.pcd.settings(dst.obj); }
        else if(expid) {
            //give the display a chance to settle before toggling
            app.fork({
                descr:"selected membic expansion",
                func:function () {
                    app.pcd.toggleRevExpansion("pcdr", expid); },
                ms:600}); }
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
    displayFavorites = function () {
        app.review.displayReviews("pcdcontdiv", "pcdf", getFavoriteReviews(),
                                  "app.pcd.toggleRevExpansion", 
                                  (dst.type === "coop"));
    },


    //Called from displayTab
    displayRemembered = function (expid, action) {
        //jt.log("pcd.displayRemembered expid:" + expid + ", action:" + action);
        app.activity.displayRemembered("pcdcontdiv", expid, action);
    },


    //Called from displayTab
    displaySearch = function () {
        var html;
        html = [["div", {id: "pcdkeysrchdiv"}],
                ["div", {id: "pcdsrchdispdiv"}],
                ["div", {id: "pcdsrvsrchdiv"}]];
        jt.out("pcdcontdiv", jt.tac2html(html));
        if(dst.obj.keywords) {
            srchst.mode = "srchkey"; }
        srchst.status = "initializing";
        app.pcd.updateSearchInputDisplay();
        app.pcd.searchReviews();
        if(app.login.isLoggedIn() && jt.byId("pcdsrchin")) {
            jt.byId("pcdsrchin").focus(); }
    },


    isKeywordMatch = function (membic) {
        if(!srchst.kwrds) {  //not filtering by keyword
            return true; }
        //if the membic keywords include at least one of the specified
        //search keywords then it's a match.
        return srchst.kwrds.csvarray().some(function (keyword) {
            return membic.keywords.csvcontains(keyword); });
    },


    isTypeMatch = function (membic) {
        if(!srchst.mtypes) {  //not filtering by type
            return true; }
        if(srchst.mtypes.csvcontains(membic.revtype)) {
            return true; }
        return false;
    },


    isQueryStringMatch = function (membic) {
        if(!srchst.qstr) {  //not filtering by text search
            return true; }
        var revtxt = membic.text || "";
        revtxt = revtxt.toLowerCase();
        var toks = srchst.qstr.toLowerCase().split(/\s+/);
        //if the membic text includes each of the search words regardless of
        //ordering, then it's a match.
        return toks.every(function (token) {
            return revtxt.indexOf(token) >= 0; });
    },


    searchFilterReviews = function (membics) {
        var filtered = [];
        membics.forEach(function (membic) {
            if(isSearchableMembic(membic) && 
               isKeywordMatch(membic) &&
               isTypeMatch(membic) &&
               isQueryStringMatch(membic)) {
                filtered.push(membic); } });
        return filtered;
    },


    updateResultsEmailLink = function (sortedRevs) {
        var eml = jt.byId("emaillink");
        if(!eml) {
            return; }
        var subj = "Selected links from " + dst.obj.name;
        var body = "Here are some links from " + dst.obj.name + ".\n" +
            "To select links yourself, go to https://membic.org/" +
            dst.obj.instid;
        sortedRevs.forEach(function (rev) {
            body += "\n\n" + rev.url + "\n" + (rev.title || rev.name) + "\n" +
                rev.text; });
        var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body);
        eml.href = link;
    },


    displaySearchResults = function () {
        var sortedRevs = srchst.revs;
        if(srchst.mode === "srchkey") {
            sortedRevs = srchst.revs.slice();  //copy recency ordered array
            sortedRevs.sort(function (a, b) {
                if(a.rating > b.rating) { return -1; }
                if(a.rating < b.rating) { return 1; }
                if(a.modified > b.modified) { return -1; }
                if(a.modified < b.modified) { return 1; }
                return 0; }); }
        app.review.displayReviews("pcdsrchdispdiv", "pcds", sortedRevs, 
                                  "app.pcd.toggleRevExpansion", 
                                  ((dst.type === "coop") && !app.solopage()));
        updateResultsEmailLink(sortedRevs);
        srchst.disprevs = sortedRevs;
        srchst.status = "waiting";
    },


    searchServerHTML = function () {
        var html = "", url;
        if(!app.login.isLoggedIn()) {
            if(app.solopage()) {
                url = app.hardhome + "?view=coop&coopid=" + dst.id + 
                    "&tab=search";
                html = ["a", {href:url, 
                              onclick:jt.fs("window.open('" + url + "')")},
                        [["u", "Sign in"],
                         [" on membic.org to search archives"]]]; }
            else {
                html = "Sign in to search archives"; }
            html = ["div", {id: "arxsidiv"}, html]; }
        else {
            html = ["div", {cla: "searchbuttondiv"},
                    ["button", {type: "button", id: "searchserverbutton",
                                onclick: jt.fs("app.pcd.searchServer()")},
                     "Search Archived Membics"]]; }
        return jt.tac2html(html);
    },


    //Called from displayTab
    displayCalendar = function () {
        jt.out("pcdcontdiv", dst.obj.calembed);
    },


    defaultTabName = function () {
        //not supporting search tab for standalone profile display right now
        if(app.solopage() && dst.type === "coop") {
            return "search"; }
        return "latest";
    },


    showContentActions = function (tabname) {
        var html, rssurl, actdiv = jt.byId("pcdactdiv");
        if(!actdiv) {
            return; }
        actdiv.style.display = "none";
        html = "";
        if(tabname.match(/^(latest|favorites|memo|search)$/)) {
            html = [["div", {id:"downloadmenudiv", 
                             style:"display:inline-block;"},
                     [["a", {href:"#Download", id: "downloadlink",
                             title:"Download " + knowntabs[tabname].stitle,
                             onclick:jt.fs("app.pcd.showDownloadDialog")},
                       [["img", {src:"img/download.png", 
                                 cla:"downloadlinkimg"}],
                        "Download " + knowntabs[tabname].stitle]]]]]; }
        if(tabname === "latest" && dst.type === "coop") {
            rssurl = app.hardhome + "/rsscoop?coop=" + dst.id;
            html.push([" | ",
                       ["a", {href:rssurl, //support right click copy link 
                              id:"rsslink",
                              title:"Subscribe RSS",
                              onclick:jt.fs("window.open('" + rssurl + "')")},
                        [["img", {src:"img/rssicon.png", 
                                  cla:"dlrssimg"}],
                         "Subscribe RSS"]]]); }
        if(tabname === "search") {
            html.push([" | ",
                       ["div", {id:"pcdsrchindiv",
                                style:"display:inline-block;"},
                        //Anything over 27 wraps on my phone, even though
                        //it looks ok on Chrome dev simulation.
                        ["input", {type:"text", id:"pcdsrchin", size:26,
                                   placeholder: "Search for...",
                                   value: srchst.qstr}]]]); }
        if(html) {
            html = ["div", {id:"pcdactcontentdiv"}, html];
            actdiv.innerHTML = jt.tac2html(html);
            actdiv.style.display = "inline-block"; }
    },


    displayTab = function (tabname, expid, action) {
        var dispfunc;
        // jt.log("pcd.displayTab " + tabname + ", expid: " + expid + 
        //        ", action: " + action);
        tabname = tabname || defaultTabName();
        Object.keys(knowntabs).forEach(function (tabkey) {
            var elem = jt.byId("tablink" + tabkey);
            if(elem) {
                elem.className = "tablink"; } });
        jt.byId("tablink" + tabname).className = "tablinksel";
        dst.tab = tabname;
        historyCheckpoint();  //history collapses tab changes
        showContentActions(tabname);
        dispfunc = knowntabs[tabname].dispfunc;
        if(jt.hasId(dst.obj)) {
            return dispfunc(expid, action); }
        //could be creating a new theme at this point. dialog may or may
        //not be displayed
        jt.out("pcdcontdiv", "Settings required.");
        app.pcd.settings();
    },


    createStyleOverridesForEmbedding = function () {
        jt.byId("pcduppercontentdiv").style.display = "none";
        jt.byId("bodyid").style.paddingLeft = "0px";
        jt.byId("bodyid").style.paddingRight = "0px";
        //give a bit of space for the top of the tabs to not be truncated
        tabvpad = 4;  //let other styling know we padded it down
        jt.byId("tabsdiv").style.marginTop = String(tabvpad) + "px";
    },


    createColorOverrides = function () {
        var sheet;
        if(!app.embedded) {
            return; }
        if(!dst || !dst.obj || !dst.obj.soloset || !dst.obj.soloset.colors) {
            return; }
        sheet = window.document.styleSheets[0];
        standardOverrideColors.forEach(function (soc) {
            var color = dst.obj.soloset.colors[soc.name];
            if(color) {
                soc.sel.csvarray().forEach(function (sel) {
                    var rule = sel + " { " + soc.attr + ": " + color + "; }";
                    sheet.insertRule(rule, sheet.cssRules.length); }); } });
    },


    changeSiteTabIcon = function () {
        var link = document.createElement("link");
        link.type = "image/x-icon";
        link.rel = "shortcut icon";
        link.href = "ctmpic?" + dst.type + "id=" + dst.id;
        document.getElementsByTagName("head")[0].appendChild(link);
    },


    customizeSoloPageDisplay = function () {
        if(app.embedded) {
            createStyleOverridesForEmbedding(); }
        createColorOverrides();
        changeSiteTabIcon();
    },


    shareButtonsHTML = function () {
        //thanks to https://sharingbuttons.io/
        var dca = "resp-sharing-button resp-sharing-button--small";
        var dcb = "resp-sharing-button__icon resp-sharing-button__icon--solid";
        var urlp = "https%3A%2F%2Fmembic.org%2F" + dst.obj.instid;
        var tlnp = jt.dquotenc(dst.obj.name);
        var tac = [
            //Twitter
            ["a", {cla:"resp-sharing-button__link",
                   href:"https://twitter.com/intent/tweet/?text=" + tlnp + 
                       "&amp;url=" + urlp,
                   target:"_blank", rel:"noopener", "aria-label":""},
             ["div", {cla:dca + " resp-sharing-button--twitter"},
              ["div", {"aria-hidden":"true", cla:dcb},
               ["svg", {xmlns:"http://www.w3.org/2000/svg",
                        viewBox:"0 0 24 24"},
                ["path", {d:"M23.44 4.83c-.8.37-1.5.38-2.22.02.93-.56.98-.96 1.32-2.02-.88.52-1.86.9-2.9 1.1-.82-.88-2-1.43-3.3-1.43-2.5 0-4.55 2.04-4.55 4.54 0 .36.03.7.1 1.04-3.77-.2-7.12-2-9.36-4.75-.4.67-.6 1.45-.6 2.3 0 1.56.8 2.95 2 3.77-.74-.03-1.44-.23-2.05-.57v.06c0 2.2 1.56 4.03 3.64 4.44-.67.2-1.37.2-2.06.08.58 1.8 2.26 3.12 4.25 3.16C5.78 18.1 3.37 18.74 1 18.46c2 1.3 4.4 2.04 6.97 2.04 8.35 0 12.92-6.92 12.92-12.93 0-.2 0-.4-.02-.6.9-.63 1.96-1.22 2.56-2.14z"}]]]]],
            //Facebook
            ["a", {cla:"resp-sharing-button__link", 
                   href:"https://facebook.com/sharer/sharer.php?u=" + urlp, 
                   target:"_blank", rel:"noopener", "aria-label":""},
             ["div", {cla:dca + " resp-sharing-button--facebook"},
              ["div", {"aria-hidden":"true", cla:dcb},
               ["svg", {xmlns:"http://www.w3.org/2000/svg",
                        viewBox:"0 0 24 24"},
                ["path", {d:"M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"}]]]]]];
        return tac;
    },


    writeTopContent = function (defs, obj) {
        var shtxt = obj[defs.descfield] || "";
        var fsz = "large";
        if(shtxt.length > 300) {
            fsz = "medium"; }
        var html = ["div", {id: "pcdouterdiv"},
                    [["div", {id: "pcduppercontentdiv"},
                      [["div", {id: "pcdpicdiv"},
                        ["img", {cla: "pcdpic", src: picImgSrc(obj)}]],
                       ["div", {id: "pcddescrdiv"},
                        [["div", {id: "pcdnamediv"},
                          [["a", {href: "/" + jt.instId(obj),
                                  onclick: jt.fs("app.pcd.togshare()")},
                            [["span", {id:"pcdnamespan", cla:"penfont"},
                              obj.name || obj.instid],
                             ["span", {id: "namearrowspan", cla: "penbutton"}, 
                              ["img", {id: "pnarw", src: "img/sharemenu.png",
                                       cla: "webjump"}]]]],
                           ["span", {cla: "penbutton"},
                            modButtonsHTML(obj)]]],
                         ["div", {id: "ppcdshoutdiv"},
                          [["div", {id:"sharediv", style:"display:none;"}, 
                            shareButtonsHTML()],
                           ["span", {cla: "shoutspan",
                                     style: "font-size:" + fsz + ";"}, 
                            jt.linkify(shtxt)]]]]]]],
                     ["div", {id: "pcdctrldiv"},
                      ["div", {id: "pcdactdiv"}]],
                     ["div", {id: "pcdcontdiv"}]]];
        jt.out("contentdiv", jt.tac2html(html));
    },


    showContentControls = function () {
        var rssurl = app.hardhome + "/rsscoop?coop=" + dst.id;
        var html = [
            ["div", {id:"pcdactcontentdiv"}, 
             [["div", {id:"pcdacrssdiv"},
               ["a", {href:rssurl, //support right click copy link 
                      id:"rsslink", title:"Subscribe to RSS feed",
                      onclick:jt.fs("window.open('" + rssurl + "')")},
                ["img", {src:"img/rssicon.png", cla:"dlrssimg"}]]],
              ["div", {id:"pcdacsrchdiv"},
               [["a", {href:"#search", title:"Search Membics",
                       onclick:jt.fs("app.pcd.searchReviews()")},
                 ["img", {src:"img/search.png", cla:"dlrssimg"}]],
                ["input", {type:"text", id:"pcdsrchin", size:26,
                           placeholder: "Text search...",
                           value: srchst.qstr,
                           onchange:jt.fs("app.pcd.searchReviews()")}]]],
              ["div", {id:"pcdacemdiv"},
               ["a", {id:"emaillink", href:"#filledInByMembicsDisplay"},
                ["img", {src:"img/emailbw22.png"}]]]]],
            ["div", {id:"pcdkeysrchdiv"}],
            ["div", {id:"pcdtypesrchdiv"}]];
        jt.out("pcdactdiv", jt.tac2html(html));
        html = [["div", {id:"pcdsrchdispdiv"}],
                ["div", {id:"pcdovermorediv"}]];
        jt.out("pcdcontdiv", jt.tac2html(html));
    },
        

    initializeSearchState = function () {
        srchst.status = "initializing";
        srchst.mtypes = "";
        srchst.kwrds = "";
        srchst.qstr = "";
        srchst.revs = [];
        srchst.disprevs = [];
    },


    resetDisplayStateFromObject = function (obj) {
        if(typeof(obj.preb) === "object" && !obj.preb.length) {
            //just in case preb had a bad value like {}
            obj.preb = []; }
        jt.log("resetDisplayStateFromObject typeof preb: " + typeof(obj));
        dst.obj = obj;
        dst.mtypes = "";
        dst.keywords = "";
    },


    displayObject = function (obj, expid, action) {
        // jt.log("pcd.displayObject expid: " + expid + ", action: " + action);
        obj = obj || dst.obj;
        resetDisplayStateFromObject(obj);
        app.layout.cancelOverlay();  //close user menu if open
        app.layout.closeDialog();    //close search dialog if open
        historyCheckpoint();
        initializeSearchState();
        var defs = dst[dst.type];
        writeTopContent(defs, obj)
        if(app.solopage()) {
            customizeSoloPageDisplay(); }
        if(dst.type === "coop" && dst.obj.instid) {
            app.profile.verifyMembership(dst.obj); }
        if(!jt.hasId(dst.obj)) {  //creating a new theme
            jt.out("pcdcontdiv", "Settings required.");
            return app.pcd.settings(); }
        showContentControls();
        app.pcd.updateSearchInputDisplay();
        app.pcd.searchReviews();
    },


    displayRetrievalWaitMessage = function (divid, dtype, id) {
        var mpi, msg;
        mpi = app.pen.myPenId();
        msg = "Retrieving " + dtype.capitalize() + " " + id + "...";
        if(dtype === "coop") {
            msg = "Retrieving theme " + id + "...";
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


    shareInviteHTML = function () {
        var html, mlev;
        if(dst.type !== "coop") {
            return ""; }
        mlev = app.coop.membershipLevel(dst.obj, app.pen.myPenId());
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


    currentTabMembics = function () {
        var membics = [];
        switch(dst.tab) {
        case "latest": membics = getRecentReviews(); break;
        case "favorites": membics = getFavoriteReviews(); break;
        case "memo": membics = app.activity.getRememberedMembics(); break;
        case "search": membics = srchst.revs; break; }
        return membics;
    },


    verifyFunctionConnections = function () {
        if(!dst.profile.objupdate) {
            dst.profile.objupdate = app.profile.update;
            dst.coop.objupdate = app.coop.updateCoop; }
    },


    longestWord = function (str) {
        var longest = "", words = str.split(/\s/);
        words.forEach(function (word) {
            if(word.length > longest.length) {
                longest = word; } });
        return longest;
    },


    updateRecentMembics = function (dtype, id, obj, supp, base) {
        var oldest = null, ts = new Date().toISOString();
        if(base.length) {
            oldest = base[base.length - 1]; }
        supp.forEach(function (membic) {
            // if(jt.instId(membic) === "5011097258033152") {
            //     jt.log("Processing it"); }
            if(!membic.dispafter || membic.dispafter < ts ||
                   membic.penid === app.pen.myPenId()) {
                //ensure cached, and use newer version if already cached
                membic = app.lcs.put("rev", membic).rev;
                //supp membics are already in descending modified order
                if(!oldest || oldest.modified > membic.modified ||
                       (oldest.modified === membic.modified && 
                        jt.instId(oldest) !== jt.instId(membic))) {
                    base.push(membic);
                    oldest = membic; } } });  //maintain DESC in case dupe found
        obj.recent = sourceRevIds(base, dtype, id);
    };


    function isSearchableMembic (obj) {
        if(!obj.revtype) {  //could be an overflow indicator
            return false; }
        if(dst.coop && obj.ctmid !== dst.obj.instid) {  //src ref
            return false; }
        return true;
    }


    function findKeywordsFromMembics () {
        var keys = "";
        dst.obj.preb.forEach(function (membic) {
            if(isSearchableMembic(membic)) {
                var keywords = membic.keywords || "";
                keywords.csvarray().forEach(function (key) {
                    key = key.trim();
                    if(!keys.csvcontains(key)) {
                        keys = keys.csvappend(key); } }); } });
        return keys;
    }


    function updateKeywordsSelectionArea () {
        if(!dst.keywords) {
            dst.keywords = findKeywordsFromMembics(); }
        if(!dst.keywords) {
            jt.byId("pcdkeysrchdiv").style.display = "none";
            return; }
        var html = [];
        dst.keywords.csvarray().forEach(function (kwd, i) {
            var chk = jt.toru(srchst.qstr.indexOf(kwd) >= 0, "checked");
            html.push(["div", {cla: "srchkwrbdiv"},
                       [["div", {cla: "skbidiv"},
                         ["input", {type: "checkbox", id: "skw" + i,
                                    name: "srchkwds", value: kwd, 
                                    checked: chk,
                                    onclick: jt.fsd("app.pcd.keysrch()")}]],
                        ["label", {fo: "skw" + i}, kwd.trim()]]]); });
        jt.out("pcdkeysrchdiv", jt.tac2html(html));
    }


    function findTypesFromMembics () {
        var types = "";
        dst.obj.preb.forEach(function (membic) {
            if(isSearchableMembic(membic) &&
               !types.csvcontains(membic.revtype)) {
                types = types.csvappend(membic.revtype); } });
        return types;
    }


    function updateTypesSelectionArea () {
        if(!dst.mtypes) {
            dst.mtypes = findTypesFromMembics(); }
        if(dst.mtypes.csvarray().length < 2) {
            jt.byId("pcdtypesrchdiv").style.display = "none";
            return; }
        var html = [];
        dst.mtypes.csvarray().forEach(function (mt, i) {
            var chk = jt.toru(srchst.mtypes.csvcontains(mt), "checked");
            html.push(["div", {cla:"srchkwrbdiv"},
                       [["div", {cla:"skbidiv"},
                         ["input", {type:"checkbox", id:"smt" + i,
                                    name:"srchtypes", value:mt,
                                    checked:chk,
                                    onclick:jt.fsd("app.pcd.typesrch()")}]],
                        ["label", {fo:"smt" + i}, mt]]]); });
        jt.out("pcdtypesrchdiv", jt.tac2html(html));
    }


    function displayLoadOverflow () {
        var preb = dst.obj.preb;
        if(!preb.length || !preb[preb.length - 1].overflow) {
            return jt.out("pcdovermorediv", ""); }
        jt.out("pcdovermorediv", jt.tac2html(
            ["a", {href:"#more",
                   onclick:jt.fs("app.pcd.loadOverflow()")},
             "More..."]));
        app.pcd.loadOverflow();  //auto load overflow
    }



    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    //Called from displayTab
    displayPrefPens: function (prefpens) {
        var html = [];
        if(!prefpens || (typeof prefpens !== "object")) {
            return app.pen.prefPens(dst.obj, "pcdcontdiv", 
                                    app.pcd.displayPrefPens); }
        Object.keys(prefpens).forEach(function (penid) {
            var pname = prefpens[penid];
            html.push(["div", {cla: "proftilewrapper",
                               id: "proftile" + penid},
                       ["div", {cla: "proftile"},
                        ["a", {title: "View " + pname,
                               href: "p/" + penid,
                               onclick: jt.fs("app.pen.bypenid('" +
                                              penid + "','prefpens')")},
                         [["div", {cla: "proftilepicdiv"},
                           ["img", {cla: "fpprofpic", alt: "no pic",
                                    src: dst.pen.picsrc + penid}]],
                          ["div", {cla: "proftiletitlediv"},
                           pname]]]]]); });
        if(!html.length) {
            html.push(["div", {cla: "pcdtext"},
                       "No preferred people yet."]); }
        jt.out("pcdcontdiv", jt.tac2html(html));
    },


    //Called from displayTab
    displayCoops: function (coopnames) {
        var html = [];
        if(!coopnames || (typeof coopnames !== "object")) {
            return app.pen.coopNames(dst.obj, "pcdcontdiv", 
                                     app.pcd.displayCoops); }
        Object.keys(coopnames).forEach(function (cid) {
            html.push(app.activity.getThemeTileTAC(
                {ctmid:cid, name:coopnames[cid]},
                jt.fs("app.coop.bycoopid('" + cid + "','membership')"))); });
        if(app.pen.myPenId() === jt.instId(dst.obj)) {
            html.push(["div", {cla: "pcdtext"},
                       [["div", {cla: "pcdtoggle"},
                         ["a", {href: "#createcoop",
                                onclick: jt.fs("app.pcd.toggleCreateCoop()")},
                          "Create cooperative theme"]],
                        ["div", {id: "createctmdiv"}]]]); }
        if(!html.length) {
            html.push(["div", {cla: "pcdtext"}, 
                       "No theme memberships found."]); }
        jt.out("pcdcontdiv", jt.tac2html(html));
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
                  (dst.type === "coop"? membershipSettingsHTML() : "")],
                 ["div", {cla: "pcdsectiondiv"},
                  picSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  descripSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  (dst.type === "pen"? app.login.accountSettingsHTML() : "")],
                 ["div", {cla: "pcdsectiondiv"},
                  keywordSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  mailinSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  soloSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  rssSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  embedSettingsHTML()],
                 ["div", {cla: "pcdsectiondiv"},
                  calendarSettingsHTML()]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   app.login.accountSettingsInit();
                                   picSettingsInit();
                                   descripSettingsInit();
                                   calSettingsInit(); },
                               jt.hasId(dst.obj)? "" : 
                                   jt.fs("app.pcd.cancelThemeCreate()"));
    },


    upsub: function () {
        var upldbutton = jt.byId("upldsub");
        upldbutton.disabled = true;
        upldbutton.value = "Uploading...";
        jt.byId("picuploadform").submit();
    },


    rssHelp: function () {
        var sr, html;
        sr = "https://feedly.com";  //sample RSS reader
        html = ["div", {id: "pcdembeddlgdiv"},
                [["div", {cla: "bumpedupwards"},
                  ["div", {cla: "headingtxt"}, "RSS for " + dst.obj.name]],
                 //basic RSS (http or https)
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Standard RSS"],
                   " for use with an ",
                   ["a", {href: "#sampleRSSReader",
                          onclick: jt.fs("window.open('" + sr + "')")},
                    "RSS reader"],
                   " or sidebar content:",
                   ["div", {cla: "setplustdiv"},
                    ["textarea", {id: "rssbta", cla: "setpldlgta"}]],
                   "Either <em>http</em> or <em>https</em> can be used."]],
                 //custom RSS
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Custom RSS"],
                   " to specify how the summary is presented:",
                   ["div", {cla: "setplustdiv"},
                    ["textarea", {id: "rsscta", cla: "setpldlgta"}]],
                   "Change the <em>ts</em> and <em>ds</em> parameter value letters to reflect what you want:",
                   ["ul",
                    [["li", "<b>s</b>: rating stars (as asterisks)"],
                     ["li", "<b>r</b>: membic type (e.g. \"book\")"],
                     ["li", "<b>t</b>: title or name"],
                     ["li", "<b>k</b>: keywords"],
                     ["li", "<b>d</b>: description why memorable"],
                     ["li", "<b>v</b>: vertical bar delimiter"]]]]],
                 //sample one line title
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Title only"],
                   " example with all info in one line:",
                   ["div", {cla: "setplustdiv"},
                    ["textarea", {id: "rssota", cla: "setpldlgta"}]]]],
                 //back
                 ["div", {cla: "pcdsectiondiv"},
                  ["a", {href: "#settings",
                         onclick: jt.fs("app.pcd.settings()")},
                   [["img", {src: "img/arrow18left.png"}],
                    " Return to Settings"]]]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   fillRSSDialogAreas(); });
    },


    embedHelp: function () {
        var html;
        html = ["div", {id: "pcdembeddlgdiv"},
                [["div", {cla: "bumpedupwards"},
                  ["div", {cla: "headingtxt"}, "Embed " + dst.obj.name]],
                 //Standalone URL
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Standalone URL"],
                   " for use with your own custom domain",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embdlta", cla: "setpldlgta"}]]]],
                 //iframe
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Embed iframe"],
                   " (replace the site value with your domain)",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embifta", cla: "setpldlgta", 
                                  rows: 5}]]]],
                 //wordpress
                 ["div", {cla: "pcdsectiondiv"},
                  [["span", {cla: "setpldlgmspan"}, "Newsfeed"],
                   " syndicated content display (recent membics)",
                   ["div", {cla: "embdlgline"},
                    ["textarea", {id: "embwpta", cla: "setpldlgta"}]]]],
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
        jt.byId("okbutton").disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("namein");
        if(elem && elem.value && elem.value.trim()) {
            val = elem.value.trim();
            if(dst.obj.name !== val) {
                dst.obj.name = val;
                changed = true; } }
        elem = jt.byId("shouteditbox");
        if(elem && elem.value !== dst.obj[defs.descfield]) {
            dst.obj[defs.descfield] = elem.value;
            changed = true; }
        elem = jt.byId("hashin");
        if(elem && elem.value && elem.value.trim()) {
            val = elem.value.trim();
            if(val.indexOf("#") === 0) {
                val = val.slice(1).trim(); }
            dst.obj.hashtag = val;
            changed = true; }
        elem = jt.byId("arkcb");
        if(elem) {
            val = elem.checked? new Date().toISOString() : "";
            if((app.coop.hasFlag(dst.obj, "archived") && !val) ||
               (!app.coop.hasFlag(dst.obj, "archived") && val)) {
                changed = true; }
            app.coop.setFlag(dst.obj, "archived", val); }
        if(!changed) {
            return app.layout.cancelOverlay(); }
        if(changed) {
            okfunc = function (updobj) {
                if(dst.type === "coop") {
                    app.fork({
                        descr:"verify theme pen stash",
                        func:function () {
                            app.coop.verifyPenStash(dst.obj); },
                        ms:50}); }
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId("okbutton").disabled = false;
                jt.out("formstatdiv", jt.errhtml("Update", code, errtxt)); };
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


    updateMailins: function () {
        dst.obj.stash.mailins = jt.byId("emaddrin").value;
        app.pen.updatePen(dst.obj, app.pcd.redisplay, app.failf);
    },


    monitorPicUpload: function () {
        var tgif, txt, defs, mtag = "Done: ";
        tgif = jt.byId("tgif");
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
                    jt.out("imgupstatdiv", txt); } }
            app.fork({descr:"monitor pic upload",
                      func:app.pcd.monitorPicUpload,
                      ms:800}); }
    },


    saveCalEmbed: function () {
        var defs, elem, okfunc, failfunc;
        jt.byId("savecalbutton").disabled = true;
        defs = dst[dst.type];
        elem = jt.byId("calembedta");
        if(elem && elem.value !== dst.obj.calembed) {
            dst.obj.calembed = elem.value;
            okfunc = function (upobj) {
                dst.obj = upobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); };
            failfunc = function (code, errtxt) {
                jt.byId("savecalbutton").disabled = false;
                jt.out("calembederrdiv", "Update failed code " + code +
                       ": " + errtxt); };
            defs.objupdate(dst.obj, okfunc, failfunc); }
    },


    saveSoloColors: function () {
        var defs = dst[dst.type];
        jt.byId("savecolorsbutton").disabled = true;
        standardOverrideColors.forEach(function (soc) {
            var color = jt.byId(soc.name + "in").value;
            dst.obj.soloset.colors[soc.name] = color; });
        defs.objupdate(dst.obj,
            function (updobj) {
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id, dst.tab, dst.obj); },
            function (code, errtxt) {
                jt.byId("savecolorsbutton").disabled = false;
                jt.out("colorupderrdiv", "Update failed code " + code +
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
            jt.out("rsbdiv", "Resigning");
            app.coop.processMembership(dst.obj, "demote", app.pen.myPenId(),
                                        "", app.pcd.settings); }
        else {
            jt.out("rsbdiv", "Stopping");
            pen = app.pen.myPenName();
            pen.coops = pen.coops.csvremove(dst.id);
            if(pen.stash && pen.stash["ctm" + dst.id]) {
                pen.stash["ctm" + dst.id] = null; }
            app.pen.updatePen(pen, app.pcd.redisplay, app.failf); }
    },


    togshare: function () {
        var sharediv = jt.byId("sharediv");
        if(!sharediv) {
            return; }
        if(sharediv.style.display === "block") {
            sharediv.style.display = "none"; }
        else {
            sharediv.style.display = "block"; }
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


    togsrchmode: function () {
        if(srchst.mode === "srchkey") {
            srchst.mode = "srchtxt"; }
        else if(srchst.mode === "srchtxt") {
            srchst.mode = "srchkey"; }
        //otherwise just leave as "nokeys"
        app.pcd.updateSearchInputDisplay();
    },


    keysrch: function () {
        srchst.kwrds = "";
        dst.keywords.csvarray().forEach(function (kwd, i) {
            var cb = jt.byId("skw" + i);
            if(cb.checked) {
                srchst.kwrds = srchst.kwrds.csvappend(kwd); } });
        app.pcd.searchReviews();
    },


    typesrch: function () {
        srchst.mtypes = "";
        dst.mtypes.csvarray().forEach(function (mt, i) {
            var cb = jt.byId("smt" + i);
            if(cb.checked) {
                srchst.mtypes = srchst.mtypes.csvappend(mt); } });
        app.pcd.searchReviews();
    },


    updateSearchInputDisplay: function () {
        updateKeywordsSelectionArea()
        updateTypesSelectionArea()
    },


    searchReviews: function () {
        var srchin;
        srchin = jt.byId("pcdsrchin");
        if(!srchin) {  //query input no longer on screen, quit
            return; }
        if(srchst.status === "processing") {  //not finished with prev call
            return app.fork({descr:"refresh search results",
                             func:app.pcd.searchReviews, ms:800}); }
        srchst.status = "processing";
        srchst.qstr = srchin.value;
        srchst.revs = searchFilterReviews(dst.obj.preb);
        displaySearchResults();  //clears the display if none matching
        displayLoadOverflow();
    },


    searchServer: function () {
        var params;
        app.displayWaitProgress(0, 1600, "pcdsrchdispdiv", 
                                "Searching...",
                                "Many reviews or slow data connection...");
        params = app.login.authparams() + 
            "&qstr=" + jt.enc(jt.canonize(srchst.qstr)) +
            "&revtype=" + app.typeOrBlank(srchst.revtype) +
            "&" + (dst.type === "coop"? "ctmid=" : "penid=") +
            jt.instId(dst.obj) + jt.ts("&cb=", "hour");
        jt.call("GET", "srchrevs?" + params, null,
                function (revs) {
                    app.lcs.putAll("rev", revs);
                    srchst.revs = revs;
                    jt.byId("pcdsrvsrchdiv").style.display = "none";
                    displaySearchResults(); },
                app.failf(function (code, errtxt) {
                    jt.out("pcdsrchdispdiv", "searchReviews failed: " + 
                           code + " " + errtxt); }),
                jt.semaphore("pcd.searchReviews"));
    },


    toggleRevExpansion: function (prefix, revid) {
        app.review.toggleExpansion(srchst.disprevs, prefix, revid);
    },


    toggleCreateCoop: function () {
        var html;
        html = ["A cooperative theme holds related membics from one or more members. As a founder, you have full privileges to manage other members and posts.",
                ["div", {cla: "formbuttonsdiv"},
                 ["button", {type: "button", id: "createcoopbutton",
                             onclick: jt.fs("app.pcd.display('coop')")},
                  "Create New Theme"]]];
        if(!jt.byId("createctmdiv").innerHTML) {
            jt.out("createctmdiv", jt.tac2html(html)); }
        else {
            jt.out("createctmdiv", ""); }
    },


    toggleCtmDet: function (ctype) {
        var midispdiv = jt.byId("midispdiv");
        if(ctype === "info" && (setdispstate.infomode !== "info" ||
                                !midispdiv.innerHTML)) {
            setdispstate.infomode = "info";
            jt.byId("midispdiv").style.display = "block";
            if(dst.type === "coop") {
                jt.out("midispdiv", coopLogHTML()); }
            else {
                jt.out("midispdiv", accountInfoHTML()); } }
        else if(ctype === "mbinfo" && (setdispstate.infomode !== "finfo" ||
                                       !midispdiv.innerHTML)) {
            setdispstate.infomode = "finfo";
            jt.byId("midispdiv").style.display = "block";
            jt.out("midispdiv", coopLogHTML("membership")); }
        else if(ctype === "members" && (setdispstate.infomode !== "members" ||
                                        !midispdiv.innerHTML)) {
            setdispstate.infomode = "members";
            jt.byId("midispdiv").style.display = "block";
            jt.out("midispdiv", coopMembershipHTML()); }
        else if(ctype === "stats" && (setdispstate.infomode !== "stats" ||
                                      !midispdiv.innerHTML)) {
            setdispstate.infomode = "stats";
            jt.byId("midispdiv").style.display = "block";
            jt.out("midispdiv", statsDisplayHTML()); }
        else {
            app.layout.togdisp("midispdiv"); }
    },


    showDownloadDialog: function () {
        app.layout.showDownloadOptions(currentTabMembics);
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


    display: function (dtype, id) {
        verifyFunctionConnections();
        if(dtype === "profile" && !id) {
            id = app.profile.myProfId(); }
        if(dtype && id) {  //object should already be cached
            dst.type = dtype;
            dst.id = id;
            dst.obj = app.lcs.getRef(dtype, id)[dtype];
            return displayObject(dst.obj); }
        if(dtype === "coop") {  //creating new coop
            var profname = app.profile.myName();
            if(!profname) {
                jt.err("You need to have a name for your profile.");
                return app.profile.displayProfile(); }
            dst.obj = { name: "", description: "", 
                        people: {}, founders: app.profile.myProfId() };
            dst.obj.people[app.profile.myProfId()] = profname;
            return displayObject(dst.obj); }
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


    updateSearchStateData: function (updrev) {
        var rid, i;
        //would use findIndex rather than for, but not fully supported..
        if(srchst.revs && srchst.revs.length) {
            rid = jt.instId(updrev);
            for(i = 0; i < srchst.revs.length; i += 1) {
                if(jt.instId(srchst.revs[i]) === rid) {
                    srchst.revs[i] = updrev;
                    break; } } }
    },


    getDisplayState: function () {
        return dst;
    },


    blockfetch: function (dtype, id, callback, divid) {
        var objref, url, time;
        divid = divid || "contentdiv";
        if(dtype === "pen" && !id) {
            id = app.pen.myPenId() || ""; }
        objref = app.lcs.getRef(dtype, id);
        if(objref && objref[dtype]) {
            return callback(objref[dtype]); }
        if(divid !== "quiet") {
            displayRetrievalWaitMessage(divid, dtype, id); }
        url = "blockfetch?" + app.login.authparams();
        if(dtype === "coop") {
            if(!id) {
                jt.log("blockfetch coop requires an id");
                return callback(null); }
            url += "&ctmid=" + id; }
        else if(dtype === "pen") {
            url += "&penid=" + id;
            if(!id || id === app.pen.myPenId()) {  //looking for my pen
                url += "&authorize=true"; } }      //include account info
        url += jt.ts("&cb=", id? "hour" : "second");
        time = Date.now();
        jt.call("GET", url, null,
                function (objs) {   //main obj + recent/top reviews
                    var obj;
                    time = Date.now() - time;
                    jt.log("blockfetch " + dtype + " " + id  + 
                           " returned in " + time/1000 + " seconds.");
                    if(divid !== "quiet") {
                        jt.out(divid, ""); }
                    if(!objs.length || !objs[0]) {
                        if(dtype === "pen") {
                            return app.pen.newPenName(callback); }
                        app.lcs.tomb(dtype, id, "blockfetch failed");
                        return callback(null); }
                    obj = objs[0];  //PenName or Coop instance
                    app.lcs.put(dtype, obj);
                    app.login.noteAccountInfo(obj);
                    updateRecentMembics(dtype, id, obj, objs.slice(1), []);
                    jt.log("blockfetch cached " + dtype + " " + jt.instId(obj));
                    if(dtype === "coop") {
                        app.coop.rememberThemeName(obj, true);
                        app.coop.verifyPenStash(obj); }
                    callback(obj); },
                app.failf(function (code, errtxt) {
                    jt.log("blockfetch " + code + ": " + errtxt);
                    app.lcs.tomb(dtype, id, "blockfetch failed " + code + 
                                 ": " + errtxt);
                    callback(null); }),
                jt.semaphore("pcd.blockfetch" + dtype + id));
    },


    fetchAndDisplay: function (dtype, id) {
        //jt.log("pcd.fetchAndDisplay " + dtype + " " + id);
        if(!id) {
            jt.log("pcd.fetchAndDisplay " + dtype + " required an id");
            jt.log(new Error().stack); }
        app.lcs.getFull(dtype, id, function (obj) {
            if(!obj) {
                jt.log("pcd.fetchAndDisplay no obj " + dtype + " " + id);
                return app.themes.display(); }
            app.pcd.display(dtype, id); });
    },


    fetchmore: function (linkonly) {
        var url, time, elem;
        if(!jt.byId("fetchmorediv")) {
            if((dst.tab === "latest" || dst.tab === "search") &&
                   dst.type === "coop" && dst.obj.soloset && 
                   dst.obj.soloset.stats && dst.obj.soloset.stats.mc &&
                   dst.obj.soloset.stats.mc > dst.obj.recent.length &&
                   !dst.obj.suppfetched) {
                elem = document.createElement("div");
                elem.innerHTML = jt.tac2html(
                    ["div", {id: "fetchmorediv"},
                     ["a", {href: "#fetchmore",
                            onclick: jt.fs("app.pcd.fetchmore()")},
                      "Fetch more..."]]);
                jt.byId("pcdcontdiv").appendChild(elem); }
            return; }
        if(linkonly) {
            return; }
        jt.out("fetchmorediv", "Fetching...");
        url = "blockfetch?" + app.login.authparams() + "&ctmid=" + dst.id +
            "&supp=preb2" + jt.ts("&cb=", "second");
        time = Date.now();
        jt.call("GET", url, null,
                function (membics) {  //contents of preb2 is just reviews
                    time = Date.now() - time;
                    jt.log("blockfetch supp " + dst.type + " " + dst.id  + 
                           " returned in " + time/1000 + " seconds.");
                    jt.out("fetchmorediv", "Redisplaying...");
                    dst.obj.suppfetched = true;
                    updateRecentMembics(dst.type, dst.id, dst.obj, membics, 
                                        getRecentReviews());
                    displayTab(dst.tab); },
                function (code, errtxt) {
                    jt.out("fetchmorediv", "Fetch failed " + code + 
                           ": " + errtxt); },
                jt.semaphore("pcd.fetchmore"));
    },


    membershipSettingsLink: function (theme) {
        var html, stashid, pen, mlev;
        stashid = "ctm" + theme.ctmid;
        pen = app.pen.myPenName();
        if(!pen || !pen.stash || !pen.stash[stashid]) {
            return ""; }
        //only have pen.stash[stashid] if at least following.  Verifying
        //zero here only prevents crashing if the data is somehow corrupt.
        mlev = pen.stash[stashid].memlev || 0;
        html = ["a", {href:"#" + theme.name + " Settings",
                      onclick:jt.fs("app.pcd.display('coop','" + theme.ctmid +
                                    "',null,null,'settings')")},
                ctmmsgs[mlev].name];
        return jt.tac2html(html);
    },


    cancelThemeCreate: function () {
        app.layout.cancelOverlay();
        app.pcd.display("pen", app.pen.myPenId(), "coops");
    },


    loadOverflow: function () {
        jt.err("loadOverflow not implemented yet");
    }

};  //end of returned functions
}());

