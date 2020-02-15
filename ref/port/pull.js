/*jslint node, white, fudge */

//Use: 
//
//node pull.js "15feb20", 200
//
//Fetches at most 200 items.  Any existing items where the json has a dltag
//matching "15feb20" will not be refetched.

//Read uids.tdf and tids.tdf to download all users and themes.  The TDF
//files were created by querying in the GAE console, selecting all, copying
//into a file, and editing.  Editing consisted of fixing the header line tag
//to be tab delimited, changing "Name/ID" to "gaeid", and getting rid of the
//"id=" prefix in the values.  That's enough to query for the rest of the
//data.  The MUser/Coop preb values are then unpacked to get the membics
//data.  For the membics, the import id is "instid".

var puller = (function () {
    "use strict";

    var fs = require("fs");
    var https = require("https");

    var stats = {pending:0, server: {}, files: {}};

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
        

    function urlFetch (url, contf) {
        https.request({host:"membic.org", path:url},
                     function (res) {
                         var data = []; //array of buffers from each chunk
                         res.on("data", function (chunk) {
                             data.push(chunk); });
                         res.on("end", function () {
                             //concat all the buffers into one and return that
                             data = Buffer.concat(data);
                             contf(data); }); })
            .on("error", function (err) {
                console.log(err.message); })
            .end();  //signal request ready for processing
    }


    function srvrGet (endpt, qstr, contf) {
        stats.server[endpt] = stats.server[endpt] || 0;
        stats.server[endpt] += 1;
        stats.pending += 1;
        urlFetch(endpt + qstr, function (data) {
            stats.pending -= 1;
            contf(data); });
    }


    function locSave (filename, content) {
        console.log("--> " + filename);
        var folder = filename.slice(0, filename.lastIndexOf("/"));
        stats.files[folder] = stats.files[folder] || 0;
        stats.files[folder] += 1;
        var format = "utf8";
        if(filename.endsWith(".png")) {
            format = "binary"; }
        fs.writeFileSync(filename, content, format);
    }


    //Verify membic data files exist, with associated pics (if any).
    function writeMembics(membics, overwrite) {
        membics.forEach(function (membic) {
            var membicwritten = false;
            var mfn = "membics/" + membic.instid + ".json";
            if(membic.overflow) {  //overflow marker membic
                if(overwrite || membicwritten) {
                    srvrGet("/ovrfbyid", "?overid=" + membic.overflow,
                            function (data) {
                                console.log("-|| ovrf " + membic.overflow);
                                var overflow = JSON.parse(data)[0];
                                var marr = JSON.parse(overflow.preb);
                                writeMembics(marr, overwrite); }); } }
            else if(overwrite || !fs.existsSync(mfn)) {
                membicwritten = true;
                locSave(mfn, JSON.stringify(membic));
                if(membic.svcdata && membic.svcdata.indexOf("upldpic") >= 0) {
                    var fnm = "membics/pics/" + membic.instid + ".png";
                    srvrGet("/revpic", "?revid=" + membic.instid,
                            function (data) {
                                locSave(fnm, data); }); } } });
    }


    //Update the local data with the data from the server, fetching
    //additional supporting data if needed.
    function updateLocalData(data, tdfo, local, dlspec) {
        var srvo = JSON.parse(data)[0];
        var loco = local.obj;
        //pull down the pic as needed
        var picfn = dlspec.folder + "/pics/" + tdfo.gaeid + ".png";
        if(srvo[dlspec.picsrc.fld] && (!fs.existsSync(picfn) ||
                                       srvo.modified !== loco.modified)) {
            srvrGet("/" + dlspec.picsrc.url, "?" + dlspec.picsrc.idparam +
                     "=" + tdfo.gaeid,
                     function (data) {
                         locSave(picfn, data); }); }
        //update local copies of membics as needed
        writeMembics(JSON.parse(srvo.preb), srvo.modified !== loco.modified);
        //update the local object and write it
        dlspec.spec.forEach(function (fs) {
            loco[fs.attr] = tdfo[fs.attr] || "";
            if(fs.ovrw) {
                loco[fs.attr] = srvo[fs.attr]; } });
        loco.dltag = dlspec.dltag;
        locSave(local.fname, JSON.stringify(loco));
    }


    function verifyDownloaded (dlspec) {
        var tdfo = dlspec.tdfdat[dlspec.index];
        if(tdfo.gaeid) {  //quit if we hit an empty row after main data
            tdfo.gaeid = tdfo.gaeid.trim();
            var locf = dlspec.folder + "/" + tdfo.gaeid + ".json";
            if(!fs.existsSync(locf)) {
                fs.writeFileSync(locf, "{}", "utf8"); }
            var loco = JSON.parse(fs.readFileSync(locf, "utf8"));
            if(loco.dltag !== dlspec.dltag && stats.pulled < stats.maxpull) {
                stats.pulled += 1;
                srvrGet("/" + dlspec.objsrc.url, "?" + dlspec.objsrc.idparam +
                        "=" + tdfo.gaeid,
                        function (data) {
                            updateLocalData(data, tdfo, {fname:locf, obj:loco},
                                            dlspec); }); }
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
        dlspec.tdfdat = tdf2jsonArray(fs.readFileSync(dlspec.tdf, "utf8"));
        verifyDownloaded(dlspec);
    }


    function writeStats () {
        if(stats.pending) {
            return setTimeout(writeStats, 500); }
        console.log(JSON.stringify(stats));
    }


    //The tag is used to resume from where things left off in case all the
    //downloading causes the site to run out of resources and shut down.
    function download (tag, maxpull) {  //e.g. "26jan20", 100
        stats.pulled = 0;
        stats.maxpull = maxpull || 1
        readTDF({dltag:tag, index:0,
                 tdf:"uids.tdf", folder:"musers", spec:uspec,
                 objsrc:{url:"profbyid", idparam:"profid"},
                 picsrc:{fld:"profpic", url:"profpic", idparam:"profileid"}});
        readTDF({dltag:tag, index:0,
                 tdf:"tids.tdf", folder:"themes", spec:tspec,
                 objsrc:{url:"ctmbyid", idparam:"coopid"},
                 picsrc:{fld:"picture", url:"ctmpic", idparam:"coopid"}});
        writeStats();
    }


    return {
        download: function (tag, maxpull) { download(tag, maxpull); }
    };
}());

puller.download(process.argv[2], process.argv[3]);

