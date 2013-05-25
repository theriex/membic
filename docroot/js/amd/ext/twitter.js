/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

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
        var addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return mor.pen.getPen(function (pen) {
                mor.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return mor.login.init();
    },


    redirectForLogin = function (oaparas) {
        var token, secret, confirmed, url;
        oaparas = mor.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        confirmed = oaparas.oauth_callback_confirmed;
        if(confirmed && token && secret) {
            //save secret so it can be accessed on callback
            mor.dojo.cookie(token, secret, { expires: 2 });
            url = twLoginURL + "?oauth_token=" + token;
            window.location.href = url; }
        else {
            mor.log("Request token returned from Twitter not valid: " + 
                    confirmed + " " + token + " " + secret);
            returnToParentDisplay(); }
    },
                             

    recordTwitterAuthorization = function (twid) {
        var prevLoginToken;
        mor.out('contentdiv', "Restoring session...");
        prevLoginToken = mor.login.readAuthCookie();
        if(!prevLoginToken) {
            mor.log("no previous login found on return from Twitter");
            return mor.login.init(); }
        mor.out('contentdiv', "Recording Twitter authorization...");
        //the latest used pen name will be selected automatically when
        //pen names are loaded.
        mor.pen.getPen(function (pen) {
            pen.twid = twid;
            mor.pen.updatePen(pen,
                              function (updpen) {
                                  returnToParentDisplay(); },
                              function (code, errtxt) {
                                  mor.err("twitterAuthComplete error " +
                                          code + ": " + errtxt);
                                  pen.twid = 0;
                                  returnToParentDisplay(); }); });
    },


    //After returning from Twitter, use the main contentdiv for all messages.
    twitterAuthComplete = function (oaparas) {
        var token, secret, id, name, addAuthOutDiv;
        addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        oaparas = mor.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        mor.dojo.cookie(token, secret, { expires: 365 });
        mor.dojo.cookie("addAuthOutDiv", "", { expires: -1 });
        id = oaparas.user_id;
        name = oaparas.screen_name;
        if(addAuthOutDiv) {
            recordTwitterAuthorization(id); }
        else {
            mor.out('contentdiv', "<p>&nbsp;</p><p>Welcome " + name + "</p>");
            mor.login.setAuth("twid", token, id + " " + name);
            //The twitter name is probably unique, but it's better to
            //allow for entry of a creative pen name without defaulting it.
            mor.login.authComplete(); }
    },


    //Surfing to http://www.myopenreviews.com#command=AltAuth1 leads
    //to this function, which is used for both the "log in via
    //twitter" click, and the callback from twitter.
    authenticate = function (params) {
        var data, outputdiv, addAuthOutDiv, critsec = "";
        addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        outputdiv = addAuthOutDiv || "contentdiv";
        if(params.oauth_token && params.oauth_verifier) {  //back from twitter
            //on return there is no auth form displayed so use contentdiv
            mor.out("contentdiv", "Returned from Twitter...");
            data = "name=Twitter&url=" + mor.enc(twTokCnvURL) +
                "&toksec=" + mor.dojo.cookie(params.oauth_token) +
                "&oauth_token=" + params.oauth_token +
                "&oauth_verifier=" + params.oauth_verifier;
            mor.call("oa1call", 'POST', data,
                     function (callresults) {
                         twitterAuthComplete(callresults[0]); },
                     function (code, errtxt) {
                         mor.log("twitter token conversion failed code " +
                                 code + ": " + errtxt);
                         returnToParentDisplay(); },
                     critsec); }
        else {  //initial login or authorization call
            mor.out(outputdiv, "Setting up call to Twitter...");
            data = "name=Twitter&url=" + mor.enc(twReqTokURL) + 
                "&oauth_callback=" +
                mor.enc("http://www.myopenreviews.com#command=AltAuth1");
            mor.call("oa1call", 'POST', data,
                     function (callresults) {
                         redirectForLogin(callresults[0]); },
                     function (code, errtxt) {
                         mor.log("twitter initial oauth failed code " + 
                                 code + ": " + errtxt);
                         returnToParentDisplay(); },
                     critsec); }
    },


    //Twitter always requires a redirect and callback, so have to
    //track context in a cookie.
    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(mor.mainsvr) !== 0) {
            alert("Twitter authentication is only supported from ",
                  mor.mainsvr);
            return mor.profile.displayAuthSettings(domid, pen); }
        mor.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
        authenticate( {} );
    },


    getShareLinkURL = function (review) {
        var text, url;
        text = mor.services.getRevStarsTxt(review, "unicode") + " " +
            mor.services.getRevTitleTxt(review);
        url = mor.services.getRevPermalink(review);
        url = "https://twitter.com/intent/tweet" +
            "?text=" + mor.embenc(text) +
            "&url=" + mor.enc(url);
        return url;
    },


    getShareOnClickStr = function (review) {
        var str, url, windowOptions, width, height, left, top = 0;
        url = getShareLinkURL(review);
        windowOptions = 'scrollbars=yes,resizable=yes,toolbar=no,location=yes';
        width = 550;
        height = 420;
        left = Math.round((mor.winw / 2) - (width / 2));
        if(mor.winh > height) {
            top = Math.round((mor.winh / 2) - (height / 2)); }
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
            mor.log("twitter service initial setup done"); },
        getLinkURL: function (review) {
            return getShareLinkURL(review); },
        getOnClickStr: function (review) {
            return getShareOnClickStr(review); },
        getShareImageAlt: function () {
            return "Tweet condensed review"; },
        getShareImageSrc: function () {
            return mor.twitter.iconurl; }
    };

});

