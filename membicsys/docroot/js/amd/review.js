/*global setTimeout, window, confirm, app, jt, google, document */

/*jslint browser, multivar, white, fudge, for */

app.review = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var //If a url was pasted or passed in as a parameter, then potentially
        //modified by automation, that "cleaned" value should be kept to
        //confirm against the potentially edited form field value.
        autourl = "",
        //The current review being displayed or edited.
        crev = {},
        //If changing the width or height of the stars img, also change
        //profile.reviewItemHTML indent
        starimgw = 85,
        starimgh = 15,
        starPointingActive = false,  //true if star sliding active
        //The last value used for autocomplete checking
        autocomptxt = "",
        gautosvc = null,
        geoc = null,
        gplacesvc = null,
        //             Review definitions:
        //Review type definitions always include the url field, it is
        //appended automatically if not explicitely listed elsewhere
        //in the type definition.  Field names are converted to lower
        //case with all spaces removed for use in storage, and
        //capitalized for use as labels.  Fields defined here also
        //need to be supported server side in the object model (rev.py)
        //
        //Definition guidelines:
        // 1. Too many fields makes it tedious to enter a review.  The
        //    goal here is to provide adequate identification for
        //    someone reading a review, not to be an item database.
        //    Links to item database entries can go in the url field.
        // 2. Default keywords should be widely applicable across the
        //    possible universe of reviews.  When practical, a keyword
        //    should describe your perception rather than being
        //    classificational (e.g. "Funny" rather than "Comedy").
        // 3. If something has a subkey, keep the primary key prompt
        //    short so it doesn't cause bad formatting.
        reviewTypes = [
          { type: "book", plural: "books", img: "TypeBook50.png",
            keyprompt: "Title",
            key: "title", subkey: "author",
            fields: [ "publisher", "year" ],
            dkwords: [ "Fluff", "Kid Ok", 
                       "Funny", "Emotional", 
                       "Gripping", "Informational" ] },
          { type: "article", plural: "articles", img: "TypeArticle50.png",
            keyprompt: "Title",
            key: "title", //subkey
            fields: [ "author", "publisher", "year" ],
            dkwords: [ "Newsworthy", "Informative", 
                       "Eloquent", "Educational" ] },
          { type: "movie", plural: "movies", img: "TypeMovie50.png",
            keyprompt: "Movie name",
            key: "title", //subkey
            fields: [ "year", "starring" ],
            dkwords: [ "Classic", "Kid Ok",
                       "Escapism", "Emotional",
                       "Stunning", "Informational" ] },
          { type: "video", plural: "videos", img: "TypeVideo50.png",
            keyprompt: "Title",
            key: "title", //subkey
            fields: [ "artist" ],
            dkwords: [ "Uplifting", "Kid Ok",
                       "Funny", "Emotional",
                       "Artistic", "Educational" ] },
          { type: "music", plural: "music", img: "TypeSong50.png",
            keyprompt: "Title",
            key: "title", subkey: "artist",
            fields: [ "album", "year" ],
            dkwords: [ "Chill", "Social",
                       "Office", "Travel",
                       "Workout", "Dance" ] },
          { type: "yum", plural: "yums", img: "TypeYum50.png",
            keyprompt: "Name of restaurant, dish, or drink",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Traditional", "Innovative",
                       "Inexpensive", "Expensive", 
                       "Quiet", "Loud" ] },
          { type: "activity", plural: "activities", img: "TypeActivity50.png",
            keyprompt: "Name of place or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Indoor", "Outdoor", 
                       "Artistic", "Athletic",
                       "Educational", "Kid Ok" ] },
          { type: "other", plural: "other membics", img: "TypeOther50.png",
            keyprompt: "Name or title", 
            key: "name", //subkey
            fields: [],
            dkwords: [ "Professional", "Personal",
                       "Hobby", "Research" ] }
          ],


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    //rating is a value from 0 - 100.  Using Math.round to adjust values
    //results in 1px graphic hiccups as the rounding switches, and ceil
    //has similar issues coming off zero, so use floor.
    starsImageHTML = function (rating, mode) {
        var imgfile = "img/stars18ptC.png", greyfile = "img/stars18ptCg.png",
            width, offset, rat, html;
        if(typeof rating !== 'number') {
            mode = mode || (rating.srcrev === -101 ? "prereview" : "read");
            rating = rating.rating; }
        rat = app.review.starRating(rating);
        if(mode === "prereview") {
            return jt.tac2html(
                ["img", {cla: "starsimg", src: "img/future.png",
                         title: rat.title, alt: rat.title}]); }
        width = Math.floor(rat.step * (starimgw / rat.maxstep));
        html = [];
        html.push(["img", {cla: "starsimg", src: "img/blank.png",
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(mode === "edit") {  //add appropriate grey star background on right
            if(rat.step % 2 === 1) {  //odd, use half star display
                offset = Math.floor(starimgw / rat.maxstep);
                html.push(
                    ["img", {cla: "starsimg", src: "img/blank.png",
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "')" +
                                                " -" + offset + "px 0;",
                             title: rat.title, alt: rat.title}]); }
            else { //even, use full star display
                html.push(
                    ["img", {cla: "starsimg", src: "img/blank.png",
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "');",
                             title: rat.title, alt: rat.title}]); } }
        else { //add blank space to left justify stars
            html.push(["img", {cla: "starsimg", src: "img/blank.png",
                               style: "width:" + (starimgw - width) + "px;" +
                                      "height:" + starimgh + "px;"}]); }
        return jt.tac2html(html);
    },


    findReviewType = function (type) {
        var revtype;
        if(!type) {
            jt.log("review.findReviewType asked to find falsy type");
            return null; }
        type = type.toLowerCase();
        revtype = reviewTypes[reviewTypes.length - 1];  // default is "other"
        reviewTypes.every(function (rt) {
            if(rt.type === type || rt.plural === type) {
                revtype = rt;
                return false; }
            return true; });
        return revtype;
    },


    readParameters = function (params) {
        if(params.newrev) { 
            crev.revtype = jt.dec(params.newrev); }
        if(params.name) {
            crev.name = jt.dec(params.name); }
        if(params.title) {
            crev.title = jt.dec(params.title); }
        if(params.artist) {
            crev.artist = jt.dec(params.artist); }
        if(params.author) {
            crev.author = jt.dec(params.author); }
        if(params.publisher) {
            crev.publisher = jt.dec(params.publisher); }
        if(params.album) {
            crev.album = jt.dec(params.album); }
        if(params.starring) {
            crev.starring = jt.dec(params.starring); }
        if(params.address) {
            crev.address = jt.dec(params.address); }
        if(params.year) {
            crev.year = jt.dec(params.year); }
        if(params.imguri) {
            crev.imguri = jt.dec(params.imguri); }
    },


    getURLReader = function (url, callfunc) {
        if(url.indexOf(".amazon.") > 0) {
            callfunc(app.amazon); }
        //app.youtube dies all the time due to the number of API calls
        //    being exhausted, and the standard reader does just as well.
        //app.netflix became nonfunctional when netflix retired the
        //    odata catalog on 08apr14.
        else {
            callfunc(app.readurl); }
    },


    reviewTextValid = function () {
        var input = jt.byId('rdta');
        if(input) {
            crev.text = input.value; }
    },


    verifyReviewImageDisplayType = function (review) {
        var dt = "guess";
        if(review.svcdata && review.svcdata.picdisp) {
            dt = review.svcdata.picdisp; }
        if(dt !== "nopic" && dt !== "sitepic" && dt !== "upldpic") {
            dt = "guess"; }
        if(dt === "guess") {
            if(review.imguri) {
                dt = "sitepic"; }
            else if(review.revpic) {
                dt = "upldpic"; }
            else {
                dt = "nopic"; } }
        review.svcdata = review.svcdata || {};
        review.svcdata.picdisp = dt;
        return dt;
    },


    //Many images (including everything from smaller websites to
    //Amazon) are not easily available over https, so removing the
    //protocol and letting the browser attempt https just results in a
    //lot of broken images.  Don't mess with the images unless you
    //have to because imagerelay eats server resources.
    sslSafeRef = function (revid, url) {
        if(window.location.href.indexOf("https://") === 0) {
            url = "imagerelay?revid=" + revid + "&url=" + jt.enc(url); }
        return url;
    },


    //If the review.url has known issues, fix it
    fixReviewURL = function (rev) {
        if(!rev.url) {
            return; }  //nothing to fix
        //Amazon detail urls have extra encoding that needs to be removed
        if(rev.url.indexOf("%3Dmembic-20%26") >= 0) {
            rev.url = jt.dec(rev.url); }
    },


    revFormImageHTML = function (review, type, keyval, mode) {
        var html;
        if(!keyval) {
            return ""; }
        if(!type) {
            jt.log("Might show typed placeholders. Pass the type"); }
        html = {id: "revimg" + jt.instId(review), cla: "revimg", 
                src: "img/nopicprof.png"};
        if(jt.isLowFuncBrowser()) {
            html.style = "width:125px;height:auto;"; }
        switch(verifyReviewImageDisplayType(review)) {
        case "sitepic":
            html.src = sslSafeRef(jt.instId(review), review.imguri);
            break;
        case "upldpic":
            html.src = "revpic?revid=" + jt.instId(review) + 
                jt.ts("&cb", review.modified);
            break;
        case "nopic":
            if(mode !== "edit") {
                html.src = "img/blank.png"; }
            break; }
        html = ["img", html];
        if(mode === "edit") {
            html = ["a", {href: "#changepic", 
                          onclick: jt.fs("app.review.picdlg()")},
                    html]; }
        else if(review.url) {
            html = ["a", {href: review.url,
                          onclick: jt.fs("window.open('" + review.url + "')")},
                    html]; }
        html = jt.tac2html(html);
        return html;
    },


    errlabel = function (domid) {
        var elem = jt.byId(domid);
        if(elem) {
            elem.style.color = "red";
            if(elem.innerHTML.indexOf("*") < 0) {
                elem.innerHTML += "*"; } }
    },


    //Validating URLs without accidentally complaining about things
    //that actually can work is not trivial.  The only real way is
    //probably to fetch it.  Checking for embedded javascript is a
    //whole other issue.
    noteURLValue = function () {
        var input;
        //if auto read url from initial form, note it and then reset var
        if(autourl) {
            crev.url = autourl;
            autourl = ""; }
        //the url may be edited, note the current value
        input = jt.byId('urlin');
        if(input) {
            crev.url = input.value; }
    },


    keyFieldsValid = function (type, errors) {
        var cankey, input = jt.byId('keyin');
        if(!input || !input.value) {
            errlabel('keyinlabeltd');
            errors.push("Need a " + type.key); }
        else {
            crev[type.key] = input.value;
            cankey = crev[type.key]; }
        if(type.subkey) {
            input = jt.byId(type.subkey + "in");
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Need to fill in the " + type.subkey); }
            else {
                crev[type.subkey] = input.value;
                cankey += crev[type.subkey]; } }
        if(cankey) {
            crev.cankey = jt.canonize(cankey); }
    },


    secondaryFieldsValid = function (type) {
        //none of the secondary fields are required, so just note the values
        type.fields.forEach(function (field) {
            var input = jt.byId(field + "in");
            if(input) {  //input field was displayed
                crev[type] = input.value; } });
    },


    verifyRatingStars = function (ignore /*type*/, errors) {
        var txt;
        if(!crev.rating && crev.srcrev !== -101) {
            txt = "Please set a star rating";
            errors.push(txt); }
    },


    keywordsValid = function () {
        var input;
        input = jt.byId('rdkwin');
        if(input) {
            crev.keywords = jt.spacedCSV(input.value); }
    },


    notePostingCoops = function () {
        crev.ctmids = "";
        app.pen.postableCoops().forEach(function (ctm) {
            var ctmcb = jt.byId("dctmcb" + ctm.ctmid);
            if(ctmcb && ctmcb.checked) {
                crev.ctmids = crev.ctmids.csvappend(ctm.ctmid); } });
    },


    readAndValidateFieldValues = function (type, errors) {
        var futcb;
        if(!type) {
            type = findReviewType(crev.revtype); }
        if(!errors) {
            errors = []; }
        if(type) {
            keyFieldsValid(type, errors);
            keywordsValid(type, errors);
            reviewTextValid(type, errors);
            secondaryFieldsValid(type, errors);
            noteURLValue();
            futcb = jt.byId("rdfutcb");
            if(futcb && futcb.checked) {
                crev.srcrev = -101; }
            else if(crev.srcrev && crev.srcrev === -101) {
                crev.srcrev = 0; }
            notePostingCoops(); }
    },


    validateCurrentReviewFields = function () {
        var errors = [], rt;
        rt = findReviewType(crev.revtype);
        if(!rt) {
            errors.push("Need to choose a type");
            return errors; }
        readAndValidateFieldValues(rt, errors);
        verifyRatingStars(rt, errors);
        return errors;
    },


    displaySitePicLabel = function () {
        var html = ["div", {cla: "ptdvdiv"}, 
                    ["span", {cla: "ptdlabspan"}, "Site Pic"]];
        jt.out('sitepicform', jt.tac2html(html));
    },


    displayUploadedPicLabel = function () {
        var html = ["div", {cla: "ptdvdiv"}, 
                    ["span", {cla: "ptdlabspan"}, "Uploaded Pic"]];
        jt.out('upldpicform', jt.tac2html(html));
    },


    abbreviatedReviewText = function (prefix, revid, rev, togfname) {
        var maxchars = 400, rtxt, morehtml;
        rtxt = jt.linkify(rev.text || "");
        if(rtxt.length > maxchars) {
            rtxt = rev.text;  //start with raw text
            morehtml = ["a", {href: "#expand",
                              onclick: jt.fs(togfname + "('" +
                                             prefix + "','" + revid + "')")},
                        ["span", {cla: "togglemoretextspan"},
                         "more"]];
            //truncated text could result in a busted link if embedded
            //in the description.  Fixed on toggle.
            rtxt = jt.linkify(rtxt.slice(0, maxchars)) + "... " + 
                jt.tac2html(morehtml); }
        return rtxt;
    },


    fpbHelpfulButtonHTML = function (prefix, disprevid, updrevid, processing) {
        var rev, penid, title = "", alt = "", src = "", html;
        rev = app.lcs.getRef("rev", updrevid).rev;
        penid = app.pen.myPenId();
        rev.helpful = rev.helpful || "";
        if(rev.helpful.csvarray().length >= 123) {
            processing = true;  //permanently suspended
            title = "Starred by lots of people";
            alt = "Max starred";
            src = "img/helpfuldis.png"; }
        else if(rev.helpful.csvcontains(penid)) {
            if(processing) {
                title = "Unstarring...";
                alt = "Processing unstar";
                src = "img/helpfuldis.png"; }
            else {
                title = "Unset star";
                alt = "Star";
                src = "img/helpful.png"; } }
        else { //not at max and not marked as helpful
            if(processing) {
                title = "Starring...";
                alt = "Processing star";
                src = "img/helpfulqdis.png"; }
            else {
                title = "Star";
                alt = "Star";
                src = "img/helpfulq.png"; } }
        html = ["img", {cla: "fpbuttonimg",
                        id: prefix + disprevid + "helpfulbutton",
                        src: src, alt: alt}];
        if(!processing) {
            html = ["a", {href: "#" + alt, title: title,
                          onclick: jt.fs("app.review.fpbToggleHelpful('" +
                                         prefix + "','" + disprevid + "','" +
                                         updrevid + "')")},
                    html]; }
        return jt.tac2html(html);
    },


    fpbRememberButtonHTML = function (prefix, disprevid, updrevid, processing) {
        var penref, title = "", alt = "", src = "", html;
        penref = app.pen.myPenRef();
        if(penref && penref.pen) {
            penref.pen.remembered = penref.pen.remembered || ""; }
        if(penref && penref.pen && 
               penref.pen.remembered.csvcontains(updrevid)) {
            if(processing) {
                title = "Forgetting...";
                alt = "Forgetting...";
                src = "img/rememberdis.png"; }
            else {
                title = "Forget";
                alt = "Remembered";
                src = "img/remembered.png"; } }
        else {  //not remembered
            if(processing) {
                title = "Remembering...";
                alt = "Remembering...";
                src = "img/rememberqdis.png"; }
            else {
                title = "Remember";
                alt = "Not remembered";
                src = "img/rememberq.png"; } }
        html = ["img", {cla: "fpbuttonimg",
                        id: prefix + disprevid + "rememberbutton",
                        src: src, alt: alt}];
        if(!processing) {
            html = ["a", {href: "#" + alt, title: title,
                          onclick: jt.fs("app.review.fpbToggleRemember('" +
                                         prefix + "','" + disprevid + "','" +
                                         updrevid + "')")},
                    html]; }
        return jt.tac2html(html);
    },


    //Not worth the overhead and potential miss of querying to find
    //whether you have already written a review of something.  Just
    //click to write and be pleasantly surprised that your previous
    //review was found (if the cankey matches), or search your reviews
    //to find the matching one and add it to the altkeys.
    fpbWriteButtonHTML = function (prefix, disprevid, updrevid, mine) {
        var las, html;
        las = {href: "#write",
               title: "Note your impressions",
               onclick: jt.fs("app.review.fpbWrite('" + prefix + "','" + 
                              disprevid + "','" + updrevid + "')")};
        if(mine) {
            las.href = "#edit";
            las.title = "Edit your membic"; }
        html = ["a", las,
                ["img", {cla: "fpbuttonimg",
                         id: prefix + updrevid + "writebutton",
                         src: "img/writereview.png"}]];
        return html;
    },


    revpostButtonsHTML = function (prefix, revid) {
        var rev, updrevid, html;
        rev = app.lcs.getRef("rev", revid).rev;
        updrevid = jt.isId(rev.ctmid)? rev.srcrev : revid;
        if(rev.penid !== app.pen.myPenId()) {
            html = [["div", {cla: "fpbuttondiv", 
                             id: prefix + revid + "helpfuldiv"},
                     fpbHelpfulButtonHTML(prefix, revid, updrevid)],
                    ["div", {cla: "fpbuttondiv",
                             id: prefix + revid + "rememberdiv"},
                     fpbRememberButtonHTML(prefix, revid, updrevid)],
                    ["div", {cla: "fpbuttondiv"},
                     fpbWriteButtonHTML(prefix, revid, updrevid)]]; }
        else { //your own review
            rev.helpful = rev.helpful || "";
            rev.remembered = rev.remembered || "";
            html = [["div", {cla: "fpbuttondiv", 
                             style: "background:url('../img/helpfuldis.png') no-repeat center center; background-size:contain;"},
                     rev.helpful.csvarray().length],
                    ["div", {cla: "fpbuttondiv",
                             style: "background:url('../img/rememberdis.png') no-repeat center center; background-size:contain;"},
                     rev.remembered.csvarray().length],
                    ["div", {cla: "fpbuttondiv"},
                     fpbWriteButtonHTML(prefix, revid, updrevid, true)]]; }
        if(app.coop.mayRemove(app.lcs.getRef("coop", rev.ctmid).coop, rev)) {
            html.push(["div", {cla: "fpbuttondiv", id: "rbd" + revid},
                       ["a", {href: "#remove",
                              title: "Remove membic",
                              onclick: jt.fs("app.coop.remove('" + 
                                             rev.ctmid + "','" +
                                             revid + "')")},
                        ["img", {cla: "fpbuttonimg",
                                 id: prefix + revid + "removebutton",
                                 src: "img/trash.png"}]]]); }
        return jt.tac2html(html);
    },


    fpSecondaryFieldsHTML = function (rev) {
        var html = [];
        findReviewType(rev.revtype).fields.forEach(function (field) {
            var mapurl, value = jt.ndq(rev[field]);
            if(value) {
                if(field === "address") {
                    mapurl = "http://maps.google.com/?q=" + value;
                    value = ["a", {href: mapurl,
                                   onclick: jt.fs("window.open('" + 
                                                  mapurl + "')")},
                             value]; }
                html.push(["tr",
                           [["td", {cla: "tdnarrow"},
                             ["span", {cla: "secondaryfield"},
                              field]],
                            ["td", {align: "left"},
                             value]]]); } });
        return jt.tac2html(["table", {cla: "collapse"}, html]);
    },


    convertOldThemePostLabel = function (rev) {
        if(rev.svcdata && rev.svcdata.postgrps && !rev.svcdata.postctms) {
            rev.svcdata.postctms = rev.svcdata.postgrps; }
    },


    postedCoopLinksHTML = function (rev) {
        var postnotes, links, html;
        convertOldThemePostLabel(rev);
        if(!rev.svcdata || !rev.svcdata.postctms) {
            return ""; }
        postnotes = rev.svcdata.postctms;
        if(!postnotes.length) {
            return ""; }
        links = [];
        postnotes.forEach(function (pn) {
            links.push(jt.tac2html(
                ["a", {href: "?view=coop&coopid=" + pn.ctmid,
                       onclick: jt.fs("app.coop.bycoopid('" +
                                      pn.ctmid + "','review')")},
                 pn.name])); });
        html = ["span", {cla: "fpctmlinksspan"},
                [["span", {cla: "fpctmlinkslab"}, "Posted to: "],
                 links.join(" | ")]];
        return jt.tac2html(html);
    },


    starDisplayAdjust = function (event, roundup) {
        var span, spanloc, evtx, relx, sval, html;
        span = jt.byId('stardisp');
        spanloc = jt.geoPos(span);
        evtx = jt.geoXY(event).x;
        //jt.out('keyinlabeltd', "starDisplayAdjust evtx: " + evtx);  //debug
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = jt.geoXY(event.changedTouches[0]).x; }
        relx = Math.max(evtx - spanloc.x, 0);
        if(relx > 130) {  //normal relx values are 0 to ~86
            return; }     //ignore far out of range events.
        //jt.out('keyinlabeltd', "starDisplayAdjust relx: " + relx);  //debug
        sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //jt.out('keyinlabeltd', "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = app.review.starRating(sval, true).value; }
        crev.rating = sval;
        html = starsImageHTML(crev, "edit");
        jt.out('stardisp', html);
    },


    starPointing = function (event) {
        //jt.out('rdokstatdiv', "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    },


    starStopPointing = function (/*event*/) {
        //var pos = jt.geoXY(event);  //debug
        //jt.out('starslabeltd', " " + pos.x + ", " + pos.y);  //debug
        //jt.out('rdokstatdiv', "star NOT pointing" + event.target);  //debug
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, xypos, evtx, evty;
        td = jt.byId('rdstarsdiv');
        tdpos = jt.geoPos(td);
        xypos = jt.geoXY(event);
        evtx = xypos.x;
        evty = xypos.y;
        if(event.changedTouches && event.changedTouches[0]) {
            xypos = jt.geoXY(event.changedTouches[0]);
            evtx = xypos.x;
            evty = xypos.y; }
        //jt.out('starslabeltd', " " + evtx + ", " + evty);  //debug
        if(evtx < tdpos.x || evtx > tdpos.x + tdpos.w ||
           evty < tdpos.y || evty > tdpos.y + tdpos.h) {
            //jt.out('rdokdiv', "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    },


    starPointAdjust = function (event) {
        if(starPointingActive) {
            //jt.out('rdokdiv', "star point adjust...");  //debug
            starDisplayAdjust(event); }
    },


    starClick = function (event) {
        starDisplayAdjust(event, true);
    },


    xmlExtract = function (tagname, xml) {
        var idx, targetstr, result = null;
        targetstr = "<" + tagname + ">";
        idx = xml.indexOf(targetstr);
        if(idx >= 0) {
            xml = xml.slice(idx + targetstr.length);
            targetstr = "</" + tagname + ">";
            idx = xml.indexOf(targetstr);
            if(idx >= 0) {
                result = { content: xml.slice(0, idx),
                           remainder: xml.slice(idx + targetstr.length) }; } }
        return result;
    },


    secondaryAttr = function (tagname, xml) {
        var secondary = xmlExtract(tagname, xml);
        if(secondary) {
            secondary = secondary.content.trim(); }
        if(secondary) {
            return "&nbsp;<i>" + secondary + "</i>"; }
        return "";
    },


    hasComplexTitle = function (item) {
        if(item && item.title && item.title.indexOf("(") >= 0) {
            return true; }
        if(item && item.title && item.title.indexOf("[") >= 0) {
            return true; }
        return false;
    },


    writeAutocompLinks = function (xml) {
        var itemdat, url, attrs, title, rest, items = [], lis = [];
        itemdat = xmlExtract("Item", xml);
        while(itemdat) {
            url = xmlExtract("DetailPageURL", itemdat.content);
            url = url.content || "";
            attrs = xmlExtract("ItemAttributes", itemdat.content);
            title = xmlExtract("Title", attrs.content);
            title = title.content || "";
            if(title) {
                rest = "";
                if(crev.revtype === 'book') {
                    rest = secondaryAttr("Author", attrs.content); }
                else if(crev.revtype === 'movie') {
                    rest = secondaryAttr("ProductCoop", attrs.content); }
                else if(crev.revtype === 'music') {
                    rest = secondaryAttr("Artist", attrs.content) + " " +
                        secondaryAttr("Manufacturer", attrs.content) +
                        secondaryAttr("ProductCoop", attrs.content); }
                items.push({url: url, title: title, rest: rest}); }
            itemdat = xmlExtract("Item", itemdat.remainder); }
        title = "";
        if(jt.byId('keyin')) {
            title = jt.byId('keyin').value.toLowerCase(); }
        items.sort(function (a, b) {
            //prefer autocomps that actually include the title text
            if(title) {
                if(a.title.toLowerCase().indexOf(title) >= 0 && 
                   b.title.toLowerCase().indexOf(title) < 0) {
                    return -1; }
                if(a.title.toLowerCase().indexOf(title) < 0 && 
                   b.title.toLowerCase().indexOf(title) >= 0) {
                    return 1; } }
            //titles without paren or square bracket addendums first
            if(!hasComplexTitle(a) && hasComplexTitle(b)) { return -1; }
            if(hasComplexTitle(a) && !hasComplexTitle(b)) { return 1; }
            //alpha order puts shorter titles first, which is generally better
            if(a.title < b.title) { return -1; }
            if(a.title > b.title) { return 1; }
            //shorter remainders may or may not be better, whatever.
            if(a.rest < b.rest) { return -1; }
            if(a.rest > b.rest) { return 1; }
            return 0; });
        items.forEach(function (item) {
            lis.push(["li",
                      ["a", {href: item.url, 
                             onclick: jt.fs("app.review.readURL('" + 
                                            item.url + "')")},
                       item.title + " " + item.rest]]); });
        jt.out('revautodiv', jt.tac2html(["ul", lis]));
    },


    callAmazonForAutocomplete = function (acfunc) {
        var url;
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            jt.enc(autocomptxt) + jt.ts("&cb=", "hour");
        jt.call('GET', url, null,
                function (json) {
                    writeAutocompLinks(jt.dec(json[0].content));
                    setTimeout(acfunc, 400); },
                app.failf(function (code, errtxt) {
                    jt.out('revautodiv', "");
                    jt.log("Amazon info retrieval failed code " +
                           code + ": " + errtxt);
                    setTimeout(acfunc, 400); }),
                jt.semaphore("review.callAmazonForAutocomplete"));
    },


    noteServiceError = function (retry, problem) {
        var div, html; 
        div = jt.byId('lslogdiv');
        if(!div) {  //div not available anymore, punt.
            return; }
        html = div.innerHTML;
        retry = retry + 1;  //use human counts
        html += "<br/>Attempt " + retry + ": " + problem;
        jt.out('lslogdiv', html);
    },


    verifyGeocodingInfoDiv = function (complainIfNotAlreadyThere) {
        var infodiv, html;
        infodiv = jt.byId("geocodingInfoDiv");
        if(!infodiv) {
            html = ["div", {id: "geocodingInfoDiv"},
                    [["div", {id: "lslogdiv"}],
                     ["div", {id: "mapdiv"}]]];
            jt.out('rdextradiv', jt.tac2html(html));
            if(complainIfNotAlreadyThere) {
                jt.out('lslogdiv', "geocodingInfoDiv was destroyed"); } }
    },


    writeACPLinks = function (acfunc, results, status) {
        var items = [], html;
        if(status === google.maps.places.PlacesServiceStatus.OK) {
            results.forEach(function (place) {
                var selfunc = "app.review.selectLocation('" +
                    jt.embenc(place.description) + "','" + 
                    place.reference + "')";
                items.push(["li",
                            ["a", {href: "#selectloc",
                                   onclick: jt.fs(selfunc)},
                             place.description]]); }); }
        html = [["ul", items],
                ["img", {src: "img/poweredbygoogle.png"}]];
        jt.out('revautodiv', jt.tac2html(html));
        setTimeout(acfunc, 400);
    },


    callGooglePlacesAutocomplete = function (acfunc) {
        if(!gautosvc && google && google.maps && google.maps.places) {
            gautosvc = new google.maps.places.AutocompleteService(); }
        if(gautosvc && autocomptxt) {
            gautosvc.getPlacePredictions({input: autocomptxt}, 
                                         function (results, status) {
                                             writeACPLinks(acfunc, results,
                                                           status); }); }
        else {
            setTimeout(acfunc, 400); }
    },


    revfs = function (callstr) {
        return jt.fs("app.review." + callstr);
    },


    rotatePicButtonHTML = function () {
        var html;
        html = ["button", {type: "button", id: "pdtfrbutton",
                           onclick: revfs("rotateupldpic()")},
                "Rotate"];
        return html;
    },


    picdlgModForm = function () {
        var html;
        if(crev.svcdata.picdisp === "sitepic") {
            html = ["div", {id: "ptdfdiv"},
                    [["label", {fo: "pdturlin"}, "Pic URL"],
                     ["input", {id: "pdturlin", type: "url", size: 26,
                                value: crev.imguri || "",
                                placeholder: "http://example.com/pic.png"}],
                     ["div", {id: "pdtsustatdiv"}],
                     ["div", {id: "pdtsbuttondiv", cla: "dlgbuttonsdiv"},
                      ["button", {type: "button", id: "pdtsupdbutton",
                                  onclick: revfs("sitepicupd()")},
                       "Update"]]]];
            jt.out('sitepicform', jt.tac2html(html)); }
        else {
            displaySitePicLabel(); }
        if(crev.svcdata.picdisp === "upldpic") {
            html = ["div", {id: "ptdfdiv"},
                    [["form", {action: "/revpicupload", method: "post",
                               enctype: "multipart/form-data", target: "ptdif"},
                      [["input", {type: "hidden", name: "penid",
                                  value: app.pen.myPenId()}],
                       ["input", {type: "hidden", name: "revid",
                                  value: jt.instId(crev)}],
                       ["input", {type: "hidden", name: "revtype",
                                  value: crev.revtype}],
                       jt.paramsToFormInputs(app.login.authparams()),
                       ["div", {cla: "tablediv"},
                        [["div", {cla: "fileindiv"},
                          [["input", {type: "file", 
                                      name: "picfilein", id: "picfilein"}],
                           ["div", {id: "ptduploadbuttonsdiv"},
                            ["input", {type: "submit", cla: "formbutton",
                                       value: "Upload&nbsp;Pic"}]]]],
                         ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                     ["iframe", {id: "ptdif", name: "ptdif", 
                                 src: "/revpicupload", 
                                 style: "display:none"}],
                     ["div", {id: "pdtfbuttondiv", cla: "dlgbuttonsdiv"},
                      rotatePicButtonHTML()]]];
            jt.out('upldpicform', jt.tac2html(html));
            app.review.monitorPicUpload(); }
        else {  //not upldpic
            displayUploadedPicLabel(); }
    },


    copyReview = function (review) {
        var copy = {};
        Object.keys(review).forEach(function (field) {
            copy[field] = review[field]; });
        return copy;
    },


    makeMine = function (review, srcrevId) {
        var now = new Date().toISOString();
        jt.setInstId(review, undefined);
        review.penid = app.pen.myPenId();
        review.ctmid = 0;
        review.rating = 0;
        review.srcrev = srcrevId;
        review.modified = now;
        review.modhist = "";
        review.keywords = "";
        review.text = "";
        review.revpic = "";
        review.svcdata = "";
        review.penname = app.pen.myPenName().name;
        review.helpful = "";
        review.remembered = "";
    },


    cacheBustCoops = function (ctmids) {
        ctmids = ctmids || "";
        ctmids.csvarray().forEach(function (ctmid) {
            app.lcs.uncache("coop", ctmid); });
    },


    cacheBustPersonalReviewSearches = function () {
        var penref = app.pen.myPenRef();
        if(penref.profstate) {
            penref.profstate.allRevsState = null; }
        penref.prerevs = null;
    },


    dlgReadButtonHTML = function () {
        return ["button", {type: "button", id: "rdurlbutton",
                           onclick: jt.fs("app.review.readURL()")},
                "Read"];
    },


    dlgRevTypeSelection = function () {
        var html = [], tpd;
        reviewTypes.forEach(function (rt) {
            var clt = (crev.revtype === rt.type) ? "reviewbadgesel" 
                                                 : "reviewbadge";
            html.push(["a", {href: "#" + rt.type,
                             onclick: jt.fs("app.review.updatedlg('" + 
                                            rt.type + "')")},
                       ["img", {cla: clt, src: "img/" + rt.img}]]); });
        html = ["div", {cla: "revtypesdiv", id: "revdlgtypesdiv"}, 
                html];
        jt.out("rdtypesdiv", jt.tac2html(html));
        html = "";
        if(!crev.revtype) {
            if(!crev.url) {
                html = "&#x21E7; Read URL or select type &#x21E7;"; }
            else {
                tpd = jt.byId("rdtypepromptdiv");
                tpd.style.color = "#AB7300";
                tpd.style.fontWeight = "bold";
                tpd.style.fontSize = "medium";
                html = "&#x21E7;Select type&#x21E7;"; } }
        jt.out("rdtypepromptdiv", html);
        jt.byId("urlin").value = crev.url || "";
        jt.out("rdurlbuttonspan", jt.tac2html(dlgReadButtonHTML()));
    },


    dlgKeyFieldEntry = function () {
        var rt, html = "";
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet
            return; }
        if(!jt.byId("rdkeyincontentdiv")) {
            html = ["div", {id: "rdkeyincontentdiv"}, 
                    [["label", {fo: "keyin", cla: "liflab", id: "keylab"}, 
                      rt.key],
                     ["input", {id: "keyin", cla: "lifin", type: "text"}],
                     ["div", {id: "rdacdiv"},
                      ["input", {type: "checkbox", id: "rdaccb",
                                 name: "autocompleteactivationcheckbox",
                                 //<IE8 onchange only fires after onblur.
                                 //check action nullified if return false.
                                 onclick: jt.fsd("app.review.runAutoComp()"),
                                 checked: jt.toru(crev.autocomp)}]],
                     ["div", {id: "revautodiv"}]]];
            jt.out("rdkeyindiv", jt.tac2html(html)); }
        jt.out("keylab", rt.key.capitalize());  //update label if type changed
        //when returning from autocomp selection, crev.title/name has been
        //updated and needs to be reflected in the form
        jt.byId("keyin").value = crev[rt.key] || jt.byId("keyin").value || "";
        jt.byId("rdaccb").checked = crev.autocomp;
        if(html) {  //just initialized the key input, set for entry
            jt.byId('keyin').focus(); }
        app.review.runAutoComp();
    },


    dlgPicHTML = function () {
        var src, type, html;
        src = "img/nopicrev.png";
        type = verifyReviewImageDisplayType(crev);
        if(type === "upldpic") {
            src = "revpic?revid=" + jt.instId(crev) + 
                jt.ts("&cb", crev.modified); }
        else if(type === "sitepic") {
            src = sslSafeRef(jt.instId(crev), crev.imguri); }
        html = ["img", {id: "dlgrevimg", cla: "revimg", src: src}];
        return jt.tac2html(html);
    },


    dlgStarsHTML = function () {
        var imgfile, greyfile, rat, width, offset, html;
        imgfile = "img/stars18ptC.png"; 
        greyfile = "img/stars18ptCg.png";
        rat = app.review.starRating(crev.rating) || 0;
        if(crev.srcrev === -101) {
            return jt.tac2html(
                ["img", {cla: "starsimg", src: "img/future.png",
                         title: rat.title, alt: rat.title}]); }
        width = Math.floor(rat.step * (starimgw / rat.maxstep));
        html = [];
        html.push(["img", {cla: "starsimg", src: "img/blank.png",
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(rat.step % 2 === 1) {  //odd, use half star display
            offset = Math.floor(starimgw / rat.maxstep);
            html.push(
                ["img", {cla: "starsimg", src: "img/blank.png",
                         style: "width:" + (starimgw - width) + "px;" + 
                                "height:" + starimgh + "px;" +
                                "background:url('" + greyfile + "')" +
                                    " -" + offset + "px 0;",
                         title: rat.title, alt: rat.title}]); }
        else { //even, use full star display
            html.push(
                ["img", {cla: "starsimg", src: "img/blank.png",
                         style: "width:" + (starimgw - width) + "px;" + 
                                "height:" + starimgh + "px;" +
                                "background:url('" + greyfile + "');",
                         title: rat.title, alt: rat.title}]); }
        html = ["span", {id: "stardisp"}, html];
        return jt.tac2html(html);
    },


    dlgStarsActivate = function () {
        jt.on('rdstarsdiv', 'mousedown',   starPointing);
        jt.on('rdstarsdiv', 'mouseup',     starStopPointing);
        jt.on('rdstarsdiv', 'mouseout',    starStopPointingBoundary);
        jt.on('rdstarsdiv', 'mousemove',   starPointAdjust);
        jt.on('rdstarsdiv', 'click',       starClick);
        jt.on('rdstarsdiv', 'touchstart',  starPointing);
        jt.on('rdstarsdiv', 'touchend',    starStopPointing);
        jt.on('rdstarsdiv', 'touchcancel', starStopPointing);
        jt.on('rdstarsdiv', 'touchmove',   starPointAdjust);
        return true;
    },


    dlgStarsDeactivate = function () {
        jt.off('rdstarsdiv', 'mousedown',   starPointing);
        jt.off('rdstarsdiv', 'mouseup',     starStopPointing);
        jt.off('rdstarsdiv', 'mouseout',    starStopPointingBoundary);
        jt.off('rdstarsdiv', 'mousemove',   starPointAdjust);
        jt.off('rdstarsdiv', 'click',       starClick);
        jt.off('rdstarsdiv', 'touchstart',  starPointing);
        jt.off('rdstarsdiv', 'touchend',    starStopPointing);
        jt.off('rdstarsdiv', 'touchcancel', starStopPointing);
        jt.off('rdstarsdiv', 'touchmove',   starPointAdjust);
        return true;
    },


    dlgFieldInputHTML = function (fldn) {
        return ["div", {id: fldn + "div", cla: "rdfindiv"},
                ["input", {id: fldn + "in", type: "text", 
                           cla: "lifin", placeholder: fldn.capitalize()}]];
    },


    dlgDetailsEntry = function () {
        var rt, html, fldttl;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no key field entry yet.
            return; }
        if(!jt.byId("rdpfdiv").innerHTML) {
            html = [["div", {id: "rdstarsdiv"}, dlgStarsHTML()]];
            if(rt.subkey) {
                html.push(dlgFieldInputHTML(rt.subkey)); }
            rt.fields.forEach(function (field) {
                html.push(dlgFieldInputHTML(field)); });
            //onclick the div in case the enclosing image is broken
            //and can't function as a link to bring up the dialog
            html = [["div", {id: "rdpicdiv",
                             onclick: jt.fs("app.review.picdlg()")}, 
                     dlgPicHTML()],
                    ["div", {id: "rdfutcbdiv"},
                     ["input", {type: "checkbox", id: "rdfutcb",
                                name: "futuremembicmarkercheckbox",
                                onclick: jt.fsd("app.review.togglefuture()"),
                                checked: jt.toru(crev.srcrev === -101)}]],
                    html];
            jt.out("rdpfdiv", jt.tac2html(html));
            dlgStarsActivate(); }
        jt.out('rdpicdiv', dlgPicHTML());
        if(rt.subkey) {
            jt.byId(rt.subkey + "in").value = crev[rt.subkey] || ""; }
        rt.fields.forEach(function (field) {
            jt.byId(field + "in").value = crev[field] || ""; });
        fldttl = (rt.subkey? 1 : 0) + rt.fields.length;
        if(fldttl <= 1) {
            jt.byId('rdpicdiv').style.height = "80px"; }
        else if(fldttl <= 2) {
            jt.byId('rdpicdiv').style.height = "100px"; }
    },


    dlgTextEntry = function () {
        var rt, ptxt, html;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no text entry yet.
            return; }
        if(!jt.byId("rdtextdiv").innerHTML) {
            ptxt = "Why is this memorable? Please tell your future self why you are posting (you'll appreciate it later).";
            html = ["textarea", {id: "rdta", placeholder: ptxt,
                                 onchange: jt.fs("app.review.revtxtchg()")},
                    crev.text || ""];
            jt.out('rdtextdiv', jt.tac2html(html)); }
        //text is not dynamically updated
    },


    dlgKeywordEntry = function () {
        var rt, html, pen, chk;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no keyword entry yet
            return; }
        crev.keywords = crev.keywords || "";
        html = [];
        pen = app.pen.myPenName();
        app.pen.verifyStashKeywords(pen);
        pen.stash.keywords[rt.type].csvarray().forEach(function (dkword, i) {
            chk = jt.toru(crev.keywords.indexOf(dkword) >= 0, "checked");
            html.push(["div", {cla: "rdkwcbdiv"},
                       [["input", {type: "checkbox", id: "dkw" + i,
                                   value: dkword, checked: chk,
                                   //onchange only fires onblur if <IE8
                                   onclick: jt.fsd("app.review.togkey('dkw" + 
                                                   i + "')")}],
                        ["label", {fo: "dkw" + i}, dkword]]]); });
        html = [["div", {id: "rdkwcbsdiv"}, html]];
        html.push(["div", {id: "rdkwindiv"},
                   [["label", {fo: "rdkwin", cla: "liflab", id: "rdkwlab"},
                     ["a", {href: "#keywordsdescription",
                            onclick: jt.fs("app.review.kwhelpdlg()")},
                      "Keywords"]],
                    ["input", {id: "rdkwin", cla: "lifin", type: "text", 
                               value: crev.keywords}]]]);
        jt.out('rdkwdiv', jt.tac2html(html));
    },


    postedCoopRevId = function (ctmid, rev) {
        var revid;
        rev = rev || crev;
        convertOldThemePostLabel(rev);
        if(!rev.svcdata || !rev.svcdata.postctms) {
            return 0; }
        revid = 0;
        rev.svcdata.postctms.every(function (ctm) {
            if(ctm.ctmid === ctmid) {
                revid = ctm.revid;
                return false; }
            return true; });
        return revid;
    },


    displayThemeCheckboxes = function (ctm) {
        var html = [], chk, kwid;
        ctm.keywords = ctm.keywords || "";
        ctm.keywords.csvarray().forEach(function (kwd, idx) {
            chk = jt.toru(crev.keywords.indexOf(kwd) >= 0, "checked");
            kwid = "ctm" + jt.instId(ctm) + "kw" + idx;
            html.push(["div", {cla: "rdkwcbdiv"},
                       [["input", {type: "checkbox", id: kwid, 
                                   cla: "keywordcheckbox",
                                   value: kwd, checked: chk,
                                   onclick: jt.fsd("app.review.togkey('" +
                                                   kwid + "')")}],
                        ["label", {fo: kwid}, kwd]]]); });
        jt.out("ctmkwdiv" + jt.instId(ctm), jt.tac2html(html));
    },


    dlgCoopPostSelection = function () {
        var rt, ctms, html = [];
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no keyword entry yet
            return; }
        ctms = app.pen.postableCoops();
        ctms.forEach(function (ctm) {
            var posted = jt.toru(postedCoopRevId(ctm.ctmid));
            html.push(["div", {cla: "rdctmdiv"},
                       [["div", {cla: "rdglpicdiv"},
                         ["img", {cla: "rdglpic", alt: "",
                                  src: "ctmpic?coopid=" + ctm.ctmid}]],
                        ["input", {type: "checkbox", id: "dctmcb" + ctm.ctmid,
                                   cla: "keywordcheckbox",
                                   value: ctm.ctmid, checked: posted,
                                   onclick: jt.fsd("app.review.togctmpost('" +
                                                   ctm.ctmid + "')")}],
                        ["label", {fo: "dctm" + ctm.ctmid, cla: "penflist"}, 
                         ctm.name],
                        ["div", {cla: "ctmkwdiv", 
                                 id: "ctmkwdiv" + ctm.ctmid}]]]); });
        if(html.length > 0) {
            html.unshift(["div", {cla: "formline"}]);
            html.unshift(["div", {cla: "liflab"}, "Post To"]); }
        jt.out('rdgdiv', jt.tac2html(html));
        ctms.forEach(function (ctm) {
            app.review.togctmpost(ctm.ctmid); });
    },


    setAllCheckboxes = function (value, checked) {
        //getElementsByClassName returns partial results macFF42
        var nodes = document.getElementsByTagName("input");
        value = value.trim();
        Array.prototype.forEach.call(nodes, function (node) {
            if(node.type === "checkbox" && node.value.trim() === value) {
                node.checked = checked; } });
    },


    revurl = function (rev) {
        if(rev.ctmid && rev.ctmid !== "0") {
            return "?view=coop&coopid=" + rev.ctmid + "&tab=recent&expid=" +
                jt.instId(rev); }
        return "?view=pen&penid=" + rev.penid + "&tab=recent&expid=" +
            jt.instId(rev);
    },


    typeAndTitle = function (type, rev, togclick) {
        var html;
        html = [["img", {cla: "reviewbadge", src: "img/" + type.img,
                         title: type.type, alt: type.type}],
                "&nbsp;",
                app.pcd.reviewItemNameHTML(type, rev)];
        html = ["a", {href: revurl(rev), onclick: togclick},
                html];
        return html;
    },


    cacheNames = function (rev) {
        app.pennames[rev.penid] = rev.penname;
        convertOldThemePostLabel(rev);
        if(rev.svcdata && rev.svcdata.postctms) {
            rev.svcdata.postctms.forEach(function (ctm) {
                //prefer earlier cached names if already set.
                if(!app.coopnames[ctm.ctmid]) {
                    app.coopnames[ctm.ctmid] = ctm.name; } }); }
    },


    dlgTweetButton = function () {
        var params, tbs = jt.byId("tweetbuttondiv");
        if(!tbs || !findReviewType(crev.revtype)) {
            return; }
        notePostingCoops();  //populates rev.ctmids csv from checkboxes
        reviewTextValid();   //populates crev.text
        params = {text: crev.text,
                  url: crev.url || app.pen.myPenPermalink(),
                  hashtags: app.layout.hashtagsCSV(
                      crev.title + " " + crev.name + " " + crev.text,
                      crev.ctmids)};
        jt.out('tweetbuttondiv', jt.tac2html(
            ["a", {cla: "twitter-share-button", id: "tweetbuttonanchor",
                   href: "https://twitter.com/intent/tweet?" + 
                   jt.objdata(params)},
             ["img", {src: "img/twitter32.png"}]]));
        window.twttr = (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0],
            t = window.twttr || {};
            if (d.getElementById(id)) { return t; }
            js = d.createElement(s);
            js.id = id;
            js.src = "https://platform.twitter.com/widgets.js";
            fjs.parentNode.insertBefore(js, fjs);
            t._e = [];  //Bad property name '_e'. Twitter likes it that way.
            t.ready = function(f) {
                t._e.push(f);
            };
            return t;
        }(document, "script", "twitter-wjs"));
    },


    updateReviewDialogContents = function () {
        dlgRevTypeSelection();
        dlgKeyFieldEntry();
        dlgDetailsEntry();
        dlgTextEntry();
        dlgKeywordEntry();
        dlgCoopPostSelection();
    },


    noteSaveError = function (statdivid, code, errtxt) {
        if(!code) {  
            //Most like the server just hung up on us and couldn't
            //even be bothered to send a status code.  Guess it was
            //too busy.  Usually the save works if you try again a
            //second time, and that's what most people will do if
            //nothing happens, so better to just eat this error rather
            //than bothering to display a potentially confusing and
            //vague error message.  Log and continue.
            jt.log("Save fail 0: Call completed but not successful");
            return; }
        jt.out(statdivid, "Save fail " + code + ": " + errtxt);
    },


    signInErr = function (errtxt, prefix, disprevid) {
        var html, href = "", yc;
        if(app.solopage()) {
            href = "?" + jt.objdata(app.login.permalinkURLElemsToParams());
            href = app.hardhome + href;
            html = ["div", {id: "siedlgdiv"},
                    [["div", {cla: "pcdsectiondiv"},
                      ["a", {href: href},
                       [["img", {cla: "reviewbadge", 
                                 src: "img/membiclogo.png"}],
                        errtxt]]],
                     ["div", {cla: "dlgbuttonsdiv"},
                      [["button", {type: "button", id: "cancelsieb",
                                   onclick: jt.fs("app.layout.closeDialog()")},
                        "Cancel"],
                       ["button", {type: "button", id: "redirsieb",
                                   onclick: jt.fs("app.redirect('" + href + 
                                                  "')")},
                        "Go to main site"]]]]];
            html = app.layout.dlgwrapHTML("&nbsp", html);
            yc = window.pageYOffset + 60;
            if(prefix && disprevid) {
                try {
                    yc = jt.geoPos(jt.byId(
                        prefix + disprevid + "buttonsdiv")).y;
                } catch (problem) {
                    jt.log("y offset for error dlg: " + problem);
                } }
            app.layout.openDialog({x: 50, y: yc},
                                  jt.tac2html(html)); }
        if(!html) {
            jt.err(errtxt); }
        return errtxt;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        autourl = "";
        crev = { autocomp: true };
        autocomptxt = "";
    },


    start: function (source) {
        var html;
        app.review.resetStateVars();
        if(app.login.accountInfo("status") !== "Active") {
            jt.err("You need to activate your account before posting");
            return app.pcd.display("pen", app.pen.myPenId(), "latest",
                                   app.pen.myPenName(), "settings"); }
        if(!app.pen.myPenName().profpic) {
            jt.err("You need a profile picture to identify your membics");
            return app.pcd.display("pen"); }
        if(typeof source === 'string') {  //passed in a url
            autourl = source; }
        if(typeof source === 'object') {  //passed in another review
            crev = copyReview(source);
            if(source.penid === app.pen.myPenId()) {
                app.coop.faultInPostThroughCoops(source); }
            else {
                makeMine(crev, jt.instId(source)); } }
        crev.penid = app.pen.myPenId();
        html = ["div", {id: "revdlgdiv"},
                [["div", {id: "rdtypesdiv"}],
                 ["div", {id: "rdtypepromptdiv"}],
                 ["div", {id: "rdurldiv"},
                  [["label", {fo: "urlin", cla: "liflab"}, "URL"],
                   ["input", {id: "urlin", cla: "lifin", type: "url"}],
                   ["span", {id: "rdurlbuttonspan"}, dlgReadButtonHTML()],
                   ["div", {id: "rdstat1"}]]],
                 ["div", {id: "rdkeyindiv"}],
                 ["div", {id: "rdpfdiv"}],     //pic, stars, fields
                 ["div", {id: "rdtextdiv"}],
                 ["div", {id: "rdkwdiv"}],
                 ["div", {id: "rdgdiv"}],
                 ["div", {id: "tweetbuttondiv"}],
                 ["div", {id: "rdokdiv"},
                  [["div", {id: "rdokstatdiv"}],
                   ["div", {id: "rdokbuttondiv", cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "okbutton",
                                onclick: jt.fs("app.review.save()")},
                     "Ok"]]]],
                 ["div", {id: "rdextradiv"}]]];
        html = app.layout.dlgwrapHTML("Make Membic", html);
        app.layout.openDialog(
            {x: jt.byId("headingdivcontent").offsetLeft - 34, 
             y: window.pageYOffset + 22},
            jt.tac2html(html), updateReviewDialogContents, dlgTweetButton);
    },


    updatedlg: function (typename) {
        app.layout.cancelOverlay(true);  //close if already open or done
        if(typename) {
            jt.out('rdokstatdiv', "");  //clear errs e.g. "need to choose type"
            //rebuild the pic and details area
            if(jt.byId('rdstarsdiv') && crev.srcrev !== -101) {
                //turn off the star functions if they were active
                dlgStarsDeactivate();
                jt.out('rdpfdiv', ""); }
            crev.revtype = typename; }
        updateReviewDialogContents();
        dlgTweetButton();
    },

    
    monitorPicUpload: function () {
        var ptdif, txt, revid, ridlabel = "revid: ";
        ptdif = jt.byId('ptdif');
        if(ptdif) {
            txt = ptdif.contentDocument || ptdif.contentWindow.document;
            if(txt) {
                txt = txt.body.innerHTML;
                if(txt.indexOf(ridlabel) === 0) {
                    revid = txt.slice(ridlabel.length);
                    jt.setInstId(crev, revid);
                    crev.revpic = revid;
                    jt.byId('upldpicimg').src = "revpic?revid=" + revid;
                    displayUploadedPicLabel();
                    return; }
                if(txt.indexOf("Error: ") === 0) {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(app.review.monitorPicUpload, 800); }
    },


    autocompletion: function (/*event*/) {
        var cb, srchtxt;
        cb = jt.byId("rdaccb");
        if(!cb || !cb.checked) {
            //jt.log("autocomp rdaccb not found or not checked");
            jt.out('revautodiv', "");
            return; }
        if(crev.autocomp && jt.byId('revautodiv') && jt.byId('keyin')) {
            srchtxt = jt.byId('keyin').value;
            if(jt.byId('subkeyin')) {
                srchtxt += " " + jt.byId('subkeyin').value; }
            if(srchtxt !== autocomptxt) {
                //jt.log("autocomp new srchtxt: " + srchtxt);
                autocomptxt = srchtxt;
                if(crev.revtype === 'book' || crev.revtype === 'movie' ||
                   crev.revtype === 'music') {
                    callAmazonForAutocomplete(app.review.autocompletion); }
                else if(crev.revtype === 'yum' || crev.revtype === 'activity') {
                    callGooglePlacesAutocomplete(app.review.autocompletion); } }
            else {
                setTimeout(app.review.autocompletion, 750); } }
    },


    runAutoComp: function () {
        var cb = jt.byId("rdaccb");
        crev.autocomp = cb && cb.checked;
        if(crev.autocomp) {
            autocomptxt = "";  //reset so search happens if toggling back on
            app.review.autocompletion(); }
        else {
            jt.out('revautodiv', ""); }
    },


    togglefuture: function () {
        if(crev.srcrev === -101) {
            crev.srcrev = 0;
            jt.out('rdstarsdiv', jt.tac2html(dlgStarsHTML()));
            dlgStarsActivate(); }
        else {
            crev.srcrev = -101;
            dlgStarsDeactivate();
            jt.out('rdstarsdiv', jt.tac2html(dlgStarsHTML())); }
    },


    readURL: function (url, params) {
        var urlin, errs = [], rbc;
        if(!params) {
            params = {}; }
        if(!url) {
            urlin = jt.byId('urlin');
            if(urlin) {
                url = urlin.value; } }
        if(!url) {  //reflect any other updates done in the interim.
            crev.autocomp = false;
            return app.review.updatedlg(); }
        if(crev.title && !crev.autocomp &&
           !confirm("Re-read title and other fields?")) {
            return; }
        //If the title or other key fields are not valid, that's ok because
        //we are about to read them. But don't lose comment text.
        reviewTextValid(null, errs);
        if(errs.length > 0) {
            return; }
        url = url.trim();
        if(url) {
            rbc = jt.byId('rdurlbuttonspan');
            if(rbc) {
                rbc.innerHTML = "reading..."; }
            if(url.toLowerCase().indexOf("http") !== 0) {
                url = "http://" + url; }
            crev.url = url;
            autourl = url;
            crev.autocomp = false;
            readParameters(params);
            getURLReader(autourl, function (reader) {
                reader.fetchData(crev, url, params); }); }
        else {
            app.review.updatedlg(); }
    },


    getReviewTypes: function () {
        return reviewTypes;
    },


    getReviewTypeByValue: function (val) {
        return findReviewType(val);
    },


    starsImageHTML: function (rating, mode) {
        return starsImageHTML(rating, mode);
    },


    setType: function (type) {
        crev.revtype = type;
        app.review.display();
    },


    keywordcsv: function (kwid, keycsv) {
        var cbox = jt.byId(kwid),
            text = "",
            keywords = keycsv.split(",");
        keywords.forEach(function (kw) {
            if(kw) {
                kw = kw.trim(); }
            if(kw && !text.csvcontains(kw)) {
                text = text.csvappend(kw); } });
        if(cbox) {
            if(cbox.checked) {
                text = text.csvappend(cbox.value); }
            else {
                text = text.csvremove(cbox.value.trim()); }
            setAllCheckboxes(cbox.value, cbox.checked); }
        text = text.replace(/,/g, ", ");
        return text;
    },


    togkey: function (kwid) {
        var rdkwin, keycsv;
        rdkwin = jt.byId('rdkwin');
        keycsv = app.review.keywordcsv(kwid, rdkwin.value);
        rdkwin.value = keycsv;
    },


    togctmpost: function (ctmid) {
        var cbox = jt.byId("dctmcb" + ctmid);
        if(cbox) {
            if(cbox.checked) {
                //need the full reference for the checkbox definitions,
                //but don't want to fault in just the coop without the
                //supporting revs and other needed info.
                app.pcd.blockfetch("coop", ctmid, function (coop) {
                    dlgTweetButton();  //note any hashtags
                    displayThemeCheckboxes(coop); }, "ctmkwdiv" + ctmid); }
            else {
                jt.out("ctmkwdiv" + ctmid, ""); } }
    },


    revtxtchg: function () {
        dlgTweetButton();
    },


    save: function (skipvalidation) {
        var errors, data, html;
        //remove save button immediately to avoid double click dupes...
        html = jt.byId('rdokbuttondiv').innerHTML;
        if(!skipvalidation) {
            jt.out('rdokbuttondiv', "Verifying...");
            errors = validateCurrentReviewFields();
            if(errors.length > 0) {
                jt.out('rdokstatdiv', errors.reduce(function (pv, cv) {
                    return pv + cv + "<br/>"; }, ""));
                jt.out('rdokbuttondiv', html); 
                return; }
            if(!app.coop.confirmPostThrough(crev)) {
                jt.out('rdokbuttondiv', html);
                return; }}
        jt.out('rdokbuttondiv', "Saving...");
        app.layout.cancelOverlay(true);  //just in case it is still up
        app.onescapefunc = null;
        app.review.serializeFields(crev);
        data = jt.objdata(crev);
        app.review.deserializeFields(crev); //in case update fail or interim use
        jt.call('POST', "saverev?" + app.login.authparams(), data,
                function (updobjs) {
                    var updpen, updrev, revs;
                    updpen = updobjs[0];
                    updrev = updobjs[1];
                    jt.out('rdokbuttondiv', "Saved.");
                    revs = app.lcs.resolveIdArrayToCachedObjs(
                        "rev", app.pen.myPenName().recent || []);
                    revs = app.activity.insertOrUpdateRev(revs, updrev);
                    updpen.recent = app.lcs.objArrayToIdArray(revs);
                    app.lcs.put("pen", updpen);
                    cacheBustCoops(crev.ctmids);
                    crev = copyReview(app.lcs.put("rev", updrev));
                    app.activity.updateFeeds(updrev);
                    cacheBustPersonalReviewSearches();
                    app.layout.closeDialog();
                    app.login.doNextStep({}); },
                app.failf(function (code, errtxt) {
                    jt.out('rdokbuttondiv', html);
                    noteSaveError('rdokstatdiv', code, errtxt); }),
                jt.semaphore("review.save"));
    },


    setCurrentReview: function (revobj) {
        crev = revobj;
    },


    getCurrentReview: function () {
        return crev;
    },


    jumpLinkHTML: function (review, type) {
        var qurl, html;
        if(!review) {
            return ""; }
        if(!review.url) {
            qurl = review[type.key];
            if(!qurl) {
                return ""; }
            if(type.subkey) { 
                qurl += " " + review[type.subkey]; }
            qurl = jt.enc(qurl);
            qurl = "https://www.google.com/?q=" + qurl + "#q=" + qurl;
            html = ["a", {href: qurl, 
                         title: "Search for " + jt.ndq(review[type.key]),
                         onclick: jt.fs("window.open('" + qurl + "')")},
                    ["img", {cla: "webjump", src: "img/search.png"}]];
            return jt.tac2html(html); }
        html = ["a", {href: review.url, title: review.url,
                      onclick: jt.fs("window.open('" + review.url + "')")},
                ["img", {cla: "webjump", src: "img/gotolink.png"}]];
        return jt.tac2html(html);
    },


    picdlg: function (picdisp) {
        var dt, revid, html;
        if(picdisp) {
            crev.scvdata = crev.svcdata || {};
            crev.svcdata.picdisp = picdisp; }
        dt = verifyReviewImageDisplayType(crev);
        revid = jt.instId(crev);
        html = ["div", {id: "revpicdlgdiv"},
                [["ul", {cla: "revpictypelist"},
                  [["li",
                    [["input", { type: "radio", name: "upt", value: "sitepic",
                                 checked: jt.toru(dt === "sitepic"),
                                 onchange: revfs("picdlg('sitepic')")}],
                     ["div", {id: "sitepicdetaildiv", cla: "ptddiv"},
                      [["img", {id: "sitepicimg", cla: "revimgdis",
                                src: crev.imguri || "img/nopicprof.png",
                                onclick: revfs("picdlg('sitepic')")}],
                       ["div", {id: "sitepicform", cla: "overform"}]]]]],
                   ["li",
                    [["input", {type: "radio", name: "upt", value: "upldpic",
                                checked: jt.toru(dt === "upldpic"),
                                onchange: revfs("picdlg('upldpic')")}],
                     ["div", {id: "upldpicdetaildiv", cla: "ptddiv"},
                      [["img", {id: "upldpicimg", cla: "revimgdis",
                                src: (crev.revpic ? ("revpic?revid=" + revid + 
                                                    jt.ts("&cb", crev.modified))
                                                  : "img/nopicprof.png"),
                                onclick: revfs("picdlg('upldpic')")}],
                       ["div", {id: "upldpicform", cla: "overform"}]]]]],
                   ["li",
                    [["input", {type: "radio", name: "upt", value: "nopic",
                                checked: jt.toru(dt === "nopic"),
                                onchange: revfs("picdlg('nopic')")}],
                     ["span", {cla: "ptdlabspan"}, "No Pic"]]]]]]];
        app.layout.openOverlay(app.layout.placerel("dlgrevimg", -5, -80), 
                               html, null, picdlgModForm,
                               jt.fs("app.review.updatedlg()"));
    },


    sitepicupd: function () {
        var url;
        jt.out('pdtsustatdiv', "");
        url = jt.byId('pdturlin').value;
        if(!url) {
            jt.out('pdtsustatdiv', "Need URL value");
            return; }
        crev.imguri = url;
        jt.byId('sitepicimg').src = url;
        displaySitePicLabel();
    },


    rotateupldpic: function () {
        var revid, picsrc, data, elem;
        revid = jt.instId(crev);
        data = "revid=" + revid + "&penid=" + app.pen.myPenId();
        jt.out('pdtfbuttondiv', "Rotating...");
        jt.call('POST', "rotatepic?" + app.login.authparams(), data,
                function (reviews) {
                    //the updated review is partial, don't replace crev
                    crev.modified = reviews[0].modified;
                    picsrc = "revpic?revid=" + revid + 
                        jt.ts("&cb", crev.modified);
                    jt.out('pdtfbuttondiv', jt.tac2html(rotatePicButtonHTML()));
                    elem = jt.byId("revimg" + revid);
                    if(elem) {
                        elem.src = picsrc; }
                    elem = jt.byId("dlgrevimg");
                    if(elem) {
                        elem.src = picsrc; }
                    jt.byId('upldpicimg').src = picsrc; },
                app.failf(function (code, errtxt) {
                    jt.out('pdtfbuttondiv', jt.tac2html(rotatePicButtonHTML()));
                    jt.err("rotate pic failed " + code + ": " + errtxt); }),
                jt.semaphore("review.rotateupldpic"));
    },


    kwhelpdlg: function () {
        var html = ["div", {id: "revpicdlgdiv"},  //re-using pic dialog..
                    ["div", {cla: "kwhelpdlg"},
                     [["p", "Keywords provide helpful meta-descriptive tags for information and search. Select keywords by checking the boxes, or entering words into the text box separated by commas."],
                      ["p", "To change which keywords are shown with checkboxes, go to your profile settings."]]]];
        app.layout.openOverlay(app.layout.placerel("rdkwindiv", -5, -100),
                               html);
    },


    starRating: function (rating, roundup) {
        var starsobj = {}, step,
            starTitles = [ "No stars", "Half a star", 
                           "One star", "One and a half stars",
                           "Two stars", "Two and a half stars",
                           "Three stars", "Three and a half stars",
                           "Four stars", "Four and a half stars",
                           "Five stars" ],
            roundNumeric = [ 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5 ],
            asterisks = [ "0", "+", "*", "*+", "**", "**+", "***", "***+",
                          "****", "****+", "*****" ],
            unicodestr = [ "0", "\u00BD", "\u2605", "\u2605\u00BD", 
                           "\u2605\u2605", "\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605", 
                           "\u2605\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605\u2605", 
                           "\u2605\u2605\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605\u2605\u2605" ];
        if(typeof rating === "string") { 
            rating = parseInt(rating, 10); }
        if(!rating || typeof rating !== 'number' || rating < 0) { 
            rating = 0; }
        if(rating > 93) {  //compensate for floored math (number by feel)
            rating = 100; }
        step = Math.floor((rating * (starTitles.length - 1)) / 100);
        if(roundup) {
            step = Math.min(step + 1, starTitles.length - 1);
            rating = Math.floor((step / (starTitles.length - 1)) * 100); }
        starsobj.value = rating;
        starsobj.step = step;
        starsobj.maxstep = starTitles.length - 1;
        starsobj.title = starTitles[step];
        starsobj.roundnum = roundNumeric[step];
        starsobj.asterisks = asterisks[step];
        starsobj.unicode = unicodestr[step];
        return starsobj;
    },


    selectLocLatLng: function (latlng, ref, retry, errmsg) {
        var mapdiv, map, maxretry = 10, html;
        retry = retry || 0;
        if(errmsg) {
            jt.log("selectLocLatLng error: " + errmsg); }
        if(retry > maxretry) {
            verifyGeocodingInfoDiv(true);
            html = jt.byId('geocodingInfoDiv').innerHTML;
            html = ["div", {id: "geocodingInfoDiv"},
                    [["div",
                      "There were problems calling the google.maps service."],
                     html,
                     ["p"],
                     ["div",
                      "This normally just works. Try reloading the site, " + 
                      "or send this error to " + app.suppemail + " so " + 
                      "someone can look into it."]]];
            html = app.layout.dlgwrapHTML("Geocoding Error", html);
            app.layout.openDialog({y:140}, jt.tac2html(html));
            return; }
        if(!gplacesvc && google && google.maps && google.maps.places) {
            try {  //this can fail if the map is not ready yet
                mapdiv = jt.byId('mapdiv');
                map = new google.maps.Map(mapdiv, {
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: latlng,
                    zoom: 15 });
                gplacesvc = new google.maps.places.PlacesService(map);
            } catch (problem) {
                gplacesvc = null;
                noteServiceError(retry, problem);
                setTimeout(function () {
                    app.review.selectLocLatLng(latlng, ref, retry + 1, problem);
                    }, 200 + (100 * retry));
                return;
            } }
        if(gplacesvc && ref) {
            gplacesvc.getDetails({reference: ref},
                function (place, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        crev.address = place.formatted_address;
                        crev.name = place.name || jt.byId('keyin').value;
                        crev.url = crev.url || place.website || "";
                        app.review.readURL(crev.url); }
                    }); }
    },

        
    selectLocation: function (addr, ref) {
        var errlines = [
            "Not going to be able to fill out the url and address",
            "from the location you selected. This normally just works.",
            "If you could email this message to " + app.suppemail,
            "someone can investigate.  You can also try reloading",
            "the site in your browser to see if that helps."];
        if(addr) {  //even if all other calls fail, use the selected name
            jt.byId('keyin').value = jt.dec(addr); }
        if(!geoc && google && google.maps && google.maps.places) {
            geoc = new google.maps.Geocoder();
            if(!geoc) {
                errlines.unshift("Initializing google.maps.Geocoder failed.");
                jt.err(errlines.join("\n")); } }
        if(geoc && addr) {
            addr = jt.dec(addr);
            jt.out('revautodiv', jt.tac2html(["p", addr]));
            verifyGeocodingInfoDiv();
            try {
                geoc.geocode({address: addr}, function (results, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        app.review.selectLocLatLng(
                            results[0].geometry.location, ref); }
                    else {
                        errlines.unshift("PlacesServiceStatus not OK");
                        jt.err(errlines.join("\n")); }
                });
            } catch (problem) {
                errlines.unshift("Error geocoding: " + problem);
                jt.err(errlines.join("\n"));
            } }
    },


    //If the user manually entered a bad URL, then the reader will
    //fail and it is better to clear out the badly pasted value than
    //to continue with it as if it was good.  Arguably the correct
    //thing would be to provide the bad URL for them to edit, but I'm
    //guessing numerous users will not know how to edit a URL and just
    //get stuck in a loop entering the same busted value.  Clearing it
    //out makes them cut and paste it again which is the best hope of
    //getting a reasonable value.  If they are using the bookmarklet
    //then this never happens, so good enough.
    resetAutoURL: function () {
        autourl = "";
        updateReviewDialogContents();
    },


    picHTML: function (review, type, mode) {
        return revFormImageHTML(review, type, "defined", "listing", mode);
    },


    fpbToggleHelpful: function (prefix, disprevid, updrevid, retries) {
        var rev, url;
        if(!app.pen.myPenName()) {
            return signInErr("Sign in to mark this membic as helpful.",
                             prefix, disprevid); }
        rev = app.lcs.getRef("rev", updrevid).rev;
        if(rev.helpful && rev.helpful.csvarray().length >= 123) {
            return jt.err("This membic has reached max stars already."); }
        jt.out(prefix + disprevid + "helpfuldiv", 
               fpbHelpfulButtonHTML(prefix, disprevid, updrevid, true));
        //disconnect update call from screen update
        setTimeout(function () {
            url = "toghelpful?" + app.login.authparams() + 
                "&penid=" + app.pen.myPenId() + "&revid=" + updrevid +
                "&disprevid=" + disprevid + jt.ts("&cb=", "second");
            jt.call('GET', url, null,
                    function (reviews) {
                        app.lcs.put("rev", reviews[0]);
                        app.activity.updateFeeds(reviews[0]);
                        jt.out(prefix + disprevid + "helpfuldiv",
                               fpbHelpfulButtonHTML(
                                   prefix, disprevid, updrevid)); },
                    app.failf(function (code, errtxt) {
                        if(!retries || retries < 3) {
                            retries = retries || 0;
                            return app.review.fpbToggleHelpful(
                                prefix, disprevid, updrevid, retries + 1); }
                        jt.err("Toggle helpful call failed " + code + 
                               ": " + errtxt); }),
                    jt.semaphore("review.toggleHelpful")); }, 50);
    },


    fpbToggleRemember: function (prefix, disprevid, updrevid) {
        var url;
        if(!app.pen.myPenName()) {
            return signInErr("Sign in to remember this membic.",
                             prefix, disprevid); }
        jt.out(prefix + disprevid + "rememberdiv",
               fpbRememberButtonHTML(prefix, disprevid, updrevid, true));
        //disconnect update call from screen update
        setTimeout(function () {
            url = "togremember?" + app.login.authparams() +
                "&penid=" + app.pen.myPenId() + "&revid=" + updrevid +
                "&disprevid=" + disprevid + jt.ts("&cb=", "second");
            jt.call('GET', url, null,
                    function (pens) {
                        app.pen.noteUpdatedPen(pens[0]);
                        app.login.updateAuthentDisplay();
                        app.activity.resetRememberedFeed();
                        jt.out(prefix + disprevid + "rememberdiv",
                               fpbRememberButtonHTML(
                                   prefix, disprevid, updrevid)); },
                    app.failf(function (code, errtxt) {
                        jt.err("Toggle remember call failed " + code +
                               ": " + errtxt); }),
                    jt.semaphore("review.toggleRemember")); }, 50);
    },


    fpbWrite: function (prefix, disprevid, updrevid) {
        if(!app.pen.myPenName()) {
            return signInErr("Sign in to note your impressions.",
                             prefix, disprevid); }
        app.lcs.getFull("rev", updrevid, function (revref) {
            app.review.start(revref.rev); });
    },


    displayingExpandedView: function (prefix, revid) {
        var buttondivid = prefix + revid + "buttonsdiv";
        if(jt.byId(buttondivid).innerHTML) {
            return true; }
        return false;
    },


    revdispHTML: function (prefix, revid, rev, togfname) {
        var revdivid, type, html, togclick, snjattr;
        togfname = togfname || "app.review.toggleExpansion";
        togclick = jt.fs(togfname + "('" + prefix + "','" + revid + "')");
        revdivid = prefix + revid;
        type = app.review.getReviewTypeByValue(rev.revtype);
        fixReviewURL(rev);
        snjattr = {cla: "starsnjumpdiv", 
                   style: (app.winw < 600)? "float:right;" 
                                          : "display:inline-block;"};
        html = ["div", {cla: (prefix === "rrd"? "fpmeminrevdiv"
                                              : "fpinrevdiv")},
                [["div", {cla: "fpbuttonsdiv", 
                          id: revdivid + "buttonsdiv"}],
                 ["div", {cla: "fptitlediv"},
                  [typeAndTitle(type, rev, togclick),
                   "&nbsp;",
                   ["div", snjattr, 
                    [["div", {cla: "fpstarsdiv"},
                      app.review.starsImageHTML(rev)],
                     ["div", {cla: "fpjumpdiv"},
                      app.review.jumpLinkHTML(rev, type)]]]]],
                 ["div", {cla: "fpsecfieldsdiv", id: revdivid + "secdiv"}],
                 ["div", {cla: "fpdatediv", id: revdivid + "datediv"}],
                 ["div", {cla: "fpbodydiv"},
                  [["div", {cla: "fprevpicdiv"},
                    app.review.picHTML(rev, type)],
                   ["div", {cla: "fpdescrdiv", id: revdivid + "descrdiv"},
                    abbreviatedReviewText(prefix, revid, rev, togfname)],
                   ["div", {cla: "fpkeywrdsdiv", id: revdivid + "keysdiv"}],
                   ["div", {cla: "fpctmsdiv", id: revdivid + "ctmsdiv"},
                    postedCoopLinksHTML(rev)]]]]];
        return html;
    },


    isDupeRev: function (rev, pr) {
        if(rev && pr && ((rev.srcrev && rev.srcrev === pr.srcrev) || 
                         (rev.cankey === pr.cankey) ||
                         (rev.url && rev.url === pr.url))) {
            return true; }
        return false;
    },


    collateDupes: function (revs) {
        var result = [], j;
        revs.forEach(function (rev, i) {
            if(rev) {  //not previously set to null
                result.push(rev);
                //collate remaining revs
                for(j = i + 1; j < revs.length; j += 1) {
                    if(app.review.isDupeRev(revs[j], rev)) {
                        result.push(revs[j]);
                        revs[j] = null; } } } });
        return result;
    },


    filterByRevtype: function (revs, rt) {
        var filtered;
        if(rt && rt !== "all") {
            filtered = [];
            revs.forEach(function (rev) {
                if(rev.revtype === rt) {
                    filtered.push(rev); } });
            revs = filtered; }
        return revs;
    },


    displayReviews: function (divid, prefix, revs, togcbn, author, xem) {
        var rt, i, html, rev, pr, maindivattrs, authlink, vp, revdivid;
        rt = app.layout.getType();
        if(!revs || revs.length === 0) {
            if(rt === "all") {
                html = "No membics to display."; }
            else {
                rt = app.review.getReviewTypeByValue(rt);
                html = "No " + rt.plural + " found."; }
            if(xem) {  //display extra empty message (prompt to write)
                html = [html, xem]; } }
        else {
            html = []; }
        //Displaying more than 100 reviews gets overwhelming..
        for(i = 0; i < revs.length && i < 100; i += 1) {
            rev = revs[i];
            cacheNames(rev);
            revdivid = prefix + jt.instId(rev);
            pr = (i > 0)? revs[i - 1] : null;
            maindivattrs = {id: revdivid + "fpdiv", cla: "fpdiv"};
            if(app.review.isDupeRev(rev, pr)) {
                maindivattrs.style = "display:none"; }
            authlink = "";
            if(author) {
                vp = "";  //visual preferences (activity feed only)
                if(prefix === "afd" && rev.penid !== app.pen.myPenId()) {
                    vp = ["div", {cla: "fpprefstatdiv", 
                                  id: "fppsdiv" + revdivid},
                          ["a", {href: "#visprefs",
                                 onclick: jt.fs("app.pen.visprefs('" + 
                                                revdivid + "','" + 
                                                rev.penid + "','" + 
                                                jt.embenc(rev.penname) + "')")},
                           ["img", {cla: "feedprefimg", 
                                    src: app.pen.prefimg(rev.penid)}]]]; }
                authlink = 
                    ["div", {cla: "fpprofdiv"},
                     [["a", {href: "#view=pen&penid=" + rev.penid,
                             onclick: jt.fs("app.pen.bypenid('" + 
                                            rev.penid + "','review')")},
                       ["img", {cla: "fpprofpic", 
                                src: "profpic?profileid=" + rev.penid,
                                title: jt.ndq(rev.penname),
                                alt: jt.ndq(rev.penname)}]],
                      vp]]; }
            html.push(["div", maindivattrs,
                       [authlink,
                        ["div", {cla: (author? "fparevdiv" : "fpnarevdiv"),
                                 id: revdivid},
                         app.review.revdispHTML(prefix, jt.instId(rev), 
                                                rev, togcbn)]]]); }
        jt.out(divid, jt.tac2html(html));
    },


    toggleExpansion: function (revs, prefix, revid) {
        var i, rev, elem, revdivid;
        //locate the review and its associated index
        for(i = 0; i < revs.length; i += 1) {
            if(jt.instId(revs[i]) === revid) {
                rev = revs[i];
                break; } }
        if(!rev) {  //bad revid or bad call, nothing to do
            return; }
        if(i === 0 || !app.review.isDupeRev(revs[i - 1], rev)) {  //primary rev
            //toggle expansion on any associated dupes
            for(i += 1; i < revs.length; i += 1) {
                if(!app.review.isDupeRev(rev, revs[i])) {  //no more children
                    break; }
                elem = jt.byId(prefix + jt.instId(revs[i]) + "fpdiv");
                if(app.review.displayingExpandedView(prefix, revid)) {
                    elem.style.display = "none"; }
                else {
                    elem.style.display = "block"; } } }
        revdivid = prefix + revid;
        if(app.review.displayingExpandedView(prefix, revid)) {
            jt.out(revdivid + "buttonsdiv", "");
            jt.out(revdivid + "secdiv", "");
            jt.out(revdivid + "datediv", "");
            jt.out(revdivid + "descrdiv", 
                   abbreviatedReviewText(prefix, revid, rev));
            jt.out(revdivid + "keysdiv", "");
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
        else {  //expand
            app.layout.scrollToVisible(revdivid + "buttonsdiv");
            jt.out(revdivid + "buttonsdiv", revpostButtonsHTML(prefix, revid));
            jt.out(revdivid + "secdiv", fpSecondaryFieldsHTML(rev));
            jt.out(revdivid + "datediv", 
                   jt.colloquialDate(jt.ISOString2Day(rev.modified)));
            jt.out(revdivid + "descrdiv", jt.linkify(rev.text || ""));
            jt.out(revdivid + "keysdiv", rev.keywords);
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
    },


    serializeFields: function (rev) {
        if(typeof rev.svcdata === 'object') {
            rev.svcdata = JSON.stringify(rev.svcdata); }
        else {
            rev.svcdata = ""; }
    },


    deserializeFields: function (rev) {
        app.lcs.reconstituteJSONObjectField("svcdata", rev);
    }

}; //end of returned functions
}());

