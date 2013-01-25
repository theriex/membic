/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . g i t h u b
//
define([], function () {
    "use strict";

    var svcName = "GitHub",
        iconurl = "img/blacktocat-32.png",


    backToParentDisplay = function () {
        var addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return mor.pen.getPen(function (pen) {
                mor.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return mor.login.init();
    },


    recordGitHubAuthorization = function (token, json) {
        var prevLoginToken;
        mor.out('contentdiv', "Restoring session...");
        prevLoginToken = mor.login.readAuthCookie();
        if(!prevLoginToken) {
            mor.log("no previous login found on return from GitHub");
            return mor.login.init(); }
        mor.out('contentdiv', "Recording GitHub authorization...");
        //the last used pen name will be selected authomatically when
        //pen names are loaded
        mor.pen.getPen(function (pen) {
            pen.ghid = json.id;
            mor.pen.updatePen(pen,
                              function (updpen) {
                                  backToParentDisplay(); },
                              function (code, errtxt) {
                                  mor.err("record GitHub auth error " + 
                                          code + ": " + errtxt);
                                  pen.ghid = 0;
                                  backToParentDisplay(); }); });
    },


    handleGitHubLogin = function (token, json) {
        mor.out('contentdiv', "<p>Welcome " + json.login + "</p>");
        mor.login.setAuth("ghid", token, json.id + " " + json.login);
        //name is not necessarily cool or unique, so not using it as a
        //default pen name value.
        mor.login.authComplete();
    },


    convertToken = function (token) {
        var addAuthOutDiv, url;
        addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        url = "https://api.github.com/user?access_token=" + token;
        url = mor.enc(url);
        url = "jsonget?geturl=" + url;
        mor.call(url, 'GET', null,
                 function (json) {
                     if(addAuthOutDiv) {
                         recordGitHubAuthorization(token, json); }
                     else {
                         handleGitHubLogin(token, json); } },
                 function (code, errtxt) {
                     mor.log("GitHub authent fetch details failed code " +
                             code + ": " + errtxt);
                     backToParentDisplay(); });
    },


    //This function gets called when you click "Login via GitHub", and
    //when adding authentication, and on return from GitHub.
    authenticate = function (params) {
        var outputdiv, addAuthOutDiv, url, state;
        addAuthOutDiv = mor.dojo.cookie("addAuthOutDiv");
        outputdiv = addAuthOutDiv || "contentdiv";
        if(params.code) {  //back from github
            mor.out("contentdiv", "Returned from GitHub...");
            state = mor.dojo.cookie("githubAuthState");
            if(state !== params.state) {
                mor.log("Bad state returned from GitHub. Sent " + state +
                        " got back " + params.state);
                backToParentDisplay(); }
            url = "githubtok?code=" + params.code + "&state=" + state;
            mor.call(url, 'GET', null,
                     function (json) {
                         convertToken(json.access_token); },
                     function (code, errtxt) {
                         mor.log("GitHub token retrieval failed code " + 
                                 code + ": " + errtxt);
                         backToParentDisplay(); }); }
        else {  //initial login or authorization call
            state = "AltAuth3" + Math.random().toString(36).slice(2);
            mor.dojo.cookie("githubAuthState", state, { expires: 2 });
            url = "https://github.com/login/oauth/authorize" +
                "?client_id=5ac4b34b8ae0c21465dc" +
                "&redirect_uri=" + mor.enc("http://www.myopenreviews.com/") +
                //no scope (public read-only access)
                "&state=" + state;
            window.location.href = url; }
    },


    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(mor.login.mainServer) !== 0) {
            alert("GitHub authentication is only supported from ",
                  mor.login.mainServer);
            return mor.profile.displayAuthSettings(domid, pen); }
        mor.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
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

