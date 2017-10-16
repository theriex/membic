import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import pickle
import json
import logging
from cacheman import *
import moracct
import datetime
import re
import rev
import pen

class MembicCounter(db.Model):
    """ A Membic sharded Counter instance. One instance for each
    profile or theme.  Not guaranteed. May underreport if there are
    several updates within the timedelta used by put_mctr to determine
    caching followed by no updates for enough time that the counter
    was lost from cache. A visitor is someone who clicks through to
    the profile/theme, or who interacts with a posted review. """
    # SiteCounter0 is the general activity display
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
    agents = db.TextProperty()                     # agstr:N,...
    # activity metrics:
    membics = db.IntegerProperty(indexed=False)    # num membics posted
    edits = db.IntegerProperty(indexed=False)      # num membics edited
    removed = db.IntegerProperty(indexed=False)    # num membics removed
    starred = db.IntegerProperty(indexed=False)    # num membics starred
    remembered = db.IntegerProperty(indexed=False) # num membics remembered
    responded = db.IntegerProperty(indexed=False)  # num membics responded


def normalize_mctr_type(handler):
    ctype = handler.request.get("ctype")
    if not ctype:
        return srverr(handler, 400, "No ctype specified")
    ct = ctype.lower()
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
        vq = VizQuery(MembicCounter, "WHERE refp = :1 AND day = :2", key, day)
        cs = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
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
            counter.agents = ""
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


def safe_csv_counter_key(ktxt):
    if ktxt.lower().startswith("http://"):
        ktxt = ktxt[7:]
    elif ktxt.lower().startswith("https://"):
        ktxt = ktxt[8:]
    ktxt = re.sub(r",", "", ktxt)  # remove any commas so CSV works
    ktxt = re.sub(r":", "", ktxt)  # remove any colons (delimiter for count)
    ktxt = ktxt[0:128]  # agent strings can be huge, leave just enough
    return ktxt


def note_agent(counter, request):
    agent = request.headers.get('User-Agent')
    if agent:
        agent = safe_csv_counter_key(agent)
        if agent:
            counter.agents = csv_increment(agent, counter.agents)


########################################
# module interfaces

def bump_rss_summary(ctm, request):
    counter = get_mctr("Coop", ctm.key().id())
    counter.rssv = counter.rssv or 0
    counter.rssv += 1;
    note_agent(counter, request)
    put_mctr(counter, "rssv")
    logging.info("bump_rss_counter " + counter.refp + ": " + str(counter.rssv))


def bump_starred(review, disprevid, ctmid):
    revid = review.key().id()
    # counters are a side-effect. do not fail and affect caller processing
    try:
        counter = get_mctr("PenName", review.penid)
        counter.starred = counter.starred or 0
        counter.starred += 1
        put_mctr(counter, "starred")
        logging.info("bump_starred " + counter.refp + ": " + 
                     str(counter.starred))
        if disprevid > 0 and disprevid != revid and ctmid:
            counter = get_mctr("Coop", ctmid)
            counter.starred = counter.starred or 0
            counter.starred += 1
            put_mctr(counter, "starred")
            logging.info("bump_starred " + counter.refp + ": " + 
                         str(counter.starred))
    except Exception as e:
        logging.error("bump_starred revid: " + str(revid) + 
                      ", disprevid: " + str(disprevid) + 
                      ", ctmid: " + str(ctmid) + " failed: " + str(e))


def bump_remembered(review, disprevid, ctmid):
    revid = review.key().id()
    try:
        counter = get_mctr("PenName", review.penid)
        counter.remembered = counter.remembered or 0
        counter.remembered += 1;
        put_mctr(counter, "remembered")
        logging.info("bump_remembered " + counter.refp + ": " + 
                     str(counter.remembered))
        if disprevid > 0 and disprevid != revid and ctmid:
            counter = get_mctr("Coop", ctmid)
            counter.remembered = counter.remembered or 0
            counter.remembered += 1;
            put_mctr(counter, "remembered")
            logging.info("bump_remembered " + counter.refp + ": " + 
                         str(counter.remembered))
    except Exception as e:
        logging.error("bump_remembered revid: " + str(revid) + 
                      ", disprevid: " + str(disprevid) + 
                      ", ctmid: " + str(ctmid) + " failed: " + str(e))


def count_review_update(action, penid, penname, ctmid, srcrev):
    counter = None
    field = None
    if ctmid > 0:
        counter = get_mctr("Coop", ctmid)
    else:
        counter = get_mctr("PenName", penid)
    if action == "save":
        counter.membics = counter.membics or 0
        counter.membics += 1
        field = "membics"
    elif action == "edit":
        counter.edits = counter.edits or 0
        counter.edits += 1;
        field = "edits"
    elif action == "delete":
        counter.removed = counter.removed or 0
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
                counter.responded = counter.responded or 0
                counter.responded += 1;
                put_mctr(counter, "responded")


