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
        tmprev = null,


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
        var data, outputdiv, addAuthOutDiv;
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
                         returnToParentDisplay(); }); }
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
                         returnToParentDisplay(); }); }
    },


    //Twitter always requires a redirect and callback, so have to
    //track context in a cookie.
    addProfileAuth = function (domid, pen) {
        mor.dojo.cookie("addAuthOutDiv", domid, { expires: 2 });
        authenticate( {} );
    },


    dismissDialog = function (review, action) {
        var odiv = mor.byId('overlaydiv');
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
        if(!review) {
            review = tmprev; }
        if(!action) {
            action = 'bailout'; }
        review.svcdata[svcName] = action;
        mor.pen.getPen(function (pen) {
            mor.services.runServices(pen, review); });
    },


    getTweetLinkHTML = function (review) {
        var html, url, text, windowOptions, width, height, left, top = 0;
        windowOptions = 'scrollbars=yes,resizable=yes,toolbar=no,location=yes';
        width = 550;
        height = 420;
        left = Math.round((mor.winw / 2) - (width / 2));
        if(mor.winh > height) {
            top = Math.round((mor.winh / 2) - (height / 2)); }
        url = "http://www.myopenreviews.com/#view=profile" + 
            "&profid=" + review.penid;
        text = "[" + mor.services.getRevStarsTxt(review) + "] " +
            mor.services.getRevTitleTxt(review);
        html = "<p>Click to tweet your review...</p><table><tr>" +
            "<td><button type=\"button\" id=\"tweetbutton\"" +
               " onclick=\"mor.twitter.dismissDialog(null,'clicked');" +
                          "window.open('https://twitter.com/intent/tweet" +
                                  "?text=" + mor.embenc(text) +
                                  "&url=" + mor.enc(url) + 
                                  "'" +
                              ", 'intent'" +
                              ", '" + windowOptions +
                              ",width=" + width +
                              ",height=" + height + 
                              ",left=" + left +
                              ",top=" + top + "');" +
                          "return false;\"" +
                "><img class=\"loginico\"" + 
                     " src=\"" + mor.twitter.iconurl + "\"" +
                     " border=\"0\"/>&nbsp;Tweet&nbsp;</button></td>" +
            "<td>&nbsp;" + 
              "<button type=\"button\" id=\"cancelbutton\"" +
                     " onclick=\"mor.twitter.dismissDialog();return false;\"" +
              ">Cancel</button></td>" +
            "</tr></table>";
        return html;
    },



    //Tweeting is best done through twitter's web intents, but those
    //require an explicit click to do a popup window, which is an
    //extra click.  Including platform.twitter.com/widgets.js is more
    //hassle than it's worth since you have to do events separately.
    //This adapts the alternative approach given at the end of
    //https://dev.twitter.com/docs/intents
    tweetReview = function (review) {
        var html, odiv;
        tmprev = review;
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = function () {
            dismissDialog(review, "bailout"); };
        html = getTweetLinkHTML(review);
        odiv.innerHTML = html;
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
        doPost: function (review) {
            tweetReview(review); },
        dismissDialog: function (review, action) {
            dismissDialog(review, action); }
    };

});

