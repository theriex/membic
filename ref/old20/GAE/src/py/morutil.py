from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api.datastore_types import Blob
import logging
import datetime
import re
import json
import urllib

def nowISO():
    """ Return the current time as an ISO string """
    return dt2ISO(datetime.datetime.utcnow())


def dt2ISO(dt):
    iso = str(dt.year) + "-" + str(dt.month).rjust(2, '0') + "-"
    iso += str(dt.day).rjust(2, '0') + "T" + str(dt.hour).rjust(2, '0')
    iso += ":" + str(dt.minute).rjust(2, '0') + ":"
    iso += str(dt.second).rjust(2, '0') + "Z"
    return iso


def ISO2dt(isostr):
    dt = datetime.datetime.utcnow()
    dt = dt.strptime(isostr, "%Y-%m-%dT%H:%M:%SZ")
    return dt


def canonize(strval):
    """ Convert to lower case and remove all whitespace """
    strval = re.sub(r"\s+", "", strval)
    strval = strval.lower();
    return strval


def intz(val):
    if not val:
        return 0
    if isinstance(val, basestring) and val.startswith("\""):
        val = val[1:len(val) - 1]
    if val == "undefined":
        return 0
    try:
        val = int(val)
    except Exception as e:
        val = 0
    return val


# You can't return a value from a webapp2.RequestHandler, so this method
# does not return a value.  Common error codes:
# 400 Bad Request, 401 Not Authorized, 403 Forbidden, 404 Not Found, 
# 405 Method Not Allowed, 406 Not Acceptable, 409 Conflict
def srverr(handler, code, errtxt):
    handler.error(code)
    handler.response.out.write(errtxt)


def srvText(handler, text):
    """ Factored method to write headers for plain text result """
    handler.response.headers['Content-Type'] = 'text/plain'
    handler.response.out.write(text)


def srvJSON(handler, jsontxt):
    """ Factored method to write headers for JSON result """
    handler.response.headers['Access-Control-Allow-Origin'] = '*'
    handler.response.headers['Content-Type'] = 'application/json'
    handler.response.out.write(jsontxt)


# Filtered properties are removed from the dict before serializing it
# because that reduces the size and complexity of preb data, and it's easier
# to see that the value was omitted rather than filled out empty.
# Dictionary properties cannot be popped while iterating over them, so
# removing the props is done in a second pass.
def obj2JSON(obj, filts=[]):
    """ Factored method return a database object as JSON text """
    props = db.to_dict(obj)
    # logging.info("props: " + str(props))
    # logging.info("filts: " + str(filts))
    for prop, val in props.iteritems():
        # binary data like pics is fetched separately by id
        if(isinstance(val, Blob)):
            props[prop] = str(obj.key().id())
        # integer values must be strings or they overflow javascript integer
        if((isinstance(val, (int, long)) and (prop.endswith("id"))) or
           (prop == "srcrev")):
            props[prop] = str(props[prop])
        # logging.info(prop + ": " + str(props[prop]))
    for prop in filts:
        if prop in props:
            props.pop(prop, None)
    jsontxt = json.dumps(props, True)
    # prepend object information
    jsontxt = "{\"_id\":\"" + str(obj.key().id()) + "\", " +\
              "\"instid\":\"" + str(obj.key().id()) + "\", " +\
              "\"obtype\":\"" + obj.key().kind() + "\", " +\
              jsontxt[1:]
    # logging.info(jsontxt)
    return jsontxt


def qres2JSON(queryResults, cursor="", fetched=-1, itemsep="\n", filts=[]):
    """ Factored method to return query results as JSON """
    result = ""
    for obj in queryResults:
        if result:
            result += "," + itemsep + " "
        result += obj2JSON(obj, filts=filts)
    if cursor or fetched > 0:
        if result:
            result += "," + itemsep + " "
        result += "{\"fetched\":" + str(fetched) + \
            ", \"cursor\":\"" + cursor + "\"}"
    result = "[" + result + "]"
    return result


def srvObjs(handler, queryResults, cursor="", fetched=-1, filts=[]):
    """ Write JSON given an array of db objs or a query result """
    result = qres2JSON(queryResults, cursor, fetched, filts=filts)
    srvJSON(handler, result)


# hex values for a 4x4 transparent PNG created with GIMP:
blank4x4imgstr = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e\x7e\x00\x00\x00\x06\x62\x4b\x47\x44\x00\xff\x00\xff\x00\xff\xa0\xbd\xa7\x93\x00\x00\x00\x09\x70\x48\x59\x73\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07\x74\x49\x4d\x45\x07\xdd\x0c\x02\x11\x32\x1f\x70\x11\x10\x18\x00\x00\x00\x0c\x69\x54\x58\x74\x43\x6f\x6d\x6d\x65\x6e\x74\x00\x00\x00\x00\x00\xbc\xae\xb2\x99\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa0\x1c\x00\x00\x00\x44\x00\x01\x06\xc0\x57\xa2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"

