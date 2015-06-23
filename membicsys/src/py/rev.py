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
import group
import json
from operator import attrgetter
import re
from cacheman import *
import time


# srcrev is heavily utilized in different contexts:
#   - if there is a source review with the same cankey where
#     references are being tracked, srcrev holds that source review id.
#   - if this is a group posted review (grpid is filled in), then
#     srcrev holds the revid of the original review.
#   - negative srcrev values indicate special handling:
#       -101: Future review (placeholder for later writeup)
#       -202: Batch update (e.g. iTunes upload or similar)
#     Special handling reviews may not be posted to groups
class Review(db.Model):
    """ A review of something """
    revtype = db.StringProperty(required=True)   # book, movie, music...
    penid = db.IntegerProperty(required=True)    # who wrote the review
    grpid = db.IntegerProperty()                 # 0 if source review
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
    svcdata = db.TextProperty()                  # ad hoc client data JSON
    penname = db.StringProperty(indexed=False)   # for ease of reporting
    orids = db.TextProperty()                    # other revids CSV
    helpful = db.TextProperty()                  # penids CSV
    remembered = db.TextProperty()               # penids CSV
    # type-specific non-indexed fields
    name = db.StringProperty(indexed=False)      # food, drink, activity, other
    title = db.StringProperty(indexed=False)     # book, movie, video, music
    url = db.StringProperty(indexed=False)       # source URL of item
    artist = db.StringProperty(indexed=False)    # video, music
    author = db.StringProperty(indexed=False)    # book
    publisher = db.StringProperty(indexed=False) # book
    album = db.StringProperty(indexed=False)     # music
    starring = db.StringProperty(indexed=False)  # movie
    address = db.StringProperty(indexed=False)   # food, drink, activity
    year = db.StringProperty(indexed=False)      # values like "80's" ok


known_rev_types = ['book', 'movie', 'video', 'music', 
                   'food', 'drink', 'activity', 'other']
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
    review.grpid = intz(handler.request.get('grpid'))
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


def update_top20_reviews(pgo, review):
    retmax = 30
    t20dict = {}
    if pgo.top20s:
        t20dict = json.loads(pgo.top20s)
    t20ids = []
    if review.revtype in t20dict:
        t20ids = t20dict[review.revtype]
    t20revs = [ review ]
    for revid in t20ids:
        resolved = cached_get(intz(revid), Review)
        # if unresolved reference, or wrong type, then just skip it
        if resolved and resolved.revtype == review.revtype:
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
    pgo.top20s = json.dumps(t20dict)
    pgo.modified = tstamp;
    cached_put(pgo)


def fetch_review_by_cankey(handler):
    penid = intz(handler.request.get('penid'))
    revtype = handler.request.get('revtype')
    cankey = handler.request.get('cankey')
    if not cankey:
        cankey = create_cankey_from_request(handler)
    where = "WHERE penid = :1 AND revtype = :2 AND cankey = :3"
    revquery = Review.gql(where, penid, revtype, cankey)
    reviews = revquery.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, 
                             deadline = 10)
    if len(reviews) > 0:
        return reviews[0]


def batch_flag_attrval(review):
    return "\"batchUpdated\":\"" + review.modified + "\""


def set_review_mainfeed(rev):
    # Not looking forward to dealing with bots and trolls, but if that
    # becomes necessary this is the hook point.  ep:28feb15
    # rev.key().id() is not defined at this point
    rev.mainfeed = 1
    logmsg = "set_review_mainfeed " + (rev.title or rev.name) + " "
    if rev.svcdata and batch_flag_attrval(rev) in rev.svcdata:
        # logging.info(logmsg + "is batch.")
        rev.srcrev = -202
        rev.mainfeed = 0
    if rev.svcdata < 0:  # future review, batch update etc.
        # logging.info(logmsg + "is future or batch.")
        rev.mainfeed = 0
    if rev.grpid > 0:   # group posting, not source review
        # logging.info(logmsg + "is group posting.")
        rev.mainfeed = 0
    if not rev.text or len(rev.text) < 90:  # not substantive
        # logging.info(logmsg + "text not substantive.")
        rev.mainfeed = 0
    if not rev.rating or rev.rating < 60:  # 3 stars or better
        # logging.info(logmsg + "is not highly rated.")
        rev.mainfeed = 0
    # logging.info("set_review_mainfeed: " + str(rev.mainfeed))


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


