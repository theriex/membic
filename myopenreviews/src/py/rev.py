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
# for conversion only...
from revtag import ReviewTag


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


def review_modification_authorized(handler):
    """ Return the PenName if the penid matches a pen name the caller is 
        authorized to modify, otherwise return False """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return False
    penid = intz(handler.request.get('penid'))
    if not penid:
        handler.error(401)
        handler.response.out.write("No penid specified")
        return False
    pnm = cached_get(penid, pen.PenName)
    if not pnm:
        handler.error(404)
        handler.response.out.write("Pen " + str(penid) + " not found.")
        return False
    authok = pen.authorized(acc, pnm)
    if not authok:
        handler.error(401)
        handler.response.out.write("Pen name not authorized.")
        return False
    return pnm


def safe_get_review_for_update(handler):
    revid = intz(handler.request.get('_id'))
    if not revid:
        revid = intz(handler.request.get('revid'))
    review = cached_get(revid, Review)
    if not review:
        handler.error(404)
        handler.response.out.write("Review id: " + str(revid) + " not found.")
        return
    penid = intz(handler.request.get('penid'))
    if penid != review.penid:
        handler.error(401)
        handler.response.out.write("Review pen does not match")
        return
    return review


def get_review_for_save(handler):
    revid = intz(handler.request.get('_id'))
    if not revid:
        revid = intz(handler.request.get('revid'))
    review = cached_get(revid, Review)
    penid = intz(handler.request.get('penid'))
    if not review:
        review = fetch_review_by_cankey(handler)
        if not review:
            revtype = handler.request.get('revtype')
            review = Review(penid=penid, revtype=revtype)
    if penid != review.penid:
        handler.error(401)
        handler.response.out.write("Not your review")
        return
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


def simple_rev_activity_search(penids):
    rps = memcache.get("recentrevs")
    # revid0:penid0,revid1:penid1,revid2:penid2...
    if not rps:
        logging.info("simple_rev_activity_search finding recent reviews...")
        rps = ""
        revs = Review.all()
        revs.order('-modified')
        dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(30))
        checked = 0
        for rev in revs:
            checked += 1
            if not (rev.svcdata and batch_flag_attrval(rev) in rev.svcdata):
                if rps:
                    rps += ","
                rps += str(rev.key().id()) + ":" + str(rev.penid)
            if rev.modified < dold:
                break  # remaining reviews are too old to display
        memcache.set("recentrevs", rps)
    logging.info("simple_rev_activity_search filtering cached reviews")
    checked = 0
    results = []
    rps = rps.split(",")
    for rp in rps:
        checked += 1
        revpen = rp.split(":")
        if len(penids) == 0 or (len(revpen) > 1 and revpen[1] in penids):
            rev = cached_get(intz(revpen[0]), Review)
            results.append(rev)
        if len(results) > 200:
            break
    return checked, results


def review_activity_search(since, cursor, penids):
    if not since and not cursor:
        return simple_rev_activity_search(penids)
    results = []
    revs = Review.all()
    revs.order('-modified')
    if since:
        revs.filter('modified >', since)
    if cursor:
        revs.with_cursor(start_cursor = cursor)
    maxcheck = 4000
    maxreturn = 200
    dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(30))
    checked = 0
    cursor = ""
    for rev in revs:
        checked += 1
        if ((str(rev.penid) in penids) and
            (not (rev.svcdata and 
                  batch_flag_attrval(rev) in rev.svcdata))):
            results.append(rev)
        if len(results) >= maxreturn:
            cursor = revs.cursor()
            break
        if rev.modified < dold:
            break  #rest is too old to display
        if checked >= maxcheck:
            break  #that's enough resources expended
    return checked, results


def batch_flag_attrval(review):
    return "\"batchUpdated\":\"" + review.modified + "\""


