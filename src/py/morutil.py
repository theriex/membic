import datetime
import re


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
    return int(val)


