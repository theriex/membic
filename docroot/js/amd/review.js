/*global define: false, alert: false, console: false, setTimeout: false, clearTimeout: false, window: false, document: false, history: false, mor: false, require: false, google: false */

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
        //If changing the width or height of the stars img, also change
        //mor.css .revtextsummary and corresponding function in statrev.py
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
            dkwords: [ "Breakfast", "Brunch", "Lunch", "Dinner", "Late Night", 
                       "Snack", "Inexpensive", "Expensive", "Fast", "Slow", 
                       "Outdoor", "Quiet", "Loud" ] },
          { type: "drink", plural: "drinks", img: "TypeDrink50.png",
            keyprompt: "Name and where from",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Traditional", "Innovative", "Inexpensive", "Expensive",
                       "Essential", "Special", "Quiet", "Loud", "Outdoor" ] },
          { type: "activity", plural: "activities", img: "TypeActivity50.png",
            keyprompt: "Name of activity, place, or event",
            key: "name", //subkey
            fields: [ "address" ],
            dkwords: [ "Indoor", "Outdoor", "Educational", "Artistic", 
                       "Kid Ok", "Inexpensive", "Expensive" ] },
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
        attribution = "";
    },


    starRating = function (rating, roundup) {
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


    //rating is a value from 0 - 100.  Using Math.round to adjust values
    //results in 1px graphic hiccups as the rounding switches, and ceil
    //has similar issues coming off zero, so use floor.
    starsImageHTML = function (rating, showblank, imgclassname) {
        var imgfile = "img/stars18ptC.png", greyfile = "img/stars18ptCg.png",
            width, offset, rat, html,
            cname = imgclassname || "starsimg";
        rat = starRating(rating);
        width = Math.floor(rat.step * (starimgw / rat.maxstep));
        html = "";
        //add left padding for right justified star display:
        //if(!showblank && !imgclassname) {
        //    html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
        //                " style=\"width:" + (starimgw - width) + "px;" +
        //                         "height:" + starimgh + "px;\"/>"; }
        html += "<img id=\"fillstarsimg\" class=\"" + cname + "\"" + 
                    " src=\"img/blank.png\"" +
                    " style=\"width:" + width + "px;" + 
                             "height:" + starimgh + "px;" +
                             "background:url('" + imgfile + "');\"" +
                    " title=\"" + rat.title + "\" alt=\"" + rat.title + "\"/>";
        if(showblank) {
            if(rat.step % 2 === 1) {  //odd, use half star display
                offset = Math.floor(starimgw / rat.maxstep);
                html += "<img id=\"greystarsimg\" class=\"" + cname + "\"" + 
                            " src=\"img/blank.png\"" +
                            " style=\"width:" + (starimgw - width) + "px;" + 
                                     "height:" + starimgh + "px;" +
                                     "background:url('" + greyfile + "')" +
                                                " -" + offset + "px 0;\"" +
                            " title=\"" + rat.title + "\"" + 
                            " alt=\"" + rat.title + "\"/>"; }
            else { //even, use full star display
                html += "<img id=\"greystarsimg\" class=\"" + cname + "\"" + 
                            " src=\"img/blank.png\"" +
                            " style=\"width:" + (starimgw - width) + "px;" + 
                                     "height:" + starimgh + "px;" +
                                     "background:url('" + greyfile + "');\"" +
                            " title=\"" + rat.title + "\"" + 
                            " alt=\"" + rat.title + "\"/>"; } }
        else if(!imgclassname) { //add right padding for left justified stars
            html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                        " style=\"width:" + (starimgw - width) + "px;" +
                                 "height:" + starimgh + "px;\"/>";
            html += "<img class=\"" + cname + "\" src=\"img/blank.png\"" +
                        " style=\"width:10px;height:" + starimgh + "px;\"/>"; }
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
                    label = "<span style=\"color:#999999;\">" + label + 
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


    reviewTypeCheckboxesHTML = function (cboxgroup, chgfstr) {
        return revTypeChoiceHTML("checkbox", cboxgroup, "", chgfstr);
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
        var html = "<div class=\"topnavitemdiv\">" +
            mor.imgntxt("writereview.png", "Write a Review",
                        "mor.review.reset(true)",
                        "#Write", 
                        "Write a review") +
            "</div>";
        return html;
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
        html = "<span style=\"background:url('img/" + fieldimages[field] + 
                                            "') no-repeat center center;" +
                            " height:15px; width:22px;" +
                            " display:inline-block;" + 
                            " text-align:center;\"" +
                    " title=\"" + len + " " + field + "\"" +
            ">" + len + "</span>";
        return html;
    },


    linkCountHTML = function (revid) {
        var revref, html;
        revref = mor.lcs.getRevRef(revid);
        if(!revref.revlink) {
            return ""; }
        html = linkCountBadgeHTML(revref.revlink, 'helpful') +
            linkCountBadgeHTML(revref.revlink, 'remembered') +
            linkCountBadgeHTML(revref.revlink, 'corresponding');
        if(html) {
            html = "&nbsp;" + html; }
        return html;
    },


    writeNavDisplay = function () {
        return true;
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
        if(url.indexOf(".amazon.") > 0) {
            require([ "ext/amazon" ], callfunc); }
        //The API calls die all the time, so going with standard tags
        //else if(url.indexOf(".youtube.") > 0) {
        //    require([ "ext/youtube" ], callfunc); }
        //netflix odata catalog retired 08apr, all calls return 404
        //else if(url.indexOf(".netflix.") > 0) {
        //    require([ "ext/netflix" ], callfunc); }
        else {
            require([ "ext/readurl" ], callfunc); }
    },


    reviewTextValid = function (type, errors) {
        var input = mor.byId('reviewtext');
        if(input) {
            crev.text = input.value; }
    },


    //This is the main processing entry point from the bookmarklet or
    //direct links.
    readURL = function (url, params) {
        var urlin, errs = [], rbc;
        if(!params) {
            params = {}; }
        if(!url) {
            urlin = mor.byId('urlin');
            if(urlin) {
                url = urlin.value; } }
        reviewTextValid(crev.revtype, errs);
        if(!url || errs.length > 0) {
            return; }
        rbc = mor.byId('readurlbuttoncontainer');
        if(rbc) {
            rbc.innerHTML = "reading..."; }
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
        var i, tdc = 0, captype, html;
        html = "<div id=\"revfdiv\" class=\"formstyle\" align=\"center\">" +
            "<div id=\"formrejustifydiv\" class=\"centertablediv\">" +
              "<ul class=\"reviewformul\">";
        //type selection
        html += "<li><table border=\"0\"><tr><td colspan=\"4\">" + 
            "<div class=\"bigoverlabel\">" + 
              "Choose a review type</div></td></tr>";
        for(i = 0; i < reviewTypes.length; i += 1) {
            if(tdc === 0) {
                html += "<tr>"; }
            captype = reviewTypes[i].type.capitalize();
            html += "<td><div class=\"revtypeselectiondiv\">" + 
                mor.imgntxt(reviewTypes[i].img, captype,
                            "mor.review.setType('" + reviewTypes[i].type + "')",
                            "#" + captype,
                            "Create a " + reviewTypes[i].type + " review") + 
                "</div></td>";
            tdc += 1;
            if(tdc === 4 || i === reviewTypes.length -1) {
                html += "</tr>";
                tdc = 0; } }
        html += "</table></li>";
        //url paste and read
        if(autourl) {
            html += "<li><a href=\"" + autourl + "\">" + autourl + 
                "</a></li>"; }
        else {
            html += "<li><table border=\"0\"><tr><td colspan=\"2\">" + 
                "<div class=\"bigoverlabel\">" + 
                  "or paste a web address to read information from" + 
                "</div></td></tr><tr>" +
                "<td align=\"right\">URL</td>" +
                "<td align=\"left\">" +
                  "<input type=\"text\" id=\"urlin\" size=\"40\"" +
                        " onchange=\"mor.review.readURL();return false;\"" + 
                    "/>&nbsp;" +
                "<span id=\"readurlbuttoncontainer\">" +
                  "<button type=\"button\" id=\"readurlbutton\"" +
                         " onclick=\"mor.review.readURL();return false;\"" +
                         " title=\"Read review form fields from pasted URL\"" +
                  ">Read</button></span>" +
                "</td>" +
              "</tr></table></li>"; }
        html += "</ul></div></div>";
        if(!mor.byId('cmain')) {
            mor.layout.initContent(); }
        mor.out('cmain', html);
        mor.byId('urlin').focus();
        mor.layout.adjust();
    },


    //There must be a review instance ID for the server to find the
    //associated review for the image.  The review does NOT need to be
    //up to date with the latest fields (that's handled during the
    //main save processing), but it needs to exist.  So if no id, then
    //save first.  However if the user has clicked the save button,
    //then clicks to upload while the save is going on, then you could
    //end up with two save AJAX calls queued up which results in a
    //duplicate review.
    picUploadForm = function () {
        var odiv, html = "", revid = mor.instId(crev);
        if(!revid) {
            html = mor.byId('revformbuttonstd').innerHTML;
            if(html.indexOf("<button") >= 0) { //not already saving
                return mor.review.save(false, "uploadpic"); }
            return; }  //already saving, just ignore the pic upload click
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
        var imgstyle, html;
        if(!keyval) {
            return ""; }
        imgstyle = "";
        if(mor.isLowFuncBrowser()) {
            imgstyle = " style=\"width:125px;height:auto;\""; }
        if(review.imguri) {  //use auto-generated link if avail. No direct edit.
            html = "<img class=\"revimg\"" + imgstyle + 
                       " src=\"" + review.imguri + "\"/>";
            if(review.url) {
                html = "<a href=\"" + review.url + "\"" + 
                         " onclick=\"window.open('" + review.url + "');" + 
                                    "return false;\">" + html + "</a>"; }
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
            html = "<img class=\"revimg\"" + imgstyle + " src=\"" + html + "\"";
            if(mode === "edit") {
                html += " title=\"Click to upload a picture\"" +
                    " onclick=mor.review.picUploadForm();return false;"; }
            html += "/>"; }
        return html;
    },


    errlabel = function (domid) {
        var elem = mor.byId(domid);
        if(elem) {
            elem.style.color = "red";
            if(elem.innerHTML.indexOf("*") < 0) {
                elem.innerHTML += "*"; } }
    },


    formFieldLabelContents = function (fieldname) {
        var html;
        if(!fieldname) {
            fieldname = ""; }
        html = fieldname.capitalize();
        if(fieldname === "url") {
            html = "<img class=\"webjump\" src=\"img/gotolink.png\"/>URL"; }
        return html;
    },


    graphicAbbrevSiteLink = function (url) {
        var html;
        if(!url) {
            return ""; }
        html = "<a href=\"" + url + "\"" + 
            " onclick=\"window.open('" + url + "');return false;\"" +
            " title=\"" + url + "\">" +
            "<img class=\"webjump\" src=\"img/gotolink.png\"/></a>";
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


    secondaryFieldsValid = function (type, errors, actionstr) {
        var input, i, txt;
        //none of the secondary fields are required, so just note the values
        for(i = 0; i < type.fields.length; i += 1) {
            input = mor.byId("field" + i);
            if(input) {  //input field was displayed
                crev[type.fields[i]] = input.value; } }
        //verify they set the rating to something.
        if(!crev.rating) {
            txt = "Please set a star rating";
            if(actionstr === "uploadpic") {
                txt += " before uploading a picture"; }
            errors.push(txt); }
    },


    toggleKeyword = function (kwid) {
        var cbox, text, keyin, keywords, i, kw;
        cbox = mor.byId(kwid);
        text = "";
        keyin = mor.byId('keywordin');
        keywords = keyin.value.split(",");
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
            html += "<td style=\"white-space:nowrap;\">" + 
                "<input type=\"checkbox\"" +
                      " name=\"dkw" + i + "\"" +
                      " id=\"dkw" + i + "\"" + 
                      " value=\"" + type.dkwords[i] + "\"" +
                      //<IE8 onchange only fires after onblur
                      " onclick=\"mor.review.toggleKeyword('dkw" + i + "');\"";
                      //do not return false or check action is nullified
            if(crev.keywords.indexOf(type.dkwords[i]) >= 0) {
                html += " checked=\"checked\""; }
            html += "/>" +
                "<label for=\"dkw" + i + "\">" + 
                  type.dkwords[i] + "</label>" +
                "</td>";
            tdc += 1;
            if(tdc === 3 || i === type.dkwords.length - 1) {
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
                "<span class=\"secondaryfield\">Keywords</span> " +
                  "<input type=\"text\" id=\"keywordin\"" + 
                        " size=\"30\"" + 
                        " value=\"" + mor.safestr(review.keywords) + "\"/>"; }
        else { //not editing
            if(mor.safestr(review.keywords)) {
                html += "<div class=\"csvstrdiv\">" +
                    "<span class=\"secondaryfield\">Keywords</span> " +
                    mor.safestr(review.keywords) + "</div>"; } }
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
                    ">Fetch review data from URL</a>&nbsp;&nbsp;&nbsp;"; }
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
        var errs = [];
        reviewTextValid(crev.revtype, errs);
        crev.revtype = typeval;
        mor.review.display();
    },


    removeImageLink = function () {
        crev.imguri = "";
        mor.review.display();
    },


    reviewLinkActionHTML = function (activebuttons) {
        var html = "<div id=\"socialrevactdiv\">" +
            "<table class=\"socialrevacttable\" border=\"0\"><tr>";
        if(activebuttons) {
            //helpful button. init unchecked then update after lookup
            html += "<td><div id=\"helpfulbutton\" class=\"buttondiv\">" +
                mor.imgntxt("helpfulq.png",
                            "Helpful",
                            "mor.review.helpful()", "#helpful",
                            "Mark this review as helpful", "", "helpful") +
                "</div></td>";
            //remember button. init unchecked and then update after lookup
            html += "<td><div id=\"memobutton\" class=\"buttondiv\">" +
                mor.imgntxt("rememberq.png",
                            "Remember",
                            "mor.review.memo()", "#memo",
                            "Add this to remembered reviews", "", "memo") +
                "</div></td>";
            //respond button
            html += "<td><div id=\"respondbutton\" class=\"buttondiv\">" +
                  //this contents is rewritten after looking up their review
                  mor.imgntxt("writereview.png",
                              "Your review",
                              "mor.review.respond()", "#respond",
                              "Edit your corresponding review", "", "respond") +
                "</div></td>"; }
        else {  //just place markers, no link actions if it's your own review
            html += "<td><img class=\"shareicodis\"" + 
                            " src=\"img/helpful.png\"" +
                            " border=\"0\"/></td>" +
                    "<td><img class=\"shareicodis\"" + 
                            " src=\"img/remembered.png\"" +
                            " border=\"0\"/></td>" +
                    "<td><img class=\"shareicodis\"" + 
                            " src=\"img/writereview.png\"" +
                            " border=\"0\"/></td>"; }
        html += "</tr><tr>" +
            "<td><div id=\"hlinksdiv\" class=\"linksdiv\"></div></td>" +
            "<td><div id=\"rlinksdiv\" class=\"linksdiv\"></div></td>" +
            "<td><div id=\"clinksdiv\" class=\"linksdiv\"></div></td>";
        html += "</tr></table></div>";
        return html;
    },


    //ATTENTION: Once review responses are available, there needs to
    //be a way to view those responses as a list so you can see what
    //other people thought of the same thing or what kind of an impact
    //you are having.  This is a good way to find other pen names to
    //follow, and a response review is how you communicate about
    //things on MyOpenReviews.  "Like", "+1" and general chatter
    //is best handled via integration with general social networks.
    reviewFormButtonsHTML = function (pen, review, type, keyval, mode) {
        var staticurl, html;
        //user just chose type for editing
        if(!keyval) {
            mor.onescapefunc = mor.review.reset;
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"cancelbutton\"" +
                       " onclick=\"mor.review.reset(true);return false;\"" +
                ">Cancel</button>&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                       " onclick=\"mor.review.validate();return false;\"" +
                ">Create Review</button></div>"; }
        //have key fields and editing full review
        else if(mode === "edit") {
            mor.onescapefunc = mor.review.reset;
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"cancelbutton\"" +
                       " onclick=\"mor.review.reset(" + 
                               (mor.instId(review)? "false" : "true") +
                                                  ");return false;\"" +
                    ">Cancel</button>&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                       " onclick=\"mor.review.save(true,'');return false;\"" +
                    ">Save</button>&nbsp;" +
                "</div>"; }
        //reading a previously written review
        else if(review.penid === mor.pen.currPenId()) {  //is review owner
            mor.onescapefunc = null;
            staticurl = "statrev/" + mor.instId(review);
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"deletebutton\"" +
                       " onclick=\"mor.review.delrev();return false;\"" +
                ">Delete</button>&nbsp;" + 
                "<button type=\"button\" id=\"editbutton\"" +
                       " onclick=\"mor.review.display();return false;\"" +
                ">Edit</button>&nbsp;&nbsp;" + 
                "<a href=\"" + staticurl + "\" class=\"permalink\"" +
                  " onclick=\"window.open('" + staticurl + "');" + 
                             "return false;\"" +
                ">permalink</a></div>" + 
                "<div id=\"sharediv\">" +
                  "<div id=\"sharebuttonsdiv\"></div>" +
                  "<div id=\"sharemsgdiv\"></div>" +
                "</div>" +
                reviewLinkActionHTML(false); }
        //reading a review written by someone else, show review link actions
        else {
            html = reviewLinkActionHTML(true); }
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
        html = "<tr><td colspan=\"4\" class=\"textareatd\">";
        if(keyval) {  //have the basics so display text area
            fval = review.text || "";
            targetwidth = textTargetWidth();
            style = "color:" + mor.colors.text + ";" +
                "background-color:" + mor.skinner.lightbg() + ";" +
                "width:" + targetwidth + "px;" +
                "height:100px;padding:2px 5px;";
            if(mode === "edit") {
                //margin:auto does not work for a textarea
                style += "margin-left:50px;";   //displayReviewForm 100/2
                placetext = ">>What was the most striking thing" + 
                    " about this for you?";
                html += "<textarea id=\"reviewtext\" class=\"shoutout\"" + 
                                 " placeholder=\"" + placetext + "\"" +
                                 " style=\"" + style + "\">" +
                    fval + "</textarea>"; }
            else {
                fval = fval || "No comment";
                style += "border:1px solid " + mor.skinner.darkbg() + ";" +
                    "overflow:auto;margin:auto";
                html += "<div id=\"reviewtext\" class=\"shoutout\"" +
                            " style=\"" + style + "\">" + 
                    mor.linkify(fval) + "</div>"; } }
        else {  //keyval for review not set yet, provide autocomplete area
            html += "<div id=\"revautodiv\" class=\"autocomplete\"" + 
                        " style=\"width:" + targetwidth + "px;\"" +
                "> </div>"; }
        html += "</td></tr>";
        return html;
    },


    //pic, keywords, secondary fields
    revFormDetailHTML = function (review, type, keyval, mode) {
        var html = "<tr>" +
            "<td align=\"right\" rowspan=\"3\" valign=\"top\">" + 
                picHTML(review, type, keyval, mode) + "</td>" +
            //use a subtable to avoid skew from really long titles
            "<td colspan=\"2\">" +
              "<table class=\"subtable\" border=\"0\" width=\"100%\"><tr>" + 
                "<td valign=\"top\">" + 
                    secondaryFieldsHTML(review, type, keyval, mode) + "</td>" +
                "<td valign=\"top\">" + 
                    keywordsHTML(review, type, keyval, mode) + "</td>" +
                "</tr></table>" +
              "</td>" +
            "</tr>";
        return html;
    },


    //Return sensible element position info and x,y coordinates
    //relative to that position for event handling.  Normally
    //dojo.domgeo.position combined with pageX/Y event coordinates
    //works just fine, but IE8 has no event.pageX,
    //clientHeight/Left/Top/Width are always zero, and event.x/y are
    //the same values as event.clientX/Y.
    //    pageX: relative to top left of fully rendered content 
    //    screenX: relative to top left of physical screen 
    //    clientX: relative to the top left of browser window
    geoPos = function (event, domelem, pos) {
        if(!event || event.pageX) {
            return mor.dojo.domgeo.position(domelem); }
        if(!pos) {
            pos = { h: domelem.offsetHeight, 
                    w: domelem.offsetWidth, 
                    x: 0, 
                    y: 0 }; }
        pos.x += domelem.offsetLeft;
        pos.y += domelem.offsetTop;
        if(domelem.offsetParent) {
            return geoPos(event, domelem.offsetParent, pos); }
        return pos;
    },
    geoXY = function (event) {
        var pos;
        if(event.pageX) {
            return { x: event.pageX, y: event.pageY }; }
        pos = { h: -1, w: -1, x: event.offsetX, y: event.offsetY };
        pos = geoPos(event, event.srcElement, pos);
        if(!pos) {
            pos = { x: event.offsetX, y: event.offsetY }; }
        return pos;
    },


    starDisplayAdjust = function (event, roundup) {
        var span, spanloc, evtx, relx, sval, html;
        span = mor.byId('stardisp');
        spanloc = geoPos(event, span);
        evtx = geoXY(event).x;
        //mor.out('keyinlabeltd', "starDisplayAdjust evtx: " + evtx);  //debug
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = geoXY(event.changedTouches[0]).x; }
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
        //var pos = geoXY(event);  //debug
        //mor.out('keyinlabeltd', "star NOT pointing" + event.target);  //debug
        //mor.out('starslabeltd', " " + pos.x + ", " + pos.y);  //debug
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, xypos, evtx, evty;
        td = mor.byId('starstd');
        tdpos = geoPos(event, td);
        xypos = geoXY(event);
        evtx = xypos.x;
        evty = xypos.y;
        if(event.changedTouches && event.changedTouches[0]) {
            xypos = geoXY(event.changedTouches[0]);
            evtx = xypos.x;
            evty = xypos.y; }
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


    writeAutocompLinks = function (xml) {
        var itemdat, url, attrs, title, html = "<ul>";
        itemdat = xmlExtract("Item", xml);
        while(itemdat) {
            url = xmlExtract("DetailPageURL", itemdat.content);
            url = url.content || "";
            attrs = xmlExtract("ItemAttributes", itemdat.content);
            title = xmlExtract("Title", attrs.content);
            title = title.content || "";
            if(title) {
                if(crev.revtype === 'book') {
                    title += secondaryAttr("Author", attrs.content); }
                else if(crev.revtype === 'movie') {
                    title += secondaryAttr("ProductGroup", attrs.content); }
                else if(crev.revtype === 'music') {
                    title += secondaryAttr("Artist", attrs.content) + " " +
                        secondaryAttr("Manufacturer", attrs.content) +
                        secondaryAttr("ProductGroup", attrs.content); } }
            html += "<li><a href=\"" + url + "\"" + 
                          " onclick=\"mor.review.readURL('" + url + "');" +
                                     "return false;\"" +
                ">" + title + "</a></li>";
            itemdat = xmlExtract("Item", itemdat.remainder); }
        html += "</ul>";
        mor.out('revautodiv', html);
    },


    callAmazonForAutocomplete = function (acfunc) {
        var url, critsec = "";
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            mor.enc(autocomptxt);
        mor.call(url, 'GET', null,
                 function (json) {
                     writeAutocompLinks(mor.dec(json[0].content));
                     setTimeout(acfunc, 400);
                     mor.layout.adjust(); },
                 function (code, errtxt) {
                     mor.out('revautodiv', "");
                     mor.log("Amazon info retrieval failed code " +
                             code + ": " + errtxt);
                     setTimeout(acfunc, 400);
                     mor.layout.adjust(); },
                 critsec);
    },


    selectLocLatLng = function (latlng, ref) {
        var map;
        if(!gplacesvc && google && google.maps && google.maps.places) {
            try {
                map = new google.maps.Map(mor.byId('mapdiv'), {
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: latlng,
                    zoom: 15 });
                gplacesvc = new google.maps.places.PlacesService(map);
            } catch (problem) {
                mor.err("selectLocLatLng svc init failed: " + problem);
            } }
        if(gplacesvc && ref) {
            gplacesvc.getDetails({reference: ref},
                function (place, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        crev.address = place.formatted_address;
                        crev.name = place.name || mor.byId('keyin').value;
                        crev.url = crev.url || place.website || "";
                        readURL(crev.url); }
                    }); }
    },


    selectLocation = function (addr, ref) {
        var html;
        if(!geoc && google && google.maps && google.maps.places) {
            geoc = new google.maps.Geocoder(); }
        if(geoc && addr) {
            try {
                addr = mor.dec(addr);
                html = "<p>" + addr + "</p><div id=\"mapdiv\"></div>";
                mor.out('revautodiv', html);
                geoc.geocode({address: addr}, function (results, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        selectLocLatLng(results[0].geometry.location, ref); }
                    });
            } catch (problem) {
                mor.err("selectLocation failed: " + problem);
            } }
    },


    callGooglePlacesAutocomplete = function (acfunc) {
        if(!gautosvc && google && google.maps && google.maps.places) {
            gautosvc = new google.maps.places.AutocompleteService(); }
        if(gautosvc && autocomptxt) {
            gautosvc.getPlacePredictions({input: autocomptxt}, 
                function (results, status) {
                    var i, place, html = "<ul>";
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        for(i = 0; i < results.length; i += 1) {
                            place = results[i];
                            html += "<li><a href=\"#selectloc\"" + 
                                " onclick=\"mor.review.selectloc('" +
                                    mor.embenc(place.description) + "','" +
                                    place.reference + "');return false;\"" +
                                ">" + place.description + "</a>" +
                                "</li>"; } }
                    html += "</ul><img src=\"img/poweredbygoogle.png\"/>";
                    mor.out('revautodiv', html);
                    setTimeout(acfunc, 400);
                    mor.layout.adjust(); }); }
        else {
            setTimeout(acfunc, 400); }
    },


    autocompletion = function (event) {
        var srchtxt;
        if(mor.byId('revautodiv') && mor.byId('keyin')) {
            srchtxt = mor.byId('keyin').value;
            if(mor.byId('subkeyin')) {
                srchtxt += " " + mor.byId('subkeyin').value; }
            if(srchtxt !== autocomptxt) {
                autocomptxt = srchtxt;
                if(crev.revtype === 'book' || crev.revtype === 'movie') {
                    callAmazonForAutocomplete(autocompletion); }
                else if(crev.revtype === 'food' || crev.revtype === 'drink' ||
                        crev.revtype === 'activity') {
                    callGooglePlacesAutocomplete(autocompletion); } }
            else {
                setTimeout(autocompletion, 750); } }
    },


    displayCorrespondingReviewInfo = function (pen, review) {
        var html, imghtml, msghtml = "Your review";
        if(review) {
            setTimeout(function () {
                mor.lcs.verifyCorrespondingLinks(review, crev); }, 100);
            imghtml = starsImageHTML(review.rating, false, "inlinestarsimg");
            msghtml = "Your review: " + imghtml; }
        html = mor.imgntxt("writereview.png", msghtml,
                           "mor.review.respond()", "#respond",
                           "Edit your corresponding review", "", "respond");
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
        var params, i, t20, critsec = "";
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
                             " " + errtxt); },
                 critsec);
    },


    updateCachedReviewTags = function (field, updrevtags) {
        var i, penref, rtid, replaced;
        rtid = mor.instId(updrevtags[0]);
        penref = mor.pen.currPenRef();
        if(!penref[field]) {
            penref[field] = updrevtags; }
        else {
            for(i = 0; i < penref[field].length; i += 1) {
                if(mor.instId(penref[field][i]) === rtid) {
                    penref[field][i] = updrevtags[0];
                    replaced = true; } }
            if(!replaced) {  //must prepend if remembered
                penref[field].unshift(updrevtags[0]); } }
        if(field === "remembered") {
            //ensure helpful marks for anything remembered are found
            updateCachedReviewTags('helpful', updrevtags); }
        mor.lcs.getRevRef(updrevtags[0].revid).revlink = null;
    },


    isHelpful = function (revtag) {
        if(revtag && revtag.helpful && !revtag.nothelpful) {
            return true; }
        return false;
    },


    toggleHelpfulButton = function (value) {
        var img, tbl, data, critsec = "";
        img = mor.byId('helpfulimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = mor.byId('helpfultable');
        if(value === "set") {  //just initializing the display
            img.src = "img/helpful.png";
            tbl.title = "Remove mark as helpful";
            return; }
        img.className = "navicodis";  //grey out the image
        value = (img.src.indexOf("helpful.png") > 0)? "no" : "yes";  //toggle
        data = "penid=" + mor.instId(mor.pen.currPenRef().pen) +
            "&revid=" + mor.instId(crev) +
            "&helpful=" + value;
        mor.call("notehelpful?" + mor.login.authparams(), 'POST', data,
                 function (updatedrevtags) {
                     updateCachedReviewTags('helpful', updatedrevtags);
                     if(isHelpful(updatedrevtags[0])) {
                         img.src = "img/helpful.png";
                         tbl.title = "Remove mark as helpful"; }
                     else {
                         img.src = "img/helpfulq.png";
                         tbl.title = "Mark this review as helpful"; }
                     img.className = "navico"; },  //ungrey the image
                 function (code, errtxt) {
                     mor.err("toggleHelpfulButton failed " + code +
                             " " + errtxt); },
                 critsec);
    },


    foundHelpful = function (revid, penref) {
        var i;
        if(!penref) {
            penref = mor.pen.currPenRef(); }
        for(i = 0; penref.helpful && i < penref.helpful.length; i += 1) {
            if(penref.helpful[i].revid === revid && 
               isHelpful(penref.helpful[i])) {
                return true; } }
        return false;
    },


    loadHelpful = function (callback, penref) {
        var params, critsec = "";
        if(!penref) {
            penref = mor.pen.currPenRef(); }
        params = "penid=" + mor.instId(penref.pen) + 
            "&" + mor.login.authparams();
        mor.call("srchhelpful?" + params, 'GET', null,
                 function (revtags) {
                     penref.helpful = revtags;
                     callback(); },
                 function (code, errtxt) {
                     mor.err("initHelpfulButtonSetting failed " + code +
                             " " + errtxt); },
                 critsec);
    },


    initHelpfulButtonSetting = function (penref, review) {
        if(penref.helpful) {  //local data initialized
            if(foundHelpful(mor.instId(review), penref)) {
                toggleHelpfulButton("set"); } }
        else {  //penref.helpful not defined yet. init from db and retry
            loadHelpful(function () {
                initHelpfulButtonSetting(penref, review); }, penref); }
    },


    isRemembered = function (revtag) {
        if(revtag && revtag.remembered && !revtag.forgotten) {
            return true; }
        return false;
    },


    toggleMemoButton = function (value) {
        var img, tbl, data, critsec = "";
        img = mor.byId('memoimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = mor.byId('memotable');
        if(value === "set") {  //just initializing the display
            img.src = "img/remembered.png";
            tbl.title = "Remove from your remembered reviews";
            mor.out('memotxttd', "Remembered");
            return; }
        img.className = "navicodis";  //grey out the image
        value = (img.src.indexOf("remembered.png") > 0)? "no" : "yes"; //toggle
        data = "penid=" + mor.instId(mor.pen.currPenRef().pen) +
            "&revid=" + mor.instId(crev) +
            "&remember=" + value;
        mor.call("noteremem?" + mor.login.authparams(), 'POST', data,
                 function (updatedrevtags) {
                     updateCachedReviewTags('remembered', updatedrevtags);
                     if(isRemembered(updatedrevtags[0])) {
                         img.src = "img/remembered.png";
                         tbl.title = "Remove from your remembered reviews";
                         mor.out('memotxttd', "Remembered"); }
                     else {
                         img.src = "img/rememberq.png";
                         tbl.title = "Add to your remembered reviews";
                         mor.out('memotxttd', "Remember"); }
                     img.className = "navico"; },  //ungrey the image
                 function (code, errtxt) {
                     mor.err("toggleMemoButton failed " + code +
                             " " + errtxt); },
                 critsec);
    },


    initMemoButtonSetting = function (penref, review) {
        var i, revid, params, critsec = "";
        if(penref.remembered) {  //local data initialized
            revid = mor.instId(review);
            for(i = 0; i < penref.remembered.length; i += 1) {
                if(penref.remembered[i].revid === revid &&
                   isRemembered(penref.remembered[i])) {
                    toggleMemoButton("set");
                    break; } } }
        else { //penref.remembered not defined yet. init from db and retry
            params = "penid=" + mor.instId(penref.pen) +
                "&" + mor.login.authparams();
            mor.call("srchremem?" + params, 'GET', null,
                     function (memos) {
                         penref.remembered = memos;
                         initMemoButtonSetting(penref, review); },
                     function (code, errtxt) {
                         mor.err("initMemoButtonSetting failed " + code +
                                 " " + errtxt); },
                     critsec); }
    },


    getReviewLinkHTML = function (field, penref, revref) {
        var titles = { helpful: "$Name found this review helpful",
                       remembered: "$Name remembered this review",
                       corresponding: "$Name also reviewed this" },
            html, pen, title, funcstr;
        pen = penref.pen;
        title = titles[field].replace("$Name", mor.ndq(pen.name));
        funcstr = "mor.profile.byprofid('" + mor.instId(pen) + "')";
        if(revref) {
            funcstr = "mor.profile.readReview('" + 
                                        mor.instId(revref.rev) + "')"; }
        html = "<a" + 
            " href=\"#" + mor.ndq(pen.name) + "\"" +
            " onclick=\"" + funcstr + ";return false;\"" +
            " title=\"" + title + "\"" +
            ">" + pen.name + "</a>";
        return html;
    },


    displayReviewLinks = function () {
        var divs = ["hlinksdiv", "rlinksdiv", "clinksdiv"],
            fields = ["helpful", "remembered", "corresponding"],
            revref = mor.lcs.getRevRef(crev),  //rev is loaded
            html, i, pens, j, penrevid, penid, penrevref, penref;
        if(!revref.revlink) {
            return mor.lcs.verifyReviewLinks(displayReviewLinks); }
        html = "";
        for(i = 0; i < divs.length; i += 1) {
            pens = revref.revlink[fields[i]];
            if(pens) {
                pens = pens.split(",");
                for(j = 0; j < pens.length; j += 1) {
                    penrevid = 0; penid = pens[j];
                    if(penid.indexOf(":") > 0) {
                        penid = penid.split(":");
                        penrevid = penid[0]; penid = penid[1]; }
                    penref = mor.lcs.getPenRef(penid);
                    if(penref.status === "not cached") {
                        return mor.lcs.getPenFull(penid, displayReviewLinks); }
                    if(penrevid) {
                        penrevref = mor.lcs.getRevRef(penrevid);
                        if(penrevref.status === "not cached") {
                            return mor.lcs.getRevFull(penrevid, 
                                                      displayReviewLinks); } }
                    if(penref.pen && penref.pen !== mor.pen.currPenRef().pen) {
                        if(html) {
                            html += ", "; }
                        html += getReviewLinkHTML(fields[i], penref, 
                                                  penrevref); } }
                mor.out(divs[i], html);
                html = ""; } }
    },


    startReviewFormDynamicElements = function (revpen, review) {
        if(mor.byId('helpfulbutton')) {
            initHelpfulButtonSetting(mor.pen.currPenRef(), review); }
        if(mor.byId('memobutton')) {
            initMemoButtonSetting(mor.pen.currPenRef(), review); }
        if(mor.byId('respondbutton')) {
            mor.pen.getPen(function (homepen) {
                findCorrespondingReview(homepen, 
                                        displayCorrespondingReviewInfo); 
            }); }
        if(mor.byId('hlinksdiv')) {
            displayReviewLinks(); }
        if(mor.byId('revautodiv')) {
            autocomptxt = "";
            autocompletion(); }
        if(mor.byId('sharediv')) {
            mor.services.displayShare('sharebuttonsdiv', 'sharemsgdiv',
                                      revpen, review); }
    },


    displayReviewForm = function (pen, review, mode, errmsg) {
        var twidth, html, type, keyval, temp;
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
        temp = transformActionsHTML(review, type, keyval, mode);
        if(temp) {
            html += "<tr>" +
              //picture extends into this row
              "<td colspan=\"3\" id=\"transformactionstd\">" + 
                temp + "</td>" +
              "</tr>"; }
        //buttons
        html += "<tr>" +
          //picture extends into this row
          "<td colspan=\"3\" id=\"revformbuttonstd\">" + 
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
            else if(mor.byId('subkeyin') && !review[type.subkey]) {
                mor.byId('subkeyin').focus(); }
            else {
                mor.byId('reviewtext').focus(); } }
        mor.layout.adjust();
        if(errmsg) {
            mor.out('revsavemsg', errmsg); }
        startReviewFormDynamicElements(pen, review);
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
            autourl = "";
            attribution = "";
            starPointingActive = false;
            autocomptxt = "";
            mor.review.display(); }       //and restart
        else {
            mor.review.displayRead(); }
    },


    saveReview = function (doneEditing, actionstr) {
        var errors = [], i, errtxt = "", type, url, data, critsec = "", html;
        //remove save button immediately to avoid double click dupes...
        html = mor.byId('revformbuttonstd').innerHTML;
        mor.out('revformbuttonstd', "Verifying...");
        type = findReviewType(crev.revtype);
        if(!type) {
            mor.out('revformbuttonstd', html);
            mor.out('revsavemsg', "Unknown review type");
            return; }
        noteURLValue();
        keyFieldsValid(type, errors);
        secondaryFieldsValid(type, errors, actionstr);
        keywordsValid(type, errors);
        reviewTextValid(type, errors);
        if(errors.length > 0) {
            mor.out('revformbuttonstd', html);
            for(i = 0; i < errors.length; i += 1) {
                errtxt += errors[i] + "<br/>"; }
            mor.out('revsavemsg', errtxt);
            return; }
        mor.out('revformbuttonstd', "Saving...");
        mor.onescapefunc = null;
        url = "updrev?";
        if(!mor.instId(crev)) {
            url = "newrev?";
            crev.svcdata = ""; }
        data = mor.objdata(crev);
        mor.call(url + mor.login.authparams(), 'POST', data,
                 function (reviews) {
                     crev = mor.lcs.putRev(reviews[0]).rev;
                     setTimeout(mor.pen.refreshCurrent, 50); //refetch top 20
                     setTimeout(function () {  //update corresponding links
                         mor.lcs.checkAllCorresponding(crev); }, 200);
                     if(doneEditing) {
                         attribution = "";
                         mor.review.displayRead(actionstr); }
                     else {
                         mor.review.display(actionstr); } },
                 function (code, errtxt) {
                     mor.log("saveReview failed code: " + code + " " +
                             errtxt);
                     mor.review.display(); },
                 critsec);
    },


    initWithId = function (revid, mode, action, errmsg) {
        var critsec = "", params = "revid=" + revid;
        mor.call("revbyid?" + params, 'GET', null,
                 function (revs) {
                     if(revs.length > 0) {
                         crev = revs[0];
                         if(mode === "edit") {
                             mor.review.display(action, errmsg); }
                         else {
                             mor.review.displayRead(action); } }
                     else {
                         mor.err("initWithId found no review id " + revid); } },
                 function (code, errtxt) {
                     mor.err("initWithId failed code " + code + ": " +
                             errtxt); },
                 critsec);
    },


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given review.
    copyAndEdit = function (pen, review) {
        if(!review) {
            review = {};
            review.srcrev = mor.instId(crev);
            review.penid = mor.instId(pen);
            review.revtype = crev.revtype;
            review.rating = crev.rating;  //initial value required..
            review.cankey = crev.cankey; }
        //Fill in any empty descriptive fields
        if(crev.imguri && !review.imguri && !review.revpic) {
            review.imguri = crev.imguri; }
        if(crev.revpic && !review.imguri && !review.revpic) {
            review.imguri = "revpic?revid=" + mor.instId(crev); }
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


    deleteReview = function () {
        var data, critsec = "";
        if(!crev || 
           !window.confirm("Are you sure you want to delete this review?")) {
            return; }
        mor.out('cmain', "Deleting review...");
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
                     mor.profile.display(); },
                 critsec);
    },


    mainDisplay = function (pen, read, action, errmsg) {
        if(!crev) {
            crev = {}; }
        if(!crev.penid) {
            crev.penid = mor.pen.currPenId(); }
        setTimeout(function () {  //refresh headings
            if(crev.penid !== mor.instId(pen)) { 
                mor.lcs.getPenFull(crev.penid, function (revpenref) {
                    mor.profile.writeNavDisplay(pen, revpenref.pen,
                                                "nosettings"); }); }
            else {
                mor.profile.writeNavDisplay(pen, null, "nosettings"); }
            }, 50);
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(pen, crev);
            if(crev.penid !== mor.pen.currPenId()) {  //not our review
                if(action === "helpful") {
                    mor.review.helpful("set"); }
                else if(action === "remember") {
                    mor.review.memo(); }
                else if(action === "respond") {
                    mor.review.respond(); } } }
        else if(!findReviewType(crev.revtype)) {
            displayTypeSelect(); }
        else if(action === "uploadpic") {
            displayReviewForm(pen, crev, "edit");
            picUploadForm(); }
        else {
            displayReviewForm(pen, crev, "edit", errmsg); }
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function (action, errmsg) {
            mor.pen.getPen(function (pen) {
                mainDisplay(pen, false, action, errmsg); 
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
        reviewTypeCheckboxesHTML: function (cboxgroup, chgfuncstr) {
            return reviewTypeCheckboxesHTML(cboxgroup, chgfuncstr); },
        reviewTypeRadiosHTML: function (rgname, chgfuncstr, revrefs, selt) {
            return reviewTypeRadiosHTML(rgname, chgfuncstr, revrefs, selt); },
        reviewTypeSelectOptionsHTML: function (revrefs) {
            return reviewTypeSelectOptionsHTML(revrefs); },
        badgeImageHTML: function (type) {
            return badgeImageHTML(type); },
        starsImageHTML: function (rating, showblank) {
            return starsImageHTML(rating, showblank); },
        linkCountHTML: function (revid) {
            return linkCountHTML(revid); },
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
        setCurrentReview: function (revobj) {
            crev = revobj; },
        getCurrentReview: function () {
            return crev; },
        initWithId: function (revid, mode, action, errmsg) {
            initWithId(revid, mode, action, errmsg); },
        respond: function () {
            mor.byId('respondtxttd').style.color = "#666666";
            setTimeout(function () {
                mor.pen.getPen(function (pen) {
                    findCorrespondingReview(pen, copyAndEdit); }); }, 50); },
        memo: function (value) {
            toggleMemoButton(value); },
        helpful: function (value) {
            toggleHelpfulButton(value); },
        graphicAbbrevSiteLink: function (url) {
            return graphicAbbrevSiteLink(url); },
        swapVidTitleAndArtist: function () {
            swapVidTitleAndArtist(); },
        changeReviewType: function (revtype) {
            changeReviewType(revtype); },
        removeImageLink: function () {
            removeImageLink(); },
        setAttribution: function (html) {
            attribution = html; },
        starRating: function (rating, roundup) {
            return starRating(rating, roundup); },
        selectloc: function (addr, ref) {
            selectLocation(addr, ref); },
        loadHelpful: function (callback, penref) {
            loadHelpful(callback, penref); },
        foundHelpful: function (revid, penref) {
            return foundHelpful(revid, penref); }
    };

});


