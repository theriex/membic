/*global window, document, app, jt, a2a, a2a_config, d3, d3ckit */

/*jslint browser, multivar, white, fudge, for */

app.layout = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var typestate = {callback: null, typename: "all"},
        dlgqueue = [],
        siteroot = "",
        addToAnyScriptLoaded = false,
        slidedecks = {},
        initialFadeIn = 1200,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    replaceDocComments = function (html) {
        var dst, txt;
        //complaints from jslint about escaping the space character here,
        //then if you get rid of it the complaint is to use \s instead.
        //What I want is to match exactly the one space, since this is
        //a known marker.  Generalizing doesn't seem good.  Leaving it.
        html = html.replace(/\.<!--\ \$ABOUTCONTACT\ -->/g,
            " or <a href=\"mailto:" + app.suppemail + "\">by email</a>.");
        dst = app.pcd.getDisplayState();
        if(dst && dst.type === "coop" && dst.obj) {
            if(dst.obj.hashtag) {
                txt = "https://" + window.location.host + "/" + 
                    dst.obj.hashtag; }
            else {
                txt = "Theme hashtag not set"; }
            html = html.replace(/<!--\ \$THEMEHASHURL\ -->/g, txt);
            txt = "https://" + window.location.host + "/t/" + dst.id;
            html = html.replace(/<!--\ \$THEMEPERMALINK\ -->/g, txt); }
        return html;
    },


    noteDocSlideDecks = function (html) {
        var calls = html.split("app.layout.runSlideDeck");
        slidedecks = { idx: -1, names: []};
        calls.forEach(function (call) {
            if(call.startsWith("('")) {
                call = call.slice(2);
                slidedecks.names.push(call.slice(0, call.indexOf("'")));
                slidedecks.idx = 0; } });
    },


    noteSlideDeckTextBlocks = function () {
        slidedecks.textblocks = [];
        slidedecks.names.forEach(function (name) {
            var html = "", div = jt.byId(name + "textdiv");
            if(div) {
                html = div.innerHTML;
                div.style.display = "none"; }
            slidedecks.textblocks.push(html); });
    },


    updateDeckIndexByName = function (deckname) {
        if(slidedecks) {
            slidedecks.names.forEach(function (name, idx) {
                if(name === deckname) {
                    slidedecks.idx = idx + 1; } }); }
    },


    nextSlideDeckName = function () {
        if(slidedecks.idx >= 0 && slidedecks.idx < slidedecks.names.length) {
            slidedecks.idx += 1;
            return slidedecks.names[slidedecks.idx - 1]; }
    },


    convertDocRef = function (href) {
        if(href.indexOf("docs/") < 0) {  //need to convert crawl relative link
            if(href.indexOf("/") >= 0) {
                href = href.slice(0, href.lastIndexOf("/") + 1) +
                    "docs/" + href.slice(href.lastIndexOf("/") + 1); }
            else {
                href = "docs/" + href; } }
        return href;
    },


    convertDocLinks = function () {
        var links, i, link;
        links = document.getElementsByTagName("a");
        for(i = 0; i < links.length; i += 1) {
            link = links[i];
            if(link.className.indexOf("localdocslink") >= 0) {
                link.href = convertDocRef(link.href);
                jt.on(link, "click", app.layout.docLinkClick); }
            else if(link.className.indexOf("externaldocslink") >= 0) {
                jt.on(link, "click", app.layout.externalDocLinkClick); } }
    },


    getTitleForDocument = function (html, url) {
        var title, idx;
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
        if(title === "About" || title === "Howto" || title === "Themepage") {
            title = ""; }
        return title;
    },


    displayDocContent = function (url, html, overlay) {
        var idx, title, bodystart = "<body>";
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        title = getTitleForDocument(html, url);
        idx = html.indexOf(bodystart);
        if(idx > 0) {
            html = html.slice(idx + bodystart.length,
                              html.indexOf("</body")); }
        html = replaceDocComments(html);
        noteDocSlideDecks(html);
        //display content
        if(overlay) {
            html = app.layout.dlgwrapHTML(title, html);
            //openDialog deals with the y scroll offset as needed.
            app.layout.openDialog({x: 20, y: 40}, html); }
        else {
            jt.out("contentdiv", html); }
        convertDocLinks();
        noteSlideDeckTextBlocks();
    },


    //relative paths don't work when you are running file://...
    relativeToAbsolute = function (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    },


    //hide the doc links as they are accessed from info link
    localDocLinks = function () {
        var html = ["a", {href: "#community", title: "Community membics",
                           onclick: jt.fs("app.activity.displayFeed('all')")},
                     ["img", {id: "logoimg", 
                              src: "img/membiclogo.png?v=161106"}]];
        jt.out("logodiv", jt.tac2html(html));
        jt.byId("bottomnav").style.display = "none";
    },


    //Minimum cell phone width is assumed to be 320px.
    findDisplayHeightAndWidth = function () {
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
    },


    closeModalSeparator = function () {
        var mdiv = jt.byId("modalseparatordiv");
        mdiv.style.width = "1px";
        mdiv.style.height = "1px";
    },


    openModalSeparator = function () {
        var mdiv = jt.byId("modalseparatordiv");
        mdiv.style.width = String(app.winw) + "px";
        mdiv.style.height = String(app.winh) + "px";
    },


    colorDeckLinkSpans = function (deckname, color, suffixes) {
        if(!suffixes) {
            suffixes = ["span", "slidesspan", "textspan"]; }
        if(typeof suffixes === "string") {
            suffixes = [suffixes]; }
        suffixes.forEach(function (suffix) {
            var span = jt.byId(deckname + suffix);
            if(span) {
                span.style.color = color; } });
    },


    ungrayKnownLinks = function () {
        if(slidedecks) {
            slidedecks.names.forEach(function (dn) {
                colorDeckLinkSpans(dn, "#111111"); }); }
    };


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
                errtxt = errtxt.replace(/coop\ \d+/g, function (ctmref) {
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
    },


    getType: function () {
        return typestate.typename;
    },


    displayTypes: function (callbackf, typename) {
        var html = [];
        if(typeof callbackf === "function") {
            typestate.callbackf = callbackf; }
        if(typename) {
            if(typename === typestate.typename && callbackf === -1) {
                typestate.typename = "all"; }  //toggle selection off...
            else {
                typestate.typename = typename; } }
        app.review.getReviewTypes().forEach(function (rt) {
            var clt = "reviewbadge";
            if(rt.type === typestate.typename) {
                clt = "reviewbadgesel"; }
            html.push(["a", {href: "#" + rt.type, cla: "revtypelink",
                             title: rt.plural.capitalize() + " only",
                             onclick: jt.fs("app.layout.displayTypes(-1,'" + 
                                            rt.type + "')")},
                       ["img", {cla: clt, src: "img/" + rt.img}]]); });
        html = ["div", {cla: "revtypesdiv", id: "revtypesdiv",
                        style: "opacity:" + (initialFadeIn? "0.0;" : "1.0")}, 
                html];
        jt.out("headingdivcontent", jt.tac2html(html));
        if(initialFadeIn) {
            setTimeout(function () {
                jt.byId("revtypesdiv").style.opacity = 1.0; }, initialFadeIn);
            initialFadeIn = 0; }
        if(callbackf === -1) {
            typestate.callbackf(typestate.typename); }
    },


    runSlideDeck: function (deckname) {
        var href, js;
        deckname = deckname || nextSlideDeckName();
        if(!deckname) {
            return jt.log("runSlideDeck: no deckname"); }
        updateDeckIndexByName(deckname);
        if(jt.byId("d3ckitdiv")) { //have display space for slides
            jt.out("d3ckitdiv", "");  //nuke anything previously running
            if(!app[deckname]) {  //slides module not already loaded
                jt.log("runSlideDeck loading " + deckname);
                href = jt.baseurl(window.location.href) + "/";
                if(typeof d3 === "undefined") {  //mac ff requires typeof
                    jt.log("runSlideDeck loading d3");
                    js = document.createElement("script");
                    //js.async = true;
                    js.type = "text/javascript";
                    js.src = href + "js/d3.v3.min.js?v=161106";
                    document.body.appendChild(js); }
                if(typeof d3ckit === "undefined") {  //mac ff requires typeof
                    jt.log("runSlideDeck loading d3ckit");
                    js = document.createElement("script");
                    //js.async = true;
                    js.type = "text/javascript";
                    js.src = href + "js/static/d3ckit.js?v=161106";
                    document.body.appendChild(js); }
                jt.loadAppModules(app, ["js/static/" + deckname], href,
                                  function () { 
                                      app.layout.runSlideDeck(deckname); },
                                  jt.ts("?cb=", "minute")); }
            else { //app[deckname] module already loaded
                if(window.d3 === undefined || d3ckit === undefined) {
                    return setTimeout(function () {
                        app.layout.runSlideDeck(deckname); }, 300); }
                jt.log("runSlideDeck " + deckname);
                jt.out("d3ckitdiv", "");  //clear any previous cruft
                d3ckit.displaySettings().endfunc = app.layout.runSlideDeck;
                d3ckit.displaySettings().paused = false;
                ungrayKnownLinks();
                colorDeckLinkSpans(deckname, "gray", ["span", "slidesspan"]);
                app[deckname].run(true); } }
    },


    deckText: function (deckname) {
        var curridx = -1, html;
        if(!deckname) {
            return jt.log("deckText: no deckname"); }
        updateDeckIndexByName(deckname);
        curridx = slidedecks.idx - 1;
        if(jt.byId("d3ckitdiv")) {
            jt.out("d3ckitdiv", "");
            ungrayKnownLinks();
            colorDeckLinkSpans(deckname, "gray", "textspan");
            if(curridx >= 0 && curridx < slidedecks.names.length) {
                html = ["div", {cla: "decktextdiv"},
                        slidedecks.textblocks[curridx]];
                jt.out("d3ckitdiv", jt.tac2html(html)); } }
    },


    runAnime: function () {
        var href, js;
        if(jt.byId("d3ckitdiv")) { //have display space for "about" animation
            if(!app.intro) {
                href = window.location.href;
                if(href.indexOf("#") > 0) {
                    href = href.slice(0, href.indexOf("#")); }
                if(href.indexOf("?") > 0) {
                    href = href.slice(0, href.indexOf("?")); }
                if(!href.endsWith("/")) {
                    href += "/"; }
                if(typeof d3 === "undefined") {  //mac ff requires typeof
                    js = document.createElement("script");
                    //js.async = true;
                    js.type = "text/javascript";
                    js.src = href + "js/d3.v3.min.js?v=161106";
                    document.body.appendChild(js); }
                if(typeof d3ckit === "undefined") {  //mac ff requires typeof
                    js = document.createElement("script");
                    //js.async = true;
                    js.type = "text/javascript";
                    js.src = href + "js/static/d3ckit.js?v=161106";
                    document.body.appendChild(js); }
                jt.loadAppModules(app, ["js/static/intro"], href, 
                                  app.layout.runAnime, 
                                  jt.ts("?cb=", "minute")); }
            else { //app.intro loaded
                jt.out("d3ckitdiv", "");  //clear any previous cruft
                app.intro.run(true, app.layout.closeAnime); } }
    },


    closeAnime: function () {
        var html;
        app.intro.furl();
        html = ["div", {style: "font-size:x-small;" + 
                               "padding:0px 0px 8px 0px;"},
          [["a", {href: "#replay", onclick: jt.fs("app.layout.runAnime()")},
            "REPLAY"],
           " | ",
           ["a", {href: "#origin", 
                  onclick: jt.fs("app.layout.displayDoc('docs/origin.html')")},
            "ORIGIN"],
           " | ",
           ["a", {href: "#intro",
                  onclick: jt.fs("window.open('" + 
              "https://membic.wordpress.com/2016/02/17/introducing-membic')")},
            "INTRODUCTION"]]];
        setTimeout(function () {
            jt.out("d3ckitdiv", jt.tac2html(html)); });
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
                       setTimeout(app.layout.runSlideDeck, 50); },
                   function (ignore /*code*/, errtxt) {
                       displayDocContent(url, errtxt, overlay); },
                   jt.semaphore("layout.displayDoc"));
    },


    docLinkClick: function (event) {
        var src, url;
        jt.evtend(event);
        src = event.target || event.srcElement;
        if(src) {
            url = convertDocRef(src.href);
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


    queueDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId("dlgdiv");
        if(dlgdiv.style.visibility === "visible") {
            dlgqueue.push({coords: coords, html: html, 
                           initf: initf, visf: visf}); }
        else {
            app.layout.openDialog(coords, html, initf, visf); }
    },


    //clobbers existing dialog if already open
    openDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId("dlgdiv");
        app.layout.cancelOverlay();  //close overlay if it happens to be up
        //window.scrollTo(0,0);  -- makes phone dialogs jump around. Don't.
        coords = coords || {};  //default x and y separately
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 100);
        coords.y = coords.y || 60;  //default y if not specified
        if(coords.x > (app.winw / 2)) {
            coords.x = 20; }  //display too tight, use default left pos
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


    closeDialog: function () {
        var dlg;
        jt.out("dlgdiv", "");
        jt.byId("dlgdiv").style.visibility = "hidden";
        app.onescapefunc = app.escapefuncstack.pop();
        if(dlgqueue.length > 0) {
            dlg = dlgqueue.pop();
            app.layout.openDialog(dlg.coords, dlg.html, dlg.initf, dlg.visf); }
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
        var coords = null, elem = jt.byId(domid);
        if(elem) {
            coords = jt.geoPos(elem);
            if(xadj) {
                coords.x += xadj; }
            if(yadj) {
                coords.y += yadj; } }
        return coords;
    },


    scrollToVisible: function (domid) {
        var elem, pos;
        elem = jt.byId(domid);
        if(elem) {
            pos = jt.geoPos(elem);
            if(pos.y > 0.8 * app.winh) {
                window.scroll(0, pos.y); } }
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
        if(coords.x > (app.winw / 2)) {
            coords.x = 20; }  //display too tight, just indent a bit
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


    //Search for hashtags and return a CSV of any found in the text or
    //in the descriptive fields of the referenced themes.  Themes are
    //not loaded if they are not cached.
    hashtagsCSV: function (text, ctmids) {
        var hashes = "", matcharray, matchAndTest, regexp = /#\w+/g;
        text = text || "";
        ctmids = ctmids || "";
        ctmids.csvarray().forEach(function (ctmid) {
            var ref = app.lcs.getRef("coop", ctmid);
            if(ref.coop) {
                text += ref.coop.name + " " + ref.coop.description;
                if(ref.coop.hashtag) {
                    text += "#" + ref.coop.hashtag; } }
            else {
                if(app.coopnames[ctmid]) {
                    text += " " + app.coopnames[ctmid]; }
                if(app.cooptags[ctmid]) {
                    text += "#" + app.cooptags[ctmid]; } } });
        matchAndTest = function () {
            matcharray = regexp.exec(text);
            return matcharray; };
        while(matchAndTest()) {
            hashes = hashes.csvappend(matcharray[0].slice(1)); }
        return hashes;
    },


    shareDivHTML: function (extraButtonHTML) {
        var html;
        extraButtonHTML = extraButtonHTML || "";
        html = ["div", {cla: "a2a_kit a2a_kit_size_32 a2a_default_style",
                        id: "a2abdiv"},
                [["a", {cla: "a2a_dd",
                        href: "https://www.addtoany.com/share_save"}],
                 ["a", {cla: "a2a_button_tumblr"}],
                 ["a", {cla: "a2a_button_pinterest"}],
                 //["a", {cla: "a2a_button_google_plus"}],
                 ["a", {cla: "a2a_button_facebook"}],
                 ["a", {cla: "a2a_button_twitter"}],
                 extraButtonHTML]];
        return html;
    },


    showShareButtons: function (title, url, tags, text) {
        var js, hts = "";
        tags = tags || "";
        tags.csvarray().forEach(function (tag) {
            if(!tag.startsWith("#")) {
                tag = "#" + tag.trim(); }
            hts = hts.csvappend(tag); });
        hts = hts? " " + hts : "";
        a2a_config.linkname = title;
        a2a_config.linkurl = url;
        a2a_config.templates = {
            //The link title gets reconstructed from the url when
            //displayed, so don't take up space here with that.
            //Most important thing is why it was memorable.
            twitter: text + hts + " ${link}" };
        try {
            if(!addToAnyScriptLoaded) {
                //the script executes on load, so nothing left to do after
                //adding the script tag to the document
                js = document.createElement("script");
                //js.async = true;
                js.type = "text/javascript";
                js.src = "//static.addtoany.com/menu/page.js";
                document.body.appendChild(js);
                jt.log("addtoany script loaded");
                addToAnyScriptLoaded = true; }
            else {
                //reinitialize the sharing display via the API
                jt.log("resetting addtoany config variables and calling init");
                a2a.init("page"); }
        } catch(e) {
            jt.log("shareViaAddToAny failed: " + e);
        }
        setTimeout(function () {
            //checking a2a_config === undefined does not work mac ff 42.0
            //so regardless of what jslint sez, this needs to stay..
            if(typeof a2a_config === "undefined") {  //mac ff requires typeof
                jt.out("a2abdiv", "Browser history must be enabled for share buttons"); } }, 3500);
    },


    formatMembics: function (membics, format) {
        var txt = "", keys = [];
        membics = membics || [];
        format = format || "JSON";
        switch(format) {
        case "JSON":
            txt = JSON.stringify(membics);
            break;
        case "TSV":
            if(membics.length) {
                keys = Object.keys(membics[0]);  //use same keys for all
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
            break; }
        return txt;
    },


    setSiteRoot: function (sr) {
        siteroot = sr;
    },
    getSiteRoot: function () {
        return siteroot;
    }


};  //end of returned functions
}());

