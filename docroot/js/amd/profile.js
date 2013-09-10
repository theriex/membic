/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, glo: false, require: false, navigator: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . p r o f i l e
//
// Display a pen name and provide for updating settings.  Cached data
// off the currently displayed pen name reference:
//
//   penref.profstate:
//     seltabname: name of selected display tab
//     revtype: name of selected review type (shared by best and allrevs)
//     allRevsState:
//       srchval: the search query value
//       cursor: cursor for continuing to load more matching reviews
//       total: count of reviews searched
//       reqs: count of times the search was manually requested
//       revs: matching fetched reviews
//       autopage: timeout for auto paging to max when no matches found
//       querymon: timeout for monitoring the query input string
//     recentRevState:
//       params: parameters for search
//       results: recent reviews found
//       cursor: cursor for continuing to load more recent reviews
//       total: count of records searched so far
//

define([], function () {
    "use strict";

    var greytxt = "#999999",
        unspecifiedCityText = "City not specified",
        profpenref,


    verifyProfileState = function (penref) {
        if(!penref) {
            penref = profpenref; }
        if(penref.pen && typeof penref.pen.top20s === "string") {
            penref.pen.top20s = glo.dojo.json.parse(penref.pen.top20s); }
        if(!penref.profstate) {
            penref.profstate = { seltabname: 'recent',
                                 revtype: "" }; }
        if(!penref.profstate.revtype && penref.pen.top20s) {
            penref.profstate.revtype = penref.pen.top20s.latestrevtype; }
        if(!penref.profstate.revtype) {
            penref.profstate.revtype = 'book'; }
    },


    //Drop all cached information from the given penref and rebuild
    //it.  The state should be dropped if a review was created or
    //updated.  It does not yet make sense to attempt to recompute
    //things locally in addition to on the server.  Ultimately saving
    //a review might insert/replace the newrev from the recent
    //reviews, insert into allrevs if matched, and reload the top20s
    //(if the pen wasn't just loaded).  For now this just clears the
    //local cache to trigger a rebuild.
    resetReviewDisplays = function (penref) {
        penref.profstate = null;
        verifyProfileState(penref);
    },


    resetStateVars = function () {
        profpenref = null;
    },


    verifyStateVariableValues = function (pen) {
        profpenref = glo.lcs.getPenRef(pen);
        verifyProfileState(profpenref);
    },


    createOrEditRelationship = function () {
        glo.rel.reledit(glo.pen.currPenRef().pen, profpenref.pen);
    },


    updateTopActionDisplay = function (pen) {
        var html;
        if(!glo.byId('homepenhdiv')) {
            glo.login.updateAuthentDisplay(); }
        html = "<div class=\"topnavitemdiv\">" +
            glo.imgntxt("profile.png", "",
                        "glo.profile.display()",
                        "#view=profile&profid=" + glo.instId(pen),
                        "Show profile for " + pen.name + " (you)") +
            "</div>";
        glo.out('homepenhdiv', html);
        html = glo.imgntxt("settings.png", "", 
                           "glo.profile.settings()",
                           "#Settings",
                           "Adjust your application settings");
        glo.out('settingsbuttondiv', html);
    },


    displayProfileHeading = function (homepen, dispen, directive) {
        var html, id, name, relationship;
        id = glo.instId(dispen);
        name = dispen.name;
        html = "<a href=\"#view=profile&profid=" + id + "\"" +
                 " title=\"Show profile for " + name + "\"" +
                 " onclick=\"glo.profile.byprofid('" + id + "');" + 
                            "return false;\"" +
               ">" + name + "</a>";
        html = "<div id=\"profhdiv\">" +
                 "<span id=\"penhnamespan\">" + html + "</span>" +
                 "<span id=\"penhbuttonspan\"> </span>" +
               "</div>";
        glo.out('centerhdiv', html);
        html = "";
        if(glo.instId(homepen) !== glo.instId(dispen) &&
           directive !== "nosettings") {
            if(glo.rel.relsLoaded()) {
                relationship = glo.rel.outbound(id);
                glo.profile.verifyStateVariableValues(dispen);
                if(relationship) {
                    html = glo.imglink("#Settings",
                                       "Adjust follow settings for " + name,
                                       "glo.profile.relationship()", 
                                       "settings.png"); }
                else {
                    html = glo.imglink("#Follow",
                                       "Follow " + name + " reviews",
                                       "glo.profile.relationship()",
                                       "follow.png"); } }
            else {  
                //Happens if you go directly to someone's profile via url
                //and rels are loading slowly.  Not known if you are following
                //them yet.  The heading updates after the rels are loaded.
                html = "..."; } }
        glo.out('penhbuttonspan', html);
    },


    writeNavDisplay = function (homepen, dispen, directive) {
        if(!dispen) {
            dispen = homepen; }
        updateTopActionDisplay(homepen);
        displayProfileHeading(homepen, dispen, directive);
    },


    setPenNameFromInput = function (pen) {
        var pennamein = glo.byId('pennamein');
        if(!pen) {
            pen = profpenref.pen; }
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    savePenNameSettings = function () {
        var pen = glo.pen.currPenRef().pen;
        setPenNameFromInput(pen);
        glo.skinner.save(pen);
        glo.pen.updatePen(pen,
                          function () {
                              glo.layout.closeDialog();
                              glo.profile.display(); },
                          function (code, errtxt) {
                              glo.out('settingsmsgtd', errtxt); });
    },


    cancelPenNameSettings = function (actionTxt) {
        glo.skinner.cancel();
        glo.layout.closeDialog();
        if(actionTxt && typeof actionTxt === "string") {
            //nuke the main display as we are about to rebuild contents
            glo.out('centerhdiv', "");
            glo.out('cmain', actionTxt); }
    },


    nameForAuthType = function (authtype) {
        switch(authtype) {
        case "mid": return "MyOpenReviews";
        case "gsid": return "Google+";
        case "fbid": return "Facebook";
        case "twid": return "Twitter";
        case "ghid": return "GitHub"; }
    },


    displayAuthSettings = function (domid, pen) {
        var atname, html;
        html = "<div id=\"accountdiv\">" + glo.login.loginInfoHTML(pen) + 
            "</div>" +
            "Access \"" + pen.name + "\" via: " +
            "<table>";
        //MyOpenReviews
        atname = nameForAuthType("mid");
        html += "<tr><td><input type=\"checkbox\" name=\"aamid\"" +
            " value=\"" + atname + "\" id=\"aamid\"" +
            " onchange=\"glo.profile.toggleAuthChange('mid','" + 
                             domid + "');return false;\"";
        if(glo.isId(pen.mid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aamid\">" + atname + "</label></td></tr>";
        html += "<tr>";
        //Facebook
        atname = nameForAuthType("fbid");
        html += "<td><input type=\"checkbox\" name=\"aafbid\"" +
            " value=\"" + atname + "\" id=\"aafbid\"" +
            " onchange=\"glo.profile.toggleAuthChange('fbid','" + 
                             domid + "');return false;\"";
        if(glo.isId(pen.fbid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aafbid\">" + atname + "</label></td>";
        //Twitter
        atname = nameForAuthType("twid");
        html += "<td><input type=\"checkbox\" name=\"aatwid\"" +
            " value=\"" + atname + "\" id=\"aatwid\"" +
            " onchange=\"glo.profile.toggleAuthChange('twid','" + 
                             domid + "');return false;\"";
        if(glo.isId(pen.twid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aatwid\">" + atname + "</label></td>";
        html += "</tr><tr>";
        //Google+
        atname = nameForAuthType("gsid");
        html += "<td><input type=\"checkbox\" name=\"aagsid\"" +
            " value=\"" + atname + "\" id=\"aagsid\"" +
            " onchange=\"glo.profile.toggleAuthChange('gsid','" + 
                             domid + "');return false;\"";
        if(glo.isId(pen.gsid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aagsid\">" + atname + "</label></td>";
        //GitHub
        atname = nameForAuthType("ghid");
        html += "<td><input type=\"checkbox\" name=\"aaghid\"" +
            " value=\"" + atname + "\" id=\"aaghid\"" +
            " onchange=\"glo.profile.toggleAuthChange('ghid','" + 
                             domid + "');return false;\"";
        if(glo.isId(pen.ghid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aaghid\">" + atname + "</label></td>";
        html += "</tr></table>";
        glo.out(domid, html);
    },


    addMyOpenReviewsAuth = function (domid, pen) {
        var html = "<form action=\"" + glo.secsvr + "/loginid\"" +
                        " enctype=\"multipart/form-data\" method=\"post\">" +
        "<table>" +
          "<tr>" + 
            "<td colspan=\"2\">Adding native authorization to " + pen.name + 
            ":</td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">username</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"userin\" name=\"userin\"" + 
                    " size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">password</td>" +
            "<td align=\"left\">" +
              "<input type=\"password\" id=\"passin\" name=\"passin\"" + 
                    " size=\"20\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<input type=\"submit\" value=\"Log in\">" +
            "</td>" +
          "</tr>" +
        "</table></form>";
        glo.out(domid, html);
    },


    handleAuthChangeToggle = function (pen, authtype, domid) {
        var action = "remove", methcount, previd;
        if(glo.byId("aa" + authtype).checked) {
            action = "add"; }
        if(action === "remove") {
            methcount = (pen.mid? 1 : 0) +
                (pen.gsid? 1 : 0) +
                (pen.fbid? 1 : 0) +
                (pen.twid? 1 : 0) +
                (pen.ghid? 1 : 0);
            if(methcount < 2) {
                alert("You must have at least one authentication type.");
                glo.byId("aa" + authtype).checked = true;
                return;  } 
            if(authtype === glo.login.getAuthMethod()) {
                alert("You can't remove the authentication you are " +
                      "currently logged in with.");
                glo.byId("aa" + authtype).checked = true;
                return;  } 
            if(confirm("Are you sure you want to remove access to this" +
                       " Pen Name from " + nameForAuthType(authtype) + "?")) {
                glo.out(domid, "Updating...");
                previd = pen[authtype];
                pen[authtype] = 0;
                glo.pen.updatePen(pen,
                                  function (updpen) {
                                      displayAuthSettings(domid, updpen); },
                                  function (code, errtxt) {
                                      glo.err("handleAuthChangeToggle error " +
                                              code + ": " + errtxt);
                                      pen[authtype] = previd;
                                      displayAuthSettings(domid, pen); }); }
            else {
                glo.byId("aa" + authtype).checked = true; } }
        else if(action === "add") {
            switch(authtype) {
            case "mid": 
                addMyOpenReviewsAuth(domid, pen); break;
            case "fbid": 
                require([ "ext/facebook" ],
                        function (facebook) {
                            if(!glo.facebook) { glo.facebook = facebook; }
                            facebook.addProfileAuth(domid, pen); });
                break;
            case "twid":
                require([ "ext/twitter" ],
                        function (twitter) {
                            if(!glo.twitter) { glo.twitter = twitter; }
                            twitter.addProfileAuth(domid, pen); });
                break;
            case "gsid":
                require([ "ext/googleplus" ],
                        function (googleplus) {
                            if(!glo.googleplus) { glo.googleplus = googleplus; }
                            googleplus.addProfileAuth(domid, pen); });
                break;
            case "ghid":
                require([ "ext/github" ],
                        function (github) {
                            if(!glo.github) { glo.github = github; }
                            github.addProfileAuth(domid, pen); });
                break;
            } }
    },


    changeToSelectedPen = function () {
        var i, sel = glo.byId('penselect'), temp = "";
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                //do not call cancelPenNameSettings before done accessing
                //the selection elementobjects or IE8 has issues.
                if(sel.options[i].id === 'newpenopt') {
                    cancelPenNameSettings("Creating new pen name...");
                    glo.pen.newPenName(glo.profile.display); }
                else {
                    temp = sel.options[i].value;
                    cancelPenNameSettings("Switching pen names...");
                    glo.pen.selectPenByName(temp); }
                break; } }
    },


    penSelectHTML = function (pen) {
        var html, pens = glo.pen.getPenNames(), i;
        html = "<div id=\"penseldiv\">" +
            "<span class=\"headingtxt\">Writing as </span>" +
            "<select id=\"penselect\"" + 
                   " onchange=\"glo.profile.switchPen();return false;\">";
        for(i = 0; i < pens.length; i += 1) {
            html += "<option id=\"" + glo.instId(pens[i]) + "\"";
            if(pens[i].name === pen.name) {
                html += " selected=\"selected\""; }
            html += ">" + pens[i].name + "</option>"; }
        html += "<option id=\"newpenopt\">New Pen Name</option>" +
            "</select>" + "&nbsp;" + 
            "<button type=\"button\" id=\"penselectok\"" + 
            " onclick=\"glo.profile.switchPen();return false;\"" +
            ">go</button>" +
            "</div>";
        return html;
    },


    changeSettings = function (pen) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"glo.profile.cancelPenNameSettings();return false;\"" +
            ">&lt;close&nbsp;&nbsp;X&gt;</a></div>" + 
            "<div class=\"floatclear\"></div>" +
          "<table>" +
            "<tr>" +
              "<td colspan=\"2\" align=\"left\" id=\"pensettitletd\">" +
                penSelectHTML(pen) + "</td>" +
            "</tr>" +
            "<tr>" +
              "<td colspan=\"2\" id=\"settingsmsgtd\"></td>" +
            "</tr>" +
            "<tr>" +
              "<td rowspan=\"2\" align=\"right\" valign=\"top\">" + 
                "<img src=\"img/penname.png\" alt=\"Pen Name\"/></td>" +
              "<td align=\"left\">" +
                "<input type=\"text\" id=\"pennamein\" size=\"25\"" + 
                      " value=\"" + pen.name + "\"/></td>" +
            "</tr>" +
            "<tr>" +
              //td from previous row
              "<td id=\"settingsauthtd\"></td>" +
            "</tr>" +
            "<tr>" +
              "<td colspan=\"2\" id=\"settingsskintd\"></td>" +
            "</tr>" +
            "<tr>" + 
              "<td colspan=\"2\" id=\"consvcstd\"></td>" +
            "</tr>" +
            "<tr>" +
              "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
                "<button type=\"button\" id=\"savebutton\">Save</button>" +
              "</td>" +
            "</tr>" +
          "</table>";
        glo.out('dlgdiv', html);
        glo.onchange('pennamein', glo.profile.setPenNameFromInput);
        glo.onclick('savebutton', savePenNameSettings);
        displayAuthSettings('settingsauthtd', pen);
        glo.services.display('consvcstd', pen);
        glo.skinner.init('settingsskintd', pen);
        glo.byId('dlgdiv').style.visibility = "visible";
        if(glo.isLowFuncBrowser()) {
            glo.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        glo.onescapefunc = cancelPenNameSettings;
    },


    addMyOpenReviewsAuthId = function (pen, mid) {
        var previd;
        if(!mid) {
            glo.err("No account ID received.");
            glo.profile.display(); }
        else {
            previd = pen.mid;
            pen.mid = mid;
            glo.pen.updatePen(pen,
                              function (updpen) {
                                  changeSettings(updpen); },
                              function (code, errtxt) {
                                  glo.err("addMyOpenReviewsAuthId error " +
                                          code + ": " + errtxt);
                                  pen.mid = previd;
                                  glo.profile.display(); }); }
    },


    mailButtonHTML = function () {
        var html, href, subj, body, types, revchecks, i, ts, mepen;
        mepen = glo.pen.currPenRef().pen;
        subj = "Sharing experiences through reviews";
        body = "Hey,\n\n" +
            "I'm using MyOpenReviews for things I experience. " + 
            "I trust your taste, and would be interested in reading reviews " + 
            "from you";
        revchecks = document.getElementsByName("invrevcb");
        types = "";
        for(i = 0; i < revchecks.length; i += 1) {
            if(revchecks[i].checked) {
                if(types) {
                    types += ","; }
                types += revchecks[i].value; } }
        if(types) {
            ts = types.split(",");
            types = "";
            for(i = 0; i < ts.length; i += 1) {
                if(i > 0) {
                    if(i === ts.length - 1) {
                        types += " and "; }
                    else {
                        types += ", "; } }
                types += ts[i]; }
            body += ", especially about " + types + "."; }
        else {
            body += "."; }
        body += " If you sign up, then I'll be able to follow reviews " +
            "from you to learn about things you've experienced." + 
            "\n\n" +
            "If you are interested in following reviews from me, " + 
            "click the 'follow' icon next to '" + mepen.name +
            "' on my profile page. Here's the direct link to my profile:\n\n" +
            "    " + glo.mainsvr + "/#view=profile&profid=" +
            glo.instId(mepen) + "\n\n" +
            "When I see you in my 'Followers' tab, I'll follow back. " +
            "Looking forward to learning about things you've experienced " +
            "recently!" +
            "\n\n" +
            "cheers,\n" + 
            mepen.name + 
            "\n\n";
        href = "mailto:?subject=" + glo.dquotenc(subj) + 
            "&body=" + glo.dquotenc(body);
        html = glo.services.serviceLinkHTML(href, "", "shareico", 
                                            "Invite via eMail",
                                            "img/email.png");
        return html;
    },


    updateInviteInfo = function () {
        glo.out('mailbspan', mailButtonHTML());
    },


    displayInvitationDialog = function () {
        var html;
        html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"glo.layout.closeDialog();return false;\"" +
            ">&lt;close&nbsp;&nbsp;X&gt;</a></div>" + 
            "<div class=\"floatclear\"></div>" +
            "<div class=\"headingtxt\">" + 
            "Build your community... Invite a friend</div>" +
          "<table class=\"formstyle\">" +
            "<tr><td id=\"invintrotd\" style=\"width:400px;\">" +
              "<p>Know someone whose taste you trust?<br/>" + 
              "Want to share your reviews?</p>" +
              "<p>What types of reviews " +
              "would you be most interested in seeing from them?</p>" +
            "</td></tr>" +
            "<tr><td id=\"invtypestd\">" + 
              glo.review.reviewTypeCheckboxesHTML("invrevcb", 
                                                  "glo.profile.chginvite") +
            "</td></tr>" +
            "<tr><td>" + 
              "Invite your friend to join:" +
            "</td></tr>" +
            "<tr><td align=\"center\">" + 
              "<span id=\"mailbspan\"></span>" +
            "</td></tr>" +
          "</table>";
        glo.out('dlgdiv', html);
        glo.byId('dlgdiv').style.visibility = "visible";
        if(glo.isLowFuncBrowser()) {
            glo.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        glo.onescapefunc = glo.layout.closeDialog;
        updateInviteInfo();
    },


    badgeDispHTML = function (pen) {
        var html, i, reviewTypes, typename;
        html = "";
        glo.pen.deserializeFields(pen);
        reviewTypes = glo.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(pen.top20s[typename] && pen.top20s[typename].length >= 20) {
                html += glo.review.badgeImageHTML(reviewTypes[i]); } }
        return html;
    },


    penListItemHTML = function (pen) {
        var penid = glo.instId(pen), picuri, hash, linktitle, html;
        hash = glo.objdata({ view: "profile", profid: penid });
        linktitle = glo.ellipsis(pen.shoutout, 75);
        if(!linktitle) {  //do not encode pen name here.  No "First%20Last"..
            linktitle = "View profile for " + pen.name; }
        html = "<li>" +
            "<a href=\"#" + hash + "\"" +
            " onclick=\"glo.profile.byprofid('" + penid + "');return false;\"" +
            " title=\"" + linktitle + "\">";
        //empytprofpic.png looks like big checkboxes, use blank instead
        picuri = "img/blank.png";
        if(pen.profpic) {
            picuri = "profpic?profileid=" + penid; }
        html += "<img class=\"srchpic\" src=\"" + picuri + "\"" + 
                    " border=\"0\"/>" + "&nbsp;" + 
            "<span class=\"penfont\">" + pen.name + 
            "</span>" + "</a>";
        if(pen.city) {
            html += " <span class=\"smalltext\">(" + pen.city + ")</span>"; }
        html += badgeDispHTML(pen);
        html += "</li>";
        return html;
    },


    findOrLoadPen = function (penid, callback) {
        glo.lcs.getPenFull(penid, function (penref) {
            callback(penref.pen); });
    },


    tablink = function (text, funcstr) {
        var html;
        if(funcstr.indexOf(";") < 0) {
            funcstr += ";"; }
        html = "<a href=\"#" + text + "\"" +
                 " title=\"Click to see " + text + "\"" +
                 " onclick=\"" + funcstr + "return false;\">" + 
               text + "</a>";
        return html;
    },


    readReview = function (revid) {
        var revobj;
        revobj = glo.lcs.getRevRef(revid).rev;
        //Make some noise if you can't find it rather than being a dead link
        if(!revobj) {
            glo.err("readReview " + revid + " not found");
            return; }
        glo.history.checkpoint({ view: "review", mode: "display",
                                 revid: revid });
        glo.review.setCurrentReview(revobj);
        glo.review.displayRead();
    },


    reviewItemHTML = function (revobj, penNameStr) {
        var revid, type, linkref, linkclass, html;
        //review item line
        revid = glo.instId(revobj);
        type = glo.review.getReviewTypeByValue(revobj.revtype);
        linkref = "statrev/" + revid;
        linkclass = glo.review.foundHelpful(revid)? "rslcbold" : "rslc";
        html = "<li>" + glo.review.starsImageHTML(revobj.rating) + 
            glo.review.badgeImageHTML(type) + "&nbsp;" +
            "<a id=\"lihr" + revid + "\" href=\"" + linkref + "\"" +
              " onclick=\"glo.profile.readReview('" + revid + "');" + 
                         "return false;\"" +
              " class=\"" + linkclass + "\"" +
              " title=\"See full review\">";
        if(type.subkey) {
            html += "<i>" + glo.ellipsis(revobj[type.key], 60) + "</i> " +
                glo.ellipsis(revobj[type.subkey], 40); }
        else {
            html += glo.ellipsis(revobj[type.key], 60); }
        html += "</a>";
        if(revobj.url) {
            html += " &nbsp;" + glo.review.graphicAbbrevSiteLink(revobj.url); }
        //review meta line
        html += "<div class=\"revtextsummary\">";
        if(penNameStr) {
            linkref = glo.objdata({ view: "profile", profid: revobj.penid });
            html += "review by " + 
                "<a href=\"#" + linkref + "\"" +
                 " onclick=\"glo.profile.byprofid('" + revobj.penid + "');" +
                            "return false;\"" +
                 " title=\"Show profile for " + glo.ndq(penNameStr) + "\"" +
                ">" + penNameStr + "</a>"; }
        if(revobj.keywords) {
            if(penNameStr) {
                html += ": "; }
            html += glo.ellipsis(revobj.keywords, 100); }
        html += glo.review.linkCountHTML(revid);
        html += "</div>";
        //review description line
        if(revobj.text) {
            html += "<div class=\"revtextsummary\">" + 
                glo.ellipsis(revobj.text, 255) + "</div>"; }
        html += "</li>";
        return html;
    },


    displayRecentReviews = function (rrs, reviews) {
        var i, html, fetched;
        html = "<ul class=\"revlist\">";
        if(!rrs.results) {
            rrs.results = []; }
        for(i = 0; i < rrs.results.length; i += 1) {
            html += reviewItemHTML(rrs.results[i]); }
        if(reviews) {  //have fresh search results
            rrs.cursor = "";
            for(i = 0; i < reviews.length; i += 1) {
                if(reviews[i].fetched) {
                    fetched = reviews[i].fetched;
                    if(typeof fetched === "number" && fetched >= 0) {
                        rrs.total += reviews[i].fetched;
                        html += "<div class=\"sumtotal\">" +
                            rrs.total + " reviews searched</div>"; }
                    if(reviews[i].cursor) {
                        rrs.cursor = reviews[i].cursor; }
                    break; }  //if no reviews, i will be left at zero
                glo.lcs.putRev(reviews[i]);  //ensure cached
                rrs.results.push(reviews[i]);
                html += reviewItemHTML(reviews[i]); } }
        rrs.total = Math.max(rrs.total, rrs.results.length);
        if(rrs.total === 0) {
            html += "<li>No recent reviews.";
            if(glo.instId(profpenref.pen) === glo.pen.currPenId()) {
                html += " " + glo.review.reviewLinkHTML(); }
            html += "</li>"; }
        html += "</ul>";
        if(rrs.cursor) {
            if(i === 0 && rrs.results.length === 0) {
                if(rrs.total < 2000) {  //auto-repeat search
                    setTimeout(glo.profile.revsmore, 10); } 
                else {
                    html += "No recent reviews found, only batch updates."; } }
            else {
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"glo.profile.revsmore();" +
                                     "return false;\"" +
                          " title=\"More reviews\"" + 
                    ">more reviews...</a>"; } }
        glo.out('profcontdiv', html);
        glo.layout.adjust();
        setTimeout(function () {
            glo.lcs.verifyReviewLinks(glo.profile.refresh); }, 250);
    },


    findRecentReviews = function (rrs) {  //recentRevState
        var params, critsec = "";
        params = glo.objdata(rrs.params) + "&" + glo.login.authparams();
        if(rrs.cursor) {
            params += "&cursor=" + glo.enc(rrs.cursor); }
        glo.call("srchrevs?" + params, 'GET', null,
                 function (revs) {
                     displayRecentReviews(rrs, revs); },
                 function (code, errtxt) {
                     glo.out('profcontdiv', "findRecentReviews failed code " + 
                             code + " " + errtxt); },
                 critsec);
    },


    displayRecent = function () {
        var rrs, html, maxdate, mindate;
        if(profpenref.profstate.recentRevState) {
            return displayRecentReviews(profpenref.profstate.recentRevState); }
        html = "Retrieving recent activity for " + profpenref.pen.name + "...";
        glo.out('profcontdiv', html);
        glo.layout.adjust();
        profpenref.profstate.recentRevState = rrs = { 
            params: {},
            cursor: "",
            results: [],
            total: 0 };
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        rrs.params.maxdate = maxdate.toISOString();
        rrs.params.mindate = mindate.toISOString();
        rrs.params.penid = glo.instId(profpenref.pen);
        findRecentReviews(rrs);
    },


    revTypeSelectorHTML = function (clickfuncstr) {
        var html, i, reviewTypes, typename, label, dispclass, pen, prefixstr;
        prefixstr = "Top 20 ";
        if(clickfuncstr && clickfuncstr.indexOf("Top") < 0) {
            prefixstr = "20+ "; }
        pen = profpenref.pen;
        html = "";
        glo.pen.deserializeFields(pen);
        reviewTypes = glo.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            dispclass = "reviewbadgedis";
            label = "No " + reviewTypes[i].type.capitalize() + " reviews.";
            if(pen.top20s[typename]) {
                if(pen.top20s[typename].length >= 20) {
                    label = prefixstr + reviewTypes[i].type.capitalize() +
                        " reviews.";
                    dispclass = "reviewbadge"; }
                else if(pen.top20s[typename].length >= 1) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].type.capitalize() + " reviews.";
                    dispclass = "reviewbadge"; } }
            html += "<img" + 
                " class=\"" + dispclass + "\"" +
                " src=\"img/" + reviewTypes[i].img + "\"" +
                " title=\"" + label + "\"" +
                " alt=\"" + label + "\"" +
                " onclick=\"" + clickfuncstr + "('" + typename + "');" +
                           "return false;\"" +
                "/>"; }
        return html;
    },


    displayBest = function () {
        var state, html, revs, i, revref;
        state = profpenref.profstate;
        html = revTypeSelectorHTML("glo.profile.showTopRated");
        revs = [];
        if(profpenref.pen.top20s) {
            revs = profpenref.pen.top20s[state.revtype] || []; }
        html += "<ul class=\"revlist\">";
        if(revs.length === 0) {
            html += "<li>No top rated " + state.revtype + " reviews.";
            if(glo.instId(profpenref.pen) === glo.pen.currPenId()) {
                html += " " + glo.review.reviewLinkHTML(); }
            html += "</li>"; }
        for(i = 0; i < revs.length; i += 1) {
            revref = glo.lcs.getRevRef(revs[i]);
            if(revref.rev) {
                html += reviewItemHTML(revref.rev); }
            //if revref.status deleted or other error, then just skip it
            else if(revref.status === "not cached") {
                html += "<li>Fetching review " + revs[i] + "...</li>";
                break; } }
        html += "</ul>";
        glo.out('profcontdiv', html);
        glo.layout.adjust();
        if(i < revs.length) { //didn't make it through, fetch and redisplay
            glo.lcs.getRevFull(revs[i], displayBest); }
        else {
            setTimeout(function () {
                glo.lcs.verifyReviewLinks(glo.profile.refresh); }, 250); }
    },


    clearAllRevProfWorkState = function () {
        var state = profpenref.profstate.allRevsState;
        //does not reset allRevsState.srchval or revtype
        if(state && state.autopage) {
            window.clearTimeout(state.autopage);
            state.autopage = null; }
        if(state && state.querymon) {
            window.clearTimeout(state.querymon);
            state.querymon = null; }
        state.cursor = "";
        state.total = 0;
        state.reqs = 1;
        state.revs = [];
    },


    allrevMaxAutoSearch = function () {
        var maxauto = 1000,
            ttl = profpenref.profstate.allRevsState.total,
            contreqs = profpenref.profstate.allRevsState.reqs;
        if(ttl >= (maxauto * contreqs)) {
            return true; }
        return false;
    },


    listAllRevs = function (results) {
        var html, i, state = profpenref.profstate.allRevsState;
        html = "<ul class=\"revlist\">";
        for(i = 0; i < state.revs.length; i += 1) {
            html += reviewItemHTML(state.revs[i]); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        state.cursor = "";  //used, so reset
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                state.total += results[i].fetched;
                html += "<div class=\"sumtotal\">" +
                    state.total + " reviews searched</div>";
                if(results[i].cursor) {
                    state.cursor = results[i].cursor; }
                break; }  //leave i at its current value
            state.revs.push(results[i]);
            html += reviewItemHTML(results[i]); }
        html += "</ul>";
        if(state.cursor) {
            if(i === 0 && !allrevMaxAutoSearch()) {
                //auto-repeat the search to try get a result to display
                state.autopage = window.setTimeout(glo.profile.searchAllRevs,
                                                   10); }
            else {
                if(allrevMaxAutoSearch()) {  //they continued search manually
                    state.reqs += 1; }
                html += "<a href=\"#continuesearch\"" +
                    " onclick=\"glo.profile.searchAllRevs();return false;\"" +
                    " title=\"Continue searching for more matching reviews\"" +
                    ">continue search...</a>"; } }
        glo.out('allrevdispdiv', html);
        setTimeout(function () {
            glo.lcs.verifyReviewLinks(glo.profile.refresh); }, 250);
    },


    monitorAllRevQuery = function () {
        var state, srchin, qstr = "";
        state = profpenref.profstate;
        srchin = glo.byId('allrevsrchin');
        if(!srchin) {  //probably switched tabs, quit
            return; }
        qstr = srchin.value;
        if(qstr !== state.allRevsState.srchval) {
            if(state.allRevsState.querymon) {
                window.clearTimeout(state.allRevsState.querymon);
                state.allRevsState.querymon = null; }
            glo.profile.searchAllRevs(); }
        else {
            state.allRevsState.querymon = setTimeout(monitorAllRevQuery, 400); }
    },


    displayAllRevs = function () {
        var html, state;
        state = profpenref.profstate.allRevsState;
        if(!state) {
            state = profpenref.profstate.allRevsState = {
                srchval: "",
                revs: [],
                cursor: "",
                total: 0,
                reqs: 1 }; }
        html = revTypeSelectorHTML("glo.profile.searchRevsIfTypeChange");
        html += "<div id=\"allrevsrchdiv\">" +
            "<input type=\"text\" id=\"allrevsrchin\" size=\"40\"" +
                  " placeholder=\"Review title or name\"" + 
                  " value=\"" + state.srchval + "\"" +
                  " onchange=\"glo.profile.allrevs();return false;\"" +
            "/></div>" +
            "<div id=\"allrevdispdiv\"></div>";
        glo.out('profcontdiv', html);
        glo.byId('allrevsrchin').focus();
        if(state.revs.length > 0) {
            listAllRevs([]);  //display previous results
            monitorAllRevQuery(); }
        else {
            clearAllRevProfWorkState();
            glo.profile.searchAllRevs(); }
    },


    searchAllRevs = function (revtype) {
        var state, qstr, maxdate, mindate, params, critsec = "";
        state = profpenref.profstate;
        if(revtype) {
            if(state.revtype !== revtype) {
                state.revtype = revtype;
                clearAllRevProfWorkState(); } }
        else {
            revtype = state.revtype; }
        qstr = glo.byId('allrevsrchin').value;
        if(qstr !== state.allRevsState.srchval) {
            state.allRevsState.srchval = qstr;
            clearAllRevProfWorkState(); }
        maxdate = (new Date()).toISOString();
        mindate = (new Date(0)).toISOString();
        params = glo.login.authparams() +
            "&qstr=" + glo.enc(glo.canonize(qstr)) +
            "&revtype=" + revtype +
            "&penid=" + glo.instId(profpenref.pen) +
            "&maxdate=" + maxdate + "&mindate=" + mindate +
            "&cursor=" + glo.enc(state.allRevsState.cursor);
        glo.call("srchrevs?" + params, 'GET', null,
                 function (results) { 
                     glo.lcs.putRevs(results);
                     listAllRevs(results);
                     monitorAllRevQuery(); },
                 function (code, errtxt) {
                     glo.err("searchAllRevs call died code: " + code + " " +
                             errtxt); },
                 critsec);
    },


    displayFollowing = function () {
        glo.rel.displayRelations(profpenref.pen, "outbound", "profcontdiv");
        glo.layout.adjust();
    },


   displayFollowers = function () {
        glo.rel.displayRelations(profpenref.pen, "inbound", "profcontdiv");
        glo.layout.adjust();
    },


    setCurrTabFromString = function (tabstr) {
        var profstate;
        verifyProfileState(profpenref);
        profstate = profpenref.profstate;
        switch(tabstr) {
        case "recent": profstate.seltabname = "recent"; break;
        case "best": profstate.seltabname = "best"; break;
        case "allrevs": profstate.seltabname = "allrevs"; break;
        case "following": profstate.seltabname = "following"; break;
        case "followers": profstate.seltabname = "followers"; break;
        }
    },


    refreshContentDisplay = function () {
        switch(profpenref.profstate.seltabname) {
        case "recent": displayRecent(); break;
        case "best": displayBest(); break;
        case "allrevs": displayAllRevs(); break;
        case "following": displayFollowing(); break;
        case "followers": displayFollowers(); break;
        }
    },


    tabselect = function (tabname) {
        var i, ul, li;
        verifyProfileState(profpenref);
        if(tabname) {
            profpenref.profstate.seltabname = tabname; }
        else {
            tabname = profpenref.profstate.seltabname; }
        ul = glo.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = glo.skinner.darkbg(); }
        li = glo.byId(tabname + "li");
        li.className = "selectedTab";
        li.style.backgroundColor = "transparent";
        glo.history.checkpoint({ view: "profile", 
                                 profid: glo.instId(profpenref.pen),
                                 tab: tabname });
        refreshContentDisplay();
    },


    displayTabs = function (penref) {
        var html;
        verifyProfileState(penref);
        html = "<ul id=\"proftabsul\">" +
          "<li id=\"recentli\" class=\"selectedTab\">" + 
            tablink("Recent Reviews", "glo.profile.tabselect('recent')") + 
          "</li>" +
          "<li id=\"bestli\" class=\"unselectedTab\">" +
            tablink("Top Rated", "glo.profile.tabselect('best')") + 
          "</li>" +
          "<li id=\"allrevsli\" class=\"unselectedTab\">" +
            tablink("All Reviews", "glo.profile.tabselect('allrevs')") +
          "</li>" +
          "<li id=\"followingli\" class=\"unselectedTab\">" +
            tablink("Following (" + penref.pen.following + ")", 
                    "glo.profile.tabselect('following')") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers (" + penref.pen.followers + ")", 
                    "glo.profile.tabselect('followers')") + 
          "</li>";
        html += "</ul>";
        glo.out('proftabsdiv', html);
        tabselect();
    },


    profileModAuthorized = function (pen) {
        if(glo.isId(pen.mid) || glo.isId(pen.gsid) || glo.isId(pen.fbid) || 
           glo.isId(pen.twid) || glo.isId(pen.ghid)) {
            return true; }
        return false;
    },


    cancelProfileEdit = function () {
        glo.profile.updateHeading();
        glo.profile.display();
    },


    profEditFail = function (code, errtxt) {
        glo.out('sysnotice', errtxt);
    },


    saveEditedProfile = function (pen) {
        var elem;
        elem = glo.byId('profcityin');
        if(elem) {
            pen.city = elem.value; }
        elem = glo.byId('shouttxt');
        if(elem) {
            pen.shoutout = elem.value; }
        glo.pen.updatePen(pen, glo.profile.display, profEditFail);
    },


    displayProfEditButtons = function () {
        var html;
        if(glo.byId('profcancelb')) {
            return; }  //already have buttons
        html = "&nbsp;" +
            "<button type=\"button\" id=\"profcancelb\">Cancel</button>" +
            "&nbsp;" +
            "<button type=\"button\" id=\"profsaveb\">Save</button>";
        glo.out('profeditbspan', html);
        glo.onclick('profcancelb', cancelProfileEdit);
        glo.onclick('profsaveb', glo.profile.save);
    },


    styleShout = function (shout) {
        var target;
        shout.style.color = glo.colors.text;
        shout.style.backgroundColor = glo.skinner.lightbg();
        //80px left margin + 160px image + padding
        //+ balancing right margin space (preferable)
        //but going much smaller than the image is stupid regardless of
        //screen size
        target = Math.max((glo.winw - 350), 200);
        target = Math.min(target, 600);
        shout.style.width = target + "px";
        //modify profcontdiv so it balances the text area size.  This is
        //needed so IE8 doesn't widen profpictd unnecessarily.
        target += glo.byId('profpictd').offsetWidth;
        target += 50;  //arbitrary extra to cover padding
        glo.byId('profcontdiv').style.width = String(target) + "px";
    },


    editShout = function (pen) {
        var html, shout;
        html = "<textarea id=\"shouttxt\" class=\"shoutout\"></textarea>";
        glo.out('profshouttd', html);
        shout = glo.byId('shouttxt');
        styleShout(shout);
        shout.readOnly = false;
        shout.value = pen.shoutout;
        shout.focus();
        displayProfEditButtons();
    },


    displayShout = function (pen) {
        var html, shout, text;
        text = "No additional information about " + pen.name;
        if(glo.instId(profpenref.pen) === glo.pen.currPenId()) {
            text = "About me (anything you would like to say to everyone)." + 
                " Link to your twitter handle, blog or site if you want."; }
        text = "<span style=\"color:" + greytxt + ";\">" + text + "</span>";
        html = "<div id=\"shoutdiv\" class=\"shoutout\"></div>";
        glo.out('profshouttd', html);
        shout = glo.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + glo.colors.bodybg;
        text = glo.linkify(pen.shoutout) || text;
        glo.out('shoutdiv', text);
        if(profileModAuthorized(pen)) {
            glo.onclick('shoutdiv', function () {
                editShout(pen); }); }
    },



    saveUnlessShoutEdit = function () {
        if(glo.byId('shoutdiv')) {
            glo.profile.save(); }
    },


    editCity = function () {
        var val, html, elem;
        elem = glo.byId('profcityin');
        if(elem) {
            return; }  //already editing
        val = glo.byId('profcityspan').innerHTML;
        //IE8 actually capitalizes the the HTML for you. Sheesh.
        if(val.indexOf("<a") === 0 || val.indexOf("<A") === 0) {
            val = glo.byId('profcitya').innerHTML; }
        if(val === unspecifiedCityText) {
            val = ""; }
        html = "<input type=\"text\" id=\"profcityin\" size=\"25\"" +
                     " placeholder=\"City or Region\"" +
                     " value=\"" + val + "\"/>";
        glo.out('profcityspan', html);
        displayProfEditButtons();
        glo.onchange('profcityin', saveUnlessShoutEdit);
        glo.byId('profcityin').focus();
    },


    displayCity = function (pen) {
        var html, style = "";
        if(!pen.city) { 
            glo.byId('profcityspan').style.color = greytxt; }
        html = pen.city || unspecifiedCityText;            
        if(!pen.city) {
            style = " style=\"color:" + greytxt + ";\""; }
        if(profileModAuthorized(pen)) {
            html = "<a href=\"#edit city\" title=\"Edit city\"" +
                     " id=\"profcitya\"" + 
                     " onclick=\"glo.profile.editCity();return false;\"" +
                       style + ">" + html + "</a>"; }
        glo.out('profcityspan', html);
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var odiv, html = "";
        html += glo.paramsToFormInputs(glo.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + 
            glo.instId(pen) + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            glo.enc(window.location.href + "#profile") + "\"/>";
        html = "<form action=\"/profpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            "<div id=\"closeline\">" +
              "<a id=\"closedlg\" href=\"#close\"" +
                " onclick=\"glo.cancelPicUpload();return false\">" + 
                  "&lt;close&nbsp;&nbsp;X&gt;</a>" +
            "</div>" + 
            html +
            "<table>" +
              "<tr><td>Upload New Profile Pic</td></tr>" +
              "<tr><td><input type=\"file\" name=\"picfilein\"" + 
                                          " id=\"picfilein\"/></td></tr>" +
              "<tr><td align=\"center\">" +
                    "<input type=\"submit\" value=\"Upload\"/></td></tr>" +
            "</form>";
        glo.out('overlaydiv', html);
        odiv = glo.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = glo.skinner.lightbg();
        glo.onescapefunc = glo.cancelPicUpload;
        glo.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var html = "img/emptyprofpic.png";
        if(pen.profpic) {
            html = "profpic?profileid=" + glo.instId(pen); }
        html = "<img class=\"profpic\" src=\"" + html + "\"/>";
        glo.out('profpictd', html);
        if(profileModAuthorized(pen)) {
            glo.onclick('profpictd', function () {
                if(glo.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    earnedBadgesHTML = function (pen) {
        var html, i, reviewTypes, typename, label, dispclass;
        html = "";
        glo.pen.deserializeFields(pen);
        reviewTypes = glo.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(pen.top20s[typename] && pen.top20s[typename].length >= 1) {
                label = "Top 20 " + reviewTypes[i].plural.capitalize();
                dispclass = "reviewbadge";
                if(pen.top20s[typename].length < 20) {
                    label = String(pen.top20s[typename].length) + " " + 
                        reviewTypes[i].plural.capitalize();
                    dispclass = "reviewbadgedis"; }
                html += "<img" + 
                    " class=\"" + dispclass + "\"" +
                    " src=\"img/" + reviewTypes[i].img + "\"" +
                    " title=\"" + label + "\"" +
                    " alt=\"" + label + "\"" +
                    " onclick=\"glo.profile.showTopRated('" + typename + "');" +
                               "return false;\"" +
                    "/>"; } }
        return html;
    },


    showTopRated = function (typename) {
        verifyProfileState(profpenref);
        profpenref.profstate.revtype = typename;
        displayBest();
    },


    proftopdivHTML = function () {
        var html = "<div id=\"proftopdiv\">" +
        "<table id=\"profdisptable\" border=\"0\">" +
          "<tr>" +
            "<td id=\"sysnotice\" colspan=\"3\">" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profpictd\" rowspan=\"3\">" +
              "<img class=\"profpic\" src=\"img/emptyprofpic.png\"/>" +
            "</td>" +
            "<td id=\"profcitytd\">" +
              "<span id=\"profcityspan\"> </span>" +
              "<span id=\"profeditbspan\"> </span>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profshouttd\" colspan=\"2\" valign=\"top\">" +
              "<div id=\"shoutdiv\" class=\"shoutout\"></div>" +
            "</td>" +
          "</tr>" +
          "<tr>" + 
            "<td id=\"profbadgestd\">" + "</td>" +
            "<td id=\"profcommbuildtd\">" + "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"3\">" +
              "<div id=\"proftabsdiv\"> </div>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"3\">" +
              "<div id=\"profcontdiv\"> </div>" +
            "</td>" +
          "</tr>" +
        "</table></div>";
        return html;
    },


    mainDisplay = function (homepen, dispen, action, errmsg) {
        var html;
        if(!dispen) {
            dispen = homepen; }
        verifyStateVariableValues(dispen);  //sets profpenref
        glo.history.checkpoint({ view: "profile", 
                                 profid: glo.instId(profpenref.pen),
                                 tab: profpenref.profstate.seltabname });
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(homepen, dispen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        glo.skinner.setColorsFromPen(homepen);
        html = proftopdivHTML();
        if(!glo.layout.haveContentDivAreas()) { //change pw kills it
            glo.layout.initContentDivAreas(); }
        glo.out('cmain', html);
        glo.out('profbadgestd', earnedBadgesHTML(dispen));
        if(glo.instId(profpenref.pen) === glo.pen.currPenId()) {
            html = "<a id=\"commbuild\" href=\"#invite\"" + 
                     " onclick=\"glo.profile.invite();return false\">" +
                "<img class=\"reviewbadge\" src=\"img/follow.png\"" + 
                    " border=\"0\">" +
                "Build your community</a>";
            glo.out('profcommbuildtd', html); }
        displayShout(dispen);
        displayCity(dispen);
        displayPic(dispen);
        displayTabs(profpenref);
        glo.layout.adjust();
        if(errmsg) {
            glo.err("Previous processing failed: " + errmsg); }
    },


    displayProfileForId = function (id, tabname) {
        glo.layout.closeDialog(); //close pen name search dialog if open
        resetStateVars();
        findOrLoadPen(id, function (dispen) {
            if(tabname) {
                verifyStateVariableValues(dispen);
                setCurrTabFromString(tabname); }
            glo.pen.getPen(function (homepen) {
                mainDisplay(homepen, dispen); }); });
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function (action, errmsg) {
            glo.pen.getPen(function (homepen) {
                mainDisplay(homepen, null, action, errmsg); }); },
        updateHeading: function () {  //called during startup
            glo.pen.getPen(function (homepen) {
                writeNavDisplay(homepen,
                                profpenref && profpenref.pen); }); },
        refresh: function () {
            glo.pen.getPen(function (homepen) {
                mainDisplay(homepen, profpenref.pen); }); },
        settings: function () {
            glo.pen.getPen(changeSettings); },
        tabselect: function (tabname) {
            tabselect(tabname); },
        resetReviews: function () {
            resetReviewDisplays(glo.pen.currPenRef()); },
        save: function () {
            glo.pen.getPen(saveEditedProfile); },
        byprofid: function (id, tabname) {
            displayProfileForId(id, tabname); },
        relationship: function () {
            createOrEditRelationship(); },
        switchPen: function () {
            changeToSelectedPen(); },
        penListItemHTML: function (pen) {
            return penListItemHTML(pen); },
        revsmore: function () {
            findRecentReviews(profpenref.profstate.recentRevState); },
        readReview: function (revid) {
            return readReview(revid); },
        reviewItemHTML: function (revobj, penNameStr) {
            return reviewItemHTML(revobj, penNameStr); },
        toggleAuthChange: function (authtype, domid) {
            glo.pen.getPen(function (pen) { 
                handleAuthChangeToggle(pen, authtype, domid); }); },
        displayAuthSettings: function (domid, pen) {
            displayAuthSettings(domid, pen); },
        addMyOpenReviewsAuthId: function(mid) {
            glo.pen.getPen(function (pen) {
                addMyOpenReviewsAuthId(pen, mid); }); },
        writeNavDisplay: function (homepen, dispen, directive) {
            writeNavDisplay(homepen, dispen, directive); },
        verifyStateVariableValues: function (pen) {
            verifyStateVariableValues(pen); },
        cancelPenNameSettings: function () {
            cancelPenNameSettings(); },
        editCity: function () {
            editCity(); },
        invite: function () {
            displayInvitationDialog(); },
        chginvite: function () {
            updateInviteInfo(); },
        showTopRated: function (typename) {
            showTopRated(typename); },
        searchAllRevs: function (revtype) {
            searchAllRevs(revtype); },
        searchRevsIfTypeChange: function (revtype) {
            if(profpenref.profstate.revtype !== revtype) {
                searchAllRevs(revtype); } }
    };

});

