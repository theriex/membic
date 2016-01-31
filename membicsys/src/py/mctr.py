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
    """ A Membic sharded Counter instance. One instance for each
    profile or theme.  Not guaranteed. May underreport if there are
    several updates within the timedelta used by put_mctr to determine
    caching followed by no updates for enough time that the counter
    was lost from cache. A visitor is someone who clicks through to
    the profile/theme, or who interacts with a posted review. """
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
        gql = MembicCounter.gql("WHERE refp = :1", key)
        cs = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        if len(cs) > 0:
            counter = cs[0]
        else:  # not found in db, make a new one
            counter = MembicCounter(refp=key,day=day)
            counter.modified = ""  # indicates this is a new counter
            counter.sitev = 0
            counter.sitek = 0
            counter.permv = 0
            counter.permk = 0
            counter.rssv = 0
            counter.logvis = ""
            counter.refers = ""
            counter.membics = 0
            counter.edits = 0
            counter.removed = 0
            counter.starred = 0
            counter.remembered = 0
            counter.responded = 0
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
        counter = MembicCounter.get_by_id(counter.key().id())  #force db read
    memcache.set(counter.refp, pickle.dumps(counter))


def normalized_count_field(pnm, field):
    if field == "sitev" and pnm:
        field = "sitek"
    elif field == "permv" and pnm:
        field = "permk"
    return field


def safe_refer_key(refer):
    if refer.lower().startswith("http://"):
        refer = refer[7:]
    elif refer.lower().startswith("https://"):
        refer = refer[8:]
    refer = re.sub(r":", "", refer)  # remove any colons (delimiter for count)
    return refer


########################################
# module interfaces

def bump_rss_summary(ctm):
    counter = get_mctr("Coop", ctm.key().id())
    counter.rssv = counter.rssv or 0
    counter.rssv += 1;
    put_mctr(counter, "rssv")
    # logging.info("bump_rss_counter " + counter.refp + ".rssv: " + 
    #              str(counter.rssv))


def count_review_update(action, penid, penname, ctmid, srcrev):
    counter = None
    field = None
    if ctmid > 0:
        counter = get_mctr("Coop", ctmid)
    else:
        counter = get_mctr("PenName", penid)
    if action == "save":
        counter.membics += 1
        field = "membics"
    elif action == "edit":
        counter.edits += 1;
        field = "edits"
    elif action == "delete":
        counter.removed += 1;
        field = "removed"
    put_mctr(counter, field)
    if action == "save" and srcrev > 0:
        # 30jan16 ep: no reasonable way to find cached srcrev in feed blocks
        counter = None
        src = rev.Review.get_by_id(srcrev)
        if src:
            if src.ctmid > 0:  # Source review was a Coop post
                counter = get_mctr("Coop", src.ctmid)
            else:
                counter = get_mctr("PenName", src.penid)
            if counter:
                counter.responded += 1;
                put_mctr(counter, "responded")


########################################
# endpoint definitions

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
            refer = safe_refer_key(refer)
            if refer:
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

