/*global window, confirm, app, jt, google, document */

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
        crev = {},  //The current review being displayed or edited.
        //If changing the width or height of the stars img, also change
        //profile.reviewItemHTML indent
        starimgw = 85,
        starimgh = 15,
        starPointingActive = false,  //true if star sliding active
        monitor = null,
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
        if(typeof rating !== "number") {
            mode = mode || (rating.srcrev === "-101" ? "prereview" : "read");
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


    reviewTextValid = function (ignore /*type*/, errors) {
        var errmsg, input = jt.byId("rdta");
        if(input) {
            crev.text = input.value;
            if(!crev.text && errors) {
                errmsg = "Why memorable?";
                errors.push(errmsg); } }
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
        var uo;
        if(!rev.url) {
            return; }  //nothing to fix
        if(rev.url.indexOf("amazon.com") >= 0) {
            //sometimes urls have been recorded with duplicate encoding
            if(rev.url.indexOf("-20%26") >= 0) {
                rev.url = jt.dec(rev.url); }
            if(rev.url.indexOf("?") > 0 && rev.url.indexOf("&tag=") > 0) {
                uo = {pvs:[{attr:"SubscriptionId", val:"AKIAJK6TWJBQGIYJ4ENA"},
                           {attr:"tag", val:"epinova-20"}],
                      bq: rev.url.split("?")};
                uo.parsed = jt.paramsToObj(uo.bq[1], null, "String");
                uo.pvs.forEach(function (pv) {
                    uo.parsed[pv.attr] = pv.val; });
                rev.url = uo.bq[0] + "?" + jt.objdata(uo.parsed); } }
    },


    sourceRevId = function (review) {
        var srcid = jt.instId(review);
        if(review.ctmid && review.ctmid !== "0") {
            srcid = review.srcrev; }
        return srcid;
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
            //Use source rev img for theme posts to take advantage of caching.
            html.src = "revpic?revid=" + sourceRevId(review) + 
                jt.ts("&cb=", review.modified);
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
        input = jt.byId("urlin");
        if(input) {
            crev.url = input.value; }
    },


    keyFieldsValid = function (type, errors) {
        var cankey, input = jt.byId("keyin");
        if(!input || !input.value) {
            errlabel("keyinlabeltd");
            errors.push("Need a " + type.key); }
        else {
            crev[type.key] = input.value;
            cankey = crev[type.key]; }
        if(type.subkey) {
            input = jt.byId(type.subkey + "in");
            if(!input || !input.value) {
                errlabel("subkeyinlabeltd");
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
                crev[field] = input.value; } });
    },


    verifyRatingStars = function (ignore /*type*/, errors) {
        var txt;
        if(!crev.rating && crev.srcrev !== "-101") {
            txt = "Please set a star rating.";
            errors.push(txt); }
    },


    keywordsValid = function () {
        var input;
        input = jt.byId("rdkwin");
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
                crev.srcrev = "-101"; }
            else if(crev.srcrev && crev.srcrev === "-101") {
                crev.srcrev = "0"; }
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
        jt.out("sitepicform", jt.tac2html(html));
    },


    displayUploadedPicLabel = function () {
        var html = ["div", {cla: "ptdvdiv"}, 
                    ["span", {cla: "ptdlabspan"}, "Uploaded Pic"]];
        jt.out("upldpicform", jt.tac2html(html));
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


    membicDescripHTML = function (prefix, revid, rev, togfname, revdivid) {
        var html = "", dc = "fpdescrdiv";
        if(rev.dispafter && rev.dispafter > new Date().toISOString()) {
            html = ["div", {cla: "fpqoverdiv", id: revdivid + "fpqoverdiv"},
                    jt.tz2human(jt.isoString2Time(rev.dispafter)) +
                    " (queued)"];
            dc = "fpdescrfadediv"; }
        html = [html,
                ["div", {cla: dc, id: revdivid + "descrdiv"},
                 abbreviatedReviewText(prefix, revid, rev, togfname)]];
        return html;
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
               title: "Membic this",
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


    mayRemove = function (rev) {
        var penid = app.pen.myPenId();
        if(!rev) {
            return false; }
        if(!rev.ctmid || rev.ctmid === "0") {  
            //not a theme post, ok to mark your own rev deleted
            return (rev.penid === penid); }
        //if rev.ctmid, then we are viewing a theme, which is dst.obj
        if(rev.penid === penid || 
               app.coop.membershipLevel(
                   app.pcd.getDisplayState().obj, penid) > 1) {
            return true; }
        return false;
    },


    posCountOrSpace = function (count) {
        if(count) {
            return String(count); }
        return "&nbsp;";
    },


    //It is possible to display [Helpful|Remember|Write|Trash] at the same
    //time if you are a theme moderator expanding someone else's membic.  If
    //making any changes, test that on a phone to make sure it looks ok.
    //Also keep in mind that for your own membic, there are counts displayed
    //for how many people found your membic helpful or wrote membics from
    //it.  That may not be frequent, but that also requires space.
    revpostButtonsHTML = function (prefix, revid) {
        var rev, updrevid, html, rmfs;
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
                     posCountOrSpace(rev.helpful.csvarray().length)],
                    ["div", {cla: "fpbuttondiv",
                             style: "background:url('../img/rememberdis.png') no-repeat center center; background-size:contain;"},
                     posCountOrSpace(rev.remembered.csvarray().length)],
                    ["div", {cla: "fpbuttondiv"},
                     fpbWriteButtonHTML(prefix, revid, updrevid, true)]]; }
        if(mayRemove(rev)) {
            rmfs = jt.isId(rev.ctmid)? "coop.remove" : "review.remove";
            html.push(["div", {cla: "fpbuttondiv", id: "rbd" + revid},
                       ["a", {href: "#remove",
                              title: "Remove membic",
                              onclick: jt.fs("app." + rmfs + "('" + 
                                             rev.ctmid + "','" +
                                             revid + "','" + prefix + "')")},
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


    selectedThemesChanged = function (org) {
        var newchecked, changed = false;
        if(!org) {
            return false; }
        notePostingCoops();  //update crev.ctmids CSV from checkboxes
        newchecked = crev.ctmids;
        if(org.svcdata && org.svcdata.postctms) {
            org.svcdata.postctms.forEach(function (ctm) {
                if(!newchecked.csvcontains(ctm.ctmid)) {
                    changed = true; }  //was checked before and isn't now
                newchecked = newchecked.csvremove(ctm.ctmid); }); }
        //anything left in newchecked was not previously in postctms
        return newchecked || changed;
    },


    picChanged = function (org) {
        var newpic = "", oldpic = "";
        if(crev.svcdata) {
            newpic = crev.svcdata.picdisp || ""; }
        if(org && org.svcdata) {
            oldpic = org.svcdata.picdisp || ""; }
        if(newpic !== oldpic) {
            return true; }
        return false;
    },


    haveChanges = function () {
        var org;
        if(jt.hasId(crev)) {
            org = app.lcs.getRef("rev", jt.instId(crev));
            if(org && org.rev) {
                org = org.rev; }
            else {
                org = null; }
            if(org) {
                validateCurrentReviewFields();  //verify crev updated
                if(jt.fsame(crev.revtype, org.revtype) &&
                   jt.fsame(crev.srcrev, org.srcrev) &&  //unchecked future
                   jt.fsame(crev.rating, org.rating) &&
                   jt.fsame(crev.keywords, org.keywords) &&
                   jt.fsame(crev.text, org.text) &&
                   //svcdata values checked separately
                   jt.fsame(crev.name, org.name) &&
                   jt.fsame(crev.title, org.title) &&
                   (jt.fsame(crev.url, org.url) || 
                    jt.fsame(crev.url, jt.dec(org.url))) &&
                   jt.fsame(crev.artist, org.artist) &&
                   jt.fsame(crev.author, org.author) &&
                   jt.fsame(crev.publisher, org.publisher) &&
                   jt.fsame(crev.album, org.album) &&
                   jt.fsame(crev.starring, org.starring) &&
                   jt.fsame(crev.address, org.address) &&
                   jt.fsame(crev.year, org.year) &&
                   !selectedThemesChanged(org) &&
                   !picChanged(org)) {
                    return false; } } }
        return true;  //not saved yet, or no changes detected
    },


    displayAppropriateButton = function (statmsg, messageWithButton) {
        if(!jt.byId("rdokbuttondiv").innerHTML) {
            jt.out("rdokbuttondiv", jt.tac2html(
                [["button", {type: "button", id: "okbutton",
                             onclick: jt.fs("app.review.save()")},
                  "Save"],
                 ["button", {type: "button", id: "donebutton",
                             onclick: jt.fs("app.review.done()")},
                  "Done"]])); }
        statmsg = statmsg || "";
        jt.out("rdokstatdiv", statmsg);
        if((statmsg && !messageWithButton) || !findReviewType(crev.revtype)) {
            jt.byId("rdokbuttondiv").style.display = "none"; }
        else if(haveChanges()) {
            jt.byId("okbutton").style.display = "inline";
            jt.byId("donebutton").style.display = "none";
            jt.byId("rdokbuttondiv").style.display = "block"; }
        else {
            jt.byId("okbutton").style.display = "none";
            jt.byId("donebutton").style.display = "inline";
            jt.byId("rdokbuttondiv").style.display = "block"; }
    },


    starDisplayAdjust = function (event, roundup) {
        var span, spanloc, evtx, relx, sval, html;
        span = jt.byId("stardisp");
        spanloc = jt.geoPos(span);
        evtx = jt.geoXY(event).x;
        //jt.out("keyinlabeltd", "starDisplayAdjust evtx: " + evtx);  //debug
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = jt.geoXY(event.changedTouches[0]).x; }
        relx = Math.max(evtx - spanloc.x, 0);
        if(relx > 130) {  //normal relx values are 0 to ~86
            return; }     //ignore far out of range events.
        //jt.out("keyinlabeltd", "starDisplayAdjust relx: " + relx);  //debug
        sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //jt.out("keyinlabeltd", "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = app.review.starRating(sval, true).value; }
        crev.rating = sval;
        html = starsImageHTML(crev, "edit");
        jt.out("stardisp", html);
        displayAppropriateButton();
    },


    starPointing = function (event) {
        //jt.out("rdokstatdiv", "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    },


    starStopPointing = function (/*event*/) {
        //var pos = jt.geoXY(event);  //debug
        //jt.out("starslabeltd", " " + pos.x + ", " + pos.y);  //debug
        //jt.out("rdokstatdiv", "star NOT pointing" + event.target);  //debug
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, xypos, evtx, evty;
        td = jt.byId("rdstarsdiv");
        tdpos = jt.geoPos(td);
        xypos = jt.geoXY(event);
        evtx = xypos.x;
        evty = xypos.y;
        if(event.changedTouches && event.changedTouches[0]) {
            xypos = jt.geoXY(event.changedTouches[0]);
            evtx = xypos.x;
            evty = xypos.y; }
        //jt.out("starslabeltd", " " + evtx + ", " + evty);  //debug
        if(evtx < tdpos.x || evtx > tdpos.x + tdpos.w ||
           evty < tdpos.y || evty > tdpos.y + tdpos.h) {
            //jt.out("rdokdiv", "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    },


    starPointAdjust = function (event) {
        if(starPointingActive) {
            //jt.out("rdokdiv", "star point adjust...");  //debug
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
                if(crev.revtype === "book") {
                    rest = secondaryAttr("Author", attrs.content); }
                else if(crev.revtype === "movie") {
                    rest = secondaryAttr("ProductCoop", attrs.content); }
                else if(crev.revtype === "music") {
                    rest = secondaryAttr("Artist", attrs.content) + " " +
                        secondaryAttr("Manufacturer", attrs.content) +
                        secondaryAttr("ProductCoop", attrs.content); }
                items.push({url: url, title: title, rest: rest}); }
            itemdat = xmlExtract("Item", itemdat.remainder); }
        title = "";
        if(jt.byId("keyin")) {
            title = jt.byId("keyin").value.toLowerCase(); }
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
        jt.out("revautodiv", jt.tac2html(["ul", lis]));
    },


    callAmazonForAutocomplete = function (acfunc) {
        var url;
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            jt.enc(autocomptxt) + jt.ts("&cb=", "hour");
        jt.call("GET", url, null,
                function (json) {
                    writeAutocompLinks(jt.dec(json[0].content));
                    app.fork({descr:"Amazon sutocomp loop ok",
                              func:acfunc, ms:400}); },
                app.failf(function (code, errtxt) {
                    jt.out("revautodiv", "");
                    jt.log("Amazon info retrieval failed code " +
                           code + ": " + errtxt);
                    app.fork({descr:"Amazon autocomp loop retry",
                              func:acfunc, ms:400}); }),
                jt.semaphore("review.callAmazonForAutocomplete"));
    },


    noteServiceError = function (retry, problem) {
        var div, html; 
        div = jt.byId("lslogdiv");
        if(!div) {  //div not available anymore, punt.
            return; }
        html = div.innerHTML;
        retry = retry + 1;  //use human counts
        html += "<br/>Attempt " + retry + ": " + problem;
        jt.out("lslogdiv", html);
    },


    verifyGeocodingInfoDiv = function (complainIfNotAlreadyThere) {
        var infodiv, html;
        infodiv = jt.byId("geocodingInfoDiv");
        if(!infodiv) {
            html = ["div", {id: "geocodingInfoDiv"},
                    [["div", {id: "lslogdiv"}],
                     ["div", {id: "mapdiv"}]]];
            jt.out("rdextradiv", jt.tac2html(html));
            if(complainIfNotAlreadyThere) {
                jt.out("lslogdiv", "geocodingInfoDiv was destroyed"); } }
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
        jt.out("revautodiv", jt.tac2html(html));
        app.fork({descr:"Google places autocomp loop",
                  func:acfunc, ms:400});
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
            app.fork({descr:"Google places autocomp start",
                      func:acfunc, ms:400}); }
    },


    revfs = function (callstr) {
        return jt.fs("app.review." + callstr);
    },


    rotatePicButtonHTML = function () {
        var html = "";
        if(jt.hasId(crev) && crev.revpic) {
            html = ["button", {type: "button", id: "pdtfrbutton",
                               onclick: revfs("rotateupldpic()")},
                    "Rotate"]; }
        return html;
    },


    picFileSelChange = function () {
        var fv = jt.byId("picfilein").value;
        //chrome yields a value like "C:\\fakepath\\circuit.png"
        fv = fv.split("\\").pop();
        jt.out("picfilelab", fv);
        jt.byId("picfilelab").className = "filesellab2";
        jt.byId("upldsub").style.visibility = "visible";
        app.review.monitorPicUpload("Init");
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
            jt.out("sitepicform", jt.tac2html(html)); }
        else {
            displaySitePicLabel(); }
        if(crev.svcdata.picdisp === "upldpic") {
            html = ["div", {id: "ptdfdiv"},
                    [["form", {action: "/revpicupload", method: "post",
                               id: "upldpicfelem",
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
                          [["input", {type: "file", cla: "hidefilein",
                                      name: "picfilein", id: "picfilein"}],
                           ["label", {fo: "picfilein", cla: "filesellab",
                                      id: "picfilelab"},
                            "Choose&nbsp;Image"],
                           ["div", {id: "ptduploadbuttonsdiv"},
                            ["input", {type: "submit", cla: "formbutton",
                                       style: "visibility:hidden;",
                                       onclick: jt.fs("app.review.upsub()"),
                                       id: "upldsub", value: "Upload"}]]]],
                         ["div", {id: "imgupstatdiv", cla: "formstatdiv"}]]]]],
                     ["iframe", {id: "ptdif", name: "ptdif", 
                                 src: "/revpicupload", style: "display:none"}],
                     ["div", {id: "pdtfbuttondiv", cla: "dlgbuttonsdiv"},
                      rotatePicButtonHTML()]]];
            jt.out("upldpicform", jt.tac2html(html));
            jt.on("picfilein", "change", picFileSelChange); }
        else {  //not upldpic
            displayUploadedPicLabel(); }
        app.onescapefunc = function () { app.layout.cancelOverlay(true); };
    },


    copyReview = function (review) {
        var copy = {};
        app.review.serializeFields(review);
        Object.keys(review).forEach(function (field) {
            copy[field] = review[field]; });
        app.review.deserializeFields(review);
        if(copy.svcdata) {
            app.review.deserializeFields(copy); }
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
            html.push(["a", {href: "#" + rt.type, cla: "typeselect",
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
                     ["input", {id: "keyin", cla: "lifin", type: "text",
                                oninput:jt.fs("app.review.buttoncheck()")}],
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
            jt.byId("keyin").focus(); }
        app.review.runAutoComp();
    },


    dlgPicHTML = function () {
        var src, type, html;
        src = "img/nopicrev.png";
        type = verifyReviewImageDisplayType(crev);
        if(type === "upldpic") {
            src = "revpic?revid=" + jt.instId(crev) + 
                jt.ts("&cb=", crev.modified); }
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
        if(crev.srcrev === "-101") {
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
        jt.on("rdstarsdiv", "mousedown",   starPointing);
        jt.on("rdstarsdiv", "mouseup",     starStopPointing);
        jt.on("rdstarsdiv", "mouseout",    starStopPointingBoundary);
        jt.on("rdstarsdiv", "mousemove",   starPointAdjust);
        jt.on("rdstarsdiv", "click",       starClick);
        jt.on("rdstarsdiv", "touchstart",  starPointing);
        jt.on("rdstarsdiv", "touchend",    starStopPointing);
        jt.on("rdstarsdiv", "touchcancel", starStopPointing);
        jt.on("rdstarsdiv", "touchmove",   starPointAdjust);
        return true;
    },


    dlgStarsDeactivate = function () {
        jt.off("rdstarsdiv", "mousedown",   starPointing);
        jt.off("rdstarsdiv", "mouseup",     starStopPointing);
        jt.off("rdstarsdiv", "mouseout",    starStopPointingBoundary);
        jt.off("rdstarsdiv", "mousemove",   starPointAdjust);
        jt.off("rdstarsdiv", "click",       starClick);
        jt.off("rdstarsdiv", "touchstart",  starPointing);
        jt.off("rdstarsdiv", "touchend",    starStopPointing);
        jt.off("rdstarsdiv", "touchcancel", starStopPointing);
        jt.off("rdstarsdiv", "touchmove",   starPointAdjust);
        return true;
    },


    dlgFieldInputHTML = function (fldn) {
        return ["div", {id: fldn + "div", cla: "rdfindiv"},
                ["input", {id: fldn + "in", type: "text", 
                           cla: "lifin", placeholder: fldn.capitalize(),
                           oninput:jt.fs("app.review.buttoncheck()")}]];
    },


    dlgDetailsEntry = function () {
        var rt, html, fldttl, futok;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no key field entry yet.
            return; }
        if(!jt.byId("rdpfdiv").innerHTML) {
            futok = app.review.futureok(crev);
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
                                disabled: jt.toru(!futok),
                                onclick: jt.fsd("app.review.togglefuture()"),
                                checked: jt.toru(crev.srcrev === "-101")}]],
                    html];
            jt.out("rdpfdiv", jt.tac2html(html));
            if(!futok) {
                jt.byId("rdfutcbdiv").style.opacity = 0.4; }
            dlgStarsActivate(); }
        jt.out("rdpicdiv", dlgPicHTML());
        if(rt.subkey) {
            jt.byId(rt.subkey + "in").value = crev[rt.subkey] || ""; }
        rt.fields.forEach(function (field) {
            jt.byId(field + "in").value = crev[field] || ""; });
        fldttl = (rt.subkey? 1 : 0) + rt.fields.length;
        if(fldttl <= 1) {
            jt.byId("rdpicdiv").style.height = "80px"; }
        else if(fldttl <= 2) {
            jt.byId("rdpicdiv").style.height = "100px"; }
    },


    dlgTextEntry = function () {
        var rt, ptxt, html;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no text entry yet.
            return; }
        if(!jt.byId("rdtextdiv").innerHTML) {
            ptxt = "Why is this worth remembering?";
            html = [["div", {style: "height:2px;background-color:orange;",
                             id: "txtlendiv"}],
                    ["textarea", {id: "rdta", placeholder: ptxt,
                                  onkeyup: jt.fs("app.review.txtlenind()"),
                                  onchange: jt.fs("app.review.revtxtchg()")},
                     crev.text || ""]];
            jt.out("rdtextdiv", jt.tac2html(html)); }
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
            dkword = dkword.trim();  //stashed keywords may be ", " separated
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
        jt.out("rdkwdiv", jt.tac2html(html));
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
            kwd = kwd.trim();  //keywords may be ", " separated
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
        jt.out("rdgdiv", jt.tac2html(html));
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
            return "?view=coop&coopid=" + rev.ctmid + "&tab=latest&expid=" +
                jt.instId(rev); }
        return "?view=pen&penid=" + rev.penid + "&tab=latest&expid=" +
            jt.instId(rev);
    },


    membicTitleLine = function (type, rev, togclick) {
        var html, url = app.review.membicURL(type, rev);
        html = [["a", {href: revurl(rev), onclick: togclick},
                 [["img", {cla: "reviewbadge", src: "img/" + type.img,
                           title: type.type, alt: type.type}],
                  ["img", {cla: "webjump", src: "img/stackedmenu.png",
                           id: "stackmenu" + jt.instId(rev),
                           title: "actions", alt: "actions"}]]],
                ["a", {href: url, title: url,
                       onclick: jt.fs("window.open('" + url + "')")},
                 app.pcd.reviewItemNameHTML(type, rev)],
                "&nbsp;",
                ["div", {cla: "starsnjumpdiv", 
                         style: (app.winw < 600)? "float:right;" 
                                                : "display:inline-block;"},
                 ["div", {cla: "fpstarsdiv"},
                  app.review.starsImageHTML(rev)]]];
        return html;
    },


    cacheNames = function (rev) {
        app.pennames[rev.penid] = rev.penname;
        convertOldThemePostLabel(rev);
        if(rev.svcdata && rev.svcdata.postctms) {
            rev.svcdata.postctms.forEach(function (ctm) {
                app.coop.rememberThemeName(ctm, true); }); }
    },


    updateShareInfo = function () {
        notePostingCoops();  //populates rev.ctmids csv from checkboxes
        reviewTextValid();   //populates crev.text
        displayAppropriateButton();
        jt.out("sharediv", "");  //rebuild share buttons with latest data
        if(jt.hasId(crev)) {
            jt.byId("closedlg").click = app.review.done;
            if(!jt.byId("sharediv").innerHTML) {
                jt.out("sharediv", jt.tac2html(
                    app.layout.shareDivHTML()));
                //make absolutely sure the share html is ready before
                //showing the share buttons.
                app.fork({
                    descr:"share button stabilization wait",
                    func:function () {
                        app.layout.showShareButtons(
                            crev.title || crev.name,
                            crev.url,
                            app.layout.hashtagsCSV("", crev.ctmids),
                            crev.text); },
                    ms:80}); } }
    },


    updateReviewDialogContents = function () {
        dlgRevTypeSelection();
        dlgKeyFieldEntry();
        dlgDetailsEntry();
        dlgTextEntry();
        dlgKeywordEntry();
        dlgCoopPostSelection();
    },


    noteSaveError = function (code, errtxt) {
        if(!code) {  
            //Likely that the server just hung up on us and couldn't
            //even be bothered to send a status code.  Guess it was
            //just too busy.  Usually the save works if you try again a
            //second time, and that's what most people will do if
            //nothing happens, so better to just eat this error rather
            //than bothering to display a potentially confusing and
            //vague error message.  Log it to the console and continue.
            jt.log("Save fail 0: Call completed but not successful");
            return ""; }
        return "Save fail " + code + ": " + errtxt;
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
                                 src: "img/membiclogo.png?v=170908"}],
                        errtxt]]],
                     ["div", {cla: "dlgbuttonsdiv"},
                      [["button", {type: "button", id: "cancelsieb",
                                   onclick: jt.fs("app.layout.closeDialog()")},
                        "Cancel"],
                       ["button", {type: "button", id: "redirsieb",
                                   onclick: jt.fs("app.layout.closeDialog('" +
                                                  href + "')")},
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
    },


    automateMembicDialog = function () {
        var rbc;
        if(app.review.isMailInMembic(crev)) {
            app.review.togglefuture(true);
            rbc = jt.byId("rdurlbuttonspan");
            if(rbc) {
                rbc.innerHTML = "reading..."; }
            app.readurl.automateMailInMembic(crev); }
    },


    displayMembicDialog = function () {
        var html;
        html = ["div", {id: "revdlgdiv"},
                [["div", {id: "rdtypesdiv"}],
                 ["div", {id: "rdtypepromptdiv"}],
                 ["div", {id: "rdurldiv"},
                  [["label", {fo: "urlin", cla: "liflab"}, "URL"],
                   ["input", {id: "urlin", cla: "lifin", type: "url",
                              oninput:jt.fs("app.review.buttoncheck()")}],
                   ["span", {id: "rdurlbuttonspan"}, dlgReadButtonHTML()],
                   ["div", {id: "rdstat1"}]]],
                 ["div", {id: "rdkeyindiv"}],
                 ["div", {id: "rdpfdiv"}],     //pic, stars, fields
                 ["div", {id: "rdtextdiv"}],
                 ["div", {id: "rdkwdiv"}],
                 ["div", {id: "rdgdiv"}],
                 ["div", {id: "rdokdiv"},
                  [["div", {id: "rdokstatdiv"}],
                   ["div", {id: "rdokbuttondiv", cla: "dlgbuttonsdiv"}]]],
                 ["div", {id: "sharediv"}],
                 ["div", {id: "rdextradiv"}]]];
        html = app.layout.dlgwrapHTML("Make Membic", html,
                                      jt.fs("app.review.done()"));
        app.layout.openDialog(
            {x: Math.max(jt.byId("headingdivcontent").offsetLeft - 34, 20),
             y: window.pageYOffset + 22},
            jt.tac2html(html), updateReviewDialogContents, updateShareInfo);
        automateMembicDialog();
    },


    postSaveProcessing = function (updobjs) {
        var updpen, updrev, revs, step = "housekeeping";
        updpen = updobjs[0];
        updrev = updobjs[1];
        try {
            step = "resolving Ids";
            revs = app.lcs.resolveIdArrayToCachedObjs(
                "rev", app.pen.myPenName().recent || []);
            step = "local updates";
            revs = app.activity.insertOrUpdateRev(revs, updrev);
            step = "tracking recent";
            app.pen.updateRecentRevs(updpen, updrev, revs);
            step = "cache update";
            app.lcs.put("pen", updpen);
            step = "cache refresh";
            cacheBustCoops(crev.ctmids);
            step = "copying membic data";
            crev = copyReview(app.lcs.put("rev", updrev).rev);
            step = "feed update";
            app.activity.updateFeeds(updrev);
            step = "search update";
            cacheBustPersonalReviewSearches();
            app.pcd.updateSearchStateData(updrev);
        } catch (problem) {
            displayAppropriateButton("Please reload this page, " + step + 
                                     " failed: " + problem);
        }
        updateShareInfo();
    },


    //Not copying info from someone else's review instance even if it
    //is available.  URL contents change, and descriptive fields can
    //be innacurate or worse.  This is just to help avoid a person
    //entering the same info again.
    findExistingInstanceByURL = function (url) {
        var revs, i, rev;
        revs = app.lcs.getCachedRecentReviews("", app.pen.myPenId());
        for(i = 0; i < revs.length; i += 1) {  //find method still not avail
            rev = revs[i];
            if(rev.url === url || rev.rurl === url) {
                crev = copyReview(rev);
                return rev; } }
    },


    timeAgo = function (tstr) {
        var mod, ela, suff = "d";
        mod = jt.isoString2Time(tstr);
        ela = Date.now() - mod.getTime();
        ela = Math.round(ela / (1000 * 60 * 60 * 24));
        if(ela >= 14) {
            ela = Math.round(ela / 7);
            suff = "wk"; }
        if(ela >= 52) {
            ela = Math.round(ela / 52);
            suff = "yr"; }
        if(!ela) {
            return "today"; }
        return String(ela) + " " + suff;
    },


    authlinkHTML = function (prefix, revdivid, rev, author, idx) {
        var xd, imgl, authlink = "";
        if(author) {
            xd = "";  //extra decorator div
            if(prefix === "afd" && rev.penid !== app.pen.myPenId()) {
                //include activity feed visibility preferences access
                xd = ["div", {cla: "fpprefstatdiv", 
                              id: "fppsdiv" + revdivid},
                      ["a", {href: "#visprefs",
                             onclick: jt.fs("app.pen.visprefs('" + 
                                            revdivid + "','" + 
                                            rev.penid + "','" + 
                                            jt.embenc(rev.penname) + "')")},
                       ["img", {cla: "feedprefimg", 
                                src: app.pen.prefimg(rev.penid)}]]]; }
            else if(prefix === "pcdf") {  //include count for top favorites
                xd = ["div", {cla: "favcntrdiv"}, idx + 1]; }
            else if(prefix === "pcdr") {  //include elapsed time for recent
                xd = ["div", {cla: "relatimediv"}, timeAgo(rev.modified)]; }
            imgl = ["img", {cla: "fpprofpic", id: "authimg" + idx,
                            src: "profpic?profileid=" + rev.penid,
                            title: jt.ndq(rev.penname),
                            alt: jt.ndq(rev.penname)}];
            if(!app.solopage()) {
                imgl = ["a", {href: "#view=pen&penid=" + rev.penid,
                              onclick: jt.fs("app.pen.bypenid('" + 
                                             rev.penid + "','review')")},
                        imgl]; }
            authlink = ["div", {cla: "fpprofdiv", 
                                id: "profdiv" + jt.instId(rev)},
                        [imgl, xd]]; }
        return authlink;
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
        app.review.resetStateVars();
        if(!app.pen.penReady()) {
            return app.pen.promptFixPen(); }
        if(typeof source === "string") {  //passed in a url
            autourl = source; }
        if(typeof source === "object") {  //passed in another review
            crev = copyReview(source);
            if(source.penid === app.pen.myPenId()) {
                app.coop.faultInPostThroughCoops(source); }
            else {
                makeMine(crev, jt.instId(source)); } }
        crev.penid = app.pen.myPenId();
        displayMembicDialog();
    },


    updatedlg: function (typename) {
        app.layout.cancelOverlay(true);  //close if already open or done
        if(!jt.byId("revdlgdiv")) {  //dialog not displayed yet, init.
            return displayMembicDialog(); }
        if(typename) {
            //rebuild the pic and details area
            if(jt.byId("rdstarsdiv") && crev.srcrev !== "-101") {
                //turn off the star functions if they were active
                dlgStarsDeactivate(); }
            jt.out("rdpfdiv", "");  //rebuild subkey etc fields if type changed
            crev.revtype = typename; }
        updateReviewDialogContents();
        updateShareInfo();
    },

    
    monitorPicUpload: function (init) {
        var ptdif, fc, txt, revid, errpre = "failed: ", ridpre = "revid: ";
        if(init) {
            monitor = {state: "init", count: 0};
            jt.out("pdtfbuttondiv", "");    //remove rotate button
            jt.out("imgupstatdiv", ""); }
        else {
            monitor.state = "waiting";
            monitor.count += 1; }
        ptdif = jt.byId("ptdif");
        if(ptdif) {
            fc = ptdif.contentDocument || ptdif.contentWindow.document;
            if(fc && fc.body) {  //body unavailable if err write in process
                txt = fc.body.innerHTML;
                jt.out("bottomstatdiv", monitor.state + " " + monitor.count + 
                       ": " + txt);
                if(txt.indexOf(ridpre) === 0) {
                    revid = txt.slice(ridpre.length);
                    jt.setInstId(crev, revid);
                    crev.revpic = revid;
                    jt.byId("upldpicimg").src = "revpic?revid=" + revid +
                        jt.ts("&cb=", "second");  //crev.modified unchanged
                    return picdlgModForm(); }
                if(txt.indexOf(errpre) >= 0) {
                    txt = txt.slice(txt.indexOf(errpre) + errpre.length);
                    jt.out("imgupstatdiv", txt);    //display error
                    fc.body.innerHTML = "Reset.";   //reset status iframe
                    jt.out("picfilelab", "Choose&nbsp;Image");
                    jt.byId("picfilelab").className = "filesellab";
                    jt.byId("upldsub").style.visibility = "hidden";
                    return; } }
            app.fork({descr:"membic pic upload monitor",
                      func:app.review.monitorPicUpload, ms:100}); }
    },


    autocompletion: function (/*event*/) {
        var cb, srchtxt;
        cb = jt.byId("rdaccb");
        if(!cb || !cb.checked) {
            //jt.log("autocomp rdaccb not found or not checked");
            jt.out("revautodiv", "");
            return; }
        if(crev.autocomp && jt.byId("revautodiv") && jt.byId("keyin")) {
            srchtxt = jt.byId("keyin").value;
            if(jt.byId("subkeyin")) {
                srchtxt += " " + jt.byId("subkeyin").value; }
            if(srchtxt !== autocomptxt) {
                //jt.log("autocomp new srchtxt: " + srchtxt);
                autocomptxt = srchtxt;
                if(crev.revtype === "book" || crev.revtype === "movie" ||
                   crev.revtype === "music") {
                    callAmazonForAutocomplete(app.review.autocompletion); }
                else if(crev.revtype === "yum" || crev.revtype === "activity") {
                    callGooglePlacesAutocomplete(app.review.autocompletion); } }
            else {
                app.fork({descr:"autocomp general start check",
                          func:app.review.autocompletion, ms:750}); } }
    },


    runAutoComp: function () {
        var cb = jt.byId("rdaccb");
        crev.autocomp = cb && cb.checked;
        if(crev.autocomp) {
            autocomptxt = "";  //reset so search happens if toggling back on
            app.review.autocompletion(); }
        else {
            jt.out("revautodiv", ""); }
    },


    togglefuture: function (updatecheckbox) {
        if(crev.srcrev === "-101") {
            if(updatecheckbox) {
                jt.byId("rdfutcb").checked = false; }
            crev.srcrev = "0";
            jt.out("rdstarsdiv", jt.tac2html(dlgStarsHTML()));
            dlgStarsActivate(); }
        else {
            if(updatecheckbox) {
                jt.byId("rdfutcb").checked = true; }
            crev.srcrev = "-101";
            dlgStarsDeactivate();
            jt.out("rdstarsdiv", jt.tac2html(dlgStarsHTML())); }
        displayAppropriateButton();
    },


    readURL: function (url, params) {
        var urlin, rbc;
        if(!params) {
            params = {}; }
        if(!url) {
            urlin = jt.byId("urlin");
            if(urlin) {
                url = urlin.value; } }
        if(!url) {  //reflect any other updates done in the interim.
            crev.autocomp = false;
            return app.review.updatedlg(); }
        if(!jt.instId(crev) && findExistingInstanceByURL(url)) {
            return app.review.updatedlg(); }
        if(crev.title && !crev.autocomp &&
           !confirm("Re-read title and other fields?")) {
            return; }
        //If the title or other key fields are not valid, that's ok because
        //we are about to read them. But don't lose comment text.
        reviewTextValid();
        url = url.trim();
        if(url) {
            rbc = jt.byId("rdurlbuttonspan");
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
        rdkwin = jt.byId("rdkwin");
        keycsv = app.review.keywordcsv(kwid, rdkwin.value);
        rdkwin.value = keycsv;
        displayAppropriateButton();
    },


    togctmpost: function (ctmid) {
        var cbox = jt.byId("dctmcb" + ctmid);
        if(cbox) {
            if(cbox.checked) {
                //need the full reference for the checkbox definitions,
                //but don't want to fault in just the coop without the
                //supporting revs and other needed info.
                app.pcd.blockfetch("coop", ctmid, function (coop) {
                    app.coop.rememberThemeName(coop);  //backup if cache in flux
                    updateShareInfo();  //note themes being posted to
                    displayThemeCheckboxes(coop); }, "ctmkwdiv" + ctmid); }
            else {
                jt.out("ctmkwdiv" + ctmid, ""); } }
        displayAppropriateButton();
    },


    txtlenind: function () {
        var rdta, tld, width;
        rdta = jt.byId("rdta");
        tld = jt.byId("txtlendiv");
        if(rdta && tld) {
            width = rdta.value || "";
            width = width.length;
            width *= rdta.offsetWidth;
            width /= 65;
            width = Math.round(Math.min(rdta.offsetWidth, width));
            tld.style.width = String(width) + "px"; }
        displayAppropriateButton();
    },


    revtxtchg: function () {
        updateShareInfo();
    },


    save: function (skipvalidation) {
        var errors, data;
        //remove save button immediately to avoid double click dupes...
        displayAppropriateButton("Saving...");
        if(!skipvalidation) {
            displayAppropriateButton("Verifying...");
            errors = validateCurrentReviewFields();
            if(errors.length > 0) {
                displayAppropriateButton(errors.reduce(function (pv, cv) {
                    return pv + cv + "<br/>"; }, ""), true);
                return; }
            if(!app.coop.confirmPostThrough(crev)) {
                displayAppropriateButton();
                return; }}
        displayAppropriateButton("Writing...");
        crev.penid = crev.penid || app.pen.myPenId();  //reader may have skipped
        app.layout.cancelOverlay(true);  //just in case it is still up
        app.onescapefunc = null;
        app.review.serializeFields(crev);
        data = jt.objdata(crev);
        app.review.deserializeFields(crev); //in case update fail or interim use
        jt.call("POST", "saverev?" + app.login.authparams(), data,
                function (updobjs) {
                    displayAppropriateButton("Saved.");
                    postSaveProcessing(updobjs); },
                app.failf(function (code, errtxt) {
                    displayAppropriateButton(
                        noteSaveError(code, errtxt), true); }),
                jt.semaphore("review.save"));
    },


    done: function () {
        var state, cached;
        if(jt.hasId(crev) && haveChanges()) {
            if(!confirm("Discard changes?")) {
                return; } }
        app.layout.closeDialog();
        //generally want to return to where we were, except when a future
        //membic has just changed to a regular membic.  Then watching it
        //disappear from the remembered tab on save is disconcerting.
        if(jt.hasId(crev)) {
            state = app.history.currState();
            if(state && state.view === "pen" && state.tab === "memo") {
                //crev may have changed if they are canceling without saving
                //so determine future status from cached version
                cached = app.lcs.getRef("rev", jt.instId(crev)).rev;
                if(cached.srcrev !== "-101") {
                    return app.pcd.display("pen", crev.penid, "latest"); } } }
        //return to wherever we were, while allowing for any other
        //processing that needs to get done.
        app.login.doNextStep({});
    },


    setCurrentReview: function (revobj) {
        crev = revobj;
    },


    getCurrentReview: function () {
        return crev;
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
                                                     jt.ts("&cb=", "second"))
                                                  : "img/nopicrev.png"),
                                onclick: revfs("picdlg('upldpic')")}],
                       ["div", {id: "upldpicform", cla: "overform"}]]]]],
                   ["li",
                    [["input", {type: "radio", name: "upt", value: "nopic",
                                checked: jt.toru(dt === "nopic"),
                                onchange: revfs("picdlg('nopic')")}],
                     ["span", {cla: "ptdlabspan"}, "No Pic"]]]]]]];
        validateCurrentReviewFields();  //don't lose input values on close
        app.layout.openOverlay(app.layout.placerel("dlgrevimg", -5, -80), 
                               html, null, picdlgModForm,
                               jt.fs("app.review.updatedlg()"));
    },


    upsub: function () {
        var upldbutton = jt.byId("upldsub");
        upldbutton.disabled = true;
        upldbutton.value = "Uploading...";
        jt.byId("upldpicfelem").submit();
    },


    sitepicupd: function () {
        var url;
        jt.out("pdtsustatdiv", "");
        url = jt.byId("pdturlin").value;
        if(!url) {
            jt.out("pdtsustatdiv", "Need URL value");
            return; }
        crev.imguri = url;
        jt.byId("sitepicimg").src = url;
        displaySitePicLabel();
    },


    uploadpic: function () {
        app.review.monitorPicUpload("init");
        jt.byId("upldpicfelem").submit();
    },


    rotateupldpic: function () {
        var revid, picsrc, data;
        revid = jt.instId(crev);
        data = "revid=" + revid + "&penid=" + app.pen.myPenId();
        jt.out("pdtfbuttondiv", "Rotating...");
        jt.call("POST", "rotatepic?" + app.login.authparams(), data,
                function (reviews) {
                    //the updated review is partial, don't replace crev
                    crev.modified = reviews[0].modified;
                    picsrc = "revpic?revid=" + revid + 
                        jt.ts("&cb=", crev.modified);
                    jt.out("pdtfbuttondiv", jt.tac2html(rotatePicButtonHTML()));
                    jt.byId("upldpicimg").src = picsrc; },
                app.failf(function (code, errtxt) {
                    jt.out("pdtfbuttondiv", jt.tac2html(rotatePicButtonHTML()));
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
        if(!rating || typeof rating !== "number" || rating < 0) { 
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
            html = jt.byId("geocodingInfoDiv").innerHTML;
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
                mapdiv = jt.byId("mapdiv");
                map = new google.maps.Map(mapdiv, {
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: latlng,
                    zoom: 15 });
                gplacesvc = new google.maps.places.PlacesService(map);
            } catch (problem) {
                gplacesvc = null;
                noteServiceError(retry, problem);
                app.fork({
                    descr:"selectLocLatLng retry",
                    func:function () {
                        app.review.selectLocLatLng(latlng, ref, retry + 1,
                                                   problem); },
                    ms:200 + (100 * retry)});
                return;
            } }
        if(gplacesvc && ref) {
            gplacesvc.getDetails({reference: ref},
                function (place, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        crev.address = place.formatted_address;
                        crev.name = place.name || jt.byId("keyin").value;
                        crev.name = crev.name.split(",")[0];
                        crev.acselkeyval = crev.name;
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
            crev.acselkeyval = jt.dec(addr);
            crev.acselkeyval = crev.acselkeyval.split(",")[0];
            jt.byId("keyin").value = crev.acselkeyval; }
        if(!geoc && google && google.maps && google.maps.places) {
            geoc = new google.maps.Geocoder();
            if(!geoc) {
                errlines.unshift("Initializing google.maps.Geocoder failed.");
                jt.err(errlines.join("\n")); } }
        if(geoc && addr) {
            addr = jt.dec(addr);
            jt.out("revautodiv", jt.tac2html(["p", addr]));
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
        app.fork({
            descr:"background server toggle helpful",
            func:function () {
                var disprevsrc = 0;
                if(disprevid !== updrevid) {
                    disprevsrc = app.lcs.getRef("rev", disprevid).rev.ctmid; }
                url = "toghelpful?" + app.login.authparams() + 
                    "&penid=" + app.pen.myPenId() + "&revid=" + updrevid + 
                    "&disprevid=" + disprevid + "&disprevsrc=" + disprevsrc + 
                    jt.ts("&cb=", "second");
                jt.call("GET", url, null,
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
                        jt.semaphore("review.toggleHelpful")); },
            ms:50});
    },


    fpbToggleRemember: function (prefix, disprevid, updrevid) {
        var url;
        if(!app.pen.myPenName()) {
            return signInErr("Sign in to remember this membic.",
                             prefix, disprevid); }
        jt.out(prefix + disprevid + "rememberdiv",
               fpbRememberButtonHTML(prefix, disprevid, updrevid, true));
        //disconnect update call from screen update
        app.fork({
            descr:"background server toggle remember",
            func:function () {
                var disprevsrc = 0;
                if(disprevid !== updrevid) {
                    disprevsrc = app.lcs.getRef("rev", disprevid).rev.ctmid; }
                url = "togremember?" + app.login.authparams() +
                    "&penid=" + app.pen.myPenId() + "&revid=" + updrevid +
                    "&disprevid=" + disprevid + "&disprevsrc=" + disprevsrc + 
                    jt.ts("&cb=", "second");
                jt.call("GET", url, null,
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
                        jt.semaphore("review.toggleRemember")); },
            ms:50});
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
        var revdivid, type, html, togclick;
        togfname = togfname || "app.review.toggleExpansion";
        togclick = jt.fs(togfname + "('" + prefix + "','" + revid + "')");
        revdivid = prefix + revid;
        type = app.review.getReviewTypeByValue(rev.revtype);
        fixReviewURL(rev);
        html = ["div", {cla: (prefix === "rrd"? "fpmeminrevdiv"
                                              : "fpinrevdiv")},
                [["div", {cla: "fpbuttonsdiv", 
                          id: revdivid + "buttonsdiv"}],
                 ["div", {cla: "fptitlediv"},
                  membicTitleLine(type, rev, togclick)],
                 ["div", {cla: "fpsecfieldsdiv", id: revdivid + "secdiv"}],
                 ["div", {cla: "fpdatediv", id: revdivid + "datediv"}],
                 ["div", {cla: "fpbodydiv"},
                  [["div", {cla: "fprevpicdiv"},
                    app.review.picHTML(rev, type)],
                   ["div", {cla: "fpdcontdiv"},
                    membicDescripHTML(prefix, revid, rev, togfname, revdivid)],
                   ["div", {cla: "fpkeywrdsdiv", id: revdivid + "keysdiv"}],
                   ["div", {cla: "fpctmsdiv", id: revdivid + "ctmsdiv"},
                    postedCoopLinksHTML(rev)]]]]];
        return html;
    },


    isDupeRev: function (rev, pr) {
        if(rev && pr && ((jt.strPos(rev.srcrev) && rev.srcrev === pr.srcrev) ||
                         (rev.cankey && rev.cankey === pr.cankey) ||
                         (rev.url && rev.url === pr.url))) {
            return true; }
        return false;
    },


    filterByRevtype: function (revs, rt) {
        var filtered = [];
        rt = rt || "all";
        revs.forEach(function (rev) {
            //with database lag it is possible to end up with a deleted
            //membic showing up in a query response.  Safest to filter here.
            if(rev.srcrev !== "-604" &&
               (rev.revtype === rt || rt === "all")) {
                filtered.push(rev); } });
        return filtered;
    },


    displayReviews: function (divid, prefix, revs, togcbn, author, xem) {
        var rt, html, state;
        rt = app.layout.getType();
        if(!revs || revs.length === 0) {
            if(rt === "all") {
                html = "No membics to display."; }
            else {
                rt = app.review.getReviewTypeByValue(rt);
                html = "No " + rt.plural + " found."; }
            if(xem) {  //display extra empty message (prompt to write)
                html = [html, xem]; }
            html = ["div", {id:"membicliststatusdiv"}, html]; }
        else {
            html = []; }
        jt.out(divid, jt.tac2html(html));
        state = {divid: divid, prefix: prefix,
                 idx: 0, revs: revs, prev: null, paused: false,
                 author: author, togcbn: togcbn};
        app.fork({descr:"revDispIterator start",
                  func:function () {
                      app.review.revDispIterator(state); },
                  ms:50});
    },


    revDispIterator: function (state) {
        var rev, revdivid, maindivattrs, authlink, elem;
        while(state.idx < state.revs.length) {
            if(state.idx >= 10 && !state.paused) {
                state.paused = true;
                break; }
            if(state.idx > 0) {
                state.prev = state.revs[state.idx - 1]; }
            rev = state.revs[state.idx];
            cacheNames(rev);
            revdivid = state.prefix + jt.instId(rev);
            maindivattrs = {id: revdivid + "fpdiv", cla: "fpdiv"};
            if(rev.srcrev === "-604" || 
                   app.review.isDupeRev(rev, state.prev) || 
                   (state.author === "notself" && 
                    rev.penid === app.pen.myPenId())) {
                maindivattrs.style = "display:none"; }
            authlink = authlinkHTML(state.prefix, revdivid, rev, 
                                    state.author, state.idx);
            elem = document.createElement("div");
            elem.className = "fpcontdiv";
            elem.innerHTML = jt.tac2html(
                ["div", maindivattrs,
                 [authlink,
                  ["div", {cla: (state.author? "fparevdiv" : "fpnarevdiv"),
                           id: revdivid},
                   app.review.revdispHTML(state.prefix, jt.instId(rev), 
                                          rev, state.togcbn)]]]);
            jt.byId(state.divid).appendChild(elem); 
            state.idx += 1; }
        if(state.idx < state.revs.length) {  //resume after pause
            app.fork({
                descr:"revDispIterator loop",
                func:function () {
                    app.review.revDispIterator(state); },
                ms:200}); }
        else {
            app.pcd.fetchmore("linkonly"); }
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
            app.activity.showMultiMembicImage(revid, true);
            if(jt.byId("stackmenu" + revid)) {
                jt.byId("stackmenu" + revid).src = "img/stackedmenu.png"; }
            jt.out(revdivid + "buttonsdiv", "");
            jt.out(revdivid + "secdiv", "");
            jt.out(revdivid + "datediv", "");
            jt.out(revdivid + "descrdiv", 
                   abbreviatedReviewText(prefix, revid, rev));
            jt.out(revdivid + "keysdiv", "");
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
        else {  //expand
            //scrolling on click is disorienting. Moves the element to
            //the top of the page when you click it so it jumps
            //around. Originally for people clicking through from RSS
            //links. Not needed anymore.
            //app.layout.scrollToVisible(revdivid + "buttonsdiv");
            app.activity.showMultiMembicImage(revid, false);
            if(jt.byId("stackmenu" + revid)) {
                jt.byId("stackmenu" + revid).src = "img/stackedmenuopen.png"; }
            jt.out(revdivid + "buttonsdiv", revpostButtonsHTML(prefix, revid));
            jt.out(revdivid + "secdiv", fpSecondaryFieldsHTML(rev));
            jt.out(revdivid + "datediv", 
                   jt.colloquialDate(jt.isoString2Day(rev.modified)));
            jt.out(revdivid + "descrdiv", jt.linkify(rev.text || ""));
            jt.out(revdivid + "keysdiv", rev.keywords);
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
    },


    remove: function (ignore /*ctmid*/, revid, prefix) {
        var timg, rev, ct, data;
        timg = jt.byId(prefix + revid + "removebutton");
        timg.style.opacity = 0.4;
        rev = app.lcs.getRef("rev", revid).rev;
        ct = "Are you sure you want to remove this membic?";
        if(rev.svcdata && rev.svcdata.postctms) {
            ct = "Removing this membic will not delete theme posts.\n" + ct; }
        if(!confirm(ct)) {
            timg.style.opacity = 1.0;
            return; }
        data = "penid=" + app.pen.myPenId() + "&revid=" + revid;
        jt.call("POST", "delrev?" + app.login.authparams(), data,
                function (reviews) {
                    app.lcs.nukeItAll();
                    //An immediate fetch may still retrieve the
                    //unmarked membic due to database update lag.
                    //Cache the marked-as-deleted instance to avoid
                    //seeing it in the meantime.
                    app.lcs.put("rev", reviews[0]);
                    app.activity.reinit();  //clear existing feeds
                    app.login.doNextStep(); },
                function (code, errtxt) {
                    timg.style.opacity = 1.0;
                    jt.err("Remove failed " + code + ": " + errtxt); },
                jt.semaphore("review.remove"));
    },


    futureok: function (rev) {
        var cached, revid = jt.instId(rev);
        if(!revid) {  //not saved yet, so future ok
            return true; }
        if(rev.srcrev === "-101") {  //currently future, so future ok
            return true; }
        cached = app.lcs.getRef("rev", revid).rev;
        if(cached.srcrev === "-101") {  //currently saved as future so ok
            return true; }
        return false;
    },


    isMailInMembic: function (rev) {
        //Exact text format matches mailsum.py make_pending_membic
        return (rev.srcrev === "-101" && 
                rev.text.trim().startsWith("Mail sent to "));
    },


    buttoncheck: function () {
        displayAppropriateButton();
    },


    membicURL: function (type, membic) {
        var url = membic.url;
        if(!url) {
            url = membic[type.key];
            if(type.subkey) {
                url += " " + membic[type.subkey]; }
            url = jt.enc(url);
            url = "https://www.google.com/?q=" + url + "#q=" + url; }
        return url;
    },


    serializeFields: function (rev) {
        if(typeof rev.svcdata === "object") {
            rev.svcdata = JSON.stringify(rev.svcdata); }
        else {
            rev.svcdata = ""; }
    },


    deserializeFields: function (rev) {
        app.lcs.reconstituteJSONObjectField("svcdata", rev);
    }

}; //end of returned functions
}());

