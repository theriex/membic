import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
import urllib
import muser
import ovrf
from morutil import *
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
#       -604: Marked as deleted
#     Special handling reviews may not be posted to coops
#
# cankey (canonical key) is an alternate index based on collapsed review
# field info.  It can be used to group multiple membics for the same thing
# within a theme, or for search.  The value is maintained server-side for
# consistency.  Multiple membics with the same cankey/penid/ctmid are
# allowed but discouraged.
class Review(db.Model):
    """ Membic: URL or unique identifying information + why memorable """
    revtype = db.StringProperty(required=True)   # book, movie, music...
    penid = db.IntegerProperty(required=True)    # who wrote this review
    ctmid = db.IntegerProperty()                 # Coop id or 0 if source review
    rating = db.IntegerProperty()                # 0-100
    srcrev = db.IntegerProperty()                # see class comment
    mainfeed = db.IntegerProperty()              # 0 if ineligible, 1 if good
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


def get_review_for_save(handler, acc):
    revid = (intz(handler.request.get("_id")) or
             intz(handler.request.get("instid")) or
             intz(handler.request.get("revid")))
    review = None
    if revid:
        review = Review.get_by_id(revid)  # Review db instances not cached
    if review:
        if review.penid != acc.key().id():
            srverr(handler, 401, "Not your review")
            return False
        if review.ctmid:
            srverr(handler, 401, "Not a source review")
            return False
    if not review:
        revtype = handler.request.get('revtype')
        review = Review(penid=acc.key().id(), revtype=revtype)
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
    defaultval = "Membic_parameter_unspecified"
    val = handler.request.get(paramname, default_value=defaultval)
    # logging.info("set_if_param_given " + paramname + ": " + val)
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


def read_review_rating(handler):
    rating = 60  # default to 3 stars (average)
    ratingstr = handler.request.get('rating')
    if ratingstr:  # a value, possibly "0", was specified
        rating = int(ratingstr)
        rating = max(rating, 0)
        rating = min(rating, 100)
    return rating


def batch_flag_attrval(review):
    return "\"batchUpdated\":\"" + review.modified + "\""


def set_review_srcrev(handler, review, acc):
    srcrev = 0
    srcrevstr = handler.request.get('srcrev')
    if srcrevstr:
        val = intz(srcrevstr)
        if val == -101 and not review.is_saved():
            srcrev = val  # marked as future (not really supported anymore)
        elif val in [-202, -604]:  # batch or marked as deleted
            srcrev = val
    if handler.request.get('mode') == "batch" or srcrev == -202:
        srcrev = -202
        # batch upload overwrites svcdata since there isn't any yet
        review.svcdata = "{" + batch_flag_attrval(review) + "}"
    review.srcrev = srcrev


def set_review_dispafter(review, acc):
    # dispafter is only set on create, it is not changed on edit. If a
    # dispafter were to be altered for one membic it could logically cascade
    # into the entire queue.
    if review.is_saved():
        return
    try:
        mpd = 1
        acs = json.loads(acc.cliset or "{}")
        if "maxPostsPerDay" in acs:
            mpd = int(acs["maxPostsPerDay"])
            mpd = max(1, mpd)
            mpd = min(2, mpd)
        wait = 24 / mpd  # every 24 hours or every 12 hours
        preb = json.loads(acc.preb or "[]")
        if not len(preb):  # first post, so no wait.
            review.dispafter = review.modified or nowISO()
        else:
            disp = preb[0]["dispafter"] or preb[0]["modified"]
            disp = ISO2dt(disp)
            disp += datetime.timedelta(hours=wait)
            disp = dt2ISO(disp)
            review.dispafter = max(review.modified, disp)
    except Exception as e:
        logging.warn("set_review_dispafter MUser: " + str(acc.key().id()) +
                     " queuing failure: " + str(e))


