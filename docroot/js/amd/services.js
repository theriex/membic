/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . s e r v i c e s 
//
define([], function () {
    "use strict";

    var connServices,
        svcstates = [ "enabled",     //normal icon, 3rd party script loaded
                      "disabled",    //share icon greyed, no 3p script loaded
                      "on click" ],  //click to load 3p script and enable
        svcmsgdiv = "",


    serviceIconHTML = function (svc) {
        var iconurl, html = "";
        iconurl = svc.svcIconURL || svc.iconurl;
        if(iconurl) {
            html += "<img class=\"svcico\" src=\"";
            if(iconurl.indexOf("http") === 0) {
                html += iconurl; }
            else if(iconurl.indexOf("img") === 0) {
                html += iconurl; }
            else {
                html += "svcpic?serviceid=" + svc.name; }
            html += "\"/>"; }
        return html;
    },


    findServiceByName = function (name) {
        var i, svc;
        for(i = 0; i < connServices.length; i += 1) {
            if(connServices[i].name === name) {
                svc = connServices[i];
                break; } }
        if(svc && ! svc.svcDispName) {
            svc.svcDispName = svc.name; }
        return svc;
    },


    getRevTitleTxt = function (review) {
        var title, type;
        type = app.review.getReviewTypeByValue(review.revtype);
        title = review[type.key];
        if(type.subkey) {
            title += ", " + review[type.subkey]; }
        return title;
    },


    getRevTypeImage = function (review) {
        var type = app.review.getReviewTypeByValue(review.revtype);
        return "http://www.myopenreviews.com/img/" + type.img;
    },


    getRevStarsTxt = function (review, format) {
        var txt, starsobj, expl;
        starsobj = app.review.starRating(review.rating, false);
        expl = "(" + starsobj.roundnum + " " + 
            (starsobj.roundnum === 1? "star" : "stars") + ")";
        if(format === "combo") {
            txt = starsobj.unihtml + " " + expl; }
        else if(format === "txtexp") {
            txt = starsobj.asterisks + " " + expl; }
        else if(format === "numeric") {
            txt = expl; }
        else if(format === "unicode") {
            txt = starsobj.unicode; }
        else {
            txt = starsobj.asterisks; }
        return txt;
    },


    toggleDescription = function (divid) {
        var div = app.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    },


    changestate = function (name, pen) {
        var sel, conf, i;
        app.pen.deserializeFields(pen);
        sel = app.byId(name + "sel");
        if(sel) {
            for(i = 0; !conf && i < pen.settings.consvcs.length; i += 1) {
                if(pen.settings.consvcs[i].name === name) {
                    conf = pen.settings.consvcs[i]; } }
            if(conf) {
                conf.state = svcstates[sel.selectedIndex]; } }
    },


    getConnSvcRowHTML = function (conf) {
        var i, html, svc;
        svc = findServiceByName(conf.name);
        html = "<tr><td>";
        html += serviceIconHTML(svc);
        html += "</td><td>" + 
            "<select id=\"" + svc.name + "sel\"" + 
            " onchange=\"app.services.changestate('" + svc.name + "');" +
                       "return false;\"" +
            ">";
        for(i = 0; i < svcstates.length; i += 1) {
            html += "<option id=\"" + conf.name + (+i) + "\"";
            if(conf.state === svcstates[i]) {
                html += " selected=\"selected\""; }
            html += ">" + svcstates[i] + "</option>"; }
        html += "</select></td>" +
            "<td><a href=\"#" + svc.svcDispName + "\"" +
                  " title=\"" + app.ellipsis(svc.svcDesc, 65) + "\"" +
                  " onclick=\"app.services.toggleDesc('svcdescdiv" +
                             svc.name + "');return false;\">" +
                    svc.svcDispName + "</a>" + 
              "<div id=\"svcdescdiv" + svc.name + "\"" +
                  " style=\"display:none;\">" + app.linkify(svc.svcDesc) + 
              "</div>" +
            "</td></tr>";
        return html;
    },


    displaySettings = function (domid, pen) {
        var i, html = "Posting Services: <table>";
        app.pen.deserializeFields(pen);
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                html += getConnSvcRowHTML(pen.settings.consvcs[i]); } }
        else {
            html += "<tr><td>No posting services available</td></tr>"; }
        html += "</table>";
        app.out(domid, html);
    },


    serviceLinkHTML = function (url, clickstr, imgclass, alt, src) {
        var html = "<a href=\"" + url + "\"" + 
                     " title=\"" + alt + "\"" +
                     " onclick=\"" + clickstr + "\">" +
            "<img class=\"" + imgclass + "\"" +
                " alt=\"" + alt + "\"" +
                " src=\"" + src + "\"" +
                " border=\"0\"" +
            "/></a>";
        return html;
    },


    initShareDisplay = function (buttondiv, msgdiv, pen, review) {
        var i, conf, svc, imgclass, svcact, html = "";
        app.pen.deserializeFields(pen);
        if(!review.svcdata) {
            review.svcdata = {}; }
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            html = "<table id=\"svcbuttontable\"><tr>";
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                conf = pen.settings.consvcs[i];
                svc = findServiceByName(conf.name);
                imgclass = "shareicodis";
                svcact = { url: "#disabled",
                           clickstr: "" };
                if(conf.state === svcstates[0]) {  //enabled
                    setTimeout(svc.doInitialSetup, 50);
                    svcact.url = svc.getLinkURL(review);
                    svcact.clickstr = svc.getOnClickStr(review);
                    imgclass = "shareico"; }
                else if(conf.state === svcstates[2]) {  //on click
                    svcact.url = "#disabled, click to enable";
                    svcact.clickstr = "app.services.enable('" + 
                        conf.name + "');return false;"; }
                html += "<td id=\"" + svc.name + "td\">" + 
                    serviceLinkHTML(svcact.url, svcact.clickstr, imgclass,
                                    svc.getShareImageAlt(), 
                                    svc.getShareImageSrc()) + "</td>"; }
            html += "</tr></table>"; }
        app.out(buttondiv, html);
    },


    enablePostingService = function (svcname) {
        var svc, review, link;
        review = app.review.getCurrentReview();
        svc = findServiceByName(svcname);
        setTimeout(svc.doInitialSetup, 50);
        link = serviceLinkHTML(svc.getLinkURL(review),
                               svc.getOnClickStr(review),
                               "shareico",
                               svc.getShareImageAlt(),
                               svc.getShareImageSrc());
        app.out(svc.name + "td", link);
    },


    //Could have bad configs due to misconfiguration, versioning etc.
    //A service must provide:
    //  name: unique across services, used as a dom id and lookup key
    //  loginurl: url to login to the service, or get info about it
    //  svcDesc: short text describing what the service does
    //Optional fields provided by a service
    //  iconurl: url for an icon image used to help identify the service
    //  svcDispName: display name for service, (defaults to name)
    //A configured service must provide the unique service name, and a
    //the service state.  If no state, then it is assumed to be new.
    validServiceConfig = function (confsvc) {
        var i, knownstate = false;
        //the service name is a unique identifier of what to run.  If that
        //is not specified then the service can't be found.
        if(typeof confsvc.name !== 'string') {
            return false; }
        //earlier bad data has "status" instead of "state".  Clear that.
        if(confsvc.status) {
            return false; }
        //correct and default any bad state values
        if(typeof confsvc.state !== 'string') {
            confsvc.state = svcstates[0]; }
        for(i = 0; i < svcstates.length; i += 1) {
            if(confsvc.state === svcstates[i]) {
                knownstate = true; 
                break; } }
        if(!knownstate) {
            confsvc.state = svcstates[0]; }
        return true;
    },


    //helpful to preserve the ordering of any defined service configs
    mergeConnectionServices = function (pen, contfunc) {
        var updconfs, i, j, svc, conf, found;
        updconfs = [];
        app.pen.deserializeFields(pen);
        if(!pen.settings.consvcs) {
            pen.settings.consvcs = []; }
        //add existing configs that are still defined
        for(i = 0; i < pen.settings.consvcs.length; i += 1) {
            conf = pen.settings.consvcs[i];
            if(validServiceConfig(conf)) {
                for(j = 0; j < connServices.length; j += 1) {
                    svc = connServices[j];
                    if(conf.name === svc.name) {
                        updconfs.push(conf); } } } }
        //add configs for new services not previously configured
        for(i = 0; i < connServices.length; i += 1) {
            svc = connServices[i];
            found = false;
            for(j = 0; !found && j < pen.settings.consvcs.length; j += 1) {
                conf = pen.settings.consvcs[j];
                if(conf.name === svc.name && validServiceConfig(conf)) {
                    found = true; } }
            if(!found) {
                conf = { name: svc.name, state: svcstates[0] };
                updconfs.push(conf); } }
        pen.settings.consvcs = updconfs;
        contfunc();
    },


    verifyConnectionServices = function (pen, callback) {
        if(connServices) {
            return mergeConnectionServices(pen, callback); }
        require([ "ext/facebook", "ext/twitter", "ext/googleplus",
                  "ext/email" ],
                function (facebook, twitter, googleplus, 
                          email) {
                    if(!app.facebook) { app.facebook = facebook; }
                    if(!app.twitter) { app.twitter = twitter; }
                    if(!app.googleplus) { app.googleplus = googleplus; }
                    if(!app.email) { app.email = email; }
                    connServices = [ facebook, twitter, googleplus,
                                     email ];
                    mergeConnectionServices(pen, callback); });
    };


    return {
        display: function (domid, pen) {
            verifyConnectionServices(pen, function () {
                displaySettings(domid, pen); }); },
        toggleDesc: function (divid) {
            toggleDescription(divid); },
        changestate: function (svcid) {
            app.pen.getPen(function (pen) {
                changestate(svcid, pen); }); },
        getRevStarsTxt: function (review, format) {
            return getRevStarsTxt(review, format); },
        getRevTitleTxt: function (review) {
            return getRevTitleTxt(review); },
        getRevTypeImage: function (review) {
            return getRevTypeImage(review); },
        displayShare: function (buttondiv, msgdiv, pen, review) {
            svcmsgdiv = msgdiv;
            verifyConnectionServices(pen, function () {
                initShareDisplay(buttondiv, msgdiv, pen, review); }); },
        enable: function (svcname) {
            enablePostingService(svcname); },
        getRevPermalink: function (review) {
            return "http://www.myopenreviews.com/statrev/" + 
                app.instId(review); },
        getPostServiceMsgDiv: function () {
            return svcmsgdiv; },
        serviceLinkHTML: function (url, clickstr, imgclass, alt, src) {
            return serviceLinkHTML(url, clickstr, imgclass, alt, src); }
    };

});

