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
    var standardOverrideColors = [
        //lower case for all colors defined here
        {name:"link", value:"#84521a", sel: "A:link,A:visited,A:active", 
         attr:"color"},
        {name:"hover", value:"#a05705", sel:"A:hover", attr:"color"}];


    function fetchType (dtype) {
        switch(dtype) {
        case "profile": return "MUser";
        case "theme": return "Theme"; }
        return dtype;
    }


    function picImgSrc (obj) {
        var src = app.dr("img/nopicprof.png");
        if(obj && obj[obacc[obj.dsType].picfield]) {  //e.g. profile.profpic
            src = "/api/obimg?dt=" + obj.dsType + "&di=" + obj.dsId +
                "&cb=" + obj.modified.replace(/[\-:]/g,""); }
        return src;
    }


    function getOverriddenColor(name, defcolor) {
        var color = defcolor;
        if(dst.obj.cliset && dst.obj.cliset.embcolors) {
            color = dst.obj.cliset.embcolors[name] || defcolor; }
        return color;
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


    function weeklyPrebVolume () {
        var vol = {low:1000, high:0, ttl:0, avg:0, nzc:0, nzt:0, nzwa:0,
                   prebs:ctx.actobj.itlist, pidx:0,
                   wkb:new Date().toISOString()};
        if(!vol.prebs.length) { return vol; }
        vol.lpc = vol.prebs[vol.prebs.length - 1].created;
        if(vol.prebs[vol.prebs.length - 1].dsType === "Overflow") {
            vol.lpc = vol.prebs[vol.prebs.length - 2].created; }
        while(vol.wkb > vol.lpc) {  //while week begin > last preb created
            if(!vol.weeks) {  //first pass
                vol.weeks = []; }
            else {  //record last pass total
                vol.weeks.push(vol.wkt); }
            vol.wkt = 0;
            vol.wkb = new Date(jt.isoString2Time(vol.wkb).getTime() -
                               (7 * 24 * 60 * 60 * 1000)).toISOString();
            while(vol.pidx < vol.prebs.length &&
                  vol.prebs[vol.pidx].created > vol.wkb) {
                if(vol.prebs[vol.pidx].dsType === "Membic") {
                    vol.wkt += 1; }
                vol.pidx += 1; } }
        vol.weeks.forEach(function (wkt) {
            if(wkt < vol.low) { vol.low = wkt; }
            if(wkt > vol.high) { vol.high = wkt; }
            vol.ttl += wkt;
            if(wkt) {
                vol.nzc += 1;
                vol.nzt += wkt; } });
        vol.avg = Math.round(vol.ttl / vol.weeks.length);
        vol.nzwa = Math.round(vol.nzt / vol.nzc);
        return vol;
    }


    function shareMailApplicationLink () {
        var subj = "membic.org";
        var body = "Links and why they are worth reading.\n" +
            app.docroot + "\n\n" +
            "You can use Membic to save and publish links related to your ongoing interests. Check out some Themes and Profiles to see what you can do.\n";
        var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body) + "%0A%0A";
        return link;
    }


    //Even though the receiver will clearly have the sender's email address,
    //app links for sharing should avoid having the email address in them.
    //Also possible the sender is using a different address to login with
    //than the one they are sending from.
    function shareMailThemeOrProfileLink () {
        var actargs = "?action=invitation";
        var sig = "";
        var auth = app.login.authenticated();
        if(auth) {
            sig = app.login.myProfile().name;
            //Add the invitation sender to the action so the app can help
            //the sender avoid duplicate invites, send thanks, whatever.
            actargs += "&from=" + auth.authId; }
        var url = ctx.descobj.exturl + actargs;
        if(!url.startsWith("http")) {
            if(url.startsWith("/")) {
                url = url.slice(1); }
            url = app.docroot + url; }
        var vol = weeklyPrebVolume();
        var descrname = ctx.descobj.name;
        if(ctx.descobj.disptype !== "theme") {
            descrname = "The profile page for " + descrname; }
        var subj = "Invitation to " + ctx.descobj.name;
        var body = "This is an invitation to follow \"" + ctx.descobj.name + "\" on membic.org. I think you might find upcoming links worth your time to check out.\n\n" +
            descrname + " is a highly curated, low volume feed (average " + vol.nzwa + " posts per week, some weeks nothing). I would be interested in your thoughts and reactions. Use this link to connect: " + url + "\n";
        if(sig) {
            body += "\nLooking forward to hearing from you.\n" + sig + "\n"; }
        var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body) + "%0A%0A";
        return link;
    }


    function shareMailLink () {
        if(ctx.descobj.disptype === "app") {
            return shareMailApplicationLink(); }
        return shareMailThemeOrProfileLink();
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
                            onclick:jt.fs("window.open('" + ctx.descobj.rssurl +
                                          "')")},
                      ["div", {cla:"resp-sharing-button" + 
                               " resp-sharing-button--small" +
                               " resp-sharing-button--rss"},
                       ["div", {cla:"resp-sharing-button__icon" + 
                                " resp-sharing-button__icon--solid",
                                "aria-hidden":"true"},
                        ["img", {src:app.dr("img/rssiconwhite.png"),
                                 style:"max-width:16px;"}]]]]); }
        if(app.solopage()) {
            var membicurl = ctx.descobj.exturl + "?action=invitation";
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
        else if(app.theme.mayViewAudience()) {
            tac.push(["a", {href:"#audience", title:"Show Audience",
                            cla:"resp-sharing-button__link",
                            onclick:jt.fs("app.theme.audience()")},
                      ["img", {src:app.dr("img/audience.png"),
                               style:"max-width:24px;"}]]);
            tac.push(["div", {id:"pcdaudcontdiv"}]); }
        return tac;
    }


    function settingsButtonHTML () {
        if(app.solopage()) {
            return ""; }  //no settings button at all if page is embedded
        if(!ctx.actobj.setfstr) {
            return jt.tac2html(  //no settings, return disabled placeholder
                ["img", {cla:"webjump", src:app.dr("img/settings.png"),
                         style:"opacity:0.4;"}]); }
        return jt.tac2html(
            ["a", {id:"pcdsettingslink",
                   href:"#" + ctx.descobj.disptype + "settings",
                   title:ctx.descobj.disptype.capitalize() + " Settings",
                   onclick:jt.fs(ctx.actobj.setfstr)},
             ["img", {cla:"webjump", src:app.dr("img/settings.png")}]]);
    }


    //If the content is being displayed within another site, then the entire
    //top section has been hidden to avoid blinking the description and
    //other info.  Re-enable just enough to allow for search and share.
    function unhideSoloPageActions() {
        var tsecdiv = jt.byId("topsectiondiv");
        if(!tsecdiv || tsecdiv.style.display !== "none" || !app.solopage()) {
            return; }
        var hds = ["topmessagelinediv", "topactiondiv", "pgdescdiv",
                   "pcdnotidiv"];
        hds.map((i) => jt.byId(i)).forEach(function (hd) {
            if(hd) { hd.style.display = "none"; } });
        tsecdiv.style.display = "block";
        jt.log("Unhid solo page actions area");
    }


    function writeActionsArea () {
        var searchdivcontents = [
            ["a", {href:"#search", id:"srchlink", title:"Search items",
                   onclick:jt.fs("app.pcd.filterContent('change')")},
             ["img", {src:app.dr("img/search.png"), cla:"webjump"}]]];
        var srchinattrs = {type:"text", id:"pcdsrchin", size:26,
                           placeholder:"Search text",
                           onchange:jt.fs("app.pcd.filterContent('change')"),
                           value:""};  //value set by UI interaction only
        var dlos = [];  //datalist options from keywords, if defined
        if(ctx.actobj.contextobj && ctx.actobj.contextobj.keywords) {
            ctx.actobj.contextobj.keywords.csvarray().forEach(function (key) {
                key = key.trim();
                if(key) {
                    dlos.push(["option", {value:key}]); } }); }
        if(dlos.length) {
            srchinattrs.list = "srchinoptsdl"; }
        searchdivcontents.push(["input", srchinattrs]);
        if(dlos.length) {
            searchdivcontents.push(["datalist", {id:"srchinoptsdl"}, dlos]); }
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
               ["div", {id:"pcdacsrchdiv"}, searchdivcontents]]],
             ["div", {id:"pcdsharediv", style:"display:none;"}, 
              shareAndFollowButtons()],
             ["div", {id:"pcdsettingsdiv", style:"display:none;"},
              ["div", {id:"pcdsetcontdiv"}]]]));
        unhideSoloPageActions();
    }


    //The extraobj is used to drive additional actions passed along from
    //app.init2 or login.verifyUserInfo.  It is up to the handler func
    //to verify the user is authenticated that is required.
    function processExtraObject (extraobj) {
        if(extraobj) { switch(extraobj.go) {
            case "follow": return app.fork(
                {descr:"pxob follow", ms:100, func:app.pcd.settings});
            case "reply": return app.fork(
                {descr:"pxob reply", ms:800, func:function () {
                    var mid = app.startParams.membicid;
                    var idx = ctx.actobj.itlist
                        .findIndex((m) => m.dsId === mid);
                    app.membic.toggleMembic(idx, "urlreplyparamexp"); }});
            case "audience": return app.fork(
                {descr:"pxob audience", ms:100, func:function () {
                    if(!app.login.authenticated()) { return; }
                    app.pcd.togshare();  //open sharing area
                    app.theme.audience(app.startParams.uid); }});
            default: if(extraobj.go) {
                jt.log("pcd.processExtraObject ignored " +
                       JSON.stringify(extraobj)); } } }
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


    //Queued membics (membic.dispafter > fist.ts) are not provided from
    //the RSS feed, but they display normally from within the app.
    function membicSearchMatch (membic, fist) {
        var contextobj = fist.actobj.contextobj;
        if(membic.dsType === "Overflow") {  //ran out of items, fault in more
            var ctxts = fist.ts;
            app.refmgr.getFull("Overflow", membic.dsId, function (ovrf) {
                //overflows are cached to avoid refetch if container modified
                if(ovrf) {  //fetch error already logged if not found
                    var membics = contextobj.preb.slice(0, -1);
                    contextobj.preb = membics.concat(ovrf.preb);
                    fist.actobj.contextobj = contextobj;
                    fist.actobj.itlist = contextobj.preb;
                    app.pcd.updateSearchLabelText();
                    app.pcd.resumeFilterContent(ctxts); } });
            return false; }  //don't display overflow elements
        if(membic.srcrev === "-604") {
            return false; }  //marked as deleted
        if(fist.qstr) {
            var toks = fist.qstr.toLowerCase().split(/\s+/);
            verifySearchFilterText(membic);
            if(toks.some((token) => membic.srchFiltTxt.indexOf(token) >= 0)) {
                return true; }  //have at least one text match
            return false; }
        return true;  //if not any other condition, assume it's a match
    }


    function membicDisplayHTML (membic, fist) {
        return app.membic.formHTML(fist.cdx, membic);
    }


    function ptNoticesDisplay (obj) {
        jt.log("ptNoticesDisplay not implemented yet" + obj);
    }


    function rssURLForObj (obj) {
        return "/feed" + app.statemgr.urlForInstance(obj);
    }


    function displayPTObj (obj, extra) {
        var sf = "";
        if(app.login.myProfile()) {  //signed in and user info loaded
            sf = "app.pcd.settings()"; }
        var fullurl = app.docroot + app.pcd.linkForThemeOrProfile(obj).slice(1);
        app.pcd.setPageDescription({picsrc:picImgSrc(obj),
                                    disptype:obacc[obj.dsType].disptype,
                                    exturl:fullurl,
                                    rssurl:rssURLForObj(obj),
                                    name:obj.name,
                                    descr:obj.description || obj.aboutme});
        app.pcd.setPageActions({itlist:obj.preb,
                                itmatchf:membicSearchMatch,
                                itdispf:membicDisplayHTML,
                                contextobj:obj, extraobj:extra,
                                setfstr:sf,
                                notif:ptNoticesDisplay});
    }

    
    function forkResumeFilterContent () {
        var ts = ctx.fist.ts;
        ctx.fist.toid = app.fork(
            {descr:"pcd.filter", ms:50,
             func:function () {
                 app.pcd.resumeFilterContent(ts); }});
    }


    function appendNextMatchingItemToContent() {
        var odiv = jt.byId("pcdcontdiv"); var elem; var item;
        var maxitemdisp = ctx.fist.pgs * ctx.fist.pz;
        while((ctx.fist.idx < ctx.actobj.itlist.length) &&
              (ctx.fist.dc <= maxitemdisp)) {
            ctx.fist.idx += 1;   //always update loop counter
            ctx.fist.cdx = ctx.fist.idx - 1;  //content display index
            if(ctx.fist.dc === maxitemdisp) {
                elem = document.createElement("div");
                elem.id = "pcdmorediv";
                odiv.appendChild(elem);
                elem.innerHTML = jt.tac2html(
                    ["a", {href:"#more...", onclick:jt.fs("app.pcd.pgmore('" +
                                                         ctx.fist.ts + "')")},
                     "More<br/>&#x25BC;"]);
                break; }
            item = ctx.actobj.itlist[ctx.fist.cdx];
            if(ctx.actobj.itmatchf(item, ctx.fist)) {
                ctx.fist.dc += 1;  //update the display count
                odiv = jt.byId("pcdcontdiv");
                if(!odiv) {  //display changed while waiting
                    jt.log("appendNextMatchingItemToContent abort, no contdiv");
                    break; }
                elem = document.createElement("div");
                elem.className = "pcditemdiv";
                elem.id = "pcditemdiv" + (ctx.fist.idx - 1);
                odiv.appendChild(elem);  //make available first, then fill
                elem.innerHTML = ctx.actobj.itdispf(item, ctx.fist);
                if(ctx.fist.idx < ctx.actobj.itlist.length) {  //more to display
                    forkResumeFilterContent();
                    break; } } } //resume rendering after yielding to UI
        if(ctx.fist.dc === 0) {  //no matching membics or none at all
            jt.out("pcdcontdiv", jt.tac2html(
                ["div", {cla:"pcditemdiv"},
                 ["div", {cla:"mdouterdiv"},
                  ["div", {id:"mdnoitemsdiv"},
                   "No membics"]]])); }
    }


    function mailinHelpHTML () {
        var subj = "Why memorable";
        var body = "Site URL";
        var link = "mailto:me@membic.org?subject=" + jt.dquotenc(subj) +
            "&body=" + jt.dquotenc(body) + "%0A%0A";
        return jt.tac2html(
            [["br"],
             "Send to ",
             ["a", {href:link}, "me@membic.org"]]);
    }


    function mailinHelp () {
        var cb = jt.byId("mailincb");
        if(cb && cb.checked) {
            jt.out("mailinhelpspan", mailinHelpHTML());
            jt.byId("altmaildiv").style.display = "block"; }
        else {
            jt.out("mailinhelpspan", "");
            jt.byId("altmaildiv").style.display = "none"; }
    }


    function personalInfoSettingsHTML () {
        var fp = app.login.fullProfile();
        if(!fp.cliset.mailins) {
            fp.cliset.mailins = "enabled"; }
        var mih = "";
        var altdisp = "none";
        if(fp.cliset.mailins === "enabled") {
            mih = mailinHelpHTML();
            altdisp = "block"; }
        return jt.tac2html(
            [["div", {cla:"cbdiv"},
              [["label", {fo:"emailin", cla:"liflab"}, "Email"],
               ["input", {type:"email", cla:"lifin", id:"emailin",
                          value:fp.email, placeholder:"nospam@example.com"}]]],
             ["div", {cla:"cbdiv"},  //"passin" is reserved for login form
              [["label", {fo:"updpin", cla:"liflab"}, "Password"],
               ["input", {type:"password", cla:"lifin", id:"updpin"}]]],
             ["div", {cla:"cbdiv"},
              ["div", {cla:"infolinediv"},
               [["span", {cla:"statlineval"}, fp.status],
                " updated " + jt.colloquialDate(fp.modified, "compress",
                                                "nodaily z2loc")]]],
             ["div", {cla:"cbdiv"},
              ["div", {cla:"infolinediv"},
               [["input", {type:"checkbox", id:"mailincb", value:"mailincb",
                           checked:jt.toru(fp.cliset.mailins === "enabled"),
                           onclick:jt.fsd("app.pcd.mailinHelp()")}],
                [["label", {fo:"mailincb", id:"mailincblab"},
                 "Enable Mail-In Membics"],
                 ["span", {id:"mailinhelpspan"}, mih]]]]],
             ["div", {cla:"cbdiv", id:"altmaildiv",
                      style:"display:" + altdisp + ";"},
              [["label", {fo:"altemin", cla:"liflab"}, "Alt&nbsp;Email"],
               ["input", {type:"email", cla:"lifin", id:"altemin",
                          value:fp.altinmail || "",
                          placeholder:"alternate@example.com"}]]]]);
    }


    //Return the standardized "permalink" web feed URI.  This should be as
    //simple and as compatible as possible.  The personalized web feed is
    //available when selecting how you are following.
    function webfeedSetting (embobj) {
        var rssurl = rssURLForObj(embobj);
        var linktxt = rssurl;
        if(embobj.dsType === "Theme" && embobj.cliset && embobj.cliset.flags &&
           embobj.cliset.flags.archived) {
            linktxt = "Archived"; }
        return jt.tac2html(
            ["div", {cla:"cblinediv"},
             ["div", {cla:"infolinediv"},
              ["Web Feed: ",
                ["a", {href:rssurl, title:"Subscribe to " + embobj.name,
                       onclick:jt.fs("window.open('" + rssurl + "')")},
                 linktxt]]]]);
    }


    function hashtagSetting (embobj, canmod) {
        var rhs = ["span", {id:"hashin"}, embobj.hashtag];
        if(canmod) {
            rhs = ["input", {type:"text", cla:"lifin", id:"hashin",
                             value:embobj.hashtag || "",
                             placeholder:"uniquetext"}]; }
        return jt.tac2html(
            ["div", {cla:"cbdiv"},
              [["label", {fo:"hashin", cla:"liflab"}, "Hashtag#"],
               rhs]]);
    }


    //Themes have custom keywords, profiles don't.  Putting keywords on
    //profileseventually restricts the content of what a user might choose
    //to post, and the only way out is to create another account.  Better to
    //encourage creating a theme.  No need to display the keywords entry
    //unless making changes, since the keywords can be easily seen by
    //clicking the search input.
    function keywordsSetting (embobj, canmod) {
        if((embobj.dsType !== "Theme") || !canmod) {
            return ""; }
        return jt.tac2html(
            ["div", {cla:"cbdiv"},
             [["label", {fo:"kwrdsin", cla:"liflab"}, "Keywords"],
              ["input", {type:"text", cla:"lifin", id:"kwrdsin",
                         value:embobj.keywords || "",
                         placeholder:"Comma separated values"}]]]);
    }


    function embedSetting (embobj, canmod) {
        var emburl = app.statemgr.urlForInstance(embobj) + "?site=YOURSITE.COM";
        var emboHTML = [];
        if(canmod) {
            embobj.cliset.embcolors = embobj.cliset.embcolors || {};
            var embcolors = embobj.cliset.embcolors;
            standardOverrideColors.forEach(function (od) {
                embcolors[od.name] = embcolors[od.name] || od.value;
                emboHTML.push(["div", {cla:"colorselectdiv"},
                               [["label", {fo:od.name + "in", cla:"colorlab"},
                                 od.name.capitalize()],
                                ["input", {id:od.name + "in", cla:"colorin",
                                           type:"color", 
                                           value:embcolors[od.name]}]]]); }); }
        return jt.tac2html(
            [["div", {cla:"cbdiv"},
              ["div", {cla:"infolinediv"},
               ["Embed: ",
                ["a", {href:emburl,
                       title:"Embed " + embobj.name + " in your website",
                       onclick:jt.fs("window.open('" + emburl + "')")},
                 emburl]]]],
             ["div", {cla:"cbdiv"},
              ["div", {id:"colorchoicesdiv"},
               emboHTML]]]);
    }


    function generalSettingsHTML (embobj, canmod) {
        return jt.tac2html(
            [hashtagSetting(embobj, canmod),
             webfeedSetting(embobj),
             keywordsSetting(embobj, canmod),
             embedSetting(embobj, canmod)]);
    }


    function settingsInfoAndUpdateButtonHTML (obj, canmod) {
        if(!canmod) {
            return ""; }
        var clickstr = jt.fs("app.login.updateAccount()");
        if(obj.dsType === "Theme") {
            clickstr = jt.fs("app.theme.settingsUpdate()"); }
        return jt.tac2html(
            [["div", {cla:"cbdiv"},
              ["div", {cla:"infolinediv", id:"settingsinfdiv"}]],
             ["div", {id:"settingsbuttonsdiv"},
              [["button", {type:"button", id:"settingsupdbutton",
                           onclick:clickstr},
                "Update"]]]]);
    }


    function writePersonalSettings (divid) {
        var prof = app.login.myProfile();
        jt.out(divid, jt.tac2html(
            [["div", {id:"settingsmenudiv"},
              [["button", {id:"cntb", title:"Create New Theme",
                           onclick:jt.fs("app.theme.createTheme('" + divid +
                                         "')")},
                "Create&nbsp;Theme"],
               ["button", {title:"Sign Out And Clear Saved Data",
                           onclick:jt.fs("app.login.logout()")},
                "Sign Out"]]],
             ["div", {id:"cpidiv"},
              [personalInfoSettingsHTML(),
               generalSettingsHTML(prof, true)]],
             settingsInfoAndUpdateButtonHTML(prof, true)]));
        //dim and disable the Create Theme button if account is not active
        if(app.login.authenticated().status !== "Active") {
            var cntb = jt.byId("cntb");
            cntb.disabled = true;
            cntb.style.opacity = 0.4; }
    }


    function writeThemeProfSettings (divid, obj) {
        var canmod = (app.theme.association(obj) === "Founder");
        jt.out(divid, jt.tac2html(
            [["div", {id:"settingsmenudiv"}],
             ["div", {id:"cpidiv"},
              [["div", {id:"memberactdiv"}],
               generalSettingsHTML(obj, canmod)]],
             settingsInfoAndUpdateButtonHTML(obj, canmod)]));
        app.theme.memberset(obj, "settingsmenudiv", "memberactdiv");
    }


    function verifyDescripSave () {
        var changed = false;
        Object.keys(ctx.descobj.owneredit).forEach(function (key) {
            var de = ctx.descobj.owneredit[key];
            var dval = ctx.descobj[de.dfld];
            var ival = jt.byId(de.eid).innerHTML;
            if(dval !== ival) {
                changed = true; } });
        var savdiv = jt.byId("pcduppersavediv");
        if(!changed && savdiv.innerHTML) {
            savdiv.innerHTML = ""; }
        else if(changed && !savdiv.innerHTML) {
            savdiv.innerHTML = jt.tac2html(
                ["button", {type:"button", id:"descrupdbutton",
                            onclick:jt.fs("app.pcd.saveDescripChanges()")},
                 "Save changes"]); }
    }


    //After a pic has been uploaded, the local profile/theme information is
    //up to date except for the modified time.  Just set directly.
    function notePicUploadMod (mod) {
        ctx.actobj.contextobj.modified = mod;  //note modification time
        //If no previous pic, then indicate pic now available
        if(ctx.actobj.contextobj.dsType === "MUser") {
            ctx.actobj.contextobj.profpic = ctx.actobj.contextobj.dsId; }
        else if(ctx.actobj.contextobj.dsType === "Theme") {
            ctx.actobj.contextobj.picture = ctx.actobj.contextobj.dsId; }
    }


    function monitorImageUpload (cmd) {
        var iframe = jt.byId("pumif");
        if(!iframe) {
            return; }
        var picstatdiv = jt.byId("picuploadstatusdiv");
        if(cmd === "start") {
            jt.byId("picuploadbutton").disabled = true;
            picstatdiv.innerHTML = "Uploading"; }
        var txt = iframe.contentDocument || iframe.contentWindow.document;
        if(txt && txt.body) {
            txt = txt.body.innerHTML;
            var doneprefix = "Done: ";
            //server text may be surrounded by HTML tags added by default.
            var idx = txt.indexOf(doneprefix);
            if(idx >= 0) {
                jt.out("pcdpicuploaddiv", "");  //clear image upload form
                var mod = txt.slice(idx + doneprefix.length);
                idx = mod.indexOf("<");
                if(idx > 0) {
                    mod = mod.slice(0, idx); }
                notePicUploadMod(mod);
                var img = jt.byId("pcdpicimg");
                img.src = picImgSrc(ctx.actobj.contextobj);  //display image
                return; }  //done monitoring
            idx = txt.indexOf("Ready");
            if(idx < 0) {  //not Done and not Ready.  Report error.
                jt.err(txt);
                jt.out("pcdpicuploaddiv", "");  //clear out image upload form
                return; } }
        picstatdiv.innerHTML = picstatdiv.innerHTML + ".";  //add a monitor dot
        app.fork({descr:"monitor pic upload", ms:1000,
                  func:monitorImageUpload});
    }


    function togglePicUpload () {
        var div = jt.byId("pcdpicuploaddiv");
        if(div.innerHTML) {
            div.innerHTML = "";
            return; }
        var cob = ctx.actobj.contextobj;
        var oa = obacc[cob.dsType];
        var auth = app.login.authenticated();
        div.innerHTML = jt.tac2html(
            ["div", {id:"picuploadformdiv"},
             //target form submission to iframe to avoid page reload
             [["div", {id:"cancelxdiv"},
               ["a", {href:"#close", title:"Close pic upload",
                      onclick:jt.fs("app.pcd.togglePicUpload()")}, "x"]],
              ["form", {id:"picupldform", action:"/api/uploadimg",
                        method:"post", target:"pumif",
                        enctype:"multipart/form-data"},
               [["input", {type:"hidden", name:"an", value:auth.email}],
                ["input", {type:"hidden", name:"at", value:auth.token}],
                ["input", {type:"hidden", name:"dsType", value:cob.dsType}],
                ["input", {type:"hidden", name:"dsId", value:cob.dsId}],
                ["label", {fo:"picfilein"},
                 "Set " + oa.disptype + " image"],
                ["input", {type:"file", id:"picfilein", name:"picfilein",
                           accept:"image/*", 
                           onchange:jt.fs("app.pcd.enableUploadButton()")}],
                ["div", {id:"picuploadstatusdiv"}],
                ["div", {id:"picuploadformbuttonsdiv"},
                 ["button", {type:"submit", id:"picuploadbutton",
                             onclick:jt.fsd( //hook but do not intercept
                                 "app.pcd.monitorImageUpload('start')")},
                  "Upload"]]]],
              ["iframe", {id:"pumif", name:"pumif", src:"/api/uploadimg",
                          style:"display:none"}]]]);
        jt.byId("picuploadbutton").disabled = true;
    }


    function ownerEditableFieldsInfo () {
        var oef = {name:{eid:"pcdnamespan", dfld:"name"},
                   descr:{eid:"pcddescrspan", dfld:"descr"}};
        if(ctx.actobj && ctx.actobj.contextobj) {
            var updobj = ctx.actobj.contextobj;
            if(updobj.dsType === "MUser") {
                oef.name.srcfld = "name";
                oef.name.place = "Your Name Here";
                oef.descr.srcfld = "aboutme";
                oef.descr.place = "What kinds of links are you tracking?"; }
            else if(updobj.dsType === "Theme") {
                oef.name.srcfld = "name";
                oef.name.place = "Theme Name Here";
                oef.name.savdfltval = "Theme " + updobj.founders.csvarray()[0];
                oef.descr.srcfld = "description";
                oef.descr.place = "What do you post to this theme?"; } }
        return oef;
    }


    function editableFieldValue (descobj, field) {
        var de = descobj.owneredit[field];
        var val = descobj[field];
        if(val === "" || val === de.savdfltval) {
            val = de.place; }
        return val;
    }


    function makePlaceholderCheckFunction (de) {
        var pcf = function (event) {
            var elem = jt.byId(de.eid);
            if(event.type === "blur" && !elem.innerHTML) {
                elem.innerHTML = de.place; }
            if(event.type === "focus" && elem.innerHTML === de.place) {
                elem.innerHTML = ""; } };
        return pcf;
    }


    function ownerEnableEdit () {
        var obj = ctx.actobj.contextobj;
        if(obj && ((app.samePO(obj, app.login.myProfile())) ||
                   (app.theme.association(obj) === "Founder"))) {
            jt.on("pcdpicdiv", "click", togglePicUpload);
            jt.byId("pcdpicdiv").style.cursor = "pointer";
            Object.keys(ctx.descobj.owneredit).forEach(function (key) {
                var de = ctx.descobj.owneredit[key];
                var elem = jt.byId(de.eid);
                elem.contentEditable = true;
                elem.style.cursor = "pointer";
                var pcf = makePlaceholderCheckFunction(de);
                jt.on(elem, "focus", pcf);
                jt.on(elem, "blur", pcf);
                jt.on(elem, "input", verifyDescripSave); }); }
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


    readCommonSettingsFields: function (obj, src) {
        obj.hashtag = jt.byId("hashin").value.trim() || "UNSET_VALUE";
        obj.cliset = src.cliset;  //unsaved changes in cached obj are ok
        standardOverrideColors.forEach(function (od) {
            obj.cliset[od.name] = jt.byId(od.name + "in").value; });
    },


    settings: function (show) {
        var auth = app.login.authenticated();
        if(!auth) { return; }  //must be signed in for settings
        jt.byId("pcdsharediv").style.display = "none";
        var setdiv = jt.byId("pcdsettingsdiv");
        if(setdiv.style.display === "block" && !show) {
            setdiv.style.display = "none"; }
        else {
            setdiv.style.display = "block"; }
        var obj = ctx.actobj.contextobj;
        if(!obj || (obj.dsType === "MUser" && obj.dsId === auth.authId)) {
            writePersonalSettings("pcdsetcontdiv"); }
        else {
            writeThemeProfSettings("pcdsetcontdiv", obj); }
    },


    togshare: function () {
        jt.byId("pcdsettingsdiv").style.display = "none";
        var sharediv = jt.byId("pcdsharediv");
        if(sharediv.style.display === "block") {
            sharediv.style.display = "none"; }
        else {
            sharediv.style.display = "block"; }
    },


    fetchType: function (dtype) { return fetchType(dtype); },


    fetchAndDisplay: function (dtype, id, extra) {
        app.statemgr.verifyState(dtype, id, extra, function () {
            if(!id) {
                jt.log("pcd.fetchAndDisplay " + dtype + " required an id");
                jt.log(new Error().stack); }
            app.refmgr.getFull(fetchType(dtype), id, function (obj) {
                if(!obj) {
                    jt.log("pcd.fetchAndDisplay no obj " + dtype + " " + id);
                    return app.connect.display(); }
                displayPTObj(obj, extra); }); });
    },


    //Overflows are done in chunks of 200.  The display page size should be
    //smaller than so when you click "more", you instantly get a few items
    //to look at while you wait for the overflow retrieval call.  So a
    //realistic max page display size (pz) would be around 180.  Meanwhile
    //that many external pic references gets slow, and even on a big screen
    //it is not massively helpful to scroll through more than about 40 at a
    //time.  That's enough to see recent, and cover most search results.
    filterContent: function (mode) {
        if(mode) {  //react to setup or change of display iteration
            if(ctx.fist && ctx.fist.toid) {  //stop previous ongoing work
                clearTimeout(ctx.fist.toid); }
            jt.out("pcdcontdiv", "");  //refresh display content from scratch
            if(mode === "init") {  //refresh display from scratch
                ctx.fist = {idx:0, ts:new Date().toISOString(), pgs:1,
                            pz:41, //off by one helps avoid pg/overflow sync
                            qstr:"", dc:0, actobj:ctx.actobj,
                            kwrds:{disp:false, sel:[]},
                            types:{disp:false, sel:[]}};
                jt.byId("pcdsrchin").value = ""; }
            else if(mode === "change") {  //refiltering in response to change
                ctx.fist.qstr = jt.byId("pcdsrchin").value;
                ctx.fist.idx = 0; //refilter all items from the beginning
                ctx.fist.ts = new Date().toISOString();
                ctx.fist.pgs = 1; //single page of results to start
                ctx.fist.dc = 0; } } //reset the display count
        appendNextMatchingItemToContent();
    },
    getDisplayContext: function () { return ctx; },
    getActobjContext: function () { return ctx.actobj.contextobj; },
    resumeFilterContent: function (ts) {
        if(ctx.fist.ts === ts) {
            app.pcd.filterContent(); }
    },


    pgmore: function (ts) {
        var odiv = jt.byId("pcdcontdiv");
        odiv.removeChild(odiv.lastChild);
        ctx.fist.pgs += 1;
        app.pcd.resumeFilterContent(ts);
    },


    updateSearchLabelText: function () {
        var link = jt.byId("srchlink");
        if(link && ctx.actobj) {
            var elementslabel = "profiles";
            var membicTypesCSV = "MUser,Theme";
            var obj = ctx.actobj.contextobj;
            if(obj && membicTypesCSV.csvcontains(obj.dsType)) {
                elementslabel = "membics"; }
            var qty = ctx.actobj.itlist.length || 0;
            if(!qty) {  //nothing to search, gray out the area
                jt.byId("pcdacsrchdiv").style.opacity = 0.4; }
            else {  //verify not grayed if there are items to search
                jt.byId("pcdacsrchdiv").style.opacity = 1.0; }
            link.title = "Search " + qty + " " + elementslabel; }
        else {
            link.title = "Search items"; }
    },


    saveDescripChanges: function () {
        jt.out("pcduppersavediv", "Saving...");
        var updobj = ctx.actobj.contextobj;
        Object.keys(ctx.descobj.owneredit).forEach(function (key) {
            var de = ctx.descobj.owneredit[key];
            var val = jt.byId(de.eid).innerHTML;
            if(val === de.place) {
                val = de.savdfltval || ""; }
            updobj[de.srcfld] = val; });
        //Rebuilding everything via app.statemgr.redispatch is heavyhanded,
        //but it doesn't happen often, and rebuilding ensures editable
        //displays are returned to their original state with proper info.
        var updfs = {"MUser":app.login.updateProfile, "Theme":app.theme.update};
        updfs[updobj.dsType](updobj,
            function () {
                app.fork({descr:"saveDesripChanges success", ms:100,
                          func:app.statemgr.redispatch}); },
            function (code, errtxt) {
                jt.log("saveDescripChanges " + code + ": " + errtxt);
                jt.out("pcduppersavediv", code + ": " + errtxt);
                app.fork({descr:"saveDesripChanges failed", ms:800,
                          func:app.statemgr.redispatch}); });
    },


    //descobj elements:
    //  picsrc: display page img src url, may include cachebust param
    //  disptype: profile|theme|app
    //  exturl: the permalink url to reach this page directly
    //  rssurl: optional link for an RSS feed for the page.
    //  name: display name for the page
    //  descr: text description for the page
    setPageDescription: function (descobj) {
        ctx.actobj = null;  //clear any prev to avoid setup confusion
        ctx.descobj = descobj;
        descobj.owneredit = ownerEditableFieldsInfo();
        var fsz = "large";
        if(descobj.descr.length > 300) {
            fsz = "medium"; }
        jt.out("pgdescdiv", jt.tac2html(
            [["div", {id:"pcduppercontentdiv"},
              [["div", {id:"pcdpicdiv"},
                ["img", {id:"pcdpicimg", src:descobj.picsrc}]],
               ["div", {id:"pcddescrdiv"},
                [["div", {id:"pcdnamediv"},
                  ["span", {id:"pcdnamespan", cla:"penfont"},
                   editableFieldValue(descobj, "name")]],
                 ["div", {id:"pcddescrdiv"},
                  ["span", {cla:"descrspan", id:"pcddescrspan",
                            style:"font-size:" + fsz + ";"},
                   jt.linkify(editableFieldValue(descobj, "descr"))]]]]]],
             ["div", {id:"pcduppersavediv"}],
             ["div", {id:"pcdpicuploaddiv"}]]));
    },


    //actobj elements:
    //  itlist: array of items to be displayed (e.g. membics)
    //  contextobj: optional, accessible from fist.actobj
    //  extraobj: optional, used for additional setup before filtering content
    //  itmatchf(item, fist): return true if match
    //  itdispf(item, fist): return HTML to display the given item
    //  setfstr: onclick for settings button (string)
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
        if(app.solopage()) {
            customizeSoloPageDisplay(); }
        writeActionsArea();
        app.pcd.updateSearchLabelText();
        processExtraObject(actobj.extraobj);
        ownerEnableEdit();
        app.pcd.filterContent("init");
    },


    enableUploadButton: function () {
        jt.byId("picuploadbutton").disabled = false; },
    picImgSrc: function (profOrThemeObj) { return picImgSrc(profOrThemeObj); },
    monitorImageUpload: function (cmd) { monitorImageUpload(cmd); },
    togglePicUpload: function () { togglePicUpload(); },
    mailinHelp: function () { mailinHelp(); }

};  //end of returned functions
}());

