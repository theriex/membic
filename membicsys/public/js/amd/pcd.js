/*global app, jt, window, confirm, document */

/*jslint browser, white, fudge, for, long */

//////////////////////////////////////////////////////////////////////
// PenName or Theme common display functions.
//

app.pcd = (function () {
    "use strict";

    var ctx = {};  //context for display processing
    var obacc = {MUser: {disptype:"profile", picfield:"profpic"},
                 Theme: {disptype:"theme", picfield:"picture"}};
    var dst = {profile: {
                   name:{eid:"pcdnamespan", dfld:"name", srcfld:"name",
                         plo:"Your Name Here", plp:"No Name Provided"},
                   dscr:{eid:"pcddescrspan", dfld:"descr", srcfld:"aboutme",
                         plo:"What kinds of links do you post?", plp:""}},
               theme: {
                   name:{eid:"pcdnamespan", dfld:"name", srcfld:"name",
                         plo:"Theme Name Here", plp:"No Name Provided"},
                   dscr:{eid:"pcddescrspan", dfld:"descr", srcfld:"description",
                         plo:"What do you post to this theme?",
                         plp:"No description given"}},
               other: {
                   name:{eid:"pcdnamespan", dfld:"name"},
                   dscr:{eid:"pcddescrspan", dfld:"descr"}}};


    function mdfs (mgrfname, ...args) {
        mgrfname = mgrfname.split(".");
        return jt.fs("app.pcd.managerDispatch('" + mgrfname[0] + "','" +
                     mgrfname[1] + "'" + app.paramstr(args) + ")");
    }


    function rssURLForObj (obj) {
        return "/feed" + app.statemgr.urlForInstance(obj);
    }


    var embedmgr = {
        standardOverrideColors: [ //lower case for all colors defined here
            {name:"link", value:"#84521a", sel: "A:link,A:visited,A:active", 
             attr:"color"},
            {name:"hover", value:"#a05705", sel:"A:hover", attr:"color"}],
        createStyleOverridesForEmbedding: function () {
            jt.byId("pcduppercontentdiv").style.display = "none";
            jt.byId("bodyid").style.paddingLeft = "0px";
            jt.byId("bodyid").style.paddingRight = "0px"; },
        insertOverrideRule: function (sheet, soc, color) {
            if(color) {
                soc.sel.csvarray().forEach(function (sel) {
                    var irl = sel + " { " + soc.attr + ": " + color + "; }";
                    jt.log("Inserted color override rule: " + irl);
                    sheet.insertRule(irl, sheet.cssRules.length); }); } },
        createColorOverrides: function (cob) {
            var sheet;
            if(!app.embedded || !cob || !cob.cliset || !cob.cliset.embcolors) {
                return; }
            sheet = window.document.styleSheets[0];
            embedmgr.standardOverrideColors.forEach(function (soc) {
                var color = cob.cliset.embcolors[soc.name];
                embedmgr.insertOverrideRule(sheet, soc, color); }); },
        changeSiteTabIcon: function (cob) {
            var link = document.createElement("link");
            link.type = "image/x-icon";
            link.rel = "shortcut icon";
            link.href = "/api/obimg?dt=" + cob.dsType + "&di=" + cob.dsId;
            document.getElementsByTagName("head")[0].appendChild(link); },
        customizeSoloPageDisplay: function (cob) {
            if(app.embedded) {
                embedmgr.createStyleOverridesForEmbedding(); }
            embedmgr.createColorOverrides(cob);
            embedmgr.changeSiteTabIcon(cob); },
        //If the content is being displayed within another site, then the
        //entire top section has been hidden to avoid blinking the
        //description and other info.  Re-enable just enough to allow for
        //search and share.
        unhideSoloPageActions: function () {
            var tsdiv = jt.byId("topsectiondiv");
            if(!tsdiv || tsdiv.style.display !== "none" || !app.solopage()) {
                return; }
            var hds = ["topmessagelinediv", "topactiondiv", "pgdescdiv",
                       "pcdnotidiv"];
            hds.map((i) => jt.byId(i)).forEach(function (hd) {
                if(hd) { hd.style.display = "none"; } });
            tsdiv.style.display = "block";
            jt.log("Unhid solo page actions area"); }
    };  //end embedmgr


    var sharemgr = {
        shareMailApplicationLink: function () {
            var subj = "membic.org";
            var body = "Links and why they are worth reading.\n" +
                app.docroot + "\n\n" +
                "You can use Membic to save and publish links related to your ongoing interests. Check out some Themes and Profiles to see what you can do.\n";
            var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
                jt.dquotenc(body) + "%0A%0A";
            return link; },
        weeklyPrebVolume: function () {
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
            return vol; },
        emqDescrip: function () {
            var descr = ctx.descobj.descr;  //might contain allowed html tags
            if(!descr) {
                return ""; }
            descr = descr.split("\n")  //preserve existing line breaks
                .map(function (line) {
                    line = line.replace(/<.*?>/g, "");
                    if(line.length <= 76) {
                        line = "> " + line; }
                    else {
                        line = "> " + line.replace(/(.{1,76})\s/g, "$1\n> "); }
                    return line; })
                .join("\n");           //recombine
            return "Here's the description from the site:\n\n" + descr; },
        //Even though the receiver will clearly have the sender's email
        //address, app links for sharing should avoid having the email
        //address in them.  Also possible the sender is using a different
        //address to login with than the one they are sending from.
        shareMailThemeOrProfileLink: function () {
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
            var vol = sharemgr.weeklyPrebVolume();
            var descrname = ctx.descobj.name;
            if(ctx.descobj.disptype !== "theme") {
                descrname = "The profile page for " + descrname; }
            var subj = "Invitation to " + ctx.descobj.name;
            var body = "I'm inviting you to follow \"" + ctx.descobj.name + "\" at " + url + " so you can email me back directly about upcoming membics.\n\n\"" + ctx.descobj.name + "\" is a highly curated, low volume feed (average " + vol.nzwa + " posts per week, some weeks nothing). " + sharemgr.emqDescrip() + "\n\nMy guess is you would be interested in what gets added next, and I would be interested in your reactions. Use this link to connect: " + url + "\n\nThoughts welcome.\n" + sig + "\n";
            var link = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
                jt.dquotenc(body) + "%0A%0A";
            return link; },
        shareMailLink: function () {
            if(ctx.descobj.disptype === "app") {
                return sharemgr.shareMailApplicationLink(); }
            return sharemgr.shareMailThemeOrProfileLink(); },
        shareAndFollowButtons: function () {
            var tac = app.layout.shareButtonsTAC(
                {url:ctx.descobj.exturl,
                 title:ctx.descobj.name,
                 mref:sharemgr.shareMailLink(),
                 socmed:["tw", "fb", "em"]});
            if(ctx.descobj.rssurl) {
                tac.push(["a", {href:ctx.descobj.rssurl,  //right click to copy
                                cla:"resp-sharing-button__link",
                                id:"rsslink", title:"RSS feed",
                                onclick:jt.fs("window.open('" + 
                                              ctx.descobj.rssurl + "')")},
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
                                onclick:jt.fs("window.open('" + membicurl + 
                                              "')")},
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
            return tac; },
        togshare: function (bname) {
            jt.byId("pcdsettingsdiv").style.display = "none";
            var sharediv = jt.byId("pcdsharediv");
            if(sharediv.style.display === "block") {
                sharediv.style.display = "none"; }
            else {
                sharediv.style.display = "block";
                if(bname === "audience") {
                    app.theme.audience(null, "block"); } } }
    };  //end sharemgr


    var stgmgr = {  //settings manager
        settingsButtonHTML: function () {
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
                 ["img", {cla:"webjump", src:app.dr("img/settings.png")}]]); },
        mailinHelpHTML: function () {
            var subj = "Why memorable";
            var body = "Site URL";
            var link = "mailto:me@membic.org?subject=" + jt.dquotenc(subj) +
                "&body=" + jt.dquotenc(body) + "%0A%0A";
            return jt.tac2html(
                [["br"],
                 "Send to ",
                 ["a", {href:link}, "me@membic.org"]]); },
        mailinHelp: function () {
            var cb = jt.byId("mailincb");
            if(cb && cb.checked) {
                jt.out("mailinhelpspan", stgmgr.mailinHelpHTML());
                jt.byId("altmaildiv").style.display = "block"; }
            else {
                jt.out("mailinhelpspan", "");
                jt.byId("altmaildiv").style.display = "none"; } },
        personalInfoSettingsHTML: function () {
            var fp = app.login.fullProfile();
            if(!fp.cliset.mailins) {
                fp.cliset.mailins = "enabled"; }
            var mih = "";
            var altdisp = "none";
            if(fp.cliset.mailins === "enabled") {
                mih = stgmgr.mailinHelpHTML();
                altdisp = "block"; }
            return jt.tac2html(
                [["div", {cla:"cbdiv"},
                  [["label", {fo:"emailin", cla:"liflab"}, "Email"],
                   ["input", {type:"email", cla:"lifin", id:"emailin",
                              placeholder:"nospam@example.com",
                              value:fp.email}]]],
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
                               onclick:mdfs("stgmgr.mailinHelp")}],
                    [["label", {fo:"mailincb", id:"mailincblab"},
                      "Enable Mail-In Membics"],
                     ["span", {id:"mailinhelpspan"}, mih]]]]],
                 ["div", {cla:"cbdiv", id:"altmaildiv",
                          style:"display:" + altdisp + ";"},
                  [["label", {fo:"altemin", cla:"liflab"}, "Alt&nbsp;Email"],
                   ["input", {type:"email", cla:"lifin", id:"altemin",
                              value:fp.altinmail || "",
                              placeholder:"alternate@example.com"}]]]]); },
        hashtagSetting: function (embobj, canmod) {
            var rhs = ["span", {id:"hashin"}, embobj.hashtag];
            if(canmod) {
                rhs = ["input", {type:"text", cla:"lifin", id:"hashin",
                                 value:embobj.hashtag || "",
                                 placeholder:"uniquetext"}]; }
            return jt.tac2html(
                ["div", {cla:"cbdiv"},
                 [["label", {fo:"hashin", cla:"liflab"}, "Hashtag#"],
                  rhs]]); },
        //Return the standardized "permalink" web feed URI.  This should be as
        //simple and as compatible as possible.  The personalized web feed is
        //available when selecting how you are following.
        webfeedSetting: function (embobj) {
            var rssurl = rssURLForObj(embobj);
            var linktxt = rssurl;
            if(embobj.dsType === "Theme" && embobj.cliset &&
               embobj.cliset.flags && embobj.cliset.flags.archived) {
                linktxt = "Archived"; }
            return jt.tac2html(
                ["div", {cla:"cblinediv"},
                 ["div", {cla:"infolinediv"},
                  ["Web Feed: ",
                   ["a", {href:rssurl, title:"Subscribe to " + embobj.name,
                          onclick:jt.fs("window.open('" + rssurl + "')")},
                    linktxt]]]]); },
        //Themes have custom keywords, profiles don't.  Putting keywords in
        //profiles eventually restricts the kinds of content a user might
        //choose to post, because they are discouraged from posting
        //something outside of the keywords they have set up and invested
        //in.  Then they want to set up a new account or a separate account
        //profile somehow.  That's what themes are for.
        //No need to display the keywords entry unless making changes, since
        //the keywords can be easily seen by clicking the search input.
        keywordsSetting: function (embobj, canmod) {
            if((embobj.dsType !== "Theme") || !canmod) {
                return ""; }
            return jt.tac2html(
                ["div", {cla:"cbdiv"},
                 [["label", {fo:"kwrdsin", cla:"liflab"}, "Keywords"],
                  ["textarea", {cla:"lifin", id:"kwrdsin", rows:6,
                                placeholder:"Line separated values"},
                   app.theme.kwrdstrim(embobj.keywords || "", "expand")]]]); },
        sortOrderSetting: function (embobj, canmod) {
            if((embobj.dsType !== "Theme") || !canmod) {
                return ""; }
            var sortby = embobj.cliset.sortby;
            var opts = [{val:"recency", lab:"Creation Time"},
                        {val:"rating", lab:"Star Rating"}];
            opts = opts.map(function (opt) {
                return ["option", {value:opt.val,
                                   selected:jt.toru(opt.val === sortby)},
                        opt.lab]; });
            return jt.tac2html(
                ["div", {cla:"cbdiv"},
                 [["label", {fo:"themesortsel", cla:"liflab"}, "Sorting"],
                  ["select", {id:"themesortsel", cla:"lifin"}, opts]]]); },
        embedSetting: function (embobj, canmod) {
            var emburl = app.statemgr.urlForInstance(embobj) +
                "?site=YOURSITE.COM";
            var emboHTML = [];
            if(canmod) {
                embobj.cliset.embcolors = embobj.cliset.embcolors || {};
                var embcolors = embobj.cliset.embcolors;
                embedmgr.standardOverrideColors.forEach(function (od) {
                    embcolors[od.name] = embcolors[od.name] || od.value;
                    emboHTML.push(
                        ["div", {cla:"colorselectdiv"},
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
                   emboHTML]]]); },
        generalSettingsHTML: function (embobj, canmod) {
            return jt.tac2html(
                [stgmgr.hashtagSetting(embobj, canmod),
                 stgmgr.webfeedSetting(embobj),
                 stgmgr.keywordsSetting(embobj, canmod),
                 stgmgr.sortOrderSetting(embobj, canmod),
                 stgmgr.embedSetting(embobj, canmod)]); },
        settingsInfoAndUpdateButtonHTML: function (obj, canmod) {
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
                    "Update"]]]]); },
        writePersonalSettings: function (divid) {
            var prof = app.login.myProfile();
            jt.out(divid, jt.tac2html(
                [["div", {id:"settingsmenudiv"},
                  [["button", {id:"cntb", title:"Create New Theme",
                               onclick:jt.fs("app.theme.create('" + divid + 
                                             "')")},
                    "Create&nbsp;Theme"],
                   ["button", {title:"Sign Out And Clear Saved Data",
                               onclick:jt.fs("app.login.logout()")},
                    "Sign Out"]]],
                 ["div", {id:"cpidiv"},
                  [stgmgr.personalInfoSettingsHTML(),
                   stgmgr.generalSettingsHTML(prof, true)]],
                 stgmgr.settingsInfoAndUpdateButtonHTML(prof, true)]));
            //dim and disable the Create Theme button if account is not active
            if(app.login.authenticated().status !== "Active") {
                var cntb = jt.byId("cntb");
                cntb.disabled = true;
                cntb.style.opacity = 0.4; } },
        writeThemeProfSettings: function (divid, obj) {
            var canmod = (app.theme.association(obj) === "Founder");
            jt.out(divid, jt.tac2html(
                [["div", {id:"settingsmenudiv"}],
                 ["div", {id:"cpidiv"},
                  [["div", {id:"memberactdiv"}],
                   stgmgr.generalSettingsHTML(obj, canmod)]],
                 stgmgr.settingsInfoAndUpdateButtonHTML(obj, canmod)]));
            app.theme.memberset(obj, "settingsmenudiv", "memberactdiv"); },
        toggleSettings: function (show) {
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
                stgmgr.writePersonalSettings("pcdsetcontdiv"); }
            else {
                stgmgr.writeThemeProfSettings("pcdsetcontdiv", obj); } },
        readCommonFields: function (obj, src) {
            oedmgr.readValues(obj);
            obj.hashtag = jt.byId("hashin").value.trim() || "UNSET_VALUE";
            obj.cliset = src.cliset;  //unsaved changes in cached obj are ok
            embedmgr.standardOverrideColors.forEach(function (od) {
                obj.cliset[od.name] = jt.byId(od.name + "in").value; }); },
        //Do a full page redisplay to reflect the potentially updated url
        //from changing the hashtag.  Leave the settings open so they can
        //see the changes were reflected.
        redisplay: function (updatedObj) {
            app.statemgr.notehash(updatedObj);
            app.statemgr.setState(updatedObj.dsType, updatedObj.dsId,
                                  {forceReplace:true, go:"settings"}); }
    };  //end stgmgr


    var srchmgr = {
        scopes: {"url":["url", "rurl"],
                 "keywords":["keywords"],
                 "details":["name", "title", "artist", "author", "publisher",
                            "album", "starring", "address", "year"]},
        //Queued membics (membic.dispafter > fist.ts) are not provided from
        //the RSS feed, but they display normally from within the app.
        match: function (membic, fist) {
            var contextobj = fist.actobj.contextobj;
            if(membic.dsType === "Overflow") {  //out of items, fault in more
                var ctxts = fist.ts;
                app.refmgr.getFull("Overflow", membic.dsId, function (ovrf) {
                    //overflows are cached to avoid refetch
                    if(ovrf) {  //fetch error already logged if not found
                        var membics = contextobj.preb.slice(0, -1);
                        contextobj.preb = membics.concat(ovrf.preb);
                        fist.actobj.contextobj = contextobj;
                        fist.actobj.itlist = contextobj.preb;
                        srchmgr.updateSearchLabelText();
                        app.pcd.resumeFilterContent(ctxts); } });
                return false; }  //don't display overflow elements
            if(membic.srcrev === "-604") {
                return false; }  //marked as deleted
            if(fist.qstr) {
                return srchmgr.specmatch(membic, fist.qstr); }
            return true; }, //if not any other condition, assume it's a match
        //Core match processing when qstr specified
        specmatch: function (membic, qstr) {
            var ps = srchmgr.parsedSearch(qstr);
            var fields;
            if(ps.scope) {
                fields = srchmgr.scopes[ps.scope]; }
            else {
                srchmgr.verifySearchFilterText(membic);
                fields = ["srchFiltTxt"]; }
            return fields.some((fld) => srchmgr.fldmatch(fld, membic, ps)); },
        tinf: function (fld, membic, ps, tok) {
            var obj = membic;
            if(ps.scope === "details") {
                obj = membic.details; }
            if(!obj || !obj[fld]) {
                return false; }
            var val = obj[fld];
            if(ps.scope) {  //searching anything except all text
                val = val.toLowerCase(); }
            return (val.indexOf(tok) >= 0); },
        fldmatch: function (fld, membic, ps) {
            if(ps.toks.some((tok) => srchmgr.tinf(fld, membic, ps, tok)) &&
               ps.pfts.every((pft) => srchmgr.tinf(fld, membic, ps, pft))) {
                return true; }
            return false; },
        //A search can consist of simple strings and/or quoted strings,
        //possibly preceded by a "+" indicating that the string should be
        //treated as an additional filter.  Save parsed search strings for
        //quick access when applying across lots of membics.
        parsedSearch: function (qstr) {
            ctx.parsedSearches = ctx.parsedSearches || {};
            var ps = ctx.parsedSearches[qstr];
            if(ps) {
                return ps; }
            ps = {scope:"", toks:[], pfts:[]};
            var pqs = srchmgr.parseScope(qstr, ps);
            ps.toks = pqs.toLowerCase().match(/\+?"[^"]*"*|\S+/g);
            ps.pfts = ps.toks.filter((tok) => tok.indexOf("+") === 0);
            ps.toks = ps.toks.filter((tok) => tok && tok.indexOf("+") !== 0);
            var opstrip = function (tok) {
                if(tok.indexOf("+") === 0) {
                    tok = tok.slice(1); }
                if(tok.indexOf("\"") === 0) {
                    tok = tok.slice(1, -1); }
                return tok; };
            ps.toks = ps.toks.map((tok) => opstrip(tok));
            ps.pfts = ps.pfts.map((pft) => opstrip(pft));
            jt.log("new parsedSearch for: " + qstr + " -> scope: " +
                   (ps.scope || "membic") + ", toks: " +
                   JSON.stringify(ps.toks) +
                   ", pfts: " + JSON.stringify(ps.pfts));
            ctx.parsedSearches[qstr] = ps;
            return ps; },
        parseScope: function (qstr, ps) {
            qstr = qstr.replace(/in\s+(\S*)\:/g, function (ignore, p1) {
                if(srchmgr.scopes[p1]) {
                    ps.scope = p1; }
                return ""; });  //leave qstr with just the search terms left
            return qstr; },
        //make a single searchable text field for the entire membic.
        verifySearchFilterText: function (membic) {
            if(membic.srchFiltTxt) {
                return; }  //already set up
            var txt = "";
            var flds = ["url", "rurl", "revtype", "cankey", "text", "keywords"];
            flds.forEach(function (field) {
                txt += " " + (membic[field] || ""); });
            srchmgr.scopes.details.forEach(function (field) {
                txt += " " + (membic.details[field] || ""); });
            membic.srchFiltTxt = txt.toLowerCase(); },
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
                link.title = "Search items"; } }
    };  //end srchmgr


    //Automatic scrolling is highly annoying from UX POV, except when you
    //were just working on something and don't want to lose your context
    //completely due to a redisplay.  To avoid unnecessary jumpiness, all
    //automatic scrolling is triggered by an explicit jumpto which is
    //consumed immediately and not repeated.
    var scrollmgr = {
        noteItemRendered: function (item) {
            if(item.dsId === ctx.jumpto) {
                app.fork({descr:"pcdjumpto" + ctx.fist.cdx, ms:200,
                          func:scrollmgr.processJumpTo}); } },
        processJumpTo: function () {
            //A display item has been created for the dsId specified in the
            //context jumpto, and the display iteration has had a chance to
            //render another item or two after that.  The resulting scroll
            //may or may not position the item at the top of the display,
            //but at least not at the bottom if there are items after it.
            var idx = ctx.actobj.itlist.findIndex((m) => m.dsId === ctx.jumpto);
            jt.byId("pcditemdiv" + idx).scrollIntoView();
            ctx.jumpto = "";
            if(app.startParams.mdisp === "expanded") {
                app.membic.toggleMembic(idx, "expanded",
                                        ctx.actobj.itlist[idx]);
                app.startParams.mdisp = ""; } },
        //Not part of the explicit scrolling, but alters the size of the top
        //part of the page so putting it here to keep interactions localized.
        toggleDescExp: function (state) {
            var descrdiv = jt.byId("pcddescrdiv");
            if(state === "check") {
                if(descrdiv.scrollHeight > descrdiv.clientHeight) {
                    state = "closed"; }
                else {  //no overflow, clear content if there was any
                    jt.out("pcdshoutexpdiv", "");
                    return; } }
            var states = {closed:{sym:"&#x261F;", nst:"open", h:110},
                          open:{sym:"&#x261D;", nst:"closed",
                                h:descrdiv.scrollHeight}};
            descrdiv.style.height = String(states[state].h) + "px";
            jt.out("pcdshoutexpdiv", jt.tac2html(
                ["a", {href:"#toggleDescriptionExpansion",
                       onclick:jt.fs("app.pcd.managerDispatch('scrollmgr'," +
                                     "'toggleDescExp','" + states[state].nst +
                                     "')")},
                 states[state].sym])); }
    };  //end scrollmgr


    //Owner editable field manager.  Field values are within "span" tags
    //because "div" tags may insert unwanted line breaks.
    var oedmgr = {
        dfstr: function (fname, argstr) {
            return jt.fs("app.pcd.managerDispatch('oedmgr', '" + fname + "'," +
                         (argstr || "") + ")"); },
        dispdefs: function () {
            return dst[ctx.descobj.disptype] || dst.other; },
        fieldstate: function () {
            var fs = "normal";
            var prof = app.login.myProfile();
            if(ctx.descobj.contextobj && prof) {  //potentially editable
                var obj = ctx.descobj.contextobj;
                if(obj.dsType === "MUser" && obj.dsId === prof.dsId) {
                    fs = "editable"; }
                else if(app.theme.association(obj) === "Founder") {
                    fs = "editable"; }
                if(fs === "editable" && ctx.descobj.editing) {
                    fs = "editing"; } }
            return fs; },
        htmlattrs: function (fieldname, attrs) {
            attrs.id = oedmgr.dispdefs()[fieldname].eid;
            if(oedmgr.fieldstate() === "editable") {
                attrs.style = attrs.style || "";
                attrs.style += "cursor:crosshair;";
                attrs.onclick = oedmgr.dfstr("startedit",
                                             "'" + fieldname + "'"); }
            return attrs; },
        htmlvalue: function (fieldname, evtype) {
            var fs = oedmgr.fieldstate();
            var defs = oedmgr.dispdefs();
            var html = ctx.descobj[defs[fieldname].dfld] || "";
            if(!html && (fs !== "editing" || evtype === "blur")) {
                if(fs !== "normal") {  //use placeholder text for owner
                    html = defs[fieldname].plo; }
                else {  //use public placeholder text
                    html = defs[fieldname].plp; } }
            if(fs !== "editing" && fieldname === "dscr") {
                html = jt.linkify(html); }
            return html; },
        startedit: function (fieldname) {
            ctx.descobj.editing = "enabled";  //note content made editable
            stgmgr.toggleSettings("show");  //show Update button to save changes
            var focid = "";
            Object.entries(oedmgr.dispdefs()).forEach(function ([field, defs]) {
                var span = jt.byId(defs.eid);
                span.onclick = null;
                span.contentEditable = true;
                jt.on(span, "focus", oedmgr.focuschange);
                jt.on(span, "blur", oedmgr.focuschange);
                span.style.cursor = "text";
                if(field === fieldname) {
                    focid = defs.eid; } });
            if(focid) {
                jt.byId(focid).focus(); } },
        focuschange: function (event) {
            //track any input changes so they don't get reset
            Object.entries(oedmgr.dispdefs())
                .forEach(function ([ignore, defs]) {
                    if(defs.eid === event.target.id) {
                        ctx.descobj[defs.dfld] = event.target.innerHTML;
                        if(ctx.descobj[defs.dfld] === defs.plo ||
                           ctx.descobj[defs.dfld] === defs.plp) {
                            ctx.descobj[defs.dfld] = ""; } } });
            if(oedmgr.dispdefs().name.eid === event.target.id) {
                event.target.innerHTML = oedmgr.htmlvalue("name", event.type); }
            else {
                event.target.innerHTML = oedmgr.htmlvalue("dscr", event.type); }
        },
        readValues: function (pto) {
            Object.entries(oedmgr.dispdefs())
                .forEach(function ([ignore, defs]) {
                    pto[defs.srcfld] = jt.byId(defs.eid).innerHTML; }); },
        ownerEditableFieldsInfo: function () {
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
                    oef.name.savdfltval = "Theme " +
                        updobj.founders.csvarray()[0];
                    oef.descr.srcfld = "description";
                    oef.descr.place = "What do you post to this theme?"; } }
            return oef; }
    };  //end oedmgr


    var picmgr = {
        //After a pic has been uploaded, the local profile/theme information
        //is up to date except for the modified time.  Just set directly.
        notePicUploadMod: function (mod) {
            ctx.actobj.contextobj.modified = mod;  //note modification time
            //If no previous pic, then indicate pic now available
            if(ctx.actobj.contextobj.dsType === "MUser") {
                ctx.actobj.contextobj.profpic = ctx.actobj.contextobj.dsId; }
            else if(ctx.actobj.contextobj.dsType === "Theme") {
                ctx.actobj.contextobj.picture = ctx.actobj.contextobj.dsId; } },
        readDoneTimestamp: function (txt) {
            return txt.match(/Done:\s([^<\s]+)/)[1]; },
        monitorUpload: function (submit) {
            var iframe = jt.byId("pumif");
            if(!iframe) {
                return jt.log("picmgr.monitorUpload exiting, no iframe"); }
            jt.byId("picuploadbutton").disabled = true;
            if(submit) {
                jt.byId("picupldform").submit(); }
            var picstatdiv = jt.byId("picuploadstatusdiv");
            if(!picstatdiv.innerHTML) {
                picstatdiv.innerHTML = "Uploading"; }
            else {  //add a monitoring dot
                picstatdiv.innerHTML = picstatdiv.innerHTML + "."; }
            var txt = iframe.contentDocument || iframe.contentWindow.document;
            if(!txt || !txt.body || txt.body.innerHTML.indexOf("Ready") >= 0) {
                return app.fork({descr:"monitor pic upload", ms:1000,
                                 func:picmgr.monitorUpload}); }
            //upload complete, update image or report error
            txt = txt.body.innerHTML;
            jt.out("pcdpicuploaddiv", "");  //clear image upload form
            if(txt.indexOf("Done: ") >= 0) { //successful upload
                picmgr.notePicUploadMod(picmgr.readDoneTimestamp(txt));
                var img = jt.byId("pcdpicimg");
                img.src = app.pcd.picImgSrc(ctx.actobj.contextobj); }
            else { //report error
                jt.err(txt); } },
        enableUploadButton: function () {
            jt.byId("picuploadbutton").disabled = false; },
        togglePicUpload: function () {
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
                          onclick:mdfs("picmgr.togglePicUpload")}, "x"]],
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
                               onchange:mdfs("picmgr.enableUploadButton")}],
                    ["div", {id:"picuploadstatusdiv"}],
                    ["div", {id:"picuploadformbuttonsdiv"},
                     ["button", {type:"submit", id:"picuploadbutton",
                                 onclick:mdfs("picmgr.monitorUpload", true)},
                      "Upload"]]]],
                  ["iframe", {id:"pumif", name:"pumif", src:"/api/uploadimg",
                              style:"display:none"}]]]);
            jt.byId("picuploadbutton").disabled = true; },
        ownerEnablePicUpload: function () {
            var obj = ctx.actobj.contextobj;
            if(obj && ((app.samePO(obj, app.login.myProfile())) ||
                       (app.theme.association(obj) === "Founder"))) {
                jt.on("pcdpicdiv", "click", picmgr.togglePicUpload);
                jt.byId("pcdpicdiv").style.cursor = "pointer"; } }
    };  //end picmgr


    function writeActionsArea () {
        var searchdivcontents = [
            ["a", {href:"#search", id:"srchlink", title:"Search items",
                   onclick:jt.fs("app.pcd.filterContent('change')")},
             ["img", {src:app.dr("img/search.png"), cla:"webjump"}]]];
        var srchinattrs = {type:"search", id:"pcdsrchin", size:26,
                           placeholder:"Search text",
                           onchange:jt.fs("app.pcd.filterContent('change')"),
                           value:""};  //value set by UI interaction only
        var dlos = [];  //datalist options from keywords, if defined
        if(ctx.actobj.contextobj && ctx.actobj.contextobj.keywords) {
            ctx.actobj.contextobj.keywords.csvarray().forEach(function (key) {
                key = key.trim();
                if(key) {
                    if(/\S+\s\S+/.test(key)) {  //keyword has a space in it
                        key = "&quot;" + key + "&quot;"; }
                    key = " " + key;  //prefix to indicate keyword
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
                        onclick:mdfs("sharemgr.togshare")},
                  ["span", {cla:"penbutton"},
                   ["img", {id:"pnarw", cla:"webjump", 
                            src:app.dr("img/sharemenu.png")}]]],
                 ["span", {cla:"penbutton"},
                  stgmgr.settingsButtonHTML()]]],
               ["div", {id:"pcdacsrchdiv"}, searchdivcontents]]],
             ["div", {id:"pcdsharediv", style:"display:none;"},
              ["div", {id:"pcdsharecontdiv"},
               sharemgr.shareAndFollowButtons()]],
             ["div", {id:"pcdsettingsdiv", style:"display:none;"},
              ["div", {id:"pcdsetcontdiv"}]]]));
        embedmgr.unhideSoloPageActions();
    }


    //The extraobj is used to drive additional actions passed along from
    //app.init2 or login.verifyUserInfo.  It is up to the handler func
    //to verify the user is authenticated if that is required.
    function processExtraObject (extraobj) {
        if(extraobj) { switch(extraobj.go) {
            case "follow": return app.fork(
                {descr:"pxob follow", ms:100, func:stgmgr.toggleSettings});
            case "reply": return app.fork(
                {descr:"pxob reply", ms:800, func:function () {
                    var mid = app.startParams.membicid;
                    var idx = ctx.actobj.itlist
                        .findIndex((m) => m.dsId === mid);
                    app.membic.toggleMembic(idx, "urlreplyparamexp"); }});
            case "audience": return app.fork(
                {descr:"pxob audience", ms:100, func:function () {
                    if(!app.login.authenticated()) { return; }
                    sharemgr.togshare();  //open sharing area
                    app.theme.audience(app.startParams.uid); }});
            case "settings": return app.fork(
                {descr:"pxob settings", ms:100, func:stgmgr.toggleSettings});
            default: if(extraobj.go) {
                if(parseInt(extraobj.go, 10) && //true even if huge number
                   ctx.actobj && ctx.actobj.itlist &&
                   ctx.actobj.itlist.find((m) => m.dsId === extraobj.go)) {
                    app.startParams.mdisp = "expanded";
                    ctx.jumpto = extraobj.go; }
                else {
                    jt.log("pcd.processExtraObject ignored " +
                           JSON.stringify(extraobj)); } } } }
    }


    function membicDisplayHTML (membic, fist) {
        return app.membic.formHTML(fist.cdx, membic);
    }


    function ptNoticesDisplay (obj) {
        jt.log("ptNoticesDisplay not implemented yet" + obj);
    }


    function displayPTObj (obj, extra) {
        var sf = "";
        if(app.login.myProfile()) {  //signed in and user info loaded
            sf = mdfs("stgmgr.toggleSettings"); }
        var fullurl = app.docroot + app.pcd.linkForThemeOrProfile(obj).slice(1);
        app.pcd.setPageDescription({picsrc:app.pcd.picImgSrc(obj),
                                    disptype:obacc[obj.dsType].disptype,
                                    contextobj:obj,
                                    name:obj.name,
                                    descr:obj.description || obj.aboutme || "",
                                    exturl:fullurl,
                                    rssurl:rssURLForObj(obj)});
        app.pcd.setPageActions({itlist:app.theme.prebsort(obj, obj.preb),
                                itmatchf:srchmgr.match,
                                itdispf:membicDisplayHTML,
                                contextobj:obj, extraobj:extra,
                                setfstr:sf,
                                notif:ptNoticesDisplay});
    }

    
    //For a profile, display the themes they've posted to so people can
    //easily jump from the person to a theme they are interested in
    //following.  Makes the profile more interesting, especially for those
    //who have not posted any text about themselves.  For a theme, it is
    //better if people expand the membics they are interested in and
    //discover the person from there.  Contribution over membership.
    function updateAssocLinksDisplay (item) {
        if(ctx.descobj.disptype === "profile" && item.svcdata &&
           item.svcdata.postctms) {
            item.svcdata.postctms.forEach(function (pn) {
                if(!ctx.descobj.assoclinks[pn.ctmid]) {
                    ctx.descobj.assoclinks[pn.ctmid] = pn;
                    var aldiv = jt.byId("pcdassoclinksdiv");
                    if(aldiv.innerText) {
                        aldiv.innerHTML += " | "; }
                    aldiv.innerHTML += app.membic.managerDispatch(
                        "tp", "postNoteHTML", 0, 0, pn); } }); }
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
                elem.id = "pcditemdiv" + ctx.fist.cdx;
                odiv.appendChild(elem);  //make available first, then fill
                elem.innerHTML = ctx.actobj.itdispf(item, ctx.fist);
                scrollmgr.noteItemRendered(item);
                updateAssocLinksDisplay(item);
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


    fetchType: function (dtype) {
        switch(dtype) {
        case "profile": return "MUser";
        case "theme": return "Theme"; }
        return dtype;
    },


    fetchAndDisplay: function (dtype, id, extra) {
        app.statemgr.verifyState(dtype, id, extra, function () {
            if(!id) {
                jt.log("pcd.fetchAndDisplay " + dtype + " required an id");
                jt.log(new Error().stack); }
            app.refmgr.getFull(app.pcd.fetchType(dtype), id, function (obj) {
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
                ctx.descobj.assoclinks = {};
                ctx.fist = {idx:0, ts:new Date().toISOString(), pgs:1,
                            pz:41, //off by one helps avoid pg/overflow sync
                            qstr:"", dc:0, actobj:ctx.actobj,
                            kwrds:{disp:false, sel:[]},
                            types:{disp:false, sel:[]}};
                jt.byId("pcdsrchin").value = ""; }
            else if(mode === "change") {  //refiltering in response to change
                var sin = jt.byId("pcdsrchin");
                ctx.fist.qstr = sin.value;
                if(ctx.fist.qstr.startsWith(" ")) { //from keywords
                    sin.value = "in keywords:" + ctx.fist.qstr;
                    ctx.fist.qstr = "in keywords: " + ctx.fist.qstr; }
                ctx.fist.idx = 0; //refilter all items from the beginning
                ctx.fist.ts = new Date().toISOString();
                ctx.fist.pgs = 1; //single page of results to start
                ctx.fist.dc = 0; } } //reset the display count
        appendNextMatchingItemToContent();  //kick off membic filtering
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
        descobj.owneredit = oedmgr.ownerEditableFieldsInfo();
        var fsz = "large";
        if(descobj.descr.length > 300) {
            fsz = "medium"; }
        jt.out("pgdescdiv", jt.tac2html(
            [["div", {id:"pcduppercontentdiv"},
              [["div", {id:"pcdpicdiv"},
                ["img", {id:"pcdpicimg", src:descobj.picsrc}]],
               ["div", {id:"pcddescrdiv"},
                [["div", {id:"pcdnamediv"},
                  ["span", oedmgr.htmlattrs("name", {cla:"penfont"}),
                   oedmgr.htmlvalue("name", descobj)]],
                 ["div", {id:"pcdshoutdiv"},
                  [["span", oedmgr.htmlattrs("dscr", {cla:"descrspan",
                                             style:"font-size:" + fsz + ";"}),
                    oedmgr.htmlvalue("dscr", descobj)],
                   ["div", {id:"pcdassoclinksdiv"}]]]]]]],  //filled on display
             ["div", {id:"pcdshoutexpdiv"}],
             ["div", {id:"pcduppersavediv"}],
             ["div", {id:"pcdpicuploaddiv"}]]));
        scrollmgr.toggleDescExp("check");
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
            embedmgr.customizeSoloPageDisplay(actobj.contextobj); }
        writeActionsArea();
        srchmgr.updateSearchLabelText();
        processExtraObject(actobj.extraobj);
        picmgr.ownerEnablePicUpload();
        var filtermode = "init";
        if(actobj.jumpto) {  //just saved an edit. or similar context
            filtermode = "change"; }
        app.pcd.filterContent(filtermode);
    },


    picImgSrc: function (obj) {  //profile or theme
        var src = app.dr("img/nopicprof.png");
        if(obj && obj[obacc[obj.dsType].picfield]) {  //e.g. profile.profpic
            src = "/api/obimg?dt=" + obj.dsType + "&di=" + obj.dsId +
                "&cb=" + obj.modified.replace(/[\-:]/g,""); }
        return src;
    },


    managerDispatch: function (mgrname, fname, ...args) {
        switch(mgrname) {
        case "embedmgr": return embedmgr[fname].apply(app.pcd, args);
        case "sharemgr": return sharemgr[fname].apply(app.pcd, args);
        case "stgmgr": return stgmgr[fname].apply(app.pcd, args);
        case "srchmgr": return srchmgr[fname].apply(app.pcd, args);
        case "scrollmgr": return scrollmgr[fname].apply(app.pcd, args);
        case "oedmgr": return oedmgr[fname].apply(app.pcd, args);
        case "picmgr": return picmgr[fname].apply(app.pcd, args);
        default: jt.log("pcd.managerDispatch no manager: " + mgrname); }
    }

};  //end of returned functions
}());
