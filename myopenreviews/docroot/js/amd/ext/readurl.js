/*global app: false, jt: false, unescape: false */

/*jslint regexp: true, unparam: true, white: true, maxerr: 50, indent: 4 */


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
                jt.log("readurl.js " + url + " findTagContents: " + problem);
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


    setCanonicalURL = function (review, html, url) {
        var elem, val;
        //the Facebook url is frequently better than the canonical link
        elem = elementForString(html, "og:url", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.url = verifyFullURL(val, url);
                return; } }
        elem = elementForString(html, "canonical", "link");
        if(elem) {
            val = valueForField(elem, "href");
            if(val) {
                review.url = verifyFullURL(val, url);
                return; } }
    },


    //Set the type if it is unambigous, and there is no specific
    //supporting extension module other than this general reader.
    setReviewType = function (review, html, url) {
        var i, typemaps = [
            { urltxt: "imdb.", revtype: "movie" },
            { urltxt: "netflix.", revtype: "movie" },
            { urltxt: "rottentomatoes.", revtype: "movie" },
            { urltxt: "soundcloud.", revtype: "music" },
            { urltxt: "vimeo.", revtype: "video" },
            { urltxt: "youtube.", revtype: "video" } ];
        url = url.toLowerCase();
        for(i = 0; i < typemaps.length; i += 1) {
            if(url.indexOf(typemaps[i].urltxt) >= 0) {
                review.revtype = typemaps[i].revtype;
                break; } }
    },
    

    setTitle = function (review, html, url) {
        var elem, val;
        //the Facebook title is frequently better than the default tag title
        elem = elementForString(html, "og:title", "meta");
        if(elem) {
            val = valueForField(elem, "content");
            if(val) {
                review.title = val;
                review.name = val;
                return; } }
        val = findTagContents(html, "title", url);
        if(val) {
            review.title = val;
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


    setReviewFields = function (review, html, url) {
        setReviewType(review, html, url);
        setTitle(review, html, url);
        if(review.revtype === "video") {  //try to be smart about music vids
            parseTitle(review); }
        setImageURI(review, html, url);
        setCanonicalURL(review, html, url);
    },


    getPlainURL = function (url) {
        var result, crockfordurlregex = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
        result = crockfordurlregex.exec(url);
        if(result.length < 4) {
            return url; }
        return result[1] + ":" + result[2] + result[3];
    };


    ////////////////////////////////////////
    // published functions
    ////////////////////////////////////////
return {

    name: svcName,


    fetchData: function (review, url, params) {
        var geturl;
        jt.out('contentdiv', "Reading details from " + url + " ...");
        geturl = "urlcontents?url=" + jt.enc(url);
        jt.call('GET', geturl, null,
                 function (json) {
                     setReviewFields(review, jt.dec(json[0].content), url);
                     app.review.display(); },
                 app.failf(function (code, errtxt) {
                     var plainurl = getPlainURL(url);
                     if(url !== plainurl) {
                         return app.readurl.fetchData(review, plainurl, 
                                                      params); }
                     jt.err("Review details were not filled out automatically" +
                            " because of a problem accessing " + url + "\n\n" +
                            "You are probably going to have to fill in the " +
                            "review details manually. Sorry about that.\n\n" +
                            "Here's what came back in case it helps:\n\n" +
                            "Error code " + code + ": " + errtxt);
                     app.review.resetAutoURL();
                     app.review.display(); }),
                jt.semaphore("readurl.fetchData"));
    }

};  //end of returned functions
}());
