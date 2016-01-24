import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import pickle
import logging
from cacheman import *
from moracct import *
import datetime
import re
import rev

class MembicCounter(db.Model):
    """ A Membic sharded Counter instance. Not guaranteed. May underreport. """
    # parentid 0 is global app counter
    refp = db.StringProperty(required=True)        # <type>Counter<parentid>
    day = db.StringProperty(required=True)         # ISO date for this count
    modified = db.StringProperty()                 # ISOmem;ISOdb
    # traffic metrics: (sum visit types for total)
    sitev = db.IntegerProperty(indexed=False)      # anon visits via main app
    sitek = db.IntegerProperty(indexed=False)      # known visits via main app
    permv = db.IntegerProperty(indexed=False)      # anon permalink visits
    permk = db.IntegerProperty(indexed=False)      # known permalink visits
    rssv = db.IntegerProperty(indexed=False)       # RSS summary requests
    logvis = db.TextProperty()                     # visitors penid:encname,...
    refers = db.TextProperty()                     # srcA:3,srcB:12...
    # activity metrics:
    membics = db.IntegerProperty(indexed=False)    # num membics posted
    edits = db.IntegerProperty(indexed=False)      # num membics edited
    removed = db.IntegerProperty(indexed=False)    # num membics removed
    starred = db.IntegerProperty(indexed=False)    # num membics starred
    remembered = db.IntegerProperty(indexed=False) # num membics remembered
    responded = db.IntegerProperty(indexed=False)  # num membics responded


def normalize_mctr_type(giventype):
    ct = giventype.lower()
    if ct == 'site':
        return "Site"
    if ct == 'coop' or ct == 'theme':
        return "Coop"
    if ct == 'pen' or ct == 'penname' or ct == 'profile':
        return "PenName"
    raise ValueError("Unknown counter type " + giventype)


def get_mctr(ctype, parid):
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
        gql = MembicCounter.gql("WHERE refp = :1", ctype + str(parid))
        cs = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        if len(cs) > 0:
            counter = cs[0]
        else:  # not found in db, make a new one
            counter = MembicCounter(refp=key,day=day)
            counter.modified = ""  # indicates this is a new counter
    return counter


def put_mctr(counter, field=None):
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
    memcache.set(counter.refp, pickle.dumps(counter))


def normalized_count_field(pnm, field):
    if field == "sitev" and pnm:
        field = "sitek"
    elif field == "permv" and pnm:
        field = "permk"
    return field


def bump_rss_summary(ctm):
    counter = get_mctr("Coop", ctm.key().id())
    counter.rssv = counter.rssv or 0
    counter.rssv += 1;
    put_mctr(counter, "rssv")
    logging.info("bump_rss_counter " + counter.refp + ".rssv: " + 
                 str(counter.rssv))


class BumpCounter(webapp2.RequestHandler):
    def post(self):
        ctype = normalize_mctr_type(self.request.get("ctype"))
        parid = int(self.request.get("parentid"))
        pnm = None
        penid = self.request.get("penid")
        if penid and int(penid):
            acc = authenticated(self.request)
            if acc:
                pnm = rev.acc_review_modification_authorized(acc, self)
        field = normalized_count_field(pnm, self.request.get("field"))
        refer = self.request.get("refer")
        counter = get_mctr(ctype, parid)
        if pnm:  # note any new visitors
            name = re.sub(r",+", "", pnm.name)  # strip any commas
            name = safeURIEncode(name)
            val = penid + ":" + name
            if not csv_contains(val, counter.logvis):
                counter.logvis = prepend_to_csv(val, counter.logvis)
        if refer:  # note referral if given
            counter.refers = csv_increment(refer, counter.refers)
        # update the count
        cval = getattr(counter, field)
        cval = cval or 0  # counter field may not be initialized yet
        cval += 1
        setattr(counter, field, cval)
        put_mctr(counter, field)
        logging.info("BumpCounter " + counter.refp + "." + field + 
                     ": " + str(cval))
        returnJSON(self.response, [counter])


class GetCounters(webapp2.RequestHandler):
    def get(self):
        ctype = normalize_mctr_type(self.request.get("ctype"))
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


app = webapp2.WSGIApplication([('.*/bumpmctr', BumpCounter),
                               ('.*/getmctrs', GetCounters)], debug=True)

