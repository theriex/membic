////////////////////////////////////////
// Just The Mods I Need
//

(function () {
    "use strict";

    ////////////////////////////////////////
    //prototype mods and global overrides
    /////////////////////////////////////////

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
