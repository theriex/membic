/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false */

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
            penName.revmem = glo.dojo.json.stringify(penName.revmem); }
        if(typeof penName.settings === 'object') {
            penName.settings = glo.dojo.json.stringify(penName.settings); }
    },


    deserializeFields = function (penName) {
        var text, obj;
        //reconstitute revmem
        if(!penName.revmem) {
            penName.revmem = {}; }
        else if(typeof penName.revmem !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.revmem;
                obj = glo.dojo.json.parse(text);
                penName.revmem = obj;
            } catch (e) {
                glo.log("pen.deserializeFields " + penName.name + ": " + e);
                penName.revmem = {};
            } }
        if(typeof penName.revmem !== 'object') {
            glo.log("Re-initializing penName revmem.  Deserialized value " +
                    "was not an object: " + penName.revmem);
            penName.revmem = {}; }
        //reconstitute settings
        if(!penName.settings) {
            penName.settings = {}; }
        else if(typeof penName.settings !== 'object') {
            try {  //debug vars here help check for double encoding etc
                text = penName.settings;
                obj = glo.dojo.json.parse(text);
                penName.settings = obj;
            } catch (e2) {
                glo.log("pen.deserializeFields " + penName.name + ": " + e2);
                penName.settings = {};
            } }
        if(typeof penName.settings !== 'object') {
            glo.log("Re-initializing penName settings.  Deserialized value " +
                    "was not an object: " + penName.settings);
            penName.settings = {}; }
        //reconstitute top20s
        if(!penName.top20s) {
            penName.top20s = {}; }
        else if(typeof penName.top20s === "string") {
            penName.top20s = glo.dojo.json.parse(penName.top20s); }
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
            params = "penid=" + glo.instId(pen);
            glo.call("penbyid?" + params, 'GET', null,
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
                             glo.profile.resetReviews(); } },
                     function (code, errtxt) {
                         glo.log("refreshCurrentPenFields " + code + " " +
                                 errtxt); },
                     critsec); }
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        glo.layout.initContent();  //may call for pen name retrieval...
        glo.rel.loadoutbound();
        callback(currpenref.pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data, critsec = "";
        serializeFields(pen);
        data = glo.objdata(pen);
        glo.call("updpen?" + glo.login.authparams(), 'POST', data,
                 function (updpens) {
                     currpenref = glo.lcs.putPen(updpens[0]);
                     callok(currpenref); },
                 function (code, errtxt) {
                     deserializeFields(pen);  //undo pre-call serialization
                     callfail(code, errtxt); },
                 critsec);
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name, critsec = "";
        name = glo.byId('pnamein').value;
        buttonhtml = glo.byId('formbuttons').innerHTML;
        glo.out('formbuttons', "Creating Pen Name...");
        newpen = {};
        newpen.name = name;
        if(currpenref && currpenref.settings) {
            newpen.settings = currpenref.settings;
            serializeFields(newpen); }
        data = glo.objdata(newpen);
        glo.call("newpen?" + glo.login.authparams(), 'POST', data,
                 function (newpens) {
                     currpenref = glo.lcs.putPen(newpens[0]);
                     if(!penNameRefs) {
                         penNameRefs = []; }
                     penNameRefs.push(currpenref);
                     glo.rel.resetStateVars("new");  //updates header display
                     returnCall(); },
                 function (code, errtxt) {
                     glo.out('penformstat', errtxt);
                     glo.out('formbuttons', buttonhtml); },
                 critsec);
    },


    cancelNewPen = function () {
        glo.login.updateAuthentDisplay();
        glo.profile.display();
    },


    newPenNameDisplay = function (callback) {
        var html, cancelbutton = "";
        returnFuncMemo = callback;
        glo.login.updateAuthentDisplay("hide");
        glo.out('centerhdiv', "");
        if(currpenref && currpenref.pen) {
            cancelbutton = "<button type=\"button\" id=\"cancelbutton\"" +
                                  " onclick=\"glo.pen.cancelNewPen();" + 
                                            "return false;\"" +
                ">Cancel</button>"; }
        //need to mimic layout initContent divs here so they are available
        //as needed for continuation processing.
        html = "<div id=\"chead\"> </div><div id=\"cmain\">" + 
        "<div id=\"penformstat\">&nbsp;</div>" +
        "<table class=\"pennametable\">" +
          "<tr>" +
            "<td colspan=\"3\">" + 
              "<div id=\"pennamedescrdiv\" class=\"introverview\">" +
              "Your pen name is a unique expression of style. You can have separate pen names for different personas, revealing as much (or as little) about yourself as you want. Use your real name, or get creative...</div>" +
            "</td>" +
          "</tr>" +
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
        glo.out('contentdiv', html);
        glo.onchange('pnamein', createPenName);
        glo.onclick('createbutton', createPenName);
        glo.layout.adjust();
        glo.byId('pnamein').focus();
    },


    selectPenByName = function (name) {
        var i;
        for(i = 0; i < penNameRefs.length; i += 1) {
            if(penNameRefs[i].pen.name === name) {
                currpenref = penNameRefs[i];
                glo.skinner.setColorsFromPen(currpenref.pen);
                //reload relationships and activity
                glo.rel.resetStateVars("reload", currpenref.pen);
                //update the accessed time so that the latest pen name is
                //chosen by default next time. 
                updatePenName(penNameRefs[i].pen, 
                              glo.profile.display, glo.profile.display);
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
        glo.skinner.setColorsFromPen(currpenref.pen);
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
        glo.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        glo.layout.adjust();
        url = "mypens?" + glo.login.authparams();
        glo.call(url, 'GET', null,
                 function (pens) {
                     var i;
                     penNameRefs = [];
                     for(i = 0; i < pens.length; i += 1) {
                         penNameRefs.push(glo.lcs.putPen(pens[i])); }
                     chooseOrCreatePenName(callback); },
                 function (code, errtxt) {
                     glo.out('contentdiv', "Pen name retrieval failed: " + 
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
                return glo.instId(currpenref.pen); }
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


