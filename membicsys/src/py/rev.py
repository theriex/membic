import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
import urllib
import moracct
from morutil import *
import pen
import coop
import mailsum
import mctr
import mfeed
import mblock
import json
from operator import attrgetter, itemgetter
import re
from cacheman import *
import time


# srcrev is heavily utilized in different contexts:
#   - if there is a source review with the same cankey where
#     references are being tracked, srcrev holds that source review id.
#   - if this is a coop posted review (ctmid is filled in), then
#     srcrev holds the revid of the original review.
#   - negative srcrev values indicate special handling:
#       -101: Future review (placeholder for later writeup)
#       -202: Batch update (e.g. iTunes upload or similar)
#       -604: Marked as deleted
#     Special handling reviews may not be posted to coops
class Review(db.Model):
    """ Membic future self reflecting review of something """
    revtype = db.StringProperty(required=True)   # book, movie, music...
    penid = db.IntegerProperty(required=True)    # who wrote the review
    ctmid = db.IntegerProperty()                 # 0 if source review
    rating = db.IntegerProperty()                # 0-100
    srcrev = db.IntegerProperty()                # see class comment
    mainfeed = db.IntegerProperty()              # 0 if ineligible, 1 if ok
    cankey = db.StringProperty()                 # canonized key/subkey value
    modified = db.StringProperty()               # ISO date
    modhist = db.StringProperty()                # creation date, mod count
    # non-indexed fields:
    keywords = db.TextProperty()                 # human readable CSV
    text = db.TextProperty()                     # review text
    revpic = db.BlobProperty()                   # uploaded pic for review
    imguri = db.TextProperty()                   # linked review pic URL
    icwhen = db.StringProperty(indexed=False)    # when img cache last written
    icdata = db.BlobProperty()                   # secure relay img cache data
    dispafter = db.StringProperty(indexed=False) # ISO date
    altkeys = db.TextProperty()                  # known equivalent cankey vals
    svcdata = db.TextProperty()                  # supporting client data JSON
    penname = db.StringProperty(indexed=False)   # for ease of reporting
    orids = db.TextProperty()                    # other revids CSV
    helpful = db.TextProperty()                  # penids CSV
    remembered = db.TextProperty()               # penids CSV
    # type-specific non-indexed fields
    name = db.StringProperty(indexed=False)      # yum, activity, other
    title = db.StringProperty(indexed=False)     # book, movie, video, music
    url = db.StringProperty(indexed=False)       # canonical URL for item
    rurl = db.StringProperty(indexed=False)      # original read URL
    artist = db.StringProperty(indexed=False)    # video, music
    author = db.StringProperty(indexed=False)    # book
    publisher = db.StringProperty(indexed=False) # book
    album = db.StringProperty(indexed=False)     # music
    starring = db.StringProperty(indexed=False)  # movie
    address = db.StringProperty(indexed=False)   # yum, activity
    year = db.StringProperty(indexed=False)      # values like "80's" ok


known_rev_types = ['book', 'article', 'movie', 'video', 
                   'music', 'yum', 'activity', 'other']


def acc_review_modification_authorized(acc, handler):
    penid = intz(handler.request.get('penid'))
    if not penid:
        srverr(handler, 401, "No penid specified")
        return False
    pnm = cached_get(penid, pen.PenName)
    if not pnm:
        srverr(handler, 404, "Pen " + str(penid) + " not found.")
        return False
    authok = pen.authorized(acc, pnm)
    if not authok:
        srverr(handler, 401, "Pen name not authorized.")
        return False
    return pnm


def review_modification_authorized(handler):
    """ Return the PenName if the penid matches a pen name the caller is 
        authorized to modify, otherwise return False """
    acc = moracct.authenticated(handler.request)
    if not acc:
        srverr(handler, 401, "Authentication failed")
        return False
    return acc_review_modification_authorized(acc, handler)


def noauth_get_review_for_update(handler):
    revid = intz(handler.request.get('_id'))
    if not revid:
        revid = intz(handler.request.get('revid'))
    review = Review.get_by_id(revid)  # Review db instances not cached
    if not review:
        srverr(handler, 404, "Review id: " + str(revid) + " not found.")
        return False
    return review


def safe_get_review_for_update(handler):
    review = noauth_get_review_for_update(handler)
    if not review:
        return False
    penid = intz(handler.request.get('penid'))
    if penid != review.penid:
        srverr(handler, 401, "Review pen does not match")
        return False
    return review


def get_review_for_save(handler):
    penid = intz(handler.request.get('penid'))
    revid = intz(handler.request.get('_id'))
    if not revid:
        revid = intz(handler.request.get('revid'))
    review = None
    if revid:
        review = Review.get_by_id(revid)  # Review db instances not cached
    if not review:
        review = fetch_review_by_cankey(handler)
        if not review:
            revtype = handler.request.get('revtype')
            review = Review(penid=penid, revtype=revtype)
    if penid != review.penid:
        srverr(handler, 401, "Not your review")
        return False
    return review


def canonize_cankey(cankey):
    # whitespace and generally problematic characters
    cankey = re.sub(r'\s', '', cankey)
    cankey = re.sub(r'\"', '', cankey)
    cankey = re.sub(r'\.', '', cankey)
    # URI reserved delimiters
    cankey = re.sub(r'\:', '', cankey)
    cankey = re.sub(r'\/', '', cankey)
    cankey = re.sub(r'\?', '', cankey)
    cankey = re.sub(r'\#', '', cankey)
    cankey = re.sub(r'\[', '', cankey)
    cankey = re.sub(r'\]', '', cankey)
    cankey = re.sub(r'\@', '', cankey)
    # URI reserved sub delimiters
    cankey = re.sub(r'\!', '', cankey)
    cankey = re.sub(r'\$', '', cankey)
    cankey = re.sub(r'\&', '', cankey)
    cankey = re.sub(r'\'', '', cankey)
    cankey = re.sub(r'\(', '', cankey)
    cankey = re.sub(r'\)', '', cankey)
    cankey = re.sub(r'\*', '', cankey)
    cankey = re.sub(r'\+', '', cankey)
    cankey = re.sub(r'\,', '', cankey)
    cankey = re.sub(r'\;', '', cankey)
    cankey = re.sub(r'\=', '', cankey)
    cankey = cankey.lower()
    return cankey


