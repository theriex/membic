/*global window: false, document: false, setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

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


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayDocContent = function (url, html) {
        var output = [], bodyidx;
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        bodyidx = html.indexOf("<body>");
        if(bodyidx > 0) {
            html = html.slice(bodyidx + "<body>".length,
                              html.indexOf("</body")); }
        output.push(["div", {id: "closeline"},
                     ["a", {id: "closedlg", href: "#close",
                            onclick: jt.fs("app.layout.closeDialog()")},
                      "&lt;close&nbsp;&nbsp;X&gt;"]]);
        output.push(html);
        html = jt.tac2html(output);
        jt.out('dlgdiv', html);
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
                setTimeout(slideshow, 2600); } }
        else {  //slideshow is over
            if(jt.byId('slidesdiv')) {
                jt.out('slidesdiv', ""); } }
    },


    adjustLogoAndSlides = function (logodim, slidedim, sep) {
        jt.byId('topsectiondiv').style.height = 
            String(Math.max(logodim.h, slidedim.h)) + "px";
        //#logodiv position:absolute
        jt.out('logodiv', jt.tac2html(
            ["img", {src: "img/wdydfun.png", id: "logoimg",
                     style: "width:" + logodim.w + "px;" + 
                            "height:" + logodim.h + "px;"}]));
        jt.setdims('logodiv', logodim);
        //slides
        slidedim.x = 0;
        if(sep) {
            slidedim.x = logodim.w + sep; }
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
                leftmargin = Math.round(target * 0.1);
                leftmargin = Math.min(leftmargin, 100); }
            target -= leftmargin;
            //jt.out('dimspan', "lm:" + leftmargin + ", cd:" + target);
            contentdiv.style.width = target + "px";
            contentdiv.style.marginLeft = leftmargin + "px"; }
        setSoftFocus();
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        jt.on(window, 'resize', fullContentHeight);
        localDocLinks();
        fullContentHeight();
        fixTextureCover();
        initSlideshow();
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
        //window.scrollTo(0,0);  -- makes phone dialogs jump around
        if(coords) {
            if(!coords.x) {
                coords.x = Math.min(Math.round(app.winw * 0.1), 100); }
            if(coords.x > (app.winw / 2)) {
                coords.x = 20; }  //display too tight, use default left pos
            dlgdiv.style.left = String(coords.x) + "px";
            dlgdiv.style.top = String(coords.y) + "px"; }
        else {
            dlgdiv.style.left = "20px";
            dlgdiv.style.top = "60px"; }
        app.escapefuncstack.push(app.onescapefunc);
        app.onescapefunc = app.layout.closeDialog;
        jt.out('dlgdiv', html);
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


    badgeImgSrc: function (pen, type, count) {
        if(!count && pen.top20s && pen.top20s[type]) {
            count = pen.top20s[type].length; }
        if(!count) {
            return ""; }
        if(count >= 20) {
            return "img/merit/Merit" + type.capitalize() + "20.png"; }
        if(count >= 10) {
            return "img/merit/Merit" + type.capitalize() + "10.png"; }
        if(count >= 5) {
            return "img/merit/Merit" + type.capitalize() + "5.png"; }
        return "img/merit/Merit" + type.capitalize() + "1.png";
    },


    //The current pen top20s have NOT been updated to reflect this
    //review yet.  The overlaydiv is available for use.
    runMeritDisplay: function (rev) {
        var pen, top, revcount, msg, psrc, nsrc, html, odiv;
        if(meritactive) {
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
                ["div", {cla: "headingtxt"},
                 ["img", {id: "meritimg", src: psrc}]]];
        jt.out('overlaydiv', jt.tac2html(html));
        odiv = jt.byId('overlaydiv');
        odiv.style.left ="300px";
        odiv.style.top = "190px";
        odiv.style.backgroundColor = app.skinner.darkbg();
        odiv.style.visibility = "visible";
        app.onescapefunc = app.cancelOverlay;
        setTimeout(function () {
            jt.byId("meritimg").src = nsrc; }, 450);
        setTimeout(function () {
            meritactive = false;
            app.cancelOverlay(); }, 2800);
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
    }


};  //end of returned functions
}());

