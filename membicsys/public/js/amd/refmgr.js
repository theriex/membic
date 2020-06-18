//////////////////////////////////////////////////
//
//     D O   N O T   E D I T
//
// This file was written by makeMySQLCRUD.js.  Any changes should be made there.
//
//////////////////////////////////////////////////
// Local object reference cache and server persistence access.  Automatically
// serializes/deserializes JSON fields.

/*global app, jt, window, console */

/*jslint browser, white, fudge, long */

app.refmgr = (function () {
    "use strict";

    var cache = {};

    var persistentTypes = ["MUser", "Theme", "AdminLog", "Membic", "Overflow", "MailNotice", "Audience", "ActivitySummary", "ConnectionService"];


    //All json fields are initialized to {} so they can be accessed directly.
    function reconstituteFieldJSONObject (field, obj) {
        if(!obj[field]) {
            obj[field] = {}; }
        else {
            var text = obj[field];
            try {
                obj[field] = JSON.parse(text);
            } catch (e) {
                jt.log("reconstituteFieldJSONObject " + obj.dsType + " " +
                       obj.dsId + " " + field + " reset to empty object from " +
                       text + " Error: " + e);
                obj[field] = {};
            } }
    }


    function deserialize (obj) {
        switch(obj.dsType) {
        case "MUser": 
            reconstituteFieldJSONObject("cliset", obj);
            reconstituteFieldJSONObject("themes", obj);
            reconstituteFieldJSONObject("preb", obj);
            break;
        case "Theme": 
            reconstituteFieldJSONObject("people", obj);
            reconstituteFieldJSONObject("cliset", obj);
            reconstituteFieldJSONObject("preb", obj);
            break;
        case "AdminLog": 
            break;
        case "Membic": 
            reconstituteFieldJSONObject("details", obj);
            reconstituteFieldJSONObject("svcdata", obj);
            reconstituteFieldJSONObject("reacdat", obj);
            break;
        case "Overflow": 
            reconstituteFieldJSONObject("preb", obj);
            break;
        case "MailNotice": 
            break;
        case "Audience": 
            break;
        case "ActivitySummary": 
            reconstituteFieldJSONObject("reqdets", obj);
            break;
        case "ConnectionService": 
            break;
        }
        return obj;
    }


    function serialize (obj) {
        switch(obj.dsType) {
        case "MUser": 
            obj.cliset = JSON.stringify(obj.cliset);
            obj.themes = JSON.stringify(obj.themes);
            obj.preb = JSON.stringify(obj.preb);
            break;
        case "Theme": 
            obj.people = JSON.stringify(obj.people);
            obj.cliset = JSON.stringify(obj.cliset);
            obj.preb = JSON.stringify(obj.preb);
            break;
        case "AdminLog": 
            break;
        case "Membic": 
            obj.details = JSON.stringify(obj.details);
            obj.svcdata = JSON.stringify(obj.svcdata);
            obj.reacdat = JSON.stringify(obj.reacdat);
            break;
        case "Overflow": 
            obj.preb = JSON.stringify(obj.preb);
            break;
        case "MailNotice": 
            break;
        case "Audience": 
            break;
        case "ActivitySummary": 
            obj.reqdets = JSON.stringify(obj.reqdets);
            break;
        case "ConnectionService": 
            break;
        }
        return obj;
    }


    function clearPrivilegedFields (obj) {
        switch(obj.dsType) {
        case "MUser": 
            obj.email = "";
            obj.status = "";
            obj.altinmail = "";
            break;
        case "Theme": 
            break;
        case "AdminLog": 
            break;
        case "Membic": 
            break;
        case "Overflow": 
            break;
        case "MailNotice": 
            break;
        case "Audience": 
            break;
        case "ActivitySummary": 
            break;
        case "ConnectionService": 
            break;
        }
    }


return {

    cached: function (dsType, dsId) {  //Returns the cached obj or null
        if(dsType && dsId && cache[dsType] && cache[dsType][dsId]) {
            return cache[dsType][dsId]; }
        return null; },


    put: function (obj) {  //obj is already deserialized
        if(!obj) {
            jt.log("refmgr.put: Attempt to put null obj");
            console.trace(); }
        clearPrivilegedFields(obj);  //no sensitive info in cache
        cache[obj.dsType] = cache[obj.dsType] || {};
        cache[obj.dsType][obj.dsId] = obj;
        return obj;
    },


    getFull: function (dsType, dsId, contf) {
        var obj = app.refmgr.cached(dsType, dsId);
        if(obj) {  //force an async callback for consistent code flow
            return setTimeout(function () { contf(obj); }, 50); }
        if(persistentTypes.indexOf(dsType) < 0) {
            jt.log("refmgr.getFull: unknown dsType " + dsType);
            console.trace(); }
        var url = app.dr("/api/fetchobj?dt=" + dsType + "&di=" + dsId +
                         jt.ts("&cb=", "second"));
        var logpre = "refmgr.getFull " + dsType + " " + dsId + " ";
        jt.call("GET", url, null,
                function (objs) {
                    var retobj = null;
                    if(objs.length > 0) {
                        retobj = objs[0];
                        jt.log(logpre + "cached.");
                        deserialize(retobj);
                        app.refmgr.put(retobj); }
                    contf(retobj); },
                function (code, errtxt) {
                    jt.log(logpre + code + ": " + errtxt);
                    contf(null); },
                jt.semaphore("refmgr.getFull" + dsType + dsId));
    },


    uncache: function (dsType, dsId) {
        cache[dsType] = cache[dsType] || {};
        cache[dsType][dsId] = null;
    },


    deserialize: function (obj) {
        return deserialize(obj);
    },


    postdata: function (obj) {
        serialize(obj);
        var dat = jt.objdata(obj);
        deserialize(obj);
        return dat;
    }

}; //end of returned functions
}());