def create_cankey_from_request(handler):
    cankey = ""
    revtype = handler.request.get('revtype')
    if revtype == 'book':
        cankey = handler.request.get('title') + handler.request.get('author')
    elif revtype == 'movie':
        cankey = handler.request.get('title')
    elif revtype == 'video':
        cankey = handler.request.get('title')
    elif revtype == 'music':
        cankey = handler.request.get('title') + handler.request.get('artist')
    else:
        cankey = handler.request.get('name')
    return canonize_cankey(cankey)


def create_cankey_for_review(review):
    cankey = ""
    revtype = review.revtype
    if revtype == 'book':
        cankey = review.title + review.author
    elif revtype == 'movie':
        cankey = review.title
    elif revtype == 'video':
        cankey = review.title
    elif revtype == 'music':
        cankey = review.title + review.artist
    else:
        cankey = review.name
    return canonize_cankey(cankey)


def set_if_param_given(review, fieldname, handler, paramname):
    defaultval = "MOR_parameter_unspecified"
    val = handler.request.get(paramname, default_value=defaultval)
    logging.info("set_if_param_given " + paramname + ": " + val)
    if val != defaultval:
        setattr(review, fieldname, val)


def note_modified(review):
    review.modified = nowISO()
    if review.modhist:
        elems = review.modhist.split(";")
        elems[1] = str(int(elems[1]) + 1)
        review.modhist = ";".join(elems)
    else:
        review.modhist = review.modified + ";1"


def read_review_values(handler, review):
    """ Read the form parameter values into the given review """
    review.penid = intz(handler.request.get('penid'))
    review.ctmid = intz(handler.request.get('ctmid'))
    review.revtype = handler.request.get('revtype')
    ratingstr = handler.request.get('rating')
    if ratingstr:
        review.rating = int(ratingstr)
    set_if_param_given(review, "keywords", handler, "keywords")
    set_if_param_given(review, "text", handler, "text")
    # review.revpic is uploaded separately, but deleted via flag:
    val = handler.request.get("revpic", "")
    if val == "DELETED":
        review.revpic = None
    set_if_param_given(review, "imguri", handler, "imguri")
    note_modified(review)
    review.name = moracct.onelinestr(handler.request.get('name'))
    review.title = moracct.onelinestr(handler.request.get('title'))
    set_if_param_given(review, "url", handler, "url")
    set_if_param_given(review, "rurl", handler, "rurl")
    review.artist = moracct.onelinestr(handler.request.get('artist'))
    review.author = moracct.onelinestr(handler.request.get('author'))
    set_if_param_given(review, "publisher", handler, "publisher")
    set_if_param_given(review, "album", handler, "album")
    set_if_param_given(review, "starring", handler, "starring")
    set_if_param_given(review, "address", handler, "address")
    set_if_param_given(review, "year", handler, "year")
    review.cankey = handler.request.get('cankey')
    if not review.cankey:
        review.cankey = create_cankey_from_request(handler)
    set_if_param_given(review, "altkeys", handler, "altkeys")
    srevidstr = handler.request.get('srevid')
    if srevidstr:
        review.srevid = intz(srevidstr)
    set_if_param_given(review, "svcdata", handler, "svcdata")
    srcrevstr = handler.request.get('srcrev')
    if srcrevstr:
        review.srcrev = intz(srcrevstr)
    else:
        review.srcrev = 0


def fetch_review_by_ptc(penid, revtype, cankey):
    where = "WHERE penid = :1 AND revtype = :2 AND cankey = :3"
    vq = VizQuery(Review, where, penid, revtype, cankey)
    reviews = vq.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
    if len(reviews) > 0:
        return reviews[0]


def fetch_review_by_cankey(handler):
    penid = intz(handler.request.get('penid'))
    revtype = handler.request.get('revtype')
    cankey = handler.request.get('cankey')
    if not cankey:
        cankey = create_cankey_from_request(handler)
    return fetch_review_by_ptc(penid, revtype, cankey)


def batch_flag_attrval(review):
    return "\"batchUpdated\":\"" + review.modified + "\""


def set_review_mainfeed(rev, acc):
    # NB: rev.key().id() is NOT defined at this point
    rev.mainfeed = 1
    logmsg = "set_review_mainfeed " + (rev.title or rev.name) + " "
    if rev.svcdata and batch_flag_attrval(rev) in rev.svcdata:
        # moracct.debuginfo(logmsg + "is batch.")
        rev.srcrev = -202
        rev.mainfeed = 0
    if rev.srcrev < 0:  # future review, batch update etc.
        # moracct.debuginfo(logmsg + "is future or batch.")
        rev.mainfeed = 0
    if rev.ctmid > 0:   # coop posting, not source review
        # moracct.debuginfo(logmsg + "is coop posting.")
        rev.mainfeed = 0
    if acc.authconf:  # account needs help
        rev.mainfeed = 0
    if not rev.text or len(rev.text) < 65:  # not substantive (matches UI)
        # moracct.debuginfo(logmsg + "text not substantive.")
        rev.mainfeed = 0
    if not rev.rating or rev.rating < 60:  # 3 stars or better
        # moracct.debuginfo(logmsg + "is not highly rated.")
        rev.mainfeed = 0
    # moracct.debuginfo("set_review_mainfeed: " + str(rev.mainfeed))


