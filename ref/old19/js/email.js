/*global app, jt */

/*jslint white, fudge */

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
        var text;
        text = "Hi,\n\nSending along one of my " + review.revtype + 
            " reviews in case you find it helpful:\n\n" + 
            app.services.getRevTitleTxt(review) + "\n" +
            "[" + review.revtype + "] " +
            app.services.getRevStarsTxt(review, "txtexp") + "\n" +
            review.text + "\n\n" +
            "If you want to remember this review for later, just click " +
            "the link off the full review page: " +
            app.services.getRevPermalink(review) + 
            "\n\ncheers,\n" + app.pen.myPenName().name + "\n";
        return text;
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

