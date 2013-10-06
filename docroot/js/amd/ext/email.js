/*global app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.email = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "email",  //no spaces in name, used as an id
        iconurl = "img/email.png",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    //Putting stars in the subject makes it resemble spam, so don't do
    //that.  Also consider what the text will look like with "re: " or
    //"fwd: " in front of it.
    getSubject = function (review) {
        return "Review of " + app.services.getRevTitleTxt(review);
    },


    //Unicode stars look nicer, but they don't make it through on
    //many clients if reading text only, and the escape characters
    //look terrible when composing the message.  KISS.
    getBody = function (review) {
        return "\n\nThis is my review from wdydfun:\n\n" + 
            app.services.getRevTitleTxt(review) + "\n" +
            "[" + review.revtype + "] " +
            app.services.getRevStarsTxt(review, "txtexp") + "\n" +
            review.text + "\n\n" +
            "To see my full review, go to\n" +
            app.services.getRevPermalink(review) + "\n";
    };


    ////////////////////////////////////////
    // returned functions
    ////////////////////////////////////////
return {

    name: svcName,
    svcDesc: "Prepares an email message for you to edit and send",
    iconurl: iconurl,

    doInitialSetup: function () {
        jt.log("email service initial setup done");
    },


    getLinkURL: function (review) {
        var subject, body, html;
        subject = getSubject(review);
        body = getBody(review);
        html = "mailto:?subject=" + jt.dquotenc(subject) +
            "&body=" + jt.dquotenc(body);
        return html; 
    },


    getOnClickStr: function () {
        return "";
    },


    getShareImageAlt: function () {
        return "Send via eMail";
    },


    getShareImageSrc: function () {
        return iconurl;
    }

};  //end of returned functions
}());

