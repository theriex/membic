/*global setTimeout: false, clearTimeout: false, window: false, document: false, confirm: false, app: false, jt: false, google: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.review = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var //If a url was pasted or passed in as a parameter, then potentially
        //modified by automation, that "cleaned" value should be kept to
        //confirm against the potentially edited form field value.
        autourl = "",
        //If form fields were filled out automatically using someone's
        //API, then this field contains a link back or whatever
        //attribution is appropriate.
        attribution = "",
        //The current review being displayed or edited.
        crev = {},
        //If changing the width or height of the stars img, also change
        //profile.reviewItemHTML indent and statrev.py
        starimgw = 85,
        starimgh = 15,
        starPointingActive = false,  //true if star sliding active
        //The last value used for autocomplete checking
        autocomptxt = "",
        gautosvc = null,
        geoc = null,
        gplacesvc = null,
        //onchange/cancel button event delegation timeout holder
        fullEditDisplayTimeout = null,
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
            dkwords: [ "Fluff", "Heavy", "Kid Ok", "Educational", 
                       "Funny", "Suspenseful", "Gripping", "Emotional",
                       "Complex", "Historical" ] },
          { type: "movie", plural: "movies", img: "TypeMovie50.png",
            keyprompt: "Movie name",
            key: "title", //subkey
            fields: [ "year", "starring" ],
            dkwords: [ "Fluff", "Light", "Heavy", "Kid Ok", 
                       "Educational", "Cult", "Classic", 
                       "Drama", "Escapism", "Funny", "Suspenseful" ] },
          { type: "video", plural: "videos", img: "TypeVideo50.png",
            keyprompt: "Title",
            key: "title", //subkey
            fields: [ "artist" ],
            dkwords: [ "Light", "Heavy", "Kid Ok", "Educational", 
                       "Funny", "Cute", "Artistic", "Disturbing" ] },
          { type: "music", plural: "music", img: "TypeSong50.png",
            keyprompt: "Title",
            key: "title", subkey: "artist",
            fields: [ "album", "year" ],
            dkwords: [ "Light", "Heavy", "Wakeup", "Travel", "Office", 
                       "Workout", "Dance", "Social", "Sex" ] },
          { type: "food", plural: "food", img: "TypeFood50.png",
            keyprompt: "Name of restaurant or dish",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Breakfast", "Brunch", "Lunch", "Dinner", "Desert",
                       "Late Night", "Snack", "Inexpensive", "Expensive", 
                       "Fast", "Slow", "Outdoor", "Quiet", "Loud" ] },
          { type: "drink", plural: "drinks", img: "TypeDrink50.png",
            keyprompt: "Name and where from",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Traditional", "Innovative", "Inexpensive", "Expensive",
                       "Essential", "Special", "Quiet", "Loud", "Outdoor" ] },
          { type: "activity", plural: "activities", img: "TypeActivity50.png",
            keyprompt: "Name of place or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Indoor", "Outdoor", "Educational", "Artistic", 
                       "Performance", "Kid Ok", "Inexpensive", 
                       "Expensive" ] },
          { type: "other", plural: "other", img: "TypeOther50.png",
            keyprompt: "Name or title", 
            key: "name", //subkey
            fields: [],
            dkwords: [ "Specialized", "General", "Professional", "Personal",
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
                ["img", {cla: "starsimg", src: "img/prereview.png",
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


    revTypeChoiceHTML = function (intype, gname, selt, chgfstr, revrefs, sing) {
        var i, typename, greyed, tobj, ts = [], html;
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            greyed = false;
            if(revrefs) {
                if(!revrefs[typename] || revrefs[typename].length === 0) {
                    greyed = true; } }
            tobj = { typename: typename, greyed: greyed,
                     label: app.review.badgeImageHTML(reviewTypes[i], 
                                                      true, greyed, sing),
                     value: sing ? reviewTypes[i].type : reviewTypes[i].plural,
                     checked: jt.idInCSV(typename, selt) };
            ts.push(jt.checkrad(intype, gname, tobj.value, tobj.label,
                                tobj.checked, chgfstr)); }
        if(app.winw < 600) {
            html = ["table",
                    [["tr",
                      [["td", ts[0]],
                       ["td", ts[1]]]],
                     ["tr",
                      [["td", ts[2]],
                       ["td", ts[3]]]],
                     ["tr",
                      [["td", ts[4]],
                       ["td", ts[5]]]],
                     ["tr",
                      [["td", ts[6]],
                       ["td", ts[7]]]]]]; }
        else {
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
                       ["td", ts[7]]]]]]; }
        return jt.tac2html(html);
    },


    findReviewType = function (type) {
        var i;
        if(!type) {
            return null; }
        type = type.toLowerCase();
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(reviewTypes[i].type === type ||
               reviewTypes[i].plural === type) {
                return reviewTypes[i]; } }
        return reviewTypes[reviewTypes.length - 1];  //last is "other"...
    },


    linkCountBadgeHTML = function (revlink, field) {
        var html, penids, len,
            fieldimages = { helpful: "cbbh.png",
                            remembered: "cbbr.png",
                            corresponding: "cbbw.png" };
        if(!revlink || !revlink[field]) {
            return ""; }
        penids = revlink[field].split(",");
        len = penids.length;
        if(!len) {
            return ""; }
        if(len > 9) { 
            len = "+"; }
        html = ["span", {style: "background:url('img/" + fieldimages[field] + 
                                                "') no-repeat center center;" +
                               " height:20px; width:28px;" +
                               " display:inline-block;" + 
                               " text-align:center;",
                         title: String(len) + " " + field},
                String(len)];
        return jt.tac2html(html);
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


    reviewTextValid = function (type, errors) {
        var input = jt.byId('rdta');
        if(input) {
            crev.text = input.value; }
    },


    okToLoseChanges =  function () {
        var prev, revid, mustconfirm, cmsg;
        revid = jt.instId(crev);
        reviewTextValid();  //read current review input value
        if(crev.text && crev.text.length > 60) {
            if(!revid) {
                mustconfirm = true; }
            else {
                prev = app.lcs.getRef("rev", crev).rev;
                if(crev.text.length - prev.text.length > 60) {
                    mustconfirm = true; } } }
        if(!mustconfirm) {
            return true; }
        cmsg = "You've added some text. OK to throw it away?";
        return window.confirm(cmsg);
    },


    typeSelectHTML = function (ts, urlh) {
        var html;
        if(app.winw < 600) {
            html = ["table",
                    [["tr",
                      ["td", {colspan: 2},
                       ["div", {cla: "bigoverlabel"},
                        "Posting type"]]],
                     ["tr",
                       [["td", ts[0]],
                        ["td", ts[1]]]],
                     ["tr",
                      [["td", ts[2]],
                       ["td", ts[3]]]],
                     ["tr",
                      [["td", ts[4]],
                       ["td", ts[5]]]],
                     ["tr",
                      [["td", ts[6]],
                       ["td", ts[7]]]]]]; }
        else {  //use full width
            html = ["table",
                    [["tr",
                      ["td", {colspan: 4},
                       ["div", {cla: "bigoverlabel"},
                        "Posting type"]]],
                     ["tr",
                      [["td", ts[0]],
                       ["td", ts[1]],
                       ["td", ts[2]],
                       ["td", ts[3]]]],
                     ["tr",
                      [["td", ts[4]],
                       ["td", ts[5]],
                       ["td", ts[6]],
                       ["td", ts[7]]]]]]; }
        html = ["div", {id: "revfdiv", cla: "formstyle"},
                ["div", {id: "formrejustifydiv"},
                 ["ul", {cla: "reviewformul"},
                  [["li", html],
                   ["li", urlh]]]]];
        return html;
    },


    urlLabel = function () {
        var html;
        html = ["img", {cla: "webjump", src: "img/gotolink.png"}];
        return html;
    },


    displayTypeSelect = function () {
        var i, typename, captype, ts = [], urlh, html;
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            captype = typename.capitalize();
            ts.push(
                ["div", {cla: "revtypeselectiondiv"},
                 jt.imgntxt(reviewTypes[i].img, captype,
                            "app.review.setType('" + typename + "')",
                            "#" + captype,
                            "Create a " + typename + " post",
                            "revtypeico", typename, "app.review.mrollwr")]); }
        if(autourl) {
            urlh = ["a", {href: autourl}, autourl]; }
        else {  //no url being read automatically, allow manual entry
            urlh = ["table",
                    [["tr",
                      ["td", {colspan: 2},
                       ["div", {cla: "bigoverlabel"},
                        "or paste a web address to read information from"]]],
                     ["tr",
                      [["td", {valign: "top", align: "right"}, urlLabel()],
                       ["td", {align: "left"},
                        [["input", {type: "url", id: "urlin", size: 32,
                                    onchange: jt.fs("app.review.readURL()")}],
                         "&nbsp;",
                         ["span", {id: "rdurlbuttonspan"},
                          ["button", {type: "button", id: "rdurlbutton",
                                      onclick: jt.fs("app.review.readURL()"),
                                      title: "Read review form fields" + 
                                            " from pasted URL"},
                           "Read"]]]]]]]]; }
        html = typeSelectHTML(ts, urlh);
        if(!jt.byId('cmain')) {
            app.layout.initContent(); }
        jt.out('cmain', jt.tac2html(html));
        //Setting focus on a phone zooms to bring up the keyboard, so the
        //type buttons don't get displayed.  Entering a URL is not the 
        //primary path forward so don't set focus here.
        //jt.byId('urlin').focus();
        app.onescapefunc = app.activity.displayActive;
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
    sslSafeRef = function (url) {
        if(window.location.href.indexOf("https://") === 0) {
            url = "imagerelay?url=" + jt.enc(url); }
        return url;
    },


    revFormImageHTML = function (review, type, keyval, mode, extra) {
        var html;
        if(!keyval) {
            return ""; }
        html = {id: "revimg" + jt.instId(review), cla: "revimg", 
                src: "img/emptyprofpic.png"};
        if(jt.isLowFuncBrowser()) {
            html.style = "width:125px;height:auto;"; }
        switch(verifyReviewImageDisplayType(review)) {
        case "sitepic":
            html.src = review.imguri;
            if(extra === "revroll") {
                html.src = sslSafeRef(review.imguri); }
            break;
        case "upldpic":
            html.src = "revpic?revid=" + jt.instId(review);
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
            input = jt.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Need to fill in the " + type.subkey); }
            else {
                crev[type.subkey] = input.value;
                cankey += crev[type.subkey]; } }
        if(cankey) {
            crev.cankey = jt.canonize(cankey); }
    },


    secondaryFieldsValid = function (type, errors) {
        var input, i;
        //none of the secondary fields are required, so just note the values
        for(i = 0; i < type.fields.length; i += 1) {
            input = jt.byId(type.fields[i] + "in");
            if(input) {  //input field was displayed
                crev[type.fields[i]] = input.value; } }
    },


    verifyRatingStars = function (type, errors) {
        var txt;
        if(!crev.rating && crev.srcrev !== -101) {
            txt = "Please set a star rating";
            errors.push(txt); }
    },


    revFormKeywordsHTML = function (review, type, keyval, mode) {
        var cols, html = "";
        if(!keyval) {
            return html; }
        if(mode === "edit") {
            cols = app.winw < 750 ? 2 : 3;
            if(!crev.keywords) {
                crev.keywords = ""; }
            html = [app.review.keywordCheckboxesHTML(
                        type, crev.keywords, cols, "app.review.toggleKeyword"),
                    [["span", {cla: "secondaryfield"},
                      "Keywords "],
                     ["input", {type: "text", id: "keywordin", size: 30,
                                value: jt.safestr(review.keywords)}]]]; }
        else { //not editing, keywords CSV displayed with the fields
            html = ""; }
        return html;
    },


    keywordsValid = function (type, errors) {
        var input, words, word, i, csv = "";
        input = jt.byId('keywordin');
        if(input) {
            words = input.value || "";
            words = words.split(",");
            for(i = 0; i < words.length; i += 1) {
                word = words[i].trim();
                if(word) {
                    if(csv) {
                        csv += ", "; }
                    csv += word; } }
            crev.keywords = csv; }
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
                crev.srcrev = 0; } }
    },


    //Returns true if the user input review field values have been altered.
    reviewFieldValuesChanged = function () {
        var prev;
        if(!crev || !jt.instId(crev)) {
            return true; }
        prev = app.lcs.getRef("rev", crev).rev;
        if(!prev) {  //nothing to compare against
            jt.log("Seems there should always be a cached version.");
            return false; }
        if(crev.revtype !== prev.revtype ||
           crev.rating !== prev.rating ||
           crev.keywords !== prev.keywords ||
           crev.text !== prev.text ||
           crev.name !== prev.name ||
           crev.title !== prev.title ||
           crev.url !== prev.url ||
           crev.artist !== prev.artist ||
           crev.author !== prev.author ||
           crev.publisher !== prev.publisher ||
           crev.album !== prev.album ||
           crev.starring !== prev.starring ||
           crev.address !== prev.address ||
           crev.year !== prev.year) {
            return true; }
        return false;
    },


    transformActionsHTML = function (review, type, keyval, mode) {
        var html = "", actions = [];
        if(keyval && mode === "edit") {
            if(review.srcrev > 0 && !jt.instId(review)) {
                //new corresponding review, allow finding mismatched titles
                actions.push(app.review.makeTransformLink(
                    "app.revresp.searchCorresponding()",
                    "Find existing corresponding post",
                    "Find Post")); }
            //always be able to change the review type
            actions.push(app.review.makeTransformLink(
                "app.review.changeRevType()",
                "Change this posting type",
                "Change Post Type"));
            if(review.revtype === "video" && review.title && review.artist) {
                //video import may have mapped the title and artist backwards
                actions.push(app.review.makeTransformLink(
                    "app.review.swapTitleAndArtist()",
                    "Swap the artist and title values",
                    "Swap Title and Artist")); }
            if(review.url) {
                //Might want to refresh the image link or re-read info
                actions.push(app.review.makeTransformLink(
                    "app.review.readURL('" + review.url + "')",
                    "Read the URL to fill out descriptive fields",
                    "Import URL Details")); }
            html = jt.tac2html(actions); }
        else if(mode !== "edit") { 
            if(review.penid === app.pen.currPenId()) {
                html = ["div", {id: "sharediv"},
                        [["div", {id: "sharebuttonsdiv"}],
                         ["div", {id: "sharemsgdiv"}]]]; }
            else { //reading someone else's review
                html = app.revresp.respActionsHTML(); } }
        return html;
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


    monitorPicUpload = function () {
        var ptdif, txt, revid;
        ptdif = jt.byId('ptdif');
        if(ptdif) {
            txt = ptdif.contentDocument || ptdif.contentWindow.document;
            if(txt) {
                txt = txt.body.innerHTML;
                if(txt.indexOf("revid: ") === 0) {
                    revid = txt.slice("revid: ".length);
                    jt.setInstId(crev, revid);
                    crev.revpic = revid;
                    jt.byId('upldpicimg').src = "revpic?revid=" + revid;
                    displayUploadedPicLabel();
                    return; }
                if(txt.indexOf("Error: ") === 0) {
                    jt.out('imgupstatdiv', txt); } }
            setTimeout(monitorPicUpload, 800); }
    },


    permalinkHTML = function (url) {
        var html = ["a", {href: url, cla: "permalink",
                          onclick: jt.fs("window.open('" + url + "')")},
                    "permalink"];
        if(app.winw < 500) {
            html = ["div", {id: "permalinkdiv"},
                    html]; }
        else {
            html = ["&nbsp;&nbsp;",
                    html,
                    ["br"]]; }
        return html;
    },


    revFormButtonsHTML = function (pen, review, type, keyval, mode) {
        var temp, html = "";
        if(!keyval) {  //user just chose type for editing
            app.onescapefunc = app.review.cancelReview;
            html = ["div", {id: "revbuttonsdiv"},
                    [["button", {type: "button", id: "cancelbutton",
                                 onclick: jt.fs("app.review.cancelReview(" + 
                                                "true)")},
                      "Cancel"],
                     "&nbsp;",
                     ["button", {type: "button", id: "savebutton",
                                 onclick: jt.fs("app.review.validate()")},
                      "Create Post"],
                     ["br"],
                     ["div", {id: "revsavemsg"}]]]; }
        else if(mode === "edit") {  //have key fields and editing full review
            app.onescapefunc = app.review.cancelReview;
            temp = (jt.instId(review)? "false" : "true");
            html = ["div", {id: "revbuttonsdiv"},
                    [["button", {type: "button", id: "cancelbutton",
                                 onclick: jt.fs("app.review.cancelReview(" + 
                                                temp + ")")},
                      "Cancel"],
                     "&nbsp;",
                     ["button", {type: "button", id: "savebutton",
                                 onclick: jt.fs("app.review.save(true,'')")},
                      "Save"],
                     ["br"],
                     ["div", {id: "revsavemsg"}]]]; }
        else if(review.penid === app.pen.currPenId()) {  //reading own review
            app.onescapefunc = null;
            temp = "statrev/" + jt.instId(review);
            html = ["div", {id: "revbuttonsdiv"},
                    [["button", {type: "button", id: "deletebutton",
                                 onclick: jt.fs("app.review.delrev()")},
                      "Delete"],
                     ["button", {type: "button", id: "postbutton",
                                 onclick: jt.fs("app.group.crevpost()")},
                      "Post to Groups"],
                     ["button", {type: "button", id: "editbutton",
                                 onclick: jt.fs("app.review.display()")},
                      "Edit"],
                     permalinkHTML(temp),
                     ["div", {id: "revsavemsg"}]]]; }
        else {  //reading someone else's review
            html = ["div", {id: "revbuttonsdiv"},
                    ["div", {id: "revsavemsg"}]]; }
        return html;
    },


    ezlink = function () {
        return ["a", {href: "#ezlink", cla: "permalink",
                      onclick: jt.fs("app.hinter.ezlink()"),
                      title: "Post from any site"},
                "ezlink"];
    },


    abbreviatedReviewText = function (prefix, revid, rev) {
        var maxchars = 400, rtxt, morehtml;
        rtxt = jt.linkify(rev.text || "");
        if(rtxt.length > maxchars) {
            rtxt = rev.text;  //start with raw text
            morehtml = ["a", {href: "#expand",
                              onclick: jt.fs("app.review.toggleExpansion('" +
                                             prefix + "','" + revid + "')")},
                        ["span", {cla: "togglemoretextspan"},
                         "more"]];
            //truncated text could result in a busted link if embedded
            //in the description.  Fixed on toggle.
            rtxt = jt.linkify(rtxt.slice(0, maxchars)) + "... " + 
                jt.tac2html(morehtml); }
        return rtxt;
    },


    fpbHelpfulButtonSource = function (revid) {
        var rev, penid;
        rev = app.lcs.getRef("rev", revid).rev;
        penid = app.pen.currPenId();
        //rev.helpful should never contain 0. helpfuldis logic is public
        if(!rev.helpful || !rev.helpful.csvcontains(penid)) {
            return "img/helpfulq.png"; }
        if(rev.helpful.csvarray().length > 100) {
            return "img/helpfuldis.png"; }
        return "img/helpful.png";
    },


    fpbRememberButtonSource = function (revid) {
        var penref;
        penref = app.pen.currPenRef();
        if(!penref || !penref.pen || 
               !penref.pen.remembered.csvcontains(revid)) {
            return "img/rememberq.png"; }
        return "img/remembered.png";
    },


    fpOtherRevsLinkHTML = function (revid) {
        var rev, src, html = "";
        rev = app.lcs.getRef("rev", revid).rev;
        if(rev.srcrev) {
            //source review is included with the feed but display filtered.
            src = app.lcs.getRef("rev", rev.srcrev).rev; }
        else if(rev.orids) {
            src = rev; }
        if(src) {
            html = ["a", {href: "#others",
                          title: "Other posts about this",
                          onclick: jt.fs("window.open('?view=revlist&srcid=" + 
                                         jt.instId(src) + "')")},
                    src.orids.csvarray().length + "+"]; }
        return html;
    },


    //Not worth the overhead and potential miss of querying to find
    //whether you have already written a review of something.  Just
    //click to write and be pleasantly surprised that your previous
    //review was found (if the cankey matches), or search your reviews
    //to find the matching one and add it to the altkeys.
    revpostButtonsHTML = function (prefix, revid) {
        var rev, html;
        rev = app.lcs.getRef("rev", revid).rev;
        if(rev.penid !== app.pen.currPenId()) {
            html = [["div", {cla: "fpotherrevsdiv"},
                     fpOtherRevsLinkHTML(revid)],
                    ["div", {cla: "fpbuttondiv"},
                     ["a", {href: "#helpful",
                            title: "Note this post was helpful",
                            onclick: jt.fs("app.review.fpbToggleHelpful('" +
                                           prefix + "','" + revid + "')")},
                      ["img", {cla: "fpbuttonimg",
                               id: prefix + revid + "helpfulbutton",
                               src: fpbHelpfulButtonSource(revid)}]]],
                    ["div", {cla: "fpbuttondiv"},
                     ["a", {href: "#remember",
                            title: "Remember this post",
                            onclick: jt.fs("app.review.fpbToggleRemember('" +
                                           prefix + "','" + revid + "')")},
                      ["img", {cla: "fpbuttonimg",
                               id: prefix + revid + "rememberbutton",
                               src: fpbRememberButtonSource(revid)}]]],
                    ["div", {cla: "fpbuttondiv"},
                     ["a", {href: "#write",
                            title: "Record your own impressions",
                            onclick: jt.fs("app.review.fpbWrite('" +
                                           prefix + "','" + revid + "')")},
                      ["img", {cla: "fpbuttonimg",
                               id: prefix + revid + "writebutton",
                               src: "img/writereview.png"}]]]]; }
        else { //your own review
            html = [["div", {cla: "fpotherrevsdiv"},
                     fpOtherRevsLinkHTML(revid)],
                    ["div", {cla: "fpbuttondiv", 
                             style: "background:url('../img/helpfuldis.png') no-repeat center center;"},
                     rev.helpful.csvarray().length],
                    ["div", {cla: "fpbuttondiv",
                             style: "background:url('../img/rememberdis.png') no-repeat center center;"},
                     rev.remembered.csvarray().length],
                    ["div", {cla: "fpbuttondiv"},
                     ["a", {href: "#edit",
                            title: "Edit your review",
                            onclick: jt.fs("app.review.fpbWrite('" +
                                           prefix + "','" + revid + "')")},
                      ["img", {cla: "fpbuttonimg",
                               id: prefix + revid + "writebutton",
                               src: "img/writereview.png"}]]]]; }
        return jt.tac2html(html);
    },


    fpSecondaryFieldsHTML = function (rev) {
        var type, i, field, value, mapurl, html = [];
        type = findReviewType(rev.revtype);
        for(i = 0; i < type.fields.length; i += 1) {
            field = type.fields[i];
            value = jt.ndq(rev[field]);
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
                             value]]]); } }
        return jt.tac2html(["table", {cla: "collapse"}, html]);
    },


    //return a good width for a text entry area
    textTargetWidth = function () {
        var targetwidth = app.winw - 40;
        if(app.winw > 600) {  //enough space for scaling
            targetwidth = Math.round(app.winw * 0.75);
            if(targetwidth > 750) {  //too wide even if display is huge
                targetwidth = 750; } }
        return targetwidth;
    },


    revFormStarsHTML = function (review, type, keyval, mode) {
        var jumplink, prerevcb, width, html = "";
        if(keyval) {
            width = textTargetWidth() + 20;
            if(mode === "edit") {
                jumplink = "";
                prerevcb = ["span", {cla: "prereviewcbspan"},
                            jt.checkbox("cbprerev", "cbprerev", "Pre-Review",
                                        review.srcrev === -101)]; }
            else { 
                jumplink = app.review.jumpLinkHTML(review, type);
                prerevcb = ""; }
            html = ["div", {id: "revformstarscontent",
                            style: "width:" + width + "px;"},
                    [["div", {id: "rfsjumpdiv", style: "float:right;"},
                      jumplink],
                     ["div", {id: "rfsratediv"},
                      [["span", {id: "stardisp"},
                        starsImageHTML(review, mode)],
                       "&nbsp;",
                       app.review.badgeImageHTML(type),
                       "&nbsp;",
                       prerevcb]]]]; }
        else {  //show type 
            html = app.review.badgeImageHTML(type); }
        return html;
    },
        
    
    makeFieldInputRow = function (review, mode, field, inid, onchange) {
        var html, valdisp, labval, ndqval, url;
        onchange = onchange || "";
        labval = field.capitalize();
        ndqval = jt.ndq(review[field]);
        if(mode === "edit") {
            if(field === "url") {  //special graphic label
                labval = urlLabel(); }
            valdisp = ["input", {type: "text", id: inid, size: 25, 
                                 value: ndqval, onchange: onchange}]; }
        else { 
            if(ndqval && field === "address") {
                url = "http://maps.google.com/?q=" + ndqval;
                valdisp = ["a", {href:url,
                                 onclick: jt.fs("window.open('" + url + "')")},
                           ndqval]; }
            else {
                valdisp = ndqval; } }
        if(inid === "keyin" && mode !== "edit") {
            html = ["tr",
                    ["td", {id: inid + "labeltd", colspan: 2, cla: "rslc"},
                     valdisp]]; }
        else {
            html = ["tr", 
                    [["td", {id: inid + "labeltd", cla: "tdnarrow"},
                      ["span", {cla: "secondaryfield"},
                       labval]],
                     ["td", {align: "left"},
                      valdisp]]]; }
        return html;
    },


    appendToRow = function (row, element) {
        var i;
        element = element[1];  //skip past "tr" to get contents
        if(element[0] === "td") {  //single element
            row.push(element); }
        else {  //attribute value pair
            for(i = 0; i < element.length; i += 1) {
                row.push(element[i]); } }
    },


    sideBySideRows = function (keyrows, secrows) {
        var row, rows = [], rf;
        while(keyrows.length || secrows.length) {
            row = [];
            if(keyrows && keyrows.length) {
                appendToRow(row, keyrows.pop()); }
            if(secrows && secrows.length) {
                appendToRow(row, secrows.pop()); }
            //if just single colspan item in row, then expand it so the
            //table doesn't end up skewed.
            if(row.length === 1) {
                rf = row[0];
                if(rf[1].colspan) {
                    rf[1].colspan = 4; } }
            rows.unshift(["tr", row]); }
        return rows;
    },


    revFormFieldsHTML = function (review, type, keyval, mode) {
        var keyrows = [], secrows = [], onchange, i, html;
        if(app.winw < 750) {
            secrows = keyrows; }
        onchange = jt.fs("app.review.validate()");
        if(type.subkey) {
            onchange = jt.fs("jt.byId('subkeyin').focus()"); }
        keyrows.push(makeFieldInputRow(review, mode, type.key, "keyin", 
                                       onchange));
        if(type.subkey) {
            onchange = jt.fs("app.review.validate()");
            keyrows.push(makeFieldInputRow(review, mode, type.subkey, 
                                           "subkeyin", onchange)); }
        for(i = 0; i < type.fields.length; i += 1) {
            if(review[type.fields[i]] || mode === "edit") {
                secrows.push(makeFieldInputRow(review, mode, type.fields[i],
                                               type.fields[i] + i)); } }
        if(mode === "edit") {
            onchange = jt.fs("app.review.urlchg()");
            keyrows.push(makeFieldInputRow(review, mode, "url", "urlin", 
                                           onchange)); }
        else { //not editing 
            if(jt.safestr(review.keywords)) {
                keyrows.push(["tr",
                              [["td", {id: "keywordslabeltd", cla: "tdnarrow"},
                                ["span", {cla: "secondaryfield"},
                                 "Keywords"]],
                               ["td", {align: "left"},
                                jt.safestr(review.keywords)]]]); } }
        if(app.winw < 750) {
            html = ["table", keyrows]; }
        else {
            html = ["div", {id: "revformfieldsdisplaydiv"},
                    ["table",
                     sideBySideRows(keyrows, secrows)]]; }
        return html;
    },


    revFormLastModified = function (review, mode) {
        if(mode === "edit") {
            return ""; }
        return jt.colloquialDate(review.modified) + ":";
    },


    postline = function (review, redispf) {
        var i, grpids, grpref, prefix, pt = "";
        if(review.svcdata && review.svcdata.postedgroups) {
            prefix = redispf ? "" : "../";
            grpids = review.svcdata.postedgroups;
            for(i = 0; i < grpids.length; i += 1) {
                grpref = app.lcs.getRef("group", grpids[i]);
                if(grpref.status === "not cached" && redispf) {
                    app.lcs.getFull("group", grpids[i], redispf);
                    break; }
                if(grpref.group) {
                    if(pt) {
                        pt += ", "; }
                    pt += jt.tac2html(
                        ["a", {href: prefix + "groups/" + 
                                   jt.canonize(grpref.group.name),
                               onclick: jt.fs("app.group.bygroupid('" + 
                                              grpids[i] + "')")},
                         grpref.group.name]); } }
            if(pt) {
                pt = ["p", {cla: "grpostline"},
                      [["span", {cla: "grpostlinehead"},
                        "Posted to "],
                       pt]];
                pt = jt.tac2html(pt); } }
        return pt;
    },


    //This should have a similar look and feel to the shoutout display
    revFormTextAreaHTML = function (review, type, keyval, mode) {
        var area, style, placetext, lightbg;
        if(keyval) {  //have the basics so display text area
            lightbg = app.skinner.lightbg();
            style = "color:" + app.colors.text + ";" +
                    "width:" + textTargetWidth() + "px;" +
                    "padding:5px 8px;" +
                    "background-color:" + lightbg + ";" +
                    "margin-left:10px;";
            if(mode === "edit") {
                placetext = ">>How would you describe this to a friend?";
                style += "height:100px;";
                //make background-color semi-transparent if browser supports it
                style += "background-color:rgba(" + 
                    jt.hex2rgb(lightbg) + ",0.6);";
                area = ["textarea", {id: "reviewtext", cla: "shoutout",
                                     placeholder: placetext,
                                     style: style},
                        review.text || ""]; }
            else {
                style += "border:1px solid " + app.skinner.darkbg() + ";" +
                    "overflow:auto;";
                //make background-color semi-transparent if browser supports it
                style += "background-color:rgba(" + 
                    jt.hex2rgb(lightbg) + ",0.3);";
                area = ["div", {id: "reviewtext", cla: "shoutout",
                                style: style},
                        jt.linkify(review.text || "") + 
                        postline(review, app.review.displayRead)]; } }
        else {  //keyval for review not set yet, provide autocomplete area
            area = ["div", {id: "revautodiv", cla: "autocomplete",
                            style: "width:" + textTargetWidth() + "px;"}]; }
        return area;
    },
        

    selectRatingByMenu = function (evtx) {
        var i, html = [], odiv;
        starPointingActive = false;
        for(i = 0; i <= 100; i += 10) {
            html.push(["div", {cla: "ratingmenudiv", id: "starsel" + i,
                               onclick: jt.fs("app.review.ratingMenuSelect(" + 
                                              i + ")")},
                       starsImageHTML(i)]); }
        jt.out('overlaydiv', jt.tac2html(html));
        odiv = jt.byId('overlaydiv');
        odiv.style.left = "70px";
        odiv.style.top = "100px";
        //bring up to the right of where the touch is occurring, otherwise
        //you can get an instant select as the touch is applied to the div
        odiv.style.left = String(Math.round(evtx + 50)) + "px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = app.skinner.lightbg();
        app.onescapefunc = app.layout.cancelOverlay;
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


    starStopPointing = function (event) {
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
        var itemdat, url, attrs, title, rest, items = [], i, lis = [];
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
                    rest = secondaryAttr("ProductGroup", attrs.content); }
                else if(crev.revtype === 'music') {
                    rest = secondaryAttr("Artist", attrs.content) + " " +
                        secondaryAttr("Manufacturer", attrs.content) +
                        secondaryAttr("ProductGroup", attrs.content); }
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
        for(i = 0; i < items.length; i += 1) {
            lis.push(["li",
                      ["a", {href: items[i].url, 
                             onclick: jt.fs("app.review.readURL('" + 
                                            items[i].url + "')")},
                       items[i].title + " " + items[i].rest]]); }
        jt.out('revautodiv', jt.tac2html(["ul", lis]));
    },


    callAmazonForAutocomplete = function (acfunc) {
        var url;
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            jt.enc(autocomptxt);
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
            html = app.layout.dlgwrapHTML("Geocoded Place Details", html);
            //the dialog is displayed if processing fails, meanwhile
            //it serves as a stable place to hold the required map.
            app.layout.writeDialogContents(html);
            if(complainIfNotAlreadyThere) {
                jt.out('lslogdiv', "geocodingInfoDiv was destroyed"); } }
    },


    selectLocLatLng = function (latlng, ref, retry, errmsg) {
        var mapdiv, map, maxretry = 10, html;
        retry = retry || 0;
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
                      "or send this error to support@fgfweb.com so " + 
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
                    selectLocLatLng(latlng, ref, retry + 1, problem);
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

        
    writeACPLinks = function (acfunc, results, status) {
        var i, place, selfunc, items = [], html = "<ul>";
        if(status === google.maps.places.PlacesServiceStatus.OK) {
            for(i = 0; i < results.length; i += 1) {
                place = results[i];
                selfunc = "app.review.selectLocation('" +
                    jt.embenc(place.description) + "','" + 
                    place.reference + "')";
                items.push(["li",
                            ["a", {href: "#selectloc",
                                   onclick: jt.fs(selfunc)},
                             place.description]]); } }
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


    autocompletion = function (event) {
        var srchtxt;
        if(crev.autocomp && jt.byId('revautodiv') && jt.byId('keyin')) {
            srchtxt = jt.byId('keyin').value;
            if(jt.byId('subkeyin')) {
                srchtxt += " " + jt.byId('subkeyin').value; }
            if(srchtxt !== autocomptxt) {
                autocomptxt = srchtxt;
                if(crev.revtype === 'book' || crev.revtype === 'movie' ||
                   crev.revtype === 'music') {
                    callAmazonForAutocomplete(autocompletion); }
                else if(crev.revtype === 'food' || crev.revtype === 'drink' ||
                        crev.revtype === 'activity') {
                    callGooglePlacesAutocomplete(autocompletion); } }
            else {
                setTimeout(autocompletion, 750); } }
    },


    startReviewFormDynamicElements = function (revpen, review) {
        setTimeout(function () {  //secondary stuff, do after main display
            app.revresp.activateResponseButtons(review); }, 50);
        if(jt.byId('revautodiv')) {
            autocomptxt = "";
            autocompletion(); }
        if(jt.byId('sharediv')) {
            app.services.displayShare('sharebuttonsdiv', 'sharemsgdiv',
                                      revpen, review); }
    },


    activateStarsAndFocus = function (type, review, keyval) {
        jt.on('revformstarsdiv', 'mousedown',   starPointing);
        jt.on('revformstarsdiv', 'mouseup',     starStopPointing);
        jt.on('revformstarsdiv', 'mouseout',    starStopPointingBoundary);
        jt.on('revformstarsdiv', 'mousemove',   starPointAdjust);
        jt.on('revformstarsdiv', 'click',       starClick);
        jt.on('revformstarsdiv', 'touchstart',  starPointing);
        jt.on('revformstarsdiv', 'touchend',    starStopPointing);
        jt.on('revformstarsdiv', 'touchcancel', starStopPointing);
        jt.on('revformstarsdiv', 'touchmove',   starPointAdjust);
        if(!keyval) {
            jt.byId('keyin').focus(); }
        else if(jt.byId('subkeyin') && !review[type.subkey]) {
            jt.byId('subkeyin').focus(); }
        else {
            jt.byId('reviewtext').focus(); }
    },


    revFormAttributionHTML = function (mode) {
        var html = "";
        if(mode === "edit" && attribution) {
            html = attribution; }
        return html;
    },


    prepPicDialogElements = function () {
        var pictype = crev.svcdata.picdisp, elem;
        if(!crev.imguri) {
            jt.byId('sitepiclabel').style.color = "#999999";
            jt.byId('sitepic').disabled = true; }
        else {  //have crev.imguri
            if(pictype !== "sitepic") {
                jt.byId('sitepicimg').className = "revimgdis"; } }
        if(pictype !== "upldpic") {
            elem = jt.byId("upimg");
            if(elem) {
                elem.className = "revimgdis"; }
            jt.byId('picfilein').disabled = true;
            jt.byId('picfilesubmit').disabled = true; }
    },


    overlay = function (base, over) {
        var pos;
        base = jt.byId(base);
        over = jt.byId(over);
        pos = jt.geoPos(base);
        over.style.left = String(pos.x) + "px";
        over.style.top = String(pos.y) + "px";
        over.style.height = String(pos.h) + "px";
        over.style.width = String(pos.w) + "px";
    },


    revfs = function (callstr) {
        return jt.fs("app.review." + callstr);
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
                                  value: app.pen.currPenId()}],
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
                                 style: "display:none"}]]];
            jt.out('upldpicform', jt.tac2html(html));
            monitorPicUpload(); }
        else {  //not upldpic
            displayUploadedPicLabel(); }
    },


    displayReviewForm = function (pen, review, mode, errmsg) {
        var type = findReviewType(review.revtype),
            keyval = review[type.key],
            html;
        html = ["div", {cla: "formstyle", id: "revdispdiv"},
                [["div", {id: "revformattributiondiv"},
                  revFormAttributionHTML(mode)],
                 ["div", {id: "revformstarsdiv"},
                  revFormStarsHTML(review, type, keyval, mode)],
                 ["div", {id: "revformfieldsdiv"},
                  revFormFieldsHTML(review, type, keyval, mode)],
                 ["div", {id: "revmodifieddiv", cla: "blrevdate"},
                  revFormLastModified(review, mode)],
                 ["div", {id: "revformtextareadiv"},
                  revFormTextAreaHTML(review, type, keyval, mode)],
                 ["div", {id: "revformkeywareadiv"},
                  revFormKeywordsHTML(review, type, keyval, mode)],
                 ["table",
                  ["tr",
                   [["td", {valign: "top"},
                     ["div", {id: "revformimagediv",
                              //reserve the img space so the form
                              //maintains a predictable visual layout
                              //max-width set in css .revimg
                              style: "min-width:125px;"},
                      revFormImageHTML(review, type, keyval, mode)]],
                    ["td", {valign: "top"},
                     ["div", {id: "revformtranformactionsdiv"},
                      transformActionsHTML(review, type, keyval, mode)]]]]],
                 ["div", {id: "revformbuttonsdiv"},
                  revFormButtonsHTML(pen, review, type, keyval, mode)],
                 ["div", {id: "revcommentsdiv"}, ""]]];
        if(!jt.byId('cmain')) {
            app.layout.initContent(); }
        html = jt.tac2html(html);
        jt.out('cmain', html);
        if(mode === "edit") {
            activateStarsAndFocus(type, review, keyval); }
        if(errmsg) {
            jt.out('revsavemsg', errmsg); }
        startReviewFormDynamicElements(pen, review);
    },


    copyReview = function (review) {
        var name, copy = {};
        for(name in review) {
            if(review.hasOwnProperty(name)) {
                copy[name] = review[name]; } }
        return copy;
    },


    makeMine = function (review, srcrevId) {
        var now = new Date().toISOString();
        review.penid = app.pen.currPenId();
        review.grpid = 0;
        review.rating = 0;
        review.srcrev = srcrevId;
        review.modified = now;
        review.modhist = "";
        review.keywords = "";
        review.text = "";
        review.revpic = "";
        review.svcdata = "";
        review.penname = app.pen.currPenRef().pen.name;
        review.helpful = "";
        review.remembered = "";
    },


    cacheBustPersonalReviewSearches = function () {
        var penref = app.pen.currPenRef();
        if(penref.profstate) {
            penref.profstate.allRevsState = null; }
        penref.prerevs = null;
    },


    mainDisplay = function (pen, read, action, errmsg) {
        if(!crev) {
            crev = {}; }
        if(!crev.penid) {
            crev.penid = app.pen.currPenId(); }
        if(!read) {
            crev = copyReview(crev); }
        setTimeout(function () {  //refresh headings
            if(crev.penid !== jt.instId(pen)) { 
                app.lcs.getFull("pen", crev.penid, function (revpenref) {
                    app.profile.verifyStateVariableValues(revpenref.pen); }); }
            else {
                app.profile.verifyStateVariableValues(pen); }
            }, 50);
        jt.out('rightcoldiv', "");
        jt.byId('rightcoldiv').style.display = "none";
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(pen, crev);
            if(crev.penid !== app.pen.currPenId()) {  //not our review
                if(action === "helpful") {
                    app.revresp.toggleHelpfulButton("set"); }
                else if(action === "remember") {
                    app.revresp.toggleMemoButton(); }
                else if(action === "respond") {
                    app.revresp.respond(); } } }
        else if(!findReviewType(crev.revtype)) {
            displayTypeSelect(); }
        else if(action === "uploadpic") {
            displayReviewForm(pen, crev, "edit");
            app.review.picdlg(); }
        else {
            displayReviewForm(pen, crev, "edit", errmsg); }
    },


    dlgReadButtonHTML = function () {
        return ["button", {type: "button", id: "rdurlbutton",
                           onclick: jt.fs("app.review.readURL()")},
                "Read"];
    },


    dlgRevTypeSelection = function () {
        var i, rt, clt, html = [];
        for(i = 0; i < reviewTypes.length; i += 1) {
            rt = reviewTypes[i];
            clt = (crev.revtype === rt.type) ? "reviewbadgesel" : "reviewbadge";
            html.push(["a", {href: "#" + rt.type,
                             onclick: jt.fs("app.review.updatedlg('" + 
                                            rt.type + "')")},
                       ["img", {cla: clt, src: "img/" + rt.img}]]); }
        html = ["div", {cla: "revtypesdiv", id: "revdlgtypesdiv"}, 
                html];
        jt.out("rdtypesdiv", jt.tac2html(html));
        jt.byId("urlin").value = crev.url || "";
        jt.out("rdurlbuttonspan", jt.tac2html(dlgReadButtonHTML()));
    },


    dlgKeyFieldEntry = function () {
        var rt, html = "";
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no key field entry yet.
            return; }
        if(!jt.byId("rdkeyindiv").innerHTML) {
            html = [["label", {fo: "keyin", cla: "liflab", id: "keylab"}, 
                     rt.key],
                    ["input", {id: "keyin", cla: "lifin", type: "text"}],
                    ["div", {id: "rdacdiv"},
                     ["input", {type: "checkbox", id: "rdaccb",
                                name: "autocompleteactivationcheckbox",
                                //<IE8 onchange only fires after onblur.
                                //check action nullified if return false.
                                onclick: jt.fsd("app.review.runAutoComp()"),
                                checked: jt.toru(crev.autocomp)}]],
                    ["div", {id: "revautodiv"}]];
            jt.out("rdkeyindiv", jt.tac2html(html)); }
        jt.out("keylab", rt.key.capitalize());  //update label if type changed
        jt.byId("keyin").value = crev[rt.key] || "";
        jt.byId("rdaccb").checked = crev.autocomp;
        if(html) {  //just initialized the key input, set for entry
            jt.byId('keyin').focus(); }
        app.review.runAutoComp();
    },


    dlgPicHTML = function () {
        var src, type, html;
        src = "img/emptyprofpic.png";
        type = verifyReviewImageDisplayType(crev);
        if(type === "upldpic") {
            src = "revpic?revid=" + jt.instId(crev); }
        else if(type === "sitepic") {
            src = crev.imguri;
            if(window.location.href.indexOf("https://") === 0) {
                src = "imagerelay?url=" + jt.enc(src); } }
        html = ["img", {id: "revimg", cla: "revimg", src: src}];
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
        var rt, html, i;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no key field entry yet.
            return; }
        if(!jt.byId("rdpfdiv").innerHTML) {
            html = [["div", {id: "rdstarsdiv"}, dlgStarsHTML()]];
            if(rt.subkey) {
                html.push(dlgFieldInputHTML(rt.subkey)); }
            for(i = 0; i < rt.fields.length; i += 1) {
                html.push(dlgFieldInputHTML(rt.fields[i])); }
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
        for(i = 0; i < rt.fields.length; i += 1) {
            jt.byId(rt.fields[i] + "in").value = crev[rt.fields[i]] || ""; }
    },


    dlgTextEntry = function () {
        var rt, ptxt, html;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no text entry yet.
            return; }
        if(!jt.byId("rdtextdiv").innerHTML) {
            ptxt = "What was the most memorable thing for you?";
            html = ["textarea", {id: "rdta", placeholder: ptxt},
                    crev.text || ""];
            jt.out('rdtextdiv', jt.tac2html(html)); }
        //text is not dynamically updated
    },


    dlgKeywordEntry = function () {
        var rt, html, i, chk;
        rt = findReviewType(crev.revtype);
        if(!rt) {  //no type selected yet, so no keyword entry yet
            return; }
        crev.keywords = crev.keywords || "";
        html = [];
        for(i = 0; i < rt.dkwords.length; i += 1) {
            chk = jt.toru(crev.keywords.indexOf(rt.dkwords[i]) >= 0, "checked");
            html.push(["div", {cla: "rdkwcbdiv"},
                       [["input", {type: "checkbox", id: "dkw" + i,
                                   value: rt.dkwords[i], checked: chk,
                                   //onchange only fires onblur if <IE8
                                   onclick: jt.fsd("app.review.togkey('dkw" + 
                                                   i + "')")}],
                        ["label", {fo: "dkw" + i}, rt.dkwords[i]]]]); }
        html = [["div", {id: "rdkwcbsdiv"}, html]];
        html.push(["div", {id: "rdkwindiv"},
                   [["label", {fo: "rdkwin", cla: "liflab", id: "rdkwlab"},
                     "Keywords"],
                    ["input", {id: "rdkwin", cla: "lifin", type: "text"}]]]);
        jt.out('rdkwdiv', jt.tac2html(html));
    },


    updateReviewDialogContents = function () {
        dlgRevTypeSelection();
        dlgKeyFieldEntry();
        dlgDetailsEntry();
        dlgTextEntry();
        dlgKeywordEntry();
        //jt.err("rdkeyindiv offsetWidth: " + jt.byId('rdkeyindiv').offsetWidth);
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        autourl = "";
        crev = { autocomp: true };
        attribution = "";
    },


    start: function (source) {
        var html;
        app.review.resetStateVars();
        if(typeof source === 'string') {  //passed in a url
            autourl = source; }
        if(typeof source === 'object') {  //passed in another review
            crev = copyReview(source);
            if(source.penid !== app.pen.currPenId()) {
                crev = makeMine(crev, jt.instId(source)); } }
        html = ["div", {id: "revdlgdiv"},
                [["div", {id: "rdurldiv"},
                  [["label", {fo: "urlin", cla: "liflab"}, "URL"],
                   ["input", {id: "urlin", cla: "lifin", type: "url"}],
                   ["span", {id: "rdurlbuttonspan"}, dlgReadButtonHTML()],
                   ["div", {id: "rdstat1"}]]],
                 ["div", {id: "rdtypesdiv"}],
                 ["div", {id: "rdkeyindiv"}],
                 ["div", {id: "rdpfdiv"}],     //pic, stars, fields
                 ["div", {id: "rdtextdiv"}],
                 ["div", {id: "rdkwdiv"}],
                 ["div", {id: "rdokdiv"},
                  [["div", {id: "rdokstatdiv"}],
                   ["div", {id: "rdokbuttondiv", cla: "dlgbuttonsdiv"},
                    ["button", {type: "button", id: "okbutton",
                                onclick: jt.fs("app.review.save()")},
                     "Ok"]]]]]];
        html = app.layout.dlgwrapHTML("Make Membic", html);
        app.layout.openDialog(
            {x: jt.byId("headingdivcontent").offsetLeft - 34, y:22},
            jt.tac2html(html), updateReviewDialogContents);
    },


    updatedlg: function (typename) {
        app.layout.cancelOverlay();  //close if already open or done
        if(typename) {
            if(jt.byId('rdstarsdiv') && crev.srcrev !== -101) {
                dlgStarsDeactivate();
                jt.out('rdpfdiv', ""); }
            crev.revtype = typename; }
        updateReviewDialogContents();
    },

    
    runAutoComp: function () {
        if(!crev.autocomp) {
            jt.out('revautodiv', ""); }
        else {
            autocompletion(); }
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
        if(!url) {
            return; }
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
            crev.url = autourl = url;
            crev.autocomp = false;
            readParameters(params);
            getURLReader(autourl, function (reader) {
                reader.fetchData(crev, url, params); }); }
        else {
            app.review.updatedlg(); }
    },


    ////////////////////
    //Everything below here might be able to be cleaned up...

    display: function (action, errmsg) {
        app.pen.getPen(function (pen) {
            mainDisplay(pen, false, action, errmsg); 
        });
    },


    displayRead: function (action) {
        app.pen.getPen(function (pen) {
            mainDisplay(pen, true, action); 
        });
    },


    staticReviewDisplay: function (review, revlink, mode) {
        var type, html, revid, revresp = "";
        revid = jt.instId(review);
        type = app.review.getReviewTypeByValue(review.revtype);
        if(!revlink) {
            revlink = ["a", {cla: "rslc", href: "../statrev/" + revid},
                       app.profile.reviewItemNameHTML(type, review)]; }
        if(revlink === "none") {
            revlink = ["span", {cla: "rslc"},
                       app.profile.reviewItemNameHTML(type, review)]; }
        if("revroll" !== mode) {
            revresp = ["div", {cla: "statrevrespdiv"},
                       ["div", {cla: "transformlinkdiv"},
                        ["a", {href: "../?view=review&penid=" + review.penid +
                                     "&revid=" + jt.instId(review),
                               title: "Launch app to respond or comment"},
                         "Respond/Comment"]]]; }
        html = ["div", {id: "statrevdiv" + revid, cla: "statrevdiv"},
                [["div", {cla: "statrevmodkeydiv"},
                  jt.colloquialDate(jt.ISOString2Day(review.modified)) +
                  ":&nbsp;" + review.keywords],
                 app.review.starsImageHTML(review),
                 app.review.badgeImageHTML(type),
                 "&nbsp;",
                 revlink,
                 "&nbsp;" + app.review.jumpLinkHTML(review, type),
                 ["div", {cla: "revtextsummary"},
                  [["div", {style:"float:left;padding:0px 10px 0px 0px;"}, 
                    app.review.picHTML(review, type, mode)],
                   ["div", {style: "padding:10px;"},
                    jt.linkify(review.text) + 
                    postline(review)],
                   revresp]],
                 ["div", {style: "clear:both;"}]]];
        return jt.tac2html(html);
    },


    delrev: function () {
        var data;
        if(!crev || 
           !window.confirm("Are you sure you want to delete this post?")) {
            return; }
        jt.out('cmain', "Deleting post...");
        data = jt.objdata(crev);
        jt.call('POST', "delrev?" + app.login.authparams(), data,
                 function (reviews) {
                     var html = "<p>Post deleted.  If this post was one" +
                         " of your top 20 best, then you may see an id" +
                         " reference message until the next time you post" +
                         " something.  Recalculating your recent posts..." +
                         "</p>";
                     jt.out('cmain', html);
                     cacheBustPersonalReviewSearches();
                     setTimeout(function () {
                         jt.out('cmain', html + "This may take a moment..."); },
                                6000);
                     setTimeout(function () {
                         //between comments and corresponding review links
                         //it's easiest to effectively just reload.
                         app.lcs.nukeItAll();
                         app.review.resetStateVars();
                         app.activity.reset();
                         app.profile.resetStateVars();
                         app.rel.resetStateVars();
                         app.pen.resetStateVars();
                         app.login.init(); }, 12000); },
                 app.failf(function (code, errtxt) {
                     jt.err("Delete failed code: " + code + " " + errtxt);
                     app.profile.display(); }),
                jt.semaphore("review.delrev"));
    },


    reviewLinkHTML: function (mode) {
        var html, imgsrc = "writereview.png", style = "";
        if(!mode) {
            mode = app.layout.currnavmode(); }
        if(mode === "review") {
            style = "color:#FFD100";
            imgsrc = "writereviewsel.png"; }
        html = ["div", {cla: "topnavitemdiv", style: style },
                jt.imgntxt(imgsrc, "",  //Post and Share...
                           "app.review.cancelReview(true)", "#Write",
                           "Post an experience and share with friends",
                           "navico", "navrev", "app.review.mroll")];
        return jt.tac2html(html);
    },


    mroll: function (mouse) {
        if(mouse === "over") {
            jt.byId('navrevimg').src = "img/writereviewsel.png";
            jt.byId('navrevtxttd').style.color = "#FFD100"; }
        else { //"out"
            if(app.layout.currnavmode() === "review" || jt.byId('revfdiv')) {
                jt.byId('navrevimg').src = "img/writereviewsel.png";
                jt.byId('navrevtxttd').style.color = "#FFD100"; }
            else {
                jt.byId('navrevimg').src = "img/writereview.png";
                jt.byId('navrevtxttd').style.color = app.colors.text; } }
    },


    updateHeading: function () {
        return true;
    },


    getReviewTypes: function () {
        return reviewTypes;
    },


    getReviewTypeByValue: function (val) {
        return findReviewType(val);
    },


    reviewTypeCheckboxesHTML: function (cboxgroup, chgfuncstr, selt) {
        return revTypeChoiceHTML("checkbox", cboxgroup, selt, chgfuncstr);
    },


    reviewTypeRadiosHTML: function (rgname, chgfuncstr, revrefs, selt) {
        return revTypeChoiceHTML("radio", rgname, selt, chgfuncstr, revrefs);
    },


    reviewTypeSelectOptionsHTML: function (revrefs) {
        var i, typename, greyed, html = [];
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            greyed = false;
            if(revrefs) {
                if(!revrefs[typename] || revrefs[typename].length === 0) {
                    greyed = true; } }
            html.push(["option", {value: typename, 
                                  disabled: jt.toru(greyed, "disabled")},
                       reviewTypes[i].plural.capitalize()]); }
        return jt.tac2html(html);
    },


    badgeImageHTML: function (type, withtext, greyed, sing) {
        var label = type.plural.capitalize(), html = [];
        if(sing) {
            label = type.type.capitalize(); }
        if(type.img) {
            html.push(["img", {cla: "reviewbadge", src: "img/" + type.img,
                               title: label, alt: label}]);
            if(withtext) {
                if(greyed) {
                    label = ["span", {style: "color:#999999;"}, label]; }
                html.push(label); } }
        return jt.tac2html(html);
    },


    starsImageHTML: function (rating, mode) {
        return starsImageHTML(rating, mode);
    },


    linkCountHTML: function (revid) {
        var revref, html;
        revref = app.lcs.getRef("rev", revid);
        if(!revref.revlink) {
            return ""; }
        html = linkCountBadgeHTML(revref.revlink, 'helpful') +
            linkCountBadgeHTML(revref.revlink, 'remembered') +
            linkCountBadgeHTML(revref.revlink, 'corresponding');
        if(html) {
            html = "&nbsp;" + html; }
        return html;
    },


    setType: function (type) {
        crev.revtype = type;
        app.review.display();
    },


    keywordcsv: function (kwid, keycsv) {
        var cbox = jt.byId(kwid), 
            text = "", kw, i,
            keywords = keycsv.split(",");
        for(i = 0; i < keywords.length; i += 1) {
            kw = keywords[i];
            if(kw) {  //have something not a null value or empty string
                kw = kw.trim();  //remove any extraneous comma space
                if(kw === cbox.value) {
                    kw = ""; }
                if(text && kw) {  //have a keyword already and appending another
                    text += ", "; }
                text += kw; } }
        if(cbox.checked) {
            if(text) {
                text += ", "; }
            text += cbox.value; }
        return text;
    },


    togkey: function (kwid) {
        var rdkwin, keycsv;
        rdkwin = jt.byId('rdkwin');
        keycsv = app.review.keywordcsv(kwid, rdkwin.value);
        rdkwin.value = keycsv;
    },


    toggleKeyword: function (kwid) {
        var keyin = jt.byId('keywordin'),
            keycsv = keyin.value;
        keycsv = app.review.keywordcsv(kwid, keycsv);
        keyin.value = keycsv;
    },


    cancelReview: function (force, revtype) {
        if(!okToLoseChanges()) {
            return; }
        app.layout.closeDialog(); //close dialog if previously open
        app.onescapefunc = null; 
        if(fullEditDisplayTimeout) {
            clearTimeout(fullEditDisplayTimeout);
            fullEditDisplayTimeout = null; }
        if(crev && crev.revpic === "DELETED") {
            crev.revpic = crev.oldrevpic; }
        if(force || !crev || !jt.instId(crev)) {
            crev = {};                    //so clear it all out 
            if(revtype) {
                crev.revtype = revtype; }
            autourl = "";
            attribution = "";
            starPointingActive = false;
            autocomptxt = "";
            app.review.display(); }       //and restart
        else {
            crev = app.lcs.getRef("rev", crev).rev;
            app.review.displayRead(); }
    },


    urlchg: function () {
        var html;
        noteURLValue();
        if(!crev.url) {
            html = ezlink(); }
        else {
            html = ["a", {href: "#", title: "Read description fields from URL",
                          onclick: jt.fs("app.review.readURL()")},
                    "Read URL"]; }
        jt.out('ezlinkspan', jt.tac2html(html));
    },


    //The field value onchange and the cancel button battle it out to
    //see whose event gets processed.  On Mac10.8.3/FF19.0.2 onchange
    //goes first, and if it hogs processing then cancel never gets
    //called.  Have to use a timeout so cancel has a shot, and short
    //timeout values (< 200) won't work consistently.
    validate: function () {
        fullEditDisplayTimeout = setTimeout(function () {
            var i, errtxt = "", errors = [];
            fullEditDisplayTimeout = null;
            readAndValidateFieldValues(null, errors);
            if(errors.length > 0) {
                for(i = 0; i < errors.length; i += 1) {
                    errtxt += errors[i] + "<br/>"; }
                jt.out('revsavemsg', errtxt);
                return; }
            app.review.display(); }, 400);
    },


    save: function (skipvalidation) {
        var errors = [], i, errtxt = "", rt, url, data, html;
        //remove save button immediately to avoid double click dupes...
        html = jt.byId('rdokbuttondiv').innerHTML;
        if(!skipvalidation) {
            jt.out('rdokbuttondiv', "Verifying...");
            rt = findReviewType(crev.revtype);
            if(!rt) {
                jt.out('rdokbuttondiv', html);
                jt.out('rdokstatdiv', "Need to choose a type");
                return; }
            readAndValidateFieldValues(rt, errors);
            verifyRatingStars(rt, errors);
            if(errors.length > 0) {
                jt.out('rdokbuttondiv', html);
                for(i = 0; i < errors.length; i += 1) {
                    errtxt += errors[i] + "<br/>"; }
                jt.out('rdokstatdiv', errtxt);
                return; } }
        jt.out('rdokbuttondiv', "Saving...");
        app.layout.cancelOverlay();  //just in case it is still up
        app.onescapefunc = null;
        url = "updrev?";
        if(!jt.instId(crev)) {
            url = "newrev?"; }
        app.review.serializeFields(crev);
        data = jt.objdata(crev);
        app.review.deserializeFields(crev); //in case update fail or interim use
        jt.call('POST', url + app.login.authparams(), data,
                function (reviews) {
                    jt.out('rdokbuttondiv', "Saved.");
                    crev = copyReview(app.lcs.put("rev", reviews[0]).rev);
                    app.activity.updateFeeds(reviews[0]);
                    cacheBustPersonalReviewSearches();
                    setTimeout(app.pen.refreshCurrent, 50); //refetch top 20
                    if(url.indexOf("newrev") >= 0) {
                        setTimeout(app.group.currentReviewPostDialog, 150); }
                    attribution = "";
                    app.layout.closeDialog();
                    app.login.doNextStep({}); },
                app.failf(function (code, errtxt) {
                    jt.out('rdokstatdiv', "Save fail " + code + ": " + errtxt);
                    jt.out('rdokbuttondiv', html); }),
                jt.semaphore("review.save"));
    },


    setCurrentReview: function (revobj) {
        crev = revobj;
    },


    getCurrentReview: function () {
        return crev;
    },


    initWithId: function (revid, mode, action, errmsg) {
        var params = "revid=" + revid;
        jt.call('GET', "revbyid?" + params, null,
                function (revs) {
                    if(revs.length > 0) {
                        crev = copyReview(app.lcs.put("rev", revs[0]).rev);
                        if(mode === "edit") {
                            app.review.display(action, errmsg); }
                        else {
                            app.review.displayRead(action); } }
                    else {
                        jt.err("initWithId found no review id " + revid);
                        app.profile.display(); } },
                app.failf(function (code, errtxt) {
                    jt.err("initWithId failed code " + code + ": " +
                           errtxt); }),
                jt.semaphore("review.initWithId"));
    },


    jumpLinkHTML: function (review, type) {
        var qurl, html;
        if(!review) {
            return ""; }
        if(!review.url) {
            qurl = review[type.key];
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


    swapTitleAndArtist: function () {
        var titlein = jt.byId('keyin'),
            title = titlein.value,
            artistin = jt.byId('artist0'),
            artist = artistin.value;
        titlein.value = artist;
        artistin.value = title;
    },


    changeRevType: function () {
        var html;
        readAndValidateFieldValues();
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                revTypeChoiceHTML("radio", "rgrp", crev.revtype,
                                  jt.fs("app.review.selRevType()"), 
                                  null, true)];
        app.layout.openDialog({y:480}, jt.tac2html(html));
    },


    selRevType: function () {
        var radios, i;
        radios = document.getElementsByName("rgrp");
        for(i = 0; i < radios.length; i += 1) {
            if(radios[i].checked) {
                crev.revtype = radios[i].value;
                break; } }
        app.layout.closeDialog();
        app.review.display();
    },


    pictype: function (pictype) {
        crev.svcdata.picdisp = pictype;
        app.review.picdlg();
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
                                src: crev.imguri || "img/emptyprofpic.png",
                                onclick: revfs("picdlg('sitepic')")}],
                       ["div", {id: "sitepicform", cla: "overform"}]]]]],
                   ["li",
                    [["input", {type: "radio", name: "upt", value: "upldpic",
                                checked: jt.toru(dt === "upldpic"),
                                onchange: revfs("picdlg('upldpic')")}],
                     ["div", {id: "upldpicdetaildiv", cla: "ptddiv"},
                      [["img", {id: "upldpicimg", cla: "revimgdis",
                                src: (crev.revpic ? "revpic?revid=" + revid
                                                  : "img/emptyprofpic.png"),
                                onclick: revfs("picdlg('upldpic')")}],
                       ["div", {id: "upldpicform", cla: "overform"}]]]]],
                   ["li",
                    [["input", {type: "radio", name: "upt", value: "nopic",
                                checked: jt.toru(dt === "nopic"),
                                onchange: revfs("picdlg('nopic')")}],
                     ["span", {cla: "ptdlabspan"}, "No Pic"]]]]]]];
        app.layout.openOverlay(app.layout.placerel("revimg", -5, -80), 
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


    setAttribution: function (html) {
        attribution = html;
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


    selectLocation: function (addr, ref) {
        var errlines = [
            "Not going to be able to fill out the url and address",
            "from the location you selected. This normally just works,",
            "so if you could email this message to support@fgfweb.com",
            "someone can look into why it.  You can also try reloading",
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
                        selectLocLatLng(results[0].geometry.location, ref); }
                    else {
                        errlines.unshift("PlacesServiceStatus not OK");
                        jt.err(errlines.join("\n")); }
                });
            } catch (problem) {
                errlines.unshift("Error geocoding: " + problem);
                jt.err(errlines.join("\n"));
            } }
    },


    ratingMenuSelect: function (rating) {
        var html;
        app.layout.cancelOverlay();
        crev.rating = rating;
        html = starsImageHTML(crev, "edit");
        jt.out('stardisp', html);
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
    },


    keywordCheckboxesHTML: function (type, keycsv, cols, togfstr) {
        var tdc = 0, i, checked, cells = [], rows = [];
        for(i = 0; i < type.dkwords.length; i += 1) {
            checked = jt.toru((keycsv.indexOf(type.dkwords[i]) >= 0),
                              "checked");
            cells.push(
                ["td", {style: "white-space:nowrap;"},
                 [["input", {type: "checkbox", name: "dkw" + i, id: "dkw" + i,
                             value: type.dkwords[i], checked: checked,
                             //<IE8 onchange only fires after onblur
                             //do not return false or check action is nullified
                             onclick: jt.fsd(togfstr + "('dkw" + i + "')")}],
                  ["label", {fo: "dkw" + i}, type.dkwords[i]]]]);
            tdc += 1;
            if(tdc === cols || i === type.dkwords.length - 1) {
                rows.push(["tr", cells]);
                tdc = 0;
                cells = []; } }
        return ["table", {cla: "keywordcheckboxtable"}, rows];
    },


    mrollwr: function (mouse, imgid) {
        var type, typename = imgid.slice(0, imgid.indexOf("img"));
        if(mouse === "over") {
            jt.byId(imgid).src = 
                "img/merit/Merit" + typename.capitalize() + "20.png";
            jt.byId(typename + "txttd").style.color = "#FFD100"; }
        else {
            type = findReviewType(typename);
            jt.byId(imgid).src = "img/" + type.img; 
            jt.byId(typename + "txttd").style.color = app.colors.link; }
    },


    picHTML: function (review, type, mode) {
        return revFormImageHTML(review, type, "defined", "listing", mode);
    },


    makeTransformLink: function (fstr, title, text, label) {
        var html;
        label = label || text;
        html = ["div", {cla: "transformlinkdiv"},
                ["a", {href: "#" + label, onclick: jt.fs(fstr), title: title},
                 text]];
        return html;
    },


    fpbToggleHelpful: function (prefix, revid) {
        var penref;
        penref = app.pen.currPenRef();
        if(!penref || !penref.pen) {
            return jt.err("Please sign in"); }
        jt.err("fpbToggleHelpful not implemented yet");
    },


    fpbToggleRemember: function (prefix, revid) {
        var penref = app.pen.currPenRef();
        if(!penref || !penref.pen) {
            return jt.err("Please sign in"); }
        jt.err("fpbToggleRemember not implemented yet");
    },


    fpbWrite: function (prefix, revid) {
        var penref = app.pen.currPenRef();
        if(!penref || !penref.pen) {
            return jt.err("Please sign in"); }
        app.lcs.getFull("rev", revid, function (revref) {
            app.review.start(revref.rev); });
    },


    toggleExpansion: function (prefix, revid) {
        var rev, revdivid, buttondivid;
        rev = app.lcs.getRef("rev", revid).rev;
        revdivid = prefix + revid;
        buttondivid = revdivid + "buttonsdiv";
        if(jt.byId(buttondivid).innerHTML) {  //shrink
            jt.out(buttondivid, "");
            jt.out(revdivid + "secdiv", "");
            jt.out(revdivid + "datediv", "");
            jt.out(revdivid + "descrdiv", 
                   abbreviatedReviewText(prefix, revid, rev));
            jt.out(revdivid + "keysdiv", ""); }
        else {  //expand
            jt.out(buttondivid, revpostButtonsHTML(prefix, revid));
            jt.out(revdivid + "secdiv", fpSecondaryFieldsHTML(rev));
            jt.out(revdivid + "datediv", 
                   jt.colloquialDate(jt.ISOString2Day(rev.modified)));
            jt.out(revdivid + "descrdiv", jt.linkify(rev.text || ""));
            jt.out(revdivid + "keysdiv", rev.keywords); }
        //ATTENTION: list links to groups rev was posted to in grpsdiv
    },


    revdispHTML: function (prefix, revid, rev) {
        var revdivid, type, html;
        revdivid = prefix + revid;
        type = app.review.getReviewTypeByValue(rev.revtype);
        html = ["div", {cla: "fpinrevdiv"},
                [["div", {cla: "fpbuttonsdiv", 
                          id: revdivid + "buttonsdiv"}],
                 ["div", {cla: "fptypediv"},
                  ["img", {cla: "reviewbadge", src: "img/" + type.img,
                           title: type.type, alt: type.type}]],
                 ["div", {cla: "fptitlediv"},
                  ["a", {href: "#statrev/" + jt.instId(rev),
                         onclick: jt.fs("app.review.toggleExpansion('" +
                                        prefix + "','" + revid + "')")},
                   app.profile.reviewItemNameHTML(type, rev)]],
                 ["div", {cla: "fpstarsdiv"},
                  app.review.starsImageHTML(rev)],
                 ["div", {cla: "fpjumpdiv"},
                  app.review.jumpLinkHTML(rev, type)],
                 ["div", {cla: "fpsecfieldsdiv", id: revdivid + "secdiv"}],
                 ["div", {cla: "fpdatediv", id: revdivid + "datediv"}],
                 ["div", {cla: "fpbodydiv"},
                  [["div", {cla: "fprevpicdiv"},
                    app.review.picHTML(rev, type)],
                   ["div", {cla: "fpdescrdiv", id: revdivid + "descrdiv"},
                    abbreviatedReviewText(prefix, revid, rev)],
                   ["div", {cla: "fpkeywrdsdiv", id: revdivid + "keysdiv"}],
                   ["div", {cla: "fpgrpsdiv", id: revdivid + "grpsdiv"}]]]]];
        return html;
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

