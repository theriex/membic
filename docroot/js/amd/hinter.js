/*global document: false, app: false, jt: false */

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


    looktopActive = function (pen) {
        return true;
    },


    //This is the first tip to be displayed, and we don't want to
    //annoy people by having them expect these tips are going to come
    //up all the time, so give them the opt out option.
    looktop = function () {
        var html, cboxhtml = "", nothanks;
        nothanks = "I know how to find a friend's top rated reviews. Don't display this message ever again.";
        cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks);
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Top Rated Reviews"],
                ["p",
                 "To see top reviews for a specific person, click their name to go to their profile and then select the \"Top Rated\" tab."],
                ["div", {cla: "dismissradiodiv"},
                 cboxhtml],
                ["div", {cla: "tipsbuttondiv"},
                 ["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('looktop')")},
                  "OK"]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null,
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


    ezlink = function (interactive) {
        var html, cboxhtml = "", nothanks;
        nothanks = "I already have the extremely handy bookmark link.  Don't display this message ever again.";
        if(interactive > 1) {
            cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks); }
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Easy Review Link"],
                [["p",
                  "To import information from any site for your review, add one of these links to your bookmarks:"],
                 ["table",
                  [["tr",
                    [["td", {cla: "bookmarkletdescr"},
                      "Start a review in a new window:"],
                     ["td",
                      ["div", {cla: "bookmarkletlinkdiv"},
                       ["a", {href: hideBookmarkletFromJSLint(true)},
                        "wdydfun window"]]],
                     ["td", {rowspan: 2, valign: "middle"},
                      "&#x21D6;<br/>&#x21D9;"],
                     ["td", {rowspan: 2, valign: "middle"},
                      ["div", {cla: "rightclick"},
                       "(\"right click\")"]]]],
                   ["tr",
                    [["td", {cla: "bookmarkletdescr"},
                      "Start a review in the same tab:"],
                     ["td",
                      ["div", {cla: "bookmarkletlinkdiv"},
                       ["a", {href: hideBookmarkletFromJSLint(false)},
                        "wdydfun this"]]]]]]]],
                ["div", {cla: "dismissradiodiv"},
                 cboxhtml],
                ["div", {cla: "tipsbuttondiv"},
                 ["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('ezlink')")},
                  "OK"]]];
        html = jt.tac2html(html);
        app.layout.queueDialog({x:80, y:140}, html, null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    writerevActive = function (pen) {
        if(pen.top20s && pen.top20s.latestrevtype) {
            return false; }
        return true;
    },


    writerev = function (displayCount) {
        var html, cboxhtml = "", nothanks;
        nothanks = "Eventually I'll find something worth mentioning to other people, please don't display this message again.";
        if(displayCount > 1) {
            cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks); }
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Write a Review"],
                ["div",
                 [["p",
                   "There are lots of people whose lives might be improved after reading a review of your favorite book, movie or place to go. You don't have to be a professional for your opinion to count here. Want to give it a shot?"],
                  ["div", {cla: "dismissradiodiv"},
                   cboxhtml],
                  ["div", {cla: "tipsbuttondiv"},
                   [["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('writerev')")},
                     "Later"],
                    "&nbsp; &nbsp; &nbsp;",
                    ["button", {type: "button", id: "writerevbutton",
                             onclick: jt.fs("app.hinter.writeReview()")},
                     "Write My First Review"]]]]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('writerevbutton').focus(); });
    },


    fillcityActive = function (pen) {
        if(pen.city) {
            return false; }
        if(writerevActive(pen)) { //profile not important until they write 
            return false; }       //at least one review
        return true;
    },


    fillcity = function (displayCount) {
        var html, cboxhtml = "", nothanks;
        nothanks = "I don't want my profile to look more interesting, please don't display this message again.";
        if(displayCount > 1) {
            cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks); }
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Profile City"],
                ["div",
                 [["p",
                   "Including the metropolitan area, township or region you are most affiliated with makes your profile more interesting and helps build relationships. Add a city to your profile?"],
                  ["div", {cla: "dismissradiodiv"},
                   cboxhtml],
                  ["div", {cla: "tipsbuttondiv"},
                   [["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('fillcity')")},
                     "Later"],
                    "&nbsp; &nbsp; &nbsp;",
                    ["button", {type: "button", id: "fillcitybutton",
                                onclick: jt.fs("app.hinter.fillCity()")},
                     "Update Profile"]]]]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('fillcitybutton').focus(); });
    },
                  

    remrevActive = function (pen) {
        if(pen.revmem && pen.revmem.remembered && 
           pen.revmem.remembered.length > 0) {
            return false; }
        return true; 
    },


    remrev = function (displayCount) {
        var html, cboxhtml = "", nothanks;
        nothanks = "I know how to remember reviews. Don't display this message ever again.";
        cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks);
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Remembered Reviews"],
                ["p",
                 "When you see a review of something that looks interesting, click its \"Remember\" button to keep a link to it. Then anytime you are looking for things to do, you can look through your remembered reviews."],
                ["div", {cla: "dismissradiodiv"},
                 cboxhtml],
                ["div", {cla: "tipsbuttondiv"},
                 ["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('remrev')")},
                  "OK"]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
    },


    requestActive = function (pen) {
        var penref = app.pen.currPenRef();
        if((penref.outreqs && penref.outreqs.length > 0) ||
           (penref.inreqs && penref.inreqs.length > 0)) {
            return false; }
        return true;
    },


    request = function (displayCount) {
        var html, cboxhtml = "", nothanks;
        nothanks = "I know how to request a review from someone I'm following. Don't display this message ever again.";
        cboxhtml = jt.checkbox("cbtip", "cbtip", nothanks);
        html = [["div", {cla: "dlgclosex"},
                 ["a", {id: "closedlg", href: "#close",
                        onclick: jt.fs("app.layout.closeDialog()")},
                  "&lt;close&nbsp;&nbsp;X&gt;"]],
                ["div", {cla: "floatclear"}],
                ["div", {cla: "headingtxt"}, "Request a Review"],
                ["p",
                 "If you would like to request a review from someone you are following, you can click the link next to their name on the \"Following\" tab of your profile."],
                ["div", {cla: "dismissradiodiv"},
                 cboxhtml],
                ["div", {cla: "tipsbuttondiv"},
                 ["button", {type: "button", id: "tipok",
                             onclick: jt.fs("app.hinter.tipok('request')")},
                  "OK"]]];
        app.layout.queueDialog({x:80, y:140}, jt.tac2html(html), null,
                               function () {
                                   jt.byId('tipok').focus(); });
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
            { name: "looktop",  checkf: looktopActive,  runf: looktop },
            { name: "ezlink",   checkf: ezlinkActive,   runf: ezlink },
            { name: "writerev", checkf: writerevActive, runf: writerev },
            { name: "fillcity", checkf: fillcityActive, runf: fillcity },
            { name: "remrev",   checkf: remrevActive,   runf: remrev },
            { name: "request",  checkf: requestActive,  runf: request } ];
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    showStartTip: function () {
        var pen, settings, tipset, i, name, rotips, temp;
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


    tipok: function (tipname) {
        var i, checkboxes, pen;
        pen = app.pen.currPenRef().pen;
        checkboxes = document.getElementsByName("cbtip");
        for(i = 0; i < checkboxes.length; i += 1) {
            if(checkboxes[i].checked) {
                pen.settings.tipset[tipname] = "dismissed";
                writeUpdatedTipsInfo(pen);
                break; } }
        app.layout.closeDialog();
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
    }


};  //end of returned functions
}());

