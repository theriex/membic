import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
import urllib
from moracct import *
from morutil import *
from pen import PenName, authorized
import json
from operator import attrgetter
import re
from cacheman import *


class Review(db.Model):
    """ A review of something """
    penid = db.IntegerProperty(required=True)
    revtype = db.StringProperty(required=True)
    rating = db.IntegerProperty()
    keywords = db.TextProperty()
    text = db.TextProperty()
    revpic = db.BlobProperty()
    imguri = db.TextProperty()
    # The time any of the above fields was last changed.  Changes to
    # item identification and agent service data is not tracked
    modified = db.StringProperty()  # iso date
    # Fields used to describe the item being reviewed
    name = db.StringProperty()
    title = db.StringProperty()
    url = db.StringProperty()
    artist = db.StringProperty()
    author = db.StringProperty()
    publisher = db.StringProperty()
    album = db.StringProperty()
    starring = db.StringProperty()
    address = db.StringProperty()
    # storing year as a string to allow values like "80's"
    year = db.StringProperty()
    # The canonized key/subkey field value for search match
    cankey = db.StringProperty()
    altkeys = db.TextProperty()
    # Blackboard of connection service processing values in JSON format
    svcdata = db.TextProperty()
    srcrev = db.IntegerProperty()
    # Duplicated data to make summary reporting easier
    penname = db.StringProperty()


def review_modification_authorized(handler):
    """ Return the PenName if the penid matches a pen name the caller is 
        authorized to modify, otherwise return False """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return False
    penid = intz(handler.request.get('penid'))
    pen = cached_get(penid, PenName)
    if not pen:
        handler.error(404)
        handler.response.out.write("Pen " + str(penid) + " not found.")
        return False
    authok = authorized(acc, pen)
    if not authok:
        handler.error(401)
        handler.response.out.write("Pen name not authorized.")
        return False
    return pen


def safe_get_review_for_update(handler):
    id = handler.request.get('_id')
    review = cached_get(intz(id), Review)
    if not review:
        handler.error(404)
        handler.response.out.write("Review id: " + str(id) + " not found.")
        return
    penid = intz(handler.request.get('penid'))
    if penid != review.penid:
        handler.error(401)
        handler.response.out.write("Review pen does not match")
        return
    return review


def canonize_cankey(cankey):
    cankey = re.sub(r'\s', '', cankey)
    cankey = re.sub(r'\'', '', cankey)
    cankey = re.sub(r'\"', '', cankey)
    cankey = re.sub(r'\,', '', cankey)
    cankey = re.sub(r'\.', '', cankey)
    cankey = re.sub(r'\!', '', cankey)
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
    review.modified = nowISO()
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


def update_top20_reviews(pen, review):
    t20dict = {}
    if pen.top20s:
        t20dict = json.loads(pen.top20s)
    t20ids = []
    if review.revtype in t20dict:
        t20ids = t20dict[review.revtype]
    t20revs = [ review ]
    for revid in t20ids:
        resolved = cached_get(intz(id), Review)
        # if unresolved reference, or wrong type, then just skip it
        if resolved and resolved.revtype == review.revtype:
            t20revs.append(resolved)
    t20revs = sorted(t20revs, key=attrgetter('rating', 'modified'), 
                     reverse=True)
    if len(t20revs) > 20:
        t20revs = t20revs[0:20]
    t20ids = []
    lastid = -1     # trap any dupes just in case
    for rev in t20revs:
        currid = rev.key().id()
        if currid != lastid:
            t20ids.append(currid)
        lastid = currid
    t20dict[review.revtype] = t20ids
    t20dict["latestrevtype"] = review.revtype
    pen.top20s = json.dumps(t20dict)
    pen.modified = nowISO();
    cached_put(pen)


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


def review_activity_search(since, cursor, penids):
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


def filter_reviews(reviews, qstr):
    results = [] 
    for review in reviews:
        filtered = False
        if not review.cankey:
            review.cankey = create_cankey_for_review(review)
            cached_put(review)
        if qstr and not qstr in review.cankey:
            filtered = True
        elif review.svcdata and batch_flag_attrval(review) in review.svcdata:
            filtered = True
        if not filtered:
            results.append(review)
    return results


class NewReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:
            return
        review = fetch_review_by_cankey(self)
        if not review:
            penid = intz(self.request.get('penid'))
            revtype = self.request.get('revtype')
            review = Review(penid=penid, revtype=revtype)
        read_review_values(self, review)
        review.penname = pen.name
        if self.request.get('mode') == "batch":
            # Might be better to unpack the existing svcdata value and 
            # update rather than rewriting, but maybe not. Change if needed
            review.svcdata = "{" + batch_flag_attrval(review) + "}"
        cached_put(review)
        update_top20_reviews(pen, review)
        returnJSON(self.response, [ review ])


class UpdateReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:
            return
        review = safe_get_review_for_update(self)
        if not review:
            return
        read_review_values(self, review)
        review.penname = pen.name
        cached_put(review)
        update_top20_reviews(pen, review)
        returnJSON(self.response, [ review ])


class DeleteReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:
            return
        review = safe_get_review_for_update(self)
        if not review:
            return
        cached_delete(review.key().id(), Review)
        ## there may be a tombstone reference in the top20s.  That's ok.
        returnJSON(self.response, [])


