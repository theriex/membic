/*global window, document, history, JSON, app, jt */

/*jslint browser, white, fudge */

app.statemgr = (function () {
    "use strict";

    var typemap = {MUser:"MUser", profile:"MUser",
                   Theme:"Theme", theme:"Theme",
                   activetps:"activetps", connect:"activetps"};
    var tagmap = {};  //dsType+dsId:hashtag entries for url mapping


    function updateNavArea (state) {
        var tndiv = jt.byId("topnavdiv");
        if(!tndiv) {
            return; }
        state = state || history.state;
        var prof = app.login.myProfile();
        if(prof && (state.dsType !== "MUser" || state.dsId !== prof.dsId)) {
            //provide link back to own profile page
            tndiv.innerHTML = jt.tac2html(
                ["div", {cla:"navicodiv"},
                 ["a", {href:"#profile", title:"My Profile",
                        onclick:jt.fs("app.statemgr.setState('MUser','" +
                                      prof.dsId + "')")},
                  ["img", {src:app.dr("img/navprofile.png")}]]]); }
        else if((state.dsType !== "activetps") &&
                (!prof ||
                 (state.dsType === "MUser" && state.dsId === prof.dsId))) {
            //provide link back to connect page
            tndiv.innerHTML = jt.tac2html(
                ["div", {cla:"navicodiv"},
                 ["a", {href:"#connect", title:"Connect",
                        onclick:jt.fs("app.statemgr.setState('activetps','" +
                                      "411')")},
                  ["img", {src:app.dr("img/membiclogo.png")}]]]); }
        else {  //e.g. on connect page but not logged in
            tndiv.innerHTML = ""; }
    }


    function dispatchState (state, extra) {
        state = state || history.state;
        updateNavArea(state);
        switch(state.dsType) {
        case "activetps":
            return app.connect.display(extra);
        case "Theme":
            return app.pcd.fetchAndDisplay("theme", state.dsId, extra);
        case "MUser":
            return app.pcd.fetchAndDisplay("profile", state.dsId, extra);
        default:
            jt.log("statemgr.dispatchState unknown state: " +
                   JSON.stringify(state)); }
    }


return {

    urlForInstance: function (obj) {
        obj = obj || {};
        if(obj.hashtag) {
            app.statemgr.notehash(obj);
            return "/" + obj.hashtag; }
        var lookuphash = tagmap[obj.dsType + obj.dsId];
        if(lookuphash) {
            return "/" + lookuphash; }
        switch(obj.dsType) {
        case "Theme":
            return "/theme/" + obj.dsId;
        case "MUser":
            return "/profile/" + obj.dsId; }
        //Return the explicit URL for the no-login default display.
        return "/connect";
    },


    //Set the state as needed.  Attempts to set the state to what it already
    //is are ignored, so a back button history pop followed by a call to set
    //the state won't accumulate.  An unspecified dsId sets a temporary
    //state that will be replaced by the next call.  The presumption is that
    //a new instance is being created and the next call to set the state
    //will reflect either the new dsId or the appropriate state after
    //abandoning creation.
    //
    //The "extra" param is passed through in the dispatch call if the state
    //was changed.  It is not saved with the state.  A typical use might be
    //to automatically open the settings when switching to display a theme.
    //Within the extra param, forceReplace replaces the state and calls
    //dispatch even if the state has not changed.  The primary use is to
    //rebuild the display processing on full page reload when the browser
    //history has not changed but the app clearly needs to redisplay.
    setState: function (dsType, dsId, extra) {
        var refobj;
        if(typeof dsType === "object") {  //support shorthand calls
            refobj = dsType;
            dsType = refobj.dsType;
            dsId = refobj.dsId; }
        dsType = typemap[dsType];
        var currst = history.state;
        if(currst && currst.dsType === dsType && currst.dsId === dsId &&
           !(extra && extra.forceReplace)) {
            return; }  //state already set
        var newst = {};
        newst.dsType = dsType;
        newst.dsId = dsId;
        refobj = refobj || app.refmgr.cached(dsType, dsId) || newst;
        if(currst && (!currst.dsId ||  //incomplete state, replace with current
                      (extra && extra.forceReplace))) {
            jt.log("history.replaceState " + dsType + " " + dsId);
            //Replacement also triggers a dispatch, even if the object was
            //just saved. Successful save processing is unknown as far as
            //the history stack is concerned, and view initialization should
            //always be consistent with history state init.
            history.replaceState(newst, dsType + dsId,
                                 app.statemgr.urlForInstance(refobj)); }
        else {
            jt.log("history.pushState " + dsType + " " + dsId);
            history.pushState(newst, dsType + dsId,
                              app.statemgr.urlForInstance(refobj)); }
        if(extra) {
            delete extra.forceReplace;
            if(Object.keys(extra).length === 0) {
                extra = null; } }
        dispatchState(history.state, extra);
    },


    pop: function (event) {
        var state;
        if(event) {
            state = event.state; }
        jt.log("historyPop: " + JSON.stringify(state));
        if(state) {
            dispatchState(state); }
        //if there is no state, then this was a call from the browser
        //resulting from a script error or user action outside of the scope
        //of the app (like trying to back-button to a previous site).  That
        //should not be handled here or the site gets sticky in a not good
        //way and errors cause weird display changes.
    },


    //If the current state matches the dsType and dsId, call the continue
    //function, otherwise call setState.
    verifyState: function (dsType, dsId, extra, contf) {
        dsType = typemap[dsType];
        var currst = history.state;
        if(currst && currst.dsType === dsType && currst.dsId === dsId) {
            return contf(); }
        return app.statemgr.setState(dsType, dsId, extra);
    },


    //Dispatch the current state again.  Basically a redraw in response to a
    //system wide data change, like the user signing in.
    redispatch: function (extra) {
        dispatchState(history.state, extra);
    },


    updatenav: function () {
        updateNavArea();
    },


    notehash: function (obj) {
        if(obj && obj.dsType && obj.dsId) {
            if(obj.hashtag) {
                tagmap[obj.dsType + obj.dsId] = obj.hashtag; }
            else {  //hashtag may have previously existed, verify not cached
                delete tagmap[obj.dsType + obj.dsId]; } }
    }
        
}; //end of returned functions
}());

