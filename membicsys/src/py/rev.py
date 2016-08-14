import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
import urllib
from moracct import *
from morutil import *
import pen
import coop
import mailsum
import mctr
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
    altkeys = db.TextProperty()                  # known equivalent cankey vals
    svcdata = db.TextProperty()                  # supporting client data JSON
    penname = db.StringProperty(indexed=False)   # for ease of reporting
    orids = db.TextProperty()                    # other revids CSV
    helpful = db.TextProperty()                  # penids CSV
    remembered = db.TextProperty()               # penids CSV
    # type-specific non-indexed fields
    name = db.StringProperty(indexed=False)      # yum, activity, other
    title = db.StringProperty(indexed=False)     # book, movie, video, music
    url = db.StringProperty(indexed=False)       # source URL of item
    artist = db.StringProperty(indexed=False)    # video, music
    author = db.StringProperty(indexed=False)    # book
    publisher = db.StringProperty(indexed=False) # book
    album = db.StringProperty(indexed=False)     # music
    starring = db.StringProperty(indexed=False)  # movie
    address = db.StringProperty(indexed=False)   # yum, activity
    year = db.StringProperty(indexed=False)      # values like "80's" ok


known_rev_types = ['book', 'article', 'movie', 'video', 
                   'music', 'yum', 'activity', 'other']
revblocksize = 200  # how many reviews to return. cacheable approx quantity
revpoolsize = 1000  # even multiple of blocksize. how many reviews to read


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
    acc = authenticated(handler.request)
    if not acc:
        srverr(handler, 401, "Authentication failed")
        return False
    return acc_review_modification_authorized(acc, handler)


def noauth_get_review_for_update(handler):
    revid = intz(handler.request.get('_id'))
    if not revid:
        revid = intz(handler.request.get('revid'))
    review = cached_get(revid, Review)
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
        review = cached_get(revid, Review)
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
    review.name = onelinestr(handler.request.get('name'))
    review.title = onelinestr(handler.request.get('title'))
    set_if_param_given(review, "url", handler, "url")
    review.artist = onelinestr(handler.request.get('artist'))
    review.author = onelinestr(handler.request.get('author'))
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


# To avoid extra cache retrievals and potentially the associated
# database hits, this only rebuilds the specified revtype. Previous
# instances of the review id are clared out first to avoid leaving
# ghosts if the revtype changes.
def update_top20_reviews(pco, review, ctmid):
    retmax = 30
    t20dict = {}
    if pco.top20s:
        t20dict = json.loads(pco.top20s)
        for rt in t20dict:
            if t20dict[rt] and str(review.key().id()) in t20dict[rt]:
                t20dict[rt].remove(revid)
    t20ids = []
    if review.revtype in t20dict:
        t20ids = t20dict[review.revtype]
    t20revs = [ review ]
    for revid in t20ids:
        resolved = cached_get(intz(revid), Review)
        if resolved and resolved.revtype == review.revtype:
            if resolved.ctmid == ctmid:
                t20revs.append(resolved)
    t20revs = sorted(t20revs, key=attrgetter('rating', 'modified'), 
                     reverse=True)
    if len(t20revs) > retmax:
        t20revs = t20revs[0:retmax]
    t20ids = []
    lastid = -1     # trap any dupes just in case
    for rev in t20revs:
        currid = rev.key().id()
        if currid != lastid:
            t20ids.append(currid)
        lastid = currid
    t20dict[review.revtype] = t20ids
    t20dict["latestrevtype"] = review.revtype
    tstamp = nowISO()
    t20dict["t20lastupdated"] = tstamp
    pco.top20s = json.dumps(t20dict)
    pco.modified = tstamp;
    cached_put(pco)


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
        # debuginfo(logmsg + "is batch.")
        rev.srcrev = -202
        rev.mainfeed = 0
    if rev.srcrev < 0:  # future review, batch update etc.
        # debuginfo(logmsg + "is future or batch.")
        rev.mainfeed = 0
    if rev.ctmid > 0:   # coop posting, not source review
        # debuginfo(logmsg + "is coop posting.")
        rev.mainfeed = 0
    if acc.authconf:  # account needs help
        rev.mainfeed = 0
    if not rev.text or len(rev.text) < 65:  # not substantive (matches UI)
        # debuginfo(logmsg + "text not substantive.")
        rev.mainfeed = 0
    if not rev.rating or rev.rating < 60:  # 3 stars or better
        # debuginfo(logmsg + "is not highly rated.")
        rev.mainfeed = 0
    # debuginfo("set_review_mainfeed: " + str(rev.mainfeed))


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


