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


    dispatchState: function (state) {
        switch(state.view) {
        case "profile":
            if(jt.isId(state.profid)) {
                return app.profile.byprofid(state.profid, state.tab); }
            return app.profile.display();
        case "group":
            if(jt.isId(state.groupid)) {
                return app.group.bygroupid(state.groupid, state.tab); }
            return app.group.display();
        case "activity":
            return app.activity.displayActive();
        case "memo":
            return app.activity.displayRemembered();
        case "review":
            if(state.revid) {
                return app.review.initWithId(state.revid, state.mode); }
            break;
        }
    },


    pop: function (event) {
        var state;
        if(event) {
            state = event.state; }
        jt.log("historyPop: " + JSON.stringify(state));
        if(state && state.view) {
            app.history.dispatchState(state); }
        else if(app.login.isLoggedIn()) { 
            jt.log("historyPop: no state, so displaying main feed by default");
            app.activity.displayFeed("all"); }
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

