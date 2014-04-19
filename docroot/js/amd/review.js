/*global setTimeout: false, clearTimeout: false, window: false, document: false, app: false, jt: false, google: false */

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
                       "Live Performance", "Kid Ok", "Inexpensive", 
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
    starsImageHTML = function (rating, showblank, imgclassname) {
        var imgfile = "img/stars18ptC.png", greyfile = "img/stars18ptCg.png",
            width, offset, rat, html,
            cname = imgclassname || "starsimg";
        rat = app.review.starRating(rating);
        width = Math.floor(rat.step * (starimgw / rat.maxstep));
        html = [];
        html.push(["img", {id: "fillstarsimg", cla: cname, 
                           src: "img/blank.png",
                           style: "width:" + width + "px;" + 
                                  "height:" + starimgh + "px;" +
                                  "background:url('" + imgfile + "');",
                           title: rat.title, alt: rat.title}]);
        if(showblank) {
            if(rat.step % 2 === 1) {  //odd, use half star display
                offset = Math.floor(starimgw / rat.maxstep);
                html.push(
                    ["img", {id: "greystarsimg", cla: cname,
                             src: "img/blank.png",
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "')" +
                                                " -" + offset + "px 0;",
                             title: rat.title, alt: rat.title}]); }
            else { //even, use full star display
                html.push(
                    ["img", {id: "greystarsimg", cla: cname,
                             src: "img/blank.png",
                             style: "width:" + (starimgw - width) + "px;" + 
                                    "height:" + starimgh + "px;" +
                                    "background:url('" + greyfile + "');",
                             title: rat.title, alt: rat.title}]); } }
        else if(!imgclassname) { //add right padding for left justified stars
            html.push(["img", {cla: cname, src: "img/blank.png",
                               style: "width:" + (starimgw - width) + "px;" +
                                      "height:" + starimgh + "px;"}]);
            html.push(["img", {cla: cname, src: "img/blank.png",
                               style: "width:10px;" + 
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
        var input = jt.byId('reviewtext');
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
        cmsg = "You've added some review text. OK to throw it away?";
        return window.confirm(cmsg);
    },


    typeSelectHTML = function (ts, urlh) {
        var html;
        if(app.winw < 600) {
            html = ["table",
                    [["tr",
                      ["td", {colspan: 2},
                       ["div", {cla: "bigoverlabel"},
                        "Choose a review type"]]],
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
                        "Choose a review type"]]],
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
        html = ["a", {href: "#ezlink", cla: "permalink",
                      onclick: jt.fs("app.hinter.ezlink()"),
                      title: "Write a review from any site"},
                [["img", {cla: "webjump", src: "img/gotolink.png"}],
                 "ezlink"]];
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
                            "Create a " + typename + " review",
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
                         ["span", {id: "readurlbuttoncontainer"},
                          ["button", {type: "button", id: "readurlbutton",
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
        app.layout.adjust();
        app.onescapefunc = app.activity.displayActive;
    },


    haveRevpic = function (review) {
        if(review.revpic && review.revpic !== "DELETED") {
            return true; }
    },


    revFormImageHTML = function (review, type, keyval, mode) {
        var imgstyle, imgattr = {}, html = [];
        if(!keyval) {
            return ""; }
        imgstyle = "";
        if(jt.isLowFuncBrowser()) {
            imgstyle = " style=\"width:125px;height:auto;\""; }
        if(review.imguri) {  //use auto-generated link if avail. No direct edit.
            html.push(["a", {href: review.url,
                             onclick: jt.fs("window.open('" + review.url + 
                                            "')")},
                       ["img", {cla: "revimg" + imgstyle,
                                src: review.imguri}]]); }
        else {  //no auto-generated link image, allow personal pic upload
            imgattr.src = "img/blank.png"; 
            if(mode === "edit") {  //for editing, default is outline pic
                imgattr.src = "img/emptyprofpic.png"; }
            if(haveRevpic(review)) {  //use uploaded pic if available
                imgattr.src = "revpic?revid=" + jt.instId(review); }
            imgattr.cla = "revimg" + imgstyle;
            if(mode === "edit") {
                imgattr.title = "Click to upload a picture";
                imgattr.onclick = jt.fs("app.review.picUploadForm()"); }
            html.push(["img", imgattr]); }
        if(mode === "edit" && (review.imguri || haveRevpic(review))) {
            html.push(["br"]);
            html.push(["a", {href: "#remove image link",
                             onclick: jt.fs("app.review.removeImageLink()")},
                       "remove image"]); }
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
            errors.push("Please specify a value for " + type.key); }
        else {
            crev[type.key] = input.value;
            cankey = crev[type.key]; }
        if(type.subkey) {
            input = jt.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Please specify a value for " + type.subkey); }
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
            input = jt.byId("field" + i);
            if(input) {  //input field was displayed
                crev[type.fields[i]] = input.value; } }
    },


    verifyRatingStars = function (type, errors, actionstr) {
        var txt;
        if(!crev.rating) {
            txt = "Please set a star rating";
            if(actionstr === "uploadpic") {
                txt += " before uploading a picture"; }
            errors.push(txt); }
    },


    revFormKeywordsHTML = function (review, type, keyval, mode) {
        var html = "";
        if(!keyval) {
            return html; }
        if(mode === "edit") {
            if(!crev.keywords) {
                crev.keywords = ""; }
            html = [app.review.keywordCheckboxesHTML(
                        type, crev.keywords, 3, "app.review.toggleKeyword"),
                    [["span", {cla: "secondaryfield"},
                      "Keywords "],
                     ["input", {type: "text", id: "keywordin", size: 30,
                                value: jt.safestr(review.keywords)}]]]; }
        else { //not editing
            if(jt.safestr(review.keywords)) {
                html = ["div", {cla: "csvstrdiv"},
                        [["span", {cla: "secondaryfield"},
                          "Keywords "],
                         jt.safestr(review.keywords)]]; } }
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
        if(!type) {
            type = findReviewType(crev.revtype); }
        if(!errors) {
            errors = []; }
        if(type) {
            keyFieldsValid(type, errors);
            keywordsValid(type, errors);
            reviewTextValid(type, errors);
            secondaryFieldsValid(type, errors);
            noteURLValue(); }
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


    makeTransformLink = function (fstr, title, text) {
        var html;
        html = ["div", {cla: "transformlinkdiv",
                        style: "background:" + app.colors.bodybg + ";"},
                ["a", {href: "#", onclick: jt.fs(fstr), title: title},
                 text]];
        return html;
    },


    transformActionsHTML = function (review, type, keyval, mode) {
        var html = "", actions = [];
        if(keyval && mode === "edit") {
            if(review.srcrev && !jt.instId(review)) {
                //new corresponding review, allow finding mismatched titles
                actions.push(makeTransformLink(
                    "app.revresp.searchCorresponding()",
                    "Find existing corresponding review",
                    "Find review")); }
            //always be able to change the review type
            actions.push(makeTransformLink(
                "app.review.changeRevType()",
                "Change this review type",
                "Change Review Type"));
            if(review.revtype === "video" && review.title && review.artist) {
                //video import may have mapped the title and artist backwards
                actions.push(makeTransformLink(
                    "app.review.swapTitleAndArtist()",
                    "Swap the artist and title values",
                    "Swap Title and Artist")); }
            if(review.url) {
                //Might want to refresh the image link or re-read info
                actions.push(makeTransformLink(
                    "app.review.readURL('" + review.url + "')",
                    "Read the URL to fill out review fields",
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
                      "Create Review"],
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
                     "&nbsp;",
                     ["button", {type: "button", id: "editbutton",
                                 onclick: jt.fs("app.review.display()")},
                      "Edit"],
                     "&nbsp;&nbsp;",
                     ["a", {href: temp, cla: "permalink",
                            onclick: jt.fs("window.open('" + temp + "')")},
                      "permalink"],
                     ["br"],
                     ["div", {id: "revsavemsg"}]]]; }
        else {  //reading someone else's review
            html = [app.revresp.feedbackActionsHTML(),
                    ["div", {id: "revsavemsg"}]]; }
        return html;
    },


    ezlink = function () {
        return ["a", {href: "#ezlink", cla: "permalink",
                      onclick: jt.fs("app.hinter.ezlink()"),
                      title: "Write a review from any site"},
                "ezlink"];
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
        var jumplink, width, html = "";
        if(keyval) {
            width = textTargetWidth() + 20;
            jumplink = "";
            if(mode !== "edit") {
                jumplink = app.review.jumpLinkHTML(review.url || ""); }
            html = ["div", {id: "revformstarscontent",
                            style: "width:" + width + "px;"},
                    [["div", {id: "rfsjumpdiv", style: "float:right;"},
                      jumplink],
                     ["div", {id: "rfsratediv"},
                      [["span", {id: "stardisp"},
                        starsImageHTML(review.rating, mode === "edit")],
                       "&nbsp;",
                       app.review.badgeImageHTML(type)]]]]; }
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
                    [["td", {id: inid + "labeltd"},
                      ["span", {cla: "secondaryfield"},
                       labval]],
                     ["td", {align: "left"},
                      valdisp]]]; }
        return html;
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
        if(app.winw < 750) {
            html = ["table", keyrows]; }
        else {
            html = ["div", {id: "revformfieldsdisplaydiv"},
                    ["table",
                     ["tr",
                      [["td", {valign: "top"},
                        ["table", keyrows]],
                       ["td", {valign: "top"},
                        ["table", secrows]]]]]]; }
        return html;
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
                placetext = ">>What was most noteworthy about this?";
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
                        jt.linkify(review.text || "")]; } }
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
        app.onescapefunc = app.cancelOverlay;
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
        if(relx > 100) {  //normal values for relx range from 0 to ~86
            setTimeout(function () {  //separate event handling
                selectRatingByMenu(evtx); }, 20);
            return; }
        //jt.out('keyinlabeltd', "starDisplayAdjust relx: " + relx);  //debug
        sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //jt.out('keyinlabeltd', "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = app.review.starRating(sval, true).value; }
        crev.rating = sval;
        html = starsImageHTML(crev.rating, true);
        jt.out('stardisp', html);
    },


    starPointing = function (event) {
        //jt.out('keyinlabeltd', "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    },


    starStopPointing = function (event) {
        //var pos = jt.geoXY(event);  //debug
        //jt.out('keyinlabeltd', "star NOT pointing" + event.target);  //debug
        //jt.out('starslabeltd', " " + pos.x + ", " + pos.y);  //debug
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, xypos, evtx, evty;
        td = jt.byId('revformstarsdiv');
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
            //jt.out('keyinlabeltd', "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    },


    starPointAdjust = function (event) {
        if(starPointingActive) {
            //jt.out('keyinlabeltd', "star point adjust...");  //debug
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
                    setTimeout(acfunc, 400);
                    app.layout.adjust(); },
                app.failf(function (code, errtxt) {
                    jt.out('revautodiv', "");
                    jt.log("Amazon info retrieval failed code " +
                           code + ": " + errtxt);
                    setTimeout(acfunc, 400);
                    app.layout.adjust(); }),
                jt.semaphore("review.callAmazonForAutocomplete"));
    },


    selectLocLatLng = function (latlng, ref, retry, errmsg) {
        var mapdiv, map, maxretry = 10;
        retry = retry || 0;
        if(retry > maxretry) {
            jt.err("Initializing google maps places failed, so the\n" +
                   "review url and address were not filled out.\n\n" + 
                   "mapdiv: " + mapdiv + "\n" +
                   "error: " + errmsg + "\n\n" +
                   "You can try creating the review again, or fill out\n" +
                   "the fields manually\n");
            return; }
        if(!gplacesvc && google && google.maps && google.maps.places) {
            //this can fail intermittently, restarting the review usually works
            try {
                mapdiv = jt.byId('mapdiv');
                map = new google.maps.Map(mapdiv, {
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: latlng,
                    zoom: 15 });
                gplacesvc = new google.maps.places.PlacesService(map);
            } catch (problem) {
                gplacesvc = null;
                setTimeout(function () {
                    selectLocLatLng(latlng, ref, retry + 1, problem);
                    }, 200);
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
        app.layout.adjust();
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


    selectLocVerifyHTML = function (addr, ref, retry) {
        var mapdiv, maxretry;
        maxretry = 10;
        mapdiv = jt.byId('mapdiv');
        if(!retry) {
            retry = 0; }
        if(retry > maxretry) {
            jt.err("Tried " + maxretry + " times to create a map holder\n" +
                   "to retrieve location info, but it's not working. Not\n" +
                   "going to be able to read the review details..."); }
        if(!mapdiv) {
            setTimeout(function () {
                selectLocVerifyHTML(addr, ref, retry + 1);
                }, 50);
            return; }
        try {
            geoc.geocode({address: addr}, function (results, status) {
                var ok = google.maps.places.PlacesServiceStatus.OK;
                if(status === ok) {
                    selectLocLatLng(results[0].geometry.location, ref); }
                });
        } catch (problem) {
            jt.err("Places service geocode failed: " + problem);
        }
    },


    autocompletion = function (event) {
        var srchtxt;
        if(jt.byId('revautodiv') && jt.byId('keyin')) {
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
                 ["div", {id: "revformtextareadiv"},
                  revFormTextAreaHTML(review, type, keyval, mode)],
                 ["div", {id: "revformkeywareadiv"},
                  revFormKeywordsHTML(review, type, keyval, mode)],
                 ["table",
                  ["tr",
                   [["td", {valign: "top"},
                     ["div", {id: "revformimagediv"},
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
        app.layout.adjust();
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


    cacheBustPersonalReviewSearches = function () {
        var penref = app.pen.currPenRef();
        if(penref.profstate) {
            penref.profstate.allRevsState = null; }
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
                    app.profile.writeNavDisplay(pen, revpenref.pen,
                                                "nosettings"); }); }
            else {
                app.profile.writeNavDisplay(pen, null, "nosettings"); }
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
            app.review.picUploadForm(); }
        else {
            displayReviewForm(pen, crev, "edit", errmsg); }
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    resetStateVars: function () {
        autourl = "";
        crev = {};
        attribution = "";
    },


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


    staticReviewDisplay: function (review, revlink) {
        var type, html, revid, jump = "";
        revid = jt.instId(review);
        type = app.review.getReviewTypeByValue(review.revtype);
        if(!revlink) {
            revlink = ["a", {cla: "rslc", href: "../statrev/" + revid},
                       app.profile.reviewItemNameHTML(type, review)]; }
        if(revlink === "none") {
            revlink = ["span", {cla: "rslc"},
                       app.profile.reviewItemNameHTML(type, review)]; }
        if(review.url) {
            jump = " &nbsp;" + app.review.jumpLinkHTML(review.url); }
        html = ["div", {id: "statrevdiv" + revid, cla: "statrevdiv"},
                [["div", {cla: "statrevmodkeydiv"},
                  jt.colloquialDate(jt.ISOString2Day(review.modified)) +
                  "&nbsp;" + review.keywords],
                 app.review.starsImageHTML(review.rating),
                 app.review.badgeImageHTML(type),
                 "&nbsp;",
                 revlink,
                 jump,
                 ["div", {cla: "revtextsummary"},
                  [["div", {style:"float:left;padding:0px 10px 0px 0px;"}, 
                    app.review.picHTML(review, type)],
                   ["div", {style: "padding:10px;"},
                    jt.linkify(review.text)],
                   ["div", {cla: "statrevrespdiv"},
                    ["a", {href: "../?view=review&penid=" + review.penid +
                                 "&revid=" + jt.instId(review),
                           title: "Open in application to see responses"},
                     "Responses/Comments"]]]],
                 ["div", {style: "clear:both;"}]]];
        return jt.tac2html(html);
    },


    delrev: function () {
        var data;
        if(!crev || 
           !window.confirm("Are you sure you want to delete this review?")) {
            return; }
        jt.out('cmain', "Deleting review...");
        data = jt.objdata(crev);
        jt.call('POST', "delrev?" + app.login.authparams(), data,
                 function (reviews) {
                     var html = "<p>Review deleted.  If this review was one" +
                         " of your top 20 best, then you may see an id" +
                         " reference message until the next time you review" +
                         " something.  Recalculating your recent reviews..." +
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
                jt.imgntxt(imgsrc, "Review and Share",
                           "app.review.cancelReview(true)", "#Write",
                           "Write a review and share it with your friends",
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


    starsImageHTML: function (rating, showblank) {
        return starsImageHTML(rating, showblank);
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


    readURL: function (url, params) {
        var urlin, errs = [], rbc;
        if(!params) {
            params = {}; }
        if(!url) {
            urlin = jt.byId('urlin');
            if(urlin) {
                url = urlin.value; } }
        //If the title or other key fields are not valid, that's ok because
        //we are about to read them. But don't lose comment text.
        reviewTextValid(null, errs);
        if(errs.length > 0) {
            return; }
        if(!url) {  //bail out, but reflect any updates so far
            return app.review.display(); }
        rbc = jt.byId('readurlbuttoncontainer');
        if(rbc) {
            rbc.innerHTML = "reading..."; }
        if(url) {
            url = url.trim();
            if(url.toLowerCase().indexOf("http") !== 0) {
                url = "http://" + url; }
            crev.url = autourl = url;
            readParameters(params);
            getURLReader(autourl, function (reader) {
                reader.fetchData(crev, url, params); }); }
        else {
            app.review.display(); }
    },


    setType: function (type) {
        crev.revtype = type;
        app.review.display();
    },


    //The review must have an id so the server can find the instance
    //to hold the associated revpic data.  Since the pic upload is a
    //form submit requiring the app to reconstruct its state
    //afterwards, any changed field values also need to be saved.  If
    //a user clicks the save button for a new review, and also manages
    //to click for a pic upload, then it might be possible for them to
    //create two instances of the same review.  Protect against that.
    picUploadForm: function () {
        var revid;
        readAndValidateFieldValues();
        revid = jt.instId(crev);
        if(!revid || reviewFieldValuesChanged()) {
            if(jt.byId('revformbuttonsdiv').    //not already saving
                   innerHTML.indexOf("<button") >= 0) {
                return app.review.save(false, "uploadpic"); }
            return; }  //already saving, just ignore the pic upload click
        app.layout.picUpload({ 
            endpoint: "/revpicupload",
            type: "Review",
            id: revid,
            penid: crev.penid,
            rethash: "#revedit=" + revid,
            left: "70px", top: "300px"});
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


    toggleKeyword: function (kwid) {
        var keyin = jt.byId('keywordin'),
            keycsv = keyin.value;
        keycsv = app.review.keywordcsv(kwid, keycsv);
        keyin.value = keycsv;
    },


    cancelReview: function (force, revtype) {
        if(!okToLoseChanges()) {
            return; }
        app.onescapefunc = null; 
        app.layout.updateNavIcons("review");
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
            html = ["a", {href: "#", title: "Read review details from URL",
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


    save: function (doneEditing, actionstr, skipvalidation) {
        var errors = [], i, errtxt = "", type, url, data, html;
        //remove save button immediately to avoid double click dupes...
        html = jt.byId('revformbuttonsdiv').innerHTML;
        if(!skipvalidation) {
            jt.out('revformbuttonsdiv', "Verifying...");
            type = findReviewType(crev.revtype);
            if(!type) {
                jt.out('revformbuttonsdiv', html);
                jt.out('revsavemsg', "Unknown review type");
                return; }
            readAndValidateFieldValues(type, errors);
            verifyRatingStars(type, errors, actionstr);
            if(errors.length > 0) {
                jt.out('revformbuttonsdiv', html);
                for(i = 0; i < errors.length; i += 1) {
                    errtxt += errors[i] + "<br/>"; }
                jt.out('revsavemsg', errtxt);
                return; } }
        jt.out('revformbuttonsdiv', "Saving...");
        app.onescapefunc = null;
        url = "updrev?";
        if(!jt.instId(crev)) {
            url = "newrev?";
            crev.svcdata = ""; }
        data = jt.objdata(crev);
        jt.call('POST', url + app.login.authparams(), data,
                function (reviews) {
                    crev = copyReview(app.lcs.put("rev", reviews[0]).rev);
                    app.layout.runMeritDisplay(crev);
                    cacheBustPersonalReviewSearches();
                    setTimeout(app.pen.refreshCurrent, 50); //refetch top 20
                    setTimeout(function () {  //update matching requests
                        app.activity.fulfillRequests(crev); }, 100);
                    setTimeout(app.group.currentReviewPostDialog, 150);
                    setTimeout(function () {  //update corresponding links
                        app.lcs.checkAllCorresponding(crev); }, 200);
                    if(doneEditing) {
                        attribution = "";
                        app.revresp.pollForUpdates();
                        app.review.displayRead(actionstr); }
                    else {
                        app.review.display(actionstr); } },
                app.failf(function (code, errtxt) {
                    jt.log("saveReview failed code: " + code + " " +
                           errtxt);
                    app.review.display(); }),
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


    jumpLinkHTML: function (url) {
        var html;
        if(!url) {
            return ""; }
        html = ["a", {href: url, title: url,
                      onclick: jt.fs("window.open('" + url + "')")},
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


    removeImageLink: function () {
        readAndValidateFieldValues();
        crev.imguri = "";
        crev.oldrevpic = crev.revpic;
        crev.revpic = "DELETED";
        app.review.display();
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
        var html;
        if(addr) {  //even if all other calls fail, use the selected name
            jt.byId('keyin').value = jt.dec(addr); }
        if(!geoc && google && google.maps && google.maps.places) {
            geoc = new google.maps.Geocoder(); }
        if(geoc && addr) {
            addr = jt.dec(addr);
            html = [["p", addr],
                    ["div", {id: "mapdiv"}]];
            jt.out('revautodiv', jt.tac2html(html));
            selectLocVerifyHTML(addr, ref); }
    },


    ratingMenuSelect: function (rating) {
        var html;
        app.cancelOverlay();
        crev.rating = rating;
        html = starsImageHTML(crev.rating, true);
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


    picHTML: function (review, type) {
        return revFormImageHTML(review, type, "defined", "listing");
    }


}; //end of returned functions
}());