def set_review_dispafter(review, pnm):
    # dispafter is only set on create, it is not changed on edit. If a
    # dispafter were to be altered for one membic it could logically cascade
    # into the entire queue.
    if review.is_saved():
        return
    mpd = 1
    jstr = pnm.settings or "{}"
    try:
        psd = json.loads(jstr)
        if "maxPostsPerDay" in psd:
            mpd = min(2, int(psd["maxPostsPerDay"]))
        review.dispafter = mblock.get_queuing_vis_date(pnm.key().id(), mpd)
    except Exception as e:
        logging.warn("set_review_dispafter pen: " + str(pnm.key().id()) +
                     " queuing failure: " + str(e))


def prepend_to_main_feeds(review, pnm):
    feedentry = str(review.key().id()) + ":" + str(review.penid)
    allrevs = memcache.get("all") or ""
    allrevs = remove_from_csv(feedentry, allrevs)
    allrevs = prepend_to_csv(feedentry, allrevs)
    memcache.set("all", allrevs)
    typerevs = memcache.get(review.revtype) or ""
    typerevs = remove_from_csv(feedentry, typerevs)
    typerevs = prepend_to_csv(feedentry, typerevs)
    memcache.set(review.revtype, typerevs)


# The standard caching for the app uses pickle and works with db.Model
# class instances that reconstitute as class instances.  This is a
# block cache that holds an array of instances in json format, and
# returns an instance as a dict.  Looking in memcache, "pen1234" is a
# json array, while "PenName1234" is a pickled db record.
# 
# A profile can be for a PenName or for a Coop.  In serialized json
# form, this cached data block is an array where:
#      [0]: Public visible PenName or Coop instance.
#  [1-~50]: Recent revs (most recent first) limited by fetchmax.
#   [~51+]: Supporting revs.  Top revs not already in included in
#           recent.  A Coop will also include srcrev instances for
#           ease of access by client.
class ProfRevCache(object):
    prefix = ""
    dbprofinst = None
    publicprofinst = None
    cache = None
    mainlist = None  # recent revs, or previous entire cache
    supplist = None
    def set_db_prof_inst(self, dbprofinst):
        self.publicprofinst = json.loads(moracct.obj2JSON(dbprofinst))
        if dbprofinst.__class__.__name__ == "PenName":
            pen.filter_sensitive_fields(self.publicprofinst)
    def __init__(self, prefix, dbprofinst):
        self.prefix = prefix
        self.set_db_prof_inst(dbprofinst)
        self.cache = {}
        self.mainlist = []
        self.supplist = []
        jstr = memcache.get(prefix + str(self.publicprofinst["_id"]))
        if jstr:
            self.mainlist = json.loads(jstr)[1:]
            for inst in self.mainlist:
                self.cache[str(inst["_id"])] = inst
    def get_cached_instance(self, instid):
        if str(instid) in self.cache:
            return self.cache[str(instid)]
        return None
    def add_instance(self, inst, supporting=False, prepend=False):
        if isinstance(inst, db.Model):
            inst = json.loads(moracct.obj2JSON(inst))
        if str(inst["_id"]) not in self.cache:
            if supporting:
                self.supplist.append(inst)
            else:
                if prepend:
                    self.mainlist.insert(0, inst)
                else:
                    self.mainlist.append(inst)
        elif prepend:  # need to move existing instance to top
            self.mainlist = [inst] + [r for r in self.mainlist if\
                                          r["_id"] != inst["_id"]]
        self.cache[str(inst["_id"])] = inst
    def cached_value(self):
        return json.dumps([self.publicprofinst] + self.mainlist + self.supplist)
    def update_memcache(self):
        mckey = self.prefix + str(self.publicprofinst["_id"])
        moracct.debuginfo("updating memcache " + mckey)
        memcache.set(mckey, self.cached_value())


# Search some probable cache areas before falling back to db retrieval.
def smart_retrieve_revinst(revid, penid, coopid=0):
    jstr = memcache.get("allRevBlock0")
    if jstr and str(revid) in jstr:  # skip loads if id not in string
        revlist = json.loads(jstr)
        for rev in revlist:
            if rev["_id"] == str(revid):
                return rev
    if int(penid) > 0:  # typically pass zero for penid if already searched
        jstr = memcache.get("pen" + str(penid))
        if jstr and str(revid) in jstr:
            revlist = json.loads(jstr)[1:]  # first element is PenName
            for rev in revlist:
                if rev["_id"] == str(revid):
                    return rev
    if int(coopid) > 0:  # coopid passed only if relevant
        jstr = memcache.get("coop" + str(coopid))
        if jstr and str(revid) in jstr:
            revlist = json.loads(jstr)[1:]  # first element is Coop
            for rev in revlist:
                if rev["_id"] == str(revid):
                    return rev
    rev = visible_get_instance(Review, revid)
    if rev:
        rev = json.loads(moracct.obj2JSON(rev))  # return cache representation
    return rev


# query the db and accumulate the results in the given review cache
def fetch_recent_membics(cacheprefix, pid, prc, fetchmax=50):
    where = "WHERE ctmid = 0 AND penid = :1 ORDER BY modified DESC"
    if cacheprefix == "coop":
        where = "WHERE ctmid = :1 ORDER BY modified DESC"
    vq = VizQuery(Review, where, pid)
    revs = vq.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
    for rev in revs:
        if rev.ctmid:  # only add coop rev if srcrev also available
            srcrev = smart_retrieve_revinst(rev.srcrev, rev.penid)
            if not srcrev:
                logging.error("Missing srcrev Review " + str(rev.key().id()))
                continue
            prc.add_instance(rev)
            prc.add_instance(srcrev, supporting=True)
        else:
            prc.add_instance(rev)