def set_review_mainfeed(rev, acc):
    # NB: rev.key().id() is NOT defined at this point
    rev.mainfeed = 1
    # logmsg = "set_review_mainfeed " + (rev.title or rev.name) + " "
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
    if not acc.actcode:  # account needs help
        rev.mainfeed = 0
    if not rev.text or len(rev.text) < 65:  # not substantive (UI indicated)
        # debuginfo(logmsg + "text not substantive.")
        rev.mainfeed = 0
    if not rev.rating or rev.rating < 60:  # 3 stars or better
        # debuginfo(logmsg + "is not highly rated.")
        rev.mainfeed = 0
    # debuginfo("set_review_mainfeed: " + str(rev.mainfeed))


# Embedded HTML in review fields screws up everything including RSS, and can
# even get the site in trouble with other sites' terms of use.  Not ok.
def remove_HTML(review, revfields):
    pattern = re.compile("<\S")
    for fspec in revfields:
        val = getattr(review, fspec["field"])
        if val:
            sr = pattern.search(val)
            if sr:
                val = val[0:sr.start()]
                setattr(review, fspec["field"], val)


# Read the field values for a source review.  Theme reviews are copied from
# source reviews (post-through model) so not read directly.
def read_review_values(handler, review, acc):
    """ Read the form parameter values into the given review """
    review.revtype = handler.request.get('revtype') or "other"
    # penid was already set when review was retrieved/constructed
    review.ctmid = 0  # reading fields for a source review
    review.rating = read_review_rating(handler)
    set_review_srcrev(handler, review, acc)
    val = handler.request.get("revpic", "")  # review.revpic uploaded separately
    if val == "DELETED":                     # but deleted via flag
        review.revpic = None
    note_modified(review)  # sets modified and modhist
    set_review_dispafter(review, acc)
    review.penname = acc.name
    revfields = [{"field":"keywords", "op":"ifgiven"},
                 {"field":"text", "op":"ifgiven"},
                 {"field":"imguri", "op":"ifgiven"},
                 # icwhen and icdata are for consvc runtime relay tracking only
                 {"field":"altkeys", "op":"ifgiven"},
                 {"field":"svcdata", "op":"ifgiven"},
                 {"field":"orids", "op":"ifgiven"},
                 {"field":"name", "op":"always"},
                 {"field":"title", "op":"always"},
                 {"field":"url", "op":"ifgiven"},
                 {"field":"rurl", "op":"ifgiven"},
                 {"field":"artist", "op":"always"},
                 {"field":"author", "op":"always"},
                 {"field":"publisher", "op":"ifgiven"},
                 {"field":"album", "op":"ifgiven"},
                 {"field":"starring", "op":"ifgiven"},
                 {"field":"address", "op":"ifgiven"},
                 {"field":"year", "op":"ifgiven"}]
    for fspec in revfields:
        if fspec["op"] == "ifgiven":
            set_if_param_given(review, fspec["field"], handler, fspec["field"])
        elif fspec["op"] == "always":
            setattr(review, fspec["field"],
                    onelinestr(handler.request.get(fspec["field"])))
    remove_HTML(review, revfields)
    set_review_mainfeed(review, acc)
    review.cankey = create_cankey_for_review(review)  # server consistency
    logdet = [review.penname, str(review.rating), review.revtype]
    for fspec in revfields:
        val = getattr(review, fspec["field"])
        if val:
            logdet.append(fspec["field"] + ":" + val)
    logging.info(" ".join(logdet))


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
        debuginfo("updating memcache " + mckey)
        memcache.set(mckey, self.cached_value())


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
    # svcdata is JSON, but easier to look for the included flag values
    # directly in the json text rather than unpacking and then checking
    # each value to see if it's there and what it is.
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


def write_coop_post_notes_to_svcdata(review, postnotes):
    svcdict = {}
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
    svcdict["postctms"] = postnotes
    review.svcdata = json.dumps(svcdict)
    # Do not update the modified timestamp here since it can cause the
    # modified and modhist fields to be off by a few millis, which can then
    # round to seconds, which can round to minutes etc.  For a new membic
    # the modhist ISO and the modified ISO should be the same.
    # review.modified = nowISO()
    review.put()  # not generally instance cached


