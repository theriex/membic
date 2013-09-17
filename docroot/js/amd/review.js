/*global define: false, alert: false, console: false, setTimeout: false, clearTimeout: false, window: false, document: false, history: false, app: false, require: false, google: false */

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
        //site.css .revtextsummary and corresponding function in statrev.py
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
                app.checkrad(intype, gname, value, label, checked, chgfstr) + 
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
            app.imgntxt("writereview.png", "Review and Share",
                        "app.review.reset(true)",
                        "#Write", 
                        "Write a review and share it with your friends") +
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
        revref = app.lcs.getRevRef(revid);
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
            crev.revtype = app.dec(params.newrev); }
        if(params.name) {
            crev.name = app.dec(params.name); }
        if(params.title) {
            crev.title = app.dec(params.title); }
        if(params.artist) {
            crev.artist = app.dec(params.artist); }
        if(params.author) {
            crev.author = app.dec(params.author); }
        if(params.publisher) {
            crev.publisher = app.dec(params.publisher); }
        if(params.album) {
            crev.album = app.dec(params.album); }
        if(params.starring) {
            crev.starring = app.dec(params.starring); }
        if(params.address) {
            crev.address = app.dec(params.address); }
        if(params.year) {
            crev.year = app.dec(params.year); }
        if(params.imguri) {
            crev.imguri = app.dec(params.imguri); }
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
        var input = app.byId('reviewtext');
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
            urlin = app.byId('urlin');
            if(urlin) {
                url = urlin.value; } }
        reviewTextValid(crev.revtype, errs);
        if(errs.length > 0) {
            return; }
        if(!url) {  //bail out, but reflect any updates so far
            return app.review.display(); }
        rbc = app.byId('readurlbuttoncontainer');
        if(rbc) {
            rbc.innerHTML = "reading..."; }
        if(url) {
            crev.url = autourl = url;
            readParameters(params);
            getURLReader(autourl, function (reader) {
                reader.fetchData(crev, url, params); }); }
        else {
            app.review.display(); }
    },


    setType = function (type) {
        crev.revtype = type;
        app.review.display();
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
                app.imgntxt(reviewTypes[i].img, captype,
                            "app.review.setType('" + reviewTypes[i].type + "')",
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
                        " onchange=\"app.review.readURL();return false;\"" + 
                    "/>&nbsp;" +
                "<span id=\"readurlbuttoncontainer\">" +
                  "<button type=\"button\" id=\"readurlbutton\"" +
                         " onclick=\"app.review.readURL();return false;\"" +
                         " title=\"Read review form fields from pasted URL\"" +
                  ">Read</button></span>" +
                "</td>" +
              "</tr></table></li>"; }
        html += "</ul></div></div>";
        if(!app.byId('cmain')) {
            app.layout.initContent(); }
        app.out('cmain', html);
        //Setting focus on a phone zooms to bring up the keyboard, so the
        //type buttons don't get displayed.  Entering a URL is not the 
        //primary path forward so don't set focus here.
        //app.byId('urlin').focus();
        app.layout.adjust();
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
        var odiv, html = "", revid = app.instId(crev);
        if(!revid) {
            html = app.byId('revformbuttonstd').innerHTML;
            if(html.indexOf("<button") >= 0) { //not already saving
                return app.review.save(false, "uploadpic"); }
            return; }  //already saving, just ignore the pic upload click
        html += app.paramsToFormInputs(app.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + revid + "\"/>";
        html += "<input type=\"hidden\" name=\"penid\" value=\"" +
            crev.penid + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            app.enc(window.location.href + "#revedit=" + revid) + "\"/>";
        //build the rest of the form around that
        html = "<form action=\"/revpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            "<div id=\"closeline\">" +
              "<a id=\"closedlg\" href=\"#close\"" +
                " onclick=\"app.cancelOverlay();return false\">" + 
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
        app.out('overlaydiv', html);
        odiv = app.byId('overlaydiv');
        odiv.style.top = "300px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = app.skinner.lightbg();
        app.onescapefunc = app.cancelOverlay;
        app.byId('picfilein').focus();
    },


    picHTML = function (review, type, keyval, mode) {
        var imgstyle, html;
        if(!keyval) {
            return ""; }
        imgstyle = "";
        if(app.isLowFuncBrowser()) {
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
                      " onclick=\"app.review.removeImageLink();" + 
                                 "return false;\"" +
                    ">remove image</a>"; } }
        else {  //no auto-generated link image, allow personal pic upload
            html = "";   //if just viewing, the default is no pic. 
            if(mode === "edit") {  //for editing, default is outline pic
                html = "img/emptyprofpic.png"; }
            if(review.revpic) {  //use uploaded pic if available
                html = "revpic?revid=" + app.instId(review); }
            html = "<img class=\"revimg\"" + imgstyle + " src=\"" + html + "\"";
            if(mode === "edit") {
                html += " title=\"Click to upload a picture\"" +
                    " onclick=app.review.picUploadForm();return false;"; }
            html += "/>"; }
        return html;
    },


    errlabel = function (domid) {
        var elem = app.byId(domid);
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
        var input = app.byId('urlin');
        //if auto read url from initial form, note it and then reset
        if(autourl) {
            crev.url = autourl;
            autourl = ""; }
        //the url may be edited
        if(input) {
            crev.url = input.value; }
    },


    keyFieldsValid = function (type, errors) {
        var cankey, input = app.byId('keyin');
        if(!input || !input.value) {
            errlabel('keyinlabeltd');
            errors.push("Please specify a value for " + type.key); }
        else {
            crev[type.key] = input.value;
            cankey = crev[type.key]; }
        if(type.subkey) {
            input = app.byId('subkeyin');
            if(!input || !input.value) {
                errlabel('subkeyinlabeltd');
                errors.push("Please specify a value for " + type.subkey); }
            else {
                crev[type.subkey] = input.value;
                cankey += crev[type.subkey]; } }
        if(cankey) {
            crev.cankey = app.canonize(cankey); }
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
            input = app.byId("field" + i);
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


    toggleKeyword = function (kwid) {
        var cbox, text, keyin, keywords, i, kw;
        cbox = app.byId(kwid);
        text = "";
        keyin = app.byId('keywordin');
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
                      " onclick=\"app.review.toggleKeyword('dkw" + i + "');\"";
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
                        " value=\"" + app.safestr(review.keywords) + "\"/>"; }
        else { //not editing
            if(app.safestr(review.keywords)) {
                html += "<div class=\"csvstrdiv\">" +
                    "<span class=\"secondaryfield\">Keywords</span> " +
                    app.safestr(review.keywords) + "</div>"; } }
        return html;
    },


    //ATTENTION: This needs to do a quick pass through and get rid of
    //           any extraneous commas.  For extra credit: Add commas
    //           when people insert their own space separated keywords.
    keywordsValid = function (type, errors) {
        var input, words, i, csv = "";
        input = app.byId('keywordin');
        if(input) {
            words = input.value || "";
            words = words.split(",");
            for(i = 0; i < words.length; i += 1) {
                if(i > 0) {
                    csv += ", "; }
                csv += words[i].trim(); }
            crev.keywords = csv; }
    },


    transformActionsHTML = function (review, type, keyval, mode) {
        var html = "";
        if(keyval && mode === "edit") {
            //video import may confuse the title and artist
            if(review.revtype === "video" && review.title && review.artist) {
                html += "<a href=\"#\"" + 
                          " title=\"Swap the artist and title values\"" +
                          " onclick=\"app.review.swapVidTitleAndArtist();" +
                                     "return false;\"" +
                    ">Swap title and artist</a>&nbsp;&nbsp;&nbsp;"; }
            //sometimes videos are really more music and vice versa
            if(review.revtype === "video") {
                html += "<a href=\"#\"" +
                          " title=\"Review this as music\"" +
                          " onclick=\"app.review.changeReviewType('music');" +
                                     "return false;\"" +
                    ">Review as music</a>&nbsp;&nbsp;&nbsp;"; }
            if(review.revtype === "music") {
                html += "<a href=\"#\"" +
                          " title=\"Review this as video\"" +
                          " onclick=\"app.review.changeReviewType('video');" +
                                     "return false;\"" +
                    ">Review as video</a>&nbsp;&nbsp;&nbsp;"; }
            //Might want to refresh the image link or get other info
            if(review.url) {
                html += "<a href=\"#\"" +
                          " title=\"Read the URL to fill out review fields\"" +
                          " onclick=\"app.review.readURL('" + 
                                                         review.url + "');" +
                                     "return false;\"" +
                    ">Read review details from URL</a>&nbsp;&nbsp;&nbsp;"; }
        }
        return html;
    },


    swapVidTitleAndArtist = function () {
        var titlein = app.byId('keyin'),
            title = titlein.value,
            artistin = app.byId('field0'),
            artist = artistin.value;
        titlein.value = artist;
        artistin.value = title;
    },


    changeReviewType = function (typeval) {
        var errs = [];
        reviewTextValid(crev.revtype, errs);
        crev.revtype = typeval;
        app.review.display();
    },


    removeImageLink = function () {
        crev.imguri = "";
        app.review.display();
    },


    reviewLinkActionHTML = function (activebuttons) {
        var html = "<div id=\"socialrevactdiv\">" +
            "<table class=\"socialrevacttable\" border=\"0\"><tr>";
        if(activebuttons) {
            //helpful button. init unchecked then update after lookup
            html += "<td><div id=\"helpfulbutton\" class=\"buttondiv\">" +
                app.imgntxt("helpfulq.png",
                            "Helpful",
                            "app.review.helpful()", "#helpful",
                            "Mark this review as helpful", "", "helpful") +
                "</div></td>";
            //remember button. init unchecked and then update after lookup
            html += "<td><div id=\"memobutton\" class=\"buttondiv\">" +
                app.imgntxt("rememberq.png",
                            "Remember",
                            "app.review.memo()", "#memo",
                            "Add this to remembered reviews", "", "memo") +
                "</div></td>";
            //respond button
            html += "<td><div id=\"respondbutton\" class=\"buttondiv\">" +
                  //this contents is rewritten after looking up their review
                  app.imgntxt("writereview.png",
                              "Your review",
                              "app.review.respond()", "#respond",
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
            app.onescapefunc = app.review.reset;
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"cancelbutton\"" +
                       " onclick=\"app.review.reset(true);return false;\"" +
                ">Cancel</button>&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                       " onclick=\"app.review.validate();return false;\"" +
                ">Create Review</button></div>"; }
        //have key fields and editing full review
        else if(mode === "edit") {
            app.onescapefunc = app.review.reset;
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"cancelbutton\"" +
                       " onclick=\"app.review.reset(" + 
                               (app.instId(review)? "false" : "true") +
                                                  ");return false;\"" +
                    ">Cancel</button>&nbsp;" +
                "<button type=\"button\" id=\"savebutton\"" +
                       " onclick=\"app.review.save(true,'');return false;\"" +
                    ">Save</button>&nbsp;" +
                "</div>"; }
        //reading a previously written review
        else if(review.penid === app.pen.currPenId()) {  //is review owner
            app.onescapefunc = null;
            staticurl = "statrev/" + app.instId(review);
            html = "<div id=\"revbuttonsdiv\">" + 
                "<button type=\"button\" id=\"deletebutton\"" +
                       " onclick=\"app.review.delrev();return false;\"" +
                ">Delete</button>&nbsp;" + 
                "<button type=\"button\" id=\"editbutton\"" +
                       " onclick=\"app.review.display();return false;\"" +
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
            onchange = "app.review.validate();return false;";
            if(type.subkey) {
                onchange = "app.byId('subkeyin').focus();return false;"; }
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
                onchange = "app.review.validate();return false;";
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
        var targetwidth = Math.max((app.winw - 350), 200);
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
            style = "color:" + app.colors.text + ";" +
                "background-color:" + app.skinner.lightbg() + ";" +
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
                style += "border:1px solid " + app.skinner.darkbg() + ";" +
                    "overflow:auto;margin:auto";
                html += "<div id=\"reviewtext\" class=\"shoutout\"" +
                            " style=\"" + style + "\">" + 
                    app.linkify(fval) + "</div>"; } }
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


    ratingMenuSelect = function (rating) {
        var html;
        app.cancelOverlay();
        crev.rating = rating;
        html = starsImageHTML(crev.rating, true);
        app.out('stardisp', html);
    },


    selectRatingByMenu = function (evtx) {
        var i, html = "", odiv;
        starPointingActive = false;
        for(i = 0; i <= 100; i += 10) {
            html += "<div class=\"ratingmenudiv\" id=\"starsel" + i + "\"" +
                        " onclick=\"app.review.ratmenusel(" + i + ");" + 
                                   "return false;\"" + 
                ">" + starsImageHTML(i) + "</div>"; }
        app.out('overlaydiv', html);
        odiv = app.byId('overlaydiv');
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
        span = app.byId('stardisp');
        spanloc = app.geoPos(span);
        evtx = app.geoXY(event).x;
        //app.out('keyinlabeltd', "starDisplayAdjust evtx: " + evtx);  //debug
        if(event.changedTouches && event.changedTouches[0]) {
            evtx = app.geoXY(event.changedTouches[0]).x; }
        relx = Math.max(evtx - spanloc.x, 0);
        if(relx > 100) {  //normal values for relx range from 0 to ~86
            setTimeout(function () {  //separate event handling
                selectRatingByMenu(evtx); }, 20);
            return; }
        //app.out('keyinlabeltd', "starDisplayAdjust relx: " + relx);  //debug
        sval = Math.min(Math.round((relx / spanloc.w) * 100), 100);
        //app.out('keyinlabeltd', "starDisplayAdjust sval: " + sval);  //debug
        if(roundup) {
            sval = starRating(sval, true).value; }
        crev.rating = sval;
        html = starsImageHTML(crev.rating, true);
        app.out('stardisp', html);
    },


    starPointing = function (event) {
        //app.out('keyinlabeltd', "star pointing");  //debug
        starPointingActive = true;
        starDisplayAdjust(event, true);
    },


    starStopPointing = function (event) {
        //var pos = app.geoXY(event);  //debug
        //app.out('keyinlabeltd', "star NOT pointing" + event.target);  //debug
        //app.out('starslabeltd', " " + pos.x + ", " + pos.y);  //debug
        starPointingActive = false;
    },


    starStopPointingBoundary = function (event) {
        var td, tdpos, xypos, evtx, evty;
        td = app.byId('starstd');
        tdpos = app.geoPos(td);
        xypos = app.geoXY(event);
        evtx = xypos.x;
        evty = xypos.y;
        if(event.changedTouches && event.changedTouches[0]) {
            xypos = app.geoXY(event.changedTouches[0]);
            evtx = xypos.x;
            evty = xypos.y; }
        //app.out('starslabeltd', " " + evtx + ", " + evty);  //debug
        if(evtx < tdpos.x || evtx > tdpos.x + tdpos.w ||
           evty < tdpos.y || evty > tdpos.y + tdpos.h) {
            //app.out('keyinlabeltd', "star NOT pointing (bounds)"); //debug
            starPointingActive = false; }
    },


    starPointAdjust = function (event) {
        if(starPointingActive) {
            //app.out('keyinlabeltd', "star point adjust...");  //debug
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
                          " onclick=\"app.review.readURL('" + url + "');" +
                                     "return false;\"" +
                ">" + title + "</a></li>";
            itemdat = xmlExtract("Item", itemdat.remainder); }
        html += "</ul>";
        app.out('revautodiv', html);
    },


    callAmazonForAutocomplete = function (acfunc) {
        var url, critsec = "";
        url = "amazonsearch?revtype=" + crev.revtype + "&search=" +
            app.enc(autocomptxt);
        app.call('GET', url, null,
                 function (json) {
                     writeAutocompLinks(app.dec(json[0].content));
                     setTimeout(acfunc, 400);
                     app.layout.adjust(); },
                 app.failf(function (code, errtxt) {
                     app.out('revautodiv', "");
                     app.log("Amazon info retrieval failed code " +
                             code + ": " + errtxt);
                     setTimeout(acfunc, 400);
                     app.layout.adjust(); }),
                 critsec);
    },


    selectLocLatLng = function (latlng, ref) {
        var mapdiv, map;
        if(!gplacesvc && google && google.maps && google.maps.places) {
            //this can fail intermittently, restarting the review usually works
            try {
                mapdiv = app.byId('mapdiv');
                map = new google.maps.Map(mapdiv, {
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: latlng,
                    zoom: 15 });
                gplacesvc = new google.maps.places.PlacesService(map);
            } catch (problem) {
                app.err("Initializing google maps places failed, so the\n" +
                        "review url and address were not filled out.\n\n" + 
                        "mapdiv: " + mapdiv + "\n" +
                        "problem: " + problem);
                gplacesvc = null; 
            } }
        if(gplacesvc && ref) {
            gplacesvc.getDetails({reference: ref},
                function (place, status) {
                    if(status === google.maps.places.PlacesServiceStatus.OK) {
                        crev.address = place.formatted_address;
                        crev.name = place.name || app.byId('keyin').value;
                        crev.url = crev.url || place.website || "";
                        readURL(crev.url); }
                    }); }
    },


    selectLocation = function (addr, ref) {
        var html;
        if(addr) {  //even if all other calls fail, use the selected name
            app.byId('keyin').value = app.dec(addr); }
        if(!geoc && google && google.maps && google.maps.places) {
            geoc = new google.maps.Geocoder(); }
        if(geoc && addr) {
            try {
                addr = app.dec(addr);
                html = "<p>" + addr + "</p><div id=\"mapdiv\"></div>";
                app.out('revautodiv', html);
                //give mapdiv a chance to be output before this call
                setTimeout(function () {
                    geoc.geocode({address: addr}, function (results, status) {
                        var ok = google.maps.places.PlacesServiceStatus.OK;
                        if(status === ok) {
                            selectLocLatLng(results[0].geometry.location, 
                                            ref); }
                        }); }, 50);
            } catch (problem) {
                app.err("selectLocation failed: " + problem);
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
                                " onclick=\"app.review.selectloc('" +
                                    app.embenc(place.description) + "','" +
                                    place.reference + "');return false;\"" +
                                ">" + place.description + "</a>" +
                                "</li>"; } }
                    html += "</ul><img src=\"img/poweredbygoogle.png\"/>";
                    app.out('revautodiv', html);
                    setTimeout(acfunc, 400);
                    app.layout.adjust(); }); }
        else {
            setTimeout(acfunc, 400); }
    },


    autocompletion = function (event) {
        var srchtxt;
        if(app.byId('revautodiv') && app.byId('keyin')) {
            srchtxt = app.byId('keyin').value;
            if(app.byId('subkeyin')) {
                srchtxt += " " + app.byId('subkeyin').value; }
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
                app.lcs.verifyCorrespondingLinks(review, crev); }, 100);
            imghtml = starsImageHTML(review.rating, false, "inlinestarsimg");
            msghtml = "Your review: " + imghtml; }
        html = app.imgntxt("writereview.png", msghtml,
                           "app.review.respond()", "#respond",
                           "Edit your corresponding review", "", "respond");
        app.out('respondbutton', html);
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
        params = "penid=" + app.instId(homepen) + 
            "&revtype=" + crev.revtype + "&cankey=" + crev.cankey +
            "&" + app.login.authparams();
        app.call('GET', "revbykey?" + params, null,
                 function (revs) {
                     var rev = null;
                     if(revs.length > 0) {
                         rev = revs[0]; }
                     contfunc(homepen, rev); },
                 app.failf(function (code, errtxt) {
                     app.err("findCorrespondingReview failed " + code + 
                             " " + errtxt); }),
                 critsec);
    },


    updateCachedReviewTags = function (field, updrevtags) {
        var i, penref, rtid, replaced;
        rtid = app.instId(updrevtags[0]);
        penref = app.pen.currPenRef();
        if(!penref[field]) {
            penref[field] = updrevtags; }
        else {
            for(i = 0; i < penref[field].length; i += 1) {
                if(app.instId(penref[field][i]) === rtid) {
                    penref[field][i] = updrevtags[0];
                    replaced = true; } }
            if(!replaced) {  //must prepend if remembered
                penref[field].unshift(updrevtags[0]); } }
        if(field === "remembered") {
            //ensure helpful marks for anything remembered are found
            updateCachedReviewTags('helpful', updrevtags); }
        app.lcs.getRevRef(updrevtags[0].revid).revlink = null;
    },


    isHelpful = function (revtag) {
        if(revtag && revtag.helpful && !revtag.nothelpful) {
            return true; }
        return false;
    },


    toggleHelpfulButton = function (value) {
        var img, tbl, data, critsec = "";
        img = app.byId('helpfulimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = app.byId('helpfultable');
        if(value === "set") {  //just initializing the display
            img.src = "img/helpful.png";
            tbl.title = "Remove mark as helpful";
            return; }
        img.className = "navicodis";  //grey out the image
        value = (img.src.indexOf("helpful.png") > 0)? "no" : "yes";  //toggle
        data = "penid=" + app.instId(app.pen.currPenRef().pen) +
            "&revid=" + app.instId(crev) +
            "&helpful=" + value;
        app.call('POST', "notehelpful?" + app.login.authparams(), data,
                 function (updatedrevtags) {
                     updateCachedReviewTags('helpful', updatedrevtags);
                     if(isHelpful(updatedrevtags[0])) {
                         img.src = "img/helpful.png";
                         tbl.title = "Remove mark as helpful"; }
                     else {
                         img.src = "img/helpfulq.png";
                         tbl.title = "Mark this review as helpful"; }
                     img.className = "navico"; },  //ungrey the image
                 app.failf(function (code, errtxt) {
                     app.err("toggleHelpfulButton failed " + code +
                             " " + errtxt); }),
                 critsec);
    },


    foundHelpful = function (revid, penref) {
        var i;
        if(!penref) {
            penref = app.pen.currPenRef(); }
        for(i = 0; penref.helpful && i < penref.helpful.length; i += 1) {
            if(penref.helpful[i].revid === revid && 
               isHelpful(penref.helpful[i])) {
                return true; } }
        return false;
    },


    loadHelpful = function (callback, penref) {
        var params, critsec = "";
        if(!penref) {
            penref = app.pen.currPenRef(); }
        params = "penid=" + app.instId(penref.pen) + 
            "&" + app.login.authparams();
        app.call('GET', "srchhelpful?" + params, null,
                 function (revtags) {
                     penref.helpful = revtags;
                     callback(); },
                 app.failf(function (code, errtxt) {
                     app.err("initHelpfulButtonSetting failed " + code +
                             " " + errtxt); }),
                 critsec);
    },


    initHelpfulButtonSetting = function (penref, review) {
        if(penref.helpful) {  //local data initialized
            if(foundHelpful(app.instId(review), penref)) {
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
        img = app.byId('memoimg');
        if(!img) {  //spurious call, button not displayed
            return; }
        tbl = app.byId('memotable');
        if(value === "set") {  //just initializing the display
            img.src = "img/remembered.png";
            tbl.title = "Remove from your remembered reviews";
            app.out('memotxttd', "Remembered");
            return; }
        img.className = "navicodis";  //grey out the image
        value = (img.src.indexOf("remembered.png") > 0)? "no" : "yes"; //toggle
        data = "penid=" + app.instId(app.pen.currPenRef().pen) +
            "&revid=" + app.instId(crev) +
            "&remember=" + value;
        app.call('POST', "noteremem?" + app.login.authparams(), data,
                 function (updatedrevtags) {
                     updateCachedReviewTags('remembered', updatedrevtags);
                     if(isRemembered(updatedrevtags[0])) {
                         img.src = "img/remembered.png";
                         tbl.title = "Remove from your remembered reviews";
                         app.out('memotxttd', "Remembered"); }
                     else {
                         img.src = "img/rememberq.png";
                         tbl.title = "Add to your remembered reviews";
                         app.out('memotxttd', "Remember"); }
                     img.className = "navico"; },  //ungrey the image
                 app.failf(function (code, errtxt) {
                     app.err("toggleMemoButton failed " + code +
                             " " + errtxt); }),
                 critsec);
    },


    initMemoButtonSetting = function (penref, review) {
        var i, revid, params, critsec = "";
        if(penref.remembered) {  //local data initialized
            revid = app.instId(review);
            for(i = 0; i < penref.remembered.length; i += 1) {
                if(penref.remembered[i].revid === revid &&
                   isRemembered(penref.remembered[i])) {
                    toggleMemoButton("set");
                    break; } } }
        else { //penref.remembered not defined yet. init from db and retry
            params = "penid=" + app.instId(penref.pen) +
                "&" + app.login.authparams();
            app.call('GET', "srchremem?" + params, null,
                     function (memos) {
                         penref.remembered = memos;
                         initMemoButtonSetting(penref, review); },
                     app.failf(function (code, errtxt) {
                         app.err("initMemoButtonSetting failed " + code +
                                 " " + errtxt); }),
                     critsec); }
    },


    getReviewLinkHTML = function (field, penref, revref) {
        var titles = { helpful: "$Name found this review helpful",
                       remembered: "$Name remembered this review",
                       corresponding: "$Name also reviewed this" },
            html, pen, title, funcstr;
        pen = penref.pen;
        title = titles[field].replace("$Name", app.ndq(pen.name));
        funcstr = "app.profile.byprofid('" + app.instId(pen) + "')";
        if(revref) {
            funcstr = "app.profile.readReview('" + 
                                        app.instId(revref.rev) + "')"; }
        html = "<a" + 
            " href=\"#" + app.ndq(pen.name) + "\"" +
            " onclick=\"" + funcstr + ";return false;\"" +
            " title=\"" + title + "\"" +
            ">" + pen.name + "</a>";
        return html;
    },


    displayReviewLinks = function () {
        var divs = ["hlinksdiv", "rlinksdiv", "clinksdiv"],
            fields = ["helpful", "remembered", "corresponding"],
            revref = app.lcs.getRevRef(crev),  //rev is loaded
            html, i, pens, j, penrevid, penid, penrevref, penref;
        if(!revref.revlink) {
            return app.lcs.verifyReviewLinks(displayReviewLinks); }
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
                    penref = app.lcs.getPenRef(penid);
                    if(penref.status === "not cached") {
                        return app.lcs.getPenFull(penid, displayReviewLinks); }
                    if(penrevid) {
                        penrevref = app.lcs.getRevRef(penrevid);
                        if(penrevref.status === "not cached") {
                            return app.lcs.getRevFull(penrevid, 
                                                      displayReviewLinks); } }
                    if(penref.pen && penref.pen !== app.pen.currPenRef().pen) {
                        if(html) {
                            html += ", "; }
                        html += getReviewLinkHTML(fields[i], penref, 
                                                  penrevref); } }
                app.out(divs[i], html);
                html = ""; } }
    },


    startReviewFormDynamicElements = function (revpen, review) {
        if(app.byId('helpfulbutton')) {
            initHelpfulButtonSetting(app.pen.currPenRef(), review); }
        if(app.byId('memobutton')) {
            initMemoButtonSetting(app.pen.currPenRef(), review); }
        if(app.byId('respondbutton')) {
            app.pen.getPen(function (homepen) {
                findCorrespondingReview(homepen, 
                                        displayCorrespondingReviewInfo); 
            }); }
        if(app.byId('hlinksdiv')) {
            displayReviewLinks(); }
        if(app.byId('revautodiv')) {
            autocomptxt = "";
            autocompletion(); }
        if(app.byId('sharediv')) {
            app.services.displayShare('sharebuttonsdiv', 'sharemsgdiv',
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
        if(!app.byId('cmain')) {
            app.layout.initContent(); }
        app.out('cmain', html);
        if(mode === "edit") {
            app.on('starstd', 'mousedown',   starPointing);
            app.on('starstd', 'mouseup',     starStopPointing);
            app.on('starstd', 'mouseout',    starStopPointingBoundary);
            app.on('starstd', 'mousemove',   starPointAdjust);
            app.on('starstd', 'click',       starClick);
            app.on('starstd', 'touchstart',  starPointing);
            app.on('starstd', 'touchend',    starStopPointing);
            app.on('starstd', 'touchcancel', starStopPointing);
            app.on('starstd', 'touchmove',   starPointAdjust);
            if(!keyval) {
                app.byId('keyin').focus(); }
            else if(app.byId('subkeyin') && !review[type.subkey]) {
                app.byId('subkeyin').focus(); }
            else {
                app.byId('reviewtext').focus(); } }
        app.layout.adjust();
        if(errmsg) {
            app.out('revsavemsg', errmsg); }
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
                //need to check all fields to capture their values 
                //back into the current review so they are not lost.
                keywordsValid(type, errors);
                reviewTextValid(type, errors);
                secondaryFieldsValid(type, errors);
                if(errors.length > 0) {
                    for(i = 0; i < errors.length; i += 1) {
                        errtxt += errors[i] + "<br/>"; }
                    app.out('revsavemsg', errtxt);
                    return; } }
            //if no type, or if all fields valid, then redisplay
            app.review.display(); }, 400);
    },


    cancelReview = function (force) {
        app.onescapefunc = null; 
        if(fullEditDisplayTimeout) {
            clearTimeout(fullEditDisplayTimeout);
            fullEditDisplayTimeout = null; }
        if(force || !crev || !app.instId(crev)) {
            crev = {};                    //so clear it all out 
            autourl = "";
            attribution = "";
            starPointingActive = false;
            autocomptxt = "";
            app.review.display(); }       //and restart
        else {
            app.review.displayRead(); }
    },


    saveReview = function (doneEditing, actionstr) {
        var errors = [], i, errtxt = "", type, url, data, critsec = "", html;
        //remove save button immediately to avoid double click dupes...
        html = app.byId('revformbuttonstd').innerHTML;
        app.out('revformbuttonstd', "Verifying...");
        type = findReviewType(crev.revtype);
        if(!type) {
            app.out('revformbuttonstd', html);
            app.out('revsavemsg', "Unknown review type");
            return; }
        noteURLValue();
        keyFieldsValid(type, errors);
        secondaryFieldsValid(type, errors);
        keywordsValid(type, errors);
        reviewTextValid(type, errors);
        verifyRatingStars(type, errors, actionstr);
        if(errors.length > 0) {
            app.out('revformbuttonstd', html);
            for(i = 0; i < errors.length; i += 1) {
                errtxt += errors[i] + "<br/>"; }
            app.out('revsavemsg', errtxt);
            return; }
        app.out('revformbuttonstd', "Saving...");
        app.onescapefunc = null;
        url = "updrev?";
        if(!app.instId(crev)) {
            url = "newrev?";
            crev.svcdata = ""; }
        data = app.objdata(crev);
        app.call('POST', url + app.login.authparams(), data,
                 function (reviews) {
                     crev = app.lcs.putRev(reviews[0]).rev;
                     setTimeout(app.pen.refreshCurrent, 50); //refetch top 20
                     setTimeout(function () {  //update corresponding links
                         app.lcs.checkAllCorresponding(crev); }, 200);
                     if(doneEditing) {
                         attribution = "";
                         app.review.displayRead(actionstr); }
                     else {
                         app.review.display(actionstr); } },
                 app.failf(function (code, errtxt) {
                     app.log("saveReview failed code: " + code + " " +
                             errtxt);
                     app.review.display(); }),
                 critsec);
    },


    initWithId = function (revid, mode, action, errmsg) {
        var critsec = "", params = "revid=" + revid;
        app.call('GET', "revbyid?" + params, null,
                 function (revs) {
                     if(revs.length > 0) {
                         crev = revs[0];
                         if(mode === "edit") {
                             app.review.display(action, errmsg); }
                         else {
                             app.review.displayRead(action); } }
                     else {
                         app.err("initWithId found no review id " + revid); } },
                 app.failf(function (code, errtxt) {
                     app.err("initWithId failed code " + code + ": " +
                             errtxt); }),
                 critsec);
    },


    //Fill any missing descriptive fields in the given review from the
    //current review, then edit the given review.
    copyAndEdit = function (pen, review) {
        if(!review) {
            review = {};
            review.srcrev = app.instId(crev);
            review.penid = app.instId(pen);
            review.revtype = crev.revtype;
            review.rating = crev.rating;  //initial value required..
            review.cankey = crev.cankey; }
        //Fill in any empty descriptive fields
        if(crev.imguri && !review.imguri && !review.revpic) {
            review.imguri = crev.imguri; }
        if(crev.revpic && !review.imguri && !review.revpic) {
            review.imguri = "revpic?revid=" + app.instId(crev); }
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
        app.review.display();
    },


    deleteReview = function () {
        var data, critsec = "";
        if(!crev || 
           !window.confirm("Are you sure you want to delete this review?")) {
            return; }
        app.out('cmain', "Deleting review...");
        data = app.objdata(crev);
        app.call('POST', "delrev?" + app.login.authparams(), data,
                 function (reviews) {
                     var html = "<p>Review deleted.  If this review was one" +
                         " of your top 20 best, then you may see an id" +
                         " reference message until the next time you review" +
                         " something.  Recalculating your recent reviews..." +
                         "</p>";
                     app.out('cmain', html);
                     setTimeout(function () {
                         app.profile.resetReviews();
                         app.profile.display(); }, 12000); },
                 app.failf(function (code, errtxt) {
                     app.err("Delete failed code: " + code + " " + errtxt);
                     app.profile.display(); }),
                 critsec);
    },


    mainDisplay = function (pen, read, action, errmsg) {
        if(!crev) {
            crev = {}; }
        if(!crev.penid) {
            crev.penid = app.pen.currPenId(); }
        setTimeout(function () {  //refresh headings
            if(crev.penid !== app.instId(pen)) { 
                app.lcs.getPenFull(crev.penid, function (revpenref) {
                    app.profile.writeNavDisplay(pen, revpenref.pen,
                                                "nosettings"); }); }
            else {
                app.profile.writeNavDisplay(pen, null, "nosettings"); }
            }, 50);
        //if reading or updating an existing review, that review is
        //assumed to be minimally complete, which means it must
        //already have values for penid, svcdata, revtype, the defined
        //key field, and the subkey field (if defined for the type).
        if(read) { 
            displayReviewForm(pen, crev);
            if(crev.penid !== app.pen.currPenId()) {  //not our review
                if(action === "helpful") {
                    app.review.helpful("set"); }
                else if(action === "remember") {
                    app.review.memo(); }
                else if(action === "respond") {
                    app.review.respond(); } } }
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
            app.pen.getPen(function (pen) {
                mainDisplay(pen, false, action, errmsg); 
            }); },
        displayRead: function (action) {
            app.pen.getPen(function (pen) {
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
            app.byId('respondtxttd').style.color = "#666666";
            setTimeout(function () {
                app.pen.getPen(function (pen) {
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
            return foundHelpful(revid, penref); },
        ratmenusel: function (rating) {
            ratingMenuSelect(rating); }
    };

});


