/*global app, jt, unescape */

/*jslint browser, multivar, white, fudge, for */


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

    ////////////////////////////////////////
    // closure variables
    ////////////////////////////////////////

    var svcName = "URLReader",  //ascii with no spaces, used as an id
        //no attribution since no API provided.


    ////////////////////////////////////////
    // helper functions
    ////////////////////////////////////////

    valueForField = function (elem, field) {
        var idx, val;
        idx = elem.indexOf(field);
        if(idx >= 0) {
            val = elem.slice(idx + field.length);
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
    },


    elementForStringSearch = function (html, targetstr, elemtype) {
        var found = false, start, end, idx, str = "";
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
    },


    elementForString = function (html, targetstr, elemtype) {
        var str = elementForStringSearch(html, targetstr, elemtype);
        if(!str) {
            //src for at least rottentomatoes shows up fully escaped
            html = unescape(html);
            str = elementForStringSearch(html, targetstr, elemtype); }
        return str;
    },


    findTagContents = function (html, tagname, url) {
        var content = "", idx;
        try {
            idx = html.indexOf("<" + tagname);
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
    },


    verifyFullURL = function (val, url) {
        var urlbase, idx;
        if(val.indexOf("http") >= 0) {
            return val; }
        if(val.indexOf("/") === 0) {  //hard url off root
            urlbase = url.split("?")[0];
            if(urlbase.lastIndexOf("/") > 9) {
                urlbase = urlbase.slice(0, urlbase.indexOf("/", 9)); }
            return urlbase + "/" + val; }
        //relative url
        urlbase = url.split("?")[0];
        idx = urlbase.lastIndexOf("/");
        if(idx > 9) {  //the slashes at the start don't count
            urlbase = urlbase.slice(0, idx); }
        idx = urlbase.lastIndexOf("/");
        if(idx <= 9) {
            urlbase += "/"; }
        return urlbase + val;
    },


    setImageURI = function (review, html, url) {
        var elem, val, index;
        elem = elementForString(html, "image_src", "link");
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
        index = html.search(/src=[A-Za-z0-9\'\"\/]*logo\.png/i);
        if(index < 0) {  //try same regex again, but unescape the html
            index = unescape(html).search(/src=[A-Za-z0-9\'\"\/]*logo\.png/i);
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
    },


    //In at least one use case, the query string part of the url was
    //needed to reach the linked content, and the returned canonical
    //value was just the base site url.  While it's nice to have
    //extraneous url crap cleaned up by a canonical link declaration,
    //failing to actually link to the content is not an option.  If
    //the canonical url is less specific than the original, then go
    //with the original to avoid that problem.
    probableInfoLoss = function (canonical, original) {
        if(original.startsWith(canonical)) {
            return true; }
        return false;
    },


    setCanonicalURL = function (review, html, url) {
        var elem, val;
        review.rurl = url;  //keep original in case canonical fails
        //the Facebook url is frequently better than the canonical link
        elem = elementForString(html, "og:url", "meta");
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
    },


    //Set the type if it is unambigous, and there is no specific
    //supporting extension module other than this general reader.
    setReviewType = function (review, ignore /*html*/, url) {
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
    },
    

    fixSpamdexing = function (val) {
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
        val = val.replace(/Home\s[\|\-]\s/ig, "");
        val = val.replace(/Welcome\s[\|\-]\s/ig, "");
        //remove known useless suffixes (not as important, but still helpful)
        val = val.replace(/\s[\|\-]\sHome/ig, "");
        return val;
    },


    setTitle = function (review, html, url) {
        var elem, val;
        if(review.acselkeyval) {  //if the name was selected from an 
            review.title = val;   //autocomplete display listing, then
            review.name = val;    //don't change it here
            return; }
        //the Facebook title is frequently better than the default tag title
        elem = elementForString(html, "og:title", "meta");
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
            //convert extended character nonsense common in some news sources
            val = val.replace(/â/g, "'");
            val = val.replace(/â/g, " - ");
            review.title = val.trim();
            review.name = val; }
    },


    //Attempt to parse the title.  Add smarts on case basis.  In
    //general, guessing artist, title is most likely due to players
    //organizing music by artist, then album, then title
    parseTitle = function (review) {
        var text, i;
        if(!review.title) {
            return; }
        text = review.title;
        //case: "artist - title"
        //e.g. http://www.youtube.com/watch?v=KnIJOO__jVo
        if(text.indexOf(" - ") > 0) {
            //text.split(" - ", 2) is supposed to give you the first element
            //and then the rest of the string as the second, but it doesn't
            text = text.split(" - ");
            review.artist = text[0].trim();
            review.title = "";
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
    },


    setPublisher = function (review, html) {
        var elem, val;
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
    },


    setAuthor = function (review, html, url) {
        var elem, val,
            brokens = [
                {src: "washingtonpost", reg: /author:\["([^"]+)/},
                {src: "huffingtonpost", reg: /author":\{[^\}]*name":"([^"]+)/},
                {src: "politi.co", reg: /content_author":"([^"]+)/}];
        if(!review.author) {
            //looking for "author" should pick up either 
            //<meta content="whoever" name="author">
            //<meta itemprop="author" content="whoever">
            elem = elementForString(html, "author", "meta");
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
    },


    setReviewFields = function (review, html, url) {
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
    },


    getPlainURL = function (url) {
        var result, crockfordurlregex = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
        result = crockfordurlregex.exec(url);
        if(!result || result.length < 4) {
            return url; }
        return result[1] + ":" + result[2] + result[3] +
            (result[5]? "/" + result[5] : "");
    },


    getFetchErrorText = function (url, code, callerr) {
        var errtxt, phrase;
        errtxt = "Membic details were not filled out automatically" +
            " because of a problem accessing " + url + "\n\n" +
            "Details: Error code " + code + ": " + callerr;
        phrase = "urlfetch.Fetch() required more quota";
        if(code === 400 && callerr.indexOf(phrase) >= 0) {
            errtxt = "Tried to fetch " + url + ", but there was too much" +
                " traffic. You can try reading again to see if things" +
                " have gotten less busy, or you can fill out the membic" +
                " fields directly."; }
        return errtxt;
    },


    readMailInMembicText = function (mim) {
        //Need to parse independently of newlines which can be inserted
        //pretty much anywhere.  Especially in a long subject.  The body may
        //be html or text.
        var mc = {}, elems;
        elems = mim.text.split("Subject: ");
        mc.to = elems[0].match(/[^\s]+@membic.org/g)[0].slice(0, -11);
        mc.received = elems[0].replace(/\n/g, "").slice(-20);
        elems = elems[1].split("Body: ");
        mc.subj = elems[0].replace(/\n/g, "");
        mc.subj = mc.subj.replace(/\s/g, " ");
        mc.text = elems[1];  //leave raw to allow for pulling a url out of it
        return mc;
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    name: svcName,


    fetchData: function (review, url, params) {
        var geturl;
        jt.out("revautodiv", "Reading details from " + url + " ...");
        geturl = "urlcontents?url=" + jt.enc(url) + jt.ts("&cb=", "second");
        jt.call("GET", geturl, null,
                function (json) {
                    var html = jt.dec(json[0].content);
                    setReviewFields(review, html, url);
                    app.review.updatedlg(); },
                //do not call app.failf here as the error may be from
                //the called site rather than the membicsys server.
                function (code, errtxt) {
                    var plainurl = getPlainURL(url);
                    if(url !== plainurl) {
                        return app.readurl.fetchData(review, plainurl, 
                                                     params); }
                    jt.err(getFetchErrorText(url, code, errtxt));
                    app.review.resetAutoURL(); },
                jt.semaphore("readurl.fetchData"));
    },


    //The mail subject is the reason why the link is memorable, the body has
    //the url.  Anything else is confusing to both humans and machines.  The
    //mail body is typically html.  The body will frequently have sig or
    //other extraneous information attached.
    automateMailInMembic: function (mim) {
        var mc = readMailInMembicText(mim);
        mc.url = mc.text.match(/https?:\/\/[^\s'"]+/g);
        if(mc.url) {
            mc.url = mc.url[0];
            mim.url = mc.url; }
        //Not doing asterisks -> stars because it loses granularity and
        //consideration, and it looks bad in the email.  Not doing keyword
        //or theme checkbox preselects because of typos and extra markup.
        mim.text = mc.subj;
        //force text to be redisplayed.  Ordinarily edits are maintained
        //during other updates like stars and checkboxes.  In this case it
        //should be rebuilt.
        jt.out("rdtextdiv", "");
        if(mc.url) {
            return app.readurl.fetchData(mim, mc.url); }
        app.review.updatedlg();
    }

};  //end of returned functions
}());

