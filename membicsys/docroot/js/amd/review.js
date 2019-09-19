/*global window, confirm, app, jt, google, document */

/*jslint browser, white, fudge, for, long */

app.review = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    //If a url was pasted or passed in as a parameter, then potentially
    //modified by automation, that "cleaned" value should be kept to
    //confirm against the potentially edited form field value.
    var autourl = "";
    var orev = null;  //The original review before editing started
    var crev = {};    //The current review being displayed or edited.
    //If changing the width or height of the stars img, also change
    //profile.reviewItemHTML indent
    var starimgw = 85;
    var starimgh = 15;
    var starPointingActive = false;  //true if star sliding active
    var monitor = null;
    var ratingDefaultValue = 60;
    //The last value used for autocomplete checking
    var autocomptxt = "";
    var gautosvc = null;
    var geoc = null;
    var gplacesvc = null;
    var maxabbrev = 400;
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
    var reviewTypes = [
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
                     "Hobby", "Research" ] } ];


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    //rating is a value from 0 - 100.  Using Math.round to adjust values
    //results in 1px graphic hiccups as the rounding switches, and ceil
    //has similar issues coming off zero, so use floor.
    function starsImageHTML (rating, mode) {
        var imgfile = "img/stars18ptC.png"; 
        var greyfile = "img/stars18ptCg.png";
        var width; var offset; var rat; var html;
        if(typeof rating !== "number") {
            mode = mode || (rating.srcrev === "-101" ? "prereview" : "read");
            rating = rating.rating; }
        rat = app.review.starRating(rating);
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
    }


    function findReviewType (type) {
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
    }


    function readParameters (params) {
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
    }


    function getURLReader (ignore, callfunc) {
        //app.youtube dies all the time due to the number of API calls
        //    being exhausted, and the standard reader does just as well.
        //app.netflix became nonfunctional when netflix retired the
        //    odata catalog on 08apr14.
        //app.amazon is disabled until membic has enough traffic to sustain
        //an advertiser relationship.
        // if(url.indexOf(".amazon.") > 0) {
        //     return callfunc(app.amazon); }
        callfunc(app.readurl);
    }


    function reviewTextValid (ignore /*type*/, errors) {
        var input = jt.byId("rdta");
        if(input) {
            crev.text = input.value;
            if(!crev.text && errors) {
                errors.push("Why memorable?"); } }
    }


    function verifyReviewImageDisplayType (review) {
        var dt = "guess";
        if(review.svcdata && typeof review.svcdata === "string") {
            app.review.deserializeFields(review); }
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
    }


    //Many images (including everything from smaller websites to
    //Amazon) are not easily available over https, so removing the
    //protocol and letting the browser attempt https just results in a
    //lot of broken images.  Don't mess with the images unless you
    //have to because imagerelay eats server resources.
    function sslSafeRef (revid, url) {
        if(window.location.href.indexOf("https://") === 0) {
            url = "imagerelay?revid=" + revid + "&url=" + jt.enc(url); }
        return url;
    }


    //If the review.url has known issues, fix it
    function fixReviewURL (rev) {
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
    }


    function sourceRevId (review) {
        var srcid = jt.instId(review);
        if(review.ctmid && review.ctmid !== "0") {
            srcid = review.srcrev; }
        return srcid;
    }


    function revFormImageHTML (review, type, keyval, mode) {
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
    }


    function errlabel (domid) {
        var elem = jt.byId(domid);
        if(elem) {
            elem.style.color = "red";
            if(elem.innerHTML.indexOf("*") < 0) {
                elem.innerHTML += "*"; } }
    }


    //Validating URLs without accidentally complaining about things
    //that actually can work is not trivial.  The only real way is
    //probably to fetch it.  Checking for embedded javascript is a
    //whole other issue.
    function noteURLValue () {
        var input;
        //if auto read url from initial form, note it and then reset var
        if(autourl) {
            crev.url = autourl;
            autourl = ""; }
        //the url may be edited, note the current value
        input = jt.byId("urlin");
        if(input) {
            crev.url = input.value; }
    }


    function keyFieldsValid (type, errors) {
        var cankey = "";
        var input = jt.byId("keyin");
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
    }


    function secondaryFieldsValid (type) {
        //none of the secondary fields are required, so just note the values
        type.fields.forEach(function (field) {
            var input = jt.byId(field + "in");
            if(input) {  //input field was displayed
                crev[field] = input.value; } });
    }


    function verifyRatingStars (ignore /*type*/, errors) {
        var txt;
        if(!crev.rating && crev.srcrev !== "-101") {
            txt = "Please set a star rating.";
            errors.push(txt); }
    }


    function keywordsValid () {
        var input;
        input = jt.byId("rdkwin");
        if(input) {
            crev.keywords = jt.spacedCSV(input.value); }
    }


    function notePostingCoops () {
        crev.ctmids = "";
        var coops = app.profile.myProfile().coops;
        Object.keys(coops).forEach(function (key) {
            var ctmcb = jt.byId("dctmcb" + key);
            if(ctmcb && ctmcb.checked) {
                crev.ctmids = crev.ctmids.csvappend(key); } });
    }


    function readAndValidateFieldValues (type, errors) {
        if(!type) {
            type = findReviewType(crev.revtype); }
        if(!errors) {
            errors = []; }
        var fields = ["keywords", "text", "imguri", "penname", "name", "title",
                      "url", "rurl", "artist", "author", "publisher", "album", 
                      "starring", "address", "year"];
        app.verifyNoEmbeddedHTML(crev, fields, errors);  //no html at all (rss)
        if(type) {
            keyFieldsValid(type, errors);
            keywordsValid(type, errors);
            reviewTextValid(type, errors);
            secondaryFieldsValid(type, errors);
            noteURLValue();
            if(crev.srcrev && crev.srcrev === "-101") {
                crev.srcrev = "0"; }
            notePostingCoops(); }
    }


    function validateCurrentReviewFields () {
        var errors = [];
        var rt = findReviewType(crev.revtype);
        if(!rt) {
            errors.push("Need to choose a type");
            return errors; }
        readAndValidateFieldValues(rt, errors);
        verifyRatingStars(rt, errors);
        return errors;
    }


    function displaySitePicLabel () {
        var html = ["div", {cla: "ptdvdiv"}, 
                    ["span", {cla: "ptdlabspan"}, "Site Pic"]];
        jt.out("sitepicform", jt.tac2html(html));
    }


    function displayUploadedPicLabel () {
        var html = ["div", {cla: "ptdvdiv"}, 
                    ["span", {cla: "ptdlabspan"}, "Uploaded Pic"]];
        jt.out("upldpicform", jt.tac2html(html));
    }


    function dispRevText (prefix, revid, rev, togfname) {
        var rtxt = jt.linkify(rev.text || "");
        if(rtxt.length > maxabbrev) {
            rtxt = rev.text;  //start with raw text
            //truncated text could result in a busted link if embedded
            //in the description.  Fixed on toggle.
            rtxt = jt.linkify(rtxt.slice(0, maxabbrev)) + "... "; }
        var html = [["span", {id:prefix + revid + "revtxtspan"}, rtxt],
                    "&nbsp;",
                    ["a", {href:"#more", 
                           onclick:jt.fs(togfname + "('" + prefix + "','" + 
                                         revid + "')")},
                     ["span", {id:prefix + revid + "togmorespan",
                               cla:"togglemoretextspan"}, "+"]],
                    //actions are filled out on request since they require
                    //checking whether the review may be modified or not.
                    ["span", {id:prefix + revid + "actspan", 
                              cla:"revactspan", style:"display:none;"}]];
        return jt.tac2html(html);
    }


    function toggleDispRevText (prefix, revid, rev) {
        var rtxt = rev.text || "";
        var togspan = jt.byId(prefix + revid + "togmorespan");
        if(!togspan) {
            return jt.log("toggleDispRevText togspan not found"); }
        if(togspan.innerHTML.indexOf("+") >= 0) {
            togspan.innerHTML = "&nbsp;-&nbsp;";
            jt.out(prefix + revid + "revtxtspan", jt.linkify(rtxt)); }
        else {
            togspan.innerHTML = "+";
            if(rtxt.length > maxabbrev) {
                rtxt = jt.linkify(rtxt.slice(0, maxabbrev)) + "... "; }
            jt.out(prefix + revid + "revtxtspan", jt.linkify(rtxt)); }
    }


    function fpMembicAuthPicHTML (rev) {
        var clickfs = "app.profile.byprofid('" + rev.penid + "')";
        if(app.solopage()) {
            clickfs = "window.open('" + app.hardhome + "/" + rev.penid + "')"; }
        var html = ["a", {href:"#author", title:rev.penname,
                          onclick:jt.fs(clickfs)},
                    ["img", {cla:"authpicimg", 
                             src:"profpic?profileid=" + rev.penid}]];
        return jt.tac2html(html);
    }


    function fpSecondaryFieldsHTML (rev) {
        var html = [];
        findReviewType(rev.revtype).fields.forEach(function (field) {
            var value = jt.ndq(rev[field]);
            if(value) {
                if(field === "address") {
                    var mapurl = "http://maps.google.com/?q=" + value;
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
    }


    function convertOldThemePostLabel (rev) {
        if(rev.svcdata && rev.svcdata.postgrps && !rev.svcdata.postctms) {
            rev.svcdata.postctms = rev.svcdata.postgrps; }
    }


    function postedCoopLinksHTML (rev) {
        convertOldThemePostLabel(rev);
        if(!rev.svcdata || !rev.svcdata.postctms) {
            return ""; }
        var postnotes = rev.svcdata.postctms;
        if(!postnotes.length) {
            return ""; }
        var links = [];
        postnotes.forEach(function (pn) {
            links.push(jt.tac2html(
                ["a", {href: "?view=coop&coopid=" + pn.ctmid,
                       onclick: jt.fs("app.coop.bycoopid('" +
                                      pn.ctmid + "','review')")},
                 pn.name])); });
        var html = ["span", {cla: "fpctmlinksspan"},
                    [["span", {cla: "fpctmlinkslab"}, "Posted to: "],
                     links.join(" | ")]];
        return jt.tac2html(html);
    }


    function selectedThemesChanged (org) {
        var changed = false;
        if(!org) {
            return false; }
        notePostingCoops();  //update crev.ctmids CSV from checkboxes
        var newchecked = crev.ctmids;
        if(org.svcdata && org.svcdata.postctms) {
            org.svcdata.postctms.forEach(function (ctm) {
                if(!newchecked.csvcontains(ctm.ctmid)) {
                    jt.log("selectedThemesChanged: unchecked " + ctm.name);
                    changed = true; }  //was checked before and isn't now
                newchecked = newchecked.csvremove(ctm.ctmid); }); }
        if(newchecked) {
            jt.log("selectedThemesChanged: checked " + newchecked); }
        return newchecked || changed;
    }


    function picChanged (org) {
        var newpic = "";
        var oldpic = "";
        if(crev.svcdata) {
            newpic = crev.svcdata.picdisp || ""; }
        if(org && org.svcdata) {
            oldpic = org.svcdata.picdisp || ""; }
        if(newpic !== oldpic) {
            return true; }
        return false;
    }


    function haveChanges () {
        if(jt.hasId(crev) && orev) {  //saved and have original to compare to
            validateCurrentReviewFields();  //verify crev updated
            var fields = ["revtype", "srcrev", "rating", "keywords", "text",
                          "name", "title", "artist", "author", "publisher",
                          "album", "starring", "address", "year"];
            var fieldsmatch = fields.every(function (field) {
                var matched = jt.fsame(crev[field], orev[field]);
                if(!matched) {
                    jt.log("haveChanges: field " + field + ": " + crev[field] +
                           " | " + orev[field]); }
                return matched; });
            var urlmatch = (jt.fsame(crev.url, orev.url) || 
                            jt.fsame(crev.url, jt.dec(orev.url)));
            if(!urlmatch) {
                jt.log("haveChanges: url changed"); }
            var picmatch = !picChanged(orev);
            if(!picmatch) {
                jt.log("haveChanges: pic changed"); }
            if(fieldsmatch && urlmatch && picmatch && 
               !selectedThemesChanged(orev)) {
                return false; } }
        return true;  //new membic or no changes detected
    }


    function displayAppropriateButton (statmsg, messageWithButton) {
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
            jt.byId("sharediv").style.display = "none";
            jt.byId("okbutton").style.display = "inline";
            jt.byId("donebutton").style.display = "none";
            jt.byId("rdokbuttondiv").style.display = "block"; }
        else {
            jt.byId("sharediv").style.display = "block";
            jt.byId("okbutton").style.display = "none";
            jt.byId("donebutton").style.display = "inline";
            jt.byId("rdokbuttondiv").style.display = "block"; }
    }


    function starDisplayAdjust (event, roundup) {
        var span = jt.byId("stardisp");
        var spanloc = jt.geoPos(span);
        var evtx = jt.geoXY(event).x;
        //jt.out("keyinlabeltd", "starDisplayAdjust evtx: " + evtx);  //debug
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = jt.geoXY(event.changedTouches[0]).x; }
        var relx = Math.max(evtx - spanloc.x, 0);
        if(relx > 130) {  //normal relx values are 0 to ~86
            return; }     //ignore far out of range events.
        //jt.out("keyinlabeltd", "starDisplayAdjust relx: " + relx);  //debug
        var sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //jt.out("keyinlabeltd", "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = app.review.starRating(sval, true).value; }
        crev.rating = sval;
        var html = starsImageHTML(crev, "edit");
        jt.out("stardisp", html);
        displayAppropriateButton();
    }


    function starPointing (event) {
        //jt.out("rdokstatdiv", "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    }


    function starStopPointing (/*event*/) {
        //var pos = jt.geoXY(event);  //debug
        //jt.out("starslabeltd", " " + pos.x + ", " + pos.y);  //debug
        //jt.out("rdokstatdiv", "star NOT pointing" + event.target);  //debug
        starPointingActive = false;
    }


    function starStopPointingBoundary (event) {
        var td = jt.byId("rdstarsdiv");
        var tdpos = jt.geoPos(td);
        var xypos = jt.geoXY(event);
        var evtx = xypos.x;
        var evty = xypos.y;
        if(event.changedTouches && event.changedTouches[0]) {
            xypos = jt.geoXY(event.changedTouches[0]);
            evtx = xypos.x;
            evty = xypos.y; }
        //jt.out("starslabeltd", " " + evtx + ", " + evty);  //debug
        if(evtx < tdpos.x || evtx > tdpos.x + tdpos.w ||
           evty < tdpos.y || evty > tdpos.y + tdpos.h) {
            //jt.out("rdokdiv", "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    }


    function starPointAdjust (event) {
        if(starPointingActive) {
            //jt.out("rdokdiv", "star point adjust...");  //debug
            starDisplayAdjust(event); }
    }


    function starClick (event) {
        starDisplayAdjust(event, true);
    }


    function xmlExtract (tagname, xml) {
        var result = null;
        var targetstr = "<" + tagname + ">";
        var idx = xml.indexOf(targetstr);
        if(idx >= 0) {
            xml = xml.slice(idx + targetstr.length);
            targetstr = "</" + tagname + ">";
            idx = xml.indexOf(targetstr);
            if(idx >= 0) {
                result = { content: xml.slice(0, idx),
                           remainder: xml.slice(idx + targetstr.length) }; } }
        return result;
    }


    function secondaryAttr (tagname, xml) {
        var secondary = xmlExtract(tagname, xml);
        if(secondary) {
            secondary = secondary.content.trim(); }
        if(secondary) {
            return "&nbsp;<i>" + secondary + "</i>"; }
        return "";
    }


    function hasComplexTitle (item) {
        if(item && item.title && item.title.indexOf("(") >= 0) {
            return true; }
        if(item && item.title && item.title.indexOf("[") >= 0) {
            return true; }
        return false;
    }


    function extractItemsFromXML (xml) {
        var iur; var itl; var attrs; var irs;
        var items = [];
        var itemdat = xmlExtract("Item", xml);
        while(itemdat) {
            iur = xmlExtract("DetailPageURL", itemdat.content);
            iur = iur.content || "";
            attrs = xmlExtract("ItemAttributes", itemdat.content);
            itl = xmlExtract("Title", attrs.content);
            itl = itl.content || "";
            if(itl) {
                irs = "";
                if(crev.revtype === "book") {
                    irs = secondaryAttr("Author", attrs.content); }
                else if(crev.revtype === "movie") {
                    irs = secondaryAttr("ProductCoop", attrs.content); }
                else if(crev.revtype === "music") {
                    irs = secondaryAttr("Artist", attrs.content) + " " +
                        secondaryAttr("Manufacturer", attrs.content) +
                        secondaryAttr("ProductCoop", attrs.content); }
                items.push({url:iur, title:itl, rest:irs}); }
            itemdat = xmlExtract("Item", itemdat.remainder); }
        return items;
    }


    function writeAutocompLinks (xml) {
        var items = extractItemsFromXML(xml);
        var title = "";
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
        var lis = []; 
        items.forEach(function (item) {
            lis.push(["li",
                      ["a", {href: item.url, 
                             onclick: jt.fs("app.review.readURL('" + 
                                            item.url + "')")},
                       item.title + " " + item.rest]]); });
        jt.out("revautodiv", jt.tac2html(["ul", lis]));
    }


    function callAmazonForAutocomplete (acfunc) {
        var url;
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            jt.enc(autocomptxt) + app.login.authparams("&") + 
            jt.ts("&cb=", "hour");
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
    }


    function noteServiceError (retry, problem) {
        var div = jt.byId("lslogdiv");
        if(!div) {  //div not available anymore, punt.
            return; }
        var html = div.innerHTML;
        retry = retry + 1;  //use human counts
        html += "<br/>Attempt " + retry + ": " + problem;
        jt.out("lslogdiv", html);
    }


    function verifyGeocodingInfoDiv (complainIfNotAlreadyThere) {
        var infodiv = jt.byId("geocodingInfoDiv");
        if(!infodiv) {
            var html = ["div", {id: "geocodingInfoDiv"},
                        [["div", {id: "lslogdiv"}],
                         ["div", {id: "mapdiv"}]]];
            jt.out("rdextradiv", jt.tac2html(html));
            if(complainIfNotAlreadyThere) {
                jt.out("lslogdiv", "geocodingInfoDiv was destroyed"); } }
    }


    function writeACPLinks (acfunc, results, status) {
        var items = [];
        if(status === google.maps.places.PlacesServiceStatus.OK) {
            results.forEach(function (place) {
                var selfunc = "app.review.selectLocation('" +
                    jt.embenc(place.description) + "','" + 
                    place.reference + "')";
                items.push(["li",
                            ["a", {href: "#selectloc",
                                   onclick: jt.fs(selfunc)},
                             place.description]]); }); }
        var html = [["ul", items],
                    ["img", {src: "img/poweredbygoogle.png"}]];
        jt.out("revautodiv", jt.tac2html(html));
        app.fork({descr:"Google places autocomp loop",
                  func:acfunc, ms:400});
    }


    function callGooglePlacesAutocomplete (acfunc) {
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
    }


    function revfs (callstr) {
        return jt.fs("app.review." + callstr);
    }


    function rotatePicButtonHTML () {
        var html = "";
        if(jt.hasId(crev) && crev.revpic) {
            html = ["button", {type: "button", id: "pdtfrbutton",
                               onclick: revfs("rotateupldpic()")},
                    "Rotate"]; }
        return html;
    }


    function picFileSelChange () {
        var fv = jt.byId("picfilein").value;
        //chrome yields a value like "C:\\fakepath\\circuit.png"
        fv = fv.split("\\").pop();
        jt.out("picfilelab", fv);
        jt.byId("picfilelab").className = "filesellab2";
        jt.byId("upldsub").style.visibility = "visible";
        app.review.monitorPicUpload("Init");
    }


    function picdlgModForm () {
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
                                  value: app.profile.myProfId()}],
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
    }


    function copyReview (review) {
        var copy = {};
        app.review.serializeFields(review);
        Object.keys(review).forEach(function (field) {
            copy[field] = review[field]; });
        app.review.deserializeFields(review);
        if(copy.svcdata) {
            app.review.deserializeFields(copy); }
        return copy;
    }


    function makeMine (review, srcrevId) {
        var now = new Date().toISOString();
        jt.setInstId(review, undefined);
        review.penid = app.profile.myProfId();
        review.ctmid = 0;
        review.rating = ratingDefaultValue;
        review.srcrev = srcrevId;
        review.modified = now;
        review.modhist = "";
        review.keywords = "";
        review.text = "";
        review.revpic = "";
        review.svcdata = "";
        review.penname = app.profile.myProfile().name;
        review.helpful = "";
        review.remembered = "";
    }


    function dlgReadButtonHTML () {
        return ["button", {type: "button", id: "rdurlbutton",
                           onclick: jt.fs("app.review.readURL()")},
                "Read"];
    }


    function dlgRevTypeSelection () {
        var html = [];
        reviewTypes.forEach(function (rt) {
            var clt = "reviewbadge";
            if(crev.revtype === rt.type) {
                clt = "reviewbadgesel"; }
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
                html = "Read site or select type"; }
            else {
                var tpd = jt.byId("rdtypepromptdiv");
                tpd.style.color = "#AB7300";
                tpd.style.fontWeight = "bold";
                tpd.style.fontSize = "medium";
                html = "&#x21E7;Select type&#x21E7;"; } }
        jt.out("rdtypepromptdiv", html);
        jt.byId("urlin").value = crev.url || "";
        jt.out("rdurlbuttonspan", jt.tac2html(dlgReadButtonHTML()));
    }


    function dlgKeyFieldEntry () {
        var rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet
            return; }
        var html = "";
        if(!jt.byId("rdkeyincontentdiv")) {
            html = ["div", {id: "rdkeyincontentdiv"}, 
                    [["label", {fo: "keyin", cla: "liflab", id: "keylab"}, 
                      rt.key],
                     ["input", {id: "keyin", cla: "lifin", type: "text",
                                oninput:jt.fs("app.review.buttoncheck()")}],
                     //There simply isn't enough traffic to maintain an
                     //Amazon relationship right now.  If an advertiser
                     //account is sustainable, update the access info and
                     //uncomment here to bring the functionality back.
                     // ["div", {id: "rdacdiv"},
                     //  ["input", {type: "checkbox", id: "rdaccb",
                     //             name: "autocompleteactivationcheckbox",
                     //             //<IE8 onchange only fires after onblur.
                     //             //check action nullified if return false.
                     //             onclick: jt.fsd("app.review.runAutoComp()"),
                     //             checked: jt.toru(crev.autocomp)}]],
                     ["div", {id: "revautodiv"}]]];
            jt.out("rdkeyindiv", jt.tac2html(html)); }
        jt.out("keylab", rt.key.capitalize());  //update label if type changed
        //when returning from autocomp selection, crev.title/name has been
        //updated and needs to be reflected in the form
        jt.byId("keyin").value = crev[rt.key] || jt.byId("keyin").value || "";
        var rdaccb = jt.byId("rdaccb");
        if(rdaccb) {
            rdaccb.checked = crev.autocomp; }
        if(html) {  //just initialized the key input, set for entry
            jt.byId("keyin").focus(); }
        app.review.runAutoComp();
    }


    function dlgPicHTML () {
        var imgsrc = "img/nopicrev.png";
        var type = verifyReviewImageDisplayType(crev);
        if(type === "upldpic") {
            imgsrc = "revpic?revid=" + jt.instId(crev) + 
                jt.ts("&cb=", crev.modified); }
        else if(type === "sitepic") {
            imgsrc = sslSafeRef(jt.instId(crev), crev.imguri); }
        return jt.tac2html(["img", {id:"dlgrevimg", cla:"revimg", src:imgsrc}]);
    }


    function dlgStarsHTML () {
        var imgfile = "img/stars18ptC.png"; 
        var greyfile = "img/stars18ptCg.png";
        var rat = app.review.starRating(crev.rating);
        var width = Math.floor(rat.step * (starimgw / rat.maxstep));
        var html = [];
        html.push(["img", {cla: "starsimg", src: "img/blank.png",
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(rat.step % 2 === 1) {  //odd, use half star display
            var offset = Math.floor(starimgw / rat.maxstep);
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
    }


    function dlgStarsActivate () {
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
    }


    function dlgStarsDeactivate () {
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
    }


    function dlgFieldInputHTML (fldn) {
        return ["div", {id: fldn + "div", cla: "rdfindiv"},
                ["input", {id: fldn + "in", type: "text", 
                           cla: "lifin", placeholder: fldn.capitalize(),
                           oninput:jt.fs("app.review.buttoncheck()")}]];
    }


    function setInputValueFromCurrent (field) {
        //If for any reason the revtype changes and the display isn't
        //updated (like coming back from reading a url) then it is possible
        //for a field input to not be available.  Set defensively, and log
        //it so there is some visibility into what is happening.
        var input = jt.byId(field + "in");
        if(!input) {
            jt.log("setInputValueFromCurrent: no input for " + field); }
        else {
            input.value = crev[field] || ""; }
    }


    function dlgDetailsEntry () {
        var rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no key field entry yet.
            return; }
        if(!jt.byId("rdpfdiv").innerHTML) {
            var html = [["div", {id: "rdstarsdiv"}, dlgStarsHTML()]];
            if(rt.subkey) {
                html.push(dlgFieldInputHTML(rt.subkey)); }
            rt.fields.forEach(function (field) {
                html.push(dlgFieldInputHTML(field)); });
            //onclick the div in case the enclosing image is broken
            //and can't function as a link to bring up the dialog
            html = [["div", {id: "rdpicdiv",
                             onclick: jt.fs("app.review.picdlg()")}, 
                     dlgPicHTML()],
                    html];
            jt.out("rdpfdiv", jt.tac2html(html));
            dlgStarsActivate(); }
        jt.out("rdpicdiv", dlgPicHTML());
        if(rt.subkey) {
            setInputValueFromCurrent(rt.subkey); }
        rt.fields.forEach(function (field) {
            setInputValueFromCurrent(field); });
        var fldttl = (rt.subkey? 1 : 0) + rt.fields.length;
        if(fldttl <= 1) {
            jt.byId("rdpicdiv").style.height = "80px"; }
        else if(fldttl <= 2) {
            jt.byId("rdpicdiv").style.height = "100px"; }
    }


    function dlgTextEntry () {
        var rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no text entry yet.
            return; }
        if(!jt.byId("rdtextdiv").innerHTML) {
            var ptxt = "Why is this worth remembering?";
            var html = [["div", {style:"height:2px;background-color:orange;",
                                 id:"txtlendiv"}],
                        ["textarea", {id:"rdta", placeholder:ptxt,
                                      onkeyup:jt.fs("app.review.txtlenind()"),
                                      onchange:jt.fs("app.review.revtxtchg()")},
                         crev.text || ""]];
            jt.out("rdtextdiv", jt.tac2html(html)); }
        //text is not dynamically updated
    }


    function dlgKeywordEntry () {
        var rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no keyword entry yet
            return; }
        crev.keywords = crev.keywords || "";
        var html = [];
        var rtkeywords = app.profile.keywordsForRevType(rt);
        rtkeywords.csvarray().forEach(function (dkword, i) {
            var chk = jt.toru(crev.keywords.indexOf(dkword) >= 0, "checked");
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
                               oninput: jt.fsd("app.review.togkey()"),
                               value: crev.keywords}]]]);
        jt.out("rdkwdiv", jt.tac2html(html));
    }


    function postedCoopRevId (ctmid, rev) {
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
    }


    function isPrecheckTheme (ctmid) {
        var orglen;
        if(crev && crev.precheckThemes && crev.precheckThemes.length) {
            orglen = crev.precheckThemes.length;
            crev.precheckThemes = crev.precheckThemes.filter(function (ctm) {
                return (ctm.ctmid !== ctmid); });
            return (crev.precheckThemes.length !== orglen); }
        return false;
    }


    //ctm may be a full Coop instance retrieved from lcs, or an abbreviated
    //instance retrieved from MUser.coops.
    function displayThemeCheckboxes (ctmid, ctm) {
        var html = []; var chk; var kwid;
        ctm.keywords = ctm.keywords || "";
        ctm.keywords.csvarray().forEach(function (kwd, idx) {
            kwd = kwd.trim();  //keywords may be ", " separated
            chk = jt.toru(crev.keywords.indexOf(kwd) >= 0, "checked");
            kwid = "ctm" + ctmid + "kw" + idx;
            html.push(["div", {cla: "rdkwcbdiv"},
                       [["input", {type: "checkbox", id: kwid, 
                                   cla: "keywordcheckbox",
                                   value: kwd, checked: chk,
                                   onclick: jt.fsd("app.review.togkey('" +
                                                   kwid + "')")}],
                        ["label", {fo: kwid}, kwd]]]); });
        jt.out("ctmkwdiv" + ctmid, jt.tac2html(html));
    }


    function dlgCoopPostSelection () {
        var rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no keyword entry yet
            return; }
        var html = [];
        var coops = app.profile.myProfile().coops;
        Object.keys(coops).forEach(function (ctmid) {
            var ctm = coops[ctmid];
            if(ctm.lev > 0 && !ctm.inactive) {
                var posted = jt.toru(postedCoopRevId(ctmid) || 
                                     isPrecheckTheme(ctmid));
                html.push(
                    ["div", {cla: "rdctmdiv"},
                     [["div", {cla: "rdglpicdiv"},
                       ["img", {cla: "rdglpic", alt: "",
                                src: "ctmpic?coopid=" + ctmid}]],
                      ["input", {type: "checkbox", id: "dctmcb" + ctmid,
                                 cla: "keywordcheckbox",
                                 value: ctmid, checked: posted,
                                 onclick: jt.fsd("app.review.togctmpost('" +
                                                 ctmid + "')")}],
                      ["label", {fo: "dctm" + ctmid, cla: "penflist"}, 
                       ctm.name],
                      ["div", {cla: "ctmkwdiv", 
                               id: "ctmkwdiv" + ctmid}]]]); } });
        if(html.length > 0) {
            html.unshift(["div", {cla: "formline"}]);
            html.unshift(["div", {cla: "liflab"}, "Post To"]); }
        jt.out("rdgdiv", jt.tac2html(html));
        Object.keys(coops).forEach(function (ctmid) {
            app.review.togctmpost(ctmid); });
    }


    function setAllCheckboxes (value, checked) {
        //getElementsByClassName returns partial results macFF42
        var nodes = document.getElementsByTagName("input");
        value = value.trim();
        Array.prototype.forEach.call(nodes, function (node) {
            if(node.type === "checkbox" && node.value.trim() === value) {
                node.checked = checked; } });
    }


    function membicTitleLine (type, rev, revdivid) {
        var url = app.review.membicURL(type, rev);
        var starstyle = "display:inline-block;";
        if(app.winw < 600) {
            starstyle = "float:right;"; }
        var dc = "membictitlenorm";
        var qnh = "";
        //rev.modified and rev.dispafter are set to UTC time, not local
        var nowiso = new Date().toISOString();
        if(rev.dispafter && rev.dispafter > nowiso) {
            qnh = ["div", {cla: "fpqoverdiv", id: revdivid + "fpqoverdiv"},
                   "Feeds after " + 
                   jt.tz2human(jt.isoString2Time(rev.dispafter))];
            dc = "membictitlefade"; }
        var html = [qnh,
                    ["div", {cla:dc},
                     [["a", {href:url, title:url,
                             onclick:jt.fs("window.open('" + url + "')")},
                       [["img", {cla:"reviewbadge", src:"img/" + type.img,
                                 title:type.type, alt:type.type}],
                        app.pcd.reviewItemNameHTML(type, rev)]],
                      "&nbsp;",
                      ["div", {cla:"starsnjumpdiv", style:starstyle},
                       ["div", {cla: "fpstarsdiv"},
                        app.review.starsImageHTML(rev)]]]]];
        return html;
    }


    function updateShareInfo () {
        notePostingCoops();  //populates rev.ctmids csv from checkboxes
        reviewTextValid();   //populates crev.text from input, shows any errors
        displayAppropriateButton();
        jt.out("sharediv", "");
        if(jt.hasId(crev)) {
            jt.byId("closedlg").click = app.review.done;
            jt.out("sharediv", jt.tac2html(app.layout.shareButtonsTAC(
                {url:crev.url || app.secsvr + "/" + app.profile.myProfId(),
                 title:crev.title || crev.name}))); }
    }


    function updateReviewDialogContents () {
        dlgRevTypeSelection();
        dlgKeyFieldEntry();
        dlgDetailsEntry();
        dlgTextEntry();
        dlgKeywordEntry();
        dlgCoopPostSelection();
    }


    function noteSaveError (code, errtxt) {
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
    }


    function displayMembicDialog () {
        var html;
        html = ["div", {id: "revdlgdiv"},
                [["div", {id: "rdtypesdiv"}],
                 ["div", {id: "rdtypepromptdiv"}],
                 ["div", {id: "rdurldiv"},
                  [["label", {fo: "urlin", cla: "liflab"}, "URL"],
                   ["input", {id: "urlin", cla: "lifin", type: "url",
                              placeholder: "Paste Link Here",
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
    }


    function postSaveProcessing (updobjs) {
        app.lcs.uncache("activetps", "411");
        if(crev.ctmids) {  //uncache stale themes data
            crev.ctmids.csvarray().forEach(function (ctmid) {
                app.lcs.uncache("coop", ctmid); }); }
        orev = updobjs[1];
        app.review.deserializeFields(orev);
        crev = copyReview(orev);
        //To show "Done" after "Save" completed, the dlg contents needs to
        //match the orev, so update the dlg to ensure they are the same.
        app.review.updatedlg();
        updobjs.forEach(function (updobj) {
            if(updobj.obtype === "MUser" || updobj.obtype === "Coop") {
                app.lcs.put(updobj.obtype, updobj); } });
        //need to rebuild the theme checkboxes in case they tried to post to
        //a theme that was archived, or they lost membership.  coops data
        //will have been updated server side (coop.py may_write_review)
        dlgCoopPostSelection();  //rebuild checked themes from saved info
        updateShareInfo();
    }


    //Not copying info from someone else's review instance even if it
    //is available.  URL contents change, and descriptive fields can
    //be innacurate or worse.  This is just to help avoid a person
    //entering the same info again.
    function editExistingMembicByURL (url) {
        var prof = app.profile.myProfile();
        if(!prof) {
            return null; }
        var revs = prof.preb || [];
        //Array.find generally available except on Internet Explorer
        return revs.find(function (rev) {
            if(rev.url === url || rev.rurl === url) {
                orev = rev;
                crev = copyReview(orev);
                return rev; }
            return false; });
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        autourl = "";
        crev = {autocomp:true, rating:ratingDefaultValue };
        autocomptxt = "";
    },


    start: function (source) {
        app.review.resetStateVars();
        if(typeof source === "string") {  //passed in a url
            autourl = source; }
        if(typeof source === "object") {  //passed in another review
            orev = source;
            crev = copyReview(source);
            if(source.penid !== app.profile.myProfId()) {
                makeMine(crev, jt.instId(source)); } }
        crev.penid = app.profile.myProfId();
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
        if(init) {
            monitor = {state: "init", count: 0};
            jt.out("pdtfbuttondiv", "");    //remove rotate button
            jt.out("imgupstatdiv", ""); }
        else {
            monitor.state = "waiting";
            monitor.count += 1; }
        var ptdif = jt.byId("ptdif");
        if(ptdif) {
            var fc = ptdif.contentDocument || ptdif.contentWindow.document;
            if(fc && fc.body) {  //body unavailable if err write in process
                var txt = fc.body.innerHTML;
                jt.out("bottomstatdiv", monitor.state + " " + monitor.count + 
                       ": " + txt);
                var ridpre = "revid: ";
                if(txt.indexOf(ridpre) === 0) {
                    var revid = txt.slice(ridpre.length);
                    jt.setInstId(crev, revid);
                    crev.revpic = revid;
                    jt.byId("upldpicimg").src = "revpic?revid=" + revid +
                        jt.ts("&cb=", "second");  //crev.modified unchanged
                    return picdlgModForm(); }
                var errpre = "failed: ";
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
        var cb = jt.byId("rdaccb");
        if(!cb || !cb.checked) {
            //jt.log("autocomp rdaccb not found or not checked");
            jt.out("revautodiv", "");
            return; }
        if(crev.autocomp && jt.byId("revautodiv") && jt.byId("keyin")) {
            var srchtxt = jt.byId("keyin").value;
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


    readURL: function (url, params) {
        if(!params) {
            params = {}; }
        if(!url) {
            var urlin = jt.byId("urlin");
            if(urlin) {
                url = urlin.value; } }
        if(!url) {  //reflect any other updates done in the interim.
            crev.autocomp = false;
            return app.review.updatedlg(); }
        if(!jt.instId(crev) && editExistingMembicByURL(url)) {
            return app.review.updatedlg(); }
        if(crev.title && !crev.autocomp &&
           !confirm("Re-read title and other fields?")) {
            return; }
        //If the title or other key fields are not valid, that's ok because
        //we are about to read them. But don't lose comment text.
        reviewTextValid();
        url = url.trim();
        if(url) {
            var rbc = jt.byId("rdurlbuttonspan");
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


    keywordcsv: function (kwid, keycsv) {
        var cbox = null; var text = ""; var keywords = keycsv.split(",");
        if(kwid) {
            cbox = jt.byId(kwid); }
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
        kwid = kwid || "";
        var rdkwin = jt.byId("rdkwin");
        //if the user is entering a space (presumably as part of a
        //multi-word keyword), or entering a comma (in preparation for
        //another keyword), get out of the way.
        if(rdkwin.value && (rdkwin.value.endsWith(" ") ||
                            rdkwin.value.endsWith(","))) {
            return; }
        //to avoid odd editing interactions, back off interim manual editing
        if(rdkwin.value && (rdkwin.value.trim() === crev.keywords ||
                            rdkwin.value.trim() === crev.keywords + ",")) {
            return; }
        var keycsv = app.review.keywordcsv(kwid, rdkwin.value);
        rdkwin.value = keycsv;
        displayAppropriateButton();
    },


    togctmpost: function (ctmid) {
        var cbox = jt.byId("dctmcb" + ctmid);
        if(cbox) {
            if(cbox.checked) {
                updateShareInfo();  //note themes being posted to
                var ctm = app.lcs.getRef("coop", ctmid);
                ctm = ctm.coop || app.profile.myProfile().coops[ctmid];
                displayThemeCheckboxes(ctmid, ctm); }
            else {
                jt.out("ctmkwdiv" + ctmid, ""); } }
        displayAppropriateButton();
    },


    txtlenind: function () {
        var rdta = jt.byId("rdta");
        var tld = jt.byId("txtlendiv");
        if(rdta && tld) {
            var width = rdta.value || "";
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
        //remove save button immediately to avoid double click dupes...
        displayAppropriateButton("Saving...");
        if(!skipvalidation) {
            displayAppropriateButton("Verifying...");
            var errors = validateCurrentReviewFields();
            if(errors.length > 0) {
                displayAppropriateButton(errors.reduce(function (pv, cv) {
                    return pv + cv + "<br/>"; }, ""), true);
                return; }
            if(!app.coop.confirmPostThrough(crev)) {
                displayAppropriateButton();
                return; }}
        displayAppropriateButton("Writing...");
        crev.penid = crev.penid || app.profile.myProfId();  //verify
        app.layout.cancelOverlay(true);  //just in case it is still up
        app.onescapefunc = null;
        app.review.serializeFields(crev);
        var data = jt.objdata(crev);
        app.review.deserializeFields(crev); //in case update fail or interim use
        data += "&editingtheme=" + app.pcd.editingTheme();
        jt.call("POST", "saverev?" + app.login.authparams(), data,
                function (updobjs) {
                    jt.log("saverev completed successfully");
                    displayAppropriateButton("Saved.");
                    postSaveProcessing(updobjs); },
                app.failf(function (code, errtxt) {
                    displayAppropriateButton(
                        noteSaveError(code, errtxt), true); }),
                jt.semaphore("review.save"));
    },


    done: function () {
        if(jt.hasId(crev) && haveChanges()) {
            if(!confirm("Discard changes?")) {
                return; } }
        app.layout.closeDialog();
        //return to wherever we were, while allowing for any other
        //processing that needs to get done (like clearing params).
        app.login.doNextStep({});
    },


    picdlg: function (picdisp) {
        if(picdisp) {
            crev.scvdata = crev.svcdata || {};
            crev.svcdata.picdisp = picdisp; }
        var dt = verifyReviewImageDisplayType(crev);
        var revid = jt.instId(crev);
        var html = [
            "div", {id:"revpicdlgdiv"},
            [["ul", {cla:"revpictypelist"},
              [["li",
                [["input", { type:"radio", name:"upt", value:"sitepic",
                             checked:jt.toru(dt === "sitepic"),
                             onchange:revfs("picdlg('sitepic')")}],
                 ["div", {id:"sitepicdetaildiv", cla:"ptddiv"},
                  [["img", {id:"sitepicimg", cla:"revimgdis",
                            src:crev.imguri || "img/nopicprof.png",
                            onclick:revfs("picdlg('sitepic')")}],
                   ["div", {id:"sitepicform", cla:"overform"}]]]]],
               ["li",
                [["input", {type:"radio", name:"upt", value:"upldpic",
                            checked:jt.toru(dt === "upldpic"),
                            onchange:revfs("picdlg('upldpic')")}],
                 ["div", {id:"upldpicdetaildiv", cla:"ptddiv"},
                  [["img", {id:"upldpicimg", cla:"revimgdis",
                            src:(crev.revpic ? ("revpic?revid=" + revid + 
                                                 jt.ts("&cb=", "second"))
                                  : "img/nopicrev.png"),
                            onclick:revfs("picdlg('upldpic')")}],
                   ["div", {id:"upldpicform", cla:"overform"}]]]]],
               ["li",
                [["input", {type:"radio", name:"upt", value:"nopic",
                            checked:jt.toru(dt === "nopic"),
                            onchange:revfs("picdlg('nopic')")}],
                 ["span", {cla:"ptdlabspan"}, "No Pic"]]]]]]];
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


    rotateupldpic: function () {
        var revid = jt.instId(crev);
        var data = "revid=" + revid + "&penid=" + app.profile.myProfId();
        jt.out("pdtfbuttondiv", "Rotating...");
        jt.call("POST", "rotatepic?" + app.login.authparams(), data,
                function (reviews) {
                    //the updated review is partial, don't replace crev
                    crev.modified = reviews[0].modified;
                    var picsrc = "revpic?revid=" + revid + 
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
        var starsobj = {};
        var starTitles = [ "No stars", "Half a star", 
                           "One star", "One and a half stars",
                           "Two stars", "Two and a half stars",
                           "Three stars", "Three and a half stars",
                           "Four stars", "Four and a half stars",
                           "Five stars" ];
        var roundNumeric = [ 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5 ];
        var asterisks = [ "0", "+", "*", "*+", "**", "**+", "***", "***+",
                          "****", "****+", "*****" ];
        var unicodestr = [ "0", "\u00BD", "\u2605", "\u2605\u00BD", 
                           "\u2605\u2605", "\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605", 
                           "\u2605\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605\u2605", 
                           "\u2605\u2605\u2605\u2605\u00BD",
                           "\u2605\u2605\u2605\u2605\u2605" ];
        if(typeof rating === "string") { 
            rating = parseInt(rating, 10); }
        if(!rating || typeof rating !== "number" || rating < 0) { 
            rating = ratingDefaultValue; }
        if(rating > 93) {  //compensate for floored math (number by feel)
            rating = 100; }
        var step = Math.floor((rating * (starTitles.length - 1)) / 100);
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
        var maxretry = 10;
        retry = retry || 0;
        if(errmsg) {
            jt.log("selectLocLatLng error: " + errmsg); }
        if(retry > maxretry) {
            verifyGeocodingInfoDiv(true);
            var html = jt.byId("geocodingInfoDiv").innerHTML;
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
                var mapdiv = jt.byId("mapdiv");
                var map = new google.maps.Map(mapdiv, {
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


    displayingExpandedView: function (prefix, revid) {
        //It's less work to just write the content once and then just toggle
        //the display style, but that would mean more work up front while
        //filtering lots of reviews.  Since writing the expanded content
        //later, it's easier just to write it each time and test for its
        //existence as the expansion display indicator.
        var datedivid = prefix + revid + "datediv";
        if(jt.byId(datedivid).innerHTML) {
            return true; }
        return false;
    },


    revdispHTML: function (prefix, revid, rev, togfname) {
        togfname = togfname || "app.review.toggleExpansion";
        var revdivid = prefix + revid;
        var type = app.review.getReviewTypeByValue(rev.revtype);
        fixReviewURL(rev);
        var html = ["div", {cla:"fpinrevdiv"}, [
            ["div", {cla:"fptitlediv"}, membicTitleLine(type, rev, revdivid)],
            ["div", {cla:"fpbodydiv"},
             [["div", {cla:"fprevpicdiv"}, app.review.picHTML(rev, type)],
              ["div", {cla:"fpdcontdiv"},
               ["div", {cla:"fpdescrdiv", id:revdivid + "descrdiv"},
                dispRevText(prefix, revid, rev, togfname)]],
              ["div", {cla:"fpauthpicdiv", id:revdivid + "authpicdiv"}],
              ["div", {cla:"fpsecfieldsdiv", id:revdivid + "secdiv"}],
              ["div", {cla:"fpdatediv", id:revdivid + "datediv"}],
              ["div", {cla:"fpkeywrdsdiv", id:revdivid + "keysdiv"}],
              ["div", {cla:"fpctmsdiv", id:revdivid + "ctmsdiv"},
               postedCoopLinksHTML(rev)]]]]];
        return html;
    },


    isDupeRev: function (/* rev, pr */) {
        //With a feed based design and inline text review expansion,
        //collapsing duplicate reviews is confusing.  Leaving this code here
        //for reference in case the collapse turns out to be useful as an
        //embed setting.  Clean up if not. ep 13aug19.
        // if(rev && pr &&
        //    ((jt.strPos(rev.srcrev) && rev.srcrev === pr.srcrev) ||
        //     (rev.cankey && rev.cankey === pr.cankey) ||
        //     (rev.url && rev.url === pr.url))) {
        //     return true; }
        return false;
    },


    displayReviews: function (pdvid, pfx, membics, ptogb, pauth, xem) {
        var html = [];
        var rt = app.layout.getType();
        if(!membics || membics.length === 0) {
            if(rt === "all") {
                html = "No membics to display."; }
            else {
                rt = app.review.getReviewTypeByValue(rt);
                html = "No " + rt.plural + " found."; }
            if(xem) {  //display extra empty message (prompt to write)
                html = [html, xem]; }
            html = ["div", {id:"membicliststatusdiv"}, html]; }
        jt.out(pdvid, jt.tac2html(html));
        app.stopLoopers();
        var state = {divid:pdvid, prefix:pfx, idx:0, revs:membics, 
                     prev:null, author:pauth, togcbn:ptogb};
        app.loopers.push(state);
        app.fork({descr:"revDispIterator start",
                  func:function () {
                      app.review.revDispIterator(state); },
                  ms:50});
    },


    revDispIterator: function (state) {
        var rev; var revdivid; var maindivattrs; var elem;
        var outdiv = jt.byId(state.divid);
        if(outdiv && !state.cancelled && state.idx < state.revs.length) {
            if(state.idx > 0) {
                state.prev = state.revs[state.idx - 1]; }
            rev = state.revs[state.idx];
            convertOldThemePostLabel(rev);
            revdivid = state.prefix + jt.instId(rev);
            maindivattrs = {id: revdivid + "fpdiv", cla: "fpdiv"};
            if(rev.srcrev === "-604" || 
                   app.review.isDupeRev(rev, state.prev) || 
                   (state.author === "notself" && 
                    rev.penid === app.profile.myProfId())) {
                maindivattrs.style = "display:none"; }
            elem = document.createElement("div");
            elem.className = "fpcontdiv";
            elem.innerHTML = jt.tac2html(
                ["div", maindivattrs,
                 ["div", {cla: (state.author? "fparevdiv" : "fpnarevdiv"),
                          id: revdivid},
                  app.review.revdispHTML(state.prefix, jt.instId(rev), 
                                         rev, state.togcbn)]]);
            outdiv.appendChild(elem); 
            state.idx += 1;
            app.fork({
                descr:"revDispIterator loop",
                func:function () {
                    app.review.revDispIterator(state); },
                ms:50}); }
    },


    toggleExpansion: function (revs, prefix, revid) {
        var i; var rev; var elem; var revdivid;
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
        toggleDispRevText(prefix, revid, rev);
        if(app.review.displayingExpandedView(prefix, revid)) {
            jt.out(revdivid + "authpicdiv", "");
            jt.out(revdivid + "secdiv", "");
            jt.out(revdivid + "datediv", "");
            jt.out(revdivid + "keysdiv", "");
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
        else {  //expand
            jt.out(revdivid + "authpicdiv", fpMembicAuthPicHTML(rev));
            jt.out(revdivid + "secdiv", fpSecondaryFieldsHTML(rev));
            jt.out(revdivid + "datediv", 
                   jt.colloquialDate(jt.isoString2Day(rev.modified)));
            jt.out(revdivid + "keysdiv", rev.keywords);
            jt.out(revdivid + "ctmsdiv", postedCoopLinksHTML(rev)); }
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


    //Called by mail-in membic processing when probable theme names in email.
    precheckThemes: function (ctms) {
        if(crev) {
            crev.precheckThemes = ctms; }
    },


    updateRating: function (rating) {
        crev.rating = rating;
        jt.out("rdstarsdiv", jt.tac2html(dlgStarsHTML()));
    },


    serializeFields: function (rev) {
        if(typeof rev.svcdata === "object") {
            rev.svcdata = JSON.stringify(rev.svcdata); }
        else {
            rev.svcdata = rev.svcdata || ""; }
    },


    deserializeFields: function (rev) {
        app.lcs.reconstituteJSONObjectField("svcdata", rev);
    }

}; //end of returned functions
}());

