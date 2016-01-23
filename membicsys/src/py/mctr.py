import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import pickle
import logging
from cacheman import *
import datetime
import re

class MembicCounter(db.Model):
    """ A Membic sharded Counter instance. Not guaranteed. May underreport. """
    # parent 0 is global app counter
    refp = db.StringProperty(required=True)        # <type>Counter<parentid>
    day = db.StringProperty(required=True)         # ISO date for this count
    modified = db.StringProperty()                 # ISOmem;ISOdb
    # traffic metrics: (sum visit types for total)
    sitev = db.IntegerProperty(indexed=False)      # visits via main app
    parav = db.IntegerProperty(indexed=False)      # visits via app params link
    permv = db.IntegerProperty(indexed=False)      # visits via the permalink
    rssv = db.IntegerProperty(indexed=False)       # RSS summary requests
    identv = db.IntegerProperty(indexed=False)     # logged in visitors
    logvis = db.TextProperty()                     # visitors penid:encname,...
    refers = db.TextProperty()                     # srcA:3,srcB:12...
    # activity metrics:
    membics = db.IntegerProperty(indexed=False)    # num membics posted
    edits = db.IntegerProperty(indexed=False)      # num membics edited
    removed = db.IntegerProperty(indexed=False)    # num membics removed
    starred = db.IntegerProperty(indexed=False)    # num membics starred
    remembered = db.IntegerProperty(indexed=False) # num membics remembered
    responded = db.IntegerProperty(indexed=False)  # num membics responded


def normalize_counter_type(giventype):
    ct = giventype.lower()
    if ct == 'site':
        return "Site"
    if ct == 'coop' or ct == 'theme':
        return "Coop"
    if ct == 'pen' or ct == 'penname':
        return "PenName"
    raise ValueError("Unknown counter type " + giventype)


def getCounter(ctype, parid):
    key = ctype + "Counter" + str(parid)
    day = dt2ISO(datetime.datetime.utcnow())[:10] + "T00:00:00Z"
    counter = memcache.get(key)  # race conditions on update are acceptable
    if counter:
        counter = pickle.loads(counter)
        if counter.day != day:  # old counter, flush it
            counter.modified = nowISO()
            counter.put()
            memcache.set(key, "")
            counter = None
    if not counter:
        gql = MembicCounter.gql("WHERE parent = :1", ctype + str(parid))
        cs = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        if len(cs) > 0:
            counter = cs[0]
        else:  # not found in db, make a new one
            counter = MembicCounter(parent=key)
            counter.day = day
            counter.modified = ""  # indicates this is a new counter
    return counter


def putCounter(counter, field=None):
    # force write fields are low volume, critical counts to keep track of
    fwf = ["membics", "edits", "removed", "remembered", "responded"]
    if field in fwf:
        counter.modified = ""
    counter.modified = counter.modified or ""
    dtnow = datetime.datetime.utcnow()
    thresh = dt2ISO(dtnow - datetime.timedelta(minutes=5))
    if thresh > counter.modified:
        counter.modified = nowISO();
        counter.put()
    memcache.set(key, pickle.dumps(counter))


class BumpCounter(webapp2.RequestHandler):
    def post(self):
        ctype = normalize_counter_type(self.request.get("type"))
        parid = int(self.request.get("parentid"))
        field = self.request.get("field")
        counter = getCounter(ctype, parid)
        if field == "logvis":
            penid = self.request.get("penid")
            name = self.request.get("name")
            name = re.sub(r",+", "", strval)  # strip any commas
            name = safeURIEncode(name)        # re-encode
            val = penid + ":" + name
            if not csv_contains(val, counter.logvis):
                counter.logvis = prepend_to_csv(val, counter.logvis)
        elif field == "refers":
            refer = self.request.get("refer")
            counter.refers = csv_increment(refer, counter.refers)
        else:
            cval = int(getattr(counter, field))
            cval += 1
            setattr(counter, field, cval)
        putCounter(counter, field)
        returnJSON(self.response, [counter])


class GetCounters(webapp2.RequestHandler):
    def get(self):
        ctype = normalize_counter_type(self.request.get("type"))
        parid = int(self.request.get("parentid"))
        refp = ctype + "Counter" + parid
        daysback = 70  # 10 weeks back
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(daysback))
        cq = None
        if ctype == "Site":
            cq = MSCtr.gql("WHERE day > :1", thresh)
        else:
            cq = MSCtr.gql("WHERE refp = :1 AND day > :2", refp, thresh)
        ctrs = cq.run(read_policy=db.EVENTUAL_CONSISTENCY, batch_size=1000)
        returnJSON(self.response, ctrs)


app = webapp2.WSGIApplication([('.*/bumpctr', BumpCounter),
                               ('.*/getmsctrs', GetCounters)], debug=True)

