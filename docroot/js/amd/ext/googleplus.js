/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . g o o g l e p l u s
//
define([], function () {
    "use strict";

    var svcName = "GooglePlus",   //ascii with no spaces, used as an id
        dispName = "Google+",     //what should actually be displayed
        iconurl = "https://www.google.com/favicon.ico",
        svcIconURL = "https://www.gstatic.com/images/icons/gplus-32.png",


    backToParentDisplay = function () {
        var addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return mor.pen.getPen(function (pen) {
                mor.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return mor.login.init();
    },


    recordGoogleAuthorization = function (gsid) {
        var prevLoginToken;
        mor.out('contentdiv', "Restoring session...");
        prevLoginToken = mor.login.readAuthCookie();
        if(!prevLoginToken) {
            mor.log("no previous login found on return from Google");
            return mor.login.init(); }
        mor.out('contentdiv', "Recording Google authorization...");
        //the latest used pen name will be selected automatically when
        //pen names are loaded
        mor.pen.getPen(function (pen) {
            pen.gsid = gsid;
            mor.pen.updatePen(pen,
                              function (updpen) {
                                  backToParentDisplay(); },
                              function (code, errtxt) {
                                  mor.err("record Google auth error " +
                                          code + ": " + errtxt);
                                  pen.gsid = "0";
                                  backToParentDisplay(); }); });
    },


    validateAuthentication = function (json, token) {
        var addAuthOutDiv, url, critsec = "";
        if("1009259210423.apps.googleusercontent.com" !== json.audience) {
            mor.log("The received token was not intended for this app");
            return backToParentDisplay(); }
        addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            recordGoogleAuthorization(json.user_id); }
        else {
            url = "https://www.googleapis.com/oauth2/v1/userinfo" + 
                "?access_token=" + token;
            url = mor.enc(url);
            url = "jsonget?geturl=" + url;
            mor.call(url, 'GET', null,
                     function (json) {
                         mor.out('contentdiv', 
                                 "<p>Welcome " + json.name + "</p>");
                         mor.login.setAuth("gsid", token, 
                                           json.id + " " + json.name);
                         //name is probably unique, but it's better to
                         //allow for creating a cool pen name without
                         //defaulting it.
                         mor.login.authComplete(); },
                     function (code, errtxt) {
                         mor.log("Google authent fetch details failed code " +
                                 code + ": " + errtxt);
                         backToParentDisplay(); },
                     critsec); }
    },
        


    //You get to this function from a direct call when you click the
    //"Login via Google+" href.  A redirect to Google results in a
    //callback with "AltAuth2" returned in the hash fragment, which
    //leads back to this method again.
    authenticate = function (params) {
        var url, scope, critsec = "";
        if(params.access_token) {  //back from google
            mor.out("contentdiv", "Returned from Google...");
            url = "https://www.googleapis.com/oauth2/v1/tokeninfo" +
                "?access_token=" + params.access_token;
            url = mor.enc(url);
            url = "jsonget?geturl=" + url;
            mor.call(url, 'GET', null,
                     function (json) {
                         validateAuthentication(json, params.access_token); },
                     function (code, errtxt) {
                         mor.log("Google token retrieval failed code " + 
                                 code + ": " + errtxt);
                         backToParentDisplay(); },
                     critsec); }
        else { //initial login or authorization call
            scope = "https://www.googleapis.com/auth/userinfo.profile";
            url = "https://accounts.google.com/o/oauth2/auth" +
                "?response_type=token" +
                "&client_id=1009259210423.apps.googleusercontent.com" +
                "&redirect_uri=" + mor.enc("http://www.myopenreviews.com/") +
                "&scope=" + mor.enc(scope) +
                "&state=AltAuth2";
            window.location.href = url; }
    },


    //Google requires a redirect and callback, so track context in
    //a cookie.  Because cookies are domain dependent, this only 
    //works from the main server.
    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(mor.mainsvr) !== 0) {
            alert("Google+ authentication is only supported from ",
                  mor.mainsvr);
            return mor.profile.displayAuthSettings(domid, pen); }
        mor.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
        authenticate( {} );
    },


    getShareLinkURL = function (review) {
        var url = "http://www.myopenreviews.com/statrev/" + mor.instId(review);
        url = "https://plus.google.com/share?url=" + mor.enc(url);
        return url;
    },


    getShareOnClickStr = function () {
        var str = "window.open(this.href,  ''," + 
            " 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes," + 
            "height=600,width=600');return false;";
        return str;
    };


    return {
        loginurl: "https://plus.google.com",
        name: svcName,  //ascii with no spaces, used as an id
        loginDispName: dispName,
        svcDispName: "Google+ Share",
        svcDesc: "Posts a review to your Google+ Stream",
        svcIconURL: svcIconURL,
        iconurl: iconurl,
        authenticate: function (params) {
            authenticate(params); },
        addProfileAuth: function (domid, pen) {
            addProfileAuth(domid, pen); },
        doInitialSetup: function () {
            mor.log("google+ service initial setup done"); },
        getLinkURL: function (review) {
            return getShareLinkURL(review); },
        getOnClickStr: function () {
            return getShareOnClickStr(); },
        getShareImageAlt: function () {
            return "Post to your Google+ stream"; },
        getShareImageSrc: function () {
            return svcIconURL; }
    };

});

