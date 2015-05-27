/*global window: false, document: false, setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4, regexp: true */

app.layout = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var dndState = null,
        typestate = {callback: null, typename: "all"},
        dlgqueue = [],
        meritactive = false,
        navmode = "activity",
        siteroot = "",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayDocContent = function (url, html) {
        var idx;
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        idx = html.indexOf("<body>");
        if(idx > 0) {
            html = html.slice(idx + "<body>".length,
                              html.indexOf("</body")); }
        html = html.replace(/\.<!-- \$ABOUTCONTACT -->/g,
            " or <a href=\"mailto:membicsystem@gmail.com\">email us</a>.");
        //create title from capitalized doc file name
        idx = url.lastIndexOf("/");
        if(idx > 0) {
            url = url.slice(idx + 1); }
        idx = url.indexOf(".");
        if(idx > 0) {
            url = url.slice(0, idx); }
        url = url.capitalize();
        //title overrides
        if(url === "About") {
            url = ""; }
        //display content
        html = app.layout.dlgwrapHTML(url, html);
        app.layout.openDialog({x: 20, y: window.pageYOffset + 40}, html);
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
        var i, nodes, node, href;
        nodes = document.getElementsByTagName('a');
        for(i = 0; nodes && i < nodes.length; i += 1) {
            node = nodes[i];
            href = node.href;
            //href may have been resolved from relative to absolute...
            if(href && href.indexOf("docs/") >= 0) {
                attachDocLinkClick(node, href); } }
    },


    //logo + 5 nav buttons with padding == 460 + (5 * 60) == 760
    //standard phone width of 480 zoomed to .6 == 800
    //going with 800 as the standard minimum display width, zoom accordingly
    //The max width is primarily driven by index.html viewport meta tag.
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
        findDisplayHeightAndWidth();
        app.layout.commonUtilExtensions();
        localDocLinks();
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
                errtxt = errtxt.replace(/group \d+/g, function (grpref) {
                    return jt.makelink("?view=group&groupid=" + 
                                       grpref.slice(5)); }); }
            return actverb + " failed code " + code + ": " + errtxt;
        };
    },


    getType: function () {
        return typestate.typename;
    },


    displayTypes: function (callbackf, typename) {
        var revtypes, i, rt, clt, html = [];
        if(typeof callbackf === "function") {
            typestate.callbackf = callbackf; }
        if(typename) {
            if(typename === typestate.typename && callbackf === -1) {
                typestate.typename = "all"; }  //toggle selection off...
            else {
                typestate.typename = typename; } }
        revtypes = app.review.getReviewTypes();
        for(i = 0; i < revtypes.length; i += 1) {
            rt = revtypes[i];
            clt = "reviewbadge";
            if(rt.type === typestate.typename) {
                clt = "reviewbadgesel"; }
            html.push(["a", {href: "#" + rt.type,
                             onclick: jt.fs("app.layout.displayTypes(-1,'" + 
                                            rt.type + "')")},
                       ["img", {cla: clt, src: "img/" + rt.img}]]); }
        html = ["div", {cla: "revtypesdiv", id: "revtypesdiv"}, 
                html];
        jt.out("headingdivcontent", jt.tac2html(html));
        if(callbackf === -1) {
            typestate.callbackf(typestate.typename); }
    },


    parseEmbeddedJSON: function (text) {  //for static page support
        var obj = null, jsonobj = JSON || window.JSON;
        if(!jsonobj) {
            jt.err("JSON not supported, please use a modern browser"); }
        text = text.trim();
        text = text.replace(/\n/g, "\\n");
        text = text.replace(/<a[^>]*\>/g, "");
        text = text.replace(/<\/a>/g, "");
        try {
            obj = jsonobj.parse(text);
        } catch(problem) {
            jt.err("Error parsing JSON: " + problem +
                   "\nPlease upgrade your browser");
        }
        return obj;
    },


    haveContentDivAreas: function () {
        return jt.byId('chead') && jt.byId('cmain');
    },


    initContentDivAreas: function () {
        var html = "<div id=\"chead\"> </div>" +
                   "<div id=\"cmain\"> </div>";
        jt.out('contentdiv', html);
    },


    //initialize the logged-in content display div areas.  Basically
    //contentdiv is subdivided into chead and cmain.
    initContent: function () {
        if(!app.layout.haveContentDivAreas()) {
            app.layout.initContentDivAreas(); }
    },


    displayDoc: function (url) {
        var html = "Fetching " + url + " ...";
        app.layout.openDialog(null, html);
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        jt.request('GET', url, null,
                   function (resp) {
                       displayDocContent(url, resp); },
                   function (code, errtxt) {
                       displayDocContent(url, errtxt); },
                   jt.semaphore("layout.displayDoc"));
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


    badgeDrawer: function (pen, type, count) {
        if(!count && pen.top20s && pen.top20s[type]) {
            count = pen.top20s[type].length; }
        if(count >= 20) {
            return 20; }
        if(count >= 10) {
            return 10; }
        if(count >= 5) {
            return 5; }
        return 1;
    },


    badgeImgSrc: function (pen, type, count) {
        if(!count && pen.top20s && pen.top20s[type]) {
            count = pen.top20s[type].length; }
        if(!count) {
            return ""; }
        return "img/merit/Merit" + type.capitalize() + 
            app.layout.badgeDrawer(pen, type, count) + ".png";
    },


    //The current pen top20s have NOT been updated to reflect this
    //review yet.  The overlaydiv is available for use.
    runMeritDisplay: function (rev, isnew) {
        var pen, top, revcount, msg, psrc, nsrc, html, odiv;
        if(meritactive || !isnew) {
            return; }
        meritactive = true;
        pen = app.pen.myPenName();
        top = [];
        if(pen.top20s && pen.top20s[rev.revtype]) {
            top = pen.top20s[rev.revtype]; }
        revcount = top.length + 1;  //top20s not updated yet...
        switch(revcount) {
        case 1: 
            psrc = app.layout.badgeImgSrc(pen, rev.revtype, 1);
            nsrc = app.layout.badgeImgSrc(pen, rev.revtype, 1);
            msg = "New Profile Badge!"; 
            break;
        case 5:
            psrc = app.layout.badgeImgSrc(pen, rev.revtype, 1);
            nsrc = app.layout.badgeImgSrc(pen, rev.revtype, 5);
            msg = "Upgraded Profile Badge!";
            break;
        case 10:
            psrc = app.layout.badgeImgSrc(pen, rev.revtype, 5);
            nsrc = app.layout.badgeImgSrc(pen, rev.revtype, 10);
            msg = "Upgraded Profile Badge!";
            break;
        case 20:
            psrc = app.layout.badgeImgSrc(pen, rev.revtype, 10);
            nsrc = app.layout.badgeImgSrc(pen, rev.revtype, 20);
            msg = "Upgraded Profile Badge!";
            break;
        default:  //skip interim displays
            meritactive = false; 
            return; }
        html = [["div", {cla: "headingtxt"},
                 msg],
                ["div", {id: "earnedmeritbadgegraphicdiv"},
                 ["img", {id: "meritimg", src: psrc}]]];
        jt.out('overlaydiv', jt.tac2html(html));
        odiv = jt.byId('overlaydiv');
        odiv.style.left ="300px";
        odiv.style.top = "190px";
        odiv.style.visibility = "visible";
        app.onescapefunc = app.layout.cancelOverlay;
        setTimeout(function () {
            jt.byId("meritimg").src = nsrc; }, 450);
        setTimeout(function () {
            meritactive = false;
            app.layout.cancelOverlay(); }, 2800);
    },


    currnavmode: function () {
        return navmode;
    },


    headingout: function (html) {
        jt.out('centerhdiv', html);
    },


    dlgwrapHTML: function (title, html) {
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, title],
                html];
        return jt.tac2html(html);
    },


    picUploadHTML: function (fupl) {
        var html;
        html = ["form", {action: fupl.endpoint,
                         enctype: "multipart/form-data", method: "post"},
                [jt.paramsToFormInputs(app.login.authparams()),
                 ["input", {type: "hidden", name: "_id", value: fupl.id}],
                 ["input", {type: "hidden", name: "penid", value: fupl.penid}],
                 ["input", {type: "hidden", name: "returnto",
                            value: jt.enc(window.location.href + 
                                          fupl.rethash)}],
                 ["table",
                  [["tr",
                    ["td", 
                     (fupl.notitle ? "" : "Upload " + fupl.type + " Pic")]],
                   ["tr",
                    ["td",
                     ["input", {type: "file", name: "picfilein",
                                id: "picfilein"}]]],
                   ["tr",
                    ["td", {align: "center"},
                     ["input", {type: "submit", id: "picfilesubmit",
                                value: "Upload"}]]]]]]];
        return html;
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


    picUpload: function (fupl) {
        var html;
        html = app.layout.picUploadHTML(fupl);
        app.layout.openOverlay({x: fupl.x || 70, y: fupl.y || 300},
                               html, null, 
                               function () {
                                   jt.byId('picfilein').focus(); });
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

