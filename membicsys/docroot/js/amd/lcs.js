/*global app, jt, window */

/*jslint browser, white, fudge, for */

//////////////////////////////////////////////////////////////////////
// Local Cache Storage for pen names, relationships, reviews, etc.
// Objects are indexed by the string value of the Id to avoid any
// potential object attribute/array index confusion.  The top level
// closure variables hold the reference objects.  Each reference
// object has an instance object, status text, and last update
// timestamp.  For example a PenRef looks like
//
//     pen: fully deserialized pen object,
//     status: "not cached", "ok" or "fetch failure status message"
//     updtime: time when retrieved from server
//
// These core reference object fields should not be modified by
// functions outside of this module.  Additional decorative fields may
// be managed by other modules for ease of access.
//
// Some known decorated object structures:
//   PenRef
//     outrels: array of oubound RelRefs
//     inrels: array of inbound RelRefs
//

app.lcs = (function () {
    "use strict";

    var cache = {
        activetps: { refs: {} },
        profile: { refs: {},
                   fetchend: "profbyid",
                   fetchparamf: function (id) {
                       return "profid=" + id; },
                   putprep: function (profobj) {
                       app.profile.deserializeFields(profobj); } },
        rel: { refs: {} },
        coop: { refs: {},
                fetchend: "ctmbyid",
                fetchparamf: function (id) {
                    return "coopid=" + id; },
                putprep: function (ctmobj) {
                    app.coop.deserializeFields(ctmobj); } } };


    function idify (id) {
        if(typeof id === "object") {
            id = jt.instId(id); }
        if(typeof id === "number") {
            id = String(id); }
        return id;
    }


    function typify (type) {
        if(type === "Coop") {
            type = "coop"; }
        if(type === "MUser") {
            type = "profile"; }
        return type;
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    getRef: function (type, id) {
        var ref;
        id = idify(id);  //convert to string as needed
        ref = cache[typify(type)].refs[id];
        if(!ref) {
            ref = { status: "not cached",
                    updtime: new Date() };
            ref[typify(type) + "id"] = id; }
        return ref;
    },


    getFull: function (type, id, callback, debugmsg) {
        id = idify(id);
        type = typify(type);
        var ref = app.lcs.getRef(type, id);
        if(ref && ref.status !== "not cached") {
            if(debugmsg) {
                jt.log("getFull cached " + type + id + " " + debugmsg); }
            return callback(ref); }
        if(debugmsg) {
            jt.log("getFull retrieving " + type + id + " " + debugmsg); }
        var url = "";
        if(window.location.href.split("/").length > 3) {  //on a sub-page
            url = "../"; }
        url += cache[type].fetchend + "?" + cache[type].fetchparamf(id) +
            jt.ts("&cb=", "second");
        jt.call("GET", url, null,
                function (objs) {
                    if(objs.length > 0) {
                        callback(app.lcs.put(type, objs[0])); }
                    else {  //should never happen, but treat as deleted
                        callback(app.lcs.tomb(type, id, "deleted")); } },
                function (code, errtxt) {
                    callback(app.lcs.tomb(type, id, 
                                          String(code) + ": " + errtxt)); },
                jt.semaphore("lcs.fetch" + type + id), null, [400, 404]);
    },


    tomb: function (type, id, reason) {
        type = typify(type);
        if(!id) {
            jt.log("lcs.tomb " + type + " id required");
            return null; }
        var tombstone = { status: reason, updtime: new Date() };
        tombstone[type + "id"] = id;
        jt.setInstId(tombstone, id);
        var ref = app.lcs.put(type, tombstone);
        ref.status = reason;
        ref[type] = null;  //so caller can just test for ref.type...
        return tombstone;
    },
        

    put: function (type, obj) {
        var ref;
        type = typify(type);
        if(cache[type].putprep) {
            cache[type].putprep(obj); }
        ref = app.lcs.getRef(type, obj);
        if(!idify(obj)) {
            jt.log("attempt to lcs.put unidentified object");
            return null; }
        if(ref[type] && ref[type].modified > obj.modified) {
            //attempting to put an older instance, return existing newer.
            return ref; }
        cache[type].refs[idify(obj)] = ref;
        ref[type] = obj;
        ref.status = "ok";
        ref.updtime = new Date();
        //any existing decorator fields on the ref are not overwritten
        return ref;
    },


    putAll: function (type, objs) {
        //If there is a newer version of an obj already cached,
        //then that element is updated in the given array to avoid
        //ending up with older copies of things in lists.
        var i;
        for(i = 0; objs && i < objs.length; i += 1) {
            if(objs[i].fetched) {  //ending stats and cursor object
                break; }
            objs[i] = app.lcs.put(type, objs[i])[type]; }
    },


    addReplaceAll: function (objs) {
        objs.forEach(function (obj) {
            var type = typify(obj.obtype);
            if(cache[type]) {  //cacheable object
                app.lcs.put(type, obj); } });
    },


    uncache: function (type, id) {
        type = typify(type);
        var ref = app.lcs.getRef(type, id);
        ref.status = "not cached";
        ref.updtime = new Date();
        ref[type] = null;
    },


    rem: function (type, obj) {
        type = typify(type);
        var ref = app.lcs.getRef(type, obj);
        ref.status = "deleted";
        ref.updtime = new Date();
        ref[type] = null;
    },


    nukeItAll: function () {
        Object.keys(cache).forEach(function (cachetype) {
            cache[cachetype].refs = {}; });
    },


    rjof: function (field, obj) {  //shorthand name
        app.lcs.reconstituteJSONObjectField(field, obj);
    },
    reconstituteJSONObjectField: function (field, obj) {
        var text;
        if(!obj[field]) {
            obj[field] = {}; }
        else if(typeof obj[field] !== "object") {
            try {
                text = obj[field];
                var parsedval = JSON.parse(text);
                obj[field] = parsedval;
            } catch (e) {
                jt.log("reconstituteJSONObjectField " + e + ". Found " + 
                       field + ": " + text + ". Reset to empty object.");
                obj[field] = {};
            } }
        if(typeof obj[field] !== "object") {
            jt.log("reconstituteJSONObjectField re-initializing " + field + 
                   ". \"" + text + "\" not an object");
            obj[field] = {}; }
    },


    resolveIdArrayToCachedObjs: function (type, ids) {
        var objs = [];
        if(!ids) {
            jt.log("lcs.resolveIdArrayToCachedObjs undefined ids");
            return objs; }
        ids.forEach(function (oid) {
            var ref = cache[type].refs[oid];
            if(ref && ref[type]) {
                objs.push(ref[type]); } });
        return objs;
    },


    objArrayToIdArray: function (objs) {
        var ids = [];
        objs.forEach(function (obj) {
            ids.push(jt.instId(obj)); });
        return ids;
    }

}; //end of returned functions
}());

