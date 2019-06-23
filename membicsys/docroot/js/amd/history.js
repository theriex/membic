/*global window, document, history, JSON, app, jt */

/*jslint browser, multivar, white, fudge */

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

    getTitle = function (ignore /*state*/) {
        var title = document.title;
        return title;
    },


    getURL = function (ignore /*state*/) {
        var url = window.location.href;
        return url;
    },


    indicateState = function (/*state*/) {
        //This used to display a "home" clickable icon if state.view
        //was anything other than "activity", but that looks like
        //visual graffiti.  Buttons need to remain static so they are
        //recognized as stable anchor points for navigation.
        jt.out("topdiv", "");
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
        indicateState(pstate);
        if(history) {  //verify history object defined, otherwise skip
            hstate = history.state;
            if(!hstate 
               || hstate.view !== pstate.view 
               || hstate.profid !== pstate.profid
               || hstate.penid !== pstate.penid
               || hstate.revid !== pstate.revid) {
                if(history.pushState && 
                   typeof history.pushState === "function") {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.pushState(pstate, title, url);
                    jt.log("history.pushState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === "function") {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.replaceState(pstate, title, url);
                    jt.log("history.replaceState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    },


    dispatchState: function (state) {
        state = state || app.history.currState();
        //jt.log("history.dispatchState " + jt.objdata(state));
        indicateState(state);
        switch(state.view) {
        case "themes":
            return app.themes.display();
        case "about":
            return app.layout.displayDoc();
        case "activity":
            return app.activity.displayActive();
        case "memo":  //not using anymore, memo tab for pen instead...
            return app.activity.displayRemembered();
        case "coop":
            return app.coop.bycoopid(state.coopid, "history", state.tab, 
                                     state.expid);
        case "profsetpic":
            if(app.pen.myPenId()) {  //they are logged in
                return app.pcd.display("pen", app.pen.myPenId(), "latest", 
                                       app.pen.myPenName(), "settingspic"); }
            //otherwise just do the main display
            return app.profile.display();
        case "profile":
            return app.profile.byprofid(state.profid);
        case "pen":
            if(jt.isId(state.profid)) {
                state.penid = state.profid; }
            if(jt.isId(state.penid)) {
                return app.pen.bypenid(state.penid, "history", state.tab,
                                       state.expid, state.action); }
            return app.pcd.display();
        default:
            jt.log("history.dispatchState unknown state: " + state);
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