def write_review(review, pnm):
    set_review_mainfeed(review)
    review.put()
    logging.info("write_review: wrote review " + str(review.key().id()))
    # force retrieval to ensure subsequent db hits find the latest
    review = Review.get_by_id(review.key().id())
    # need to rebuild cache unless new review and not mainfeed.  Just do it.
    memcache.delete(review.revtype)
    memcache.delete("all")
    for i in range(revpoolsize / revblocksize):
        memcache.delete(review.revtype + "RevBlock" + str(i))
        memcache.delete("allRevBlock" + str(i))
    logging.info("write_review: cache cleared, calling to update top 20s")
    update_top20_reviews(pnm, review)
    logging.info("write_review: update_top20_reviews completed")


def copy_source_review(fromrev, torev, grpid):
    torev.revtype = fromrev.revtype
    torev.penid = fromrev.penid
    torev.grpid = int(grpid)
    torev.rating = fromrev.rating
    torev.srcrev = fromrev.key().id()
    torev.mainfeed = fromrev.mainfeed
    torev.cankey = fromrev.cankey
    torev.keywords = fromrev.keywords
    torev.text = fromrev.text
    torev.revpic = fromrev.revpic
    torev.imguri = fromrev.imguri
    torev.altkeys = fromrev.altkeys
    # torev.svcdata = fromrev.svcdata
    torev.penname = fromrev.penname
    torev.orids = fromrev.orids
    torev.helpful = fromrev.helpful
    torev.remembered = fromrev.remembered
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
    note_modified(torev)


def group_post_note(grp, grprev):
    postnote = {}
    postnote["grpid"] = str(grp.key().id())
    postnote["name"] = grp.name
    postnote["revid"] = str(grprev.key().id())
    return postnote


def write_group_post_notes_to_svcdata(review, postnotes):
    svcdict = {}
    if review.svcdata:
        svcdict = json.loads(review.svcdata)
    svcdict["postgrps"] = postnotes
    review.svcdata = json.dumps(svcdict)
    review.modified = nowISO()
    cached_put(review)


def write_group_reviews(review, pnm, grpidscsv):
    if not grpidscsv:
        logging.info("write_group_reviews: no grpidscsv so nothing to do")
        return
    postnotes = []
    for grpid in csv_list(grpidscsv):
        grp = cached_get(int(grpid), group.Group)
        if not grp:
            logging.info("write_group_reviews: no group " + grpid)
            continue
        penid = pnm.key().id()
        if not group.member_level(penid, grp):
            logging.info("write_group_reviews: not member of " + grpid)
            continue
        where = "WHERE grpid = :1 AND srcrev = :2"
        gql = Review.gql(where, int(grpid), review.key().id())
        revs = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        grprev = None
        if len(revs) > 0:
            grprev = revs[0]
        else:
            grprev = Review(penid=penid, revtype=review.revtype)
        logging.info("write_group_reviews: Group " + grpid + " " + grp.name)
        logging.info("write_group_reviews: copying source review")
        copy_source_review(review, grprev, grpid)
        cached_put(grprev)
        logging.info("write_group_reviews: review saved, updating top20s")
        update_top20_reviews(grp, grprev)
        logging.info("write_group_reviews: appending post note")
        postnotes.append(group_post_note(grp, grprev))
    logging.info("write_group_reviews: writing postnotes to svcdata")
    write_group_post_notes_to_svcdata(review, postnotes)


def creation_compare(revA, revB):
    createA = revA.modhist.split(";")[0]
    createB = revB.modhist.split(";")[0]
    if createA < createB:
        return -1
    if createA > createB:
        return 1
    return 0


