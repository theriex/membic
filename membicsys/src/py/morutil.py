from google.appengine.ext import db
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


def obj2JSON(obj, filts=[]):
    """ Factored method return a database object as JSON text """
    props = db.to_dict(obj)
    # logging.info("props: " + str(props))
    logging.info("filts: " + str(filts))
    for prop, val in props.iteritems():
        # binary data like pics is fetched separately by id
        if(isinstance(val, Blob)):
            props[prop] = str(obj.key().id())
        # integer values must be strings or they overflow javascript integer
        if((isinstance(val, (int, long)) and (prop.endswith("id"))) or
           (prop == "srcrev")):
            props[prop] = str(props[prop])
        if prop in filts:
            props[prop] = ""
        # logging.info(prop + ": " + str(props[prop]))
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

