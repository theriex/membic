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
                   return "revid=" + id; } },
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
    },


    ////////////////////////////////////////
    // application-specific helper funcs
    ////////////////////////////////////////

    resolveReviewLinks = function (revids, revlinks) {
        var i, revid, revs = cache.rev.refs;
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
        //no semaphore on this call. All link updates need to go through,
        //even if we are quickly processing two in a row.
        jt.call('POST', "updlink?" + app.login.authparams(), data,
                function (updrevlinks) {
                    jt.log("verifyCorrespondingLink updated " +
                           updrevlinks[0].revid + " corresponding: " +
                           updrevlinks[0].corresponding); },
                app.failf(function (code, errtxt) {
                    jt.log("verifyCorrespondingLink failed " + 
                           code + " " + errtxt); }));
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
        var revid, revref, revs = cache.rev.refs;
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
    },


    //Walk the revrefs and verify each has an associated revlink,
    //retrieving from the server as needed.  Adds an empty placeholder
    //revlink if no server info exists.  Also verifies markups from
    //the current pen ref are reflected in the revlinks.  The changed
    //parameter switches to true if anything was loaded or updated, and
    //that triggers the callback to onchangefunc.
    verifyReviewLinks: function (onchangefunc, changed) {
        var revid, revref, revids = [], maxq = 20, params, 
            revs = cache.rev.refs;
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
                         if(code) {  //chrome reload returns code 0
                             jt.err("verifyReviewLinks revlinks call failed " +
                                    code + " " + errtxt); } }),
                    jt.semaphore("lcs.verifyReviewLinks")); }
        else if(revids.length === 0 && changed) {
            onchangefunc(); }
    },


    verifyCorrespondingLinks: function (rev1, rev2) {
        var revref1, revref2;
        if(rev1.penid === rev2.penid) { 
            return; }  //avoid corresponding with yourself
        revref1 = app.lcs.getRef("rev", jt.instId(rev1));
        if(revref1.status === "not cached") {
            revref1 = app.lcs.put("rev", rev1); }
        revref2 = app.lcs.getRef("rev", jt.instId(rev2));
        if(revref2.status === "not cached") {
            revref2 = app.lcs.put("rev", rev2); }
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
                        app.lcs.put("rev", revs[i]); }
                    checkCachedCorresponding(review); },
                app.failf(function (code, errtxt) {
                    jt.log("checkAllCorresponding failed " + code + 
                           ": " + errtxt); }),
                jt.semaphore("lcs.checkAllCorresponding"));
    }


}; //end of returned functions
}());