def feedcsventry(review):
    entry = str(review.key().id()) + ":" + str(review.penid) +\
        ":" + str(review.ctmid)
    return entry


# Return the feedcsv and asociated JSON data blocks from cache.  If
# the cache is partial, clean up and return None, None
def get_feed_cache_elements(ckey):
    feedcsv = memcache.get(ckey)
    numblocks = revpoolsize / revblocksize
    blocks = [None for i in range(numblocks)]
    for i in range(numblocks):
        blocks[i] = memcache.get(ckey + "RevBlock" + str(i))
    if (feedcsv is not None) and (None not in blocks):
        return feedcsv, blocks
    # not found or partial.  Clean up.
    memcache.delete(ckey)
    for i in range(numblocks):
        memcache.delete(ckey + "RevBlock" + str(i))
    return None, None


def replace_instance_in_json(rev, jtxt, remove):
    objs = json.loads(jtxt)
    rt = ""
    for obj in objs:
        idstr = str(rev.key().id())
        if obj["_id"] == idstr:
            if not remove:
                debuginfo("Replaced json for _id " + idstr)
                rt = append_to_csv(obj2JSON(rev), rt)
            else:
                debuginfo("Removed json for _id " + idstr)
        else:
            rt = append_to_csv(json.dumps(obj), rt)
    return "[" + rt + "]"


# update the cache or ensure it is nuked for rebuild.
def update_feed_cache(ckey, rev, addifnew=False):
    debuginfo("update_feed_cache for " + ckey)
    feedcsv, blocks = get_feed_cache_elements(ckey)
    # debuginfo("feedcsv: " + str(feedcsv))
    if feedcsv is None:
        debuginfo("no cache data. rebuild later if needed")
        return  # cache cleared, rebuild later as needed
    entry = feedcsventry(rev)
    numblocks = revpoolsize / revblocksize
    if csv_contains(entry, feedcsv):
        debuginfo("updating existing cache entry")
        for i in range(numblocks):  # walk all in case dupe included
            blocks[i] = replace_instance_in_json(rev, blocks[i], 
                                                 rev.mainfeed <= 0)
            memcache.set(ckey + "RevBlock" + str(i), blocks[i])
    elif rev.mainfeed > 0 and addifnew:
        debuginfo("prepending new cache entry")
        feedcsv = prepend_to_csv(entry, feedcsv)
        memcache.set(ckey, feedcsv)
        # prepend to first block.  Not worth rebalancing the blocks.
        prepend_to_csv(obj2JSON(rev), blocks[0])