# social net min size resolution is 200x200.  Anything less and the image
# won't show in the post, which is bad for sharing.
imgstdminsize = 200


def srvImg(handler, pic, minw=imgstdminsize):
    img = images.Image(pic)
    # By default, resize chooses the widest dimension, which can cause the
    # short dimension to dip below the minimum.  Using crop_to_fit instructs
    # the scaling to use the less restricting dimension and then chop off
    # the extra. Best available solution to meet min width requirement.
    img.resize(width=minw, height=minw, crop_to_fit=True)
    # After working without a hitch for a long time, the server had a bad
    # image conversion day and crapped out on half the images.  The try
    # block is a slight improvement in terms of tracing and recovery.
    # Returning the raw image data doesn't work, it has to be transformed
    # first.  May as well standardize on PNG format.
    try:
        img = img.execute_transforms(output_encoding=images.PNG)
    except Exception as e:
        logging.warn("srvImg execute_transforms error: " + str(e))
        return srverr(handler, 500, str(e))
    handler.response.headers['Content-Type'] = "image/png"
    handler.response.out.write(img)


def suppemail():
    return "@".join(["membicsystem", ".".join(["gmail", "com"])])


def csv_elem_count(csv):
    if not csv:
        return 0
    return csv.count(",") + 1


def csv_list(csv):
    if not csv:
        return []
    return csv.split(",")


def csv_contains(val, csv):
    if not csv:
        return False
    if csv == val:
        return True
    if csv.startswith(val + ","):
        return True
    index = csv.find("," + val)
    if index >= 0:
        return True
    return False


def id_in_csv(idval, csv):
    idval = str(idval)
    csv = csv or ""
    for elem in csv.split(","):
        if idval == elem:
            return elem
    return None


def remove_from_csv(val, csv):
    if not csv or csv == val:
        return ""
    if csv.startswith(val + ","):
        return csv[len(val) + 1:]
    val = "," + val
    index = csv.find(val)
    if index >= 0:
        return csv[0:index] + csv[index + len(val):]
    return csv


def remove_id_from_csv(idval, csv):
    if not csv:
        return ""
    ids = csv.split(",")
    try:
        ids.remove(str(idval))
    except Exception:
        pass  # not found is fine, as long as it's not in the list now
    return ",".join(ids)


def append_id_to_csv(idval, csv):
    if not csv:
        return str(idval)
    return csv + "," + str(idval)


def elem_count_csv(csv):
    if not csv:
        return 0
    ids = csv.split(",")
    return len(ids)


# CSV strings longer than 1000 elements are cumbersome to the point of
# being useless, so roll previous elements off the end to reasonably
# bound the length.
def prepend_to_csv(val, csv, upperbound=1000):
    if not csv:
        return val
    if csv_elem_count(csv) >= upperbound:
        csv = csv[0:csv.rfind(",")]
    return val + "," + csv


def append_to_csv(val, csv):
    val = str(val)
    if not csv:
        return val
    return csv + "," + val


def list_to_csv(values):
    csv = ""
    for val in values:
        csv = append_to_csv(val, csv)
    return csv

# append ikey:1 if ikey not present, otherwise increment count
def csv_increment(ikey, csv):
    if ikey.find(',') >= 0 or ikey.find(':') >= 0:
        raise ValueError("Invalid csv counter key: " + ikey)
    if not csv:
        return ikey + ":1"
    delimkey = ikey + ":"
    index = csv.find(delimkey)
    if index < 0:
        return csv + "," + ikey + ":1"
    index += len(ikey) + 1  # start of count
    endidx = index + 1
    while endidx < len(csv) and csv[endidx] != ',':
        endidx += 1
    count = int(csv[index:endidx])
    count += 1
    updated = csv[0:index] + str(count)
    if endidx < len(csv):
        updated += csv[endidx:]
    return updated


def htmlquot(txt):
    txt = txt or ""
    return txt.replace("\"", "&quot;")


def safeURIEncode(stringval, stripnewlines = False):
    if not stringval:
        stringval = ""
    if stripnewlines:
        stringval = ''.join(stringval.splitlines())
    return urllib.quote(stringval.encode("utf-8"))


def safestr(val):
    if not val:
        return ""
    try:
        # str(val) yields ascii only. Names are not all english.
        val = unicode(val)
    except Exception as e:
        logging.info("safestr exception: " + str(e))
        val = val.encode('ascii', 'xmlcharrefreplace')
        logging.info("safestr fallback encoding: " + val)
    return val


def onelinestr(val):
    val = safestr(val);
    val = val.replace("\n", " ")
    if len(val) > 255:
        val = val[:255]
    return val


# debug output doesn't show up in development log view, so this dumps text
# at info level while making it easy to find/cleanup in code
def debuginfo(text):
    logging.info(text)



