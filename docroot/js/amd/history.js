/*global define: false, window: false, document: false, history: false, glo: false */

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
                    glo.log("history.pushState: " + 
                            glo.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } }
            else if(pstate.tab && hstate.tab !== pstate.tab) {
                if(history.replaceState &&
                   typeof history.replaceState === 'function') {
                    title = getTitle(pstate);
                    url = getURL(pstate);
                    history.replaceState(pstate, title, url);
                    glo.log("history.replaceState: " + 
                            glo.dojo.json.stringify(pstate) +
                            ", title: " + title + ", url: " + url); 
                } } }
    },


    pop: function (event) {
        var state = event.state;
        glo.log("historyPop: " + glo.dojo.json.stringify(state));
        if(state) {
            switch(state.view) {
            case "profile":
                if(glo.isId(state.profid)) {
                    glo.profile.byprofid(state.profid, state.tab); }
                break; 
            case "activity":
                glo.activity.displayActive();
                break;
            case "memo":
                glo.activity.displayRemembered();
                break;
            case "review":
                //the review was cached when previously viewed..
                glo.review.setCurrentReview(
                    glo.lcs.getRevRef(state.revid).rev);
                glo.review.displayRead();
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