def update_feed_caches(rev, addifnew=False):
    update_feed_cache("all", rev, addifnew)        # main feed
    update_feed_cache(rev.revtype, rev, addifnew)  # filtered main feed


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
        self.publicprofinst = json.loads(obj2JSON(dbprofinst))
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
            inst = json.loads(obj2JSON(inst))
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
    def update_memcache(self):
        mckey = self.prefix + str(self.publicprofinst["_id"])
        debuginfo("updating memcache " + mckey)
        memcache.set(mckey, json.dumps([self.publicprofinst] + self.mainlist + 
                                       self.supplist))


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
        rev = obj2JSON(rev)  # consistent cache representation for return
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
    cacherev = json.loads(obj2JSON(rev))  # cache dict representation
    trevs = [cacherev]  # build list of resolved top instances to sort
    for tidstr in tids:
        inst = fetch_validated_instance(tidstr, prc, rev, dbprofinst)
        if inst:
            trevs.append(inst)
    # debuginfo("update_top_membics about to sort trevs.")
    # for idx in range(len(trevs)):
    #     debuginfo("trevs[" + str(idx) + "] " + str(trevs[idx]))
    trevs = sorted(trevs, key=itemgetter('rating', 'modified'), 
                   reverse=True)
    tids = idlist_from_instlist(trevs, topmax)
    newdict[rev.revtype] = tids
    newdict["latestrevtype"] = orgdict["latestrevtype"]
    newdict["t20lastupdated"] = orgdict["t20lastupdated"]
    # debuginfo("orgdict: " + str(orgdict))
    # debuginfo("newdict: " + str(newdict))
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
    prc.update_memcache()


def write_review(review, pnm, acc):
    set_review_mainfeed(review, acc)
    mctr.synchronized_db_write(review)
    logging.info("write_review wrote Review " + str(review.key().id()))
    # update all related cached data, or clear it for later rebuild
    update_feed_caches(review, addifnew=True)
    update_profile("pen", pnm, review)


def update_prof_cache(ckey, rev):
    if isinstance(rev, db.Model):
        rev = json.loads(obj2JSON(rev))
    jstr = memcache.get(ckey)
    if jstr and rev["_id"] in jstr:
        debuginfo("update_prof_cache Review " + rev["_id"] + " in " + ckey)
        replist = []
        cachelist = json.loads(jstr)
        for idx, cached in enumerate(cachelist):
            if idx > 0 and cached["_id"] == rev["_id"]:
                replist.append(rev)
            else:
                replist.append(cached)
        memcache.set(ckey, json.dumps(replist))


def update_review_caches(review):
    update_feed_caches(review)
    update_prof_cache("pen" + str(review.penid), review)
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
        if "postctms" in svcdict:
            for ctmpost in svcdict["postctms"]:
                update_prof_cache("coop" + ctmpost["ctmid"], review)


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


def write_coop_post_notes_to_svcdata(review, postnotes):
    svcdict = {}
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
    svcdict["postctms"] = postnotes
    review.svcdata = json.dumps(svcdict)
    review.modified = nowISO()
    cached_put(review)


def write_coop_reviews(review, pnm, ctmidscsv):
    ctmidscsv = ctmidscsv or ""
    postnotes = []
    for ctmid in csv_list(ctmidscsv):
        # get cooperative theme
        ctm = cached_get(intz(ctmid), coop.Coop)
        if not ctm:
            logging.info("write_coop_reviews: no Coop " + ctmid)
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
        debuginfo("    copying source review")
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


def sort_filter_feed(feedcsv, pnm, maxret):
    preferred = []
    normal = []
    background = []
    feedelems = csv_list(feedcsv)
    for elem in feedelems:
        ela = elem.split(":")
        if pnm:
            # skip any membics from blocked pens
            if csv_contains(ela[1], pnm.blocked):
                continue
            # preferred pen membic
            if csv_contains(ela[1], pnm.preferred):
                preferred.append(int(ela[0]))
            # followed theme membic
            elif csv_contains(ela[2], pnm.coops):
                preferred.append(int(ela[0]))
            # background pen membic
            elif csv_contains(ela[1], pnm.background):
                background.append(int(ela[0]))
            # membics from self shouldn't get buried below preferred
            elif str(ela[1]) == str(pnm.key().id()):
                if pnm.preferred:
                    preferred.append(int(ela[0]))
                else:
                    normal.append(int(ela[0]))
            # default
            else:
                normal.append(int(ela[0]))
        else:
            preferred.append(int(ela[0]))
        if len(preferred) >= maxret:
            break
    feedids = preferred[:maxret] + normal[:maxret] + background[:maxret]
    feedids = feedids[:maxret]
    return feedids


