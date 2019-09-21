/*global app, jt */

/*jslint browser, white, fudge, for */

app.jsonapi = (function () {
    "use strict";

    var svcName = "JSONAPI";     //ascii with no spaces, used as an id


    function coreURL (url) {
        var idx = url.indexOf("#");
        if(idx >= 0) {
            url = url.slice(0, idx); }
        idx = url.indexOf("?");
        if(idx >= 0) {
            url = url.slice(0, idx); }
        return url;
    }


    function normalizeServiceURL (membic, url) {
        svcName = "unknownJSONAPI";
        if(url.toLowerCase().indexOf("vimeo.")) {  //https://vimeo.com/id
            membic.rurl = url;
            url = coreURL(url);
            var vidid = url.slice(url.lastIndexOf("/") + 1);
            url = "https://api.vimeo.com/videos/" + vidid;
            svcName = "Vimeo"; }
        return url;
    }


    function setVimeoMembicFields (membic, jd) {
        if(!jd || !jd.name) {
            jt.log("setVimeoMembicFields no data provided");
            jt.err(svcName + " No data returned.");
            app.review.updatedlg(); }
        membic.revtype = "video";
        membic.title = jd.name;
        membic.url = jd.link;  //use canonical url returned from API
        membic.artist = jd.user.name;
        membic.year = jd.created_time.slice(0,4);
        var picwidth = 0;
        jd.pictures.sizes.forEach(function (pic) {
            //pics ordered by size from smallest to largest.
            if(!picwidth || pic.width < 300) {  //want big enough for revimg
                picwidth = pic.width;
                membic.imguri = pic.link; } });
    }


    function setMembicFields (membic, jd) {
        switch(svcName) {
            case "Vimeo": setVimeoMembicFields(membic, jd); break;
            default: jt.log("jsonapi.setMembicFields unknown service"); }
    }


return {

    name: svcName,

    fetchData: function (membic, url) {
        url = normalizeServiceURL(membic, url);  //changes svcName if known
        url = "jsonget?geturl=" + jt.enc(url) + app.login.authparams("&") +
            jt.ts("&cb=", "second");
        jt.call("GET", url, null,
                function (json) {
                    setMembicFields(membic, json);
                    app.review.updatedlg(); },
                 app.failf(function (code, errtxt) {
                     jt.log("jsonapi data retrieval failed code " +
                            code + ": " + errtxt);
                     jt.err(svcName + " URL could not be read.");
                     app.review.updatedlg(); }),
                jt.semaphore("jsonapi.fetchData"));
    }

};  //end of returned functions
}());