# find_source_review was only used during data migration, and it requires
# an index that isn't worth maintaining for normal operations moving
# forward.  Keeping it around for reference for now.  If it actually
# needs to be used, then also add the following index back:
#
# - kind: Review
#   properties:
#   - name: cankey
#   - name: modhist
#
# def find_source_review(cankey, modhist):
#     source = None
#     # strict less-than match to avoid finding the same thing being checked
#     where = "WHERE cankey = :1 AND modhist < :2 ORDER BY modhist ASC"
#     rq = Review.gql(where, cankey, modhist)
#     revs = rq.fetch(1000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
#     for rev in revs:
#         if source and creation_compare(source, rev) < 0:
#             break  # have the earliest, done
#         if rev.orids:
#             source = rev
#             break  # found the currently used reference root for this cankey
#         source = rev  # assign as candidate reference root
#     return source


def sort_filter_feed(feedcsv, pnm, maxret):
    preferred = []
    normal = []
    background = []
    feedelems = csv_list(feedcsv)
    for elem in feedelems:
        ela = elem.split(":")
        if pnm:
            if csv_contains(ela[1], pnm.blocked):
                continue
            if csv_contains(ela[1], pnm.preferred):
                preferred.append(int(ela[0]))
            elif csv_contains(ela[1], pnm.background):
                background.append(int(ela[0]))
            else:
                normal.append(int(ela[0]))
        else:
            preferred.append(int(ela[0]))
        if len(preferred) >= maxret:
            break
    feedids = preferred[:maxret] + normal[:maxret] + background[:maxret]
    feedids = feedids[:maxret]
    return feedids


def create_or_update_grouprev(revid, grpid):
    srcrev = Review.get_by_id(revid)
    if not srcrev:
        logging.info("create_or_update_grouprev Review " + str(revid) +
                     " not found. Ignoring.")
        return
    logging.info("Found srcrev " + str(revid) + " " + srcrev.name)
    grprev = Review(penid=srcrev.penid, revtype=srcrev.revtype)
    gql = Review.gql("WHERE grpid = :1 AND srcrev = :2", grpid, revid)
    revs = gql.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
    if len(revs) > 0:
        logging.info("Found existing instance")
        grprev = revs[0]
    else:
        logging.info("Creating new instance")
    grprev.revtype = srcrev.revtype
    grprev.penid = srcrev.penid
    grprev.grpid = grpid
    grprev.rating = srcrev.rating
    grprev.srcrev = revid
    grprev.mainfeed = srcrev.mainfeed
    grprev.cankey = srcrev.cankey
    grprev.modified = srcrev.modified
    grprev.modhist = srcrev.modhist
    grprev.keywords = srcrev.keywords
    grprev.text = srcrev.text
    grprev.revpic = srcrev.revpic
    grprev.imguri = srcrev.imguri
    grprev.altkeys = srcrev.altkeys
    grprev.svcdata = srcrev.svcdata
    grprev.penname = srcrev.penname
    grprev.orids = srcrev.orids
    grprev.helpful = srcrev.helpful
    grprev.remembered = srcrev.remembered
    grprev.name = srcrev.name
    grprev.title = srcrev.title
    grprev.url = srcrev.url
    grprev.artist = srcrev.artist
    grprev.author = srcrev.author
    grprev.publisher = srcrev.publisher
    grprev.album = srcrev.album
    grprev.starring = srcrev.starring
    grprev.address = srcrev.address
    grprev.year = srcrev.year
    cached_put(grprev)


def find_pen_or_group_type_and_id(handler):
    pgid = intz(handler.request.get('grpid'))
    if pgid:
        return "group", pgid, None
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
        return "pen", mypen.key().id(), mypen
    # final case is no pen found because they haven't created one yet
    # that's a normal condition and not an error return
    return "pen", 0, None


def rev_in_list(revid, revs):
    revid = int(revid)
    for rev in revs:
        if rev.key().id() == revid:
            return rev


def strids_from_list(revs):
    strids = []
    for rev in revs:
        strids.append(str(rev.key().id()))
    return strids


