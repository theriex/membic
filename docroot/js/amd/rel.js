/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . r e l
//
define([], function () {
    "use strict";

    var loadoutcursor,
        asyncLoadStarted,
        maxpgdisp = 100,


    resetStateVars = function (relstate) {
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
            app.instId(pen);
        if(cursor) {
            params += "&cursor=" + cursor; }
        app.call("findrels?" + params, 'GET', null,
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
                 function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     app.log(msg);
                     app.err(msg); },
                 critsec);
    },


    followBackLink = function (pen) {
        var i, refarray, penid, html, srcpen;
        srcpen = app.pen.currPenRef().pen;
        refarray = getRelRefArray(srcpen, "outbound");
        penid = app.instId(pen);
        for(i = 0; refarray && i < refarray.length; i += 1) {
            if(refarray[i].rel.relatedid === penid) {
                return ""; } }  //already following
        html = " <a href=\"#followback\" title=\"follow " + pen.name + "\"" +
                  " onclick=\"app.rel.followBack(" + app.instId(pen) + ");" +
                             "return false;\"" +
                  " class=\"smalltext\"" +
            ">[follow back]</a>";
        return html;
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


    relRefPenHTML = function (relref, direction, placeholder) {
        var idfield, penref, temp = placeholder;
        idfield = (direction === "outbound")? "relatedid" : "originid";
        penref = app.lcs.getPenRef(relref.rel[idfield]);
        if(penref.status !== "ok" && penref.status !== "not cached") {
            return ""; }  //skip any deleted or otherwise unresolved refs
        if(penref.pen) {
            temp = app.profile.penListItemHTML(penref.pen);
            if(direction === "inbound") {  //showing followers
                temp = temp.slice(0, temp.indexOf("</li>"));
                temp += followBackLink(penref.pen) + "</li>"; } }
        return temp;
    },


    relRefPenHTMLFooter = function (direction) {
        var html = "<div id=\"srchpenslinkdiv\">" + 
              "<a id=\"srchpens\" href=\"#findpens\"" + 
                " onclick=\"app.activity.pensearchdialog();" + 
                           "return false;\">" +
                "<img class=\"reviewbadge\" src=\"img/follow.png\"" + 
                    " border=\"0\">" +
                "Find pen names to follow</a>" +
            "</div>";
        return html;
    },


    displayRelatedPens = function (pen, direction, divid) {
        var html, refarray, placeholder, i, litemp;
        placeholder = "<li>Fetching pen names</li>";
        refarray = getRelRefArray(pen, direction);
        html = "<ul class=\"penlist\">";
        if(refarray) {
            if(refarray.length > 0) {
                for(i = 0; i < refarray.length && i < maxpgdisp; i += 1) {
                    litemp = relRefPenHTML(refarray[i], direction, placeholder);
                    html += litemp;
                    if(litemp === placeholder) {
                        break; } }
                //ATTENTION: continue display link if maxpgdisp
                if(i === refarray.length) {
                    html += relRefPenHTMLFooter(direction); } }
            else if(refarray.length === 0) {
                if(direction === "outbound") {
                    html += "<li>Not following anyone.</li>";
                    if(app.instId(pen) === app.pen.currPenId()) {  //own profile
                        html += "<li>" + app.activity.searchPensLinkHTML() +
                            "</li>"; } }
                else { //inbound
                    html += "<li>No followers.</li>"; } } }
        else {  //dump an interim placeholder while retrieving rels
            html += "<li>fetching relationships...</li>"; }
        html += "</ul>";
        app.out(divid, html);
        if(!refarray) {  //rels not loaded yet, init and fetch.
            loadDisplayRels(pen, direction, divid); }
        else if(litemp === placeholder) {
            loadReferencedPens(refarray[i], function () {
                displayRelatedPens(pen, direction, divid); }); }
    },


    settingsDialogChangeFollowType = function () {
        if(app.safeget('follow', 'checked')) {
            app.out('fstatdescr', 
                    "Show new reviews under friend reviews"); }
        else if(app.safeget('block', 'checked')) {
            app.out('fstatdescr',
                    "List as following, but do not show new reviews"); }
        else if(app.safeget('nofollow', 'checked')) {
            app.out('fstatdescr',
                    "Do not show new reviews, do not list as following"); }
    },


    setFormValuesFromRel = function (rel) {
        var mutes, i;
        if(rel.status === "blocked") {
            app.byId('block').checked = true; }
        else {
            app.byId('follow').checked = true; }
        if(rel.mute) {
            mutes = rel.mute.split(',');
            for(i = 0; i < mutes.length; i += 1) {
                app.byId(mutes[i]).checked = true; } }
        settingsDialogChangeFollowType();
    },


    setRelFieldsFromFormValues = function (rel) {
        var checkboxes, i;
        if(app.byId('follow').checked) {
            rel.status = "following"; }
        else if(app.byId('block').checked) {
            rel.status = "blocked"; }
        else if(app.byId('nofollow').checked) {
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
        var penref, i, relid = app.instId(rel);
        penref = app.pen.currPenRef();
        if(penref.outrels) {
            for(i = 0; i < penref.outrels.length; i += 1) {
                if(app.instId(penref.outrels[i].rel) === relid) {
                    break; } }
            if(i < penref.outrels.length) { //found it
                penref.outrels.splice(i, 1); } }
        app.lcs.remRel(rel);
    },


    updateRelationship = function (rel) {
        var critsec = "", data = app.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            app.call("delrel?" + app.login.authparams(), 'POST', data,
                     function (updates) {
                         var orgpen = updates[0],  //originator pen
                             relpen = updates[1];  //related pen
                         app.lcs.putPen(orgpen);
                         app.lcs.putPen(relpen);
                         removeOutboundRel(rel);   //relationship
                         app.layout.closeDialog();
                         app.activity.reset();
                         app.profile.byprofid(app.instId(updates[1])); },
                     function (code, errtxt) {
                         app.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
        else { //update
            app.call("updrel?" + app.login.authparams(), 'POST', data,
                     function (updates) {
                         app.lcs.putRel(updates[0]);
                         app.layout.closeDialog();
                         app.activity.reset();
                         app.profile.byprofid(updates[0].relatedid); },
                     function (code, errtxt) {
                         app.err("Relationship update failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    //The data model supports a minimum rating, but leaving that out
    //unless and until there is a real need to limit activity noise
    //beyond the types.
    displayRelationshipDialog = function (rel, related, isnew) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"app.layout.closeDialog();return false;\"" +
            ">&lt;close&nbsp;&nbsp;X&gt;</a></div>" + 
            "<div class=\"floatclear\"></div>" +
            "<span class=\"headingtxt\">";
        if(isnew) {
            html += "You are now following " + related.name; }
        else {
            html += "Follow settings for " + related.name; }
        html += "</span><table class=\"formstyle\">" +
          "<tr>" +
            "<td>" +
              "<b>Status</b> " + 
              app.radiobutton("fstat", "follow", "", false, "app.rel.fchg") + 
                "&nbsp;" +
              app.radiobutton("fstat", "block", "", false, "app.rel.fchg") + 
                "&nbsp;" +
              app.radiobutton("fstat", "nofollow", "Stop Following",
                              false, "app.rel.fchg") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td><div id=\"fstatdescr\"></div></td>" +
          "</tr>" +
          "<tr>" +
            "<td>" +
              "<b>Ignore reviews from " + related.name + " about</b>" +
              app.review.reviewTypeCheckboxesHTML("mtype") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        app.out('dlgdiv', html);
        setFormValuesFromRel(rel);
        app.on('savebutton', 'click', function (e) {
            app.evtend(e);
            app.out('settingsbuttons', "Saving...");
            setRelFieldsFromFormValues(rel);
            updateRelationship(rel); });
        app.byId('dlgdiv').style.visibility = "visible";
        app.onescapefunc = app.layout.closeDialog;
    },


    findOutboundRelationship = function (relatedid) {
        var pen, relrefs, i;
        pen = app.pen.currPenRef().pen;
        relrefs = getRelRefArray(pen, "outbound");
        for(i = 0; relrefs && i < relrefs.length; i += 1) {
            if(relrefs[i].rel.relatedid === relatedid) {
                return relrefs[i].rel; } }
    },


    getOutboundRelationshipIds = function () {
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


    createOrEditRelationship = function (originator, related) {
        var rel, newrel, data, critsec = "";
        rel = findOutboundRelationship(app.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            newrel = {};
            newrel.originid = app.instId(originator);
            newrel.relatedid = app.instId(related);
            app.assert(newrel.originid && newrel.relatedid);
            newrel.status = "following";
            newrel.mute = "";
            newrel.cutoff = 0;
            data = app.objdata(newrel);
            app.call("newrel?" + app.login.authparams(), 'POST', data,
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
                     function (code, errtxt) {
                         app.err("Relationship creation failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    addFollowerDisplayHome = function (followerid) {
        app.pen.getPen(function (homepen) {
            app.lcs.getPenFull(followerid, function (penref) {
                createOrEditRelationship(homepen, penref.pen,
                                         app.instId(homepen)); }); });
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
        params = app.login.authparams() + "&originid=" + app.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + app.enc(loadoutcursor); }
        app.call("findrels?" + params, 'GET', null,
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
                 function (code, errtxt) {
                     app.log("loadOutboundRelationships errcode " + code +
                             ": " + errtxt);
                     alert("Sorry. Data error. Please reload the page"); },
                 critsec);
    },


    //kick off loading all the outbound relationships, but do not
    //block since nobody wants to sit and wait for it.  Protect
    //against duplicate calls, since that can happen as closures
    //are establishing their state at startup.
    asyncLoadOutboundRelationships = function () {
        if(asyncLoadStarted) {
            return; }  //allready working on loading
        if(app.pen.currPenRef().outrels) {
            return; }  //already loaded
        asyncLoadStarted = true;
        loadoutcursor = "starting";
        setTimeout(function () {
            loadOutboundRelationships(); }, 50);
    };


    return {
        resetStateVars: function (relstate, pen) {
            resetStateVars(relstate, pen); },
        reledit: function (from, to) {
            createOrEditRelationship(from, to); },
        fchg: function () {
            settingsDialogChangeFollowType(); },
        outbound: function (relatedid) {
            return findOutboundRelationship(relatedid); },
        loadoutbound: function () {
            asyncLoadOutboundRelationships(); },
        outboundids: function () {
            return getOutboundRelationshipIds(); },
        displayRelations: function (pen, direction, divid) {
            return displayRelatedPens(pen, direction, divid); },
        followBack: function (followerid) {
            addFollowerDisplayHome(followerid); },
        relsLoaded: function () {
            return asyncLoadStarted && !loadoutcursor; }
    };

});