def find_pen_or_coop_type_and_id(handler):
    pgid = intz(handler.request.get('ctmid'))
    if pgid:
        return "coop", pgid, None
    pgid = intz(handler.request.get('penid'))
    if pgid:
        return "pen", pgid, None
    pens = pen.find_auth_pens(handler)
    if pens and len(pens) > 0:
        mypen = pens[0]
        mypen.accessed = nowISO()
        try:
            mypen.put()
        except Exception as e:
            logging.info("Update of pen.accessed failed: " + str(e))
        try:
            acc = authenticated(handler.request)
            pen.add_account_info_to_pen_stash(acc, mypen)
        except Exception as e:
            logging.info("Unable to add account info to pen " + str(e))
        return "pen", mypen.key().id(), mypen
    # final case is no pen found because they haven't created one yet
    # that's a normal condition and not an error return
    return "pen", 0, None


def append_review_jsoncsv(jstr, rev):
    jstr = jstr or ""
    if jstr:
        jstr += ","
    jstr += obj2JSON(rev)
    if rev.ctmid:
        # append coop srcrevs for client cache reference
        srcrev = Review.get_by_id(int(rev.srcrev))
        if not srcrev:
            logging.error("Missing srcrev for Review " + str(rev.key().id()))
        else:
            jstr += "," + obj2JSON(srcrev)
    return jstr


def append_top20_revs_to_jsoncsv(jstr, revs, pct, pco, sizebound):
    topdict = {}
    if pco.top20s:
        topdict = json.loads(pco.top20s)
        for i in range(50):
            for rt in known_rev_types:
                if rt in topdict and len(topdict[rt]) > i:
                    revid = int(topdict[rt][i])
                    rev = None
                    for recentrev in revs:
                        if recentrev.key().id() == revid:
                            rev = recentrev
                            break;
                    if rev:  # already have the review no need to add it again
                        continue
                    rev = Review.get_by_id(revid)
                    if not rev:  # could be deleted coop review or somesuch
                        continue
                    jstr = append_review_jsoncsv(jstr, rev)
                    if len(jstr) > sizebound:
                        logging.info(pct + " " + str(pco.key().id()) + 
                                     " exceeded sizebound " + str(sizebound))
                        return jstr
    return jstr


# returns an array of the source object followed by all the reviews
def rebuild_reviews_block(handler, pct, pgid):
    logging.info("rebuild_reviews_block " + pct + " " + str(pgid))
    pco = None
    if pct == "coop":
        pco = coop.Coop.get_by_id(int(pgid))
    elif pct == "pen":
        pco = pen.PenName.get_by_id(int(pgid))
        pen.filter_sensitive_fields(pco)
    if not pco:
        srverr(handler, 404, pct + " " + str(pgid) + " not found")
        return
    jstr = obj2JSON(pco)
    # logging.info("rebuild_reviews_block pco jstr: " + jstr)
    where = "WHERE ctmid = 0 AND penid = :1 ORDER BY modified DESC"
    if pct == "coop":
        where = "WHERE ctmid = :1 ORDER BY modified DESC"
    vq = VizQuery(Review, where, pco.key().id())
    revs = vq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
    for rev in revs:
        jstr = append_review_jsoncsv(jstr, rev)
    jstr = append_top20_revs_to_jsoncsv(jstr, revs, pct, pco, 450 * 1024)
    return "[" + jstr + "]"


