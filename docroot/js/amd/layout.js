/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l a y o u t
//
define([], function () {
    "use strict";

    var slides = [ "sloganPadded.png", "sloganPadded.png",
                   "promo_balloons2.png", 
                   "promo_list.png",
                   "promo_cycle.png" ],
        slideindex = 0,
        slideslot = 0,
        topPaddingAndScroll = 320,


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
    slideshow = function () {
        var sdiv, prevslot, currslot;
        sdiv = mor.byId('slidesdiv');
        if(sdiv) {
            if(mor.isLowFuncBrowser()) {
                currslot = "<img src=\"img/slides/" + slides[slideindex] +
                    "\" class=\"slideimg\"/>";
                mor.out('slidesdiv', currslot);
                slideindex = (slideindex + 1) % slides.length; }
            else {  //use nice opacity transitions
                prevslot = mor.byId("introslide" + slideslot);
                if(!prevslot) {  //we probably logged in and it's gone
                    return; }
                slideslot = (slideslot + 1) % 2;
                slideindex = (slideindex + 1) % slides.length;
                currslot = mor.byId("introslide" + slideslot);
                if(!currslot) {  //we probably logged in and it's gone
                    return; }
                currslot.src = "img/slides/" + slides[slideindex];
                currslot.style.opacity = 1;
                prevslot.style.opacity = 0; }
            if(slides[slideindex].indexOf("mor") === 0) {
                setTimeout(slideshow, 1200); }
            else {
                setTimeout(slideshow, 5400); } }
    },


    //initialize the logged-in content display div areas.  Basically
    //contentdiv is subdivided into chead and cmain.
    initContent = function () {
        var html, div;
        div = mor.byId('chead');
        if(!div) {
            html = "<div id=\"chead\"> </div>" +
                "<div id=\"cmain\"> </div>";
            mor.out('contentdiv', html);
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
            mor.byId('bodyid').style.backgroundImage = altimg; }
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
            slideshow();
            localDocLinks();
            fullContentHeight();
            fixTextureCover(); },
        initContent: function () {
            initContent(); },
        adjust: function () {
            fullContentHeight(); },
        displayDoc: function (url) {
            displayDoc(url); },
        closeDialog: function () {
            closeDialog(); },
        setTopPaddingAndScroll: function (val) {
            topPaddingAndScroll = val; }
    };

});

