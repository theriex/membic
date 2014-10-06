/*global document: false, app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.hinter = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var tips = null,
        accountInfo = null,


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    promptedRecently = function (tipset) {
        var yesterday = new Date().getTime() - 24*60*60*1000;
        yesterday = new Date(yesterday).toISOString();
        if(tipset.lastprompt > yesterday) {
            return true; }
        return false;
    },


    emailActive = function (pen) {
        var params;
        if(app.login.getAuthMethod === "mid") {
            return false; }
        if(accountInfo) {
            if(accountInfo.hasEmail) {
                return false; }
            return "run"; }
        params = app.login.authparams() + "&penid=" + jt.instId(pen);
        jt.call('GET', "acctinfo?" + params, null,
                function (infos) {
                    accountInfo = infos[0];
                    app.hinter.showStartTip(); },
                app.failf(function (code, errtxt) {
                    jt.log("emailActive call failed: " + 
                           code + ": " + errtxt); }),
                jt.semaphore("hinter.emailActive"));
        return "halt";  //stop processing while fetching account info
    },


    email = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "FGFweb is a low noise site. You are going to want the weekly summary to track what your friends have been up to. Your email address is not shared with anyone."],
                 ["div", {id: "formstatdiv"}, "&nbsp;"],
                 ["div", {id: "eminputdiv"},
                  [["label", {fo: "emailin", cla: "liflab"},
                    "Email"],
                   ["input", {type: "email", id: "emailin", size: 25,
                              onchange: jt.fs("app.hinter.setEmail()")}]]],
                 ["div", {cla: "dismissradiodiv"},
                  (displayCount <= 1 ? "" : jt.checkbox("cbtip", "cbtip", "I'll remember to check back each week. Don't display this message ever again."))],
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('email')")},
                    "Skip"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "setemailbutton",
                               onclick: jt.fs("app.hinter.setEmail()")},
                    "Save"]]]]];
        html = app.layout.dlgwrapHTML("Email Address", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               //logically emailin should have the
                               //focus, but that doesn't work on ipad,
                               //and having "Skip" show up as the
                               //default button is not good.
                               function () {
                                   jt.byId('setemailbutton').focus(); });
    },
        
                  
    looktopActive = function (pen) {
        return true;
    },


    //Avoid annoying people with tips coming up all the time, give them the
    //opt out option immediately when possible.  Like for this tip.
    looktop = function () {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "To see someone's top 20 posts, select the \"Top Rated\" tab on their profile."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to find a friend's top rated posts. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('looktop')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Top Rated Posts", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    ezlinkActive = function (pen) {
        return true;
    },


    //jslint rightfully complains about javascript urls, but that's
    //how you do a bookmarklet, and as of 5dec13 there does not seem to
    //be an option to turn off the warning.  Hence this method.
    hideBookmarkletFromJSLint = function (newwindow) {
        var prefix = "javascript";
        prefix += ":";
        if(newwindow) {
            return prefix + "(function(){window.open('http://www.fgfweb.com?newrev=&url='+encodeURIComponent(window.location.href));})();"; }
        return prefix + "(function(){window.location.href='http://www.fgfweb.com?newrev=&url='+encodeURIComponent(window.location.href);})();";
    },


    ezlink = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "The FGFweb bookmarklet lets you kick off a post from any site.<br/>To install it, \"right click\" this link..."],
                 ["p", {style: "padding:5px 40px; font-weight:bold;"},
                  ["&#x2192;&nbsp;",
                   ["a", {href: hideBookmarkletFromJSLint(true)},
                    "Post to FGFweb"],
                   "&nbsp;&#x2190;"]],
                 ["p",
                  ["...and add it to your bookmarks. ",
                   ["span", {cla: "smalltext"},
                    ["a", {href: "#more", 
                           onclick: jt.fs("app.layout.displayDoc('" + 
                                          "docs/more.html')")},
                     "Read how it works."]]]],
                 ["div", {cla: "dismissradiodiv"},
                  (displayCount <= 1 ? "" : jt.checkbox("cbtip", "cbtip", "I already have the extremely handy bookmark link.  Don't display this message ever again."))],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('ezlink')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Easy Posting Link", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    writerevActive = function (pen) {
        var now, lrd;
        if(pen.top20s && pen.top20s.t20lastupdated) {
            lrd = jt.ISOString2Day(pen.top20s.t20lastupdated);
            now = new Date();
            //8 days may not seem like much slack, but it is easy to get
            //out of the weekly review habit if too much time goes by.
            if(lrd.getTime() - now.getTime() < 8 * 24 * 60 * 60 * 1000) {
                return false; } }  //wrote a review recently
        return true;
    },


    writerev = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "Posting once a week will get you more followers, and build up a really cool blog.  There are definitely people here who are interested in your impressions.  Want to help them out?"],
                 ["p", "If the past week was not worth mentioning, don't forget to post your favorite book, movie, song, or place."],
                 //no permanent dismiss option. Write a review a week..
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('writerev')")},
                    "Later"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "writerevbutton",
                               onclick: jt.fs("app.hinter.writeReview()")},
                    "Post Something"]]]]];
        html = app.layout.dlgwrapHTML("Post Something", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('writerevbutton').focus(); });
    },


    fillcityActive = function (pen) {
        if(pen.city) {
            return false; }
        if(!pen.top20s) {
            //if they haven't written a review yet, then it doesn't make sens
            //to bother about the finer points of having a decent profile.
            return false; }
        return true;
    },


    fillcity = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "Including the metropolitan area, township or region you are most affiliated with makes your profile more interesting and helps build relationships. Add a city to your profile?"],
                 ["div", {cla: "dismissradiodiv"},
                  (displayCount <= 1 ? "" : jt.checkbox("cbtip", "cbtip", "I don't want my profile to look more interesting, please don't display this message again."))],
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('fillcity')")},
                    "Later"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "fillcitybutton",
                               onclick: jt.fs("app.hinter.fillCity()")},
                    "Update Profile"]]]]];
        html = app.layout.dlgwrapHTML("Profile City", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('fillcitybutton').focus(); });
    },
                  

    remrevActive = function (pen) {
        var penref = app.pen.currPenRef();
        //penref.remembered is initialized by hitting the remembered
        //nav link, or when viewing someone else's review.  Neither is
        //likely to have happened by the time this hint is being
        //tested, but check anyway for completeness.
        if(penref.remembered && penref.remembered.length > 0) {
            return false; }
        //So pretty much this will always return true, and the user is
        //just going to tell the dialog to go away eventually.
        //Doesn't seem worth an extra db call to srchremem here,
        //probably the right thing to do is to record a note after
        //they have remembered something, but that could be due to a
        //random click of the remember button without realizing that
        //it ties to the remembered display.  Just show the hint.
        return true; 
    },


    remrev = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "When you see an interesting post, click its \"Remember\" button to keep a link to it in your remembered posts."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to remember posts. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('remrev')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Remembered Posts", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    follmoreActive = function (pen) {
        //by default, people are introduced to 3 others, so if they
        //are following less than 4 then they have not found anyone to
        //follow except for their initial introductions.
        if(pen.following < 4) { 
            return true; }
        return false;
    },


    follmore = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "Searching for pen names shows you who is active on the site. Want to meet some more people?"],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "Actually I'm totally happy not following anyone else. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('follmore')")},
                    "Later"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "follmorebutton",
                         onclick: jt.fs("app.activity.penNameSearchDialog()")},
                    "Find People"]]]]];
        html = app.layout.dlgwrapHTML("Follow More People", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('follmorebutton').focus(); });
    },


    groupsActive = function (pen) {
        if(pen.groups) {
            return false; }
        return true;
    },


    groups = function (displayCount) {
        var html;
        html = ["div", {cla: "hintercontentdiv"},
                [["p", "Groups are themed collections of posts. Join or create one from \"Groups\" tab on your profile."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I'm not interested in following or joining any groups. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('groups')")},
                    "Later"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "showgroupsbutton",
                               onclick: jt.fs("app.hinter.groupsTab()")},
                    "Show My Groups"]]]]];
        html = app.layout.dlgwrapHTML("Groups", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('showgroupsbutton').focus(); });
    },


    requestActive = function (pen) {
        var penref = app.pen.currPenRef();
        if((penref.outreqs && penref.outreqs.length > 0) ||
           (penref.inreqs && penref.inreqs.length > 0)) {
            return false; }
        return true;
    },


    request = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "If you would like to request a post from someone you are following, click the link next to their name on your profile."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to request a post from someone I'm following. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('request')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Request a Post", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    displayCodeUpdateDialog = function (vstr, locstr) {
        var html = [["p", "Your browser found an older copy of the site to run.<br/>Please reload this page."],
                    ["p", 
                     ["Server version: " + vstr,
                      ["br"],
                      "Script version: " + locstr]]];
        html = app.layout.dlgwrapHTML("Get The Latest", html);
        app.layout.openDialog({y:140}, html);
    },


    //If the version is out of date, clobber any dialog that is up and
    //ask them to reload to get the latest source.  Better to be
    //annoying than flaky.
    runVersionCheck = function () {
        jt.call('GET', "/buildverstr", null,
                function (vstr) {
                    var locstr = "BUILDVERSIONSTRING";
                    if(vstr !== locstr) {
                        displayCodeUpdateDialog(vstr, locstr); } },
                function (code, errtxt) {
                    jt.log("buildverstr failed code " + code + 
                           ": " + errtxt); },
                jt.semaphore("hinter.runVersionCheck"));
    },


    writeUpdatedTipsInfo = function (pen) {
        app.pen.updatePen(pen,
                          function () {
                              jt.log("tip settings updated"); },
                          function () {
                              jt.log("tip settings fail"); });
    },


    runTip = function (pen, tip, tipset, name) {
        if(!tipset[name]) {
            tipset[name] = 1; }
        else {
            tipset[name] += 1; }
        tip.runf(tipset[name]);  //pass the count for content logic
        tipset.prevtip = name;
        tipset.lastprompt = new Date().toISOString();
        writeUpdatedTipsInfo(pen);
    },


    showPriorityTip = function (pen) {
        var tipset, i, name;
        tipset = pen.settings.tipset;
        for(i = 0; i < tips.length; i += 1) {
            name = tips[i].name;
            if(tips[i].priority && tipset[name] !== "dismissed" && 
                   tips[i].checkf(pen)) {
                if(tips[i].checkf(pen)  === "run") {
                    runTip(pen, tips[i], tipset, name); }
                return true; } }
        return false;
    },


    findAndShowNextTip = function (pen) {
        var tipset, i, name, rotips, temp;
        tipset = pen.settings.tipset;
        if(promptedRecently(tipset)) {
            return false; }
        if(tipset.prevtip) {  //rotate previous tip to bottom of list
            rotips = tips;
            for(i = 0; i < tips.length; i += 1) {
                temp = rotips[rotips.length - 1];
                if(temp.name === tipset.prevtip) {
                    break; } //previous tip now at the end
                temp = rotips[0];
                rotips = rotips.slice(1);
                rotips.push(temp); }
            tips = rotips; }
        for(i = 0; i < tips.length; i += 1) {
            name = tips[i].name;
            if(tipset[name] !== "dismissed" && tips[i].checkf(pen)) {
                runTip(pen, tips[i], tipset, name);
                break; } }
        
    },


    initTips = function () {
        tips = [
            { name: "email",    checkf: emailActive,    runf: email,
              priority: true },
            { name: "looktop",  checkf: looktopActive,  runf: looktop },
            { name: "ezlink",   checkf: ezlinkActive,   runf: ezlink },
            { name: "writerev", checkf: writerevActive, runf: writerev },
            { name: "fillcity", checkf: fillcityActive, runf: fillcity },
            { name: "remrev",   checkf: remrevActive,   runf: remrev },
            { name: "follmore", checkf: follmoreActive, runf: follmore },
            { name: "groups",   checkf: groupsActive,   runf: groups },
            { name: "request",  checkf: requestActive,  runf: request } ];
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    showStartTip: function () {
        var pen;
        setTimeout(runVersionCheck, 1000);  //preempts everything if broken
        pen = app.pen.currPenRef().pen;
        if(!pen.settings.tipset) {
            pen.settings.tipset = {}; }
        initTips();
        if(!showPriorityTip(pen)) {
            findAndShowNextTip(pen); }
    },


    tipok: function (tipname, leaveExistingDialogOpen) {
        var i, checkboxes, pen;
        pen = app.pen.currPenRef().pen;
        checkboxes = document.getElementsByName("cbtip");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                pen.settings.tipset[tipname] = "dismissed";
                writeUpdatedTipsInfo(pen);
                break; } }
        if(!leaveExistingDialogOpen) {
            app.layout.closeDialog(); }
    },


    promptToReview: function () {
        app.layout.closeDialog();
        writerev(0);
    },


    writeReview: function () {
        app.hinter.tipok('writerev');
        app.review.cancelReview(true);
    },


    fillCity: function () {
        app.hinter.tipok('fillcity');
        app.profile.setEditField("city");
        app.profile.display();
    },


    ezlink: function () {
        ezlink(true);
    },


    groupsTab: function () {
        app.layout.closeDialog();
        app.pen.getPen(function (pen) {
            app.profile.verifyStateVariableValues(pen);
            app.profile.setSelectedTab('groups');
            app.profile.display(); });
    },


    //Check the email address provided in the form, then update.  If
    //the email address was not used yet, then a new native account is
    //created using the specified email.  If a native account exists
    //with the specified email, then it probably belongs to the user,
    //and the easiest thing is just to hook it up.  Of course if it
    //isn't their email, then they just gave someone else full control
    //over their pen name, which is the one they access automatically
    //when logging in via that 3rd party auth.  Fixing that kind of a
    //screwup is not possible via the site. It requires going into the
    //db directly and unsetting the "mid" value for the given pen.
    //Not expecting that to be a common problem.  If it does happen,
    //then support would first verify access by having the user change
    //the pen shoutout text.
    setEmail: function () {
        var data, emaddr = jt.byId('emailin').value;
        if(!emaddr) {
            return jt.out('formstatdiv', "No email address found"); }
        if(!jt.isProbablyEmail(emaddr)) {
            return jt.out('formstatdiv', "Need a valid email address"); }
        data = "penid=" + jt.instId(app.pen.currPenRef().pen) +
            "&email=" + jt.enc(emaddr);
        jt.call('POST', "penmail?" + app.login.authparams(), data,
                function (pens) {
                    app.pen.setCurrentPenReference(pens[0]);
                    app.hinter.tipok('email'); },
                app.failf(function (code, errtxt) {
                    jt.out('formstatdiv', "Email update failure " + code +
                           ": " + errtxt); }),
                jt.semaphore("hinter.setEmail"));
    }


};  //end of returned functions
}());

