/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false */

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
            id = glo.instId(id); }
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
                       penid: penid,
                       updtime: new Date() }; }
        return penref;
    },


    putPen = function (penobj) {
        var penref;
        //once cached, subsequent accesss shouldn't have to verify the
        //pen object has been deserialized so do it once now.
        glo.pen.deserializeFields(penobj);
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
        var penref, tombstone, params, critsec = "";
        penref = getPenRef(penid);
        if(penref && penref.status === "ok" && penref.pen) {
            return callback(penref); }
        params = "penid=" + idify(penid);
        glo.call("penbyid?" + params, 'GET', null,
                 function (foundpens) {
                     if(foundpens.length > 0) {
                         callback(putPen(foundpens[0])); }
                     else {  //should never happen, but treat as deleted
                         tombstone = { status: "deleted",
                                       updtime: new Date() };
                         pens[idify(penid)] = tombstone;
                         callback(tombstone); } },
                 function (code, errtxt) {
                     tombstone = { status: String(code) + ": " + errtxt,
                                   updtime: new Date() };
                     pens[idify(penid)] = tombstone;
                     callback(tombstone); },
                 critsec, null, [400, 404]);
    },


    getRelRef = function (relid) {
        var relref;
        relid = idify(relid);
        relref = rels[relid];
        if(!relref) {
            relref = { status: "not cached",
                       relid: relid,
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
                       revid: revid,
                       updtime: new Date() }; }
        return revref;
    },


    putRev = function (revobj) {
        var revref;
        revref = getRevRef(revobj);
        revs[idify(revobj)] = revref;
        revref.rev = revobj;
        revref.status = "ok";
        revref.updtime = new Date();
        return revref;
    },


    putRevs = function (revobjs) {
        var i;
        for(i = 0; revobjs && i < revobjs.length; i += 1) {
            if(revobjs[i].fetched) {
                break; }  //skip stats and cursor object
            putRev(revobjs[i]); }
    },


    getRevFull = function (revid, callback) {
        var revref, tombstone, params, critsec = "";
        revref = getRevRef(revid);
        if(revref && revref.status === "ok" && revref.rev) {
            return callback(revref); }
        params = "revid=" + idify(revid);
        glo.call("revbyid?" + params, 'GET', null,
                 function (foundrevs) {
                     if(foundrevs.length > 0) {
                         callback(putRev(foundrevs[0])); }
                     else {  //should never happen, but treat as deleted
                         tombstone = { status: "deleted",
                                       updtime: new Date() };
                         revs[idify(revid)] = tombstone;
                         callback(tombstone); } },
                 function (code, errtxt) {
                     tombstone = { status: String(code) + ": " + errtxt,
                                   updtime: new Date() };
                     revs[idify(revid)] = tombstone;
                     callback(tombstone); },
                 critsec, null, [400, 404]);
    },


    resolveReviewLinks = function (revids, revlinks) {
        var i, revid;
        for(i = 0; i < revids.length; i += 1) {
            revid = String(revids[i]);
            revs[revid].revlink = { revid: parseInt(revid, 10),
                                    helpful: "",
                                    remembered: "",
                                    corresponding: "" }; }
        for(i = 0; i < revlinks.length; i += 1) {
            revid = String(revlinks[i].revid);
            revs[revid].revlink = revlinks[i]; }
    },


    //Walk the revrefs and verify each has an associated revlink,
    //retrieving from the server as needed.  Adds an empty placeholder
    //revlink if no server info exists.  Also verifies markups from
    //the current pen ref are reflected in the revlinks.  The changed
    //parameter switches to true if anything was loaded or updated, and
    //that triggers the callback to onchangefunc.
    verifyReviewLinks = function (onchangefunc, changed) {
        var revid, revref, revids = [], maxq = 20, params, critsec = "";
        for(revid in revs) {
            if(revs.hasOwnProperty(revid)) {
                revref = revs[revid];
                if(revref && !revref.revlink) {
                    revids.push(revid); }
                if(revids.length >= maxq) {
                    break; } } }
        if(revids.length > 0) {
            params = "revids=" + revids.join(",") + 
                "&" + glo.login.authparams();
            glo.call("revlinks?" + params, 'GET', null,
                     function (revlinks) {
                         resolveReviewLinks(revids, revlinks);
                         verifyReviewLinks(onchangefunc, true); },
                     function (code, errtxt) {
                         glo.err("verifyReviewLinks revlinks call failed " +
                                 code + " " + errtxt); },
                     critsec); }
        else if(revids.length === 0 && changed) {
            onchangefunc(); }
    },


    
    verifyCorrespondingLink = function (revref, rev) {
        var revlink, rlidstr, corids, i, data;
        revlink = revref.revlink;
        rlidstr = String(glo.instId(rev)) + ":" + rev.penid;
        if(!revlink.corresponding) {
            revlink.corresponding = rlidstr; }
        else {
            corids = revlink.corresponding.split(",");
            for(i = 0; i < corids.length; i += 1) {
                if(corids[i] === rlidstr) {
                    return; } } //already exists, so done
            corids.push(rlidstr);
            revlink.corresponding = corids.join(","); }
        revlink.critsec = "";
        data = glo.objdata(revlink);
        glo.call("updlink?" + glo.login.authparams(), 'POST', data,
                 function (updrevlinks) {
                     glo.log("verifyCorrespondingLink updated " +
                             updrevlinks[0].revid + " corresponding: " +
                             updrevlinks[0].corresponding); },
                 function (code, errtxt) {
                     glo.log("verifyCorrespondingLink failed " + 
                             code + " " + errtxt); },
                 revlink.critsec);
    },


    verifyCorrespondingLinks = function (rev1, rev2) {
        var revref1, revref2;
        if(rev1.penid === rev2.penid) { 
            return; }  //avoid corresponding with yourself
        revref1 = getRevRef(glo.instId(rev1));
        if(revref1.status === "not cached") {
            revref1 = putRev(rev1); }
        revref2 = getRevRef(glo.instId(rev2));
        if(revref2.status === "not cached") {
            revref2 = putRev(rev2); }
        if(!revref1.revlink || !revref2.revlink) {
            setTimeout(function () {
                verifyReviewLinks(function () {
                    verifyCorrespondingLinks(rev1, rev2); }); }, 50);
            return; }
        verifyCorrespondingLink(revref1, rev2);
        verifyCorrespondingLink(revref2, rev1);
    },


    checkCachedCorresponding = function (review) {
        var revid, revref;
        for(revid in revs) {
            if(revs.hasOwnProperty(revid)) {
                revref = revs[revid];
                if(revref && revref.rev 
                   && revref.rev.cankey === review.cankey
                   && revref.rev.penid !== review.penid) {
                    verifyCorrespondingLinks(review, revref.rev); } } }
    },


    checkAllCorresponding = function (review) {
        var params, critsec = "";
        checkCachedCorresponding(review);
        params = "revtype=" + review.revtype + "&cankey=" + review.cankey +
            "&" + glo.login.authparams();
        glo.call("revbykey?" + params, 'GET', null,
                 function (revs) {
                     var i;
                     for(i = 0; i < revs.length; i += 1) {
                         putRev(revs[i]); }
                     checkCachedCorresponding(review); },
                 function (code, errtxt) {
                     glo.log("checkAllCorresponding failed " + code + 
                             ": " + errtxt); },
                 critsec);
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
            return putRev(revobj); },
        putRevs: function (revobjs) {
            putRevs(revobjs); },
        verifyReviewLinks: function (onchangefunc) {
            verifyReviewLinks(onchangefunc); },
        verifyCorrespondingLinks: function (rev1, rev2) {
            verifyCorrespondingLinks(rev1, rev2); },
        checkAllCorresponding: function (review) {
            checkAllCorresponding(review); }
    };

});