def get_review_feed_pool(revtype):
    numblocks = revpoolsize / revblocksize
    blocks = [None for i in range(numblocks)]
    feedcsv = memcache.get(revtype)
    if feedcsv is not None:
        for i in range(numblocks):
            blocks[i] = memcache.get(revtype + "RevBlock" + str(i))
        if None not in blocks:
            return feedcsv, blocks
    logging.info("rebuilding feedcsv for " + revtype)
    feedcsv = ""
    blocks = ["" for i in range(numblocks)]
    bidx = 0
    count = 0
    where = "WHERE ctmid = 0 AND mainfeed = 1"
    if revtype and revtype != "all":
        where += " AND revtype = '" + revtype + "'"
    where += " ORDER BY modhist DESC"
    vq = VizQuery(Review, where)
    revs = vq.fetch(revpoolsize, read_policy=db.EVENTUAL_CONSISTENCY, 
                    deadline=60)
    for rev in revs:
        entry = feedcsventry(rev)
        if csv_contains(entry, feedcsv):
            continue  # already added, probably from earlier srcrev reference
        feedcsv = append_to_csv(entry, feedcsv)
        blocks[bidx] = append_to_csv(obj2JSON(rev), blocks[bidx])
        count += 1
        if rev.srcrev and rev.srcrev > 0:  # ensure source included in block
            source = Review.get_by_id(rev.srcrev)
            if source:
                feedcsv = append_to_csv(feedcsventry(source), feedcsv)
                blocks[bidx] = append_to_csv(obj2JSON(source), blocks[bidx])
                count += 1
        if count >= revblocksize:
            bidx += 1
            count = 0
    memcache.set(revtype, feedcsv)
    for i in range(numblocks):
        blocks[i] = "[" + blocks[i] + "]"
        memcache.set(revtype + "RevBlock" + str(i), blocks[i])
    return feedcsv, blocks


def nuke_review_feed_pool(revtype):
    memcache.delete(revtype)
    numblocks = revpoolsize / revblocksize
    for i in range(numblocks):
        memcache.delete(revtype + "RevBlock" + str(i))


def nuke_cached_recent_review_feeds():
    nuke_review_feed_pool("all")
    for rt in known_rev_types:
        nuke_review_feed_pool(rt)


def resolve_ids_to_json(feedids, blocks):
    jstr = ""
    for block in blocks:
        # debuginfo("resolve_ids_to_json block: " + block)
        objs = json.loads(block)
        for obj in objs:
            # debuginfo("resolve_ids_to_json id: " + obj["_id"])
            # debuginfo("feedids: " + str(feedids))
            if int(obj["_id"]) in feedids:
                jstr = append_to_csv(json.dumps(obj), jstr)
    return "[" + jstr + "]"


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
        review.name = onelinestr(safe_dictattr(rdat, "name"))
        review.title = onelinestr(safe_dictattr(rdat, "title"))
        review.url = safe_dictattr(rdat, "url")
        review.artist = onelinestr(safe_dictattr(rdat, "artist"))
        review.author = onelinestr(safe_dictattr(rdat, "author"))
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


