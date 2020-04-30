/*global app, jt */

/*jslint browser, white, fudge, for */

//////////////////////////////////////////////////////////////////////
// A reader for known endpoints providing a JSON interface for metadata
// about their content.  The interfaces all have specific handling but are
// grouped together based on the format to avoid having lots of specific
// endpoints as site access changes.


app.jsonapi = (function () {
    "use strict";

    var vimeoHandler = {
        setMembicFields: function (ctx, membic, jd) {
            membic.revtype = "video";
            if(!jd || !jd.name) {
                return ctx.msgs.push("vimeoHandler: No JSON data provided"); }
            membic.details = {title: jd.name,
                              name: jd.name,
                              artist: jd.user.name,
                              year: jd.created_time.slice(0,4)};
            membic.url = jd.link;  //use canonical url returned from API
            var picwidth = 0;
            jd.pictures.sizes.forEach(function (pic) {
                //pics ordered by size from smallest to largest.
                if(!picwidth || pic.width < 300) {  //want big enough to see
                    picwidth = pic.width;           //but don't need huge
                    membic.imguri = pic.link; } });
            var msg = "Filled out: title, url, artist, year";
            if(membic.imguri) {
                msg += ", imguri"; }
            ctx.msgs.push(msg); }
    };


    function getCallContext (url) {
        var ctx = {handler:null, furl:"unknown", msgs:[]};
        var match = url.match(/https?:\/\/vimeo.com\/(\d+)/i);
        if(match) { //[0] is matching text, [1] is first matching group
            ctx.handler = vimeoHandler;
            ctx.furl = "https://api.vimeo.com/videos/" + match[1]; }
        return ctx;
    }


return {

    getInfo: function (membic, url) {
        jt.log("app.jsonapi fetching " + url);
        var ctx = getCallContext(url);
        if(!ctx.handler) {
            jt.log("Unknown jsonapi interface, calling default reader");
            return app.readurl.getInfo(membic, url); }
        var apiurl = app.login.authURL("/api/jsonget") + "&url=" +
            jt.enc(ctx.furl) + jt.ts("&cb=", "second");
        jt.call("GET", apiurl, null,
                function (json) {
                    ctx.handler.setMembicFields(ctx, membic, json);
                    app.membic.readerFinish(membic, "success",
                                            ctx.msgs.join("|")); },
                //Error may be from call to url, not a local server error
                function (code, errtxt) {
                    jt.log("app.jsonapi failed " + code + ": " + errtxt);
                    app.membic.readerFinish(membic, "failure",
                                            String(code) + ": " + errtxt); },
                jt.semaphore("jsonapi.getInfo"));
    }

};  //end of returned functions
}());
