/*global alert: false, console: false, window: false, document: false, app: false, jt: false, FB: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.facebook = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "Facebook",  //no spaces in name, used as an id
        tmprev,  //temporary review holder for posting process
    

    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    facebookWelcome = function (loginResponse) {
        var html = [["p", "&nbsp;"],
                    ["p", "Facebook login success! Fetching your info..."]];
        jt.out('contentdiv', jt.tac2html(html));
        FB.api('/me', function (infoResponse) {
            html = [["p", "&nbsp;"],
                    ["p", "Welcome " + infoResponse.name]];
            jt.out('contentdiv', jt.tac2html(html));
            app.login.setAuth("fbid", loginResponse.authResponse.accessToken,
                              infoResponse.id + " " + infoResponse.name);
            //The facebook name is NOT a good default pen name since it
            //is unlikely to be unique, and creativity on pen names is good.
            app.login.authComplete(); });
    },


    facebookLoginFormDisplay = function (loginResponse, domid, 
                                         okfstr, cancelfstr) {
        var msg, canceltd = "", html;
        if(loginResponse.status === "not_authorized") {
            msg = "You have not yet authorized wdydfun," +
                " click to authorize..."; }
        else {
            msg = "You are not currently logged into Facebook," +
                " click to log in..."; }
        if(cancelfstr) {
            canceltd = ["td", 
                        ["&nbsp;",
                         ["button", {type: "button", id: "cancelbutton",
                                     onclick: jt.fs(cancelfstr)},
                          "Cancel"]]]; }
        html = [["p", msg],
                ["table", 
                 ["tr", 
                  [["td",
                    ["a", {href: "http://www.facebook.com",
                           title: "Log in to Facebook",
                           onclick: jt.fs("app.facebook." + okfstr)},
                     [["img", {cla: "loginico", src: "img/f_logo.png"}],
                      " Log in to Facebook"]]],
                   canceltd]]]];
        jt.out(domid, jt.tac2html(html));
        if(cancelfstr) {  //not already in a dialog...
            app.layout.adjust(); }
    },


    checkFBLogin = function () {
        FB.getLoginStatus(function (loginResponse) {
            if(loginResponse.status === "connected") {
                facebookWelcome(loginResponse); }
            else {
                facebookLoginFormDisplay(loginResponse, 'contentdiv',
                                         "loginFB()", "app.login.init()"); } 
        });
    },


    loadFacebook = function (nextfunc, msgdivid) {
        var js, id = 'facebook-jssdk', firstscript, html;
        window.fbAsyncInit = function () {
            FB.init({ appId: 661315260568822,
                      status: true, //check login status
                      cookie: true, //enable server to access the session
                      xfbml: true });
            nextfunc(); };
        //Load the FB SDK asynchronously if not already loaded
        if(jt.byId(id)) {
            return; }
        js = document.createElement('script');
        js.id = id;
        js.async = true;
        js.src = "//connect.facebook.net/en_US/all.js";
        firstscript = document.getElementsByTagName('script')[0];
        firstscript.parentNode.insertBefore(js, firstscript);
        if(!msgdivid) {
            msgdivid = "contentdiv"; }
        if(msgdivid !== "quiet") {
            html = [["p", "&nbsp;"],
                    ["p", "Loading Facebook API..."]];
            jt.out(msgdivid, jt.tac2html(html)); }
        app.layout.adjust();
    },


    addProfileAuth3 = function (domid, pen, fbUserID) {
        var fbid;
        if(!fbUserID) {
            jt.err("No userID received from Facebook");
            return app.profile.displayAuthSettings(domid, pen); }
        fbid = parseInt(fbUserID, 10);
        if(!fbid || fbid <= 0) {
            jt.err("Invalid userID received from Facebook");
            return app.profile.displayAuthSettings(domid, pen); }
        jt.out(domid, "Recording Facebook authorization...");
        pen.fbid = fbUserID;  //use string to avoid any potential rounding
        app.pen.updatePen(pen,
                          function (updpen) {
                              app.profile.displayAuthSettings(domid, updpen); },
                          function (code, errtxt) {
                              jt.err("facebook.addProfileAuth3 error " +
                                      code + ": " + errtxt);
                              pen.fbid = 0;
                              app.profile.displayAuthSettings(domid, pen); });
    },


    addProfileAuth2 = function (domid, pen) {
        FB.getLoginStatus(function (loginResponse) {
            if(loginResponse.status === "connected") {
                addProfileAuth3(domid, pen, 
                                loginResponse.authResponse.userID); }
            else {
                facebookLoginFormDisplay(loginResponse, domid, 
                                         "authFB('" + domid + "')"); } 
        });
    },


    closeOverlay = function () {
        var odiv = jt.byId('overlaydiv');
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
    },


    postRevBailout = function (review) {
        review.svcdata[svcName] = "bailout";
    },


    revaction = function (revtype) {
        switch(revtype) {
        case 'book': return "I read...";
        case 'movie': return "I watched...";
        case 'video': return "I watched...";
        case 'music': return "I listened to...";
        case 'food': return "I ate...";
        case 'drink': return "I drank...";
        case 'activity': return "I did...";
        default: return "I ..."; }
    },


    postReview4 = function (review) {
        var fbimage, fblinkurl, fblinktext, fbtitle, fbtext, 
            fbremurl, fbmessage, fbprompt;
        fbimage = app.services.getRevTypeImage(review);
        fbimage = fbimage.slice(0, fbimage.length - 6) + "Pic.png";
        fblinkurl = app.services.getRevPermalink(review);
        fblinktext = "wdydfun this week? " + revaction(review.revtype);
        fbtitle = app.services.getRevStarsTxt(review, "unicode") + " " +
            app.services.getRevTitleTxt(review);
        fbtext = review.text;
        if(review.keywords) {
            fbtext += " [" + review.keywords + "]"; }
        fbremurl = "http://www.wdydfun.com/#command=remember&penid=" + 
            review.penid + "&revid=" + jt.instId(review);
        fbmessage = "wdydfun " + review.revtype + " review";
        fbprompt = "Check this out if...";
        FB.ui({ method: 'feed',  //use the feed dialog...
                message: fbmessage,  //not part of final post
                name: fblinktext,
                caption: fbtitle,
                description: fbtext,
                link: fblinkurl,
                picture: fbimage,
                actions: [ { name: 'Remember', link: fbremurl } ],
                user_message_prompt: fbprompt },
              function (response) {
                  if(response && response.post_id) {
                      jt.log("Review posted to Facebook");
                      review.svcdata[svcName] = response.post_id; }
                  else {  //probably just canceled posting
                      jt.log("Posting to Facebook did not happen.");
                      review.svcdata[svcName] = 'nopost'; } 
              });
    },


    postReview3 = function (review) {
        FB.login(function (loginResponse) {
            closeOverlay();
            app.onescapefunc = null;
            if(loginResponse.status === "connected") {
                postReview4(review); }
            else {
                postRevBailout(review); } });
    },


    postReview2 = function (review) {
        FB.getLoginStatus(function (loginResponse) {
            var odiv;
            if(loginResponse.status === "connected") {
                postReview4(review, 
                            loginResponse.authResponse.userID); }
            else {
                tmprev = review;
                odiv = jt.byId('overlaydiv');
                odiv.style.top = "80px";
                odiv.style.visibility = "visible";
                odiv.style.backgroundColor = app.skinner.lightbg();
                app.onescapefunc = function () {
                    closeOverlay();
                    postRevBailout(review); };
                facebookLoginFormDisplay(loginResponse, 'overlaydiv',
                                         "postTmpRev()", "bailTmpRev()"); }
        });
    };


    ////////////////////////////////////////
    // published function
    ////////////////////////////////////////
return {

    loginurl: "https://www.facebook.com",
    name: svcName,  //no spaces in name, used as an id
    svcDispName: "Facebook Wall Post",
    svcDesc: "Posts a review to your wall",
    iconurl: "img/f_logo.png",


    loginFB: function () {
        FB.login(function (loginResponse) {
            if(loginResponse.status === "connected") {
                facebookWelcome(loginResponse); }
            else {
                app.login.init(); } });
    },


    authenticate: function () {
        try {
            if(FB) {
                return checkFBLogin(); }
        } catch (e) {
            jt.log("facebook.js authenticate error: " + e);
        }
        loadFacebook(checkFBLogin);
    },


    addProfileAuth: function (domid, pen) {
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            alert("Facebook authentication is only supported from " +
                  app.mainsvr);
            return app.profile.displayAuthSettings(domid, pen); }
        if(typeof FB === 'object' || typeof FB === 'function') {
            return addProfileAuth2(domid, pen); }
        loadFacebook(function () {
            addProfileAuth2(domid, pen); });
    },


    authFB: function (domid) {
        FB.login(function (loginResponse) {
            if(loginResponse.status === "connected") {
                app.pen.getPen(function (pen) {
                    addProfileAuth3(domid, pen,
                                    loginResponse.authResponse.userID); 
                }); }
            else {
                app.pen.getPen(function (pen) {
                    app.profile.displayAuthSettings(domid, pen); }); }
        });
    },


    doInitialSetup: function () {
        if(window.location.href.indexOf(app.mainsvr) === 0 &&
               !(typeof FB === 'object' || typeof FB === 'function')) {
            loadFacebook(function () {
                console.log("facebook service initial setup done"); },
                         "quiet"); }
        else {
            console.log("facebook service initial setup skipped"); }
    },


    getLinkURL: function (review) {
        var url = app.services.getRevPermalink(review);
        url = "http://www.facebook.com/sharer/sharer.php?u=" + jt.enc(url);
        return url;
    },


    getOnClickStr: function (review) {
        var str = "app.facebook.shareCurrentReview();return false;";
        return str;
    },


    shareCurrentReview: function () {
        var review = app.review.getCurrentReview();
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            alert("Posting to Facebook is only supported from " +
                  app.mainsvr);
            return postRevBailout(review); }
        if(typeof FB === 'object' || typeof FB === 'function') {
            return postReview2(review); }
        loadFacebook(function () {
            postReview2(review); });
    },


    getShareImageAlt: function () {
        return "Post to your wall";
    },


    getShareImageSrc: function () {
        return app.facebook.iconurl;
    },


    postTmpRev: function () {
        closeOverlay();
        postReview3(tmprev);
    },


    bailTmpRev: function () {
        closeOverlay();
        postRevBailout(tmprev);
    }

};  //end of returned functions
}());

