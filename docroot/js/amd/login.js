/*global alert: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.login = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var authmethod = "",
        authtoken = "",
        authname = "",
        moracct = null,
        cookdelim = "..morauth..",
        topworkdivcontents = "",
        altauths = [],
        loginhtml = "",
        sumfreqs = [ "daily", "weekly", "fortnightly", "never" ],
        sumlabels = [ "Daily", "Weekly", "Fortnightly", "Never" ],
        revroll = { index: 0, revs: [] },


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    secureURL = function (endpoint) {
        var url = window.location.href;
        if(url.indexOf("https://") === 0 || url.search(/:\d080/) >= 0) {
            url = endpoint; }  //relative path url ok, data is encrypted
        else {  //return secured URL for endpoint
            url = app.secsvr + "/" + endpoint; }
        return url;
    },


    authparams = function () {
        var params, sec; 
        params = "am=" + authmethod + "&at=" + authtoken + 
                 "&an=" + jt.enc(authname);
        sec = jt.cookie(authtoken);
        if(sec) {
            params += "&as=" + jt.enc(sec); }
        return params;
    },


    //Produces less cryptic params to read
    authparamsfull = function () {
        var params = "authmethod=" + authmethod + 
                     "&authtoken=" + authtoken + 
                     "&authname=" + jt.enc(authname);
        return params;
    },


    logoutWithNoDisplayUpdate = function () {
        //remove the cookie and reset the app vars
        jt.cookie(app.authcookname, "", -1);
        authmethod = "";
        authtoken = "";
        authname = "";
        moracct = null;
        app.review.resetStateVars();
        app.profile.resetStateVars();
        app.pen.resetStateVars();
        app.rel.resetStateVars("logout");
    },


    clearParams = function () {
        //this also clears any search parameters to leave a clean url.
        //that way a return call from someplace like twitter doesn't
        //keep token info and similar parameter stuff hanging around.
        var url = window.location.pathname;
        //note this is using the standard html5 history directly.  That's
        //a way to to clear the URL noise without a redirect triggering
        //a page refresh. 
        if(history && history.pushState && 
                      typeof history.pushState === 'function') {
            history.pushState("", document.title, url); }
    },


    doneWorkingWithAccount = function (params) {
        var state, redurl, xpara;
        if(!params) {
            params = jt.parseParams(); }
        if(params.returnto) {
            //if changing here, also check /redirlogin
            redurl = decodeURIComponent(params.returnto) + "#" +
                authparamsfull();
            if(params.special === "nativeonly") {
                redurl += "&special=nativeonly"; }
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            xpara = jt.objdata(params, ["logout", "returnto"]);
            if(xpara) {
                redurl += "&" + xpara; }
            window.location.href = redurl;
            return; }
        //no explicit redirect, so check if directed by anchor tag
        if(params.anchor === "profile") {
            clearParams();
            return app.profile.display(params.action, params.errmsg); }
        //no tag redirect so check current state.  State may be from history
        //pop or set by handleRedirectOrStartWork
        state = app.history.currState();
        if(state) {
            if(state.view === "profile") {
                if(state.profid) {
                    return app.profile.byprofid(state.profid); }
                return app.profile.display(); }
            if(state.view === "group") {
                if(state.groupid) {
                    return app.group.bygroupid(state.groupid); }
                return app.group.display(); }
            if(state.view === "activity") {
                return app.activity.displayActive(); }
            if(state.view === "review" && state.revid) {
                return app.review.initWithId(state.revid, state.mode,
                                             params.action, params.errmsg); } }
        if(params.view === "profile") {
            return app.profile.display(); }
        //go with default display
        app.activity.displayActive();
    },


    //Cookie timeout is enforced both by the expiration setting here,
    //and by the server (moracct.py authenticated).  On FF14 with
    //noscript installed, the cookie gets written as a session cookie
    //regardless of the expiration set here.  This happens even if
    //directly using Cookie.set, or setting document.cookie directly.
    //On FF14 without noscript, all is normal.
    setAuthentication = function (method, token, name) {
        var cval = method + cookdelim + token + cookdelim + name;
        jt.cookie(app.authcookname, cval, 365);
        authmethod = method;
        authtoken = token;
        authname = name;
        if(authname) {
            authname = authname.replace("%40", "@"); }
        app.login.updateAuthentDisplay();
    },


    displayEmailSent = function () {
        var html;
        html = [["p", 
                 [["Your account information has been emailed to "],
                  ["code", jt.byId('emailin').value],
                  [" and should arrive in a few minutes.  If it doesn't" + 
                   " show up, please"]]],
                ["ol",
                 [["li", "Make sure your email address is spelled correctly"],
                  ["li", "Check your spam folder"],
                  ["li", "Confirm the email address you entered is the same" +
                        " one you used when you created your account."]]],
                ["div", {cla: "dlgbuttonsdiv"},
                 ["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.layout.closeDialog()")},
                  "OK"]]];
        html = app.layout.dlgwrapHTML("Email Account Password", html);
        app.layout.openDialog({y:90}, jt.tac2html(html), null,
                              function () {
                                  jt.byId('okbutton').focus(); });
    },


    freqopts = function (account) {
        var opts = [], i, selected, html;
        if(!account.summaryfreq) {
            account.summaryfreq = "weekly"; }
        for(i = 0; i < sumfreqs.length; i += 1) {
            selected = jt.toru((account.summaryfreq === sumfreqs[i]),
                               "selected");
            opts.push(["option", {id: sumfreqs[i], selected: selected},
                       sumlabels[i]]); }
        html = ["select", {id: "offsumsel"}, opts];
        html = jt.tac2html(html);
        return html;
    },


    hasflag = function (account, flag) {
        return (account.summaryflags &&
                account.summaryflags.indexOf(flag) >= 0);
    },


    //all alternate login is done from the main server. 
    handleAlternateAuthentication = function (idx, params) {
        var redurl;
        if(!params) {
            params = jt.parseParams(); }
        if(window.location.href.indexOf("localhost") >= 0) {
            jt.err("Not redirecting to main server off localhost. Confusing.");
            return; }
        if(window.location.href.indexOf(app.mainsvr) !== 0) {
            redurl = app.mainsvr + "#command=AltAuth" + (+idx);
            if(params.reqprof) {
                redurl += "&view=profile&profid=" + params.reqprof; }
            setTimeout(function () {
                window.location.href = redurl; 
            }, 20); }
        else {  //we are on app.mainsvr at this point
            if(typeof idx !== "number") {
                idx = parseInt(idx, 10); }
            altauths[idx].authenticate(params); }
    },


    onLoginEmailChange = function (e) {
        var passin;
        jt.evtend(e); 
        passin = jt.byId('passin');
        //Unbelievably, the passin field may not be available yet if
        //this is a browser autosubmit of saved credentials in Safari.
        //Don't create error noise in that case.
        if(passin) {
            passin.focus(); }
    },


    //webkit likes to escape at signs
    fixEmailAddress = function (emaddr) {
        emaddr = emaddr.replace(/%40/g, "@");
        return emaddr;
    },


    //safari displays "No%20match%20for%20those%20credentials"
    //and even "No%2520match%2520for%2520those%2520credentials"
    fixServerText = function (text) {
        var emailin;
        if(!text) {
            text = ""; }
        text = text.replace(/%20/g, " ");
        text = text.replace(/%2520/g, " ");
        if(text.startsWith("Not registered")) {
            emailin = jt.byId('emailin');
            if(emailin && emailin.value) {
                text = fixEmailAddress(emailin.value); }
            else {
                text = "That account"; }
            text += " is not registered yet.<br/>" +
                "If you want to create it, verify your<br/>" + 
                "password is entered correctly and<br/>" + 
                "click \"Create Account\"."; }
        return text;
    },


    setFocusOnEmailInput = function () {
        jt.retry(function () {  //setting the focus is not reliable
            var actel = document.activeElement;
            if(!actel || actel.id !== 'emailin') {
                actel = jt.byId('emailin');
                if(actel) {
                    actel.focus();
                    jt.log("Set emailin focus..."); } }
            else {
                jt.log("emailin focus set already."); }
        }, [200, 400, 600]);
    },



    verifyCoreLoginForm = function () {
        var html;
        if(!jt.byId('logindiv') || !jt.byId('loginform')) {
            html = jt.tac2html(["div", {id: "logindiv"}, loginhtml]);
            jt.out('topworkdiv', html); }
    },


    addParamValuesToLoginForm = function (params) {
        var name, html = [];
        //add url parameters to pass through on form submit.  Except for
        //emailin, which should always be read from the form even if it
        //is passed back from the server for use in error handling.
        for(name in params) {
            if(params.hasOwnProperty(name) && name !== "emailin") {
                html.push(["input", {type: "hidden", name: name,
                                     value: params[name]}]); } }
        if(!params.returnto) {
            html.push(["input", {type: "hidden", name: "returnto",
                                 //window.location.origin is webkit only
                                 value: window.location.protocol + "//" + 
                                        window.location.host}]); }
        jt.out('loginparaminputs', jt.tac2html(html));
    },


    displayReviewActivityRoll = function (revs) {
        var i, rev, displayed = false;
        revroll.revs = revs || revroll.revs;
        if(!revroll.revs || revroll.revs.length === 0) {
            jt.log("no activity roll revs to display");
            return; }
        if(jt.byId('revrolldiv')) {  //stop id div goes away
            for(i = 0; i < revroll.revs.length && !displayed; i += 1) {
                //reset index if past end
                if(revroll.index >= revroll.revs.length) {
                    revroll.index = 0; }
                //display review if it meeds the criteria
                rev = revroll.revs[revroll.index];
                if(jt.instId(rev) && rev.text.length > 255) {
                    jt.out('revrolldiv', app.review.staticReviewDisplay(
                        revroll.revs[revroll.index], null, "revroll"));
                    displayed = true; }
                revroll.index += 1; }
            setTimeout(displayReviewActivityRoll, 4000); }
    },


    //The login form must already exist in index.html for saved passwords
    //to work on some browsers.  This adds the detail.
    displayLoginForm = function (params) {
        var html;
        verifyCoreLoginForm();
        addParamValuesToLoginForm(params);
        //decorate contents and connect additional actions
        if(params.loginerr) {
            jt.out('loginstatdiv', fixServerText(params.loginerr)); }
        html = ["a", {id: "forgotpw", href: "#forgotpassword",
                      title: "Email my password, I spaced it",
                      onclick: jt.fs("app.login.forgotPassword()")},
                "forgot my password..."];
        jt.out('forgotpassdiv', jt.tac2html(html));
        if(authname) {
            jt.byId('emailin').value = authname; }
        if(params.emailin) {
            jt.byId('emailin').value = params.emailin; }
        jt.on('emailin', 'change', onLoginEmailChange);
        //Since this is an actual form, the default form action is
        //already triggered on return, and setting a handler
        //interferes with the Create Account button press.
        //jt.on('passin', 'change', onLoginPasswordChange);
        setFocusOnEmailInput();
    },


    activateButtonOrNoticeHTML = function (moracct) {
        var html, acts, i, ta, sent = false;
        html = ["button", {type: "button", id: "activatebutton",
                           onclick: jt.fs("app.login.sendActivation()")},
                "Activate"];
        if(moracct.actsends) {
            acts = moracct.actsends.split(",");
            for(i = 0; i < acts.length; i += 1) {
                ta = acts[i].split(";");
                if(ta[1] === moracct.email && 
                   jt.timewithin(ta[0], 'hours', 4)) {
                    sent = jt.tz2loc(jt.ISOString2Time(ta[0]));
                    break; } } }
        if(sent) {
            html = ["sent " + sent,
                    ["p", {cla: "activationsentdet"},
                     "Expedited email service is not available, so delivery may take up to 4 hrs (please also check spam folders). Click the link in the email to activate your account."]];
            jt.out("accstatdetaildiv", jt.tac2html(html));
            html = ["span", {cla: "actmailtext"},
                    ["a", {href: "#activationmaildetails",
                           onclick: jt.fs("app.login.toggleactmaildet()")},
                     "mail sent"]]; }
        return html;
    },


    writeUsermenuAccountFormElements = function (moracct) {
        var html;
        if(moracct.status === "Active") {
            html = [["span", {cla: "accstatvalspan"}, "Active"],
                    ["button", {type: "button", id: "deactivatebutton",
                                onclick: jt.fs("app.login.deactivateAcct()")},
                     "Deactivate"]]; }
        else { //Pending|Inactive|Unreachable
            html = [["span", {cla: "accstatvalspan"}, 
                     moracct.status || "Pending"],
                    activateButtonOrNoticeHTML(moracct)]; }
        html = [["label", {fo: "emptyspace", cla: "liflab"}, ""],
                ["span", {id: "buttonornotespan"},
                 html]];
        jt.out('accstatusupdatediv', jt.tac2html(html));
        //You can request your password be mailed to you, so simple
        //entry seems best here.
        html = [["label", {fo: "passin", cla: "liflab"}, "Password"],
                ["input", {type: "password", cla: "lifin", 
                           name: "passin", id: "passin"}]];
        jt.out('accpassupdatediv', jt.tac2html(html));
        html = [["label", {fo: "freqsel", cla: "liflab"}, "Summary"],
                freqopts(moracct)];
        jt.out('accsumfrequpdatediv', jt.tac2html(html));
        html = [["input", {type: "checkbox", name: "summaryflags",
                           value: "sumiflogin", id: "sumiflogin",
                           cla: "accsetcbox",
                           checked: jt.toru(hasflag(moracct, "sumiflogin"))}],
                ["label", {fo: "sumiflogin", cla: "accsetcboxlab"},
                 "Send even if site visited"]];
        jt.out('accsumflagsupdatediv', jt.tac2html(html));
        app.pen.getPen(function (pen) {
            var accpenin = jt.byId("accpenin");
            if(accpenin) {
                accpenin.value = pen.name;
                moracct.penName = pen.name; }});
    },


    readUsermenuAccountForm = function () {
        var ua, cboxes, i;
        ua = { email: moracct.email,
               summaryfreq: moracct.summaryfreq,
               summaryflags: moracct.summaryflags,
               penName: moracct.penName };
        ua.email = jt.byId('emailin').value.trim();
        if(!jt.isProbablyEmail(ua.email)) {
            return jt.out('usermenustat', "Invalid email address"); }
        if(ua.email !== moracct.email &&
           (!confirm("You will need to re-activate your account from your new email address. Double check your new email address is correct for login recovery. Activation mail will be sent to " + ua.email))) {
            return; }
        if(jt.byId('passin').value) {
            ua.password = jt.byId('passin').value.trim(); }
        ua.summaryfreq = sumfreqs[jt.byId('offsumsel').selectedIndex];
        ua.summaryflags = "";
        cboxes = document.getElementsByName("summaryflags");
        for(i = 0; i < cboxes.length; i += 1) {
            if(cboxes[i].checked) {
                if(ua.summaryflags) {
                    ua.summaryflags += ","; }
                ua.summaryflags += cboxes[i].value; } }
        ua.penName = jt.byId('accpenin').value;
        return ua;
    },


    logLoadTimes = function () {
        var millis, timer = app.amdtimer;
        millis = timer.load.end.getTime() - timer.load.start.getTime();
        jt.log("load app: " + millis);
    },


    addNativeAuthToPen = function (params) {
        var url;
        jt.out('contentdiv', "Verifying account");
        url = "getacct?am=" + params.am + "&at=" + params.at +
            "&an=" + jt.enc(params.an);
        jt.call('GET', url, null,
                function (accarr) {
                    var mid;
                    if(accarr.length > 0) {
                        mid = jt.instId(accarr[0]); }
                    app.profile.addMORAuthId(mid); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "Account verification failed"); }),
                jt.semaphore("login.addNativaAuthToPen"));
    },


    loggedInAuthentDisplay = function () {
        var penref, nml, remb, wrib, html;
        penref = app.pen.currPenRef();
        nml = ["a", {href: "#view=profile",
                     onclick: jt.fs("app.login.usermenu()")},
                authname];
        remb = ["a", {href: "#setUpPenNameToRemember",
                      onclick: jt.fs("app.profile.display()")},
                ["img", {cla: "topbuttonimg", 
                         src: "img/rememberdis.png"}]];
        wrib = ["a", {href: "#setUpPenNameToWrite",
                      onclick: jt.fs("app.profile.display()")},
                ["img", {cla: "topbuttonimg",
                         src: "img/writereviewdis.png"}]];
        if(penref && penref.pen) {
            nml = ["a", {href: "#view=profile&profid=" + jt.instId(penref.pen),
                         onclick: jt.fs("app.login.usermenu()")},
                   penref.pen.name];
            remb = ["a", {href: "#remembered",
                          onclick: jt.fs("app.activity.displayRemembered()")},
                    [["img", {cla: "topbuttonimg",
                              src: "img/remembered.png"}],
                     ["span", {id: "rememberedcountspan"},
                      penref.pen.remembered.csvarray().length || ""]]];
            wrib = ["a", {href: "#write",
                          onclick: jt.fs("app.review.display()")},
                    ["img", {cla: "topbuttonimg",
                             src: "img/writereview.png"}]]; }
        html = ["div", {id: "topactionsdiv"},
                [["div", {cla: "tasnamediv"}, nml],
                 ["div", {id: "tasbuttonsdiv"},
                  [remb, wrib]]]];
        jt.out('topworkdiv', jt.tac2html(html));
    },


    //On localhost, params are lost when the login form is displayed.
    //On the server, they are passed to the secure host and returned
    //post-login.  These are separate flows.  Not supporting a
    //separate param processing path just for local development.
    loggedInDoNextStep = function (params) {
        //Need to note login, but definitely don't hold up display work
        setTimeout(function () {
            var data = "penid=" + app.pen.currPenId();
            if(app.pen.currPenId()) {
                jt.call('POST', "penacc?" + app.login.authparams(), data,
                        function () {
                            jt.log("Pen access time updated"); },
                        app.failf(),
                        jt.semaphore("login.loggedInDoNextStep")); }}, 4000);
        if(params.command === "helpful" ||
           params.command === "remember" ||
           params.command === "respond" ||
           (params.view === "review" && params.revid)) {
            setTimeout(function () {
                jt.call('GET', "/bytheway?clickthrough=review", null,
                        function () {
                            jt.log("noted review clickthrough"); },
                        app.failf); }, 200);
            app.lcs.getFull("pen", params.penid, function (penref) {
                app.profile.verifyStateVariableValues(penref.pen);
                app.review.initWithId(params.revid, "read", 
                                      params.command); }); }
        else if(params.command === "penfinder") {
            app.profile.display("penfinder"); }
        else if(params.url) {
            app.review.readURL(jt.dec(params.url), params); }
        else if(params.special === "nativeonly") {
            addNativeAuthToPen(params); }
        else {  //pass parameters along to the general processing next step
            doneWorkingWithAccount(params); }
    },


    standardizeAuthParams = function (params) {
        if(params.authmethod) { params.am = params.authmethod; }
        if(params.authtoken) { params.at = params.authtoken; }
        if(params.authname) { params.an = params.authname; }
    },


    handleInitialParamSideEffects = function (params) {
        if(params.am && params.at && params.an && !params.special) {
            params.at = jt.enc(params.at);  //restore token encoding 
            setAuthentication(params.am, params.at, params.an); }
        if(params.logout) {
            logoutWithNoDisplayUpdate(); }
        if(!params.returnto) {  //clean up the URL display
            clearParams(); }
        //handle specific context requests
        if(params.view && (params.profid || params.groupid)) {
            //Note who requested a specific profile or group
            setTimeout(function () {
                jt.call('GET', "/bytheway?clickthrough=" + params.view, null,
                        function () {
                            jt.log("noted profile clickthrough"); },
                        app.failf); }, 200);
            app.history.checkpoint({ view: params.view, 
                                     profid: params.profid,
                                     groupid: params.groupid }); }
        else if(params.revedit) {
            app.history.checkpoint({ view: "review", mode: "edit",
                                     revid: params.revedit }); }
    },


    handleRedirectOrStartWork = function () {
        var idx, params = jt.parseParams();
        standardizeAuthParams(params);
        handleInitialParamSideEffects(params);
        //figure out what to do next
        if(params.command && params.command.indexOf("AltAuth") === 0) {
            idx = params.command.slice("AltAuth".length);
            handleAlternateAuthentication(idx, params); }
        else if(params.state && params.state.indexOf("AltAuth") === 0) {
            idx = params.state.slice("AltAuth".length, "AltAuth".length + 1);
            handleAlternateAuthentication(idx, params); }
        else if(authtoken || app.login.readAuthCookie()) {
            loggedInDoNextStep(params); }
        else if(secureURL("login") === "login") {
            displayLoginForm(params);
            app.activity.displayFeed("all"); }
        else { 
            app.redirectToSecureServer(params); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    init: function () {
        logLoadTimes();
        if(!loginhtml) {  //save original html in case needed later
            loginhtml = jt.byId('logindiv').innerHTML; }
        //do not change this ordering. Some auths leverage their index
        altauths = [ app.facebook, app.twitter, app.googleplus, app.github ];
        handleRedirectOrStartWork();
    },


    usermenu: function () {
        var html;
        html = ["div", {id: "accountsettingsformdiv"},
                [["div", {cla: "tasnamediv"},
                  ["a", {href: "#myprofile", id: "myprof",
                         onclick: jt.fs("app.login.closeupdate('profile')")},
                   "Show My Profile"]],
                 ["div", {cla: "tasnamediv"}, 
                  ["a", {href: "logout", id: "logout",
                         onclick: jt.fs("app.login.closeupdate('logout')")},
                   "Sign out"]],
                 ["div", {cla: "lifsep", id: "accemailupdatediv"},
                  [["label", {fo: "emailin", cla: "liflab"}, "Email"],
                   ["input", {type: "email", cla: "lifin",
                              name: "emailin", id: "emailin",
                              value: authname,
                              placeholder: "nospam@example.com"}]]],
                 ["div", {cla: "lifsep", id: "accstatusupdatediv"}],
                 ["div", {cla: "lifsep", id: "accstatdetaildiv"}],
                 ["div", {cla: "lifsep", id: "accpenupdatediv"},
                  [["label", {fo: "accpenin", cla: "liflab"}, "Pen&nbsp;Name"],
                   ["input", {type: "text", cla: "lifin", 
                              name: "accpenin", id: "accpenin"}]]],
                 ["div", {cla: "lifsep", id: "accpassupdatediv"}],
                 ["div", {cla: "lifsep", id: "accsumfrequpdatediv"}],
                 ["div", {cla: "lifsep", id: "accsumflagsupdatediv"}],
                 ["div", {cla: "lifsep", id: "usermenustat"}],
                 ["div", {cla: "dlgbuttonsdiv"},
                  [["button", {type: "button", id: "cancelbutton",
                               onclick: jt.fs("app.login.closeupdate()")},
                    "Cancel"],
                   ["button", {type: "button", id: "okbutton",
                               onclick: jt.fs("app.login.updateAccount()")},
                    "Ok"]]]]];
        app.layout.cancelOverlay();
        app.layout.closeDialog();
        app.onescapefunc = app.login.closeupdate;
        jt.byId('accsetdiv').style.visibility = "visible";
        jt.out('accsetdiv', jt.tac2html(html));
        jt.byId('accstatdetaildiv').style.display = "none";
        if(moracct) {
            writeUsermenuAccountFormElements(moracct); }
        else {
            jt.call('GET', "getacct?" + authparams(), null,
                    function (accarr) {
                        if(accarr.length > 0) {
                            moracct = accarr[0];
                            writeUsermenuAccountFormElements(moracct); }
                        else {
                            jt.err("Account details unavailable"); } },
                    app.failf(function (code, errtxt) {
                        jt.err("Account details retrieval failed: " + code + 
                               " " + errtxt); }),
                    jt.semaphore("login.usermenu")); }
    },


    closeupdate: function (next) {
        jt.out('accsetdiv', "");
        jt.byId('accsetdiv').style.visibility = "hidden";
        switch(next) {
        case 'profile': return app.profile.display();
        case 'logout': return app.login.logout(); }
    },


    toggleactmaildet: function () {
        var detdiv = jt.byId("accstatdetaildiv");
        if(detdiv) {
            if(detdiv.style.display === "block") {
                detdiv.style.display = "none"; }
            else {
                detdiv.style.display = "block"; } }
    },


    deactivateAcct: function () {
        var params, emaddr = jt.byId('emailin').value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before deactivating.");
            return; }
        if(confirm("If you want to re-activate your account after deactivating, you will need to confirm your email address again.")) {
            jt.out('buttonornotespan', "Deactivating...");
            params = app.login.authparams() + "&status=Inactive";
            jt.call('GET', "activate?" + params, null,
                    function (accounts) {
                        moracct = accounts[0];
                        writeUsermenuAccountFormElements(moracct); },
                    app.failf(function (code, errtxt) {
                        jt.err("Deactivation failed " + code + ": " + errtxt);
                        writeUsermenuAccountFormElements(moracct); }),
                    jt.semaphore("login.deactivateAcct")); }
    },


    sendActivation: function (status) {
        var emaddr = jt.byId('emailin').value;
        if(emaddr !== authname) {
            jt.err("Please ok your email address change before activating.");
            return; }
        jt.out('buttonornotespan', "Sending...");
        jt.call('POST', "sendcode?" + app.login.authparams(), "",
                function (accounts) {
                    moracct = accounts[0];
                    writeUsermenuAccountFormElements(moracct); },
                app.failf(function (code, errtxt) {
                    jt.err("Sending failed " + code + ": " + errtxt);
                    writeUsermenuAccountFormElements(moracct); }),
                jt.semaphore("login.sendActivation"));
    },


    //create the logged-in display areas
    updateAuthentDisplay: function (override) {
        if(!topworkdivcontents) {
            topworkdivcontents = jt.byId('topworkdiv').innerHTML; }
        if(authtoken && override !== "hide") {
            loggedInAuthentDisplay(); }
        else if(override === "hide") { 
            jt.out('topworkdiv', ""); }
        else {  //restore whatever was in index.html to begin with
            jt.out('topworkdiv', topworkdivcontents); }
    },


    redirhome: function (e) {
        var url = app.mainsvr;
        jt.evtend(e);
        if(window.location.href.indexOf("http://localhost:8080") === 0) {
            url = "http://localhost:8080"; }
        window.location.href = url;
    },


    updateAccount: function () {
        var ua, data, contf = app.login.closeupdate;
        ua = readUsermenuAccountForm();
        if(ua.penName !== moracct.penName) {
            contf = function () {
                app.pen.getPen(function (pen) {
                    pen.name = ua.penName;
                    app.pen.updatePen(
                        pen,
                        function (penref) {
                            app.login.closeupdate();
                            app.login.updateAuthentDisplay(); },
                        function (code, errtxt) {
                            jt.out('usermenustat', "Pen name update failed " + 
                                   code + ": " + errtxt); }); }); }; }
        if(ua.email === moracct.email &&
           !ua.password &&
           ua.summaryfreq === moracct.summaryfreq &&
           ua.summaryflags === moracct.summaryflags) {
            contf(); }
        else {  //account info changed
            data = jt.objdata(ua) + "&" + authparams();
            jt.call('POST', secureURL("updacc"), data,
                    function (objs) {
                        if(authmethod === "mid") {
                            setAuthentication("mid", objs[0].token, authname); }
                        moracct = null;
                        contf(); },
                    app.failf(function (code, errtxt) {
                        jt.out('setstatdiv', "Account update failed " +
                               code + ": " + errtxt); }),
                    jt.semaphore("login.updateAccount")); }
    },


    authparams: function () {
        return authparams();
    },


    isLoggedIn: function () {
        if(authmethod && authtoken && authname) {
            return true; }
        return false;
    },


    readAuthCookie: function () {
        var cval, mtn;
        cval = jt.cookie(app.authcookname);
        if(cval) {
            mtn = cval.split(cookdelim);
            authmethod = mtn[0];
            authtoken = mtn[1];
            authname = mtn[2].replace("%40", "@"); }
        app.login.updateAuthentDisplay();
        return authtoken;  //true if set earlier
    },


    logout: function (errprompt) {
        app.login.closeupdate();
        logoutWithNoDisplayUpdate();
        app.profile.cancelPenNameSettings();  //close the dialog if it is up
        app.history.checkpoint({ view: "profile", profid: 0 });
        app.login.updateAuthentDisplay();
        app.login.init();
        if(errprompt) {
            jt.err(errprompt); }
    },


    altLogin: function (idx) {
        handleAlternateAuthentication(idx);
    },


    setAuth: function (method, token, name) {
        setAuthentication(method, token, name);
    },


    //Return point for 3rd party auth completion
    authComplete: function () {
        var params;
        //any original params probably didn't make it through the 3rd
        //party auth calls, but capture them in case they did.
        params = jt.parseParams();
        //kick off the pen access time update, hinter etc.
        loggedInDoNextStep(params);
    },


    createAccount: function () {
        var emaddr, password, data, url, buttonhtml;
        emaddr = jt.byId('emailin').value;
        password = jt.byId('passin').value;
        if(!emaddr || !password || !emaddr.trim() || !password.trim()) {
            jt.out('loginstatdiv', "Please specify an email and password");
            return; }
        jt.out('loginstatdiv', "&nbsp;");  //clear any previous message
        buttonhtml = jt.byId('loginbuttonsdiv').innerHTML;
        jt.out('loginbuttonsdiv', "Creating new account...");
        emaddr = emaddr.toLowerCase();
        data = jt.objdata({ emailin: emaddr, passin: password });
        url = secureURL("newacct");
        jt.call('POST', url, data, 
                 function (objs) {
                     var html = "<p>Your account has been created." + 
                         " Welcome to FGFweb!</p>" +
                         "<p>Signing you in for the first time now...</p>";
                     jt.out('logindiv', html);
                     setAuthentication("mid", objs[0].token, emaddr);
                     //wait briefly to give the db a chance to stabilize
                     setTimeout(doneWorkingWithAccount, 3000); },
                 app.failf(function (code, errtxt) {
                     jt.out('loginstatdiv', errtxt);
                     jt.out('loginbuttonsdiv', buttonhtml); }),
                jt.semaphore("login.createAccount"));
    },


    getAuthMethod: function () {
        return authmethod; 
    },


    getAuthMethodPrint: function () {
        switch(authmethod) {
        case "mid": return "Native";
        case "gsid": return "Google+";
        case "fbid": return "Facebook";
        case "twid": return "Twitter";
        case "ghid": return "GitHub";
        default: return "Unknown"; }
    },


    loginInfoHTML: function (pen) {
        var html, iconurl;
        switch(authmethod) {
            case "mid": iconurl = "img/iconfgfweb.png"; break;
            case "fbid": iconurl = app.facebook.iconurl; break;
            case "twid": iconurl = app.twitter.iconurl; break;
            case "gsid": iconurl = app.googleplus.iconurl; break;
            case "ghid": iconurl = app.github.iconurl; break; }
        html = [["img", {cla: "loginico", src: iconurl}],
                ["em", authname],
                " &nbsp; ",
                ["a", {href: "logout", id: "logout",
                       onclick: jt.fs("app.login.logout()")},
                 "Sign out"]];
        html = jt.tac2html(html);
        return html;
    },


    forgotPassword: function () {
        var emaddr, data;
        emaddr = jt.byId('emailin').value;
        if(!jt.isProbablyEmail(emaddr)) {
            jt.out('loginstatdiv', "Please fill in your email address...");
            return; }
        jt.out('loginstatdiv', "Sending...");
        data = "emailin=" + jt.enc(emaddr);
        jt.call('POST', "mailcred", data,
                function (objs) {
                    jt.out('loginstatdiv', "&nbsp;");
                    displayEmailSent(); },
                app.failf(function (code, errtxt) {
                    jt.out('loginstatdiv', errtxt); }),
                jt.semaphore("forgotPassword"));
    }

};  //end of returned functions
}());

