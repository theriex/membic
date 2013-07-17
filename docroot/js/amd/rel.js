/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

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
            mor.pen.currPenRef().outrels = [];
            asyncLoadStarted = true;  //started and finished..
            mor.profile.updateHeading(); }
        else if(relstate !== "logout") {
            //start the async load of the outrels.  relstate === "reload" 
            //is ignored since the relationships are cached with each pen
            //and are asumed to have been updated through this UI.
            mor.rel.loadoutbound(); }
    },


    getRelRefArray = function (pen, direction, init) {
        var penref, field;
        penref = mor.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field] && init) {
            penref[field] = []; }
        return penref[field];
    },


    pushRel = function (pen, direction, relationship) {
        var penref, field, relref;
        relref = mor.lcs.putRel(relationship);
        penref = mor.lcs.getPenRef(pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
        penref[field].push(relref);
    },


    loadDisplayRels = function (pen, direction, divid, cursor) {
        var refarray, field, params, critsec = "";
        refarray = getRelRefArray(pen, direction);
        if(refarray && !cursor) {  //relationships already loaded
            return mor.rel.displayRelations(pen, direction, divid); }
        field = (direction === "outbound")? "originid" : "relatedid";
        params = mor.login.authparams() + "&" + field + "=" +
            mor.instId(pen);
        if(cursor) {
            params += "&cursor=" + cursor; }
        mor.call("findrels?" + params, 'GET', null,
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
                         mor.rel.displayRelations(pen, direction, divid); } },
                 function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     mor.log(msg);
                     mor.err(msg); },
                 critsec);
    },


    followBackLink = function (pen) {
        var i, refarray, penid, html;
        penid = mor.instId(pen);
        refarray = getRelRefArray(pen, "outbound");
        for(i = 0; refarray && i < refarray.length; i += 1) {
            if(refarray[i].rel.relatedid === penid) {
                return ""; } }  //already following
        html = " <a href=\"#followback\" title=\"follow " + pen.name + "\"" +
                  " onclick=\"mor.rel.followBack(" + mor.instId(pen) + ");" +
                             "return false;\"" +
                  " class=\"smalltext\"" +
            ">[follow back]</a>";
        return html;
    },


    loadReferencedPens = function (relref, callback) {
        var penid, penref;
        penid = relref.rel.relatedid;
        penref = mor.lcs.getPenRef(penid);
        if(penref.pen) {
            penid = relref.rel.originid;
            penref = mor.lcs.getPenRef(penid); }
        if(penref.pen) {  //both loaded, return directly
            return callback(); }
        mor.lcs.getPenFull(penid, callback);
    },


    relRefPenHTML = function (relref, direction, placeholder) {
        var idfield, penref, temp = placeholder;
        idfield = (direction === "outbound")? "relatedid" : "originid";
        penref = mor.lcs.getPenRef(relref.rel[idfield]);
        if(penref.status !== "ok" && penref.status !== "not cached") {
            return ""; }  //skip any deleted or otherwise unresolved refs
        if(penref.pen) {
            temp = mor.profile.penListItemHTML(penref.pen);
            if(direction === "inbound") {  //showing followers
                temp = temp.slice(0, temp.indexOf("</li>"));
                temp += followBackLink(penref.pen) + "</li>"; } }
        return temp;
    },


    relRefPenHTMLFooter = function (direction) {
        var html = "<div id=\"srchpenslinkdiv\">" + 
              "<a id=\"srchpens\" href=\"#findpens\"" + 
                " onclick=\"mor.activity.pensearchdialog();" + 
                           "return false;\">" +
                "<img class=\"reviewbadge\" src=\"img/follow.png\">" +
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
                    if(mor.instId(pen) === mor.pen.currPenId()) {  //own profile
                        html += "<li>" + mor.activity.searchPensLinkHTML() +
                            "</li>"; } }
                else { //inbound
                    html += "<li>No followers.</li>"; } } }
        else {  //dump an interim placeholder while retrieving rels
            html += "<li>fetching relationships...</li>"; }
        html += "</ul>";
        mor.out(divid, html);
        if(!refarray) {  //rels not loaded yet, init and fetch.
            getRelRefArray(pen, direction, true);
            loadDisplayRels(pen, direction, divid); }
        else if(litemp === placeholder) {
            loadReferencedPens(refarray[i], function () {
                displayRelatedPens(pen, direction, divid); }); }
    },


    settingsDialogChangeFollowType = function () {
        if(mor.safeget('follow', 'checked')) {
            mor.out('fstatdescr', 
                    "Show new reviews under friend reviews"); }
        else if(mor.safeget('block', 'checked')) {
            mor.out('fstatdescr',
                    "List as following, but do not show new reviews"); }
        else if(mor.safeget('nofollow', 'checked')) {
            mor.out('fstatdescr',
                    "Do not show new reviews, do not list as following"); }
    },


    setFormValuesFromRel = function (rel) {
        var mutes, i;
        if(rel.status === "blocked") {
            mor.byId('block').checked = true; }
        else {
            mor.byId('follow').checked = true; }
        if(rel.mute) {
            mutes = rel.mute.split(',');
            for(i = 0; i < mutes.length; i += 1) {
                mor.byId(mutes[i]).checked = true; } }
        settingsDialogChangeFollowType();
    },


    setRelFieldsFromFormValues = function (rel) {
        var checkboxes, i;
        if(mor.byId('follow').checked) {
            rel.status = "following"; }
        else if(mor.byId('block').checked) {
            rel.status = "blocked"; }
        else if(mor.byId('nofollow').checked) {
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
        var penref, i, relid = mor.instId(rel);
        penref = mor.pen.currPenRef();
        if(penref.outrels) {
            for(i = 0; i < penref.outrels.length; i += 1) {
                if(mor.instId(penref.outrels[i].rel) === relid) {
                    break; } }
            if(i < penref.outrels.length) { //found it
                penref.outrels.splice(i, 1); } }
        mor.lcs.remRel(rel);
    },


    updateRelationship = function (rel) {
        var critsec = "", data = mor.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            mor.call("delrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         var orgpen = updates[0],  //originator pen
                             relpen = updates[1];  //related pen
                         mor.lcs.putPen(orgpen);
                         mor.lcs.putPen(relpen);
                         removeOutboundRel(rel);   //relationship
                         mor.layout.closeDialog();
                         mor.activity.reset();
                         mor.profile.byprofid(mor.instId(updates[1])); },
                     function (code, errtxt) {
                         mor.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
        else { //update
            mor.call("updrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         mor.lcs.putRel(updates[0]);
                         mor.layout.closeDialog();
                         mor.activity.reset();
                         mor.profile.byprofid(updates[0].relatedid); },
                     function (code, errtxt) {
                         mor.err("Relationship update failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    //The data model supports a minimum rating, but leaving that out
    //unless and until there is a real need to limit activity noise
    //beyond the types.
    displayRelationshipDialog = function (rel, related, isnew) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"mor.layout.closeDialog();return false;\"" +
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
              mor.radiobutton("fstat", "follow", "", false, "mor.rel.fchg") + 
                "&nbsp;" +
              mor.radiobutton("fstat", "block", "", false, "mor.rel.fchg") + 
                "&nbsp;" +
              mor.radiobutton("fstat", "nofollow", "Stop Following",
                              false, "mor.rel.fchg") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td><div id=\"fstatdescr\"></div></td>" +
          "</tr>" +
          "<tr>" +
            "<td>" +
              "<b>Ignore reviews from " + related.name + " about</b>" +
              mor.review.reviewTypeCheckboxesHTML("mtype") +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('dlgdiv', html);
        setFormValuesFromRel(rel);
        mor.onclick('savebutton', function () {
            mor.out('settingsbuttons', "Saving...");
            setRelFieldsFromFormValues(rel);
            updateRelationship(rel); });
        mor.byId('dlgdiv').style.visibility = "visible";
        mor.onescapefunc = mor.layout.closeDialog;
    },


    findOutboundRelationship = function (relatedid) {
        var pen, relrefs, i;
        pen = mor.pen.currPenRef().pen;
        relrefs = getRelRefArray(pen, "outbound");
        for(i = 0; relrefs && i < relrefs.length; i += 1) {
            if(relrefs[i].rel.relatedid === relatedid) {
                return relrefs[i].rel; } }
    },


    getOutboundRelationshipIds = function () {
        var pen, relrefs, i, relids = [];
        pen = mor.pen.currPenRef().pen;
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
        rel = findOutboundRelationship(mor.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            newrel = {};
            newrel.originid = mor.instId(originator);
            newrel.relatedid = mor.instId(related);
            mor.assert(newrel.originid && newrel.relatedid);
            newrel.status = "following";
            newrel.mute = "";
            newrel.cutoff = 0;
            data = mor.objdata(newrel);
            mor.call("newrel?" + mor.login.authparams(), 'POST', data,
                     function (newrels) {
                         var orgpen = newrels[0],  //originator pen
                             relpen = newrels[1],  //related pen
                             newrel = newrels[2];  //new relationship
                         mor.lcs.putPen(orgpen);
                         mor.lcs.putPen(relpen);
                         pushRel(orgpen, "outbound", newrel);
                         //profile.writeNavDisplay is not enough if followBack,
                         //have to redraw follow tab counts also.
                         mor.profile.refresh();
                         displayRelationshipDialog(newrels[2], newrels[1], 
                                                   true); },
                     function (code, errtxt) {
                         mor.err("Relationship creation failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
    },


    addFollowerDisplayHome = function (followerid) {
        mor.pen.getPen(function (homepen) {
            mor.lcs.getPenFull(followerid, function (penref) {
                createOrEditRelationship(homepen, penref.pen,
                                         mor.instId(homepen)); }); });
    },


    relationshipsLoadFinished = function (pen) {
        mor.profile.updateHeading();
    },


    appendOutboundRel = function (relref) {
        var penref = mor.pen.currPenRef();
        if(!penref.outrels) {
            penref.outrels = []; }
        penref.outrels.push(relref);
    },


    loadOutboundRelationships = function () {
        var pen, params, critsec = "";
        pen = mor.pen.currPenRef().pen;
        params = mor.login.authparams() + "&originid=" + mor.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + mor.enc(loadoutcursor); }
        mor.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i, relref;
                     loadoutcursor = "";
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 loadoutcursor = relationships[i].cursor; }
                             break; }
                         relref = mor.lcs.putRel(relationships[i]);
                         appendOutboundRel(relref); }
                     if(loadoutcursor) {
                         setTimeout(function () {
                             loadOutboundRelationships(pen); }, 50); }
                     else {
                         relationshipsLoadFinished(pen); } },
                 function (code, errtxt) {
                     mor.log("loadOutboundRelationships errcode " + code +
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
        if(mor.pen.currPenRef().outrels) {
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

