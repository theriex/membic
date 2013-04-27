/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . p e n
//
define([], function () {
    "use strict";

    var penNames,
        currpen,
        returnFuncMemo,  //if a form display is needed


    resetStateVars = function () {
        penNames = null;
        currpen = null;
        returnFuncMemo = null;
    },


    //update the currently stored version of the pen.
    noteUpdatedPen = function (pen) {
        var i, penid = mor.instId(pen);
        for(i = 0; penNames && i < penNames.length; i += 1) {
            if(mor.instId(penNames[i]) === penid) {
                penNames[i] = pen;
                break; } }
        if(mor.instId(currpen) === penid) {
            currpen = pen; }
    },


    //returns the referenced pen if it is owned by the current user
    getHomePen = function (penid) {
        var i;
        for(i = 0; penNames && i < penNames.length; i += 1) {
            if(mor.instId(penNames[i]) === penid) {
                return penNames[i]; } }
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
    //can lead to race conditions if the app is dealing with that in
    //the meantime while the call is going on.
    refreshCurrentPenFields = function () {
        var params;
        if(currpen) {
            params = "penid=" + mor.instId(currpen);
            mor.call("penbyid?" + params, 'GET', null,
                     function (pens) {
                         if(pens.length > 0) {
                             currpen.name = pens[0].name;
                             currpen.shoutout = pens[0].shoutout;
                             currpen.city = pens[0].city;
                             currpen.accessed = pens[0].accessed;
                             currpen.modified = pens[0].modified;
                             currpen.top20s = pens[0].top20s;
                             currpen.following = pens[0].following;
                             currpen.followers = pens[0].followers; } },
                     function (code, errtxt) {
                         mor.log("refreshCurrentPenFields " + code + " " +
                                 errtxt); }); }
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        mor.layout.initContent();  //may call for pen name retrieval...
        mor.rel.loadoutbound(currpen);
        callback(currpen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data;
        serializeFields(pen);
        data = mor.objdata(pen);
        mor.call("updpen?" + mor.login.authparams(), 'POST', data,
                 function (updpens) {
                     currpen = updpens[0];
                     deserializeFields(currpen);
                     callok(currpen); },
                 function (code, errtxt) {
                     callfail(code, errtxt); });
    },


    createPenName = function () {
        var buttonhtml, newpen, data, name;
        name = mor.byId('pnamein').value;
        buttonhtml = mor.byId('formbuttons').innerHTML;
        mor.out('formbuttons', "Creating Pen Name...");
        newpen = {};
        newpen.name = name;
        if(currpen && currpen.settings) {
            newpen.settings = currpen.settings;
            serializeFields(newpen); }
        data = mor.objdata(newpen);
        mor.call("newpen?" + mor.login.authparams(), 'POST', data,
                 function (newpens) {
                     currpen = newpens[0];
                     if(!penNames) {
                         penNames = []; }
                     penNames.push(currpen);
                     deserializeFields(currpen);
                     mor.rel.resetStateVars();
                     mor.activity.resetStateVars();
                     mor.login.updateAuthentDisplay();
                     returnCall(); },
                 function (code, errtxt) {
                     mor.out('penformstat', errtxt);
                     mor.out('formbuttons', buttonhtml); });
    },


    newPenNameDisplay = function (callback) {
        var html, cancelbutton = "";
        returnFuncMemo = callback;
        mor.login.updateAuthentDisplay("hide");
        mor.out('centerhdiv', "");
        if(currpen) {
            cancelbutton = "<button type=\"button\" id=\"cancelbutton\"" +
                                  " onclick=\"mor.profile.display();" + 
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
        for(i = 0; i < penNames.length; i += 1) {
            if(penNames[i].name === name) {
                currpen = penNames[i];
                mor.skinner.setColorsFromPen(currpen);
                //reload relationships and activity
                mor.rel.resetStateVars();
                mor.activity.resetStateVars();
                //update the accessed time so that the latest pen name is
                //chosen by default next time. 
                updatePenName(penNames[i], 
                              mor.profile.display, mor.profile.display);
                break; } }
    },


    findHomePen = function () {
        var i, lastChosen = "0000-00-00T00:00:00Z", pen;
        if(penNames && penNames.length) {
            for(i = 0; i < penNames.length; i += 1) {
                deserializeFields(penNames[i]);
            if(penNames[i].accessed > lastChosen) {
                lastChosen = penNames[i].accessed;
                pen = penNames[i]; } } }
        return pen;
    },


    chooseOrCreatePenName = function (callback) {
        if(!penNames || penNames.length === 0) {
            return newPenNameDisplay(callback); }
        currpen = findHomePen();
        mor.skinner.setColorsFromPen(currpen);
        returnCall(callback);
    },


    getPenName = function (callback) {
        var url;
        if(penNames) {
            chooseOrCreatePenName(callback); }
        mor.out('contentdiv', "<p>Retrieving your pen name(s)...</p>");
        mor.layout.adjust();
        url = "mypens?" + mor.login.authparams();
        mor.call(url, 'GET', null,
                 function (pens) {
                     penNames = pens;
                     chooseOrCreatePenName(callback); },
                 function (code, errtxt) {
                     mor.out('contentdiv', "Pen name retrieval failed: " + 
                             code + " " + errtxt); });
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        getPen: function (callback) {
            if(currpen) {  //initialization done, no side effects..
                return callback(currpen); }
            getPenName(callback); },  //triggers setup processing.
        currPenId: function () {
            return mor.instId(currpen) || 0; },
        updatePen: function (pen, callbackok, callbackfail) {
            updatePenName(pen, callbackok, callbackfail); },
        noteUpdatedPen: function (pen) {
            noteUpdatedPen(pen); },
        getPenNames: function () { 
            return penNames; },
        newPenName: function (callback) {
            newPenNameDisplay(callback); },
        selectPenByName: function (name) {
            selectPenByName(name); },
        getHomePen: function (penid) {
            return getHomePen(penid); },
        findHomePen: function () {
            return findHomePen(); },
        refreshCurrent: function () {
            refreshCurrentPenFields(); },
        deserializeFields: function (pen) {
            deserializeFields(pen); }
    };

});