# Prevents stale data from showing up in subsequent queries by forcing
# a retrieval by id after database write.  Factors a common pattern
# for updating the membic counters.
def synchronized_db_write(instance):
    instance.modified = nowISO()
    instance.put()
    # force retrieval to ensure any subsequent db queries find the latest
    instance = instance.__class__.get_by_id(instance.key().id())
    # update cache like cached_put if this is a pickle cached instance
    cname = instance.__class__.__name__
    pcns = ["PenName", "Coop"]
    if cname in pcns:
        memcache.set(cname + str(instance.key().id()), pickle.dumps(instance))
    # if this was a membic, bump the appropriate counter
    if cname == "Review":
        updt = "save"
        if instance.is_saved():
            updt = "edit"
        count_review_update(updt, instance.penid, instance.penname,
                            instance.ctmid, instance.srcrev)
    return instance



########################################
# endpoint definitions

class BumpCounter(webapp2.RequestHandler):
    def post(self):
        ctype = normalize_mctr_type(self)
        if not ctype:
            return
        parid = intz(self.request.get("parentid"))
        pnm = None
        penid = self.request.get("penid")
        if penid and int(penid):
            acc = moracct.authenticated(self.request)
            if acc:
                pnm = cached_get(penid, pen.PenName)
        field = normalized_count_field(pnm, self.request.get("field"))
        refer = self.request.get("refer")
        logging.info("BumpCounter ctype: " + str(ctype) + ", parentid: " + str(parid) + ", penid: " + str(penid) + ", field: " + str(field) + ", refer: " + str(refer))
        counter = get_mctr(ctype, parid)
        if pnm:  # note any new visitors
            name = re.sub(r",+", "", pnm.name)  # strip any commas
            name = moracct.safeURIEncode(name)
            val = penid + ":" + name
            if not csv_contains(val, counter.logvis):
                counter.logvis = prepend_to_csv(val, counter.logvis)
        if refer:  # note referral if given
            refer = safe_csv_counter_key(refer)
            if refer:
                counter.refers = csv_increment(refer, counter.refers)
        note_agent(counter, self.request)
        # update the count
        cval = getattr(counter, field)
        cval = cval or 0  # counter field may not be initialized yet
        cval += 1
        setattr(counter, field, cval)
        put_mctr(counter, field)
        logging.info("BumpCounter " + counter.refp + "." + field + 
                     ": " + str(cval))
        moracct.returnJSON(self.response, [counter])


class GetCounters(webapp2.RequestHandler):
    def get(self):
        ctype = normalize_mctr_type(self)
        if not ctype:
            return
        parid = intz(self.request.get("parentid"))  # sets to 0 if not found
        acc = None
        if not ctype == "Coop":
            acc = moracct.authenticated(self.request)
            if not acc:
                return srverr(self, "403", "Authentication failed")
        # Anyone following a theme has stats access, but profiles are private
        if ctype == "PenName":
            pnm = rev.acc_review_modification_authorized(acc, self)
            if not pnm or (pnm and pnm.key().id() != parid):
                return srverr(self, "403",
                              "You may only view stats for your own profile")
        elif (ctype == "Site" and 
            (not acc or acc.key().id() != 11005) and 
            (not self.request.host_url.startswith('http://localhost'))):
            return srverr(self, "403", 
                          "Access stats through your profile or theme")
        cqk = ctype + "CtrQuery" + str(parid)
        res = memcache.get(cqk)
        counter = get_mctr(ctype, parid)
        if res:
            res = json.loads(res)
            # if last saved counter is not the current counter, and the 
            # current counter is not temporary, then results are old
            if len(res) and res[-1]["day"] != counter.day and counter.modified:
                res = ""
                memcache.set(cqk, "")
        if res:
            counter = db.to_dict(counter)
            if len(res) and res[-1]["day"] == counter["day"]:
                res[-1] = counter
            else:
                res.append(counter)
            return moracct.writeJSONResponse(json.dumps(res, True), 
                                             self.response)
        refp = ctype + "Counter" + str(parid)
        daysback = 70  # max 10 weeks back if not restricted by batch_size
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(daysback))
        vq = None
        if ctype == "Site":
            vq = VizQuery(MembicCounter, "WHERE day > :1", thresh)
        else:
            vq = VizQuery(MembicCounter, "WHERE refp = :1 AND day > :2", 
                          refp, thresh)
        ctrs = vq.run(read_policy=db.EVENTUAL_CONSISTENCY, batch_size=1000)
        jsondat = moracct.qres2JSON(ctrs)
        memcache.set(cqk, jsondat)
        moracct.writeJSONResponse(jsondat, self.response)


class CurrentStat(webapp2.RequestHandler):
    def get(self):
        ctype = normalize_mctr_type(self)
        if not ctype:
            return
        parid = intz(self.request.get("parentid"))  # sets to 0 if not found
        counter = get_mctr(ctype, parid)
        if not counter.modified:
            put_mctr(counter)  # JSON processing needs an id
        moracct.returnJSON(self.response, [ counter ]);
        


app = webapp2.WSGIApplication([('.*/bumpmctr', BumpCounter),
                               ('.*/getmctrs', GetCounters),
                               ('.*/currstats', CurrentStat)], debug=True)

