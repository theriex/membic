/*global define: false, alert: false, console: false, confirm: false, setTimeout: false, window: false, document: false, history: false, mor: false, require: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// m o r . p r o f i l e
//
define([], function () {
    "use strict";

    var unspecifiedCityText = "City not specified",
        currtab,
        profpen,
        cachepens = [],
        //tab displays
        recentRevState = { results: [] },
        topRevState = {},
        followingDisp,
        followerDisp,
        //search tab display
        searchparams = {},
        searchresults = [],
        searchcursor = "",
        searchtotal = 0,
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
        topRevState = {};
        followingDisp = null;
        followerDisp = null;
        searchparams = {};
        searchresults = [];
        searchcursor = "";
        searchtotal = 0;
    },


    createOrEditRelationship = function () {
        mor.pen.getPen(function (pen) {
            mor.rel.reledit(pen, profpen); });
    },


    writeNavDisplay = function (pen) {
        var html, relationship, penid = mor.instId(pen),
            profdfunc = "mor.profile.display()";
        if(!mor.pen.getHomePen(penid)) {
            profdfunc = "mor.profile.byprofid(" + penid + ")"; }
        html = "<a href=\"#view=profile&profid=" + penid + "\"" +
                 " title=\"Show profile for " + pen.name + "\"" +
                 " onclick=\"" + profdfunc + ";return false;\"" +
            ">" + pen.name + "</a>";
        mor.out('penhnamespan', html);
        //ATTENTION: These selector icons could stand some mouseover action
        if(mor.pen.getHomePen(mor.instId(pen))) {  //self
            html = mor.imglink("#Settings","Adjust settings for " + pen.name,
                               "mor.profile.settings()", "settings.png") +
                   mor.imglink("#PenNames","Switch Pen Names",
                               "mor.profile.penswitch()", "pen.png"); }
        else {  //someone else's pen name
            relationship = mor.rel.outbound(mor.instId(pen));
            if(relationship) {
                html = mor.imglink("#Settings",
                                   "Adjust follow settings for " + pen.name,
                                   "mor.profile.relationship()", 
                                   "settings.png"); }
            else {
                html = mor.imglink("#Follow",
                                   "Follow " + pen.name,
                                   "mor.profile.relationship()",
                                   "plus.png"); }
            html += mor.imglink("#Home","Return to home profile",
                                "mor.profile.display()", "home.png"); }
        mor.out('penhbuttonspan', html);
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


    cancelPenNameSettings = function () {
        mor.skinner.cancel();
        mor.layout.closeDialog();
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
        var atname, html = "Authenticated access: <table>";
        //MyOpenReviews
        atname = nameForAuthType("mid");
        html += "<tr><td><input type=\"checkbox\" name=\"aamid\"" +
            " value=\"" + atname + "\" id=\"aamid\"" +
            " onchange=\"mor.profile.toggleAuthChange('mid','" + 
                             domid + "');return false;\"";
        if(pen.mid) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aamid\">" + atname + "</label></td></tr>";
        //Facebook
        atname = nameForAuthType("fbid");
        html += "<tr><td><input type=\"checkbox\" name=\"aafbid\"" +
            " value=\"" + atname + "\" id=\"aafbid\"" +
            " onchange=\"mor.profile.toggleAuthChange('fbid','" + 
                             domid + "');return false;\"";
        if(pen.fbid) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aafbid\">" + atname + "</label></td></tr>";
        //Twitter
        atname = nameForAuthType("twid");
        html += "<tr><td><input type=\"checkbox\" name=\"aatwid\"" +
            " value=\"" + atname + "\" id=\"aatwid\"" +
            " onchange=\"mor.profile.toggleAuthChange('twid','" + 
                             domid + "');return false;\"";
        if(pen.twid) {
            html += " checked=\"checked\""; }
        html += "/><label for=\"aatwid\">" + atname + "</label></td></tr>";
        //Google+
        atname = nameForAuthType("gsid");
        html += "<tr><td><input type=\"checkbox\" name=\"aagsid\"" +
            " value=\"" + atname + "\" id=\"aagsid\"" +
            " onchange=\"mor.profile.toggleAuthChange('gsid','" + 
                             domid + "');return false;\"";
        if(pen.gsid) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aagsid\">" + atname + "</label></td></tr>";
        //GitHub
        atname = nameForAuthType("ghid");
        html += "<tr><td><input type=\"checkbox\" name=\"aaghid\"" +
            " value=\"" + atname + "\" id=\"aaghid\"" +
            " onchange=\"mor.profile.toggleAuthChange('ghid','" + 
                             domid + "');return false;\"";
        if(pen.ghid) { 
            html += " checked=\"checked\""; }
        html += "/><label for=\"aaghid\">" + atname + "</label></td></tr>";
        html += "</table>";
        mor.out(domid, html);
    },


    addMyOpenReviewsAuth = function (domid, pen) {
        var authmethod = mor.login.getAuthMethod();
        if(authmethod !== "mid") {
            alert("To add MyOpenReviews authorization, you first need to " +
                  "log out and then log back in with a username and " +
                  "password.  After you have logged in directly, click " +
                  "the pen name selection on your profile page.");
            displayAuthSettings(domid, pen); }
        else {
            mor.out(domid, "Recording MyOpenReviews authorization");
            pen.mid = mor.login.getMORAccountId();
            mor.pen.updatePen(pen,
                              function (updpen) {
                                  displayAuthSettings(domid, updpen); },
                              function (code, errtxt) {
                                  mor.err("addMyOpenReviewsAuth error " +
                                          code + ": " + errtxt);
                                  pen.mid = 0;
                                  displayAuthSettings(domid, pen); }); }
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
                       "Pen Name from " + nameForAuthType(authtype) + "?")) {
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


    changeSettings = function (pen) {
        var html = "<table>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"pensettitletd\">" +
              "<h2>Settings for " + pen.name + "</h2>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsmsgtd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td align=\"right\">Pen Name</td>" +
            "<td align=\"left\">" +
              "<input type=\"text\" id=\"pennamein\" size=\"25\"" + 
                    " value=\"" + pen.name + "\"/></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsauthtd\"></td>" +
          "</tr>" +
          "<tr>" + 
            "<td colspan=\"2\" id=\"consvcstd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" id=\"settingsskintd\"></td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\" align=\"center\" id=\"settingsbuttons\">" +
              "<button type=\"button\" id=\"cancelbutton\">Cancel</button>" +
              "&nbsp;" +
              "<button type=\"button\" id=\"savebutton\">Save</button>" +
            "</td>" +
          "</tr>" +
        "</table>";
        mor.out('dlgdiv', html);
        mor.onchange('pennamein', mor.profile.setPenName);
        mor.onclick('cancelbutton', cancelPenNameSettings);
        mor.onclick('savebutton', mor.profile.saveSettings);
        displayAuthSettings('settingsauthtd', pen);
        mor.services.display('consvcstd', pen);
        mor.skinner.init('settingsskintd', pen);
        mor.byId('dlgdiv').style.visibility = "visible";
        mor.onescapefunc = cancelPenNameSettings;
    },


    changeToSelectedPen = function () {
        var i, sel = mor.byId('penselect');
        for(i = 0; i < sel.options.length; i += 1) {
            if(sel.options[i].selected) {
                if(sel.options[i].id === 'newpenopt') {
                    mor.pen.newPenName(mor.profile.display); }
                else {
                    mor.pen.selectPenByName(sel.options[i].value); }
                break; } }
    },


    changePens = function (pen) {
        var html = "", pens = mor.pen.getPenNames(), i;
        html += "<div id=\"proftoptive\">";  //re-use to keep same display
        html += "<span class=\"headingtxt\">Select Pen Name: </span>";
        html += "<select id=\"penselect\">";
        for(i = 0; i < pens.length; i += 1) {
            html += "<option id=\"" + mor.instId(pens[i]) + "\"";
            if(pens[i].name === pen.name) {
                html += " selected=\"selected\""; }
            html += ">" + pens[i].name + "</option>"; }
        html += "<option id=\"newpenopt\">New Pen Name</option>" +
            "</select>" +
            "&nbsp;" + 
            "<button type=\"button\" id=\"penselectok\">Ok</button>" +
            "</div>";
        mor.out('cmain', html);
        mor.layout.adjust();
        mor.onchange('penselect', changeToSelectedPen);
        mor.onclick('penselectok', changeToSelectedPen);
    },


    badgeDispHTML = function (hastop) {
        var html = "", i, values, type;
        values = hastop.split(",");
        for(i = 0; i < values.length; i += 1) {
            type = mor.review.getReviewTypeByValue(values[i]);
            html += mor.review.badgeImageHTML(type); }
        return html;
    },


    penListItemHTML = function (pen) {
        var penid = mor.instId(pen), picuri, hash, linktitle, html;
        hash = mor.objdata({ view: "profile", profid: penid });
        linktitle = mor.ellipsis(pen.shoutout, 75);
        if(!linktitle) {
            linktitle = "View profile for " + mor.enc(pen.name); }
        html = "<li>" +
            "<a href=\"#" + hash + "\"" +
            " onclick=\"mor.profile.changeid('" + penid + "');return false;\"" +
            " title=\"" + linktitle + "\">";
        picuri = "img/emptyprofpic.png";
        if(pen.profpic) {
            picuri = "profpic?profileid=" + penid; }
        html += "<img class=\"srchpic\" src=\"" + picuri + "\"/>" +
            "&nbsp;" + "<span class=\"penfont\">" + pen.name + 
            "</span>" + "</a>";
        if(pen.city) {
            html += " <span class=\"smalltext\">(" + pen.city + ")</span>"; }
        if(pen.hastop) {
            html += badgeDispHTML(pen.hastop); }
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


    updateCache = function (pen) {
        var i, penid = mor.instId(pen);
        for(i = 0; i < searchresults.length; i += 1) {
            if(mor.instId(searchresults[i]) === penid) {
                searchresults[i] = pen;
                break; } }
        for(i = 0; i < cachepens.length; i += 1) {
            if(mor.instId(cachepens[i]) === penid) {
                cachepens[i] = pen;
                break; } }
    },


    findOrLoadPen = function (id, callback) {
        var pen, params;
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
                             errtxt); });
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
        li.style.backgroundColor = mor.colors.bodybg;
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
        if(typeof revid !== "number") {
            revid = parseInt(revid, 10); }
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
        if(!revobj) {
            mor.log("readReview " + revid + " not found");
            return; }
        mor.historyCheckpoint({ view: "review", mode: "display",
                                revid: revid });
        mor.review.setCurrentReview(revobj);
        mor.review.displayRead();
    },


    reviewItemHTML = function (revobj, penNameStr) {
        var revid, type, linkref, html;
        revid = mor.instId(revobj);
        type = mor.review.getReviewTypeByValue(revobj.revtype);
        linkref = "statrev/" + revid;
        html = "<li>" + mor.review.starsImageHTML(revobj.rating) + 
            mor.review.badgeImageHTML(type) + "&nbsp;" +
            "<a href=\"" + linkref + "\"" +
              " onclick=\"mor.profile.readReview('" + revid + "');" + 
                         "return false;\"" +
              " title=\"See full review\">" + 
            revobj[type.key];
        if(type.subkey) {
            html += " <i>" + revobj[type.subkey] + "</i>"; }
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
        html += "<div class=\"revtextsummary\">" + 
            mor.ellipsis(revobj.text, 255) + "</div>";
        html += "</li>";
        return html;
    },


    displayReviews = function (dispState, reviews) {
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
            html += "<li>No reviews</li>"; }
        html += "</ul>";
        if(dispState.cursor && i > 0) {
            html += "<a href=\"#continuesearch\"" +
                " onclick=\"mor.profile.revsmore('" + dispState.tab + "');" +
                           "return false;\"" +
                " title=\"More reviews\"" + ">more reviews...</a>"; }
        mor.out('profcontdiv', html);
        mor.layout.adjust();
    },


    findReviews = function (dispState) {
        var params;
        if(!dispState.params.penid) {
            dispState.params.penid = mor.instId(profpen); }
        params = mor.objdata(dispState.params) + "&" + mor.login.authparams();
        mor.call("srchrevs?" + params, 'GET', null,
                 function (revs) {
                     displayReviews(dispState, revs); },
                 function (code, errtxt) {
                     mor.out('profcontdiv', "findReviews failed code " + code +
                             " " + errtxt); });
    },


    fetchMoreReviews = function (tabname) {
        if(tabname === "recent") {
            findReviews(recentRevState); }
        else {
            mor.err("fetchMoreReviews unknown tabname: " + tabname); }
    },

        
    recent = function () {
        var html, temp, maxdate, mindate;
        selectTab("recentli", recent);
        if(recentRevState && recentRevState.initialized) {
            displayReviews(recentRevState); }
        html = "Retrieving recent activity for " + profpen.name + "...";
        mor.out('profcontdiv', html);
        mor.layout.adjust();
        clearReviewSearchState(recentRevState);
        temp = recentRevState;
        maxdate = new Date();
        mindate = new Date(maxdate.getTime() - (30 * 24 * 60 * 60 * 1000));
        recentRevState.params.maxdate = maxdate.toISOString();
        recentRevState.params.mindate = mindate.toISOString();
        recentRevState.initialized = true; 
        findReviews(recentRevState);
    },


    dispTypeSelectionHTML = function () {
        var html;
        //verify a display type is selected
        if(!topRevState.dispType) {
            topRevState.dispType = "book";  //arbitrary default
            if(profpen.top20s.latestrevtype) {
                topRevState.dispType = profpen.top20s.latestrevtype; } }
        //get the html for the radio buttons
        html = mor.review.reviewTypeRadiosHTML("trbchoice",
                                               "mor.profile.topTypeChange",
                                               profpen.top20s,
                                               topRevState.dispType);
        return html;
    },


    topTypeChange = function () {
        var radios, i, revtype;
        radios = document.getElementsByName("trbchoice");
        for(i = 0; i < radios.length; i += 1) {
            if(radios[i].checked) {
                revtype = mor.review.getReviewTypeByValue(radios[i].value);
                if(revtype && revtype.type !== topRevState.dispType) {
                    topRevState.dispType = revtype.type; }
                break; } }
        mor.profile.best();  //redisplay
    },


    best = function () {
        var html, revs, i, temp;
        selectTab("bestli", best);
        if(typeof profpen.top20s === "string") {
            profpen.top20s = mor.dojo.json.parse(profpen.top20s); }
        html = dispTypeSelectionHTML();
        revs = profpen.top20s[topRevState.dispType] || [];
        html += "<ul class=\"revlist\">";
        if(revs.length === 0) {
            html += "<li>No reviews</li>"; }
        for(i = 0; i < revs.length; i += 1) {
            if(typeof revs[i] === 'number') {  //need to resolve id
                if(topRevState.review) {       //have a resolution
                    if(typeof topRevState.review === 'object') {
                        if(mor.instId(topRevState.review) === revs[i]) {
                            revs[i] = topRevState.review; } }
                    else if(typeof topRevState.review === 'string') {
                        temp = revs[i].toString() + ":";
                        if(topRevState.review.indexOf(temp) === 0) {
                            revs[i] = topRevState.review; } } } }
            //have resolved object, error text, or unresolved id
            if(typeof revs[i] === 'object') {  //resolved
                html += reviewItemHTML(revs[i]); }
            else if(typeof revs[i] === 'string') {  //resolution error
                html += "<li>" + revs[i] + "</li>"; }
            else {  //not resolved
                html += "<li>Fetching review " + revs[i] + "...</li>";
                break; } }  //didn't make it through, stop at index
        html += "</ul>";
        mor.out('profcontdiv', html);
        mor.layout.adjust();
        temp = profpen.top20s[topRevState.dispType];
        if(i < revs.length) {  //didn't make it through, go fetch
            mor.call("revbyid?revid=" + revs[i], 'GET', null,
                     function (revs) {
                         if(revs.length > 0) {
                             topRevState.review = revs[0]; }
                         else {
                             topRevState.review = revs[i] + ": not found"; }
                         mor.profile.best(); },
                     function (code, errtxt) {
                         topRevState.review = revs[i] + ": " + code + " " +
                             errtxt;
                         mor.profile.best(); }); }
    },


    following = function () {
        selectTab("followingli", following);
        if(!followingDisp) {  //different profile than last call..
            followingDisp = { profpen: profpen, direction: "outbound", 
                              divid: 'profcontdiv' }; }
        mor.rel.displayRelations(followingDisp);
        mor.layout.adjust();
    },


    followers = function () {
        selectTab("followersli", followers);
        if(!followerDisp) {  //different profile than last call..
            followerDisp = { profpen: profpen, direction: "inbound", 
                             divid: 'profcontdiv' }; }
        mor.rel.displayRelations(followerDisp);
        mor.layout.adjust();
    },


    readSearchParamsFromForm = function () {
        var checkboxes, options, i, since;
        searchparams.reqmin = [];
        checkboxes = document.getElementsByName("reqmin");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                searchparams.reqmin.push(checkboxes[i].value); } }
        options = mor.byId('srchactivesel').options;
        for(i = 0; i < options.length; i += 1) {
            if(options[i].selected) {
                switch(options[i].id) {
                case 'pastweek':
                    since = 7; break;
                case 'pastmonth':
                    since = 30; break;
                case 'pastyear':
                    since = 365; break;
                case 'whenever':
                    since = -1; break; }
                break; } }
        searchparams.activeDaysAgo = since;
        searchparams.includeFollowing = false;
        searchparams.includeBlocked = false;
        checkboxes = document.getElementsByName("srchinc");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                if(checkboxes[i].value === 'following') {
                    searchparams.includeFollowing = true; }
                if(checkboxes[i].value === 'blocked') {
                    searchparams.includeBlocked = true; } } }
    },


    setFormValuesFromSearchParams = function () {
        var i, options, since;
        if(searchparams.reqmin) {
            for(i = 0; i < searchparams.reqmin.length; i += 1) {
                mor.byId(searchparams.reqmin[i]).checked = true; } }
        if(searchparams.activeDaysAgo) {
            since = searchparams.activeDaysAgo;
            options = mor.byId('srchactivesel').options;
            for(i = 0; i < options.length; i += 1) {
                switch(options[i].id) {
                case 'pastweek':
                    options[i].selected = (since === 7); break;
                case 'pastmonth':
                    options[i].selected = (since === 30); break;
                case 'pastyear':
                    options[i].selected = (since === 365); break;
                case 'whenever':
                    options[i].selected = (since <= 0); break; } } }
        mor.byId('following').checked = searchparams.includeFollowing;
        mor.byId('blocked').checked = searchparams.includeBlocked;
    },


    //When searching pen names, the server handles the "active since"
    //restriction by checking the "accessed" field, and the "top 20"
    //restriction by testing the "hastop" field.  However it does not
    //handle joins across relationships due to indexing overhead, so
    //these are filtered out here.
    filtered = function (searchitem) {
        var pen, rel;
        if(searchmode === "rev") {
            return false; }  //no filtering
        pen = searchitem;
        rel = mor.rel.outbound(mor.instId(pen));
        if(rel) {
            if(searchparams.includeFollowing && rel.status === "following") {
                return false; }
            if(searchparams.includeBlocked && rel.status === "blocked") {
                return false; }
            return true; }
        return false;
    },


    displaySearchResults = function (results) {
        var i, html, ts;
        ts = { "pen": { "ulc": "penlist", "stype": "pen names" },
               "rev": { "ulc": "revlist", "stype": "reviews" } };
        ts = ts[searchmode];
        html = "<ul class=\"" + ts.ulc + "\">";
        for(i = 0; i < searchresults.length; i += 1) {
            if(searchmode === "pen") {
                html += penListItemHTML(searchresults[i]); }
            else if(searchmode === "rev") {
                html += reviewItemHTML(searchresults[i]); } }
        searchcursor = "";
        for(i = 0; i < results.length; i += 1) {
            if(results[i].fetched) {
                searchtotal += results[i].fetched;
                html += "<div class=\"sumtotal\">" + 
                    searchtotal + " " + ts.stype + " searched</div>";
                if(results[i].cursor) {
                    searchcursor = results[i].cursor; }
                break; }  //if no results, i will be left at zero
            if(!filtered(results[i])) {
                searchresults.push(results[i]);
                if(searchmode === "pen") {
                    html += penListItemHTML(results[i]); }
                else if(searchmode === "rev") {
                    html += reviewItemHTML(results[i]); } } }
        html += "</ul>";
        if(searchcursor) {
            if(i > 0) {  //have more than just an empty result cursor..
                html += "<a href=\"#continuesearch\"" +
                          " onclick=\"mor.profile.srchmore();return false;\"" +
                          " title=\"Continue searching for more matching " + 
                                    ts.stype + "\"" +
                    ">continue search...</a>"; }
            else if(searchtotal < 1000) { //auto-repeat search
                setTimeout(mor.profile.srchmore, 10); } }
        mor.out('searchresults', html);
        mor.byId('srchbuttonspan').style.display = "inline";
        mor.out('srchmessagespan', "");
    },


    doPenSearch = function () {
        var params, qstr, time, t20, i;
        qstr = mor.byId('searchtxt').value;
        params = mor.login.authparams() + "&qstr=" + mor.enc(qstr) +
            "&cursor=" + mor.enc(searchcursor);
        if(searchparams.activeDaysAgo > 0) {
            time = (new Date()).getTime();
            time -= searchparams.activeDaysAgo * 24 * 60 * 60 * 1000;
            time = new Date(time);
            time = time.toISOString();
            params += "&time=" + mor.enc(time); }
        if(searchparams.reqmin.length > 0) {
            t20 = "";
            for(i = 0; i < searchparams.reqmin.length; i += 1) {
                if(i > 0) {
                    t20 += ","; }
                t20 += searchparams.reqmin[i]; }
            params += "&t20=" + mor.enc(t20); }
        mor.call("srchpens?" + params, 'GET', null,
                 function (results) {
                     displaySearchResults(results); },
                 function (code, errtxt) {
                     mor.out('searchresults', 
                             "error code: " + code + " " + errtxt); });
    },


    doRevSearch = function () {
        var params, maxdate, mindate, qstr, revtype, typesel;
        qstr = mor.byId('searchtxt').value;
        typesel = mor.byId('revsearchsel');
        revtype = typesel.options[typesel.selectedIndex].value;
        maxdate = (new Date()).toISOString();
        mindate = (new Date(0)).toISOString();
        params = mor.login.authparams() + 
            "&qstr=" + mor.enc(mor.canonize(qstr)) +
            "&revtype=" + revtype +
            "&penid=" + mor.pen.currPenId() +
            "&maxdate=" + maxdate + "&mindate=" + mindate +
            "&cursor=" + mor.enc(searchcursor);
        mor.call("srchrevs?" + params, 'GET', null,
                 function (results) {
                     displaySearchResults(results); },
                 function (code, errtxt) {
                     mor.out('searchresults',
                             "error code: " + code + " " + errtxt); });
    },


    doSearch = function () {
        readSearchParamsFromForm();
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.byId('srchbuttonspan').style.display = "none";
        mor.out('srchmessagespan', "Searching...");
        switch(searchmode) {
        case "pen": return doPenSearch();
        case "rev": return doRevSearch(); }
    },


    startSearch = function () {
        searchresults = [];
        searchcursor = "";
        searchtotal = 0;
        mor.out('searchresults', "");
        doSearch();
    },


    changeSearchMode = function () {
        var i, radios = document.getElementsByName("searchmode");
        for(i = 0; i < radios.length; i += 1) {
            if(radios[i].checked) {
                if(radios[i].value === "pen") {
                    mor.byId('srchoptstoggle').style.display = "inline";
                    mor.byId('revsearchtype').style.display = "none";
                    mor.byId('searchtxt').placeholder = pensrchplace;
                    searchmode = "pen";
                    break; }
                else if(radios[i].value === "rev") {
                    mor.byId('srchoptstoggle').style.display = "none";
                    mor.byId('revsearchtype').style.display = "inline";
                    mor.byId('searchtxt').placeholder = revsrchplace;
                    searchmode = "rev";
                    break; } } }
    },


    displaySearchForm = function () {
        var html = "";
        selectTab("searchli", mor.profile.search);
        html += "<table><tr>" +
            "<td><input type=\"text\" id=\"searchtxt\" size=\"40\"" +
                      " placeholder=\"" + pensrchplace + "\"" +
                      " value=\"\"/></td>" +
            "<td>" +
              "<span id=\"srchmessagespan\"> </span>" +
              "<span id=\"srchbuttonspan\">" +
                "<button type=\"button\" id=\"searchbutton\">Search</button>" +
              "</span></td>" +
            "<td>" +
              mor.checkrad("radio", "searchmode", "pen", "Pen Names",
                           (searchmode === "pen"), "mor.profile.srchmode") +
              " &nbsp; " +
              "<span id=\"srchoptstoggle\" class=\"formstyle\">" + 
                "<a href=\"#options\"" +
                  " title=\"advanced search options\"" +
                  " onclick=\"mor.profile.togglesrchopts();return false;\"" +
                ">options</a></span>" +
              "<br/>" +
              mor.checkrad("radio", "searchmode", "rev", "My Reviews",
                           (searchmode === "rev"), "mor.profile.srchmode") +
              " &nbsp; " +
              "<span id=\"revsearchtype\" class=\"formstyle\">" +
                "<select id=\"revsearchsel\">" +
                  mor.review.reviewTypeSelectOptionsHTML(profpen.top20s) +
                "</select>" +
              "</span>" +
            "</td>" +
            "</tr></table>" +
            "<div id=\"searchoptionsdiv\" class=\"formstyle\">" +
            "<b>Must have reviewed their top 20</b>" +
            mor.review.reviewTypeCheckboxesHTML("reqmin") +
            "<b>Must have been active within the past</b>&nbsp;" + 
            "<select id=\"srchactivesel\">" +
              "<option id=\"whenever\">Whenever</option>" +
              "<option id=\"pastyear\" selected=\"selected\">Year</option>" +
              "<option id=\"pastmonth\">Month</option>" +
              "<option id=\"pastweek\">Week</option>" +
            "</select>" +
            "<br/>" +
            "<b>Include</b>&nbsp;" + 
            mor.checkbox("srchinc", "following") +
            mor.checkbox("srchinc", "blocked") +
            " <b> in the search results</b>" +
            "<br/>";
        html += "&nbsp;<br/></div>";
        html += "<div id=\"searchresults\"></div>";
        mor.out('profcontdiv', html);
        setFormValuesFromSearchParams();
        displaySearchResults([]);  //show previous results, if any
        mor.byId('searchoptionsdiv').style.display = "none";
        mor.onchange('searchtxt', startSearch);
        mor.onclick('searchbutton', startSearch);
        changeSearchMode();
        mor.byId('searchtxt').focus();
        mor.layout.adjust();
    },


    toggleSearchOptions = function () {
        var sod = mor.byId('searchoptionsdiv');
        if(sod) {
            if(sod.style.display === "none") {
                sod.style.display = "block"; }
            else {
                sod.style.display = "none"; } }
        mor.layout.adjust();
    },


    displayTabs = function (pen) {
        var html;
        html = "<ul id=\"proftabsul\">" +
          "<li id=\"recentli\" class=\"selectedTab\">" + 
            tablink("Recent Activity", "mor.profile.recent()") + 
          "</li>" +
          "<li id=\"bestli\" class=\"unselectedTab\">" +
            tablink("Top Rated", "mor.profile.best()") + 
          "</li>" +
          "<li id=\"followingli\" class=\"unselectedTab\">" +
            tablink("Following (" + pen.following + ")", 
                    "mor.profile.following()") + 
          "</li>" +
          "<li id=\"followersli\" class=\"unselectedTab\">" +
            tablink("Followers (" + pen.followers + ")", 
                    "mor.profile.followers()") + 
          "</li>" +
          "<li id=\"searchli\" class=\"unselectedTab\">" +
            tablink("Search", "mor.profile.search()") + 
          "</li>" +
        "</ul>";
        mor.out('proftabsdiv', html);
        if(!currtab) {
            currtab = recent; }
        currtab();
    },


    getCurrTabAsString = function () {
        if(currtab === recent) { return "recent"; }
        if(currtab === best) { return "best"; }
        if(currtab === following) { return "following"; }
        if(currtab === followers) { return "followers"; }
        if(currtab === mor.profile.search) { return "search"; }
        return "recent"; //default
    },


    setCurrTabFromString = function (tabstr) {
        switch(tabstr) {
        case "recent": currtab = recent; break;
        case "best": currtab = best; break;
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
        shout.style.width = target + "px";
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
        var html, shout;
        html = "<div id=\"shoutdiv\" class=\"shoutout\"></div>";
        mor.out('profshouttd', html);
        shout = mor.byId('shoutdiv');
        styleShout(shout);
        shout.style.overflow = "auto";
        //the textarea has a default border, so adding an invisible
        //border here to keep things from jumping around.
        shout.style.border = "1px solid " + mor.colors.bodybg;
        mor.out('shoutdiv', mor.linkify(pen.shoutout));
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
        var html = pen.city || unspecifiedCityText;
        mor.out('profcityspan', html);
        if(!pen.city) {
            mor.byId('profcityspan').style.color = "#CCCCCC"; }
        if(mor.profile.authorized(pen)) {
            mor.onclick('profcityspan', editCity); }
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


    verifyStateVariableValues = function (pen) {
        if(profpen !== pen) {
            profpen = pen;
            followingDisp = null;
            followerDisp = null; }
        mor.historyCheckpoint({ view: "profile", profid: mor.instId(profpen),
                                tab: getCurrTabAsString() });
    },


    mainDisplay = function (pen) {
        var html;
        verifyStateVariableValues(pen);
        //redisplay the heading in case we just switched pen names
        writeNavDisplay(pen);
        //reset the colors in case that work got dropped in the
        //process of updating the persistent state
        mor.skinner.setColorsFromPen(pen);
        html = "<div id=\"proftopdiv\">" +
        "<table>" +
          "<tr>" +
            "<td id=\"sysnotice\" colspan=\"2\">" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profpictd\" rowspan=\"2\">" +
              "<img class=\"profpic\" src=\"img/emptyprofpic.png\"/>" +
            "</td>" +
            "<td id=\"profshouttd\">" +
              "<div id=\"shoutdiv\" class=\"shoutout\"></div>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td id=\"profcitytd\">" +
              "<span id=\"profcityspan\"> </span>" +
              "<span id=\"profeditbspan\"> </span>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\">" +
              "<div id=\"proftabsdiv\"> </div>" +
            "</td>" +
          "</tr>" +
          "<tr>" +
            "<td colspan=\"2\">" +
              "<div id=\"profcontdiv\"> </div>" +
            "</td>" +
          "</tr>" +
        "</table></div>";
        mor.out('cmain', html);
        displayShout(pen);
        displayCity(pen);
        displayPic(pen);
        displayTabs(pen);
        mor.layout.adjust();
    },


    displayProfileForId = function (id) {
        if(typeof id !== "number") {
            id = parseInt(id, 10); }
        resetReviewDisplays();
        findOrLoadPen(id, mainDisplay);
    };


    return {
        resetStateVars: function () {
            resetStateVars(); },
        display: function () {
            mor.pen.getPen(mainDisplay); },
        updateHeading: function () {
            if(profpen) {
                writeNavDisplay(profpen); }
            else {
                mor.pen.getPen(writeNavDisplay); } },
        settings: function () {
            mor.pen.getPen(changeSettings); },
        penswitch: function () {
            mor.pen.getPen(changePens); },
        recent: function () {
            recent(); },
        best: function () {
            best(); },
        following: function () {
            following(); },
        followers: function () {
            followers(); },
        search: function () {
            displaySearchForm(); },
        togglesrchopts: function () {
            toggleSearchOptions(); },
        resetReviews: function () {
            resetReviewDisplays(); },
        authorized: function (pen) {
            if(pen.mid || pen.gsid || pen.fbid || pen.twid || pen.ghid) {
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
        srchmore: function () {
            doSearch(); },
        relationship: function () {
            createOrEditRelationship(); },
        retrievePen: function (id, callback) {
            return findOrLoadPen(id, callback); },
        getCachedPen: function (id) {
            return cachedPen(id); },
        penListItemHTML: function (pen) {
            return penListItemHTML(pen); },
        updateCache: function (pen) {
            updateCache(pen); },
        currentTabAsString: function () {
            return getCurrTabAsString(); },
        revsmore: function (tab) {
            return fetchMoreReviews(tab); },
        readReview: function (revid) {
            return readReview(revid); },
        topTypeChange: function () {
            topTypeChange(); },
        reviewItemHTML: function (revobj, penNameStr) {
            return reviewItemHTML(revobj, penNameStr); },
        toggleAuthChange: function (authtype, domid) {
            mor.pen.getPen(function (pen) { 
                handleAuthChangeToggle(pen, authtype, domid); }); },
        displayAuthSettings: function (domid, pen) {
            displayAuthSettings(domid, pen); },
        srchmode: function () {
            changeSearchMode(); }
    };

});

