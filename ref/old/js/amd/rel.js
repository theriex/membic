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
        hideNoRevOutbound = true,
        hideNoRevInbound = true,
        dlgreq = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    getRelRefArray = function (pen, direction, init) {
        var penref, field;
        penref = app.lcs.getRef("pen", pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field] && init) {
            penref[field] = []; }
        return penref[field];
    },


    pushRel = function (pen, direction, relationship) {
        var penref, field, relref;
        relref = app.lcs.put("rel", relationship);
        penref = app.lcs.getRef("pen", pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
        penref[field].push(relref);
    },


    verifyRelsInitialized = function (pen, direction) {
        var penref, field;
        penref = app.lcs.getRef("pen", pen);
        field = (direction === "outbound")? "outrels" : "inrels";
        if(!penref[field]) {
            penref[field] = []; }
    },


    followBackLink = function (pen) {
        var i, refarray, penid, html, srcpen;
        srcpen = app.pen.currPenRef().pen;
        refarray = getRelRefArray(srcpen, "outbound");
        penid = jt.instId(pen);
        if(app.revresp.isAbusivePen(penid)) {
            html = ["span", {cla: "errmsgdiv"}, "abusive"];
            return " " + jt.tac2html(html); }
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


    reqTypeSelectHTML = function (req) {
        var html, revtypes, ts = [], i, captype, imgsrc, vtxt, labtxt;
        revtypes = app.review.getReviewTypes();
        for(i = 0; i < revtypes.length; i += 1) {
            captype = revtypes[i].type.capitalize();
            imgsrc = revtypes[i].img;
            vtxt = "Set";
            labtxt = captype;
            if(revtypes[i].type === req.revtype) {
                vtxt = "Unset";
                imgsrc = "img/merit/Merit" + captype + "1.png";
                labtxt = "<span class=\"bluetxt\">" + captype + "</span>"; }
            ts.push(["div", {cla: "reqrevtseldiv"},
                     jt.imgntxt(imgsrc, labtxt,
                                "app.rel.reqdlgseltype('" + revtypes[i].type + 
                                                      "')",
                                "#" + captype,
                                vtxt + " review request type " + captype)]); }
        html = ["table",
                [["tr",
                  [["td", ts[0]],
                   ["td", ts[1]],
                   ["td", ts[2]],
                   ["td", ts[3]]]],
                 ["tr",
                  [["td", ts[4]],
                   ["td", ts[5]],
                   ["td", ts[6]],
                   ["td", ts[7]]]]]];
        return html;
    },


    withdrawButtonHTML = function () {
        var html = "";
        if(jt.instId(dlgreq)) {
            html = ["button", {type: "button", id: "withdrawbutton",
                               onclick: jt.fs("app.rel.withdrawRequest()")},
                    "Withdraw Request"]; }
        return html;
    },


    displayRequestDialog = function () {
        var req = dlgreq, html, pen, keyrow = "", revtype;
        pen = app.lcs.getRef("pen", req.toid).pen;
        if(req.revtype) {
            revtype = app.review.getReviewTypeByValue(req.revtype);
            if(!req.keywords) {
                req.keywords = ""; }
            keyrow = ["tr",
                      [["td",
                        ["b", "Keywords"]],
                       ["td",
                        app.review.keywordCheckboxesHTML(
                            revtype, req.keywords, 4,
                            "app.rel.toggleReqKeyword")]]]; }
        html = [
            ["div", {cla: "dlgclosex"},
             ["a", {id: "closedlg", href: "#close",
                    onclick: jt.fs("app.layout.closeDialog()")},
              "&lt;close&nbsp;&nbsp;X&gt;"]],
            ["div", {cla: "floatclear"}],
            ["div", {cla: "headingtxt"}, 
             "Requesting a review from " + pen.name],
            ["table", {cla: "formstyle"},
             [["tr",
               [["td",
                 ["b", "Requested"]],
                ["td",
                 jt.colloquialDate(jt.ISOString2Day(req.modified))]]],
              ["tr",
               [["td",
                 ["b", "Review Type"]],
                ["td",
                 reqTypeSelectHTML(req)]]],
              keyrow]],
            ["div", {id: "requestbuttonsdiv"},
             [withdrawButtonHTML(),
              "&nbsp;",
              ["button", {type: "button", id: "cancelbutton",
                          onclick: jt.fs("app.layout.closeDialog()")},
               "Cancel"],
              "&nbsp;",
              ["button", {type: "button", id: "savebutton",
                          onclick: jt.fs("app.rel.saveRequest()")},
               "Ok"],
              ["br"],
              ["div", {id: "reqsavemsg"}]]]];
        app.layout.openDialog({x:220, y:140}, jt.tac2html(html));
    },


    requestLinkHTML = function (penref) {
        var selfref, params, i, req, html = "";
        selfref = app.pen.currPenRef();
        if(!selfref.outreqs) {
            params = app.login.authparams() + "&fromid=" + selfref.penid;
            jt.call('GET', "findreqs?" + params, null,
                    function (reqs) {
                        selfref.outreqs = reqs;
                        app.profile.tabselect(); },
                    app.failf,
                    jt.semaphore("rel.requestLinkHTML")); }
        else { //have reqs, 
            for(i = 0; i < selfref.outreqs.length; i += 1) {
                if(selfref.outreqs[i].toid === penref.penid) {
                    req = selfref.outreqs[i];
                    break; } }
            if(req) {
                html = ["a", {href: "#request", title: "Modify review request",
                              onclick: jt.fs("app.rel.editreq('" + 
                                             penref.penid + "','" +
                                             jt.instId(req) + "')") },
                        "<i>sent request</i>"]; }
            else {
                html = ["a", {href: "#request", title: "Request a review",
                              onclick: jt.fs("app.rel.editreq('" + 
                                             penref.penid + "')") },
                        "Request a review"]; } }
        return html;                
    },


    writeRequestToServer = function () {
        var reqid, selfref, outreq, i, data;
        reqid = jt.instId(dlgreq);
        selfref = app.pen.currPenRef();
        if(reqid) {  //previously loaded, check if changed
            for(i = 0; i < selfref.outreqs.length; i += 1) {
                if(jt.instId(selfref.outreqs[i]) === reqid) {
                    outreq = selfref.outreqs[i];
                    break; } }
            if(outreq.revtype === dlgreq.revtype &&
               outreq.keywords === dlgreq.keywords &&
               outreq.status === dlgreq.status) {
                app.layout.closeDialog();
                return; } }
        //new or changed request
        data = jt.objdata(dlgreq);
        jt.call('POST', "updreq?" + app.login.authparams(), data,
                function (newreqs) {
                    if(reqid) {  //modified
                        if(newreqs[0].status === "open") {
                            selfref.outreqs[i] = newreqs[0]; }
                        else {
                            selfref.outreqs.splice(i, 1); } }
                    else {
                        selfref.outreqs.push(newreqs[0]); }
                    dlgreq = null;
                    app.layout.closeDialog();
                    app.profile.tabselect(); },
                app.failf(function (code, errtxt) {
                    jt.err("Review request save failed code " + code +
                           ": " + errtxt); }),
                jt.semaphore("rel.writeRequestToServer"));
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
        html = [["span", {cla: "poststatspan"},
                 "&nbsp;&nbsp;&nbsp;" + text + "&nbsp;"],
                ["span", {id: "reqspan" + penref.penid, cla: "reqlinkspan"},
                 requestLinkHTML(penref)]];
        return jt.tac2html(html);
    },


    loadReferencedPens = function (relref, callback) {
        var penid, penref;
        if(relref) {  //could get a spurious call if no followers
            penid = relref.rel.relatedid;
            penref = app.lcs.getRef("pen", penid);
            if(penref.pen) {
                penid = relref.rel.originid;
                penref = app.lcs.getRef("pen", penid); }
            if(penref.pen) {  //both loaded, return directly
                return callback(); }
            app.lcs.getFull("pen", penid, callback); }
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
            penrefA = app.lcs.getRef("pen", a.rel[idfield]);
            penrefB = app.lcs.getRef("pen", b.rel[idfield]);
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
        penref = app.lcs.getRef("pen", relref.rel[idfield]);
        if(penref.status !== "ok" && penref.status !== "not cached") {
            return ""; }  //skip any deleted or otherwise unresolved refs
        if(penref.pen) {
            if(!penref.pen.top20s || !penref.pen.top20s.latestrevtype) {
                if(direction === "outbound" && hideNoRevOutbound) {
                    return ""; }
                if(direction === "inbound" && hideNoRevInbound) {
                    return ""; } }
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


    relListCtrlsHTML = function (pen, direction, divid, refarray) {
        var html = "", showing, tab;
        if(refarray && refarray.length > 0) {
            html = [["input", {type: "checkbox", name: "cblurkincl",
                               value: "hidenorev", id: "hidenorev",
                               checked: jt.toru(direction === "outbound" ?
                                                hideNoRevOutbound : 
                                                hideNoRevInbound),
                               onclick: jt.fs("app.rel.toggleNoRevHide('" + 
                                              direction + "','" + divid + 
                                              "')")}],
                     ["label", {fo: "hidenorev"}, "Hide if no reviews"]]; }
        tab = "following";
        showing = "followers";
        if(direction === "outbound") {
            tab = "followers";
            showing = "following"; }
        html = ["table", {id: "relctrlstable"},
                [["tr",
                  [["td", {cla: "headingtxt"}, showing.capitalize()],
                   ["td",
                    ["div", {id: "followmodelinkdiv", cla: "tabmodediv"},
                     ["a", {href:"#followshowtoggle",
                            onclick: jt.fs("app.profile.tabselect('" + 
                                           tab + "')")},
                      "Show " + tab.capitalize()]]]]],
                 ["tr",
                  ["td",
                   html]]]];
        html = jt.tac2html(html);
        return html;
    },


    positionFollowControls = function () {
        var ctrls, fli, ctbl, x;
        ctrls = jt.byId('relctrlstable');
        if(ctrls) {
            fli = jt.byId('followli');
            if(fli) {
                ctbl = jt.byId('relctrlstable');
                x = Math.floor(fli.offsetLeft + (fli.offsetWidth / 2));
                x -= ctbl.offsetWidth;
                x = Math.max(x, 0);
                jt.byId('relctrlsdiv').style.marginLeft = String(x) + "px"; } }
    },


    noFollowersHTML = function (pen) {
        var html = [];
        if(pen.top20s && pen.top20s.latestrevtype) {
            html.push(["p", "No followers yet, but if you post a review every once in a while you will get noticed."]); }
        else {
            html.push(["p", "No followers yet. Consider writing a review."]);
            html.push(["p", "Guaranteed you've experienced <em>something</em>" +
                       " other people would like to hear about..."]);
        }
        return html;
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
        app.lcs.rem("rel", rel);
    },


    updateRelationship = function (rel) {
        var data = jt.objdata(rel);
        if(rel.status === "nofollow") {  //delete
            jt.call('POST', "delrel?" + app.login.authparams(), data,
                    function (updates) {
                        var orgpen = updates[0],  //originator pen
                            relpen = updates[1];  //related pen
                        app.lcs.put("pen", orgpen);
                        app.lcs.put("pen", relpen);
                        removeOutboundRel(rel);   //relationship
                        app.layout.closeDialog();
                        app.activity.reset();
                        app.profile.byprofid(jt.instId(updates[1])); },
                    app.failf(function (code, errtxt) {
                        jt.err("Relationship deletion failed code " + code +
                               ": " + errtxt); }),
                    jt.semaphore("rel.updateRelationship")); }
        else { //update
            jt.call('POST', "updrel?" + app.login.authparams(), data,
                     function (updates) {
                         app.lcs.put("rel", updates[0]);
                         app.layout.closeDialog();
                         app.activity.reset();
                         app.profile.byprofid(updates[0].relatedid); },
                     app.failf(function (code, errtxt) {
                         jt.err("Relationship update failed code " + code +
                                 ": " + errtxt); }),
                     jt.semaphore("rel.updateRelationship")); }
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
        app.layout.openDialog({x:220, y:140}, jt.tac2html(html), function () {
            setFormValuesFromRel(rel);
            jt.on('savebutton', 'click', function (e) {
                jt.evtend(e);
                jt.out('settingsbuttons', "Saving...");
                setRelFieldsFromFormValues(rel);
                updateRelationship(rel); }); });
    },


    addFollow = function (originator, related, contfunc) {
        var newrel = {}, data;
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
                    app.lcs.put("pen", orgpen);
                    app.lcs.put("pen", relpen);
                    pushRel(orgpen, "outbound", newrel);
                    contfunc(orgpen, relpen, newrel); },
                app.failf(function (code, errtxt) {
                    jt.err("Relationship creation failed code " + code +
                           ": " + errtxt); }),
                jt.semaphore("rel.addFollow"));
    },


    createOrEditRelationship = function (originator, related) {
        var rel;
        rel = app.rel.outbound(jt.instId(related));
        if(rel) {
            displayRelationshipDialog(rel, related); }
        else if(loadoutcursor) {
            alert("Still loading relationships, try again in a few seconds"); }
        else {
            addFollow(originator, related, function (orgpen, relpen, newrel) {
                //have to redraw follow tab counts also.
                app.profile.refresh();
                displayRelationshipDialog(newrel, relpen, true); }); }
    },


    relationshipsLoadFinished = function (pen) {
    },


    //Even though the server calls are protected from re-entrancy, it
    //is still possible to end up with two work processes both loading
    //outbound relationships. For example the async load of outbound
    //relationships that kicks off on app init, and a second sync load
    //of the same thing trying to display the profile "following" tab.
    //So this needs to protect against appending duplicates.
    appendOutboundRel = function (relref) {
        var i, penref = app.pen.currPenRef();
        if(!penref.outrels) {
            penref.outrels = []; }
        for(i = 0; i < penref.outrels.length; i += 1) {
            if(penref.outrels[i].relid === relref.relid) {
                return; }    //already there, don't duplicate
            if(penref.outrels[i].rel && 
               penref.outrels[i].rel.relatedid === relref.rel.relatedid) {
                return; } }  //already there, don't duplicate
        penref.outrels.push(relref);
    },


    loadOutboundRelationships = function () {
        var pen, params;
        if(!app.pen.currPenRef()) {
            return app.pen.getPen(loadOutboundRelationships); }
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
                         relref = app.lcs.put("rel", relationships[i]);
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
                jt.semaphore("rel.loadOutboundRelationships"));
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function (relstate, pen) {
        jt.log("rel.resetStateVars called");
        loadoutcursor = null;
        asyncLoadStarted = false;
        if(app.pen.currPenRef()) {
            app.pen.currPenRef().outrels = null; }
        if(relstate === "new") {
            //a new pen name has no outbound relationships yet.  Just
            //init the outrels in the cache PenRef to an empty array.
            app.pen.currPenRef().outrels = [];
            asyncLoadStarted = true; } //started and finished..
        else if(relstate !== "logout") {
            //start the async load of the outrels.  relstate === "reload" 
            //is ignored since the relationships are cached with each pen
            //and are asumed to have been updated through this UI.
            app.rel.loadoutbound(); }
    },


    reledit: function (from, to) {
        createOrEditRelationship(from, to);
    },


    follow: function (pen, contfunc) {
        addFollow(app.pen.currPenRef().pen, pen, contfunc);
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
            jt.log("rel.loadoutbound already started");
            return; }  //already working on loading
        if(app.pen.currPenRef().outrels) {
            jt.log("rel.loadoutbound curr penref outrels already loaded");
            return; }  //already loaded
        jt.log("rel.loadoutbound starting load");
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


    loadDisplayRels: function (pen, direction, contfunc, cursor) {
        var refarray, field, params;
        refarray = getRelRefArray(pen, direction);
        if(refarray && !cursor) {  //relationships already loaded
            return contfunc(refarray); }
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
                         app.rel.loadDisplayRels(pen, direction, contfunc, 
                                                 resultCursor); }
                     else {
                         verifyRelsInitialized(pen, direction);
                         contfunc(getRelRefArray(pen, direction)); } },
                 app.failf(function (code, errtxt) {
                     var msg = "loadDisplayRels error code " + code + 
                         ": " + errtxt;
                     jt.log(msg);
                     jt.err(msg); }),
                jt.semaphore("rel.loadDisplayRels"));
    },


    //Working on ameliorating large number issues as they develop
    //(before maxpgdisp kicks in), so there is context for strategies.
    displayRelations: function (pen, direction, divid) {
        var html, refarray, relitems = [], placeholder, i, litemp;
        refarray = getRelRefArray(pen, direction);
        if(refarray) {
            if(refarray.length > 0) {
                sortRelRefsByPenName(refarray, direction);
                for(i = 0; i < refarray.length && i < maxpgdisp; i += 1) {
                    placeholder = jt.tac2html(
                        ["li", "Fetching pen names (" + i + " out of " + 
                         refarray.length + ")..."]);
                    litemp = relRefPenHTML(refarray[i], direction, placeholder);
                    relitems.push(litemp);
                    if(litemp === placeholder) {
                        break; } }
                if(i === refarray.length) {
                    relitems.push(app.rel.findPenNamesHTML()); } }
            else if(refarray.length === 0) {
                if(direction === "outbound") {
                    relitems.push(["li", "Not following anyone."]);
                    if(jt.instId(pen) === app.pen.currPenId()) {  //own profile
                        relitems.push(["li", 
                                       app.activity.searchPensLinkHTML()]); } }
                else { //inbound
                    relitems.push(["li", noFollowersHTML(pen)]); } } }
        else {  //dump an interim status while retrieving rels
            relitems.push(["li", "Fetching relationships..."]); }
        html = [["div", {id: "relctrlsdiv"},
                 relListCtrlsHTML(pen, direction, divid, refarray)],
                ["ul", {cla: "penlist"}, 
                 relitems]];
        jt.out(divid, jt.tac2html(html));
        if(!refarray) {  //rels not loaded yet, init and fetch.
            app.rel.loadDisplayRels(pen, direction, function () {
                app.rel.displayRelations(pen, direction, divid); }); }
        else if(litemp === placeholder) {
            loadReferencedPens(refarray[i], function () {
                app.rel.displayRelations(pen, direction, divid); }); }
        positionFollowControls();
    },


    followBack: function (followerid) {
        app.pen.getPen(function (homepen) {
            app.lcs.getFull("pen", followerid, function (penref) {
                createOrEditRelationship(homepen, penref.pen); }); });
    },


    relsLoaded: function () {
        return asyncLoadStarted && !loadoutcursor;
    },


    toggleNoRevHide: function (direction, divid) {
        if(direction === 'outbound') {
            hideNoRevOutbound = !hideNoRevOutbound; }
        else {  //direction === 'inbound'
            hideNoRevInbound = !hideNoRevInbound; }
        app.rel.displayRelations(app.profile.getProfilePenReference().pen, 
                                 direction, divid);
    },


    editreq: function (toid, reqid) {
        var selfref = app.pen.currPenRef(), outreq, i;
        if(reqid) {
            for(i = 0; i < selfref.outreqs.length; i += 1) {
                if(jt.instId(selfref.outreqs[i]) === reqid) {
                    outreq = selfref.outreqs[i];
                    break; } } }
        if(!outreq) {
            outreq = { fromid: selfref.penid,
                       toid: toid,
                       qtype: "review",
                       modified: new Date().toISOString(),
                       status: "open" }; }
        //make a copy for editing
        dlgreq = { fromid: outreq.fromid,
                   toid: outreq.toid,
                   qtype: outreq.qtype,
                   revtype: outreq.revtype,
                   keywords: outreq.keywords,
                   modified: outreq.modified,
                   status: outreq.status };
        jt.setInstId(dlgreq, jt.instId(outreq));
        displayRequestDialog();
    },


    reqdlgseltype: function (revtype) {
        if(dlgreq.revtype === revtype) {  //toggle off
            dlgreq.revtype = ""; }
        else { 
            dlgreq.revtype = revtype;
            dlgreq.keywords = ""; }
        displayRequestDialog();
    },


    toggleReqKeyword: function (kwid) {
        var text = dlgreq.keywords;
        text = app.review.keywordcsv(kwid, text);
        dlgreq.keywords = text;
    },


    withdrawRequest: function () {
        jt.out('requestbuttonsdiv', "Deleting request...");
        dlgreq.status = "withdrawn";
        writeRequestToServer();
    },


    saveRequest: function () {
        jt.out('requestbuttonsdiv', "Saving...");
        writeRequestToServer();
    },


    findPenNamesHTML: function (preftxt) {
        var html;
        if(!preftxt) {
            preftxt = ""; }
        html = ["div", {id: "srchpenslinkdiv"},
                [["div", {cla: "smalltext"},
                  preftxt],
                 ["a", {id: "srchpens", href: "#findpens",
                        onclick: jt.fs("app.activity.penNameSearchDialog()")},
                  [["img", {cla: "reviewbadge", src: "img/follow.png"}],
                   "Find pen names to follow"]]]];
        return jt.tac2html(html);
    }


}; //end of returned functions
}());

