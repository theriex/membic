/*global window, document, app, jt, a2a, a2a_config */

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


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    replaceDocComments = function (html) {
        var dst, txt;
        html = html.replace(/\.<!--\ \$ABOUTCONTACT\ -->/g,
            " or <a href=\"" + app.suppemail + "\">email us</a>.");
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


    displayDocContent = function (url, html) {
        var idx, bodystart = "<body>";
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        idx = html.indexOf(bodystart);
        if(idx > 0) {
            html = html.slice(idx + bodystart.length,
                              html.indexOf("</body")); }
        html = replaceDocComments(html);
        //create title from capitalized doc file name
        idx = url.lastIndexOf("/");
        if(idx > 0) {
            url = url.slice(idx + 1); }
        idx = url.indexOf(".");
        if(idx > 0) {
            url = url.slice(0, idx); }
        url = url.capitalize();
        //title overrides
        if(url === "About" || url === "Howto" || url === "Themepage") {
            url = ""; }
        //display content
        html = app.layout.dlgwrapHTML(url, html);
        //openDialog deals with the y scroll offset as needed.
        app.layout.openDialog({x: 20, y: 40}, html);
        app.layout.crumbify();
    },


    //relative paths don't work when you are running file://...
    relativeToAbsolute = function (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    },


    attachDocLinkClick = function (node, link) {
        jt.on(node, "click", function (e) {
            jt.evtend(e);
            app.layout.displayDoc(link); });
    },


    //faster to grab all links rather than iterating through bottomnav
    localDocLinks = function () {
        var i, href, nodes = document.getElementsByTagName('a');
        //nodes is an HTMLCollection, not an array.  Basic iteration only.
        for(i = 0; nodes && nodes.length && i < nodes.length; i += 1) {
            href = nodes[i].href;
            //href may have been resolved from relative to absolute...
            if(href && href.indexOf("docs/") >= 0) {
                attachDocLinkClick(nodes[i], href); } }
    },


    //Minimum cell phone width is assumed to be 320px.
    findDisplayHeightAndWidth = function () {
        //most browsers (FF, safari, chrome, 
        if(window.innerWidth && window.innerHeight) {
            app.winw = window.innerWidth;
            app.winh = window.innerHeight; }
        //alternate that must have been useful at some point?
        else if(document.compatMode === 'CSS1Compat' &&
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
        //jt.out('bottomnav', String(app.winw) + "x" + app.winh);
    },


    closeModalSeparator = function () {
        var mdiv = jt.byId('modalseparatordiv');
        mdiv.style.width = "1px";
        mdiv.style.height = "1px";
    },


    openModalSeparator = function () {
        var mdiv = jt.byId('modalseparatordiv');
        mdiv.style.width = String(app.winw) + "px";
        mdiv.style.height = String(app.winh) + "px";
    },


    shareServiceHTML = function (divid, url, desc, imgsrc) {
        var linkattr, html;
        linkattr = {href: url, title: desc};
        if(url.indexOf("mailto") < 0) {
            linkattr.onclick = "window.open('" + url + "');return false;"; }
        html = ["div", {id: divid, cla: "sharebuttondiv"},
                ["a", linkattr,
                 ["img", {cla: "shsico", alt: desc, src: imgsrc}]]];
        return html;
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
            body = jt.byId('bodyid');
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
            if(idval && typeof idval === 'string' && idval !== "0") {
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
        html = ["div", {cla: "revtypesdiv", id: "revtypesdiv"}, 
                html];
        jt.out("headingdivcontent", jt.tac2html(html));
        if(callbackf === -1) {
            typestate.callbackf(typestate.typename); }
    },


    displayDoc: function (url) {
        var html = "Fetching " + url + " ...";
        url = url || "docs/howto.html";
        app.layout.openDialog(null, html);
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        url += jt.ts("?cb=", "day");
        jt.request('GET', url, null,
                   function (resp) {
                       displayDocContent(url, resp); },
                   function (ignore /*code*/, errtxt) {
                       displayDocContent(url, errtxt); },
                   jt.semaphore("layout.displayDoc"));
    },


    crumbify: function (index) {
        var i, cb, cf, sections, cht;
        index = index || 0;
        cb = jt.byId('crumbsbackdiv');
        cf = jt.byId('crumbsforwarddiv');
        sections = document.getElementsByClassName("docsecdiv");
        if(!cb || !cf || !sections || !sections.length) {
            return; }  //nothing to do
        for(i = 0; i < sections.length; i += 1) {
            sections[i].style.display = "none"; }
        sections[index].style.display = "block";
        cht = cb.children[0].outerHTML;  //origin anchor link from doc
        for(i = 0; i < index; i += 1) {
            cht += " ";
            cht += jt.tac2html(
                ["a", {href: "#" + jt.canonize(sections[i].title),
                       onclick: jt.fs("app.layout.crumbify(" + i + ")")},
                 [["img", {src: "img/arrow18left.png"}],
                  " " + sections[i].title]]); }
        cb.innerHTML = cht;
        cht = "";
        for(i = index + 1; i < sections.length; i += 1) {
            cht += " ";
            cht += jt.tac2html(
                ["a", {href: "#" + jt.canonize(sections[i].title),
                       onclick: jt.fs("app.layout.crumbify(" + i + ")")},
                 [["img", {src: "img/arrow18right.png"}],
                  " " + sections[i].title]]); }
        cf.innerHTML = cht;
    },


    writeDialogContents: function (html) {
        jt.out('dlgdiv', jt.tac2html(
            ["div", {id: "dlgborderdiv"},
             ["div", {id: "dlginsidediv"}, 
              html]]));
    },


    queueDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId('dlgdiv');
        if(dlgdiv.style.visibility === "visible") {
            dlgqueue.push({coords: coords, html: html, 
                           initf: initf, visf: visf}); }
        else {
            app.layout.openDialog(coords, html, initf, visf); }
    },


    //clobbers existing dialog if already open
    openDialog: function (coords, html, initf, visf) {
        var dlgdiv = jt.byId('dlgdiv');
        app.layout.cancelOverlay();  //close overlay if it happens to be up
        //window.scrollTo(0,0);  -- makes phone dialogs jump around. Don't.
        coords = coords || {};  //default x and y separately
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 100);
        coords.y = coords.y || 60;  //default y if not specified
        if(coords.x > (app.winw / 2)) {
            coords.x = 20; }  //display too tight, use default left pos
        coords.y = coords.y + jt.byId('bodyid').scrollTop;  //logical height
        dlgdiv.style.left = String(coords.x) + "px";
        dlgdiv.style.top = String(coords.y) + "px";
        if(!app.escapefuncstack) {
            app.escapefuncstack = []; }
        app.escapefuncstack.push(app.onescapefunc);
        app.onescapefunc = app.layout.closeDialog;
        app.layout.writeDialogContents(html);
        if(initf) {
            initf(); }
        jt.byId('dlgdiv').style.visibility = "visible";
        if(visf) {
            visf(); }
    },


    closeDialog: function () {
        var dlg;
        jt.out('dlgdiv', "");
        jt.byId('dlgdiv').style.visibility = "hidden";
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
        odiv = jt.byId('overlaydiv');
        if(odiv) {
            jt.out('overlaydiv', "");
            odiv.style.visibility = "hidden"; }
        if(!preserveEscape) {
            app.onescapefunc = null; }
    },


    openOverlay: function (coords, html, initf, visf, closefstr) {
        var odiv;
        openModalSeparator();
        odiv = jt.byId('overlaydiv');
        coords = coords || {};
        coords.x = coords.x || Math.min(Math.round(app.winw * 0.1), 70);
        coords.y = coords.y || 200;
        if(coords.x > (app.winw / 2)) {
            coords.x = 20; }  //display too tight, just indent a bit
        coords.y = coords.y + jt.byId('bodyid').scrollTop;  //logical height
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
        jt.out('overlaydiv', jt.tac2html(html));
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
            else if(app.coopnames[ctmid]) {
                text += " " + app.coopnames[ctmid]; } });
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
                 ["a", {cla: "a2a_button_wordpress"}],
                 ["a", {cla: "a2a_button_pinterest"}],
                 //["a", {cla: "a2a_button_google_plus"}],
                 ["a", {cla: "a2a_button_facebook"}],
                 ["a", {cla: "a2a_button_twitter"}],
                 extraButtonHTML]];
        return html;
    },


    showShareButtons: function (title, url, tags, text) {
        var js;
        tags = tags? " " + tags : "";
        text = text? " " + text : "";
        a2a_config.linkname = title;
        a2a_config.linkurl = url;
        a2a_config.templates = {
            twitter: "${title} ${link}" + tags + text };
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
                a2a.init('page'); }
        } catch(e) {
            jt.log("shareViaAddToAny failed: " + e);
        }
        setTimeout(function () {
            //checking a2a_config === undefined does not work mac ff 42.0
            //so regardless of what jslint sez, this needs to stay..
            if(typeof a2a_config === 'undefined') {  //mac ff requires typeof
                jt.out('a2abdiv', "Browser history must be enabled for share buttons"); } }, 3500);
    },


    shareLinksHTML: function (url, desc, reloff) {
        var html;
        reloff = reloff || "";
        html = [
            shareServiceHTML(
                "facebookdiv", 
                "http://www.facebook.com/sharer/sharer.php?u=" + 
                    jt.enc(url) + "&t=" + jt.enc(desc.capitalize()),
                "Post " + desc + " to your wall",
                reloff + "img/f_logo.png"),
            shareServiceHTML(
                "twitterdiv",
                "https://twitter.com/intent/tweet?text=" + 
                    jt.enc(desc.capitalize()) + "&url=" + jt.enc(url),
                "Tweet " + desc,
                reloff + "img/tw_logo.png"),
            shareServiceHTML(
                "gplusdiv",
                "https://plus.google.com/share?url=" + jt.enc(url),
                "Plus " + desc,
                "https://www.gstatic.com/images/icons/gplus-32.png"),
            shareServiceHTML(
                "emaildiv",
                "mailto:?subject=" + jt.dquotenc(desc.capitalize()) +
                    "&body=" + jt.dquotenc(desc.capitalize() + "\n\n" +
                                           url + "\n"),
                "Email " + desc,
                reloff + "img/email.png")];
        return jt.tac2html(html);
    },


    setSiteRoot: function (sr) {
        siteroot = sr;
    },
    getSiteRoot: function () {
        return siteroot;
    }


};  //end of returned functions
}());

