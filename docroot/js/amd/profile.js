/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, app: false, require: false, navigator: false */

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
            penref.pen.top20s = app.dojo.json.parse(penref.pen.top20s); }
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
        profpenref = app.lcs.getPenRef(pen);
        verifyProfileState(profpenref);
    },


    createOrEditRelationship = function () {
        app.rel.reledit(app.pen.currPenRef().pen, profpenref.pen);
    },


    updateTopActionDisplay = function (pen) {
        var html;
        if(!app.byId('homepenhdiv')) {
            app.login.updateAuthentDisplay(); }
        html = "<div class=\"topnavitemdiv\">" +
            app.imgntxt("profile.png", "",
                        "app.profile.display()",
                        "#view=profile&profid=" + app.instId(pen),
                        "Show profile for " + pen.name + " (you)") +
            "</div>";
        app.out('homepenhdiv', html);
        html = app.imgntxt("settings.png", "", 
                           "app.profile.settings()",
                           "#Settings",
                           "Adjust your application settings");
        app.out('settingsbuttondiv', html);
    },


    displayProfileHeading = function (homepen, dispen, directive) {
        var html, id, name, relationship;
        id = app.instId(dispen);
        name = dispen.name;
        html = "<a href=\"#view=profile&profid=" + id + "\"" +
                 " title=\"Show profile for " + name + "\"" +
                 " onclick=\"app.profile.byprofid('" + id + "');" + 
                            "return false;\"" +
               ">" + name + "</a>";
        html = "<div id=\"profhdiv\">" +
                 "<span id=\"penhnamespan\">" + html + "</span>" +
                 "<span id=\"penhbuttonspan\"> </span>" +
               "</div>";
        app.out('centerhdiv', html);
        html = "";
        if(app.instId(homepen) !== app.instId(dispen) &&
           directive !== "nosettings") {
            if(app.rel.relsLoaded()) {
                relationship = app.rel.outbound(id);
                app.profile.verifyStateVariableValues(dispen);
                if(relationship) {
                    html = app.imglink("#Settings",
                                       "Adjust follow settings for " + name,
                                       "app.profile.relationship()", 
                                       "settings.png"); }
                else {
                    html = app.imglink("#Follow",
                                       "Follow " + name + " reviews",
                                       "app.profile.relationship()",
                                       "follow.png"); } }
            else {  
                //Happens if you go directly to someone's profile via url
                //and rels are loading slowly.  Not known if you are following
                //them yet.  The heading updates after the rels are loaded.
                html = "..."; } }
        app.out('penhbuttonspan', html);
    },


    writeNavDisplay = function (homepen, dispen, directive) {
        if(!dispen) {
            dispen = homepen; }
        updateTopActionDisplay(homepen);
        displayProfileHeading(homepen, dispen, directive);
    },


    setPenNameFromInput = function (pen) {
        var pennamein = app.byId('pennamein');
        if(!pen) {
            pen = profpenref.pen; }
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    savePenNameSettings = function (e) {
        var pen;
        app.evtend(e);
        pen = app.pen.currPenRef().pen;
        setPenNameFromInput(pen);
        app.skinner.save(pen);
        app.pen.updatePen(pen,
                          function () {
                              app.layout.closeDialog();
                              app.profile.display(); },
                          function (code, errtxt) {
                              app.out('settingsmsgtd', errtxt); });
    },


    cancelPenNameSettings = function (actionTxt) {
        app.skinner.cancel();
        app.layout.closeDialog();
        if(actionTxt && typeof actionTxt === "string") {
            //nuke the main display as we are about to rebuild contents
            app.out('centerhdiv', "");
            app.out('cmain', actionTxt); }
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
        html = "<div id=\"accountdiv\">" + app.login.loginInfoHTML(pen) + 
            "</div>" +
            "Access \"" + pen.name + "\" via: " +
            "<table>";
        //MyOpenReviews
        atname = nameForAuthType("mid");
        html += "<tr><td><input type=\"checkbox\" name=\"aamid\"" +
            " value=\"" + atname + "\" id=\"aamid\"" +
            " onchange=\"app.profile.toggleAuthChange('mid','" + 
                             domid + "');return false;\"";
        if(app.isId(pen.mid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aamid\">" + atname + "</label></td></tr>";
        html += "<tr>";
        //Facebook
        atname = nameForAuthType("fbid");
        html += "<td><input type=\"checkbox\" name=\"aafbid\"" +
            " value=\"" + atname + "\" id=\"aafbid\"" +
            " onchange=\"app.profile.toggleAuthChange('fbid','" + 
                             domid + "');return false;\"";
        if(app.isId(pen.fbid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aafbid\">" + atname + "</label></td>";
        //Twitter
        atname = nameForAuthType("twid");
        html += "<td><input type=\"checkbox\" name=\"aatwid\"" +
            " value=\"" + atname + "\" id=\"aatwid\"" +
            " onchange=\"app.profile.toggleAuthChange('twid','" + 
                             domid + "');return false;\"";
        if(app.isId(pen.twid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aatwid\">" + atname + "</label></td>";
        html += "</tr><tr>";
        //Google+
        atname = nameForAuthType("gsid");
        html += "<td><input type=\"checkbox\" name=\"aagsid\"" +
            " value=\"" + atname + "\" id=\"aagsid\"" +
            " onchange=\"app.profile.toggleAuthChange('gsid','" + 
                             domid + "');return false;\"";
        if(app.isId(pen.gsid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aagsid\">" + atname + "</label></td>";
        //GitHub
        atname = nameForAuthType("ghid");
        html += "<td><input type=\"checkbox\" name=\"aaghid\"" +
            " value=\"" + atname + "\" id=\"aaghid\"" +
            " onchange=\"app.profile.toggleAuthChange('ghid','" + 
                             domid + "');return false;\"";
        if(app.isId(pen.ghid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aaghid\">" + atname + "</label></td>";
        html += "</tr></table>";
        app.out(domid, html);
    },


    addMyOpenReviewsAuth = function (domid, pen) {
        var html = "<form action=\"" + app.secsvr + "/loginid\"" +
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
        app.out(domid, html);
    },


    handleAuthChangeToggle = function (pen, authtype, domid) {
        var action = "remove", methcount, previd;
        if(app.byId("aa" + authtype).checked) {
            action = "add"; }
        if(action === "remove") {
            methcount = (pen.mid? 1 : 0) +
                (pen.gsid? 1 : 0) +
                (pen.fbid? 1 : 0) +
                (pen.twid? 1 : 0) +
                (pen.ghid? 1 : 0);
            if(methcount < 2) {
                alert("You must have at least one authentication type.");
                app.byId("aa" + authtype).checked = true;
                return;  } 
            if(authtype === app.login.getAuthMethod()) {
                alert("You can't remove the authentication you are " +
                      "currently logged in with.");
                app.byId("aa" + authtype).checked = true;
                return;  } 
            if(confirm("Are you sure you want to remove access to this" +
                       " Pen Name from " + nameForAuthType(authtype) + "?")) {
                app.out(domid, "Updating...");
                previd = pen[authtype];
                pen[authtype] = 0;
                app.pen.updatePen(pen,
                                  function (updpen) {
                                      displayAuthSettings(domid, updpen); },
                                  function (code, errtxt) {
                                      app.err("handleAuthChangeToggle error " +
                                              code + ": " + errtxt);
                                      pen[authtype] = previd;
                                      displayAuthSettings(domid, pen); }); }
            else {
                app.byId("aa" + authtype).checked = true; } }
        else if(action === "add") {
            switch(authtype) {
            case "mid": 
                addMyOpenReviewsAuth(domid, pen); break;
            case "fbid": 
                require([ "ext/facebook" ],
                        function (facebook) {
                            if(!app.facebook) { app.facebook = facebook; }
                            facebook.addProfileAuth(domid, pen); });
                break;
            case "twid":
                require([ "ext/twitter" ],
                        function (twitter) {
                            if(!app.twitter) { app.twitter = twitter; }
                            twitter.addProfileAuth(domid, pen); });
                break;
            case "gsid":
                require([ "ext/googleplus" ],
                        function (googleplus) {
                            if(!app.googleplus) { app.googleplus = googleplus; }
                            googleplus.addProfileAuth(domid, pen); });
                break;
            case "ghid":
                require([ "ext/github" ],
                        function (github) {
                            if(!app.github) { app.github = github; }
                            github.addProfileAuth(domid, pen); });
                break;
            } }
    },


    changeToSelectedPen = function () {
        var i, sel = app.byId('penselect'), temp = "";
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                //do not call cancelPenNameSettings before done accessing
                //the selection elementobjects or IE8 has issues.
                if(sel.options[i].id === 'newpenopt') {
                    cancelPenNameSettings("Creating new pen name...");
                    app.pen.newPenName(app.profile.display); }
                else {
                    temp = sel.options[i].value;
                    cancelPenNameSettings("Switching pen names...");
                    app.pen.selectPenByName(temp); }
                break; } }
    },


    penSelectHTML = function (pen) {
        var html, pens = app.pen.getPenNames(), i;
        html = "<div id=\"penseldiv\">" +
            "<span class=\"headingtxt\">Writing as </span>" +
            "<select id=\"penselect\"" + 
                   " onchange=\"app.profile.switchPen();return false;\">";
        for(i = 0; i < pens.length; i += 1) {
            html += "<option id=\"" + app.instId(pens[i]) + "\"";
            if(pens[i].name === pen.name) {
                html += " selected=\"selected\""; }
            html += ">" + pens[i].name + "</option>"; }
        html += "<option id=\"newpenopt\">New Pen Name</option>" +
            "</select>" + "&nbsp;" + 
            "<button type=\"button\" id=\"penselectok\"" + 
            " onclick=\"app.profile.switchPen();return false;\"" +
            ">go</button>" +
            "</div>";
        return html;
    },


    changeSettings = function (pen) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"app.profile.cancelPenNameSettings();return false;\"" +
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
        app.out('dlgdiv', html);
        app.on('pennamein', 'change', app.profile.penNameChange);
        app.on('savebutton', 'click', savePenNameSettings);
        displayAuthSettings('settingsauthtd', pen);
        app.services.display('consvcstd', pen);
        app.skinner.init('settingsskintd', pen);
        app.byId('dlgdiv').style.visibility = "visible";
        if(app.isLowFuncBrowser()) {
            app.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        app.onescapefunc = cancelPenNameSettings;
    },


    addMyOpenReviewsAuthId = function (pen, mid) {
        var previd;
        if(!mid) {
            app.err("No account ID received.");
            app.profile.display(); }
        else {
            previd = pen.mid;
            pen.mid = mid;
            app.pen.updatePen(pen,
                              function (updpen) {
                                  changeSettings(updpen); },
                              function (code, errtxt) {
                                  app.err("addMyOpenReviewsAuthId error " +
                                          code + ": " + errtxt);
                                  pen.mid = previd;
                                  app.profile.display(); }); }
    },


    mailButtonHTML = function () {
        var html, href, subj, body, types, revchecks, i, ts, mepen;
        mepen = app.pen.currPenRef().pen;
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
            "    " + app.mainsvr + "/#view=profile&profid=" +
            app.instId(mepen) + "\n\n" +
            "When I see you in my 'Followers' tab, I'll follow back. " +
            "Looking forward to learning about things you've experienced " +
            "recently!" +
            "\n\n" +
            "cheers,\n" + 
            mepen.name + 
            "\n\n";
        href = "mailto:?subject=" + app.dquotenc(subj) + 
            "&body=" + app.dquotenc(body);
        html = app.services.serviceLinkHTML(href, "", "shareico", 
                                            "Invite via eMail",
                                            "img/email.png");
        return html;
    },


    updateInviteInfo = function () {
        app.out('mailbspan', mailButtonHTML());
    },


    displayInvitationDialog = function () {
        var html;
        html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"app.layout.closeDialog();return false;\"" +
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
              app.review.reviewTypeCheckboxesHTML("invrevcb", 
                                                  "app.profile.chginvite") +
            "</td></tr>" +
            "<tr><td>" + 
              "Invite your friend to join:" +
            "</td></tr>" +
            "<tr><td align=\"center\">" + 
              "<span id=\"mailbspan\"></span>" +
            "</td></tr>" +
          "</table>";
        app.out('dlgdiv', html);
        app.byId('dlgdiv').style.visibility = "visible";
        if(app.isLowFuncBrowser()) {
            app.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        app.onescapefunc = app.layout.closeDialog;
        updateInviteInfo();
    },


    badgeDispHTML = function (pen) {
        var html, i, reviewTypes, typename;
        html = "";
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(pen.top20s[typename] && pen.top20s[typename].length >= 20) {
                html += app.review.badgeImageHTML(reviewTypes[i]); } }
        return html;
    },


    penListItemHTML = function (pen) {
        var penid = app.instId(pen), picuri, hash, linktitle, html;
        hash = app.objdata({ view: "profile", profid: penid });
        linktitle = app.ellipsis(pen.shoutout, 75);
        if(!linktitle) {  //do not encode pen name here.  No "First%20Last"..
            linktitle = "View profile for " + pen.name; }
        html = "<li>" +
            "<a href=\"#" + hash + "\"" +
            " onclick=\"app.profile.byprofid('" + penid + "');return false;\"" +
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
        app.lcs.getPenFull(penid, function (penref) {
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
        revobj = app.lcs.getRevRef(revid).rev;
        //Make some noise if you can't find it rather than being a dead link
        if(!revobj) {
            app.err("readReview " + revid + " not found");
            return; }
        app.history.checkpoint({ view: "review", mode: "display",
                                 revid: revid });
        app.review.setCurrentReview(revobj);
        app.review.displayRead();
    },


    reviewItemHTML = function (revobj, penNameStr) {
        var revid, type, linkref, linkclass, html;
        //review item line
        revid = app.instId(revobj);
        type = app.review.getReviewTypeByValue(revobj.revtype);
        linkref = "statrev/" + revid;
        linkclass = app.review.foundHelpful(revid)? "rslcbold" : "rslc";
        html = "<li>" + app.review.starsImageHTML(revobj.rating) + 
            app.review.badgeImageHTML(type) + "&nbsp;" +
            "<a id=\"lihr" + revid + "\" href=\"" + linkref + "\"" +
              " onclick=\"app.profile.readReview('" + revid + "');" + 
                         "return false;\"" +
              " class=\"" + linkclass + "\"" +
              " title=\"See full review\">";
        if(type.subkey) {
            html += "<i>" + app.ellipsis(revobj[type.key], 60) + "</i> " +
                app.ellipsis(revobj[type.subkey], 40); }
        else {
            html += app.ellipsis(revobj[type.key], 60); }
        html += "</a>";
        if(revobj.url) {
            html += " &nbsp;" + app.review.graphicAbbrevSiteLink(revobj.url); }
        //review meta line
        html += "<div class=\"revtextsummary\">";
        if(penNameStr) {
            linkref = app.objdata({ view: "profile", profid: revobj.penid });
            html += "review by " + 
                "<a href=\"#" + linkref + "\"" +
                 " onclick=\"app.profile.byprofid('" + revobj.penid + "');" +
                            "return false;\"" +
                 " title=\"Show profile for " + app.ndq(penNameStr) + "\"" +
                ">" + penNameStr + "</a>"; }
        if(revobj.keywords) {
            if(penNameStr) {
                html += ": "; }
            html += app.ellipsis(revobj.keywords, 100); }
        html += app.review.linkCountHTML(revid);
        html += "</div>";
        //review description line
        if(revobj.text) {
            html += "<div class=\"revtextsummary\">" + 
                app.ellipsis(revobj.text, 255) + "</div>"; }
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
                app.lcs.putRev(reviews[i]);  //ensure cached
                rrs.results.push(reviews[i]);
                html += reviewItemHTML(reviews[i]); } }
        rrs.total = Math.max(rrs.total, rrs.results.length);
        if(rrs.total === 0) {
            html += "<li>No recent reviews.";
            if(app.instId(profpenref.pen) === app.pen.currPenId()) {
                html += " " + app.review.reviewLinkHTML(); }
            html += "</li>"; }
        html += "</ul>";
        if(rrs.cursor) {
            if(i === 0 && rrs.results.length === 0) {
                if(rrs.total < 2000) {  //auto-repeat search
                    setTimeout(app.profile.revsmore, 10); } 
                else {
                    html += "No recent reviews found, only batch updates."; } }
            else {
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"app.profile.revsmore();" +
                                     "return false;\"" +
                          " title=\"More reviews\"" + 
                    ">more reviews...</a>"; } }
        app.out('profcontdiv', html);
        app.layout.adjust();
        setTimeout(function () {
            app.lcs.verifyReviewLinks(app.profile.refresh); }, 250);
    },


    findRecentReviews = function (rrs) {  //recentRevState
        var params, critsec = "";
        params = app.objdata(rrs.params) + "&" + app.login.authparams();
        if(rrs.cursor) {
            params += "&cursor=" + app.enc(rrs.cursor); }
        app.call("srchrevs?" + params, 'GET', null,
                 function (revs) {
                     displayRecentReviews(rrs, revs); },
                 function (code, errtxt) {
                     app.out('profcontdiv', "findRecentReviews failed code " + 
                             code + " " + errtxt); },
                 critsec);
    },


    displayRecent = function () {
        var rrs, html, maxdate, mindate;
        if(profpenref.profstate.recentRevState) {
            return displayRecentReviews(profpenref.profstate.recentRevState); }
        html = "Retrieving recent activity for " + profpenref.pen.name + "...";
        app.out('profcontdiv', html);
        app.layout.adjust();
        profpenref.profstate.recentRevState = rrs = { 
            params: {},
            cursor: "",
            results: [],
            total: 0 };
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        rrs.params.maxdate = maxdate.toISOString();
        rrs.params.mindate = mindate.toISOString();
        rrs.params.penid = app.instId(profpenref.pen);
        findRecentReviews(rrs);
    },


    revTypeSelectorHTML = function (clickfuncstr) {
        var html, i, reviewTypes, typename, label, dispclass, pen, prefixstr;
        prefixstr = "Top 20 ";
        if(clickfuncstr && clickfuncstr.indexOf("Top") < 0) {
            prefixstr = "20+ "; }
        pen = profpenref.pen;
        html = "";
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
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
        html = revTypeSelectorHTML("app.profile.showTopRated");
        revs = [];
        if(profpenref.pen.top20s) {
            revs = profpenref.pen.top20s[state.revtype] || []; }
        html += "<ul class=\"revlist\">";
        if(revs.length === 0) {
            html += "<li>No top rated " + state.revtype + " reviews.";
            if(app.instId(profpenref.pen) === app.pen.currPenId()) {
                html += " " + app.review.reviewLinkHTML(); }
            html += "</li>"; }
        for(i = 0; i < revs.length; i += 1) {
            revref = app.lcs.getRevRef(revs[i]);
            if(revref.rev) {
                html += reviewItemHTML(revref.rev); }
            //if revref.status deleted or other error, then just skip it
            else if(revref.status === "not cached") {
                html += "<li>Fetching review " + revs[i] + "...</li>";
                break; } }
        html += "</ul>";
        app.out('profcontdiv', html);
        app.layout.adjust();
        if(i < revs.length) { //didn't make it through, fetch and redisplay
            app.lcs.getRevFull(revs[i], displayBest); }
        else {
            setTimeout(function () {
                app.lcs.verifyReviewLinks(app.profile.refresh); }, 250); }
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
                state.autopage = window.setTimeout(app.profile.searchAllRevs,
                                                   10); }
            else {
                if(allrevMaxAutoSearch()) {  //they continued search manually
                    state.reqs += 1; }
                html += "<a href=\"#continuesearch\"" +
                    " onclick=\"app.profile.searchAllRevs();return false;\"" +
                    " title=\"Continue searching for more matching reviews\"" +
                    ">continue search...</a>"; } }
        app.out('allrevdispdiv', html);
        setTimeout(function () {
            app.lcs.verifyReviewLinks(app.profile.refresh); }, 250);
    },


    monitorAllRevQuery = function () {
        var state, srchin, qstr = "";
        state = profpenref.profstate;
        srchin = app.byId('allrevsrchin');
        if(!srchin) {  //probably switched tabs, quit
            return; }
        qstr = srchin.value;
        if(qstr !== state.allRevsState.srchval) {
            if(state.allRevsState.querymon) {
                window.clearTimeout(state.allRevsState.querymon);
                state.allRevsState.querymon = null; }
            app.profile.searchAllRevs(); }
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
        html = revTypeSelectorHTML("app.profile.searchRevsIfTypeChange");
        html += "<div id=\"allrevsrchdiv\">" +
            "<input type=\"text\" id=\"allrevsrchin\" size=\"40\"" +
                  " placeholder=\"Review title or name\"" + 
                  " value=\"" + state.srchval + "\"" +
                  " onchange=\"app.profile.allrevs();return false;\"" +
            "/></div>" +
            "<div id=\"allrevdispdiv\"></div>";
        app.out('profcontdiv', html);
        app.byId('allrevsrchin').focus();
        if(state.revs.length > 0) {
            listAllRevs([]);  //display previous results
            monitorAllRevQuery(); }
        else {
            clearAllRevProfWorkState();
            app.profile.searchAllRevs(); }
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
        qstr = app.byId('allrevsrchin').value;
        if(qstr !== state.allRevsState.srchval) {
            state.allRevsState.srchval = qstr;
            clearAllRevProfWorkState(); }
        maxdate = (new Date()).toISOString();
        mindate = (new Date(0)).toISOString();
        params = app.login.authparams() +
            "&qstr=" + app.enc(app.canonize(qstr)) +
            "&revtype=" + revtype +
            "&penid=" + app.instId(profpenref.pen) +
            "&maxdate=" + maxdate + "&mindate=" + mindate +
            "&cursor=" + app.enc(state.allRevsState.cursor);
        app.call("srchrevs?" + params, 'GET', null,
                 function (results) { 
                     app.lcs.putRevs(results);
                     listAllRevs(results);
                     monitorAllRevQuery(); },
                 function (code, errtxt) {
                     app.err("searchAllRevs call died code: " + code + " " +
                             errtxt); },
                 critsec);
    },


    displayFollowing = function () {
        app.rel.displayRelations(profpenref.pen, "outbound", "profcontdiv");
        app.layout.adjust();
    },


   displayFollowers = function () {
        app.rel.displayRelations(profpenref.pen, "inbound", "profcontdiv");
        app.layout.adjust();
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
        ul = app.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = app.skinner.darkbg(); }
        li = app.byId(tabname + "li");
        li.className = "selectedTab";
        li.style.backgroundColor = "transparent";
        app.history.checkpoint({ view: "profile", 
                                 profid: app.instId(profpenref.pen),
                                 tab: tabname });
        refreshContentDisplay();
    },


    displayTabs = function (penref) {
        var html;
        verifyProfileState(penref);
        html = "<ul id=\"proftabsul\">" +
          "<li id=\"recentli\" class=\"selectedTab\">" + 
            tablink("Recent Reviews", "app.profile.tabselect('recent')") + 
          "</li>" +
          "<li id=\"bestli\" class=\"unselectedTab\">" +
            tablink("Top Rated", "app.profile.tabselect('best')") + 
          "</li>" +
          "<li id=\"allrevsli\" class=\"unselectedTab\">" +
            tablink("All Reviews", "app.profile.tabselect('allrevs')") +
          "</li>" +
          "<li id=\"followingli\" class=\"unselectedTab\">" +
            tablink("Following (" + penref.pen.following + ")", 
                    "app.profile.tabselect('following')") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers (" + penref.pen.followers + ")", 
                    "app.profile.tabselect('followers')") + 
          "</li>";
        html += "</ul>";
        app.out('proftabsdiv', html);
        tabselect();
    },


    profileModAuthorized = function (pen) {
        if(app.isId(pen.mid) || app.isId(pen.gsid) || app.isId(pen.fbid) || 
           app.isId(pen.twid) || app.isId(pen.ghid)) {
            return true; }
        return false;
    },


    cancelProfileEdit = function (e) {
        app.evtend(e);
        app.profile.updateHeading();
        app.profile.display();
    },


    profEditFail = function (code, errtxt) {
        app.out('sysnotice', errtxt);
    },


    saveEditedProfile = function (pen) {
        var elem;
        elem = app.byId('profcityin');
        if(elem) {
            pen.city = elem.value; }
        elem = app.byId('shouttxt');
        if(elem) {
            pen.shoutout = elem.value; }
        app.pen.updatePen(pen, app.profile.display, profEditFail);
    },


    onProfileSaveClick = function (e) {
        app.evtend(e);
        app.profile.save();
    },


    displayProfEditButtons = function () {
        var html;
        if(app.byId('profcancelb')) {
            return; }  //already have buttons
        html = "&nbsp;" +
            "<button type=\"button\" id=\"profcancelb\">Cancel</button>" +
            "&nbsp;" +
            "<button type=\"button\" id=\"profsaveb\">Save</button>";
        app.out('profeditbspan', html);
        app.on('profcancelb', 'click', cancelProfileEdit);
        app.on('profsaveb', 'click', onProfileSaveClick);
    },


    styleShout = function (shout) {
        var target;
        shout.style.color = app.colors.text;
        shout.style.backgroundColor = app.skinner.lightbg();
        //80px left margin + 160px image + padding
        //+ balancing right margin space (preferable)
        //but going much smaller than the image is stupid regardless of
        //screen size
        target = Math.max((app.winw - 350), 200);
        target = Math.min(target, 600);
        shout.style.width = target + "px";
        //modify profcontdiv so it balances the text area size.  This is
        //needed so IE8 doesn't widen profpictd unnecessarily.
        target += app.byId('profpictd').offsetWidth;
        target += 50;  //arbitrary extra to cover padding
        app.byId('profcontdiv').style.width = String(target) + "px";
    },


    editShout = function (pen) {
        var html, shout;
        html = "<textarea id=\"shouttxt\" class=\"shoutout\"></textarea>";
        app.out('profshouttd', html);
        shout = app.byId('shouttxt');
        styleShout(shout);
        shout.readOnly = false;
        shout.value = pen.shoutout;
        shout.focus();
        displayProfEditButtons();
    },


    displayShout = function (pen) {
        var html, shout, text;
        text = "No additional information about " + pen.name;
        if(app.instId(profpenref.pen) === app.pen.currPenId()) {
            text = "About me (anything you would like to say to everyone)." + 
                " Link to your twitter handle, blog or site if you want."; }
        text = "<span style=\"color:" + greytxt + ";\">" + text + "</span>";
        html = "<div id=\"shoutdiv\" class=\"shoutout\"></div>";
        app.out('profshouttd', html);
        shout = app.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + app.colors.bodybg;
        text = app.linkify(pen.shoutout) || text;
        app.out('shoutdiv', text);
        if(profileModAuthorized(pen)) {
            app.on('shoutdiv', 'click', function (e) {
                app.evtend(e);
                editShout(pen); }); }
    },



    saveUnlessShoutEdit = function (e) {
        app.evtend(e);
        if(app.byId('shoutdiv')) {
            app.profile.save(); }
    },


    editCity = function () {
        var val, html, elem;
        elem = app.byId('profcityin');
        if(elem) {
            return; }  //already editing
        val = app.byId('profcityspan').innerHTML;
        //IE8 actually capitalizes the the HTML for you. Sheesh.
        if(val.indexOf("<a") === 0 || val.indexOf("<A") === 0) {
            val = app.byId('profcitya').innerHTML; }
        if(val === unspecifiedCityText) {
            val = ""; }
        html = "<input type=\"text\" id=\"profcityin\" size=\"25\"" +
                     " placeholder=\"City or Region\"" +
                     " value=\"" + val + "\"/>";
        app.out('profcityspan', html);
        displayProfEditButtons();
        app.on('profcityin', 'change', saveUnlessShoutEdit);
        app.byId('profcityin').focus();
    },


    displayCity = function (pen) {
        var html, style = "";
        if(!pen.city) { 
            app.byId('profcityspan').style.color = greytxt; }
        html = pen.city || unspecifiedCityText;            
        if(!pen.city) {
            style = " style=\"color:" + greytxt + ";\""; }
        if(profileModAuthorized(pen)) {
            html = "<a href=\"#edit city\" title=\"Edit city\"" +
                     " id=\"profcitya\"" + 
                     " onclick=\"app.profile.editCity();return false;\"" +
                       style + ">" + html + "</a>"; }
        app.out('profcityspan', html);
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var odiv, html = "";
        html += app.paramsToFormInputs(app.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + 
            app.instId(pen) + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            app.enc(window.location.href + "#profile") + "\"/>";
        html = "<form action=\"/profpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            "<div id=\"closeline\">" +
              "<a id=\"closedlg\" href=\"#close\"" +
                " onclick=\"app.cancelPicUpload();return false\">" + 
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
        app.out('overlaydiv', html);
        odiv = app.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = app.skinner.lightbg();
        app.onescapefunc = app.cancelPicUpload;
        app.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var html = "img/emptyprofpic.png";
        if(pen.profpic) {
            html = "profpic?profileid=" + app.instId(pen); }
        html = "<img class=\"profpic\" src=\"" + html + "\"/>";
        app.out('profpictd', html);
        if(profileModAuthorized(pen)) {
            app.on('profpictd', 'click', function (e) {
                app.evtend(e);
                if(app.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    earnedBadgesHTML = function (pen) {
        var html, i, reviewTypes, typename, label, dispclass;
        html = "";
        app.pen.deserializeFields(pen);
        reviewTypes = app.review.getReviewTypes();
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
                    " onclick=\"app.profile.showTopRated('" + typename + "');" +
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
        app.history.checkpoint({ view: "profile", 
                                 profid: app.instId(profpenref.pen),
                                 tab: profpenref.profstate.seltabname });
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(homepen, dispen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        app.skinner.setColorsFromPen(homepen);
        html = proftopdivHTML();
        if(!app.layout.haveContentDivAreas()) { //change pw kills it
            app.layout.initContentDivAreas(); }
        app.out('cmain', html);
        app.out('profbadgestd', earnedBadgesHTML(dispen));
        if(app.instId(profpenref.pen) === app.pen.currPenId()) {
            html = "<a id=\"commbuild\" href=\"#invite\"" + 
                     " onclick=\"app.profile.invite();return false\">" +
                "<img class=\"reviewbadge\" src=\"img/follow.png\"" + 
                    " border=\"0\">" +
                "Build your community</a>";
            app.out('profcommbuildtd', html); }
        displayShout(dispen);
        displayCity(dispen);
        displayPic(dispen);
        displayTabs(profpenref);
        app.layout.adjust();
        if(errmsg) {
            app.err("Previous processing failed: " + errmsg); }
    },


    displayProfileForId = function (id, tabname) {
        app.layout.closeDialog(); //close pen name search dialog if open
        resetStateVars();
        findOrLoadPen(id, function (dispen) {
            if(tabname) {
                verifyStateVariableValues(dispen);
                setCurrTabFromString(tabname); }
            app.pen.getPen(function (homepen) {
                mainDisplay(homepen, dispen); }); });
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function (action, errmsg) {
            app.pen.getPen(function (homepen) {
                mainDisplay(homepen, null, action, errmsg); }); },
        updateHeading: function () {  //called during startup
            app.pen.getPen(function (homepen) {
                writeNavDisplay(homepen,
                                profpenref && profpenref.pen); }); },
        refresh: function () {
            app.pen.getPen(function (homepen) {
                mainDisplay(homepen, profpenref.pen); }); },
        settings: function () {
            app.pen.getPen(changeSettings); },
        tabselect: function (tabname) {
            tabselect(tabname); },
        resetReviews: function () {
            resetReviewDisplays(app.pen.currPenRef()); },
        save: function () {
            app.pen.getPen(saveEditedProfile); },
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
            app.pen.getPen(function (pen) { 
                handleAuthChangeToggle(pen, authtype, domid); }); },
        displayAuthSettings: function (domid, pen) {
            displayAuthSettings(domid, pen); },
        addMyOpenReviewsAuthId: function(mid) {
            app.pen.getPen(function (pen) {
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
                searchAllRevs(revtype); } },
        penNameChange: function (event) {
            app.evtend(event);
            setPenNameFromInput(); }
    };

});

