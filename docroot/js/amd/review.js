/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . r e v i e w
//
define([], function () {
    "use strict";

    var //The pen name the user is currently logged in with.
        userpen = null,
        //The initial review url that was given for review creation
        readurl = "",
        //The review currently being displayed or edited.  The pic field
        //is handled as a special case since it requires a form upload.
        review = {},
        //The error message from the previous server save call, if any.
        asyncSaveErrTxt = "",
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
        reviewTypes = [
          { type: "book", plural: "books", img: "TypeBook50.png",
            keyprompt: "Title of book being reviewed",
            key: "title", subkey: "author",
            fields: [ "publisher", "year" ],
            dkwords: [ "Fluff", "Light", "Heavy", "Kid Ok", 
                       "Educational", "Beach", "Travel", "Engaging" ] },
          { type: "movie", plural: "movies", img: "TypeMovie50.png",
            keyprompt: "Movie name",
            key: "title", //subkey
            fields: [ "year", "starring" ],
            dkwords: [ "Fluff", "Light", "Heavy", "Kid Ok", 
                       "Educational", "Cult", "Classic", "Funny", 
                       "Suspenseful" ] },
          { type: "video", plural: "videos", img: "TypeVideo50.png",
            keyprompt: "Link to video",
            key: "url", //subkey
            fields: [ "title", "artist" ],
            dkwords: [ "Light", "Heavy", "Kid Ok", "Educational", 
                       "Cult", "Funny", "Disturbing", "Trippy" ] },
          { type: "music", plural: "music", img: "TypeSong50.png",
            keyprompt: "Title of song, album, video, show or other release",
            key: "title", subkey: "artist",
            fields: [ "album", "year" ],
            dkwords: [ "Light", "Heavy", "Wakeup", "Travel", "Office", 
                       "Workout", "Dance", "Social", "Sex" ] },
          { type: "food", plural: "food", img: "TypeFood50.png",
            keyprompt: "Name of restaurant or dish",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Breakfast", "Lunch", "Dinner", "Snack", 
                       "Cheap", "Expensive", "Fast", "Slow", "Outdoor",
                       "Quiet", "Loud" ] },
          { type: "drink", plural: "drinks", img: "TypeDrink50.png",
            keyprompt: "Name and where from",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Traditional", "Innovative", "Cheap", "Expensive",
                       "Essential", "Special", "Quiet", "Loud", "Outdoor" ] },
          { type: "to do", plural: "things to do", img: "TypeBucket50.png",
            keyprompt: "Name of place, activity, or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Easy", "Advanced", "Kid Ok", "Cheap", "Expensive",
                       "Spring", "Summer", "Autumn", "Winter", "Anytime" ] },
          { type: "other", plural: "other", img: "TypeOther50.png",
            keyprompt: "Name or title", 
            key: "name", subkey: "type",
            fields: [],
            dkwords: [ "Specialized", "General", "Professional", "Personal",
                       "Hobby", "Research" ] }
          ],


    resetStateVars = function () {
        userpen = null;
        readurl = "";
        review = {};
        asyncSaveErrTxt = "";
    },


    //rating is a value from 0 - 100.  Display is rounded to nearest value.
    starsImageHTML = function (rating) {
        var img, title, html;
        if(typeof rating === "string") {
            rating = parseInt(rating, 10); }
        if(!rating || typeof rating !== 'number' || rating < 5) {
            img = "ratstar0.png";
            title = "No stars"; }
        else if(rating < 15) {
            img = "ratstar05.png";
            title = "Half a star"; }
        else if(rating < 25) {
            img = "ratstar1.png";
            title = "One star"; }
        else if(rating < 35) {
            img = "ratstar15.png";
            title = "One and a half stars"; }
        else if(rating < 45) {
            img = "ratstar2.png";
            title = "Two stars"; }
        else if(rating < 55) {
            img = "ratstar25.png";
            title = "Two and a half stars"; }
        else if(rating < 65) {
            img = "ratstar3.png";
            title = "Three stars"; }
        else if(rating < 75) {
            img = "ratstar35.png";
            title = "Three and a half stars"; }
        else if(rating < 85) {
            img = "ratstar4.png";
            title = "Four stars"; }
        else if(rating < 95) {
            img = "ratstar45.png";
            title = "Four and a half stars"; }
        else {
            img = "ratstar5.png";
            title = "Five stars"; }
        html = "<img class=\"starsimg\" src=\"img/" + img + "\"" +
                   " title=\"" + title + "\" alt=\"" + title + "\"/>";
        return html;
    },


    //returns empty string if no image
    badgeImageHTML = function (type, withtext, greyed) {
        var label = type.plural.capitalize(), html = "";
        if(type.img) {
            html = "<img class=\"reviewbadge\"" +
                       " src=\"img/" + type.img + "\"" + 
                       " title=\"" + label + "\"" +
                       " alt=\"" + label + "\"" +
                "/>";
            if(withtext) {
                if(greyed) {
                    label = "<span style=\"color:#CCCCCC;\">" + label + 
                        "</span>"; }
                html += label; } }
        return html;
    },


    revTypeChoiceHTML = function (intype, gname, selt, chgfstr, revrefs) {
        var i, tdc = 0, greyed, typename, label, value, checked, 
            html = "<table>";
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            greyed = false;
            if(revrefs) {
                if(!revrefs[typename] || revrefs[typename].length === 0) {
                    greyed = true; } }
            label = badgeImageHTML(reviewTypes[i], true, greyed);
            value = reviewTypes[i].plural;
            checked = (typename === selt);
            if(tdc === 0) {
                html += "<tr>"; }
            html += "<td>" + 
                mor.checkrad(intype, gname, value, label, checked, chgfstr) + 
                "</td>";
            tdc += 1;
            if(tdc === 4 || i === reviewTypes.length - 1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table>";
        return html;
    },


    reviewTypeCheckboxesHTML = function (cboxgroup) {
        return revTypeChoiceHTML("checkbox", cboxgroup);
    },


    reviewTypeRadiosHTML = function (rgname, chgfstr, revrefs, selt) {
        return revTypeChoiceHTML("radio", rgname, selt, chgfstr, revrefs);
    },


    findReviewType = function (type) {
        var i;
        type = type.toLowerCase();
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(reviewTypes[i].type === type ||
               reviewTypes[i].plural === type) {
                return reviewTypes[i]; } }
    },


    writeNavDisplay = function () {
        var html = "<a href=\"#Write a Review\"" +
                     " title=\"Review something\"" +
                     " onclick=\"mor.review.reset();return false;\"" +
            ">Write a Review</a>";
        mor.out('revhdiv', html);
        mor.byId('revhdiv').style.visibility = "visible";
    },


    readURL = function (url) {
        var input;
        if(!url) {
            input = mor.byId('urlin');
            if(input) {
                url = input.value; } }
        if(url) {
            readurl = url;
            //ATTENTION: Check configured connection services to see if
            //any of them know how to pull info from this url.
            alert("Unfortunately there is no registered connection service " +
                  "available yet that knows how to read " + url + " so you " +
                  "will have to choose a type manually.  For general " + 
                  "progress status on features see the contact page." ); }
    },


    setType = function (type) {
        review.revtype = type;
        mor.review.display();
    },


    displayTypeSelect = function () {
        var i, tdc = 0, html;
        html = "<div id=\"revfdiv\" class=\"formstyle\" align=\"center\">" +
        "<ul class=\"reviewformul\">" +
            "<li>Paste a web address for what you are reviewing " + 
            "(if available)" + "<table><tr>" +
              "<td align=\"right\">URL</td>" +
              "<td align=\"left\">" +
                "<input type=\"text\" id=\"urlin\" size=\"40\"" +
                      " onchange=\"mor.review.readURL();return false;\"" + 
                "/></td>" +
              "<td>" +
                "<button type=\"button\" id=\"readurlbutton\"" +
                       " onclick=\"mor.review.readURL();return false;\"" +
                       " title=\"Read review form fields from pasted URL\"" +
                    ">Read</button>" +
                "</td>" +
            "</tr></table>" +
            "<li>Choose a review type</li>";
        html += "<table class=\"typebuttonstable\">";
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            //ATTENTION: These buttons could look better.
            html += "<td><button type=\"button\" id=\"type" + i + "\"" +
                               " onclick=\"mor.review.setType('" +
                                             reviewTypes[i].type + "');" +
                                            "return false;\"" +
                               " title=\"Create a " + reviewTypes[i].type + 
                                        " review\"" +
                         "><img class=\"reviewbadge\"" +
                              " src=\"img/" + reviewTypes[i].img + "\">" +
                reviewTypes[i].type + "</button></td>";
            tdc += 1;
            if(tdc === 4 || i === reviewTypes.length -1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table></ul></div>";
        mor.out('cmain', html);
        mor.byId('urlin').focus();
        mor.layout.adjust();
    },


    picUploadForm = function () {
        var odiv, html = "", revid = mor.instId(review);
        mor.review.save();  //save any outstanding edits
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + revid + "\"/>";
        html += "<input type=\"hidden\" name=\"penid\" value=\"" +
            review.penid + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#revedit=" + revid) + "\"/>";
        //build the rest of the form around that
        html = "<form action=\"/revpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            html +
            "<table>" +
              "<tr><td>Upload Review Pic</td></tr>" +
              "<tr><td><input type=\"file\" name=\"picfilein\"" + 
                                          " id=\"picfilein\"/></td></tr>" +
              "<tr><td align=\"center\">" +
                    "<input type=\"submit\" value=\"Upload\"/></td></tr>" +
            "</form>";
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "300px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = mor.cancelPicUpload;
        mor.byId('picfilein').focus();
    },


    picHTML = function (review, type, keyval, mode) {
        var html;
        if(!keyval) {
            return ""; }
        //if just viewing, the default is no pic, just space.  But
        //the layout should stay consistent, so use a placeholder image
        html = "img/emptyblankpic.png";
        if(mode === "edit") {
            //show placeholder outline pic they can click to upload
            html = "img/emptyprofpic.png"; }
        if(review.revpic) {
            //if a pic has been uploaded, use that
            html = "revpic?revid=" + mor.instId(review); }
        html = "<img class=\"revpic\" src=\"" + html + "\"";
        if(mode === "edit") {
            html += " onclick=mor.review.picUploadForm();return false;"; }
        html += "/>";
        return html;
    },


    errlabel = function (domid) {
        var elem = mor.byId(domid);
        elem.style.color = "red";
        if(elem.innerHTML.indexOf("*") < 0) {
            elem.innerHTML += "*"; }
    },


    formFieldLabelContents = function (fieldname) {
        var html = fieldname.capitalize();
        if(fieldname === "url") {
            html = "<img class=\"webjump\" src=\"img/wwwico.png\"/>URL"; }
        return html;
    },


    siteAbbrev = function (url) {
        var html, dotindex;
        if(!url) {
            return "?"; }
        dotindex = url.lastIndexOf(".");
        if(dotindex >= 0) {
            html = url.slice(dotindex, dotindex + 4); }
        else {
            html = url.slice(0, 4); }
        html = "<span class=\"webabbrev\">" + html + "</span>";
        return html;
    },


    graphicAbbrevSiteLink = function (url) {
        var html;
        if(!url) {
            return ""; }
        html = "<a href=\"" + url + "\"" + 
            " onclick=\"window.open('" + url + "');return false;\"" +
            " title=\"" + url + "\">" +
            "<img class=\"webjump\" src=\"img/wwwico.png\"/>" +
                siteAbbrev(url) + "</a>";
        return html;
    },


    noteURLValue = function () {
        var input = mor.byId('urlin');
        //if auto read url from initial form, note it and then reset
        if(readurl) {
            review.url = readurl;
            readurl = ""; }
        //the url may be edited
        if(input) {
            review.url = input.value; }
    },


    keyFieldsValid = function (type, errors) {
        var cankey, input = mor.byId('keyin');
        if(!input || !input.value) {
            errlabel('keyinlabeltd');
            errors.push("Please specify a value for " + type.key); }
        else {
            review[type.key] = input.value;
            cankey = review[type.key]; }
        if(type.subkey) {
            input = mor.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Please specify a value for " + type.subkey); }
            else {
                review[type.subkey] = input.value;
                cankey += review[type.subkey]; } }
        if(cankey) {
            review.cankey = mor.canonize(cankey); }
    },


    secondaryFieldsHTML = function (review, type, keyval, mode) {
        var html = "", i, field, fval;
        if(!keyval) {
            return html; }
        html += "<table>";
        for(i = 0; i < type.fields.length; i += 1) {
            field = type.fields[i];
            fval = review[field] || "";
            if(field !== "url") {
                html += "<tr>";
                if(mode === "edit") {
                    html += "<td align=\"right\">" + 
                        field.capitalize() + "</td>" +
                        "<td align=\"left\">" +
                            "<input type=\"text\" id=\"field" + i + "\"" + 
                                  " size=\"25\"" +
                                  " value=\"" + fval + "\"/></td>"; }
                else if(fval) {  //not editing and have value to display
                    html += "<td>" + fval + "</td>"; }
                html += "</tr>"; } }
        html += "</table>";
        return html;
    },


    secondaryFieldsValid = function (type, errors) {
        var input, i;
        //none of the secondary fields are required, so just note the values
        for(i = 0; i < type.fields.length; i += 1) {
            input = mor.byId("field" + i);
            if(input) {  //input field was displayed
                review[type.fields[i]] = input.value; } }
    },


    toggleKeyword = function (kwid) {
        var cbox, text, keyin, keywords, i, kw;
        cbox = mor.byId(kwid);
        text = "";
        keyin = mor.byId('keywordin');
        keywords = keyin.value.split(",");
        for(i = 0; i < keywords.length; i += 1) {
            kw = keywords[i].trim();
            if(kw === cbox.value) {
                kw = ""; }
            if(text) {  //have a keyword already
                text += ", "; }
            text += kw; }
        if(cbox.checked) {
            if(text) {
                text += ", "; }
            text += cbox.value; }
        keyin.value = text;
    },


    keywordCheckboxesHTML = function (type) {
        var i, tdc = 0, html = "";
        html += "<table>";
        for(i = 0; i < type.dkwords.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            html += "<td><input type=\"checkbox\"" +
                " name=\"dkw" + i + "\"" +
                " value=\"" + type.dkwords[i] + "\"" +
                " id=\"dkw" + i + "\"" + 
                " onchange=\"mor.review.toggleKeyword('dkw" + i + "');" +
                            "return false;\"";
            if(review.keywords.indexOf(type.dkwords[i]) >= 0) {
                html += " checked=\"checked\""; }
            html += "/>" +
                "<label for=\"dkw" + i + "\">" + 
                  type.dkwords[i] + "</label>" +
                "</td>";
            tdc += 1;
            if(tdc === 4 || i === type.dkwords.length - 1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table>";
        return html;
    },


    keywordsHTML = function (review, type, keyval, mode) {
        var html = "";
        if(!keyval) {
            return html; }
        if(mode === "edit") {
            html += keywordCheckboxesHTML(type) + 
                "Keywords: " +
                  "<input type=\"text\" id=\"keywordin\"" + 
                        " size=\"30\"" + 
                        " value=\"" + review.keywords + "\"/>"; }
        else { //not editing
            html += "<div class=\"csvstrdiv\">" + review.keywords + "</div>"; }
        return html;
    },


    keywordsValid = function (type, errors) {
        var input = mor.byId('keywordin');
        if(input) {
            review.keywords = input.value; }
    },


    //This should have a similar look and feel to the shoutout display
    reviewTextHTML = function (review, type, keyval, mode) {
        var html = "", fval, style, targetwidth;
        if(!keyval) {
            return html; }
        fval = review.text || "";
        targetwidth = Math.max((mor.winw - 350), 200);
        style = "color:" + mor.colors.text + ";" +
            "background-color:" + mor.skinner.lightbg() + ";" +
            "width:" + targetwidth + "px;";
        if(mode === "edit") {
            style += "height:120px;";
            html += "<textarea id=\"reviewtext\" class=\"shoutout\"" + 
                             " style=\"" + style + "\">" +
                fval + "</textarea>"; }
        else {
            style += "height:140px;overflow:auto;" + 
                "border:1px solid " + mor.skinner.darkbg() + ";";
            html += "<div id=\"reviewtext\" class=\"shoutout\"" +
                        " style=\"" + style + "\">" + 
                mor.linkify(fval) + "</div>"; }
        return html;
    },


    reviewTextValid = function (type, errors) {
        var input = mor.byId('reviewtext');
        if(input) {
            review.text = input.value; }
    },


    //Return true if the current user has remembered the given review,
    //false otherwise.
    isRemembered = function (review) {
        var penid = mor.instId(userpen);
        if(penid && review && review.memos && 
           review.memos.indexOf(penid + ":") >= 0) {
            return true; }
    },


    //ATTENTION: Once review responses are available, there needs to
    //be a way to view those responses as a list so you can see what
    //other people thought of the same thing or what kind of an impact
    //you are having.  This is a good way to find other pen names to
    //follow, and a response review is how you communicate about
    //things on MyOpenReviews.  "Like", "+1" and general chatter
    //is best handled via integration with general social networks.
    reviewFormButtonsHTML = function (review, type, keyval, mode) {
        var html = "";
        //user just chose type for editing
        if(!keyval) {
            mor.onescapefunc = mor.review.reset;
            html += "<button type=\"button\" id=\"cancelbutton\"" +
                " onclick=\"mor.review.reset();return false;\"" +
                ">Cancel</button>" + 
                "&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.save();return false;\"" +
                ">Create Review</button>"; }
        //have key fields and editing full review
        else if(mode === "edit") {
            html += "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.save();return false;\"" +
                ">Save</button>&nbsp;";
            if(keyval) {  //have at least minimally complete review..
                html += "<button type=\"button\" id=\"donebutton\"" +
                    " onclick=\"mor.review.save(true);return false;\"" +
                    ">Done</button>"; } }
        //reading a previously written review
        else if(review.penid === mor.instId(userpen)) {  //is review owner
            html += "<button type=\"button\" id=\"deletebutton\"" +
                " onclick=\"mor.review.delrev();return false;\"" +
                ">Delete</button>" + "&nbsp;" + 
                "<button type=\"button\" id=\"editbutton\"" +
                " onclick=\"mor.review.display();return false;\"" +
                ">Edit</button>"; }
        //reading a review written by someone else
        else {
            html += "<button type=\"button\" id=\"respondbutton\"" +
                " onclick=\"mor.review.respond();return false;\"" +
                ">Edit Your Review</button>" +
                "&nbsp;";
            if(isRemembered(review)) {
                html += "<button type=\"button\" id=\"memobutton\"" +
                    " onclick=\"mor.review.memo(true);return false;\"" +
                    ">Stop Remembering</a>"; }
            else {
                html += "<button type=\"button\" id=\"memobutton\"" +
                    " onclick=\"mor.review.memo();return false;\"" +
                    ">Remember</a>"; } }
        //space for save status messages underneath buttons
        html += "<br/><div id=\"revsavemsg\"></div>";
        return html;
    },


    sliderChange = function (value) {
        var html;
        //mor.log("sliderChange: " + value);
        review.rating = Math.round(value);
        html = starsImageHTML(review.rating);
        mor.out('stardisp', html);
    },


    makeRatingSlider = function (keyval) {
        //The dojo dijit/form/HorizontalSlider rating control
        var ratingSlider = mor.dojo.dijitreg.byId("ratslide");
        if(ratingSlider) {
            //kill the widget and any contained widgets, preserving DOM node
            ratingSlider.destroyRecursive(true); }
        if(!keyval) {  //no star value input yet
            return; }
        ratingSlider = new mor.dojo.slider({
            name: "ratslide",
            value: 80,
            minimum: 0,
            maximum: 100,
            intermediateChanges: true,
            style: "width:150px;",
            onChange: function (value) {
                sliderChange(value); } }, "ratslide");
        if(review.rating === null || review.rating < 0) { 
            review.rating = 80; }  //have to start somewhere...
        ratingSlider.set("value", review.rating);
        sliderChange(review.rating);
        return ratingSlider;
    },


    //ATTENTION: Somewhere in the read display, show a count of how
    //many response reviews have been written, and how many people
    //have remembered the review.  Provided there's more than zero.
    displayReviewForm = function (review, mode) {
        var html, type, keyval, fval, onchange;
        type = findReviewType(review.revtype);
        keyval = review[type.key];
        html = "<div class=\"formstyle\">" + 
            "<table class=\"revdisptable\" border=\"0\">";
        //labels for first line if editing
        if(mode === "edit") {
            html += "<tr>" +
                "<td></td>" +
                "<td id=\"keyinlabeltd\">" + 
                    formFieldLabelContents(type.keyprompt) + "</td>";
            if(type.subkey) {
                html += "<td id=\"subkeyinlabeltd\">" +
                    formFieldLabelContents(type.subkey) + "</td>"; }
            html += "</tr>"; }
        //first line of actual content
        html += "<tr><td><span id=\"stardisp\">" + 
            starsImageHTML(review.rating) + "</span>" + "&nbsp;" +
            badgeImageHTML(type) + "</td>";
        if(mode === "edit") {
            onchange = "mor.review.save();return false;";
            if(type.subkey) {
                onchange = "mor.byId('subkeyin').focus();return false;"; }
            fval = review[type.key] || "";
            html += "<td><input type=\"text\" id=\"keyin\" size=\"30\"" +
                              " onchange=\"" + onchange + "\"" + 
                              " value=\"" + fval + "\"></td>";
            if(type.subkey) {
                onchange = "mor.review.save();return false;";
                fval = review[type.subkey] || "";
                html += "<td><input type=\"text\" id=\"subkeyin\" size=\"30\"" +
                                  " onchange=\"" + onchange + "\"" +
                                  " value=\"" + fval + "\"/></td>"; } }
        else {  //not editing, read only display
            fval = review[type.key] || "";
            html += "<td align=\"middle\"><b>" + fval + "</b></td>";
            if(type.subkey) {
                fval = review[type.subkey] || "";
                html += "<td><i>" + fval + "</i></td>"; }
            if("url" !== type.key && "url" !== type.subkey) {
                fval = review.url || "";
                html += "<td>" + graphicAbbrevSiteLink(fval) + "</td>"; } }
        html += "</tr>";
        //slider rating control and url input if editing
        if(mode === "edit" && keyval) {
            fval = review.url || "";
            html += "<tr>" + 
                "<td colspan=\"2\" class=\"claro\">" +
                  "<div id=\"ratslide\"></div>" +
                "</td>" + 
                "<td>" +
                  formFieldLabelContents("url") + "<br/>" +
                  "<input type=\"text\" id=\"urlin\" size=\"30\"" +
                        " value=\"" + fval + "\"/>" +
                "</td>" +
                "</tr>"; }
        //text description line
        html += "<tr><td colspan=\"4\">" + 
            reviewTextHTML(review, type, keyval, mode) + "</td></tr>" +
            "</table><table class=\"revdisptable\" border=\"0\">";
        //pic, keywords, secondary fields, pic
        html += "<tr>" +
            "<td>" + picHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                keywordsHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                secondaryFieldsHTML(review, type, keyval, mode) + "</td>" +
            "</tr>";
        //buttons
        html += "<tr>" +
          "<td colspan=\"4\" align=\"center\" id=\"formbuttonstd\">" + 
            reviewFormButtonsHTML(review, type, keyval, mode) + "</td>" +
        "</tr>" +
        "</table></div>";
        mor.out('cmain', html);
        if(mode === "edit") {
            makeRatingSlider(keyval);
            if(!keyval) {
                mor.byId('keyin').focus(); }
            else if(mor.byId('subkeyin')) {
                mor.byId('subkeyin').focus(); }
            else {
                mor.byId('reviewtext').focus(); } }
        mor.layout.adjust();
    },


    cancelReview = function () {
        review = {};
        mor.onescapefunc = null; 
        mor.review.display();
    },


    saveReview = function (doneEditing) {
        var errors = [], i, errtxt = "", type, url, data;
        type = findReviewType(review.revtype);
        if(!type) {
            mor.out('revsavemsg', "Unknown review type");
            return; }
        noteURLValue();
        keyFieldsValid(type, errors);
        secondaryFieldsValid(type, errors);
        keywordsValid(type, errors);
        reviewTextValid(type, errors);
        if(errors.length > 0) {
            for(i = 0; i < errors.length; i += 1) {
                errtxt += errors[i] + "<br/>"; }
            mor.out('revsavemsg', errtxt);
            return; }
        mor.out('formbuttonstd', "Saving...");
        mor.onescapefunc = null;
        url = "updrev?";
        if(!mor.instId(review)) {
            url = "newrev?";
            review.svcdata = ""; }
        data = mor.objdata(review);
        mor.call(url + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     mor.profile.resetReviews();
                     review = reviews[0];
                     //fetch the updated top 20 lists
                     setTimeout(mor.pen.refreshCurrent, 100);
                     if(doneEditing) {
                         mor.review.displayRead(true); }
                     else {
                         mor.review.display(); } },
                 function (code, errtxt) {
                     asyncSaveErrTxt = "Save failed code: " + code + " " +
                         errtxt;
                     mor.review.display(); });
    },


    initWithId = function (revid, mode) {
        var params = "revid=" + revid;
        mor.call("revbyid?" + params, 'GET', null,
                 function (revs) {
                     if(revs.length > 0) {
                         review = revs[0];
                         if(mode === "edit") {
                             mor.review.display(); }
                         else {
                             mor.review.displayRead(); } }
                     else {
                         mor.err("initWithId found no review id " + revid); } },
                 function (code, errtxt) {
                     mor.err("initWithId failed code " + code + ": " +
                             errtxt); });
    },


    //If the current user has a corresponding review for the current
    //review, then edit it, otherwise create a new review using the
    //existing review fields (except the text).  Verify penid:revid
    //for the original review exists in the sourcerevs of the edited
    //response review.  After saving the modified response review,
    //call the server to verify the penid:revid of the response review
    //exists in the responserevs field of the original review. [This
    //could be done via a separate task on the server, but the client
    //has all the context already, and it's not a critical referential
    //integrity relationship].
    //
    //If the current review.responserevs has a penid:revid value, then
    //edit that identified review.  Otherwise look up the review by
    //the type and canonical key/subkey value (cankey).  If no match
    //was found, then provide a message saying "no existing review
    //found, creating a new one <search>".  Clicking search bring up a
    //dialog that walks the users reviews for the given type and
    //displays anything that might be a match.  Sort of like how you
    //search for pen names.
    //
    //Editing a response review should show up in the feeds for the
    //source pen name.
    createEditResponseReview = function () {
        //ATTENTION: This needs to get built
        mor.err("Sorry, editing a response review is not implemented yet");
    },


    //Add the review to the remembered (permanent) feed items.  If
    //remove is true then delete it from the remembered feed items.
    //This would be called "bookmark", except then it gets confused
    //with the browser bookmarks.
    //
    //After the feed item has been created, call the server to verify
    //the penid:feedid exists in the source review.
    addReviewToMemos = function (remove) {
        //ATTENTION: This needs to get built
        mor.err("Sorry, remembering a review is not implemented yet");
    },


    deleteReview = function () {
        var url, data;
        if(!review || 
           !confirm("Are you sure you want to delete this review?")) {
            return; }
        url = "delrev?";
        data = mor.objdata(review);
        mor.call("delrev?" + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     mor.profile.resetReviews();
                     mor.profile.display(); },
                 function (code, errtxt) {
                     mor.err("Delete failed code: " + code + " " + errtxt);
                     mor.profile.display(); });
    },


    mainDisplay = function (pen, read, runServices) {
        userpen = pen;
        if(!review) {
            review = {}; }
        if(!review.penid) {
            review.penid = mor.instId(userpen); }
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(review);
            if(runServices) {
                mor.services.run(pen, review); } }
        else if(!review.revtype) {
            displayTypeSelect(); }
        else {
            displayReviewForm(review, "edit"); }
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function () {
            mor.pen.getPen(mainDisplay); },
        displayRead: function (runServices) {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, true, runServices); }); },
        delrev: function () {
            deleteReview(); },
        updateHeading: function () {
            writeNavDisplay(); },
        getReviewTypes: function () {
            return reviewTypes; },
        getReviewTypeByValue: function (val) {
            return findReviewType(val); },
        reviewTypeCheckboxesHTML: function (cboxgroup) {
            return reviewTypeCheckboxesHTML(cboxgroup); },
        reviewTypeRadiosHTML: function (rgname, chgfuncstr, revrefs, selt) {
            return reviewTypeRadiosHTML(rgname, chgfuncstr, revrefs, selt); },
        badgeImageHTML: function (type) {
            return badgeImageHTML(type); },
        starsImageHTML: function (rating) {
            return starsImageHTML(rating); },
        readURL: function (url) {
            return readURL(url); },
        setType: function (type) {
            return setType(type); },
        picUploadForm: function () {
            picUploadForm(); },
        toggleKeyword: function (kwid) {
            toggleKeyword(kwid); },
        reset: function () {
            cancelReview(); },
        save: function (doneEditing) {
            saveReview(doneEditing); },
        setCurrentReview: function (revobj) {
            review = revobj; },
        getCurrentReview: function () {
            return review; },
        initWithId: function (revid, mode) {
            initWithId(revid, mode); },
        respond: function () {
            createEditResponseReview(); },
        memo: function (remove) {
            addReviewToMemos(remove); },
        graphicAbbrevSiteLink: function (url) {
            return graphicAbbrevSiteLink(url); }
    };

});


