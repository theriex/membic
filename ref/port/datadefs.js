/*jslint node, white, fudge */

//For porting to standard App Engine, queries are limited at most one
//non-equality field specification, and there are no join operations.
//Stored object instances are limited to a max size of 1mb.

module.exports = (function () {
    "use strict";

    var fieldDescriptors = [
        {dn:"priv[ate]", h:"authorized access only e.g. owner personal info"},
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
        {dn:"image", h:"opaque binary image data (max 1mb)"},
        {dn:"dbid", h:"long int db id translated to string for JSON"},
        {dn:"int", h:"low range integer value JavaScript can handle"}];
    var descrLookup = null;


    var ddefs = [ //data storage entity definitions
    {entity:"MUser", descr:"Membic User account.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"email", d:"priv req unique email"},
        {f:"phash", d:"priv req string"},
        {f:"status", d:"priv string", c:"Only Active may post",
         enumvals:["Pending", "Active", "Inactive", "Unreachable"]},
        {f:"mailbounce", d:"priv isodcsv", c:"latest bounce first"},
        {f:"actsends", d:"priv gencsv", c:"latest first isod;emaddr vals"},
        {f:"actcode", d:"priv string", c:"account activation code"},
        {f:"altinmail", d:"priv unique email", c:"alt mail-in address"},
        {f:"name", d:"string", c:"optional but recommended public name"},
        {f:"aboutme", d:"text", c:"optional description, website link etc."},
        {f:"hashtag", d:"unique string", c:"personal theme direct access"},
        {f:"profpic", d:"image", c:"used for theme, and coop posts"},
        {f:"cliset", d:"json", c:"dict of client settings, see note"},
        {f:"coops", d:"json", c:"coopid map, see note"},
        {f:"created", d:"isodate", c:"when the account was first created"},
        {f:"modified", d:"isod", c:"when account last modified"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}]},
        // cliset: {flags:{archived:ISO},
        //          embcolors:{link:"#84521a", hover:"#a05705"},
        //          maxPostsPerDay:1,
        //          ctkeys:{book:"keyword1, keyword2...",
        //                  movie:"keyword4, keyword2...",
        //                  ...} }
        //
        // coops: {"coopid":info, "coopid2":info2, ...}
        //  info: {lev:N, obtype:str, name:str, hashtag:str, description:str, 
        //         picture:idstr, keywords:CSV, inactive:str, 
        //         notices:[notice1, notice2..]}
        //    lev: -1 (following), 1 (member), 2 (moderator), 3 (founder).
        //         Any falsy value for lev means no association.
        //    obtype: "MUser" or "Coop"
        //    inactive: only included if the Coop is archived
        //    notice: {type:"application", lev:int, uid, uname, created:ISO,
        //             status:"pending"|"rejected", reason}
        // The coops data is cached supplemental data.  It is not authoritative.
        // See python process_membership, profile.js verifyMembership

    {entity:"Theme", descr:"A cooperative theme.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"name", d:"req string", c:"Human readable name"},
        {f:"name_c", d:"req unique string", c:"canonical name for match"},
        {f:"modhist", d:"isomod", c:"creation date and mod count"},
        {f:"modified", d:"isod", c:"when last updated"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"hashtag", d:"unique string", c:"optional one word name"},
        {f:"description", d:"text", c:"optional description, site link etc."},
        {f:"picture", d:"image", c:"used for theme display"},
        {f:"founders", d:"idcsv", c:"founding members"},
        {f:"moderators", d:"idcsv", c:"moderator members"},
        {f:"members", d:"idcsv", c:"standard members"},
        {f:"seeking", d:"idcsv", c:"member applications (member ids)"},
        {f:"rejects", d:"idcsv", c:"rejected applications (member ids)"},
        {f:"adminlog", d:"json", c:"latest first array of theme admin actions"},
        {f:"people", d:"json", c:"map of ids to user names for fast display"},
        {f:"cliset", d:"json", c:"client settings (like MUser)"},
        {f:"keywords", d:"gencsv", c:"custom theme keywords"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}]},

    {entity:"Membic", descr:"A URL with a reason why it's memorable.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"revtype", d:"req string", c:"book, movie, music...",
         enumvals:["book", "article", "movie", "video", "music", "yum",
                   "activity", "other"]},
        {f:"penid", d:"req dbid", c:"who wrote this membic"},
        {f:"ctmid", d:"req dbid", c:"Theme id, or 0 if source membic"},
        {f:"rating", d:"req int", c:"0-100"},
        {f:"srcrev", d:"req dbid", c:"source membic, see note"},
        {f:"cankey", d:"req string", c:"alt key, see note"},
        {f:"modified", d:"isod", c:"when last updated"},
        {f:"modhist", d:"isomod", c:"creationDate;modCount"},
        {f:"text", d:"text", c:"why this link is memorable"},
        {f:"keywords", d:"gencsv", c:"keywords for this membic"},
        {f:"svcdata", d:"json", c:"pic src, other info, see note"},
        {f:"revpic", d:"image", c:"pic, if uploaded"},
        {f:"imguri", d:"url", c:"external pic for membic"},
        {f:"icdata", d:"image", c:"secure relay ext pic cache data"},
        {f:"icwhen", d:"isodate", c:"when icdata last pulled"},
        {f:"dispafter", d:"isodate", c:"visibility queued until"},
        {f:"penname", d:"string", c:"author name for easy UI ref"},
        {f:"reacdat", d:"json", c:"reaction data, see note"},
        //which of these fields is are used depends on the type
        {f:"name", d:"string", c:"yum, activity, other"},
        {f:"title", d:"string", c:"book, movie, video, music"},
        {f:"url", d:"url", c:"canonical URL for item"},
        {f:"rurl", d:"url", c:"original read URL"},
        {f:"artist", d:"string", c:"video, music"},
        {f:"author", d:"string", c:"book"},
        {f:"publisher", d:"string", c:"book"},
        {f:"album", d:"string", c:"music"},
        {f:"starring", d:"string", c:"movie"},
        {f:"address", d:"string", c:"yum, activity"},
        {f:"year", d:"string", c:"values like \"80's\" are ok"}],
      queries: [{q:[{f:"ctmid"}, {f:"modified", dir:"desc"}]},
                {q:[{f:"ctmid"}, {f:"penid"}, {f:"modified", dir:"desc"}]}]},
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
        //   are allowed but discouraged.
        // svcdata: 
        //   Client setting of picdisp:sitepic|upldpic|nopic. On update, the
        //   server writes a postctms dictionary field with info on the
        //   themes the membic was posted through to.
        // reacdat:
        //   Server maintained reaction data from other users.  For example
        //   a user might mark the membic as helpful or remembered.  Or they
        //   might select from a scalar view of emoticons to rate it.  Or
        //   flag as inappropriate.

    {entity:"Overflow", descr:"extra preb membics", fields:[
        {f:"dbkind", d:"req string", c:"MUser or Theme"},
        {f:"dbkeyid", d:"req dbid", c:"id of source MUser or Theme"},
        {f:"overcount", d:"req int", c:"overflow instance count"},
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
        {f:"created", d:"req int", c:"how many new membics were created"},
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
        {f:"data", d:"text", c:"service-specific data"}]}];
        

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

