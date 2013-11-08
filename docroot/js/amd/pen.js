/*global JSON: false, app: false, jt: false */

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
        if(typeof penName.revmem === 'object') {
            penName.revmem = JSON.stringify(penName.revmem); }
        if(typeof penName.settings === 'object') {
            penName.settings = JSON.stringify(penName.settings); }
    },


    verifyPenFields = function (pen) {
        if(!pen.following) {  //may be null
            pen.following = 0; }
        if(!pen.followers) {
            pen.followers = 0; }
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        app.layout.initContent();  //may call for pen name retrieval...
        app.rel.loadoutbound();
        callback(currpenref.pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data, critsec = "";
        serializeFields(pen);
        data = jt.objdata(pen);
        jt.call('POST', "updpen?" + app.login.authparams(), data,
                 function (updpens) {
                     currpenref = app.lcs.putPen(updpens[0]);
                     callok(currpenref); },
                 app.failf(function (code, errtxt) {
                     app.pen.deserializeFields(pen);  //undo pre-call serialize
                     callfail(code, errtxt); }),
                 critsec);
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name, critsec = "";
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
                     currpenref = app.lcs.putPen(newpens[0]);
                     if(!penNameRefs) {
                         penNameRefs = []; }
                     penNameRefs.push(currpenref);
                     app.rel.resetStateVars("new");  //updates header display
                     returnCall(); },
                 app.failf(function (code, errtxt) {
                     jt.out('penformstat', errtxt);
                     jt.out('formbuttons', buttonhtml); }),
                 critsec);
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
                     ["td", {cla: "formval"},
                      ["input", {type: "text", id: "pnamein", size: 34}]]],
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
        var url, critsec = "";
        if(currpenref) { 
            return callback(currpenref.pen); }
        if(penNameRefs) {
            return chooseOrCreatePenName(callback); }
        jt.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        app.layout.adjust();
        url = "mypens?" + app.login.authparams();
        jt.call('GET', url, null,
                function (pens) {
                    var i;
                    penNameRefs = [];
                    for(i = 0; i < pens.length; i += 1) {
                        verifyPenFields(pens[i]);
                        penNameRefs.push(app.lcs.putPen(pens[i])); }
                    chooseOrCreatePenName(callback); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "Pen name retrieval failed: " + 
                           code + " " + errtxt); }),
                critsec);
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
        var pen, params, critsec = "";
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
                             currpenref.pen.following = pens[0].following;
                             currpenref.pen.followers = pens[0].followers;
                             app.profile.resetReviews(); } },
                     app.failf(function (code, errtxt) {
                         jt.log("pen.refreshCurrent " + code + " " + 
                                errtxt); }),
                     critsec); }
    },


    deserializeFields: function (penName) {
        var text, obj;
        //reconstitute revmem
        if(!penName.revmem) {
            penName.revmem = {}; }
        else if(typeof penName.revmem !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.revmem;
                obj = JSON.parse(text);
                penName.revmem = obj;
            } catch (e) {
                jt.log("pen.deserializeFields " + penName.name + ": " + e);
                penName.revmem = {};
            } }
        if(typeof penName.revmem !== 'object') {
            jt.log("Re-initializing penName revmem.  Deserialized value " +
                    "was not an object: " + penName.revmem);
            penName.revmem = {}; }
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
    },


    cancelNewPen: function () {
        app.login.updateAuthentDisplay();
        app.profile.display();
    }


}; //end of returned functions
}());


