/*global alert: false, window: false, app: false, jt: false, document: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.googleplus = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "GooglePlus",   //ascii with no spaces, used as an id
        dispName = "Google+",     //what should actually be displayed
        svcIconURL = "https://www.gstatic.com/images/icons/gplus-32.png",
        gauth = null;


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
    iconurl: "img/g_logo.png",


    signinCallback: function (authResult) {
        var identurl;
        if(!authResult || !authResult.status) {
            jt.out('gsitd', "Google+ sign-in failed");
            return; }
        if(authResult.status.signed_in) {
            gauth = authResult;
            jt.out('gsitd', "Google+ sign-in success");
            jt.out('gpromptdiv', "Fetching authentication ID and name...");
            identurl = "https://www.googleapis.com/plus/v1/people/me";
            identurl += "?access_token=" + gauth.access_token;
            jt.call('GET', identurl, null,
                    function (resp) {
                        jt.out('gpromptdiv', "Google+ authentication success.");
                        app.login.setAuth("gsid", gauth.access_token,
                                          resp.id + " " + resp.displayName);
                        app.login.authComplete(); },
                    function (code, errtxt) {
                        jt.out('gsitd', "error " + code + ": " + errtxt); },
                    jt.semaphore("login.signinCallback")); }
        else if(authResult.error === "immediate_failed") {
            jt.log("Automatic google+ user login failed"); }
        else {
            jt.out('gpromptdiv', authResult.error); }
    },


    //You get to this function from a direct call when you click the
    //"Login via Google+" href.  A redirect to Google results in a
    //callback with "AltAuth2" returned in the hash fragment, which
    //leads back to this method again.
    authenticate: function (params) {
        var gisdef, html, gscript, firstscript;
        //Callback requires a top level function.
        gisdef = {cla: "g-signin", 
                  "data-callback": "googlePlusAuthCallback",
                  "data-clientid": "98201437720-ckqbapo2h292rdoumjfcvt6814tgbai4.apps.googleusercontent.com",
                  "data-cookiepolicy": "single_host_origin",
                  "data-requestvisibleactions": "http://schema.org/AddAction",
                  "data-scope": "https://www.googleapis.com/auth/plus.login"};
        html = ["div", {id: "gpluslogindiv"},
                [["div", {id: "gpromptdiv"},
                  "Sign in via Google+"],
                 ["table",
                  ["tr",
                   [["td",
                     ["button", {type: "button", id: "cancelbutton",
                                 onclick: jt.fs("app.login.init()")},
                      "Cancel"]],
                    ["td", {id: "gsitd"},
                     ["span", {id: "signinButton"},
                      ["span", gisdef]]]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        gscript = document.createElement('script'); 
        gscript.type = 'text/javascript'; 
        gscript.async = true;
        gscript.src = "https://apis.google.com/js/client:plusone.js";
        firstscript = document.getElementsByTagName('script')[0]; 
        firstscript.parentNode.insertBefore(gscript, firstscript);
        //gscript loads, converts the span to a button, and calls back
    },


    addProfileAuth: function (domid, pen) {
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
        return app.googleplus.iconurl;
    }


};  //end of returned functions
}());