def find_coop_review_for_source_review(ctm, review):
    ctmrev = None
    # figure out id from cache to save a query
    revidstr = str(review.key().id())
    prs = json.loads(ctm.preb or "[]")
    for pr in prs:
        if pr["srcrev"] == revidstr:
            ctmrev = Review.get_by_id(int(pr["instid"]))
            break
    # preb might have overflowed or been reset, query for it
    if not ctmrev:
        where = "WHERE ctmid = :1 AND srcrev = :2"
        vq = VizQuery(Review, where, ctm.key().id(), review.key().id())
        revs = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        if len(revs) > 0:
            ctmrev = revs[0]
    return ctmrev


def write_coop_reviews(review, acc, ctmidscsv, adding):
    rebmode = "replace"
    if adding:
        rebmode = "add"
    ctmidscsv = ctmidscsv or ""
    postnotes = []
    coops = []
    cd = json.loads(acc.coops or "{}")
    # logging.info("write_coop_reviews: " + str(cd))
    for ctmid in cd:
        if cd[ctmid]["lev"] < 1:
            continue  # just following, not posting
        posting = csv_contains(ctmid, ctmidscsv)
        if adding and not posting:
            continue  # no need to check for deletions if adding new review
        logging.info("    wrc checking " + ctmid + " " + cd[ctmid]["name"])
        ctm = cached_get(intz(ctmid), coop.Coop)
        if not coop.may_write_review(acc, ctm):
            continue  # acc.coops updated to avoid retry. Not an error.
        if posting:  # writing new or updating
            ctmrev = None
            if not adding:
                ctmrev = find_coop_review_for_source_review(ctm, review)
            if not ctmrev:  # either adding new or not found
                ctmrev = Review(revtype=review.revtype, penid=acc.key().id())
            copy_source_review(review, ctmrev, ctmid)
            mctr.synchronized_db_write(ctmrev)
            postnotes.append(coop_post_note(ctm, ctmrev))
            logging.info("write_coop_reviews wrote review for: Coop " + ctmid +
                         " " + ctm.name)
            ctm = rebuild_prebuilt(ctm, ctmrev, mode=rebmode)
            coops.append(ctm)
        if not posting and not adding:  # check theme deletions
            ctmrev = find_coop_review_for_source_review(ctm, review)
            if ctmrev and not csv_contains(ctmid, ctmidscsv): # deleting
                revid = ctmrev.key().id();
                cached_delete(revid, Review)
                logging.info("write_coop_reviews deleted Review " + str(revid) +
                             " from Coop " + ctmid + " " + ctm.name)
                ctm = rebuild_prebuilt(ctm, ctmrev, mode="remove")
                coops.append(ctm)
    logging.info("    writing svcdata.postnotes " + str(postnotes))
    write_coop_post_notes_to_svcdata(review, postnotes)
    return coops


def ctmids_except_coop(review, ctm):
    exid = str(ctm.key().id())
    ctmids = []
    svcdata = json.loads(review.svcdata or "{}")
    if "postctms" in svcdata:
        for pt in svcdata["postctms"]:
            if pt["ctmid"] != exid:
                ctmids.append(pt["ctmid"])
    ctmids = ",".join(ctmids)
    return ctmids


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


rev_json_skip_fields = ["mainfeed", "icwhen", "icdata", "altkeys", "orids",
                        "helpful", "remembered"]


def preb_query_generator(instance, review):
    where = "WHERE ctmid = 0 AND penid = :1 ORDER BY modified DESC"
    if instance.kind() == "Coop":
        where = "WHERE ctmid = :1 ORDER BY modified DESC"
    vq = VizQuery(Review, where, instance.key().id())
    revs = vq.run(read_policy=db.STRONG_CONSISTENCY, deadline=60,
                  batch_size=1000)
    for rev in revs:
        if review and str(rev.key().id()) == str(review.key().id()):
            continue  # given review has already been dealt with
        if rev.srcrev and rev.srcrev < 0:
            continue  # deleted or other ignorable
        jstr = obj2JSON(rev, rev_json_skip_fields)
        yield jstr