def append_review_jsoncsv(jstr, rev):
    jstr = jstr or ""
    if jstr:
        jstr += ","
    jstr += obj2JSON(rev)
    if rev.grpid:
        # append group srcrevs for client cache reference
        srcrev = Review.get_by_id(int(rev.srcrev))
        if not srcrev:
            logging.error("Missing srcrev for Review " + str(rev.key().id()))
        else:
            jstr += "," + obj2JSON(srcrev)
    return jstr


def append_top20_revs_to_jsoncsv(jstr, revs, pgt, pgo, sizebound):
    topdict = {}
    if pgo.top20s:
        topdict = json.loads(pgo.top20s)
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
                    if not rev:  # could be deleted group review or somesuch
                        continue
                    jstr = append_review_jsoncsv(jstr, rev)
                    if len(jstr) > sizebound:
                        logging.info(pgt + " " + str(pgo.key().id()) + 
                                     " exceeded sizebound " + str(sizebound))
                        return jstr
    return jstr


def rebuild_reviews_block(handler, pgt, pgid):
    logging.info("rebuild_reviews_block " + pgt + " " + str(pgid))
    pgo = None
    if pgt == "group":
        pgo = group.Group.get_by_id(int(pgid))
    elif pgt == "pen":
        pgo = pen.PenName.get_by_id(int(pgid))
        pen.filter_sensitive_fields(pgo)
    if not pgo:
        srverr(handler, 404, pgt + " " + str(pgid) + " not found")
        return
    jstr = obj2JSON(pgo)
    # logging.info("rebuild_reviews_block pgo jstr: " + jstr)
    where = "WHERE grpid = 0 AND penid = :1 ORDER BY modified DESC"
    if pgt == "group":
        where = "WHERE grpid = :1 ORDER BY modified DESC"
    rq = Review.gql(where, pgo.key().id())
    revs = rq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for rev in revs:
        jstr = append_review_jsoncsv(jstr, rev)
    jstr = append_top20_revs_to_jsoncsv(jstr, revs, pgt, pgo, 450 * 1024)
    return "[" + jstr + "]"


def feedcsventry(review):
    return str(review.key().id()) + ":" + str(review.penid)


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
    where = "WHERE grpid = 0 AND mainfeed = 1"
    if revtype and revtype != "all":
        where += " AND revtype = '" + revtype + "'"
    where += " ORDER BY modhist DESC"
    rq = Review.gql(where)
    revs = rq.fetch(revpoolsize, read_policy=db.EVENTUAL_CONSISTENCY, 
                    deadline=60)
    for rev in revs:
        feedcsv = append_to_csv(feedcsventry(rev), feedcsv)
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


def extract_json_by_id(fid, block):
    jstr = ""
    openidx = block.find('{"_id":"' + str(fid) + '",')
    if openidx >= 0:
        closeidx = openidx + 1
        brackets = 1
        while closeidx < len(block):
            if block[closeidx] == '{':
                brackets += 1
            elif block[closeidx] == '}':
                brackets -= 1
                if brackets <= 0:
                    closeidx += 1
                    break
            closeidx += 1
        jstr= block[openidx:closeidx]
    return jstr


def resolve_ids_to_json(feedids, blocks):
    jstr = ""
    for fid in feedids:
        for block in blocks:
            objson = extract_json_by_id(fid, block)
            if objson:
                jstr = append_to_csv(objson, jstr)
                break
    return "[" + jstr + "]"


