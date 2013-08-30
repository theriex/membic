/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false */

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
            glo.pen.currPenRef().outrels = [];
            asyncLoadStarted = true;  //started and finished..
            glo.profile.updateHeading(); }
        else if(relstate !== "logout") {
            //start the async load of the outrels.  relstate === "reload" 
            //is ignored since the relationships are cached with each pen
            //and are asumed to have been updated through this UI.
            glo.rel.loadoutbound(); }
    },


    getRelRefArray = function (pen, direction, init) {
        var penref, field;
        penref = glo.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field] && init) {
            penref[field] = []; }
        return penref[field];
    },


    pushRel = function (pen, direction, relationship) {
        var penref, field, relref;
        relref = glo.lcs.putRel(relationship);
        penref = glo.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
        penref[field].push(relref);
    },


    verifyRelsInitialized = function (pen, direction) {
        var penref, field;
        penref = glo.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
    },


    loadDisplayRels = function (pen, direction, divid, cursor) {
        var refarray, field, params, critsec = "";
        refarray = getRelRefArray(pen, direction);
        if(refarray && !cursor) {  //relationships already loaded
            return glo.rel.displayRelations(pen, direction, divid); }
        field = (direction === "outbound")? "originid" : "relatedid";
        params = glo.login.authparams() + "&" + field + "=" +
            glo.instId(pen);
        if(cursor) {
            params += "&cursor=" + cursor; }
        glo.call("findrels?" + params, 'GET', null,
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
                         glo.rel.displayRelations(pen, direction, divid); } },
                 function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     glo.log(msg);
                     glo.err(msg); },
                 critsec);
    },


    followBackLink = function (pen) {
        var i, refarray, penid, html, srcpen;
        srcpen = glo.pen.currPenRef().pen;
        refarray = getRelRefArray(srcpen, "outbound");
        penid = glo.instId(pen);
        for(i = 0; refarray && i < refarray.length; i += 1) {
            if(refarray[i].rel.relatedid === penid) {
                return ""; } }  //already following
        html = " <a href=\"#followback\" title=\"follow " + pen.name + "\"" +
                  " onclick=\"glo.rel.followBack(" + glo.instId(pen) + ");" +
                             "return false;\"" +
                  " class=\"smalltext\"" +
            ">[follow back]</a>";
        return html;
    },


    loadReferencedPens = function (relref, callback) {
        var penid, penref;
        penid = relref.rel.relatedid;
        penref = glo.lcs.getPenRef(penid);
        if(penref.pen) {
            penid = relref.rel.originid;
            penref = glo.lcs.getPenRef(penid); }
        if(penref.pen) {  //both loaded, return directly
            return callback(); }
        glo.lcs.getPenFull(penid, callback);
    },


    relRefPenHTML = function (relref, direction, placeholder) {
        var idfield, penref, temp = placeholder;
        idfield = (direction === "outbound")? "relatedid" : "originid";
        penref = glo.lcs.getPenRef(relref.rel[idfield]);
        if(penref.status !== "ok" && penref.status !== "not cached") {
            return ""; }  //skip any deleted or otherwise unresolved refs
        if(penref.pen) {
            temp = glo.profile.penListItemHTML(penref.pen);
            if(direction === "inbound") {  //showing followers
                temp = temp.slice(0, temp.indexOf("</li>"));
                temp += followBackLink(penref.pen) + "</li>"; } }
        return temp;
    },


    relRefPenHTMLFooter = function (direction) {
        var html = "<div id=\"srchpenslinkdiv\">" + 
              "<a id=\"srchpens\" href=\"#findpens\"" + 
                " onclick=\"glo.activity.pensearchdialog();" + 
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
                    if(glo.instId(pen) === glo.pen.currPenId()) {  //own profile
                        html += "<li>" + glo.activity.searchPensLinkHTML() +
                            "</li>"; } }
                else { //inbound
                    html += "<li>No followers.</li>"; } } }
        else {  //dump an interim placeholder while retrieving rels
            html += "<li>fetching relationships...</li>"; }
        html += "</ul>";
        glo.out(divid, html);
        if(!refarray) {  //rels not loaded yet, init and fetch.
            loadDisplayRels(pen, direction, divid); }
        else if(litemp === placeholder) {
            loadReferencedPens(refarray[i], function () {
                displayRelatedPens(pen, direction, divid); }); }
    },


    settingsDialogChangeFollowType = function () {
        if(glo.safeget('follow', 'checked')) {
            glo.out('fstatdescr', 
                    "Show new reviews under friend reviews"); }
        else if(glo.safeget('block', 'checked')) {
            glo.out('fstatdescr',
                    "List as following, but do not show new reviews"); }
        else if(glo.safeget('nofollow', 'checked')) {
            glo.out('fstatdescr',
                    "Do not show new reviews, do not list as following"); }
    },


    setFormValuesFromRel = function (rel) {
        var mutes, i;
        if(rel.status === "blocked") {
            glo.byId('block').checked = true; }
        else {
            glo.byId('follow').checked = true; }
        if(rel.mute) {
            mutes = rel.mute.split(',');
            for(i = 0; i < mutes.length; i += 1) {
                glo.byId(mutes[i]).checked = true; } }
        settingsDialogChangeFollowType();
    },


    setRelFieldsFromFormValues = function (rel) {
        var checkboxes, i;
        if(glo.byId('follow').checked) {
            rel.status = "following"; }
        else if(glo.byId('block').checked) {
            rel.status = "blocked"; }
        else if(glo.byId('nofollow').checked) {
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
        var penref, i, relid = glo.instId(rel);
        penref = glo.pen.currPenRef();
        if(penref.outrels) {
            for(i = 0; i < penref.outrels.length; i += 1) {
                if(glo.instId(penref.outrels[i].rel) === relid) {
                    break; } }
            if(i < penref.outrels.length) { //found it
                penref.outrels.splice(i, 1); } }
        glo.lcs.remRel(rel);
    },


    updateRelationship = function (rel) {
        var critsec = "", data = glo.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            glo.call("delrel?" + glo.login.authparams(), 'POST', data,
                     function (updates) {
                         var orgpen = updates[0],  //originator pen
                             relpen = updates[1];  //related pen
                         glo.lcs.putPen(orgpen);
                         glo.lcs.putPen(relpen);
                         removeOutboundRel(rel);   //relationship
                         glo.layout.closeDialog();
                         glo.activity.reset();
                         glo.profile.byprofid(glo.instId(updates[1])); },
                     function (code, errtxt) {
                         glo.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
        else { //update
            glo.call("updrel?" + glo.login.authparams(), 'POST', data,
                     function (updates) {
                         glo.lcs.putRel(updates[0]);
                         glo.layout.closeDialog();
                         glo.activity.reset();
                         glo.profile.byprofid(updates[0].relatedid); },
                     function (code, errtxt) {
                         glo.err("Relationship update failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    //The data model supports a minimum rating, but leaving that out
    //unless and until there is a real need to limit activity noise
    //beyond the types.
    displayRelationshipDialog = function (rel, related, isnew) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"glo.layout.closeDialog();return false;\"" +
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
              glo.radiobutton("fstat", "follow", "", false, "glo.rel.fchg") + 
                "&nbsp;" +
              glo.radiobutton("fstat", "block", "", false, "glo.rel.fchg") + 
                "&nbsp;" +
              glo.radiobutton("fstat", "nofollow", "Stop Following",
                              false, "glo.rel.fchg") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td><div id=\"fstatdescr\"></div></td>" +
          "</tr>" +
          "<tr>" +
            "<td>" +
              "<b>Ignore reviews from " + related.name + " about</b>" +
              glo.review.reviewTypeCheckboxesHTML("mtype") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        glo.out('dlgdiv', html);
        setFormValuesFromRel(rel);
        glo.onclick('savebutton', function () {
            glo.out('settingsbuttons', "Saving...");
            setRelFieldsFromFormValues(rel);
            updateRelationship(rel); });
        glo.byId('dlgdiv').style.visibility = "visible";
        glo.onescapefunc = glo.layout.closeDialog;
    },


    findOutboundRelationship = function (relatedid) {
        var pen, relrefs, i;
        pen = glo.pen.currPenRef().pen;
        relrefs = getRelRefArray(pen, "outbound");
        for(i = 0; relrefs && i < relrefs.length; i += 1) {
            if(relrefs[i].rel.relatedid === relatedid) {
                return relrefs[i].rel; } }
    },


    getOutboundRelationshipIds = function () {
        var pen, relrefs, i, relids = [];
        pen = glo.pen.currPenRef().pen;
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
        rel = findOutboundRelationship(glo.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            newrel = {};
            newrel.originid = glo.instId(originator);
            newrel.relatedid = glo.instId(related);
            glo.assert(newrel.originid && newrel.relatedid);
            newrel.status = "following";
            newrel.mute = "";
            newrel.cutoff = 0;
            data = glo.objdata(newrel);
            glo.call("newrel?" + glo.login.authparams(), 'POST', data,
                     function (newrels) {
                         var orgpen = newrels[0],  //originator pen
                             relpen = newrels[1];  //related pen
                         newrel = newrels[2];  //new relationship
                         glo.lcs.putPen(orgpen);
                         glo.lcs.putPen(relpen);
                         pushRel(orgpen, "outbound", newrel);
                         //profile.writeNavDisplay is not enough if followBack,
                         //have to redraw follow tab counts also.
                         glo.profile.refresh();
                         displayRelationshipDialog(newrels[2], newrels[1], 
                                                   true); },
                     function (code, errtxt) {
                         glo.err("Relationship creation failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    addFollowerDisplayHome = function (followerid) {
        glo.pen.getPen(function (homepen) {
            glo.lcs.getPenFull(followerid, function (penref) {
                createOrEditRelationship(homepen, penref.pen,
                                         glo.instId(homepen)); }); });
    },


    relationshipsLoadFinished = function (pen) {
        glo.profile.updateHeading();
    },


    appendOutboundRel = function (relref) {
        var penref = glo.pen.currPenRef();
        if(!penref.outrels) {
            penref.outrels = []; }
        penref.outrels.push(relref);
    },


    loadOutboundRelationships = function () {
        var pen, params, critsec = "";
        pen = glo.pen.currPenRef().pen;
        params = glo.login.authparams() + "&originid=" + glo.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + glo.enc(loadoutcursor); }
        glo.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i, relref;
                     loadoutcursor = "";
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 loadoutcursor = relationships[i].cursor; }
                             break; }
                         relref = glo.lcs.putRel(relationships[i]);
                         appendOutboundRel(relref); }
                     if(loadoutcursor) {
                         setTimeout(function () {
                             loadOutboundRelationships(pen); }, 50); }
                     else {
                         relationshipsLoadFinished(pen); } },
                 function (code, errtxt) {
                     glo.log("loadOutboundRelationships errcode " + code +
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
        if(glo.pen.currPenRef().outrels) {
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

