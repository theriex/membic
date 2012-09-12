import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
import urllib
from moracct import *
from pen import PenName, authorized


class Review(db.Model):
    """ A review of something """
    penid = db.IntegerProperty(required=True)
    revtype = db.StringProperty(required=True)
    rating = db.IntegerProperty()
    keywords = db.TextProperty()
    text = db.TextProperty()
    revpic = db.BlobProperty()
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
    # The id of the source review (if any) that triggered this review
    srevid = db.IntegerProperty()
    # Blackboard of service agent processing values in url parameter
    # format (e.g. attr1=val1&attr2=val2...) used for tracking import
    # and export status, suggestion frequency and whatever
    svcdata = db.TextProperty()


def review_modification_authorized(handler):
    """ Return true if the penid matches a pen name the caller is 
        authorized to modify. """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return False
    penid = int(handler.request.get('penid'))
    pen = PenName.get_by_id(penid)
    if not pen:
        handler.error(404)
        hanlder.response.out.write("Pen " + str(penid) + " not found.")
        return False
    authok = authorized(acc, pen)
    if not authok:
        handler.error(401)
        handler.response.out.write("Pen name not authorized.")
        return False
    return True


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
    srevidstr = handler.request.get('srevid')
    if srevidstr:
        review.srevid = int(srevidstr)
    review.svcdata = handler.request.get('svcdata')


class NewReview(webapp2.RequestHandler):
    def post(self):
        if not review_modification_authorized(self):
            return
        penid = int(self.request.get('penid'))
        revtype = self.request.get('revtype')
        review = Review(penid=penid, revtype=revtype)
        read_review_values(self, review)
        review.put()
        returnJSON(self.response, [ review ])


class UpdateReview(webapp2.RequestHandler):
    def post(self):
        if not review_modification_authorized(self):
            return
        review = safe_get_review_for_update(self)
        if not review:
            return
        read_review_values(self, review)
        review.put()
        returnJSON(self.response, [ review ])


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
            cursor = reviews.cursor()
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


app = webapp2.WSGIApplication([('/newrev', NewReview),
                               ('/updrev', UpdateReview),
                               ('/revpicupload', UploadReviewPic),
                               ('/revpic', GetReviewPic),
                               ('/srchrevs', SearchReviews),
                               ('/revbyid', GetReviewById)], debug=True)

