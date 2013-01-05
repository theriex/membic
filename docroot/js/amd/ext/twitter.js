/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . t w i t t e r
//
define([], function () {
    "use strict";

    var svcName = "Twitter",  //no spaces in name, used as an id
        reqTokURL = "https://api.twitter.com/oauth/request_token",
        tokCnvURL = "https://api.twitter.com/oauth/access_token",


    addProfileAuth = function (domid, pen) {
        mor.err("Not implemented yet");
    },


    redirectForLogin = function (oaparas) {
        var token, secret, confirmed, url;
        oaparas = mor.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        confirmed = oaparas.oauth_callback_confirmed;
        if(confirmed && token && secret) {
            //save secret so it can be accessed on callback
            mor.dojo.cookie(token, secret, { expires: 60*60*24*365 });
            url = "http://api.twitter.com/oauth/authenticate?oauth_token=" +
                token;
            window.location.href = url; }
        else {
            mor.log("request token returned from twitter not valid: " + 
                    confirmed + " " + token + " " + secret);
            mor.login.init(); }
    },
                             

    twitterAuthComplete = function (oaparas) {
        var token, secret, id, name, html;
        oaparas = mor.paramsToObj(oaparas.content);
        token = oaparas.oauth_token;
        secret = oaparas.oauth_token_secret;
        id = oaparas.user_id;
        name = oaparas.screen_name;
        html = "<p>&nbsp;</p><p>Welcome " + name + "</p>";
        mor.out('contendiv', html);
        mor.login.setAuth("twid", token, id + " " + name);
        mor.dojo.cookie(token, secret, { expires: 60*60*24*365 });
        //The twitter name is somewhat likely to be unique, but it is
        //not necessarily the best default pen name.  Encourage creativity.
        mor.login.authComplete();
    },


    //Surfing to http://www.myopenreviews.com#command=AltAuth1 transfers 
    //control to here.  This is both the redirect, and the callback URL.
    //If twitter redirected to here then 
    authenticate = function (params) {
        var data;
        if(params.oauth_token && params.oauth_verifier) {  //back from twitter
            data = "name=Twitter&url=" + mor.enc(tokCnvURL) +
                "&toksec=" + mor.dojo.cookie(params.oauth_token) +
                "&oauth_token=" + params.oauth_token +
                "&oauth_verifier=" + params.oauth_verifier;
            mor.call("oa1call", 'POST', data,
                     function (callresults) {
                         twitterAuthComplete(callresults[0]); },
                     function (code, errtxt) {
                         mor.log("twitter token conversion failed code " +
                                 code + ": " + errtxt);
                         mor.login.init(); }); }
        else {  //initial call
            data = "name=Twitter&url=" + mor.enc(reqTokURL) + 
                "&oauth_callback=" +
                mor.enc("http://www.myopenreviews.com#command=AltAuth1");
            mor.call("oa1call", 'POST', data,
                     function (callresults) {
                         redirectForLogin(callresults[0]); },
                     function (code, errtxt) {
                         mor.log("twitter initial oauth failed code " + 
                                 code + ": " + errtxt);
                         mor.login.init(); }); }
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
            addProfileAuth(domid, pen); }
    };

});

