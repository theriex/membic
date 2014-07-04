/*global setTimeout: false, window: false, document: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.revresp = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var greytxt = "#999999",
        correspcheck = 0,
        abcontf = null,
        pollcount = 0,
        polltimer = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayCorrespondingReviewInfo = function (pen, review) {
        var html, imghtml, msghtml = "Your review";
        if(!jt.byId('respondbutton')) {
            return; }
        if(review) {
            setTimeout(function () {
                app.lcs.verifyCorrespondingLinks(review, 
                                                 app.review.getCurrentReview());
            }, 100);
            imghtml = app.review.starsImageHTML(review);
            msghtml = "Your review: " + imghtml; }
        html = jt.imgntxt("writereview.png", msghtml,
                           "app.revresp.respond()", "#respond",
                           "Edit your corresponding review", 
                           "respico", "respond");
        jt.out('respondbutton', html);
    },


    //Using the cankey, look up this pen's corresponding review and
    //call the continuation function with found instance, or null if
    //no matching review was found.
    //
    //Looking up by cankey is not infallible.  If the original review
    //has typos in the identifying field, and the user corrects these
    //when editing, then the corrected version might not be found.
    //The cankey is used so if the user sees multiple reviews from
    //multiple sources, they can get to their own review of the same
    //thing fairly reliably.  Seems the best option.
    //
    //Retrieving the response review is pretty much always a server
    //call, but if the response review is part of the top20s and was
    //already instantiated, then that instance is used and written
    //through on save. 
    findCorrespondingReview = function (homepen, contfunc, cacheonly) {
        var params, i, t20, crev, revref, elems, revid, penid;
        crev = app.review.getCurrentReview();
        revref = app.lcs.getRef("rev", crev);
        if(revref && revref.revlink && revref.revlink.corresponding) {
            elems = revref.revlink.corresponding.split(",");
            for(i = 0; i < elems.length; i += 1) {
                revid = elems[i].split(":");
                penid = revid[1];
                revid = revid[0];
                if(penid === jt.instId(homepen)) {
                    revref = app.lcs.getRef("rev", revid);
                    if(revref.rev) {
                        return contfunc(homepen, revref.rev); } } } }
        if(homepen.top20s) {
            t20 = homepen.top20s[app.review.getCurrentReview().revtype];
            if(t20 && t20.length) {
                for(i = 0; i < t20.length; i += 1) {
                    if(t20[i].cankey === crev.cankey && 
                       t20[i].revtype === crev.revtype) {
                        return contfunc(homepen, t20[i]); } } } }
        if(cacheonly) {
            return contfunc(homepen, null); }
        params = "penid=" + jt.instId(homepen) + 
            "&revtype=" + crev.revtype + "&cankey=" + crev.cankey +
            "&" + app.login.authparams();
        jt.call('GET', "revbykey?" + params, null,
                 function (revs) {
                     var rev = null;
                     if(revs.length > 0) {
                         rev = revs[0]; }
                     contfunc(homepen, rev); },
                 app.failf(function (code, errtxt) {
                     jt.err("findCorrespondingReview failed " + code + 
                             " " + errtxt); }),
                jt.semaphore("revresp.findCorrespondingReview"));
    },


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given corresponding review.
    copyAndEditCorresponding = function (pen, review) {
        var crev = app.review.getCurrentReview();
        if(!review) {
            review = {};
            review.srcrev = jt.instId(crev);
            review.penid = jt.instId(pen);
            review.revtype = crev.revtype;
            review.rating = crev.rating;  //initial value required..
            review.cankey = crev.cankey; }
        //Fill in any empty descriptive fields
        if(crev.imguri && !review.imguri && !review.revpic) {
            review.imguri = crev.imguri; }
        if(crev.revpic && !review.imguri && !review.revpic) {
            review.imguri = "revpic?revid=" + jt.instId(crev); }
        if(crev.name && !review.name) {
            review.name = crev.name; }
        if(crev.title && !review.title) {
            review.title = crev.title; }
        if(crev.url && !review.url) {
            review.url = crev.url; }
        if(crev.artist && !review.artist) {
            review.artist = crev.artist; }
        if(crev.author && !review.author) {
            review.author = crev.author; }
        if(crev.publisher && !review.publisher) {
            review.publisher = crev.publisher; }
        if(crev.album && !review.album) {
            review.album = crev.album; }
        if(crev.starring && !review.starring) {
            review.starring = crev.starring; }
        if(crev.address && !review.address) {
            review.address = crev.address; }
        if(crev.year && !review.year) {
            review.year = crev.year; }
        app.review.setCurrentReview(review);
        app.review.display();
    },


    isHelpful = function (revtag) {
        if(revtag && revtag.helpful && !revtag.nothelpful) {
            return true; }
        return false;
    },


    initHelpfulButtonSetting = function (penref, review) {
        if(penref.helpful) {  //local data initialized
            if(app.revresp.foundHelpful(jt.instId(review), penref)) {
                app.revresp.toggleHelpfulButton("set"); } }
        else {  //penref.helpful not defined yet. init from db and retry
            app.revresp.loadHelpful(function () {
                initHelpfulButtonSetting(penref, review); }, penref); }
    },


    isRemembered = function (revtag) {
        if(revtag && revtag.remembered && !revtag.forgotten) {
            return true; }
        return false;
    },


    initMemoButtonSetting = function (penref, review) {
        var i, revid, params;
        if(penref.remembered) {  //local data initialized
            revid = jt.instId(review);
            for(i = 0; i < penref.remembered.length; i += 1) {
                if(penref.remembered[i].revid === revid &&
                   isRemembered(penref.remembered[i])) {
                    app.revresp.toggleMemoButton("set");
                    break; } } }
        else { //penref.remembered not defined yet. init from db and retry
            params = "penid=" + jt.instId(penref.pen) +
                "&" + app.login.authparams();
            jt.call('GET', "srchremem?" + params, null,
                    function (memos) {
                        penref.remembered = memos;
                        initMemoButtonSetting(penref, review); },
                    app.failf(function (code, errtxt) {
                        jt.err("initMemoButtonSetting failed " + code +
                               " " + errtxt); }),
                    jt.semaphore("revresp.initMemoButtonSetting")); }
    },


    execIfMutuallyFollowing = function (execfunc) {
        var review, penref, i, following;
        review = app.review.getCurrentReview();
        penref = app.pen.currPenRef();
        //outbound relationships are loaded already so just walk them
        for(i = 0; i < penref.outrels.length; i += 1) {
            if(penref.outrels[i].rel.relatedid === review.penid) {
                following = true;
                break; } }
        if(following) {  //see if they are following back
            app.rel.loadDisplayRels(penref.pen, "inbound", function (rels) {
                for(i = 0; i < rels.length; i += 1) {
                    if(rels[i].rel.originid === review.penid) {
                        return execfunc(); } } }); }
    },


    disableQuestionButton = function () {
        var img, txt;
        if(jt.byId('questionbutton')) {
            img = jt.byId('questionimg');
            if(img) {
                img.className = "respicodis"; }
            txt = jt.byId('questiontxttd');
            if(txt) {
                txt.style.color = greytxt; } }
    },


    testEnableQuestionButton = function () {
        disableQuestionButton();
        execIfMutuallyFollowing(function () {
            var penref, img, txt;
            penref = app.pen.currPenRef();
            //if they have pending or rejected comments, those need to
            //be deleted before any more can be added.
            if(!penref.qcmts || penref.qcmts.length === 0) { 
                img = jt.byId('questionimg');
                if(img) {
                    img.className = "respico"; }
                txt = jt.byId('questiontxttd');
                if(txt) {
                    txt.style.color = app.colors.text; } } });
    },


    disableCommentButton = function () {
        var img, txt;
        if(jt.byId('commentbutton')) {
            img = jt.byId('commentimg');
            if(img) {
                img.className = "respicodis"; }
            txt = jt.byId('commenttxttd');
            if(txt) {
                txt.style.color = greytxt; } }
    },


    haveOpenComment = function () {
        var rev, penref, revid, i, qcmt;
        rev = app.review.getCurrentReview();
        penref = app.pen.currPenRef();
        if(!penref.qcmts) {
            return false; }
        revid = jt.instId(rev);
        for(i = 0; i < penref.qcmts.length; i += 1) {
            qcmt = penref.qcmts[i];
            if(qcmt.revid === revid && qcmt.rcstat !== "accepted") {
                return true; } }
        return false;
    },


    testEnableCommentButton = function () {
        var now = new Date().getTime();
        if(now - correspcheck < 9000) {
            return; }  //don't pound the db for no reason
        correspcheck = now;
        disableCommentButton();
        findCorrespondingReview(app.pen.currPenRef().pen, function (pen, rev) {
            var img, txt;
            if(!rev) {  //no corresponding review, leave disabled
                return; }
            //Open comments are displayed already, and need to be accepted
            //or deleted before adding more.
            if(!haveOpenComment()) {
                img = jt.byId('commentimg');
                if(img) {
                    img.className = "respico"; }
                txt = jt.byId('commenttxttd');
                if(txt) {
                    txt.style.color = app.colors.text; } } });
    },


    penlinksHTML = function (pencsv, redrawfunc, title) {
        var html = "", penids, selfidstr, i, penref, penlinks = [], 
            max = 20, slop = 3;
        selfidstr = String(jt.instId(app.pen.currPenRef().pen));
        penids = pencsv.split(",");
        //start with "You" if applicable
        for(i = 0; i < penids.length; i += 1) {
            if(penids[i] === selfidstr) {
                penlinks.push("You");
                break; } }
        for(i = 0; i < penids.length; i += 1) {
            penref = app.lcs.getRef("pen", penids[i]);
            if(penref.status === "not cached") {
                app.lcs.getFull("pen", penids[i], redrawfunc);
                break; }
            if(penref.pen && String(penref.penid) !== selfidstr) {
                html = ["a", {href: "#" + jt.ndq(penref.pen.name),
                              onclick: jt.fs("app.profile.byprofid('" +
                                             penref.penid + "')"),
                              title: title.replace("$Name", 
                                                   jt.ndq(penref.pen.name))},
                        penref.pen.name];
                html = jt.tac2html(html);
                penlinks.push(html);
                if(penlinks.length > max && (penids.length - max) > slop) {
                    penlinks.push(String(penids.length - max) + " others");
                    break; } } }
        if(penlinks.length > 0) {
            html = "";
            for(i = 0; i < penlinks.length; i += 1) {
                if(html && i === penlinks.length - 1) {
                    html += " and "; }
                else if(html) {
                    html += ", "; }
                html += penlinks[i]; }
            html += title.replace("$Name", ""); }
        return html;
    },


    //return a good width for a text entry area
    textTargetWidth = function () {
        var targetwidth = Math.max((app.winw - 400), 200);
        targetwidth = Math.min(targetwidth, 750);
        return targetwidth;
    },


    crevlink = function () {
        return app.lcs.getRef("rev", app.review.getCurrentReview()).revlink;
    },


    taStyle = function () {
        var lightbg, tas;
        lightbg = app.skinner.lightbg();
        tas = "color:" + app.colors.text + ";" + "width:" + 
            textTargetWidth() + "px;" + "height:50px;padding:5px 8px;" +
            "background-color:" + lightbg + ";background-color:rgba(" +
            jt.hex2rgb(lightbg) + ",0.6);";
        return tas;
    },


    questionButtonsHTML = function () {
        var html;
        html = [["button", {type: "button", id: "cmtcancelb",
                            onclick: jt.fs("app.layout.closeDialog()")},
                 "Cancel"],
                "&nbsp;",
                ["button", {type: "button", id: "cmtokb",
                            onclick: jt.fs("app.revresp.createcomment('" +
                                           "question')")},
                 "Ask"]];
        return jt.tac2html(html);
    },


    commentButtonsHTML = function () {
        var html;
        html = [["button", {type: "button", id: "cmtcancelb",
                            onclick: jt.fs("app.layout.closeDialog()")},
                 "Cancel"],
                "&nbsp;",
                ["button", {type: "button", id: "cmtokb",
                            onclick: jt.fs("app.revresp.createcomment('" +
                                           "comment')")},
                 "Comment"]];
        return jt.tac2html(html);
    },


    topacceptButtonsHTML = function (qcid) {
        var html;
        html = [["button", {type: "button", id: "cmtcancelb",
                            onclick: jt.fs("app.revresp.handlePendingQC('" + 
                                           qcid + "')")},
                 "Cancel"],
                "&nbsp;",
                ["button", {type: "button", id: "acceptb",
                            onclick: jt.fs("app.revresp.topacceptConfirmed('" +
                                           qcid + "')")},
                 "Accept"]];
        return jt.tac2html(html);
    },


    topignoreButtonsHTML = function (qcid) {
        var html;
        html = [["button", {type: "button", id: "cmtcancelb",
                            onclick: jt.fs("app.revresp.handlePendingQC('" +
                                           qcid + "')")},
                 "Cancel"],
                "&nbsp;",
                ["button", {type: "button", id: "ignoreb",
                            onclick: jt.fs("app.revresp.topignoreConfirmed('" +
                                           qcid + "')")},
                 "Ignore Forever"]];
        return jt.tac2html(html);
    },


    toprejectButtonsHTML = function (qcid) {
        var html, cbharass;
        html = [["button", {type: "button", id: "cmtcancelb",
                            onclick: jt.fs("app.revresp.handlePendingQC('" +
                                           qcid + "')")},
                 "Cancel"],
                "&nbsp;"];
        cbharass = jt.byId('cbharass');
        if(cbharass && cbharass.checked) {
            html.push(
                ["button", {type: "button", id: "rejectb",
                            onclick: jt.fs("app.revresp.reportAbuse('" +
                                           qcid + "')")},
                 "Report Harassment"]); }
        else {
            html.push(
                ["button", {type: "button", id: "rejectb",
                            onclick: jt.fs("app.revresp.toprejectConfirmed('" +
                                           qcid + "')")},
                 "Reject"]); }
        return jt.tac2html(html);
    },


    removePendingComment = function (qcid) {
        var qcs, qc, i, index;
        qcs = app.pen.currPenRef().pendqcs;
        for(i = 0; i < qcs.length; i += 1) {
            if(jt.instId(qcs[i]) === qcid) {
                qc = qcs[i];
                index = i;
                break; } }
        if(qc) {
            qcs.splice(index, 1); }
    },


    helpfulRowHTML = function (redrawfunc) {
        var html = "", pencsv;
        pencsv = crevlink().helpful;
        if(pencsv) {
            html = ["tr",
                    [["td", {cla:"respcol", align:"right"},
                      ["img", {src:"img/helpful.png",
                               style:"width:25px;height:22px"}]],
                     ["td", {cla:"respval", colspan: 2},
                      penlinksHTML(pencsv, redrawfunc,
                                   "$Name found this review helpful")]]]; }
        return html;
    },


    rememberedRowHTML = function (redrawfunc) {
        var html = "", pencsv;
        pencsv = crevlink().remembered;
        if(pencsv) {
            html = ["tr",
                    [["td", {cla:"respcol", align:"right"},
                      ["img", {src:"img/remembered.png",
                               style:"width:25px;height:22px"}]],
                     ["td", {cla:"respval", colspan: 2},
                      penlinksHTML(pencsv, redrawfunc,
                                   "$Name remembered this review")]]]; }
        return html;
    },


    commentDeleteHTML = function (revcmt) {
        var penid, rcid;
        penid = app.pen.currPenRef().penid;
        if(penid !== revcmt.cmtpenid) {
            return ""; }
        rcid = jt.instId(revcmt);
        return ["a", {cla: "cmtdelex", id: "rcx" + rcid, href: "#delete",
                      onclick: jt.fs("app.revresp.deleterevcmt('" +
                                     rcid + "')")},
                "(x)&nbsp;"];
    },


    miniProfPicHTML = function (penref) {
        var html = "";
        if(penref.pen.profpic) {
            html = ["img", {src: "profpic?profileid=" + jt.instId(penref.pen),
                            cla: "srchpic"}]; }
        return html;
    },


    commentText = function (qcmt, acceptable) {
        var html = jt.ellipsis(qcmt.comment, 255);
        if(acceptable) {
            html = ["a", {href: "#rejectoraccept",
                          onclick: jt.fs("app.revresp.handlePendingQC('" +
                                         jt.instId(qcmt) + "')")},
                    html];
            html = jt.tac2html(html); }
        return html;
    },


    isAbusivePen = function (penid) {
        var abcsv, abpens, i;
        abcsv = app.pen.currPenRef().pen.abusive;
        if(abcsv) {
            abpens = abcsv.split(",");
            for(i = 0; i < abpens.length; i += 1) {
                if(abpens[i] === penid) {
                    return true; } } }
        return false;
    },


    appendReviewComment = function (rows, qcmt, acceptable, penref) {
        var resptxt, revref;
        switch(qcmt.rcstat) {
        case "accepted": resptxt = ""; break;
        case "rejected": resptxt = "Rejected: "; break;
        default: resptxt = "Pending..."; }
        resptxt += qcmt.resp;
        rows.push(
            ["tr",
             [["td", {cla:"respcol", align:"right"},
               [commentDeleteHTML(qcmt),
                miniProfPicHTML(penref),
                ["span", {cla: "qcaspan"},
                 (qcmt.rctype === "question" ? "Q" : "C")]]],
              ["td", {cla:"respval", align:"right", valign:"top"},
               ["a", {href: "#" + jt.ndq(penref.pen.name),
                      onclick: jt.fs("app.profile.byprofid('" +
                                     qcmt.cmtpenid + "')")},
                penref.pen.name]],
              ["td", {cla:"respval", align:"left", valign:"top"},
               commentText(qcmt, acceptable)]]]);
        if(resptxt) {
            revref = app.lcs.getRef("rev", app.review.getCurrentReview());
            penref = app.lcs.getRef("pen", revref.rev.penid);
            rows.push(
                ["tr",
                 [["td", {cla:"respcol", align:"right"},
                   [miniProfPicHTML(penref),
                    ["span", {cla: "qcaspan"},
                     "A"]]],
                  ["td"],
                  ["td", {cla:"respval", align:"left", valign:"top"},
                   resptxt]]]); }
    },


    appendReviewComments = function (rows, qcmts, redrawfunc, acceptable) {
        var revid, i, qcmt, penref;
        revid = jt.instId(app.review.getCurrentReview());
        for(i = 0; i < qcmts.length; i += 1) {
            qcmt = qcmts[i];
            if(qcmt.revid === revid && !isAbusivePen(qcmt.cmtpenid)) {
                penref = app.lcs.getRef("pen", qcmt.cmtpenid);
                if(penref.status === "not cached") {
                    app.lcs.getFull("pen", qcmt.cmtpenid, redrawfunc);
                    break; }
                if(penref.pen) {
                    appendReviewComment(rows, qcmt, acceptable, penref); } } }
        return rows;
    },


    queryAndCommentRowsHTML = function (redrawfunc) {
        var penref, revref, rows = [], params;
        penref = app.pen.currPenRef();
        if(penref.pendqcs) {  //loaded by activity display
            appendReviewComments(rows, penref.pendqcs, redrawfunc, true); }
        if(!penref.qcmts) {
            params = "penid=" + penref.penid + "&" + app.login.authparams();
            penref.qcmts = [];  //if call crashes hard, don't loop
            jt.call('GET', "pendoutcmt?" + params, null,
                    function (revcmts) {
                        penref.qcmts = revcmts;
                        redrawfunc(); },  //calls back to here for output...
                    app.failf(function (code, errtxt) {
                        jt.err("Pending comment retrieval failed " + code +
                               " " + errtxt); }),
                    jt.semaphore("revresp.queryAndCommentRowsHTML")); }
        else {  //have penref.qcmts
            appendReviewComments(rows, penref.qcmts, redrawfunc);
            revref = app.lcs.getRef("rev", app.review.getCurrentReview());
            if(!revref.qcmts) {
                params = "revid=" + revref.revid + "&" + app.login.authparams();
                revref.qcmts = [];  //if call crashes hard, don't loop
                jt.call('GET', "revcmt?" + params, null,
                        function (revcmts) {
                            revref.qcmts = revcmts;
                            redrawfunc(); },
                        app.failf(function (code, errtxt) {
                            jt.err("Review comment retrieval failed: " + code +
                                   " " + errtxt); }),
                        jt.semaphore("revresp.queryAndCommentRowsHTML")); }
            else {  //have revref.qcmts
                appendReviewComments(rows, revref.qcmts, redrawfunc); } }
        return rows;
    },
                
            

    commenterNameHTML = function (qcmt) {
        var penref, html = [];
        penref = app.lcs.getRef("pen", qcmt.cmtpenid);
        if(penref.pen) {
            if(penref.pen.profpic) {
                html.push(["img", {cla: "smallbadge",
                                   src: "profpic?profileid=" + penref.penid}]);
                html.push("&nbsp;"); }
            html.push(penref.pen.name); }
        return jt.tac2html(html);
    },


    pendingCommentsLoadedHTML = function () {
        var qcs, i, penref, nametxt, linktxt, rows = [], html = "";
        qcs = app.pen.currPenRef().pendqcs;
        for(i = 0; i < qcs.length; i += 1) {
            if(!isAbusivePen(qcs[i].cmtpenid)) {
                nametxt = "";
                penref = app.lcs.getRef("pen", qcs[i].cmtpenid);
                if(penref.pen) {
                    nametxt = " from " + commenterNameHTML(qcs[i]); }
                else if(penref.status === "not cached") {
                    app.lcs.getFull("pen", qcs[i].cmtpenid, 
                                       app.revresp.redrawPendingComments); }
                linktxt = qcs[i].rctype.capitalize() + nametxt + ": " + 
                    qcs[i].comment;
                rows.push(["li", {cla: "cmtli"},
                           ["a", {href: "#" + qcs[i].rctype,
                                  title: "Accept or reject this " + 
                                         qcs[i].rctype,
                                  onclick: jt.fs("app.revresp.initPendingQC('" +
                                                 jt.instId(qcs[i]) + "')")},
                            linktxt]]); } }
        if(rows.length > 0) {
            html = ["ul", {cla: "cmtlist"},
                    rows]; }
        return jt.tac2html(html);
    },


    findPendingComment = function (qcid) {
        var qcs, i;
        qcs = app.pen.currPenRef().pendqcs;
        for(i = 0; i < qcs.length; i += 1) {
            if(jt.instId(qcs[i]) === qcid) {
                return qcs[i]; } }
        return null;
    },


    displayQCDialog = function (bid, dismsg, bhtmlf) {
        var img, html, visf = null, crev, revpen;
        img = jt.byId(bid + "img");
        if(!img) {  //button not displayed, spurious call
            return; }
        crev = app.review.getCurrentReview();
        revpen = app.lcs.getRef("pen", crev.penid).pen;
        dismsg = dismsg.replace(/\$REVIEWER/g, revpen.name);
        dismsg = dismsg.replace(/\$REVTITLE/g, crev.title || crev.name);
        if(img.className === "respicodis") {
            html = ["div", {cla: "commentdiv"},
                    [["div", {cla: "commentform", 
                              style: "width:" + textTargetWidth() + "px;"},
                      dismsg],
                     ["div", {id: "requestbuttonsdiv"},
                      ["button", {type: "button", id: "niokb",
                                  onclick: jt.fs("app.layout.closeDialog()")},
                       "OK"]]]];
            visf = function () {
                jt.byId('niokb').focus(); }; }
        else {
            html = ["div", {cla: "commentdiv"},
                    [["div", {cla: "commentform"},
                      ["Your " + bid + " for " + revpen.name,
                       ["br"],
                       ["textarea", {id: "cmtta", style: taStyle()},
                        ""]]],
                     ["div", {id: "cmterrdiv"}, ""],
                     ["div", {id: "requestbuttonsdiv"},
                      bhtmlf()]]];
            visf = function () {
                jt.byId('cmtta').focus(); }; }
        html = app.layout.dlgwrapHTML(bid.capitalize(), html);
        app.layout.openDialog({x:200, y:370}, jt.tac2html(html), null, visf);
    },


    correspRevHTML = function (penref, revref) {
        var pname = penref.pen.name;
        if(penref.penid === app.pen.currPenId()) {
            pname = "you"; }
        return ["tr",
                [["td", {cla:"respcol", align:"left"},
                  app.review.starsImageHTML(revref.rev)],
                 ["td", {cla:"respval", valign:"top", align:"right"},
                  ["a", {href: "#" + jt.ndq(penref.pen.name),
                         onclick: jt.fs("app.profile.readReview('" +
                                        revref.revid + "')")},
                   pname]],
                 ["td", {cla:"respval", valign:"top", align:"left"},
                  jt.ellipsis(revref.rev.text, 255)]]];
    },


    updateCorrespondingReviewButton = function (cacheonly) {
        app.pen.getPen(function (homepen) {
            findCorrespondingReview(homepen, 
                                    displayCorrespondingReviewInfo,
                                    cacheonly); }); 
    },


    correspondingReviewsHTML = function (redrawfunc) {
        var rows = [], csv, elems, i, penid, revid, penref, revref, cb;
        csv = crevlink().corresponding;
        if(csv) {
            elems = csv.split(",");
            for(i = 0; i < elems.length; i += 1) {
                revid = elems[i].split(":");
                penid = revid[1];
                revid = revid[0];
                if(!isAbusivePen(penid)) {
                    penref = app.lcs.getRef("pen", penid);
                    if(penref.status === "not cached") {
                        app.lcs.getFull("pen", penid, redrawfunc);
                        cb = true;
                        break; }
                    revref = app.lcs.getRef("rev", revid);
                    if(revref.status === "not cached") {
                        app.lcs.getFull("rev", revid, redrawfunc);
                        cb = true;
                        break; }
                    if(penref.pen && revref.rev) {
                        rows.push(correspRevHTML(penref, revref)); } } } }
        if(!cb) {
            updateCorrespondingReviewButton(true); }
        return rows;
    },


    displayReviewResponses = function () {
        var revref, html;
        revref = app.lcs.getRef("rev", app.review.getCurrentReview());
        if(!revref.revlink) {
            return app.lcs.verifyReviewLinks(displayReviewResponses); }
        html = ["table",
                [helpfulRowHTML(displayReviewResponses),
                 rememberedRowHTML(displayReviewResponses),
                 queryAndCommentRowsHTML(displayReviewResponses),
                 correspondingReviewsHTML(displayReviewResponses)]];
        jt.out('revcommentsdiv', jt.tac2html(html));
        testEnableQuestionButton();
        correspcheck = 0;
        testEnableCommentButton();
        if(pollcount && !polltimer) {
            polltimer = setTimeout(function () {
                jt.log("revresp polling for changes, pollcount: " + pollcount);
                polltimer = null;
                pollcount -= 1;
                displayReviewResponses(); }, 2400); }
    },


    updateCachedReviewTags = function (field, updrevtags) {
        var revtag, revlink, i, penref, revtagid, replaced;
        revtag = updrevtags[0];
        revlink = updrevtags[1];
        revtagid = jt.instId(revtag);
        penref = app.pen.currPenRef();
        if(!penref[field]) {
            penref[field] = [revtag]; }
        else {
            for(i = 0; i < penref[field].length; i += 1) {
                if(jt.instId(penref[field][i]) === revtagid) {
                    penref[field][i] = revtag;
                    replaced = true; } }
            if(!replaced) {  //must prepend if remembered
                penref[field].unshift(revtag); } }
        if(field === "remembered") {
            //ensure helpful marks for anything remembered are found
            updateCachedReviewTags('helpful', updrevtags); }
        app.lcs.getRef("rev", revtag.revid).revlink = revlink;
        setTimeout(displayReviewResponses, 50);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    respond: function () {
        jt.byId('respondtxttd').style.color = greytxt;
        app.layout.closeDialog(); //close dialog if open
        setTimeout(function () {
            app.pen.getPen(function (pen) {
                findCorrespondingReview(pen, copyAndEditCorresponding); }); },
                   50);
    },


    searchCorresponding: function (val) {
        var html, correspsrch;
        correspsrch = {
            inputId: "searchtxt",
            outdivId: "csrchresdiv",
            revrendf: function (state, type, review) {
                return jt.tac2html(
                    ["li",
                     ["a", {href: "#" + jt.instId(review),
                            title: "Select corresponding review",
                            onclick: jt.fs("app.revresp.selcorresp('" +
                                           jt.instId(review) + "')") },
                      app.profile.reviewItemNameHTML(type, review)]]); },
            revtype: app.review.getCurrentReview().revtype,
            srchval: val || "" };
        html = ["div", {id: "csrchcontentdiv"},
                 [["div", {id: "csrchindiv"},
                   ["input", {type: "text", id: correspsrch.inputId, size: "40",
                              placeholder: "Review title or name",
                              value: correspsrch.srchval}]],
                  ["div", {id: correspsrch.outdivId}]]];
        html = app.layout.dlgwrapHTML("Find your corresponding review", html);
        app.layout.openDialog({x:200, y:370}, jt.tac2html(html), null,
                              function () {
                                  jt.byId(correspsrch.inputId).focus(); });
        app.profile.revsearch(correspsrch);
    },


    selcorresp: function (revid) {
        var crev, theirrev, ourrev, type, html;
        crev = app.review.getCurrentReview();
        theirrev = app.lcs.getRef("rev", crev.srcrev).rev;
        ourrev = app.lcs.getRef("rev", revid).rev;
        type = app.review.getReviewTypeByValue(crev.revtype);
        html = [["div", {id: "csrchconfirmdiv"},
                 ["Which " + type.key + " should be used for your review?",
                  ["ul", {cla: "reqlist"},
                   [["li", jt.checkrad("radio", "tgrp", 
                                       jt.instId(theirrev),
                                       app.profile.reviewItemNameHTML(
                                           type, theirrev),
                                       false)],
                    ["li", jt.checkrad("radio", "tgrp",
                                       jt.instId(ourrev),
                                       app.profile.reviewItemNameHTML(
                                           type, ourrev),
                                       true)]]]]],
                ["div", {id: "csrchbuttonsdiv"},
                 [["button", {type: "button", id: "cancelb",
                              onclick: jt.fs("app.profile.revsearch()")},
                   "Cancel"],
                  "&nbsp;",
                  ["button", {type: "button", id: "confirmb",
                              onclick: jt.fs("app.revresp.confirmcorresp('" +
                                             revid + "')")},
                   "OK"]]]];
        jt.out('csrchcontentdiv', jt.tac2html(html));
    },


    confirmcorresp: function (revid) {
        var crev, theirrev, ourrev, type, radios, i;
        crev = app.review.getCurrentReview();
        theirrev = app.lcs.getRef("rev", crev.srcrev).rev;
        ourrev = app.lcs.getRef("rev", revid).rev;
        type = app.review.getReviewTypeByValue(crev.revtype);
        app.review.setCurrentReview(ourrev);
        radios = document.getElementsByName("tgrp");
        for(i = 0; i < radios.length; i += 1) {
            if(radios[i].checked) {
                if(radios[i].value === jt.instId(theirrev)) {
                    jt.out('csrchbuttonsdiv', "Updating " + type.key + "...");
                    ourrev[type.key] = theirrev[type.key];
                    if(type.subkey) {
                        ourrev[type.subkey] = theirrev[type.subkey]; }
                    ourrev.cankey = theirrev.cankey;
                    break; }
                if(radios[i].value === jt.instId(ourrev)) {
                    jt.out('csrchbuttonsdiv', "Adding corresponding links...");
                    ourrev.altkeys = ourrev.altkeys || "";
                    if(ourrev.altkeys) {
                        ourrev.altkeys += ","; }
                    ourrev.altkeys += theirrev.cankey;
                    break; } } }
        app.review.displayRead();  //show review, no form input
        app.layout.closeDialog();
        app.review.save(true, "", true);
    },


    toggleMemoButton: function (value) {
        var img, tbl, data;
        img = jt.byId('memoimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = jt.byId('memotable');
        if(value === "set") {  //just initializing the display
            img.src = "img/remembered.png";
            tbl.title = "Remove from your remembered reviews";
            return; }
        img.className = "respicodis";  //grey out the image
        value = (img.src.indexOf("remembered.png") > 0)? "no" : "yes"; //toggle
        data = "penid=" + jt.instId(app.pen.currPenRef().pen) +
            "&revid=" + jt.instId(app.review.getCurrentReview()) +
            "&remember=" + value;
        jt.call('POST', "noteremem?" + app.login.authparams(), data,
                function (updatedrevtags) {  //revtag, revlink
                    updateCachedReviewTags('remembered', updatedrevtags);
                    if(isRemembered(updatedrevtags[0])) {
                        img.src = "img/remembered.png";
                        tbl.title = "Remove from your remembered reviews"; }
                    else {
                        img.src = "img/rememberq.png";
                        tbl.title = "Add to your remembered reviews"; }
                    img.className = "respico"; },  //ungrey the image
                app.failf(function (code, errtxt) {
                    jt.err("toggleMemoButton failed " + code +
                           " " + errtxt); }),
                jt.semaphore("revresp.toggleMemoButton"));
    },


    toggleHelpfulButton: function (value) {
        var img, tbl, data;
        img = jt.byId('helpfulimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = jt.byId('helpfultable');
        if(value === "set") {  //just initializing the display
            img.src = "img/helpful.png";
            tbl.title = "Remove mark as helpful";
            return; }
        img.className = "respicodis";  //grey out the image
        value = (img.src.indexOf("helpful.png") > 0)? "no" : "yes";  //toggle
        data = "penid=" + jt.instId(app.pen.currPenRef().pen) +
            "&revid=" + jt.instId(app.review.getCurrentReview()) +
            "&helpful=" + value;
        jt.call('POST', "notehelpful?" + app.login.authparams(), data,
                function (updatedrevtags) {  //revtag, revlink
                    updateCachedReviewTags('helpful', updatedrevtags);
                    if(isHelpful(updatedrevtags[0])) {
                        img.src = "img/helpful.png";
                        tbl.title = "Remove mark as helpful"; }
                    else {
                        img.src = "img/helpfulq.png";
                        tbl.title = "Mark this review as helpful"; }
                    img.className = "respico"; },  //ungrey the image
                app.failf(function (code, errtxt) {
                    jt.err("toggleHelpfulButton failed " + code +
                           " " + errtxt); }),
                jt.semaphore("revresp.toggleHelpfulButton"));
    },


    question: function () {
        displayQCDialog(
            "question",
            "You must be following $REVIEWER, and $REVIEWER must be" + 
                " following you back before you can create a question." +
                " You can only have one pending question or comment" + 
                " open at a time.",
            questionButtonsHTML);
    },


    comment: function () {
        var errtxt = 
            "You must review $REVTITLE before commenting on this review.";
        if(haveOpenComment) {
            errtxt = "Your pending comment must be accepted or " +
                "deleted before writing another comment."; }
        displayQCDialog(
            "comment", errtxt, commentButtonsHTML);
    },


    createcomment: function (rctype) {
        var verb, text, crev, data;
        verb = (rctype === "question" ? "Asking" : "Writing");
        jt.out('requestbuttonsdiv', verb + "...");
        text = jt.byId('cmtta').value;
        crev = app.review.getCurrentReview();
        data = { revid: jt.instId(crev), 
                 revpenid: crev.penid,
                 cmtpenid: jt.instId(app.pen.currPenRef().pen),
                 rctype: rctype,
                 comment: text };
        data = jt.objdata(data);
        jt.call('POST', "crecmt?" + app.login.authparams(), data,
                function (updcmts) {  //returned comment rcstat: "pending"
                    app.pen.currPenRef().qcmts.push(updcmts[0]);
                    app.layout.closeDialog();
                    displayReviewResponses(); },
                app.failf(function (code, errtxt) {
                    jt.out('cmterrdiv', verb + " failed " + code + 
                           " " + errtxt);
                    jt.out('requestbuttonsdiv', 
                           (rctype === "question" ? questionButtonsHTML() :
                            commentButtonsHTML())); }),
                jt.semaphore("revresp.createComment"));
    },


    deleterevcmt: function (rcid) {
        var qcmts, index, rc = null, i, data;
        qcmts = app.pen.currPenRef().qcmts;
        for(i = 0; qcmts && i < qcmts.length; i += 1) {
            if(jt.instId(qcmts[i]) === rcid) {
                rc = qcmts[i];
                index = i;
                break; } }
        if(!rc) {
            qcmts = app.lcs.getRef("rev", app.review.getCurrentReview()).qcmts;
            for(i = 0; qcmts && i < qcmts.length; i += 1) {
                if(jt.instId(qcmts[i]) === rcid) {
                    rc = qcmts[i];
                    index = i;
                    break; } } }
        if(!rc) {
            jt.err("Could not find comment id " + rcid);
            return; }
        if(!window.confirm("Are you sure you want to delete this " + 
                           rc.rctype + "?")) {
            return; }
        jt.out("rcx" + rcid, "(&nbsp;)&nbsp;");
        data = jt.objdata(rc);
        jt.call('POST', "delcmt?" + app.login.authparams(), data,
                function () {
                    qcmts.splice(index, 1);
                    displayReviewResponses(); },
                app.failf(function (code, errtxt) {
                    jt.err("Delete failed " + code + " " + errtxt);
                    jt.out("rcx" + rcid, "(x)&nbsp;"); }),
                jt.semaphore("revresp.deleterevcmt"));
    },


    loadHelpful: function (callback, penref) {
        var params;
        if(!penref) {
            penref = app.pen.currPenRef(); }
        params = "penid=" + jt.instId(penref.pen) + 
            "&" + app.login.authparams();
        jt.call('GET', "srchhelpful?" + params, null,
                function (revtags) {
                    penref.helpful = revtags;
                    callback(); },
                app.failf(function (code, errtxt) {
                    jt.err("initHelpfulButtonSetting failed " + code +
                           " " + errtxt); }),
                jt.semaphore("revresp.loadHelpful"));
    },


    foundHelpful: function (revid, penref) {
        var i;
        if(!penref) {
            penref = app.pen.currPenRef(); }
        for(i = 0; penref.helpful && i < penref.helpful.length; i += 1) {
            if(penref.helpful[i].revid === revid && 
               isHelpful(penref.helpful[i])) {
                return true; } }
        return false;
    },


    respActionsHTML: function () {
        var html;
        html = ["div", {id: "socialrevactdiv"},
                ["table", {cla: "revdisptable"},
                 [["tr",
                   [["td", {align:"center"},
                     ["div", {id: "helpfulbutton", cla: "buttondiv"},
                      jt.imgntxt("helpfulq.png", "",  //Helpful
                                 "app.revresp.toggleHelpfulButton()", 
                                 "#helpful", 
                                 "Mark this review as helpful", 
                                 "respico", "helpful")]],
                    ["td", {align:"center"},
                     ["div", {id: "memobutton", cla: "buttondiv"},
                      jt.imgntxt("rememberq.png", "", //Remember
                                 "app.revresp.toggleMemoButton()", 
                                 "#memo", 
                                 "Add this to remembered reviews", 
                                 "respico", "memo")]]]],
                  ["tr",
                   ["td", {colspan: 2, align:"center"},
                    app.review.makeTransformLink(
                        "app.revresp.showResponseDialog()",
                        "Write your review, comment or question",
                        ["span", {id: "respondtextspan", 
                                  style: "font-size:large;"}, 
                         "Respond"], 
                        "Respond")]]]]];
        return html;
    },


    redrawPendingComments: function () {
        jt.out("pendingqcsdiv", pendingCommentsLoadedHTML());
    },
    pendingCommentsHTML: function () {
        var selfref, params, html = "";
        selfref = app.pen.currPenRef();
        if(!selfref.pendqcs) {
            params = "penid=" + selfref.penid + "&" + app.login.authparams();
            selfref.pendqcs = [];  //don't loop if GET crashes hard
            jt.call('GET', "pendincmt?" + params, null,
                    function (revcmts) {
                        selfref.pendqcs = revcmts;
                        jt.out("pendingqcsdiv", pendingCommentsLoadedHTML()); },
                    app.failf,
                    jt.semaphore("revresp.pendingCommentsHTML")); }
        else {
            html = pendingCommentsLoadedHTML(); }
        return html;
    },


    initPendingQC: function (qcid) {
        var qcmt = findPendingComment(qcid);
        if(qcmt) {
            app.lcs.getFull("rev", qcmt.revid, function (revref) {
                if(revref.rev) {
                    app.review.setCurrentReview(revref.rev);
                    app.review.displayRead();
                    app.revresp.handlePendingQC(qcid); } }); }
    },


    handlePendingQC: function (qcid) {
        var qcmt, html;
        qcmt = findPendingComment(qcid);
        html = ["div", {cla: "commentdiv"},
                [["div", {id: "formcontentdiv", cla: "commentform"},
                  ["p", {cla: "qctext"},
                   qcmt.comment]],
                 ["div", {id: "cmterrdiv"}, ""],
                 ["div", {id: "requestbuttonsdiv"},
                  [["button", {type: "button", id: "cmtcancelb",
                               onclick: jt.fs("app.layout.closeDialog()")},
                    "Cancel"],
                   "&nbsp;",
                   ["button", {type: "button", id: "cmtaccb",
                               onclick: jt.fs("app.revresp.topaccept('" +
                                              qcid + "')")},
                    "Accept"],
                   "&nbsp;",
                   ["button", {type: "button", id: "cmtignoreb",
                               onclick: jt.fs("app.revresp.topignore('" +
                                              qcid + "')")},
                    "Ignore Forever"],
                   "&nbsp;",
                   ["button", {type: "button", id: "cmtrejectb",
                               onclick: jt.fs("app.revresp.topreject('" +
                                              qcid + "')")},
                    "Reject"]]]]];
        html = app.layout.dlgwrapHTML(
            qcmt.rctype.capitalize() + " from " + commenterNameHTML(qcmt),
            html);
        app.layout.openDialog({x:200, y:300}, jt.tac2html(html));
    },


    topaccept: function (qcid) {
        var qcmt, html = "";
        qcmt = findPendingComment(qcid);
        if(qcmt.rctype === "comment") {
            html = " (optional)"; }
        html = [["p", {cla: "qctext"},
                 qcmt.comment],
                ["br"],
                "Your response" + html,
                ["br"],
                ["textarea", {id: "cmtta", style: taStyle()},
                 ""]];
        jt.out('formcontentdiv', jt.tac2html(html));
        jt.out('cmterrdiv', "");
        jt.out('requestbuttonsdiv', topacceptButtonsHTML(qcid));
    },


    topacceptConfirmed: function (qcid) {
        var qcmt, revref, data;
        jt.out('requestbuttonsdiv', "Accepting...");
        revref = app.lcs.getRef("rev", app.review.getCurrentReview());
        qcmt = findPendingComment(qcid);
        qcmt.resp = jt.byId('cmtta').value;
        qcmt.rcstat = "accepted";
        data = jt.objdata(qcmt);
        jt.call('POST', "updcmt?" + app.login.authparams(), data,
                function (updcmts) {
                    revref.qcmts.push(updcmts[0]);
                    removePendingComment(qcid);
                    app.layout.closeDialog();
                    displayReviewResponses(); },
                app.failf(function (code, errtxt) {
                    jt.out('cmterrdiv', "Accept failed " + code + 
                           " " + errtxt);
                    jt.out('requestbuttonsdiv', topacceptButtonsHTML(qcid)); }),
                jt.semaphore("revresp.topacceptConfirmed"));
    },


    topignore: function (qcid) {
        var qcmt, penref, html = "";
        qcmt = findPendingComment(qcid);
        penref = app.lcs.getRef("pen", qcmt.cmtpenid);
        html = [["p", {cla: "qctext"},
                 qcmt.comment],
                ["div", {cla: "confirmlastline"},
                 "This " + qcmt.rctype + " will be permanently ignored."],
                ["div", {cla: "qctext"},
                 ["Neither you, nor anyone else, will ever see this " +
                  qcmt.rctype + " again, ",
                  ["br"],
                  "but " + penref.pen.name + " will still see it as pending."]],
                ["div", {cla: "confirmlastline"},
                 "Are you sure?"]];
        jt.out('formcontentdiv', jt.tac2html(html));
        jt.out('cmterrdiv', "");
        jt.out('requestbuttonsdiv', topignoreButtonsHTML(qcid));
    },


    topignoreConfirmed: function (qcid) {
        var qcmt, data;
        jt.out('requestbuttonsdiv', "Ignoring forever...");
        qcmt = findPendingComment(qcid);
        qcmt.rcstat = "ignored";
        data = jt.objdata(qcmt);
        jt.call('POST', "updcmt?" + app.login.authparams(), data,
                function (updcmts) {
                    removePendingComment(qcid);
                    app.layout.closeDialog();
                    displayReviewResponses(); },
                app.failf(function (code, errtxt) {
                    jt.out('cmterrdiv', "Ignore failed " + code + 
                           " " + errtxt);
                    jt.out('requestbuttonsdiv', topignoreButtonsHTML(qcid)); }),
                jt.semaphore("revresp.topignoreConfirmed"));
    },


    topreject: function (qcid) {
        var qcmt, penref, insize, html = "";
        insize = app.winw < 600 ? 20 : 50;
        qcmt = findPendingComment(qcid);
        penref = app.lcs.getRef("pen", qcmt.cmtpenid);
        html = [["p", {cla: "qctext"},
                 qcmt.comment],
                ["div", {cla: "harasscbdiv"},
                 jt.checkbox("cbharass", "cbharass", "This " + qcmt.rctype +
                             " is harassment.",
                             false, jt.fs("app.revresp.toggleabusecb('" + 
                                          qcid + "')"))],
                ["div", {id: "harassdiv", cla: "confirmtext",
                         style: "display:none;"},
                 [["div", {cla: "confirmlastline"},
                   penref.pen.name + " will be noted as abusive."],
                  ["div", {cla: "qctext"},
                   ["This, and all further questions or comments from " +
                    penref.pen.name + " will be permanently ignored.",
                    ["br"],
                    "Neither you, nor anyone else will see any more of " +
                    "this person's commentary on your reviews."]],
                  ["div", {cla: "confirmlastline"},
                   "Are you sure?"]]],
                ["div", {id: "rejcontdiv", cla: "commentform"},
                 ["table",
                  [["tr",
                    ["td", {colspan: 2},
                     "Reject " + qcmt.rctype.capitalize()]],
                   ["tr",
                    [["td", "Reason"],
                     ["td",
                      ["select", {id: "rejreasonsel"},
                       [["option", "Not Helpful"],
                        ["option", "Not Public Appropriate"],
                        ["option", "Not Clear"],
                        ["option", "Other"]]]]]],
                   ["tr",
                    [["td", "Details"],
                     ["td",
                      ["input", {type: "text", id: "rejresin", 
                                 size: insize}]]]]]]]];
        jt.out('formcontentdiv', jt.tac2html(html));
        jt.out('cmterrdiv', "");
        jt.out('requestbuttonsdiv', toprejectButtonsHTML(qcid));
    },


    toggleabusecb: function (qcid) {
        var cbharass = jt.byId('cbharass');
        if(cbharass && cbharass.checked) {
            jt.byId('harassdiv').style.display = "block";
            jt.byId('rejcontdiv').style.display = "none"; }
        else {
            jt.byId('harassdiv').style.display = "none";
            jt.byId('rejcontdiv').style.display = "block"; }
        jt.out('cmterrdiv', "");
        jt.out('requestbuttonsdiv', toprejectButtonsHTML(qcid));
    },


    toprejectConfirmed: function (qcid) {
        var qcmt, sel, i, det, data;
        jt.out('requestbuttonsdiv', "Rejecting...");
        qcmt = findPendingComment(qcid);
        qcmt.rcstat = "rejected";
        sel = jt.byId("rejreasonsel");
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                qcmt.resp = sel.options[i].value;
                break; } }
        det = jt.byId("rejresin");
        if(det.value) {
            qcmt.resp += ": " + det.value; }
        data = jt.objdata(qcmt);
        jt.call('POST', "updcmt?" + app.login.authparams(), data,
                function (updcmts) {
                    removePendingComment(qcid);
                    app.layout.closeDialog();
                    displayReviewResponses(); },
                app.failf(function (code, errtxt) {
                    jt.out('cmterrdiv', "Reject failed " + code + 
                           " " + errtxt);
                    jt.out('requestbuttonsdiv', toprejectButtonsHTML(qcid)); }),
                jt.semaphore("revresp.toprejectConfirmed"));
    },


    reportAbuse: function (qcid) {
        var pen, qcmt;
        jt.out('requestbuttonsdiv', "Reporting...");
        pen = app.pen.currPenRef().pen;
        qcmt = findPendingComment(qcid);
        if(pen.abusive) {
            pen.abusive += "," + qcmt.cmtpenid; }
        else {
            pen.abusive = String(qcmt.cmtpenid); }
        app.pen.updatePen(pen,
                          function () {
                              app.layout.closeDialog();
                              displayReviewResponses(); },
                          app.failf(function (code, errtxt) {
                              jt.out('cmterrdiv', "Reporting failed " + code + 
                                     " " + errtxt);
                              jt.out('requestbuttonsdiv', 
                                     toprejectButtonsHTML(qcid)); }));
    },


    clearAbuse: function (otherpen, contf) {
        var pen, abid, html, flagged = false;
        if(!jt.byId("followbimg")) {
            return contf(); }
        pen = app.pen.currPenRef().pen;
        if(pen.abusive) {
            abid = jt.instId(otherpen);
            if(pen.abusive.indexOf(abid + ",") >= 0 || 
               pen.abusive.endsWith(abid)) {
                flagged = true; } }
        if(!flagged) {
            return contf(); }
        abcontf = contf;
        html = ["div", {cla: "commentdiv"},
                [["div", {id: "formcontentdiv", cla: "commentform"},
                  [["p", {cla: "qctext"},
                    "You previously reported " + otherpen.name + 
                    " for harassment."],
                   ["p", {cla: "qctext"},
                    "Following them could set a bad precedent. " +
                    "Are you sure?"],
                   ["div", {cla: "harasscbdiv"},
                    jt.checkbox("cbclear", "cbclear", "Clear " + 
                                otherpen.name + " harassment report.")]]],
                 ["div", {id: "cmterrdiv"}, ""],
                 ["div", {id: "requestbuttonsdiv"},
                  [["button", {type: "button", id: "cancelb",
                               onclick: jt.fs("app.layout.closeDialog()")},
                    "Cancel"],
                   "&nbsp;",
                   ["button", {type: "button", id: "confirmb",
                               onclick: jt.fs("app.revresp.clearAbuseConf('" +
                                              abid + "')")},
                    "OK"]]]]];
        html = app.layout.dlgwrapHTML("Follow " + otherpen.name + "?", html);
        app.layout.openDialog({x:200, y:200}, jt.tac2html(html));
    },


    clearAbuseConf: function (abid) {
        var pen, cbclear, ids, i;
        cbclear = jt.byId('cbclear');
        if(!cbclear || !cbclear.checked) {
            return abcontf(); }
        pen = app.pen.currPenRef().pen;
        ids = pen.abusive.split(",");
        pen.abusive = [];
        for(i = 0; i < ids.length; i += 1) {
            if(ids[i] !== abid) {
                pen.abusive.push(ids[i]); } }
        pen.abusive = pen.abusive.join(",");
        app.layout.closeDialog();
        app.pen.updatePen(pen, abcontf, app.failf);
    },


    //Sometimes corresponding links can take a few server calls to settle
    pollForUpdates: function () {
        pollcount = 3;
    },


    activateSecondaryResponseButtons: function () {
        disableQuestionButton();
        disableCommentButton();
        if(jt.byId('respondbutton')) {
            updateCorrespondingReviewButton(); }
        if(jt.byId('questionbutton')) {
            testEnableQuestionButton(); }
        correspcheck = 0;
        if(jt.byId('commentbutton')) {
            testEnableCommentButton(); }
    },


    activateResponseButtons: function (review) {
        if(jt.byId('helpfulbutton')) {
            initHelpfulButtonSetting(app.pen.currPenRef(), review); }
        if(jt.byId('memobutton')) {
            initMemoButtonSetting(app.pen.currPenRef(), review); }
        if(jt.byId('revcommentsdiv')) {
            displayReviewResponses(); }
    },


    showResponseDialog: function () {
        var html, pos;
        html = ["div", {cla: "revrespactionsdiv"},
                [["div", {id: "respondbutton", cla: "buttondiv"},
                  jt.imgntxt("writereview.png", "Your review",
                             "app.revresp.respond()", 
                             "#respond", 
                             "Edit your corresponding review", 
                             "respico", "respond")],
                 ["div", {id: "questionbutton", cla: "buttondiv"},
                  jt.imgntxt("questionb.png", "Question",
                             "app.revresp.question()",
                             "#question",
                             "Ask a question about this review",
                             "respico", "question")],
                 ["div", {id: "commentbutton", cla: "buttondiv"},
                  jt.imgntxt("commentb.png", "Comment",
                             "app.revresp.comment()",
                             "#comment",
                             "Comment on this review",
                             "respico", "comment")]]];
        html = app.layout.dlgwrapHTML("Respond", html);
        pos = jt.geoPos(jt.byId('respondtextspan'));
        pos.x -= 50;
        pos.y -= 70;
        app.layout.openDialog(pos, jt.tac2html(html), null,
                              app.revresp.activateSecondaryResponseButtons);
    },


    isAbusivePen: function (penid) {
        return isAbusivePen(penid);
    }


}; //end of returned functions
}());

