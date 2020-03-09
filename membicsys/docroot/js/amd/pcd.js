/*global app, jt, window, confirm, document */

/*jslint browser, white, fudge, for, long */

//////////////////////////////////////////////////////////////////////
// PenName or Coop common display functions.
//

app.pcd = (function () {
    "use strict";

    var ctx = {};  //context for display processing
    var obacc = {MUser: {disptype:"profile", picfield:"profpic"},
                 Theme: {disptype:"theme", picfield:"picture"}};
    var dst = {type:"", id:"", tab:"", obj:null,
               MUser: {desclabel: "About Me",
                       descplace: "A message for visitors. Link to your site, or favorite quote?",
                       descfield: "aboutme",
                       piclabel: "Profile Pic",
                       picfield: "profpic",
                       dlparam: "u"},
               Theme: {desclabel: "Description",
                       descplace: "What is this theme focused on? What's appropriate to post?",
                       descfield: "description", 
                       piclabel: "Theme Pic",
                       picfield: "picture",
                       dlparam: "t"} };
    var srchst = {mtypes:"", kwrds:"", mode:"nokeys", qstr:"", status:""};
    var setdispstate = {infomode:""};
    var standardOverrideColors = [
        //lower case for all colors defined here
        //{name:"tab", value:"#ffae50", sel:".tablinksel", attr:"background"},
        {name:"link", value:"#84521a", sel: "A:link,A:visited,A:active", 
         attr:"color"},
        {name:"hover", value:"#a05705", sel:"A:hover", attr:"color"}];
    var noassoc =    //standardized messages if no Coop association
        {name:"Not Connected", //MUser.coops lev: 0
         imgsrc: app.dr("img/tsnoassoc.png"),
         levtxt:"You are not following this $dsType.",
         uptxt:"Follow for membic notices.",
         upbtn:"Follow",
         cantxt:"",
         canbtn:"",
         rejtxt:"",
         rejbtn:"",
         restxt:"",
         resbtn:"",
         resconf:"",
         notice:"" };
    var ctmmsgs = [  //standardized messages organized by Coop level
        {name:"Following", //MUser.coops lev: -1
         imgsrc: app.dr("img/tsfollowing.png"),
         levtxt:"Following shows you are interested in reading membics posted to this $dsType.",
         uptxt:"Only members may post.",
         upbtn:"Apply for membership",
         cantxt:"You are applying for membership.",
         canbtn:"Withdraw membership application",
         rejtxt:"Your membership application was rejected.",
         rejbtn:"Ok rejection",
         restxt:"",
         resbtn:"Stop following",
         resconf:"",
         notice:"is applying for membership" },
        {name:"Member",    //MUser.coops lev: 1
         imgsrc: app.dr("img/tsmember.png"),
         levtxt:"As a member, you may post membics related to this theme.",
         uptxt:"If you would like to help monitor new membics, you can apply to become a Moderator.",
         upbtn:"Apply to become a Moderator",
         cantxt:"You are applying to become a Moderator.",
         canbtn:"Withdraw Moderator application",
         rejtxt:"Your Moderator application was rejected.",
         rejbtn:"Ok rejection",
         restxt:"If you no longer wish to contribute, you can resign your membership and go back to just following.",
         resbtn:"Resign membership",
         resconf:"Are you sure you want to resign your membership?",
         notice:"is applying to become a Moderator" },
        {name:"Moderator", //MUser.coops lev: 2
         imgsrc: app.dr("img/tsmoderator.png"),
         levtxt:"As a moderator, you may remove any innapropriate membics from the theme.",
         uptxt:"To become a permanent co-owner, with full control over membership and all descriptive information, you can apply to become a Founder.",
         upbtn:"Apply to become a Founder",
         cantxt:"You are applying to become a Founder.",
         canbtn:"Withdraw your Founder application",
         rejtxt:"Your Founder application was rejected.",
         rejbtn:"Ok rejection",
         restxt:"If you no longer wish to help moderate, you can resign as a Moderator and go back to being a regular member.",
         resbtn:"Resign as Moderator",
         resconf:"Are you sure you want to resign as moderator?",
         notice:"is applying to become a Founder" },
        {name:"Founder",   //MUser.coops lev: 3
         imgsrc: app.dr("img/tsfounder.png"),
         levtxt:"As a Founder, you permanently have all privileges available.",
         uptxt:"",
         upbtn:"",
         cantxt:"",
         rejtxt:"",
         rejbtn:"",
         canbtn:"",
         restxt:"If you no longer want ownership, you can resign as a Founder and allow others to continue the cooperative theme.",
         resbtn:"Resign as Founder",
         resconf:"Are you sure you want to resign as Founder?"}];


    function printType () {
        var pt = "theme";
        if(dst.type !== "coop") {
            pt = "profile"; }
        return pt;
    }


    function fetchType (dtype) {
        switch(dtype) {
        case "profile": return "MUser";
        case "theme": return "Theme"; }
        return dtype;
    }


    function getDirectLinkInfo (usehashtag) {
        var infobj = {title: "", url: app.hardhome};
        if(dst.type === "profile") {
            infobj.url += "/" + dst.id;
            infobj.title = "Direct profile URL:"; }
        else if(usehashtag && dst.obj && dst.obj.hashtag) {
            infobj.url += "/" + dst.obj.hashtag;
            infobj.title = "Custom direct theme URL:"; }
        else {
            infobj.url += "/" + dst.id;
            infobj.title = "Direct theme URL:"; }
        return infobj;
    }


    function picImgSrc (obj) {
        var src = app.dr("img/nopicprof.png");
        if(obj[obacc[obj.dsType].picfield]) {  //e.g. profile.profpic
            src = "/api/obimg?dt=" + obj.dsType + "&di=" + obj.dsId +
                "&cb=" + obj.modified.replace(/[\-:]/g,""); }
        return src;
    }


    function modButtonsHTML () {
        if(app.solopage()) {
            return ""; }
        var html = ["a", {id:"pcdsettingslink", 
                          href:"#" + printType() + "settings",
                          title:printType().capitalize() + " Settings",
                          onclick:jt.fs("app.pcd.settings()")},
                    ["img", {cla:"webjump", src:app.dr("img/settings.png")}]];
        if(!app.profile.myProfile()) {  //not loaded yet, return placeholder
            html = ["img", {cla:"webjump", src:app.dr("img/settings.png"),
                            style:"opacity:0.4;"}]; }
        return jt.tac2html(html);
    }


    function accountInfoHTML () {
        var html = "";
        if(dst.type === "profile") {
            html = ["p", "Last modified " + 
                    jt.colloquialDate(jt.isoString2Day(dst.obj.modified))]; }
        return jt.tac2html(html);
    }


    function isMyMembershipAction (entry) {
        if(entry.targid === app.profile.myProfId() &&
           (entry.action.indexOf("Rejected") >= 0 ||
            entry.action.indexOf("Denied") >= 0 ||
            entry.action.indexOf("Accepted") >= 0 ||
            entry.action.indexOf("Demoted") >= 0)) {
            return true; }
        return false;
    }


    function personalInfoButtonHTML () {
        var les = dst.obj.adminlog;
        var html = "";
        if(les && les.length) {
            les.every(function (action) {
                if(isMyMembershipAction(action)) {
                    html = ["a", {href: "#myloginfo",
                              onclick: jt.fs("app.pcd.toggleCtmDet('mbinfo')")},
                            ["img", {cla: "myinfoimg", 
                                     src:app.dr("img/info.png")}]];
                    return false; } //found my latest, end iteration
                return true; }); }
        return html;
    }


    function membershipButtonLine (msgtxt, buttondivid, buttondeco, 
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
    }


    function getAssociationMessages(prof, porc) {
        var msgs = null;
        if(porc.dsType === "Theme") {
            var mlev = app.coop.membershipLevel(porc, prof.dsId);
            if(mlev) {
                msgs = ctmmsgs[mlev]; } }
        if(!msgs) {  //Use profile cache only if no Coop info
            if(prof.coops[porc.dsId]) {  //following
                msgs = ctmmsgs[0]; }
            else {  //no association
                msgs = noassoc; } }
        var cm = {};
        var pt = printType();
        Object.keys(msgs).forEach(function (key) {
            cm[key] = msgs[key].replace(/\$dsType/g, pt); });
        if(prof.coops[porc.dsId] && porc.dsType === "MUser") {
            cm.uptxt = "";
            cm.upbtn = ""; }  //no further up levels if following profile
        return cm;
    }


    function membershipSettingsHTML () {
        if(dst.id === app.profile.myProfId()) {
            return ""; }  //no membership settings for your own profile
        var msgs = getAssociationMessages(app.profile.myProfile(), dst.obj);
        var seeking = app.coop.isSeeking(dst.obj);
        var rejected = app.coop.isRejected(dst.obj);
        var html = [];
        //show application button if not in application process
        if(msgs.uptxt && !seeking && !rejected) {
            html.push(membershipButtonLine(
                msgs.uptxt, "memappbdiv", personalInfoButtonHTML(),
                "uplevelbutton", jt.fs("app.pcd.ctmmem('apply')"),
                msgs.upbtn)); }
        //show appropriate process button or default downlevel button
        if(rejected) {
            html.push(membershipButtonLine(
                msgs.rejtxt, "memappbdiv", personalInfoButtonHTML(),
                "accrejbutton", jt.fs("app.pcd.ctmmem('accrej')"),
                msgs.rejbtn)); }
        else if(seeking) {
            html.push(membershipButtonLine(
                msgs.cantxt, "memappbdiv", "",
                "withdrawbutton", jt.fs("app.pcd.ctmmem('withdraw')"),
                msgs.canbtn)); }
        //not seeking or rejected, show downlevel/resign button if relevant
        else if(msgs.resbtn) {
            html.push(membershipButtonLine(
                msgs.restxt, "rsbdiv", "",
                "downlevelbutton", jt.fs("app.pcd.ctmdownlev()"),
                msgs.resbtn)); }
        html = [["div", {cla: "formline", style:"text-align:center;"},
                 ["a", {href: "#togglecoopstat",
                        onclick: jt.fs("app.layout.togdisp('ctmstatdetdiv')")},
                  [["img", {src:msgs.imgsrc}],
                   ["span", {id: "memlevspan"},
                    (seeking? "Applying" : msgs.name)]]]],
                ["div", {cla: "formline", id: "ctmstatdetdiv",
                         style: "display:none;"},
                 [["div", {cla: "formline"},
                   msgs.levtxt],
                  html]]];
        return html;
    }


    function membershipAppNoticeHTML (profid, name, mlev) {
        var html;
        html = ["div", {cla: "ctmmemdiv"},
                [["div", {cla: "fpprofdivsp"},
                  ["img", {cla: "fpprofpic",
                           src: "profpic?profileid=" + profid,
                           title: jt.ndq(name),
                           alt: "prof pic"}]],
                 ["a", {href: "view=profile&profid=" + profid,
                        onclick: jt.fs("app.profile.byprofid('" + profid + 
                                       "','membapp')")},
                  ["span", {cla: "proflist"}, name]],
                 "&nbsp;" + ctmmsgs[mlev].notice,
                 ["div", {cla: "formline"}],
                 ["div", {cla: "formline", id: "reasondiv" + profid,
                          style: "display:none;"},
                  [["label", {fo: "reasonin" + profid, cla: "liflab",
                              id: "reasonlab" + profid},
                    "Reason"],
                   ["input", {id: "reasonin" + profid, cla: "lifin",
                              type: "text"}]]],
                 ["div", {cla: "formline inlinebuttonsdiv", 
                          id: "abdiv" + profid},
                  [["button", {type: "button", id: "rejectb" + profid,
                               onclick: jt.fs("app.pcd.memapp('reject" +
                                              "','" + profid + "')")},
                    "Reject"],
                   ["button", {type: "button", id: "acceptb" + profid,
                               onclick: jt.fs("app.pcd.memapp('accept" +
                                              "','" + profid + "')")},
                    "Accept"]]]]];
        return html;
    }


    function applicantName (coop, profid) {
        var people = dst.obj.people || {};
        var name = people[profid];
        if(!name) {
            var prof = app.profile.myProfile();
            if(prof && prof.coops && prof.coops[coop.dsId]) {
                var notices = prof.coops[coop.dsId].notices || [];
                notices.forEach(function (note) {
                    if(note.uid === profid) {
                        name = note.uname; } }); } }
        if(!name) {
            name = profid; }
        return name;
    }


    function outstandingApplicationsHTML () {
        if(!dst.obj.seeking) {
            return ""; }
        var mlev = app.coop.membershipLevel(dst.obj);
        if(mlev < 2) {
            return ""; }
        var html = [];
        dst.obj.seeking.csvarray().forEach(function (profid) {
            var name = applicantName(dst.obj, profid);
            var slev = app.coop.membershipLevel(dst.obj, profid);
            if(mlev > slev || mlev === 3) {
                html.push(membershipAppNoticeHTML(profid, name, slev)); } });
        return html;
    }


    function adminLogTargetHTML (logentry) {
        var profid;
        if(logentry.action === "Removed Membic") {
            return logentry.tname; }
        if(logentry.action.startsWith("Resigned")) {
            return ""; }
        profid = logentry.targid;
        return ["a", {href: "view=profile&profid=" + profid,
                      onclick: jt.fs("app.profile.byprofid('" + profid + 
                                     "','adminlog')")},
                logentry.tname];
    }


    function coopLogHTML (filter) {
        var les = dst.obj.adminlog;
        if(!les || !les.length) {
            return "No log entries"; }
        les = les.slice(0, 10);  //don't scroll forever
        var html = [];
        les.forEach(function (logentry) {
            var profid;
            if(!filter || (filter === "membership" &&
                           isMyMembershipAction(logentry))) {
                profid = logentry.profid;
                html.push(
                    ["div", {cla: "adminlogentrydiv"},
                     [["span", {cla: "logdatestampspan"}, 
                       logentry.when.slice(0, 10) + ": "],
                      ["a", {href: "view=profile&profid=" + profid,
                             onclick: jt.fs("app.profile.byprofid('" + profid + 
                                            "')")},
                       ["span", {cla: "logdatestampspan"},
                        logentry.pname || profid]],
                      " " + logentry.action + " ",
                      adminLogTargetHTML(logentry),
                      (logentry.reason? ": " + logentry.reason : "")]]); } });
        return jt.tac2html(html);
    }


    function coopMembershipLineHTML (mlev, plev, pid, pname) {
        var icons = ["", "tsmember.png", "tsmoderator.png", "tsfounder.png"];
        var html = [["img", {src:app.dr("img/" + icons[plev]),
                             alt:icons[plev].slice(2, -4)}],
                    ["img", {cla:"memberlistprofpic", 
                             alt:"prof pic for " + pname,
                             src:"profpic?profileid=" + pid}],
                    ["span", {cla:"memberlistnamespan"}, pname]];
        if(mlev > plev && pid !== app.profile.myProfId()) { //wrap for edit
            html = [["div", {cla:"formline", id:"memlistdiv" + pid},
                     ["a", {href:"#demote", 
                            onclick:jt.fs("app.layout.togdisp('memdemdiv" +
                                          pid + "')")},
                      html]],
                    ["div", {cla:"formline", id:"memdemdiv" + pid,
                             style:"display:none;"},
                     [["label", {fo:"reasonin" + pid, cla:"liflab",
                                  id:"reasonlab" + pid},
                       "Reason"],
                      ["input", {id:"reasonin" + pid, cla:"lifin",
                                  placeholder:"Reason required",
                                  type:"text"}],
                       ["div", {cla:"formline formbuttonsdiv",
                                id:"memdembuttondiv" + pid},
                        ["button", {type:"button", id:"demoteb" + pid,
                                    onclick:jt.fs("app.pcd.memdem('" + 
                                                  pid + "')")},
                         "Demote"]]]]]; }
        else {  //not modifiable, just wrap in plain enclosing div
            html = ["div", {cla:"formline", id:"memlistdiv" + pid}, html]; }
        html = ["div", {cla:"memberlistlinediv"}, html];
        return html;
    }


    function coopMembershipHTML () {
        var mlev = app.coop.membershipLevel(dst.obj);
        var html = [];
        app.coop.memberSummary(dst.obj).forEach(function (sum) {
            html.push(coopMembershipLineHTML(
                mlev, sum.lev, sum.profid, sum.name)); });
        html.push(["div", {cla: "formline"}, ""]); //final clear
        return jt.tac2html(html);
    }


    function adminSettingsHTML () {
        var memsel = "";
        var oah = "";
        if(dst.type === "coop") {
            oah = outstandingApplicationsHTML();
            if(app.coop.membershipLevel(dst.obj) >= 2) {
                memsel = [
                    "a", {href: "#memberinfo",
                          onclick: jt.fs("app.pcd.toggleCtmDet('members')")},
                    ["img", {cla: "ctmsetimg", 
                             src:app.dr("img/membership.png")}]]; } }
        var signout = "";
        if(dst.type === "profile" && dst.id === app.profile.myProfId()) {
            signout = ["button", {type:"button", 
                                  onclick:jt.fs("app.login.logout()")},
                       "Sign&nbsp;out"]; }
        var html = [["div", {cla: "formline", id: "settingsinfolinediv"},
                     [["div", {id: "ctminfoseldiv"},
                       ["a", {href: "#actioninfo",
                              onclick: jt.fs("app.pcd.toggleCtmDet('info')")},
                        ["img", {cla: "ctmsetimg", 
                                 src:app.dr("img/info.png")}]]],
                      ["div", {id: "meminfoseldiv",
                               style: (memsel? "" : "display:none;")}, 
                       memsel],
                      signout]],
                    ["div", {cla: "formline"}, oah],
                    ["div", {cla: "formline", id: "midispdiv",
                             style: "display:none;"}]];
        return html;
    }


    function getPicInfo () {
        var pi = {havepic: false, src:app.dr("img/nopicprof.png")};
        if(dst.type === "profile") {
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
    }


    function picFileSelChange () {
        var fv = jt.byId("picfilein").value;
        //chrome yields a value like "C:\\fakepath\\circuit.png"
        fv = fv.split("\\").pop();
        jt.out("picfilelab", fv);
        jt.byId("picfilelab").className = "filesellab2";
        jt.byId("upldsub").style.visibility = "visible";
    }


    function picSettingsHTML () {
        if(!jt.hasId(dst.obj) ||  //need an instance to upload image into
           (dst.type === "coop" && app.coop.membershipLevel(dst.obj) < 3) ||
           (dst.type === "profile" && dst.id !== app.profile.myProfId())) {
            return ""; }
        var pinf = getPicInfo();
        var html = [["label", {fo:"picuploadform", cla:"overlab",
                               style:(pinf.havepic? "display:none;" : "")},
                     pinf.lab],
                    ["div", {id:"whypicdiv", cla:"formline", 
                             style:"display:none;"},
                     ["div", {cla:"fieldexpdiv"}, pinf.exp]],
                    ["form", {action:"/picupload", method:"post",
                              enctype:"multipart/form-data", target:"tgif",
                              id:"picuploadform"},
                     [jt.paramsToFormInputs(app.login.authparams()),
                      jt.paramsToFormInputs("picfor=" + dst.type + 
                                            "&dsId=" + dst.obj.dsId),
                      ["div", {cla:"ptddiv"},
                       [["img", {id:"upldpicimg", cla:"profimgdis",
                                 src:pinf.src}],
                        ["div", {id:"upldpicform", cla:"picsideform"},
                         [["div", {cla:"fileindiv"},
                           [["input", {type:"file", cla:"hidefilein",
                                       name:"picfilein", id:"picfilein"}],
                            ["label", {fo:"picfilein", cla:"filesellab",
                                       id:"picfilelab"},
                             "Choose&nbsp;Image"],
                            ["div", {cla:"picsideformbuttonsdiv"},
                             ["input", {type:"submit", cla:"formbutton",
                                        style:"visibility:hidden;",
                                        onclick:jt.fs("app.pcd.upsub()"),
                                        id:"upldsub", value:"Upload"}]]]],
                          ["div", {id:"imgupstatdiv", cla:"formstatdiv"}]]]]]]],
                    ["iframe", {id:"tgif", name:"tgif", src:"/picupload",
                                style:"display:none"}]];
        return html;
    }
    function picSettingsInit () {
        jt.on("picfilein", "change", picFileSelChange);
        app.pcd.monitorPicUpload();
    }


    function descripSettingsHTML () {
        if((dst.type === "coop" && app.coop.membershipLevel(dst.obj) < 3) ||
           (dst.type === "profile" && dst.id !== app.profile.myProfId())) {
            return ""; }
        var nameplace = "Theme name required.";
        if(dst.type !== "coop") {
            nameplace = "Set a profile name!"; }
        var nh = ["div", {cla:"formline"},
                  [["label", {fo:"namein", cla:"liflab", id:"namelab"},
                    "Name"],
                   ["input", {id:"namein", cla:"lifin", type:"text",
                              placeholder:nameplace, value:dst.obj.name}]]];
        var ht = ["div", {cla:"formline"},
                  [["label", {fo:"hashin", cla:"liflab", id:"hashlab"},
                    "Hashtag&nbsp;#"],
                   ["input", {id:"hashin", cla:"lifin", type:"text",
                              placeholder:"uniqueandshort",
                              value:dst.obj.hashtag}]]];
        var ark = "";
        if(dst.type === "coop" && dst.dsId) {
            ark = ["div", {cla:"formline"},
                   [["input", {type:"checkbox", id:"arkcb", value:"archived",
                               checked:jt.toru(
                                   app.coop.hasFlag(dst.obj,"archived"))}],
                    ["label", {fo:"arkcb"}, "Archive (no further posts)"]]]; }
        var btxt = "Create Theme";
        if(jt.hasId(dst.obj)) {
            btxt = "Update Description"; }
        var html = [nh,
                    //textarea label conflicts visually with placeholder
                    //text when empty.  Removed to reduce visual clutter.
                    ["textarea", {id:"shouteditbox", cla:"dlgta"}],
                    ht,
                    ark,
                    ["div", {id:"formstatdiv"}],
                    ["div", {cla:"dlgbuttonsdiv"},
                     ["button", {type:"button", id:"okbutton",
                                 onclick:jt.fs("app.pcd.saveDescription()")},
                      btxt]]];
        return html;
    }
    function descripSettingsInit () {
        var defs = dst[dst.type];
        var shout = jt.byId("shouteditbox");
        if(shout) {
            shout.readOnly = false;
            shout.value = dst.obj[defs.descfield];
            shout.placeholder = defs.descplace; }
        //set the focus only if not already filled in
        var namein = jt.byId("namein");
        if(namein && !namein.value) {
            namein.focus(); }
        else if(shout && !shout.value) {
            shout.focus(); }
    }


    function personalSettingsHTML () {
        if(dst.type !== "profile" || dst.id !== app.profile.myProfId()) {
            return ""; }
        var html = ["div", {cla:"formline"},
                    [["a", {href:"#togglepersonalinfo",
                            onclick:jt.fs("app.layout.togdisp('profpidiv')")},
                      [["img", {cla:"ctmsetimg",
                                src:app.dr("img/personinfo.png")}],
                       ["span", {cla:"settingsexpandlinkspan"},
                        "Personal Info"]]],
                     ["div", {cla:"formline", id:"profpidiv",
                              style:"display:none;"},
                      app.login.accountSettingsHTML()]]];
        return html;
    }


    function reviewTypeKeywordsHTML (prof) {
        var html = [];
        var kwu = app.profile.getKeywordUse(prof);
        app.membic.getMembicTypes().forEach(function (rt) {
            var defkeys = app.profile.keywordsForRevType(rt);
            html.push(
                ["div", {cla:"rtkwdiv", id:"rtkwdiv" + rt.type},
                 [["div", {cla:"formline"},
                   [["img", {cla:"reviewbadge", src:app.dr("img/" + rt.img)}],
                    ["input", {id:"kwcsvin" + rt.type, cla:"keydefin", 
                               type:"text", placeholder:"Checkbox keywords",
                               value:jt.spacedCSV(defkeys)}]]],
                  ["div", {cla:"formline"},
                   ["span", {cla:"kwcsvspan"},
                    [["span", {cla:"kwcsvlabel"}, "Recent:"],
                     jt.spacedCSV(kwu.recent[rt.type])]]],
                  ["div", {cla:"formline"},
                   ["span", {cla:"kwcsvspan"},
                    [["span", {cla:"kwcsvlabel"}, "Default:"],
                     jt.spacedCSV(kwu.system[rt.type])]]]]]); });
        return html;
    }


    function themeKeywordsHTML () {
        var html;
        html = ["div", {cla:"rtkwdiv", id:"themekwdiv"},
                ["div", {cla:"formline"},
                 [["img", {cla:"reviewbadge", src:picImgSrc(dst.obj)}],
                  ["input", {id:"kwcsvin", cla:"keydefin",
                             type:"text", 
                             placeholder:"keywords separated by commas",
                             value:dst.obj.keywords}]]]];
        return html;
    }


    function keywordSettingsHTML () {
        var label = "";
        var html = "";
        switch(dst.type) {
        case "profile": 
            if(dst.id !== app.profile.myProfId()) {
                return ""; }
            label = "Checkbox Keywords";
            html = reviewTypeKeywordsHTML(dst.obj);
            break;
        case "coop": 
            if(!jt.hasId(dst.obj) || app.coop.membershipLevel(dst.obj) < 3) {
                return ""; }
            label = "Theme Keywords";
            html = themeKeywordsHTML();
            break;
        default: return ""; }
        html = ["div", {cla:"formline"},
                [["a", {href:"#togglecustomkeywords",
                        onclick:jt.fs("app.layout.togdisp('profkwdsdiv')")},
                  [["img", {cla:"ctmsetimg", src:app.dr("img/checkbox.png")}],
                   ["span", {cla:"settingsexpandlinkspan"},
                    label]]],
                 ["div", {cla:"formline", id:"profkwdsdiv",
                          style:"display:none;"},
                  [html,
                   ["div", {cla:"dlgbuttonsdiv"},
                    [["button", {type:"button", id:"updatekwdsb",
                                 onclick:jt.fs("app.pcd.updateKeywords()")},
                      "Update Keywords"],
                     ["div", {id:"updatekwdserrdiv", cla:"errdiv"}]]]]]]];
        return html;
    }


    function mailInDescHTML () {
        var inm = "me@membic.org";
        var html = [["table", {cla:"mailindesctable"}, ["tbody", [
            ["tr", [["td", "From:"], ["td", dst.obj.email]]],
            ["tr", [["td", "To:"], ["td", ["a", {href:"mailto:" + inm}, inm]]]],
            ["tr", [["td", "Subj:"], ["td", "Why memorable?"]]],
            ["tr", [["td", "Body:"], ["td", "Link"], ["td", [
                "a", {href:"#more", 
                      onclick:jt.fs("app.toggledivdisp('mailindetdiv')")},
                "more..."]]]]]]],
                    ["div", {id:"mailindetdiv", cla:"formline", 
                             style:"display:none;"},
                     "If you want your profile to accept mail-in membics from an address other than your account login, you can specify a single alternate email here. All receipt confirmations will be sent to " + dst.obj.email + "."]];
        return html;
    }


    function mailinSettingsHTML () {
        if(dst.type !== "profile" || dst.id !== app.profile.myProfId() ||
           !jt.hasId(dst.obj)) {
            return ""; }  //Only for personal accounts. Edit to post through.
        var html = ["div", {cla:"formline"},
                    [["a", {href:"#togglemailinsettings",
                            onclick:jt.fs("app.layout.togdisp('mailinsdiv')")},
                      [["img", {cla:"ctmsetimg",
                                src:app.dr("img/emailbw22.png")}],
                       ["span", {cla:"settingsexpandlinkspan"},
                        "Mail-In Membics"]]],
                     ["div", {cla:"formline", id:"mailinsdiv",
                              style:"display:none;"},
                      ["div", {cla:"rtkwdiv", id:"mailinaccsdiv"},
                       [["div", {cla:"mailindescdiv"}, mailInDescHTML()],
                        ["div", {cla:"formline", style:"font-size:small;"},
                         ["Alternate authorized email:"]],
                        ["div", {cla:"formline"},
                         ["input", {id:"emaddrin", cla:"keydefin", type:"text",
                                    placeholder:"othermail@example.com",
                                    value:dst.obj.altinmail || ""}]],
                        ["div", {cla:"dlgbuttonsdiv"},
                         [["button", {type:"button", id:"updatemiab",
                                      onclick:jt.fs("app.pcd.updateMailins()")},
                           "Update Mail-Ins"],
                          ["div", {id:"updmiserrdiv", cla:"errdiv"}]]]]]]]];
        return html;
    }


    function rssSettingsHTML () {
        if(!jt.hasId(dst.obj)) {  //need an dsId for rss url
            return ""; }
        var html = ["div", {cla:"formline"},
                    [["a", {href:"#rss", 
                            onclick:jt.fs("app.pcd.rssHelp()")},
                      [["img", {cla:"ctmsetimg",
                                src:app.dr("img/rssicon.png")}],
                       ["span", {cla:"settingsexpandlinkspan"},
                        "RSS Feed"]]]]];
        return html;
    }
    function fillRSSDialogAreas () {
        var furl = window.location.href;
        if(furl.endsWith("/")) {
            furl = furl.slice(0, -1); }
        furl += "/rssfeed?" + dst.type + "=" + dst.obj.dsId +
            "&ts=st&ds=dvrk";
        var ta = jt.byId("rsslinkta");
        if(ta) {
            ta.readOnly = true;
            ta.value = furl; }
    }


    function getOverriddenColor(name, defcolor) {
        var color = defcolor;
        if(dst.obj.cliset && dst.obj.cliset.embcolors) {
            color = dst.obj.cliset.embcolors[name] || defcolor; }
        return color;
    }


    function soloSettingsHTML () {
        if(!jt.hasId(dst.obj) || (dst.type === "coop" &&
                                  app.coop.membershipLevel(dst.obj) < 3)) {
            return ""; }
        var html = [];
        standardOverrideColors.forEach(function (soc) {
            var colorval = getOverriddenColor(soc.name, soc.value);
            html.push(["div", {cla:"formline"},
                       [["label", {fo:soc.name + "in", cla:"liflab"},
                         soc.name],
                        ["input", {id:soc.name + "in", cla:"lifin",
                                   type:"color", value:colorval}]]]); });
        html = ["div", {cla:"formline"},
                [["a", {href:"#togglepermcolors",
                        onclick:jt.fs("app.layout.togdisp('ctmcolordiv')")},
                  [["img", {cla:"ctmsetimg", src:app.dr("img/colors.png")}],
                   ["span", {cla:"settingsexpandlinkspan"},
                    "Embed Colors"]]],
                 ["div", {cla:"formline", id:"ctmcolordiv",
                          style:"display:none;"},
                  [html,
                   ["div", {cla:"dlgbuttonsdiv"},
                    ["button", {type:"button", id:"savecolorsbutton",
                                onclick:jt.fs("app.pcd.saveSoloColors()")},
                     "Update Colors"]],
                   ["div", {cla:"formline", id:"colorupderrdiv"}]]]]];
        return html;
    }


    function embedSettingsHTML () {
        if(!jt.hasId(dst.obj)) {
            return ""; }
        var html = ["div", {cla:"formline"},
                    [["a", {href:"#embed", 
                            onclick:jt.fs("app.pcd.embedHelp()")},
                      [["img", {cla:"ctmsetimg", src:app.dr("img/embed.png")}],
                       ["span", {cla:"settingsexpandlinkspan"},
                        "Embed Feed"]]]]];
        return html;
    }
    function fillEmbedDialogAreas () {
        var site = window.location.href;
        if(site.endsWith("/")) {
            site = site.slice(0, -1); }
        var ta = jt.byId("embdlta");
        if(ta) {
            ta.readOnly = true;
            ta.value = getDirectLinkInfo().url; }
        ta = jt.byId("embifta");
        if(ta) {
            ta.readOnly = true;
            ta.value = "<iframe id=\"membiciframe\" src=\"" + app.hardhome +
                "/" + dst.id + "?site=EXAMPLE.COM\" " +
                "style=\"position:relative;height:100%;width:100%\" " +
                "seamless=\"seamless\" frameborder=\"0\"></iframe>"; }
        ta = jt.byId("embwpta");
        if(ta) {
            ta.readOnly = true;
            ta.value = site + "/rssfeed?" + dst.type + "=" + dst.dsId; }
    }


    function isKeywordMatch (membic) {
        if(!srchst.kwrds) {  //not filtering by keyword
            return true; }
        //if the membic keywords include at least one of the specified
        //search keywords then it's a match.
        return srchst.kwrds.csvarray().some(function (keyword) {
            return (membic.keywords &&   //in case null rather than ""
                    membic.keywords.csvcontains(keyword)); });
    }


    function isTypeMatch (membic) {
        if(!srchst.mtypes) {  //not filtering by type
            return true; }
        if(srchst.mtypes.csvcontains(membic.revtype)) {
            return true; }
        return false;
    }


    function isQueryStringMatch (membic) {
        if(!srchst.qstr) {  //not filtering by text search
            return true; }
        var revtxt = "";
        var fields = ["text", "name", "title", "url", "artist", "author", 
                      "publisher", "album", "starring", "address",
                      "keywords"];  //keywords may contain non-checkbox words
        fields.forEach(function (field) {
            revtxt += " " + (membic[field] || ""); });
        revtxt = revtxt.toLowerCase();
        var toks = srchst.qstr.toLowerCase().split(/\s+/);
        //if the membic text includes each of the search words regardless of
        //ordering, then it's a match.
        return toks.every(function (token) {
            return revtxt.indexOf(token) >= 0; });
    }


    function isSearchableMembic (rev) {
        if(!rev.revtype) {  //could be an overflow indicator
            return false; }
        var nowiso = new Date().toISOString();
        if(dst.type === "coop") {
            if(rev.ctmid !== dst.obj.dsId) {
                return false; }  //source reference, not a coop rev
            if(rev.dispafter && rev.dispafter > nowiso &&
               !app.coop.membershipLevel(dst.obj)) {
                return false; } }  //not a member and not showing yet
        if(dst.type === "profile") {
            if(rev.dispafter && rev.dispafter > nowiso &&
               rev.penid !== app.profile.myProfId()) {
                return false; } }  //not yours and not showing yet
        return true;
    }


    function searchFilterReviews (membics) {
        var filtered = [];
        membics.forEach(function (membic) {
            if(isSearchableMembic(membic) && 
               isKeywordMatch(membic) &&
               isTypeMatch(membic) &&
               isQueryStringMatch(membic)) {
                filtered.push(membic); } });
        return filtered;
    }


    function updateResultsEmailLink (sortedRevs) {
        var eml = jt.byId("emaillink");
        if(!eml) {
            return; }
        var subj = "Selected links from " + dst.obj.name;
        var body = "Here are some links from " + dst.obj.name + ".\n" +
            "To select links yourself, go to https://membic.org/" +
            dst.obj.dsId;
        sortedRevs.forEach(function (rev) {
            body += "\n\n" + rev.url + "\n" + (rev.title || rev.name) + "\n" +
                rev.text; });
        var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body);
        eml.href = link;
    }


    function displaySearchResults () {
        var sortedRevs = srchst.revs;
        if(srchst.mode === "srchkey") {
            sortedRevs = srchst.revs.slice();  //copy recency ordered array
            sortedRevs.sort(function (a, b) {
                if(a.rating > b.rating) { return -1; }
                if(a.rating < b.rating) { return 1; }
                if(a.modified > b.modified) { return -1; }
                if(a.modified < b.modified) { return 1; }
                return 0; }); }
        var includeAuthorsInRevs = (dst.type === "coop");
        var xem = "";
        if(dst.type === "profile" && dst.id === app.profile.myProfId() &&
           (!dst.obj.preb || !dst.obj.preb.length)) {
            xem = "Click the write button above."; }
        app.membic.displayMembics("pcdsrchdispdiv", "pcds", sortedRevs,
                                  "app.pcd.toggleRevExpansion",
                                  includeAuthorsInRevs, xem);
        updateResultsEmailLink(sortedRevs);
        srchst.disprevs = sortedRevs;
        srchst.status = "waiting";
    }


    function createStyleOverridesForEmbedding () {
        jt.byId("pcduppercontentdiv").style.display = "none";
        jt.byId("bodyid").style.paddingLeft = "0px";
        jt.byId("bodyid").style.paddingRight = "0px";
    }


    function createColorOverrides () {
        var sheet;
        if(!app.embedded) {
            return; }
        if(!dst || !dst.obj || !dst.obj.cliset || !dst.obj.cliset.embcolors) {
            return; }
        sheet = window.document.styleSheets[0];
        standardOverrideColors.forEach(function (soc) {
            var color = getOverriddenColor(soc.name, "");
            if(color) {
                soc.sel.csvarray().forEach(function (sel) {
                    var rule = sel + " { " + soc.attr + ": " + color + "; }";
                    jt.log("createColoroverrides inserted rule: " + rule);
                    sheet.insertRule(rule, sheet.cssRules.length); }); } });
    }


    function changeSiteTabIcon () {
        var link = document.createElement("link");
        link.type = "image/x-icon";
        link.rel = "shortcut icon";
        link.href = "/api/obimg?dt=" + fetchType(dst.type) + "&di=" + dst.id;
        document.getElementsByTagName("head")[0].appendChild(link);
    }


    function customizeSoloPageDisplay () {
        if(app.embedded) {
            createStyleOverridesForEmbedding(); }
        createColorOverrides();
        changeSiteTabIcon();
    }


    function shareMailLink () {
        var url = ctx.descobj.exturl + "&action=settings";
        var subj = "Invitation to " + ctx.descobj.name;
        var body = "Hi,\n\n" +
            "Check out " + ctx.descobj.name + " " + url + ". You can follow new posts via email or RSS. Low noise, trusted info.\n\n";
        var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body) + "%0A%0A";
        return link;
    }


    function shareAndFollowButtons () {
        var tac = app.layout.shareButtonsTAC(
            {url:ctx.descobj.exturl,
             title:ctx.descobj.name,
             mref:shareMailLink(),
             socmed:["tw", "fb", "em"]});
        if(ctx.descobj.rssurl) {
            tac.push(["a", {href:ctx.descobj.rssurl,  //right click to copy
                            cla:"resp-sharing-button__link",
                            id:"rsslink", title:"RSS feed",
                            onclick:jt.fs("app.pcd.rssHelp('standalone')")},
                      ["div", {cla:"resp-sharing-button" + 
                               " resp-sharing-button--small" +
                               " resp-sharing-button--rss"},
                       ["div", {cla:"resp-sharing-button__icon" + 
                                " resp-sharing-button__icon--solid",
                                "aria-hidden":"true"},
                        ["img", {src:app.dr("img/rssiconwhite.png"),
                                 style:"max-width:16px;"}]]]]); }
        if(app.solopage()) {
            var membicurl = ctx.descobj.exturl + "&action=settings";
            tac.push(["a", {href:membicurl, //right click to copy
                            cla:"resp-sharing-button__link",
                            id:"membiclink", title:"Follow on Membic",
                            onclick:jt.fs("window.open('" + membicurl + "')")},
                      ["div", {cla:"resp-sharing-button" + 
                               " resp-sharing-button--small" +
                               " resp-sharing-button--membic"},
                       ["div", {cla:"resp-sharing-button__icon" + 
                                " resp-sharing-button__icon--solid",
                                "aria-hidden":"true"},
                        ["img", {src:app.dr("img/membiciconwhite.png"),
                                 style:"max-width:16px;"}]]]]); }
        return tac;
    }


    function writeContentAreas (defs, obj) {
        app.pcd.setPageDescription({picsrc:picImgSrc(obj),
                                    name:obj.name || obj.dsId,
                                    descr:obj[defs.descfield] || ""});
        jt.out("pgactdiv", jt.tac2html(
            [["div", {id:"pcdctrldiv"},
              ["div", {id:"pcdactdiv"}]],
             ["div", {id:"pcdnotidiv"}]]));
        jt.out("contentdiv", jt.tac2html(
            ["div", {id:"pcdouterdiv"},
             ["div", {id:"pcdcontdiv"}]]));
    }


    function showContentControls () {
        var html = [
            ["div", {id:"pcdactcontentdiv"}, 
             [["div", {id:"pcdacsharediv"},
               [["a", {href: "/" + dst.id, title:"Share",
                       onclick: jt.fs("app.pcd.togshare()")},
                 ["span", {id:"namearrowspan", cla:"penbutton"},
                  ["img", {id:"pnarw", cla:"webjump", 
                           src:app.dr("img/sharemenu.png")}]]],
                ["span", {cla:"penbutton"},
                 modButtonsHTML()]]],
              ["div", {id:"pcdacsrchdiv"},
               [["a", {href:"#search", title:"Search Membics",
                       onclick:jt.fs("app.pcd.searchReviews()")},
                 ["img", {src:app.dr("img/search.png"), cla:"webjump"}]],
                ["input", {type:"text", id:"pcdsrchin", size:26,
                           placeholder: "Text search...",
                           value: srchst.qstr,
                           onchange:jt.fs("app.pcd.searchReviews()")}]]],
              ["div", {id:"pcdacemdiv"},
               ["a", {id:"emaillink", href:"#filledInByMembicsDisplay"},
                ["img", {src:app.dr("img/emailbw22.png")}]]]]],
            ["div", {id:"pcdsharediv", style:"display:none;"}, 
             shareAndFollowButtons()],
            ["div", {id:"pcdkeysrchdiv"}],
            ["div", {id:"pcdtypesrchdiv"}]];
        jt.out("pcdactdiv", jt.tac2html(html));
        html = [["div", {id:"pcdsrchdispdiv"}],
                ["div", {id:"pcdovermorediv"}]];
        jt.out("pcdcontdiv", jt.tac2html(html));
    }


    function settingsButtonHTML () {
        if(app.solopage()) {
            return ""; }  //no settings button at all if page is embedded
        if(!ctx.actobj.settingsf) {
            return jt.tac2html(  //no settings, return disabled placeholder
                ["img", {cla:"webjump", src:app.dr("img/settings.png"),
                         style:"opacity:0.4;"}]); }
        return jt.tac2html(
            ["a", {id:"pcdsettingslink",
                   href:"#" + ctx.descobj.disptype + "settings",
                   title:ctx.descobj.disptype.capitalize() + " Settings",
                   onclick:jt.fs("app.pcd.settings()")},
             ["img", {cla:"webjump", src:app.dr("img/settings.png")}]]);
    }


    function writeActionsArea () {
        jt.out("pcdactdiv", jt.tac2html(
            [["div", {id:"pcdactcontentdiv"}, 
              [["div", {id:"pcdacsharediv"},
                [["a", {href:ctx.descobj.exturl, title:"Share",
                        onclick: jt.fs("app.pcd.togshare()")},
                  ["span", {cla:"penbutton"},
                   ["img", {id:"pnarw", cla:"webjump", 
                            src:app.dr("img/sharemenu.png")}]]],
                 ["span", {cla:"penbutton"},
                  settingsButtonHTML()]]],
               ["div", {id:"pcdacsrchdiv"},
                [["a", {href:"#search", title:"Text Search",
                        onclick:jt.fs("app.pcd.filterContent('change')")},
                  ["img", {src:app.dr("img/search.png"), cla:"webjump"}]],
                 ["input", {type:"text", id:"pcdsrchin", size:26,
                            placeholder: "Text search...",
                            onchange:jt.fs("app.pcd.filterContent('change')"),
                            value: srchst.qstr}]]]]],
             ["div", {id:"pcdsharediv", style:"display:none;"}, 
              shareAndFollowButtons()],
             ["div", {id:"pcdkeysrchdiv"}],
             ["div", {id:"pcdtypesrchdiv"}]]));
    }
        

    function initializeSearchState () {
        srchst.status = "initializing";
        srchst.mtypes = "";
        srchst.kwrds = "";
        srchst.qstr = "";
        srchst.revs = [];
        srchst.disprevs = [];
    }


    function resetDisplayStateFromObject (obj) {
        if(typeof(obj.preb) === "object" && !obj.preb.length) {
            //just in case preb had a bad value like {}
            obj.preb = []; }
        jt.log("resetDisplayStateFromObject " + obj.dsType + 
               " id:" + obj.dsId + " name:" + obj.name);
        dst.obj = obj;
        dst.mtypes = "";
        dst.keywords = "";
    }


    function findTypesForKeyword (key) {
        var res = "";
        //PENDING: extend to also check user profile type overrides
        var rts = app.membic.getMembicTypes();
        rts.forEach(function (rt) {
            if(rt.dkwords.indexOf(key) >= 0) {
                res = res.csvappend(rt.type); } });
        return res;
    }


    function findThemesForKeyword (key) {
        var res = "";
        //Current theme should always be the first entry if matched
        if(dst.type === "coop") {
            if(dst.obj.keywords && dst.obj.keywords.csvcontains(key)) {
                res = res.csvappend(dst.id); } }
        var prof = app.profile.myProfile();
        if(prof && prof.coops) {
            Object.keys(prof.coops).forEach(function (ctmid) {
                var ckws = prof.coops[ctmid].keywords;
                if(ckws && ckws.csvcontains(key)) {
                    res = res.csvappend(ctmid); } }); }
        return res;
    }


    function findKeywordsFromMembics () {
        var keys = {};
        dst.obj.preb.forEach(function (membic) {
            //keywords are filtered based on type selections
            if(isSearchableMembic(membic) && isTypeMatch(membic)) {
                var keywords = membic.keywords || "";
                keywords.csvarray().forEach(function (key) {
                    key = key.trim();
                    if(!keys[key]) {
                        keys[key] = {count:0,
                                     types:findTypesForKeyword(key),
                                     themes:findThemesForKeyword(key)}; }
                    keys[key].count += 1; }); } });
        return keys;
    }


    function filterAndSortKeys (keydict) {
        var keys = [];
        //Unofficial keywords are not included.  Text search only.
        Object.keys(keydict).forEach(function (key) {
            var kwd = keydict[key];
            //if type-specific keyword and type selected, then include it
            if(kwd.types && srchst.mtypes) {
                srchst.mtypes.csvarray().forEach(function (selt) {
                    if(kwd.types.csvcontains(selt)) {
                        kwd.include = true; } }); }
            //if theme-specific keyword and showing that theme, then include it
            if(kwd.themes && dst.type === "coop") {
                if(kwd.themes.csvcontains(dst.id)) {
                    kwd.include = true; } }
            if(kwd.include) {
                kwd.keyword = key;
                keys.push(kwd); } });
        keys.sort(function (a, b) {
            var akey = a.keyword.toLowerCase();
            var bkey = b.keyword.toLowerCase();
            if(akey > bkey) { return 1; }
            if(akey < bkey) { return -1; }
            return 0; });
        var res = "";
        keys.forEach(function (key) {
            res = res.csvappend(key.keyword); });
        return res;
    }


    function updateKeywordsSelectionArea () {
        var keys = findKeywordsFromMembics();
        dst.keywords = filterAndSortKeys(keys);
        // if(!dst.keywords) {
        //     jt.byId("pcdkeysrchdiv").style.display = "none";
        //     return; }
        var html = [];
        dst.keywords.csvarray().forEach(function (kwd, i) {
            var chk = jt.toru(srchst.kwrds.indexOf(kwd) >= 0, "checked");
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
            //types are filtered based on keyword selections
            if(isSearchableMembic(membic) && isKeywordMatch(membic) &&
               !types.csvcontains(membic.revtype)) {
                types = types.csvappend(membic.revtype); } });
        return types;
    }


    function updateTypesSelectionArea () {
        dst.mtypes = findTypesFromMembics();
        // if(dst.mtypes.csvarray().length < 2) {
        //     jt.byId("pcdtypesrchdiv").style.display = "none";
        //     return; }
        var html = [];
        dst.mtypes.csvarray().forEach(function (mt, i) {
            var chk = jt.toru(srchst.mtypes.csvcontains(mt), "checked");
            html.push(["div", {cla:"srchkwrbdiv"},
                       [["div", {cla:"skbidiv"},
                         ["input", {type:"checkbox", id:"smt" + i,
                                    name:"srchtypes", value:mt,
                                    checked:chk,
                                    onclick:jt.fsd("app.pcd.typesrch()")}]],
                        ["label", {fo:"smt" + i}, mt.capitalize()]]]); });
        jt.out("pcdtypesrchdiv", jt.tac2html(html));
    }


    function handleCommand (cmd) {
        if(!cmd || app.solopage()) {
            return; }
        if(!app.login.isLoggedIn()) {
            jt.log(cmd + " command not available unless signed in.");
            return; }
        if(cmd.toLowerCase() === "settings" && app.profile.myProfile()) {
            return app.pcd.settings(); }
        if(cmd.toLowerCase() === "follow") {
            //they are logged in, but profile may not have been loaded yet
            app.profile.fetchProfile(function (prof) {
                if(!prof.coops[dst.id]) {  //not following
                    app.profile.follow(dst.obj, function () {
                        app.pcd.settings(); }); }
                else {
                    return app.pcd.settings(); } }); }
    }


    //Does not closeDialog or cancelOverlay.  action=follow processing
    //requires the overlay stay up.
    function displayObject (obj, command) {
        obj = obj || dst.obj;
        app.statemgr.setState(obj, command);
        resetDisplayStateFromObject(obj);
        initializeSearchState();
        var defs = dst[dst.type];
        writeContentAreas(defs, obj);
        if(app.solopage()) {
            customizeSoloPageDisplay(); }
        if(!jt.hasId(dst.obj)) {  //creating a new theme
            jt.out("pcdcontdiv", "Settings required.");
            return app.pcd.settings(); }
        if(dst.type === "coop" && dst.obj.dsId) {
            app.profile.verifyMembership(dst.obj); }
        showContentControls();
        updateKeywordsSelectionArea();
        updateTypesSelectionArea();
        app.pcd.showNotices();
        app.pcd.searchReviews();
        handleCommand(command);
        //To show relevant notices for the theme, or do anything personal
        //with it, the profile needs to be available.  Fault in if needed
        if(!app.solopage() && app.login.isLoggedIn() && 
           !app.profile.myProfile()) {
            //This has to be significantly delayed or the browser thinks it
            //should skip loading pics and otherwise finishing the display.
            app.fork({descr:"pcd displayObject call profile.fetchProfile",
                      ms:1800,
                      func:function () {
                          app.profile.fetchProfile(function () {
                              displayObject(dst.obj, command); }); }}); }
    }


    function verifyFunctionConnections () {
        if(!dst.MUser.objupdate) {
            dst.MUser.objupdate = app.profile.update;
            dst.Theme.objupdate = app.coop.updateCoop; }
    }


    function imgsrcForThemeId (ctmid) {
        var imgsrc = app.dr("img/blank.png");
        if(ctmid) {
            imgsrc = "ctmpic?coopid=" + ctmid; }
        return imgsrc;
    }


    function addNotice (notice) {
        jt.log("addNotice " + notice.text);
        var bgs = {red:"#ff9e30", green:"#b5dcbf", yellow:"#fcfeaf"};
        var ndiv = document.createElement("div");
        ndiv.className = "noticediv";
        ndiv.id = notice.id;
        var imgsrc = app.dr("img/info.png");
        switch(notice.type) {
        case "settings": 
            imgsrc = app.dr("img/settings.png");
            ndiv.style.background = bgs.red;
            break;
        case "theme":
            imgsrc = imgsrcForThemeId(notice.pic);
            ndiv.style.background = bgs.green;
            ndiv.style.fontSize = "medium";
            break;
        case "threj":
            imgsrc = imgsrcForThemeId(notice.pic);
            ndiv.style.background = bgs.yellow;
            ndiv.style.fontSize = "medium";
            break; }
        ndiv.innerHTML = jt.tac2html([
            ["div", {cla:"notimgdiv"},
             ["a", {href:"#" + notice.id, onclick:notice.fstr,
                    title:notice.text},
              ["img", {cla:"noticeimg", src:imgsrc}]]],
            ["div", {cla:"noticetxtdiv"},
             ["a", {href:"#" + notice.id, onclick:notice.fstr},
              notice.text]]]);
        jt.byId("pcdnotidiv").appendChild(ndiv);
    }


    function addThemeNotice (prof, ctm, note, appf) {
        var levs = ["", "Member", "Moderator", "Founder"];
        var txt;
        if(note.type === "application") {
            if(note.status === "pending") {
                txt = note.uname + " is applying";
                if(note.uid === prof.dsId) {
                    txt = "You are applying"; }
                txt += " to become a " + levs[note.lev] + " of " + ctm.name;
                addNotice({type:"theme", id:"app" + ctm.dsId + note.uid,
                           text:txt, fstr:appf, pic:ctm.picture}); }
            else if(note.status === "rejected") {
                txt = "Your " + levs[note.lev] + " application to " +
                    ctm.name + " was rejected: " + note.reason;
                addNotice({type:"threj", id:"app" + ctm.dsId + note.uid,
                           text:txt, fstr:appf, pic:ctm.picture}); } }
    }


    function showThemeNotices(prof) {
        prof.coops = prof.coops || {};
        Object.keys(prof.coops).forEach(function (ctmid) {
            var ctm = prof.coops[ctmid];
            var notices = ctm.notices || [];
            var appf = jt.fs("app.pcd.fetchAndDisplay('coop','" + ctmid + 
                             "','Settings')");
            notices.forEach(function (note) {
                addThemeNotice(prof, ctm, note, appf); }); });
    }


    function showProfileNotices(prof) {
        if(!prof.name) {
            addNotice({type:"settings", id:"profileName",
                       text:"Set your Profile name...",
                       fstr:jt.fs("app.pcd.settings()")}); }
        if(!prof.profpic) {
            addNotice({type:"settings", id:"profilePic",
                       text:"Upload a profile pic for visual authorship.",
                       fstr:jt.fs("app.pcd.settings()")}); }
    }


    function indicateAndHandleOverflow () {
        var preb = dst.obj.preb;
        if(!preb.length || preb[preb.length - 1].dsType !== "Overflow") {
            return jt.out("pcdovermorediv", ""); }
        //indicate that the current display is missing overflowed info
        //and they can click to get more
        jt.out("pcdovermorediv", jt.tac2html(
            ["a", {href:"#more",
                   onclick:jt.fs("app.pcd.searchReviews()")},
             "More..."]));
        //fetch one more level of overflow so it will be available next time.
        //dst.obj.preb is copied/filtered/sorted before display, so generally
        //no timing conflict updating preb here after fetch.  Overflows are 
        //rarely updated, and can be helpful to keep them for dereferencing 
        //again after writing another membic.
        var ovrsum = preb[preb.length - 1];  //no preb info in summary
        app.refmgr.getFull(ovrsum.dsType, ovrsum.dsId, function (overflow) {
            if(overflow) {
                dst.obj.preb = preb.slice(0, -1).concat(overflow.preb); }
            else {
                jt.out("pcdovermorediv", app.failmsg(
                    "Unable to load Overflow " + ovrsum.dsId)); } });
    }


    //make a single searchable text field for the entire membic.
    function verifySearchFilterText (membic) {
        if(membic.srchFiltTxt) {
            return; }  //already set up
        var txt = "";
        var fields = ["url", "rurl", "revtype", "cankey", "text", "keywords"];
        fields.forEach(function (field) {
            txt += " " + (membic[field] || ""); });
        fields = ["name", "title", "artist", "author", "publisher", "album", 
                  "starring", "address", "year"];
        fields.forEach(function (field) {
            txt += " " + (membic.details[field] || ""); });
        membic.srchFiltTxt = txt.toLowerCase();
    }


    function membicSearchMatch (membic, fist) {
        if(membic.srcrev === "-604") {
            return false; }  //marked as deleted
        if((membic.dispafter > fist.ts) &&
           (!((membic.ctmid && app.coop.membershipLevel(fist.contextobj)) ||
              (membic.penid === app.profile.myProfId())))) {
            return false; }  //queued, and not visible to general public yet
        if(!fist.matchCriteriaSpecified || membic.dsType === "Overflow") {
            return true; }  //nothing to match against, ok.
        if(fist.kwrds.disp &&
           !fist.kwrds.sel.some((keyword) => membic.keywords &&
                                   membic.keywords.csvcontains(keyword))) {
            return false; }  //did not match specified keywords(s)
        if(fist.types.disp &&
           !fist.types.sel.some((type) => type === membic.revtype)) {
            return false; }  //did not match a specified type
        if(fist.qstr) {
            var toks = srchst.qstr.toLowerCase().split(/\s+/);
            verifySearchFilterText(membic);
            if(toks.some((token) => membic.srchFiltTxt.indexOf(token) >= 0)) {
                return true; }  //have at least one text match
            return false; }
        return true;  //if not any other condition, assume it's a match
    }


    function membicDisplayHTML (membic, fist) {
        //expansion divs (fist.idx ids) are filled out later as needed.
        if(membic.dsType === "Overflow") {
            return "Overflow HTML goes here"; }
        return jt.tac2html(
            ["div", {cla:"mdouterdiv"},
             ["div", {cla:"mdinnerdiv"},
              [["div", {cla:"mdtitlediv"}, 
                app.membic.mdTitleHTML(membic, fist)],
               ["div", {cla:"mdactdiv", id:"mdactdiv" + fist.idx}],
               ["div", {cla:"mdsharediv", id:"mdsharediv" + fist.idx}],
               ["div", {cla:"mdbodydiv"},
                 [["div", {cla:"mdpicdiv"}, app.membic.mdPicHTML(membic)],
                  ["div", {cla:"mdtxtdiv"}, jt.linkify(membic.text)],
                  ["div", {cla:"mddetdiv"}, app.membic.mdDetsHTML(membic)],
                  ["div", {cla:"mdkwsdiv"}, membic.keywords]]],
               ["div", {cla:"mdptsdiv", id:"mdptsdiv" + fist.idx}]]]]);
    }


    function ptSettingsDisplay (obj) {
        jt.log("ptSettingsDisplay not implemented yet" + obj);
    }


    function ptNoticesDisplay (obj) {
        jt.log("ptNoticesDisplay not implemented yet" + obj);
    }


    function displayPTObj (obj) {
        app.pcd.setPageDescription({picsrc:picImgSrc(obj),
                                    disptype:obacc[obj.dsType].disptype,
                                    exturl:app.pcd.linkForThemeOrProfile(obj),
                                    name:obj.name,
                                    descr:obj.description || obj.aboutme});
        app.pcd.setPageActions({itlist:obj.preb,
                                itmatchf:membicSearchMatch,
                                itdispf:membicDisplayHTML,
                                contextobj:obj,
                                settingsf:ptSettingsDisplay,
                                notif:ptNoticesDisplay});
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    linkForThemeOrProfile: function (obj) {
        var link = "/" + obj.hashtag;
        //sharing on socmed and other situationa requires a permalink, without
        //parameter arguments.  Essentially special-case hashtags.
        if(!obj.hashtag) {  //use a permalink (non parameterisze
            if(obj.dsType === "MUser" || obj.obtype === "profile") {
                link = "/profile/" + obj.dsId; }
            else if(obj.dsType === "Theme" || obj.obtype === "theme") {
                link = "/theme/" + obj.dsId; } }
        return link;
    },


    settings: function (obj) {
        if(obj) {
            dst.obj = obj; }
        var html = [
            "div", {id: "pcdsettingsdlgdiv"},
            [["div", {cla: "bumpedupwards"},
              ["div", {cla: "headingtxt"}, "Settings"]],
             ["div", {cla: "pcdsectiondiv"},
              adminSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              membershipSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              picSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              descripSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              personalSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              keywordSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              mailinSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              rssSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              embedSettingsHTML()],
             ["div", {cla: "pcdsectiondiv"},
              soloSettingsHTML()]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   app.login.accountSettingsInit();
                                   picSettingsInit();
                                   descripSettingsInit(); },
                               jt.hasId(dst.obj)? "" : 
                                   jt.fs("app.pcd.cancelThemeCreate()"));
    },


    upsub: function () {
        var upldbutton = jt.byId("upldsub");
        upldbutton.disabled = true;
        upldbutton.value = "Uploading...";
        jt.byId("picuploadform").submit();
    },


    //There are lots of RSS feed plugins for WordPress, including at least
    //one that will copy the content into the page.
    rssHelp: function (standalone) {
        var sampreader = "https://feedly.com";  //sample RSS reader
        var samphub = "https://hootsuite.com";  //sample social media hub
        var html = [
            //title
            ["div", {id: "pcdembeddlgdiv"},
             [["div", {cla: "bumpedupwards"},
               ["div", {cla: "headingtxt"}, 
                printType().capitalize() + " Feed"]]]],
            //rss link text area
            ["div", {cla: "pcdsectiondiv"},
             [["span", {cla: "setpldlgmspan"}, "RSS feed"],
                       " (for ",
              ["a", {href: "#sampleRSSReader",
                     onclick: jt.fs("window.open('" + sampreader + "')")},
               "RSS reader"],
              ", site feed plugin, or ",
              ["a", {href: "#socialMediaHub",
                     onclick: jt.fs("window.open('" + samphub + "')")},
               "social media hub"],
              ")",
              ["div", {cla: "setplustdiv"},
               ["textarea", {id: "rsslinkta", cla: "setpldlgta", rows: 4}]]]],
            //custom param description.  Anyone who wants to know if https
            //is available will already know enough to just try it.
            ["div", {cla: "pcdsectiondiv"},
             ["You can customize the <em>title summary</em> (ts) and <em>detail summary</em> (ds) values:",
              ["ul",
               [["li", "<b>t</b>: title or name"],
                ["li", "<b>s</b>: stars (as asterisks)"],
                ["li", "<b>d</b>: why memorable"],
                ["li", "<b>r</b>: membic type (e.g. \"book\")"],
                ["li", "<b>k</b>: keywords"],
                ["li", "<b>v</b>: vertical bar delimiter"]]]]]];
        if(!standalone) {
            //back link to return to settings
            html.push(["div", {cla: "pcdsectiondiv"},
                      ["a", {href: "#settings",
                             onclick: jt.fs("app.pcd.settings()")},
                       [["img", {src:app.dr("img/arrow18left.png")}],
                        " Return to Settings"]]]); }
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   fillRSSDialogAreas(); });
    },


    embedHelp: function () {
        var html = [
            //title
            ["div", {id: "pcdembeddlgdiv"},
             [["div", {cla: "bumpedupwards"},
               ["div", {cla: "headingtxt"},
                "Embed " + printType().capitalize()]]]],
            //iframe text area
            ["div", {cla: "pcdsectiondiv"},
             [["span", {cla: "setpldlgmspan"}, "Embed iframe"],
              " (replace EXAMPLE.COM with your domain)",
              ["div", {cla: "embdlgline"},
               ["textarea", {id: "embifta", cla: "setpldlgta", rows: 5}]]]],
            //Standalone URL text area
            ["div", {cla: "pcdsectiondiv"},
             [["span", {cla: "setpldlgmspan"}, "Standalone URL"],
              " (for use with your own custom domain)",
              ["div", {cla: "embdlgline"},
               ["textarea", {id: "embdlta", cla: "setpldlgta"}]]]],
            //use RSS feed for syndicated content wordpress and such
            ["div", {cla: "pcdsectiondiv"},
             ["If your site does not support frames, try including your " +
              "syndicated content via ",
              ["a", {href:"#RSS", onclick:jt.fs("app.pcd.rssHelp()")},
               "RSS"]]],
            //back link to return to settings
            ["div", {cla: "pcdsectiondiv"},
             ["a", {href: "#settings",
                    onclick: jt.fs("app.pcd.settings()")},
              [["img", {src:app.dr("img/arrow18left.png")}],
               " Return to Settings"]]]];
        app.layout.openOverlay({x:10, y:80}, jt.tac2html(html), null,
                               function () {
                                   fillEmbedDialogAreas(); });
    },


    saveDescription: function () {
        var changed = false; var val;
        jt.byId("okbutton").disabled = true;
        var defs = dst[dst.type];
        var elem = jt.byId("namein");
        if(elem) {  //can be changed back to "" so read even if no value
            changed = jt.changeSet(dst.obj, "name", jt.trimval(elem.value)) ||
                changed; }
        elem = jt.byId("shouteditbox");
        if(elem) {
            changed = jt.changeSet(dst.obj, defs.descfield, elem.value) ||
                changed; }
        elem = jt.byId("hashin");
        if(elem) {
            val = jt.trimval(elem.value);
            if(val.indexOf("#") === 0) {
                val = val.slice(1); }
            changed = jt.changeSet(dst.obj, "hashtag", val) || changed; }
        elem = jt.byId("arkcb");
        if(elem) {
            val = "";
            if(elem.checked) {
                val = new Date().toISOString(); }
            if((app.coop.hasFlag(dst.obj, "archived") && !val) ||
               (!app.coop.hasFlag(dst.obj, "archived") && val)) {
                changed = true; }
            app.coop.setFlag(dst.obj, "archived", val); }
        var errors = app.verifyNoEmbeddedHTML(
            dst.obj, ["name", defs.descfield, "hashtag"], null, ["b", "i"]);
        if(errors.length) {
            jt.byId("okbutton").disabled = false;
            jt.out("formstatdiv", errors[0]);
            return; }
        if(!changed) {
            return app.layout.cancelOverlay(); }
        if(changed) {  //update functions handle cache and bookkeeping
            defs.objupdate(dst.obj,
                           function (updobj) {
                               dst.obj = updobj;
                               dst.id = updobj.dsId;  //verify set if new
                               app.layout.cancelOverlay();
                               app.pcd.redisplay(); },
                           function (code, errtxt) {
                               jt.byId("okbutton").disabled = false;
                               jt.out("formstatdiv", 
                                      jt.errhtml("Update", code, errtxt)); }); }
    },


    updateKeywords: function () {
        var val;
        var failfunc = function (code, errtxt) {
            jt.out("updatekwdserrdiv", "Description update failed " + code +
                   " " + errtxt); };
        if(dst.type === "profile") {
            var custom = false;
            app.membic.getMembicTypes().forEach(function (rt) {
                val = jt.byId("kwcsvin" + rt.type).value;
                val = val.csvarray().join(",");  //remove whitespace in CSV
                if(val !== rt.dkwords.join(",")) {
                    dst.obj.cliset.ctkeys = dst.obj.cliset.ctkeys || {};
                    dst.obj.cliset.ctkeys[rt.type] = val;
                    custom = true; } });
            if(custom) {
                app.profile.update(dst.obj, app.pcd.redisplay, failfunc); } }
        else if(dst.type === "coop") {
            val = jt.byId("kwcsvin").value;
            dst.obj.keywords = val;
            app.coop.updateCoop(dst.obj, app.pcd.redisplay, failfunc); }
    },


    updateMailins: function () {
        dst.obj.altinmail = jt.byId("emaddrin").value.trim();
        app.profile.update(dst.obj, app.pcd.redisplay, function (code, errtxt) {
            jt.out("updmiserrdiv", "Mail-Ins update failed " + code +
                   " " + errtxt); });
    },


    monitorPicUpload: function () {
        var mtag = "Done: ";
        var tgif = jt.byId("tgif");
        if(tgif) {
            var txt = tgif.contentDocument || tgif.contentWindow.document;
            if(txt && txt.body) {
                txt = txt.body.innerHTML;
                if(txt.indexOf(mtag) === 0) {
                    var defs = dst[dst.type];
                    dst.obj[defs.picfield] = dst.id;
                    dst.obj.modified = txt.slice(mtag.length);
                    app.layout.cancelOverlay();
                    app.refmgr.uncache("activetps", "411");  //refresh imgsrc cb
                    app.pcd.display(dst.type, dst.id);
                    return; }
                if(txt && txt.trim() && txt.trim() !== "Ready") {
                    var upldbutton = jt.byId("upldsub");
                    upldbutton.disabled = false;
                    upldbutton.value = "Upload";
                    jt.out("imgupstatdiv", txt); } }
            app.fork({descr:"monitor pic upload",
                      func:app.pcd.monitorPicUpload,
                      ms:800}); }
    },


    saveSoloColors: function () {
        var defs = dst[dst.type];
        jt.byId("savecolorsbutton").disabled = true;
        standardOverrideColors.forEach(function (soc) {
            var color = jt.byId(soc.name + "in").value;
            if(color && color.toLowerCase() !== soc.value) {
                dst.obj.cliset.embcolors = dst.obj.cliset.embcolors || {};
                dst.obj.cliset.embcolors[soc.name] = color.toLowerCase(); } });
        defs.objupdate(dst.obj,
            function (updobj) {
                dst.obj = updobj;
                app.layout.cancelOverlay();
                app.pcd.display(dst.type, dst.id); },
            function (code, errtxt) {
                jt.byId("savecolorsbutton").disabled = false;
                jt.out("colorupderrdiv", "Update failed code " + code +
                       ": " + errtxt); });
    },


    closeandprof: function () {
        app.layout.cancelOverlay();
        app.layout.closeDialog();
        app.profile.display();
    },


    ctmmem: function (action) {
        if(action === "apply") {
            if(!app.profile.following(dst.id)) {
                jt.out("memappbdiv", "Following");
                return app.profile.follow(dst.obj, function () {
                    app.pcd.settings(dst.obj); }); }
            var prof = app.profile.myProfile();
            if(prof && (!prof.name || !prof.profpic)) {
                //prof is available if new account created, but may not be
                //yet in other situations.  A complete profile is not
                //strictly required, but it helps to try keep the
                //application process clean for new accounts.
                jt.out("memappbdiv", jt.tac2html(
                    ["Please ",
                     ["a", {href:"#profile",
                            onclick:jt.fs("app.pcd.closeandprof()")},
                      "complete your profile"],
                     " before applying"]));
                return; }
            jt.out("memappbdiv", "Applying..."); }
        else if(action === "withdraw") {
            jt.out("memappbdiv", "Withdrawing..."); }
        else if(action === "accrej") {
            jt.out("memappbdiv", "Acknowledging..."); }
        app.coop.applyForMembership(dst.obj, action, app.pcd.settings);
    },


    ctmdownlev: function () {
        if(!jt.hasId(dst.obj)) {  //creating new coop and not instantiated yet
            app.layout.cancelOverlay();
            return app.pcd.display("coop"); }
        var mlev = app.coop.membershipLevel(dst.obj);
        var confmsg = ctmmsgs[mlev].resconf;
        if(confmsg && !confirm(confmsg)) {
            return; }
        if(mlev > 0) {
            jt.out("rsbdiv", "Resigning");
            app.coop.processMembership(dst.obj, "demote", 
                                       app.profile.myProfId(),
                                       "", app.pcd.settings); }
        else {
            jt.out("rsbdiv", "Disconnecting");
            app.profile.unfollow(dst.obj, function () {
                app.pcd.settings(dst.obj); }); }
    },


    togshare: function () {
        var sharediv = jt.byId("pcdsharediv");
        if(!sharediv) {
            return; }
        if(sharediv.style.display === "block") {
            sharediv.style.display = "none"; }
        else {
            sharediv.style.display = "block"; }
    },


    membicItemNameHTML: function (type, membic) {
        var linktxt = "";
        if(membic.details && typeof(membic.details) === "string") {
            app.refmgr.deserialize(membic); }
        var dets = membic.details || {};
        if(type.subkey) {
            linktxt = "<i>" + jt.ellipsis(dets[type.key], 60) + "</i> " +
                jt.ellipsis(dets[type.subkey], 40); }
        else {
            linktxt = jt.ellipsis(dets[type.key], 60); }
        return linktxt;
    },


    keysrch: function () {
        srchst.kwrds = "";
        dst.keywords.csvarray().forEach(function (kwd, i) {
            var cb = jt.byId("skw" + i);
            if(cb.checked) {
                srchst.kwrds = srchst.kwrds.csvappend(kwd); } });
        updateTypesSelectionArea();  //update types in response to keys
        app.pcd.searchReviews();
    },


    typesrch: function () {
        srchst.mtypes = "";
        dst.mtypes.csvarray().forEach(function (mt, i) {
            var cb = jt.byId("smt" + i);
            if(cb.checked) {
                srchst.mtypes = srchst.mtypes.csvappend(mt); } });
        updateKeywordsSelectionArea();  //update keys in response to types
        app.pcd.searchReviews();
    },


    showNotices: function () {
        jt.out("pcdnotidiv", "");
        var prof = app.profile.myProfile();
        if(!prof || dst.type !== "profile" || dst.id !== prof.dsId) {
            return; }  //not viewing own profile
        showProfileNotices(prof);
        showThemeNotices(prof);
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
        indicateAndHandleOverflow();
    },


    toggleRevExpansion: function (prefix, revid) {
        var actspan = jt.byId(prefix + revid + "actspan");
        if(!actspan) {
            jt.log("pcd.toggleRevExpansion: no actspan to toggle");
            return; }
        if(!actspan.innerHTML) {  //initialize
            var rev = dst.obj.preb.find(function (r) {
                return r.dsId === revid; });
            if(rev.penid === app.profile.myProfId()) {  //my membic
                var html = ["a", {href:"#edit",
                                  onclick:jt.fs("app.pcd.editMembic('" + 
                                                rev.dsId + "')")},
                            ["img", {cla:"revedimg", 
                                     src:app.dr("img/writereview.png")}]];
                if(dst.id === app.profile.myProfId()) {  //my profile
                    html = [["a", {href:"#delete",
                                   onclick:jt.fs("app.pcd.deleteMembic('" + 
                                                 rev.dsId + "')")},
                             ["img", {cla:"revedimg",
                                      src:app.dr("img/trash.png")}]],
                            html]; }
                actspan.innerHTML = jt.tac2html(html); }
            else {  //someone else's membic
                var prof = app.profile.myProfile();
                if(prof && prof.coops && prof.coops[dst.id] && 
                   prof.coops[dst.id].lev >= 2) {
                    actspan.innerHTML = jt.tac2html(
                        ["a", {href:"#remove",
                               onclick:jt.fs("app.pcd.removeMembic('" + 
                                             rev.dsId + "')")},
                         ["img", {cla:"revedimg", src:app.dr("img/trash.png"),
                                  id:"trashmembic" + revid}]]); }
                else {  //fill with a space to avoid initializing again
                    actspan.innerHTML = "&nbsp;"; } } }
        if(actspan.style.display === "none") {
            actspan.style.display = "inline"; }
        else {
            actspan.style.display = "none"; }
        app.membic.toggleExpansion(srchst.disprevs, prefix, revid);
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
        else {
            app.layout.togdisp("midispdiv"); }
    },


    memapp: function (verb, profid) {
        var elem;
        switch(verb) {
        case "reject":
            elem = jt.byId("reasondiv" + profid);
            if(elem.style.display !== "block") {
                elem.style.display = "block";
                jt.byId("reasonin" + profid).focus(); }
            else {
                elem = jt.byId("reasonin" + profid);
                if(!elem.value || !elem.value.trim()) {
                    jt.byId("reasonlab" + profid).style.color = "red"; }
                else { //have reason
                    jt.out("abdiv" + profid, "Rejecting...");
                    app.coop.processMembership(dst.obj, verb, profid,
                                               elem.value.trim(),
                                               app.pcd.settings); } }
            break;
        case "accept":
            jt.out("abdiv" + profid, "Accepting...");
            app.coop.processMembership(dst.obj, verb, profid, "", 
                                        app.pcd.settings);
            break;
        default:
            jt.log("pcd.memapp unknown verb: " + verb); }
    },


    memdem: function (profid) {
        var elem;
        elem = jt.byId("reasonin" + profid);
        if(elem && elem.value.trim()) {
            jt.out("memdembuttondiv" + profid, "Demoting...");
            app.coop.processMembership(dst.obj, "demote", profid, 
                                        elem.value.trim(),
                                        app.pcd.settings); }
    },


    display: function (dtype, id, command) {
        verifyFunctionConnections();
        if(dtype === "profile" && !id) {
            id = app.profile.myProfId(); }
        if(dtype && id) {  //object should already be cached
            dst.type = dtype;
            dst.id = id;
            dst.obj = app.refmgr.cached(fetchType(dtype), id);
            return displayObject(dst.obj, command); }
        if(dtype === "coop") {  //creating new coop
            var prof = app.profile.myProfile();
            if(!prof.name) {
                jt.err("You need to have a name for your profile.");
                return app.profile.displayProfile(); }
            dst.type = "coop";
            dst.obj = {name:"", description:"", 
                       people:{}, founders:app.profile.myProfId()};
            dst.obj.people[app.profile.myProfId()] = prof.name;
            return displayObject(dst.obj); }
    },


    redisplay: function () {
        app.layout.cancelOverlay();
        app.layout.closeDialog();
        app.pcd.display(dst.type, dst.id);
    },


    resetState: function () {
        dst.type = "";
        dst.id = "";
        dst.obj = null;
        srchst = { revtype: "all", qstr: "", status: "" };
        setdispstate = { infomode: "" };
    },


    getDisplayState: function () {
        return dst;
    },


    editingTheme: function () {
        if(dst && dst.type === "coop" && dst.id) {
            return dst.id; }
        return 0;  //appends to parameters as "0", server evals that as false
    },


    fetchType: function (dtype) { return fetchType(dtype); },


    fetchAndDisplay: function (dtype, id, extra) {
        var command = (extra && extra.command) || "";
        app.statemgr.verifyState(dtype, id, extra, function () {
            if(!id) {
                jt.log("pcd.fetchAndDisplay " + dtype + " required an id");
                jt.log(new Error().stack); }
            app.refmgr.getFull(fetchType(dtype), id, function (obj) {
                if(!obj) {
                    jt.log("pcd.fetchAndDisplay no obj " + dtype + " " + id);
                    return app.connect.display(); }
                displayPTObj(obj, command); }); });
    },


    cancelThemeCreate: function () {
        app.layout.cancelOverlay();
        app.pcd.display("profile", app.profile.myProfId(), "coops");
    },


    editMembic: function (revid) {
        var rev = dst.obj.preb.find(function (r) { 
            return r.dsId === revid; });
        if(dst.type === "coop") {
            rev = app.profile.myProfile().preb.find(function (r) {
                return r.dsId === rev.srcrev; }); }
        app.membic.start(rev);
    },


    deleteMembic: function (revid) {
        //delete is only available when viewing your own profile
        var rev = dst.obj.preb.find(function (r) { 
            return r.dsId === revid; });
        //not bringing up the review dialog since people might get confused
        //and think they are editing, even if the button says "Delete".  A
        //low-level looking confirmation warning is appropriate.
        if(!confirm("Are you sure you want to delete this membic?")) {
            return; }
        var descrdiv = jt.byId("pcds" + revid + "descrdiv");
        descrdiv.innerHTML = "Deleting...";
        rev.srcrev = -604;  //mark as deleted.
        rev.ctmids = "";    //no theme post-throughs, delete any existing.
        app.review.serializeFields(rev);
        jt.call("POST", "saverev?" + app.login.authparams(), jt.objdata(rev),
                function (updobjs) {
                    jt.log("delete completed successfully");
                    app.lcs.uncache("activetps", "411");
                    updobjs.forEach(function (updobj) {
                        if(updobj.dsType === "MUser" || 
                           updobj.dsType === "Theme") {
                            app.lcs.put(updobj.dsType, updobj); } });
                    app.pcd.redisplay(); },
                app.failf(function (code, errtxt) {
                    descrdiv.innerHTML = "Delete failed: " + code + " " + 
                        errtxt; }),
                jt.semaphore("pcd.deleteMembic"));
    },


    removeMembic: function (rtid) {
        var rev = dst.obj.preb.find(function (r) { 
            return r.dsId === rtid; });
        var rin = jt.byId("whyremovein");
        if(!rin) {
            var placetext = "Let " + rev.penname + 
                " know why you are removing their Membic";
            var html = ["div", {id:"removemembicdiv"},
                        [["textarea", {id:"whyremovein", cla:"dlgta",
                                       placeholder:placetext}],
                         ["div", {cla:"formline errdiv", id:"removedlgerrdiv"}],
                         ["div", {cla:"formline formbuttonsdiv",
                                  id:"removedlgbuttonsdiv"},
                          ["button", {type:"button", id:"removeb" + rtid,
                                      onclick:jt.fs("app.pcd.removeMembic('" +
                                                    rtid + "')")},
                           "Remove"]]]];
            html = app.layout.dlgwrapHTML("Remove Reason", html);
            app.layout.openDialog(  //same x coordinate as review dialog
                {x: Math.max(jt.byId("contentdiv").offsetLeft - 34, 20),
                 y: jt.geoPos(jt.byId("trashmembic" + rtid)).y - 40},
                jt.tac2html(html));
            return; }
        if(!rin.value) {
            jt.out("removedlgerrdiv", "Reason required to remove Membic");
            return; }
        //source membic is with author's profile, probably not loaded.
        jt.byId("removeb" + rtid).disabled = true;
        jt.out("removedlgerrdiv", "Removing...");
        var data = jt.objdata({revid:rtid, coopid:dst.id, reason:rin.value,
                               editingtheme:app.pcd.editingTheme()});
        jt.call("POST", "remthpost?" + app.login.authparams(), data,
                function (updobjs) {
                    jt.log("remthpost completed successfully");
                    app.lcs.uncache("activetps", "411");
                    updobjs.forEach(function (updobj) {
                        app.lcs.put(updobj.dsType, updobj); });
                    app.pcd.redisplay(); }, //refresh content, close dialog
                function (code, errtxt) {
                    jt.byId("removeb" + rtid).disabled = false;
                    jt.out("removedlgerrdiv", "Remove failed. Code " + code +
                           ": " + errtxt); },
                jt.semaphore("pcd.removeMembic"));
    },


    filterContent: function (mode) {
        if(mode) {
            jt.out("pcdcontdiv", "");  //refresh display content from scratch
            if(ctx.fist && ctx.fist.toid) {  //stop previous ongoing work
                clearTimeout(ctx.fist.toid); }
            if(mode === "init") {  //refresh display from scratch
                ctx.fist = {idx:0, ts:new Date().toISOString(),
                            qstr:"", contextobj:ctx.actobj.contextobj,
                            kwrds:{disp:false, sel:[]},
                            types:{disp:false, sel:[]}};
                jt.byId("pcdsrchin").value = ""; }
            else if(mode === "change") {  //refiltering in response to change
                ctx.fist.idx = 0; }
            ctx.fist.matchCriteriaSpecified = (ctx.fist.qstr ||
                (ctx.fist.kwrds.disp && ctx.fist.kwrds.sel.length) ||
                (ctx.fist.types.disp && ctx.fist.types.sel.length)); }
        ctx.fist.qstr = jt.byId("pcdsrchin").value;
        var item; var contdiv; var elem;
        while(ctx.fist.idx < ctx.actobj.itlist.length) {
            item = ctx.actobj.itlist[ctx.fist.idx];
            ctx.fist.idx += 1;
            if(ctx.actobj.itmatchf(item, ctx.fist)) {
                contdiv = jt.byId("pcdcontdiv");
                elem = document.createElement("div");
                elem.className = "pcditemdiv";
                elem.id = "pcditemdiv" + ctx.fist.idx;
                contdiv.appendChild(elem);  //make available first, then fill
                elem.innerHTML = ctx.actobj.itdispf(item, ctx.fist);
                if(ctx.fist.idx < ctx.actobj.itlist.length) {  //more to display
                    ctx.fist.toid = app.fork(
                        {descr:"pcd.filter", func:app.pcd.filterContent,
                         ms:50});
                    break; } } }  //resume rendering after yielding to UI
    },


    //descobj elements:
    //  picsrc: display page img src url, may include cachebust param
    //  disptype: profile|theme|app
    //  exturl: the permalink url to reach this page directly
    //  rssurl: optional link for an RSS feed for the page.
    //  name: display name for the page
    //  descr: text description for the page
    setPageDescription: function (descobj) {
        ctx.descobj = descobj;
        var fsz = "large";
        if(descobj.descr.length > 300) {
            fsz = "medium"; }
        jt.out("pgdescdiv", jt.tac2html(
            ["div", {id:"pcduppercontentdiv"},
             [["div", {id:"pcdpicdiv"},
               ["img", {cla:"pcdpic", src:descobj.picsrc}]],
              ["div", {id:"pcddescrdiv"},
               [["div", {id:"pcdnamediv"},
                 ["span", {id:"pcdnamespan", cla:"penfont"}, descobj.name]],
                ["div", {id:"ppcdshoutdiv"},
                 ["span", {cla:"shoutspan",
                           style:"font-size:" + fsz + ";"}, 
                  jt.linkify(descobj.descr)]]]]]]));
    },


    //actobj elements:
    //  itlist: array of items to be displayed (e.g. membics)
    //  contextobj: optional, accessible from fist
    //  itmatchf(item, fist): return true if match
    //  itdispf(item, fist): return HTML to display the given item
    //  settingsf(): null if settings unavailable, called settings click
    //  notif(): Return zero or more notices to be displayed.
    setPageActions: function (actobj) {
        ctx.actobj = actobj;
        jt.out("pgactdiv", jt.tac2html(
            [["div", {id:"pcdctrldiv"},       //main actions line wrapper
              ["div", {id:"pcdactdiv"}]],     //main actions line content
             ["div", {id:"pcdnotidiv"}]]));   //notifications display
        jt.out("contentdiv", jt.tac2html(
            ["div", {id:"pcdouterdiv"},       //outer wrapper for content
             ["div", {id:"pcdcontdiv"}]]));   //display items container
        writeActionsArea();
        app.pcd.filterContent("init");
    }



};  //end of returned functions
}());

