/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . g i t h u b
//
define([], function () {
    "use strict";

    var svcName = "GitHub",
        iconurl = "img/blacktocat-32.png",


    backToParentDisplay = function () {
        var addAuthOutDiv = glo.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return glo.pen.getPen(function (pen) {
                glo.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return glo.login.init();
    },


    recordGitHubAuthorization = function (token, json) {
        var prevLoginToken;
        glo.out('contentdiv', "Restoring session...");
        prevLoginToken = glo.login.readAuthCookie();
        if(!prevLoginToken) {
            glo.log("no previous login found on return from GitHub");
            return glo.login.init(); }
        glo.out('contentdiv', "Recording GitHub authorization...");
        //the last used pen name will be selected authomatically when
        //pen names are loaded
        glo.pen.getPen(function (pen) {
            pen.ghid = json.id;
            glo.pen.updatePen(pen,
                              function (updpen) {
                                  backToParentDisplay(); },
                              function (code, errtxt) {
                                  glo.err("record GitHub auth error " + 
                                          code + ": " + errtxt);
                                  pen.ghid = 0;
                                  backToParentDisplay(); }); });
    },


    handleGitHubLogin = function (token, json) {
        glo.out('contentdiv', "<p>Welcome " + json.login + "</p>");
        glo.login.setAuth("ghid", token, json.id + " " + json.login);
        //name is not necessarily cool or unique, so not using it as a
        //default pen name value.
        glo.login.authComplete();
    },


    convertToken = function (token) {
        var addAuthOutDiv, url, critsec = "";
        addAuthOutDiv = glo.dojo.cookie("addAuthOutDiv");
        url = "https://api.github.com/user?access_token=" + token;
        url = glo.enc(url);
        url = "jsonget?geturl=" + url;
        glo.call(url, 'GET', null,
                 function (json) {
                     if(addAuthOutDiv) {
                         recordGitHubAuthorization(token, json); }
                     else {
                         handleGitHubLogin(token, json); } },
                 function (code, errtxt) {
                     glo.log("GitHub authent fetch details failed code " +
                             code + ": " + errtxt);
                     backToParentDisplay(); },
                 critsec);
    },


    //This function gets called when you click "Login via GitHub", and
    //when adding authentication, and on return from GitHub.
    authenticate = function (params) {
        var url, state, critsec = "";
        if(params.code) {  //back from github
            glo.out("contentdiv", "Returned from GitHub...");
            state = glo.dojo.cookie("githubAuthState");
            if(state !== params.state) {
                glo.log("Bad state returned from GitHub. Sent " + state +
                        " got back " + params.state);
                backToParentDisplay(); }
            url = "githubtok?code=" + params.code + "&state=" + state;
            glo.call(url, 'GET', null,
                     function (json) {
                         convertToken(json.access_token); },
                     function (code, errtxt) {
                         glo.log("GitHub token retrieval failed code " + 
                                 code + ": " + errtxt);
                         backToParentDisplay(); },
                     critsec); }
        else {  //initial login or authorization call
            state = "AltAuth3" + Math.random().toString(36).slice(2);
            glo.dojo.cookie("githubAuthState", state, { expires: 2 });
            url = "https://github.com/login/oauth/authorize" +
                "?client_id=5ac4b34b8ae0c21465dc" +
                "&redirect_uri=" + glo.enc("http://www.myopenreviews.com/") +
                //no scope (public read-only access)
                "&state=" + state;
            window.location.href = url; }
    },


    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(glo.mainsvr) !== 0) {
            alert("GitHub authentication is only supported from ",
                  glo.mainsvr);
            return glo.profile.displayAuthSettings(domid, pen); }
        glo.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
        authenticate( {} );
    };


    return {
        loginurl: "https://github.com",
        name: svcName, //ascii with no spaces, used as an id
        iconurl: iconurl,
        authenticate: function (params) {
            authenticate(params); },
        addProfileAuth: function (domid, pen) {
            addProfileAuth(domid, pen); }
    };

});

