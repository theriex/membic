/*jslint node, white, fudge */

//Read uids.tdf and tids.tdf to download all users and themes.  The TDF
//files were created by querying in the GAE console, selecting all, copying
//into a file and then editing.  Editing consisted of fixing the header line
//tag to be tab delimited, changing "Name/ID" to "gaeid", and getting rid of
//the "id=" prefix in the values.  Membic uses "_id" as the identifier for
//objects.  Mapping from gaeid to _id happens on import to new db.

var puller = (function () {
    "use strict";

    var fs = require("fs");
    var http = require("http");

    var stats = {musersUpdated:0, themesUpdated:0, servercalls:0};

    var uspec = [
        {attr:"gaeid", type:"String", ovrw:false},
        {attr:"email", type:"String", ovrw:false},
        {attr:"phash", type:"String", ovrw:false},
        {attr:"status", type:"String", ovrw:false},
        {attr:"mailbounce", type:"String", ovrw:false},
        {attr:"actsends", type:"String", ovrw:false},
        {attr:"actcode", type:"String", ovrw:false},
        {attr:"altinmail", type:"String", ovrw:false},
        {attr:"name", type:"String", ovrw:true},
        {attr:"aboutme", type:"String", ovrw:true},
        {attr:"hashtag", type:"String", ovrw:true},
        {attr:"profpic", type:"pic", ovrw:true},
        {attr:"cliset", type:"JSON", ovrw:true},
        {attr:"coops", type:"JSON", ovrw:true},
        {attr:"created", type:"String", ovrw:true},
        {attr:"modified", type:"String", ovrw:true},
        {attr:"lastwrite", type:"String", ovrw:true},
        {attr:"preb", type:"JSON", ovrw:true}];

    var tspec = [
        {attr:"gaeid", type:"String", ovrw:false},
        {attr:"name", type:"String", ovrw:true},
        {attr:"name_c", type:"String", ovrw:true},
        {attr:"modified", type:"String", ovrw:true},
        {attr:"modhist", type:"String", ovrw:true},
        {attr:"hashtag", type:"String", ovrw:true},
        {attr:"lastwrite", type:"String", ovrw:true},
        {attr:"description", type:"String", ovrw:true},
        {attr:"picture", type:"pic", ovrw:true},
        {attr:"founders", type:"String", ovrw:true},
        {attr:"moderators", type:"String", ovrw:true},
        {attr:"members", type:"String", ovrw:true},
        {attr:"seeking", type:"String", ovrw:true},
        {attr:"rejects", type:"String", ovrw:true},
        {attr:"adminlog", type:"JSON", ovrw:true},
        {attr:"people", type:"JSON", ovrw:true},
        {attr:"cliset", type:"JSON", ovrw:true},
        {attr:"keywords", type:"String", ovrw:true},
        {attr:"preb", type:"JSON", ovrw:true}];
        
        
    function updateLocalData(tdfo, data, locf, dlspec) {
        var srvo = JSON.parse(data)[0];
        var updo = {dltag:dlspec.dltag};
        dlspec.spec.forEach(function (fs) {
            updo[fs.attr] = tdfo[fs.attr] || "";
            if(fs.ovrw) {
                updo[fs.attr] = srvo[fs.attr]; } });
        fs.writeFileSync(locf, JSON.stringify(updo), "utf8");
        stats[dlspec.folder + "Updated"] += 1;
        console.log("updated " + locf);
    }


    function downloadAndUpdate (tdfo, locf, dlspec) {
        if(stats.servercalls) {
            return; }  //just call once to make sure things are working.
        //console.log("downloadAndUpdate " + locf);
        stats.servercalls += 1;
        http.request(
            {host:"membic.org",
             path:"/" + dlspec.objsrc.url + "?" + dlspec.objsrc.idparam + "=" + 
                 tdfo.gaeid},
            function (res) {
                var data = "";
                res.on("data", function (chunk) {
                    data += chunk; });
                res.on("end", function () {
                    updateLocalData(tdfo, data, locf, dlspec); }); })
            .on("error", function (err) {
                console.log(err.message); })
            .end();
    }


    function verifyDownloaded (dlspec) {
        // console.log("verifyDownloaded " + dlspec.folder + ": " + 
        //             JSON.stringify(dlspec.tdfdat[0]));
        var tdfo = dlspec.tdfdat[dlspec.index];
        if(tdfo.gaeid) {  //quit if we hit an empty row after main data
            tdfo.gaeid = tdfo.gaeid.trim();
            var locf = dlspec.folder + "/" + tdfo.gaeid + ".json";
            if(!fs.existsSync(locf)) {
                fs.writeFileSync(locf, "{}", "utf8"); }
            var loco = JSON.parse(fs.readFileSync(locf, "utf8"));
            // console.log("verifyDownloaded " + locf + " " + loco.dltag + "/" +
            //             dlspec.dltag);
            if(loco.dltag !== dlspec.dltag) {
                downloadAndUpdate(tdfo, locf, dlspec); }
            dlspec.index += 1;
            if(dlspec.index < dlspec.tdfdat.length) {
                verifyDownloaded(dlspec); } }
    }


    function makeJSONObject(fields, values) {
        var jso = {};
        fields.forEach(function (field, idx) {
            jso[field] = values[idx]; });
        return jso;
    }


    function tdf2jsonArray (data) {
        var fields = null;
        var jsa = [];
        data.split("\n").forEach(function (line) {
            if(!fields) {
                fields = line.split("\t"); }
            else {
                jsa.push(makeJSONObject(fields, line.split("\t"))); } });
        return jsa;
    }


    function readTDF (dlspec) {
        fs.readFile(dlspec.tdf, "utf8", function (err, data) {
            if(err) { 
                throw err; }
            dlspec.tdfdat = tdf2jsonArray(data);
            // fs.writeFileSync(dlspec.folder + ".json",
            //                  JSON.stringify(dlspec.tdfdat, "utf8"));
            verifyDownloaded(dlspec); });
    }


    //The tag is used to resume from where things left off in case all the
    //downloading causes the site to run out of resources and shut down.
    function download (tag) {  //e.g. "28jan20"
        readTDF({dltag:tag, index:0,
                 tdf:"uids.tdf", folder:"musers", spec:uspec,
                 objsrc:{url:"profbyid", idparam:"profid"},
                 picsrc:{url:"profpic", idparam:"profileid"}});
        readTDF({dltag:tag, index:0,
                 tdf:"tids.tdf", folder:"themes", spec:tspec,
                 objsrc:{url:"ctmbyid", idparam:"coopid"},
                 picsrc:{url:"ctmpic", idparam:"coopid"}});
    }


    return {
        download: function (tag) { download(tag); }
    };
}());

puller.download(process.argv[2]);

