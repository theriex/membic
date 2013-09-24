/*global setTimeout: false, window: false, document: false, app: false, jt: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

app.layout = (function () {
    "use strict";

    var topextra = 12 + 20,  //topsectiondiv shadow + appspacediv padding
        topPaddingAndScroll = 250 + topextra,   //topsectiondiv height
        dndState = null,


    closeDialog = function () {
        jt.out('dlgdiv', "");
        jt.byId('dlgdiv').style.visibility = "hidden";
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
        jt.out('dlgdiv', html);
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
        jt.out('dlgdiv', html);
        jt.byId('dlgdiv').style.visibility = "visible";
        if(url.indexOf(":") < 0) {
            url = relativeToAbsolute(url); }
        jt.request('GET', url, null,
                   function (resp) {
                       displayDocContent(url, resp); },
                   function (code, errtxt) {
                       displayDocContent(url, errtxt); },
                   critsec);
    },


    attachDocLinkClick = function (node, link) {
        jt.on(node, "click", function (e) {
            jt.evtend(e);
            displayDoc(link); });
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


    //initialize the logged-in content display div areas.  Basically
    //contentdiv is subdivided into chead and cmain.
    haveContentDivAreas = function () {
        return jt.byId('chead') && jt.byId('cmain');
    },


    initContentDivAreas = function () {
        var html = "<div id=\"chead\"> </div>" +
                   "<div id=\"cmain\"> </div>";
        jt.out('contentdiv', html);
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
            //jt.byId('bodyid').style.backgroundSize = "2048px 1536px;";
            //scaled up image either too large or too pixelated for use
            //altimg = "url('../img/texturePaperBig.png')";
            altimg = "url('../img/blank.png')";
            jt.byId('bodyid').style.backgroundImage = altimg;
            jt.byId('dlgdiv').style.backgroundColor = "#CCCCCC"; }
    },


    dndStart = function (event) {
        if(event) {
            dndState = { domobj: event.target,
                         screenX: event.screenX,
                         screenY: event.screenY };
            jt.log("dndStart " + dndState.domobj + " " + 
                    dndState.screenX + "," + dndState.screenY);
            if(event.dataTransfer && event.dataTransfer.setData) {
                event.dataTransfer.setData("text/plain", "general drag"); } }
    },


    dndEnd = function (event) {
        if(event && dndState) {
            jt.log("dndEnd called");
            dndState.ended = true; }
    },
                

    dndOver = function (event) {
        if(event && dndState && (!dndState.ended || dndState.dropped)) {
            //jt.log("dndOver preventing default cancel");
            event.preventDefault(); }
    },


    dndDrop = function (event) {
        var diffX, diffY, domobj, currX, currY;
        jt.log("dndDrop called");
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
        var ch, filldiv, topdiv, contentdiv, target;
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
        target = app.winw - 120;  //Remo is 72px, margin padding
        topdiv = jt.byId('topdiv');
        if(topdiv) {
            topdiv.style.width = target + "px"; }
        contentdiv = jt.byId('contentdiv');
        if(contentdiv) {
            contentdiv.style.width = target + "px"; }
        setSoftFocus();
    };


    return {
        init: function () {
            jt.on(window, 'resize', fullContentHeight);
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

}());

