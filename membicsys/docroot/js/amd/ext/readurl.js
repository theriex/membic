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


    function findAmazonImage (review, html) {
        var matches = html.match(/iUrl\s=\s"(\S+)"/);
        if(matches) {
            review.imguri = matches[1]; }
    }


    function findNetflixImage (review, html, url) {
        //the alt for the image has the movie title, which isn't found
        //conveniently anywhere else, so set it here.
        if(url.indexOf("netflix.") >= 0) {
            var elem = elementForString(html, "thumbnailUrl", "img");
            if(elem) {
                var val = valueForField(elem, "src");
                if(val) {
                    review.imguri = val;
                    val = valueForField(elem, "alt");
                    review.title = val; } } }
    }


    function findLogoImage (review, html, url) {
        //A logo can be buried pretty much anywhere, but usually has "logo"
        //somewhere in the name and is almost always a png.  Try find.
        var index = html.search(/src=[A-Za-z0-9'"\/]*logo\.png/i);
        if(index < 0) {  //try same regex again, but unescape the html
            index = unescape(html).search(/src=[A-Za-z0-9'"\/]*logo\.png/i);
            if(index >= 0) {
                html = unescape(html); } }
        if(index > 0) {
            var val = html.slice(index + 5);
            val = val.slice(0, val.toLowerCase().indexOf(".png") + 4);
            review.imguri = verifyFullURL(val, url); }
    }


    function findFaviconImage (review, html, url) {
        //The favicon invariably looks lame, but it shows that app analyzed
        //the site, which is better than plain failure.  Better both in
        //terms of looking like we tried, and in encouraging people to
        //upload or find a better image if they want.  Last ditch effort.
        var elem = elementForString(html, "icon", "link");
        if(elem) {
            var val = valueForField(elem, "href");
            if(val) {
                review.imguri = verifyFullURL(val, url); } }
    }


    function setImageURI (review, html, url) {
        review.imguri = "";
        var stds = [{t:"image_src",     e:"link", f:"href"},
                    {t:"og:image",      e:"meta", f:"content"},
                    {t:"twitter:image", e:"meta", f:"content"}];
        stds.forEach(function (std) {
            if(!review.imguri) {
                var elem = elementForString(html, std.t, std.e);
                if(elem) {
                    var val = valueForField(elem, std.f);
                    if(val) {
                        review.imguri = verifyFullURL(val, url); } } } });
        var hacks = [findAmazonImage,
                     findNetflixImage,
                     findLogoImage,
                     findFaviconImage];
        hacks.forEach(function (hack) {
            if(!review.imguri) {
                hack(review, html, url); } });
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


    ////////////////////////////////////////
    // published functions and attributes
    ////////////////////////////////////////
return {

    name: svcName,


    //params are ignored for this reader.
    fetchData: function (membic, url) {
        var geturl;
        jt.out("revautodiv", "Reading details from " + url + " ...");
        geturl = "urlcontents?url=" + jt.enc(url) + app.login.authparams("&") +
            jt.ts("&cb=", "second");
        jt.call("GET", geturl, null,
                function (json) {
                    var html = jt.dec(json[0].content);
                    setReviewFields(membic, html, url);
                    app.review.updatedlg(membic.revtype); },
                //do not call app.failf here as the error may be from
                //the called site rather than the membicsys server.
                function (code, errtxt) {
                    var plainurl;
                    //Do not retry http if the original was https since the
                    //site may redirect http to https causing a loop.
                    plainurl = getPlainURL(url);
                    if(url !== plainurl) {  //wasn't a permalink, retry basic
                        return app.readurl.fetchData(membic, plainurl); }
                    jt.err(getFetchErrorText(url, code, errtxt));
                    app.review.resetAutoURL(); },
                jt.semaphore("readurl.fetchData"));
    }

};  //end of returned functions
}());

