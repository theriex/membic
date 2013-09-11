/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l a y o u t
//
define([], function () {
    "use strict";

    var slides = [ "promo_cycle.png",
                   "promo_balloons2.png",
                   "promo_list.png" ],
        slideindex = -1,
        slideslot = -1,
        topextra = 12 + 20,  //topsectiondiv shadow + appspacediv padding
        topPaddingAndScroll = 250 + topextra,   //topsectiondiv height
        dndState = null,


    closeDialog = function () {
        app.out('dlgdiv', "");
        app.byId('dlgdiv').style.visibility = "hidden";
        app.layout.adjust();
        app.onescapefunc = null;
    },


    displayDocContent = function (url, html) {
        var bodyidx;
        if(!html || !html.trim()) {
            html = url + " contains no text"; }
        bodyidx = html.indexOf("<body>");
        if(bodyidx > 0) {
            html = html.slice(bodyidx + "<body>".length,
                              html.indexOf("</body")); }
        html = "<div id=\"closeline\">" +
          "<a id=\"closedlg\" href=\"#close\"" +
            " onclick=\"app.layout.closeDialog();return false\">" + 
                 "&lt;close&nbsp;&nbsp;X&gt;</a>" +
          "</div>" + html;
        app.out('dlgdiv', html);
        app.onescapefunc = closeDialog;
    },


    //relative paths don't work when you are running file://...
    relativeToAbsolute = function (url) {
        var loc = window.location.href;
        loc = loc.slice(0, loc.lastIndexOf("/") + 1);
        return loc + url;
    },


    displayDoc = function (url) {
        var critsec = "", html = "Fetching " + url + " ...";
        window.scrollTo(0,0);
        app.out('dlgdiv', html);
        app.byId('dlgdiv').style.visibility = "visible";
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        app.call(url, 'GET', null,
                 function (resp) {
                     displayDocContent(url, resp); },
                 function (code, errtxt) {
                     displayDocContent(url, errtxt); },
                 critsec);
    },


    attachDocLinkClick = function (node, link) {
        app.onxnode("click", node, function (e) {
            e.preventDefault();
            e.stopPropagation();
            displayDoc(link); });
    },


    //faster to grab all links rather than iterating through bottomnav
    localDocLinks = function () {
        var i, nodes = app.dojo.query('a'), node, href;
        for(i = 0; nodes && i < nodes.length; i += 1) {
            node = nodes[i];
            href = node.href;
            //href may have been resolved from relative to absolute...
            if(href && href.indexOf("docs/") >= 0) {
                attachDocLinkClick(node, href); } }
    },


    //Set the src of the current img to the next slide and change its
    //opacity to 1.  Then change the opacity of the prev img to 0.  If
    //someone is logging in automatically (the most common case), then
    //preloading images is extra overhead so not doing that.
    slideshow = function (firstrun) {
        var html, previmg, img;
        if(app.byId('slidesdiv')) {
            if(app.isLowFuncBrowser()) {
                app.log("slideshow isLowFuncBrowser so no fades");
                if(firstrun) {
                    slideindex = 0; }
                html = "<img src=\"img/slides/" + slides[slideindex] +
                         "\" class=\"slideimg\"/>";
                app.out('slidesdiv', html);
                slideindex = (slideindex + 1) % slides.length; }
            else {  //use nice opacity transitions
                if(!firstrun) {
                    app.log("    fading introslide" + slideslot + ": " + 
                            "img/slides/" + slides[slideindex]);
                    previmg = app.byId("introslide" + slideslot);
                    if(!previmg) {  //probably logged in in the interim
                        return; }
                    setTimeout(function () {
                        //blank out so if there is a lag on image load when
                        //faded back for display, old content won't flash.
                        //wait until fade completes though.
                        previmg.src = "img/slides/blank.png"; }, 1200);
                    previmg.style.opacity = 0; }  //fade out
                slideslot = (slideslot + 1) % 2;
                slideindex = (slideindex + 1) % slides.length;
                app.log("displaying introslide" + slideslot + ": " + 
                        "img/slides/" + slides[slideindex]);
                img = app.byId("introslide" + slideslot);
                if(!img) {  //probably logged in in the interim
                    return; }
                img.src = "img/slides/" + slides[slideindex];
                img.style.opacity = 1; }
            if(!slides[slideindex] || slides[slideindex] === "blank.png") {
                setTimeout(slideshow, 2200); }
            else {
                setTimeout(slideshow, 6400); } }
    },


    //Even though window.screen.width *might* give you a semi-accurate
    //value of something like 480px for a phone, using minimum space
    //here does not cause the browser to use anything other than full
    //client width in its own layout calculations.  So just go with
    //what is being reported.
    initSlideshow = function () {
        var width, leftx, logow = 515, slidew = 522;
        width = document.documentElement.clientWidth;
        if(width > logow + slidew) {  //enough room for logo and slides
            app.out('logodiv', "<img src=\"img/slides/logoMOR.png\"" +
                    " id=\"logoimg\" border=\"0\"/>");
            leftx = logow + Math.round(((width - (logow + slidew)) / 2));
            app.byId('introslide0').style.left = String(leftx) + "px";
            app.byId('introslide1').style.left = String(leftx) + "px"; }
        else if(width >= slidew) {  //probably a phone. just slides, but center
            app.out('logodiv', "");
            leftx = Math.round((width - slidew) / 2); 
            app.byId('introslide0').style.left = String(leftx) + "px";
            app.byId('introslide1').style.left = String(leftx) + "px"; }
        if(!app.isLowFuncBrowser()) {  //skip nice fade transitions
            app.byId('introslide0').style.opacity = 0;
            app.byId('introslide1').style.opacity = 0; }
        slideshow(true);
    },


    //initialize the logged-in content display div areas.  Basically
    //contentdiv is subdivided into chead and cmain.
    haveContentDivAreas = function () {
        return app.byId('chead') && app.byId('cmain');
    },


    initContentDivAreas = function () {
        var html = "<div id=\"chead\"> </div>" +
                   "<div id=\"cmain\"> </div>";
        app.out('contentdiv', html);
    },


    initContent = function () {
        if(!haveContentDivAreas()) {
            initContentDivAreas();
            app.profile.updateHeading();
            app.activity.updateHeading();
            app.review.updateHeading(); }
    },


    findDisplayHeightAndWidth = function () {
        if(window.innerWidth && window.innerHeight) {
            app.winw = window.innerWidth;
            app.winh = window.innerHeight; }
        else if(document.compatMode === 'CSS1Compat' &&
                document.documentElement && 
                document.documentElement.offsetWidth) {
            app.winw = document.documentElement.offsetWidth;
            app.winh = document.documentElement.offsetHeight; }
        else if(document.body && document.body.offsetWidth) {
            app.winw = document.body.offsetWidth;
            app.winh = document.body.offsetHeight; }
        else {  //WTF, just guess.
            app.winw = 600;
            app.winh = 800; }
        //if we are actually on a small screen, dial the width back a bit
        if(window.innerWidth <= 768 || window.screen.width <= 768) {
            app.winw = 768; }
    },


    //ie8 and below don't support cover so we end up with just a postage
    //stamp image in the middle of the screen.
    fixTextureCover = function () {
        var altimg, rules = document.styleSheets[0].cssRules;
        if(!rules) { //decent css support is missing, fall back
            //texturePaper.png is 256x192
            //setting backgroundSize to a scaled up fixed size has no effect
            //app.byId('bodyid').style.backgroundSize = "2048px 1536px;";
            //scaled up image either too large or too pixelated for use
            //altimg = "url('../img/texturePaperBig.png')";
            altimg = "url('../img/blank.png')";
            app.byId('bodyid').style.backgroundImage = altimg;
            app.byId('dlgdiv').style.backgroundColor = "#CCCCCC"; }
    },


    dndStart = function (event) {
        if(event) {
            dndState = { domobj: event.target,
                         screenX: event.screenX,
                         screenY: event.screenY };
            app.log("dndStart " + dndState.domobj + " " + 
                    dndState.screenX + "," + dndState.screenY);
            if(event.dataTransfer && event.dataTransfer.setData) {
                event.dataTransfer.setData("text/plain", "general drag"); } }
    },


    dndEnd = function (event) {
        if(event && dndState) {
            app.log("dndEnd called");
            dndState.ended = true; }
    },
                

    dndOver = function (event) {
        if(event && dndState && (!dndState.ended || dndState.dropped)) {
            //app.log("dndOver preventing default cancel");
            event.preventDefault(); }
    },


    dndDrop = function (event) {
        var diffX, diffY, domobj, currX, currY;
        app.log("dndDrop called");
        if(event && dndState) {
            dndState.dropped = true;
            diffX = event.screenX - dndState.screenX;
            diffY = event.screenY - dndState.screenY;
            domobj = dndState.domobj;
            app.log("dropping " + domobj + " moved " + diffX + "," + diffY);
            currX = domobj.offsetLeft;
            currY = domobj.offsetTop;
            domobj.style.left = String(currX + diffX) + "px";
            domobj.style.top = String(currY + diffY) + "px";
            event.preventDefault();
            event.stopPropagation(); }
    },


    setSoftFocus = function () {
        var revid, focobj;
        if(app.review.getCurrentReview()) {
            revid = "lihr" + app.instId(app.review.getCurrentReview());
            focobj = app.byId(revid);
            if(focobj) {
                focobj.focus(); } }
    },


    currentContentHeight = function () {
        var ch, content, centerh, bottomnav;
        content = app.byId("contentdiv").offsetHeight;
        centerh = app.byId("centerhdiv").offsetHeight;
        bottomnav = app.byId("bottomnav").offsetHeight;
        ch = content + centerh + bottomnav;
        return ch;
    },


    fullContentHeight = function () {
        var ch, filldiv, topdiv, contentdiv, target;
        findDisplayHeightAndWidth();
        //fill the bottom content so the footer text isn't too high up
        filldiv = app.byId("contentfill");
        ch = currentContentHeight();
        target = app.winh - topPaddingAndScroll; 
        if(ch < target) {
            filldiv.style.height = (target - ch) + "px"; }
        else {  //not filling, just leave a little separator space
            filldiv.style.height = "16px"; }
        //adjust the topdiv and content width so it looks reasonable
        target = app.winw - 120;  //Remo is 72px, margin padding
        topdiv = app.byId('topdiv');
        if(topdiv) {
            topdiv.style.width = target + "px"; }
        contentdiv = app.byId('contentdiv');
        if(contentdiv) {
            contentdiv.style.width = target + "px"; }
        setSoftFocus();
    };


    return {
        init: function () {
            app.dojo.on(window, 'resize', fullContentHeight);
            initSlideshow();
            localDocLinks();
            fullContentHeight();
            fixTextureCover(); },
        haveContentDivAreas: function () {
            return haveContentDivAreas(); },
        initContentDivAreas: function () {
            initContentDivAreas(); },
        initContent: function () {
            initContent(); },
        adjust: function () {
            fullContentHeight(); },
        displayDoc: function (url) {
            displayDoc(url); },
        closeDialog: function () {
            closeDialog(); },
        setTopPaddingAndScroll: function (val) {
            topPaddingAndScroll = val + topextra; },
        dragstart: function (event) {
            dndStart(event); },
        dragend: function (event) {
            dndEnd(event); },
        bodydragover: function (event) {
            dndOver(event); },
        bodydrop: function (event) {
            dndDrop(event); }
    };

});

