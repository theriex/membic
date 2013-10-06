/*global setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.services = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var connServices,
        svcstates = [ "enabled",     //normal icon, 3rd party script loaded
                      "disabled",    //share icon greyed, no 3p script loaded
                      "on click" ],  //click to load 3p script and enable
        svcmsgdiv = "",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    serviceIconHTML = function (svc) {
        var iconurl, imgsrc, html = "";
        iconurl = svc.svcIconURL || svc.iconurl;
        if(iconurl) {
            if(iconurl.indexOf("http") === 0) {
                imgsrc = iconurl; }
            else if(iconurl.indexOf("img") === 0) {
                imgsrc = iconurl; }
            else {
                imgsrc = "svcpic?serviceid=" + svc.name; }
            html = ["img", {cla: "svcico", src: imgsrc}];
            html = jt.tac2html(html); }
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


    getConnSvcRowHTML = function (conf) {
        var i, options = [], svc, html;
        svc = findServiceByName(conf.name);
        for(i = 0; i < svcstates.length; i += 1) {
            options.push(
                ["option", {id: conf.name + (+i),
                            selected: jt.toru((conf.state === svcstates[i]), 
                                              "selected")},
                 svcstates[i]]); }
        html = ["tr",
                [["td", serviceIconHTML(svc)],
                 ["td", 
                  ["select", {id: svc.name + "sel",
                              onchange: jt.fs("app.services.changestate('" + 
                                              svc.name + "')")},
                   options]],
                 ["td",
                  [["a", {href: "#" + svc.svcDispName,
                          title: jt.ellipsis(svc.svcDesc, 65),
                          onclick: jt.fs("app.services.toggleDesc('svcdescdiv" +
                                         svc.name + "')")},
                    svc.svcDispName],
                   ["div", {id: "svcdescdiv" + svc.name,
                            style: "display:none;"},
                    jt.linkify(svc.svcDesc)]]]]];
        return html;
    },


    displaySettings = function (domid, pen) {
        var i, rows = [], html;
        app.pen.deserializeFields(pen);
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                rows.push(getConnSvcRowHTML(pen.settings.consvcs[i])); } }
        else {
            rows.push(["tr", ["td", "No posting services available"]]); }
        html = ["Posting Services: ", ["table", rows]];
        jt.out(domid, jt.tac2html(html));
    },


    initShareDisplay = function (buttondiv, msgdiv, pen, review) {
        var i, conf, svc, svcact, cells = [], html = "";
        app.pen.deserializeFields(pen);
        if(!review.svcdata) {
            review.svcdata = {}; }
        if(pen.settings.consvcs && pen.settings.consvcs.length > 0) {
            for(i = 0; i < pen.settings.consvcs.length; i += 1) {
                conf = pen.settings.consvcs[i];
                svc = findServiceByName(conf.name);
                svcact = { imgclass: "shareicodis",
                           url: "#disabled",
                           clickstr: "" };
                if(conf.state === svcstates[0]) {  //enabled
                    setTimeout(svc.doInitialSetup, 50);
                    svcact.url = svc.getLinkURL(review);
                    svcact.clickstr = svc.getOnClickStr(review);
                    svcact.imgclass = "shareico"; }
                else if(conf.state === svcstates[2]) {  //enable on click
                    svcact.url = "#disabled, click to enable";
                    svcact.clickstr = "app.services.enable('" + 
                        conf.name + "');return false;"; }
                cells.push(
                    ["td", {id: svc.name + "td"},
                     app.services.serviceLinkHTML(svcact.url, svcact.clickstr, 
                                                  svcact.imgclass,
                                                  svc.getShareImageAlt(), 
                                                  svc.getShareImageSrc())]); }
            html = ["table", {id: "svcbuttontable"},
                    ["tr", cells]];
            html = jt.tac2html(html); }
        jt.out(buttondiv, html);
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
        connServices = [ app.facebook, app.twitter, app.googleplus, 
                         app.email ];
        mergeConnectionServices(pen, callback);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    display: function (domid, pen) {
        verifyConnectionServices(pen, function () {
            displaySettings(domid, pen); });
    },


    toggleDesc: function (divid) {
        var div = jt.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    },


    changestate: function (name) {
        app.pen.getPen(function (pen) {
            var sel, conf, i;
            app.pen.deserializeFields(pen);
            sel = jt.byId(name + "sel");
            if(sel) {
                for(i = 0; !conf && i < pen.settings.consvcs.length; i += 1) {
                    if(pen.settings.consvcs[i].name === name) {
                        conf = pen.settings.consvcs[i]; } }
                if(conf) {
                    conf.state = svcstates[sel.selectedIndex]; } } });
    },


    getRevStarsTxt: function (review, format) {
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


    getRevTitleTxt: function (review) {
        var title, type;
        type = app.review.getReviewTypeByValue(review.revtype);
        title = review[type.key];
        if(type.subkey) {
            title += ", " + review[type.subkey]; }
        return title;
    },


    getRevTypeImage: function (review) {
        var type = app.review.getReviewTypeByValue(review.revtype);
        return "http://www.wdydfun.com/img/" + type.img;
    },


    displayShare: function (buttondiv, msgdiv, pen, review) {
        svcmsgdiv = msgdiv;
        verifyConnectionServices(pen, function () {
            initShareDisplay(buttondiv, msgdiv, pen, review); });
    },


    enable: function (svcname) {
        var svc, review, link;
        review = app.review.getCurrentReview();
        svc = findServiceByName(svcname);
        setTimeout(svc.doInitialSetup, 50);
        link = app.services.serviceLinkHTML(svc.getLinkURL(review),
                                            svc.getOnClickStr(review),
                                            "shareico",
                                            svc.getShareImageAlt(),
                                            svc.getShareImageSrc());
        jt.out(svc.name + "td", link);
    },


    getRevPermalink: function (review) {
        return "http://www.wdydfun.com/statrev/" + 
            jt.instId(review);
    },


    getPostServiceMsgDiv: function () {
        return svcmsgdiv;
    },


    serviceLinkHTML: function (url, clickstr, imgclass, alt, src) {
        var html;
        html = ["a", {href: url, title: alt,
                      onclick: jt.toru(clickstr, jt.fsd(clickstr))},
                ["img", {cla: imgclass, alt: alt, src: src}]];
        return jt.tac2html(html);
    }

};  //end of returned functions
}());

