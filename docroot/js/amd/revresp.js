/*global setTimeout: false, app: false, jt: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.revresp = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var greytxt = "#999999",


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    displayCorrespondingReviewInfo = function (pen, review) {
        var html, imghtml, msghtml = "Your review";
        if(review) {
            setTimeout(function () {
                app.lcs.verifyCorrespondingLinks(review, 
                                                 app.review.getCurrentReview());
            }, 100);
            imghtml = app.review.starsImageHTML(review.rating, false, 
                                                "inlinestarsimg");
            msghtml = "Your review: " + imghtml; }
        html = jt.imgntxt("writereview.png", msghtml,
                           "app.revresp.respond()", "#respond",
                           "Edit your corresponding review", "", "respond");
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
    findCorrespondingReview = function (homepen, contfunc) {
        var params, i, t20, critsec = "", crev;
        crev = app.review.getCurrentReview();
        if(homepen.top20s) {
            t20 = homepen.top20s[app.review.getCurrentReview().revtype];
            if(t20 && t20.length) {
                for(i = 0; i < t20.length; i += 1) {
                    if(t20[i].cankey === crev.cankey && 
                       t20[i].revtype === crev.revtype) {
                        return contfunc(homepen, t20[i]); } } } }
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
                 critsec);
    },


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given review.
    copyAndEdit = function (pen, review) {
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
        crev = review;
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
        var i, revid, params, critsec = "";
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
                     critsec); }
    },


    initQuestionButtonSetting = function () {
        var img;
        img = jt.byId('questionimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        img.className = "navicodis";  //grey out the image to react to click
        jt.byId('questiontxttd').style.color = greytxt;
    },


    initCommentButtonSetting = function () {
        var img;
        img = jt.byId('commentimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        img.className = "navicodis";  //grey out the image to react to click
        jt.byId('commenttxttd').style.color = greytxt;
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
            penref = app.lcs.getPenRef(penids[i]);
            if(penref.status === "not cached") {
                app.lcs.getPenFull(penids[i], redrawfunc);
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


    crevlink = function () {
        return app.lcs.getRevRef(app.review.getCurrentReview()).revlink;
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


    queryAndCommentRowsHTML = function (redrawfunc) {
        var html = "";
        //functionality coming soon...
        return html;
    },


    correspondingReviewsHTML = function (redrawfunc) {
        var rows = [], csv, elems, i, penid, revid, penref, revref;
        csv = crevlink().corresponding;
        if(csv) {
            elems = csv.split(",");
            for(i = 0; i < elems.length; i += 1) {
                revid = elems[i].split(":");
                penid = revid[1];
                revid = revid[0];
                penref = app.lcs.getPenRef(penid);
                if(penref.status === "not cached") {
                    app.lcs.getPenFull(penid, redrawfunc);
                    break; }
                revref = app.lcs.getRevRef(revid);
                if(revref.status === "not cached") {
                    app.lcs.getRevFull(revid, redrawfunc);
                    break; }
                if(penref.pen && revref.rev) {
                    rows.push(
                        ["tr",
                         [["td", {cla:"respcol", align:"left"},
                           app.review.starsImageHTML(revref.rev.rating)],
                          ["td", {cla:"respval", valign:"top", align:"right"},
                           ["a", {href: "#" + jt.ndq(penref.pen.name),
                                  onclick: jt.fs("app.profile.readReview('" +
                                                 revref.revid + "')")},
                             penref.pen.name]],
                          ["td", {cla:"respval", valign:"top", align:"left"},
                           jt.ellipsis(revref.rev.text, 255)]]]); } } }
        return rows;
    },


    displayReviewResponses = function () {
        var revref, html;
        revref = app.lcs.getRevRef(app.review.getCurrentReview());
        if(!revref.revlink) {
            return app.lcs.verifyReviewLinks(displayReviewResponses); }
        html = ["table",
                [helpfulRowHTML(displayReviewResponses),
                 rememberedRowHTML(displayReviewResponses),
                 queryAndCommentRowsHTML(displayReviewResponses),
                 correspondingReviewsHTML(displayReviewResponses)]];
        jt.out('revcommentsdiv', jt.tac2html(html));
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
        app.lcs.getRevRef(revtag.revid).revlink = revlink;
        setTimeout(displayReviewResponses, 50);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    respond: function () {
        jt.byId('respondtxttd').style.color = greytxt;
        setTimeout(function () {
            app.pen.getPen(function (pen) {
                findCorrespondingReview(pen, copyAndEdit); }); }, 50);
    },


    toggleMemoButton: function (value) {
        var img, tbl, data, critsec = "";
        img = jt.byId('memoimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = jt.byId('memotable');
        if(value === "set") {  //just initializing the display
            img.src = "img/remembered.png";
            tbl.title = "Remove from your remembered reviews";
            jt.out('memotxttd', "Remembered");
            return; }
        img.className = "navicodis";  //grey out the image
        value = (img.src.indexOf("remembered.png") > 0)? "no" : "yes"; //toggle
        data = "penid=" + jt.instId(app.pen.currPenRef().pen) +
            "&revid=" + jt.instId(app.review.getCurrentReview()) +
            "&remember=" + value;
        jt.call('POST', "noteremem?" + app.login.authparams(), data,
                 function (updatedrevtags) {  //revtag, revlink
                     updateCachedReviewTags('remembered', updatedrevtags);
                     if(isRemembered(updatedrevtags[0])) {
                         img.src = "img/remembered.png";
                         tbl.title = "Remove from your remembered reviews";
                         jt.out('memotxttd', "Remembered"); }
                     else {
                         img.src = "img/rememberq.png";
                         tbl.title = "Add to your remembered reviews";
                         jt.out('memotxttd', "Remember"); }
                     img.className = "navico"; },  //ungrey the image
                 app.failf(function (code, errtxt) {
                     jt.err("toggleMemoButton failed " + code +
                             " " + errtxt); }),
                 critsec);
    },


    toggleHelpfulButton: function (value) {
        var img, tbl, data, critsec = "";
        img = jt.byId('helpfulimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = jt.byId('helpfultable');
        if(value === "set") {  //just initializing the display
            img.src = "img/helpful.png";
            tbl.title = "Remove mark as helpful";
            return; }
        img.className = "navicodis";  //grey out the image
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
                     img.className = "navico"; },  //ungrey the image
                 app.failf(function (code, errtxt) {
                     jt.err("toggleHelpfulButton failed " + code +
                             " " + errtxt); }),
                 critsec);
    },


    question: function () {
        jt.err("not implemented yet.");
    },


    comment: function () {
        jt.err("not implemented yet.");
    },


    loadHelpful: function (callback, penref) {
        var params, critsec = "";
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
                 critsec);
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
        html = ["div", { id: "socialrevactdiv"},
                ["table", {cla: "socialrevacttable"},
                 [["tr",
                   [["td", {colspan: 2},
                     //helpful button. init unchecked, update after lookup
                     ["div", {id: "helpfulbutton", cla: "buttondiv"},
                      jt.imgntxt("helpfulq.png", "Helpful",
                                 "app.revresp.toggleHelpfulButton()", 
                                 "#helpful", 
                                 "Mark this review as helpful", 
                                 "", "helpful")]],
                    ["td", {colspan: 2},
                     //remember button. init unchecked, update after lookup
                     ["div", {id: "memobutton", cla: "buttondiv"},
                      jt.imgntxt("rememberq.png", "Remember",
                                 "app.revresp.toggleMemoButton()", 
                                 "#memo", 
                                 "Add this to remembered reviews", 
                                 "", "memo")]],
                    ["td", {colspan: 2},
                     //respond button, contents rewritten after lookup
                     ["div", {id: "respondbutton", cla: "buttondiv"},
                      jt.imgntxt("writereview.png", "Your review",
                                 "app.revresp.respond()", 
                                 "#respond", 
                                 "Edit your corresponding review", 
                                 "", "respond")]]]],
                  ["tr",
                   [["td",
                     "&nbsp;"],
                    ["td", {colspan: 2},
                     ["div", {id: "questionbutton", cla: "buttondiv"},
                      jt.imgntxt("questionb.png", "Question",
                                 "app.revresp.question()",
                                 "#question",
                                 "Ask a question about this review",
                                 "", "question")]],
                    ["td", {colspan: 2},
                     ["div", {id: "commentbutton", cla: "buttondiv"},
                      jt.imgntxt("commentb.png", "Comment",
                                 "app.revresp.comment()",
                                 "#comment",
                                 "Comment on this review",
                                 "", "comment")]],
                    ["td",
                     "&nbsp;"]]]]]];
        return html;
    },


    activateResponseButtons: function (review) {
        if(jt.byId('helpfulbutton')) {
            initHelpfulButtonSetting(app.pen.currPenRef(), review); }
        if(jt.byId('memobutton')) {
            initMemoButtonSetting(app.pen.currPenRef(), review); }
        if(jt.byId('respondbutton')) {
            app.pen.getPen(function (homepen) {
                findCorrespondingReview(homepen, 
                                        displayCorrespondingReviewInfo); 
            }); }
        if(jt.byId('questionbutton')) {
            initQuestionButtonSetting(); }
        if(jt.byId('commentbutton')) {
            initCommentButtonSetting(); }
        if(jt.byId('revcommentsdiv')) {
            displayReviewResponses(); }
    }


}; //end of returned functions
}());

