//////////////////////////////////////////////////
//
//     D O   N O T   E D I T
//
// This file was written by makeMySQLCRUD.js.  Any changes should be made there.
//
//////////////////////////////////////////////////
// Local object reference cache and server persistence access.  Automatically
// serializes/deserializes JSON fields.

/*global app, jt, window */

/*jslint browser, white, fudge, for */

app.refmgr = (function () {
    "use strict";

    var cache = {};

    //All json fields are initialized to {} so they can be accessed directly.
    reconstituteFieldJSONObject: function (field, obj) {
        if(!obj[field]) {
            obj[field] = {}; }
        else {
            var text = obj[field];
            try {
                obj[field] = JSON.parse(text);
            } catch (e) {
                jt.log("reconstituteJSONObjectField " + obj.dsType + " " +
                       obj.dsId + " " + field + " reset to empty object from " +
                       text + " Error: " + e);
                obj[field] = {};
            } }
    }


    function deserialize (obj) {
        switch(obj.dsType) {
        case "MUser": 
            reconstituteFieldJSONObjectField("cliset", obj);
            reconstituteFieldJSONObjectField("themes", obj);
            reconstituteFieldJSONObjectField("preb", obj);
            break;
        case "Theme": 
            reconstituteFieldJSONObjectField("people", obj);
            reconstituteFieldJSONObjectField("cliset", obj);
            reconstituteFieldJSONObjectField("preb", obj);
            break;
        case "AdminLog": 
            break;
        case "Membic": 
            reconstituteFieldJSONObjectField("details", obj);
            reconstituteFieldJSONObjectField("svcdata", obj);
            reconstituteFieldJSONObjectField("reacdat", obj);
            break;
        case "Overflow": 
            reconstituteFieldJSONObjectField("preb", obj);
            break;
        case "MailNotice": 
            break;
        case "ActivitySummary": 
            reconstituteFieldJSONObjectField("reqdets", obj);
            break;
        case "ConnectionService": 
            break;
        }
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
        case "ActivitySummary": 
            break;
        case "ConnectionService": 
            break;
        }
    }


return {

    cached: function (dsType, dsId) {  //Returns the cached obj or null
        if(dsType && dsId && cache.dsType && cache.dsType.dsId) {
            return cache.dsType.dsId; }
        return null; }


    put: function (obj) {
        clearPrivilegedFields(obj);  //no sensitive info here
        cache[obj.dsType] = cache[obj.dsType] || {};
        cache[obj.dsType][obj.dsId] = retobj;
    }


    getFull: function (dsType, dsId, contf) {
        obj = cached(dsType, dsId);
        if(obj) {
            return contf(obj); }
        var url = app.refmgr.serverurl() + "/fetchobj?dt=" + dsType + "&di=" +
            dsId + jt.ts("&cb=", "second");
        jt.call("GET", url, null,
                function (objs) {
                    retobj = null;
                    if(objs.length > 0) {
                        retobj = deserialize(objs[0]);
                        app.refmgr.put(retobj); }
                    callback(retobj); },
                function (code, errtxt) {
                    jt.log("refmgr.getFull " + dsType + " " + dsId + " " +
                           code + ": " + errtxt);
                    callback(null); }
                jt.semaphore("refmgr.getFull" + dsType + dsId));
    },


    uncache: function (dsType, dsId) {
        cache[dsType] = cache[dsType] || {};
        cache[dsType][dsId] = null;
    },


    serverurl: function () { 
        var url = window.location.href;
        return url.split("/").slice(0, 3).join("/");
    }

}; //end of returned functions
}());

