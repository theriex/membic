/*global app, jt, unescape */

/*jslint browser, white, fudge, for */


//////////////////////////////////////////////////////////////////////
// A catchall reader that fills membic details using general page
// information typically provided for reference sharing purposes.  Other
// readers work the same way, providing a callable getInfo function which is
// called from app.membic.
//
// When a membic URL is given, app.membic selects a reader, initializes the
// urlreader context, and calls getInfo.  The reader works in the background
// getting summary information from the url into the given membic, then calls
// app.membic.readerFinish to merge that data back in, along with a result
// status and any message to be saved.

app.readurl = (function () {
    "use strict";

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


    function findAmazonImage (membic, html) {
        var matches = html.match(/iUrl\s=\s"(\S+)"/);
        if(matches) {
            membic.imguri = matches[1]; }
    }


    function findNetflixImage (membic, html, url) {
        //the alt for the image has the movie title, which isn't found
        //conveniently anywhere else, so set it here.
        if(url.indexOf("netflix.") >= 0) {
            var elem = elementForString(html, "thumbnailUrl", "img");
            if(elem) {
                var val = valueForField(elem, "src");
                if(val) {
                    membic.imguri = val;
                    val = valueForField(elem, "alt");
                    membic.details.title = val; } } }
    }


    function findLogoImage (membic, html, url) {
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
            membic.imguri = verifyFullURL(val, url); }
    }


    function findFaviconImage (membic, html, url) {
        //The favicon invariably looks lame, but it shows that app analyzed
        //the site, which is better than plain failure.  Better both in
        //terms of looking like we tried, and in encouraging people to
        //upload or find a better image if they want.  Last ditch effort.
        var elem = elementForString(html, "icon", "link");
        if(elem) {
            var val = valueForField(elem, "href");
            if(val) {
                membic.imguri = verifyFullURL(val, url); } }
    }


    function setImageURI (membic, html, url) {
        membic.imguri = "";
        var stds = [{t:"image_src",     e:"link", f:"href"},
                    {t:"og:image",      e:"meta", f:"content"},
                    {t:"twitter:image", e:"meta", f:"content"}];
        stds.forEach(function (std) {
            if(!membic.imguri) {
                var elem = elementForString(html, std.t, std.e);
                if(elem) {
                    var val = valueForField(elem, std.f);
                    if(val) {
                        membic.imguri = verifyFullURL(val, url); } } } });
        var hacks = [findAmazonImage,
                     findNetflixImage,
                     findLogoImage,
                     findFaviconImage];
        hacks.forEach(function (hack) {
            if(!membic.imguri) {
                hack(membic, html, url); } });
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


    function setType (membic, url) {
        membic.revtype = "article";
        var typeflags = [
            {s:"imdb.", t:"movie"},
            {s:"netflix.", t:"movie"},
            {s:"rottentomatoes.", t:"movie"},
            {s:"soundcloud.", t:"music"},
            {s:"vimeo.", t:"video"},
            {s:"youtu.be", t:"video"},
            {s:"youtube.", t:"video"}];
        url = url.toLowerCase();
        typeflags.forEach(function (tf) {
            if(url.indexOf(tf.s) >= 0) {
                membic.revtype = tf.t; } });
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


    //Set both the title and the name in the membic details.  If the revtype
    //is changed later, having the other value filled in makes things easier.
    function setTitle (membic, html, url) {
        membic.details = membic.details || {};
        if(membic.acselkeyval) {  //name selected from verified autocomplete.
            membic.details.name = membic.acselkeyval;
            membic.details.title = membic.acselkeyval;
            return; }
        var val;
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
            val = val.trim();
            membic.details.name = val;
            membic.details.title = val; }
    }


    //You might think that text.split(delim, 2) would give you the first
    //element of the split, followed by the rest of the string, but in fact
    //it works like text.split(delim).slice(0, 2).
    function splitFirstAndRemainder (text, delim) {
        text = text || "";
        text = text.trim();
        var subs = text.split(delim);
        if(subs.length < 2) {
            return [text, ""]; }
        var first = subs[0].trim();
        var second = subs.slice(1).join(delim).trim();
        return [first, second];
    }


    //Music and video players tend to organize on artist/album/track, but
    //album info is frequently omitted, especially for music videos.  This
    //is just a heuristic, but it is helpful when it works.  Some samples:
    //  https://www.youtube.com/watch?v=KnIJOO__jVo
    //  http://www.youtube.com/watch?v=tHOn093r-Ak
    function parseArtistWorkTitle (membic) {
        var text = membic.details.title;
        var delims = [" - ", ": "];
        delims.forEach(function (delim) {
            if(!membic.details.artist && text.indexOf(delim) >= 0) {
                var subs = splitFirstAndRemainder(text, delim);
                membic.details.artist = subs[0];
                membic.details.title = subs[1]; } });
    }


    //general, guessing artist, title is most likely due to players
    //organizing music by artist, then album, then title
    function parseTitle (membic) {
        if(!membic.details.title) {
            return; }  //nothing to parse
        if(membic.revtype === "music" || membic.revtype === "video") {
            parseArtistWorkTitle(membic); }
    }


    function setPublisher (membic, html) {
        if(!membic.details.publisher) {
            var elem; var val;
            if(!val) {
                elem = elementForString(html, "og:site_name", "meta");
                if(elem) {
                    val = valueForField(elem, "content"); } }
            if(!val) {
                elem = elementForString(html, "name=\"cre\"", "meta");
                if(elem) {
                    val = valueForField(elem, "content"); } }
            if(val) {
                membic.details.publisher = val; } }
    }


    function setAuthor (membic, html, url) {
        var val;
        var brokens = [
                {src:"washingtonpost", reg:/author:\["([^"]+)/},
                {src:"huffingtonpost", reg:/author":\{[^}]*name":"([^"]+)/},
                {src:"politi.co", reg:/content_author":"([^"]+)/}];
        if(!membic.details.author) {
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
                membic.details.author = val; } }
    }


    function setMembicFields (ctx) {
        setType(ctx.m, ctx.u);
        setTitle(ctx.m, ctx.html, ctx.u);
        if(ctx.m.revtype === "video") {  //try to be smart about music vids
            parseTitle(ctx.m); }
        setPublisher(ctx.m, ctx.html);
        setAuthor(ctx.m, ctx.html, ctx.u);
        setImageURI(ctx.m, ctx.html, ctx.u);
        setCanonicalURL(ctx.m, ctx.html, ctx.u);
        var rfs = [];
        if(ctx.m.imguri) {
            rfs.push("imguri"); }
        var detfields = ["title", /*name,*/ "artist", "author", "publisher",
                         "album", "starring", "address", "year"];
        detfields.forEach(function (detfld) {
            if(ctx.m.details[detfld]) {
                rfs.push(detfld); } });
        ctx.msgs.push("Filled out: " + rfs.join(", "));
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


    ////////////////////////////////////////
    // published functions and attributes
    ////////////////////////////////////////
return {

    getInfo: function  (membic, url) {
        jt.log("app.readurl fetching " + url);
        var apiurl = app.login.authURL("/api/urlcontents") +
            "&url=" + jt.enc(url) + jt.ts("&cb=", "second");
        jt.call("GET", apiurl, null,
                function (json) {
                    jt.log("app.readurl success: " + url);
                    var ctx = {m:membic, u:url, msgs:[],
                               html:jt.dec(json[0].content)};
                    setMembicFields(ctx);
                    app.membic.readerFinish(membic, "success",
                                            ctx.msgs.join("|")); },
                //Error may be from call to url, not a local server error
                function (code, errtxt) {
                    jt.log("app.readurl failed " + code + ": " + errtxt);
                    var plainurl;
                    //Do not retry http if the original was https, since the
                    //site may redirect http to https causing a loop.
                    plainurl = getPlainURL(url);
                    if(url !== plainurl) {  //wasn't a permalink, retry basic
                        return app.readurl.getInfo(membic, plainurl); }
                    app.membic.readerFinish(membic, "failure",
                                            String(code) + ": " + errtxt); },
                jt.semaphore("readurl.getInfo"));
    }

};  //end of returned functions
}());