def fetch_validated_instance(tidstr, prc, rev, prof):
    inst = prc.get_cached_instance(tidstr)
    if not inst:
        inst = smart_retrieve_revinst(tidstr, 0)
    if inst:
        # Check for various bad data conditions. The inst may already be
        # cached but its id won't be in the top list.
        if inst and inst["revtype"] != rev.revtype:
            inst = None
        if inst and inst["srcrev"] == -604:  # marked as deleted
            inst = None
        if inst and prc.prefix == "coop":
            if str(inst["ctmid"]) != str(prof.key().id()):
                inst = None  # no longer part of this theme
            if inst and not int(inst["srcrev"]):
                inst = None  # original source membic not specified
            if inst: # cache the srcrev for client reference
                srcrev = smart_retrieve_revinst(inst["srcrev"], rev.penid)
                if not srcrev:  # bad data reference
                    logging.error("Bad srcrev Review " + str(inst["_id"]))
                    inst = None
                else:
                    prc.add_instance(srcrev, supporting=True)
    return inst


def idlist_from_instlist(instlist, lenmax):
    idlist = []
    lastid = "-1"
    for inst in instlist:             # skip dupes
        if inst["_id"] != lastid:
            idlist.append(int(inst["_id"]))
        lastid = inst["_id"]
    if len(idlist) > lenmax:          # truncate length if needed
        idlist = idlist[0:lenmax]
    return idlist


# Returns updated json text if changed, None otherwise.
def update_top_membics(cacheprefix, dbprofinst, rev, prc):
    topmax = 30  # how many top membics of each type to keep
    jstr = dbprofinst.top20s or "{}"
    orgdict = json.loads(jstr)
    newdict = json.loads(jstr)
    # remove any references to rev id across all types in case type changed
    ridstr = str(rev.key().id())
    for mtype in newdict:
        if newdict[mtype] and ridstr in newdict[mtype]:
            newdict[mtype].remove(ridstr)
    # rebuild the top id list for the current type
    tids = []
    if rev.revtype in newdict:
        tids = newdict[rev.revtype]
    trevs = []  # list of resolved top instances to sort
    if rev.srcrev not in [-604, -101]:  # include rev unless deleted or future
        cacherev = json.loads(moracct.obj2JSON(rev))  # cache dict repr
        trevs = [cacherev]
    for tidstr in tids:  # append instances for existing ids to trevs
        inst = fetch_validated_instance(tidstr, prc, rev, dbprofinst)
        if inst:
            trevs.append(inst)
    # moracct.debuginfo("update_top_membics about to sort trevs.")
    # for idx in range(len(trevs)):
    #     moracct.debuginfo("trevs[" + str(idx) + "] " + str(trevs[idx]))
    trevs = sorted(trevs, key=itemgetter('rating', 'modified'), 
                   reverse=True)
    tids = idlist_from_instlist(trevs, topmax)
    newdict[rev.revtype] = tids
    if "latestrevtype" in orgdict:
        newdict["latestrevtype"] = orgdict["latestrevtype"]
    if "t20lastupdated" in orgdict:
        newdict["t20lastupdated"] = orgdict["t20lastupdated"]
    # moracct.debuginfo("orgdict: " + str(orgdict))
    # moracct.debuginfo("newdict: " + str(newdict))
    if newdict == orgdict:
        logging.info("update_top_membics: no change")
        return None
    newdict["latestrevtype"] = rev.revtype
    newdict["t20lastupdated"] = str(nowISO())
    logging.info("update_top_membics: recalculated")
    return json.dumps(newdict)


def update_profile(cacheprefix, dbprofinst, rev, srcrev=None):
    prc = ProfRevCache(cacheprefix, dbprofinst)
    if len(prc.mainlist) == 0:  # cache uninitialized or no membics yet
        fetch_recent_membics(cacheprefix, dbprofinst.key().id(), prc)
    if srcrev:  # prepend source rev first so it ends up second in the list
        prc.add_instance(srcrev, prepend=True) 
    prc.add_instance(rev, prepend=True)  # ensure new rev instance is cached
    updtop = update_top_membics(cacheprefix, dbprofinst, rev, prc)
    if updtop:
        dbprofinst.top20s = updtop
        dbprofinst = mctr.synchronized_db_write(dbprofinst)
        logging.info("update_profile wrote new top membics for " +
                     cacheprefix + " " + str(dbprofinst.key().id()))
        prc.set_db_prof_inst(dbprofinst)
    if cacheprefix == "coop":
        dbprofinst.preb = prc.cached_value()
        dbprofinst = mctr.synchronized_db_write(dbprofinst)
        logging.info("update_profile updated preb for " +
                     cacheprefix + " " + str(dbprofinst.key().id()))
        # prc.set_db_prof_inst(dbprofinst)  # not necessary
    prc.update_memcache()


def write_review(review, pnm, acc):
    set_review_mainfeed(review, acc)
    set_review_dispafter(review, pnm)
    mctr.synchronized_db_write(review)
    logging.info("write_review wrote Review " + str(review.key().id()))
    # update all related cached data, or clear it for later rebuild
    mfeed.update_feed_caches(review, addifnew=True)
    update_profile("pen", pnm, review)


def update_prof_cache(ckey, rev):
    if isinstance(rev, db.Model):
        rev = json.loads(moracct.obj2JSON(rev))
    jstr = memcache.get(ckey)
    if jstr and rev["_id"] in jstr:
        moracct.debuginfo("update_prof_cache Review " + rev["_id"] + 
                          " in " + ckey)
        replist = []
        cachelist = json.loads(jstr)
        for idx, cached in enumerate(cachelist):
            if idx > 0 and cached["_id"] == rev["_id"]:
                replist.append(rev)
            else:
                replist.append(cached)
        memcache.set(ckey, json.dumps(replist))