def set_review_mainfeed(rev):
    # Not looking forward to dealing with bots and trolls, but if that
    # becomes necessary this is the hook point.  ep:28feb15
    rev.mainfeed = 1
    if rev.svcdata and batch_flag_attrval(rev) in rev.svcdata:
        rev.srcrev = -202
        rev.mainfeed = 0
    if rev.svcdata < 0:  # future review, batch update etc.
        rev.mainfeed = 0
    if rev.grpid != 0:   # group posting, not source review
        rev.mainfeed = 0
    if not rev.text or len(rev.text) < 180:  # not substantive
        rev.mainfeed = 0
    if not rev.rating or rev.rating < 0:  # rating required
        rev.mainfeed = 0


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
    cached_put(review)
    set_review_mainfeed(review)
    if review.mainfeed:
        prepend_to_main_feeds(review, pnm)
    bust_cache_key("recentrevs")
    bust_cache_key("blog" + pnm.name_c)
    update_top20_reviews(pnm, review)


def copy_source_review(fromrev, torev, grpid):
    torev.revtype = fromrev.revtype
    torev.penid = fromrev.penid
    torev.grpid = int(grpid)
    torev.rating = fromrev.rating
    torev.srcrev = fromrev.srcrev
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
        gql = Review.gql(where, grpid, review.key().id())
        revs = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
        grprev = None
        if len(revs) > 0:
            grprev = revs[0]
        else:
            grprev = Review(penid=penid, revtype=review.revtype)
        copy_source_review(review, grprev, grpid)
        cached_put(grprev)
        update_top20_reviews(grp, grprev)
        postnotes.append(group_post_note(grp, grprev))
    write_group_post_notes_to_svcdata(review, postnotes)


def creation_compare(revA, revB):
    createA = revA.modhist.split(";")[0]
    createB = revB.modhist.split(";")[0]
    if createA < createB:
        return -1
    if createA > createB:
        return 1
    return 0


