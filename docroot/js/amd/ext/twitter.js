/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . t w i t t e r
//
define([], function () {
    "use strict";

    var svcName = "Twitter",  //no spaces in name, used as an id
        twReqTokURL = "https://api.twitter.com/oauth/request_token",
        twTokCnvURL = "https://api.twitter.com/oauth/access_token",
        twLoginURL = "http://api.twitter.com/oauth/authenticate",


    returnToParentDisplay = function () {
        var addAuthOutDiv = app.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return app.pen.getPen(function (pen) {
                app.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return app.login.init();
    },


    redirectForLogin = function (oaparas) {
        var token, secret, confirmed, url;
        oaparas = app.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        confirmed = oaparas.oauth_callback_confirmed;
        if(confirmed && token && secret) {
            //save secret so it can be accessed on callback
            app.cookie(token, secret, 2);
            url = twLoginURL + "?oauth_token=" + token;
            window.location.href = url; }
        else {
            app.log("Request token returned from Twitter not valid: " + 
                    confirmed + " " + token + " " + secret);
            returnToParentDisplay(); }
    },
                             

    recordTwitterAuthorization = function (twid) {
        var prevLoginToken;
        app.out('contentdiv', "Restoring session...");
        prevLoginToken = app.login.readAuthCookie();
        if(!prevLoginToken) {
            app.log("no previous login found on return from Twitter");
            return app.login.init(); }
        app.out('contentdiv', "Recording Twitter authorization...");
        //the latest used pen name will be selected automatically when
        //pen names are loaded.
        app.pen.getPen(function (pen) {
            pen.twid = twid;
            app.pen.updatePen(pen,
                              function (updpen) {
                                  returnToParentDisplay(); },
                              function (code, errtxt) {
                                  app.err("twitterAuthComplete error " +
                                          code + ": " + errtxt);
                                  pen.twid = 0;
                                  returnToParentDisplay(); }); });
    },


    //After returning from Twitter, use the main contentdiv for all messages.
    twitterAuthComplete = function (oaparas) {
        var token, secret, id, name, addAuthOutDiv;
        addAuthOutDiv = app.cookie("addAuthOutDiv");
        oaparas = app.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        app.cookie(token, secret, 365);
        app.cookie("addAuthOutDiv", "", -1);
        id = oaparas.user_id;
        name = oaparas.screen_name;
        if(addAuthOutDiv) {
            recordTwitterAuthorization(id); }
        else {
            app.out('contentdiv', "<p>&nbsp;</p><p>Welcome " + name + "</p>");
            app.login.setAuth("twid", token, id + " " + name);
            //The twitter name is probably unique, but it's better to
            //allow for entry of a creative pen name without defaulting it.
            app.login.authComplete(); }
    },


    //Surfing to http://www.myopenreviews.com#command=AltAuth1 leads
    //to this function, which is used for both the "log in via
    //twitter" click, and the callback from twitter.
    authenticate = function (params) {
        var data, outputdiv, addAuthOutDiv, critsec = "";
        addAuthOutDiv = app.cookie("addAuthOutDiv");
        outputdiv = addAuthOutDiv || "contentdiv";
        if(params.oauth_token && params.oauth_verifier) {  //back from twitter
            //on return there is no auth form displayed so use contentdiv
            app.out("contentdiv", "Returned from Twitter...");
            data = "name=Twitter&url=" + app.enc(twTokCnvURL) +
                "&toksec=" + app.cookie(params.oauth_token) +
                "&oauth_token=" + params.oauth_token +
                "&oauth_verifier=" + params.oauth_verifier;
            app.call('POST', "oa1call", data,
                     function (callresults) {
                         twitterAuthComplete(callresults[0]); },
                     app.failf(function (code, errtxt) {
                         app.log("twitter token conversion failed code " +
                                 code + ": " + errtxt);
                         returnToParentDisplay(); }),
                     critsec); }
        else {  //initial login or authorization call
            app.out(outputdiv, "Setting up call to Twitter...");
            data = "name=Twitter&url=" + app.enc(twReqTokURL) + 
                "&oauth_callback=" +
                app.enc("http://www.myopenreviews.com#command=AltAuth1");
            app.call('POST', "oa1call", data,
                     function (callresults) {
                         redirectForLogin(callresults[0]); },
                     app.failf(function (code, errtxt) {
                         app.log("twitter initial oauth failed code " + 
                                 code + ": " + errtxt);
                         returnToParentDisplay(); }),
                     critsec); }
    },


    //Twitter always requires a redirect and callback, so have to
    //track context in a cookie.
    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            alert("Twitter authentication is only supported from ",
                  app.mainsvr);
            return app.profile.displayAuthSettings(domid, pen); }
        app.cookie("addAuthOutDiv", domid, 2);
        authenticate( {} );
    },


    getShareLinkURL = function (review) {
        var text, url;
        text = app.services.getRevStarsTxt(review, "unicode") + " " +
            app.services.getRevTitleTxt(review);
        url = app.services.getRevPermalink(review);
        url = "https://twitter.com/intent/tweet" +
            "?text=" + app.embenc(text) +
            "&url=" + app.enc(url);
        return url;
    },


    getShareOnClickStr = function (review) {
        var str, url, windowOptions, width, height, left, top = 0;
        url = getShareLinkURL(review);
        windowOptions = 'scrollbars=yes,resizable=yes,toolbar=no,location=yes';
        width = 550;
        height = 420;
        left = Math.round((app.winw / 2) - (width / 2));
        if(app.winh > height) {
            top = Math.round((app.winh / 2) - (height / 2)); }
        str = "window.open(" + 
            "'" + url + "', 'intent', " + 
            "'" + windowOptions + ",width=" + width + ",height=" + height + 
                ",left=" + left + ",top=" + top + "');return false;";
        return str;
    };


    return {
        loginurl: "https://www.twitter.com",
        name: svcName,  //no spaces in name, used as an id
        svcDispName: "Tweet",
        svcDesc: "Tweets a condensed review",
        iconurl: "img/tw_logo.png",
        authenticate: function (params) {
            authenticate(params); },
        addProfileAuth: function (domid, pen) {
            addProfileAuth(domid, pen); },
        doInitialSetup: function () {
            app.log("twitter service initial setup done"); },
        getLinkURL: function (review) {
            return getShareLinkURL(review); },
        getOnClickStr: function (review) {
            return getShareOnClickStr(review); },
        getShareImageAlt: function () {
            return "Tweet condensed review"; },
        getShareImageSrc: function () {
            return app.twitter.iconurl; }
    };

});

