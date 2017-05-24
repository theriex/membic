/*global app, jt, setTimeout, window, confirm, document */

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
                pen: { desclabel: "About Me",
                       descplace: "A message for visitors to your profile. Any links you want to share?",
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
                                   img: "img/endorse.png",
                                   mtitle: "People I endorse",
                                   otitle: "People $NAME endorses"},
                      coops:     { href: "#coopsfollowing",
                                   img: "img/tabctms.png",
                                   mtitle: "My Themes",
                                   otitle: "Themes followed by $NAME"},
                      calendar:  { href: "#coopcalendar",
                                   img: "calico",
                                   mtitle: "Event Calendar",
                                   otitle: "Event Calendar"} },
        tabvpad = 0,
        srchst = { revtype: "all", mode: "nokeys", qstr: "", status: "" },
        setdispstate = { infomode: "" },
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
                                 title: "Profile settings",
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
                              title: "Theme settings",
                              onclick: jt.fs("app.pcd.settings()")},
                        ["img", {cla: "reviewbadge",
                                 src: "img/settings.png"}]]; } }
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
            setTimeout(function () {  //fetch after initial display finished
                var params = app.login.authparams() + "&ctype=" + dst.type +
                    "&parentid=" + dst.id + jt.ts("&cb=", "minute");
                jt.call("GET", "currstats?" + params, null,
                        function (mctrs) {
                            dst.obj.mctr = mctrs[0];
                            jt.out("statsumdiv", statSummaryHTML()); },
                        app.failf(function (code, errtxt) {
                            jt.out("statsumdiv", "currstats failed " + code +
                                   ": " + errtxt); }),
                        jt.semaphore("pcd.fetchStats")); }, 200); }
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
                    "Hashtag #"],
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
            ta.value = "<iframe id=\"membiciframe\" src=\"" + site + 
                "?view=coop&coopid=" + dst.id + 
                "&css=none&site=YOURSITE.COM\" " + 
                "style=\"position:relative;height:100%;width:100%\" " +
                "seamless=\"seamless\" frameborder=\"0\"/></iframe>"; }
        ta = jt.byId("embwpta");
        if(ta) {
            ta.readOnly = true;
            ta.value = site + "/rsscoop?coop=" + jt.instId(dst.obj); }
    },


    permalinkInfoHTML = function () {
        var html;
        if(dst.type !== "coop" || app.coop.membershipLevel(dst.obj) < 3 ||
               !jt.hasId(dst.obj)) {
            return ""; }
        html = ["a", {href: "solopageinfo",
                      onclick: jt.fs(
                          "app.layout.displayDoc('docs/themepage.html',true)")},
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
        if(dst.type === "coop" && !dst.id) {
            //don't push a theme history with no id. Can't restore it.
            return; }
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
            setTimeout(function () {
                app.pcd.toggleRevExpansion("pcdr", expid); }, 600); }
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
        app.review.displayReviews("pcdcontdiv", "pcdf", getFavoriteReviews(),
                                  "app.pcd.toggleRevExpansion", 
                                  (dst.type === "coop"));
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayRemembered = function () {
        app.activity.displayRemembered("pcdcontdiv");
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displaySearch = function () {
        var html;
        html = [["div", {id: "pcdsrchdiv"}],
                ["div", {id: "pcdsrchdispdiv"}]];
        jt.out("pcdcontdiv", jt.tac2html(html));
        if(dst.obj.keywords) {
            srchst.mode = "srchkey"; }
        srchst.status = "initializing";
        app.pcd.updateSearchInputDisplay();
        app.pcd.searchReviews();
        if(app.login.isLoggedIn() && jt.byId("pcdsrchin")) {
            jt.byId("pcdsrchin").focus(); }
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
        var merged = [], candidate, last = null;
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
            if(merged.length) {
                last = merged[merged.length - 1]; }
            if(isMatchingReview(srchst.qstr, candidate) &&
               jt.instId(last) !== jt.instId(candidate)) {
                merged.push(candidate); } }
        return merged;
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
        srchst.status = "waiting";
        setTimeout(app.pcd.searchReviews, 400);
    },


    searchServerHTML = function () {
        var html = "";
        if(!app.login.isLoggedIn()) {
            if(app.solopage()) {
                html = ["a", {href: app.hardhome + "?view=coop&coopid=" + 
                                    dst.id + "&tab=search"},
                        [["u", "Sign in"],
                         [" on membic.org to search archives"]]]; }
            else {
                html = "Sign in to search archives"; } }
        else {
            html = ["div", {cla: "searchbuttondiv"},
                    ["button", {type: "button", id: "searchserverbutton",
                                onclick: jt.fs("app.pcd.searchServer()")},
                     "Search Archived Membics"]]; }
        return jt.tac2html(html);
    },


    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
    displayCalendar = function () {
        jt.out("pcdcontdiv", dst.obj.calembed);
    },


    tabsHTML = function () {
        var html = [];
        html.push(tabHTMLFromDef("latest"));
        html.push(tabHTMLFromDef("favorites"));
        if(!app.solopage() && dst.id === app.pen.myPenId()) {
            html.push(tabHTMLFromDef("memo")); }
        if(!app.solopage() || dst.type === "coop") {
            html.push(tabHTMLFromDef("search")); }
        if(dst.type === "pen") {
            html.push(tabHTMLFromDef("prefpens"));
            html.push(tabHTMLFromDef("coops")); }
        if(dst.type === "coop" && dst.obj.calembed) {
            html.push(tabHTMLFromDef("calendar")); }
        return html;
    },


    defaultTabName = function () {
        //not supporting search tab for standalone profile display right now
        if(app.solopage() && dst.type === "coop") {
            return "search"; }
        return "latest";
    },


    displayTab = function (tabname, expid) {
        var dispfunc, html;
        tabname = tabname || defaultTabName();
        Object.keys(knowntabs).forEach(function (kt) {
            var elem = jt.byId(kt + "li");
            if(elem) {
                elem.className = "unselectedTab"; } });
        jt.byId(tabname + "li").className = "selectedTab";
        dst.tab = tabname;
        historyCheckpoint();  //history collapses tab changes
        if(jt.byId("downloadlinksdiv")) {
            jt.byId("downloadlinksdiv").style.display = "none"; }
        html = "";
        if(tabname.match(/^(latest|favorites|memo|search)$/)) {
            html = ["a", {href: "#Download", id: "downloadlink",
                          title: "Download these membics",
                          style: "padding:0px;", //override inherited tabs def
                          onclick: jt.fs("app.pcd.toggleDownloadsDisp()")},
                    [["img", {src: "img/download.png", cla: "downloadlinkimg"}],
                     "Download"]]; }
        jt.out("tabtitlediv", jt.tac2html([titleForTab(knowntabs[tabname]),
                                           html]));
        dispfunc = knowntabs[tabname].dispfunc;
        app.layout.displayTypes(dispfunc);  //connect type filtering
        if(jt.hasId(dst.obj)) {
            return dispfunc(expid); }
        //could be creating a new theme at this point. dialog may or may
        //not be displayed
        jt.out("pcdcontdiv", "Settings required.");
        app.pcd.settings();
    },


    displayRSSAndHomeLinks = function () {
        var coords, absdiv, html, homeurl, rssurl;
        coords = jt.geoPos(jt.byId("tabsdiv"));
        coords.x += (dst.type === "pen"? 230 : 150);
        absdiv = jt.byId("xtrabsdiv");
        absdiv.style.left = String(coords.x) + "px";
        absdiv.style.top = String(coords.y - 12 + tabvpad) + "px";
        absdiv.style.background = "transparent";
        absdiv.style.border = "none";
        absdiv.style.visibility = "visible";
        homeurl = app.hardhome + "?view=coop&coopid=" + dst.id;
        if(dst.type !== "coop") {
            homeurl = app.hardhome + "?view=pen&penid=" + dst.id; }
        html = [["a", {href: homeurl, title: dst.obj.name + " membic page",
                       onclick: jt.fs("window.open('" + homeurl + "')")},
                 ["img", {cla: "reviewbadge", src: "img/membiclogobw.png"}]]];
        if(dst.type === "coop") {  //RSS only available for themes...
            rssurl = app.hardhome + "/rsscoop?coop=" + dst.id;
            html.push("&nbsp; &nbsp;");
            html.push(
                ["a", {href: rssurl, title: dst.obj.name + " RSS feed",
                       onclick: jt.fs("window.open('" + rssurl + "')")},
                 ["img", {cla: "rsslinkimg", src: "img/rssicon.png"}]]); }
        jt.out("xtrabsdiv", jt.tac2html(html));
    },


    backgroundVerifyObjectData = function () {
        var pen;
        if(dst.type === "coop" && jt.hasId(dst.obj)) {
            pen = app.pen.myPenName();
            if(app.coop.membershipLevel(dst.obj, app.pen.myPenId()) > 0 &&
               !(pen.coops && pen.coops.csvcontains(jt.instId(dst.obj)))) {
                app.pcd.follow(); } }
    },


    createStyleOverridesForEmbedding = function () {
        jt.byId("pcdupperdiv").style.display = "none";
        jt.byId("pcddescrfadediv").style.display = "none";
        jt.byId("bodyid").style.paddingLeft = "0px";
        jt.byId("bodyid").style.paddingRight = "0px";
        //give a bit of space for the top of the tabs to not be truncated
        tabvpad = 4;  //let other styling know we padded it down
        jt.byId("tabsdiv").style.marginTop = String(tabvpad) + "px";
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
                var rule;
                if(cdef.name === "backgrnd") {
                    if(app.embedded) {  //use parent window background
                        cdef.value = "none"; }
                    else { //set text overflow fade background color
                        rule = "#pcddescrfadediv { background:" + 
                            "linear-gradient(rgba(" + jt.hex2rgb(cdef.value) +
                            ",0), " + cdef.value + "); }";
                        sheet.insertRule(rule, sheet.cssRules.length); } }
                rule = sel + " { " + ckeys[cdef.name].attr + ": " +
                    cdef.value + "; }";
                sheet.insertRule(rule, sheet.cssRules.length); }); });
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
        displayRSSAndHomeLinks();
    },


    displayObject = function (obj, expid) {
        var defs, html, shtxt;
        obj = obj || dst.obj;
        dst.obj = obj;
        app.layout.cancelOverlay();  //close user menu if open
        app.layout.closeDialog();    //close search dialog if open
        historyCheckpoint();
        defs = dst[dst.type];
        shtxt = obj[defs.descfield] || "";
        html = ["div", {id: "pcdouterdiv"},
                [["div", {id: "pcdupperdiv"},
                  [["div", {id: "pcdpicdiv"},
                    ["img", {cla: "pcdpic", src: picImgSrc(obj)}]],
                   ["div", {id: "pcddescrdiv"},
                    [["div", {id: "pcdnamediv"},
                      [["a", {href: defs.accsrc + jt.instId(obj),
                              onclick: jt.fs("app.pcd.share()")},
                        [["span", {id: "namearrowspan", cla: "penbutton"}, 
                          ["img", {id: "pnarw", src: "img/stackedmenu.png",
                                   cla: "webjump"}]],
                         ["span", {cla: "penfont"}, obj.name]]],
                       ["span", {cla: "penbutton"},
                        modButtonsHTML(obj)]]],
                     ["div", {id: "ppcdshoutdiv"},
                      ["span", {cla: "shoutspan",
                                style: "font-size:" + 
                                ((shtxt.length > 300)? "medium" : "large") +
                               ";"}, 
                       jt.linkify(shtxt)]]
                     // ["div", {id: "pcdhashdiv"},
                     //  (obj.hashtag? ("#" + obj.hashtag) : "")]
                    ]]]],
                 ["div", {id: "pcddescrfadediv"}],
                 ["div", {id: "tabsdiv"},
                  [["ul", {id: "tabsul"},
                    tabsHTML()],
                   ["div", {id: "tabtitlediv"}],
                   ["div", {id: "downloadlinksdiv", style: "display:none;"}]]],
                 ["div", {id: "pcdcontdiv"}]]];
        jt.out("contentdiv", jt.tac2html(html));
        if(app.solopage()) {
            customizeSoloPageDisplay(); }
        setTimeout(backgroundVerifyObjectData, 100);
        displayTab(dst.tab, expid);
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


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    //Called from displayTab
    //Called from layout.displayTypes when membic type selected
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
    //Called from layout.displayTypes when membic type selected
    displayCoops: function (coopnames) {
        var html = [];
        if(!coopnames || (typeof coopnames !== "object")) {
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
                                              cid + "','membership')")},
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
                                   calSettingsInit(); });
    },


    upsub: function () {
        var upldbutton = jt.byId("upldsub");
        upldbutton.disabled = true;
        upldbutton.value = "Uploading...";
        jt.byId("upldpicfelem").submit();
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
                   " syndicated content display (recent membics only)",
                   ["div", {cla: "embdlgline"},
                    ["div", {cla: "embedexample"},
                     [["span", {cla: "embedexamptitle"}, "WordPress:"],
                      " Customize | Widgets | Sidebar | Add a Widget | RSS"]]],
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
                    setTimeout(function () {
                        app.coop.verifyPenStash(dst.obj); }, 50); }
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
            setTimeout(app.pcd.monitorPicUpload, 800); }
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
        dst.obj.soloset.colors.forEach(function (cdef, idx) {
            var color = jt.byId(cdef.name + "in").value;
            dst.obj.soloset.colors[idx].value = color; });
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
            app.pen.updatePen(pen, app.pcd.redisplay, app.failf); }
    },


    share: function () {
        var descrdiv, shurlspan, defs, html, dlo;
        descrdiv = jt.byId("ppcdshoutdiv");
        if(descrdiv) {
            defs = dst[dst.type];
            shurlspan = jt.byId("shurlspan");
            if(shurlspan) {
                jt.out("ppcdshoutdiv", jt.tac2html(
                    ["span", {cla: "shoutspan"}, 
                     jt.linkify(dst.obj[defs.descfield] || "")])); }
            else {
                dlo = getDirectLinkInfo(true);
                html = [
                    ["div", {cla: "permalinkdiv"},
                     [["span", {id: "shurlspan"},
                       ["a", {href: dlo.url,
                              onclick: jt.fs("window.open('" + dlo.url + "')")},
                        dlo.url]],
                      permalinkInfoHTML()]],
                    ["span", {cla: "shoutspan"},
                     signInToFollowHTML()],
                    app.layout.shareDivHTML(shareInviteHTML())];
                jt.out("ppcdshoutdiv", jt.tac2html(html));
                //make absolutely sure the share html is ready before
                //showing the share buttons.
                setTimeout(function () {
                    app.layout.showShareButtons(dst.obj.name, 
                                                dlo.url); }, 80); } }
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


    keysrch: function (label) {
        var keyval = jt.byId(label).value;
        if(jt.byId("pcdsrchin").value === keyval) {
            jt.byId(label).checked = false;
            jt.byId("pcdsrchin").value = ""; }
        else {
            jt.byId("pcdsrchin").value = keyval; }
        app.pcd.searchReviews();
    },


    updateSearchInputDisplay: function () {
        var imgsrc, html, title, style = "";
        imgsrc = "blank.png";
        title = "Toggle text/keyword search";
        if(!dst.obj.keywords) {
            title = "";
            srchst.mode = "nokeys"; }
        if(srchst.mode === "srchkey") {
            imgsrc = "keyicon2.png"; }
        else if(srchst.mode === "srchtxt") {
            imgsrc = "txticon2.png"; }
        html = [];
        if(srchst.mode === "srchkey") {
            dst.obj.keywords.csvarray().forEach(function (kwd, i) {
                var chk, kwc = "srchkwrbdiv";
                chk = jt.toru(srchst.qstr.indexOf(kwd) >= 0, "checked");
                if(longestWord(kwd).length > 9) {
                    kwc = "srchkwrbdbldiv"; }
                html.push(["div", {cla: kwc},
                           [["div", {cla: "skbidiv"},
                             ["input", {
                                 type: "radio", id: "skw" + i,
                                 name: "srchkwds", value: kwd, 
                                 checked: chk,
                                 onclick: jt.fsd("app.pcd.keysrch('skw" + 
                                                       i + "')")}]],
                            ["label", {fo: "skw" + i}, kwd.trim()]]]); });
            style = "display:none;"; }
        html.push(["input", {type: "text", id: "pcdsrchin", size: 30,
                             placeholder: "Search for...", style: style,
                             value: srchst.qstr}]);
        style = srchst.mode === "nokeys" ? "" : "cursor:pointer;";
        html = [["img", {cla: "reviewbadge", src: "img/" + imgsrc,
                         title: title,
                         style: style,
                         onclick: jt.fs("app.pcd.togsrchmode()")}],
                ["div", {id: "srchincontdiv"},
                 html]];
        jt.out("pcdsrchdiv", jt.tac2html(html));
    },


    searchReviews: function () {
        var srchin;
        srchin = jt.byId("pcdsrchin");
        if(!srchin) {  //query input no longer on screen.  probably switched
            return; }  //tabs so just quit
        if(!srchst.status !== "processing" && 
              (srchst.status === "initializing" ||
               srchst.revtype !== app.layout.getType() ||
               srchst.qstr !== srchin.value)) {
            app.pcd.toggleDownloadsDisp(true);  //rebuild downloads
            srchst.status = "processing";
            srchst.qstr = srchin.value;
            srchst.revtype = app.layout.getType();
            srchst.revs = searchFilterReviews(srchst.revs || [], 
                app.lcs.resolveIdArrayToCachedObjs("rev", dst.obj.recent));
            displaySearchResults();  //clears the display if none matching
            //If there are more revs on the server, offer to search further,
            //otherwise it is discomforting to not find something.
            if(srchst.revs.length < 20 && dst.obj.recent.length >= 50) {
                jt.out("pcdsrchdispdiv", searchServerHTML()); } }
        else {  //no change to search parameters yet, monitor
            app.pcd.fetchmore("linkonly");
            setTimeout(app.pcd.searchReviews, 400); }
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
                    displaySearchResults(); },
                app.failf(function (code, errtxt) {
                    jt.out("pcdsrchdispdiv", "searchReviews failed: " + 
                           code + " " + errtxt); }),
                jt.semaphore("pcd.searchReviews"));
    },


    toggleRevExpansion: function (prefix, revid) {
        var revs;
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
                  ["img", {src: "img/membiclogo.png?v=170524", 
                           cla: "hthimg"}]]],
                ", click the title to see if it was posted to any cooperative themes. If it was, you can click through to the theme and follow it. After following, you can apply for membership if you want to contribute."];
        if(!jt.byId("findctmdiv").innerHTML) {
            jt.out("findctmdiv", jt.tac2html(html)); }
        else {
            jt.out("findctmdiv", ""); }
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


    toggleDownloadsDisp: function (close) {
        var div = jt.byId("downloadlinksdiv");
        if(close || div.style.display !== "none") {
            div.style.display = "none"; }
        else {
            if(!div.innerHTML) {
                div.innerHTML = jt.tac2html(
                    [["div", {cla: "downloadoptdiv"},
                      ["a", {href: "", id: "dloptaTSV",
                             onclick: "app.pcd.dldata('TSV')",
                             download: "membics.tsv"},
                       [["img", {src: "img/download.png"}],
                        " Spreadsheet (TSV)"]]],
                     ["div", {cla: "downloadoptdiv"},
                      ["a", {href: "", id: "dloptaJSON",
                             onclick: "app.pcd.dldata('JSON')",
                             download: "membics.json"},
                       [["img", {src: "img/download.png"}],
                        " JavaScript (JSON)"]]]]); }
            div.style.display = "block"; }
    },


    dldata: function (format) {
        //setting the href makes it available for when the click
        //percolates upwards in the event processing.
        jt.byId("dlopta" + format).href = "data:text/plain;charset=utf-8," +
            encodeURIComponent(
                app.layout.formatMembics(currentTabMembics(), format));
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
        dst.tab = tab || defaultTabName();
        if(dst.tab === "top") {  //parameterized request
            document.title = document.title.replace(/^Top\s\d+\s/, "");
            dst.tab = "favorites"; }
        if(obj) {
            return displayObject(obj, expid); }
        if(dst.id) {
            return app.pcd.fetchAndDisplay(dst.type, dst.id, dst.tab); }
        if(dtype === "coop") {  //creating new coop
            dst.obj = { name: "", description: "", 
                        people: {}, founders: app.pen.myPenId() };
            dst.obj.people[app.pen.myPenId()] = app.pen.myPenName().name;
            return displayObject(dst.obj); }
        //At this point we have an unknown situation. One possibility
        //is an app crash resulting in a logout with no screen update,
        //then trying to display pen 0.  Best to just reload the page.
        document.location.reload();
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
        if(objref && objref[dtype] && objref[dtype].recent) {
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


    fetchAndDisplay: function (dtype, id, tab, expid) {
        app.pcd.blockfetch(dtype, id, function (obj) {
            if(!obj) {
                jt.log("pcd.fetchAndDisplay no obj");
                return app.activity.redisplay(); }
            app.pcd.display(dtype, id, tab || "", obj, expid); });
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
    }

};  //end of returned functions
}());

