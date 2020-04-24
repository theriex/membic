/*global window, confirm, app, jt, google, document */

/*jslint browser, white, fudge, for, long */

app.membic = (function () {
    "use strict";

    var addmem = null;  //The new membic being added
    var savind = "";    //Ongoing save indicator
    var expandedMembics = {};  //currently expanded membics (by src membic id)
    var formElements = null;  //forward declare to avoid circular func refs
    var rto = null;  //input reaction timeout

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

    //Thought about adding membic share button to make your own membic off
    //of an existing one, but that adds complexity, would likely be of very
    //limited use, and detract from the external nature of sharing.  To make
    //a membic off an existing membic you can always use the mail share and
    //mail it in.
    function membicShareHTML (membic) {
        var subj = membic.text;
        var body = membic.url;
        var mlink = "mailto:?subject=" + jt.dquotenc(subj) + "&body=" +
            jt.dquotenc(body) + "%0A%0A";
        return jt.tac2html(app.layout.shareButtonsTAC(
            {url:membic.url,
             title:membic.text,
             mref:mlink,
             socmed:["tw", "fb", "em"]}));
    }


    function mayEdit (membic) {
        var prof = app.profile.myProfile();
        if(prof && prof.dsId === membic.penid) {
            return true; }
        return false;
    }


    function safeInner (tagid) {
        var elem = jt.byId(tagid);
        if(!elem) {
            return ""; }
        return elem.innerHTML;
    }


    //If the theme is not cached, then there is no modified value to use as
    //an appropriate cache bust parameter.  Since a plain img src reference
    //can hang around for a potentially really long time, this uses a one
    //hour time slug with minutes removed.  That provides for re-use across
    //multiple display uses with eventual refresh.
    function themeImgSrc(tid) {
        var theme = app.refmgr.cached("Theme", tid);
        if(theme) {
            return app.pcd.picImgSrc(theme); }
        return app.dr("/api/obimg?dt=Theme&di=" + tid + jt.ts("&cb=", "hour"));
    }


    //As you accumulate themes over time, you don't want to keep seeing
    //suggestions for older archives.
    function membicThemePostsHTML (cdx, membic) {
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.postctms = membic.svcdata.postctms || [];
        if(!mayEdit(membic) && !membic.svcdata.postctms.length) {
            return ""; }
        var links = [];
        var tidcsv = "";
        membic.svcdata.postctms.forEach(function (pn) {
            tidcsv = tidcsv.csvappend(pn.ctmid);
            var html = [
                ["a", {href:app.dr("theme/" + pn.ctmid),
                       onclick:jt.fs("app.statemgr.setState('Theme','" +
                                     pn.ctmid + "')")},
                 [["img", {src:themeImgSrc(pn.ctmid)}],
                  pn.name]]];
            if(mayEdit(membic)) {
                //onclick of the '+' it changes to a select with options
                //built from preferred themes minus those already selected.
                //onchange of theme selection, it converts to a postnote
                //with a remove.
                html.push(
                    ["button", {type:"button", title:"Remove membic from theme",
                                onclick:jt.fs("app.membic.removepost(" + cdx +
                                              ",'" + pn.ctmid + "')")},
                     "x"]); }
            links.push(jt.tac2html(
                ["div", {cla:"postnotediv"}, html])); });
        if(mayEdit(membic)) {
            links.push(jt.tac2html(
                ["div", {cla:"postnotediv", id:"addthemepostdiv" + cdx},
                 ["button", {type:"button", title:"Add Theme Post",
                             onclick:jt.fs("app.membic.themeselect(" + cdx + 
                                           ")")},
                  "+"]])); }
        return jt.tac2html(
            ["div", {cla:"postnotescontainerdiv"},
             [["span", {id:"postedthemeids" + cdx, style:"display:none"},
               tidcsv],
              ["span", {cla:"masptlab"}, "Posted to: "],
              links.join(" | ")]]);
    }


    function selectedPostThemes (cdx, membic) {
        var postctms = membic.svcdata.postctms;
        var pns = [];
        var tids = jt.byId("postedthemeids" + cdx);
        if(!tids) {  //checking if changed before csv written to HTML
            return postctms; }
        tids = tids.innerHTML;
        tids.csvarray().forEach(function (tid) {
            var currpn = postctms.find((pn) => pn.ctmid === tid);
            if(currpn) {  //existing post
                pns.push(currpn); }
            else {  //new post
                var proftheme = app.profile.myProfile().themes[tid];
                pns.push({ctmid:tid, name:proftheme.name, revid:0}); } });
        return pns;
    }


    function themePostsChanged (membic, tps) {
        var postctms = membic.svcdata.postctms;
        function postin (entry, posts) {
            return posts.find((post) => post.ctmid === entry.ctmid); }
        var same = (postctms.every((pn) => postin(pn, tps)) &&
                    tps.every((tp) => postin(tp, postctms)));
        return !same;
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


    function saveMembic (savemembic, contf, failf) {
        savind = new Date().toISOString();  //indicate we are saving
        var url = app.login.authURL("/api/membicsave");
        var pcdo = app.pcd.getDisplayContext().actobj.contextobj;
        if(pcdo.dsType === "Theme") {
            url += "&themecontext=" + pcdo.dsId; }
        jt.call("POST", url, app.refmgr.postdata(savemembic),
                //The updated MUser is always the first item returned,
                //followed by the display context Theme if specified.
                function (pots) {  //profile or/and theme object(s)
                    savind = "";
                    pots.forEach(function (pot) {  //deserialize so ready to use
                        app.refmgr.deserialize(pot); });
                    var profmem = pots[0].preb[0];  //profile membic
                    profmem.postnotes.forEach(function (pn) {  //clear outdated
                        app.refmgr.uncache("Theme", pn.ctmid); });
                    pots.forEach(function (pot) {  //update all given data
                        app.refmgr.put(pot); });
                    expandedMembics[profmem.dsId] = "expandedpostsave";
                    var dispobj = pots[pots.length - 1];
                    app.pcd.fetchAndDisplay(dispobj.dsType, dispobj.dsId);
                    if(contf) {
                        contf(profmem); } },
                function (code, errtxt) {
                    savind = "";
                    jt.log("saveMembic " + savemembic.dsId + " " + code + ": " +
                           errtxt);
                    if(failf) {
                        failf(code, errtxt); } },
                jt.semaphore("membic.saveMembic"));
    }


    function mergeURLReadInfoIntoSavedMembic (membic) {
        if(savind) {  //currently saving, wait and retry
            return app.fork({descr:"Merge Details " + membic.rurl,
                             ms:2000,
                             func:function () {
                                 mergeURLReadInfoIntoSavedMembic(membic); }}); }
        //not currently saving, find target membic in profile
        var tm = app.profile.myProfile()
            .preb.find((cand) => cand.rurl === membic.rurl);
        tm.url = membic.url || membic.rurl;
        tm.details = membic.details || {};
        tm.revtype = membic.revtype || "article";
        tm.rating = ratmgr.rati.dfltv;
        tm.keywords = "";
        saveMembic(tm);
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


    function startReader (membic) {
        var readername = readerModuleForURL(membic.rurl);
        membic.svcdata = membic.svcdata || {};
        membic.svcdata.urlreader = membic.svcdata.urlreader || {};
        var reader = membic.svcdata.urlreader;
        reader.name = readername;
        reader.status = "reading";
        reader.result = "partial";
        reader.log = reader.log || [];  //could be a log from a previous read
        reader.log.push({start:new Date().toISOString()});
        app.fork({descr:"app." + readername + ": " + addmem.rurl, ms:100,
                  func:function () {
                      app[readername].getInfo(membic, membic.rurl); }});
    }


    //Return the preb field index (iterator state index) for the membic.
    function pfiForMembic (membic) {
        return app.profile.myProfile()
            .preb.findIndex((cand) => cand.dsId === membic.dsId);
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
                        onclick:jt.fs("app.profile.actCodeHelp()")},
                  "no code?"],
                 ["button", {type:"submit"}, "Activate Account"]]]]]]));
        jt.on("newmembicform", "submit", app.membic.actcode);
    }


    function mayRemove (membic) {
        var auth = app.login.authenticated();
        if(auth && app.theme.memberlev(membic.ctmid) >= 2) {
            return true; }
        return false;
    }


    function membicImgSrc (membic) {
        //upldpic is not supported anymore except for compatibility
        membic.svcdata = membic.svcdata || {};
        if(!membic.svcdata.picdisp) {
            if(membic.imguri) {
                membic.svcdata.picdisp = "sitepic"; }
            else if(membic.revpic) {
                membic.svcdata.picdisp = "upldpic"; }
            else {
                membic.svcdata.picdisp = "nopic"; } }
        var imgsrc = app.dr("img/blank.png");
        switch(membic.svcdata.picdisp) {
        case "sitepic":
            imgsrc = "/api/imagerelay?membicid=" + membic.dsId;
            break;
        case "upldpic":
            imgsrc = "/api/obimg?dt=Membic&di=" + membic.dsId;
            break; }
        return imgsrc;
    }


    function dispatchFStr (cdx, formfuncstr) {
        formfuncstr = formfuncstr.split(".");
        return jt.fs("app.membic.formDispatch('" + formfuncstr[0] + "','" +
                     formfuncstr[1] + "'," + cdx + ")");
    }


    //Return a new object with the fields used for the details area of
    //membic display and editing form.  The name/title fields are handled
    //separately so they are not included here.
    function initNewDetailsObject () {
        return {artist:"", author:"", publisher:"", album:"",
                starring:"", address:"", year:""};
    }


    //Custom detail fields are allowed, but lower case letters only.
    //Removing the value from a detail attribute effectively removes it from
    //the display when saved.  Slightly clunky, but not expecting heavy use
    //and want to minimize the number of controls on screen.
    function detailsHTML (cdx, membic, edit) {
        var detobj = initNewDetailsObject();
        membic.details = membic.details || {};
        Object.keys(membic.details).forEach(function (key) {
            if(key !== "title" && key !== "name") {
                detobj[key] = membic.details[key]; } });
        var chgfstr = jt.fs("app.membic.formInput(" + cdx + ")");
        var dlos = [];  //datalist options for adding other detail fields
        var html = [];
        Object.keys(detobj).forEach(function (key) {
            if(detobj[key]) { html.push(jt.tac2html(
                ["tr",
                 [["td", {cla:"detailattrtd"}, key],
                  ["td", {cla:"detailvaltd", 
                          id:"detail" + key + "valtd" + cdx,
                          contenteditable:jt.toru(edit, "true"),
                          oninput:jt.toru(edit, chgfstr)}, 
                   detobj[key]]]])); } });
        if(edit) {
            Object.keys(detobj).forEach(function (key) {
                if(!detobj[key]) {
                    dlos.push(["option", {value:key}]); } });
            var dlh = "";
            if(dlos.length) {
                dlh = jt.tac2html(["datalist", {id:"detnewattroptsdl" + cdx},
                                   dlos]); }
            html.push(jt.tac2html(
                ["tr",
                 [["td", {cla:"detailattrtd"},
                   [["input", {type:"text", cla:"detnewattrin",
                               id:"detnewattrin" + cdx,
                               placeholder:"attribute", value:"",
                               list:"detnewattroptsdl" + cdx,
                               onchange:chgfstr}],
                    dlh]],
                  ["td", {cla:"detailvaltd"},
                   ["input", {type:"text", cla:"detnewvalin",
                              id:"detnewvalin" + cdx,
                              placeholder:"value", value:"",
                              onchange:chgfstr}]]]])); }
        return jt.tac2html(["div", {cla:"mddetdiv"},
                            ["table", {cla: "collapse"}, html]]);
    }


    //Check the values of the keys in the source object against those in the
    //comparison object.  Return true if they are all equal.  The cmp object
    //may have additional keys not found in the src.
    function objKVEq (src, cmp) {
        return Object.keys(src).every((key) => src[key] === cmp[key]);
    }


    //Construct a details object from the interface display.  The resulting
    //object can be used for comparison or update.  The user may enter a
    //custom detail attribute, and they can change or remove the value for
    //any existing attribute, but they cannot change the name of an existing
    //attribute, so it is sufficient to walk the displayed attributes to
    //construct the details object.
    function detailsValues (cdx) {
        var valobj = {};
        Object.keys(initNewDetailsObject()).forEach(function (key) {
            var td = jt.byId("detail" + key + "valtd" + cdx);
            if(td) {
                valobj[key] = td.innerHTML.trim(); } });
        var input = jt.byId("detnewattrin" + cdx);
        if(input && input.value.trim()) {  //adding a detail attribute
            var valin = jt.byId("detnewvalin" + cdx);
            if(valin && valin.value.trim()) {
                valobj[input.value.trim()] = valin.value.trim(); } }
        return valobj;
    }


    //Return all the possible keywords grouped by source.
    function keywordGroups (cdx, membic, selkwcsv) {
        selkwcsv = selkwcsv || membic.keywords;
        var mt = membicTypes.find((md) => md.type === membic.revtype);
        var keygrps = [{name:"", kwcsv:mt.dkwords.join(",")}];
        selectedPostThemes(cdx, membic).forEach(function (pn) {
            var proftheme = app.profile.myProfile().themes[pn.ctmid];
            keygrps.push({name:proftheme.name, kwcsv:proftheme.keywords}); });
        var knownkws = keygrps.reduce((acc, kg) => acc.csvappend(kg.kwcsv), "");
        knownkws = knownkws.toLowerCase();
        var akws = selkwcsv.csvarray()
            .filter((kw) => !knownkws.csvcontains(kw.toLowerCase()));
        keygrps.push({name:"Additional", kwcsv:akws.join(",")});
        return keygrps;
    }


    //Unlike theme posts, it's easier to see all the available keywords and
    //use checkboxes.  It's not great if the accumulated total gets really
    //long, but it's still way better than clicking a pulldown for each one.
    function keywordsHTML (cdx, membic, edit, selkwcsv) {
        if(!edit) {
            return jt.tac2html(["div", {cla:"mdkwsdiv"}, membic.keywords]); }
        selkwcsv = selkwcsv || membic.keywords;
        var html = [];
        keywordGroups(cdx, membic, selkwcsv).forEach(function (kg, idx) {
            if(kg.kwcsv) {
                var kwshtml = [];
                kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                    var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                    var bchk = selkwcsv.csvcontains(kwd);
                    kwshtml.push(
                        ["div", {cla:"mdkwdiv"},
                         [["input", {type:"checkbox", cla:"keywordcheckbox",
                                     id:kwid, value:kwd, checked:jt.toru(bchk),
                                     onclick:jt.fsd("app.membic.formInput(" +
                                                    cdx + ")")}],
                          ["label", {fo:kwid, id:kwid + "label"}, kwd]]]); });
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
                          onclick:dispatchFStr(cdx, "keywords.addnew")},
               "+"]]]));
        return jt.tac2html(
            ["div", {cla:"mdkwsdiv"},
             ["div", {id:"mdkwscontentdiv" + cdx}, html]]);
    }


    function selectedKeywords (cdx, membic) {
        var skws = "";
        var kwgs = keywordGroups(cdx, membic);
        kwgs.forEach(function (kg, idx) {
            kg.kwcsv.csvarray().forEach(function (kwd, csvidx) {
                var kwid = "m" + cdx + "g" + idx + "c" + csvidx;
                var kwi = jt.byId(kwid);
                if(!kwi) {  //UI not set up, return original keywords
                    skws = membic.keywords; }
                else if(kwi.checked) {
                    skws = skws.csvappend(kwd); } }); });
        var agi = kwgs.length - 1;  //additional keywords group index
        var pui = kwgs[agi].kwcsv.length;  //previously unknown index
        var newKeywordInput; var kwid;
        do {
            kwid = "m" + cdx + "g" + agi + "c" + pui;
            newKeywordInput = jt.byId(kwid);
            if(newKeywordInput && newKeywordInput.checked) {
                skws = skws.csvappend(safeInner(kwid + "label")); }
            pui += 1;
        } while(newKeywordInput);
        return skws;
    }


    function equivKeywords (kwsa, kwsb) {
        kwsa = kwsa.toLowerCase().csvarray().sort().join(",");
        kwsb = kwsb.toLowerCase().csvarray().sort().join(",");
        return (kwsa === kwsb);
    }


    function addNewKeywordOption (cdx) {
        var nkin = jt.byId("newkwin" + cdx);
        if(nkin && nkin.value) {
            var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
            var currkws = selectedKeywords(cdx, membic);
            currkws = currkws.csvappend(nkin.value);
            jt.out("mdkwscontentdiv" + cdx,
                   keywordsHTML(cdx, membic, true, currkws));
            app.membic.formInput(cdx); }
    }


    //If anything has been edited, return true.
    function membicEdited (cdx, membic) {
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
        return changed;
    }


    //Update the changed membic elements and redisplay closed to show
    //completion.  When the update was just a fix to the title or text,
    //redisplaying closed is the most intuitive, and provides more of a
    //"just works" kind of feel.  In cases where more editing is needed,
    //re-expanding still provides a sense of confirmation that the edits
    //took effect.  If an error occurs, then leave expanded with message.
    function updateMembic (cdx) {
        jt.out("dlgbsmsgdiv" + cdx, "");
        jt.out("dlgbsbdiv" + cdx, "Saving...");
        var membic = app.pcd.getDisplayContext().actobj.itlist[cdx];
        var updm = {dsType:"Membic", dsId:membic.dsId};
        Object.keys(formElements).forEach(function (key) {
            var chgval = formElements[key].changed(cdx, membic);
            if(chgval) {
                formElements[key].write(chgval, updm); } });
        jt.log("updateMembic: " + JSON.stringify(updm));
        //saveMembic...
    }


    //Mark the given membic as deleted, which will automatically trigger
    //removal of any corresponding theme posts.
    function markMembicDeleted (/*cdx*/) {
        jt.err("markMembicDeleted not implemented yet.");
    }


    //Remove the theme from postctms and save.  This is the one special case
    //where the founder/moderator can modify the membic.  The only thing
    //they can do is remove the postnote for the theme they are managing.
    function removeMembic (/*cdx*/) {
        jt.err("removeMembic not implemented yet.");
    }


    function formActionButtonsHTML (cdx, tac) {
        return jt.tac2html(
            [["div", {cla:"dlgbsmsgdiv", id:"dlgbsmsgdiv" + cdx}],
             ["div", {cla:"dlgbsbdiv", id:"dlgbsbdiv" + cdx},
              tac]]);
    }


    function formButton (name, ocstr, disabled) {
        var bas = {type:"button", cla:"membicformbutton", onclick:ocstr};
        if(disabled) {
            bas.disabled = true;
            bas.cla = "membicformbuttondisabled"; }
        return jt.tac2html(["button", bas, name]);
    }


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
                       onclick:jt.fs("app.membic.typesel(" + cdx + ",'" +
                                     mt.type + "',true)")},
                 typemgr.imgHTMLForType(cdx, mt)]); },
        selectClickHTML: function (cdx, mt, idsuf) {
            return jt.tac2html(
                ["a", {href:"#" + mt.type, title:"Select " + mt.type,
                       onclick:jt.fs("app.membic.typesel(" + cdx + ",'" +
                                     mt.type + "',false)")},
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
        imgi: {i:app.dr("img/stars18ptC.png"),
               g:app.dr("img/stars18ptCg.png"),
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
                var ehs = "app.membic.ratingEventDispatch(event)";
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


    formElements = {
        title: {
            closed: function (ignore /*cdx*/, membic) {
                var html = jt.tac2html(
                    ["a", {href:membic.url, title:membic.url,
                           onclick:jt.fs("window.open('" + membic.url + "')")},
                     (membic.details.title || membic.details.name)]);
                return html; },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.title.closed(cdx, membic); }
                return jt.tac2html(
                    ["span", {id:"mftitlespan" + cdx, contenteditable:"true",
                              oninput:jt.fs("app.membic.formInput(" + cdx +
                                            ")")},
                     (membic.details.title || membic.details.name)]); },
            changed: function (cdx, membic) {
                var mt = (membic.details.title || membic.details.name);
                mt.trim();
                var st = safeInner("mftitlespan" + cdx).trim();
                return jt.toru(mt !== st, st); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                updobj.details.title = chgval;
                updobj.details.name = chgval; } },
        share: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                return membicShareHTML(membic); },
            changed: function () { return false; },
            write: function () { return; } },
        revtype: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                var mt = typemgr.findType(membic.revtype);
                if(mayEdit(membic)) {
                    return typemgr.clickHTMLForType(cdx, mt); }
                else {
                    return typemgr.imgHTMLForType(mt); } },
            changed: function (cdx, membic) {
                var rt = jt.byId("revtypeimg" + cdx).title;
                return jt.toru(membic.revtype !== rt, rt); },
            write: function (chgval, updobj) {
                updobj.revtype = chgval; } },
        byline: {
            closed: function () { return ""; },
            expanded: function (ignore /*cdx*/, membic) {
                var cretxt = jt.colloquialDate(membic.created, "compress");
                return jt.tac2html(
                    [["span", {cla:"mascrespan"}, cretxt],
                     ["span", {cla:"masbyline"},
                      ["a", {href:"#" + membic.penid,
                             title:"Visit " + membic.penname,
                             onclick:jt.fs("app.statemgr.setState('MUser','" +
                                           membic.penid + "')")},
                       [["img", {src:app.profile.profimgsrc(membic.penid)}],
                        ["span", {cla:"penlight"}, membic.penname]]]]]); },
            changed: function () { return false; },
            write: function () { return; } },
        stars: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                return jt.tac2html(
                    ["span", {cla:"masratspan"},
                     ratmgr.getHTML(cdx, membic)]); },
            changed: function (cdx, membic) {
                var rat = ratmgr.ratingValue(cdx);
                return jt.toru(membic.rating !== rat, rat); },
            write: function (chgval, updobj) {
                updobj.rating = chgval; } },
        dlgbs: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) {
                    var edited = membicEdited(cdx, membic);
                    return jt.tac2html(
                        [["a", {href:"#delete", title:"Delete Membic",
                                onclick:dispatchFStr(cdx, "dlgbs.mrkdel")},
                          ["img", {cla:"masactbimg",
                                   src:app.dr("img/trash.png")}]],
                         formButton("Cancel", jt.fs("app.membic.toggleMembic(" +
                                                    cdx + ")"), !edited),
                         formButton("Save", dispatchFStr(cdx, "dlgbs.save"),
                                    !edited)]); }
                if(mayRemove(membic)) {
                    formActionButtonsHTML(cdx,
                        ["a", {href:"#remove", title:"Remove Theme Post",
                               onclick:dispatchFStr(cdx, "dlgbs.remove")},
                         ["img", {cla:"masactbimg",
                                  src:app.dr("img/trash.png")}]]); }
                return ""; },
            changed: function () { return false; },
            write: function () { return; },
            save: function (cdx) { updateMembic(cdx); },
            mrkdel: function (cdx) { markMembicDeleted(cdx); },
            remove: function (cdx) { removeMembic(cdx); } },
        picture: {
            closed: function (ignore /*cdx*/, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdpicdiv"},
                     ["a", {href:membic.url, title:membic.url,
                            onclick:jt.fs("window.open('" + membic.url + "')")},
                      ["img", {cla:"mdimg", src:membicImgSrc(membic)}]]]); },
            expanded: function (cdx, membic) {
                if(mayEdit(membic)) { //no link, too many clickables
                    return jt.tac2html(
                        ["div", {cla:"mdpicdiv"},
                         ["img", {cla:"mdimg", src:membicImgSrc(membic)}]]); }
                return formElements.picture.closed(cdx, membic); },
            changed: function () { return false; },
            write: function () { return; } },
        text: {
            closed: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdtxtdiv", id:"mdtxtdiv" + cdx,
                             onclick:jt.toru(mayEdit(membic), jt.fs(
                                 "app.membic.toggleMembic(" + cdx + ")"))},
                     jt.linkify(membic.text)]); },
            expanded: function (cdx, membic) {
                if(!mayEdit(membic)) {
                    return formElements.text.closed(cdx, membic); }
                return jt.tac2html(
                    ["div", {cla:"mdtxtdiv", contenteditable:"true",
                             id:"mdtxtdiv" + cdx,
                             oninput:jt.fs("app.membic.formInput(" + cdx +
                                           ")")}, membic.text]); },
            changed: function (cdx, membic) {
                var mt = membic.text.trim();
                var dt = jt.byId("mdtxtdiv" + cdx).innerHTML.trim();
                return jt.toru(mt !== dt, dt); },
            write: function (chgval, updobj) {
                updobj.text = chgval; } },
        details: {
            closed: function (cdx, membic) {
                return detailsHTML(cdx, membic, false); },
            expanded: function (cdx, membic) {
                return detailsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var dvo = detailsValues(cdx, membic);
                return jt.toru(!objKVEq(dvo, membic.details), dvo); },
            write: function (chgval, updobj) {
                updobj.details = updobj.details || {};
                Object.keys(chgval).forEach(function (key) {
                    updobj.details[key] = chgval[key]; }); } },
        themes: {
            closed: function () { return ""; },
            expanded: function (cdx, membic) {
                return jt.tac2html(
                    ["div", {cla:"mdptsdiv", id:"mdptsdiv" + cdx},
                     membicThemePostsHTML(cdx, membic)]); },
            changed: function (cdx, membic) {
                var tps = selectedPostThemes(cdx, membic);
                return jt.toru(themePostsChanged(membic, tps), tps); },
            write: function (chgval, updobj) {
                updobj.svcdata = updobj.svcdata || {};
                updobj.svcdata.postctms = chgval; } },
        keywords: {
            closed: function (cdx, membic) {
                return keywordsHTML(cdx, membic, false); },
            expanded: function (cdx, membic) {
                return keywordsHTML(cdx, membic, mayEdit(membic)); },
            changed: function (cdx, membic) {
                var kws = selectedKeywords(cdx, membic);
                return jt.toru(!equivKeywords(membic.keywords, kws), kws); },
            write: function (chgval, updobj) {
                updobj.keywords = chgval; },
            addnew: function (cdx) {
                addNewKeywordOption(cdx); } }
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


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    toggleMembic: function (idx, exp) {
        var membic = app.pcd.getDisplayContext().actobj.itlist[idx];
        var expid = membicExpId(membic);
        expandedMembics[expid] = exp || !expandedMembics[expid];
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
            addmem.text = jt.byId("whymemin");
            jt.out("amprocmsgdiv", "Writing membic...");
            jt.byId("ambuttonsdiv").style.display = "none";
            saveMembic(addmem, 
                function (membic) {
                    addmem = null;  //reset for next membic creation
                    app.membic.toggleMembic(pfiForMembic(membic), "expand");
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
        app.profile.update({actcode:code},
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
        if(addmem && !savind && //still working off addmem and not saved yet
           addmem.rurl === membic.rurl) {  //and not way out of sync
            return; }  //url read data will be recorded on save.
        mergeURLReadInfoIntoSavedMembic(membic);
    },


    formHTML: function (cdx, membic) {
        return jt.tac2html(
            ["div", {cla:"mdouterdiv"},
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


    ratingEventDispatch: function (event) { ratmgr.handleEvent(event); },
    typesel: function (c, t, e) { typemgr.typesel(c, t, e); }

}; //end of returned functions
}());

