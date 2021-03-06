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
        {dn:"adm[in]", h:"administrative access only e.g. activation codes"},
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
        {f:"cliset", d:"json", c:"dict of client settings (*1)"},
        {f:"perset", d:"priv json", c:"dict of personal settings (*2)"},
        {f:"themes", d:"json", c:"theme reference info (*3)"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}],
     cache:{minutes:2*60, manualadd:true}, //auth interactions
     logflds:["email", "name"]},
        //*1 client settings object
        //    flags:{archived:ISO},  //no new membics for theme if set
        //    mailins:"enabled",     //"disabled" if Mail-Ins not allowed
        //    audchgem:"enabled",    //"disabled" if no audience chg email
        //    sortby:"recency",      //"rating" if top rated first
        //    embcolors:{link:"#84521a", hover:"#a05705"},  //colors if embedded
        //    //maxPostsPerDay:1,   //prev max of 2
        //    //ctkeys: {book:"keyword1, keyword2..."},  //custom kwds by type
        //*2 personal settings object
        //    mshare: {<themeId or "profile">: <emaddrcsv>}
        //*3 themes references object indexed by themeid.  Profile
        //   references hava a 'P' prefix to avoid collisions e.g. "P2350".
        //   The themes references are for access convenience.  They are not
        //   authoritative and may be out of date.  Each ref object has
        //     name, hashtag, description, picture (idstr), keywords,
        //     archived:ISO
        //     lev: <-2:blocking (profile only), -1:following, 0:noassoc,
        //            1:member, 2:moderator, 3:founder>
        //     followmech: <"email" or "RSS">
        //     //notices: []  //not currently used, old membership mgmt
        //     //  type:"application", lev:int, uid, uname, created:ISO,
        //     //  status:"pending"|"rejected", reason}


    {entity:"Theme", descr:"A cooperative theme.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"name", d:"req string", c:"Human readable name (*1)"},
        {f:"name_c", d:"req unique string", c:"canonical name for match"},
        {f:"lastwrite", d:"isod", c:"latest membic/preb rebuild"},
        {f:"hashtag", d:"unique string", c:"optional one word name"},
        {f:"description", d:"text", c:"optional description, site link etc."},
        {f:"picture", d:"image", c:"used for theme display"},
        {f:"founders", d:"idcsv", c:"founding members"},
        {f:"moderators", d:"idcsv", c:"moderator members"},
        {f:"members", d:"idcsv", c:"standard members"},
        {f:"people", d:"json", c:"map of ids to user names for fast display"},
        {f:"cliset", d:"json", c:"client settings (like MUser)"},
        {f:"keywords", d:"gencsv", c:"custom theme keywords"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}],
     cache:{minutes:0},  //client cache for instance and pic is sufficient
     logflds:["name"]},
        //*1 bootstrap theme name is "Theme " + id of first founder


    {entity:"AdminLog", descr:"Administrative actions log.", fields:[
        {f:"letype", d:"req string", c:"log entry type, e.g. 'Theme'"},
        {f:"leid", d:"req dbid", c:"e.g. the dsId of the Theme"},
        {f:"lename", d:"string", c:"theme name for ease of reference"},
        {f:"adminid", d:"req dbid", c:"dsId of the MUser who took action"},
        {f:"adminname", d:"string", c:"name of the admin for readability"},
        {f:"action", d:"req string", c:"'Membership Change', 'Removed Membic'"},
        {f:"data", d:"text", c:"Arbitrary data value for action"},
        {f:"target", d:"string", c:"Affected entity type e.g. MUser, Membic"},
        {f:"targid", d:"dbid", c:"dsId of the affected entity"},
        {f:"targname", d:"string", c:"name of user or url of membic"},
        {f:"reason", d:"string", c:"text of why membic removed or whatever"}],
     cache:{minutes:0},  //not referenced singly
     logflds:["letype", "leid", "adminname", "action", "targid"]},


    {entity:"Membic", descr:"A URL with a reason why it's memorable.", fields:[
        {f:"importid", d:"dbid unique", c:"previous id from import data"},
        {f:"url", d:"url", c:"sanitized URL derived from rurl"},
        {f:"rurl", d:"url", c:"original read URL as entered by the user"},
        {f:"revtype", d:"req string", c:"book, movie, music...",
         enumvals:["book", "article", "movie", "video", "music", "yum",
                   "activity", "other"]},
        {f:"details", d:"json", c:"detail fields depending on type (*1)"},
        {f:"penid", d:"req dbid", c:"who wrote this membic"},
        {f:"ctmid", d:"req dbid", c:"Theme id, or 0 if source membic"},
        {f:"rating", d:"req int", c:"0 for no value, otherwise 1-100"},
        {f:"srcrev", d:"req dbid", c:"source membic or indicator (*2)"},
        {f:"cankey", d:"string", c:"alternative semi-key (*3)"},
        {f:"text", d:"text", c:"why this link is memorable"},
        {f:"keywords", d:"gencsv", c:"keywords for this membic"},
        {f:"svcdata", d:"json", c:"pic src, other info (*4)"},
        {f:"revpic", d:"image", c:"pic, if uploaded"},
        {f:"imguri", d:"url", c:"external pic for membic"},
        {f:"icdata", d:"image", c:"secure relay ext pic cache data"},
        {f:"icwhen", d:"isodate", c:"when icdata last pulled"},
        {f:"dispafter", d:"isodate", c:"visibility queued until"},
        {f:"penname", d:"string", c:"author name for easy UI ref"},
        {f:"reacdat", d:"json", c:"reaction data (*5)"}],
     cache:{minutes:0},  //only referenced directly for image data
     logflds: ["url", "penname", "penid", "ctmid"],
     queries: [{q:[{f:"ctmid"}, {f:"modified", dir:"desc"}]},
               {q:[{f:"ctmid"}, {f:"penid"}, {f:"modified", dir:"desc"}]}]},
        //*1 details fields as used by each revtype:
        //   - name: yum, activity, other
        //   - title: book, movie, video, music
        //   - artist: video, music
        //   - author: book
        //   - publisher: book
        //   - album: music
        //   - starring: movie
        //   - address: yum, activity
        //   - year: values like "80's" are ok"
        //*2 srcrev is heavily utilized in different contexts:
        //   - if this membic is a Theme post (ctmid is filled in), srcrev
        //     holds the id of the original membic.
        //   - if this membic was created directly from another membic,
        //     srcrev holds the id of the membic this was created from.
        //   - negative srcrev values indicate special handling:
        //       -101: Future review (placeholder for later writeup)
        //       -202: Batch update (no longer supported)
        //       -604: Marked as deleted
        //*3 cankey (canonical key):
        //   alternate index based on collapsed review field info.  Can be
        //   used to group multiple membics for the same thing within a
        //   theme, or for search.  The value is maintained server-side for
        //   consistency.  Multiple membics with the same cankey/penid/ctmid
        //   are allowed but discouraged.  Should always have a value, but
        //   can end up empty if unreadable url.
        //*4 svcdata fields for both MUser and Theme membics:
        //     - picdisp: sitepic|upldpic  ("nopic" no longer used)
        //       Client setting. For sitepic, the server may cache a lowres
        //       copy of the source image in the icdata field to avoid
        //       degraded client server connections over https.
        //   MUser svcdata fields:
        //     - postctms: [] zero or more theme postnotes
        //           postnote: {ctmid, name, revid}
        //     - urlreader: {name: primary reader module name (e.g. "readurl")
        //                   status: reading|finished,
        //                   result: success|partial|failure,
        //                   merge: unreadonly|overwrite,
        //                   log: [calldet, calldet2...]}
        //           calldet:{start, end, msg}
        //       A specific API reader may failover to calling general
        //       reader processing, but that is situation specific and still
        //       logged within the primary reader info listing.
        //     - mshares: csv of userIds this Membic has been mailed to via
        //       extended membic share.  The csv is updated server side when
        //       the emails is sent.  Any signed-in user can share, so the
        //       csv reflects all recipients, whether the share was done by
        //       the author or someone else.
        //   Theme svcdata fields:
        //     - tdat: {disp:active|removed, user:dsId, reason:txt, ts:ISO}
        //       An empty tdat is equivalent to tdat.disp:active.  If user
        //       is src membic author, then can switch from removed back to
        //       active, provided the src membic is not marked as deleted.
        // *5 reacdat:
        //   Server maintained reaction data from other users.  For example
        //   a user might mark the membic as helpful or remembered.  Or they
        //   might select from a scalar view of emoticons to rate it.  Or
        //   flag as inappropriate.


    {entity:"Overflow", descr:"extra preb membics", fields:[
        {f:"dbkind", d:"req string", c:"MUser or Theme"},
        {f:"dbkeyid", d:"req dbid", c:"id of source MUser or Theme"},
        {f:"preb", d:"json", c:"membics for display w/opt overflow link"}],
     cache:{minutes:0},  //not commonly referenced
     logflds:["dbkind", "dbkeyid"]},
        

    //This is used to prevent duplicate sends of things like daily summaries.
    //Broadcast email is completely unreliable, and it should be assumed to
    //be routed directly to spam folders.  Only if the recipient has previously
    //flagged a message as not being spam (possibly multiple times) will there
    //be any hope of the recipient ever seeing it.
    {entity:"MailNotice", descr:"Broadcast email tracking", fields:[
        {f:"name", d:"req unique string", c:"query access identifier"},
        {f:"subject", d:"string", c:"the email subject for ease of reference"},
        {f:"uidcsv", d:"idcsv", c:"MUser ids that were sent to"},
        {f:"lastupd", d:"isodate", c:"last recorded send"}],
     cache:{minutes:0},  //not generally referenced
     logflds:["name"]},


    {entity:"SentMail", descr:"Log of server sent mail messages", fields:[
        {f:"sender", d:"req email", c:"from address"},
        {f:"replyto", d:"email", c:"reply-to address"},
        {f:"recip", d:"req email", c:"to address"},
        {f:"subj", d:"req string", c:"subject of email (possibly truncated)"}],
     cache:{minutes:0},  //not generally referenced
     logflds:["sender", "replyto", "recip", "subj"]},


    //Audience relationships are not updated transactionally.  Normally they
    //are discovered through periodic sweeps or email processing.  Audience
    //entries can be updated directly by those managing their audiences.
    {entity:"Audience", descr:"Accumulated follower relationships", fields:[
        {f:"uid", d:"req dbid", c:"MUser id of follower"},
        {f:"name", d:"string", c:"latest seen name for ease of reference"},
        {f:"srctype", d:"string", c:"dsType of source: Theme or MUser"},
        {f:"srcid", d:"req dbid", c:"dsId of source"},
        {f:"lev", d:"int", c:"same as MUser.themes info lev"},
        {f:"mech", d:"string", c:"'email' or 'RSS'"},
        {f:"blocked", d:"string", c:"authId|timestamp when email disabled"}],
     cache:{minutes:0},  //not frequently referenced
     logflds:["srctype", "srcid", "name", "uid", "lev", "mech"],
     queries:[{q:[{f:"srctype"}, {f:"srcid"}]}]},
     
        
    //Content updated by cron job.  General reporting/history use.
    {entity:"ActivitySummary", descr:"Stats by profile/theme", fields:[
        {f:"refp", d:"req unique string", c:"e.g. MUser1234 or Theme4567"},
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
     cache:{minutes:0},  //not generally referenced
     logflds:["refp", "tstart", "tuntil"],
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
     cache:{minutes:4*60},  //small instances, minimum change, used a lot
     logflds:["name"]}];
        

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

