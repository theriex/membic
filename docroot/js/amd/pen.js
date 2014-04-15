/*global JSON: false, app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.pen = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var penNameRefs,  //array of authorized PenRefs
        currpenref,   //the currently selected PenRef
        returnFuncMemo,  //function to return to after dialog completed


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    serializeFields = function (penName) {
        var i;
        if(typeof penName.settings === 'object') {
            penName.settings = JSON.stringify(penName.settings); }
        if(!penName.groups) {
            penName.groups = ""; }
        if(typeof penName.groups !== "string") {
            for(i = 0; i < penName.groups.length; i += 1) {
                penName.groups[i] = jt.instId(penName.groups[i]); }
            penName.groups = penName.groups.join(","); }
    },


    verifyPenFields = function (pen) {
        if(!pen.following) {  //may be null
            pen.following = 0; }
        if(!pen.followers) {
            pen.followers = 0; }
    },


    askForEmailAddress = function (errmsg) {
        var html, askcount, nothanks, mailval;
        mailval = jt.safeget('emailin', 'value');
        askcount = Number(currpenref.pen.settings.askedemail || 0);
        nothanks = "I'll remember to check back in a week myself";
        if(askcount >= 1) {
            nothanks = "I'll drop by occasionally, stop asking for email"; }
        errmsg = errmsg || "";
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"},
                 "Contact email"],
                ["p",
                 "Wdydfun is a low noise site, and a lot of folks only check in about once a week or so.  To stay in touch, it's recommended that you have a weekly summary of your friend's reviews mailed to you."],
                ["ul", {cla: "revlist"},
                 [["li",
                   ["div", {cla: "errtxt"},
                    errmsg]],
                  ["li",
                   [jt.radiobutton("mailsel", "yesmail", 
                                   "Email address (private) &nbsp;", true),
                    ["input", {type: "email", id: "emailin", size: 25,
                               onchange: jt.fs("app.pen.processEmailForm()"),
                               value: mailval}]]],
                  ["li",
                   [jt.radiobutton("mailsel", "nomail",
                                   nothanks)]]]],
                ["div", {cla: "headingtxt"},
                 ["button", {type: "button", id: "emailpromptok",
                             onclick: jt.fs("app.pen.processEmailForm()")},
                  "OK"]]];
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('emailin').focus(); });
    },


    promptForEmailIfNeeded = function () {
        var yesterday, settings, lastprompt, ttlprompts, params;
        app.pen.deserializeFields(currpenref.pen);
        settings = currpenref.pen.settings;
        lastprompt = settings.emailprompt || "2012-01-01T00:00:00Z";
        yesterday = new Date((new Date().getTime()) - (24*60*60*1000))
            .toISOString();
        if(lastprompt > yesterday) {
            return; }  //already asked recently
        ttlprompts = Number(settings.askedemail || 0);
        if(ttlprompts >= 2) {
            return; }  //don't be too pesky. See form verbiage.
        params = app.login.authparams() + "&penid=" + jt.instId(currpenref.pen);
        jt.call('GET', "acctinfo?" + params, null,
                function (infos) {
                    if(!infos[0].hasEmail) {
                        askForEmailAddress(); } },
                app.failf(function (code, errtxt) {
                    jt.log("promptForEmailIfNeeded call failed: " + 
                           code + " " + errtxt); }),
                jt.semaphore("pen.promptForEmailIfNeeded"));
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        app.layout.initContent();  //may call for pen name retrieval...
        app.rel.loadoutbound();
        callback(currpenref.pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data;
        serializeFields(pen);
        data = jt.objdata(pen);
        jt.call('POST', "updpen?" + app.login.authparams(), data,
                 function (updpens) {
                     currpenref = app.lcs.put("pen", updpens[0]);
                     callok(currpenref); },
                 app.failf(function (code, errtxt) {
                     app.pen.deserializeFields(pen);  //undo pre-call serialize
                     callfail(code, errtxt); }),
                jt.semaphore("pen.updatePenName"));
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name;
        name = jt.byId('pnamein').value;
        buttonhtml = jt.byId('formbuttons').innerHTML;
        jt.out('formbuttons', "Creating Pen Name...");
        newpen = {};
        newpen.name = name;
        if(currpenref && currpenref.settings) {
            newpen.settings = currpenref.settings;
            serializeFields(newpen); }
        data = jt.objdata(newpen);
        jt.call('POST', "newpen?" + app.login.authparams(), data,
                 function (newpens) {
                     currpenref = app.lcs.put("pen", newpens[0]);
                     if(!penNameRefs) {
                         penNameRefs = []; }
                     penNameRefs.push(currpenref);
                     app.rel.resetStateVars("new");  //updates header display
                     setTimeout(promptForEmailIfNeeded, 200);
                     setTimeout(app.hinter.showStartTip, 4000);
                     returnCall(); },
                 app.failf(function (code, errtxt) {
                     jt.out('penformstat', errtxt);
                     jt.out('formbuttons', buttonhtml); }),
                jt.semaphore("pen.createPenName"));
    },


    onCreatePenRequest = function (e) {
        jt.evtend(e);
        createPenName();
    },


    newPenNameDisplay = function (callback) {
        var html, bcancel = "";
        returnFuncMemo = callback;
        app.login.updateAuthentDisplay("hide");
        jt.out('centerhdiv', "");
        if(currpenref && currpenref.pen) {
            bcancel = ["button", {type: "button", id: "cancelbutton",
                                  onclick: jt.fs("app.pen.cancelNewPen()")},
                       "Cancel"];
            bcancel = jt.tac2html(bcancel); }
        //need to mimic layout initContent divs here so they are available
        //as needed for continuation processing.
        html = [["div", {id: "chead"}],
                ["div", {id: "cmain"},
                 [["div", {id: "penformstat"}, "&nbsp;"],
                  ["table", {cla: "pennametable"},
                   [["tr",
                     ["td", {colspan: 3},
                      ["div", {id: "pennamedescrdiv", cla: "introverview"},
                       "Your pen name is a unique expression of style. You can have separate pen names for different personas, revealing as much (or as little) about yourself as you want. Use your real name, or get creative..."]]],
                    ["tr",
                     [["td", { rowspan: 2},
                       ["img", {src: "img/penname.png"}]],
                      ["td", { cla: "formattr"}, "Writing as..."]]],
                    ["tr",
                     ["td", {cla: "formval"},               //fits on phone...
                      ["input", {type: "text", id: "pnamein", size: 24}]]],
                    ["tr",
                     ["td", {colspan: 2, id: "formbuttons", align: "center"},
                      [bcancel,
                       "&nbsp;",
                       ["button", {type: "button", id: "createbutton"},
                        "Create"]]]]]]]]];
        html = jt.tac2html(html);
        jt.out('contentdiv', html);
        jt.on('pnamein', 'change', onCreatePenRequest);
        jt.on('createbutton', 'click', onCreatePenRequest);
        app.layout.adjust();
        jt.byId('pnamein').focus();
    },


    findHomePenRef = function () {
        var i, lastChosen = "0000-00-00T00:00:00Z", penref;
        if(penNameRefs && penNameRefs.length) {
            for(i = 0; i < penNameRefs.length; i += 1) {
                if(penNameRefs[i].pen.accessed > lastChosen) {
                    lastChosen = penNameRefs[i].pen.accessed;
                    penref = penNameRefs[i]; } } }
        return penref;
    },


    chooseOrCreatePenName = function (callback) {
        if(!penNameRefs || penNameRefs.length === 0) {
            return newPenNameDisplay(callback); }
        currpenref = findHomePenRef();
        setTimeout(promptForEmailIfNeeded, 200);
        app.skinner.setColorsFromPen(currpenref.pen);
        returnCall(callback);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        penNameRefs = null;
        currpenref = null;
        returnFuncMemo = null;
    },


    getPen: function (callback) {
        var url;
        if(currpenref) { 
            return callback(currpenref.pen); }
        if(penNameRefs) {
            return chooseOrCreatePenName(callback); }
        jt.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        app.layout.adjust();
        url = "mypens?" + app.login.authparams();
        //no semaphore on this call.  During startup and reset,
        //multiple functions might be needing access to the current
        //pen, and it is not reasonable to ignore a secondary call
        //because that leads to a line of processing being ignored.
        //With no semaphore, the log may show multiple server calls
        //for the same pen in some situations, but it is better than
        //unexplained lack of display updates.
        jt.call('GET', url, null,
                function (pens) {
                    var i;
                    penNameRefs = [];
                    for(i = 0; i < pens.length; i += 1) {
                        verifyPenFields(pens[i]);
                        penNameRefs.push(app.lcs.put("pen", pens[i])); }
                    chooseOrCreatePenName(callback); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "Pen name retrieval failed: " + 
                           code + " " + errtxt); }));
    },


    currPenId: function () {
        if(currpenref && currpenref.pen) {
            return jt.instId(currpenref.pen); }
        return 0;
    },


    currPenRef: function () {
        return currpenref;
    },


    updatePen: function (pen, callbackok, callbackfail) {
        updatePenName(pen, callbackok, callbackfail);
    },


    getPenNames: function () { 
        var i, pens = [];
        for(i = 0; penNameRefs && i < penNameRefs.length; i += 1) {
            pens.push(penNameRefs[i].pen); }
        return pens;
    },


    newPenName: function (callback) {
        newPenNameDisplay(callback);
    },


    selectPenByName: function (name) {
        var i;
        for(i = 0; i < penNameRefs.length; i += 1) {
            if(penNameRefs[i].pen.name === name) {
                currpenref = penNameRefs[i];
                app.skinner.setColorsFromPen(currpenref.pen);
                //reload relationships and activity
                app.rel.resetStateVars("reload", currpenref.pen);
                //update the accessed time so that the latest pen name is
                //chosen by default next time. 
                updatePenName(penNameRefs[i].pen, 
                              app.profile.display, app.profile.display);
                break; } }
    },


    //Update changed fields for currpen so anything referencing it
    //gets the latest field values from the db.  Only updates public
    //fields.  Explicitely does not update the settings, since that
    //can lead to race conditions if the app is dealing with that
    //while this call is going on.  The cached pen ref is modified
    //directly so the updated info is globally available.
    refreshCurrent: function () {
        var pen, params;
        pen = currpenref && currpenref.pen;
        if(pen) {
            params = "penid=" + jt.instId(pen);
            jt.call('GET', "penbyid?" + params, null,
                    function (pens) {
                        if(pens.length > 0) {
                            currpenref.pen.name = pens[0].name;
                            currpenref.pen.shoutout = pens[0].shoutout;
                            currpenref.pen.city = pens[0].city;
                            currpenref.pen.accessed = pens[0].accessed;
                            currpenref.pen.modified = pens[0].modified;
                            currpenref.pen.top20s = pens[0].top20s;
                            currpenref.pen.stash = pens[0].stash;
                            currpenref.pen.following = pens[0].following;
                            currpenref.pen.followers = pens[0].followers;
                            app.profile.resetReviews(); } },
                    app.failf(function (code, errtxt) {
                        jt.log("pen.refreshCurrent " + code + " " + 
                               errtxt); }),
                    jt.semaphore("pen.refreshCurrent")); }
    },


    deserializeFields: function (penName) {
        var text, obj;
        //reconstitute settings
        if(!penName.settings) {
            penName.settings = {}; }
        else if(typeof penName.settings !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.settings;
                obj = JSON.parse(text);
                penName.settings = obj;
            } catch (e2) {
                jt.log("pen.deserializeFields " + penName.name + ": " + e2);
                penName.settings = {};
            } }
        if(typeof penName.settings !== 'object') {
            jt.log("Re-initializing penName settings.  Deserialized value " +
                    "was not an object: " + penName.settings);
            penName.settings = {}; }
        //reconstitute top20s
        if(!penName.top20s) {
            penName.top20s = {}; }
        else if(typeof penName.top20s === "string") {
            penName.top20s = JSON.parse(penName.top20s); }
        //reconstitute stash
        if(!penName.stash) {
            penName.stash = {}; }
        else if(typeof penName.stash === "string") {
            penName.stash = JSON.parse(penName.stash); }
    },


    processEmailForm: function () {
        var email = jt.safeget('emailin', 'value'),
            rejected = jt.safeget('nomail', 'checked'),
            pen = currpenref.pen, data;
        if(rejected) {
            pen.settings.emailprompt = new Date().toISOString();
            pen.settings.askedemail = pen.settings.askedemail || 0;
            pen.settings.askedemail += 1;
            updatePenName(pen, 
                          function () {
                              app.layout.closeDialog(); },
                          app.failf(app.layout.closeDialog)); }
        else {  //adding email
            if(!jt.isProbablyEmail(email)) {
                return askForEmailAddress("Please enter your email address"); }
            data = "penid=" + jt.instId(pen) + "&email=" + jt.enc(email);
            jt.call('POST', "penmail?" + app.login.authparams(), data,
                    function (pens) {
                        currpenref = app.lcs.put("pen", pens[0]);
                        app.layout.closeDialog(); },
                    app.failf(function (code, errtxt) {
                        jt.err("Email update failure: " + code + "\n" +
                               "Please login natively to update your email.\n" +
                               errtxt); }),
                    jt.semaphore("pen.processEmailForm")); }
    },


    cancelNewPen: function () {
        app.login.updateAuthentDisplay();
        app.profile.display();
    }


}; //end of returned functions
}());


