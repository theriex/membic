/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false, navigator: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . p r o f i l e
//
define([], function () {
    "use strict";

    var greytxt = "#999999",
        unspecifiedCityText = "City not specified",
        currtab,
        profpen,
        cachepens = [],
        //tab displays
        recentRevState = { results: [] },
        workrev = null,
        //search tab display
        searchresults = [],
        searchmode = "pen",  //other option is "rev"
        pensrchplace = "Pen name, city or shoutout...",
        revsrchplace = "Review title or name...",

    clearReviewSearchState = function (dispState) {
        dispState.params = {};
        dispState.results = [];
        dispState.cursor = "";
        dispState.total = 0;
        dispState.initialized = false;
    },


    resetStateVars = function () {
        currtab = null;
        profpen = null;
        cachepens = [];
        clearReviewSearchState(recentRevState);
        workrev = null;
        searchresults = [];
    },


    createOrEditRelationship = function () {
        mor.pen.getPen(function (pen) {
            mor.rel.reledit(pen, profpen); });
    },


    updateTopActionDisplay = function (pen) {
        var html = "<div class=\"topnavitemdiv\">" +
            mor.imgntxt("profile.png", pen.name,
                        "mor.profile.display()",
                        "#view=profile&profid=" + mor.instId(pen),
                        "Show profile for your current pen name") +
            "</div>";
        mor.out('homepenhdiv', html);
        html = mor.imglink("#Settings","Adjust your application settings",
                           "mor.profile.settings()", "settings.png",
                           "settingsnavico");
        mor.out('settingsbuttondiv', html);
    },


    displayProfileHeading = function (homepen, dispen, directive) {
        var html, id, name, relationship;
        id = mor.instId(dispen);
        name = dispen.name;
        html = "<a href=\"#view=profile&profid=" + id + "\"" +
                 " title=\"Show profile for " + name + "\"" +
                 " onclick=\"mor.profile.byprofid('" + id + "');" + 
                            "return false;\"" +
               ">" + name + "</a>";
        html = "<div id=\"profhdiv\">" +
                 "<span id=\"penhnamespan\">" + html + "</span>" +
                 "<span id=\"penhbuttonspan\"> </span>" +
               "</div>";
        mor.out('centerhdiv', html);
        html = "";
        if(mor.instId(homepen) !== mor.instId(dispen) &&
           directive !== "nosettings") {
            if(mor.rel.relsLoaded()) {
                relationship = mor.rel.outbound(id);
                mor.profile.verifyStateVariableValues(dispen);
                if(relationship) {
                    html = mor.imglink("#Settings",
                                       "Adjust follow settings for " + name,
                                       "mor.profile.relationship()", 
                                       "settings.png"); }
                else {
                    html = mor.imglink("#Follow",
                                       "Follow " + name + " reviews",
                                       "mor.profile.relationship()",
                                       "follow.png"); } }
            else {  
                //Happens if you go directly to someone's profile via url
                //and rels are loading slowly.  Not known if you are following
                //them yet.  The heading updates after the rels are loaded.
                html = "..."; } }
        mor.out('penhbuttonspan', html);
    },


    writeNavDisplay = function (homepen, dispen, directive) {
        if(!dispen) {
            dispen = homepen; }
        updateTopActionDisplay(homepen);
        displayProfileHeading(homepen, dispen, directive);
    },


    setPenNameFromInput = function (pen) {
        var pennamein = mor.byId('pennamein');
        if(pennamein) {
            pen.name = pennamein.value; }
    },


    savePenNameSettings = function (pen) {
        setPenNameFromInput(pen);
        mor.skinner.save(pen);
        mor.pen.updatePen(pen,
                          function () {
                              mor.layout.closeDialog();
                              mor.profile.display(); },
                          function (code, errtxt) {
                              mor.out('settingsmsgtd', errtxt); });
    },


    cancelPenNameSettings = function (actionTxt) {
        mor.skinner.cancel();
        mor.layout.closeDialog();
        if(actionTxt && typeof actionTxt === "string") {
            //nuke the main display as we are about to rebuild contents
            mor.out('centerhdiv', "");
            mor.out('cmain', actionTxt); }
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
        html = "<div id=\"accountdiv\">" + mor.login.loginInfoHTML() + 
            "</div>" +
            "Access \"" + pen.name + "\" via: " +
            "<table>";
        //MyOpenReviews
        atname = nameForAuthType("mid");
        html += "<tr><td><input type=\"checkbox\" name=\"aamid\"" +
            " value=\"" + atname + "\" id=\"aamid\"" +
            " onchange=\"mor.profile.toggleAuthChange('mid','" + 
                             domid + "');return false;\"";
        if(mor.isId(pen.mid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aamid\">" + atname + "</label></td></tr>";
        html += "<tr>";
        //Facebook
        atname = nameForAuthType("fbid");
        html += "<td><input type=\"checkbox\" name=\"aafbid\"" +
            " value=\"" + atname + "\" id=\"aafbid\"" +
            " onchange=\"mor.profile.toggleAuthChange('fbid','" + 
                             domid + "');return false;\"";
        if(mor.isId(pen.fbid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aafbid\">" + atname + "</label></td>";
        //Twitter
        atname = nameForAuthType("twid");
        html += "<td><input type=\"checkbox\" name=\"aatwid\"" +
            " value=\"" + atname + "\" id=\"aatwid\"" +
            " onchange=\"mor.profile.toggleAuthChange('twid','" + 
                             domid + "');return false;\"";
        if(mor.isId(pen.twid)) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aatwid\">" + atname + "</label></td>";
        html += "</tr><tr>";
        //Google+
        atname = nameForAuthType("gsid");
        html += "<td><input type=\"checkbox\" name=\"aagsid\"" +
            " value=\"" + atname + "\" id=\"aagsid\"" +
            " onchange=\"mor.profile.toggleAuthChange('gsid','" + 
                             domid + "');return false;\"";
        if(mor.isId(pen.gsid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aagsid\">" + atname + "</label></td>";
        //GitHub
        atname = nameForAuthType("ghid");
        html += "<td><input type=\"checkbox\" name=\"aaghid\"" +
            " value=\"" + atname + "\" id=\"aaghid\"" +
            " onchange=\"mor.profile.toggleAuthChange('ghid','" + 
                             domid + "');return false;\"";
        if(mor.isId(pen.ghid)) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aaghid\">" + atname + "</label></td>";
        html += "</tr></table>";
        mor.out(domid, html);
    },


    addMyOpenReviewsAuth = function (domid, pen) {
        var html = "<form action=\"" + mor.secsvr + "/loginid\"" +
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
        mor.out(domid, html);
    },


    handleAuthChangeToggle = function (pen, authtype, domid) {
        var action = "remove", methcount, previd;
        if(mor.byId("aa" + authtype).checked) {
            action = "add"; }
        if(action === "remove") {
            methcount = (pen.mid? 1 : 0) +
                (pen.gsid? 1 : 0) +
                (pen.fbid? 1 : 0) +
                (pen.twid? 1 : 0) +
                (pen.ghid? 1 : 0);
            if(methcount < 2) {
                alert("You must have at least one authentication type.");
                mor.byId("aa" + authtype).checked = true;
                return;  } 
            if(authtype === mor.login.getAuthMethod()) {
                alert("You can't remove the authentication you are " +
                      "currently logged in with.");
                mor.byId("aa" + authtype).checked = true;
                return;  } 
            if(confirm("Are you sure you want to remove access to this" +
                       " Pen Name from " + nameForAuthType(authtype) + "?")) {
                mor.out(domid, "Updating...");
                previd = pen[authtype];
                pen[authtype] = 0;
                mor.pen.updatePen(pen,
                                  function (updpen) {
                                      displayAuthSettings(domid, updpen); },
                                  function (code, errtxt) {
                                      mor.err("handleAuthChangeToggle error " +
                                              code + ": " + errtxt);
                                      pen[authtype] = previd;
                                      displayAuthSettings(domid, pen); }); }
            else {
                mor.byId("aa" + authtype).checked = true; } }
        else if(action === "add") {
            switch(authtype) {
            case "mid": 
                addMyOpenReviewsAuth(domid, pen); break;
            case "fbid": 
                require([ "ext/facebook" ],
                        function (facebook) {
                            if(!mor.facebook) { mor.facebook = facebook; }
                            facebook.addProfileAuth(domid, pen); });
                break;
            case "twid":
                require([ "ext/twitter" ],
                        function (twitter) {
                            if(!mor.twitter) { mor.twitter = twitter; }
                            twitter.addProfileAuth(domid, pen); });
                break;
            case "gsid":
                require([ "ext/googleplus" ],
                        function (googleplus) {
                            if(!mor.googleplus) { mor.googleplus = googleplus; }
                            googleplus.addProfileAuth(domid, pen); });
                break;
            case "ghid":
                require([ "ext/github" ],
                        function (github) {
                            if(!mor.github) { mor.github = github; }
                            github.addProfileAuth(domid, pen); });
                break;
            } }
    },


    changeToSelectedPen = function () {
        var i, sel = mor.byId('penselect'), temp = "";
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                //do not call cancelPenNameSettings before done accessing
                //the selection elementobjects or IE8 has issues.
                if(sel.options[i].id === 'newpenopt') {
                    cancelPenNameSettings("Creating new pen name...");
                    mor.pen.newPenName(mor.profile.display); }
                else {
                    temp = sel.options[i].value;
                    cancelPenNameSettings("Switching pen names...");
                    mor.pen.selectPenByName(temp); }
                break; } }
    },


    penSelectHTML = function (pen) {
        var html, pens = mor.pen.getPenNames(), i;
        html = "<div id=\"penseldiv\">" +
            "<span class=\"headingtxt\">Writing as </span>" +
            "<select id=\"penselect\"" + 
                   " onchange=\"mor.profile.switchPen();return false;\">";
        for(i = 0; i < pens.length; i += 1) {
            html += "<option id=\"" + mor.instId(pens[i]) + "\"";
            if(pens[i].name === pen.name) {
                html += " selected=\"selected\""; }
            html += ">" + pens[i].name + "</option>"; }
        html += "<option id=\"newpenopt\">New Pen Name</option>" +
            "</select>" + "&nbsp;" + 
            "<button type=\"button\" id=\"penselectok\"" + 
            " onclick=\"mor.profile.switchPen();return false;\"" +
            ">go</button>" +
            "</div>";
        return html;
    },


    changeSettings = function (pen) {
        var html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"mor.profile.cancelPenNameSettings();return false;\"" +
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
        mor.out('dlgdiv', html);
        mor.onchange('pennamein', mor.profile.setPenName);
        mor.onclick('savebutton', mor.profile.saveSettings);
        displayAuthSettings('settingsauthtd', pen);
        mor.services.display('consvcstd', pen);
        mor.skinner.init('settingsskintd', pen);
        mor.byId('dlgdiv').style.visibility = "visible";
        if(mor.isLowFuncBrowser()) {
            mor.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        mor.onescapefunc = cancelPenNameSettings;
    },


    addMyOpenReviewsAuthId = function (pen, mid) {
        var previd;
        if(!mid) {
            mor.err("No account ID received.");
            mor.profile.display(); }
        else {
            previd = pen.mid;
            pen.mid = mid;
            mor.pen.updatePen(pen,
                              function (updpen) {
                                  changeSettings(updpen); },
                              function (code, errtxt) {
                                  mor.err("addMyOpenReviewsAuthId error " +
                                          code + ": " + errtxt);
                                  pen.mid = previd;
                                  mor.profile.display(); }); }
    },


    mailButtonHTML = function () {
        var html, href, subj, body, types, revchecks, i, ts;
        subj = "Sharing experiences through reviews";
        body = "Hey,\n\n" +
            "I'm using MyOpenReviews to review things I experience.\n\n" + 
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
        body += "\n\nIf you sign up, then I'll be able to follow what you " +
            "like and don't like, and you can see what I like and don't like " +
            "by following me. " + 
            "To follow me, click the 'follow' icon next to '" + profpen.name + 
            "' on my profile page. Here's the direct link to my profile:\n\n" +
            "http://www.myopenreviews.com/#view=profile&profid=" +
            mor.instId(profpen) + "\n\n" +
            "I'll follow back when I see you in my 'Followers' tab.\n\n" +
            "Looking forward to hearing about your new finds";
        if(types) {
            body += " in " + types; }
        body += "!\n\ncheers,\n" + profpen.name + "\n\n";
        href = "mailto:?subject=" + mor.dquotenc(subj) + 
            "&body=" + mor.dquotenc(body);
        html = mor.services.serviceLinkHTML(href, "", "shareico", 
                                            "Invite via eMail",
                                            "img/email.png");
        return html;
    },


    updateInviteInfo = function () {
        mor.out('mailbspan', mailButtonHTML());
    },


    displayInvitationDialog = function () {
        var html;
        html = "<div class=\"dlgclosex\">" +
            "<a id=\"closedlg\" href=\"#close\"" +
              " onclick=\"mor.layout.closeDialog();return false;\"" +
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
              mor.review.reviewTypeCheckboxesHTML("invrevcb", 
                                                  "mor.profile.chginvite") +
            "</td></tr>" +
            "<tr><td>" + 
              "Invite your friend to join:" +
            "</td></tr>" +
            "<tr><td align=\"center\">" + 
              "<span id=\"mailbspan\"></span>" +
            "</td></tr>" +
          "</table>";
        mor.out('dlgdiv', html);
        mor.byId('dlgdiv').style.visibility = "visible";
        if(mor.isLowFuncBrowser()) {
            mor.byId('dlgdiv').style.backgroundColor = "#eeeeee"; }
        mor.onescapefunc = mor.layout.closeDialog;
        updateInviteInfo();
    },


    badgeDispHTML = function (pen) {
        var html, i, reviewTypes, typename;
        html = "";
        mor.pen.deserializeFields(pen);
        reviewTypes = mor.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(pen.top20s[typename] && pen.top20s[typename].length >= 20) {
                html += mor.review.badgeImageHTML(reviewTypes[i]); } }
        return html;
    },


    penListItemHTML = function (pen) {
        var penid = mor.instId(pen), picuri, hash, linktitle, html;
        hash = mor.objdata({ view: "profile", profid: penid });
        linktitle = mor.ellipsis(pen.shoutout, 75);
        if(!linktitle) {  //do not encode pen name here.  No "First%20Last"..
            linktitle = "View profile for " + pen.name; }
        html = "<li>" +
            "<a href=\"#" + hash + "\"" +
            " onclick=\"mor.profile.changeid('" + penid + "');return false;\"" +
            " title=\"" + linktitle + "\">";
        //empytprofpic.png looks like big checkboxes, use blank instead
        picuri = "img/blank.png";
        if(pen.profpic) {
            picuri = "profpic?profileid=" + penid; }
        html += "<img class=\"srchpic\" src=\"" + picuri + "\"/>" +
            "&nbsp;" + "<span class=\"penfont\">" + pen.name + 
            "</span>" + "</a>";
        if(pen.city) {
            html += " <span class=\"smalltext\">(" + pen.city + ")</span>"; }
        html += badgeDispHTML(pen);
        html += "</li>";
        return html;
    },


    findPenInArray = function (id, pens) {
        var i;
        for(i = 0; pens && i < pens.length; i += 1) {
            if(mor.instId(pens[i]) === id) {
                return pens[i]; } }
    },


    cachedPen = function (id) {
        var pen;
        //check our own pens first, usually fewer of those
        if(!pen) {
            pen = findPenInArray(id, mor.pen.getPenNames()); }
        //check the current search results
        if(!pen) {
            pen = findPenInArray(id, searchresults); }
        //check the cached pens
        if(!pen) {
            pen = findPenInArray(id, cachepens); }
        return pen;
    },


    verifyDisplayTypeSelected = function () {
        if(typeof profpen.top20s === "string") {
            profpen.top20s = mor.dojo.json.parse(profpen.top20s); }
        if(!profpen.profstate) {  //transient profile display state info
            profpen.profstate = { seltabname: 'recent',
                                  revtype: "",
                                  allrevsrchval: "",
                                  allrevsrchcursor: "",
                                  allrevttl: 0,
                                  allrevcontreqs: 1,
                                  allrevs: [] }; }
        if(!profpen.profstate.revtype && profpen.top20s) {
            profpen.profstate.revtype = profpen.top20s.latestrevtype; }
        if(!profpen.profstate.revtype) {
            profpen.profstate.revtype = 'book'; }
    },


    updateCached = function (pens) {
        var i, j, pen, penid, seltab;
        if(pens && pens.length) {
            for(i = 0; i < pens.length; i += 1) {
                pen = pens[i];
                penid = mor.instId(pen);
                if(mor.instId(profpen) === penid) {
                    //keep currently selected tab, but rebuild rest
                    if(profpen && profpen.profstate) {
                        seltab = profpen.profstate.revtype; }
                    profpen = pen;
                    verifyDisplayTypeSelected();
                    if(seltab) {
                        profpen.profstate.revtype = seltab; } }
                for(j = 0; j < searchresults.length; j += 1) {
                    if(mor.instId(searchresults[j]) === penid) {
                        searchresults[j] = pen;
                        break; } }
                for(j = 0; j < cachepens.length; j += 1) {
                    if(mor.instId(cachepens[j]) === penid) {
                        cachepens[j] = pen;
                        break; } } } }
    },


    findOrLoadPen = function (id, callback) {
        var pen, params, critsec = "";
        pen = cachedPen(id);
        if(pen) {
            return callback(pen); }
        params = "penid=" + id;
        mor.call("penbyid?" + params, 'GET', null,
                 function (pens) {
                     if(pens.length > 0) {
                         cachepens.push(pens[0]);
                         callback(pens[0]); }
                     else {
                         mor.err("findOrLoadPen found no pen id: " + id); } },
                 function (code, errtxt) {
                     mor.err("findOrLoadPen failed code " + code + ": " + 
                             errtxt); },
                 critsec);
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


    selectTab = function (tabid, tabfunc) {
        var i, ul, li;
        ul = mor.byId('proftabsul');
        for(i = 0; i < ul.childNodes.length; i += 1) {
            li = ul.childNodes[i];
            li.className = "unselectedTab";
            li.style.backgroundColor = mor.skinner.darkbg(); }
        li = mor.byId(tabid);
        li.className = "selectedTab";
        li.style.backgroundColor = "transparent";
        currtab = tabfunc;
        mor.historyCheckpoint({ view: "profile", profid: mor.instId(profpen),
                                tab: mor.profile.currentTabAsString() });

    },


    resetReviewDisplays = function () {
        clearReviewSearchState(recentRevState);
        recentRevState.tab = "recent";
    },


    readReview = function (revid) {
        var i, revobj, t20s, revtype, tops;
        //Try find source review in the recent reviews
        for(i = 0; !revobj && i < recentRevState.results.length; i += 1) {
            if(mor.instId(recentRevState.results[i]) === revid) {
                revobj = recentRevState.results[i]; } }
        //Try find source review in the top 20 reviews
        if(!revobj && profpen && profpen.top20s && 
                      typeof profpen.top20s === 'object') {
            t20s = profpen.top20s;
            for(revtype in t20s) {
                //revtype may be null, but jslint wants this condition order..
                if(t20s.hasOwnProperty(revtype) && revtype) {
                    tops = t20s[revtype];
                    if(tops && tops.length && typeof tops !== "string") {
                        for(i = 0; !revobj && i < tops.length; i += 1) {
                            if(typeof tops[i] === 'object' &&
                               mor.instId(tops[i]) === revid) {
                                revobj = tops[i]; } } } } } }
        //Try find the source review in the activity display
        if(!revobj) {
            revobj = mor.activity.findReview(revid); }
        //Try find the source review in the search results
        if(!revobj && searchresults && searchresults.length) {
            for(i = 0; i < searchresults.length; i += 1) {
                if(!searchresults[i].revtype) {
                    break; }  //searched something other than reviews
                if(mor.instId(searchresults[i]) === revid) {
                    revobj = searchresults[i]; } } }
        //Make some noise if you can't find it rather than being a dead link
        if(!revobj) {
            mor.err("readReview " + revid + " not found");
            return; }
        mor.historyCheckpoint({ view: "review", mode: "display",
                                revid: revid });
        mor.review.setCurrentReview(revobj);
        mor.review.displayRead();
    },


    reviewItemHTML = function (revobj, penNameStr) {
        var revid, type, linkref, html, text;
        revid = mor.instId(revobj);
        type = mor.review.getReviewTypeByValue(revobj.revtype);
        linkref = "statrev/" + revid;
        html = "<li>" + mor.review.starsImageHTML(revobj.rating) + 
            mor.review.badgeImageHTML(type) + "&nbsp;" +
            "<a id=\"lihr" + revid + "\" href=\"" + linkref + "\"" +
              " onclick=\"mor.profile.readReview('" + revid + "');" + 
                         "return false;\"" +
              " title=\"See full review\">";
        if(type.subkey) {
            html += "<i>" + mor.ellipsis(revobj[type.key], 60) + "</i> " +
                mor.ellipsis(revobj[type.subkey], 40); }
        else {
            html += mor.ellipsis(revobj[type.key], 60); }
        html += "</a>";
        if(revobj.url) {
            html += " &nbsp;" + mor.review.graphicAbbrevSiteLink(revobj.url); }
        if(penNameStr) {
            linkref = mor.objdata({ view: "profile", profid: revobj.penid });
            html += "<div class=\"revtextsummary\">" + 
                "<a href=\"#" + linkref + "\"" +
                 " onclick=\"mor.profile.changeid('" + revobj.penid + "');" +
                            "return false;\"" +
                 " title=\"Show profile for " + mor.ndq(penNameStr) + "\">" +
                "review by " + penNameStr + "</a></div>"; }
        text = (revobj.text || "") + " " + (revobj.keywords || "");
        html += "<div class=\"revtextsummary\">" + 
            mor.ellipsis(text, 255) + "</div>";
        html += "</li>";
        return html;
    },


    displayRecentReviews = function (dispState, reviews) {
        var i, html = "<ul class=\"revlist\">", fetched;
        for(i = 0; i < dispState.results.length; i += 1) {
            html += reviewItemHTML(dispState.results[i]); }
        if(reviews) {  //have fresh search results
            dispState.cursor = "";
            for(i = 0; i < reviews.length; i += 1) {
                if(reviews[i].fetched) {
                    fetched = reviews[i].fetched;
                    if(typeof fetched === "number" && fetched >= 0) {
                        dispState.total += reviews[i].fetched;
                        html += "<div class=\"sumtotal\">" +
                            dispState.total + " reviews searched</div>"; }
                    if(reviews[i].cursor) {
                        dispState.cursor = reviews[i].cursor; }
                    break; }  //if no reviews, i will be left at zero
                dispState.results.push(reviews[i]);
                html += reviewItemHTML(reviews[i]); } }
        dispState.total = Math.max(dispState.total, dispState.results.length);
        if(dispState.total === 0) {
            html += "<li>No recent reviews.";
            if(mor.instId(profpen) === mor.pen.currPenId()) {
                html += " " + mor.review.reviewLinkHTML(); }
            html += "</li>"; }
        html += "</ul>";
        if(dispState.cursor) {
            if(i === 0 && dispState.results.length === 0) {
                if(dispState.total < 2000) {  //auto-repeat search
                    setTimeout(mor.profile.revsmore, 10); } 
                else {
                    html += "No recent reviews found, only batch updates."; } }
            else {
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"mor.profile.revsmore();" +
                                     "return false;\"" +
                          " title=\"More reviews\"" + 
                    ">more reviews...</a>"; } }
        mor.out('profcontdiv', html);
        mor.layout.adjust();
    },


    findRecentReviews = function (dispState) {
        var params, critsec = "";
        if(!dispState.params.penid) {
            dispState.params.penid = mor.instId(profpen); }
        params = mor.objdata(dispState.params) + "&" + mor.login.authparams();
        if(dispState.cursor) {
            params += "&cursor=" + mor.enc(dispState.cursor); }
        mor.call("srchrevs?" + params, 'GET', null,
                 function (revs) {
                     displayRecentReviews(dispState, revs); },
                 function (code, errtxt) {
                     mor.out('profcontdiv', "findRecentReviews failed code " + 
                             code + " " + errtxt); },
                 critsec);
    },


    recent = function () {
        var html, maxdate, mindate;
        selectTab("recentli", recent);
        if(recentRevState && recentRevState.initialized &&
           recentRevState.penid === mor.instId(profpen)) {
            displayRecentReviews(recentRevState);
            return; }
        html = "Retrieving recent activity for " + profpen.name + "...";
        mor.out('profcontdiv', html);
        mor.layout.adjust();
        clearReviewSearchState(recentRevState);
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        recentRevState.params.maxdate = maxdate.toISOString();
        recentRevState.params.mindate = mindate.toISOString();
        recentRevState.penid = mor.instId(profpen);
        recentRevState.initialized = true; 
        findRecentReviews(recentRevState);
    },


    revTypeSelectorHTML = function (clickfuncstr) {
        var html, i, reviewTypes, typename, label, dispclass, pen = profpen;
        html = "";
        mor.pen.deserializeFields(pen);
        reviewTypes = mor.review.getReviewTypes();
        for(i = 0; i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            dispclass = "reviewbadgedis";
            label = "No " + reviewTypes[i].type.capitalize() + " reviews.";
            if(pen.top20s[typename]) {
                if(pen.top20s[typename].length >= 20) {
                    label = "Top 20 " + reviewTypes[i].plural.capitalize();
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


    best = function () {
        var html, revs, i, state, critsec = "";
        selectTab("bestli", best);
        verifyDisplayTypeSelected();
        state = profpen.profstate;
        html = revTypeSelectorHTML("mor.profile.showTopRated");
        revs = [];
        if(profpen.top20s) {
            revs = profpen.top20s[state.revtype] || []; }
        html += "<ul class=\"revlist\">";
        if(revs.length === 0) {
            html += "<li>No top rated " + state.revtype + " reviews.";
            if(mor.instId(profpen) === mor.pen.currPenId()) {
                html += " " + mor.review.reviewLinkHTML(); }
            html += "</li>"; }
        for(i = 0; i < revs.length; i += 1) {
            if(typeof revs[i] === 'string') {
                if(revs[i].indexOf("not found") >= 0) {
                    html += "</li>Review " + revs[i] + "</li>"; }
                else if((typeof workrev === 'object') &&
                        (mor.instId(workrev) === revs[i])) {
                    revs[i] = workrev;
                    html += reviewItemHTML(revs[i]); }
                else {
                    html += "<li>Fetching review " + revs[i] + "...</li>";
                    break; } }
            else if(typeof revs[i] === 'object') {
                html += reviewItemHTML(revs[i]); } }
        html += "</ul>";
        mor.out('profcontdiv', html);
        mor.layout.adjust();
        if(i < revs.length) {  //didn't make it through, go fetch
            mor.call("revbyid?revid=" + revs[i], 'GET', null,
                     function (fetchedrevs) {
                         if(fetchedrevs.length > 0) {
                             workrev = fetchedrevs[0]; }
                         else {
                             revs[i] += ": not found"; }
                         mor.profile.best(); },
                     function (code, errtxt) {
                         revs[i] += ": not found";
                         mor.profile.best(); },
                     critsec); }
    },


    clearAllRevProfWorkState = function () {
        var state = profpen.profstate;
        //does not reset allrevsrchval or revtype
        if(state.allrevauto) {
            window.clearTimeout(state.allrevauto);
            state.allrevauto = null; }
        if(state.allrevqmon) {
            window.clearTimeout(state.allrevqmon);
            state.allrevqmon = null; }
        state.allrevsrchcursor = "";
        state.allrevttl = 0;
        state.allrevcontreqs = 1;
        state.allrevs = [];
    },


    allrevMaxAutoSearch = function () {
        var maxauto = 1000,
            ttl = profpen.profstate.allrevttl,
            contreqs = profpen.profstate.allrevcontreqs;
        if(ttl >= (maxauto * contreqs)) {
            return true; }
        return false;
    },


    displayAllRevs = function (results) {
        var html, i, state = profpen.profstate;
        html = "<ul class=\"revlist\">";
        for(i = 0; i < state.allrevs.length; i += 1) {
            html += reviewItemHTML(state.allrevs[i]); }
        if(!results || results.length === 0) {
            results = [ { "fetched": 0, "cursor": "" } ]; }
        state.allrevsrchcursor = "";  //used, so reset
        for(i = 0; i < results.length; i += 1) {
            if(typeof results[i].fetched === "number") {
                state.allrevttl += results[i].fetched;
                html += "<div class=\"sumtotal\">" +
                    state.allrevttl + " reviews searched</div>";
                if(results[i].cursor) {
                    state.allrevsrchcursor = results[i].cursor; }
                break; }  //leave i at its current value
            state.allrevs.push(results[i]);
            html += reviewItemHTML(results[i]); }
        html += "</ul>";
        if(state.allrevsrchcursor) {
            if(i === 0 && !allrevMaxAutoSearch()) {
                //auto-repeat the search to try get a result to display
                state.allrevauto = window.setTimeout(mor.profile.searchReviews,
                                                     10); }
            else {
                if(allrevMaxAutoSearch) {  //they continued search manually
                    state.allrevcontreqs += 1; }
                html += "<a href=\"#continuesearch\"" +
                    " onclick=\"mor.profile.searchReviews();return false;\"" +
                    " title=\"Continue searching for more matching reviews\"" +
                    ">continue search...</a>"; } }
        mor.out('allrevdispdiv', html);
    },


    monitorAllRevQuery = function () {
        var state, srchin, qstr = "";
        state = profpen.profstate;
        srchin = mor.byId('allrevsrchin');
        if(!srchin) {  //probably switched tabs, quit
            return; }
        qstr = srchin.value;
        if(qstr !== state.allrevsrchval) {
            if(state.allrevqmon) {
                window.clearTimeout(state.allrevqmon);
                state.allrevqmon = null; }
            mor.profile.searchReviews(); }
        else {
            state.allrevqmon = setTimeout(monitorAllRevQuery, 400); }
    },


    allrevs = function () {
        var html;
        selectTab("allrevsli", allrevs);
        verifyDisplayTypeSelected();
        html = revTypeSelectorHTML("mor.profile.searchRevsIfTypeChange");
        html += "<div id=\"allrevsrchdiv\">" +
            "<input type=\"text\" id=\"allrevsrchin\" size=\"40\"" +
                  " placeholder=\"Review title or name\"" + 
                  " value=\"" + profpen.profstate.allrevsrchval + "\"" +
            //the onchange here can cause a dupe display???
                  " onchange=\"mor.profile.allrevs();return false;\"" +
            "/></div>" +
            "<div id=\"allrevdispdiv\"></div>";
        mor.out('profcontdiv', html);
        mor.byId('allrevsrchin').focus();
        if(profpen.profstate.allrevs.length > 0) {
            displayAllRevs([]);  //display previous results
            monitorAllRevQuery(); }
        else {
            clearAllRevProfWorkState();
            mor.profile.searchReviews(); }
    },


    searchReviews = function (revtype) {
        var state, qstr, maxdate, mindate, params, critsec = "";
        state = profpen.profstate;
        if(revtype) {
            if(state.revtype !== revtype) {
                state.revtype = revtype;
                clearAllRevProfWorkState(); } }
        else {
            revtype = state.revtype; }
        qstr = mor.byId('allrevsrchin').value;
        if(qstr !== state.allrevsrchval) {
            state.allrevsrchval = qstr;
            clearAllRevProfWorkState(); }
        maxdate = (new Date()).toISOString();
        mindate = (new Date(0)).toISOString();
        params = mor.login.authparams() +
            "&qstr=" + mor.enc(mor.canonize(qstr)) +
            "&revtype=" + revtype +
            "&penid=" + mor.pen.currPenId() +
            "&maxdate=" + maxdate + "&mindate=" + mindate +
            "&cursor=" + mor.enc(state.allrevsrchcursor);
        mor.call("srchrevs?" + params, 'GET', null,
                 function (results) { 
                     displayAllRevs(results);
                     monitorAllRevQuery(); },
                 function (code, errtxt) {
                     mor.err("searchReviews call died code: " + code + " " +
                             errtxt); },
                 critsec);
    },


    following = function () {
        selectTab("followingli", following);
        verifyDisplayTypeSelected();
        mor.rel.displayRelations(profpen, "outbound", "profcontdiv");
        mor.layout.adjust();
    },


    followers = function () {
        selectTab("followersli", followers);
        verifyDisplayTypeSelected();
        mor.rel.displayRelations(profpen, "inbound", "profcontdiv");
        mor.layout.adjust();
    },


    toggleSearchOptions = function () {
        var sod = mor.byId(searchmode + 'searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                mor.out('srchoptstogglehref', "- search options");
                sod.style.display = "block"; }
            else {
                mor.out('srchoptstogglehref', "+ search options");
                sod.style.display = "none"; } }
        mor.layout.adjust();
    },


    changeSearchMode = function () {
        var i, radios, prevmode = searchmode;
        radios = document.getElementsByName("searchmode");
        for(i = 0; i < radios.length; i += 1) {
            if(radios[i].checked) {
                if(radios[i].value === "pen") {
                    mor.byId('revsearchoptionsdiv').style.display = "none";
                    mor.byId('pensearchoptionsdiv').style.display = "block";
                    mor.byId('searchtxt').placeholder = pensrchplace;
                    searchmode = "pen";
                    break; }
                if(radios[i].value === "rev") {
                    mor.byId('revsearchoptionsdiv').style.display = "block";
                    mor.byId('pensearchoptionsdiv').style.display = "none";
                    mor.byId('searchtxt').placeholder = revsrchplace;
                    searchmode = "rev";
                    break; } } }
        mor.out('srchoptstogglehref', "");
        if(prevmode !== searchmode) {
            mor.out('searchresults', ""); }
        if(searchmode === "pen") {  //start with options hidden for pen search
            toggleSearchOptions(); }
    },


    displayTabs = function (pen) {
        var html;
        html = "<ul id=\"proftabsul\">" +
          "<li id=\"recentli\" class=\"selectedTab\">" + 
            tablink("Recent Reviews", "mor.profile.recent()") + 
          "</li>" +
          "<li id=\"bestli\" class=\"unselectedTab\">" +
            tablink("Top Rated", "mor.profile.best()") + 
          "</li>" +
          "<li id=\"allrevsli\" class=\"unselectedTab\">" +
            tablink("All Reviews", "mor.profile.allrevs()") +
          "</li>" +
          "<li id=\"followingli\" class=\"unselectedTab\">" +
            tablink("Following (" + pen.following + ")", 
                    "mor.profile.following()") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers (" + pen.followers + ")", 
                    "mor.profile.followers()") + 
          "</li>";
        html += "</ul>";
        mor.out('proftabsdiv', html);
        if(!currtab) {
            currtab = recent; }
        currtab();
    },


    getCurrTabAsString = function () {
        if(currtab === recent) { return "recent"; }
        if(currtab === best) { return "best"; }
        if(currtab === allrevs) { return "allrevs"; }
        if(currtab === following) { return "following"; }
        if(currtab === followers) { return "followers"; }
        if(currtab === mor.profile.search) { return "search"; }
        return "recent"; //default
    },


    setCurrTabFromString = function (tabstr) {
        switch(tabstr) {
        case "recent": currtab = recent; break;
        case "best": currtab = best; break;
        case "allrevs": currtab = allrevs; break;
        case "following": currtab = following; break;
        case "followers": currtab = followers; break;
        case "search": currtab = mor.profile.search; break;
        }
    },


    cancelProfileEdit = function () {
        mor.profile.updateHeading();
        mor.profile.display();
    },


    profEditFail = function (code, errtxt) {
        mor.out('sysnotice', errtxt);
    },


    saveEditedProfile = function (pen) {
        var elem;
        elem = mor.byId('profcityin');
        if(elem) {
            pen.city = elem.value; }
        elem = mor.byId('shouttxt');
        if(elem) {
            pen.shoutout = elem.value; }
        mor.pen.updatePen(pen, mor.profile.display, profEditFail);
    },


    displayProfEditButtons = function () {
        var html;
        if(mor.byId('profcancelb')) {
            return; }  //already have buttons
        html = "&nbsp;" +
            "<button type=\"button\" id=\"profcancelb\">Cancel</button>" +
            "&nbsp;" +
            "<button type=\"button\" id=\"profsaveb\">Save</button>";
        mor.out('profeditbspan', html);
        mor.onclick('profcancelb', cancelProfileEdit);
        mor.onclick('profsaveb', mor.profile.save);
    },


    styleShout = function (shout) {
        var target;
        shout.style.color = mor.colors.text;
        shout.style.backgroundColor = mor.skinner.lightbg();
        //80px left margin + 160px image + padding
        //+ balancing right margin space (preferable)
        //but going much smaller than the image is stupid regardless of
        //screen size
        target = Math.max((mor.winw - 350), 200);
        target = Math.min(target, 600);
        shout.style.width = target + "px";
        //modify profcontdiv so it balances the text area size.  This is
        //needed so IE8 doesn't widen profpictd unnecessarily.
        target += mor.byId('profpictd').offsetWidth;
        target += 50;  //arbitrary extra to cover padding
        mor.byId('profcontdiv').style.width = String(target) + "px";
    },


    editShout = function (pen) {
        var html, shout;
        html = "<textarea id=\"shouttxt\" class=\"shoutout\"></textarea>";
        mor.out('profshouttd', html);
        shout = mor.byId('shouttxt');
        styleShout(shout);
        shout.readOnly = false;
        shout.value = pen.shoutout;
        shout.focus();
        displayProfEditButtons();
    },


    displayShout = function (pen) {
        var html, shout, text;
        text = "No additional information about " + pen.name;
        if(mor.instId(profpen) === mor.pen.currPenId()) {
            text = "About me (anything you would like to say to everyone)." + 
                " Link to your twitter handle, blog or site if you want."; }
        text = "<span style=\"color:" + greytxt + ";\">" + text + "</span>";
        html = "<div id=\"shoutdiv\" class=\"shoutout\"></div>";
        mor.out('profshouttd', html);
        shout = mor.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + mor.colors.bodybg;
        text = mor.linkify(pen.shoutout) || text;
        mor.out('shoutdiv', text);
        if(mor.profile.authorized(pen)) {
            mor.onclick('shoutdiv', function () {
                editShout(pen); }); }
    },



    saveUnlessShoutEdit = function () {
        if(mor.byId('shoutdiv')) {
            mor.profile.save(); }
    },


    editCity = function () {
        var val, html, elem;
        elem = mor.byId('profcityin');
        if(elem) {
            return; }  //already editing
        val = mor.byId('profcityspan').innerHTML;
        //IE8 actually capitalizes the the HTML for you. Sheesh.
        if(val.indexOf("<a") === 0 || val.indexOf("<A") === 0) {
            val = mor.byId('profcitya').innerHTML; }
        if(val === unspecifiedCityText) {
            val = ""; }
        html = "<input type=\"text\" id=\"profcityin\" size=\"25\"" +
                     " placeholder=\"City or Region\"" +
                     " value=\"" + val + "\"/>";
        mor.out('profcityspan', html);
        displayProfEditButtons();
        mor.onchange('profcityin', saveUnlessShoutEdit);
        mor.byId('profcityin').focus();
    },


    displayCity = function (pen) {
        var html, style = "";
        if(!pen.city) { 
            mor.byId('profcityspan').style.color = greytxt; }
        html = pen.city || unspecifiedCityText;            
        if(!pen.city) {
            style = " style=\"color:" + greytxt + ";\""; }
        if(mor.profile.authorized(pen)) {
            html = "<a href=\"#edit city\" title=\"Edit city\"" +
                     " id=\"profcitya\"" + 
                     " onclick=\"mor.profile.editCity();return false;\"" +
                       style + ">" + html + "</a>"; }
        mor.out('profcityspan', html);
    },


    //actual submitted form, so triggers full reload
    displayUploadPicForm = function (pen) {
        var odiv, html = "";
        html += mor.paramsToFormInputs(mor.login.authparams());
        html += "<input type=\"hidden\" name=\"_id\" value=\"" + 
            mor.instId(pen) + "\"/>";
        html += "<input type=\"hidden\" name=\"returnto\" value=\"" +
            mor.enc(window.location.href + "#profile") + "\"/>";
        html = "<form action=\"/profpicupload\"" +
                    " enctype=\"multipart/form-data\" method=\"post\">" +
            "<div id=\"closeline\">" +
              "<a id=\"closedlg\" href=\"#close\"" +
                " onclick=\"mor.cancelPicUpload();return false\">" + 
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
        mor.out('overlaydiv', html);
        odiv = mor.byId('overlaydiv');
        odiv.style.top = "80px";
        odiv.style.visibility = "visible";
        odiv.style.backgroundColor = mor.skinner.lightbg();
        mor.onescapefunc = mor.cancelPicUpload;
        mor.byId('picfilein').focus();
    },


    displayPic = function (pen) {
        var html = "img/emptyprofpic.png";
        if(pen.profpic) {
            html = "profpic?profileid=" + mor.instId(pen); }
        html = "<img class=\"profpic\" src=\"" + html + "\"/>";
        mor.out('profpictd', html);
        if(mor.profile.authorized(pen)) {
            mor.onclick('profpictd', function () {
                if(mor.byId('profcancelb')) {  //save other field edits so
                    saveEditedProfile(pen); }  //they aren't lost on reload
                displayUploadPicForm(pen); }); }
    },


    earnedBadgesHTML = function (pen) {
        var html, i, reviewTypes, typename, label, dispclass;
        html = "";
        mor.pen.deserializeFields(pen);
        reviewTypes = mor.review.getReviewTypes();
        for(i = 0; pen.top20s && i < reviewTypes.length; i += 1) {
            typename = reviewTypes[i].type;
            if(pen.top20s[typename] && pen.top20s[typename].length >= 1) {
                label = "top 20 " + reviewTypes[i].plural.capitalize();
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
                    " onclick=\"mor.profile.showTopRated('" + typename + "');" +
                               "return false;\"" +
                    "/>"; } }
        return html;
    },


    showTopRated = function (typename) {
        verifyDisplayTypeSelected();  //init state variables if needed
        profpen.profstate.revtype = typename;
        best();
    },


    verifyStateVariableValues = function (pen) {
        if(profpen !== pen) {
            profpen = pen; }
    },


    mainDisplay = function (homepen, dispen, action, errmsg) {
        var html;
        if(!dispen) {
            dispen = homepen; }
        verifyStateVariableValues(dispen);
        mor.historyCheckpoint({ view: "profile", profid: mor.instId(profpen),
                                tab: getCurrTabAsString() });
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(homepen, dispen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        mor.skinner.setColorsFromPen(homepen);
        html = "<div id=\"proftopdiv\">" +
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
        if(!mor.layout.haveContentDivAreas()) { //change pw kills it
            mor.layout.initContentDivAreas(); }
        mor.out('cmain', html);
        mor.out('profbadgestd', earnedBadgesHTML(dispen));
        if(mor.instId(profpen) === mor.pen.currPenId()) {
            html = "<a id=\"commbuild\" href=\"#invite\"" + 
                     " onclick=\"mor.profile.invite();return false\">" +
                "<img class=\"reviewbadge\" src=\"img/follow.png\">" +
                "Build your community</a>";
            mor.out('profcommbuildtd', html); }
        displayShout(dispen);
        displayCity(dispen);
        displayPic(dispen);
        displayTabs(dispen);
        mor.layout.adjust();
        if(errmsg) {
            mor.err("Previous processing failed: " + errmsg); }
    },


    displayProfileForId = function (id) {
        resetReviewDisplays();
        findOrLoadPen(id, function (dispen) {
            mor.pen.getPen(function (homepen) {
                mainDisplay(homepen, dispen); }); });
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function (action, errmsg) {
            mor.pen.getPen(function (homepen) {
                mainDisplay(homepen, null, action, errmsg); }); },
        updateHeading: function () {
            mor.pen.getPen(function (homepen) {
                writeNavDisplay(homepen, profpen); }); },
        refresh: function () {
            mor.pen.getPen(function (homepen) {
                mainDisplay(homepen, profpen); }); },
        settings: function () {
            mor.pen.getPen(changeSettings); },
        recent: function () {
            recent(); },
        best: function () {
            best(); },
        allrevs: function () {
            allrevs(); },
        following: function () {
            following(); },
        followers: function () {
            followers(); },
        togglesrchopts: function () {
            toggleSearchOptions(); },
        resetReviews: function () {
            resetReviewDisplays(); },
        authorized: function (pen) {
            if(mor.isId(pen.mid) || mor.isId(pen.gsid) || mor.isId(pen.fbid) || 
               mor.isId(pen.twid) || mor.isId(pen.ghid)) {
                return true; }
            return false; },
        save: function () {
            mor.pen.getPen(saveEditedProfile); },
        setPenName: function () {
            mor.pen.getPen(setPenNameFromInput); },
        saveSettings: function () {
            mor.pen.getPen(savePenNameSettings); },
        byprofid: function (id) {
            displayProfileForId(id); },
        changeid: function (id) {
            currtab = recent;
            displayProfileForId(id); },
        initWithId: function (id) {
            mor.pen.getPen(function (pen) { displayProfileForId(id); }); },
        setTab: function (tabstr) {
            setCurrTabFromString(tabstr); },
        relationship: function () {
            createOrEditRelationship(); },
        retrievePen: function (id, callback) {
            return findOrLoadPen(id, callback); },
        getCachedPen: function (id) {
            return cachedPen(id); },
        switchPen: function () {
            changeToSelectedPen(); },
        penListItemHTML: function (pen) {
            return penListItemHTML(pen); },
        updateCached: function (pens) {
            updateCached(pens); },
        currentTabAsString: function () {
            return getCurrTabAsString(); },
        revsmore: function () {
            findRecentReviews(recentRevState); },
        readReview: function (revid) {
            return readReview(revid); },
        reviewItemHTML: function (revobj, penNameStr) {
            return reviewItemHTML(revobj, penNameStr); },
        toggleAuthChange: function (authtype, domid) {
            mor.pen.getPen(function (pen) { 
                handleAuthChangeToggle(pen, authtype, domid); }); },
        displayAuthSettings: function (domid, pen) {
            displayAuthSettings(domid, pen); },
        srchmode: function () {
            changeSearchMode(); },
        addMyOpenReviewsAuthId: function(mid) {
            mor.pen.getPen(function (pen) {
                addMyOpenReviewsAuthId(pen, mid); }); },
        writeNavDisplay: function (homepen, dispen, directive) {
            writeNavDisplay(homepen, dispen, directive); },
        verifyStateVariableValues: function (pen) {
            verifyStateVariableValues(pen); },
        cancelPenNameSettings: function () {
            cancelPenNameSettings(); },
        editCity: function () {
            editCity(); },
        setSearchMode: function (mode) {
            searchmode = mode; },
        invite: function () {
            displayInvitationDialog(); },
        chginvite: function () {
            updateInviteInfo(); },
        showTopRated: function (typename) {
            showTopRated(typename); },
        searchReviews: function (revtype) {
            searchReviews(revtype); },
        searchRevsIfTypeChange: function (revtype) {
            if(profpen.profstate.revtype !== revtype) {
                searchReviews(revtype); } }
    };

});

