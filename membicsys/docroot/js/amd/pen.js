/*global JSON, app, jt, confirm */

/*jslint white, fudge */

app.pen = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var loginpenid,
        returnFuncMemo,  //function to return to after dialog completed
        visprefvals = [
            { ident: "blocked", code: "x", name: "Block",
              description: "Permanently block everything from $PEN" },
            { ident: "background", code: "z", name: "Background",
              description: "Prefer others over $PEN" },
            { ident: "normal", code: "&#x2022;", name: "Normal",
              description: "" },
            { ident: "prefer", code: "&#x2605;", name: "Prefer",
              description: "Prefer posts from $PEN over others" }],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    fetchCoopAndRetry = function (coopid, penid, divid, callback) {
        jt.out(divid, "Fetching cooperative theme " + coopid + "...");
        app.pcd.blockfetch("coop", coopid, function (ignore /*coop*/) {
            app.pen.coopNames(penid, divid, callback); }, divid);
    },


    returnCall = function (callback) {
        if(!callback) {
            callback = returnFuncMemo; }
        callback(app.lcs.getRef("pen", loginpenid).pen);
    },


    updatePenName = function (pen, callok, callfail) {
        var data, acctval = "";
        if(pen.stash && pen.stash.account) {
            //do not leak account info in to general JSON field when writing
            acctval = pen.stash.account;
            pen.stash.account = ""; }
        app.pen.serializeFields(pen);
        data = jt.objdata(pen, ["recent", "top20s"]);
        app.pen.deserializeFields(pen);  //in case update fail or interim use
        jt.call('POST', "updpen?" + app.login.authparams(), data,
                 function (updpens) {
                     updpens[0].recent = pen.recent;
                     app.lcs.put("pen", updpens[0]);
                     if(updpens[0].stash) {
                         updpens[0].stash.account = acctval; }
                     callok(updpens[0]); },
                 app.failf(function (code, errtxt) {
                     callfail(code, errtxt); }),
                jt.semaphore("pen.updatePenName"));
    },


    newPenNameDisplay = function (callback) {
        var html;
        returnFuncMemo = callback;
        app.login.updateAuthentDisplay("hide");
        jt.out('headingdivcontent', "");
        html = ["div", {id: "createpndiv"},
                [["div", {id: "createpnintrodiv"},
                  "Your pen name is a unique public identifier for membics you write. Use your real name or get creative."],
                 ["div", {id: "createpnformdiv"},
                  [["label", {fo: "pnamein", cla: "liflabw", id: "pnameinlab"},
                    "Pen Name"],
                   ["input", {id: "pnamein", cla: "lifin", type: "text",
                              onchange: jt.fs("app.pen.createPenName()")}],
                   ["div", {id: "penformstat", cla: "formline"}],
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
        loginpenid = 0;
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
                 app.failf(function (ignore /*code*/, errtxt) {
                     jt.out('penformstat', errtxt);
                     jt.out('pncbuttondiv', buttonhtml); }),
                jt.semaphore("pen.createPenName"));
    },


    getPen: function (penid, callback, divid) {
        app.pcd.blockfetch("pen", penid, callback, divid);
    },


    bypenid: function (penid, tabname) {
        var penref = app.lcs.getRef("pen", penid);
        if(penref.pen) {
            return app.pcd.display("pen", penid, tabname, penref.pen); }
        app.pcd.fetchAndDisplay("pen", penid, tabname);
    },


    coopNames: function (pen, divid, callback) {
        var ret = {};
        pen.coops = pen.coops || "";
        pen.coops.csvarray().every(function (coopid) {
            var coopref;
            if(!ret[coopid]) {  //try cache lookup
                coopref = app.lcs.getRef("coop", coopid);
                if(coopref.coop) {
                    ret[coopid] = coopref.coop.name;
                    app.coopnames[coopid] = ret[coopid]; } }
            if(!ret[coopid]) {  //try stashed value from coop.verifyStash
                if(pen.stash && pen.stash["ctm" + coopid] &&
                   pen.stash["ctm" + coopid].name) {
                    ret[coopid] = pen.stash["ctm" + coopid].name;
                    app.coopnames[coopid] = ret[coopid]; } }
            if(!ret[coopid] && coopref.status === "not cached") {
                fetchCoopAndRetry(coopid, pen, divid, callback);
                return false; }
            return true; });
        callback(ret);
    },


    postableCoops: function (pen) {
        var ctms = [];
        pen = pen || app.pen.myPenName();
        if(!pen.stash) {
            return []; }
        Object.keys(pen.stash).forEach(function (key) {
            var obj;
            if(key.startsWith("ctm")) {
                obj = pen.stash[key];
                if(obj.memlev >= 1) {
                    obj.ctmid = key.slice(3);
                    //was a member, but verify haven't resigned
                    if(pen.coops && pen.coops.csvcontains(obj.ctmid)) {
                        ctms.push(obj); } } } });
        ctms.sort(function (a, b) {
            if(a.lastpost && !b.lastpost) { return -1; }
            if(!a.lastpost && b.lastpost) { return 1; }
            if(a.lastpost < b.lastpost) { return 1; }
            if(a.lastpost > b.lastpost) { return -1; }
            return 0; });
        return ctms;
    },


    setMyPenId: function (penid) {
        loginpenid = penid;
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


    visprefs: function (revdivid, penid, penname) {
        var pen, html, pcode;
        penname = jt.dec(penname || "pen " + penid);
        pen = app.pen.myPenName();
        if(!pen) {
            return jt.err("Sign in to prefer, background or block posts from " +
                          penname); }
        html = [];
        pcode = app.pen.prefcode(penid);
        visprefvals.forEach(function (pv, i) {
            html.unshift(["div", {cla: "visprefseldiv"},
                          [["input", {type: "radio", name: "vpr", 
                                      value: pv.name, id: "vprin" + i,
                                      checked: jt.toru(pv.code === pcode)}],
                           ["span", {cla: "vispreflabspan"}, pv.name],
                           ["span", {cla: "visprefdescrspan"}, 
                            pv.description.replace(/\$PEN/g, penname)]]]); });
        html = ["div", {id: "vpdlgdiv"},
                [html,
                 ["div", {cla: "dlgbuttonsdiv"},
                  [["button", {type: "button", id: "cancelbutton",
                               onclick: jt.fs("app.layout.cancelOverlay()")},
                    "Cancel"],
                   ["button", {type: "button", id: "okbutton",
                               onclick: jt.fs("app.pen.updateVisPrefs('" +
                                              penid + "')")},
                    "Ok"]]]]];
        app.layout.openOverlay(app.layout.placerel("fppsdiv" + revdivid, 
                                                   5, -30), 
                               html);
    },


    updateVisPrefs: function (penid) {
        var vp = null, pen;
        visprefvals.forEach(function (pv, i) {
            var cb = jt.byId("vprin" + i);
            if(cb && cb.checked) {
                vp = pv; } });
        if(vp && vp.ident === "blocked" && 
               !confirm("Blocking cannot be undone. Permanently block?")) {
            return; }
        app.layout.cancelOverlay();
        if(vp) {
            pen = app.pen.myPenName();
            pen.preferred = pen.preferred || "";
            pen.preferred = pen.preferred.csvremove(penid);
            pen.background = pen.background || "";
            pen.background = pen.background.csvremove(penid);
            pen.blocked = pen.blocked || "";
            pen.blocked = pen.blocked.csvremove(penid);
            switch(vp.ident) {
            case "blocked":
                pen.blocked = pen.blocked.csvappend(penid); break;
            case "background":
                pen.background = pen.background.csvappend(penid); break;
            case "prefer":
                pen.preferred = pen.preferred.csvappend(penid); break; }
            app.pen.updatePen(pen, app.activity.redisplay, app.failf); }
    },


    prefcode: function (penid) {
        var pen;
        if(penid === app.pen.myPenId()) {
            return ""; }
        pen = app.pen.myPenName();
        if(pen && pen.preferred && pen.preferred.csvcontains(penid)) {
            return visprefvals[3].code; }
        if(pen && pen.background && pen.background.csvcontains(penid)) {
            return visprefvals[1].code; }
        if(pen && pen.blocked && pen.blocked.csvcontains(penid)) {
            return visprefvals[0].code; }
        return visprefvals[2].code; 
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
    }


}; //end of returned functions
}());