class SaveReview(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
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
        returnJSON(self.response, [ pnm, review ])


class DeleteReview(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return
        # logging.info("DeleteReview authorized PenName " + pnm.name)
        review = noauth_get_review_for_update(self)
        if not review:
            return
        if not review.ctmid:
            return srverr(self, 400, "Only coop posts may be deleted")
        ctm = coop.Coop.get_by_id(int(review.ctmid))
        if not ctm:
            return srverr(self, 404, "Coop " + review.ctmid + " not found")
        penid = pnm.key().id()
        reason = self.request.get('reason') or ""
        if review.penid != penid:
            if coop.member_level(penid, ctm) < 2:
                return srverr(self, 400, "You may only remove your own review")
            if not reason:
                return srverr(self, 400, "Reason required")
        srcrev = Review.get_by_id(int(review.srcrev))
        if not srcrev:
            return srverr(self, 400, "Source review " + str(review.srcrev) +
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
        returnJSON(self.response, [ ctm ])


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
            review.revpic = db.Blob(upfile)
            review.revpic = images.resize(review.revpic, 160, 160)
            note_modified(review)
            cached_put(review)
        except Exception as e:
            # Client looks for text containing "failed: " for error reporting
            return srverr(self, 409, "Pic upload processing failed: " + str(e))
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("revid: " + str(review.key().id()))


class GetReviewPic(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        review = cached_get(intz(revid), Review)
        havepic = review and review.revpic
        if not havepic:
            return srverr(self, 404, 
                          "Pic for review " + str(revid) + " not found.")
        img = images.Image(review.revpic)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class RotateReviewPic(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return;
        revid = self.request.get('revid')
        review = cached_get(intz(revid), Review)
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
            cached_put(review)
        except Exception as e:
            return srverr(self, 409, "Pic rotate failed: " + str(e))
        returnJSON(self.response, [ review ])


class SearchReviews(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
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
        returnJSON(self.response, qres)


class GetReviewById(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        if revid:
            logging.info("Client cache miss fetch Review " + revid)
            review = cached_get(intz(revid), Review)
            if not review:
                return srverr(self, 404, "No Review found for id " + revid)
            returnJSON(self.response, [ review ])
            return
        revs = []
        revids = self.request.get('revids')
        if revids:
            rids = revids.split(",")
            for rid in rids:
                review = cached_get(intz(rid), Review)
                if review:
                    revs.append(review)
        returnJSON(self.response, revs)


class GetReviewFeed(webapp2.RequestHandler):
    def get(self):
        revtype = self.request.get('revtype')
        if not revtype or revtype not in known_rev_types:
            revtype = "all"
        feedcsv, blocks = get_review_feed_pool(revtype)
        acc = authenticated(self.request)
        pnm = None
        if acc and intz(self.request.get('penid')):
            pnm = acc_review_modification_authorized(acc, self)
        if not pnm:
            writeJSONResponse(blocks[0], self.response)
            return
        feedids = sort_filter_feed(feedcsv, pnm, revblocksize)
        if self.request.get('debug') == "sortedfeedids":
            self.response.out.write(feedids)
            return
        jstr = resolve_ids_to_json(feedids, blocks)
        writeJSONResponse(jstr, self.response)
        

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
        returnJSON(self.response, [ review ])


class FetchAllReviews(webapp2.RequestHandler):
    def get(self):
        pct, pgid, mypen = find_pen_or_coop_type_and_id(self)
        if pgid: # pgid may be zero if no pen name yet
            key = pct + str(pgid)      # e.g. "pen1234" or "coop5678"
            jstr = memcache.get(key)   # grab the prebuilt JSON data
            if not jstr:
                jstr = rebuild_reviews_block(self, pct, pgid)
                memcache.set(key, jstr)
        else:  # return empty array with no first item pen
            jstr = "[]"
        if mypen:  # replace first element with private pen data
            i = 2 
            brackets = 1
            while i < len(jstr) and brackets > 0:
                if jstr[i] == '{':
                    brackets += 1
                elif jstr[i] == '}':
                    brackets -= 1
                i += 1
            jstr = '[' + obj2JSON(mypen) + jstr[i:]
        writeJSONResponse(jstr, self.response)


class FetchPreReviews(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
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
        returnJSON(self.response, reviews)


class BatchUpload(webapp2.RequestHandler):
    def post(self):
        # this needs to be rewritten to use the standard auth.
        # Possibly cache-only (no batch unless you recently have
        # logged in interactively).  Turning off for now...
        return srverr(self, 403, "Batch uploading currently offline")
        # this uses the same db access as moracct.py GetToken
        emaddr = self.request.get('email') or ""
        emaddr = normalize_email(emaddr)
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write("BatchUpload from " + emaddr + "\n")
        password = self.request.get('password')
        where = "WHERE email=:1 AND password=:2 LIMIT 1"
        vq = VizQuery(MORAccount, where, emaddr, password)
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