def copy_rev_descrip_fields(fromrev, torev):
    torev.rating = fromrev.rating
    torev.keywords = fromrev.keywords
    torev.text = fromrev.text
    # revpic not copied. don't overwrite if just updating descriptive info
    # imguri ditto
    # altkeys and other processing, same thing.  Just descriptive fields
    torev.name = fromrev.name
    torev.title = fromrev.title
    torev.url = fromrev.url
    torev.rurl = fromrev.rurl
    torev.artist = fromrev.artist
    torev.author = fromrev.author
    torev.publisher = fromrev.publisher
    torev.album = fromrev.album
    torev.starring = fromrev.starring
    torev.address = fromrev.address
    torev.year = fromrev.year
    

def copy_rev_image_fields(fromrev, torev):
    torev.revpic = fromrev.revpic
    torev.imguri = fromrev.imguri
    torev.svcdata = None
    if "sitepic" in fromrev.svcdata:
        torev.svcdata = "{\"picdisp\": \"sitepic\"}"
    elif "upldpic" in fromrev.svcdata:
        torev.svcdata = "{\"picdisp\": \"upldpic\"}"
    elif "nopic" in fromrev.svcdata:
        torev.svcdata = "{\"picdisp\": \"nopic\"}"


def copy_source_review(fromrev, torev, ctmid):
    torev.revtype = fromrev.revtype
    torev.penid = fromrev.penid
    torev.ctmid = int(ctmid)
    torev.srcrev = fromrev.key().id()
    torev.mainfeed = fromrev.mainfeed
    torev.cankey = fromrev.cankey
    copy_rev_image_fields(fromrev, torev)
    torev.dispafter = fromrev.dispafter
    torev.altkeys = fromrev.altkeys
    #torev.svcdata has theme postings etc. do not copy directly
    torev.penname = fromrev.penname
    torev.orids = fromrev.orids
    torev.helpful = fromrev.helpful
    torev.remembered = fromrev.remembered
    copy_rev_descrip_fields(fromrev, torev)
    note_modified(torev)


def coop_post_note(ctm, ctmrev):
    postnote = {}
    postnote["ctmid"] = str(ctm.key().id())
    postnote["name"] = ctm.name
    postnote["revid"] = str(ctmrev.key().id())
    return postnote


def update_review_caches(review):
    mfeed.update_feed_caches(review)
    update_prof_cache("pen" + str(review.penid), review)
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
        if "postctms" in svcdict:
            for ctmpost in svcdict["postctms"]:
                update_prof_cache("coop" + ctmpost["ctmid"], review)
    # If the standard instance cached was used, update it, but do not
    # generally cache individual Review instances.
    mkey = "Review" + str(review.key().id())
    cached = memcache.get(mkey)
    if cached:
        memcache.set(mkey, pickle.dumps(review))


def write_coop_post_notes_to_svcdata(review, postnotes):
    svcdict = {}
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
    svcdict["postctms"] = postnotes
    review.svcdata = json.dumps(svcdict)
    review.modified = nowISO()
    review.put()  # not generally instance cached
    update_review_caches(review)


def write_coop_reviews(review, pnm, ctmidscsv):
    ctmidscsv = ctmidscsv or ""
    postnotes = []
    for ctmid in csv_list(ctmidscsv):
        # get cooperative theme
        ctm = cached_get(intz(ctmid), coop.Coop)
        if not ctm:
            logging.info("write_coop_reviews: no Coop " + ctmid)
            continue
        if coop.has_flag(ctm, "archived"):
            logging.info("write_coop_reviews: Coop " + ctmid + " archived")
            continue
        penid = pnm.key().id()
        if not coop.member_level(penid, ctm):
            logging.info("write_coop_reviews: not member of " + ctmid)
            continue
        # get/create theme membic for update and write it to the db
        where = "WHERE ctmid = :1 AND srcrev = :2"
        vq = VizQuery(Review, where, int(ctmid), review.key().id())
        revs = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        ctmrev = None
        if len(revs) > 0:
            ctmrev = revs[0]
        else:
            ctmrev = Review(penid=penid, revtype=review.revtype)
        moracct.debuginfo("    copying source review")
        copy_source_review(review, ctmrev, ctmid)
        mctr.synchronized_db_write(ctmrev)
        logging.info("write_coop_reviews wrote review for: Coop " + ctmid + 
                     " " + ctm.name)
        # update cache, recalculate recent and top membics for theme
        update_profile("coop", ctm, ctmrev, srcrev=review)
        # note the review was posted to this theme
        logging.info("    appending post note")
        postnotes.append(coop_post_note(ctm, ctmrev))
    logging.info("    writing svcdata.postnotes " + str(postnotes))
    write_coop_post_notes_to_svcdata(review, postnotes)


def update_access_time_if_needed(pen):
    acctime = ISO2dt(pen.accessed)
    now = datetime.datetime.utcnow()
    diff = now - acctime
    if diff.seconds > 2 * 60 * 60:
        pen.accessed = nowISO()
        cached_put(pen)
    return pen


