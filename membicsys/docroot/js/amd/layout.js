/*global window, document, app, jt, d3, d3ckit */

/*jslint browser, white, fudge, for, long */

app.layout = (function () {
    "use strict";

    var typestate = {callback: null, typename: "all"};
    var dnld = {mf:null, opts:[{format:"html", name:"Document (HTML)"},
                               {format:"pdf", name:"Document (PDF)"},
                               {format:"tsv", name:"Spreadsheet (TSV)"},
                               {format:"json", name:"JavaScript (JSON)"}]};
    var dlgqueue = [];
    var decknames = [];
    var autoplay = false;
    var tightLeftX = 10;


    function replaceDocComments (html) {
        var txt;
        html = html.replace(/\.<!--\s\$ABOUTCONTACT\s-->/g,
            " or <a href=\"mailto:" + app.suppemail + "\">by email</a>.");
        var dst = app.pcd.getDisplayState();
        if(dst && dst.obj) {
            if(dst.type === "coop") {
                if(dst.obj.hashtag) {
                    txt = "https://" + window.location.host + "/" + 
                        dst.obj.hashtag; }
                else {
                    txt = "Theme hashtag not set"; }
                html = html.replace(/<!--\s\$THEMEHASHURL\s-->/g, txt);
                txt = "https://" + window.location.host + "/t/" + dst.id;
                html = html.replace(/<!--\s\$THEMEPERMALINK\s-->/g, txt);
                txt = "https://" + window.location.host + 
                    "?view=coop&coopid=" + dst.id;
                html = html.replace(/<!--\s\$MEMBICPARAMLINK\s-->/g, txt); }
            txt = jt.tac2html(["a", {href: "#settings",
                                     onclick: jt.fs("app.pcd.settings()")},
                               "See Settings for RSS and embedding."]);
            html = html.replace(/<!--\s\$SEEPCDSETTINGSLINK\s-->/g, txt); }

        return html;
    }


    function noteDocSlideDecks (html) {
        var calls = html.split("app.layout.runSlideDeck");
        decknames = [];  //clear anything previously loaded
        autoplay = false;
        calls.forEach(function (call) {
            var deckname;
            if(call.startsWith("('")) {
                call = call.slice(2);
                deckname = call.slice(0, call.indexOf("'"));
                decknames.push(deckname); } });
    }


    function convertDocRef (href) {
        if(href.indexOf("docs/") < 0) {  //need to convert crawl relative link
            if(href.indexOf("/") >= 0) {
                href = href.slice(0, href.lastIndexOf("/") + 1) +
                    "docs/" + href.slice(href.lastIndexOf("/") + 1); }
            else {
                href = "docs/" + href; } }
        return href;
    }


    function shouldOpenInNewTab (link) {
        var nt;
        var lms = ["#", "https://membic.org", "https://membic.org",
                   "https://www.membic.org", "https://www.membic.org",
                   "http://localhost", "mailto"];
        if(link.className.indexOf("externaldocslink") >= 0) {
            nt = true; }
        if(!nt) {
            var matches = lms.filter(function (substr) {
                if(link.href.indexOf(substr) >= 0) {
                    return substr; } });
            nt = !(matches && matches.length); }
        return nt;
    }


    function convertDocLinks () {
        var links = document.getElementsByTagName("a");
        Array.prototype.forEach.call(links, function (link) {
            if(link.className.indexOf("localdocslink") >= 0) {
                link.href = convertDocRef(link.href);
                jt.on(link, "click", app.layout.docLinkClick); }
            else if(shouldOpenInNewTab(link)) {
                //jt.log("new tab for: " + link.href);
                jt.on(link, "click", app.layout.externalDocLinkClick); } });
    }


    function getTitleForDocument (html, url) {
        var title; var idx;
        if(html.indexOf("<title>") >= 0 && html.indexOf("</title>") >= 0) {
            title = html.slice(html.indexOf("<title>") + 7,
                               html.indexOf("</title>")); }
        else { //create title from capitalized doc file name
            idx = url.lastIndexOf("/");
            if(idx > 0) {
                url = url.slice(idx + 1); }
            idx = url.indexOf(".");
            if(idx > 0) {
                url = url.slice(0, idx); }
            title = url.capitalize(); }
        //title overrides
        if(title === "About" || title === "Howto" || title === "Themepage"
           || title === "membic definition") {
            title = ""; }
        return title;
    }


    function displayDocContent (url, html, overlay) {
        var bodystart = "<body>";
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        var title = getTitleForDocument(html, url);
        var idx = html.indexOf(bodystart);
        if(idx > 0) {
            html = html.slice(idx + bodystart.length,
                              html.indexOf("</body")); }
        html = replaceDocComments(html);
        noteDocSlideDecks(html);
        //display content
        if(overlay) {
            html = app.layout.dlgwrapHTML(title, html);
            var coords = {x: tightLeftX, y: 40};
            if(typeof overlay === "string") {
                var elem = jt.byId(overlay);
                if(elem) {
                    coords = jt.geoPos(elem);
                    //position content above element (footer links)
                    coords.y = Math.max(coords.y - 250, 40); } }
            //openDialog deals with the y scroll offset as needed.
            app.layout.openDialog(coords, html); }
        else {
            if(url.indexOf("about.html") >= 0) {
                jt.byId("infoimg").style.display = "none"; }
            jt.out("contentdiv", html); }
        convertDocLinks();
    }


    //relative paths don't work when you are running file://...
    function relativeToAbsolute (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    }


    //hide the doc links as they are accessed from info link
    function localDocLinks () {
        jt.out("logodiv", "");
        jt.byId("bottomnav").style.display = "none";
    }


    //Minimum cell phone width is assumed to be 320px.
    function findDisplayHeightAndWidth () {
        //most browsers (FF, safari, chrome, 
        if(window.innerWidth && window.innerHeight) {
            app.winw = window.innerWidth;
            app.winh = window.innerHeight; }
        //alternate that must have been useful at some point?
        else if(document.compatMode === "CSS1Compat" &&
                document.documentElement && 
                document.documentElement.offsetWidth) {
            app.winw = document.documentElement.offsetWidth;
            app.winh = document.documentElement.offsetHeight; }
        //IE8
        else if(document.body && document.body.offsetWidth) {
            app.winw = document.body.offsetWidth;
            app.winh = document.body.offsetHeight; }
        //last resort
        else {  //WTF, just guess.
            app.winw = 800;
            app.winh = 800; }
        //jt.out("bottomnav", String(app.winw) + "x" + app.winh);
    }


    function closeModalSeparator () {
        var mdiv = jt.byId("modalseparatordiv");
        mdiv.style.width = "1px";
        mdiv.style.height = "1px";
    }


    function openModalSeparator () {
        var mdiv = jt.byId("modalseparatordiv");
        mdiv.style.width = String(app.winw) + "px";
        mdiv.style.height = String(app.winh) + "px";
    }


    function colorDeckLinkSpans (deckname, color, suffixes) {
        if(!suffixes) {
            suffixes = ["span", "slidesspan", "textspan"]; }
        if(typeof suffixes === "string") {
            suffixes = [suffixes]; }
        suffixes.forEach(function (suffix) {
            var span = jt.byId(deckname + suffix);
            if(span) {
                span.style.color = color; } });
    }


    function ungrayKnownLinks () {
        if(decknames) {
            decknames.forEach(function (dn) {
                colorDeckLinkSpans(dn, "#111111"); }); }
    }


    function getHTMLDataURI (membics) {
        var txt;
        membics = membics || [];
        txt = "<!doctype html>\n<html>\n<head>\n" +
            "<meta http-equiv=\"Content-Type\"" + 
            " content=\"text/html; charset=UTF-8\" />\n" +
            "<title>Membics</title>\n" +
            "<style>\n" +
            ".printrevdiv { clear:both; margin-bottom:10px; }\n" +
            ".fprevpicdiv { float:left; padding:0px 10px 0px 3px; }\n" +
            ".revimg { max-width:125px; max-height:80px; min-width:50px; }\n" +
            "</style>\n" +
            "</head><body>";
        membics.forEach(function (membic) {
            var type = app.review.getReviewTypeByValue(membic.revtype);
            var url = app.review.membicURL(type, membic);
            var pic = "";
            if(membic.imguri) {
                pic = ["img", {cla:"revimg", src:membic.imguri}]; }
            txt += "\n" + jt.tac2html(
                ["div", {cla:"printrevdiv"},
                 [["div", {cla:"fprevpicdiv"}, pic],
                  ["a", {href: url},
                   app.pcd.reviewItemNameHTML(type, membic)],
                  ["br"],
                  jt.linkify(membic.text || "")]]); });
        txt += "</body></html>\n";
        return "data:text/html;charset=utf-8," + encodeURIComponent(txt);
    }


    function getTSVDataURI (membics) {
        var txt = "";
        membics = membics || [];
        if(membics.length) {
            var keys = Object.keys(membics[0]);  //use same keys for all
            keys.forEach(function (field, idx) {
                if(idx) {
                    txt += "\t"; }
                txt += field; });
            txt += "\n";
            membics.forEach(function (membic) {
                keys.forEach(function (field, idx) {
                    var fv = membic[field];
                    if(field === "text") {
                        fv = fv.replace(/\t/g, " ");
                        fv = fv.replace(/\n/g, "  "); }
                    if(idx) {
                        txt += "\t"; }
                    txt += fv; });
                txt += "\n"; }); }
        return "data:text/plain;charset=utf-8," + encodeURIComponent(txt);
    }


    function getJSONDataURI (membics) {
        var txt;
        membics = membics || [];
        txt = JSON.stringify(membics);
        return "data:text/plain;charset=utf-8," + encodeURIComponent(txt);
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        var body;
        findDisplayHeightAndWidth();
        app.layout.commonUtilExtensions();
        localDocLinks();
        if(app.winw > 500) {  //easily fit max topleftdiv + toprightdiv
            body = jt.byId("bodyid");
            body.style.paddingLeft = "8%";
            body.style.paddingRight = "8%"; }
        if(!app.embedded) {
            app.layout.rotateBackgroundPic(); }
    },


    commonUtilExtensions: function () {
        //Referencing variables starting with an underscore causes jslint
        //complaints, but it still seems the clearest and safest way to
        //handle an ID value in the server side Python JSON serialization.
        //This utility method encapsulates the access, and provides a
        //single point of adjustment if the server side logic changes.
        jt.instId = function (obj) {
            var idfield = "_id";
            if(obj && obj.hasOwnProperty(idfield)) {
                return obj[idfield]; }
        };
        jt.setInstId = function (obj, idval) {
            var idfield = "_id";
            obj[idfield] = idval;
        };
        jt.isId = function (idval) {
            if(idval && typeof idval === "string" && idval !== "0") {
                return true; }
            return false;
        };
        jt.hasId = function (obj) {
            if(obj && jt.isId(jt.instId(obj))) {
                return true; }
            return false;
        };
        jt.errhtml = function (actverb, code, errtxt) {
            if(code === 409) {
                errtxt = errtxt.replace(/coop\s\d+/g, function (ctmref) {
                    return jt.makelink("?view=coop&coopid=" + 
                                       ctmref.slice(5)); }); }
            return actverb + " failed code " + code + ": " + errtxt;
        };
        jt.fsame = function (valA, valB) {  //equivalent form input value
            if(!valA && !valB) {
                return true; }
            if(typeof valA === "string" &&
               typeof valB === "string" &&
               valA.trim() === valB.trim()) {
                return true; }
            if(valA === valB) {
                return true; }
            return false;
        };
        jt.strNonNeg = function (val) {
            if(typeof val === "string") {
                val = parseInt(val, 10); }
            if(!val || val > 0) {
                return true; }  //numeric value may overflow js int
            return false;
        };
        jt.strPos = function (val) {
            if(typeof val === "string") {
                val = parseInt(val, 10); }
            if(val > 0) {
                return true; }  //numeric value may overflow js int
            return false;
        };
        jt.trimval = function (val) {
            val = val || "";
            val = val.trim();
            return val;
        };
        jt.changeSet = function (obj, field, val) {
            var changed = false;
            var currval = obj[field];
            if(currval !== val) {
                obj[field] = val;
                changed = true; }
            return changed; };
    },


    getType: function () {
        return typestate.typename;
    },


    deckStart: function (dds) {
        var deckname = dds.decks[dds.deckidx].deckname;
        ungrayKnownLinks();
        colorDeckLinkSpans(deckname, "gray", ["span", "slidesspan"]);
        if(autoplay) {
            d3ckit.playpause(); }
    },


    deckFinish: function () {
        autoplay = true;  //autoplay after the first one has been played
        d3ckit.nextDeck();  //start next deck
    },


    runSlideDeck: function (deckname) {
        jt.log("runSlideDeck " + deckname);
        autoplay = true;
        ungrayKnownLinks();
        colorDeckLinkSpans(deckname, "gray", ["span", "slidesspan"]);
        d3ckit.displayDeck(deckname);
    },


    deckText: function (deckname) {
        var dds = d3ckit.getDisplay();
        jt.log("deckText " + deckname);
        ungrayKnownLinks();
        colorDeckLinkSpans(deckname, "gray", "textspan");
        jt.out(dds.divid, d3ckit.deckByName(deckname).texthtml);
    },


    displayDoc: function (url, overlay) {
        var html;
        url = url || "docs/about.html";
        html = "Fetching " + url + " ...";
        if(overlay) {
            app.layout.openDialog(null, html); }
        else {
            jt.out("contentdiv", html);
            jt.out("headingdivcontent", ""); } //remove the types filter display
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        url += jt.ts("?cb=", "day");
        jt.request("GET", url, null,
                   function (resp) {
                       displayDocContent(url, resp, overlay);
                       app.fork({descr:"slide deck load",
                                 func:app.layout.loadSlideDecks,
                                 ms:50}); },
                   function (ignore /*code*/, errtxt) {
                       displayDocContent(url, errtxt, overlay); },
                   jt.semaphore("layout.displayDoc"));
    },


    loadSlideDecks: function () {
        var modnames = [];
        if(jt.byId("d3ckitdiv") && decknames && decknames.length) {
            if(window.d3 === undefined) { //glob var test
                app.loadScript("loadSlideDecks", 
                               "js/d3.v3.min.js", 
                               "d3script"); }
            if(window.d3ckit === undefined) { //glob var test
                app.loadScript("loadSlideDecks", 
                               "js/static/d3ckit.js?v=181127",
                               "d3ckitscript"); }
            decknames.forEach(function (deckname) {
                modnames.push("js/static/" + deckname); });
            jt.loadAppModules(app, modnames, window.location.href,
                              app.layout.displaySlideDecks, "?v=181127"); }
    },


    displaySlideDecks: function () {
        var deckdisp = {divid:"d3ckitdiv", decks:[],
                        bigArrowPlayColor:"#00af02",
                        deckStartFunc:app.layout.deckStart,
                        deckFinishFunc:app.layout.deckFinish};
        if(window.d3 === undefined ||   //glob var test
           window.d3ckit === undefined) {   //glob var test
            return app.fork({descr:"display slide decks",
                             func:app.layout.displaySlideDecks,
                             ms:300}); }
        //everything loaded and stable, set up and go
        deckdisp.vidw = Math.min((app.winw - 40), 420);
        jt.byId(deckdisp.divid).style.width = deckdisp.vidw + "px";
        decknames.forEach(function (deckname) {
            var deck = app[deckname];
            var decktextdiv = jt.byId(deckname + "textdiv");
            deck.deckname = deckname;
            if(decktextdiv) {  //store text with deck
                deck.texthtml = decktextdiv.innerHTML;
                decktextdiv.style.display = "none"; }
            deckdisp.decks.push(deck); });
        d3ckit.initDisplay(deckdisp);
        d3ckit.displayDeck("deckmembic");
    },


    docLinkClick: function (event) {
        jt.evtend(event);
        var src = event.target || event.srcElement;
        if(src) {
            var url = convertDocRef(src.href);
            jt.log("docLinkClick: " + url);
            app.layout.displayDoc(url, true); }
    },


    externalDocLinkClick: function (event) {
        var src;
        jt.evtend(event);
        src = event.target || event.srcElement;
        if(src) {
            window.open(src.href); }
    },


    writeDialogContents: function (html) {
        jt.out("dlgdiv", jt.tac2html(
            ["div", {id: "dlgborderdiv"},
             ["div", {id: "dlginsidediv"}, 
              html]]));
    },


    //clobbers existing dialog if already open
    openDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId("dlgdiv");
        app.layout.cancelOverlay();  //close overlay if it happens to be up
        //window.scrollTo(0,0);  -- makes phone dialogs jump around. Don't.
        coords = coords || {};  //default x and y separately
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 100);
        coords.y = coords.y || 60;  //default y if not specified
        if(coords.x > (app.winw / 2) || app.winw < 350) {
            coords.x = tightLeftX; }  //display too tight, use default left pos
        coords.y = coords.y + jt.byId("bodyid").scrollTop;  //logical height
        dlgdiv.style.left = String(coords.x) + "px";
        dlgdiv.style.top = String(coords.y) + "px";
        if(!app.escapefuncstack) {
            app.escapefuncstack = []; }
        app.escapefuncstack.push(app.onescapefunc);
        app.onescapefunc = app.layout.closeDialog;
        app.layout.writeDialogContents(html);
        if(initf) {
            initf(); }
        jt.byId("dlgdiv").style.visibility = "visible";
        if(visf) {
            visf(); }
    },


    closeDialog: function (jumpref) {
        jt.out("dlgdiv", "");
        jt.byId("dlgdiv").style.visibility = "hidden";
        app.onescapefunc = app.escapefuncstack.pop();
        if(dlgqueue.length > 0) {
            var dlg = dlgqueue.pop();
            app.layout.openDialog(dlg.coords, dlg.html, dlg.initf, dlg.visf); }
        if(jumpref) {
            window.open(jumpref); }
    },


    dlgwrapHTML: function (title, html, fs) {
        fs = fs || jt.fs("app.layout.closeDialog()");
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close", onclick: fs},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, title],
                html];
        return jt.tac2html(html);
    },


    placerel: function (domid, xadj, yadj) {
        var coords = null; 
        var elem = jt.byId(domid);
        if(elem) {
            coords = jt.geoPos(elem);
            if(xadj) {
                coords.x += xadj; }
            if(yadj) {
                coords.y += yadj; } }
        return coords;
    },


    cancelOverlay: function (preserveEscape) {
        var odiv;
        closeModalSeparator();
        odiv = jt.byId("overlaydiv");
        if(odiv) {
            jt.out("overlaydiv", "");
            odiv.style.visibility = "hidden"; }
        if(!preserveEscape) {
            app.onescapefunc = null; }
    },


    openOverlay: function (coords, html, initf, visf, closefstr) {
        var odiv;
        openModalSeparator();
        odiv = jt.byId("overlaydiv");
        coords = coords || {};
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 70);
        coords.y = coords.y || 200;
        if(coords.x > (app.winw / 2) || app.winw < 350) {
            coords.x = tightLeftX; }
        coords.y = coords.y + jt.byId("bodyid").scrollTop;  //logical height
        odiv.style.left = String(coords.x) + "px";
        odiv.style.top = String(coords.y) + "px";
        app.escapefuncstack.push(app.onescapefunc);
        app.onescapefunc = app.layout.cancelOverlay;
        closefstr = closefstr || jt.fs("app.layout.cancelOverlay()");
        html = [["div", {id: "closeline"},
                 ["a", {id: "closeoverlay", href: "#close",
                        onclick: closefstr},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                html];
        jt.out("overlaydiv", jt.tac2html(html));
        if(initf) {
            initf(); }
        odiv.style.visibility = "visible";
        if(visf) {
            visf(); }
    },


    togdisp: function (divid) {
        var div = jt.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    },


    shareButtonsTAC: function (spec) {
        //thanks to https://sharingbuttons.io/
        var dca = "resp-sharing-button resp-sharing-button--small";
        var dcb = "resp-sharing-button__icon resp-sharing-button__icon--solid";
        var urlp = jt.enc(spec.url);
        var tlnp = jt.dquotenc(spec.title);
        var tac = [];
        spec.socmed = spec.socmed || ["tw", "fb", "em"];
        spec.socmed.forEach(function (mt) {
            switch(mt) {
            case "tw":
                tac.push(["a", {
                    cla:"resp-sharing-button__link",
                    href:"https://twitter.com/intent/tweet/?text=" + tlnp + 
                        "&amp;url=" + urlp, target:"_blank",
                    rel:"noopener", "aria-label":""},
                          ["div", {cla:dca + " resp-sharing-button--twitter"},
                           ["div", {"aria-hidden":"true", cla:dcb},
                            ["svg", {xmlns:"http://www.w3.org/2000/svg",
                                     viewBox:"0 0 24 24"},
                             ["path", {d:"M23.44 4.83c-.8.37-1.5.38-2.22.02.93-.56.98-.96 1.32-2.02-.88.52-1.86.9-2.9 1.1-.82-.88-2-1.43-3.3-1.43-2.5 0-4.55 2.04-4.55 4.54 0 .36.03.7.1 1.04-3.77-.2-7.12-2-9.36-4.75-.4.67-.6 1.45-.6 2.3 0 1.56.8 2.95 2 3.77-.74-.03-1.44-.23-2.05-.57v.06c0 2.2 1.56 4.03 3.64 4.44-.67.2-1.37.2-2.06.08.58 1.8 2.26 3.12 4.25 3.16C5.78 18.1 3.37 18.74 1 18.46c2 1.3 4.4 2.04 6.97 2.04 8.35 0 12.92-6.92 12.92-12.93 0-.2 0-.4-.02-.6.9-.63 1.96-1.22 2.56-2.14z"}]]]]]);
                break;
            case "fb":
                tac.push(["a", {
                    cla:"resp-sharing-button__link", 
                    href:"https://facebook.com/sharer/sharer.php?u=" + urlp, 
                   target:"_blank", rel:"noopener", "aria-label":""},
                          ["div", {cla:dca + " resp-sharing-button--facebook"},
                           ["div", {"aria-hidden":"true", cla:dcb},
                            ["svg", {xmlns:"http://www.w3.org/2000/svg",
                                     viewBox:"0 0 24 24"},
                             ["path", {d:"M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"}]]]]]);
                break;
            case "em":
                spec.mref = spec.mref || 
                    "mailto:?subject=" + tlnp + "&amp;body=" + urlp;
                tac.push(["a", {
                    cla:"resp-sharing-button__link",
                    href:spec.mref,
                    target:"_self", rel:"noopener", "aria-label":""},
                          ["div", {cla:dca + " resp-sharing-button--email"},
                           ["div", {"aria-hidden":"true", cla:dcb},
                            ["svg", {xmlns:"http://www.w3.org/2000/svg",
                                     viewBox:"0 0 24 24"},
                             ["path", {d:"M22 4H2C.9 4 0 4.9 0 6v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7.25 14.43l-3.5 2c-.08.05-.17.07-.25.07-.17 0-.34-.1-.43-.25-.14-.24-.06-.55.18-.68l3.5-2c.24-.14.55-.06.68.18.14.24.06.55-.18.68zm4.75.07c-.1 0-.2-.03-.27-.08l-8.5-5.5c-.23-.15-.3-.46-.15-.7.15-.22.46-.3.7-.14L12 13.4l8.23-5.32c.23-.15.54-.08.7.15.14.23.07.54-.16.7l-8.5 5.5c-.08.04-.17.07-.27.07zm8.93 1.75c-.1.16-.26.25-.43.25-.08 0-.17-.02-.25-.07l-3.5-2c-.24-.13-.32-.44-.18-.68s.44-.32.68-.18l3.5 2c.24.13.32.44.18.68z"}]]]]]);
                break; } });
        return tac;
    },


    //With a single direct download link, the link would initially have
    //href="" which would then be set to an appropriate data URI in an
    //onclick handler before letting the click event percolate up to be
    //taken care of by the browser.  With all options in a dialog, the data
    //URI can be calculated when the radio button is selected.
    showDownloadOptions: function (membicsfunction) {
        var html = [];
        dnld.mf = membicsfunction;
        html.push(["div", {id:"dloptseltitlediv"}, "File Format"]);
        dnld.opts.forEach(function (opt, idx) {
            html.push(
                ["div", {cla:"dloptseldiv"},
                 [["input", {type:"radio", name:"dloptr", value:opt.format,
                             id:"dldrad" + opt.format, checked:jt.toru(!idx),
                             onchange:jt.fs("app.layout.dldrad(" + idx +")")}],
                  ["label", {fo:"dldrad" + opt.format, cla:"dlformatlabel"},
                   opt.name]]]); });
        html.push(["div", {id:"downloadactiondiv"}]);
        html = ["div", {id:"downloadoptsdiv"}, html];
        app.layout.openOverlay(jt.geoPos(jt.byId("downloadlink")), html,
                               function () { app.layout.dldrad(0); });
    },


    dldrad: function (dloptidx) {
        var dlopt = dnld.opts[dloptidx];
        switch(dlopt.format) {
        case "html":
            jt.out("downloadactiondiv", jt.tac2html(
                ["a", {id:"downloadactionlink", href:getHTMLDataURI(dnld.mf()),
                       download:"membics.html",
                       onclick:jt.fsd("app.layout.cancelOverlay()")},
                 [["img", {src: "img/download.png"}],
                  ["span", {id:"downloadactiontextspan"}, 
                   "Download HTML"]]]));
            break;
        case "pdf":
            jt.out("downloadactiondiv", jt.tac2html(
                ["a", {id:"downloadactionlink", href:"#printToPDF",
                       onclick:jt.fs("app.layout.cancelOverlay();" +
                                     "window.print();")},
                 [["img", {src: "img/download.png"}],
                  ["span", {id:"downloadactiontextspan"}, 
                   "Print to PDF"]]]));
            break;
        case "tsv":
            jt.out("downloadactiondiv", jt.tac2html(
                ["a", {id:"downloadactionlink", href:getTSVDataURI(dnld.mf()),
                       download:"membics.tsv",
                       onclick:jt.fsd("app.layout.cancelOverlay()")},
                 [["img", {src: "img/download.png"}],
                  ["span", {id:"downloadactiontextspan"}, 
                   "Download TSV"]]]));
            break;
        case "json":
            jt.out("downloadactiondiv", jt.tac2html(
                ["a", {id:"downloadactionlink", href:getJSONDataURI(dnld.mf()),
                       download:"membics.json",
                       onclick:jt.fsd("app.layout.cancelOverlay()")},
                 [["img", {src: "img/download.png"}],
                  ["span", {id:"downloadactiontextspan"}, 
                   "Download JSON"]]]));
            break;
        default:
            jt.out("downloadactiondiv", "Unknown Format"); }
    },


    rotateBackgroundPic: function () {
        var body = jt.byId("bodyid");
        //pic00 is reserved as a placeholder and is not in the rotation
        var pics = ["SnaefellsnesPenninsula.jpg", 
                    "BigIslandKona.jpg",
                    "RedwoodMoss.jpg", 
                    "BlueHill.jpg",
                    "QueeensGardenBryce.jpg", 
                    //"Iceland.jpg",
                    "GlassHouseLillies.jpg", 
                    "BryceWood.jpg", 
                    "NorthShore.jpg"];
        //bgpicidx is 1 based for easier init and to avoid confusion with pic00
        if(!app.bgpicidx) {  //choose starting index based on todays date
            app.bgpicidx = (new Date().getDate() % pics.length) + 1; }
        if(app.bgpicidx > pics.length) {  //one-based bgpicidx
            app.bgpicidx = 1; }
        var picf = "../img/sbg/" + pics[app.bgpicidx - 1];
        jt.log("switching background to " + picf);
        body.style.backgroundImage = "url('" + picf + "')";
        app.bgpicidx += 1;
    }

};  //end of returned functions
}());

