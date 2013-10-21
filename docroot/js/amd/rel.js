/*global alert: false, setTimeout: false, document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.rel = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var loadoutcursor,
        asyncLoadStarted,
        maxpgdisp = 100,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    getRelRefArray = function (pen, direction, init) {
        var penref, field;
        penref = app.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field] && init) {
            penref[field] = []; }
        return penref[field];
    },


    pushRel = function (pen, direction, relationship) {
        var penref, field, relref;
        relref = app.lcs.putRel(relationship);
        penref = app.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
        penref[field].push(relref);
    },


    verifyRelsInitialized = function (pen, direction) {
        var penref, field;
        penref = app.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
    },


    loadDisplayRels = function (pen, direction, divid, cursor) {
        var refarray, field, params, critsec = "";
        refarray = getRelRefArray(pen, direction);
        if(refarray && !cursor) {  //relationships already loaded
            return app.rel.displayRelations(pen, direction, divid); }
        field = (direction === "outbound")? "originid" : "relatedid";
        params = app.login.authparams() + "&" + field + "=" +
            jt.instId(pen);
        if(cursor) {
            params += "&cursor=" + cursor; }
        jt.call('GET', "findrels?" + params, null,
                 function (relationships) {
                     var i, resultCursor;
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 resultCursor = relationships[i].cursor; }
                             break; }
                         pushRel(pen, direction, relationships[i]); }
                     if(resultCursor) {
                         loadDisplayRels(pen, direction, divid, resultCursor); }
                     else {
                         verifyRelsInitialized(pen, direction);
                         app.rel.displayRelations(pen, direction, divid); } },
                 app.failf(function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     jt.log(msg);
                     jt.err(msg); }),
                 critsec);
    },


    followBackLink = function (pen) {
        var i, refarray, penid, html, srcpen;
        srcpen = app.pen.currPenRef().pen;
        refarray = getRelRefArray(srcpen, "outbound");
        penid = jt.instId(pen);
        for(i = 0; refarray && i < refarray.length; i += 1) {
            if(refarray[i].rel.relatedid === penid) {
                return ""; } }  //already following
        html = ["a", {cla: "smalltext", href: "#followback", 
                      title: "follow " + pen.name,
                      onclick: jt.fs("app.rel.followBack(" + 
                                     jt.instId(pen) + ")")},
                "[follow back]"];
        return " " + jt.tac2html(html);
    },


    activityIndicatorHTML = function (penref) {
        var text, revs, lr, selfref, i, days, html;
        text = "No recent reviews";
        if(!penref.pen.top20s || !penref.pen.top20s.latestrevtype) {
            text = "No reviews yet"; }
        else {  //they've written at least one review at some point
            revs = jt.saferef(penref, "profstate.?recentRevState.?results");
            if(revs && revs.length > 0) {
                lr = revs[0]; }
            if(!lr) {
                selfref = app.pen.currPenRef();
                revs = jt.saferef(selfref, "actdisp.?revrefs");
                if(revs && revs.length > 0) {
                    for(i = 0; i < revs.length; i += 1) {
                        if(revs[i].rev.penid === penref.penid) {
                            lr = revs[i].rev;
                            break; } } } }
            if(lr) {
                days = new Date().toISOString();
                days = jt.ISOString2Day(days).getTime();
                days = days - jt.ISOString2Day(lr.modified).getTime();
                days = days / (1000 * 60 * 60 * 24);
                days = Math.round(days);
                if(days === 0) {
                    text = "Posted today"; }
                else if(days === 1) {
                    text = "Posted yesterday"; }
                else {
                    text = "Posted " + days + " days ago"; } } }
        html = ["span", {style: "font-size:small;color:#666;"},
                "&nbsp;&nbsp;&nbsp;" + text];
        return jt.tac2html(html);
    },


    loadReferencedPens = function (relref, callback) {
        var penid, penref;
        penid = relref.rel.relatedid;
        penref = app.lcs.getPenRef(penid);
        if(penref.pen) {
            penid = relref.rel.originid;
            penref = app.lcs.getPenRef(penid); }
        if(penref.pen) {  //both loaded, return directly
            return callback(); }
        app.lcs.getPenFull(penid, callback);
    },


    sortRelRefsByPenName = function (refarray, direction) {
        refarray.sort(function (a, b) {
            var idfield, penrefA, penrefB, nameA, nameB;
            if(a.status === "ok" && b.status !== "ok") {
                return -1; }  //resolved belongs before unresolved
            if(a.status !== "ok" && b.status === "ok") {
                return 1; } 
            if(a.status !== "ok" && b.status !== "ok") {
                return 0; }
            idfield = (direction === "outbound")? "relatedid" : "originid";
            penrefA = app.lcs.getPenRef(a.rel[idfield]);
            penrefB = app.lcs.getPenRef(b.rel[idfield]);
            if(penrefA.status === "ok" && penrefB.status !== "ok") {
                return -1; }
            if(penrefA.status !== "ok" && penrefB.status === "ok") {
                return 1; }
            if(penrefA.status !== "ok" && penrefB.status !== "ok") {
                return 0; }
            nameA = penrefA.pen.name;
            nameB = penrefB.pen.name;
            if(nameA) {
                nameA = nameA.toLowerCase(); }
            if(nameB) {
                nameB = nameB.toLowerCase(); }
            if(nameA < nameB) {
                return -1; }
            if(nameA > nameB) {
                return 1; }
            return 0; });
    },


    relRefPenHTML = function (relref, direction, placeholder) {
        var idfield, penref, temp;
        temp = placeholder;
        idfield = (direction === "outbound")? "relatedid" : "originid";
        penref = app.lcs.getPenRef(relref.rel[idfield]);
        if(penref.status !== "ok" && penref.status !== "not cached") {
            return ""; }  //skip any deleted or otherwise unresolved refs
        if(penref.pen) {
            temp = app.profile.penListItemHTML(penref.pen);
            if(app.profile.displayingSelf()) {
                temp = temp.slice(0, temp.indexOf("</li>"));
                if(direction === "inbound") {
                    temp += followBackLink(penref.pen); }
                else if(direction === "outbound") {
                    temp += activityIndicatorHTML(penref); }
                temp += "</li>"; } }
        return temp;
    },


    relRefPenHTMLFooter = function (direction) {
        var html;
        html = ["div", {id: "srchpenslinkdiv"},
                ["a", {id: "srchpens", href: "#findpens",
                       onclick: jt.fs("app.activity.penNameSearchDialog()")},
                 [["img", {cla: "reviewbadge", src: "img/follow.png"}],
                  "Find pen names to follow"]]];
        return jt.tac2html(html);
    },


    setFormValuesFromRel = function (rel) {
        var mutes, i;
        if(rel.status === "blocked") {
            jt.byId('block').checked = true; }
        else {
            jt.byId('follow').checked = true; }
        if(rel.mute) {
            mutes = rel.mute.split(',');
            for(i = 0; i < mutes.length; i += 1) {
                jt.byId(mutes[i]).checked = true; } }
        app.rel.fchg();
    },


    setRelFieldsFromFormValues = function (rel) {
        var checkboxes, i;
        if(jt.byId('follow').checked) {
            rel.status = "following"; }
        else if(jt.byId('block').checked) {
            rel.status = "blocked"; }
        else if(jt.byId('nofollow').checked) {
            rel.status = "nofollow"; }
        rel.mute = "";
        checkboxes = document.getElementsByName("mtype");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(rel.mute) {
                    rel.mute += ","; }
                rel.mute += checkboxes[i].value; } }
    },


    removeOutboundRel = function (rel) {
        var penref, i, relid = jt.instId(rel);
        penref = app.pen.currPenRef();
        if(penref.outrels) {
            for(i = 0; i < penref.outrels.length; i += 1) {
                if(jt.instId(penref.outrels[i].rel) === relid) {
                    break; } }
            if(i < penref.outrels.length) { //found it
                penref.outrels.splice(i, 1); } }
        app.lcs.remRel(rel);
    },


    updateRelationship = function (rel) {
        var critsec = "", data = jt.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            jt.call('POST', "delrel?" + app.login.authparams(), data,
                     function (updates) {
                         var orgpen = updates[0],  //originator pen
                             relpen = updates[1];  //related pen
                         app.lcs.putPen(orgpen);
                         app.lcs.putPen(relpen);
                         removeOutboundRel(rel);   //relationship
                         app.layout.closeDialog();
                         app.activity.reset();
                         app.profile.byprofid(jt.instId(updates[1])); },
                     app.failf(function (code, errtxt) {
                         jt.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); }),
                     critsec); }
        else { //update
            jt.call('POST', "updrel?" + app.login.authparams(), data,
                     function (updates) {
                         app.lcs.putRel(updates[0]);
                         app.layout.closeDialog();
                         app.activity.reset();
                         app.profile.byprofid(updates[0].relatedid); },
                     app.failf(function (code, errtxt) {
                         jt.err("Relationship update failed code " + code +
                                 ": " + errtxt); }),
                     critsec); }
    },


    //The data model supports a minimum rating, but leaving that out
    //unless and until there is a real need to limit activity noise
    //beyond the types.
    displayRelationshipDialog = function (rel, related, isnew) {
        var html, titletxt;
        titletxt = "Follow settings for " + related.name;
        if(isnew) {
            titletxt = "You are now following " + related.name; }
        html = [
            ["div", {cla: "dlgclosex"},
             ["a", {id: "closedlg", href: "#close",
                    onclick: jt.fs("app.layout.closeDialog()")},
              "&lt;close&nbsp;&nbsp;X&gt;"]],
            ["div", {cla: "floatclear"}],
            ["span", {cla: "headingtxt"}, titletxt],
            ["table", {cla: "formstyle"},
             [["tr",
               ["td",
                [["b", "Status "],
                 jt.radiobutton("fstat", "follow", "", false, "app.rel.fchg"),
                 "&nbsp;" +
                 jt.radiobutton("fstat", "block", "", false, "app.rel.fchg"),
                 "&nbsp;" +
                 jt.radiobutton("fstat", "nofollow", "Stop Following",
                                false, "app.rel.fchg")]]],
              ["tr",
               ["td",
                ["div", {id: "fstatdescr"}]]],
              ["tr",
               ["td",
                [["b", "Ignore reviews from " + related.name + " about"],
                 app.review.reviewTypeCheckboxesHTML("mtype")]]],
              ["tr",
               ["td", {colspan: 2, align: "center", id: "settingsbuttons"},
                ["button", {type: "button", id: "savebutton"},
                 "Save"]]]]]];
        jt.out('dlgdiv', jt.tac2html(html));
        setFormValuesFromRel(rel);
        jt.on('savebutton', 'click', function (e) {
            jt.evtend(e);
            jt.out('settingsbuttons', "Saving...");
            setRelFieldsFromFormValues(rel);
            updateRelationship(rel); });
        jt.byId('dlgdiv').style.visibility = "visible";
        app.onescapefunc = app.layout.closeDialog;
    },


    createOrEditRelationship = function (originator, related) {
        var rel, newrel, data, critsec = "";
        rel = app.rel.outbound(jt.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            newrel = {};
            newrel.originid = jt.instId(originator);
            newrel.relatedid = jt.instId(related);
            jt.assert(newrel.originid && newrel.relatedid);
            newrel.status = "following";
            newrel.mute = "";
            newrel.cutoff = 0;
            data = jt.objdata(newrel);
            jt.call('POST', "newrel?" + app.login.authparams(), data,
                     function (newrels) {
                         var orgpen = newrels[0],  //originator pen
                             relpen = newrels[1];  //related pen
                         newrel = newrels[2];  //new relationship
                         app.lcs.putPen(orgpen);
                         app.lcs.putPen(relpen);
                         pushRel(orgpen, "outbound", newrel);
                         //profile.writeNavDisplay is not enough if followBack,
                         //have to redraw follow tab counts also.
                         app.profile.refresh();
                         displayRelationshipDialog(newrels[2], newrels[1], 
                                                   true); },
                     app.failf(function (code, errtxt) {
                         jt.err("Relationship creation failed code " + code +
                                 ": " + errtxt); }),
                     critsec); }
    },


    relationshipsLoadFinished = function (pen) {
        app.profile.updateHeading();
    },


    appendOutboundRel = function (relref) {
        var penref = app.pen.currPenRef();
        if(!penref.outrels) {
            penref.outrels = []; }
        penref.outrels.push(relref);
    },


    loadOutboundRelationships = function () {
        var pen, params, critsec = "";
        pen = app.pen.currPenRef().pen;
        params = app.login.authparams() + "&originid=" + jt.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + jt.enc(loadoutcursor); }
        jt.call('GET', "findrels?" + params, null,
                 function (relationships) {
                     var i, relref;
                     loadoutcursor = "";
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 loadoutcursor = relationships[i].cursor; }
                             break; }
                         relref = app.lcs.putRel(relationships[i]);
                         appendOutboundRel(relref); }
                     if(loadoutcursor) {
                         setTimeout(function () {
                             loadOutboundRelationships(pen); }, 50); }
                     else {
                         relationshipsLoadFinished(pen); } },
                 app.failf(function (code, errtxt) {
                     jt.log("loadOutboundRelationships errcode " + code +
                             ": " + errtxt);
                     alert("Sorry. Data error. Please reload the page"); }),
                 critsec);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function (relstate, pen) {
        loadoutcursor = null;
        asyncLoadStarted = false;
        if(relstate === "new") {
            //a new pen name has no outbound relationships yet.  Just
            //init the outrels in the cache PenRef to an empty array.
            app.pen.currPenRef().outrels = [];
            asyncLoadStarted = true;  //started and finished..
            app.profile.updateHeading(); }
        else if(relstate !== "logout") {
            //start the async load of the outrels.  relstate === "reload" 
            //is ignored since the relationships are cached with each pen
            //and are asumed to have been updated through this UI.
            app.rel.loadoutbound(); }
    },


    reledit: function (from, to) {
        createOrEditRelationship(from, to);
    },


    fchg: function () {
        if(jt.safeget('follow', 'checked')) {
            jt.out('fstatdescr', 
                    "(Show new reviews)"); }
        else if(jt.safeget('block', 'checked')) {
            jt.out('fstatdescr',
                    "(List as following, but do not show new reviews)"); }
        else if(jt.safeget('nofollow', 'checked')) {
            jt.out('fstatdescr',
                    "(Do not show new reviews, do not list as following)"); }
    },


    outbound: function (relatedid) {
        var pen, relrefs, i;
        pen = app.pen.currPenRef().pen;
        relrefs = getRelRefArray(pen, "outbound");
        for(i = 0; relrefs && i < relrefs.length; i += 1) {
            if(relrefs[i].rel.relatedid === relatedid) {
                return relrefs[i].rel; } }
    },


    //kick off loading all the outbound relationships, but do not
    //block since nobody wants to sit and wait for it.  Protect
    //against duplicate calls, since that can happen as closures
    //are establishing their state at startup.
    loadoutbound: function () {
        if(asyncLoadStarted) {
            return; }  //allready working on loading
        if(app.pen.currPenRef().outrels) {
            return; }  //already loaded
        asyncLoadStarted = true;
        loadoutcursor = "starting";
        setTimeout(function () {
            loadOutboundRelationships(); }, 50);
    },


    outboundids: function () {
        var pen, relrefs, i, relids = [];
        pen = app.pen.currPenRef().pen;
        relrefs = getRelRefArray(pen, "outbound");
        for(i = 0; relrefs && i < relrefs.length; i += 1) {
            //do not include blocked relationships in result ids
            if(relrefs[i].rel.status === "following") {
                relids.push(relrefs[i].rel.relatedid); } }
        if(!asyncLoadStarted) {
            relids.push("waiting"); }
        else if(loadoutcursor) {
            relids.push("loading"); }
        return relids;
    },


    displayRelations: function (pen, direction, divid) {
        var html, refarray, relitems = [], placeholder, i, litemp;
        placeholder = jt.tac2html(["li", "Fetching pen names"]);
        refarray = getRelRefArray(pen, direction);
        if(refarray) {
            if(refarray.length > 0) {
                sortRelRefsByPenName(refarray, direction);
                for(i = 0; i < refarray.length && i < maxpgdisp; i += 1) {
                    litemp = relRefPenHTML(refarray[i], direction, placeholder);
                    relitems.push(litemp);
                    if(litemp === placeholder) {
                        break; } }
                //ATTENTION: continue display link if maxpgdisp
                if(i === refarray.length) {
                    relitems.push(relRefPenHTMLFooter(direction)); } }
            else if(refarray.length === 0) {
                if(direction === "outbound") {
                    relitems.push(["li", "Not following anyone."]);
                    if(jt.instId(pen) === app.pen.currPenId()) {  //own profile
                        relitems.push(["li", 
                                       app.activity.searchPensLinkHTML()]); } }
                else { //inbound
                    relitems.push(["li", "No followers."]); } } }
        else {  //dump an interim status while retrieving rels
            relitems.push(["li", "fetching relationships..."]); }
        html = ["ul", {cla: "penlist"}, relitems];
        jt.out(divid, jt.tac2html(html));
        if(!refarray) {  //rels not loaded yet, init and fetch.
            loadDisplayRels(pen, direction, divid); }
        else if(litemp === placeholder) {
            loadReferencedPens(refarray[i], function () {
                app.rel.displayRelations(pen, direction, divid); }); }
    },


    followBack: function (followerid) {
        app.pen.getPen(function (homepen) {
            app.lcs.getPenFull(followerid, function (penref) {
                createOrEditRelationship(homepen, penref.pen,
                                         jt.instId(homepen)); }); });
    },


    relsLoaded: function () {
        return asyncLoadStarted && !loadoutcursor;
    }


}; //end of returned functions
}());