def find_pen_or_coop_type_and_id(handler):
    coopid = intz(handler.request.get('ctmid'))
    if coopid:
        return "coop", coopid, None
    auth = handler.request.get('authorize')
    penid = intz(handler.request.get('penid'))
    # moracct.debuginfo("auth: " + str(auth) + ", " + "penid: " + str(penid))
    if penid and not auth:
        return "pen", penid, None
    if auth:
        acc = moracct.authenticated(handler.request)
        if not acc:  # error already reported
            return "pen", 0, None
        pens = pen.find_auth_pens(handler)
        if not pens or len(pens) == 0:
            return "pen", 0, None
        mypen = pens[0]
        moracct.debuginfo("fpoctai auth pen: " + str(mypen))
        acc.lastpen = mypen.key().id()
        put_cached_instance(acc.email, acc)
        mypen = update_access_time_if_needed(mypen)
        pen.add_account_info_to_pen_stash(acc, mypen)
        return "pen", mypen.key().id(), mypen
    # final case is no pen found because they haven't created one yet
    # that's a normal condition and not an error return
    return "pen", 0, None


def append_review_jsoncsv(jstr, rev):
    jstr = jstr or ""
    if jstr:
        jstr += ","
    jstr += moracct.obj2JSON(rev)
    if rev.ctmid:
        # append coop srcrevs for client cache reference
        srcrev = Review.get_by_id(int(rev.srcrev))
        if not srcrev:
            logging.error("Missing srcrev for Review " + str(rev.key().id()))
        else:
            jstr += "," + moracct.obj2JSON(srcrev)
    return jstr


def safe_dictattr(dictionary, fieldname):
    val = ""
    if dictionary and fieldname in dictionary:
        val = dictionary[fieldname] or ""
    return val


def write_batch_reviews(pn, handler):
    penid = pn.key().id()
    revsjson = handler.request.get('revsjson')
    revs = json.loads(revsjson)
    for rdat in revs:
        review = Review(penid=penid, revtype=rdat["revtype"])
        review.penname = pn.name
        review.rating = int(rdat["rating"])
        review.keywords = safe_dictattr(rdat, "keywords")
        review.text = safe_dictattr(rdat, "text")
        review.name = moracct.onelinestr(safe_dictattr(rdat, "name"))
        review.title = moracct.onelinestr(safe_dictattr(rdat, "title"))
        review.url = safe_dictattr(rdat, "url")
        review.rurl = safe_dictattr(rdat, "rurl")
        review.artist = moracct.onelinestr(safe_dictattr(rdat, "artist"))
        review.author = moracct.onelinestr(safe_dictattr(rdat, "author"))
        review.publisher = safe_dictattr(rdat, "publisher")
        review.album = safe_dictattr(rdat, "album")
        review.starring = safe_dictattr(rdat, "starring")
        review.address = safe_dictattr(rdat, "address")
        review.year = str(safe_dictattr(rdat, "year"))
        review.cankey = create_cankey_for_review(review)
        existing = fetch_review_by_ptc(penid, review.revtype, review.cankey)
        if existing:
            copy_rev_descrip_fields(review, existing)
            review = existing
        review.srcrev = -202   # batch source flag
        review.mainfeed = 0    # no batch updates in main display
        note_modified(review)
        review.put()
        handler.response.out.write("updated by key: " + review.cankey + "\n")
    handler.response.out.write("write_batch_reviews complete\n")


# logic here needs to the same as pcd.js isMatchingReview
def is_matching_review(qstr, review):
    if not qstr:
        return True
    qstr = qstr.lower()
    if qstr in review.cankey:
        return True
    keywords = review.keywords or ""
    keywords = keywords.lower()
    if qstr in keywords:
        return True
    return False


def delete_coop_post(review, pnm, handler):
    ctm = coop.Coop.get_by_id(int(review.ctmid))
    if not ctm:
        return srverr(handler, 404, "Coop " + review.ctmid + " not found")
    penid = pnm.key().id()
    reason = handler.request.get('reason') or ""
    if review.penid != penid:
        if coop.member_level(penid, ctm) < 2:
            return srverr(handler, 400, "You may only remove your own membic")
        if not reason:
            return srverr(handler, 400, "Reason required")
    srcrev = Review.get_by_id(int(review.srcrev))
    if not srcrev:
        return srverr(handler, 400, "Source membic " + str(review.srcrev) +
                      " not found")
    rt = review.revtype
    revid = str(review.key().id())
    topdict = {}
    if ctm.top20s:
        topdict = json.loads(ctm.top20s)
    if rt in topdict and topdict[rt] and revid in topdict[rt]:
        topdict[rt].remove(revid)
    ctm.top20s = json.dumps(topdict)
    # The reason here must be exactly "Removed Membic" so the client can
    # differentiate between removing a review and removing a member.
    coop.update_coop_admin_log(ctm, pnm, "Removed Membic", srcrev, reason)
    coop.update_coop_and_bust_cache(ctm)
    cached_delete(revid, Review)
    mctr.count_review_update("delete", review.penid, review.penname,
                             review.ctmid, review.srcrev)
    return ctm


def mark_review_as_deleted(review, pnm, acc, handler):
    review.penname = pnm.name  # in case name modified since last update
    review.srcrev = -604
    # Marking a review as deleted shows up in the counters as an edit.
    # Not worth duplicating
    write_review(review, pnm, acc)
    try:
        pen.add_account_info_to_pen_stash(acc, pnm)
    except Exception as e:
        logging.info("Account info stash failed on membic delete: " + str(e))
    return review


def supplemental_recent_reviews(handler, pgid):
    jstr = "[]"
    pco = coop.Coop.get_by_id(int(pgid))
    if pco and pco.preb2:
        jstr = pco.preb2
    moracct.writeJSONResponse(jstr, handler.response);


# Returning raw image data directly to the browser doesn't work, it
# must be transformed first. If transforming anyway, may as well
# standardize on PNG format. Large images are not required, restrict
# the size to avoid pushing 1mb size limit on value/object.  Upscaling
# small images can look very ugly, so leave anything below threshold.
def prepare_image(img):
    maxwidth = 160
    if img.width > maxwidth:
        img.resize(width=maxwidth)  # height adjusts automatically to match
    else:  # at least one transform required so do a dummy crop
        img.crop(0.0, 0.0, 1.0, 1.0)
    img = img.execute_transforms(output_encoding=images.PNG)
    return img