# If adding a new review with a preb overflow, writing of the overflow will
# start before iteration of the instance.preb is completed.  To avoid any
# ambiguity with reading and writing at the same time, the overflow preb is
# fetched immediately if it exists.
def preb_preb_generator(instance, review):
    prebstr = instance.preb
    while prebstr:
        revs = json.loads(prebstr)
        prebstr = ""  # exit while unless overflow
        if len(revs) and "overflow" in revs[len(revs) - 1]:
            overid = int(revs[len(revs) - 1]["overflow"])
            overflow = ovrf.Overflow.get_by_id(overid)
            if not overflow:
                logging.warn("Overflow " + str(overid) + " not found.")
            if overflow and overflow.preb:
                prebstr = overflow.preb
        for rev in revs:
            if "overflow" in rev:
                break
            if review and rev["instid"] == str(review.key().id()):
                continue  # given review has already been dealt with
            yield json.dumps(rev)


def prebuilt_revs_iterable(instance, review, mode):
    if instance.preb and mode in ["add", "replace", "remove"]:
        return preb_preb_generator(instance, review)
    return preb_query_generator(instance, review)


# The review is in because otherwise it is likely the query will find an
# older copy.  If not given, then rebuild from scratch.
# mode can be "query" (fetch from database), "add" (newly created entry),
# "replace" (modification of existing entry), or "remove" (delete entry)
# GAE max object size is 1mb.  A unicode char is 2-4 bytes.  Guessing around
# 3k chars of storage for text elements: 10k.  200x200 pic: 40k.  Double for
# safety, so a max of 900k for preb.  Go with 800k for preb.  If all membics
# won't fit, the last entry in the preb array will be {overflow:id}.
# Encoding the obect as JSON also encodes unicode chars, so standard len
# testing gives an accurate count of the size.
def rebuild_prebuilt(instance, review, mode="query"):
    priminst = instance   # keep primary instance reference for overflow
    priminst.lastwrite = nowISO();
    sizemax = 800 * 1000  # Dunno if counted 1024 or 1000, being conservative
    preb = ""
    if review and mode != "remove":
        preb = obj2JSON(review, rev_json_skip_fields)
    currsize = len(preb)
    revs = prebuilt_revs_iterable(priminst, review, mode)
    revcount = 1    # just informational, remove still counted as 1
    overcount = 0   # how many times the preb data has been overflowed
    for jstr in revs:
        if currsize + 1 + len(jstr) > sizemax:
            overcount += 1
            overflow = ovrf.get_overflow(priminst.kind(), priminst.key().id(), 
                                         overcount)
            preb += ",{\"overflow\": \"" + str(overflow.key().id()) + "\"}"
            instance.preb = "[" + preb + "]"
            cached_put(instance)  # writes current MUser, Coop or Overflow
            instance = overflow
            preb = jstr
            currsize = len(jstr)
        else:
            if preb:
                preb += ","
            preb += jstr
            currsize += 1 + len(jstr)
        revcount += 1
    instance.preb = "[" + preb + "]"
    cached_put(instance)  # priminst or last overflow object
    logging.info("rebuild_prebuilt " + str(revcount) + " membics, overcount " +
                 str(overcount) + " " + priminst.kind() + " " +
                 str(priminst.key().id()) + " " + priminst.name)
    return priminst


# Each theme can be up to 1mb in size, which leads to a lot of download
# time, especially on a phone.  Limit the returned themes to just the one
# requested by the client (if any).
def filter_themes_to_requested(handler, themes):
    filtered = []
    logmsg = "Filter themes"
    reqid = handler.request.get("editingtheme") or "0"
    reqid = int(reqid)
    if reqid:
        logmsg += " to " + str(reqid)
        for theme in themes:
            if str(theme.key().id()) == str(reqid):
                filtered.append(theme)
    logging.info(logmsg + " len(filtered): " + str(len(filtered)))
    return filtered


