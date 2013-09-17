/*global define: false, window: false, document: false, history: false, JSON: false, app: false */

/*jslint white: true, unparam: true, maxerr: 50, indent: 4 */

////////////////////////////////////////
// history utility methods
//

define([], function () {
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
                    app.log("history.pushState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.replaceState(pstate, title, url);
                    app.log("history.replaceState: " + 
                            JSON.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    },


    pop: function (event) {
        var state = event.state;
        app.log("historyPop: " + JSON.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(app.isId(state.profid)) {
                    app.profile.byprofid(state.profid, state.tab); }
                break; 
            case "activity":
                app.activity.displayActive();
                break;
            case "memo":
                app.activity.displayRemembered();
                break;
            case "review":
                //the review was cached when previously viewed..
                app.review.setCurrentReview(
                    app.lcs.getRevRef(state.revid).rev);
                app.review.displayRead();
                break;
            } }
    },


    currState: function () {
        var state = {};
        if(history && history.state) {
            state = history.state; }
        return state;
    }


    }; //end of returned functions
});

