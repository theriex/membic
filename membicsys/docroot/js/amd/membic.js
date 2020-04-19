/*global window, confirm, app, jt, google, document */

/*jslint browser, white, fudge, for, long */

app.membic = (function () {
    "use strict";

    var addmem = null;  //The new membic being added
    var savind = "";    //Ongoing save indicator
    var expandedMembics = {};  //currently expanded membics (by src membic id)
    var formElements = null;  //forward declare to avoid circular func refs
    var rto = null;  //input reaction timeout

    //If a url was pasted or passed in as a parameter, then potentially
    //modified by automation, that "cleaned" value should be kept to
    //confirm against the potentially edited form field value.
    var autourl = "";
    var orev = null;  //The original review before editing started
    var crev = {};    //The current review being displayed or edited.
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
    // Membic Type Definition guidelines:
    // 1. Too many fields makes entry tedious.  The goal is adequate
    //    identification, not full database info.
    // 2. Default keywords should be widely applicable across the possible 
    //    universe of membics for a type.  They describe perceptions, not
    //    classification (e.g. "Funny" rather than "Comedy").
    // 3. If something has a subkey, keep the primary key prompt
    //    short so it doesn't cause ugly formatting.
    var membicTypes = [
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
        var imgfile = app.dr("img/stars18ptC.png");
        var greyfile = app.dr("img/stars18ptCg.png");
        var width; var offset; var rat; var html;
        if(typeof rating !== "number") {
            mode = mode || (rating.srcrev === "-101" ? "prereview" : "read");
            rating = rating.rating; }
        rat = app.membic.starRating(rating);
        width = Math.floor(rat.step * (starimgw / rat.maxstep));
        html = [];
        html.push(["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(mode === "edit") {  //add appropriate grey star background on right
            if(rat.step % 2 === 1) {  //odd, use half star display
                offset = Math.floor(starimgw / rat.maxstep);
                html.push(
                    ["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "')" +
                                                " -" + offset + "px 0;",
                             title: rat.title, alt: rat.title}]); }
            else { //even, use full star display
                html.push(
                    ["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "');",
                             title: rat.title, alt: rat.title}]); } }
        else { //add blank space to left justify stars
            html.push(["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                               style: "width:" + (starimgw - width) + "px;" +
                                      "height:" + starimgh + "px;"}]); }
        return jt.tac2html(html);
    }


    function findMembicType (type) {
        var revtype;
        if(!type) {
            return null; }
        type = type.toLowerCase();
        revtype = membicTypes[membicTypes.length - 1];  // default is "other"
        membicTypes.every(function (rt) {
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


    function getURLReader (url, callfunc) {
        //app.youtube dies all the time due to the number of API calls
        //    being exhausted, and the standard reader does just as well.
        //app.netflix became nonfunctional when netflix retired the
        //    odata catalog on 08apr14.
        //app.amazon is disabled until membic has enough traffic to sustain
        //an advertiser relationship.
        // if(url.indexOf(".amazon.") > 0) {
        //     return callfunc(app.amazon); }
        if(url.toLowerCase().indexOf("vimeo.") > 0) {  //https://vimeo.com/id
            return callfunc(app.jsonapi); }
        callfunc(app.readurl);
    }


    function reviewTextValid (ignore /*type*/, errors) {
        var input = jt.byId("rdta");
        if(input) {
            crev.text = input.value;
            if(!crev.text && errors) {
                errors.push("Why memorable?"); } }
    }


    function verifyMembicImageDisplayType (membic) {
        var dt = "guess";
        if(membic.svcdata && typeof membic.svcdata === "string") {
            app.refmgr.deserialize(membic); }
        if(membic.svcdata && membic.svcdata.picdisp) {
            dt = membic.svcdata.picdisp; }
        if(dt !== "nopic" && dt !== "sitepic" && dt !== "upldpic") {
            dt = "guess"; }
        if(dt === "guess") {
            if(membic.imguri) {
                dt = "sitepic"; }
            else if(membic.revpic) {
                dt = "upldpic"; }
            else {
                dt = "nopic"; } }
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.picdisp = dt;
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
        var srcid = review.dsId;
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
        html = {id: "revimg" + review.dsId, cla: "revimg", 
                src:app.dr("img/nopicprof.png")};
        if(jt.isLowFuncBrowser()) {
            html.style = "width:125px;height:auto;"; }
        switch(verifyMembicImageDisplayType(review)) {
        case "sitepic":
            html.src = sslSafeRef(review.dsId, review.imguri);
            break;
        case "upldpic":
            //Use source rev img for theme posts to take advantage of caching.
            html.src = "revpic?revid=" + sourceRevId(review) + 
                jt.ts("&cb=", review.modified);
            break;
        case "nopic":
            if(mode !== "edit") {
                html.src = app.dr("img/blank.png"); }
            break; }
        html = ["img", html];
        if(mode === "edit") {
            html = ["a", {href: "#changepic", 
                          onclick: jt.fs("app.membic.picdlg()")},
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
            type = findMembicType(crev.revtype); }
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
        var rt = findMembicType(crev.revtype);
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
                             src:"/api/obimg?dt=MUser&di=" + rev.penid}]];
        return jt.tac2html(html);
    }


    function fpSecondaryFieldsHTML (rev) {
        var html = [];
        findMembicType(rev.revtype).fields.forEach(function (field) {
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
                             onclick: jt.fs("app.membic.save()")},
                  "Save"],
                 ["button", {type: "button", id: "donebutton",
                             onclick: jt.fs("app.membic.done()")},
                  "Done"]])); }
        statmsg = statmsg || "";
        jt.out("rdokstatdiv", statmsg);
        if((statmsg && !messageWithButton) || !findMembicType(crev.revtype)) {
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
            sval = app.membic.starRating(sval, true).value; }
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
                             onclick: jt.fs("app.membic.readURL('" + 
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
                var selfunc = "app.membic.selectLocation('" +
                    jt.embenc(place.description) + "','" + 
                    place.reference + "')";
                items.push(["li",
                            ["a", {href: "#selectloc",
                                   onclick: jt.fs(selfunc)},
                             place.description]]); }); }
        var html = [["ul", items],
                    ["img", {src:app.dr("img/poweredbygoogle.png")}]];
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
        return jt.fs("app.membic." + callstr);
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
        app.membic.monitorPicUpload("Init");
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
                                  value: crev.dsId}],
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
                                       onclick: jt.fs("app.membic.upsub()"),
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
        app.membic.serializeFields(review);
        Object.keys(review).forEach(function (field) {
            copy[field] = review[field]; });
        app.membic.deserializeFields(review);
        if(copy.svcdata) {
            app.membic.deserializeFields(copy); }
        return copy;
    }


    function makeMine (review, srcrevId) {
        var now = new Date().toISOString();
        review.dsId = undefined;
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
                           onclick: jt.fs("app.membic.readURL()")},
                "Read"];
    }


    function dlgRevTypeSelection () {
        var html = [];
        membicTypes.forEach(function (rt) {
            var clt = "reviewbadge";
            if(crev.revtype === rt.type) {
                clt = "reviewbadgesel"; }
            html.push(["a", {href: "#" + rt.type, cla: "typeselect",
                             onclick: jt.fs("app.membic.updatedlg('" + 
                                            rt.type + "')")},
                       ["img", {cla: clt, src:app.dr("img/" + rt.img)}]]); });
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
        var rt = findMembicType(crev.revtype);
        if(!rt) {  //no type selected yet
            return; }
        var html = "";
        if(!jt.byId("rdkeyincontentdiv")) {
            html = ["div", {id: "rdkeyincontentdiv"}, 
                    [["label", {fo: "keyin", cla: "liflab", id: "keylab"}, 
                      rt.key],
                     ["input", {id: "keyin", cla: "lifin", type: "text",
                                oninput:jt.fs("app.membic.buttoncheck()")}],
                     //There simply isn't enough traffic to maintain an
                     //Amazon relationship right now.  If an advertiser
                     //account is sustainable, update the access info and
                     //uncomment here to bring the functionality back.
                     // ["div", {id: "rdacdiv"},
                     //  ["input", {type: "checkbox", id: "rdaccb",
                     //             name: "autocompleteactivationcheckbox",
                     //             //<IE8 onchange only fires after onblur.
                     //             //check action nullified if return false.
                     //             onclick: jt.fsd("app.membic.runAutoComp()"),
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
        app.membic.runAutoComp();
    }


    function dlgPicHTML () {
        var imgsrc = app.dr("img/nopicrev.png");
        var type = verifyMembicImageDisplayType(crev);
        if(type === "upldpic") {
            imgsrc = "revpic?revid=" + crev.dsId + 
                jt.ts("&cb=", crev.modified); }
        else if(type === "sitepic") {
            imgsrc = sslSafeRef(crev.dsId, crev.imguri); }
        return jt.tac2html(["img", {id:"dlgrevimg", cla:"revimg", src:imgsrc}]);
    }


    function dlgStarsHTML () {
        var imgfile = app.dr("img/stars18ptC.png");
        var greyfile = app.dr("img/stars18ptCg.png");
        var rat = app.membic.starRating(crev.rating);
        var width = Math.floor(rat.step * (starimgw / rat.maxstep));
        var html = [];
        html.push(["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(rat.step % 2 === 1) {  //odd, use half star display
            var offset = Math.floor(starimgw / rat.maxstep);
            html.push(
                ["img", {cla: "starsimg", src:app.dr("img/blank.png"),
                         style: "width:" + (starimgw - width) + "px;" + 
                                "height:" + starimgh + "px;" +
                                "background:url('" + greyfile + "')" +
                                    " -" + offset + "px 0;",
                         title: rat.title, alt: rat.title}]); }
        else { //even, use full star display
            html.push(
                ["img", {cla: "starsimg", src:app.dr("img/blank.png"),
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
                           oninput:jt.fs("app.membic.buttoncheck()")}]];
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
        var rt = findMembicType(crev.revtype);
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
                             onclick: jt.fs("app.membic.picdlg()")}, 
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
        var rt = findMembicType(crev.revtype);
        if(!rt) {  //no type selected yet, so no text entry yet.
            return; }
        if(!jt.byId("rdtextdiv").innerHTML) {
            var ptxt = "Why is this worth remembering?";
            var html = [["div", {style:"height:2px;background-color:orange;",
                                 id:"txtlendiv"}],
                        ["textarea", {id:"rdta", placeholder:ptxt,
                                      onkeyup:jt.fs("app.membic.txtlenind()"),
                                      onchange:jt.fs("app.membic.revtxtchg()")},
                         crev.text || ""]];
            jt.out("rdtextdiv", jt.tac2html(html)); }
        //text is not dynamically updated
    }


    function dlgKeywordEntry () {
        var rt = findMembicType(crev.revtype);
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
                                   onclick: jt.fsd("app.membic.togkey('dkw" + 
                                                   i + "')")}],
                        ["label", {fo: "dkw" + i}, dkword]]]); });
        html = [["div", {id: "rdkwcbsdiv"}, html]];
        html.push(["div", {id: "rdkwindiv"},
                   [["label", {fo: "rdkwin", cla: "liflab", id: "rdkwlab"},
                     ["a", {href: "#keywordsdescription",
                            onclick: jt.fs("app.membic.kwhelpdlg()")},
                      "Keywords"]],
                    ["input", {id: "rdkwin", cla: "lifin", type: "text", 
                               oninput: jt.fsd("app.membic.togkey()"),
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
                                   onclick: jt.fsd("app.membic.togkey('" +
                                                   kwid + "')")}],
                        ["label", {fo: kwid}, kwd]]]); });
        jt.out("ctmkwdiv" + ctmid, jt.tac2html(html));
    }


    function dlgCoopPostSelection () {
        var rt = findMembicType(crev.revtype);
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
                                 onclick: jt.fsd("app.membic.togctmpost('" +
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
            app.membic.togctmpost(ctmid); });
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
        var url = app.membic.membicURL(type, rev);
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
                       [["img", {cla:"reviewbadge", 
                                 src:app.dr("img/" + type.img),
                                 title:type.type, alt:type.type}],
                        app.pcd.membicItemNameHTML(type, rev)]],
                      "&nbsp;",
                      ["div", {cla:"starsnjumpdiv", style:starstyle},
                       ["div", {cla: "fpstarsdiv"},
                        app.membic.starsImageHTML(rev)]]]]];
        return html;
    }


    function updateShareInfo () {
        notePostingCoops();  //populates rev.ctmids csv from checkboxes
        reviewTextValid();   //populates crev.text from input, shows any errors
        displayAppropriateButton();
        jt.out("sharediv", "");
        if(jt.hasId(crev)) {
            jt.byId("closedlg").click = app.membic.done;
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
                              oninput:jt.fs("app.membic.buttoncheck()")}],
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
                                      jt.fs("app.membic.done()"));
        app.layout.openDialog(
            {x: Math.max(jt.byId("contentdiv").offsetLeft - 34, 20),
             y: window.pageYOffset + 22},
            jt.tac2html(html), updateReviewDialogContents, updateShareInfo);
    }


    function postSaveProcessing (updobjs) {
        app.lcs.uncache("activetps", "411");
        if(crev.ctmids) {  //uncache stale themes data
            crev.ctmids.csvarray().forEach(function (ctmid) {
                app.lcs.uncache("coop", ctmid); }); }
        orev = updobjs[1];
        app.membic.deserializeFields(orev);
        crev = copyReview(orev);
        //To show "Done" after "Save" completed, the dlg contents needs to
        //match the orev, so update the dlg to ensure they are the same.
        app.membic.updatedlg();
        updobjs.forEach(function (updobj) {
            if(updobj.dsType === "MUser" || updobj.dsType === "Theme") {
                app.lcs.put(updobj.dsType, updobj); } });
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


    function membicActionButtonsHTML (membic, idx) {
        var auth = app.login.authenticated();
        var html = "";
        if(auth && auth.authId === membic.penid) {  //my membic
            html = jt.tac2html(
                [["a", {href:"#edit", title:"Edit Membic",
                        onclick:jt.fs("app.pcd.editMembic(" + idx + ")")},
                  ["img", {cla:"masactbimg",
                           src:app.dr("img/writereview.png")}]],
                 ["a", {href:"#delete", title:"Delete Membic",
                        onclick:jt.fs("app.pcd.deleteMembic(" + idx + ")")},
                  ["img", {cla:"masactbimg",
                           src:app.dr("img/trash.png")}]]]); }
        else if(auth && app.theme.memberlev(membic.ctmid) >= 2) {
            html = jt.tac2html(
                ["a", {href:"#remove", title:"Remove Theme Post",
                       onclick:jt.fs("app.pcd.removeMembic(" + idx + ")")},
                 ["img", {cla:"masactbimg",
                          src:app.dr("img/trash.png")}]]); }
        return html;
    }


    //mtype, actions, profpic, name created ****
    function membicActionsHTML (membic, idx) {
        var mt = membicTypes.find((md) => md.type === membic.revtype);
        var cretxt = jt.colloquialDate(membic.created, "compress");
        //There's not really enough room on a phone to show a second date,
        //and modified may be off due to porting updates.
        // if(membic.modified > membic.created) {
        //     var modtxt = jt.colloquialDate(membic.modified, "compress");
        //     if(modtxt !== cretxt) {
        //         cretxt += "/" + modtxt; } }
        var profname = app.profile.profname(membic.penid, membic.penname);
        return jt.tac2html(
            [["img", {cla:"mastypeimg", src:app.dr("img/" + mt.img),
                      title:mt.type, alt:mt.type}],
             ["span", {cla:"masactspan"}, membicActionButtonsHTML(membic, idx)],
             ["span", {cla:"mascrespan"}, cretxt],
             ["span", {cla:"masbyline"},
              ["a", {href:"#" + membic.penid, title:"Visit " + profname,
                     onclick:jt.fs("app.statemgr.setState('MUser','" +
                                   membic.penid + "')")},
               [["img", {src:app.profile.profimgsrc(membic.penid)}],
                ["span", {cla:"penlight"}, profname]]]],
             ["span", {cla:"masratspan"}, starsImageHTML(membic.rating)]]);
    }


    //Thought about adding membic share button to make your own membic off
    //of an existing one, but that adds complexity, would likely be of very
    //limited use, and detract from the external nature of sharing.  To make
    //a membic off an existing membic you can always use the mail share and
    //mail it in.
    function membicShareHTML (membic) {
        var subj = membic.text;
        var body = membic.url;
        var mlink = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body) + "%0A%0A";
        return jt.tac2html(app.layout.shareButtonsTAC(
            {url:membic.url,
             title:membic.text,
             mref:mlink,
             socmed:["tw", "fb", "em"]}));
    }


    function mayEdit (membic) {
        var prof = app.profile.myProfile();
        if(prof && prof.dsId === membic.penid) {
            return true; }
        return false;
    }


    function safeInner (tagid) {
        var elem = jt.byId(tagid);
        if(!elem) {
            return ""; }
        return elem.innerHTML;
    }


    //If the theme is not cached, then there is no modified value to use as
    //an appropriate cache bust parameter.  Since a plain img src reference
    //can hang around for a potentially really long time, this uses a one
    //hour time slug with minutes removed.  That provides for re-use across
    //multiple display uses with eventual refresh.
    function themeImgSrc(tid) {
        var theme = app.refmgr.cached("Theme", tid);
        if(theme) {
            return app.pcd.picImgSrc(theme); }
        return app.dr("/api/obimg?dt=Theme&di=" + tid + jt.ts("&cb=", "hour"));
    }


    //As you accumulate themes over time, you don't want to keep seeing
    //suggestions for older archives.
    function membicThemePostsHTML (cdx, membic) {
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.postctms = membic.svcdata.postctms || [];
        if(!mayEdit(membic) && !membic.svcdata.postctms.length) {
            return ""; }
        var links = [];
        var tidcsv = "";
        membic.svcdata.postctms.forEach(function (pn) {
            tidcsv = tidcsv.csvappend(pn.ctmid);
            var html = [
                ["a", {href:app.dr("theme/" + pn.ctmid),
                       onclick:jt.fs("app.statemgr.setState('Theme','" +
                                     pn.ctmid + "')")},
                 [["img", {src:themeImgSrc(pn.ctmid)}],
                  pn.name]]];
            if(mayEdit(membic)) {
                //onclick of the '+' it changes to a select with options
                //built from preferred themes minus those already selected.
                //onchange of theme selection, it converts to a postnote
                //with a remove.
                html.push(
                    ["button", {type:"button", title:"Remove membic from theme",
                                onclick:jt.fs("app.membic.removepost(" + cdx +
                                              ",'" + pn.ctmid + "')")},
                     "x"]); }
            links.push(jt.tac2html(
                ["div", {cla:"postnotediv"}, html])); });
        if(mayEdit(membic)) {
            links.push(jt.tac2html(
                ["div", {cla:"postnotediv", id:"addthemepostdiv" + cdx},
                 ["button", {type:"button", title:"Add Theme Post",
                             onclick:jt.fs("app.membic.themeselect(" + cdx + 
                                           ")")},
                  "+"]])); }
        return jt.tac2html(
            ["div", {cla:"postnotescontainerdiv"},
             [["span", {id:"postedthemeids" + cdx, style:"display:none"},
               tidcsv],
              ["span", {cla:"masptlab"}, "Posted to: "],
              links.join(" | ")]]);
    }


    function selectedPostThemes (cdx, membic) {
        var postctms = membic.svcdata.postctms;
        var pns = [];
        var tids = jt.byId("postedthemeids" + cdx);
        if(!tids) {  //checking if changed before csv written to HTML
            return postctms; }
        tids = tids.innerHTML;
        tids.csvarray().forEach(function (tid) {
            var currpn = postctms.find((pn) => pn.ctmid === tid);
            if(currpn) {  //existing post
                pns.push(currpn); }
            else {  //new post
                var proftheme = app.profile.myProfile().themes[tid];
                pns.push({ctmid:tid, name:proftheme.name, revid:0}); } });
        return pns;
    }


    function themePostsChanged (membic, tps) {
        var postctms = membic.svcdata.postctms;
        function postin (entry, posts) {
            return posts.find((post) => post.ctmid === entry.ctmid); };
        var same = (postctms.every((pn) => postin(pn, tps)) &&
                    tps.every((tp) => postin(tp, postctms)));
        return !same;
    }


    //The profile membic dsId is used to indicate membic expansion.  The
    //membic display is expanded or condensed across the profile and all
    //themes to make it easier to track what you are focusing on.
    function membicExpId (membic) {
        var expid = membic.dsId;
        if(membic.ctmid) {
            expid = membic.srcrev; }
        return expid;
    }


    function saveMembic (savemembic, contf, failf) {
        savind = new Date().toISOString();  //indicate we are saving
        var url = app.login.authURL("/api/membicsave");
        var pcdo = app.pcd.getDisplayContext().actobj.contextobj;
        if(pcdo.dsType === "Theme") {
            url += "&themecontext=" + pcdo.dsId; }
        jt.call("POST", url, app.refmgr.postdata(savemembic),
                //The updated MUser is always the first item returned,
                //followed by the display context Theme if specified.
                function (pots) {
                    savind = "";
                    pots.forEach(function (pot) {  //deserialize so ready to use
                        app.refmgr.deserialize(pot); });
                    var profmem = pots[0].preb[0];  //profile membic
                    profmem.postnotes.forEach(function (pn) {  //clear outdated
                        app.refmgr.uncache("Theme", pn.ctmid); });
                    pots.forEach(function (pot) {  //update all given data
                        app.refmgr.put(pot); });
                    expandedMembics[profmem.dsId] = "expandedpostsave";
                    var dispobj = pots[pots.length - 1];
                    app.pcd.fetchAndDisplay(dispobj.dsType, dispobj.dsId);
                    if(contf) {
                        contf(profmem); } },
                function (code, errtxt) {
                    savind = "";
                    jt.log("saveMembic " + savemembic.dsId + " " + code + ": " +
                           errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("membic.saveMembic"));
    }


    function mergeURLReadInfoIntoSavedMembic (membic) {
        if(savind) {  //currently saving, wait and retry
            return app.fork({descr:"Merge Details " + membic.rurl,
                             ms:2000,
                             func:function () {
                                 mergeURLReadInfoIntoSavedMembic(membic); }}); }
        //not currently saving, find target membic in profile
        var tm = app.profile.myProfile()
            .preb.find((cand) => cand.rurl === membic.rurl);
        tm.url = membic.url || membic.rurl;
        tm.details = membic.details || {};
        tm.revtype = membic.revtype || "article";
        tm.rating = ratingDefaultValue;
        tm.keywords = "";
        saveMembic(tm);
    }


    //Return a reader appropriate for the given URL.  Looking forward to the
    //day when a link title and image becomes standard web protocol.  Bonus
    //points for detail info like author/artist, address etc.
    function readerModuleForURL (url) {
        //Site notes:
        //  - YouTube has an API, but it fails frequently due to limits on
        //    the number of calls.  Standard reader works much better.
        //  - Netflx retired their online data catalog 08apr14.
        //  - Amazon has an API, but it requires enough site traffic to
        //    sustain an advertising relationship.
        //Vimeo doesn't want to provide any info about their videos except
        //through their API.
        if(url.toLowerCase().indexOf("vimeo.") > 0) {  //https://vimeo.com/id
            return "jsonapi"; }
        return "readurl";
    }


    function startReader (membic) {
        var readername = readerModuleForURL(membic.rurl);
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.urlreader = membic.svcdata.urlreader || {};
        var reader = membic.svcdata.urlreader;
        reader.name = readername;
        reader.status = "reading"
        reader.result = "partial"
        reader.log = reader.log || [];  //could be a log from a previous read
        reader.log.push({start:new Date().toISOString()});
        app.fork({descr:"app." + readername + ": " + addmem.rurl, ms:100,
                  func:function () {
                      app[readername].getInfo(membic, membic.rurl); }});
    }


    //Return the preb field index (iterator state index) for the membic.
    function pfiForMembic (membic) {
        return app.profile.myProfile()
            .preb.findIndex((cand) => cand.dsId === membic.dsId);
    }


    //If the account isn't active yet, replace the new membic form with 
    //a message to activate the account.
    function verifyMayPost (divid) {
        var authobj = app.login.authenticated();
        if(authobj && authobj.status === "Active") {
            return; }  //ready to post membics
        jt.out("newmembicdiv", jt.tac2html(
            ["form", {id:"newmembicform"},  //same form so same CSS
             [["div", {cla:"nmformlinediv"},
               [["label", {fo:"actcin", title:"Activation Code"}, "code"],
                ["input", {type:"text", id:"actcin", //no size, use CSS
                           placeholder:"Paste Activation Code from email",
                           required:"required",
                           onchange:jt.fs("app.membic.actcode(event)")}]]],
              ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
              ["div", {cla:"nmformlinediv"},
               ["div", {id:"ambuttonsdiv"},
                [["a", {href:"#codehelp", title:"Activation Code Help",
                        onclick:jt.fs("app.profile.actCodeHelp()")},
                  "no code?"],
                 ["button", {type:"submit"}, "Activate Account"]]]]]]));
        jt.on("newmembicform", "submit", app.membic.actcode);
    }


    function mayRemove (membic) {
        var auth = app.login.authenticated();
        if(auth && app.theme.memberlev(membic.ctmid) >= 2) {
            return true; }
        return false;
    }


    function membicImgSrc (membic) {
        //upldpic is not supported anymore except for compatibility
        membic.svcdata = membic.svcdata || {};
        if(!membic.svcdata.picdisp) {
            if(membic.imguri) {
                membic.svcdata.picdisp = "sitepic"; }
            else if(membic.revpic) {
                membic.svcdata.picdisp = "upldpic"; }
            else {
                membic.svcdata.picdisp = "nopic"; } }
        var imgsrc = app.dr("img/blank.png");
        switch(membic.svcdata.picdisp) {
        case "sitepic":
            imgsrc = "/api/imagerelay?membicid=" + membic.dsId;
            break;
        case "upldpic":
            imgsrc = "/api/obimg?dt=Membic&di=" + membic.dsId;
            break; }
        return imgsrc;
    }


    function dispatchFStr (cdx, formfuncstr) {
        formfuncstr = formfuncstr.split(".");
        return jt.fs("app.membic.formDispatch('" + formfuncstr[0] + "','" +
                     formfuncstr[1] + "'," + cdx + ")");
    }


    //Return a new object with the fields used for the details area of
    //membic display and editing form.  The name/title fields are handled
    //separately so they are not included here.
    function initNewDetailsObject () {
        return {artist:"", author:"", publisher:"", album:"",
                starring:"", address:"", year:""};
    }


    //Custom detail fields are allowed, but lower case letters only.
    //Removing the value from a detail attribute effectively removes it from
    //the display when saved.  Slightly clunky, but not expecting heavy use
    //and want to minimize the number of controls on screen.
    function detailsHTML (cdx, membic, edit) {
        var detobj = initNewDetailsObject();
        membic.details = membic.details || {};
        Object.keys(membic.details).forEach(function (key) {
            if(key !== "title" && key !== "name") {
                detobj[key] = membic.details[key]; } });
        var chgfstr = jt.fs("app.membic.formInput(" + cdx + ")");
        var dlos = [];  //datalist options for adding other detail fields
        var html = [];
        Object.keys(detobj).forEach(function (key) {
            if(detobj[key]) { html.push(jt.tac2html(
                ["tr",
                 [["td", {cla:"detailattrtd"}, key],
                  ["td", {cla:"detailvaltd", 
                          id:"detail" + key + "valtd" + cdx,
                          contenteditable:jt.toru(edit, "true"),
                          oninput:jt.toru(edit, chgfstr)}, 
                   detobj[key]]]])); } });
        if(edit) {
            Object.keys(detobj).forEach(function (key) {
                if(!detobj[key]) {
                    dlos.push(["option", {value:key}]); } });
            var dlh = "";
            if(dlos.length) {
                dlh = jt.tac2html(["datalist", {id:"detnewattroptsdl" + cdx},
                                   dlos]); }
            html.push(jt.tac2html(
                ["tr",
                 [["td", {cla:"detailattrtd"},
                   [["input", {type:"text", cla:"detnewattrin",
                               id:"detnewattrin" + cdx,
                               placeholder:"attribute", value:"",
                               list:"detnewattroptsdl" + cdx,
                               onchange:chgfstr}],
                    dlh]],
                  ["td", {cla:"detailvaltd"},
                   ["input", {type:"text", cla:"detnewvalin",
                              id:"detnewvalin" + cdx,
                              placeholder:"value", value:"",
                              onchange:chgfstr}]]]])); }
        return jt.tac2html(["div", {cla:"mddetdiv"},
                            ["table", {cla: "collapse"}, html]]);
    }


    //Check the values of the keys in the source object against those in the
    //comparison object.  Return true if they are all equal.  The cmp object
    //may have additional keys not found in the src.
    function objKVEq (src, cmp) {
        return Object.keys(src).every((key) => src[key] === cmp[key]);
    }


    //Construct a details object from the interface display.  The resulting
    //object can be used for comparison or update.  The user may enter a
    //custom detail attribute, and they can change or remove the value for
    //any existing attribute, but they cannot change the name of an existing
    //attribute, so it is sufficient to walk the displayed attributes to
    //construct the details object.
    function detailsValues (cdx, membic) {
        var valobj = {};
        Object.keys(initNewDetailsObject()).forEach(function (key) {
            var td = jt.byId("detail" + key + "valtd" + cdx);
            if(td) {
                valobj[key] = td.innerHTML.trim(); } });
        var input = jt.byId("detnewattrin" + cdx);
        if(input && input.value.trim()) {  //adding a detail attribute
            var valin = jt.byId("detnewvalin" + cdx);
            if(valin && valin.value.trim()) {
                valobj[input.value.trim()] = valin.value.trim(); } }
        return valobj;
    }


    //Return all the possible keywords grouped by source.
    function keywordGroups (cdx, membic, selkwcsv) {
        selkwcsv = selkwcsv || membic.keywords;
        var mt = membicTypes.find((md) => md.type === membic.revtype);
        var keygrps = [{name:"", kwcsv:mt.dkwords.join(",")}];
        selectedPostThemes(cdx, membic).forEach(function (pn) {
            var proftheme = app.profile.myProfile().themes[pn.ctmid];
            keygrps.push({name:proftheme.name, kwcsv:proftheme.keywords}); });
        var knownkws = keygrps.reduce((acc, kg) => acc.csvappend(kg.kwcsv), "");
        knownkws = knownkws.toLowerCase();
        var akws = selkwcsv.csvarray()
            .filter((kw) => !knownkws.csvcontains(kw.toLowerCase()));
        keygrps.push({name:"Additional", kwcsv:akws.join(",")});
        return keygrps;
    }


    //Unlike theme posts, it's easier to see all the available keywords and
    //use checkboxes.  It's not great if the accumulated total gets really
    //long, but it's still way better than clicking a pulldown for each one.
    function keywordsHTML (cdx, membic, edit, selkwcsv) {
        if(!edit) {
            return jt.tac2html(["div", {cla:"mdkwsdiv"}, membic.keywords]); }
        selkwcsv = selkwcsv || membic.keywords;
        var html = [];
        keywordGroups(cdx, membic, selkwcsv).forEach(function (kg, idx) {
            if(kg.kwcsv) {
                var kwshtml = [];
                kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                    var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                    var bchk = selkwcsv.csvcontains(kwd);
                    kwshtml.push(
                        ["div", {cla:"mdkwdiv"},
                         [["input", {type:"checkbox", cla:"keywordcheckbox",
                                     id:kwid, value:kwd, checked:jt.toru(bchk),
                                     onclick:jt.fsd("app.membic.formInput(" +
                                                    cdx + ")")}],
                          ["label", {fo:kwid, id:kwid + "label"}, kwd]]]); });
                html.push(jt.tac2html(
                    ["div", {cla:"mdkwsectiondiv"},
                     [["div", {cla:"mdkwgnamediv"}, kg.name],
                      ["div", {cla:"mdkwcbsdiv"}, kwshtml]]])); } });
        html.push(jt.tac2html(
            ["div", {cla:"mdkwaddnewdiv"},
             [["label", {fo:"newkwin" + cdx}, "Add Keyword"],
              ["input", {type:"text", id:"newkwin" + cdx,
                         placeholder:"New Keyword"}],
              ["button", {type:"button", title:"Add Keyword",
                          onclick:dispatchFStr(cdx, "keywords.addnew")},
               "+"]]]));
        return jt.tac2html(
            ["div", {cla:"mdkwsdiv"},
             ["div", {id:"mdkwscontentdiv" + cdx}, html]]);
    }


    function selectedKeywords (cdx, membic) {
        var skws = "";
        var kwgs = keywordGroups(cdx, membic);
        kwgs.forEach(function (kg, idx) {
            kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                var kwi = jt.byId(kwid);
                if(!kwi) {  //UI not set up, return original keywords
                    skws = membic.keywords; }
                else if(kwi.checked) {
                    skws = skws.csvappend(kwd); } }); });
        var agi = kwgs.length - 1;  //additional keywords group index
        var pui = kwgs[agi].kwcsv.length;  //previously unknown index
        var newKeywordInput;
        do {
            var kwid = "m" + cdx + "g" + agi + "c" + pui;
            newKeywordInput = jt.byId(kwid);
            if(newKeywordInput && newKeywordInput.checked) {
                skws = skws.csvappend(safeInner(kwid + "label")); }
            pui += 1;
        } while(newKeywordInput);
        return skws;
    }


    function equivKeywords (kwsa, kwsb) {
        kwsa = kwsa.toLowerCase().csvarray().sort().join(",");
        kwsb = kwsb.toLowerCase().csvarray().sort().join(",");
        return (kwsa === kwsb);
    }


    function addNewKeywordOption (cdx) {
        var nkin = jt.byId("newkwin" + cdx);
        if(nkin && nkin.value) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var currkws = selectedKeywords(cdx, membic);
            currkws = currkws.csvappend(nkin.value);
            jt.out("mdkwscontentdiv" + cdx,
                   keywordsHTML(cdx, membic, true, currkws));
            app.membic.formInput(cdx); }
    }


    //If anything has been edited, return true.
    function membicEdited (cdx, membic) {
        var changed = [];
        Object.keys(formElements).forEach(function (key) {
            if(formElements[key].changed(cdx, membic)) {
                changed.push(key); } });
        changed = changed.join(",");
        jt.log("membicEdited: " + changed);
        return changed;
    }


    //Update the changed membic elements and redisplay closed to show
    //completion.  When the update was just a fix to the title or text,
    //redisplaying closed is the most intuitive, and provides more of a
    //"just works" kind of feel.  In cases where more editing is needed,
    //re-expanding still provides a sense of confirmation that the edits
    //took effect.  If an error occurs, then leave expanded with message.
    function saveMembic (cdx) {
        jt.out("dlgbsmsgdiv" + cdx, "");
        jt.out("dlgbsbdiv" + cdx, "Saving...");
        var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
        var updm = {dsType:"Membic", dsId:membic.dsId};
        Object.keys(formElements).forEach(function (key) {
            var chgval = formElements[key].changed(cdx, membic);
            if(chgval) {
                formElements[key].write(chgval, updm); } });
        jt.log("saveMembic: " + JSON.stringify(updm));
    }


    function formActionButtonsHTML (tac) {
        return jt.tac2html(
            [["div", {cla:"dlgbsmsgdiv", id:"dlgbsmsgdiv" + cdx}]
             ["div", {cla:"dlgbsbdiv", id:"dlgbsbdiv" + cdx},
              tac]]);
    }


    function formButton (name, ocstr, disabled) {
        var bas = {type:"button", cla:"membicformbutton", onclick:ocstr};
        if(disabled) {
            bas.disabled = true;
            bas.cla = "membicformbuttondisabled" }
        return jt.tac2html(["button", bas, name]);
    }


    formElements = {
        title: {
            closed: function (cdx, membic) {
                var html = jt.tac2html(
                    ["a", {href:membic.url, title:membic.url,
                           onclick:jt.fs("window.open('" + membic.url + "')")},
                     (membic.details.title || membic.details.name)]);
                return html; },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.title.closed(cdx, membic); }
                return jt.tac2html(
                    ["span", {id:"mftitlespan" + cdx, contenteditable:"true",
                              oninput:jt.fs("app.membic.formInput(" + cdx +
                                            ")")},
                     (membic.details.title || membic.details.name)]); },
            changed: function (cdx, membic) {
                var mt = (membic.details.title || membic.details.name).trim();
                var st = safeInner("mftitlespan" + cdx).trim();
                return jt.toru(mt !== st, st); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                updobj.details.title = chgval;
                updobj.details.name = chgval; } },
        share: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                return membicShareHTML(membic); },
            changed: function () { return false; },
            write: function () { return; } },
        revtype: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                var mt = membicTypes.find((md) => md.type === membic.revtype);
                return jt.tac2html(
                    ["a", {href:"#changetype", title:"Change Membic Type",
                           onclick:dispatchFStr(cdx, "revtype.showsel")},
                     ["img", {cla:"revtypeimg", src:app.dr("img/" + mt.img),
                              id:"revtypeimg" + cdx, title:mt.type,
                              alt:mt.type}]]); },
            changed: function (cdx, membic) {
                var rt = jt.byId("revtypeimg" + cdx).title;
                return jt.toru(membic.revtype !== rt, rt); },
            write: function (chgval, updobj) {
                updobj.revtype = chgval; },
            showsel: function (cdx) {
                jt.err("Not implemented yet"); } },
        byline: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                var cretxt = jt.colloquialDate(membic.created, "compress");
                return jt.tac2html(
                    [["span", {cla:"mascrespan"}, cretxt],
                     ["span", {cla:"masbyline"},
                      ["a", {href:"#" + membic.penid,
                             title:"Visit " + membic.penname,
                             onclick:jt.fs("app.statemgr.setState('MUser','" +
                                           membic.penid + "')")},
                       [["img", {src:app.profile.profimgsrc(membic.penid)}],
                        ["span", {cla:"penlight"}, membic.penname]]]]]); },
            changed: function () { return false; },
            write: function () { return; } },
        stars: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                return jt.tac2html(
                    ["span", {cla:"masratspan"},
                     starsImageHTML(membic.rating)]); },
            changed: function (cdx, membic) {
                return 0; },
            write: function (chgval, updobj) {
                updobj.rating = chgval; } },
        dlgbs: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) {
                    var edited = membicEdited(cdx, membic);
                    return jt.tac2html(
                        [["a", {href:"#delete", title:"Delete Membic",
                                onclick:dispatchFStr(cdx, "dlgbs.delete")},
                          ["img", {cla:"masactbimg",
                                   src:app.dr("img/trash.png")}]],
                         formButton("Cancel", jt.fs("app.membic.toggleMembic(" +
                                                    cdx + ")"), !edited),
                         formButton("Save", dispatchFStr(cdx, "dlgbs.save"),
                                    !edited)]); }
                if(mayRemove(membic)) {
                    formActionButtonsHTML(
                        ["a", {href:"#remove", title:"Remove Theme Post",
                               onclick:dispatchFStr(cdx, "dlgbs.remove")},
                         ["img", {cla:"masactbimg",
                                  src:app.dr("img/trash.png")}]]); }
                return ""; },
            changed: function () { return false; },
            write: function () { return; },
            save: function (cdx) { saveMembic(cdx); } },
        picture: {
            closed: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdpicdiv"},
                     ["a", {href:membic.url, title:membic.url,
                            onclick:jt.fs("window.open('" + membic.url + "')")},
                      ["img", {cla:"mdimg", src:membicImgSrc(membic)}]]]); },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) { //no link, too many clickables
                    return jt.tac2html(
                        ["div", {cla:"mdpicdiv"},
                         ["img", {cla:"mdimg", src:membicImgSrc(membic)}]]); }
                return formElements.picture.closed(cdx, membic); },
            changed: function () { return false; },
            write: function () { return; } },
        text: {
            closed: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdtxtdiv", id:"mdtxtdiv" + cdx,
                             onclick:jt.toru(mayEdit(membic), jt.fs(
                                 "app.membic.toggleMembic(" + cdx + ")"))},
                     jt.linkify(membic.text)]); },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.text.closed(cdx, membic); }
                return jt.tac2html(
                    ["div", {cla:"mdtxtdiv", contenteditable:"true",
                             id:"mdtxtdiv" + cdx,
                             oninput:jt.fs("app.membic.formInput(" + cdx +
                                           ")")}, membic.text]); },
            changed: function (cdx, membic) {
                var mt = membic.text.trim();
                var dt = jt.byId("mdtxtdiv" + cdx).innerHTML.trim();
                return jt.toru(mt !== dt, dt); },
            write: function (chgval, updobj) {
                updobj.text = chgval; } },
        details: {
            closed: function (cdx, membic) {
                return detailsHTML(cdx, membic, false); },
            expanded: function (cdx, membic) {
                return detailsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var dvo = detailsValues(cdx, membic);
                return jt.toru(!objKVEq(dvo, membic.details), dvo); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                Object.keys(chgval).forEach(function (key) {
                    updobj.details[key] = chgval[key]; }); } },
        themes: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdptsdiv", id:"mdptsdiv" + cdx},
                     membicThemePostsHTML(cdx, membic)]); },
            changed: function (cdx, membic) {
                var tps = selectedPostThemes(cdx, membic);
                return jt.toru(themePostsChanged(membic, tps), tps); },
            write: function (chgval, updobj) {
                updobj.svcdata = updobj.svcdata || {};
                updobj.svcdata.postctms = chgval; } },
        keywords: {
            closed: function (cdx, membic) {
                return keywordsHTML(cdx, membic, false); },
            expanded: function (cdx, membic) {
                return keywordsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var kws = selectedKeywords(cdx, membic);
                return jt.toru(!equivKeywords(membic.keywords, kws), kws); },
            write: function (chgval, updobj) {
                updobj.keywords = chgval; },
            addnew: function (cdx) {
                addNewKeywordOption(cdx); } }
    }


    function formElementsVerb (expid) {
        if(expandedMembics[expid]) {
            return "expanded"; }
        return "closed";
    }


    function formElementHTML (name, cdx, membic) {
        var disp = formElementsVerb(membicExpId(membic));
        var html = formElements[name][disp](cdx, membic);
        //several elements are inline, but don't want divs inside spans
        return jt.tac2html(
            ["div", {cla:"mf" + name, id:"mf" + name + cdx}, html]);
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
        app.membic.resetStateVars();
        if(typeof source === "string") {  //passed in a url
            autourl = source; }
        if(typeof source === "object") {  //passed in another review
            orev = source;
            crev = copyReview(source);
            if(source.penid !== app.profile.myProfId()) {
                makeMine(crev, source.dsId); } }
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
                    crev.dsId = revid;
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
                      func:app.membic.monitorPicUpload, ms:100}); }
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
                    callAmazonForAutocomplete(app.membic.autocompletion); }
                else if(crev.revtype === "yum" || crev.revtype === "activity") {
                    callGooglePlacesAutocomplete(app.membic.autocompletion); } }
            else {
                app.fork({descr:"autocomp general start check",
                          func:app.membic.autocompletion, ms:750}); } }
    },


    runAutoComp: function () {
        var cb = jt.byId("rdaccb");
        crev.autocomp = cb && cb.checked;
        if(crev.autocomp) {
            autocomptxt = "";  //reset so search happens if toggling back on
            app.membic.autocompletion(); }
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
            return app.membic.updatedlg(); }
        if(!crev.dsId && editExistingMembicByURL(url)) {
            return app.membic.updatedlg(); }
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
            app.membic.updatedlg(); }
    },


    getMembicTypes: function () {
        return membicTypes;
    },


    getMembicTypeByValue: function (val) {
        return findMembicType(val);
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
        var keycsv = app.membic.keywordcsv(kwid, rdkwin.value);
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
        app.membic.serializeFields(crev);
        var data = jt.objdata(crev);
        app.membic.deserializeFields(crev); //in case update fail or interim use
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
        var dt = verifyMembicImageDisplayType(crev);
        var revid = crev.dsId;
        var html = [
            "div", {id:"revpicdlgdiv"},
            [["ul", {cla:"revpictypelist"},
              [["li",
                [["input", { type:"radio", name:"upt", value:"sitepic",
                             checked:jt.toru(dt === "sitepic"),
                             onchange:revfs("picdlg('sitepic')")}],
                 ["div", {id:"sitepicdetaildiv", cla:"ptddiv"},
                  [["img", {id:"sitepicimg", cla:"revimgdis",
                            src:crev.imguri || app.dr("img/nopicprof.png"),
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
                                  : app.dr("img/nopicrev.png")),
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
                               jt.fs("app.membic.updatedlg()"));
    },


    upsub: function () {
        var upldbutton = jt.byId("upldsub");
        upldbutton.disabled = true;
        upldbutton.value = "Uploading...";
        jt.byId("upldpicfelem").submit();
    },


    rotateupldpic: function () {
        var revid = crev.dsId;
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
                        app.membic.selectLocLatLng(latlng, ref, retry + 1,
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
                        app.membic.readURL(crev.url); }
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
                        app.membic.selectLocLatLng(
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
        togfname = togfname || "app.membic.toggleExpansion";
        var revdivid = prefix + revid;
        var type = app.membic.getMembicTypeByValue(rev.revtype);
        fixReviewURL(rev);
        var html = ["div", {cla:"fpinrevdiv"}, [
            ["div", {cla:"fptitlediv"}, membicTitleLine(type, rev, revdivid)],
            ["div", {cla:"fpbodydiv"},
             [["div", {cla:"fprevpicdiv"}, app.membic.picHTML(rev, type)],
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


    isDupe: function (/* rev, pr */) {
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


    displayMembics: function (pdvid, pfx, membics, ptogb, pauth, xem) {
        var html = [];
        var rt = app.layout.getType();
        if(!membics || membics.length === 0) {
            if(rt === "all") {
                html = "No membics to display."; }
            else {
                rt = app.membic.getMembicTypeByValue(rt);
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
                      app.membic.revDispIterator(state); },
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
            revdivid = state.prefix + rev.dsId;
            maindivattrs = {id: revdivid + "fpdiv", cla: "fpdiv"};
            if(rev.srcrev === "-604" || 
                   app.membic.isDupe(rev, state.prev) || 
                   (state.author === "notself" && 
                    rev.penid === app.profile.myProfId())) {
                maindivattrs.style = "display:none"; }
            elem = document.createElement("div");
            elem.className = "fpcontdiv";
            elem.innerHTML = jt.tac2html(
                ["div", maindivattrs,
                 ["div", {cla: (state.author? "fparevdiv" : "fpnarevdiv"),
                          id: revdivid},
                  app.membic.revdispHTML(state.prefix, rev.dsId, 
                                         rev, state.togcbn)]]);
            outdiv.appendChild(elem); 
            state.idx += 1;
            app.fork({
                descr:"revDispIterator loop",
                func:function () {
                    app.membic.revDispIterator(state); },
                ms:50}); }
    },


    toggleExpansion: function (revs, prefix, revid) {
        var i; var rev; var elem; var revdivid;
        //locate the review and its associated index
        for(i = 0; i < revs.length; i += 1) {
            if(revs[i].dsId === revid) {
                rev = revs[i];
                break; } }
        if(!rev) {  //bad revid or bad call, nothing to do
            return; }
        if(i === 0 || !app.membic.isDupe(revs[i - 1], rev)) {  //primary rev
            //toggle expansion on any associated dupes
            for(i += 1; i < revs.length; i += 1) {
                if(!app.membic.isDupe(rev, revs[i])) {  //no more children
                    break; }
                elem = jt.byId(prefix + revs[i].dsId + "fpdiv");
                if(app.membic.displayingExpandedView(prefix, revid)) {
                    elem.style.display = "none"; }
                else {
                    elem.style.display = "block"; } } }
        revdivid = prefix + revid;
        toggleDispRevText(prefix, revid, rev);
        if(app.membic.displayingExpandedView(prefix, revid)) {
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
            //search for it. Use something vaguely privacy friendly.
            url = "https://duckduckgo.com/?q=" + url; }
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


    //All site images are cached and relayed.  Not fair to repeatedly burden
    //other sites for their images, even if the app is delivering clicks.
    mdPicHTML: function (membic) {
        membic.svcdata = membic.svcdata || {};
        if(!membic.svcdata.picdisp) {
            if(membic.imguri) {
                membic.svcdata.picdisp = "sitepic"; }
            else if(membic.revpic) {
                membic.svcdata.picdisp = "upldpic"; }
            else {
                membic.svcdata.picdisp = "nopic"; } }
        var imgsrc = app.dr("img/blank.png");
        switch(membic.svcdata.picdisp) {
        case "sitepic":
            imgsrc = "/api/imagerelay?membicid=" + membic.dsId;
            break;
        case "upldpic":
            imgsrc = "/api/obimg?dt=Membic&di=" + membic.dsId;
            break; }
        return jt.tac2html(
            ["a", {href:membic.url, title:membic.url,
                   onclick:jt.fs("window.open('" + membic.url + "')")},
             ["img", {cla:"mdimg", src:imgsrc}]]);
    },


    mdDetsHTML: function (membic) {
        var secflds = ["artist", "author", "publisher", "album", "starring",
                       "address", "year"];
        var html = []
        secflds.forEach(function (field) {
            var val = membic.details[field];
            if(val) {
                if(field === "address") {
                    val = ["address", val]; }
                html.push(["tr",
                           [["td", {cla:"tdnarrow"},
                             ["span", {cla:"secondaryfield"}, field]],
                            ["td", {align:"left"}, val]]]); } });
        return jt.tac2html(["table", {cla: "collapse"}, html]);
    },


    toggleMembic: function (idx, exp) {
        var membic = app.pcd.getDisplayContext().actobj.itlist[idx];
        var expid = membicExpId(membic);
        expandedMembics[expid] = exp || !expandedMembics[expid];
        var disp = formElementsVerb(expid);
        Object.keys(formElements).forEach(function (key) {
            jt.out("mf" + key + idx, formElements[key][disp](idx, membic)); });
    },


    serializeFields: function (rev) {
        if(typeof rev.svcdata === "object") {
            rev.svcdata = JSON.stringify(rev.svcdata); }
        else {
            rev.svcdata = rev.svcdata || ""; }
    },


    deserializeFields: function (rev) {
        app.lcs.reconstituteJSONObjectField("svcdata", rev);
    },


    addMembic: function (step) {
        step = step || "start";
        switch(step) {
        case "start":
            var inval = "";
            if(addmem && addmem.rurl) { //previous add not completed
                inval = addmem.rurl; }
            jt.out("newmembicdiv", jt.tac2html(
                ["form", {id:"newmembicform"},
                 [["div", {cla:"nmformlinediv"},
                   [["label", {fo:"urlinput", title:"Memorable Link"}, "URL"],
                    ["input", {type:"url", id:"urlinput", //size via CSS
                               placeholder:"Paste Memorable Link Here",
                               required:"required", value:inval,
                               onchange:jt.fs("app.membic.amfact(event)")}]]],
                  ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
                  ["div", {cla:"nmformlinediv"},
                   ["div", {id:"ambuttonsdiv"},
                    ["button", {type:"submit"}, "Make Membic"]]]]]));
            jt.on("newmembicform", "submit", app.membic.amfact);
            verifyMayPost("newmembicdiv");
            break;
        case "whymem":
            if(!jt.byId("newmembicform").checkValidity()) {
                return; }  //fill in the url properly first.
            addmem = {rurl:jt.byId("urlinput").value};
            startReader(addmem);
            jt.out("newmembicform", jt.tac2html(
                [["div", {id:"newmembicurldiv", cla:"nmformlinediv"},
                  addmem.rurl],
                 ["div", {cla:"nmformlinediv"},
                  [["label", {fo:"whymemin", title:"Why memorable?"}, "Why?"],
                   ["input", {type:"text", id:"whymemin", //no size, use CSS
                              placeholder:"What's memorable about it?",
                              onchange:jt.fs("app.membic.amfact(event)")}]]],
                 ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
                 ["div", {cla:"nmformlinediv"},
                  ["div", {id:"ambuttonsdiv"},
                   [["button", {type:"button",
                                onclick:jt.fs("app.membic.addMembic()")},
                     "Cancel"],
                    //form submit action set up in first step
                    ["button", {type:"submit"}, "Add"]]]]]));
            jt.byId("whymemin").focus();
            break;
        case "addit":
            if(!jt.byId("newmembicform").checkValidity()) {
                return; }  //fix why memorable if needed
            addmem.text = jt.byId("whymemin")
            jt.out("amprocmsgdiv", "Writing membic...");
            jt.byId("ambuttonsdiv").style.display = "none";
            saveMembic(addmem, 
                function (membic) {
                    addmem = null;  //reset for next membic creation
                    app.membic.toggleMembic(pfiForMembic(membic), "expand");
                    app.membic.addMembic("start"); },
                function (code, errtxt) {
                    jt.out("amprocmsgdiv", errtxt);
                    jt.byId("ambuttonsdiv").style.display = "block"; });
            break;
        default:
            jt.log("addMembic unknown step: " + step); }
    },
    amfact: function (event) {
        jt.evtend(event);
        if(jt.byId("urlinput")) {
            var urlin = jt.byId("urlinput");
            if(!urlin.value.startsWith("http")) {
                urlin.value = "https://" + urlin.value; }
            app.membic.addMembic("whymem"); }
        else if(jt.byId("whymemin")) {
            app.membic.addMembic("addit"); }
    },


    actcode: function (event) {
        jt.evtend(event);
        var code = jt.byId("actcin").value;
        if(!code) {
            return; }  //not an error and doesn't require explanation
        jt.out("amprocmsgdiv", "Activating account...");
        jt.byId("ambuttonsdiv").style.display = "none";
        app.profile.update({actcode:code},
            function (prof) { //updated auth and account already cached
                jt.out("amprocmsgdiv", "Account Activated!");
                app.fork({descr:"End account activation form", ms:800,
                          func:app.login.rebuildContext}); },
            function (code, errtxt) {
                jt.out("amprocmsgdiv", "Activation failed: " + code + " " +
                       errtxt);
                jt.byId("ambuttonsdiv").style.display = "block"; });
    },


    //Merge the retrieved membic details.  If this is a new membic, there
    //may or may not be an outstanding save going on.
    readerFinish: function (membic, result, msg) {
        var ur = membic.svcdata.urlreader;
        ur.status = "finished";
        ur.result = result;
        var le = ur.log[ur.log.length - 1];
        le.end = new Date().toISOString()
        le.msg = msg;
        if(addmem && !savind && //still working off addmem and not saved yet
           addmem.rurl === membic.rurl) {  //and not way out of sync
            return; }  //url read data will be recorded on save.
        mergeURLReadInfoIntoSavedMembic(membic);
    },


    formHTML: function (cdx, membic) {
        return jt.tac2html(
            ["div", {cla:"mdouterdiv"},
             ["div", {cla:"mdinnerdiv"},
              [["a", {href:"#expand" + cdx, title:"Toggle Membic Expansion",
                    onclick:jt.fs("app.membic.toggleMembic(" + cdx + ")")},
                ["img", {cla:"mbtkebabimg", src:app.dr("img/kebab.png")}]],
               formElementHTML("title", cdx, membic),
               formElementHTML("share", cdx, membic),
               ["div", {cla:"mdheaderline"},
                [formElementHTML("revtype", cdx, membic),
                 formElementHTML("byline", cdx, membic),
                 formElementHTML("stars", cdx, membic)]],
               ["div", {cla:"mddlgbsdiv"},
                formElementHTML("dlgbs", cdx, membic)],
               ["div", {cla:"mdbodydiv"},
                [formElementHTML("picture", cdx, membic),
                 formElementHTML("text", cdx, membic),
                 formElementHTML("details", cdx, membic),
                 formElementHTML("themes", cdx, membic),
                 formElementHTML("keywords", cdx, membic)]]]]]);
    },


    formDispatch: function (formpartname, funcname, cdx) {
        formElements[formpartname][funcname](cdx);
    },


    //It is conceivable to be editing one membic and then clobber the
    //timeout by quickly editing another, but that is extremely unlikely and
    //trivial to recover.  Just tracking the one timeout sweep.
    formInput: function (cdx) {
        if(rto) {  //already waiting to react to changes
            return; }
        //avoid redrawing any edits that haven't been saved yet.
        rto = app.fork({descr:"Check Membic changes", ms:800, func:function () {
            rto = null;
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var disp = formElementsVerb(membicExpId(membic));
            jt.out("mfdlgbs" + cdx, formElements.dlgbs[disp](cdx, membic)); }});
    }

}; //end of returned functions
}());

