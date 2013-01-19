/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . s e r v i c e s 
//
define([], function () {
    "use strict";

    var connServices,
        svcstates = [ "new service", "enabled", "ask", "disabled" ],


    serviceIconHTML = function (svc) {
        var html = "";
        if(svc.iconurl) {
            html += "<img class=\"svcico\" src=\"";
            if(svc.iconurl.indexOf("img") === 0) {
                html += svc.iconurl; }
            else {
                html += "svcpic?serviceid=" + svc.name; }
            html += "\"/>"; }
        return html;
    },


    findServiceByName = function (name) {
        var i;
        for(i = 0; i < connServices.length; i += 1) {
            if(connServices[i].name === name) {
                return connServices[i]; } }
    },


    //using the overlay div to avoid confusion from the settings
    //dialog getting launched at the same time.
    promptForService = function (review, conf, isnew) {
        var odiv, svc, html = "";
        svc = findServiceByName(conf.name);
        if(isnew) {
            html += "<p>A new connection service is available:</p>"; }
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


    getRevStarsTxt = function (review) {
        var txt = "", rat = review.rating;
        if(rat && typeof rat === 'number' && rat > 5) {
            if(rat < 15) { txt = "+"; }
            else if(rat < 25) { txt = "*"; }
            else if(rat < 35) { txt = "*+"; }
            else if(rat < 45) { txt = "**"; }
            else if(rat < 55) { txt = "**+"; }
            else if(rat < 65) { txt = "***"; }
            else if(rat < 75) { txt = "***+"; }
            else if(rat < 85) { txt = "****"; }
            else if(rat < 95) { txt = "****+"; }
            else { txt = "*****"; } }
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
        mor.pen.deserializeSettings(pen);
        if(!review.svcdata) {
            review.svcdata = {}; }
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                conf = pen.settings.consvcs[i];
                bb = conf.name;
                //not already run, or prompted and confirmed
                if(!review.svcdata[bb] || review.svcdata[bb] === "confirmed") {
                    if(!review.svcdata[bb]) {  //note processing was triggered
                        review.svcdata[bb] = conf.status; }
                    //kick off appropriate processing
                    if(review.svcdata[bb] === svcstates[0]) {  //new service
                        return promptForService(review, conf, true); }
                    if(review.svcdata[bb] === svcstates[2]) {  //ask
                        return promptForService(review, conf); }
                    if(review.svcdata[bb] === svcstates[1] ||  //enabled
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
        mor.pen.deserializeSettings(pen);
        sel = mor.byId(name + "sel");
        if(sel) {
            for(i = 0; !conf && i < pen.settings.consvcs.length; i += 1) {
                if(pen.settings.consvcs[i].name === name) {
                    conf = pen.settings.consvcs[i]; } }
            if(conf) {
                conf.status = svcstates[sel.selectedIndex]; } }
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
            if(conf.status === svcstates[i]) {
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
        mor.pen.deserializeSettings(pen);
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                html += getConnSvcRowHTML(pen.settings.consvcs[i]); } }
        else {
            html += "<tr><td>No posting services available</td></tr>"; }
        html += "</table>";
        mor.out(domid, html);
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
        //the service name is a unique identifier of what to run.  If that
        //is not specified then the service can't be found.
        if(typeof confsvc.name !== 'string') {
            return false; }
        if(typeof confsvc.state !== 'string') {
            confsvc.state = svcstates[0]; }
        return true;
    },


    //helpful to preserve the ordering of any defined service configs
    mergeConnectionServices = function (pen, contfunc) {
        var updconfs, i, j, svc, conf, found;
        updconfs = [];
        mor.pen.deserializeSettings(pen);
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
            for(j = 0; j < pen.settings.consvcs.length; j += 1) {
                conf = pen.settings.consvcs[j];
                if(conf.name === svc.name) {
                    found = true; } }
            if(!found) {
                updconfs.push( { name: svc.name,
                                 status: svcstates[0] } ); } }
        pen.settings.consvcs = updconfs;
        contfunc();
    },


    verifyConnectionServices = function (pen, callback) {
        if(connServices) {
            return mergeConnectionServices(pen, callback); }
        require([ "ext/facebook", "ext/twitter" ],
                function (facebook, twitter) {
                    if(!mor.facebook) { mor.facebook = facebook; }
                    if(!mor.twitter) { mor.twitter = twitter; }
                    connServices = [ facebook, twitter ];
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
        getRevStarsTxt: function (review) {
            return getRevStarsTxt(review); },
        getRevTitleTxt: function (review) {
            return getRevTitleTxt(review); },
        getRevTypeImage: function (review) {
            return getRevTypeImage(review); },
        continueServices: function (review) {
            mor.pen.getPen(function (pen) {
                runServices(pen, review); }); }
    };

});

