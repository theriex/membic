/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false, FB: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . f a c e b o o k
//
define([], function () {
    "use strict";

    var svcName = "Facebook",  //no spaces in name, used as an id
        tmprev,  //temporary review holder for posting process
    

    facebookWelcome = function (loginResponse) {
        var html = "<p>&nbsp;</p>" + 
            "<p>Facebook login success! Fetching your info...</p>";
        glo.out('contentdiv', html);
        FB.api('/me', function (infoResponse) {
            html = "<p>&nbsp;</p><p>Welcome " + infoResponse.name + "</p>";
            glo.out('contentdiv', html);
            glo.login.setAuth("fbid", loginResponse.authResponse.accessToken,
                              infoResponse.id + " " + infoResponse.name);
            //The facebook name is NOT a good default pen name since it
            //is unlikely to be unique, and creativity on pen names is good.
            glo.login.authComplete(); });
    },


    facebookLoginFormDisplay = function (loginResponse, domid, 
                                         okfstr, cancelfstr) {
        var msg, html;
        if(loginResponse.status === "not_authorized") {
            msg = "You have not yet authorized MyOpenReviews," +
                " click to authorize..."; }
        else {
            msg = "You are not currently logged into Facebook," +
                " click to log in..."; }
        html = "<p>" + msg + "</p><table><tr>" + 
            "<td><a href=\"http://www.facebook.com\"" +
                  " title=\"Log in to Facebook\"" +
                  " onclick=\"glo.facebook." + okfstr + ";return false;\"" +
                "><img class=\"loginico\" src=\"img/f_logo.png\"" +
                     " border=\"0\"/> Log in to Facebook</a></td>";
        if(cancelfstr) {
            html += "<td>&nbsp;" + 
              "<button type=\"button\" id=\"cancelbutton\"" +
                     " onclick=\"" + cancelfstr + ";return false;\"" +
              ">Cancel</button></td>"; }
        html += "</tr></table>";
        glo.out(domid, html);
        if(cancelfstr) {  //not already in a dialog...
            glo.layout.adjust(); }
    },


    handleFBLogin = function () {
        FB.login(function (loginResponse) {
            if(loginResponse.status === "connected") {
                facebookWelcome(loginResponse); }
            else {
                glo.login.init(); } });
    },


    checkFBLogin = function () {
        FB.getLoginStatus(function (loginResponse) {
            if(loginResponse.status === "connected") {
                facebookWelcome(loginResponse); }
            else {
                facebookLoginFormDisplay(loginResponse, 'contentdiv',
                                         "loginFB()", "glo.login.init()"); } 
        });
    },


    loadFacebook = function (nextfunc, msgdivid) {
        var js, id = 'facebook-jssdk', firstscript, html;
        window.fbAsyncInit = function () {
            FB.init({ appId: 265001633620583, 
                      status: true, //check login status
                      cookie: true, //enable server to access the session
                      xfbml: true });
            nextfunc(); };
        //Load the FB SDK asynchronously if not already loaded
        if(glo.byId(id)) {
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
            html = "<p>&nbsp;</p><p>Loading Facebook API...</p>";
            glo.out(msgdivid, html); }
        glo.layout.adjust();
    },


    addProfileAuth3 = function (domid, pen, fbUserID) {
        var fbid;
        if(!fbUserID) {
            glo.err("No userID received from Facebook");
            return glo.profile.displayAuthSettings(domid, pen); }
        fbid = parseInt(fbUserID, 10);
        if(!fbid || fbid <= 0) {
            glo.err("Invalid userID received from Facebook");
            return glo.profile.displayAuthSettings(domid, pen); }
        glo.out(domid, "Recording Facebook authorization...");
        pen.fbid = fbUserID;  //use string to avoid any potential rounding
        glo.pen.updatePen(pen,
                          function (updpen) {
                              glo.profile.displayAuthSettings(domid, updpen); },
                          function (code, errtxt) {
                              glo.err("facebook.addProfileAuth3 error " +
                                      code + ": " + errtxt);
                              pen.fbid = 0;
                              glo.profile.displayAuthSettings(domid, pen); });
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


    addProfileAuth1 = function (domid, pen) {
        if(window.location.href.indexOf(glo.mainsvr) !== 0) {
            alert("Facebook authentication is only supported from " +
                  glo.mainsvr);
            return glo.profile.displayAuthSettings(domid, pen); }
        if(typeof FB === 'object' || typeof FB === 'function') {
            return addProfileAuth2(domid, pen); }
        loadFacebook(function () {
            addProfileAuth2(domid, pen); });
    },


    handleFBProfileAuth = function (domid) {
        FB.login(function (loginResponse) {
            if(loginResponse.status === "connected") {
                glo.pen.getPen(function (pen) {
                    addProfileAuth3(domid, pen,
                                    loginResponse.authResponse.userID); 
                }); }
            else {
                glo.pen.getPen(function (pen) {
                    glo.profile.displayAuthSettings(domid, pen); }); }
        });
    },


    authenticate = function () {
        try {
            if(glo.isDefined(FB)) {
                return checkFBLogin(); }
        } catch (e) {
            glo.log("facebook.js authenticate error: " + e);
        }
        loadFacebook(checkFBLogin);
    },


    closeOverlay = function () {
        var odiv = glo.byId('overlaydiv');
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
    },


    postRevBailout = function (review) {
        review.svcdata[svcName] = "bailout";
    },


    postReview4 = function (review) {
        var fblinkname, fblinkurl, fbremurl, fbimage, fbprompt;
        fblinkname = glo.services.getRevStarsTxt(review, "unicode") + " " +
            glo.services.getRevTitleTxt(review);
        fblinkurl = glo.services.getRevPermalink(review);
        fbremurl = "http://www.myopenreviews.com/#command=remember&penid=" + 
            review.penid + "&revid=" + glo.instId(review);
        fbimage = glo.services.getRevTypeImage(review);
        fbprompt = "Check this out if...";
        FB.ui({ method: 'feed',  //use the feed dialog...
                message: review.revtype + " review",
                name: fblinkname,
                caption: review.keywords,
                description: review.text,
                link: fblinkurl,
                picture: fbimage,
                actions: [ { name: 'Remember', link: fbremurl } ],
                user_message_prompt: fbprompt },
              function (response) {
                  if(response && response.post_id) {
                      glo.log("Review posted to Facebook");
                      review.svcdata[svcName] = response.post_id; }
                  else {  //probably just canceled posting
                      glo.log("Posting to Facebook did not happen.");
                      review.svcdata[svcName] = 'nopost'; } 
              });
    },


    postReview3 = function (review) {
        FB.login(function (loginResponse) {
            closeOverlay();
            glo.onescapefunc = null;
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
                odiv = glo.byId('overlaydiv');
                odiv.style.top = "80px";
                odiv.style.visibility = "visible";
                odiv.style.backgroundColor = glo.skinner.lightbg();
                glo.onescapefunc = function () {
                    closeOverlay();
                    postRevBailout(review); };
                facebookLoginFormDisplay(loginResponse, 'overlaydiv',
                                         "postTmpRev()", "bailTmpRev()"); }
        });
    },


    getShareLinkURL = function (review) {
        var url = glo.services.getRevPermalink(review);
        url = "http://www.facebook.com/sharer/sharer.php?u=" + glo.enc(url);
        return url;
    },


    getShareOnClickStr = function (review) {
        var str = "glo.facebook.shareCurrentReview();return false;";
        return str;
    },


    verifyFacebookLoaded = function () {
        if(window.location.href.indexOf(glo.mainsvr) === 0 &&
           !(typeof FB === 'object' || typeof FB === 'function')) {
            loadFacebook(function () {
                console.log("facebook service initial setup done"); },
                         "quiet"); }
        else {
            console.log("facebook service initial setup skipped"); }
    },


    postReview1 = function (review) {
        if(window.location.href.indexOf(glo.mainsvr) !== 0) {
            alert("Posting to Facebook is only supported from " +
                  glo.mainsvr);
            return postRevBailout(review); }
        if(typeof FB === 'object' || typeof FB === 'function') {
            return postReview2(review); }
        loadFacebook(function () {
            postReview2(review); });
    };
            

    return {
        loginurl: "https://www.facebook.com",
        name: svcName,  //no spaces in name, used as an id
        svcDispName: "Facebook Wall Post",
        svcDesc: "Posts a review to your wall",
        iconurl: "img/f_logo.png",
        loginFB: function () {
            handleFBLogin(); },
        authenticate: function () {
            authenticate(); },
        addProfileAuth: function (domid, pen) {
            addProfileAuth1(domid, pen); },
        authFB: function (domid) {
            handleFBProfileAuth(domid); },
        doInitialSetup: function () {
            verifyFacebookLoaded(); },
        getLinkURL: function (review) {
            return getShareLinkURL(review); },
        getOnClickStr: function (review) {
            return getShareOnClickStr(review); },
        shareCurrentReview: function () {
            postReview1(glo.review.getCurrentReview()); },
        getShareImageAlt: function () {
            return "Post to your wall"; },
        getShareImageSrc: function () {
            return glo.facebook.iconurl; },
        postTmpRev: function () {
            closeOverlay();
            postReview3(tmprev); },
        bailTmpRev: function () {
            closeOverlay();
            postRevBailout(tmprev); }
    };

});

