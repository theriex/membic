/*global window, confirm, app, jt, google, document */

/*jslint browser, white, fudge, for, long */

app.membic = (function () {
    "use strict";

    var addmem = null;  //The new membic being added
    var savind = "";    //Ongoing save indicator
    var expandedMembics = {};  //currently expanded membics (by src membic id)
    var formElements = null;  //forward declare to avoid circular func refs
    var rto = null;  //input reaction timeout
    var apso = {apto:null, started:{}};   //automated processing status

    // Membic Type Definition guidelines:
    // 1. Too many fields makes entry tedious.  The goal is adequate
    //    identification, not full database info.
    // 2. Default keywords should be widely applicable across the possible 
    //    universe of membics for a type.  They describe perceptions, not
    //    classification (e.g. "Funny" rather than "Comedy").
    // 3. If something has a subkey, keep the primary key prompt
    //    short so it doesn't cause ugly formatting.
    var membicTypes = [
        { type: "book", plural: "books", img: "TypeBook50.png",
          keyprompt: "Title",
          key: "title", subkey: "author",
          fields: [ "publisher", "year" ],
          dkwords: [ "Fluff", "Kid Ok", 
                     "Funny", "Emotional", 
                     "Gripping", "Informational" ] },
        { type: "article", plural: "articles", img: "TypeArticle50.png",
          keyprompt: "Title",
          key: "title", //subkey
          fields: [ "author", "publisher", "year" ],
          dkwords: [ "Newsworthy", "Informative", 
                     "Eloquent", "Educational" ] },
        { type: "movie", plural: "movies", img: "TypeMovie50.png",
          keyprompt: "Movie name",
          key: "title", //subkey
          fields: [ "year", "starring" ],
          dkwords: [ "Classic", "Kid Ok",
                     "Escapism", "Emotional",
                     "Stunning", "Informational" ] },
        { type: "video", plural: "videos", img: "TypeVideo50.png",
          keyprompt: "Title",
          key: "title", //subkey
          fields: [ "artist" ],
          dkwords: [ "Uplifting", "Kid Ok",
                     "Funny", "Emotional",
                     "Artistic", "Educational" ] },
        { type: "music", plural: "music", img: "TypeSong50.png",
          keyprompt: "Title",
          key: "title", subkey: "artist",
          fields: [ "album", "year" ],
          dkwords: [ "Chill", "Social",
                     "Office", "Travel",
                     "Workout", "Dance" ] },
        { type: "yum", plural: "yums", img: "TypeYum50.png",
          keyprompt: "Name of restaurant, dish, or drink",
          key: "name", //subkey
          fields: [ "address" ],
          dkwords: [ "Traditional", "Innovative",
                     "Inexpensive", "Expensive", 
                     "Quiet", "Loud" ] },
        { type: "activity", plural: "activities", img: "TypeActivity50.png",
          keyprompt: "Name of place or event",
          key: "name", //subkey
          fields: [ "address" ],
          dkwords: [ "Indoor", "Outdoor", 
                     "Artistic", "Athletic",
                     "Educational", "Kid Ok" ] },
        { type: "other", plural: "other membics", img: "TypeOther50.png",
          keyprompt: "Name or title", 
          key: "name", //subkey
          fields: [],
          dkwords: [ "Professional", "Personal",
                     "Hobby", "Research" ] } ];


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    //People can paste in all kinds of crap.  Don't let it crash the display.
    function htmlSafeURL (url) {
        var xi = url.search(/["<>]/g);
        if(xi >= 0) {  //have bad chars in url
            var hi = url.search(/http/i);
            if(hi >= 0) {
                if(hi < xi) {
                    url = url.slice(hi, xi); }
                else {
                    url = url.slice(hi);
                    xi = url.search(/["<>]/g);
                    if(xi >= 0) {
                        url = url.slice(0, xi); } } }
            else {  //no "http" in url, take the first clean part
                url = url.slice(0, xi); } }
        return url;
    }


    //Return a display title for the membic.
    function titleForMembic (membic) {
        //normally a membic will have a title or name filled in
        if(membic.details && (membic.details.title || membic.details.name)) {
            return membic.details.title || membic.details.name; }
        //if just created, membic might have an rurl but no details yet.
        if(membic.rurl) {
            return htmlSafeURL(membic.rurl); }
        jt.log("Membic " + membic.dsId + " No title, name or rurl.");
        return "No Title Available";
    }


    function linkForMembic (membic) {
        //ok to have a membic with no url provided details specfied.  If no
        //details, that will be evident from the title, so no need to log.
        var url = "";
        if(!url && membic.url) {  //have normalized url from reader
            url = membic.url; }
        if(!url && membic.rurl) {  //have interim url, waiting for reader
            url = htmlSafeURL(membic.rurl); }
        if(url && !url.toLowerCase().startsWith("http")) {
            url = "http://" + url; }
        return url;
    }


    function membicReferenceText (membic) {
        var reft = membic.url;
        if(!reft && membic.details) {
            reft = membic.details.title || membic.details.name; }
        if(!reft) {
            reft = membic.text; }
        return reft;
    }


    function myMembic (membic) {
        var prof = app.login.myProfile();
        if(prof && prof.dsId === membic.penid) {
            return true; }
        return false;
    }


    //A theme post membic does not have all the same information as a source
    //membic.  It's essentially a copy for bookkeeping purposes.  Editing a
    //source membic from the theme seems like it could be convenient, but
    //in practice tends to be confusing both in UI and code.
    function mayEdit (membic) {
        if(myMembic(membic) && !membic.ctmid) {
            return true; }
        return false;
    }


    function safeInnerText (tagid) {
        var elem = jt.byId(tagid);
        if(!elem) {
            return ""; }
        return elem.innerText;
    }


    //Lines starting with an all caps tag (e.g. "SECTION: ") are collapsed
    //individually.  For display, newlines are converted to "<br>" tags, but
    //the text passed in to here has \n delimiters.
    function collapseText (text, expanded) {
        if(expanded) {
            return text; }
        var lines = text.split("\n");
        lines = lines.map(function (line) {
            if(line.match(/[A-Z0-9\s]{3,}:\s/)) {
                return jt.ellipsis(line, 450); }
            return line; });
        text = lines.join("\n");
        text = jt.ellipsis(text, 1400);
        return text;
    }


    function editableWithPlaceholder (cdx, idbase, placetxt) {
        return {cla:idbase, id:idbase + cdx, contentEditable:"true",
                "data-placetext":placetxt,
                //need to check for input so form can react to change text
                oninput:jt.fs("app.membic.formInput(" + cdx + ")"),
                onfocus:jt.fs("app.membic.placeholdercheck(event)"),
                onblur:jt.fs("app.membic.placeholdercheck(event)")};
    }


    //The profile membic dsId is used to indicate membic expansion.  The
    //membic display is expanded or condensed across the profile and all
    //themes to make it easier to track what you are focusing on.
    function membicExpId (membic) {
        var expid = membic.dsId;
        if(membic.ctmid) {
            expid = membic.srcrev; }
        return expid;
    }


    function clearCachedThemesForMembic (membic) {
        var postctms = membic.svcdata.postctms || [];
        postctms.forEach(function (pn) {
            app.refmgr.uncache("Theme", pn.ctmid); });
    }


    //If no mid, then this assumes a new membic was just added and that it
    //is therefore the first element in mbcs.
    function findMembic(mid, mbcs) {
        if(!mid) {  //assume a new membic was just added
            return mbcs[0]; }
        return mbcs.find((mbc) => mbc.dsId === mid);
    }


    //The caller is responsible for clearing any cached Themes that no
    //longer contain the membic being saved.  On return, this will display
    //the user profile, with the membic open for further editing.  The top
    //form allows for adding a new membic from anywhere on the site, but you
    //can only edit from your profile display.  Any calls received before a
    //call is finished are ignored, in order to avoid any possibility of
    //multiple events causing the addition of a duplicate new membic.  If
    //that results in the site seizing up due to a previous call never
    //returning, that is still far preferable to duplicate data.
    function saveMembic (logmsg, savemembic, contf, failf) {
        jt.log("saveMembic logmsg: " + logmsg);
        if(savind) {  //default call will retry. Debounce extra event calls
            return jt.log("saveMembic in progress, ignoring spurious call"); }
        savind = new Date().toISOString();  //indicate we are saving
        savemembic.dsType = "Membic";  //verify for param serialization
        var url = app.login.authURL("/api/membicsave");
        jt.call("POST", url, app.refmgr.postdata(savemembic),
                //The updated MUser is always the first item returned,
                //followed by the display context Theme if specified.
                function (pots) {  //profile or/and theme object(s)
                    savind = "";
                    pots.forEach(function (pot) {  //deserialize so ready to use
                        app.refmgr.deserialize(pot); });
                    var updmbc = findMembic(savemembic.dsId, pots[0].preb);
                    clearCachedThemesForMembic(updmbc);
                    pots.forEach(function (pot) {  //update all given data
                        app.refmgr.put(pot); });
                    app.pcd.fetchAndDisplay(pots[0].dsType, pots[0].dsId,
                                           {go:updmbc.dsId});
                    if(contf) {
                        contf(updmbc); } },
                function (code, errtxt) {
                    savind = "";
                    jt.log("saveMembic " + savemembic.dsId + " " + code + ": " +
                           errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("membic.saveMembic"));
    }


    function membicDetailsMissing (membic) {
        if(!mayEdit(membic)) {
            return false; }  //can't change, so don't try and read.
        if(!membic.rurl) {
            return false; }  //nothing to read, so don't try.
        if(!membic.imguri && membic.details.title === membic.rurl) {
            return true; }
        return false;
    }


    //Membics can be added server side (via mail-in processing) without
    //having gone through a url reader pass.  The url read happens in the
    //background when creating a new membic interatively.
    function membicDetailsUnread (membic) {
        if(!mayEdit(membic)) {
            return false; }  //can't change, so don't try and read.
        if(!membic.rurl) {
            return false; }  //nothing to read, so don't try.
        if(membic.svcdata && membic.svcdata.urlreader &&
           Object.keys(membic.svcdata.urlreader).length > 0) {
            return false; }  //reader ran at least once before.
        //Older membics might not have reader information logged.
        if(membic.imguri) {
            return false; }  //reader filled in the img
        if(membic.details && (membic.details.artist ||
                              membic.details.author ||
                              membic.details.publisher ||
                              membic.details.album ||
                              membic.details.starring ||
                              membic.details.address ||
                              membic.details.year)) {
            return false; }  //reader filled more than title/name
        return true;
    }


    //Called from readerFinish.  Avoids possible write collision timing
    //between user save and reader save.
    function mergeURLReadInfoIntoSavedMembic (membic) {
        if(savind) {  //currently saving, wait and retry
            return app.fork({descr:"Merge Details " + membic.rurl,
                             ms:2000,
                             func:function () {
                                 mergeURLReadInfoIntoSavedMembic(membic); }}); }
        //Not currently saving, find target membic in profile and merge.
        //The rurl must match or the merge should not be done.  There can be
        //multiple membics with the same rurl, so the dsId must also match.
        var tm = app.login.myProfile()
            .preb.find((cand) => ((cand.rurl === membic.rurl) &&
                                  ((!cand.dsId) ||
                                   (cand.dsId === membic.dsId))));
        if(!tm) {
            jt.log("mergeURLReadInfoIntoSavedMembic did not find a matching " +
                   "membic to update for Membic " + membic.dsId + " rurl: " +
                   membic.rurl);
            return; }
        if((membic.svcdata.urlreader.merge !== "overwrite") &&
           (!membicDetailsUnread(tm))) {
            jt.log("mergeURLReadInfoIntoSavedMembic not merging Membic " +
                   membic.dsId + " since details were already read.");
            return app.membic.toggleMembic(-1, "unchanged", tm); }
        tm.url = membic.url || membic.rurl;
        tm.details = membic.details || {};
        tm.imguri = membic.imguri || tm.imguri || "";
        tm.revtype = membic.revtype || "article";
        tm.rating = membic.rating || ratmgr.rati.dfltv;
        tm.svcdata = tm.svcdata || {};
        tm.svcdata.urlreader = membic.svcdata.urlreader;
        saveMembic("mergeURLReadInfoIntoSavedMembic", tm, function (membic) {
            //This is called while the display is being rebuilt.  If the
            //reader ran in the background while the membic was collapsed
            //(e.g. mail-in), then open the membic to show it was changed
            //and allow the user to check the details.  If they clicked the
            //Refetch button, then leave it open.
            app.membic.toggleMembic(-1, "expandedpostsave", membic); });
    }


    //Return a reader appropriate for the given URL.  Looking forward to the
    //day when a link title and image becomes standard web protocol.  Bonus
    //points for detail info like author/artist, address etc.
    function readerModuleForURL (url) {
        //Site notes:
        //  - YouTube has an API, but it fails frequently due to limits on
        //    the number of calls.  Standard reader works much better.
        //  - Netflx retired their online data catalog 08apr14.
        //  - Amazon has an API, but it requires enough site traffic to
        //    sustain an advertising relationship.
        //Vimeo doesn't want to provide any info about their videos except
        //through their API.
        if(url.toLowerCase().indexOf("vimeo.") > 0) {  //https://vimeo.com/id
            return "jsonapi"; }
        return "readurl";
    }


    //A membic starts from the rurl field being filled out, then the url
    //reader fills out the url field with a canonical value.  The rurl is
    //not used for display, it is only for reference and reader processing.
    //If the membic was not previously saved, it is preferable to have the
    //reader fill in the info directly into the working membic object so it
    //is immediately available in the display.  If the membic already
    //exists, then the reader should not disturb the current data being
    //worked with until after it has completed and the data is being merged.
    function startReader (membic, overwrite) {
        if(membic.dsId) {
            membic = JSON.parse(JSON.stringify(membic)); }
        var readername = readerModuleForURL(membic.rurl);
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.urlreader = membic.svcdata.urlreader || {};
        var reader = membic.svcdata.urlreader;
        reader.name = readername;
        reader.status = "reading";
        reader.result = "partial";
        reader.merge = "unreadonly";  //reset to default each time
        if(overwrite) {
            reader.merge = "overwrite"; }
        reader.log = reader.log || [];  //could be a log from a previous read
        reader.log.push({start:new Date().toISOString()});
        app.fork({descr:"app." + readername + ": " + membic.rurl, ms:100,
                  func:function () {
                      app[readername].getInfo(membic, membic.rurl); }});
    }


    //If the account isn't active yet, replace the new membic form with 
    //a message to activate the account.
    function verifyMayPost () {
        var authobj = app.login.authenticated();
        if(authobj && authobj.status === "Active") {
            return; }  //ready to post membics
        jt.out("newmembicdiv", jt.tac2html(
            ["form", {id:"newmembicform"},  //same form so same CSS
             [["div", {cla:"nmformlinediv"},
               [["label", {fo:"actcin", title:"Activation Code"}, "code"],
                ["input", {type:"text", id:"actcin", //no size, use CSS
                           placeholder:"Paste Activation Code from email",
                           required:"required",
                           onchange:jt.fs("app.membic.actcode(event)")}]]],
              ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
              ["div", {cla:"nmformlinediv"},
               ["div", {id:"ambuttonsdiv"},
                [["a", {href:"#codehelp", title:"Activation Code Help",
                        onclick:jt.fs("app.login.actCodeHelp()")},
                  "no code?"],
                 ["button", {type:"submit"}, "Activate Account"]]]]]]));
        jt.on("newmembicform", "submit", app.membic.actcode);
    }


    //Return the image src to be used in the membic display.  By default the
    //image provided by the site, or blank.  If an image has been uploaded,
    //then use that as specified.
    function membicImgSrc (membic) {
        var imgsrc = app.dr("img/blank.png");
        if(membic.svcdata && membic.svcdata.picdisp === "upldpic") {
            var cb = jt.enc(membic.svcdata.picchgt || membic.modified);
            imgsrc = "/api/obimg?dt=Membic&di=" + membic.dsId + "&cb=" + cb; }
        else if(membic.imguri) {
            imgsrc = "/api/imagerelay?membicid=" + membic.dsId; }
        return imgsrc;
    }


    function mdfs (mgrfname, ...args) {
        mgrfname = mgrfname.split(".");
        return jt.fs("app.membic.managerDispatch('" + mgrfname[0] + "','" +
                     mgrfname[1] + "'" + app.paramstr(args) + ")");
    }


    function fdfs (formfname, ...args) {
        formfname = formfname.split(".");
        return jt.fs("app.membic.formDispatch('" + formfname[0] + "','" +
                     formfname[1] + "'" + app.paramstr(args) + ")");
    }


    //Check the values of the keys in the source object against those in the
    //comparison object.  Return true if they are all equal.  The cmp object
    //may have additional keys not found in the src.
    function objKVEq (src, cmp) {
        return Object.keys(src).every((key) => src[key] === cmp[key]);
    }


    //Some functionality overlap with useract.py prep_simple_html but for
    //different purposes.  Here we are converting back to text in order to
    //handle common pasting issues.
    function fixCommonTextAnnoyances (txt) {
        //Firefox 77.0 separates multi-line input into divs with no attrs
        //<br></div> -> </div> to avoid creating double line breaks
        txt = txt.replace(/<br\/?>\s*<\/div>/g, "</div>");
        //<div>whatever</div> -> whatever\n
        txt = txt.replace(/<\/div>(.*?)<\/div>/g, "$1\n");
        //# Convert any remaining <br> into \n
        txt = txt.replace(/<br\/?>/g, "\n");
        //txt should now be normalized with all newlines as \n
        var wc = {ft:"", collapsing:false, lines:txt.split("\n")};
        wc.lines.forEach(function (line, idx) {
            if(!wc.collapsing && line && (idx + 2 < wc.lines.length) &&
               wc.lines[idx + 1] && wc.lines[idx + 2]) {
                wc.collapsing = true; }  //2+ lines with hard breaks
            if(!line || (line && (idx + 1 < wc.lines.length) &&
                         !wc.lines[idx + 1])) {
                wc.collapsing = false; } //paragraph resets collapse
            if(wc.collapsing) {
                wc.ft += line + " "; }
            else {
                wc.ft += line + "\n"; } });
        return wc.ft;
    }


    var savemgr = {
        //If anything has been edited, return true.
        membicEdited: function (cdx, membic) {
            var changed = [];
            Object.keys(formElements).forEach(function (key) {
                //If checking before the display has stabilized, things can
                //crash from references not being found.  Treat as not changed.
                try {
                    if(formElements[key].changed(cdx, membic)) {
                        changed.push(key); }
                } catch (ignore) {} });
            changed = changed.join(",");
            jt.log("membicEdited: " + changed);
            return changed; },
        //Update the changed membic elements and call to save.
        updateMembic: function (cdx) {
            jt.out("dlgbsmsgdiv" + cdx, "");
            var bhtml = jt.byId("dlgbsbdiv" + cdx).innerHTML;
            jt.out("dlgbsbdiv" + cdx, "Saving...");
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var updm = {dsType:"Membic", dsId:membic.dsId};
            Object.keys(formElements).forEach(function (key) {
                var chgval = formElements[key].changed(cdx, membic);
                if(chgval) {
                    formElements[key].write(chgval, updm, membic); } });
            if(updm.details) {  //updating details, keep existing detail fields
                var detflds = ["title", "name", "artist", "author", "publisher",
                               "album", "starring", "address", "year"];
                detflds.forEach(function (df) {
                    if(!updm.details.hasOwnProperty(df) &&  //not set or cleared
                       membic.details[df]) {
                        updm.details[df] = membic.details[df]; } }); }
            clearCachedThemesForMembic(membic);  //theme post maybe removed
            jt.log("updateMembic: " + JSON.stringify(updm));
            //Redisplay closed on successful completion.  If the update changed
            //the title or text, redisplaying closed is intuitive and smooth.
            //If the update changed other things, redisplaying closed still
            //provides a sense of confirmation of updated info on re-expansion.
            //If an error occurs, leave expanded with message.
            saveMembic("updateMembic", updm,
                       function (srcmembic) {
                           app.membic.toggleMembic(-1, "closed", srcmembic); },
                       function (code, txt) {
                           jt.out("dlgbsmsgdiv" + cdx, "Save failed " + code +
                                  ": " + txt);
                           jt.out("dlgbsbdiv" + cdx, bhtml);
                           savemgr.errorRecovery(code, txt, cdx); }); },
        errorRecovery: function (ignore /*code*/, errtxt, cdx) {
            var matches = errtxt.match(/rchived\sTheme\s(\S+)/);
            if(matches) {
                return savemgr.fixArchivedThemePost(matches, cdx); }
            matches = errtxt.match(
                    /MUser\d+\supdate\sreceived\soutdated\sversion\scheck/);
            if(matches) {
                return savemgr.fixStaleUserCache(cdx); }
            jt.log("savemgr.errorRecovery no matching automatic recovery"); },
        fixArchivedThemePost: function (matches, cdx) {
            //Note theme archived in profile MUser.themes
            var tid = matches[1];
            var authobj = app.login.authenticated();
            var prof = app.login.myProfile();
            var uti = prof.themes[tid];
            var association = app.theme.nameForLevel(uti.lev);
            var data = jt.objdata(
                {an:authobj.email, at:authobj.token, aot:"Theme", aoi:tid,
                 pid:prof.dsId, assoc:association, fm:uti.followmech});
            jt.call("POST", app.dr("/api/associate"), data,
                    function (objs) {  //first object is update profile
                        app.refmgr.put(app.refmgr.deserialize(objs[0]));
                        tpmgr.themepost(cdx, "remove", tid); },
                    function (code, errtxt) {
                        jt.log("membicSaveErrorRecovery associate " + code +
                               ": " + errtxt); }); },
        fixStaleUserCache: function (cdx) {
            var errmsgdiv = jt.byId("dlgbsmsgdiv" + cdx);
            errmsgdiv.innerHTML = errmsgdiv.innerHTML + "<br/>" +
                "Reloading user account to synchronize version info.";
            var prof = app.login.myProfile();
            var rdf = function () {
                var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
                app.startParams.go = membic.dsId;  //return to this membic
                app.login.verifyUserInfo(); };
            app.refmgr.serverUncache(prof.dsType, prof.dsId, rdf, rdf); }
    };


    //Mark the given membic as deleted, which will automatically trigger
    //removal of any corresponding theme posts.  There is no undelete, but
    //for testing it is possible to accomplish manually:
    //  - find the Membic in the db and setting its srcrev to 0
    //  - find the MUser for the membic and setting their preb to NULL
    //  - find all themes the membic was posted to and set their preb to NULL
    //  - restart the server to clear the cache
    //  - sign in as an admin and run api/prebsweep
    //Deleted membics are kept around because it helps with resolving log
    //references and general integrity verification.  An undelete/recover
    //option can possibly be supported later if it becomes a need.
    function markMembicDeleted (cdx) {
        var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
        var atps = "";
        if(membic.svcdata.postctms && membic.svcdata.postctms.length) {
            atps = " and associated theme posts"; }
        var confmsg = "Permanently delete this membic" + atps + "?";
        if(!confirm(confmsg)) {
            return; }
        jt.out("dlgbsmsgdiv" + cdx, "");
        var bhtml = jt.byId("dlgbsbdiv" + cdx).innerHTML;
        jt.out("dlgbsbdiv" + cdx, "Deleting...");
        clearCachedThemesForMembic(membic);
        var updm = {dsType:"Membic", dsId:membic.dsId, srcrev:"-604"};
        saveMembic("markMembicDeleted", updm,
            function (delmem) {
                app.membic.toggleMembic(-1, "closed", delmem);
                app.statemgr.redispatch(); },  //redraw content
            function (code, txt) {
                jt.out("dlgbsmsgdiv" + cdx, "Delete failed " + code + ": " +
                       txt);
                jt.out("dlgbsbdiv" + cdx, bhtml); });
    }


    //Return a copy the existing svcdata field values from the source membic.
    //Helpful for not clobbering one field when updating another.
    function copySvcData (membic) {
        var sdfs = ["picdisp", "postctms", "urlreader"];
        var cpsd = {};
        if(membic.svcdata) {
            sdfs.forEach(function (sdf) {
                var sdv = membic.svcdata[sdf];
                if(sdv) {
                    cpsd[sdf] = JSON.parse(JSON.stringify(sdv)); } }); }
        return cpsd;
    }


    function exposeTags (text) {
        //expose all html tags
        text = text.replace(/<(\/?)([^>]*)>/g, function (ignore, p1, p2) {
            p1 = p1 || "";
            return "&lt;" + p1 + p2 + "&gt;"; });
        //replace newlines with <br/> so they don't disappear
        text = text.replace(/\n/g, "<br/>");
        return text;
    }


    var sharemgr = {
        //Thought about adding membic share button to create your own membic
        //from an existing one, but that adds complexity, would likely be of
        //very limited use, and detract from the external nature of sharing.
        //To make a membic off an existing membic you can always use the
        //mail share and mail it in.
        membicShareHTML: function  (cdx, membic) {
            var subj = membic.text;
            var body = linkForMembic(membic) || "No URL available";
            var mlink = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
                jt.dquotenc(body) + "%0A%0A";
            var tac = app.layout.shareButtonsTAC(
                {url:body,
                 title:subj,
                 mref:mlink,
                 socmed:["tw", "fb", "em"]});
            if(myMembic(membic)) {  //author can do extended email sharing
                tac.push(app.layout.shareButtonsTAC(
                    {mplusfstr:mdfs("sharemgr.openMailDialog", cdx),
                     socmed:["mp"]})[0]); }
            else {  //someone else's membic, allow responding to it
                tac.push(["span", {cla:"sharerespsepspan"}, "&nbsp;|&nbsp;"]);
                tac.push(sharemgr.responseButtonHTML(cdx, membic));
                tac.push(["div", {id:"mcmtdiv" + cdx}]); }
            return jt.tac2html(tac); },
        //Provide descriptive information for human reference and for use by
        //mail forwarding which works off the membic dsId.  Place dsId in
        //middle to minimize it being accidentally edited.
        emquoteMembicFields: function (membic) {
            var body = "";
            var qflds = [
                {field:"title",
                 val:(membic.details.title || membic.details.name)},
                {field:"url", val:(membic.url || membic.rurl)},
                "text", "dsId", "penname"];
            qflds.forEach(function (fld) {
                if(typeof fld === "string") {
                    fld = {field:fld, val:membic[fld]}; }
                fld.val = fld.val || "";
                fld.val = fld.val.replace(/\r?\n|\r/g, " ");
                fld.val = jt.ellipsis(fld.val, 300);
                body += "\n> [" + fld.field + "] " + fld.val; });
            return body; },
        responseButtonHTML: function (cdx, membic) {
            var subj = "Re: " + jt.ellipsis(membicReferenceText(membic), 75);
            var body = sharemgr.emquoteMembicFields(membic);
            var mlink = "mailto:forwarding@membic.org?subject=" +
                jt.dquotenc(subj) + "&body=" + "%0A%0A" + jt.dquotenc(body) +
                "%0A";
            var linkattrs = {cla:"linkbutton", href:mlink};
            var prof = app.login.myProfile();
            var ctxobj = app.pcd.getDisplayContext().actobj.contextobj;
            var assoc = app.theme.profassoc(ctxobj.dsType, ctxobj.dsId);
            if(!prof) {
                linkattrs = {cla:"linkbutton linkbutdis",
                             href:"#signInToRespond",
                             onclick:mdfs("sharemgr.resperr", cdx, "signin")}; }
            else if(!assoc.lev) {  //undefined or not following
                linkattrs = {cla:"linkbutton linkbutdis",
                             href:"#followToRespond",
                             onclick:mdfs("sharemgr.resperr", cdx, "follow")}; }
            return jt.tac2html(["a", linkattrs, "Send&nbsp;Comment"]); },
        resperr: function (cdx, errt, ack) {
            var actobj = app.pcd.getDisplayContext().actobj;
            switch(errt) {
            case "signin":
                jt.out("mcmtdiv" + cdx, "Sign In to comment");
                if(app.solopage()) {
                    jt.out("mcmtdiv" + cdx, jt.tac2html(
                        ["a", {href:app.docroot,
                               onclick:jt.fs("window.open('" + app.docroot +
                                             "')")},
                         "Sign In to comment"])); }
                break;
            case "follow":
                if(!ack) {
                    jt.out("mcmtdiv" + cdx, jt.tac2html(
                        ["a", {href:"#Follow",
                               onclick:mdfs("sharemgr.resperr", cdx, "follow",
                                            true)},
                         "To comment, follow " + actobj.contextobj.name])); }
                else {  //clicked to follow
                    jt.out("mcmtdiv" + cdx, "");
                    window.scrollTo(0, 0);
                    app.pcd.managerDispatch("stgmgr", "toggleSettings"); }
                break;
            default:
                jt.out("sharemgr.resperr unknown errt: " + errt); } },
        openMailDialog: function (cdx) {
            var html = jt.tac2html(
                ["div", {cla:"mailsharediv"},
                 [["div", {id:"mshaddrsdiv"},
                   sharemgr.mailShareHTML(cdx)],
                  ["div", {id:"mailsharecontentdiv"},
                   sharemgr.mailContentHTML(cdx)]]]);
            html = app.layout.dlgwrapHTML("Membic Share Mail", html);
            app.layout.openDialog({y:40}, html); }, //no autofocus
        mailShareHTML: function (cdx) {
            return jt.tac2html(
                [sharemgr.mailShareAddrs(cdx).map(sharemgr.mshselHTML),
                 sharemgr.addMailAddrHTML(cdx)]); },
        mailShareAddrs: function (cdx) {
            var msh = app.login.myProfile().cliset.mshare || {};
            var wrk = {addrs:{}, res:[]};
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            sharemgr.accumEmAddrs(wrk, msh[membic.ctmid], membic.ctmid, cdx);
            sharemgr.accumEmAddrs(wrk, msh.profile, !membic.ctmid, cdx);
            return wrk.res; },
        accumEmAddrs: function (wrk, addrcsv, dfltChecked, cdx) {
            if(!addrcsv) { return; }
            addrcsv.csvarray().forEach(function (addr) {
                var pma = sharemgr.parseShareAddr(addr);
                if(pma) {
                    pma.dfltChecked = dfltChecked;
                    pma.cdx = cdx;
                    if(!wrk.addrs[pma.addr]) {  //not already added
                        wrk.addrs[pma.addr] = pma;
                        wrk.res.push(pma); } } }); },
        parseShareAddr: function (addr) {  //server validates email on send
            //"uid:name <emaddr>" e.g. "1234:Test User <test@example.com>"
            var emcs = addr.match(/^(\d+):([^<]*)<(\S+@\S+\.\S+)>/);
            if(emcs) {  //
                return sharemgr.normEmail(emcs[1], emcs[2], emcs[3]); }
            return null; },
        normEmail: function (uid, emname, emaddr) {
            var ret = {user:uid, name:emname.trim(), addr:emaddr.toLowerCase()};
            ret.full = ret.name + " <" + ret.addr + ">";
            ret.dbv = ret.user + ":" + ret.full;
            return ret; },
        mshselHTML: function (pma, idx) {
            return jt.tac2html(
                ["div", {cla:"mshselcbdiv", id:"mshselcbdiv" + idx},
                 [["input", {type:"checkbox", cla:"mshselcb",
                             id:"mshselcb" + idx, value:jt.enc(pma.full),
                             checked:jt.toru(pma.dfltChecked)}],
                  ["label", {fo:"mshselcb" + idx, cla:"mshsellab"},
                   pma.name + " &lt;" + pma.addr + "&gt;"],
                  ["div", {cla:"mshtrashdiv"},
                   ["a", {href:"#deletecontact",
                          title:"Delete " + pma.name + " contact",
                          onclick:mdfs("sharemgr.deleteEmail", idx, pma.cdx)},
                    ["img", {cla:"mshactbimg",
                             src:app.dr("img/trash.png")}]]]]]); },
        deleteEmail: function (idx, cdx) {
            var cb = jt.byId("mshselcb" + idx);
            var pma = sharemgr.parseShareAddr(jt.dec(cb.value));
            jt.out("mshselcbdiv" + idx, "Deleting...");
            //remove from current theme and from profile so it doesn't show
            //up again in this theme.  Might still be appropriate for a
            //different theme so leave any other refs alone.
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var prof = app.login.fullProfile();
            var msh = prof.cliset.mshare || {};
            if(msh[membic.ctmid]) {
                msh[membic.ctmid] = sharemgr.remEmail(pma, msh[membic.ctmid]); }
            msh.profile = sharemgr.remEmail(pma, msh.profile);
            prof.cliset.mshare = msh;
            app.login.updateProfile(prof, 
                function () {
                    jt.out("mshselcbdiv" + idx, ""); },
                function () {  //not much to do if fail. Won't send...
                    jt.out("mshselcbdiv" + idx, ""); }); },
        remEmail: function (pma, csv) {
            //emaddrs should be normalized, but can't assume that so filter.
            csv = csv || "";
            var addrs = csv.csvarray();
            addrs = addrs.filter((em) =>
                sharemgr.parseShareAddr(em).addr !== pma.addr);
            return addrs.join(","); },
        addMailAddrHTML: function (cdx) {
            return jt.tac2html(
                ["div", {id:"newshemdiv"},
                 [["a", {href:"#newaddr", title:"Add new mail share",
                         id:"mailshareplus",
                         onclick:mdfs("sharemgr.addMailAddr", cdx)}, "+"],
                  ["input", {type:"text", id:"newshnamein", placeholder:"Name",
                             onchange:mdfs("sharemgr.addMailAddr", cdx)}],
                  ["input", {type:"email", id:"newshemin",
                             placeholder:"friend@example.com",
                             onchange:mdfs("sharemgr.addMailAddr", cdx)}]]]); },
        addMailAddr: function (cdx) {
            var pma = sharemgr.normEmail(0, jt.byId("newshnamein").value || "",
                                         jt.byId("newshemin").value || "");
            if(!pma.name) { return jt.byId("newshnamein").focus(); }
            if(!pma.addr) { return jt.byId("newshemin").focus(); }
            jt.out("newshemdiv", "Fetching recipient...");
            jt.call("POST", app.dr("/api/fmkuser"),
                    app.login.authdata({name:pma.name, email:pma.addr}),
                    function (res) {
                        pma = sharemgr.normEmail(
                            res[0].dsId, res[0].name || pma.name, pma.addr);
                        jt.out("newshemdiv", "Adding...");
                        sharemgr.addRecipient(cdx, pma); },
                    function (code, errtxt) {
                        jt.out("newshemdiv", code + ": " + errtxt); },
                    jt.semaphore("membic.addMailAddr")); },
        addRecipient: function (cdx, pma) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var prof = app.login.fullProfile();
            var msh = prof.cliset.mshare || {};
            if(membic.ctmid) {
                msh[membic.ctmid] = msh[membic.ctmid] || "";
                msh[membic.ctmid] = msh[membic.ctmid].csvappend(pma.dbv); }
            else {
                msh.profile = msh.profile || "";
                msh.profile = msh.profile.csvappend(pma.dbv); }
            prof.cliset.mshare = msh;
            app.login.updateProfile(prof, 
                function () {
                    jt.out("mshaddrsdiv", sharemgr.mailShareHTML(cdx)); },
                function () {  //not much to do if fail. Redraw.
                    jt.out("mshaddrsdiv", sharemgr.mailShareHTML(cdx)); }); },
        mailContentHTML: function (cdx) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var title = membic.details.title || membic.details.name || "";
            var url = membic.url || membic.rurl;
            var prof = app.login.fullProfile();
            return jt.tac2html(
                [["div", {id:"mshsubjdiv"},
                  ["&#x261e;",
                   ["input", {type:"text", id:"mshsubjin",
                              placeholder:"Subject",
                              value:jt.ellipsis(membic.text, 65)}]]],
                 ["div", {id:"mshbodydiv"},
                  ["textarea", {id:"mshbodyta", rows:20, cols:35},
                  "Hey $NAME,\n\n" +
                  "Thought you might find this interesting:\n\n" +
                  title + "\n" + url + "\n\n" +
                  membic.text + "\n\n" +
                  prof.name + "\n" + prof.email + "\n"]],
                 ["div", {id:"mshstatmsgdiv"}],
                 ["div", {cla:"formbuttonsdiv"},
                  ["button", {type:"button", title:"Send Share Email",
                              onclick:mdfs("sharemgr.sendShareMail")},
                   "Send"]]]); },
        sendShareMail: function () {
            jt.out("mshstatmsgdiv", "Send not implemented yet"); }
    };


    var tpmgr = {
        //If the theme is not cached, then there is no modified value to use
        //as an appropriate cache bust parameter.  Since a plain img src
        //reference can hang around for a potentially really long time, this
        //uses a one hour time slug with minutes removed.  That provides for
        //re-use across multiple display uses with eventual refresh.
        themeImgSrc: function (tid) {
            var theme = app.refmgr.cached("Theme", tid);
            if(theme) {
                return app.pcd.picImgSrc(theme); }
            return app.dr("/api/obimg?dt=Theme&di=" + tid +
                          jt.ts("&cb=", "hour")); },
        removePostButtonHTML: function (cdx, editable, pn) {
            if(!editable) {
                return ""; }
            return jt.tac2html(
                ["button", {type:"button", title:"Remove membic from theme",
                            onclick:mdfs("tpmgr.themepost", cdx, "remove",
                                         pn.ctmid)},
                 "x"]); },
        addPostContentHTML: function (cdx, select) {
            if(!select) {
                return jt.tac2html(
                    ["button", {type:"button", title:"Add Theme Post",
                                onclick:mdfs("tpmgr.themepost", cdx, "add")},
                     "+"]); }
            return jt.tac2html(
                ["select", {cla:"themepostsel", id:"themepostsel" + cdx,
                            onchange:mdfs("tpmgr.themepost", cdx, "select")},
                 tpmgr.themePostOptionsHTML(cdx)]); },
        availableThemeIds: function (uts, skiptidcsv) {
            return Object.keys(uts).filter(function (tid) {
                if(skiptidcsv.csvcontains(tid)) { return false; }
                if(uts[tid].lev <= 0) { return false; }
                if(uts[tid].archived) { return false; }
                return true; }); },
        verifyThemePostTimes: function () {
            var themes = app.login.myProfile().themes;
            var havePosts = true;
            Object.keys(themes).forEach(function (ctmid) {
                if(!themes[ctmid].lastPost) {
                    havePosts = false;
                    themes[ctmid].lastPost = "1234-12-12T00:00:00Z"; } });
            if(!havePosts) {
                app.login.myProfile().preb.forEach(function (membic) {
                    if(membic.svcdata && membic.svcdata.postctms) {
                        membic.svcdata.postctms.forEach(function (pn) {
                            if(membic.created > themes[pn.ctmid].lastPost) {
                                themes[pn.ctmid].lastPost = membic.created; }
                        }); } }); } },
        themePostOptionsHTML: function (cdx) {
            var tidcsv = "";
            var pnlab = jt.byId("postnoteslabel" + cdx);
            if(pnlab) {
                tidcsv = pnlab.dataset.tidcsv; }
            var uts = app.login.myProfile().themes;
            var avtis = tpmgr.availableThemeIds(uts, tidcsv);
            tpmgr.verifyThemePostTimes();
            avtis.sort(function (a, b) {
                if(uts[a].lastPost < uts[b].lastPost) { return 1; }
                if(uts[a].lastPost > uts[b].lastPost) { return -1; }
                return 0; });
            var html = [["option", {value:""}, "--Choose Theme--"]];
            avtis.forEach(function (ctmid) {
                html.push(["option", {value:ctmid}, uts[ctmid].name]); });
            return jt.tac2html(html); },
        postNoteHTML: function (cdx, editable, pn) {
            return jt.tac2html(
                ["div", {cla:"postnotediv"},
                 [["a", {href:app.dr("theme/" + pn.ctmid),
                         onclick:jt.fs("app.statemgr.setState('Theme','" +
                                       pn.ctmid + "')")},
                   [["img", {src:tpmgr.themeImgSrc(pn.ctmid)}],
                    pn.name]],
                  tpmgr.removePostButtonHTML(cdx, editable, pn)]]); },
        postNoteForThemeId: function (ignore /*cdx*/, membic, tid) {
            var pn = membic.svcdata.postctms.find((cn) => cn.ctmid === tid);
            if(!pn) {  //no previously existing post
                var pt = app.login.myProfile().themes[tid];
                pn = {ctmid:tid, name:pt.name, revid:0}; }
            return pn; },
        redrawUpdatedThemes: function (cdx, pns, membic, selkws) {
            jt.out("postnotescontdiv" + cdx,
                   tpmgr.themePostsHTML(cdx, true, pns));
            kwmgr.redrawKeywords(cdx, membic, selkws); },
        themepost: function (cdx, command, ctmid) {
            var pne = jt.byId("postnoteslabel" + cdx);
            pne.innerHTML = "Post to: ";  //clarify actions take effect on save
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var selkws = kwmgr.selectedKeywords(cdx, membic);  //opts may change
            var pns = tpmgr.selectedPostThemes(cdx, membic);
            switch(command) {
            case "remove":  //remove the ctmid and redraw posts
                pns = pns.filter((pn) => pn.ctmid !== ctmid);
                if(pne) {
                    pne.dataset.tidcsv = pne.dataset.tidcsv.csvremove(ctmid); }
                tpmgr.redrawUpdatedThemes(cdx, pns, membic, selkws);
                break;
            case "add":  //replace '+' with a list of options
                jt.out("addthemepostdiv" + cdx,
                       tpmgr.addPostContentHTML(cdx, "select"));
                break;
            case "select":  //add the selected theme and '+' button
                ctmid = jt.byId("themepostsel" + cdx);
                ctmid = ctmid.options[ctmid.selectedIndex].value;
                pns.push(tpmgr.postNoteForThemeId(cdx, membic, ctmid));
                tpmgr.redrawUpdatedThemes(cdx, pns, membic, selkws);
                break; }
            app.membic.formInput(cdx); },  //note any changes
        themePostsHTML: function (cdx, editable, pns) {
            if(!editable && !pns.length) {
                return ""; }
            var labtxt = "Themes: ";
            if(editable) {
                labtxt = "Post to: "; }
            var links = [];
            var tidcsv = "";
            pns.forEach(function (pn) {
                tidcsv = tidcsv.csvappend(pn.ctmid);
                links.push(tpmgr.postNoteHTML(cdx, editable, pn)); });
            if(editable) {
                links.push(jt.tac2html(
                    ["div", {cla:"postnotediv", id:"addthemepostdiv" + cdx},
                     tpmgr.addPostContentHTML(cdx, !pns.length)])); }
            return jt.tac2html(
                [["span", {cla:"postnoteslabel", id:"postnoteslabel" + cdx,
                           "data-tidcsv":tidcsv}, labtxt],
                 links.join(" | ")]); },
        membicThemePostsHTML: function (cdx, membic, readonly) {
            membic.svcdata = membic.svcdata || {};
            membic.svcdata.postctms = membic.svcdata.postctms || [];
            if(!mayEdit(membic) && !membic.svcdata.postctms.length) {
                return ""; }
            return jt.tac2html(
                ["div", {cla:"postnotescontdiv", id:"postnotescontdiv" + cdx},
                 tpmgr.themePostsHTML(cdx, (!readonly && mayEdit(membic)),
                                      membic.svcdata.postctms)]); },
        selectedPostThemes: function (cdx, membic) {
            var pne = jt.byId("postnoteslabel" + cdx);
            if(!pne) {  //checking for changes before post note element display
                return membic.svcdata.postctms; }  //return original
            var pns = [];
            pne.dataset.tidcsv.csvarray().forEach(function (tid) {
                pns.push(tpmgr.postNoteForThemeId(cdx, membic, tid)); });
            return pns; },
        themePostsChanged: function (membic, tps) {
            var postctms = membic.svcdata.postctms;
            function postin (entry, posts) {
                return posts.find((post) => post.ctmid === entry.ctmid); }
            var same = (postctms.every((pn) => postin(pn, tps)) &&
                        tps.every((tp) => postin(tp, postctms)));
            return !same; }
    };


    function togIfEdit(attrs, cdx, membic, oninputfstr) {
        if(expandedMembics[membicExpId(membic)]) {  //currently expanded
            if(oninputfstr && mayEdit(membic)) {
                attrs.contentEditable = "true";
                attrs.oninput = oninputfstr; } }
        else { //currently collapsed
            attrs.style = "cursor:crosshair;";
            attrs.onclick = jt.fs("app.membic.toggleMembic(" + cdx + ")"); }
        return attrs;
    }


    var detmgr = {
        //The predefined detail attributes in order of display.
        detailattrs: ["author", "publisher", "artist", "album", "starring",
                      "address", "year"],
        membic2dets: function (membic, edit) {
            var dets = {mode:"display", edfld:"", flds:{}};
            if(edit) {
                dets.mode = "add"; }
            detmgr.detailattrs.forEach(function (key) { dets.flds[key] = ""; });
            Object.keys(membic.details || {}).forEach(function (key) {
                if(key !== "title" && key !== "name") {
                    dets.flds[key] = membic.details[key]; } });
            return dets; },
        html2dets: function (cdx) {
            var dets = {mode:"display", edfld:"", flds:{}};
            var table = jt.byId("detailstable" + cdx);
            Array.from(table.rows).forEach(function (row) {
                var cells = Array.from(row.cells);
                var av = {att:"", val:""};
                switch(row.dataset.mode) { //only one active edit row
                case "add":
                    av.att = jt.byId("detnewattrin" + cdx).value || "";
                    //valid js ident required. only want simple word attrs.
                    av.att = av.att.replace(/\W/g, "").toLowerCase();
                    av.val = jt.byId("detnewvalin" + cdx).value;
                    dets.mode = "add";
                    break;
                case "edit":
                    av.att = cells[0].innerText;
                    av.val = jt.byId("detnewvalin" + cdx).value;
                    dets.mode = "edit";
                    dets.edfld = av.att;
                    break;
                default: //"display"
                    av.att = cells[0].innerText;
                    av.val = cells[1].innerText; }
                if(av.att && av.val) {  //no value means removed
                    dets.flds[av.att] = av.val; } });
            return dets; },
        dets2html: function (dets, cdx) {
            var html = [];
            Object.keys(dets.flds).forEach(function (fldname) {
                var val = dets.flds[fldname];
                if(val) {
                    html.push(detmgr.row(fldname, val, dets, cdx)); } });
            if(dets.mode === "add") {
                html.push(detmgr.addrow(dets, cdx)); }
            return jt.tac2html(["table", {cla: "collapse",
                                          id:"detailstable" + cdx}, html]); },
        row: function (fld, val, dets, cdx) {
            var vh = val; var mode="display";
            if(dets.mode === "edit" && dets.edfld === fld) {
                mode = "edit";
                vh = ["input", {type:"text", cla:"detnewvalin",
                                id:"detnewvalin" + cdx,
                                placeholder:"value", value:vh,
                                onchange:mdfs("detmgr.changevalue", cdx)}]; }
            else {  //standard value display, click to edit.
                vh = ["a", {href:"edit", onclick:mdfs("detmgr.clickval",
                                                      fld, cdx)}, vh]; }
            return jt.tac2html(
                ["tr", {"data-mode":mode},
                 [["td", {cla:"detailattrtd"}, fld],
                  ["td", {cla:"detailvaltd",
                          id:"detail" + fld + "valtd" + cdx}, vh]]]); },
        clickval: function (fld, cdx) {
            var dets = detmgr.html2dets(cdx);
            dets.mode = "edit";
            dets.edfld = fld;
            jt.out("mddetdiv" + cdx, detmgr.dets2html(dets, cdx)); },
        changevalue: function (cdx) {
            var dets = detmgr.html2dets(cdx);  //read updated attrval
            dets.mode = "add";
            dets.edfld = "";
            jt.out("mddetdiv" + cdx, detmgr.dets2html(dets, cdx));
            app.membic.formInput(cdx); },
        addrow: function (dets, cdx) {
            return jt.tac2html(
                ["tr", {"data-mode":"add"},
                 [["td", {cla:"detailattrtd"},
                   [["input", {type:"text", cla:"detnewattrin",
                               id:"detnewattrin" + cdx,
                               placeholder:"attribute", value:"",
                               list:"detnewattroptsdl" + cdx,
                               onchange:mdfs("detmgr.chgadd", cdx)}],
                    ["datalist", {id:"detnewattroptsdl" + cdx},
                     detmgr.attrOptionsForAdd(dets)]]],
                  ["td", {cla:"detailvaltd"},
                   ["input", {type:"text", cla:"detnewvalin",
                              id:"detnewvalin" + cdx,
                              placeholder:"value", value:"",
                              onchange:mdfs("detmgr.chgadd", cdx)}]]]]); },
        attrOptionsForAdd: function (dets) {
            var dlos = [];
            detmgr.detailattrs.forEach(function (fld) {
                if(!dets.flds[fld]) {  //no assigned value yet
                    dlos.push(["option", {value:fld}]); } });
            return dlos; },
        chgadd: function (cdx) {
            var ins = {att:jt.byId("detnewattrin" + cdx),
                       val:jt.byId("detnewvalin" + cdx)};
            if(ins.att.value && ins.val.value) {   //need to redraw
                var dets = detmgr.html2dets(cdx);  //read new attrval
                jt.out("mddetdiv" + cdx,           //update display with new add
                       detmgr.dets2html(dets, cdx));
                app.membic.formInput(cdx); }       //note any changes
            else if(!ins.att.value) {
                ins.att.focus(); }
            else if(!ins.val.value) {
                ins.val.focus(); } },
        detailsHTML: function (cdx, membic, edit) {
            return jt.tac2html(["div", {cla:"mddetdiv", id:"mddetdiv" + cdx},
                                detmgr.dets2html(
                                    detmgr.membic2dets(membic, edit),
                                    cdx)]); },
        detailsValues: function (cdx) {
            var dets = detmgr.html2dets(cdx);
            return dets.flds; }
    };


    var typemgr = {
        findType: function (typename) {
            return membicTypes.find((md) => md.type === typename); },
        imgHTMLForType: function (cdx, mt, idsuf) {
            idsuf = idsuf || "";
            return jt.tac2html(
                ["img", {cla:"revtypeimg", src:app.dr("img/" + mt.img),
                         id:"revtypeimg" + cdx + idsuf, title:mt.type,
                         alt:mt.type}]); },
        clickHTMLForType: function (cdx, mt) {
            return jt.tac2html(
                ["div", {cla:"revtseldiv", id:"revtseldiv" + cdx,
                         "data-state":"collapsed"},
                 typemgr.typesHTML(cdx, mt)]); },
        openClickHTML: function (cdx, mt) {
            return jt.tac2html(
                ["a", {href:"#changetype", title:"Change Membic Type",
                       onclick:mdfs("typemgr.typesel", cdx, mt.type, true)},
                 typemgr.imgHTMLForType(cdx, mt)]); },
        selectClickHTML: function (cdx, mt, idsuf) {
            return jt.tac2html(
                ["a", {href:"#" + mt.type, title:"Select " + mt.type,
                       onclick:mdfs("typemgr.typesel", cdx, mt.type, false)},
                 typemgr.imgHTMLForType(cdx, mt, idsuf)]); },
        typesHTML: function (cdx, mt, expanded) {
            if(!expanded) {
                return typemgr.openClickHTML(cdx, mt); }
            var html = [typemgr.selectClickHTML(cdx, mt)];
            membicTypes.forEach(function (ot) {
                if(ot.type !== mt.type) {
                    html.push(typemgr.selectClickHTML(cdx, ot, ot.type)); } });
            return jt.tac2html(html); },
        typesel: function (cdx, typename, expanded) {
            var mt = typemgr.findType(typename);
            jt.out("revtseldiv" + cdx, typemgr.typesHTML(cdx, mt, expanded));
            app.membic.formInput(cdx); }
    };


    var ratmgr = {
        imgi: {i:app.dr("img/stars20ds17.png"),
               g:app.dr("img/stars20gray.png"),
               w:85, h:15},
        rati: {tis:["No stars", "Half a star", "One star", 
                    "One and a half stars", "Two stars", "Two and a half stars",
                    "Three stars", "Three and a half stars", "Four stars", 
                    "Four and a half stars", "Five stars"],
               sns:[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
               rns:[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
               wns:[0,  9, 17, 26, 34, 43, 51, 60, 68, 77, 85],
               aks:["-", "+", "*", "*+", "**", "**+", "***", "***+", "****",
                    "****+", "*****"],
               ucs:["0", "\u00BD", "\u2605", "\u2605\u00BD", "\u2605\u2605",
                    "\u2605\u2605\u00BD", "\u2605\u2605\u2605",
                    "\u2605\u2605\u2605\u00BD", "\u2605\u2605\u2605\u2605",
                    "\u2605\u2605\u2605\u2605\u00BD",
                    "\u2605\u2605\u2605\u2605\u2605"],
               dfltv:60},  //default rating value is 3 stars
        bg: function (membic) {
            if(mayEdit(membic)) {
                return ratmgr.imgi.g; }
            return app.dr("img/blank.png"); },
        ratingInfo: function (rating, roundup) {
            if(typeof rating === "string") { 
                rating = parseInt(rating, 10); }
            if(!rating || typeof rating !== "number" || rating < 0) { 
                rating = ratmgr.rati.dfltv; }
            if(rating > 93) {   //compensate for floored math low stickiness.
                rating = 100; } //round up to "dock" right when dragging
            var mrsi = ratmgr.rati.tis.length - 1;  //max rating step index
            var stv = Math.floor((rating * mrsi) / 100);  //step value
            if(roundup) {
                stv = Math.min(stv + 1, mrsi);
                rating = Math.floor((stv / mrsi) * 100); }
            return {value:rating, step:stv, maxstep:mrsi,
                    title:ratmgr.rati.tis[stv], roundnum:ratmgr.rati.sns[stv],
                    asters:ratmgr.rati.aks[stv], unicode:ratmgr.rati.ucs[stv],
                    rn:ratmgr.rati.rns[stv], width:ratmgr.rati.wns[stv]}; },
        getHTML: function (cdx, membic) {
            var ri = ratmgr.ratingInfo(membic.rating, false);
            return jt.tac2html(
                ["div", {cla:"starcontdiv", id:"starcontdiv" + cdx,
                         style:"position:relative;" +
                               "background:url('" + ratmgr.bg(membic) + "');" +
                               "width:" + ratmgr.imgi.w + "px;" +
                               "height:" + ratmgr.imgi.h + "px;"},
                 [["div", {cla:"ratstardiv", id:"ratstardiv" + cdx,
                           style:"position:absolute;top:0px;left:0px;" +
                                 "background:url('" + ratmgr.imgi.i + "');" +
                                 "width:" + ri.width + "px;" +
                                 "height:" + ratmgr.imgi.h + "px;"}],
                  ratmgr.ctrlOverlayHTML(cdx, membic)]]); },
        ctrlOverlayHTML: function (cdx, membic) {
            if(mayEdit(membic)) {
                var ehs = mdfs("ratmgr.handleEvent", "event");
                ehs = ehs.replace("return false;", "");  //don't latch event
                return jt.tac2html(
                    ["div", {cla:"ratctrldiv", id:"ratctrldiv" + cdx,
                             style:"position:absolute;top:0px;left:0px;" +
                                   "width:" + ratmgr.imgi.w + "px;" +
                                   "height:" + ratmgr.imgi.h + "px;",
                             "data-cdx":String(cdx), "data-pointing":"",
                             onmousedown:ehs, onmouseup:ehs, onmouseout:ehs,
                             onmousemove:ehs, onclick:ehs, ontouchstart:ehs,
                             ontouchend:ehs, ontouchcancel:ehs,
                             ontouchmove:ehs}]); }
            return ""; },
        handleEvent: function (event) {
            switch(event.type) {
            case "mousedown":
            case "touchstart":
                event.target.dataset.pointing = "active";
                ratmgr.adjustDisplay(event, true);
                break;
            case "mouseup":
            case "touchend":
            //case "mouseout": (use mouseleave instead, more stable)
            case "mouseleave":
            case "touchcancel":
                event.target.dataset.pointing = "";
                break;
            case "mousemove":
            case "touchmove":
                if(event.target.dataset.pointing) {
                    ratmgr.adjustDisplay(event); }
                break;
            case "click":
                ratmgr.adjustDisplay(event, true);
                break; } },
        adjustDisplay: function (event, roundup) {
            var br = event.target.getBoundingClientRect();
            var acs = {x:event.clientX - br.left, y:event.clientY - br.top};
            // jt.log("adjustDisplay " + event.target.dataset.cdx + " x:" +
            //        acs.x + ", y:" + acs.y); }
            var ri = ratmgr.ratingInfo((acs.x / ratmgr.imgi.w) * 100, roundup);
            var sdiv = jt.byId("ratstardiv" + event.target.dataset.cdx);
            if(sdiv) {
                sdiv.style.width = ri.width + "px"; }
            app.membic.formInput(parseInt(event.target.dataset.cdx, 10)); },
        ratingValue: function (cdx) {
            var width = jt.byId("ratstardiv" + cdx).offsetWidth;
            //pass the same roundup value as getHTML to start unchanged.
            var ri = ratmgr.ratingInfo((width / ratmgr.imgi.w) * 100, false);
            return ri.rn; }
    };


    var kwmgr = {
        //Return all the possible keywords grouped by source.
        keywordGroups: function (cdx, membic, selkwcsv) {
            selkwcsv = selkwcsv || membic.keywords;
            var mt = membicTypes.find((md) => md.type === membic.revtype);
            var keygrps = [{name:"", kwcsv:mt.dkwords.join(",")}];
            tpmgr.selectedPostThemes(cdx, membic).forEach(function (pn) {
                var proftheme = app.login.myProfile().themes[pn.ctmid];
                keygrps.push({name:proftheme.name,
                              kwcsv:proftheme.keywords}); });
            var knownkws = keygrps.reduce((acc, kg) => 
                                          acc.csvappend(kg.kwcsv), "");
            knownkws = knownkws.toLowerCase();
            var akws = selkwcsv.csvarray()
                .filter((kw) => !knownkws.csvcontains(kw.toLowerCase()));
            keygrps.push({name:"Additional", kwcsv:akws.join(",")});
            return keygrps; },
        //Easier to see all the available keywords and use checkboxes.  It's
        //not great if the accumulated total gets really long, but it's
        //still way better than clicking a pulldown.
        keywordsHTML: function (cdx, membic, edit, skcsv) {
            if(!edit) {
                var kwrds = membic.keywords || "";
                if(kwrds) {
                    kwrds = [["span", {cla:"postnoteslabel"}, "Keywords: "],
                             kwrds.replace(/\s/g, "&nbsp;")
                             .split(",").join(", ")]; }
                return jt.tac2html(
                    ["div", togIfEdit({cla:"mdkwsdiv"}, cdx, membic), kwrds]); }
            skcsv = skcsv || membic.keywords;
            var html = [];
            kwmgr.keywordGroups(cdx, membic, skcsv).forEach(function (kg, idx) {
                if(kg.kwcsv) {
                    var kwshtml = [];
                    kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                        var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                        var bchk = skcsv.csvcontains(kwd);
                        kwshtml.push(
                            ["div", {cla:"mdkwdiv"},
                             [["input", {type:"checkbox", cla:"keywordcheckbox",
                                         id:kwid, value:kwd,
                                         checked:jt.toru(bchk),
                                         onclick:jt.fsd("app.membic.formInput("
                                                        + cdx + ")")}],
                              ["label", {fo:kwid, id:kwid + "label"},
                               kwd]]]); });
                    html.push(jt.tac2html(
                        ["div", {cla:"mdkwsectiondiv"},
                         [["div", {cla:"mdkwgnamediv"}, kg.name],
                          ["div", {cla:"mdkwcbsdiv"}, kwshtml]]])); } });
            html.push(jt.tac2html(
                ["div", {cla:"mdkwaddnewdiv"},
                 [["label", {fo:"newkwin" + cdx}, "Add Keyword"],
                  ["input", {type:"text", id:"newkwin" + cdx,
                             placeholder:"New Keyword"}],
                  ["button", {type:"button", title:"Add Keyword",
                              onclick:mdfs("kwmgr.addNew", cdx)},
                   "+"]]]));
            return jt.tac2html(
                ["div", {cla:"mdkwsdiv"},
                 ["div", {id:"mdkwscontentdiv" + cdx}, html]]); },
        selectedKeywords: function (cdx, membic) {
            var skws = "";
            var kwgs = kwmgr.keywordGroups(cdx, membic);
            kwgs.forEach(function (kg, idx) {
                kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                    var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                    var kwi = jt.byId(kwid);
                    if(!kwi) {  //UI for one or more kwrds not ready yet.
                        //use what we already found, or had originally.
                        skws = skws || membic.keywords; }
                    else if(kwi.checked) {
                        skws = skws.csvappend(kwd); } }); });
            var agi = kwgs.length - 1;  //additional keywords group index
            var pui = kwgs[agi].kwcsv.length;  //previously unknown index
            var newKeywordInput; var kwid;
            do {
                kwid = "m" + cdx + "g" + agi + "c" + pui;
                newKeywordInput = jt.byId(kwid);
                if(newKeywordInput && newKeywordInput.checked) {
                    skws = skws.csvappend(safeInnerText(kwid + "label")); }
                pui += 1;
            } while(newKeywordInput);
            return skws; },
        equivKwrds: function (kwsa, kwsb) {
            kwsa = kwsa.toLowerCase().csvarray().sort().join(",");
            kwsb = kwsb.toLowerCase().csvarray().sort().join(",");
            return (kwsa === kwsb); },
        redrawKeywords: function (cdx, membic, currkws) {
            jt.out("mdkwscontentdiv" + cdx,
                   kwmgr.keywordsHTML(cdx, membic, true, currkws)); },
        addNew: function (cdx) {
            var nkin = jt.byId("newkwin" + cdx);
            if(nkin && nkin.value) {
                var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
                var currkws = kwmgr.selectedKeywords(cdx, membic);
                currkws = currkws.csvappend(nkin.value);
                kwmgr.redrawKeywords(cdx, membic, currkws);
                app.membic.formInput(cdx); } }
    };


    //Reader details and image management access
    var rdrmgr = {
        toggle: function (cdx) {
            if(jt.byId("mdrdrdetcontdiv" + cdx).innerHTML) {
                return jt.out("mdrdrdetcontdiv" + cdx, ""); }
            var rsd = rdrmgr.readerSummaryDetails(cdx);
            jt.out("mdrdrdetcontdiv" + cdx, jt.tac2html(
                [["div", {cla:"toprightxdiv"},
                  ["a", {href:"#close", onclick:mdfs("rdrmgr.toggle", cdx)},
                   "X"]],
                 ["div",
                  [["b", rsd.name], " ",
                   ["em", "status"], ": ", rsd.status, ", ",
                   ["em", "result"], ": ", rsd.result]],
                 ["div", rsd.timing],
                 ["div", rsd.filled],
                 ["div", {cla:"formbuttonsdiv", id:"mdrdetbuttonsdiv" + cdx},
                  rdrmgr.buttons(cdx, rsd)]])); },
        readerSummaryDetails: function (cdx) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var rsd = {name:"Unknown", status:"None", result:"-",
                       timing:"", filled:""};
            if(membic.svcdata && membic.svcdata.urlreader) {
                var rdr = membic.svcdata.urlreader;
                rsd.name = rdr.name;
                rsd.status = rdr.status;
                rsd.result = rdr.result;
                if(rdr.log && rdr.log.length) {
                    var log = rdr.log[rdr.log.length - 1];
                    var etms = jt.isoString2Time(log.end).getTime();
                    var stms = jt.isoString2Time(log.start).getTime();
                    var elap = Math.round((etms - stms) / 10);  //100th sec
                    rsd.timing = log.start + " ~ " + (elap / 100) + " seconds.";
                    rsd.filled = log.msg; } }
            return rsd; },
        buttons: function (cdx, rsd) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            if(savemgr.membicEdited(cdx, membic)) {
                //simplest to keep db info in sync with UI.
                return "Save changes before uploading image."; }
            var subj = "Missing info for Membic " + membic.dsId;
            var body = "Hi,\n\nNoticed missing info for Membic " + membic.dsId +
                "\nReader: " + rsd.name + " status: " + rsd.status + 
                ", result: " + rsd.result + "\n" +
                "Timing: " + (rsd.timing || "No timing info") + "\n" +
                "Message: " + (rsd.filled || "No details filled out") + "\n\n" +
                "Could you look into this?\n\n" +
                "thanks,\n\n";
            var link = "mailto:support@membic.org?subject=" +
                jt.dquotenc(subj) + "&body=" + jt.dquotenc(body) + "%0A%0A";
            var imgselb = ["button", {type:"button", cla:"membicformbutton",
                                      onclick:mdfs("rdrmgr.uploadForm", cdx)},
                           "Upload&nbsp;Image"];
            if(membic.svcdata.picdisp === "upldpic") {
                imgselb = ["button", {type:"button", cla:"membicformbutton",
                                      onclick:mdfs("rdrmgr.useSitePic", cdx)},
                           "Use&nbsp;Site&nbsp;Image"]; }
            return jt.tac2html(
                [["a", {cla:"linkbutton", href:link},
                  "Report&nbsp;Missing&nbsp;Info"],
                 " &nbsp; ",
                 imgselb]); },
        uploadForm: function (cdx) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            rdrmgr.switchToPrevUploadPic(cdx, membic);
            var auth = app.login.authenticated();
            var monfstr = mdfs("rdrmgr.monitorUpload", cdx, true);
            jt.out("mdrdetbuttonsdiv" + cdx, jt.tac2html(
                [["form", {id:"mpuform", action:"/api/uploadimg",
                           method:"post", target:"mpuif" + cdx,
                           enctype:"multipart/form-data"},
                  [["input", {type:"hidden", name:"an", value:auth.email}],
                   ["input", {type:"hidden", name:"at", value:auth.token}],
                   ["input", {type:"hidden", name:"dsType", value:"Membic"}],
                   ["input", {type:"hidden", name:"dsId", value:membic.dsId}],
                   ["label", {fo:"picfilein"}, "Upload image"],
                   ["input", {type:"file", id:"picfilein", name:"picfilein",
                              accept:"image/*",
                              onchange:mdfs("rdrmgr.enableUploadButton", cdx)}],
                   ["div", {id:"mbcpicupldstatdiv" + cdx}],
                   ["div", {id:"mbcpicupldbuttonsdiv" + cdx},
                    [["button", {type:"button", cla:"membicformbutton",
                                 onclick:mdfs("rdrmgr.useSitePic", cdx)},
                      "Cancel"], " &nbsp; ",
                     ["button", {type:"submit", id:"mbcpicupldbutton" + cdx,
                                 onclick:monfstr}, "Upload"]]]]],
                 ["iframe", {id:"mpuif" + cdx, name:"mpuif" + cdx,
                             src:"/api/uploadimg", style:"display:none"}]]));
            jt.byId("mbcpicupldbutton" + cdx).disabled = true; },
        switchToPrevUploadPic: function (cdx, membic) {
            if(membic.revpic && membic.svcdata.picdisp === "sitepic") {
                membic.svcdata.picdisp = "upldpic";
                membic.svcdata.picchgt = new Date().toISOString();
                jt.out("mfpicture" + cdx,
                       formElements.picture.expanded(cdx, membic));
                app.membic.formInput(cdx); } },
        enableUploadButton: function (cdx) {
            jt.byId("mbcpicupldbutton" + cdx).disabled = false; },
        monitorUpload: function (cdx, submit) {
            var iframe = jt.byId("mpuif" + cdx);
            if(!iframe) {
                return jt.log("rdrmgr.monitorUpload exiting since no iframe"); }
            jt.byId("mbcpicupldbutton" + cdx).disabled = true;
            if(submit) {
                jt.byId("mpuform").submit(); }
            var statdiv = jt.byId("mbcpicupldstatdiv" + cdx);
            if(!statdiv.innerHTML) {
                statdiv.innerHTML = "Uploading"; }
            else {  //add a monitoring dot
                statdiv.innerHTML = statdiv.innerHTML + "."; }
            var txt = iframe.contentDocument || iframe.contentWindow.document;
            if(!txt || !txt.body || txt.body.innerHTML.indexOf("Ready") >= 0) {
                return app.fork({descr:"monitor membic img upload", ms:1000,
                                 func:function () {
                                     rdrmgr.monitorUpload(cdx); }}); }
            //upload complete, update image or report error
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            txt = txt.body.innerHTML;
            if(txt.indexOf("Done: ") >= 0) { //successful upload
                membic.svcdata.picdisp = "upldpic";
                membic.svcdata.picchgt = rdrmgr.readDoneTimestamp(txt); }
            else {  //report error
                jt.err(txt); }
            app.membic.toggleMembic(cdx, "unchanged", membic); },
        readDoneTimestamp: function (txt) {
            return txt.match(/Done:\s([^<\s]+)/)[1]; },
        useSitePic: function (cdx) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            membic.svcdata.picdisp = "sitepic";
            membic.svcdata.picchgt = new Date().toISOString();
            app.membic.toggleMembic(cdx, "unchanged", membic); }
    };


    formElements = {
        title: {
            closed: function (ignore /*cdx*/, membic) {
                var html = titleForMembic(membic);
                var link = linkForMembic(membic);
                if(link) {
                    html = jt.tac2html(
                        ["a", {href:link, title:link,
                               onclick:jt.fs("window.open('" + link + "')")},
                     html]); }
                return html; },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.title.closed(cdx, membic); }
                var placetext = "Title for Membic";
                return jt.tac2html(
                    ["span", editableWithPlaceholder(cdx, "mftitlespan",
                                                     placetext),
                     (exposeTags(titleForMembic(membic)) || placetext)]); },
            changed: function (cdx, membic) {
                var mt = titleForMembic(membic);
                var st = mt;  //unchanged if title not displayed yet
                var elem = jt.byId("mftitlespan" + cdx);
                if(elem) {  //have input area, even if they have cleared it out
                    st = elem.innerText.trim(); }
                return jt.toru(mt !== st, st); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                updobj.details.title = chgval;
                updobj.details.name = chgval; } },
        share: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                return sharemgr.membicShareHTML(cdx, membic); },
            changed: function () { return false; },
            write: function () { return; } },
        revtype: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                var mt = typemgr.findType(membic.revtype);
                if(mayEdit(membic)) {
                    return typemgr.clickHTMLForType(cdx, mt); }
                else {
                    return typemgr.imgHTMLForType(cdx, mt); } },
            changed: function (cdx, membic) {
                var rt = jt.byId("revtypeimg" + cdx).title;
                return jt.toru(membic.revtype !== rt, rt); },
            write: function (chgval, updobj) {
                updobj.revtype = chgval; } },
        byline: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                var cretxt = jt.colloquialDate(membic.created, "compress");
                var linkattrs = {href:"#" + membic.penid,
                                 title:"Visit " + membic.penname,
                                 onclick:formElements.byline.blcfs(membic)};
                if(app.solopage()) {
                    linkattrs.onclick = jt.fs("window.open('" + app.docroot +
                                              "/profile/" + membic.penid +
                                              "')"); }
                var linkname = membic.penname;
                if(myMembic(membic) && membic.ctmid) {
                    linkname = "Me (edit)"; }
                return jt.tac2html(
                    [["span", {cla:"mascrespan"}, cretxt],
                     ["span", {cla:"masbyline"},
                      ["a", linkattrs,
                       [["img", {src:app.login.profimgsrc(membic.penid)}],
                        ["span", {cla:"penlight"}, linkname]]]]]); },
            changed: function () { return false; },
            write: function () { return; },
            blcfs: function (membic) {
                //If clicking your own membic byline, you probably want to
                //edit.  Otherwise you are just checking the profile out.
                var fs = "'MUser'" + ",'" + membic.penid + "'";
                if(myMembic(membic)) {
                    fs += ",{go:'" + membic.srcrev + "'}"; }
                fs = "app.statemgr.setState(" + fs + ")";
                return jt.fs(fs); } },
        stars: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                return jt.tac2html(
                    ["span", {cla:"masratspan"},
                     ratmgr.getHTML(cdx, membic)]); },
            changed: function (cdx, membic) {
                var rat = ratmgr.ratingValue(cdx);
                //jt.log("rat: " + rat + ", membic.rating: " + membic.rating);
                return jt.toru(membic.rating !== rat, rat); },
            write: function (chgval, updobj) {
                updobj.rating = chgval; } },
        dlgbs: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) {
                    return formElements.dlgbs.actionAreaWrap(cdx,
                        [["a", {href:"#delete", title:"Delete Membic",
                                onclick:fdfs("dlgbs.mrkdel", cdx)},
                          ["img", {cla:"masactbimg",
                                   src:app.dr("img/trash.png")}]],
                         formElements.dlgbs.actionButtons(cdx, membic)]); }
                return ""; },
            changed: function () { return false; },
            write: function () { return; },
            actionAreaWrap: function (cdx, html) {
                return jt.tac2html(
                    [["div", {cla:"dlgbsmsgdiv", id:"dlgbsmsgdiv" + cdx}],
                     ["div", {cla:"dlgbsbdiv", id:"dlgbsbdiv" + cdx},
                      html]]); },
            actionButtons: function (cdx, membic) {
                var edited = savemgr.membicEdited(cdx, membic);
                var mkb = formElements.dlgbs.makeActionButton;
                var ret = [];
                if(edited) {
                    ret.push(mkb("Cancel",
                        jt.fs("app.membic.toggleMembic(" + cdx + ")")));
                    ret.push(mkb("Save", fdfs("dlgbs.save", cdx))); }
                else {
                    if(membicDetailsMissing(membic)) {
                        ret.push(mkb("Refetch", fdfs("dlgbs.read", cdx))); }
                    ret.push(mkb("Done Editing",
                        jt.fs("app.membic.toggleMembic(" + cdx + ")"))); }
                return jt.tac2html(ret); },
            makeActionButton: function (name, fstr, disabled) {
                var bas = {type:"button", cla:"membicformbutton", onclick:fstr};
                if(disabled) {
                    bas.disabled = true;
                    bas.cla = "membicformbuttondisabled"; }
                return jt.tac2html(["button", bas, name]); },
            mrkdel: function (cdx) { markMembicDeleted(cdx); },
            save: function (cdx) { savemgr.updateMembic(cdx); },
            read: function (cdx, overwrite) {
                jt.out("dlgbsbdiv" + cdx, "Reading...");
                var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
                membic.rurl = membic.rurl;
                startReader(membic, overwrite); } },
        imgrdr: {  //closed unless currently using. modal.
            closed: function (cdx) {
                return jt.tac2html(["div", {id:"mdrdrdetcontdiv" + cdx}]); },
            expanded: function (cdx) {
                return formElements.imgrdr.closed(cdx); },
            changed: function () { return false; },
            write: function () { return; } },
        picture: {
            closed: function (ignore /*cdx*/, membic) {
                var link = linkForMembic(membic);
                var html = ["img", {cla:"mdimg", src:membicImgSrc(membic)}];
                if(link) {
                    html = ["a", {href:link, title:link,
                                  onclick:jt.fs("window.open('" + link + "')")},
                            html]; }
                return jt.tac2html(["div", {cla:"mdpicdiv"},
                                    html]); },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) { //access reader details and actions
                    return jt.tac2html(
                        ["div", {cla:"mdpicdiv"},
                         ["a", {href:"#readinfo", cla:"mdrdrdetlink",
                                title:"Show reader details",
                                onclick:mdfs("rdrmgr.toggle", cdx)},
                          ["img", {cla:"mdimg", src:membicImgSrc(membic)}]]]); }
                return formElements.picture.closed(cdx, membic); },
            changed: function (ignore /*cdx*/, membic) {
                if(membic.svcdata.picchgt > membic.modified) {
                    return membic.svcdata.picdisp; }
                return false; },
            write: function (chgval, updobj, membic) {
                updobj.svcdata = updobj.svcdata || copySvcData(membic);
                updobj.svcdata.picdisp = chgval; } },
        text: {
            closed: function (cdx, membic, expanded) {
                return jt.tac2html(
                    ["div", togIfEdit({cla:"mdtxtdiv", id:"mdtxtdiv" + cdx},
                                      cdx, membic),
                     jt.linkify(collapseText(membic.text, expanded))]); },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.text.closed(cdx, membic, true); }
                var placetext = "Why was this memorable?";
                return jt.tac2html(
                    ["div", editableWithPlaceholder(cdx, "mdtxtdiv",
                                                    placetext),
                     (exposeTags(membic.text) || placetext)]); },
            changed: function (cdx, membic) {
                var mt = fixCommonTextAnnoyances(membic.text.trim());
                var dd = jt.byId("mdtxtdiv" + cdx);
                if(dd.contentEditable !== "true") {  //expansion not done yet
                    return false; }
                var dt = fixCommonTextAnnoyances(dd.innerHTML.trim());
                return jt.toru(mt !== dt, dt); },
            write: function (chgval, updobj) {
                updobj.text = chgval; } },
        details: {
            closed: function () {
                return ""; },  //clutter. not always full/accurate 24jun20
            expanded: function (cdx, membic) {
                return detmgr.detailsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var dvo = detmgr.detailsValues(cdx, membic);
                return jt.toru(!objKVEq(dvo, membic.details), dvo); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                Object.keys(chgval).forEach(function (key) {
                    updobj.details[key] = chgval[key]; }); } },
        themes: {
            closed: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdptsdiv", id:"mdptsdiv" + cdx},
                     tpmgr.membicThemePostsHTML(cdx, membic, true)]); },
            expanded: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdptsdiv", id:"mdptsdiv" + cdx},
                     tpmgr.membicThemePostsHTML(cdx, membic)]); },
            changed: function (cdx, membic) {
                var tps = tpmgr.selectedPostThemes(cdx, membic);
                return jt.toru(tpmgr.themePostsChanged(membic, tps), tps); },
            write: function (chgval, updobj, membic) {
                updobj.svcdata = updobj.svcdata || copySvcData(membic);
                updobj.svcdata.postctms = chgval; } },
        keywords: {
            closed: function (cdx, membic) {
                return kwmgr.keywordsHTML(cdx, membic, false); },
            expanded: function (cdx, membic) {
                return kwmgr.keywordsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var kws = kwmgr.selectedKeywords(cdx, membic);
                return jt.toru(!kwmgr.equivKwrds(membic.keywords, kws),
                               kws || "unset_value"); },
            write: function (chgval, updobj) {
                updobj.keywords = chgval; } }
    };


    function formElementsVerb (expid) {
        if(expandedMembics[expid]) {
            return "expanded"; }
        return "closed";
    }


    function formElementHTML (name, cdx, membic) {
        var disp = formElementsVerb(membicExpId(membic));
        var html = formElements[name][disp](cdx, membic);
        //several elements are inline, but don't want divs inside spans
        return jt.tac2html(
            ["div", {cla:"mf" + name, id:"mf" + name + cdx}, html]);
    }


    //app.pcd does not have a display iteration completion hook, since that
    //would require differentiating between "more", no results, or max items
    //termination conditions.  If a membic needs further processing, this
    //kicks it off.  Only need to start the first read here.
    //readerFinish -> merge and saveMembic -> redisplay -> here.  Track
    //the scheduling timeout to avoid multiple simultaneous reads.
    function scheduleFollowupProcessing (cdx, membic) {
        if(cdx === 0) { //start of display pass through membics
            if(apso.apto) {  //clear any previously scheduled automation
                clearTimeout(apso.apto); }
            apso.apto = null; }
        //May only edit membic from your own profile display
        if(!apso.apto && membicDetailsUnread(membic)) {
            //Hold off on any scheduling until after user info verified
            var authobj = app.login.authenticated();
            //Avoid infinite scheduling. Verify call not started already.
            //Duplicate calls shouldn't happen, but if there is a timing issue
            //or a bug, looping needs to be impossible.
            if(authobj.verifyUserInfoComplete && !apso.started[membic.dsId]) {
                apso.started[membic.dsId] = new Date().toISOString();
                var des = "Followup read Membic " + membic.dsId;
                jt.log(des);
                apso.apto = app.fork({descr:des, ms:800, func:function () {
                    startReader(membic); }}); } }
    }


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    //If this method is called while the membics are being filtered, then it
    //is possible some or all of the UI element updates may fail.  That's
    //tolerable as the expandedMembics entry will have been updated and the
    //display state will reflect that when the membic is rendered.
    toggleMembic: function (idx, exp, membic) {
        var mbcs = app.pcd.getDisplayContext().actobj.itlist;
        membic = membic || mbcs[idx];
        if(idx < 0) {
            idx = mbcs.findIndex((mbc) => mbc.dsId === membic.dsId); }
        var expid = membicExpId(membic);
        if(exp === "closed") {
            expandedMembics[expid] = ""; }
        else if(exp === "unchanged") {  //essentially a display refresh
            expandedMembics[expid] = expandedMembics[expid] || ""; }
        else if(exp) {  //opened.  use exp value as open value
            expandedMembics[expid] = exp; }
        else {  //invert whatever state it was in.
            expandedMembics[expid] = !expandedMembics[expid]; }
        var disp = formElementsVerb(expid);
        Object.keys(formElements).forEach(function (key) {
            jt.out("mf" + key + idx, formElements[key][disp](idx, membic)); });
    },


    addMembic: function (step) {
        var inval;
        step = step || "start";
        switch(step) {
        case "start":
            inval = "";
            if(addmem && addmem.rurl) { //previous add not completed
                inval = addmem.rurl; }
            jt.out("newmembicdiv", jt.tac2html(
                ["form", {id:"newmembicform"},
                 [["div", {cla:"nmformlinediv"},
                   [["label", {fo:"urlinput", title:"Memorable Link"}, "URL"],
                    ["input", {type:"url", id:"urlinput", //size via CSS
                               placeholder:"Paste Memorable Link Here",
                               required:"required", value:inval,
                               onchange:jt.fs("app.membic.amfact(event)")}]]],
                  ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
                  ["div", {cla:"nmformlinediv"},
                   ["div", {id:"ambuttonsdiv"},
                    ["button", {type:"submit"}, "Make Membic"]]]]]));
            jt.on("newmembicform", "submit", app.membic.amfact);
            verifyMayPost("newmembicdiv");
            break;
        case "whymem":
            if(!jt.byId("newmembicform").checkValidity()) {
                return; }  //fill in the url properly first.
            addmem = {rurl:jt.byId("urlinput").value};
            startReader(addmem);
            jt.out("newmembicform", jt.tac2html(
                [["div", {id:"newmembicurldiv", cla:"nmformlinediv"},
                  addmem.rurl],
                 ["div", {cla:"nmformlinediv"},
                  [["label", {fo:"whymemin", title:"Why memorable?"}, "Why?"],
                   ["input", {type:"text", id:"whymemin", //no size, use CSS
                              placeholder:"What's memorable about it?",
                              onchange:jt.fs("app.membic.amfact(event)")}]]],
                 ["div", {cla:"nmformlinediv", id:"amprocmsgdiv"}],
                 ["div", {cla:"nmformlinediv"},
                  ["div", {id:"ambuttonsdiv"},
                   [["button", {type:"button",
                                onclick:jt.fs("app.membic.addMembic()")},
                     "Cancel"],
                    //form submit action set up in first step
                    ["button", {type:"submit"}, "Add"]]]]]));
            jt.byId("whymemin").focus();
            break;
        case "addit":
            if(!jt.byId("newmembicform").checkValidity()) {
                return; }  //fix why memorable if needed
            addmem.text = jt.byId("whymemin").value;
            addmem.rating = ratmgr.rati.dfltv;
            addmem.revtype = addmem.revtype || "article";
            jt.out("amprocmsgdiv", "Writing membic...");
            jt.byId("ambuttonsdiv").style.display = "none";
            saveMembic("addMembic addit", addmem, 
                function () {
                    addmem = null;  //reset for next membic creation
                    app.membic.addMembic("start"); },
                function (code, errtxt) {
                    jt.log("saveMembic failed " + code + " " + errtxt);
                    jt.out("amprocmsgdiv", errtxt);
                    jt.byId("ambuttonsdiv").style.display = "block"; });
            break;
        default:
            jt.log("addMembic unknown step: " + step); }
    },
    amfact: function (event) {
        jt.evtend(event);
        if(jt.byId("urlinput")) {
            var urlin = jt.byId("urlinput");
            if(!urlin.value.startsWith("http")) {
                urlin.value = "https://" + urlin.value; }
            app.membic.addMembic("whymem"); }
        else if(jt.byId("whymemin")) {
            app.membic.addMembic("addit"); }
    },


    actcode: function (event) {
        jt.evtend(event);
        var code = jt.byId("actcin").value;
        if(!code) {
            return; }  //not an error and doesn't require explanation
        jt.out("amprocmsgdiv", "Activating account...");
        jt.byId("ambuttonsdiv").style.display = "none";
        app.login.updateProfile({actcode:code},
            function () { //updated auth and account already cached
                jt.out("amprocmsgdiv", "Account Activated!");
                app.fork({descr:"End account activation form", ms:800,
                          func:app.login.rebuildContext}); },
            function (code, errtxt) {
                jt.out("amprocmsgdiv", "Activation failed: " + code + " " +
                       errtxt);
                jt.byId("ambuttonsdiv").style.display = "block"; });
    },


    //Merge the retrieved membic details.  If this is a new membic, there
    //may or may not be an outstanding save going on.
    readerFinish: function (membic, result, msg) {
        var ur = membic.svcdata.urlreader;
        ur.status = "finished";
        ur.result = result;
        var le = ur.log[ur.log.length - 1];
        le.end = new Date().toISOString();
        le.msg = msg;
        jt.log("membic.readerFinish " + JSON.stringify(ur));
        if(addmem && !savind && //still working off addmem and not saved yet
           addmem.rurl === membic.rurl) {  //and not way out of sync
            jt.log("membic.readerFinish result merged into addmem");
            return; }  //url read data will be recorded on save.
        jt.log("membic.readerFinish merging into previously saved membic");
        mergeURLReadInfoIntoSavedMembic(membic);
    },


    formHTML: function (cdx, membic) {
        scheduleFollowupProcessing(cdx, membic);
        return jt.tac2html(
            //include membic data for debugging. 
            ["div", {cla:"mdouterdiv", "data-dsId":membic.dsId,
                     "data-ctmid":membic.ctmid, "data-srcrev":membic.srcrev},
             ["div", {cla:"mdinnerdiv"},
              [["a", {href:"#expand" + cdx, title:"Toggle Membic Expansion",
                    onclick:jt.fs("app.membic.toggleMembic(" + cdx + ")")},
                ["img", {cla:"mbtkebabimg", src:app.dr("img/kebab.png")}]],
               formElementHTML("title", cdx, membic),
               formElementHTML("share", cdx, membic),
               ["div", {cla:"mdheaderline"},
                [formElementHTML("revtype", cdx, membic),
                 formElementHTML("byline", cdx, membic),
                 formElementHTML("stars", cdx, membic)]],
               ["div", {cla:"mddlgbsdiv"},
                formElementHTML("dlgbs", cdx, membic)],
               ["div", {cla:"mdrdrdetdiv"},
                formElementHTML("imgrdr", cdx, membic)],
               ["div", {cla:"mdbodydiv"},
                [formElementHTML("picture", cdx, membic),
                 formElementHTML("text", cdx, membic),
                 formElementHTML("details", cdx, membic),
                 formElementHTML("themes", cdx, membic),
                 formElementHTML("keywords", cdx, membic)]]]]]);
    },


    formDispatch: function (formpartname, funcname, cdx) {
        formElements[formpartname][funcname](cdx);
    },


    //It is conceivable to be editing one membic and then clobber the
    //timeout by quickly editing another, but that is extremely unlikely and
    //trivial to recover.  Just tracking the one timeout sweep.
    formInput: function (cdx) {
        if(rto) {  //already waiting to react to changes
            return; }
        //avoid redrawing any edits that haven't been saved yet.
        rto = app.fork({descr:"Check Membic changes", ms:800, func:function () {
            rto = null;
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var disp = formElementsVerb(membicExpId(membic));
            jt.out("mfdlgbs" + cdx, formElements.dlgbs[disp](cdx, membic)); }});
    },

    placeholdercheck: function (event) {
        if(event.type === "blur" && !event.target.innerText) {
            event.target.innerText = event.target.dataset.placetext; }
        else if(event.type === "focus" &&
                event.target.innerText === event.target.dataset.placetext) {
            event.target.innerHTML = ""; }
    },


    managerDispatch: function (mgrname, fname, ...args) {
        switch(mgrname) {
        case "rdrmgr": return rdrmgr[fname].apply(app.membic, args);
        case "tpmgr": return tpmgr[fname].apply(app.membic, args);
        case "typemgr": return typemgr[fname].apply(app.membic, args);
        case "ratmgr": return ratmgr[fname].apply(app.membic, args);
        case "sharemgr": return sharemgr[fname].apply(app.membic, args);
        case "detmgr": return detmgr[fname].apply(app.membic, args);
        default: jt.log("membic.managerDispatch unknown manager: " + mgrname); }
    }


}; //end of returned functions
}());
