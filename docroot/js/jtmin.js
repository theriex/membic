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
// Decorate the given object with the utility methods.
// Library users will need to live with this one global.
var jtminjsDecorateWithUtilities = function (utilityObject) {
    "use strict";

    var uo = utilityObject;  //local reference for cooperative functions


    ////////////////////////////////////////
    // basic IO convenience

    uo.byId = function (elemid) {
        return document.getElementById(elemid);
    };


    uo.log = function (text) {
        try {
            if (console && console.log) {
                console.log(text);
            }
        } catch (ignore) {  //most likely a bad IE console def, just skip it
        }
    };


    uo.err = function (text) {
        alert(text);
    };


    uo.assert = function (testval) {
        if (!testval) {
            uo.err("An application integrity check has failed. Please reload the page in your browser.");
            throw ("uo.assert");
        }
    };


    uo.out = function (domid, html) {
        var node = uo.byId(domid);
        if (node) {
            node.innerHTML = html;
        } else {
            uo.log("DOM id " + domid + " not available for output");
        }
    };


    ////////////////////////////////////////
    // String manipulation and conversion 

    uo.prefixed = function (string, prefix) {
        if (string && string.indexOf(prefix) === 0) {
            return true;
        }
        return false;
    };


    uo.ellipsis = function (string, length) {
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


    uo.safestr = function (string) {
        if (!string) {
            return "";
        }
        return String(string);
    };


    uo.safeget = function (domid, field) {
        var elem = uo.byId(domid);
        if (elem) {
            return elem[field];
        }
    };


    uo.enc = function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        return encodeURIComponent(val);
    };


    uo.dec = function (val) {
        val = val || "";
        if (typeof val === "string") {
            val = val.trim();
        }
        try {
            val = decodeURIComponent(val);
        } catch (e) {
            uo.log("decodeURIComponent failure: " + e);
        }
        return val;
    };


    //if a string needs to be URL encoded and then stuffed inside of
    //single quotes, then you need to replace any embedded single
    //quotes to avoid terminating the string early.
    uo.embenc = function (val) {
        val = uo.enc(val);
        val = val.replace(/'/g, "%27");
        return val;
    };


    uo.dquotenc = function (val) {
        val = val.replace(/"/g, "&quot;");
        val = uo.enc(val);
        return val;
    };


    //if making an html attribute value by escaping double quotes,
    //then get rid of any double quotes in the contained value
    uo.ndq = function (val) {
        if (!val) {
            return "";
        }
        val = val.replace(/"/g, "&quot;");
        return val;
    };


    uo.canonize = function (txt) {
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


    uo.ISOString2Day = function (str) {
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


    uo.colloquialDate = function (date) {
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
    uo.isProbablyEmail = function (text) {
        return text && text.match(/^\S+@\S+\.\S+$/);
    };


    uo.parseParams = function () {
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
    uo.objdata = function (obj, skips) {
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
                    str += name + "=" + uo.enc(obj[name]);
                }
            }
        }
        return str;
    };


    uo.paramsToObj = function (paramstr) {
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


    uo.paramsToFormInputs = function (paramstr) {
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


    uo.makelink = function (url) {
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
    uo.linkify = function (txt) {
        if (!txt) {
            return "";
        }
        txt = txt.replace(/https?:\S+/g, function (url) {
            return uo.makelink(url);
        });
        txt = txt.replace(/\n/g, "<br/>");
        return txt;
    };


};


