/*global app, jt, unescape */

/*jslint browser, white, fudge, for */


//////////////////////////////////////////////////////////////////////
// This is a catchall reader that does the best it can to fill out
// some of the review fields using information generally available
// from any url.  If there are standards for declaring media that are
// in general use then this is the place to support them.  Anything
// seriously specific to a particular URL probably indicates the need
// for a separate reader.
//////////////////////////////////////////////////////////////////////

app.readurl = (function () {
    "use strict";

    var svcName = "URLReader";  //ascii with no spaces, used as an id.
    //no attribution since no API provided.


    function valueForField (elem, field) {
        var idx = elem.indexOf(field);
        if(idx >= 0) {
            var val = elem.slice(idx + field.length);
            idx = val.indexOf("\"");
            if(idx >= 0) {  //double quote delimited
                val = val.slice(idx + 1);
                idx = val.indexOf("\"");
                if(idx >= 0) {
                    val = val.slice(0, idx);
                    return val; } }
            idx = val.indexOf("'");
            if(idx >= 0) {  //single quote delimited
                val = val.slice(idx + 1);
                idx = val.indexOf("'");
                if(idx >= 0) {
                    val = val.slice(0, idx);
                    return val; } } }
        return "";
    }


    function elementForStringSearch (html, targetstr, elemtype) {
        var found = false; var start; var end; var idx; var str = "";
        idx = html.indexOf(targetstr);
        while(!found && idx >= 0) {
            start = html.lastIndexOf("<", idx);
            end = html.indexOf(">", idx);
            str = html.slice(start, end + 1);
            if(str.indexOf("<" + elemtype) === 0) {
                found = true; }
            else {
                found = false;
                str = "";  //reset to avoid returning bad interim tags
                idx = html.indexOf(targetstr, idx + 1); } }
        return str;
    }


    function elementForString (html, targetstr, elemtype) {
        var str = elementForStringSearch(html, targetstr, elemtype);
        if(!str) {
            //src for at least rottentomatoes shows up fully escaped
            html = unescape(html);
            str = elementForStringSearch(html, targetstr, elemtype); }
        return str;
    }


    function findTagContents (html, tagname, url) {
        var content = "";
        try {
            var idx = html.indexOf("<" + tagname);
            if(idx >= 0) {
                content = html.slice(idx + 1);
                idx = content.indexOf(">");
                content = content.slice(idx + 1);
                idx = content.indexOf("<");
                content = content.slice(0, idx); }
            } catch (problem) {
                jt.log("readurl " + url + " findTagContents: " + problem);
            }
        return content;
    }


    function verifyFullURL (val, url) {
        var urlbase;
        if(val.indexOf("http") >= 0) {
            return val; }
        if(val.indexOf("/") === 0) {  //hard url off root
            urlbase = url.split("?")[0];
            if(urlbase.lastIndexOf("/") > 9) {
                urlbase = urlbase.slice(0, urlbase.indexOf("/", 9)); }
            return urlbase + "/" + val; }
        //relative url
        urlbase = url.split("?")[0];
        var idx = urlbase.lastIndexOf("/");
        if(idx > 9) {  //the slashes at the start don't count
            urlbase = urlbase.slice(0, idx); }
        idx = urlbase.lastIndexOf("/");
        if(idx <= 9) {
            urlbase += "/"; }
        return urlbase + val;
    }


    function setImageURI (review, html, url) {
        var val;
        var elem = elementForString(html, "image_src", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
        elem = elementForString(html, "og:image", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
        elem = elementForString(html, "twitter:image", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
        if(url.indexOf("netflix.") >= 0) {
            elem = elementForString(html, "thumbnailUrl", "img");
            if(elem) {
                val = valueForField(elem, "src");
                if(val) {
                    review.imguri = val;
                    val = valueForField(elem, "alt");
                    review.title = val;
                    return; } } }
        //try groping in the dark for some kind of logo...
        var index = html.search(/src=[A-Za-z0-9'"\/]*logo\.png/i);
        if(index < 0) {  //try same regex again, but unescape the html
            index = unescape(html).search(/src=[A-Za-z0-9'"\/]*logo\.png/i);
            if(index >= 0) {
                html = unescape(html); } }
        if(index > 0) {
            val = html.slice(index + 5);
            val = val.slice(0, val.toLowerCase().indexOf(".png") + 4);
            review.imguri = verifyFullURL(val, url);
            return; }
        //last ditch, try the favicon just to show we saw data and tried
        elem = elementForString(html, "icon", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                review.imguri = verifyFullURL(val, url);
                return; } }
    }


    //In at least one use case, the query string part of the url was
    //needed to reach the linked content, and the returned canonical
    //value was just the base site url.  While it's nice to have
    //extraneous url crap cleaned up by a canonical link declaration,
    //failing to actually link to the content is not an option.  If
    //the canonical url is less specific than the original, then go
    //with the original to avoid that problem.
    function probableInfoLoss (canonical, original) {
        if(original.startsWith(canonical)) {
            return true; }
        return false;
    }


    function setCanonicalURL (review, html, url) {
        var val;
        review.rurl = url;  //keep original in case canonical fails
        //the Facebook url is frequently better than the canonical link
        var elem = elementForString(html, "og:url", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                val = verifyFullURL(val, url);
                if(!probableInfoLoss(val, url)) {
                    review.url = val;
                    return; } } }
        elem = elementForString(html, "canonical", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                val = verifyFullURL(val, url);
                if(!probableInfoLoss(val, url)) {
                    review.url = val;
                    return; } } }
    }


    //Set the type if it is unambigous, and there is no specific
    //supporting extension module other than this general reader.
    function setReviewType (review, ignore /*html*/, url) {
        var typemaps = [
            { urltxt: "imdb.", revtype: "movie" },
            { urltxt: "netflix.", revtype: "movie" },
            { urltxt: "rottentomatoes.", revtype: "movie" },
            { urltxt: "soundcloud.", revtype: "music" },
            { urltxt: "vimeo.", revtype: "video" },
            { urltxt: "youtube.", revtype: "video" } ];
        url = url.toLowerCase();
        typemaps.every(function (typemap) {
            if(url.indexOf(typemap.urltxt) >= 0) {
                review.revtype = typemap.revtype;
                return false; }
            return true; });
    }
    

    function fixSpamdexing (val) {
        //choose the first real value out of any multi-line title
        if(val.indexOf("\n") >= 0) {
            var vs = val.split("\n");
            vs.some(function (line) {
                if(line && line.trim()) {
                    val = line;
                    return true; } }); }
        //remove any preceding or trailing whitespace
        val = val.trim();
        //remove known useless prefixes
        val = val.replace(/Home\s[|\-]\s/ig, "");
        val = val.replace(/Welcome\s[|\-]\s/ig, "");
        //remove known useless suffixes (not as important, but still helpful)
        val = val.replace(/\s[|\-]\sHome/ig, "");
        return val;
    }


    function commonUnicodeConversions (val) {
        //When this file first started, unicode characters would
        //occasionally come through spelled out in escape sequences.  Some
        //of those sequences were trapped and converted on a case-by-case
        //basis to keep things rolling. For example a variant of a right
        //leaning quotation mark was replaced with an apostrophe.  A better
        //solution would be to generally re-encode the sequences, or
        //trace/fix why the encoding broke in the first place.  It would be
        //good for title strings and other text to come through unscathed
        //regardless of language or emojii.
        //
        //The one exception I'm keeping here is to replace the long emphasis
        //dash with a standard ascii dash surrounded by spaces.  The reason
        //is that people use the long dash to sneak through ridiculously
        //long titles that can't be obviously truncated.
        val = val.replace(/—/g, " - ");
        return val;
    }



    function setTitle (review, html, url) {
        var val;
        if(review.acselkeyval) {  //if the name was selected from an 
            review.title = val;   //autocomplete display listing, then
            review.name = val;    //don't change it here
            return; }
        //the Facebook title is frequently better than the default tag title
        var elem = elementForString(html, "og:title", "meta");
        if(elem) {
            val = valueForField(elem, "content"); }
        if(!val || !val.trim()) {
            val = findTagContents(html, "title", url);
            if(!val) {
                val = findTagContents(html, "TITLE", url); } }
        if(val) {
            val = fixSpamdexing(val);
            //decodeURIComponent not needed, but catch common extra encodings..
            val = val.replace(/&#x27;/g, "'");
            val = val.replace(/&#039;/g, "'");
            val = val.replace(/&quot;/g, "\"");
            val = val.replace(/&amp;/g, "&");
            val = val.replace(/&#8211;/g, "-");
            //ignore any other special sequences that look bad as text.
            //matches crap like "&raquo;"
            val = val.replace(/&#?x?\S\S\S?\S?\S?;/g, "");
            val = commonUnicodeConversions(val);
            review.title = val.trim();
            review.name = val; }
    }


    //Attempt to parse the title.  Add smarts on case basis.  In
    //general, guessing artist, title is most likely due to players
    //organizing music by artist, then album, then title
    function parseTitle (review) {
        if(!review.title) {
            return; }
        var text = review.title;
        //case: "artist - title"
        //e.g. http://www.youtube.com/watch?v=KnIJOO__jVo
        if(text.indexOf(" - ") > 0) {
            //text.split(" - ", 2) is supposed to give you the first element
            //and then the rest of the string as the second, but it doesn't
            text = text.split(" - ");
            review.artist = text[0].trim();
            review.title = "";
            var i;
            for(i = 1; i < text.length; i += 1) {
                if(review.title) {
                    review.title += " - "; }
                review.title += text[i].trim(); } }
        //case: "artist: title"
        //e.g. http://www.youtube.com/watch?v=tHOn093r-Ak
        else if(text.indexOf(": ") > 0) {
            text = text.split(": ", 2);
            review.artist = text[0].trim();
            review.title = text[1].trim(); }
    }


    function setPublisher (review, html) {
        var elem; var val;
        if(!review.publisher) {
            if(!val) {
                elem = elementForString(html, "og:site_name", "meta");
                if(elem) {
                    val = valueForField(elem, "content"); } }
            if(!val) {
                elem = elementForString(html, "name=\"cre\"", "meta");
                if(elem) {
                    val = valueForField(elem, "content"); } }
            if(val) {
                review.publisher = val; } }
    }


    function setAuthor (review, html, url) {
        var val;
        var brokens = [
                {src: "washingtonpost", reg: /author:\["([^"]+)/},
                {src: "huffingtonpost", reg: /author":\{[^}]*name":"([^"]+)/},
                {src: "politi.co", reg: /content_author":"([^"]+)/}];
        if(!review.author) {
            //looking for "author" should pick up either 
            //<meta content="whoever" name="author">
            //<meta itemprop="author" content="whoever">
            var elem = elementForString(html, "author", "meta");
            if(elem) {
                val = valueForField(elem, "content"); }
            if(!val || val.startsWith("http")) {
                brokens.forEach(function (custom) {
                    if(url.indexOf(custom.src) >= 0) {
                        elem = html.match(custom.reg);
                        if(elem && elem.length > 1) {
                            val = elem[1]; } } }); }
            if(val) {
                review.author = val; } }
    }


    function setReviewFields (review, html, url) {
        setReviewType(review, html, url);
        setTitle(review, html, url);
        if(review.revtype === "video") {  //try to be smart about music vids
            parseTitle(review); }
        setPublisher(review, html);
        setAuthor(review, html, url);
        setImageURI(review, html, url);
        if(review.imguri) {
            review.svcdata = review.svcdata || {};
            review.svcdata.picdisp = "sitepic"; }
        setCanonicalURL(review, html, url);
    }


    function readAsThemeName (membic, mimc, line) {
        var cm = "themes:";
        if(line) {
            if(line.toLowerCase().startsWith(cm)) {
                line.slice(cm.length).csvarray().forEach(function (thn) {
                    readAsThemeName(membic, mimc, thn.trim()); });
                line = ""; }
            var prof = app.profile.myProfile();
            if(line && prof) {
                Object.keys(prof.coops).forEach(function (ctmid) {
                    var theme = prof.coops[ctmid];
                    if(theme.name.toLowerCase() === line.toLowerCase()) {
                        mimc.themes.push(ctmid);
                        line = ""; } }); } }
        return line;
    }


    function readAsKeyword (membic, mimc, line, addIfNotFound) {
        var cm = "keywords:";
        if(line) {
            if(line.toLowerCase().startsWith(cm)) {
                line.slice(cm.length).csvarray().forEach(function (kwl) {
                    readAsKeyword(membic, mimc, kwl.trim(), true); });
                line = ""; }
            mimc.themes.forEach(function (ctm) {
                var theme = app.lcs.getRef("coop", ctm.ctmid);
                if(theme && theme.coop) {
                    theme = theme.coop;
                    theme.keywords.csvarray().forEach(function (kw) {
                        if(kw.toLowerCase() === line.toLowerCase()) {
                            if(!mimc.keywords.csvcontains(kw)) {
                                mimc.keywords = mimc.keywords.csvappend(kw);
                                line = ""; } } }); } }); }
        if(line && addIfNotFound) {
            mimc.keywords = mimc.keywords.csvappend(line);
            line = ""; }
        return line;
    }


    function readAsRating (membic, ignore /*mimc*/, line) {
        var match;
        if(line) {
            //start of line, followed by 1-5 asterisks, followed by space or
            //end.  This does not use a {1,5} count match because that can
            //also match more than 5 asterisks, which is more likely a sig
            //line or other text separator and not a rating.
            //lint wants the multiline 'm' modifier.  Doesn't matter.
            match = line.match(/^(\*\*?\*?\*?\*?)(\s|$)/m);
            if(match) {
                membic.rating = match[1].length * 20;
                line = ""; } }
        return line;
    }


    function readAsURL (line) {
        var match;
        if(line) {
            match = line.match(/https?:\/\/[^\s'"]+/);
            if(match) {
                //just note that the line was understood as a URL.  The
                //membic url was already set and corrected earlier. This
                //just clears any other URL lines.
                line = ""; } }
        return line;
    }


    function heuristicReadLine (membic, mimc, line) {
        var title = membic.title || membic.name || "";
        title = title.trim();
        line = line || "";
        line = line.trim();
        if(title) {
            line = line.replace(title, ""); }
        line = readAsThemeName(membic, mimc, line);
        line = readAsKeyword(membic, mimc, line);
        line = readAsRating(membic, mimc, line);
        line = readAsURL(line);
        if(line && !membic.text) {
            //First encountered text not understood as something else is
            //assumed to be the reason why this link is memorable.  It would
            //be great to understand multi-line reasons, but it's far more
            //likely to be including signature lines and similar crap which
            //is generally more annoying than helpful.
            membic.text = line; }
        return line;
    }


    function paragraphToLine (txt) {
        var par = ""; var lines = txt.split("\n"); var i;
        for(i = 0; i < lines.length; i += 1) {
            if(!lines[i]) {
                break; }
            if(par) {
                par += " "; }
            par += lines[i].trim(); }
        return par;
    }


    function heuristicParseMailInText (membic, mimc) {
        var rectxt = "";  //reconstituted text lines
        if(!mimc) {
            return; }
        mimc.themes = [];
        mimc.keywords = "";
        //If the original email subject was a theme name, or the title of of
        //the article, then read that appropriately and unset the reason why
        //it was memorable so that can be discovered from the email body.
        membic.text = heuristicReadLine(membic, mimc, membic.text);
        //Fill out any detail info provided, and rebuild the reason why this
        //was memorable if that was previously cleared
        mimc.text.split("\n").forEach(function (line) {
            rectxt += heuristicReadLine(membic, mimc, line) + "\n"; });
        //When reading plain text, long lines (aka paragraphs in typical
        //mail) normally get linebreaks inserted as if there were a word
        //wrap at 78 characters.  If the reason why a link was memorable was
        //pulled from the body of the email, there is a good chance only the
        //first line of text was captured.  Grab the rest from the rectxt.
        var idx = rectxt.indexOf(membic.text);
        if(idx >= 0) {
            membic.text = paragraphToLine(rectxt.slice(idx)); }
        app.review.precheckThemes(mimc.themes);
        if(mimc.keywords) {
            membic.keywords = mimc.keywords.replace(/,/g, ", "); }
        app.review.updateRating(membic.rating);
    }


    function getPlainURL (url) {
        //returns the url minus any query or hash parts.  In some instances
        //that may lead to completely different content, but the original
        //failed so the idea is to retry without to try get a pic.
        var crockfordurlregex = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
        var result = crockfordurlregex.exec(url);
        if(!result || result.length < 4) {
            return url; }
        // 0: whole url
        // 1: scheme (e.g. "https")
        // 2: "//"
        // 3: host (e.g. "membic.org")
        // 4: port (e.g. "8080")
        // 5: path (e.g. "fetchurl" for https://membic.org/fetchurl)
        // 6: query (everything after the '?' and before the '#')
        // 7: hash (everything after the '#')
        return result[1] + ":" + result[2] + result[3] +
            (result[5]? "/" + result[5] : "");
    }


    function getFetchErrorText (url, code, callerr) {
        var errtxt = "Membic details were not filled out automatically" +
            " because of a problem accessing " + url + "\n\n" +
            "Details: Error code " + code + ": " + callerr;
        var manfill = " You may need to fill out the membic fields yourself.";
        var phrase = "urlfetch.Fetch() required more quota";  //too many calls
        if(code >= 400 && code < 500) {
            errtxt = "The server for " + url + " is not allowing automated" +
                " access." + manfill; }
        switch(code) {
        case 400:
            if(callerr.indexOf(phrase) >= 0) {
                errtxt = "Tried to fetch " + url + ", but there was too much" +
                    " traffic. You can try reading again to see if things" +
                    " have gotten less busy, or you can fill out the membic" +
                    " fields directly."; }
            break;
        case 401: //fall through
        case 403:
            errtxt = "The server for " + url + " is not allowing automation" +
                " to read the page." + manfill; break;
        case 404:
            errtxt = "The server for " + url + " could not find the page." +
                " Double check the url is correct."; break; }
        return errtxt;
    }


    function readMailInMembicText (mim) {
        //Need to parse independently of newlines that can be inserted
        //pretty much anywhere, especially in a long subject that gets
        //wrapped.  The body is probably text but may be html.
        var mc = {};
        var elems = mim.text.split("Subject: ");
        mc.to = elems[0].match(/[^\s]+@membic.org/g)[0].slice(0, -11);
        mc.received = elems[0].replace(/\n/g, "").slice(-20);
        elems = elems[1].split("Body: ");
        //autowrap preserves spaces, and lines can be wrapped mid-word.
        mc.subj = elems[0].replace(/\n/g, "");  //just remove newlines
        mc.subj = mc.subj.replace(/\s/g, " ");  //normalize whitespace
        //Leave raw text intact, all smarts are in the heuristic processing.
        mc.text = elems[1];
        //Do clean up html however, since it's a mess to read.
        if(mc.text.trim().toLowerCase().startsWith("<html")) {
            mc.text = mc.text.replace(/<\/?[^>]+>/g, "\n"); }
        return mc;
    }


    ////////////////////////////////////////
    // published functions and attributes
    ////////////////////////////////////////
return {

    name: svcName,


    //params are ignored for this reader.  mail-in membic context optional.
    fetchData: function (membic, url, params, mimc) {
        var geturl;
        jt.out("revautodiv", "Reading details from " + url + " ...");
        geturl = "urlcontents?url=" + jt.enc(url) + jt.ts("&cb=", "second");
        jt.call("GET", geturl, null,
                function (json) {
                    var html = jt.dec(json[0].content);
                    setReviewFields(membic, html, url);
                    heuristicParseMailInText(membic, mimc);
                    app.review.updatedlg(); },
                //do not call app.failf here as the error may be from
                //the called site rather than the membicsys server.
                function (code, errtxt) {
                    var plainurl;
                    //Do not retry http if the original was https since the
                    //site may redirect http to https causing a loop.
                    plainurl = getPlainURL(url);
                    if(url !== plainurl) {  //wasn't a permalink, retry basic
                        return app.readurl.fetchData(membic, plainurl, 
                                                     params, mimc); }
                    heuristicParseMailInText(membic, mimc);
                    jt.err(getFetchErrorText(url, code, errtxt));
                    app.review.resetAutoURL(); },
                jt.semaphore("readurl.fetchData"));
    },


    //The standard is that the mail subject is the reason why the link is
    //memorable, while the body has the url.  The reason is that the body
    //can get stuffed with various different things, while the subject is
    //usually pretty clean.  That said, the idea is to do the best that can
    //be done given whatever there is to work with.
    automateMailInMembic: function (mim) {
        var mc = readMailInMembicText(mim);
        //grab the first URL as the source to read. No other option really.
        mc.url = mc.text.match(/https?:\/\/[^\s'"]+/g);
        if(!mc.url) {
            mc.url = mc.subj.match(/https?:\/\/[^\s'"]+/g); }
        if(mc.url) {
            mc.url = mc.url[0];
            mim.url = mc.url; }
        //set the text of the mail-in membic to the mail subject so that in
        //a worst case fetch and heuristic parse failure at least the
        //standard case of why something is memorable will be kept.
        mim.text = mc.subj;
        //force text to be redisplayed.  Ordinarily edits are maintained
        //during other updates like stars and checkboxes.  In this case it
        //should be rebuilt.  Keep the working space for after the URL reads.
        jt.out("rdtextdiv", "");
        if(mc.url) {
            return app.readurl.fetchData(mim, mc.url, null, mc); }
        app.review.updatedlg();
    }

};  //end of returned functions
}());