class SaveReview(webapp2.RequestHandler):
    def post(self):
        acc = moracct.authenticated(self.request)
        if not acc:
            return
        pnm = acc_review_modification_authorized(acc, self)
        if not pnm:
            return
        review = get_review_for_save(self)
        if not review:
            return
        read_review_values(self, review)
        review.penname = pnm.name
        if self.request.get('mode') == "batch":
            review.srcrev = -202
            # not bothering to unpack and rewrite existing value unless needed
            review.svcdata = "{" + batch_flag_attrval(review) + "}"
        write_review(review, pnm, acc) # updates pen top20s
        write_coop_reviews(review, pnm, self.request.get('ctmids'))
        try:
            pen.add_account_info_to_pen_stash(acc, pnm)
        except Exception as e:
            logging.info("Account info stash failure for updated pen " + str(e))
        moracct.returnJSON(self.response, [ pnm, review ])


class DeleteReview(webapp2.RequestHandler):
    def post(self):
        acc = moracct.authenticated(self.request)
        if not acc:
            return
        pnm = acc_review_modification_authorized(acc, self)
        if not pnm:
            return
        # logging.info("DeleteReview authorized PenName " + pnm.name)
        review = noauth_get_review_for_update(self)
        if not review:
            return
        obj = None
        if review.ctmid:
            obj = delete_coop_post(review, pnm, self)
        else:
            obj = mark_review_as_deleted(review, pnm, acc, self)
        if not obj:  # error in processing
            return   # error already reported
        moracct.returnJSON(self.response, [ obj ])