# This is a form submission endpoint, so always redirect back to the app.
class UploadReviewPic(webapp2.RequestHandler):
    def post(self):
        errmsg = "You are not authorized to update this review pic"
        if review_modification_authorized(self):
            errmsg = "Could not find review for pic attachment"
            review = safe_get_review_for_update(self)
            if review:
                errmsg = "Picture file not found"
                upfile = self.request.get("picfilein")
                if upfile:
                    errmsg = "Picture upload failure"
                    try:
                        review.revpic = db.Blob(upfile)
                        review.revpic = images.resize(review.revpic, 160, 160)
                        cached_put(review)
                        errmsg = ""
                    except Exception as e:
                        errmsg = "Picture upload failed: " + str(e)
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.wdydfun.com#review"
        redurl = urllib.unquote(redurl)
        redurl = str(redurl)
        if errmsg:
            redurl += "&action=revpicupload&errmsg=" + errmsg
        logging.info("UploadReviewPic redirecting to " + redurl)
        self.redirect(redurl)


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
        mindate = self.request.get('mindate')
        maxdate = self.request.get('maxdate')
        qstr = self.request.get('qstr')
        revtype = self.request.get('revtype')
        oldfirst = self.request.get('oldfirst')
        cursor = self.request.get('cursor')
        fetchmax = 100
        where = "WHERE penid = :1 AND modified >= :2 AND modified <= :3"
        ckey = "SearchReviews" + str(penid) + mindate + maxdate
        if revtype:
            where += " AND revtype = '" + revtype + "'"
            ckey += revtype
        if oldfirst:
            where += " ORDER BY modified ASC"
            ckey += "ASC"
        else:
            where += " ORDER BY modified DESC"
            ckey += "DESC"
        revquery = Review.gql(where, penid, mindate, maxdate)
        qres = cached_query(ckey, revquery, cursor, fetchmax, Review)
        checked = len(qres.objects)
        logging.info("SearchReviews checked: " + str(checked))
        reviews = filter_reviews(qres.objects, qstr)
        if self.request.get('format') == "record":
            result = ""
            for review in reviews:
                record = "revid: " + str(review.key().id()) +\
                    ", title: " + safeURIEncode(review.title) +\
                    ", artist: " + safeURIEncode(review.artist) +\
                    ", album: " + safeURIEncode(review.album) +\
                    ", year: " + safeURIEncode(review.year) +\
                    ", rating: " + str(review.rating) +\
                    ", modified: " + review.modified +\
                    ", keywords: " + safeURIEncode(review.keywords) +\
                    ", text: " + safeURIEncode(review.text, True)
                result += record + "\n"
            result += "fetched: " + str(checked)
            if qres.cursor:
                result += ", cursor: " + qres.cursor
            result += "\n"
            writeTextResponse(result, self.response)
        else:
            returnJSON(self.response, reviews, qres.cursor, checked)


class GetReviewById(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        review = cached_get(intz(revid), Review)
        if not review:
            self.error(404)
            self.response.write("No Review found for id " + revid)
            return
        returnJSON(self.response, [ review ])


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


class ReviewActivity(webapp2.RequestHandler):
    def get(self):
        since = self.request.get('since')
        cursor = self.request.get('cursor')
        penidstr = self.request.get('penids')
        penids = penidstr.split(',')
        # logging.info("penids: " + str(penids))
        checked, reviews = review_activity_search(since, cursor, penids)
        returnJSON(self.response, reviews, cursor, checked)


class MakeTestReviews(webapp2.RequestHandler):
    def get(self):
        if not self.request.url.startswith('http://localhost'):
            self.error(405)
            self.response.out.write("Test pens are only for local testing")
            return
        count = 0
        while count < 10:
            count += 1
            name = "RevTestPen " + str(count)
            pen = PenName(name=name, name_c=canonize(name))
            pen.shoutout = "MakeTestReviews dummy pen name " + str(count)
            pen.city = "fake city " + str(count)
            pen.accessed = nowISO()
            pen.modified = nowISO()
            pen.revmem = ""
            pen.settings = ""
            pen.following = 0
            pen.followers = 0
            cached_put(pen)
            moviecount = 0
            while moviecount < 4:
                moviecount += 1
                rev = Review(penid=pen.key().id(), revtype="movie")
                rev.rating = 50
                rev.text = "dummy movie review " + str(count) + str(moviecount)
                rev.modified = nowISO()
                rev.title = "movie " + str(count) + str(moviecount)
                rev.cankey = canonize(rev.title)
                cached_put(rev)
        self.response.out.write("Test reviews created")


app = webapp2.WSGIApplication([('/newrev', NewReview),
                               ('/updrev', UpdateReview),
                               ('/delrev', DeleteReview),
                               ('/revpicupload', UploadReviewPic),
                               ('/revpic', GetReviewPic),
                               ('/srchrevs', SearchReviews),
                               ('/revbyid', GetReviewById), 
                               ('/revbykey', GetReviewByKey),
                               ('/revact', ReviewActivity),
                               ('/testrevs', MakeTestReviews)], debug=True)

