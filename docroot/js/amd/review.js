/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . r e v i e w
//
define([], function () {
    "use strict";

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
        // 3. If something has a subkey, keep the primary key prompt
        //    short so it doesn't cause bad formatting.
        reviewTypes = [
          { type: "book", plural: "books", img: "TypeBook50.png",
            keyprompt: "Title",
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
            keyprompt: "Title",
            key: "title", //subkey
            fields: [ "artist" ],
            dkwords: [ "Light", "Heavy", "Kid Ok", "Educational", 
                       "Cult", "Funny", "Disturbing", "Trippy" ] },
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
            key: "name", //subkey
            fields: [],
            dkwords: [ "Specialized", "General", "Professional", "Personal",
                       "Hobby", "Research" ] }
          ],


    resetStateVars = function () {
        autourl = "";
        crev = {};
        asyncSaveErrTxt = "";
        attribution = "";
    },


    //rating is a value from 0 - 100.  Display is rounded to nearest value.
    starsImageHTML = function (rating) {
        var width, title, html;
        if(typeof rating === "string") {
            rating = parseInt(rating, 10); }
        if(!rating || typeof rating !== 'number' || rating < 5) {
            width = 0;
            title = "No stars"; }
        else if(rating < 15) {
            width = 6;
            title = "Half a star"; }
        else if(rating < 25) {
            width = 12;
            title = "One star"; }
        else if(rating < 35) {
            width = 18;
            title = "One and a half stars"; }
        else if(rating < 45) {
            width = 24;
            title = "Two stars"; }
        else if(rating < 55) {
            width = 30;
            title = "Two and a half stars"; }
        else if(rating < 65) {
            width = 36;
            title = "Three stars"; }
        else if(rating < 75) {
            width = 42;
            title = "Three and a half stars"; }
        else if(rating < 85) {
            width = 48;
            title = "Four stars"; }
        else if(rating < 95) {
            width = 54;
            title = "Four and a half stars"; }
        else {
            width = 60;
            title = "Five stars"; }
        html = "<img class=\"starsimg\" src=\"img/blank.png\"" +
                   " style=\"width:" + (60 - width) + "px;height:13px;\"/>" +
               "<img class=\"starsimg\" src=\"img/blank.png\"" +
                   " style=\"width:" + width + "px;height:13px;" + 
                            "background:url('img/ratstar5.png')\"" +
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
        if(!type) {
            return null; }
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


    readParameters = function (params) {
        if(params.newrev) { 
            crev.revtype = mor.dec(params.newrev); }
        if(params.name) {
            crev.name = mor.dec(params.name); }
        if(params.title) {
            crev.title = mor.dec(params.title); }
        if(params.artist) {
            crev.artist = mor.dec(params.artist); }
        if(params.author) {
            crev.author = mor.dec(params.author); }
        if(params.publisher) {
            crev.publisher = mor.dec(params.publisher); }
        if(params.album) {
            crev.album = mor.dec(params.album); }
        if(params.starring) {
            crev.starring = mor.dec(params.starring); }
        if(params.address) {
            crev.address = mor.dec(params.address); }
        if(params.year) {
            crev.year = mor.dec(params.year); }
        if(params.imguri) {
            crev.imguri = mor.dec(params.imguri); }
    },


    getURLReader = function (url, callfunc) {
        if(url.indexOf(".youtube.") > 0) {
            require([ "ext/youtube" ], callfunc); }
        else if(url.indexOf(".netflix.") > 0) {
            require([ "ext/netflix" ], callfunc); }
        else if(url.indexOf(".amazon.") > 0) {
            require([ "ext/amazon" ], callfunc); }
        else {
            require([ "ext/readurl" ], callfunc); }
    },


    //This is the main processing entry point from the bookmarklet or
    //direct links.
    readURL = function (url, params) {
        var urlin, rbtd;
        if(!params) {
            params = {}; }
        if(!url) {
            urlin = mor.byId('urlin');
            if(urlin) {
                url = urlin.value; } }
        rbtd = mor.byId('readurlbuttontd');
        if(rbtd) {
            rbtd.innerHTML = "reading..."; }
        if(url) {
            crev.url = autourl = url;
            readParameters(params);
            getURLReader(autourl, function (reader) {
                reader.fetchData(crev, url, params); }); }
        else {
            mor.review.display(); }
    },


    setType = function (type) {
        crev.revtype = type;
        mor.review.display();
    },


    displayTypeSelect = function () {
        var i, tdc = 0, html;
        html = "<div id=\"revfdiv\" class=\"formstyle\" align=\"center\">" +
            "<ul class=\"reviewformul\">";
        if(autourl) {
            html += "<li><a href=\"" + autourl + "\">" + autourl + 
                "</a></li>"; }
        else {
            html += "<li><div class=\"bigoverlabel\">" + 
                "Paste a web address for the review (if available)" + 
                "</div><table><tr>" +
                "<td align=\"right\">URL</td>" +
                "<td align=\"left\">" +
                  "<input type=\"text\" id=\"urlin\" size=\"40\"" +
                        " onchange=\"mor.review.readURL();return false;\"" + 
                "/></td>" +
                "<td id=readurlbuttontd>" +
                  "<button type=\"button\" id=\"readurlbutton\"" +
                         " onclick=\"mor.review.readURL();return false;\"" +
                         " title=\"Read review form fields from pasted URL\"" +
                  ">Read</button>" +
                "</td>" +
              "</tr></table></li>"; }
        html += "<li><div class=\"bigoverlabel\">" + 
                "Choose a review type</div></li>" + 
            "<table class=\"typebuttonstable\">";
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
        var odiv, html = "", revid = mor.instId(crev);
        mor.review.save();  //save any outstanding edits
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + revid + "\"/>";
        html += "<input type=\"hidden\" name=\"penid\" value=\"" +
            crev.penid + "\"/>";
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
        if(review.imguri) {  //use auto-generated link if avail. No direct edit.
            html = "<a href=\"" + review.url + "\"" + 
                     " onclick=\"window.open('" + review.url + "');" + 
                                "return false;\"" +
                "><img style=\"max-width:125px;height:auto;\"" +
                     " src=\"" + review.imguri + "\"/></a>";
            if(mode === "edit") {
                html += "<br/>" +
                    "<a href=\"#remove image link\"" +
                      " onclick=\"mor.review.removeImageLink();" + 
                                 "return false;\"" +
                    ">remove image</a>"; } }
        else {  //no auto-generated link image, allow personal pic upload
            html = "";   //if just viewing, the default is no pic. 
            if(mode === "edit") {  //for editing, default is outline pic
                html = "img/emptyprofpic.png"; }
            if(review.revpic) {  //use uploaded pic if available
                html = "revpic?revid=" + mor.instId(review); }
            html = "<img class=\"revpic\" src=\"" + html + "\"";
            if(mode === "edit") {
                html += " onclick=mor.review.picUploadForm();return false;"; }
            html += "/>"; }
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
        if(autourl) {
            crev.url = autourl;
            autourl = ""; }
        //the url may be edited
        if(input) {
            crev.url = input.value; }
    },


    keyFieldsValid = function (type, errors) {
        var cankey, input = mor.byId('keyin');
        if(!input || !input.value) {
            errlabel('keyinlabeltd');
            errors.push("Please specify a value for " + type.key); }
        else {
            crev[type.key] = input.value;
            cankey = crev[type.key]; }
        if(type.subkey) {
            input = mor.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Please specify a value for " + type.subkey); }
            else {
                crev[type.subkey] = input.value;
                cankey += crev[type.subkey]; } }
        if(cankey) {
            crev.cankey = mor.canonize(cankey); }
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
                if(fval || mode === "edit") {
                    html += "<tr><td><span class=\"secondaryfield\">" +
                        field.capitalize() + "</span></td>"; }
                if(mode === "edit") {
                    html += "<td align=\"left\">" +
                        "<input type=\"text\" id=\"field" + i + "\"" + 
                              " size=\"25\"" +
                              " value=\"" + fval + "\"/></td>"; }
                else {  
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
                crev[type.fields[i]] = input.value; } }
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
            if(text && kw) {  //have a keyword already and appending another
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
        if(!crev.keywords) {
            crev.keywords = ""; }
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
            if(crev.keywords.indexOf(type.dkwords[i]) >= 0) {
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


    //ATTENTION: This needs to do a quick pass through and get rid of
    //           any extraneous commas.  For extra credit: Add commas
    //           when people insert their own space separated keywords.
    keywordsValid = function (type, errors) {
        var input = mor.byId('keywordin');
        if(input) {
            crev.keywords = input.value; }
    },


    reviewTextValid = function (type, errors) {
        var input = mor.byId('reviewtext');
        if(input) {
            crev.text = input.value; }
    },


    //Return true if the current user has remembered the given review,
    //false otherwise.
    isRemembered = function (pen, review) {
        var i, revid = mor.instId(review);
        if(pen.revmem && pen.revmem.remembered) {
            for(i = 0; i < pen.revmem.remembered.length; i += 1) {
                if(revid === pen.revmem.remembered[i]) {
                    return true; } } }
    },


    transformActionsHTML = function (review, type, keyval, mode) {
        var html = "";
        if(keyval && mode === "edit") {
            //video import may confuse the title and artist
            if(review.revtype === "video" && review.title && review.artist) {
                html += "<a href=\"#\"" + 
                          " title=\"Swap the artist and title values\"" +
                          " onclick=\"mor.review.swapVidTitleAndArtist();" +
                                     "return false;\"" +
                    ">Swap title and artist</a>&nbsp;&nbsp;&nbsp;"; }
            //sometimes videos are really more music and vice versa
            if(review.revtype === "video") {
                html += "<a href=\"#\"" +
                          " title=\"Review this as music\"" +
                          " onclick=\"mor.review.changeReviewType('music');" +
                                     "return false;\"" +
                    ">Review as music</a>&nbsp;&nbsp;&nbsp;"; }
            if(review.revtype === "music") {
                html += "<a href=\"#\"" +
                          " title=\"Review this as video\"" +
                          " onclick=\"mor.review.changeReviewType('video');" +
                                     "return false;\"" +
                    ">Review as video</a>&nbsp;&nbsp;&nbsp;"; }
            //Might want to refresh the image link or get other info
            if(review.url) {
                html += "<a href=\"#\"" +
                          " title=\"Refetch imported data field values\"" +
                          " onclick=\"mor.review.readURL('" + 
                                                         review.url + "');" +
                                     "return false;\"" +
                    ">Reimport</a>&nbsp;&nbsp;&nbsp;"; }
        }
        return html;
    },


    swapVidTitleAndArtist = function () {
        var titlein = mor.byId('keyin'),
            title = titlein.value,
            artistin = mor.byId('field0'),
            artist = artistin.value;
        titlein.value = artist;
        artistin.value = title;
    },


    changeReviewType = function (typeval) {
        crev.revtype = typeval;
        mor.review.display();
    },


    removeImageLink = function () {
        crev.imguri = "";
        mor.review.display();
    },


    //ATTENTION: Once review responses are available, there needs to
    //be a way to view those responses as a list so you can see what
    //other people thought of the same thing or what kind of an impact
    //you are having.  This is a good way to find other pen names to
    //follow, and a response review is how you communicate about
    //things on MyOpenReviews.  "Like", "+1" and general chatter
    //is best handled via integration with general social networks.
    reviewFormButtonsHTML = function (pen, review, type, keyval, mode) {
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
        else if(review.penid === mor.pen.currPenId()) {  //is review owner
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
                ">Edit your corresponding review</button>" +
                "&nbsp;";
            if(isRemembered(pen, review)) {
                html += "<button type=\"button\" id=\"memobutton\"" +
                    " onclick=\"mor.review.memo(true);return false;\"" +
                    ">Stop remembering this review</a>"; }
            else {
                html += "<button type=\"button\" id=\"memobutton\"" +
                    " onclick=\"mor.review.memo();return false;\"" +
                    ">Remember this review</a>"; } }
        //space for save status messages underneath buttons
        html += "<br/><div id=\"revsavemsg\"></div>";
        return html;
    },


    sliderChange = function (value) {
        var html;
        //mor.log("sliderChange: " + value);
        crev.rating = Math.round(value);
        html = starsImageHTML(crev.rating);
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
        //0 is a valid rating value so can't test for !crev.rating...
        if(crev.rating === null || crev.rating < 0) { 
            crev.rating = 80; }  //have to start somewhere...
        ratingSlider.set("value", crev.rating);
        sliderChange(crev.rating);
        return ratingSlider;
    },


    revFormIdentHTML = function (review, type, keyval, mode) {
        var html = "", onchange, fval;
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
        html += "<tr><td style=\"text-align:right\"><span id=\"stardisp\">" + 
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
            html += "<td>" + "<span class=\"revtitle\">" + 
                fval + "</span></td>";
            if(type.subkey) {
                fval = review[type.subkey] || "";
                html += "<td><span class=\"revauthor\">" + 
                    fval + "</span></td>"; }
            if("url" !== type.key && "url" !== type.subkey) {
                fval = review.url || "";
                html += "<td>" + graphicAbbrevSiteLink(fval) + "</td>"; } }
        html += "</tr>";
        //slider rating control and url input if editing
        if(mode === "edit" && keyval) {
            fval = review.url || "";
            html += "<tr>" + 
                "<td class=\"claro\" style=\"width:160px;\">" +
                  "<table class=\"nopadtable\"><tr><td>" +
                    "<div id=\"ratslide\"></div>" +
                  "</td></tr></table>" +
                "</td>" + 
                "<td></td>" + 
                "<td>" +
                  formFieldLabelContents("url") + "<br/>" +
                  "<input type=\"text\" id=\"urlin\" size=\"30\"" +
                        " value=\"" + fval + "\"/>" +
                "</td>" +
                "</tr>"; }
        return html;
    },


    //This should have a similar look and feel to the shoutout display
    revFormTextHTML = function (review, type, keyval, mode) {
        var html, fval, style, targetwidth, placetext;
        html = "<tr><td colspan=\"4\">";
        if(keyval) {  //have the basics so display text area
            fval = review.text || "";
            targetwidth = Math.max((mor.winw - 350), 200);
            style = "color:" + mor.colors.text + ";" +
                "background-color:" + mor.skinner.lightbg() + ";" +
                "width:" + targetwidth + "px;";
            if(mode === "edit") {
                style += "height:120px;";
                placetext = ">>What was the most striking thing" + 
                    " about this for you?";
                html += "<textarea id=\"reviewtext\" class=\"shoutout\"" + 
                                 " placeholder=\"" + placetext + "\"" +
                                 " style=\"" + style + "\">" +
                    fval + "</textarea>"; }
            else {
                style += "height:140px;overflow:auto;" + 
                    "border:1px solid " + mor.skinner.darkbg() + ";";
                html += "<div id=\"reviewtext\" class=\"shoutout\"" +
                            " style=\"" + style + "\">" + 
                    mor.linkify(fval) + "</div>"; } }
        html += "</td></tr>";
        return html;
    },


    //pic, keywords, secondary fields
    revFormDetailHTML = function (review, type, keyval, mode) {
        var html = "<tr>" +
            "<td>" + picHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                keywordsHTML(review, type, keyval, mode) + "</td>" +
            "<td valign=\"top\">" + 
                secondaryFieldsHTML(review, type, keyval, mode) + "</td>" +
            "</tr>";
        return html;
    },


    //ATTENTION: Somewhere in the read display, show a count of how
    //many response reviews have been written, and how many people
    //have remembered the review.  Provided there's more than zero.
    displayReviewForm = function (pen, review, mode) {
        var html, type, keyval;
        type = findReviewType(review.revtype);
        keyval = review[type.key];
        html = "<div class=\"formstyle\">" + 
            "<table class=\"revdisptable\" border=\"0\">";
        if(mode === "edit" && attribution) {
            html += "<tr><td colspan=\"4\">" + 
                "<div id=\"attributiondiv\">" + attribution + 
                "</div></td></tr>"; }
        html += revFormIdentHTML(review, type, keyval, mode);
        if(mode === "edit") {
            html += revFormTextHTML(review, type, keyval, mode);
            html += revFormDetailHTML(review, type, keyval, mode); }
        else { //read display
            html += revFormDetailHTML(review, type, keyval, mode);
            html += revFormTextHTML(review, type, keyval, mode); }
        //special case additional helper functions
        html += "<tr>" +
          "<td colspan=\"4\" align=\"center\" id=\"transformactionstd\">" + 
            transformActionsHTML(review, type, keyval, mode) + "</td>" +
        "</tr>";
        //buttons
        html += "<tr>" +
          "<td colspan=\"4\" align=\"center\" id=\"formbuttonstd\">" + 
            reviewFormButtonsHTML(pen, review, type, keyval, mode) + "</td>" +
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
        crev = {};
        mor.onescapefunc = null; 
        mor.review.display();
    },


    saveReview = function (doneEditing) {
        var errors = [], i, errtxt = "", type, url, data;
        type = findReviewType(crev.revtype);
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
        if(!mor.instId(crev)) {
            url = "newrev?";
            crev.svcdata = ""; }
        data = mor.objdata(crev);
        mor.call(url + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     mor.profile.resetReviews();
                     crev = reviews[0];
                     //fetch the updated top 20 lists
                     setTimeout(mor.pen.refreshCurrent, 100);
                     if(doneEditing) {
                         attribution = "";
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
                         crev = revs[0];
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


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given review.
    copyAndEdit = function (pen, review) {
        //If instantiating a new review, then copy some base fields over
        review.penid = mor.instId(pen);
        review.revtype = crev.revtype;
        review.rating = crev.rating;  //initial value required..
        review.cankey = crev.cankey;
        //Fill in any empty descriptive fields
        if(crev.imguri && !review.imguri && !review.revpic) {
            review.imguri = crev.imguri; }
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
        mor.review.display();
    },


    //Using the cankey, look up this pen's corresponding review and
    //edit it, filling out any descriptive fields that did not already
    //have values.  
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
    createEditResponseReview = function (homepen) {
        var params, i, t20;
        if(homepen.top20s) {
            t20 = homepen.top20s[crev.revtype];
            if(t20 && t20.length) {
                for(i = 0; i < t20.length; i += 1) {
                    if(t20[i].cankey === crev.cankey && 
                       t20[i].revtype === crev.revtype) {
                        return copyAndEdit(homepen, t20[i]); } } } }
        params = "penid=" + mor.instId(homepen) + 
            "&revtype=" + crev.revtype + "&cankey=" + crev.cankey +
            "&" + mor.login.authparams();
        mor.call("revbykey?" + params, 'GET', null,
                 function (revs) {
                     var rev = {};
                     if(revs.length > 0) {
                         rev = revs[0]; }
                     copyAndEdit(homepen, rev); },
                 function (code, errtxt) {
                     mor.err("Edit response review failed " + code + 
                             " " + errtxt); });
    },


    //Add the review to the remembered (permanent) feed items.  If
    //remove is true then delete it from the remembered feed items.
    //This would be called "bookmark", except then it gets confused
    //with the browser bookmarks.
    //
    //After the feed item has been created, call the server to verify
    //the penid:feedid exists in the source review.
    addReviewToMemos = function (pen, remove) {
        var idx, revid = mor.instId(crev);
        if(!pen.revmem) {
            pen.revmem = {}; }
        if(!pen.revmem.remembered) {
            pen.revmem.remembered = []; }
        if(remove) {
            idx = pen.revmem.remembered.indexOf(revid);
            if(idx >= 0) {
                pen.revmem.remembered.splice(idx, 1); } }
        else {  //prepend to remembered, most recent first
            pen.revmem.remembered.unshift(revid);
            mor.activity.cacheReview(crev); }
        mor.pen.updatePen(pen, 
                          function (pen) {
                              mor.review.displayRead(false); },
                          function (code, errtxt) {
                              mor.err("Remember update failed " + code + 
                                      " " + errtxt); });
    },


    deleteReview = function () {
        var url, data;
        if(!crev || 
           !confirm("Are you sure you want to delete this review?")) {
            return; }
        url = "delrev?";
        data = mor.objdata(crev);
        mor.call("delrev?" + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     mor.profile.resetReviews();
                     mor.profile.display(); },
                 function (code, errtxt) {
                     mor.err("Delete failed code: " + code + " " + errtxt);
                     mor.profile.display(); });
    },


    mainDisplay = function (pen, read, runServices) {
        if(!crev) {
            crev = {}; }
        if(!crev.penid) {
            crev.penid = mor.pen.currPenId(); }
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(pen, crev);
            if(runServices) {
                mor.services.run(pen, crev); } }
        else if(!findReviewType(crev.revtype)) {
            displayTypeSelect(); }
        else {
            displayReviewForm(pen, crev, "edit"); }
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
        readURL: function (url, params) {
            return readURL(url, params); },
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
            crev = revobj; },
        getCurrentReview: function () {
            return crev; },
        initWithId: function (revid, mode) {
            initWithId(revid, mode); },
        respond: function () {
            mor.pen.getPen(function (pen) {
                createEditResponseReview(pen); }); },
        memo: function (remove) {
            mor.pen.getPen(function (pen) {
                addReviewToMemos(pen, remove); }); },
        graphicAbbrevSiteLink: function (url) {
            return graphicAbbrevSiteLink(url); },
        swapVidTitleAndArtist: function () {
            swapVidTitleAndArtist(); },
        changeReviewType: function (revtype) {
            changeReviewType(revtype); },
        removeImageLink: function () {
            removeImageLink(); },
        setAttribution: function (html) {
            attribution = html; }
    };

});