# Errors containing the string "failed: " are reported by the client
class UploadReviewPic(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write('Ready')
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return
        review = None
        revid = intz(self.request.get("revid"))
        if revid:
            review = safe_get_review_for_update(self)
            if not review:
                return
        else:
            revtype = self.request.get("revtype")
            if not revtype:
                return srverr(self, 406, "failed: No membic type")
            review = Review(penid=pnm.key().id(), revtype=revtype)
        upfile = self.request.get("picfilein")
        if not upfile:
            return srverr(self, 406, "failed: No pic data")
        try:
            review.revpic = db.Blob(prepare_image(images.Image(upfile)))
            note_modified(review)
            cached_put(review)  # use instance cache when uploaded images
            update_review_caches(review)
        except Exception as e:
            # Client looks for text containing "failed: " for error reporting
            return srverr(self, 409, "Pic upload processing failed: " + str(e))
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("revid: " + str(review.key().id()))


# Most membics reference an image from a url, or have no image.  When
# a pic is uploaded, that data is the majority of the size of the
# Review instance, so it's reasonable to just cache the Review
# instance with standard instance caching.
class GetReviewPic(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        review = cached_get(intz(revid), Review)  # will probably need pic again
        havepic = review and review.revpic
        if not havepic:
            return srverr(self, 404, 
                          "Pic for review " + str(revid) + " not found.")
        img = prepare_image(images.Image(review.revpic))
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class RotateReviewPic(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return;
        revid = intz(self.request.get('revid'))
        review = Review.get_by_id(revid)  # pull database instance for update
        if not review or review.penid != pnm.key().id():
            return srverr(self, 403, "Review not found or not writeable")
        if not review.revpic:
            return srverr(self, 404, "No pic found for review " + str(revid))
        try:
            img = images.Image(review.revpic)
            img.rotate(90)
            img = img.execute_transforms(output_encoding=images.PNG)
            review.revpic = db.Blob(img)
            note_modified(review)
            review.put()  # not generally instance cached
            update_review_caches(review)
        except Exception as e:
            return srverr(self, 409, "Pic rotate failed: " + str(e))
        moracct.returnJSON(self.response, [ review ])


class SearchReviews(webapp2.RequestHandler):
    def get(self):
        acc = moracct.authenticated(self.request)
        if not acc:
            return srverr(self, 401, "Authentication failed")
        penid = intz(self.request.get('penid'))
        ctmid = intz(self.request.get('ctmid'))
        mindate = self.request.get('mindate') or "2012-10-04T00:00:00Z"
        maxdate = self.request.get('maxdate') or nowISO()
        qstr = self.request.get('qstr')
        revtype = self.request.get('revtype')
        cursor = self.request.get('cursor')
        ckey = "SearchReviewsG" + str(ctmid) + "P" + str(penid) +\
            "D" + mindate + "M" + maxdate
        where = "WHERE ctmid = " + str(ctmid)  # matches on zero if penid
        if penid:
            where += " AND penid = " + str(penid)
        where += " AND modified >= :1 AND modified <= :2"
        if revtype and revtype != "all":
            where += " AND revtype = '" + revtype + "'"
            ckey += revtype
        where += " ORDER BY modified DESC"
        logging.info("SearchReviews query: " + where + " " + 
                     mindate + " - " + maxdate)
        vq = VizQuery(Review, where, mindate, maxdate)
        qres = []
        reviter = vq.run(read_policy=db.EVENTUAL_CONSISTENCY, deadline=30,
                         batch_size=1000)
        for review in reviter:
            if is_matching_review(qstr, review):
                qres.append(review)
            if len(qres) >= 20:
                break
        moracct.returnJSON(self.response, qres)


class GetReviewById(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        if revid:
            logging.warn("Client cache miss fetch Review " + revid)
            review = smart_retrieve_revinst(revid, 0)
            if not review:
                return srverr(self, 404, "No Review found for id " + revid)
            moracct.returnJSON(self.response, [ review ])
            return
        revs = []
        revids = self.request.get('revids')
        if revids:
            logging.warn("Client multiple revid fetch " + revid)
            rids = revids.split(",")
            for rid in rids:
                review = smart_retrieve_revinst(rid, 0)
                if review:
                    revs.append(review)
        moracct.returnJSON(self.response, revs)


class GetReviewFeed(webapp2.RequestHandler):
    def get(self):
        revtype = self.request.get('revtype')
        if not revtype or revtype not in known_rev_types:
            revtype = "all"
        feedcsv, blocks = mfeed.get_review_feed_pool(revtype)
        jstr = blocks[0];
        acc = moracct.authenticated(self.request)
        pnm = None
        if acc and intz(self.request.get('penid')):
            pnm = acc_review_modification_authorized(acc, self)
        jstr = mfeed.filter_for_client(blocks, pnm);
        moracct.writeJSONResponse(jstr, self.response)
        

class ToggleHelpful(webapp2.RequestHandler):
    def get(self):
        pnm = review_modification_authorized(self)
        if not pnm:  # caller does not control specified penid
            return
        revid = intz(self.request.get('revid'))
        review = Review.get_by_id(revid)  # db inst not cached, need to update
        if not review:
            return srverr(self, 404, "Membic: " + str(revid) + " not found.")
        if csv_elem_count(review.helpful) < 123:  # semi-arbitrary upper bound
            penid = str(pnm.key().id())
            if csv_contains(penid, review.helpful):  # toggle off
                review.helpful = remove_from_csv(penid, review.helpful)
            else:  # toggle on
                disprevid = intz(self.request.get('disprevid'))
                disprevsrc = intz(self.request.get('disprevsrc'))
                mctr.bump_starred(review, disprevid, disprevsrc)
                review.helpful = prepend_to_csv(penid, review.helpful)
            review.put()  # no instance cache, not modified
            update_review_caches(review)
        moracct.returnJSON(self.response, [ review ])


class FetchAllReviews(webapp2.RequestHandler):
    def get(self):
        try:
            pct, pgid, mypen = find_pen_or_coop_type_and_id(self)
            if pgid: # pgid may be zero if no pen name yet
                if self.request.get('supp'):
                    return supplemental_recent_reviews(self, pgid)
                jstr = mblock.get_membics_json_for_profile(pct, pgid)
            else:  # return empty array with no first item pen
                jstr = "[]"
            if jstr and mypen:  # replace first element with private pen data
                i = 2 
                brackets = 1
                while i < len(jstr) and brackets > 0:
                    if jstr[i] == '{':
                        brackets += 1
                    elif jstr[i] == '}':
                        brackets -= 1
                    i += 1
                jstr = '[' + moracct.obj2JSON(mypen) + jstr[i:]
            if not jstr:
                srverr(handler, 404, pct + " " + str(pgid) + " not found")
            else:
                moracct.writeJSONResponse(jstr, self.response)
            return
        except Exception as e:
            if str(e) == "Token expired":
                return srverr(self, 401, "Your access token has expired, you will need to sign in again.")
            logging.warn("FetchAllReviews failed: " + str(e))
            return srverr(self, 500, "FetchAllReviews failed: " + str(e))


class FetchPreReviews(webapp2.RequestHandler):
    def get(self):
        acc = moracct.authenticated(self.request)
        if not acc:
            return srverr(self, 401, "Authentication failed")
        penid = intz(self.request.get('penid'))
        if not penid:
            return srverr(self, 400, "penid required")
        where = "WHERE penid = :1 AND srcrev = -101 ORDER BY modified DESC"
        vq = VizQuery(Review, where, penid)
        fetchmax = 20
        reviews = vq.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                           deadline=10)
        moracct.returnJSON(self.response, reviews)


class BatchUpload(webapp2.RequestHandler):
    def post(self):
        # this needs to be rewritten to use the standard auth.
        # Possibly cache-only (no batch unless you recently have
        # logged in interactively).  Turning off for now...
        return srverr(self, 403, "Batch uploading currently offline")
        # this uses the same db access as moracct.py GetToken
        emaddr = self.request.get('email') or ""
        emaddr = moracct.normalize_email(emaddr)
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write("BatchUpload from " + emaddr + "\n")
        password = self.request.get('password')
        where = "WHERE email=:1 AND password=:2 LIMIT 1"
        vq = VizQuery(moracct.MORAccount, where, emaddr, password)
        accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        for account in accounts:
            accid = account.key().id()
            self.response.out.write("Account " + str(accid) + "\n")
            # this uses the same db access as pen.py find_auth_pens
            vq2 = VizQuery(pen.PenName, "WHERE mid=:1 LIMIT 1", accid)
            pens = vq2.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, 
                             deadline=10)
            for pn in pens:
                self.response.out.write("PenName " + pn.name + "\n")
                try:
                    write_batch_reviews(pn, self)
                except Exception as e:
                    self.response.out.write(str(e) + "\n")
        self.response.out.write("BatchUpload complete\n")


app = webapp2.WSGIApplication([('.*/saverev', SaveReview),
                               ('.*/delrev', DeleteReview),
                               ('.*/revpicupload', UploadReviewPic),
                               ('.*/revpic', GetReviewPic),
                               ('.*/rotatepic', RotateReviewPic),
                               ('.*/srchrevs', SearchReviews),
                               ('.*/revbyid', GetReviewById), 
                               ('.*/revfeed', GetReviewFeed),
                               ('.*/toghelpful', ToggleHelpful),
                               ('.*/blockfetch', FetchAllReviews),
                               ('.*/fetchprerevs', FetchPreReviews),
                               ('.*/batchupload', BatchUpload)], debug=True)

