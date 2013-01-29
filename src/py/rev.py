import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
import urllib
from moracct import *
from pen import PenName, authorized
import json
from operator import attrgetter
import re


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
    # CSV of penid:revid pairs for tracking review responses
    sourcerevs = db.TextProperty()
    responserevs = db.TextProperty()
    # CSV of penid:feedid pairs for tracking remembered reviews
    memos = db.TextProperty()
    # Blackboard of connection service processing values in JSON format
    svcdata = db.TextProperty()


def review_modification_authorized(handler):
    """ Return the PenName if the penid matches a pen name the caller is 
        authorized to modify, otherwise return False """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return False
    penid = int(handler.request.get('penid'))
    pen = PenName.get_by_id(penid)
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
    review = Review.get_by_id(int(id))
    if not review:
        handler.error(404)
        handler.response.out.write("Review id: " + str(id) + " not found.")
        return
    penid = int(handler.request.get('penid'))
    if penid != review.penid:
        handler.error(401)
        handler.response.out.write("Review pen does not match")
        return
    return review


def create_cankey_from_request(handler):
    cankey = ""
    revtype = handler.request.get('revtype')
    if revtype == 'book':
        cankey = handler.request.get('title') + handler.request.get('author')
    elif revtype == 'movie':
        cankey = handler.request.get('title')
    elif revtype == 'video':
        cankey = handler.request.get('url')
    elif revtype == 'music':
        cankey = handler.request.get('title') + handler.request.get('artist')
    else:
        cankey = handler.request.get('name')
    cankey = re.sub(r'\s', '', cankey)
    cankey = re.sub(r'\'', '', cankey)
    cankey = re.sub(r'\"', '', cankey)
    cankey = re.sub(r'\,', '', cankey)
    cankey = re.sub(r'\.', '', cankey)
    cankey = re.sub(r'\!', '', cankey)
    cankey = cankey.lower()
    return cankey


def read_review_values(handler, review):
    """ Read the form parameter values into the given review """
    review.penid = int(handler.request.get('penid'))
    review.revtype = handler.request.get('revtype')
    ratingstr = handler.request.get('rating')
    if ratingstr:
        review.rating = int(ratingstr)
    review.keywords = handler.request.get('keywords')
    review.text = handler.request.get('text')
    # review.revpic is uploaded separately
    review.imguri = handler.request.get('imguri')
    review.modified = nowISO()
    review.name = handler.request.get('name')
    review.title = handler.request.get('title')
    review.url = handler.request.get('url')
    review.artist = handler.request.get('artist')
    review.author = handler.request.get('author')
    review.publisher = handler.request.get('publisher')
    review.album = handler.request.get('album')
    review.starring = handler.request.get('starring')
    review.address = handler.request.get('address')
    review.year = handler.request.get('year')
    review.cankey = handler.request.get('cankey')
    if not review.cankey:
        review.cankey = create_cankey_from_request(handler)
    # review.sourcrevs is updated through a specialized call
    # review.responserevs is updated through a specialized call
    # review.memos is updated through a specialized call
    srevidstr = handler.request.get('srevid')
    if srevidstr:
        review.srevid = int(srevidstr)
    # review.svcdata is updated through a specialized call


def update_top20_reviews(pen, review):
    t20dict = {}
    if pen.top20s:
        t20dict = json.loads(pen.top20s)
    t20ids = []
    if review.revtype in t20dict:
        t20ids = t20dict[review.revtype]
    t20revs = [ review ]
    for revid in t20ids:
        resolved = Review.get_by_id(revid)
        # if unresolved reference then just skip it
        if resolved:
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
    pen.put()


def fetch_review_by_cankey(handler):
    penid = int(handler.request.get('penid'))
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


class NewReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:
            return
        review = fetch_review_by_cankey(self)
        if not review:
            penid = int(self.request.get('penid'))
            revtype = self.request.get('revtype')
            review = Review(penid=penid, revtype=revtype)
        read_review_values(self, review)
        review.put()
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
        review.put()
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
        review.delete()
        ## there may be a tombstone reference in the top20s.  That's ok.
        returnJSON(self.response, [])


class UploadReviewPic(webapp2.RequestHandler):
    def post(self):
        if not review_modification_authorized(self):
            return
        review = safe_get_review_for_update(self)
        if not review:
            return
        upfile = self.request.get("picfilein")
        if upfile:
            review.revpic = db.Blob(upfile)
            review.revpic = images.resize(review.revpic, 160, 160)
            review.put()
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.myopenreviews.com#review"
        redurl = urllib.unquote(redurl)
        redurl = str(redurl)
        logging.info("UploadReviewPic redirecting to " + redurl);
        self.redirect(redurl)


class GetReviewPic(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid');
        review = Review.get_by_id(int(revid))
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
        penid = int(self.request.get('penid'))
        mindate = self.request.get('mindate')
        maxdate = self.request.get('maxdate')
        fetchmax = 100
        where = "WHERE penid = :1 AND modified >= :2 AND modified <= :3"\
             + " ORDER BY modified DESC"
        revquery = Review.gql(where, penid, mindate, maxdate)
        cursor = self.request.get('cursor')
        if cursor:
            revquery.with_cursor(start_cursor = cursor)
        cursor = ""
        reviews = revquery.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                                 deadline=10)
        if len(reviews) >= fetchmax:
            cursor = revquery.cursor()
        returnJSON(self.response, reviews, cursor)


class GetReviewById(webapp2.RequestHandler):
    def get(self):
        revid = self.request.get('revid')
        review = Review.get_by_id(int(revid))
        if not review:
            self.error(404)
            self.response.write("No Review found for id " + revid)
            return
        returnJSON(self.response, [ review ])


class ReviewActivity(webapp2.RequestHandler):
    def get(self):
        since = self.request.get('since')
        cursor = self.request.get('cursor')
        penidstr = self.request.get('penids')
        penids = penidstr.split(',')
        logging.info("penids: " + str(penids))
        results = []
        revs = Review.all()
        revs.order('-modified')
        if since:
            revs.filter('modified >', since)
        if cursor:
            revs.with_cursor(start_cursor = cursor)
        maxcheck = 1000
        checked = 0
        cursor = ""
        for rev in revs:
            checked += 1
            if str(rev.penid) in penids:
                results.append(rev)
            if checked >= maxcheck or len(results) >= 20:
                cursor = revs.cursor()
                break
        returnJSON(self.response, results, cursor, checked)


app = webapp2.WSGIApplication([('/newrev', NewReview),
                               ('/updrev', UpdateReview),
                               ('/delrev', DeleteReview),
                               ('/revpicupload', UploadReviewPic),
                               ('/revpic', GetReviewPic),
                               ('/srchrevs', SearchReviews),
                               ('/revbyid', GetReviewById), 
                               ('/revact', ReviewActivity)], debug=True)

