/*global alert: false, window: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.googleplus = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "GooglePlus",   //ascii with no spaces, used as an id
        dispName = "Google+",     //what should actually be displayed
        iconurl = "https://www.google.com/favicon.ico",
        svcIconURL = "https://www.gstatic.com/images/icons/gplus-32.png",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    backToParentDisplay = function () {
        var addAuthOutDiv = jt.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return app.pen.getPen(function (pen) {
                app.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return app.login.init();
    },


    recordGoogleAuthorization = function (gsid) {
        var prevLoginToken;
        jt.out('contentdiv', "Restoring session...");
        prevLoginToken = app.login.readAuthCookie();
        if(!prevLoginToken) {
            jt.log("no previous login found on return from Google");
            return app.login.init(); }
        jt.out('contentdiv', "Recording Google authorization...");
        //the latest used pen name will be selected automatically when
        //pen names are loaded
        app.pen.getPen(function (pen) {
            pen.gsid = gsid;
            app.pen.updatePen(pen,
                              function (updpen) {
                                  backToParentDisplay(); },
                              function (code, errtxt) {
                                  jt.err("record Google auth error " +
                                          code + ": " + errtxt);
                                  pen.gsid = "0";
                                  backToParentDisplay(); }); });
    },


    validateAuthentication = function (json, token) {
        var addAuthOutDiv, url;
        if("1009259210423.apps.googleusercontent.com" !== json.audience) {
            jt.log("The received token was not intended for this app");
            return backToParentDisplay(); }
        addAuthOutDiv = jt.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            recordGoogleAuthorization(json.user_id); }
        else {
            url = "https://www.googleapis.com/oauth2/v1/userinfo" + 
                "?access_token=" + token;
            url = jt.enc(url);
            url = "jsonget?geturl=" + url;
            jt.call('GET', url, null,
                     function (json) {
                         jt.out('contentdiv', 
                                 "<p>Welcome " + json.name + "</p>");
                         app.login.setAuth("gsid", token, 
                                           json.id + " " + json.name);
                         //name is probably unique, but it's better to
                         //allow for creating a cool pen name without
                         //defaulting it.
                         app.login.authComplete(); },
                     app.failf(function (code, errtxt) {
                         jt.log("Google authent fetch details failed code " +
                                 code + ": " + errtxt);
                         backToParentDisplay(); }),
                    jt.semaphore("googleplus.validateAuthentication")); }
    };
        

    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    loginurl: "https://plus.google.com",
    name: svcName,  //ascii with no spaces, used as an id
    loginDispName: dispName,
    svcDispName: "Google+ Share",
    svcDesc: "Posts a review to your Google+ Stream",
    svcIconURL: svcIconURL,
    iconurl: iconurl,


    //You get to this function from a direct call when you click the
    //"Login via Google+" href.  A redirect to Google results in a
    //callback with "AltAuth2" returned in the hash fragment, which
    //leads back to this method again.
    authenticate: function (params) {
        var url, scope;
        if(params.access_token) {  //back from google
            jt.out("contentdiv", "Returned from Google...");
            url = "https://www.googleapis.com/oauth2/v1/tokeninfo" +
                "?access_token=" + params.access_token;
            url = jt.enc(url);
            url = "jsonget?geturl=" + url;
            jt.call('GET', url, null,
                     function (json) {
                         validateAuthentication(json, params.access_token); },
                     app.failf(function (code, errtxt) {
                         jt.log("Google token retrieval failed code " + 
                                 code + ": " + errtxt);
                         backToParentDisplay(); }),
                    jt.semaphore("googleplus.authenticate")); }
        else { //initial login or authorization call
            scope = "https://www.googleapis.com/auth/userinfo.profile";
            url = "https://accounts.google.com/o/oauth2/auth" +
                "?response_type=token" +
                "&client_id=1009259210423.apps.googleusercontent.com" +
                "&redirect_uri=" + jt.enc("http://www.fgfweb.com/") +
                "&scope=" + jt.enc(scope) +
                "&state=AltAuth2";
            window.location.href = url; }
    },


    //Google requires a redirect and callback, so track context in
    //a cookie.  Because cookies are domain dependent, this only 
    //works from the main server.
    addProfileAuth: function (domid, pen) {
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            alert("Google+ authentication is only supported from ",
                  app.mainsvr);
            return app.profile.displayAuthSettings(domid, pen); }
        jt.cookie("addAuthOutDiv", domid, 2);
        app.googleplus.authenticate( {} );
    },


    doInitialSetup: function () {
        jt.log("google+ service initial setup done");
    },


    getLinkURL: function (review) {
        var url = "http://www.fgfweb.com/statrev/" + jt.instId(review);
        url = "https://plus.google.com/share?url=" + jt.enc(url);
        return url;
    },


    getOnClickStr: function () {
        var str = "window.open(this.href,  ''," + 
            " 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes," + 
            "height=600,width=600');return false;";
        return str;
    },


    getShareImageAlt: function () {
        return "Post to your Google+ stream";
    },


    getShareImageSrc: function () {
        return svcIconURL;
    }


};  //end of returned functions
}());

