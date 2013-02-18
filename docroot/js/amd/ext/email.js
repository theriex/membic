/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . e m a i l
//
define([], function () {
    "use strict";

    var svcName = "email",  //no spaces in name, used as an id
        iconurl = "img/email.png",
        tmprev = null,


    getSubject = function (review) {
        return "[" + mor.services.getRevStarsTxt(review) + "] " +
            mor.services.getRevTitleTxt(review);
    },


    getBody = function (review) {
        return review.text + "\n\nhttp://www.myopenreviews.com/statrev/" +
            mor.instId(review);
    },


    dismissDialog = function () {
        var review, odiv = mor.byId('overlaydiv');
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
        review = tmprev;
        review.svcdata[svcName] = "done";
        mor.pen.getPen(function (pen) {
            mor.services.runServices(pen, review); });
    },


    getPostHTML = function (review) {
        var html, subj, body;
        tmprev = review;
        subj = getSubject(review);
        body = getBody(review);
        html = "<p>Click to email your review...</p><table><tr><td>" +
            "<a href=\"mailto:?subject=" + mor.dquotenc(subj) + 
                             "&body=" + mor.dquotenc(body) + "\"" + 
              "><img src=\"" + iconurl + "\" border=\"0\"></a>" +
          "</td><td>&nbsp;&nbsp;&nbsp;&nbsp;" +
            "<button type=\"button\" id=\"donebutton\"" +
                   " onclick=\"mor.email.dismissDialog();return false;\"" +
            ">Done</button>" +
          "</td></tr></table>";
        return html;
    },


    doPost = function (review) {
        var odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = function () {
            dismissDialog(review, "bailout"); };
        odiv.innerHTML = getPostHTML(review);
    };


    return {
        name: svcName,
        svcDesc: "Fills out an email for you to send",
        iconurl: iconurl,
        doPost: function (review) {
            doPost(review); },
        dismissDialog: function () {
            dismissDialog(); }
    };

});

