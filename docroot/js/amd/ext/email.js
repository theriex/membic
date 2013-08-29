/*global define: false, alert: false, console: false, window: false, document: false, history: false, glo: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . e m a i l
//
define([], function () {
    "use strict";

    var svcName = "email",  //no spaces in name, used as an id
        iconurl = "img/email.png",


    //Putting stars in the subject makes it resemble spam, so don't do
    //that.  Also consider what the text will look like with "re: " or
    //"fwd: " in front of it.
    getSubject = function (review) {
        return "Review of " + glo.services.getRevTitleTxt(review);
    },


    //Unicode stars look nicer, but they don't make it through on
    //many clients if reading text only, and the escape characters
    //look terrible when composing the message.  KISS.
    getBody = function (review) {
        return "\n\nThis my review from MyOpenReviews:\n\n" + 
            glo.services.getRevTitleTxt(review) + "\n" +
            "[" + review.revtype + "] " +
            glo.services.getRevStarsTxt(review, "txtexp") + "\n" +
            review.text + "\n\n" +
            "To see my full review, go to\n" +
            glo.services.getRevPermalink(review) + "\n";
    },


    getLinkURL = function (review) {
        var subject, body, html;
        subject = getSubject(review);
        body = getBody(review);
        html = "mailto:?subject=" + glo.dquotenc(subject) +
            "&body=" + glo.dquotenc(body);
        return html; 
    };


    return {
        name: svcName,
        svcDesc: "Fills out an email for you to send",
        iconurl: iconurl,
        doInitialSetup: function () {
            glo.log("email service initial setup done"); },
        getLinkURL: function (review) {
            return getLinkURL(review); },
        getOnClickStr: function () {
            return ""; },
        getShareImageAlt: function () {
            return "Send via eMail"; },
        getShareImageSrc: function () {
            return iconurl; }
    };

});

