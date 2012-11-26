/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, FB: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . s e r v i c e s 
//
define([], function () {
    "use strict";

    var connServices,
    svcstates = [ "new service", "enabled", "ask", "disabled" ],
    tempref,


    serviceIconHTML = function (svc) {
        var html = "";
        if(svc.icon) {
            html += "<img class=\"svcico\" src=\"";
            if(svc.icon.indexOf("img") === 0) {
                html += svc.icon; }
            else {
                html += "svcpic?serviceid=" + svc.svcid; }
            html += "\"/>"; }
        return html;
    },


    //using the overlay div to avoid confusion from the settings
    //dialog getting launched at the same time.
    promptForService = function (review, svc, isnew) {
        var odiv, svcid = "svc" + svc.svcid, html = "";
        if(isnew) {
            html += "<p>A new connection service is available:</p>"; }
        html += "<p>" + serviceIconHTML(svc) + "&nbsp;" + svc.name + "</p>";
        html += mor.linkify(svc.desc);
        html += "<p class=\"headingtxt\">Run it?</p>" +
        "<p class=\"headingtxt\">" +
          "<button type=\"button\"" + 
                 " onclick=\"mor.services.promptresp('" + svcid + "','No');" +
                          "return false;\">No</button>&nbsp;" +
          "<button type=\"button\"" +
                 " onclick=\"mor.services.promptresp('" + svcid + "','Yes');" +
                          "return false;\">Yes</button></p>" +
        "<p class=\"smalltext\"><i>You can manage connection services through" +
            " the settings button next to your pen name</i></p>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = function () { 
            mor.services.promptresp(svcid, 'No'); };
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


    doFacebookBailout = function (review) {
        if(!review) {
            review = tempref; } 
        review.svcdata.svc100 = "bailout";
        mor.pen.getPen(function (pen) {
            mor.services.runServices(pen, review); });
    },


    doFacebookPostLoggedIn = function (review) {
        var fblinkname, fblinkurl, fbimage, fbprompt;
        if(!review) {
            review = tempref; }
        fblinkname = getRevStarsTxt(review) + " " + getRevTitleTxt(review);
        fblinkurl = "http://www.myopenreviews.com/#view=profile" + 
            "&profid=" + review.penid;
        fbimage = getRevTypeImage(review);
        fbprompt = "Check this out if...";
        FB.ui({ method: 'feed',  //use the feed dialog...
                message: review.revtype + " review",
                name: fblinkname,
                caption: review.keywords,
                description: review.text,
                link: fblinkurl,
                picture: fbimage,
                actions: [ { name: 'profile', link: fblinkurl } ],
                user_message_prompt: fbprompt },
              function (response) {
                  if(response && response.post_id) {
                      review.svcdata.svc100 = response.post_id; }
                  else {
                      review.svcdata.svc100 = 'nopost'; } });
    },


    doFacebookPostSDKLoaded = function (review) {
        FB.getLoginStatus(function (loginResponse) {
            var msg, html, odiv;
            if(loginResponse.status === "connected") {
                return doFacebookPostLoggedIn(review); }
            tempref = review;
            if(loginResponse.status === "not_authorized") {
                msg = "You have not yet authorized MyOpenReviews, " +
                    " click to authorize."; }
            else {
                msg = "You are not currently logged into Facebook," +
                    " click to log in."; }
            html = "<p>" + msg + "</p>" +
                "<p><a href=\"http://www.facebook.com\"" +
                      " title=\"Log in to Facebook\"" +
                      " onclick=\"mor.services.loginFB();return false;\"" +
                    "><img class=\"loginico\" src=\"img/f_logo.png\"" +
                         " border=\"0\"/> Log in to Facebook</a></p>";
            mor.out('overlaydiv', html);
            odiv = mor.byId('overlaydiv');
            odiv.style.top = "80px";
            odiv.style.visibility = "visible";
            odiv.style.backgroundColor = mor.skinner.lightbg(); });
    },


    doFacebookPost = function (review) {
        var js, id = 'facebook-jssdk', firstscript, 
            mainsvr = "http://www.myopenreviews.com";
        if(window.location.href.indexOf(mainsvr) !== 0) {
            alert("Posting to facebook is only supported from " + mainsvr);
            return doFacebookBailout(review); }
        if(mor.byId(id)) {  //if facebook script is already loaded, then go
            return doFacebookPostSDKLoaded(review); }
        window.fbAsyncInit = function () {
            FB.init({ appId: 265001633620583, 
                      status: true, //check login status
                      cookie: true, //enable server to access the session
                      xfbml: true });
            doFacebookPostSDKLoaded(review); };
        js = document.createElement('script');
        js.id = id;
        js.async = true;
        js.src = "//connect.facebook.net/en_US/all.js";
        firstscript = document.getElementsByTagName('script')[0];
        firstscript.parentNode.insertBefore(js, firstscript);
    },


    callToRunService = function (review, svc) {
        if(svc.svcid === 100) {
            doFacebookPost(review); }
        //ATTENTION: if it's anything other than a special case, call
        //the server to run it.
    },


    runServices = function (pen, review) {
        var i, svc, bb;
        mor.pen.deserializeSettings(pen);
        if(!review.svcdata) {
            review.svcdata = {}; }
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                svc = pen.settings.consvcs[i];
                bb = "svc" + svc.svcid;
                if(!review.svcdata[bb]) {
                    review.svcdata[bb] = svc.status; }
                if(review.svcdata[bb] === svcstates[0]) {  //new service
                    return promptForService(review, svc, true); }
                if(review.svcdata[bb] === svcstates[2]) {  //ask
                    return promptForService(review, svc); }
                if(review.svcdata[bb] === svcstates[1] ||  //enabled
                   review.svcdata[bb] === "confirmed") {
                    return callToRunService(review, svc); } } }
    },


    handleResponseToPrompt = function (svcid, resp) {
        var review = mor.review.getCurrentReview(),
            odiv = mor.byId('overlaydiv');
        if(resp === "Yes") {
            review.svcdata[svcid] = "confirmed"; }
        else {
            review.svcdata[svcid] = "rejected"; }
        odiv.innerHTML = "";
        odiv.style.visibility = "hidden";
        mor.onescapefunc = null;
        //run async so the call chain from the dialog can terminate nicely
        setTimeout(function () {
            mor.pen.getPen(function (pen) {
                mor.services.runServices(pen, review); 
            }); }, 50);
    },


    optionHTML = function (svc, optname, optid) {
        var html;
        if(!optid) {
            optid = optname; }
        html = "<option id=\"" + svc.svcid + optid + "\"";
        if(svc.status === optname) {
            html += " selected=\"selected\""; }
        html += ">" + optname + "</option>";
        return html;
    },


    toggleDescription = function (divid) {
        var div = mor.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    },


    changestate = function (svcid, pen) {
        var sel, svc, i;
        mor.pen.deserializeSettings(pen);
        sel = mor.byId(svcid + "sel");
        if(sel) {
            for(i = 0; !svc && i < pen.settings.consvcs.length; i += 1) {
                if(pen.settings.consvcs[i].svcid === svcid) {
                    svc = pen.settings.consvcs[i]; } }
            if(svc) {
                svc.status = svcstates[sel.selectedIndex]; } }
    },


    getConnSvcRowHTML = function (svc) {
        var i, html = "<tr><td>";
        html += serviceIconHTML(svc);
        html += "</td><td>" + 
            "<select id=\"" + svc.svcid + "sel\"" + 
            " onchange=\"mor.services.changestate(" + svc.svcid + ");" +
                       "return false;\"" +
            ">";
        for(i = 0; i < svcstates.length; i += 1) {
            html += optionHTML(svc, svcstates[i]); }
        html += "</select></td>" +
            "<td><a href=\"#service" + svc.svcid + "\"" +
                  " title=\"" + mor.ellipsis(svc.desc, 65) + "\"" +
                  " onclick=\"mor.services.toggleDesc('svcdescdiv" +
                             svc.svcid + "');return false;\">" +
                    svc.name + "</a>" + 
              "<div id=\"svcdescdiv" + svc.svcid + "\"" +
                  " style=\"display:none;\">" + mor.linkify(svc.desc) + 
              "</div>" +
            "</td></tr>";
        return html;
    },


    displaySettings = function (domid, pen) {
        var i, html = "Connection Services: <table>";
        mor.pen.deserializeSettings(pen);
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                html += getConnSvcRowHTML(pen.settings.consvcs[i]); } }
        else {
            html += "<tr><td>No connection services available</td></tr>"; }
        html += "</table>";
        mor.out(domid, html);
    },


    mergeConnectionServices = function (pen, contfunc) {
        var i, serviceId, found, svc, j, config;
        mor.pen.deserializeSettings(pen);
        if(!pen.settings.consvcs) {
            pen.settings.consvcs = []; }
        found = false;
        for(i = 0; i < connServices.length; i += 1) {
            if(connServices[i].name === "Facebook Post") {
                found = true;
                break; } }
        if(!found) {
            svc = { 
                icon: "img/f_logo.png",
                name: "Facebook Post",
                devstatus: "released",
                description: "The standard built-in Facebook posting service."
            };
            mor.setInstId(svc, 100);
            connServices.push(svc); }
        for(i = 0; i < connServices.length; i += 1) {
            if(connServices[i].devstatus === "released") {
                serviceId = mor.instId(connServices[i]);
                found = false;
                for(j = 0; j < pen.settings.consvcs.length; i += 1) {
                    config = pen.settings.consvcs[j];
                    if(serviceId === config.svcid) {
                        found = true;
                        config.icon = connServices[i].icon;
                        config.name = connServices[i].name;
                        config.desc = connServices[i].description;
                        break; } }
                if(!found) {
                    config = { svcid: serviceId,
                               status: svcstates[0],
                               icon: connServices[i].icon,
                               name: connServices[i].name,
                               desc: connServices[i].description };
                    if(config.name === "Facebook Post") {
                        config.icon = "img/f_logo.png"; }
                    pen.settings.consvcs.push(config); } } }
        contfunc();
    },


    fetchAndMergeServices = function (pen, contfunc) {
        mor.call("/consvcs", 'GET', null,
                 function (connectionServices) {
                     connServices = connectionServices;
                     mergeConnectionServices(pen, contfunc); },
                 function (code, errtxt) {
                     mor.log("fetchAndMergeServices errcode " + code +
                             ": " + errtxt); });
    };


    return {
        display: function (domid, pen) {
            displaySettings(domid, pen);
            if(!connServices) {
                setTimeout(function () {  //load async so caller can continue
                    fetchAndMergeServices(pen, function () {
                        displaySettings(domid, pen); }); }, 50); } },
        toggleDesc: function (divid) {
            toggleDescription(divid); },
        changestate: function (svcid) {
            mor.pen.getPen(function (pen) {
                changestate(svcid, pen); }); },
        run: function (pen, review) {
            if(!connServices) {
                fetchAndMergeServices(pen, function () {
                    runServices(pen, review); }); }
            else {
                mergeConnectionServices(pen, function () {
                    runServices(pen, review); }); } },
        runServices: function (pen, review) {
            runServices(pen, review); },
        promptresp: function (svcid, resp) {
            handleResponseToPrompt(svcid, resp); },
        loginFB: function () {
            FB.login(function (loginResponse) {
                mor.out('overlaydiv', "");
                mor.byId('overlaydiv').style.visibility = "hidden";
                mor.onescapefunc = null;
                if(loginResponse.status === "connected") {
                    doFacebookPostLoggedIn(); }
                else {
                    doFacebookBailout(); } }); }

    };

});

