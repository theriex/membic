/*global window: false, document: false, history: false, JSON: false, app: false, jt: false */

/*jslint white: true, unparam: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// history utility methods
//

app.history = (function () {
    "use strict";

    ////////////////////////////////////////
    // closure data
    ////////////////////////////////////////

    var 


    ////////////////////////////////////////
    // closure helper funtions
    ////////////////////////////////////////

    getTitle = function (state) {
        var title = document.title;
        return title;
    },


    getURL = function (state) {
        var url = window.location.href;
        return url;
    };


    ////////////////////////////////////////
    // closure exposed functions
    ////////////////////////////////////////

return {

    //if the view or profid has changed, then push a history record.
    //if anything else has changed, replace the current history record.
    //otherwise no effect.
    checkpoint: function (pstate) {
        var hstate, title, url;
        if(history) {  //verify history object defined, otherwise skip
            hstate = history.state;
            if(!hstate 
               || hstate.view !== pstate.view 
               || hstate.profid !== pstate.profid
               || hstate.revid !== pstate.revid) {
                if(history.pushState && 
                   typeof history.pushState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.pushState(pstate, title, url);
                    jt.log("history.pushState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.replaceState(pstate, title, url);
                    jt.log("history.replaceState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    },


    pop: function (event) {
        var state;
        if(event) {
            state = event.state; }
        jt.log("historyPop: " + JSON.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(jt.isId(state.profid)) {
                    app.layout.updateNavIcons("profile");
                    app.profile.byprofid(state.profid, state.tab); }
                break; 
            case "activity":
                app.layout.updateNavIcons("activity");
                app.activity.displayActive();
                break;
            case "memo":
                app.layout.updateNavIcons("memo");
                app.activity.displayRemembered();
                break;
            case "review":
                app.layout.updateNavIcons("review");
                //the review was cached when previously viewed..
                app.review.setCurrentReview(
                    app.lcs.getRevRef(state.revid).rev);
                app.review.displayRead();
                break;
            } }
        else if(app.login.isLoggedIn()) { 
            jt.log("historyPop: no state, so displaying activity by default");
            app.activity.displayActive(); }
        //no default action if not logged in.  A browser may pop the
        //history to attempt to return to the raw site in the event of
        //an autologin failure.
    },


    currState: function () {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        return state;
    }


    }; //end of returned functions

}());

