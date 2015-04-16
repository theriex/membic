/*global setTimeout: false, app: false, jt: false, window: false */

/*jslint white: true, maxerr: 50, indent: 4 */

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

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var cache = {
        pen: { refs: {},
               fetchend: "penbyid",
               fetchparamf: function (id) {
                   return "penid=" + id; },
               putprep: function (penobj) {
                   app.pen.deserializeFields(penobj); } },
        rel: { refs: {} },
        rev: { refs: {},
               fetchend: "revbyid",
               fetchparamf: function (id) {
                   return "revid=" + id; },
               putprep: function (revobj) {
                   app.review.deserializeFields(revobj); } },
        group: { refs: {},
                 fetchend: "grpbyid",
                 fetchparamf: function (id) {
                     return "groupid=" + id; } } },



    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    idify = function (id) {
        if(typeof id === 'object') {
            id = jt.instId(id); }
        if(typeof id === 'number') {
            id = String(id); }
        return id;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    getRef: function (type, id) {
        var ref;
        id = idify(id);  //convert to string as needed
        ref = cache[type].refs[id];
        if(!ref) {
            ref = { status: "not cached",
                    updtime: new Date() };
            ref[type + "id"] = id; }
        return ref;
    },


    getFull: function (type, id, callback, debugmsg) {
        var ref, url;
        id = idify(id);
        ref = app.lcs.getRef(type, id);
        if(ref && ref.status !== "not cached") {
            if(debugmsg) {
                jt.log("getFull cached " + type + id + " " + debugmsg); }
            return callback(ref); }
        if(debugmsg) {
            jt.log("getFull retrieving " + type + id + " " + debugmsg); }
        url = "";
        if(window.location.href.split("/").length > 3) {  //on a sub-page
            url = "../"; }
        url += cache[type].fetchend + "?" + cache[type].fetchparamf(id);
        jt.call('GET', url, null,
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
        var tombstone, ref;
        tombstone = { status: reason, updtime: new Date() };
        tombstone[type + "id"] = id;
        jt.setInstId(tombstone, id);
        ref = app.lcs.put(type, tombstone);
        ref.status = reason;
        ref[type] = null;  //so caller can just test for ref.type...
        return tombstone;
    },
        

    put: function (type, obj) {
        var ref;
        if(cache[type].putprep) {
            cache[type].putprep(obj); }
        ref = app.lcs.getRef(type, obj);
        if(!idify(obj)) {
            jt.log("attempt to lcs.put unidentified object");
            return null; }
        cache[type].refs[idify(obj)] = ref;
        ref[type] = obj;
        ref.status = "ok";
        ref.updtime = new Date();
        //any existing decorator fields on the ref are not overwritten
        return ref;
    },


    putAll: function (type, objs) {
        var i;
        for(i = 0; objs && i < objs.length; i += 1) {
            if(objs[i].fetched) {  //ending stats and cursor object...
                break; }
            app.lcs.put(type, objs[i]); }
    },


    rem: function (type, obj) {
        var ref;
        ref = app.lcs.getRef(type, obj);
        ref.status = "deleted";
        ref.updtime = new Date();
        ref[type] = null;
    },


    nukeItAll: function () {
        var name;
        for(name in cache) {
            if(cache.hasOwnProperty(name)) {
                cache[name].refs = {}; } }
    },


    reconstituteJSONObjectField: function (field, obj) {
        var text, parsedval, jsonobj = JSON || window.JSON;
        if (!jsonobj) {
            jt.err("JSON not supported, please use a modern browser");
        }
        if(!obj[field]) {
            obj[field] = {}; }
        else if(typeof obj[field] !== 'object') {
            try {
                text = obj[field];
                parsedval = jsonobj.parse(text);
                obj[field] = parsedval;
            } catch (e) {
                jt.log("reconstituteJSONObjectField " + e + ". Found " + 
                       field + ": " + text + ". Reset to empty object.");
                obj[field] = {};
            } }
        if(typeof obj[field] !== 'object') {
            jt.log("reconstituteJSONObjectField re-initializing " + field + 
                   ". \"" + text + "\" not an object");
            obj[field] = {}; }
    },


    ////////////////////////////////////////
    // application-specific published funcs
    ////////////////////////////////////////

    findNewerReviews: function (penid, modified) {
        var revcache = cache.rev.refs, revid, revref, results = [];
        for(revid in revcache) {
            if(revcache.hasOwnProperty(revid)) {
                revref = revcache[revid];
                if(revref && revref.rev && revref.rev.penid === penid &&
                   revref.rev.modified > modified) {
                    results.push(revref.rev); } } }
        return results;
    }


}; //end of returned functions
}());

