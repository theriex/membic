/*global setTimeout: false, app: false, jt: false */

/*jslint white: true, maxerr: 50, indent: 4 */

//////////////////////////////////////////////////////////////////////
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

app.lcs = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var pens = {},
        rels = {},
        revs = {},


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    idify = function (id) {
        if(typeof id === 'object') {
            id = jt.instId(id); }
        if(typeof id === 'number') {
            id = String(id); }
        return id;
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


    verifyCorrespondingLink = function (revref, rev) {
        var revlink, rlidstr, corids, i, data;
        revlink = revref.revlink;
        rlidstr = String(jt.instId(rev)) + ":" + rev.penid;
        if(!revlink.corresponding) {
            revlink.corresponding = rlidstr; }
        else {
            corids = revlink.corresponding.split(",");
            for(i = 0; i < corids.length; i += 1) {
                if(corids[i] === rlidstr) {
                    return; } } //already exists, so done
            corids.push(rlidstr);
            revlink.corresponding = corids.join(","); }
        data = jt.objdata(revlink);
        jt.call('POST', "updlink?" + app.login.authparams(), data,
                function (updrevlinks) {
                    jt.log("verifyCorrespondingLink updated " +
                           updrevlinks[0].revid + " corresponding: " +
                           updrevlinks[0].corresponding); },
                app.failf(function (code, errtxt) {
                    jt.log("verifyCorrespondingLink failed " + 
                           code + " " + errtxt); }),
                jt.semaphore("lcs.verifyCorrespondingLink" + 
                             jt.instId(revlink)));
    },


    isCanonicalMatch = function (fromrev, torev) {
        var keys, i;
        if(fromrev.revtype !== torev.revtype) {
            return false; }
        if(fromrev.cankey === torev.cankey) {
            return true; }
        if(fromrev.altkeys) {
            keys = fromrev.altkeys.split(",");
            for(i = 0; i < keys.length; i += 1) {
                if(keys[i] === torev.cankey) {
                    return true; } } }
        return false;
    },


    checkCachedCorresponding = function (review) {
        var revid, revref;
        for(revid in revs) {
            if(revs.hasOwnProperty(revid)) {
                revref = revs[revid];
                if(revref && revref.rev && revref.rev.penid !== review.penid) {
                    if(isCanonicalMatch(review, revref.rev)) {
                        app.lcs.verifyCorrespondingLinks(review, 
                                                         revref.rev); } } } }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    getPenRef: function (penid) {
        var penref;
        penid = idify(penid);
        penref = pens[penid];
        if(!penref) {
            penref = { status: "not cached",
                       penid: penid,
                       updtime: new Date() }; }
        return penref;
    },


    getPenFull: function (penid, callback) {
        var penref, tombstone, params;
        penref = app.lcs.getPenRef(penid);
        if(penref && penref.status === "ok" && penref.pen) {
            return callback(penref); }
        penid = idify(penid);
        params = "penid=" + penid;
        jt.call('GET', "penbyid?" + params, null,
                 function (foundpens) {
                     if(foundpens.length > 0) {
                         callback(app.lcs.putPen(foundpens[0])); }
                     else {  //should never happen, but treat as deleted
                         tombstone = { status: "deleted",
                                       penid: penid,
                                       updtime: new Date() };
                         pens[penid] = tombstone;
                         callback(tombstone); } },
                 app.failf(function (code, errtxt) {
                     tombstone = { status: String(code) + ": " + errtxt,
                                   penid: penid,
                                   updtime: new Date() };
                     pens[penid] = tombstone;
                     callback(tombstone); }),
                 jt.semaphore("lcs.getPenFull" + penid), null, [400, 404]);
    },


    putPen: function (penobj) {
        var penref;
        //once cached, subsequent accesss shouldn't have to verify the
        //pen object has been deserialized so do it once now.
        app.pen.deserializeFields(penobj);
        penref = app.lcs.getPenRef(penobj);
        pens[idify(penobj)] = penref;
        penref.pen = penobj;
        penref.status = "ok";
        penref.updtime = new Date();
        //existing outrels and other decorator fields not overwritten
        return penref;
    },


    remPen: function (penobj) {
        var penref;
        penref = app.lcs.getPenRef(penobj);
        penref.status = "deleted";
        penref.updtime = new Date();
        penref.pen = null;
    },


    getRelRef: function (relid) {
        var relref;
        relid = idify(relid);
        relref = rels[relid];
        if(!relref) {
            relref = { status: "not cached",
                       relid: relid,
                       updtime: new Date() }; }
        return relref;
    },


    putRel: function (relobj) {
        var relref;
        relref = app.lcs.getRelRef(relobj);
        rels[idify(relobj)] = relref;
        relref.rel = relobj;
        relref.status = "ok";
        relref.updtime = new Date();
        return relref;
    },


    remRel: function (relobj) {
        var relref;
        relref = app.lcs.getRelRef(relobj);
        relref.status = "deleted";
        relref.updtime = new Date();
        relref.pen = null;
    },


    getRevRef: function (revid) {
        var revref;
        revid = idify(revid);
        revref = revs[revid];
        if(!revref) {
            revref = { status: "not cached",
                       revid: revid,
                       updtime: new Date() }; }
        return revref;
    },


    getRevFull: function (revid, callback) {
        var revref, tombstone, params;
        revref = app.lcs.getRevRef(revid);
        if(revref && revref.status === "ok" && revref.rev) {
            return callback(revref); }
        params = "revid=" + idify(revid);
        jt.call('GET', "revbyid?" + params, null,
                 function (foundrevs) {
                     if(foundrevs.length > 0) {
                         callback(app.lcs.putRev(foundrevs[0])); }
                     else {  //should never happen, but treat as deleted
                         tombstone = { status: "deleted",
                                       revid: revid,
                                       updtime: new Date() };
                         revs[idify(revid)] = tombstone;
                         callback(tombstone); } },
                 app.failf(function (code, errtxt) {
                     tombstone = { status: String(code) + ": " + errtxt,
                                   revid: revid,
                                   updtime: new Date() };
                     revs[idify(revid)] = tombstone;
                     callback(tombstone); }),
                jt.semaphore("lcs.getRevFull"), null, [400, 404]);
    },


    putRev: function (revobj) {
        var revref;
        revref = app.lcs.getRevRef(revobj);
        revs[idify(revobj)] = revref;
        revref.rev = revobj;
        revref.status = "ok";
        revref.updtime = new Date();
        return revref;
    },


    putRevs: function (revobjs) {
        var i;
        for(i = 0; revobjs && i < revobjs.length; i += 1) {
            if(revobjs[i].fetched) {
                break; }  //skip stats and cursor object
            app.lcs.putRev(revobjs[i]); }
    },


    findNewerReviews: function (penid, modified) {
        var revcache = revs, revid, revref, results = [];
        for(revid in revcache) {
            if(revcache.hasOwnProperty(revid)) {
                revref = revcache[revid];
                if(revref && revref.rev && revref.rev.penid === penid &&
                   revref.rev.modified > modified) {
                    results.push(revref.rev); } } }
        return results;
    },


    //Walk the revrefs and verify each has an associated revlink,
    //retrieving from the server as needed.  Adds an empty placeholder
    //revlink if no server info exists.  Also verifies markups from
    //the current pen ref are reflected in the revlinks.  The changed
    //parameter switches to true if anything was loaded or updated, and
    //that triggers the callback to onchangefunc.
    verifyReviewLinks: function (onchangefunc, changed) {
        var revid, revref, revids = [], maxq = 20, params;
        for(revid in revs) {
            if(revs.hasOwnProperty(revid)) {
                revref = revs[revid];
                if(revref && !revref.revlink) {
                    revids.push(revid); }
                if(revids.length >= maxq) {
                    break; } } }
        if(revids.length > 0) {
            params = "revids=" + revids.join(",") + 
                "&" + app.login.authparams();
            jt.call('GET', "revlinks?" + params, null,
                     function (revlinks) {
                         resolveReviewLinks(revids, revlinks);
                         app.lcs.verifyReviewLinks(onchangefunc, true); },
                     app.failf(function (code, errtxt) {
                         jt.err("verifyReviewLinks revlinks call failed " +
                                code + " " + errtxt); }),
                    jt.semaphore("lcs.verifyReviewLinks")); }
        else if(revids.length === 0 && changed) {
            onchangefunc(); }
    },


    verifyCorrespondingLinks: function (rev1, rev2) {
        var revref1, revref2;
        if(rev1.penid === rev2.penid) { 
            return; }  //avoid corresponding with yourself
        revref1 = app.lcs.getRevRef(jt.instId(rev1));
        if(revref1.status === "not cached") {
            revref1 = app.lcs.putRev(rev1); }
        revref2 = app.lcs.getRevRef(jt.instId(rev2));
        if(revref2.status === "not cached") {
            revref2 = app.lcs.putRev(rev2); }
        if(!revref1.revlink || !revref2.revlink) {
            setTimeout(function () {
                app.lcs.verifyReviewLinks(function () {
                    app.lcs.verifyCorrespondingLinks(rev1, rev2); }); }, 50);
            return; }
        verifyCorrespondingLink(revref1, rev2);
        verifyCorrespondingLink(revref2, rev1);
    },


    checkAllCorresponding: function (review) {
        var params;
        checkCachedCorresponding(review);
        params = "revtype=" + review.revtype + "&cankey=" + review.cankey +
            "&" + app.login.authparams();
        jt.call('GET', "revbykey?" + params, null,
                function (revs) {
                    var i;
                    for(i = 0; i < revs.length; i += 1) {
                        app.lcs.putRev(revs[i]); }
                    checkCachedCorresponding(review); },
                app.failf(function (code, errtxt) {
                    jt.log("checkAllCorresponding failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("lcs.checkAllCorresponding"));
    },


    nukeItAll: function () {
        pens = {};
        rels = {};
        revs = {};
    }


}; //end of returned functions
}());

