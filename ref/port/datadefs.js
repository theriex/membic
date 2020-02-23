/*jslint node, white, fudge */

//If porting to standard App Engine, queries are limited at most one
//non-equality field specification, and there are no join operations.
//Stored object instances are limited to a max size of 1mb.

//Fields required to support database search and retrieval are separate and
//distinct.  Those are either declared unique, or listed within one or more
//queries.  Fields needed primarily for server-side CRUD processing are
//usually distinct for ease of coding.  Fields used mainly for analysis, or
//client-side display filtering may be grouped into JSON for ease of
//maintenance.

module.exports = (function () {
    "use strict";

    var fieldDescriptors = [
        {dn:"priv[ate]", h:"authorized access only e.g. owner personal info"},
        {dn:"adm[in]", h:"administrative access only e.g. act codes"},
        {dn:"req[uired]", h:"Save error if null or empty"},
        {dn:"uniq[ue]", h:"Indexed. Save err if matches another's value"},
        {dn:"str[ing]", h:"Rough max 128 char text, truncation ok.", aliases:[
            {dn:"email", h:"email address format"},
            {dn:"isod[ate]", h:"ISO date format"},
            {dn:"isomod", h:"ISO date;int count"}]},
        {dn:"text", h:"unindexable max 1mb string.", aliases:[
            {dn:"json", h:"JSON encoded data."},
            {dn:"idcsv", h:"comma separated unique integer ids"},
            {dn:"isodcsv", h:"comma separated ISO date values"},
            {dn:"gencsv", h:"general comma separated values"},
            {dn:"url", h:"a URL, possibly longer than 128chars"}]},
        {dn:"image", h:"base64 encoded binary image data (max 1mb)"},
        {dn:"dbid", h:"long int db id translated to string for JSON"},
        {dn:"int", h:"low range integer value JavaScript can handle"}];
    var descrLookup = null;


    var ddefs = [ //data storage entity definitions
    // The dsId, created, and modified fields are automatically added.
    {entity:"MUser", descr:"Membic User account.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"email", d:"priv req unique email"},
        {f:"phash", d:"adm req string"},
        {f:"status", d:"priv string", c:"Only Active may post",
         enumvals:["Pending", "Active", "Inactive", "Unreachable"]},
        {f:"mailbounce", d:"adm isodcsv", c:"latest bounce first"},
        {f:"actsends", d:"adm gencsv", c:"latest first isod;emaddr vals"},
        {f:"actcode", d:"adm string", c:"account activation code"},
        {f:"altinmail", d:"priv unique email", c:"alt mail-in address"},
        {f:"name", d:"string", c:"optional but recommended public name"},
        {f:"aboutme", d:"text", c:"optional description, website link etc."},
        {f:"hashtag", d:"unique string", c:"personal theme direct access"},
        {f:"profpic", d:"image", c:"used for theme, and coop posts"},
        {f:"cliset", d:"json", c:"dict of client settings, see note 1"},
        {f:"themes", d:"json", c:"theme reference info, see note"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}],
      logflds: ["email", "name"]},
        ////////// Notes:
        // cliset: {flags:{archived:ISO},
        //          embcolors:{link:"#84521a", hover:"#a05705"},
        //          maxPostsPerDay:1,
        //          ctkeys:{book:"keyword1, keyword2...",
        //                  movie:"keyword4, keyword2...",
        //                  ...} }
        //
        // themes: {"themeid":info, "themeid2":info2, ...}
        //  info: {lev:N, obtype:str, name:str, hashtag:str, description:str,
        //         picture:idstr, keywords:CSV, notices:[notice1, notice2..]}
        //    lev: -1 (following), 1 (member), 2 (moderator), 3 (founder).
        //         Any falsy value for lev means no association.
        //    obtype: "MUser" or "Theme". (you can follow an MUser)
        //    notice: {type:"application", lev:int, uid, uname, created:ISO,
        //             status:"pending"|"rejected", reason}
        // The themes data is for ease of reference, it is not authoritative
        // and may be out of date.  See util.verify_theme_muser_info

    {entity:"Theme", descr:"A cooperative theme.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"name", d:"req string", c:"Human readable name"},
        {f:"name_c", d:"req unique string", c:"canonical name for match"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"hashtag", d:"unique string", c:"optional one word name"},
        {f:"description", d:"text", c:"optional description, site link etc."},
        {f:"picture", d:"image", c:"used for theme display"},
        {f:"founders", d:"idcsv", c:"founding members"},
        {f:"moderators", d:"idcsv", c:"moderator members"},
        {f:"members", d:"idcsv", c:"standard members"},
        {f:"seeking", d:"idcsv", c:"member applications (member ids)"},
        {f:"rejects", d:"idcsv", c:"rejected applications (member ids)"},
        {f:"people", d:"json", c:"map of ids to user names for fast display"},
        {f:"cliset", d:"json", c:"client settings (like MUser)"},
        {f:"keywords", d:"gencsv", c:"custom theme keywords"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}],
      logflds: ["name"]},

    {entity:"AdminLog", descr:"Administrative actions log.", fields:[
        {f:"letype", d:"req string", c:"log entry type, e.g. 'Theme'"},
        {f:"leid", d:"req dbid", c:"e.g. the dsId of the Theme"},
        {f:"adminid", d:"req dbid", c:"dsId of the MUser who took action"},
        {f:"adminname", d:"string", c:"The name of the admin for readability"},
        {f:"action", d:"req string", c:"'Accepted Member', 'Removed Membic'"},
        {f:"targent", d:"string", c:"Affected entity type e.g. MUser, Membic"},
        {f:"targid", d:"dbid", c:"dsId of the affected entity"},
        {f:"targname", d:"string", c:"name of user or url of membic"},
        {f:"reason", d:"string", c:"text of why membic removed or whatever"}]},

    {entity:"Membic", descr:"A URL with a reason why it's memorable.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"url", d:"url", c:"canonical URL for item"},
        {f:"rurl", d:"url", c:"original read URL"},
        {f:"revtype", d:"req string", c:"book, movie, music...",
         enumvals:["book", "article", "movie", "video", "music", "yum",
                   "activity", "other"]},
        {f:"details", d:"json", c:"detail fields depending on type"},
        {f:"penid", d:"req dbid", c:"who wrote this membic"},
        {f:"ctmid", d:"req dbid", c:"Theme id, or 0 if source membic"},
        {f:"rating", d:"req int", c:"0-100"},
        {f:"srcrev", d:"req dbid", c:"source membic, see note"},
        {f:"cankey", d:"string", c:"alternative semi-key, see note"},
        {f:"text", d:"text", c:"why this link is memorable"},
        {f:"keywords", d:"gencsv", c:"keywords for this membic"},
        {f:"svcdata", d:"json", c:"pic src, other info, see note"},
        {f:"revpic", d:"image", c:"pic, if uploaded"},
        {f:"imguri", d:"url", c:"external pic for membic"},
        {f:"icdata", d:"image", c:"secure relay ext pic cache data"},
        {f:"icwhen", d:"isodate", c:"when icdata last pulled"},
        {f:"dispafter", d:"isodate", c:"visibility queued until"},
        {f:"penname", d:"string", c:"author name for easy UI ref"},
        {f:"reacdat", d:"json", c:"reaction data, see note"}],
      logflds: ["url", "penname", "penid", "ctmid"],
      queries: [{q:[{f:"ctmid"}, {f:"modified", dir:"desc"}]},
                {q:[{f:"ctmid"}, {f:"penid"}, {f:"modified", dir:"desc"}]}]},
        // rurl/url:
        //   rurl is always filled in with whatever was entered.  url may be
        //   the same, or a sanitized value for general reference.  The url
        //   may be updated later by the system as knowledge evolves.
        // details:
        //   - name: yum, activity, other
        //   - title: book, movie, video, music
        //   - artist: video, music
        //   - author: book
        //   - publisher: book
        //   - album: music
        //   - starring: movie
        //   - address: yum, activity
        //   - year: values like "80's" are ok"
        // srcrev is heavily utilized in different contexts:
        //   - if this membic is a Theme post (ctmid is filled in), srcrev
        //     holds the id of the original membic.
        //   - if this membic was created directly from another membic,
        //     srcrev holds the id of the membic this was created from.
        //   - negative srcrev values indicate special handling:
        //       -101: Future review (placeholder for later writeup)
        //       -202: Batch update (no longer supported)
        //       -604: Marked as deleted
        // cankey (canonical key): 
        //   alternate index based on collapsed review field info.  Can be
        //   used to group multiple membics for the same thing within a
        //   theme, or for search.  The value is maintained server-side for
        //   consistency.  Multiple membics with the same cankey/penid/ctmid
        //   are allowed but discouraged.  Should always have a value, but
        //   can end up empty if unreadable url.
        // svcdata:
        //   - picdisp: sitepic|upldpic|nopic (client setting).  For sitepics
        //     not over https, the server internally caches a lowres copy of
        //     the source image to serve over https.  Tracked in "ic" fields.
        //   - postctms: server written info on posted through themes.
        // reacdat:
        //   Server maintained reaction data from other users.  For example
        //   a user might mark the membic as helpful or remembered.  Or they
        //   might select from a scalar view of emoticons to rate it.  Or
        //   flag as inappropriate.

    {entity:"Overflow", descr:"extra preb membics", fields:[
        {f:"dbkind", d:"req string", c:"MUser or Theme"},
        {f:"dbkeyid", d:"req dbid", c:"id of source MUser or Theme"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}]},
        
    {entity:"MailNotice", descr:"Broadcast email tracking", fields:[
        {f:"name", d:"req unique string", c:"query access identifier"},
        {f:"subject", d:"string", c:"the email subject for ease of reference"},
        {f:"uidcsv", d:"idcsv", c:"MUser ids that were sent to"},
        {f:"lastupd", d:"isodate", c:"last recorded send"}]},
        
    //Content updated by cron job.  General reporting/history use.
    {entity:"ActivitySummary", descr:"Stats by profile/theme", fields:[
        {f:"refp", d:"req unique string", c:"e.g. MUSer1234 or Theme4567"},
        {f:"tstart", d:"req isod", c:"daily summary start time"},
        {f:"tuntil", d:"req isod", c:"daily summary end time"},
        {f:"reqbyid", d:"req int", c:"count of external requests via id"},
        {f:"reqbyht", d:"req int", c:"count of external requests via hashtag"},
        {f:"reqbypm", d:"req int", c:"count of external requests via params"},
        {f:"reqbyrs", d:"req int", c:"count of requests via RSS"},
        {f:"reqdets", d:"json", c:"dict of supplemental info, see note"},
        {f:"newmembics", d:"req int", c:"how many new membics were created"},
        {f:"edited", d:"req int", c:"how many existing membics were edited"},
        {f:"removed", d:"req int", c:"deleted if MUser, removed if Theme"}],
      queries:[{q:[{f:"refp"}, {f:"tuntil", dir:"desc"}]}]},
        //reqdets (request details dictionary):
        //  - How many of the requests were from known crawler programs
        //  - Map of known (signed in via cookie) users, with counts/names.
        //  - Map of referering urls with counts for each
        //  - Map of user agent strings with counts for each

    {entity:"ConnectionService", descr:"Supporting service auth", fields:[
        {f:"name", d:"req unique string", c:"service name"},
        {f:"ckey", d:"string", c:"key e.g. oauth1 consumer key"},
        {f:"secret", d:"string", c:"e.g. oauth1 consumer secret"},
        {f:"data", d:"text", c:"service-specific data"}],
      logflds: ["name"]}];
        

    function makeFieldDescriptionLookup (fds, aliasKey) {
        descrLookup = descrLookup || {};
        aliasKey = aliasKey || "";
        fds.forEach(function (fd) {
            var key = fd.dn;
            var abbrevIndex = key.indexOf("[");
            if(abbrevIndex >= 0) {
                key = key.slice(0, abbrevIndex); }
            descrLookup[key] = {name:key, aliasof:aliasKey, src:fd};
            //console.log(key + "(" + aliasKey + "): " + fd.h);
            if(fd.aliases) {
                makeFieldDescriptionLookup(fd.aliases, key); } });
    }


    function lookupKey (dts) {
        return Object.keys(descrLookup).find(function (lokey) {
            if(dts.indexOf(lokey) >= 0) {
                //console.log("lookupKey found " + dts + " key: " + lokey);
                return true; } });
    }


    //Return true if the given field description string contains the given
    //field description name, taking into acount abbrevs and aliases. 
    //Example: fieldIs("req isodate", "string") === true
    function fieldIs (fds, dts) {
        if(!descrLookup) {
            makeFieldDescriptionLookup(fieldDescriptors); }
        var dtsk = lookupKey(dts);
        if(!dtsk) {
            throw("Unknown field type description: " + dts); }
        //console.log("fieldIs testing for: " + dtsk);
        fds = fds.split(/\s/);
        return fds.find(function (fd) {
            var fdk = lookupKey(fd);
            //console.log("fieldIs comparing against: " + fdk);
            if(!fdk) {
                throw("Bad field description element: " + fd); }
            if(fdk === dtsk) {  //same top level field descriptor lookupKey
                return true; }
            var kob = descrLookup[fdk];
            if(kob.aliasof && kob.aliasof === dtsk) {
                return true; } });
    }


    return {
        fieldDescriptors: function () { return fieldDescriptors; },
        dataDefinitions: function () { return ddefs; },
        fieldIs: function (fdef, dts) { return fieldIs(fdef, dts); }
    };
}());

