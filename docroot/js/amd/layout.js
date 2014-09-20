/*global window: false, document: false, setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4, regexp: true */

app.layout = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var topextra = 12 + 20,  //topsectiondiv shadow + appspacediv padding
        topPaddingAndScroll = 250 + topextra,   //topsectiondiv height
        dndState = null,
        dlgqueue = [],
        slides = [ "promo_cycle.png",
                   "promo_balloons2.png",
                   "promo_list.png" ],
        slideindex = -1,
        slideslot = -1,
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
            " or <a href=\"mailto:support@fgfweb.com\">email support.");
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
        app.layout.openDialog({x:20, y:60}, html);
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
        var viewport;
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
        //jt.out('dimspan', String(app.winw) + "x" + app.winh);
        if(window.screen && window.screen.width && window.screen.width > 700) {
            viewport = document.querySelector("meta[name=viewport]");
            viewport.setAttribute("content", 
                                  "width=device-width, initial-scale=1.0"); }
        //jt.out('dimspan', "window.screen.width:" + window.screen.width);
    },


    fixTextureCover = function () {
        var altimg;
        if(jt.isLowFuncBrowser()) { //decent css support is missing, fall back
            //texturePaper.png is 256x192
            //setting backgroundSize to a scaled up fixed size has no effect
            //jt.byId('bodyid').style.backgroundSize = "2048px 1536px;";
            //scaled up image either too large or too pixelated for use
            //altimg = "url('../img/texturePaperBig.png')";
            altimg = "url('../img/blank.png')";
            jt.byId('bodyid').style.backgroundImage = altimg;
            jt.byId('dlgdiv').style.backgroundColor = "#EEEEEE"; }
    },


    //Set the src of the current img to the next slide and change its
    //opacity to 1.  Then change the opacity of the prev img to 0.  If
    //someone is logging in automatically (the most common case), then
    //preloading images is extra overhead so not doing that.
    slideshow = function (firstrun) {
        var sdiv, html, previmg, img;
        sdiv = jt.byId('slidesdiv');
        if(sdiv && jt.byId('userin') && jt.byId('passin')) {
            if(jt.isLowFuncBrowser()) {
                jt.log("slideshow isLowFuncBrowser so no fades");
                if(firstrun) {
                    slideindex = 0; }
                html = ["img", {src: "img/slides/" + slides[slideindex],
                                cla: "slideimglowfuncb"}];
                jt.out('slidesdiv', jt.tac2html(html));
                slideindex = (slideindex + 1) % slides.length; }
            else {  //use nice opacity transitions
                if(!firstrun) {
                    jt.log("    fading introslide" + slideslot + ": " + 
                            "img/slides/" + slides[slideindex]);
                    previmg = jt.byId("introslide" + slideslot);
                    if(!previmg) {  //probably logged in in the interim
                        return; }
                    setTimeout(function () {
                        jt.log("displaying blank to avoid flashing previous");
                        //timeout value must be > css transition time
                        previmg.src = "img/slides/blank.png"; }, 1200);
                    previmg.style.opacity = 0; }  //fade out
                slideslot = (slideslot + 1) % 2;
                slideindex = (slideindex + 1) % slides.length;
                jt.log("displaying introslide" + slideslot + ": " + 
                        "img/slides/" + slides[slideindex]);
                img = jt.byId("introslide" + slideslot);
                if(!img) {  //probably logged in in the interim
                    return; }
                img.src = "img/slides/" + slides[slideindex];
                img.style.opacity = 1; }
            if(!slides[slideindex] || slides[slideindex] === "blank.png") {
                setTimeout(slideshow, 2000); }
            else {
                setTimeout(slideshow, 3600); } }
        else {  //slideshow is over
            if(jt.byId('slidesdiv')) {
                jt.out('slidesdiv', ""); } }
    },


    adjustLogoAndSlides = function (logodim, slidedim, sep) {
        jt.byId('topsectiondiv').style.height = 
            String(Math.max(logodim.h, slidedim.h)) + "px";
        //#logodiv position:absolute
        jt.out('logodiv', jt.tac2html(
            ["img", {src: "img/fgfweb.png", id: "logoimg",
                     style: "width:" + logodim.w + "px;" + 
                            "height:" + logodim.h + "px;"}]));
        jt.setdims('logodiv', logodim);
        jt.setdims('introverviewtaglinediv', {y: logodim.h});
        //slides
        slidedim.x = 0;
        if(sep) {
            slidedim.x = logodim.w + sep; }
        else { //adjust slides down to cover the bottom loop of the 'y'
            slidedim.y = 11; }
        jt.setdims('slidesdiv', slidedim);
        jt.setdims('introslide0', slidedim);
        jt.setdims('introslide1', slidedim);
        //remove smooth slide opacity transitions if transitions not supported
        if(!jt.isLowFuncBrowser()) {
            jt.byId('introslide0').style.opacity = 0;
            jt.byId('introslide1').style.opacity = 0; }
    },


    initSlideshow = function () {
        var logodim = {w: 460, h: 227}, slidedim = {w: 522, h: 250},
            minsep = 40;
        if(app.winw > logodim.w + slidedim.w + minsep) {  //space available
            adjustLogoAndSlides(logodim, slidedim,
                Math.round((app.winw - (logodim.w + slidedim.w)) / 2)); }
        else {  //go with mobile size images
            logodim = {w: 320, h: 158};
            slidedim = {w: 320, h: 153};
            if(app.winw > logodim.w + slidedim.w + minsep) {
                adjustLogoAndSlides(logodim, slidedim,
                    Math.round((app.winw - (logodim.w + slidedim.w)) / 2)); }
            else {
                slides.unshift("blank.png");  //reveal logo in slide cycles
                adjustLogoAndSlides(logodim, slidedim, 0); } }
        slideshow(true);
    },


    setSoftFocus = function () {
        var revid, focobj;
        if(app.review.getCurrentReview()) {
            revid = "lihr" + jt.instId(app.review.getCurrentReview());
            focobj = jt.byId(revid);
            if(focobj) {
                focobj.focus(); } }
    },


    currentContentHeight = function () {
        var ch, content, centerh, bottomnav;
        content = jt.byId("contentdiv").offsetHeight;
        centerh = jt.byId("centerhdiv").offsetHeight;
        bottomnav = jt.byId("bottomnav").offsetHeight;
        ch = content + centerh + bottomnav;
        return ch;
    },


    fullContentHeight = function () {
        var ch, filldiv, topdiv, contentdiv, target, leftmargin;
        findDisplayHeightAndWidth();
        //fill the bottom content so the footer text isn't too high up
        filldiv = jt.byId("contentfill");
        ch = currentContentHeight();
        target = app.winh - topPaddingAndScroll; 
        if(ch < target) {
            filldiv.style.height = (target - ch) + "px"; }
        else {  //not filling, just leave a little separator space
            filldiv.style.height = "16px"; }
        //adjust the topdiv and content width so it looks reasonable
        target = app.winw;
        if(target > 850) {
            target -= 120; }  //margin padding
        topdiv = jt.byId('topdiv');
        if(topdiv) {
            topdiv.style.width = target + "px"; }
        contentdiv = jt.byId('contentdiv');
        if(contentdiv) {
            target = app.winw - jt.byId('rightcoldiv').offsetWidth;
            leftmargin = 0;
            if(target <= 320) {  //hard minimum phone size
                target = 316; }  //fudge pixels to avoid side scrolling
            if(target > 600) { //enough space to play with
                target -= 4;  //fudge pixels to avoid side scrolling
                leftmargin = Math.round(target * 0.1);
                leftmargin = Math.min(leftmargin, 100); }
            target -= leftmargin;
            //jt.out('dimspan', "lm:" + leftmargin + ", cd:" + target);
            contentdiv.style.width = target + "px";
            contentdiv.style.marginLeft = leftmargin + "px"; }
        setSoftFocus();
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
        jt.on(window, 'resize', fullContentHeight);
        app.layout.commonUtilExtensions();
        localDocLinks();
        fullContentHeight();
        fixTextureCover();
        initSlideshow();
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
    },


    fixTextureCover: function () {  //for static page support
        fixTextureCover();
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
            app.layout.initContentDivAreas();
            app.profile.updateHeading();
            app.activity.updateHeading();
            app.review.updateHeading(); }
    },


    adjust: function () {
        fullContentHeight();
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
        if(jt.byId('dlgdiv').style.visibility === "visible") {
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
        var state, dlg;
        jt.out('dlgdiv', "");
        jt.byId('dlgdiv').style.visibility = "hidden";
        state = app.history.currState();
        if(!state || !state.view) {
            navmode = "activity"; }
        else {
            navmode = state.view; }
        app.layout.updateNavIcons();
        app.layout.adjust();
        app.onescapefunc = app.escapefuncstack.pop();
        if(dlgqueue.length > 0) {
            dlg = dlgqueue.pop();
            app.layout.openDialog(dlg.coords, dlg.html, dlg.initf, dlg.visf); }
    },


    setTopPaddingAndScroll: function (val) {
        topPaddingAndScroll = val + topextra;
    },


    dragstart: function (event) {
        if(event) {
            dndState = { domobj: event.target,
                         screenX: event.screenX,
                         screenY: event.screenY };
            jt.log("dragstart " + dndState.domobj + " " + 
                    dndState.screenX + "," + dndState.screenY);
            if(event.dataTransfer && event.dataTransfer.setData) {
                event.dataTransfer.setData("text/plain", "general drag"); } }
    },


    dragend: function (event) {
        if(event && dndState) {
            jt.log("dragend called");
            dndState.ended = true; }
    },


    bodydragover: function (event) {
        if(event && dndState && (!dndState.ended || dndState.dropped)) {
            //jt.log("dndOver preventing default cancel");
            event.preventDefault(); }
    },


    bodydrop: function (event) {
        var diffX, diffY, domobj, currX, currY;
        jt.log("bodydrop called");
        if(event && dndState) {
            dndState.dropped = true;
            diffX = event.screenX - dndState.screenX;
            diffY = event.screenY - dndState.screenY;
            domobj = dndState.domobj;
            jt.log("dropping " + domobj + " moved " + diffX + "," + diffY);
            currX = domobj.offsetLeft;
            currY = domobj.offsetTop;
            domobj.style.left = String(currX + diffX) + "px";
            domobj.style.top = String(currY + diffY) + "px";
            event.preventDefault();
            event.stopPropagation(); }
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
        pen = app.pen.currPenRef().pen;
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
        odiv.style.backgroundColor = app.skinner.lightbg();
        odiv.style.visibility = "visible";
        app.onescapefunc = app.layout.cancelOverlay;
        setTimeout(function () {
            jt.byId("meritimg").src = nsrc; }, 450);
        setTimeout(function () {
            app.profile.writeNavDisplay(app.pen.currPenRef().pen,
                                        null, "nosettings");
            meritactive = false;
            app.layout.cancelOverlay(); }, 2800);
    },


    updateNavIcons: function (mode) {
        var penref = app.pen.currPenRef();
        if(mode) {
            navmode = mode; }
        jt.out('recentacthdiv', app.activity.activityLinkHTML(navmode));
        jt.out('rememberedhdiv', app.activity.rememberedLinkHTML(navmode));
        jt.out('writerevhdiv', app.review.reviewLinkHTML(navmode));
        if(penref && penref.pen) {
            app.profile.updateTopActionDisplay(penref.pen, navmode); }
    },


    currnavmode: function () {
        return navmode;
    },


    headingout: function (html) {
        jt.out('centerhdiv', html);
        jt.byId('centerhdivtd').style.height = 
            String(jt.byId('centerhdiv').offsetHeight) + "px";
        jt.byId('centerhdivtd').style.maxHeight = 
            String(jt.byId('centerhdiv').offsetHeight) + "px";
        app.layout.adjust();
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


    cancelOverlay: function () {
        var odiv = jt.byId('overlaydiv');
        if(odiv) {
            jt.out('overlaydiv', "");
            odiv.style.visibility = "hidden"; }
        app.onescapefunc = null;
    },


    openOverlay: function (coords, html, initf, visf) {
        var odiv = jt.byId('overlaydiv');
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
        html = [["div", {id: "closeline"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.cancelOverlay()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                html];
        jt.out('overlaydiv', jt.tac2html(html));
        if(initf) {
            initf(); }
        odiv.style.backgroundColor = app.skinner.lightbg();
        odiv.style.visibility = "visible";
        if(visf) {
            visf(); }
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
    },


    //Prepends the site root to image and other resource links in the
    //given html.  Image links in the given html are relative to the
    //actual site root, do not start with a "/", and do not have any
    //".."  relative addressing in them. 
    rootLink: function (html) {
        var idx;
        if(!siteroot) {
            siteroot = "http://www.fgfweb.com";
            idx = window.location.href.search(/:\d080/);
            if(idx >= 0) {
                siteroot = window.location.href.slice(idx);    //:8080/blah
                idx = siteroot.indexOf("/");
                if(idx >= 0) {
                    siteroot = siteroot.slice(0, idx); }       //:8080
                siteroot = "http://localhost" + siteroot; } }
        html = html.replace(/img\//g, siteroot + "/img/");
        html = html.replace(/revpic\?/g, siteroot + "/revpic?");
        html = html.replace(/profpic\?/g, siteroot + "/profpic?");
        //fix other known relative cases
        html = html.replace(/..\/statrev/g, siteroot + "/statrev");
        html = html.replace(/..\/\?/g, siteroot + "?");
        return html;
    },


    showEmbed: function (scripturl, divid, embfuncallstr) {
        var embedtxt, html;
        embedtxt = "<div id=\"" + divid + "\"" + 
            " style=\"background:#ddd;width:70%;margin-left:10%;\"></div>\n" +
            "<script src=\"" + siteroot + "/" + scripturl + "\"></script>\n" +
            "<script src=\"" + siteroot + "/js/embed.js\"></script>\n" +
            "<script>\n" +
            "  fgfwebEmbed." + embfuncallstr + ";\n" +
            "</script>\n";
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "To embed this content into another web page," + 
                  " copy and paste this code:"],
                 ["textarea", {id: "tascr", cla: "shoutout"}],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.layout.closeDialog()")},
                   "OK"]]]];
        app.layout.openDialog({y:140}, jt.tac2html(html), null,
                              function () {
                                  var tascr = jt.byId('tascr');
                                  tascr.style.width = "95%";
                                  tascr.style.marginLeft = "2%";
                                  tascr.value = embedtxt;
                                  jt.byId('tipok').focus(); });
    }


};  //end of returned functions
}());

