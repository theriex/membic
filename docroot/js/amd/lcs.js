/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . l c s
//
// Local Cache Storage for pen names, relationships, and reviews.
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
// The core reference object fields should not be modified by
// functions outside of this module.  Additional decorative fields are
// managed by other modules for ease of access.
//
// For access and updates, the lcs supports:
//  - getXRef: synchronous method takes an X identifier and returns 
//    the cached reference object.  The contained instance object 
//    may be null if the instance hasn't been put yet.
//  - getXFull: asynchronous method takes an identifier and the callback
//    func. Callback gets an "ok" reference object with the requested
//    instance object, or some other status and null.  If the instance
//    is null, then the instance object cannot be retrieved.
//  - putX: synchronous method takes an instance object and updates
//    the cache.
//  - remX: synchronous method takes an instance object and updates
//    the cache.
//
// Decorated object structure:
//   PenRef
//     outrels: array of oubound RelRefs
//     inrels: array of inbound RelRefs
//

define([], function () {
    "use strict";

    var pens = {},
        rels = {},
        revs = {},


    idify = function (id) {
        if(typeof id === 'object') {
            id = mor.instId(id); }
        if(typeof id === 'number') {
            id = String(id); }
        return id;
    },


    getPenRef = function (penid) {
        var penref;
        penid = idify(penid);
        penref = pens[penid];
        if(!penref) {
            penref = { status: "not cached",
                       updtime: new Date() }; }
        return penref;
    },


    putPen = function (penobj) {
        var penref;
        //once cached, subsequent accesss shouldn't have to verify the
        //pen object has been deserialized so do it once now.
        mor.pen.deserializeFields(penobj);
        penref = getPenRef(penobj);
        pens[idify(penobj)] = penref;
        penref.pen = penobj;
        penref.status = "ok";
        penref.updtime = new Date();
        //existing outrels and other decorator fields not overwritten
        return penref;
    },


    remPen = function (penobj) {
        var penref;
        penref = getPenRef(penobj);
        penref.status = "deleted";
        penref.updtime = new Date();
        penref.pen = null;
    },


    getPenFull = function (penid, callback) {
        var penref, params, critsec = "";
        penref = getPenRef(penid);
        if(penref && penref.status === "ok" && penref.pen) {
            return callback(penref); }
        params = "penid=" + idify(penid);
        mor.call("penbyid?" + params, 'GET', null,
                 function (pens) {
                     if(pens.length > 0) {
                         callback(putPen(pens[0])); }
                     else {  //should never happen, but treat as deleted
                         callback({ status: "deleted",
                                    updtime: new Date() }); } },
                 function (code, errtxt) {
                     callback({ status: String(code) + ": " + errtxt,
                                updtime: new Date() }); },
                 critsec, null, [400, 404]);
    },


    getRelRef = function (relid) {
        var relref;
        relid = idify(relid);
        relref = rels[relid];
        if(!relref) {
            relref = { status: "not cached",
                       updtime: new Date() }; }
        return relref;
    },


    putRel = function (relobj) {
        var relref;
        relref = getRelRef(relobj);
        rels[idify(relobj)] = relref;
        relref.rel = relobj;
        relref.status = "ok";
        relref.updtime = new Date();
        return relref;
    },


    remRel = function (relobj) {
        var relref;
        relref = getRelRef(relobj);
        relref.status = "deleted";
        relref.updtime = new Date();
        relref.pen = null;
    },


    getRevRef = function (revid) {
        var revref;
        revid = idify(revid);
        revref = revs[revid];
        if(!revref) {
            revref = { status: "not cached",
                       updtime: new Date() }; }
        return revref;
    },


    putRev = function (revobj) {
        var oldrevobj, revref;
        revref = getRevRef(revobj);
        oldrevobj = revref.rev;
        revs[idify(revobj)] = revref;
        revref.rev = revobj;
        revref.status = "ok";
        revref.updtime = new Date();
        return revref;
    },


    getRevFull = function (revid, callback) {
        var revref, params, critsec = "";
        revref = getRevRef(revid);
        if(revref && revref.status === "ok" && revref.rev) {
            return callback(revref); }
        params = "revid=" + idify(revid);
        mor.call("revbyid?" + params, 'GET', null,
                 function (revs) {
                     if(revs.length > 0) {
                         callback(putRev(revs[0])); }
                     else {  //should never happen, but treat as deleted
                         callback({ status: "deleted",
                                    updtime: new Date() }); } },
                 function (code, errtxt) {
                     callback({ status: String(code) + ": " + errtxt,
                                updtime: new Date() }); },
                 critsec, null, [400, 404]);
    };


    return {
        getPenRef: function (penid) {
            return getPenRef(penid); },
        getPenFull: function (penid, callback) {
            getPenFull(penid, callback); },
        putPen: function (penobj) {
            return putPen(penobj); },
        remPen: function (penobj) {
            remPen(penobj); },
        getRelRef: function (relid) {
            return getRelRef(relid); },
        putRel: function (relobj) {
            return putRel(relobj); },
        remRel: function (relobj) {
            remRel(relobj); },
        getRevRef: function (revid) {
            return getRevRef(revid); },
        getRevFull: function (revid, callback) {
            getRevFull(revid, callback); },
        putRev: function (revobj) {
            return putRev(revobj); }
    };

});