def find_source_review(cankey, modhist):
    source = None
    # strict less-than match to avoid finding the same thing being checked
    where = "WHERE cankey = :1 AND modhist < :2 ORDER BY modhist ASC"
    rq = Review.gql(where, cankey, modhist)
    revs = rq.fetch(1000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for rev in revs:
        if source and creation_compare(source, rev) < 0:
            break  # have the earliest, done
        if rev.orids:
            source = rev
            break  # found the currently used reference root for this cankey
        source = rev  # assign as candidate reference root
    return source


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


def retrieve_pen_or_group(handler):
    grpid = intz(handler.request.get('grpid'))
    if grpid:
        grp = cached_get(grpid, group.Group)
        return grp, "grpid"
    penid = intz(handler.request.get('penid'))
    if penid:
        pnm = pen.fetch_pen_by_penid(handler)
        return pnm, "penid"
    pens = pen.find_auth_pens(handler)
    if pens and len(pens) > 0:
        return pens[0], "penid"
    return None, penid


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


def update_top20s(pgo, recentrevs):
    maxpertype = 50  # 20 is not quite enough
    topdict = {}
    if pgo.top20s:
        topdict = json.loads(pgo.top20s)
    changed = False
    alltopids = []
    for rt in known_rev_types:
        if not rt in topdict:
            topdict[rt] = []
        orgtids = topdict[rt] or []
        toprevs = [];
        for rev in recentrevs:
            if rev.revtype == rt:
                toprevs.append(rev)
        for orgtid in orgtids:
            if not rev_in_list(orgtid, toprevs):
                orgrev = cached_get(intz(orgtid), Review)
                if orgrev and orgrev.revtype == rt:
                    toprevs.append(orgrev)
        toprevs = sorted(toprevs, key=attrgetter('rating', 'modified'),
                         reverse=True)
        if len(toprevs) > maxpertype:
            toprevs = toprevs[0:maxpertype]
        newtids = strids_from_list(toprevs)
        alltopids = alltopids + newtids
        if newtids != orgtids:
            changed = True
            topdict[rt] = newtids
    if changed:
        topdict["latestrevtype"] = recentrevs[0].revtype
        tstamp = nowISO();
        topdict["t20lastupdated"] = tstamp
        pgo.top20s = json.dumps(topdict)
        pgo.modified = tstamp;
        cached_put(pgo)
    return pgo, list_to_csv(alltopids)


def fetch_revs_for_pg(idfield, pgo):
    where = "WHERE " + idfield + " = :1 ORDER BY modified DESC"
    rq = Review.gql(where, pgo.key().id())
    recent = rq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    recentcsv = ""
    for rev in recent:
        recentcsv = append_to_csv(str(rev.key().id()), recentcsv)
        cache_verify(rev)
    pgo, topcsv = update_top20s(pgo, recent)
    resultcsv = recentcsv
    for idstr in csv_list(topcsv):
        if not csv_contains(idstr, recentcsv):
            resultcsv = append_to_csv(idstr, resultcsv)
    return pgo, resultcsv


class NewReview(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return
        review = fetch_review_by_cankey(self)
        if not review:
            penid = intz(self.request.get('penid'))
            revtype = self.request.get('revtype')
            review = Review(penid=penid, revtype=revtype)
        read_review_values(self, review)
        review.penname = pnm.name
        if self.request.get('mode') == "batch":
            # Might be better to unpack the existing svcdata value and 
            # update rather than rewriting, but maybe not. Change if needed
            review.svcdata = "{" + batch_flag_attrval(review) + "}"
        write_review(review, pnm)
        returnJSON(self.response, [ review ])


class UpdateReview(webapp2.RequestHandler):
    def post(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return
        review = safe_get_review_for_update(self)
        if not review:
            return
        read_review_values(self, review)
        review.penname = pnm.name
        write_review(review, pnm)
        returnJSON(self.response, [ review ])


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
        review = safe_get_review_for_update(self)
        if not review:
            return
        cached_delete(review.key().id(), Review)
        ## there may be a tombstone reference in the top20s.  That's ok.
        returnJSON(self.response, [])


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
                self.error(406)  # Not Acceptable
                self.response.out.write("No revtype recieved")
                return
            review = Review(penid=penid, revtype=revtype)
        upfile = self.request.get("picfilein")
        if not upfile:
            self.error(406)  # Not Acceptable
            self.response.out.write("No picfilein received")
            return
        try:
            review.revpic = db.Blob(upfile)
            review.revpic = images.resize(review.revpic, 160, 160)
            note_modified(review)
            cached_put(review)
        except Exception as e:
            self.error(409)  # Conflict
            self.response.out.write("Pic upload processing failed: " + str(e))
            return
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("revid: " + str(review.key().id()))


class GetReviewPic(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        review = cached_get(intz(revid), Review)
        havepic = review and review.revpic
        if not havepic:
            self.error(404)
            self.response.write("Pic for review " + str(revid) + " not found.")
            return
        img = images.Image(review.revpic)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class SearchReviews(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
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
            review = cached_get(intz(revid), Review)
            if not review:
                self.error(404)
                self.response.write("No Review found for id " + revid)
                return
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


# If penid is specified, then this returns the first few matching
# reviews, most recent first (allows for dupe checking).  If penid is
# NOT specified, then this returns the first 10 matching reviews,
# oldest first (allows for seniority in corresponding linkage counts).
class GetReviewByKey(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        penid = intz(self.request.get('penid'))
        revtype = self.request.get('revtype')
        cankey = self.request.get('cankey')
        if penid:
            fetchmax = 5
            where = "WHERE penid = :1 AND revtype = :2 AND cankey = :3"\
                 + " ORDER BY modified DESC"
            revquery = Review.gql(where, penid, revtype, cankey)
        else:  #penid not specified
            fetchmax = 10
            where = "WHERE revtype = :1 AND cankey = :2"\
                 + " ORDER BY modified ASC"
            revquery = Review.gql(where, revtype, cankey)
        reviews = revquery.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                                 deadline=10)
        returnJSON(self.response, reviews)


class ReviewDataInit(webapp2.RequestHandler):
    def get(self):
        revs = Review.all()
        count = 0
        for rev in revs:
            rev.modhist = rev.modified + ";1"
            rev.grpid = 0
            set_review_mainfeed(rev)
            if rev.srcrev >= 0:    # not some reserved special handling value
                rev.srcrev = -1    # set to proper revid or 0 later
            rev.orids = ""
            rev.helpful = ""
            rev.remembered = ""
            rev.put()
            count += 1
        self.response.out.write(str(count) + " Reviews initialized<br>\n")
        rts = ReviewTag.all()
        count = 0
        for rt in rts:
            rt.converted = 0
            rt.put()
            count += 1
        self.response.out.write(str(count) + " ReviewTags initialized<br>\n")
        pens = pen.PenName.all()
        count = 0
        for pnm in pens:
            pnm.remembered = ""
            pnm.preferred = ""
            pnm.background = ""
            pnm.blocked = ""
            pnm.put()
            count += 1
        self.response.out.write(str(count) + " Pens initialized<br>\n")


class VerifyAllReviews(webapp2.RequestHandler):
    def get(self):
        memcache.delete("all")
        for revtype in known_rev_types:
            memcache.delete(revtype)
        # fix up any initialized srcrev values
        rq = Review.gql("WHERE srcrev = -1")
        revs = rq.fetch(10000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
        count = 0
        for rev in revs:
            src = find_source_review(rev.cankey, rev.modhist)
            if src:
                src = Review.get_by_id(src.key().id())  # read latest data
                rev.srcrev = src.key().id()
                revidstr = str(rev.key().id())
                src.orids = remove_from_csv(revidstr, src.orids)
                src.orids = prepend_to_csv(revidstr, src.orids, 200)
                src.put()
            else:
                rev.srcrev = 0
            rev.put()
            count += 1
        self.response.out.write(str(count) + " Reviews verified<br>\n")
        # convert helpful and remembered to new new data representation
        count = 0
        rtq = ReviewTag.gql("WHERE converted = 0")
        rts = rtq.fetch(10000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
        for rt in rts:
            rev = Review.get_by_id(rt.revid)
            pnm = pen.PenName.get_by_id(rt.penid)
            if rev and pnm:
                spid = str(rt.penid)
                rid = str(rt.revid)
                if not rt.nothelpful or rt.helpful > rt.nothelpful:
                    rev.helpful = remove_from_csv(spid, rev.helpful)
                    rev.helpful = prepend_to_csv(spid, rev.helpful, 120)
                if not rt.forgotten or rt.remembered > rt.forgotten:
                    rev.remembered = remove_from_csv(spid, rev.remembered)
                    rev.remembered = prepend_to_csv(spid, rev.remembered, 120)
                    pnm.remembered = remove_from_csv(rid, pnm.remembered)
                    pnm.remembered = prepend_to_csv(rid, pnm.remembered, 1000)
                    pnm.put()
                rev.put()
            rt.converted = 1
            rt.put()
            count += 1
        self.response.out.write(str(count) + " ReviewTags converted<br>\n")
        # convert group revid lists into separate review entries
        groups = group.Group.all()
        count = 0
        for grp in groups:
            logging.info("Converting " + grp.name)
            revids = csv_list(grp.reviews)
            for revid in revids:
                count += 1
                create_or_update_grouprev(int(revid), grp.key().id())
        self.response.out.write(str(count) + " group reviews converted<br>\n")


class GetReviewFeed(webapp2.RequestHandler):
    # If revtype is specified, restrict to that type. If an authorized
    # account was given, then filter and sort based on blocking and
    # preferences. Maximally leverage cache to avoid db overhead.
    def get(self):
        revtype = self.request.get('revtype')
        if revtype not in known_rev_types:
            revtype = ""
        feedcsv = memcache.get(revtype or "all")
        if not feedcsv:  # rebuild and save in cache
            logging.info("rebuilding feedcsv for " + (revtype or "all"))
            feedcsv = ""
            where = "WHERE grpid = 0 AND mainfeed = 1"
            if revtype:
                where += " AND revtype = '" + revtype + "'"
            where += " ORDER BY modhist DESC"
            rq = Review.gql(where)
            revs = rq.fetch(1000, read_policy=db.EVENTUAL_CONSISTENCY, 
                            deadline=60)
            for rev in revs:
                fv = str(rev.key().id()) + ":" + str(rev.penid)
                feedcsv = append_to_csv(fv, feedcsv)
                if rev.srcrev:
                    fv = str(rev.srcrev) + ":0"
                    if not csv_contains(fv, feedcsv):
                        feedcsv = append_to_csv(fv, feedcsv)
            memcache.set(revtype or "all", feedcsv)
        pnm = None
        acc = authenticated(self.request)
        if acc and intz(self.request.get('penid')):
            pnm = review_modification_authorized(self)
        feedids = sort_filter_feed(feedcsv, pnm, 200)
        revs = []
        for revid in feedids:
            rev = cached_get(intz(revid), Review)
            revs.append(rev)
        returnJSON(self.response, revs)


class ToggleHelpful(webapp2.RequestHandler):
    def get(self):
        pnm = review_modification_authorized(self)
        if not pnm:
            return
        revid = intz(self.request.get('revid'))
        review = cached_get(revid, Review)
        if not review:
            self.error(404)
            self.response.out.write("Review: " + str(revid) + " not found.")
            return
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
        pgo, idfield = retrieve_pen_or_group(self)
        objs = []
        if pgo:
            ckey = "revs" + str(pgo.key().id())
            idcsv = memcache.get(ckey)
            if not idcsv:
                pgo, idcsv = fetch_revs_for_pg(idfield, pgo)
            objs.append(pgo)
            mostrecent = None
            for revidstr in csv_list(idcsv):
                rev = cached_get(int(revidstr), Review)
                mostrecent = mostrecent or rev.modified
                if rev.modified > mostrecent:
                    logging.error("cache invalidation " + ckey)
                    memcache.delete(key)
                    self.error(409)  # Conflict
                    self.response.out.write("Outdated cache data detected")
                    return
                objs.append(rev)
        returnJSON(self.response, objs)


class FetchPreReviews(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        penid = intz(self.request.get('penid'))
        if not penid:
            self.error(400)
            self.response.out.write("penid required")
            return
        where = "WHERE penid = :1 AND srcrev = -101 ORDER BY modified DESC"
        revquery = Review.gql(where, penid)
        fetchmax = 20
        reviews = revquery.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                                 deadline=10)
        returnJSON(self.response, reviews)


class MakeTestReviews(webapp2.RequestHandler):
    def get(self):
        if not self.request.url.startswith('http://localhost'):
            self.error(405)
            self.response.out.write("Test reviews are only for local testing")
            return
        pencname = self.request.get('pencname')
        if not pencname:
            self.error(400)
            self.response.out.write("pencname required")
            return
        for i in range(20):
            # PenName top20 updated with each write, so refetch each time
            # Same index retrieval already used by pen.py NewPenName
            pens = pen.PenName.gql("WHERE name_c=:1 LIMIT 1", pencname)
            if pens.count() != 1:
                self.error(404)
                self.response.out.write("PenName name_c " + pencname + 
                                        " not found")
                return
            rev = Review(penid=pens[0].key().id(), revtype="movie")
            rev.rating = 75
            rev.text = "dummy movie review " + str(i)
            rev.modified = nowISO()
            rev.title = "movie " + str(i)
            rev.cankey = canonize(rev.title)
            logging.info("Writing test review: " + rev.title)
            write_review(rev, pens[0])
            time.sleep(7)  # let database updates stabilize
        self.response.out.write("Test reviews created")


app = webapp2.WSGIApplication([('/newrev', NewReview),
                               ('/updrev', UpdateReview),
                               ('/saverev', SaveReview),
                               ('/delrev', DeleteReview),
                               ('/revpicupload', UploadReviewPic),
                               ('/revpic', GetReviewPic),
                               ('/srchrevs', SearchReviews),
                               ('/revbyid', GetReviewById), 
                               ('/revbykey', GetReviewByKey),
                               ('/revdatainit', ReviewDataInit),
                               ('/revcheckall', VerifyAllReviews),
                               ('/revfeed', GetReviewFeed),
                               ('/toghelpful', ToggleHelpful),
                               ('/blockfetch', FetchAllReviews),
                               ('/fetchprerevs', FetchPreReviews),
                               ('/testrevs', MakeTestReviews)], debug=True)