class SaveReview(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
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
        write_review(review, pnm) # updates pen top20s
        write_group_reviews(review, pnm, self.request.get('grpids'))
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
        if not review.grpid:
            return srverr(self, 400, "Only group posts may be deleted")
        grp = group.Group.get_by_id(int(review.grpid))
        if not grp:
            return srverr(self, 404, "Group " + review.grpid + " not found")
        penid = pnm.key().id()
        reason = self.request.get('reason') or ""
        if review.penid != penid:
            if group.member_level(penid, grp) < 2:
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
        if grp.top20s:
            topdict = json.loads(grp.top20s)
        if rt in topdict and topdict[rt] and revid in topdict[rt]:
            topdict[rt].remove(revid)
        grp.top20s = json.dumps(topdict)
        # The reason here must be exactly "Removed Review" so the client can
        # differentiate between removing a review and removing a member.
        group.update_group_admin_log(grp, pnm, "Removed Review", srcrev, reason)
        grp.modified = nowISO()
        cached_put(grp)
        cached_delete(revid, Review)
        returnJSON(self.response, [ grp ])


# This is a form submission endpoint, so always redirect back to the app.
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
                return srverr(self, 406, "No revtype recieved")
            review = Review(penid=pnm.key().id(), revtype=revtype)
        upfile = self.request.get("picfilein")
        if not upfile:
            return srverr(self, 406, "No picfilein received")
        try:
            review.revpic = db.Blob(upfile)
            review.revpic = images.resize(review.revpic, 160, 160)
            note_modified(review)
            cached_put(review)
        except Exception as e:
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


class SearchReviews(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            return srverr(self, 401, "Authentication failed")
        penid = intz(self.request.get('penid'))
        grpid = intz(self.request.get('grpid'))
        mindate = self.request.get('mindate') or "2012-10-04T00:00:00Z"
        maxdate = self.request.get('maxdate') or nowISO()
        qstr = self.request.get('qstr')
        revtype = self.request.get('revtype')
        cursor = self.request.get('cursor')
        ckey = "SearchReviewsG" + str(grpid) + "P" + str(penid) +\
            "D" + mindate + "M" + maxdate
        where = "WHERE grpid = " + str(grpid)  # matches on zero if penid
        if penid:
            where += " AND penid = " + str(penid)
        where += " AND modified >= :1 AND modified <= :2"
        if revtype and revtype != "all":
            where += " AND revtype = '" + revtype + "'"
            ckey += revtype
        where += " ORDER BY modified DESC"
        logging.info("SearchReviews query: " + where + " " + 
                     mindate + " - " + maxdate)
        revquery = Review.gql(where, mindate, maxdate)
        qres = []
        reviter = revquery.run(read_policy=db.EVENTUAL_CONSISTENCY, deadline=30,
                               batch_size=1000)
        for review in reviter:
            if not qstr or qstr in review.cankey:
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


# class ReviewDataInit(webapp2.RequestHandler):
#     def get(self):
#         revs = Review.all()
#         count = 0
#         for rev in revs:
#             if rev.modhist and rev.modhist.endswith(";1"):
#                 continue
#             rev.modhist = rev.modified + ";1"
#             rev.grpid = 0
#             set_review_mainfeed(rev)
#             if rev.srcrev >= 0:    # not some reserved special handling value
#                 rev.srcrev = -1    # set to proper revid or 0 later
#             rev.orids = ""
#             rev.helpful = ""
#             rev.remembered = ""
#             rev.put()
#             count += 1
#         self.response.out.write(str(count) + " Reviews initialized<br>\n")
#         rest = self.request.get('rest')
#         if not rest or rest != "yes":
#             self.response.out.write("rest=yes not found so returning")
#             return
#         rts = ReviewTag.all()
#         count = 0
#         for rt in rts:
#             rt.converted = 0
#             rt.put()
#             count += 1
#         self.response.out.write(str(count) + " ReviewTags initialized<br>\n")
#         pens = pen.PenName.all()
#         count = 0
#         for pnm in pens:
#             pnm.remembered = ""
#             pnm.preferred = ""
#             pnm.background = ""
#             pnm.blocked = ""
#             pnm.put()
#             count += 1
#         self.response.out.write(str(count) + " Pens initialized<br>\n")
#         groups = group.Group.all()
#         count = 0
#         for grp in groups:
#             grp.adminlog = ""
#         self.response.out.write(str(count) + " Groups initialized<br>\n")


# class VerifyAllReviews(webapp2.RequestHandler):
#     def get(self):
#         memcache.delete("all")
#         for revtype in known_rev_types:
#             memcache.delete(revtype)
#         # fix up any initialized srcrev values
#         rq = Review.gql("WHERE srcrev = -1")
#         revs = rq.fetch(10000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
#         count = 0
#         for rev in revs:
#             src = find_source_review(rev.cankey, rev.modhist)
#             if src:
#                 src = Review.get_by_id(src.key().id())  # read latest data
#                 rev.srcrev = src.key().id()
#                 revidstr = str(rev.key().id())
#                 src.orids = remove_from_csv(revidstr, src.orids)
#                 src.orids = prepend_to_csv(revidstr, src.orids, 200)
#                 src.put()
#             else:
#                 rev.srcrev = 0
#             rev.put()
#             count += 1
#         self.response.out.write(str(count) + " Reviews verified<br>\n")
#         # convert helpful and remembered to new new data representation
#         count = 0
#         rtq = ReviewTag.gql("WHERE converted = 0")
#         rts = rtq.fetch(10000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
#         for rt in rts:
#             rev = Review.get_by_id(rt.revid)
#             pnm = pen.PenName.get_by_id(rt.penid)
#             if rev and pnm:
#                 spid = str(rt.penid)
#                 rid = str(rt.revid)
#                 if not rt.nothelpful or rt.helpful > rt.nothelpful:
#                     rev.helpful = remove_from_csv(spid, rev.helpful)
#                     rev.helpful = prepend_to_csv(spid, rev.helpful, 120)
#                 if not rt.forgotten or rt.remembered > rt.forgotten:
#                     rev.remembered = remove_from_csv(spid, rev.remembered)
#                     rev.remembered = prepend_to_csv(spid, rev.remembered, 120)
#                     pnm.remembered = remove_from_csv(rid, pnm.remembered)
#                     pnm.remembered = prepend_to_csv(rid, pnm.remembered, 1000)
#                     pnm.put()
#                 rev.put()
#             rt.converted = 1
#             rt.put()
#             count += 1
#         self.response.out.write(str(count) + " ReviewTags converted<br>\n")
#         # convert group revid lists into separate review entries
#         groups = group.Group.all()
#         count = 0
#         for grp in groups:
#             logging.info("Converting " + grp.name)
#             revids = csv_list(grp.reviews)
#             for revid in revids:
#                 count += 1
#                 create_or_update_grouprev(int(revid), grp.key().id())
#         self.response.out.write(str(count) + " group reviews converted<br>\n")


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
            writeJSONResponse("[" + blocks[0] + "]", self.response)
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
        if not pnm:
            return
        revid = intz(self.request.get('revid'))
        review = cached_get(revid, Review)
        if not review:
            return srverr(self, 404, "Review: " + str(revid) + " not found.")
        if csv_elem_count(review.helpful) < 123:
            penid = str(pnm.key().id())
            if csv_contains(penid, review.helpful):
                review.helpful = remove_from_csv(penid, review.helpful)
            else:
                review.helpful = prepend_to_csv(penid, review.helpful)
            cached_put(review)
            # do not redo the main feeds. too much churn
        returnJSON(self.response, [ review ])


class FetchAllReviews(webapp2.RequestHandler):
    def get(self):
        pgt, pgid, mypen = find_pen_or_group_type_and_id(self)
        if pgid: # pgid may be zero if no pen name yet
            key = pgt + str(pgid)
            jstr = memcache.get(key)
            if not jstr:
                jstr = rebuild_reviews_block(self, pgt, pgid)
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
        revquery = Review.gql(where, penid)
        fetchmax = 20
        reviews = revquery.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                                 deadline=10)
        returnJSON(self.response, reviews)


app = webapp2.WSGIApplication([('/saverev', SaveReview),
                               ('/delrev', DeleteReview),
                               ('/revpicupload', UploadReviewPic),
                               ('/revpic', GetReviewPic),
                               ('/srchrevs', SearchReviews),
                               ('/revbyid', GetReviewById), 
                               ('/revfeed', GetReviewFeed),
                               ('/toghelpful', ToggleHelpful),
                               ('/blockfetch', FetchAllReviews),
                               ('/fetchprerevs', FetchPreReviews)], debug=True)

