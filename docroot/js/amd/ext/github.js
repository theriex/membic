/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . g i t h u b
//
define([], function () {
    "use strict";

    var svcName = "GitHub",
        iconurl = "img/blacktocat-32.png",


    backToParentDisplay = function () {
        var addAuthOutDiv = app.dojo.cookie("addAuthOutDiv");
        if(addAuthOutDiv) {
            return app.pen.getPen(function (pen) {
                app.profile.displayAuthSettings(addAuthOutDiv, pen); }); }
        return app.login.init();
    },


    recordGitHubAuthorization = function (token, json) {
        var prevLoginToken;
        app.out('contentdiv', "Restoring session...");
        prevLoginToken = app.login.readAuthCookie();
        if(!prevLoginToken) {
            app.log("no previous login found on return from GitHub");
            return app.login.init(); }
        app.out('contentdiv', "Recording GitHub authorization...");
        //the last used pen name will be selected authomatically when
        //pen names are loaded
        app.pen.getPen(function (pen) {
            pen.ghid = json.id;
            app.pen.updatePen(pen,
                              function (updpen) {
                                  backToParentDisplay(); },
                              function (code, errtxt) {
                                  app.err("record GitHub auth error " + 
                                          code + ": " + errtxt);
                                  pen.ghid = 0;
                                  backToParentDisplay(); }); });
    },


    handleGitHubLogin = function (token, json) {
        app.out('contentdiv', "<p>Welcome " + json.login + "</p>");
        app.login.setAuth("ghid", token, json.id + " " + json.login);
        //name is not necessarily cool or unique, so not using it as a
        //default pen name value.
        app.login.authComplete();
    },


    convertToken = function (token) {
        var addAuthOutDiv, url, critsec = "";
        addAuthOutDiv = app.dojo.cookie("addAuthOutDiv");
        url = "https://api.github.com/user?access_token=" + token;
        url = app.enc(url);
        url = "jsonget?geturl=" + url;
        app.call(url, 'GET', null,
                 function (json) {
                     if(addAuthOutDiv) {
                         recordGitHubAuthorization(token, json); }
                     else {
                         handleGitHubLogin(token, json); } },
                 function (code, errtxt) {
                     app.log("GitHub authent fetch details failed code " +
                             code + ": " + errtxt);
                     backToParentDisplay(); },
                 critsec);
    },


    //This function gets called when you click "Login via GitHub", and
    //when adding authentication, and on return from GitHub.
    authenticate = function (params) {
        var url, state, critsec = "";
        if(params.code) {  //back from github
            app.out("contentdiv", "Returned from GitHub...");
            state = app.dojo.cookie("githubAuthState");
            if(state !== params.state) {
                app.log("Bad state returned from GitHub. Sent " + state +
                        " got back " + params.state);
                backToParentDisplay(); }
            url = "githubtok?code=" + params.code + "&state=" + state;
            app.call(url, 'GET', null,
                     function (json) {
                         convertToken(json.access_token); },
                     function (code, errtxt) {
                         app.log("GitHub token retrieval failed code " + 
                                 code + ": " + errtxt);
                         backToParentDisplay(); },
                     critsec); }
        else {  //initial login or authorization call
            state = "AltAuth3" + Math.random().toString(36).slice(2);
            app.dojo.cookie("githubAuthState", state, { expires: 2 });
            url = "https://github.com/login/oauth/authorize" +
                "?client_id=5ac4b34b8ae0c21465dc" +
                "&redirect_uri=" + app.enc("http://www.myopenreviews.com/") +
                //no scope (public read-only access)
                "&state=" + state;
            window.location.href = url; }
    },


    addProfileAuth = function (domid, pen) {
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            alert("GitHub authentication is only supported from ",
                  app.mainsvr);
            return app.profile.displayAuthSettings(domid, pen); }
        app.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
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

