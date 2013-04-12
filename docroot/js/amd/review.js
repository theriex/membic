/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, clearTimeout: false, window: false, document: false, history: false, mor: false, require: false */

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
        //Whether the stars are being pointer manipulated now
        starPointingActive = false,
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
                       "Educational", "Suspenseful", "Amusing", "Engaging" ] },
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
                       "Inexpensive", "Expensive", "Fast", "Slow", "Outdoor",
                       "Quiet", "Loud" ] },
          { type: "drink", plural: "drinks", img: "TypeDrink50.png",
            keyprompt: "Name and where from",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Traditional", "Innovative", "Inexpensive", "Expensive",
                       "Essential", "Special", "Quiet", "Loud", "Outdoor" ] },
          { type: "to do", plural: "things to do", img: "TypeBucket50.png",
            keyprompt: "Name of place, activity, or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Easy", "Advanced", "Kid Ok", "Inexpensive", "Expensive",
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


    starRating = function (rating, roundup) {
        var starsobj = {}, step,
            starTitles = [ "No stars", "Half a star", 
                           "One star", "One and a half stars",
                           "Two stars", "Two and a half stars",
                           "Three stars", "Three and a half stars",
                           "Four stars", "Four and a half stars",
                           "Five stars" ];
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
        return starsobj;
    },


    //rating is a value from 0 - 100.  Using Math.round to adjust values
    //results in 1px graphic hiccups as the rounding switches, and ceil
    //has similar issues coming off zero, so use floor.
    starsImageHTML = function (rating, showblank, imgclassname) {
        var imgwidth = 81, imgheight = 17, width, offset, rat, html,
            cname = imgclassname || "starsimg";
        rat = starRating(rating);
        width = Math.floor(rat.step * (imgwidth / rat.maxstep));
        html = "";
        if(!showblank && !imgclassname) {
            html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                        " style=\"width:" + (imgwidth - width) + "px;" +
                                 "height:" + imgheight + "px;\"/>"; }
        html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                    " style=\"width:" + width + "px;" + 
                             "height:" + imgheight + "px;" +
                             "background:url('img/starsgold.png');\"" +
                    " title=\"" + rat.title + "\" alt=\"" + rat.title + "\"/>";
        if(showblank) {
            if(rat.step % 2 === 1) {  //odd, use half star display
                offset = Math.floor(imgwidth / rat.maxstep);
                html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                            " style=\"width:" + (imgwidth - width) + "px;" + 
                                     "height:" + imgheight + "px;" +
                                     "background:url('img/starsnone.png')" +
                                                " -" + offset + "px 0;\"" +
                            " title=\"" + rat.title + "\"" + 
                            " alt=\"" + rat.title + "\"/>"; }
            else { //even, use full star display
                html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                            " style=\"width:" + (imgwidth - width) + "px;" + 
                                     "height:" + imgheight + "px;" +
                                     "background:url('img/starsnone.png');\"" +
                            " title=\"" + rat.title + "\"" + 
                            " alt=\"" + rat.title + "\"/>"; } }
        else if(!imgclassname) { //some horizontal spacing...
            html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                        " style=\"width:10px;height:" + imgheight + "px;\"/>"; }
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


    reviewTypeSelectOptionsHTML = function (revrefs) {
        var i, typename, greyed, html = "";
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            greyed = false;
            if(revrefs) {
                if(!revrefs[typename] || revrefs[typename].length === 0) {
                    greyed = true; } }
            html += "<option value=\"" + typename + "\"";
            if(greyed) {
                html += " disabled=\"disabled\""; }
            html += ">" + reviewTypes[i].plural.capitalize() + "</option>"; }
        return html;
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


    reviewLinkHTML = function () {
        var html = "<a href=\"#Write a Review\"" +
                     " title=\"Review something\"" +
                     " onclick=\"mor.review.reset(true);return false;\"" +
            ">Write a Review</a>";
        return html;
    },


    writeNavDisplay = function () {
        var html = reviewLinkHTML();
        if(mor.byId('revhdiv')) {
            mor.out('revhdiv', html);
            mor.byId('revhdiv').style.visibility = "visible"; }
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
        //netflix odata catalog retired 08apr, all calls return 404
        //else if(url.indexOf(".netflix.") > 0) {
        //    require([ "ext/netflix" ], callfunc); }
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
        if(!mor.byId('cmain')) {
            mor.layout.initContent(); }
        mor.out('cmain', html);
        mor.byId('urlin').focus();
        mor.layout.adjust();
    },


    //there must be a review instance ID for the server to find the
    //associated review for the image.  The review does NOT need to be
    //up to date with the latest fields, that's handled during the main
    //save processing.
    picUploadForm = function () {
        var odiv, html = "", revid = mor.instId(crev);
        if(!revid) {
            return mor.review.save(false, "uploadpic"); }
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + revid + "\"/>";
        html += "<input type=\"hidden\" name=\"penid\" value=\"" +
            crev.penid + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#revedit=" + revid) + "\"/>";
        //build the rest of the form around that
        html = "<form action=\"/revpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            "<div id=\"closeline\">" +
              "<a id=\"closedlg\" href=\"#close\"" +
                " onclick=\"mor.cancelPicUpload();return false\">" + 
                  "&lt;close&nbsp;&nbsp;X&gt;</a>" +
            "</div>" + 
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
        var html;
        if(!fieldname) {
            fieldname = ""; }
        html = fieldname.capitalize();
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
        var html = "", i, field, fval, fsize = 25;
        if(!keyval) {
            return html; }
        html += "<table>";
        if(mode === "edit" && type.subkey) {
            field = type.subkey;
            fval = review[type.subkey] || "";
            html += "<tr>" +
                "<td id=\"subkeyinlabeltd\">" + 
                  "<span class=\"secondaryfield\">" +
                    field.capitalize() + "</span></td>" +
                "<td align=\"left\">" + 
                  "<input type=\"text\" id=\"subkeyin\"" + 
                        " size=\"" + fsize + "\"" +
                        " value=\"" + fval + "\"/></td>" +
                "</tr>"; }
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
                              " size=\"" + fsize + "\"" +
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
                        " value=\"" + mor.safestr(review.keywords) + "\"/>"; }
        else { //not editing
            html += "<div class=\"csvstrdiv\">" + 
                mor.safestr(review.keywords) + "</div>"; }
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
        var staticurl, html = "";
        //user just chose type for editing
        if(!keyval) {
            mor.onescapefunc = mor.review.reset;
            html += "<button type=\"button\" id=\"cancelbutton\"" +
                " onclick=\"mor.review.reset(true);return false;\"" +
                ">Cancel</button>" + 
                "&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.validate();return false;\"" +
                ">Create Review</button>"; }
        //have key fields and editing full review
        else if(mode === "edit") {
            html += "<button type=\"button\" id=\"cancelbutton\"" +
                " onclick=\"mor.review.reset();return false;\"" +
                ">Cancel</button>" + 
                "&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                " onclick=\"mor.review.save(true,'');return false;\"" +
                ">Save</button>&nbsp;";
            if(keyval) {  //have at least minimally complete review..
                html += "<button type=\"button\" id=\"donebutton\"" +
                    " onclick=\"mor.review.save(true,'runServices');" + 
                               "return false;\"" +
                    ">Save and Share</button>"; } }
        //reading a previously written review
        else if(review.penid === mor.pen.currPenId()) {  //is review owner
            staticurl = "statrev/" + mor.instId(review);
            html += "<button type=\"button\" id=\"deletebutton\"" +
                " onclick=\"mor.review.delrev();return false;\"" +
                ">Delete</button>" + "&nbsp;" + 
                "<button type=\"button\" id=\"editbutton\"" +
                " onclick=\"mor.review.display();return false;\"" +
                ">Edit</button>" +  "&nbsp;" + 
                "<button type=\"button\" id=\"sharebutton\"" +
                " onclick=\"mor.review.share();return false;\"" +
                ">Share</button>" + "&nbsp;&nbsp;" +
                "<a href=\"" + staticurl + "\" class=\"permalink\"" +
                  " onclick=\"window.open('" + staticurl + "');" + 
                             "return false;\"" +
                ">permalink</a>"; }
        //reading a review written by someone else, matches statrev.py
        else {
            html += "<div id=\"statrevactdiv\">" +
              "<table class=\"statnoticeactlinktable\"><tr>" +
                "<td><div class=\"statnoticeactlinkdiv\">" +
                  "<a href=\"#respond\" id=\"respondbutton\"" +
                    " onclick=\"mor.review.respond();return false;\"" +
                  ">Edit your corresponding review</a>" + 
                  "</div></td>" +
                "<td><div class=\"statnoticeactlinkdiv\">" +
                  "<a href=\"#remember\" id=\"memobutton\"";
            if(isRemembered(pen, review)) {
                html += " onclick=\"mor.review.memo(true);return false;\"" +
                    ">Stop remembering this review</a>"; }
            else {
                html += " onclick=\"mor.review.memo();return false;\"" +
                    ">Remember this review</a>"; }
            html += "</div></td></tr></table></div>"; }
        //space for save status messages underneath buttons
        html += "<br/><div id=\"revsavemsg\"></div>";
        return html;
    },


    revFormIdentHTML = function (review, type, keyval, mode) {
        var html = "", onchange, fval;
        //labels for first line if editing
        if(mode === "edit") {
            html += "<tr>" +
                "<td id=\"starslabeltd\"></td>" +
                "<td id=\"keyinlabeltd\">" + 
                    formFieldLabelContents(type.keyprompt) + "</td>" +
                "<td>" +
                    formFieldLabelContents(keyval? "url" : type.subkey) +
                "</td>" +
              "</tr>"; }
        //first line of actual content
        html += "<tr><td id=\"starstd\">";
        if(keyval) {
            html += "<span id=\"stardisp\">" + 
                  starsImageHTML(review.rating, mode === "edit") + 
                "</span>"; }
        html += "&nbsp;" + badgeImageHTML(type) + "</td>";
        if(mode === "edit") {
            onchange = "mor.review.validate();return false;";
            if(type.subkey) {
                onchange = "mor.byId('subkeyin').focus();return false;"; }
            fval = review[type.key] || "";
            html += "<td><input type=\"text\" id=\"keyin\" size=\"30\"" +
                              " onchange=\"" + onchange + "\"" + 
                              " value=\"" + fval + "\"></td>";
            if(keyval) {  //key fields have been specified
                fval = review.url || "";
                html += "<td><input type=\"text\" id=\"urlin\"" + 
                                  " size=\"30\"" +
                                  " value=\"" + fval + "\"/></td>"; }
            else if(type.subkey) {
                onchange = "mor.review.validate();return false;";
                fval = review[type.subkey] || "";
                html += "<td id=\"subkeyinlabeltd\">" + 
                    "<input type=\"text\" id=\"subkeyin\"" + 
                                 " size=\"30\"" + 
                                 " onchange=\"" + onchange + "\"" +
                                 " value=\"" + fval + "\"/></td>"; } }
        else {  //not editing, read only display
            fval = review[type.key] || "";
            html += "<td>" + 
                "<span class=\"revtitle\">" + fval + "</span></td>";
            if(type.subkey) {
                fval = review[type.subkey] || "";
                html += "<td><span class=\"revauthor\">" + 
                    fval + "</span></td>"; }
            if("url" !== type.key && "url" !== type.subkey) {
                fval = review.url || "";
                html += "<td>" + graphicAbbrevSiteLink(fval) + "</td>"; } }
        html += "</tr>";
        return html;
    },


    //return a good width for a text entry area
    textTargetWidth = function () {
        var targetwidth = Math.max((mor.winw - 350), 200);
        targetwidth = Math.min(targetwidth, 750);
        return targetwidth;
    },


    //This should have a similar look and feel to the shoutout display
    revFormTextHTML = function (review, type, keyval, mode) {
        var html, fval, style, targetwidth, placetext;
        html = "<tr><td colspan=\"4\">";
        if(keyval) {  //have the basics so display text area
            fval = review.text || "";
            targetwidth = textTargetWidth();
            style = "color:" + mor.colors.text + ";" +
                "background-color:" + mor.skinner.lightbg() + ";" +
                "width:" + targetwidth + "px;";
            if(mode === "edit") {
                style += "height:100px;";
                placetext = ">>What was the most striking thing" + 
                    " about this for you?";
                html += "<textarea id=\"reviewtext\" class=\"shoutout\"" + 
                                 " placeholder=\"" + placetext + "\"" +
                                 " style=\"" + style + "\">" +
                    fval + "</textarea>"; }
            else {
                style += "height:100px;overflow:auto;" + 
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


    starDisplayAdjust = function (event, roundup) {
        var span, spanloc, evtx, relx, sval, html;
        span = mor.byId('stardisp');
        spanloc = mor.dojo.domgeo.position(span);
        evtx = event.pageX;
        if(event.changedTouches && event.changedTouches[0]) {
            //ATTENTION: if the display is zoomed on a phone, then the
            //coordinates may need to be adjusted here.
            evtx = event.changedTouches[0].pageX; }
        relx = Math.max(evtx - spanloc.x, 0);
        sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //mor.out('keyinlabeltd', "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = starRating(sval, true).value; }
        crev.rating = sval;
        html = starsImageHTML(crev.rating, true);
        mor.out('stardisp', html);
    },


    starPointing = function (event) {
        //mor.out('keyinlabeltd', "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    },


    starStopPointing = function (event) {
        //mor.out('keyinlabeltd', "star NOT pointing" + event.target);  //debug
        //mor.out('starslabeltd', " " + event.pageX + ", " + event.pageY); //"
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, evtx, evty;
        td = mor.byId('starstd');
        tdpos = mor.dojo.domgeo.position(td);
        evtx = event.pageX;
        evty = event.pageY;
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = event.changedTouches[0].pageX;
            evty = event.changedTouches[0].pageY; }
        //mor.out('starslabeltd', " " + evtx + ", " + evty);  //debug
        if(evtx < tdpos.x || evtx > tdpos.x + tdpos.w ||
           evty < tdpos.y || evty > tdpos.y + tdpos.h) {
            //mor.out('keyinlabeltd', "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    },


    starPointAdjust = function (event) {
        if(starPointingActive) {
            //mor.out('keyinlabeltd', "star point adjust...");  //debug
            starDisplayAdjust(event); }
    },


    starClick = function (event) {
        starDisplayAdjust(event, true);
    },


    displayCorrespondingReviewInfo = function (pen, review) {
        var imghtml, html = "Create your corresponding review";
        if(review) {
            imghtml = starsImageHTML(review.rating, false, "inlinestarsimg");
            html = "Edit your " + imghtml + " review"; }
        mor.out('respondbutton', html);
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
        var params, i, t20;
        if(homepen.top20s) {
            t20 = homepen.top20s[crev.revtype];
            if(t20 && t20.length) {
                for(i = 0; i < t20.length; i += 1) {
                    if(t20[i].cankey === crev.cankey && 
                       t20[i].revtype === crev.revtype) {
                        return contfunc(homepen, t20[i]); } } } }
        params = "penid=" + mor.instId(homepen) + 
            "&revtype=" + crev.revtype + "&cankey=" + crev.cankey +
            "&" + mor.login.authparams();
        mor.call("revbykey?" + params, 'GET', null,
                 function (revs) {
                     var rev = null;
                     if(revs.length > 0) {
                         rev = revs[0]; }
                     contfunc(homepen, rev); },
                 function (code, errtxt) {
                     mor.err("findCorrespondingReview failed " + code + 
                             " " + errtxt); });
    },


    //ATTENTION: Somewhere in the read display, show a count of how
    //many response reviews have been written, and how many people
    //have remembered the review.  Provided there's more than zero.
    displayReviewForm = function (pen, review, mode) {
        var twidth, html, type, keyval;
        type = findReviewType(review.revtype);
        keyval = review[type.key];
        twidth = textTargetWidth() + 100;
        html = "<div class=\"formstyle\" style=\"width:" + twidth + "px;\">" + 
            "<table class=\"revdisptable\" border=\"0\">";
        if(mode === "edit" && attribution) {
            html += "<tr><td colspan=\"4\">" + 
                "<div id=\"attributiondiv\">" + attribution + 
                "</div></td></tr>"; }
        html += revFormIdentHTML(review, type, keyval, mode);
        html += revFormTextHTML(review, type, keyval, mode);
        html += revFormDetailHTML(review, type, keyval, mode);
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
        if(!mor.byId('cmain')) {
            mor.layout.initContent(); }
        mor.out('cmain', html);
        if(mode === "edit") {
            mor.onx('mousedown',   'starstd', starPointing);
            mor.onx('mouseup',     'starstd', starStopPointing);
            mor.onx('mouseout',    'starstd', starStopPointingBoundary);
            mor.onx('mousemove',   'starstd', starPointAdjust);
            mor.onx('click',       'starstd', starClick);
            mor.onx('touchstart',  'starstd', starPointing);
            mor.onx('touchend',    'starstd', starStopPointing);
            mor.onx('touchcancel', 'starstd', starStopPointing);
            mor.onx('touchmove',   'starstd', starPointAdjust);
            if(!keyval) {
                mor.byId('keyin').focus(); }
            else if(mor.byId('subkeyin')) {
                mor.byId('subkeyin').focus(); }
            else {
                mor.byId('reviewtext').focus(); } }
        mor.layout.adjust();
        if(mor.byId('respondbutton')) {
            mor.pen.getPen(function (pen) {
                findCorrespondingReview(pen, displayCorrespondingReviewInfo); 
            }); }
    },


    //The field value onchange and the cancel button battle it out to
    //see whose event gets processed.  On Mac10.8.3/FF19.0.2 onchange
    //goes first, and if it hogs processing then cancel never gets
    //called.  Have to use a timeout so cancel has a shot, and short
    //timeout values (< 200) won't work consistently.
    fullEditDisplayTimeout = null,
    validateAndContinue = function () {
        fullEditDisplayTimeout = setTimeout(function () {
            var i, errtxt = "", errors = [], type;
            fullEditDisplayTimeout = null;
            type = findReviewType(crev.revtype);
            if(type) {
                keyFieldsValid(type, errors);
                if(errors.length > 0) {
                    for(i = 0; i < errors.length; i += 1) {
                        errtxt += errors[i] + "<br/>"; }
                    mor.out('revsavemsg', errtxt);
                    return; } }
            mor.review.display(); }, 400);
    },


    cancelReview = function (force) {
        mor.onescapefunc = null; 
        if(fullEditDisplayTimeout) {
            clearTimeout(fullEditDisplayTimeout);
            fullEditDisplayTimeout = null; }
        if(force || !crev || !mor.instId(crev)) {
            crev = {};                    //so clear it all out 
            mor.review.display(); }       //and restart
        else {
            mor.review.displayRead(); }
    },


    saveReview = function (doneEditing, actionstr) {
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
                         mor.review.displayRead(actionstr); }
                     else {
                         mor.review.display(actionstr); } },
                 function (code, errtxt) {
                     asyncSaveErrTxt = "Save failed code: " + code + " " +
                         errtxt;
                     mor.review.display(); });
    },


    initWithId = function (revid, mode, action) {
        var params = "revid=" + revid;
        mor.call("revbyid?" + params, 'GET', null,
                 function (revs) {
                     if(revs.length > 0) {
                         crev = revs[0];
                         if(mode === "edit") {
                             mor.review.display(); }
                         else {
                             mor.review.displayRead(action); } }
                     else {
                         mor.err("initWithId found no review id " + revid); } },
                 function (code, errtxt) {
                     mor.err("initWithId failed code " + code + ": " +
                             errtxt); });
    },


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given review.
    copyAndEdit = function (pen, review) {
        if(!review) {
            review = {};
            review.srcrev = mor.instId(crev); }
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
        //always remove.  When adding this will prevent duplicates
        idx = pen.revmem.remembered.indexOf(revid);
        while(idx >= 0) {
            pen.revmem.remembered.splice(idx, 1);
            idx = pen.revmem.remembered.indexOf(revid); }
        if(!remove) { //prepend to remembered, most recent first
            pen.revmem.remembered.unshift(revid);
            mor.activity.cacheReview(crev); }
        mor.pen.updatePen(pen, 
                          function (pen) {
                              mor.review.displayRead(); },  //no runServices
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
                     var html = "<p>Review deleted.  If this review was one" +
                         " of your top 20 best, then you may see an id" +
                         " reference message until the next time you review" +
                         " something.  Recalculating your recent reviews..." +
                         "</p>";
                     mor.out('cmain', html);
                     setTimeout(function () {
                         mor.profile.resetReviews();
                         mor.profile.display(); }, 12000); },
                 function (code, errtxt) {
                     mor.err("Delete failed code: " + code + " " + errtxt);
                     mor.profile.display(); });
    },


    mainDisplay = function (pen, read, action) {
        if(!crev) {
            crev = {}; }
        if(!crev.penid) {
            crev.penid = mor.pen.currPenId(); }
        setTimeout(function () {  //refresh headings
            if(crev.penid !== mor.instId(pen)) { 
                mor.profile.retrievePen(crev.penid, function(revpen) {
                    mor.profile.writeNavDisplay(pen, revpen);
                }); }
            else {
                mor.profile.writeNavDisplay(pen); }
            }, 50);
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(pen, crev);
            if(action === "runServices") {
                mor.services.run(pen, crev); }
            else if(action === "remember") {
                mor.review.memo(); }
            else if(action === "respond") {
                mor.review.respond(); } }
        else if(!findReviewType(crev.revtype)) {
            displayTypeSelect(); }
        else if(action === "uploadpic") {
            displayReviewForm(pen, crev, "edit");
            picUploadForm(); }
        else {
            displayReviewForm(pen, crev, "edit"); }
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function (action) {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, false, action); 
            }); },
        displayRead: function (action) {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, true, action); 
            }); },
        delrev: function () {
            deleteReview(); },
        reviewLinkHTML: function () {
            return reviewLinkHTML(); },
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
        reviewTypeSelectOptionsHTML: function (revrefs) {
            return reviewTypeSelectOptionsHTML(revrefs); },
        badgeImageHTML: function (type) {
            return badgeImageHTML(type); },
        starsImageHTML: function (rating, showblank) {
            return starsImageHTML(rating, showblank); },
        readURL: function (url, params) {
            return readURL(url, params); },
        setType: function (type) {
            return setType(type); },
        picUploadForm: function () {
            picUploadForm(); },
        toggleKeyword: function (kwid) {
            toggleKeyword(kwid); },
        reset: function (force) {
            cancelReview(force); },
        validate: function () {
            validateAndContinue(); },
        save: function (doneEditing, actionstr) {
            saveReview(doneEditing, actionstr); },
        share: function () {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, true, "runServices"); }); },
        setCurrentReview: function (revobj) {
            crev = revobj; },
        getCurrentReview: function () {
            return crev; },
        initWithId: function (revid, mode, action) {
            initWithId(revid, mode, action); },
        respond: function () {
            mor.pen.getPen(function (pen) {
                findCorrespondingReview(pen, copyAndEdit); }); },
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


