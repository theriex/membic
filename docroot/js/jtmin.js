/*global alert: false, console: false, document: false, window: false */

////////////////////////////////////////
// Just The Mods I Need
//

////////////////////////////////////////
//prototype mods and global overrides
(function () {
    "use strict";

    if (!String.prototype.trim) {  //thanks to Douglas Crockford
        String.prototype.trim = function () {
            return this.replace(/^\s*(\S*(?:\s+\S+)*)\s*$/, "$1");
        };
    }


    if (!String.prototype.capitalize) {
        String.prototype.capitalize = function () {
            return this.charAt(0).toUpperCase() + this.slice(1);
        };
    }


    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement) {
            var i;
            if (this === null) {
                throw new TypeError();
            }
            for (i = 0; i < this.length; i += 1) {
                if (this[i] === searchElement) {
                    return i;
                }
            }
            return -1;
        };
    }


    if (!Array.prototype.shuffle) {
        Array.prototype.shuffle = function () {
            var i, j, tmp;
            for (i = this.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                tmp = this[i];
                this[i] = this[j];
                this[j] = tmp;
            }
            return this;
        };
    }


    if (!Date.prototype.toISOString) {
        Date.prototype.toISOString = function () {
            function pad(n) { return n < 10 ? '0' + n : n; }
            return this.getUTCFullYear() + '-'
                + pad(this.getUTCMonth() + 1) + '-'
                + pad(this.getUTCDate()) + 'T'
                + pad(this.getUTCHours()) + ':'
                + pad(this.getUTCMinutes()) + ':'
                + pad(this.getUTCSeconds()) + 'Z';
        };
    }


}());


