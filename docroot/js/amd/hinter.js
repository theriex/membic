/*global document: false, app: false, jt: false, setTimeout: false */

/*jslint unparam: true, white: true, maxerr: 50, indent: 4 */

app.hinter = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var tips = null,


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


    notipActive = function (pen) {
        return true; 
    },


    //This is an empty tip, which is used to avoid having a tip show
    //up when people first sign up.  They already see the
    //introductions dialog, which is enough popups happening
    //initially.  This will cycle through like any other tip, but not
    //showing a tip every once in a while is fine.
    notip = function () {
        app.hinter.tipok('notip', true);
    },


    looktopActive = function (pen) {
        return true;
    },


    //Avoid annoying people with tips coming up all the time, give them the
    //opt out option immediately when possible.  Like for this tip.
    looktop = function () {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "To see someone's top 20 reviews, select the \"Top Rated\" tab on their profile."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to find a friend's top rated reviews. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('looktop')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Top Rated Reviews", html);
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
            return prefix + "(function(){window.open('http://www.wdydfun.com?newrev=&url='+encodeURIComponent(window.location.href));})();"; }
        return prefix + "(function(){window.location.href='http://www.wdydfun.com?newrev=&url='+encodeURIComponent(window.location.href);})();";
    },


    ezlink = function (displayCount) {
        var html;
        html = ["div", {cla: "hintcontentdiv"},
                [["p", "The wdydfun bookmarklet lets you kick off a review from any site.<br/>To install it, \"right click\" this link..."],
                 ["p", {style: "padding:5px 40px; font-weight:bold;"},
                  ["&#x2192;&nbsp;",
                   ["a", {href: hideBookmarkletFromJSLint(true)},
                    "wdydfun review"],
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
        html = app.layout.dlgwrapHTML("Easy Review Link", html);
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
                [["p", "Reviewing something once a week will get you more followers, and build up a really cool review log.  There are definitely people here who are interested in your impressions.  Want to help them out?"],
                 ["p", "If the past week was not worth mentioning, don't forget to review your favorite book, movie, album, restaurant or place to visit."],
                 //no permanent dismiss option. Write a review a week..
                 ["div", {cla: "tipsbuttondiv"},
                  [["button", {type: "button", id: "tipok",
                               onclick: jt.fs("app.hinter.tipok('writerev')")},
                    "Later"],
                   "&nbsp; &nbsp; &nbsp;",
                   ["button", {type: "button", id: "writerevbutton",
                               onclick: jt.fs("app.hinter.writeReview()")},
                    "Write a Review"]]]]];
        html = app.layout.dlgwrapHTML("Write a Review", html);
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
                [["p", "When you see an interesting review of something new, click its \"Remember\" button to keep a link to it in your remembered reviews."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to remember reviews. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('remrev')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Remembered Reviews", html);
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
                [["p", "Groups are themed collections of reviews. Join or create one from \"Groups\" tab on your profile."],
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
                [["p", "If you would like to request a review from someone you are following, click the link next to their name on your profile."],
                 ["div", {cla: "dismissradiodiv"},
                  jt.checkbox("cbtip", "cbtip", "I know how to request a review from someone I'm following. Don't display this message ever again.")],
                 ["div", {cla: "tipsbuttondiv"},
                  ["button", {type: "button", id: "tipok",
                              onclick: jt.fs("app.hinter.tipok('request')")},
                   "OK"]]]];
        html = app.layout.dlgwrapHTML("Request a Review", html);
        app.layout.queueDialog({y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    displayCodeUpdateDialog = function () {
        var html = ["p", "Your browser found an older copy of the site to run.<br/>Please reload this page."];
        html = app.layout.dlgwrapHTML("Get The Latest", html);
        app.layout.openDialog({y:140}, html);
    },


    //If the version is out of date, clobber any dialog that is up and
    //ask them to reload to get the latest source.  Better to be
    //annoying than flaky.
    runVersionCheck = function () {
        jt.call('GET', "/buildverstr", null,
                function (vstr) {
                    if(vstr !== "BUILDVERSIONSTRING") {
                        displayCodeUpdateDialog(); } },
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


    initTips = function () {
        tips = [
            { name: "notip",    checkf: notipActive,    runf: notip },
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
        var pen, settings, tipset, i, name, rotips, temp;
        setTimeout(runVersionCheck, 1000);
        pen = app.pen.currPenRef().pen;
        settings = pen.settings;
        if(!settings.tipset) {
            settings.tipset = {}; }
        tipset = settings.tipset;
        if(promptedRecently(tipset)) {
            return; }
        initTips();
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
                if(!tipset[name]) {
                    tipset[name] = 1; }
                else {
                    tipset[name] += 1; }
                tips[i].runf(tipset[name]);  //pass the count for processing
                tipset.prevtip = name;
                tipset.lastprompt = new Date().toISOString();
                writeUpdatedTipsInfo(pen);
                break; } }
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
    }


};  //end of returned functions
}());

