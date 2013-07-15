/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l a y o u t
//
define([], function () {
    "use strict";

    var slides = [ "sloganPadded.png", "blank.png",
                   "promo_balloons2.png", 
                   "promo_list.png",
                   "promo_cycle.png" ],
        slideindex = -1,
        slideslot = -1,
        topPaddingAndScroll = 320,
        dndState = null,


    closeDialog = function () {
        mor.out('dlgdiv', "");
        mor.byId('dlgdiv').style.visibility = "hidden";
        mor.layout.adjust();
        mor.onescapefunc = null;
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
            " onclick=\"mor.layout.closeDialog();return false\">" + 
                 "&lt;close&nbsp;&nbsp;X&gt;</a>" +
          "</div>" + html;
        mor.out('dlgdiv', html);
        mor.onescapefunc = closeDialog;
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
        mor.out('dlgdiv', html);
        mor.byId('dlgdiv').style.visibility = "visible";
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        mor.call(url, 'GET', null,
                 function (resp) {
                     displayDocContent(url, resp); },
                 function (code, errtxt) {
                     displayDocContent(url, errtxt); },
                 critsec);
    },


    attachDocLinkClick = function (node, link) {
        mor.onxnode("click", node, function (e) {
            e.preventDefault();
            e.stopPropagation();
            displayDoc(link); });
    },


    //faster to grab all links rather than iterating through bottomnav
    localDocLinks = function () {
        var i, nodes = mor.dojo.query('a'), node, href;
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
        if(mor.byId('slidesdiv')) {
            if(mor.isLowFuncBrowser()) {
                mor.log("slideshow isLowFuncBrowser so no fades");
                if(firstrun) {
                    slideindex = 0; }
                html = "<img src=\"img/slides/" + slides[slideindex] +
                         "\" class=\"slideimg\"/>";
                mor.out('slidesdiv', html);
                slideindex = (slideindex + 1) % slides.length; }
            else {  //use nice opacity transitions
                if(!firstrun) {
                    mor.log("    fading introslide" + slideslot + ": " + 
                            "img/slides/" + slides[slideindex]);
                    previmg = mor.byId("introslide" + slideslot);
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
                mor.log("displaying introslide" + slideslot + ": " + 
                        "img/slides/" + slides[slideindex]);
                img = mor.byId("introslide" + slideslot);
                if(!img) {  //probably logged in in the interim
                    return; }
                img.src = "img/slides/" + slides[slideindex];
                img.style.opacity = 1; }
            if(!slides[slideindex] || slides[slideindex] === "blank.png") {
                setTimeout(slideshow, 2200); }
            else {
                setTimeout(slideshow, 6400); } }
    },


    initSlideshow = function () {
        if(!mor.isLowFuncBrowser()) {
            mor.byId('introslide0').style.opacity = 0;
            mor.byId('introslide1').style.opacity = 0; }
        slideshow(true);
    },


    //initialize the logged-in content display div areas.  Basically
    //contentdiv is subdivided into chead and cmain.
    haveContentDivAreas = function () {
        return mor.byId('chead') && mor.byId('cmain');
    },


    initContentDivAreas = function () {
        var html = "<div id=\"chead\"> </div>" +
                   "<div id=\"cmain\"> </div>";
        mor.out('contentdiv', html);
    },


    initContent = function () {
        if(!haveContentDivAreas()) {
            initContentDivAreas();
            mor.profile.updateHeading();
            mor.activity.updateHeading();
            mor.review.updateHeading(); }
    },


    findDisplayHeightAndWidth = function () {
        if(window.innerWidth && window.innerHeight) {
            mor.winw = window.innerWidth;
            mor.winh = window.innerHeight; }
        else if(document.compatMode === 'CSS1Compat' &&
                document.documentElement && 
                document.documentElement.offsetWidth) {
            mor.winw = document.documentElement.offsetWidth;
            mor.winh = document.documentElement.offsetHeight; }
        else if(document.body && document.body.offsetWidth) {
            mor.winw = document.body.offsetWidth;
            mor.winh = document.body.offsetHeight; }
        else {  //WTF, just guess.
            mor.winw = 240;
            mor.winh = 320; }
    },


    //ie8 and below don't support cover so we end up with just a postage
    //stamp image in the middle of the screen.
    fixTextureCover = function () {
        var altimg, rules = document.styleSheets[0].cssRules;
        if(!rules) { //decent css support is missing, fall back
            //texturePaper.png is 256x192
            //setting backgroundSize to a scaled up fixed size has no effect
            //mor.byId('bodyid').style.backgroundSize = "2048px 1536px;";
            //scaled up image either too large or too pixelated for use
            //altimg = "url('../img/texturePaperBig.png')";
            altimg = "url('../img/blank.png')";
            mor.byId('bodyid').style.backgroundImage = altimg;
            mor.byId('dlgdiv').style.backgroundColor = "#CCCCCC"; }
    },


    dndStart = function (event) {
        if(event) {
            dndState = { domobj: event.target,
                         screenX: event.screenX,
                         screenY: event.screenY };
            mor.log("dndStart " + dndState.domobj + " " + 
                    dndState.screenX + "," + dndState.screenY);
            if(event.dataTransfer && event.dataTransfer.setData) {
                event.dataTransfer.setData("text/plain", "general drag"); } }
    },


    dndEnd = function (event) {
        if(event && dndState) {
            mor.log("dndEnd called");
            dndState.ended = true; }
    },
                

    dndOver = function (event) {
        if(event && dndState && (!dndState.ended || dndState.dropped)) {
            //mor.log("dndOver preventing default cancel");
            event.preventDefault(); }
    },


    dndDrop = function (event) {
        var diffX, diffY, domobj, currX, currY;
        mor.log("dndDrop called");
        if(event && dndState) {
            dndState.dropped = true;
            diffX = event.screenX - dndState.screenX;
            diffY = event.screenY - dndState.screenY;
            domobj = dndState.domobj;
            mor.log("dropping " + domobj + " moved " + diffX + "," + diffY);
            currX = domobj.offsetLeft;
            currY = domobj.offsetTop;
            domobj.style.left = String(currX + diffX) + "px";
            domobj.style.top = String(currY + diffY) + "px";
            event.preventDefault();
            event.stopPropagation(); }
    },


    setSoftFocus = function () {
        var revid, focobj;
        if(mor.review.getCurrentReview()) {
            revid = "lihr" + mor.instId(mor.review.getCurrentReview());
            focobj = mor.byId(revid);
            if(focobj) {
                focobj.focus(); } }
    },


    fullContentHeight = function () {
        var ch, filldiv, topdiv, contentdiv, target;
        findDisplayHeightAndWidth();
        //fill the bottom content so the footer text isn't too high up
        filldiv = mor.byId("contentfill");
        ch = mor.byId("contentdiv").offsetHeight;
        target = mor.winh - topPaddingAndScroll; 
        if(ch < target) {
            filldiv.style.height = (target - ch) + "px"; }
        else {  //not filling, just leave a little separator space
            filldiv.style.height = "16px"; }
        //adjust the topdiv and content width so it looks reasonable
        target = mor.winw - 120;  //Remo is 72px, margin padding
        topdiv = mor.byId('topdiv');
        if(topdiv) {
            topdiv.style.width = target + "px"; }
        contentdiv = mor.byId('contentdiv');
        if(contentdiv) {
            contentdiv.style.width = target + "px"; }
        setSoftFocus();
    };


    return {
        init: function () {
            mor.dojo.on(window, 'resize', fullContentHeight);
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
            topPaddingAndScroll = val; },
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

