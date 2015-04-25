/*global JSON: false, window: false, app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.pen = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var loginpenid,
        returnFuncMemo,  //function to return to after dialog completed


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        callback(app.lcs.getRef("pen", loginpenid).pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data;
        app.pen.serializeFields(pen);
        data = jt.objdata(pen);
        app.pen.deserializeFields(pen);  //in case update fail or interim use
        jt.call('POST', "updpen?" + app.login.authparams(), data,
                 function (updpens) {
                     app.lcs.put("pen", updpens[0]);
                     callok(updpens[0]); },
                 app.failf(function (code, errtxt) {
                     callfail(code, errtxt); }),
                jt.semaphore("pen.updatePenName"));
    },


    newPenNameDisplay = function (callback) {
        var html;
        returnFuncMemo = callback;
        app.login.updateAuthentDisplay("hide");
        html = ["div", {id: "createpndiv"},
                [["div", {id: "createpnintrodiv"},
                  "Your pen name is a unique public identifier for membics you write. Use your real name or get creative."],
                 ["div", {id: "createpnformdiv"},
                  [["label", {fo: "pnamein", cla: "liflabw", id: "pnameinlab"},
                    "Pen Name"],
                   ["input", {id: "pnamein", cla: "lifin", type: "text",
                              onchange: jt.fs("app.pen.createPenName()")}],
                   ["div", {id: "penformstat"}],
                   ["div", {id: "pncbuttondiv", cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "createbutton",
                                onclick: jt.fs("app.pen.createPenName()")},
                     "Create"]]]]]];
        jt.out('contentdiv', jt.tac2html(html));
        jt.byId('pnamein').focus();
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        returnFuncMemo = null;
    },


    createPenName: function () {
        var buttonhtml, data, name;
        name = jt.byId('pnamein').value;
        if(!name || !name.trim()) {
            return; }  //no input, so nothing to create yet
        buttonhtml = jt.byId('pncbuttondiv').innerHTML;
        jt.out('pncbuttondiv', "Creating Pen Name...");
        data = jt.objdata({name: name});
        jt.call('POST', "newpen?" + app.login.authparams(), data,
                 function (newpens) {
                     loginpenid = jt.instId(newpens[0]);
                     app.lcs.put("pen", newpens[0]);
                     returnCall(); },
                 app.failf(function (code, errtxt) {
                     jt.out('penformstat', errtxt);
                     jt.out('formbuttons', buttonhtml); }),
                jt.semaphore("pen.createPenName"));
    },


    getPen: function (penid, callback) {
        var penref, url, time;
        penid = penid || loginpenid;
        penref = app.lcs.getRef("pen", penid);
        if(penref && penref.pen) {
            return callback(penref.pen); }
        jt.out('contentdiv', ((!penid && !loginpenid) ||
                              (penid && penid === loginpenid) ? 
                              "Retrieving your Pen Name..." :
                              "Retrieving Pen Name " + penid + "..."));
        url = "blockfetch?" + app.login.authparams() +
            ((penid !== loginpenid) ? "&penid=" + penid : "");
        time = new Date().getTime();
        jt.call('GET', url, null,
                function (objs) {  // pen and recent/top reviews
                    var pen, revs, i;
                    time = new Date().getTime() - time;
                    jt.log("blockfetch returned in " + time/1000 + " seconds.");
                    pen = objs[0];
                    if(!pen) {
                        return newPenNameDisplay(callback); }
                    app.lcs.put("pen", pen);
                    if(!loginpenid && pen.mid) {
                        loginpenid = jt.instId(pen); }
                    revs = objs.slice(1);
                    revs.sort(function (a, b) {
                        if(a.modified < b.modified) { return 1; }
                        if(a.modified > b.modified) { return -1; }
                        return 0; });
                    app.lcs.putAll("rev", revs);
                    for(i = 0; i < revs.length; i += 1) {
                        revs[i] = jt.instId(revs[i]); }
                    pen.recent = revs;
                    returnCall(callback); },
                app.failf(function (code, errtxt) {
                    jt.out('contentdiv', "Pen name retrieval failed: " +
                           code + ": " + errtxt); }),
                jt.semaphore("pen.getPen"));
    },


    myPenId: function () {
        return loginpenid;
    },
    myPenRef: function () {
        return app.lcs.getRef("pen", loginpenid);
    },
    myPenName: function () {
        var penref = app.pen.myPenRef();
        if(penref && penref.pen) {
            return penref.pen; }
        return null;
    },


    updatePen: function (pen, callbackok, callbackfail) {
        updatePenName(pen, callbackok, callbackfail);
    },


    newPenName: function (callback) {
        newPenNameDisplay(callback);
    },


    serializeFields: function (penName) {
        if(typeof penName.settings === 'object') {
            penName.settings = JSON.stringify(penName.settings); }
        //top20s are maintained and rebuilt by the server, so
        //serializing is not strictly necessary, but better to have
        //the field reflect the state of the other serialized fields.
        if(typeof penName.top20s === 'object') {
            penName.top20s = JSON.stringify(penName.top20s); }
        if(typeof penName.stash === 'object') {
            penName.stash = JSON.stringify(penName.stash); }
    },


    deserializeFields: function (penName) {
        penName.remembered = penName.remembered || "";
        app.lcs.reconstituteJSONObjectField("top20s", penName);
        app.lcs.reconstituteJSONObjectField("stash", penName);
        app.lcs.reconstituteJSONObjectField("settings", penName);
    },


    cancelNewPen: function () {
        app.login.updateAuthentDisplay();
        app.profile.display();
    }


}; //end of returned functions
}());