////////////////////////////////////////
// Decorate the given object with utility methods.  This function name
// pollutes the global name space, but the likelihood of a name
// conflict is low, and it seems worth it for the convenience of
// a simple direct call when first setting up an app.
var jtminjsDecorateWithUtilities = function (utilityObject) {
    "use strict";

    var app = utilityObject;  //usually app level decoration, easier to grep


    ////////////////////////////////////////
    // basic IO convenience

    app.log = app.log || function (text) {
        try {
            if (console && console.log) {
                console.log(text);
            }
        } catch (ignore) {  //most likely a bad IE console def, just skip it
        }
    };


    app.err = app.err || function (text) {
        alert(text);
    };


    app.assert = app.assert || function (testval) {
        if (!testval) {
            app.err("An application integrity check has failed. Please reload the page in your browser.");
            throw ("app.assert");
        }
    };


    app.byId = app.byId || function (elemid) {
        return document.getElementById(elemid);
    };


    app.out = app.out || function (domid, html) {
        var node = app.byId(domid);
        if (node) {
            node.innerHTML = html;
        } else {
            app.log("DOM id " + domid + " not available for output");
        }
    };


    ////////////////////////////////////////
    // String manipulation and conversion 

    app.prefixed = app.prefixed || function (string, prefix) {
        if (string && string.indexOf(prefix) === 0) {
            return true;
        }
        return false;
    };


    app.ellipsis = app.ellipsis || function (string, length) {
        if (!string || typeof string !== "string") {
            return "";
        }
        string = string.trim();
        if (string.length <= length) {
            return string;
        }
        string = string.slice(0, length - 3) + "...";
        return string;
    };


    app.safestr = app.safestr || function (string) {
        if (!string) {
            return "";
        }
        return String(string);
    };


    app.safeget = app.safeget || function (domid, field) {
        var elem = app.byId(domid);
        if (elem) {
            return elem[field];
        }
    };


    app.enc = app.enc || function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        return encodeURIComponent(val);
    };


    app.dec = app.dec || function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        try {
            val = decodeURIComponent(val);
        } catch (e) {
            app.log("decodeURIComponent failure: " + e);
        }
        return val;
    };


    //if a string needs to be URL encoded and then stuffed inside of
    //single quotes, then you need to replace any embedded single
    //quotes to avoid terminating the string early.
    app.embenc = app.embenc || function (val) {
        val = app.enc(val);
        val = val.replace(/'/g, "%27");
        return val;
    };


    app.dquotenc = app.dquotenc || function (val) {
        val = val.replace(/"/g, "&quot;");
        val = app.enc(val);
        return val;
    };


    //if making an html attribute value by escaping double quotes,
    //then get rid of any double quotes in the contained value
    app.ndq = app.ndq || function (val) {
        if (!val) {
            return "";
        }
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    app.canonize = app.canonize || function (txt) {
        var strval = txt || "";
        strval = strval.replace(/\s/g, "");
        strval = strval.replace(/\'/g, "");
        strval = strval.replace(/\"/g, "");
        strval = strval.replace(/\,/g, "");
        strval = strval.replace(/\./g, "");
        strval = strval.replace(/\!/g, "");
        strval = strval.toLowerCase();
        return strval;
    };


    app.ISOString2Day = app.ISOString2Day || function (str) {
        var date, year, month, day;
        if (!str) {
            return new Date();
        }
        year = parseInt(str.slice(0, 4), 10);
        month = parseInt(str.slice(5, 7), 10);
        day = parseInt(str.slice(8, 10), 10);
        date = new Date(year, month, day, 0, 0, 0, 0);
        return date;
    };


    app.colloquialDate = app.colloquialDate || function (date) {
        var days = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday',
                     'Thursday', 'Friday', 'Saturday', 'Sunday' ],
            months = [ "January", "February", "March", "April", "May",
                       "June", "July", "August", "September", "October",
                       "November", "December" ];
        return String(days[date.getUTCDay()]) +
            ", " + String(months[date.getMonth()]) +
            " " + String(date.getUTCDate());
    };


    ////////////////////////////////////////
    // value testing and manipulation

    //return true if the given text can be reasonably construed to be an
    //email address.
    app.isProbablyEmail = app.isProbablyEmail || function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
    };


    app.parseParams = app.parseParams || function () {
        var pstr = window.location.hash, params = {}, avs, av, i;
        if (pstr) {  //parse the hash params
            if (pstr.indexOf("#") === 0) {
                pstr = pstr.slice(1);
            }
            avs = pstr.split('&');
            for (i = 0; i < avs.length; i += 1) {
                av = avs[i].split('=');
                if (av.length > 1) {
                    params[av[0]] = av[1];
                } else {
                    params.anchor = av[0];
                }
            }
        }
        pstr = window.location.search;
        if (pstr) {
            if (pstr.indexOf("?") === 0) {
                pstr = pstr.slice(1);
            }
            avs = pstr.split('&');
            for (i = 0; i < avs.length; i += 1) {
                av = avs[i].split('=');
                params[av[0]] = av[1];
            }
        }
        return params;
    };


    //return the given object field and values as html POST data
    app.objdata = app.objdata || function (obj, skips) {
        var str = "", name;
        if (!obj) {
            return "";
        }
        if (!skips) {
            skips = [];
        }
        for (name in obj) {
            if (obj.hasOwnProperty(name)) {
                if (skips.indexOf(name) < 0) {
                    if (str) {
                        str += "&";
                    }
                    str += name + "=" + app.enc(obj[name]);
                }
            }
        }
        return str;
    };


    app.paramsToObj = app.paramsToObj || function (paramstr) {
        var comps, i, attval, obj = {}, idx = paramstr.indexOf("?");
        if (idx >= 0) {
            paramstr = paramstr.slice(idx + 1);
        }
        comps = paramstr.split("&");
        for (i = 0; i < comps.length; i += 1) {
            attval = comps[i].split("=");
            obj[attval[0]] = attval[1];
        }
        return obj;
    };


    app.paramsToFormInputs = app.paramsToFormInputs || function (paramstr) {
        var html = "", fields, i, attval;
        if (!paramstr) {
            return "";
        }
        fields = paramstr.split("&");
        for (i = 0; i < fields.length; i += 1) {
            attval = fields[i].split("=");
            html += "<input type=\"hidden\" name=\"" + attval[0] + "\"" +
                                          " value=\"" + attval[1] + "\"/>";
        }
        return html;
    };


    app.makelink = app.makelink || function (url) {
        var html, suffix = "";
        if (!url) {
            return "";
        }
        //strip any common trailing punctuation on the url if found
        if (/[\.\,\)]$/.test(url)) {
            suffix = url.slice(-1);
            url = url.slice(0, -1);
        }
        html = "<a href=\"" + url + "\" onclick=\"window.open('" + url +
            "');return false;\">" + url + "</a>" + suffix;
        return html;
    };


    //Make the text into display html.  Newlines become <br/>s and
    //urls become hrefs that open in a new window/tab.  Trying to
    //avoid complex regex since those are annoying to maintain.  Ok
    //with not automatically picking up on things that don't start
    //with "http".  Links other than web not desired.
    app.linkify = app.linkify || function (txt) {
        if (!txt) {
            return "";
        }
        txt = txt.replace(/https?:\S+/g, function (url) {
            return app.makelink(url);
        });
        txt = txt.replace(/\n/g, "<br/>");
        return txt;
    };


};