class SaveReview(webapp2.RequestHandler):
    def post(self):
        acc = muser.authenticated(self.request)
        if not acc:
            return  # error already reported
        review = get_review_for_save(self, acc)
        if not review:
            return  # error already reported
        add = not review.is_saved()
        read_review_values(self, review, acc)
        mctr.synchronized_db_write(review)
        logging.info("SaveReview wrote Review " + str(review.key().id()))
        # get the updated prebuilt coops, updating acc.svcdata in the process
        objs = write_coop_reviews(review, acc, self.request.get('ctmids'), add)
        objs = filter_themes_to_requested(self, objs)
        rebmode = "replace"
        if add:
            rebmode = "add"
        acc = rebuild_prebuilt(acc, review, mode=rebmode)
        logging.info("SaveReview updated MUser.preb " + str(acc.key().id()))
        memcache.set("activecontent", "")  # force theme/profile refetch
        objs.insert(0, review)
        objs.insert(0, acc)
        srvObjs(self, objs)  # [acc, review, coop?]


class RemoveThemePost(webapp2.RequestHandler):
    def post(self):
        acc = muser.authenticated(self.request)
        if not acc:
            return
        theme, role = coop.fetch_coop_and_role(self, acc)
        if not theme:
            return
        if role not in ["Founder", "Moderator"]:
            return srverr(self, 401, "You are not authorized to remove membics")
        themerev = noauth_get_review_for_update(self)
        if not themerev:
            return
        reason = self.request.get("reason")
        if not reason:
            return srverr(self, 400, "A reason is required for the theme log")
        # The source instance is always available, even if marked as deleted.
        srcrev = Review.get_by_id(themerev.srcrev)
        coop.update_coop_admin_log(theme, acc, "Removed Membic", srcrev, reason)
        cached_put(theme)
        ctmidcsv = ctmids_except_coop(srcrev, theme)
        srcacc = muser.MUser.get_by_id(srcrev.penid)
        # Same processing as SaveReview...
        objs = write_coop_reviews(srcrev, srcacc, ctmidcsv, False)
        objs = filter_themes_to_requested(self, objs)
        srcacc = rebuild_prebuilt(srcacc, srcrev, mode="replace")
        memcache.set("activecontent", "")  # force theme/profile refetch
        objs.insert(0, srcacc)
        srvObjs(self, objs)  # [acc, coop?]


# Errors containing the string "failed: " are reported by the client
class UploadReviewPic(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write('Ready')
    def post(self):
        acc = muser.authenticated(self)
        if not acc:
            return  # error already reported
        review = None
        revid = intz(self.request.get("revid"))
        if revid:
            review = safe_get_review_for_update(self)
            if not review:
                return  # error already reported
        else:
            revtype = self.request.get("revtype")
            if not revtype:
                return srverr(self, 406, "failed: No membic type")
            review = Review(penid=acc.key().id(), revtype=revtype)
        upfile = self.request.get("picfilein")
        if not upfile:
            return srverr(self, 406, "failed: No pic data")
        try:
            review.revpic = db.Blob(prepare_image(images.Image(upfile)))
            note_modified(review)
            cached_put(review)  # so GetReviewPic can quickly find it..
            rebuild_prebuilt(acc, review, mode="replace")
            # coop posted reviews use pic from source review, so don't need 
            # to rebuild_prebuilt all the coops.
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
        acc = muser.authenticated(self)
        if not acc:
            return  # error already reported
        revid = intz(self.request.get('revid'))
        review = Review.get_by_id(revid)  # pull database instance for update
        if not review or review.penid != acc.key().id():
            return srverr(self, 403, "Review not found or not writeable")
        if not review.revpic:
            return srverr(self, 404, "No pic found for review " + str(revid))
        try:
            img = images.Image(review.revpic)
            img.rotate(90)
            img = img.execute_transforms(output_encoding=images.PNG)
            review.revpic = db.Blob(img)
            note_modified(review)
            cached_put(review)  # so GetReviewPic can quickly find it..
            rebuild_prebuilt(acc, review, mode="replace")
            # same logic as UploadReviewPic for coop posted reviews..
        except Exception as e:
            return srverr(self, 409, "Pic rotate failed: " + str(e))
        moracct.returnJSON(self.response, [ review ])


app = webapp2.WSGIApplication([('.*/saverev', SaveReview),
                               ('.*/remthpost', RemoveThemePost),
                               ('.*/revpicupload', UploadReviewPic),
                               ('.*/revpic', GetReviewPic),
                               ('.*/rotatepic', RotateReviewPic)], debug=True)

