/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

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


    //using the overlay div to avoid confusion from the settings
    //dialog getting launched at the same time.
    promptForService = function (review, conf) {
        var odiv, svc, html = "";
        svc = findServiceByName(conf.name);
        html += "<p>" + serviceIconHTML(svc) + "&nbsp;" + 
            svc.svcDispName + "</p>";
        html += mor.linkify(svc.svcDesc);
        html += "<p class=\"headingtxt\">Run it?</p>" +
        "<p class=\"headingtxt\">" +
          "<button type=\"button\"" + 
                 " onclick=\"mor.services.promptresp('" + svc.name + "'," + 
                                                    "'No');return false;\"" +
            ">No</button>&nbsp;" +
          "<button type=\"button\"" +
                 " onclick=\"mor.services.promptresp('" + svc.name + "'," +
                                                    "'Yes');return false;\"" + 
            ">Yes</button></p>" +
        "<p class=\"smalltext\"><i>You can manage connection services through" +
            " the settings button next to your pen name</i></p>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = function () { 
            mor.services.promptresp(svc.name, 'No'); };
    },


    getRevTitleTxt = function (review) {
        var title, type;
        type = mor.review.getReviewTypeByValue(review.revtype);
        title = review[type.key];
        if(type.subkey) {
            title += ", " + review[type.subkey]; }
        return title;
    },


    getRevTypeImage = function (review) {
        var type = mor.review.getReviewTypeByValue(review.revtype);
        return "http://www.myopenreviews.com/img/" + type.img;
    },


    getRevStarsTxt = function (review, format) {
        var txt, starsobj, expl;
        starsobj = mor.review.starRating(review.rating, false);
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


    callToRunService = function (review, conf) {
        var svc;
        svc = findServiceByName(conf.name);
        //if the service needs a display, it can use overlaydiv
        svc.doPost(review);
    },


    runServices = function (pen, review) {
        var i, conf, bb;
        mor.pen.deserializeFields(pen);
        if(!review.svcdata) {
            review.svcdata = {}; }
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                conf = pen.settings.consvcs[i];
                bb = conf.name;
                //not already run, or prompted and confirmed
                if(!review.svcdata[bb] || review.svcdata[bb] === "confirmed") {
                    if(!review.svcdata[bb]) {  //note processing was triggered
                        review.svcdata[bb] = conf.state; }
                    //kick off appropriate processing
                    if(review.svcdata[bb] === svcstates[2]) {  //ask first
                        return promptForService(review, conf); }
                    if(review.svcdata[bb] === svcstates[0] ||  //enabled
                       review.svcdata[bb] === "confirmed") {
                        return callToRunService(review, conf); } } } }
        mor.profile.display();
    },


    handleResponseToPrompt = function (name, resp) {
        var review, odiv;
        review = mor.review.getCurrentReview();
        odiv = mor.byId('overlaydiv');
        if(resp === "Yes") {
            review.svcdata[name] = "confirmed"; }
        else {
            review.svcdata[name] = "rejected"; }
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
        mor.onescapefunc = null;
        //run async so the call chain from the dialog can terminate nicely
        setTimeout(function () {
            mor.pen.getPen(function (pen) {
                mor.services.runServices(pen, review); 
            }); }, 50);
    },


    toggleDescription = function (divid) {
        var div = mor.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    },


    changestate = function (name, pen) {
        var sel, conf, i;
        mor.pen.deserializeFields(pen);
        sel = mor.byId(name + "sel");
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
            " onchange=\"mor.services.changestate('" + svc.name + "');" +
                       "return false;\"" +
            ">";
        for(i = 0; i < svcstates.length; i += 1) {
            html += "<option id=\"" + conf.name + (+i) + "\"";
            if(conf.state === svcstates[i]) {
                html += " selected=\"selected\""; }
            html += ">" + svcstates[i] + "</option>"; }
        html += "</select></td>" +
            "<td><a href=\"#" + svc.svcDispName + "\"" +
                  " title=\"" + mor.ellipsis(svc.svcDesc, 65) + "\"" +
                  " onclick=\"mor.services.toggleDesc('svcdescdiv" +
                             svc.name + "');return false;\">" +
                    svc.svcDispName + "</a>" + 
              "<div id=\"svcdescdiv" + svc.name + "\"" +
                  " style=\"display:none;\">" + mor.linkify(svc.svcDesc) + 
              "</div>" +
            "</td></tr>";
        return html;
    },


    displaySettings = function (domid, pen) {
        var i, html = "Posting Services: <table>";
        mor.pen.deserializeFields(pen);
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                html += getConnSvcRowHTML(pen.settings.consvcs[i]); } }
        else {
            html += "<tr><td>No posting services available</td></tr>"; }
        html += "</table>";
        mor.out(domid, html);
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
        mor.pen.deserializeFields(pen);
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
                    svcact.clickstr = "mor.services.enable('" + 
                        conf.name + "');return false;"; }
                html += "<td id=\"" + svc.name + "td\">" + 
                    serviceLinkHTML(svcact.url, svcact.clickstr, imgclass,
                                    svc.getShareImageAlt(), 
                                    svc.getShareImageSrc()) + "</td>"; }
            html += "</tr></table>"; }
        mor.out(buttondiv, html);
    },


    enablePostingService = function (svcname) {
        var svc, review, link;
        review = mor.review.getCurrentReview();
        svc = findServiceByName(svcname);
        setTimeout(svc.doInitialSetup, 50);
        link = serviceLinkHTML(svc.getLinkURL(review),
                               svc.getOnClickStr(review),
                               "shareico",
                               svc.getShareImageAlt(),
                               svc.getShareImageSrc());
        mor.out(svc.name + "td", link);
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
        mor.pen.deserializeFields(pen);
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
                    if(!mor.facebook) { mor.facebook = facebook; }
                    if(!mor.twitter) { mor.twitter = twitter; }
                    if(!mor.googleplus) { mor.googleplus = googleplus; }
                    if(!mor.email) { mor.email = email; }
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
            mor.pen.getPen(function (pen) {
                changestate(svcid, pen); }); },
        run: function (pen, review) {
            verifyConnectionServices(pen, function () {
                runServices(pen, review); }); },
        runServices: function (pen, review) {
            runServices(pen, review); },
        promptresp: function (svcid, resp) {
            handleResponseToPrompt(svcid, resp); },
        getRevStarsTxt: function (review, format) {
            return getRevStarsTxt(review, format); },
        getRevTitleTxt: function (review) {
            return getRevTitleTxt(review); },
        getRevTypeImage: function (review) {
            return getRevTypeImage(review); },
        continueServices: function (review) {
            mor.pen.getPen(function (pen) {
                runServices(pen, review); }); },
        displayShare: function (buttondiv, msgdiv, pen, review) {
            verifyConnectionServices(pen, function () {
                initShareDisplay(buttondiv, msgdiv, pen, review); }); },
        enable: function (svcname) {
            enablePostingService(svcname); },
        getRevPermalink: function (review) {
            return "http://www.myopenreviews.com/statrev/" + 
                mor.instId(review); }
    };

});

