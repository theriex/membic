/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . r e l
//
define([], function () {
    "use strict";

    var outboundRels,
        loadoutcursor,
        asyncLoadStarted,


    resetStateVars = function (relstate, pen) {
        outboundRels = null;
        loadoutcursor = null;
        asyncLoadStarted = false;
        if(relstate === "new") {
            outboundRels = []; }
        else if(relstate === "reload") {
            mor.rel.loadoutbound(pen); }
    },


    loadDisplayRels = function (pen, direction, divid) {
        var field, dispobj, params;
        if(direction === "outbound") {
            field = "originid"; }
        else { //inbound
            field = "relatedid"; }
        dispobj = pen.profstate[direction];
        params = mor.login.authparams() + "&" + field + "=" +
            mor.instId(pen);
        if(dispobj.cursor) {
            params += "&cursor=" + dispobj.cursor; }
        else if(dispobj.offset) {
            params += "&offset=" + dispobj.offset; }
        mor.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i;
                     dispobj.rels = [];
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 dispobj.cursor = relationships[i].cursor; }
                             break; }
                         dispobj.rels.push(relationships[i]); }
                     mor.rel.displayRelations(pen, direction, divid); },
                 function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     mor.log(msg);
                     mor.err(msg); },
                 dispobj.critsec);
    },


    loadDisplayRelPens = function (pen, direction, divid) {
        var dispobj, rel, id;
        dispobj = pen.profstate[direction];
        rel = dispobj.rels[dispobj.pens.length];
        if(direction === "outbound") {
            id = rel.relatedid; }
        else { //inbound
            id = rel.originid; }
        mor.profile.retrievePen(id, function (relpen) {
            dispobj.pens.push(relpen);
            mor.rel.displayRelations(pen, direction, divid); });
    },


    followBackLink = function (pen) {
        var i, outrel, penid, html;
        penid = mor.instId(pen);
        for(i = 0; i < outboundRels.length; i += 1) {
            outrel = outboundRels[i];
            if(outrel.relatedid === penid) {
                return ""; } }  //already following
        html = " <a href=\"#followback\" title=\"follow " + pen.name + "\"" +
                  " onclick=\"mor.rel.followBack(" + mor.instId(pen) + ");" +
                             "return false;\"" +
                  " class=\"smalltext\"" +
            ">[follow back]</a>";
        return html;
    },


    //factored method to avoid a firebug stepping bug
    dumpPenItems = function (dispobj, direction) {
        var i, html = "", temp;
        for(i = 0; i < dispobj.pens.length; i += 1) {
            temp = mor.profile.penListItemHTML(dispobj.pens[i]);
            if(direction === "inbound") {  //showing followers
                temp = temp.slice(0, temp.indexOf("</li>"));
                temp += followBackLink(dispobj.pens[i]) + "</li>"; }
            html += temp; }
        if(direction === "outbound") {
            html += "<div id=\"srchpenslinkdiv\">" + 
                  "<a id=\"srchpens\" href=\"#findpens\"" + 
                    " onclick=\"mor.activity.pensearchdialog();" + 
                               "return false;\">" +
                    "<img class=\"reviewbadge\" src=\"img/follow.png\">" +
                    "Find pen names to follow</a>" +
                "</div>"; }
        return html;
    },


    //pen.profstate is initialized from profile
    displayRelatedPens = function (pen, direction, divid) {
        var html, dispobj;
        if(!pen.profstate[direction]) {
            pen.profstate[direction] = { }; }
        dispobj = pen.profstate[direction];
        html = "<ul class=\"penlist\">";
        //display whatever pens have been retrieved so far
        if(dispobj.rels) {
            if(dispobj.pens && dispobj.pens.length > 0) {
                html += dumpPenItems(dispobj, direction); }
            else if(dispobj.rels.length === 0) {
                if(direction === "outbound") {
                    html += "<li>Not following anyone.</li>";
                    if(mor.instId(pen) === mor.pen.currPenId()) {  //own profile
                        html += "<li>" + mor.activity.searchPensLinkHTML() +
                            "</li>"; } }
                else { //inbound
                    html += "<li>No followers.</li>"; } }
            else {
                html += "<li>fetching pen names...</li>"; } }
        else {  //dump an interim placeholder while retrieving rels
            html += "<li>fetching relationships...</li>"; }
        html += "</ul>";
        //ATTENTION: need prev/next buttons for paging
        mor.out(divid, html);
        //if any info needs to be filled in, then go get it...
        if(!dispobj.rels) { 
            return loadDisplayRels(pen, direction, divid); }
        if(!dispobj.pens) {
            dispobj.pens = []; }
        if(dispobj.rels.length !== dispobj.pens.length) {
            return loadDisplayRelPens(pen, direction, divid); }
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
        var i, relid = mor.instId(rel);
        for(i = 0; i < outboundRels.length; i += 1) {
            if(mor.instId(outboundRels[i]) === relid) {
                break; } }
        if(i < outboundRels.length) {  //found it
            outboundRels.splice(i, 1); }
    },


    updateOutboundRel = function (rel) {
        var i, relid = mor.instId(rel);
        for(i = 0; i < outboundRels.length; i += 1) {
            if(mor.instId(outboundRels[i]) === relid) {
                outboundRels[i] = rel;
                break; } }
    },


    updateRelationship = function (rel) {
        var critsec = "", data = mor.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            mor.call("delrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         var orgpen = updates[0],  //originator pen
                             relpen = updates[1];  //related pen
                         mor.pen.noteUpdatedPen(orgpen);
                         mor.profile.updateCached([orgpen, relpen]);
                         removeOutboundRel(rel);   //relationship
                         mor.layout.closeDialog();
                         mor.profile.byprofid(mor.instId(updates[1])); },
                     function (code, errtxt) {
                         mor.err("Relationship deletion failed code " + code +
                                 ": " + errtxt); },
                     critsec); }
        else { //update
            mor.call("updrel?" + mor.login.authparams(), 'POST', data,
                     function (updates) {
                         updateOutboundRel(updates[0]);       //relationship
                         mor.layout.closeDialog();
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
              mor.radiobutton("fstat", "follow") + "&nbsp;" +
              mor.radiobutton("fstat", "block") + "&nbsp;" +
              mor.radiobutton("fstat", "nofollow", "Stop Following") +
            "</td>" +
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
            mor.activity.resetStateVars();
            updateRelationship(rel); });
        mor.byId('dlgdiv').style.visibility = "visible";
        mor.onescapefunc = mor.layout.closeDialog;
    },


    findOutboundRelationship = function (relatedid) {
        var i;
        for(i = 0; outboundRels && i < outboundRels.length; i += 1) {
            if(outboundRels[i].relatedid === relatedid) {
                return outboundRels[i]; } }
    },


    getOutboundRelationshipIds = function () {
        var i, relids = [];
        for(i = 0; outboundRels && i < outboundRels.length; i += 1) {
            //do not include blocked relationships in result ids
            if(outboundRels[i].status === "following") {
                relids.push(outboundRels[i].relatedid); } }
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
                         mor.pen.noteUpdatedPen(orgpen);
                         mor.profile.updateCached([orgpen, relpen]);
                         outboundRels.push(newrel);
                         mor.activity.resetStateVars();
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
            mor.profile.retrievePen(followerid, function (followerpen) {
                createOrEditRelationship(homepen, followerpen,
                                         mor.instId(homepen)); }); });
    },


    relationshipsLoadFinished = function (pen) {
        mor.profile.updateHeading();
    },


    loadOutboundRelationships = function (pen) {
        var params, critsec = "";
        params = mor.login.authparams() + "&originid=" + mor.instId(pen);
        if(loadoutcursor && loadoutcursor !== "starting") {
            params += "&cursor=" + mor.enc(loadoutcursor); }
        mor.call("findrels?" + params, 'GET', null,
                 function (relationships) {
                     var i;
                     loadoutcursor = "";
                     for(i = 0; i < relationships.length; i += 1) {
                         if(relationships[i].fetched) {
                             if(relationships[i].cursor) {
                                 loadoutcursor = relationships[i].cursor; }
                             break; }
                         outboundRels.push(relationships[i]); }
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
    asyncLoadOutboundRelationships = function (pen) {
        if(asyncLoadStarted) {
            return; }
        asyncLoadStarted = true;
        loadoutcursor = "starting";
        setTimeout(function () {
            outboundRels = [];
            loadOutboundRelationships(pen); }, 500);
    };


    return {
        resetStateVars: function (relstate, pen) {
            resetStateVars(relstate, pen); },
        reledit: function (from, to) {
            createOrEditRelationship(from, to); },
        outbound: function (relatedid) {
            return findOutboundRelationship(relatedid); },
        loadoutbound: function (pen) {
            asyncLoadOutboundRelationships(pen); },
        outboundids: function () {
            return getOutboundRelationshipIds(); },
        alloutbound: function () {
            return outboundRels; },
        displayRelations: function (pen, direction, divid) {
            return displayRelatedPens(pen, direction, divid); },
        followBack: function (followerid) {
            addFollowerDisplayHome(followerid); },
        relsLoaded: function () {
            return asyncLoadStarted && !loadoutcursor; }
    };

});

