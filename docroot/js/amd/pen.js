/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . p e n
//
define([], function () {
    "use strict";

    var penNameRefs,  //array of authorized PenRefs
        currpenref,   //the currently selected PenRef
        returnFuncMemo,  //function to return to after dialog completed


    resetStateVars = function () {
        penNameRefs = null;
        currpenref = null;
        returnFuncMemo = null;
    },


    serializeFields = function (penName) {
        if(typeof penName.revmem === 'object') {
            penName.revmem = mor.dojo.json.stringify(penName.revmem); }
        if(typeof penName.settings === 'object') {
            penName.settings = mor.dojo.json.stringify(penName.settings); }
    },


    deserializeFields = function (penName) {
        var text, obj;
        //reconstitute revmem
        if(!penName.revmem) {
            penName.revmem = {}; }
        else if(typeof penName.revmem !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.revmem;
                obj = mor.dojo.json.parse(text);
                penName.revmem = obj;
            } catch (e) {
                mor.log("pen.deserializeFields " + penName.name + ": " + e);
                penName.revmem = {};
            } }
        if(typeof penName.revmem !== 'object') {
            mor.log("Re-initializing penName revmem.  Deserialized value " +
                    "was not an object: " + penName.revmem);
            penName.revmem = {}; }
        //reconstitute settings
        if(!penName.settings) {
            penName.settings = {}; }
        else if(typeof penName.settings !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.settings;
                obj = mor.dojo.json.parse(text);
                penName.settings = obj;
            } catch (e2) {
                mor.log("pen.deserializeFields " + penName.name + ": " + e2);
                penName.settings = {};
            } }
        if(typeof penName.settings !== 'object') {
            mor.log("Re-initializing penName settings.  Deserialized value " +
                    "was not an object: " + penName.settings);
            penName.settings = {}; }
        //reconstitute top20s
        if(!penName.top20s) {
            penName.top20s = {}; }
        else if(typeof penName.top20s === "string") {
            penName.top20s = mor.dojo.json.parse(penName.top20s); }
    },


    //Update changed fields for currpen so anything referencing it
    //gets the latest field values from the db.  Only updates public
    //fields.  Explicitely does not update the settings, since that
    //can lead to race conditions if the app is dealing with that
    //while this call is going on.  The cached pen ref is modified
    //directly so the updated info is globally available.
    refreshCurrentPenFields = function () {
        var pen, params, critsec = "";
        pen = currpenref && currpenref.pen;
        if(pen) {
            params = "penid=" + mor.instId(pen);
            mor.call("penbyid?" + params, 'GET', null,
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
                             mor.profile.resetReviews(); } },
                     function (code, errtxt) {
                         mor.log("refreshCurrentPenFields " + code + " " +
                                 errtxt); },
                     critsec); }
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        mor.layout.initContent();  //may call for pen name retrieval...
        mor.rel.loadoutbound();
        callback(currpenref.pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data, critsec = "";
        serializeFields(pen);
        data = mor.objdata(pen);
        mor.call("updpen?" + mor.login.authparams(), 'POST', data,
                 function (updpens) {
                     currpenref = mor.lcs.putPen(updpens[0]);
                     callok(currpenref); },
                 function (code, errtxt) {
                     deserializeFields(pen);  //undo pre-call serialization
                     callfail(code, errtxt); },
                 critsec);
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name, critsec = "";
        name = mor.byId('pnamein').value;
        buttonhtml = mor.byId('formbuttons').innerHTML;
        mor.out('formbuttons', "Creating Pen Name...");
        newpen = {};
        newpen.name = name;
        if(currpenref && currpenref.settings) {
            newpen.settings = currpenref.settings;
            serializeFields(newpen); }
        data = mor.objdata(newpen);
        mor.call("newpen?" + mor.login.authparams(), 'POST', data,
                 function (newpens) {
                     currpenref = mor.lcs.putPen(newpens[0]);
                     if(!penNameRefs) {
                         penNameRefs = []; }
                     penNameRefs.push(currpenref);
                     mor.rel.resetStateVars("new");
                     mor.login.updateAuthentDisplay();
                     returnCall(); },
                 function (code, errtxt) {
                     mor.out('penformstat', errtxt);
                     mor.out('formbuttons', buttonhtml); },
                 critsec);
    },


    cancelNewPen = function () {
        mor.login.updateAuthentDisplay();
        mor.profile.display();
    },


    newPenNameDisplay = function (callback) {
        var html, cancelbutton = "";
        returnFuncMemo = callback;
        mor.login.updateAuthentDisplay("hide");
        mor.out('centerhdiv', "");
        if(currpenref && currpenref.pen) {
            cancelbutton = "<button type=\"button\" id=\"cancelbutton\"" +
                                  " onclick=\"mor.pen.cancelNewPen();" + 
                                            "return false;\"" +
                ">Cancel</button>"; }
        //need to mimic layout initContent divs here so they are available
        //as needed for continuation processing.
        html = "<div id=\"chead\"> </div><div id=\"cmain\"><p>Your pen name is a unique expression of style. You can have separate pen names for different personas, revealing as much (or as little) about yourself as you want. Use your real name, or get creative...</p>" +
        "<div id=\"penformstat\">&nbsp;</div>" +
        "<table class=\"pennametable\">" +
          "<tr>" +
            "<td rowspan=\"2\"><img src=\"img/penname.png\"/></td>" +
            "<td class=\"formattr\">Writing as...</td>" +
          "</tr>" +
          "<tr>" +
            "<td class=\"formval\">" +
              "<input type=\"text\" id=\"pnamein\" size=\"34\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"formbuttons\"align=\"center\">" +
              cancelbutton +
              "<button type=\"button\" id=\"createbutton\">Create</button>" +
            "</td>" +
          "</tr>" +
        "</table></div>";
        mor.out('contentdiv', html);
        mor.onchange('pnamein', createPenName);
        mor.onclick('createbutton', createPenName);
        mor.layout.adjust();
        mor.byId('pnamein').focus();
    },


    selectPenByName = function (name) {
        var i;
        for(i = 0; i < penNameRefs.length; i += 1) {
            if(penNameRefs[i].pen.name === name) {
                currpenref = penNameRefs[i];
                mor.skinner.setColorsFromPen(currpenref.pen);
                //reload relationships and activity
                mor.rel.resetStateVars("reload", currpenref.pen);
                //update the accessed time so that the latest pen name is
                //chosen by default next time. 
                updatePenName(penNameRefs[i].pen, 
                              mor.profile.display, mor.profile.display);
                break; } }
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
        mor.skinner.setColorsFromPen(currpenref.pen);
        returnCall(callback);
    },


    getPenNames = function () {
        var i, pens = [];
        for(i = 0; penNameRefs && i < penNameRefs.length; i += 1) {
            pens.push(penNameRefs[i].pen); }
        return pens;
    },


    getPenName = function (callback) {
        var url, critsec = "";
        if(penNameRefs) {
            chooseOrCreatePenName(callback); }
        mor.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        mor.layout.adjust();
        url = "mypens?" + mor.login.authparams();
        mor.call(url, 'GET', null,
                 function (pens) {
                     var i;
                     penNameRefs = [];
                     for(i = 0; i < pens.length; i += 1) {
                         penNameRefs.push(mor.lcs.putPen(pens[i])); }
                     chooseOrCreatePenName(callback); },
                 function (code, errtxt) {
                     mor.out('contentdiv', "Pen name retrieval failed: " + 
                             code + " " + errtxt); },
                 critsec);
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        getPen: function (callback) {
            if(currpenref) {  //initialization done, no side effects..
                return callback(currpenref.pen); }
            getPenName(callback); },  //triggers setup processing.
        currPenId: function () {
            if(currpenref && currpenref.pen) {
                return mor.instId(currpenref.pen); }
            return 0; },
        currPenRef: function () {
            return currpenref; },
        updatePen: function (pen, callbackok, callbackfail) {
            updatePenName(pen, callbackok, callbackfail); },
        getPenNames: function () { 
            return getPenNames(); },
        newPenName: function (callback) {
            newPenNameDisplay(callback); },
        selectPenByName: function (name) {
            selectPenByName(name); },
        refreshCurrent: function () {
            refreshCurrentPenFields(); },
        deserializeFields: function (pen) {
            deserializeFields(pen); },
        cancelNewPen: function () {
            cancelNewPen(); }
    };

});


