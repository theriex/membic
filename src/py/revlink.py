import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized
from rev import Review
import json


class ReviewLink(db.Model):
    """ Links from a review to other pens. Kind of an interest graph. """
    revid = db.IntegerProperty(required=True)
    revpenid = db.IntegerProperty()
    # CSV of penIds that found this review helpful
    helpful = db.TextProperty()
    # CSV of penIds that remembered this review
    remembered = db.TextProperty()
    # CSV of revId:penId pairs of corresponding reviews
    corresponding = db.TextProperty()
    modified = db.StringProperty()  # iso date


def verify_review_link_revpenid(revlink):
    if not revlink.revpenid:
        review = Review.get_by_id(revlink.revid)
        if not review:
            logging.error("ReviewLink " + str(revlink.key().id()) + " revid " +
                          str(revlink.revid) + " does not exist.")
        else:
            revlink.revpenid = review.penid


def make_review_link(revid):
    revlink = ReviewLink(revid=revid)
    revlink.helpful = ""
    revlink.remembered = ""
    revlink.corresponding = ""
    verify_review_link_revpenid(revlink)
    return revlink


# Return a summary of linkages to reviews written by the given pen id
# within the past 30 days.  This is used for the "influence score"
# indicator next to the profile icon in the nav bar, and the breakdown
# count you see on your own profile display.
class FetchLinkActivity(webapp2.RequestHandler):
    def get(self):
        # not looking up account info since no real authorization needed...
        penid = intz(self.request.get('penid'))
        if not penid:
            self.error(401)
            self.response.out.write("No penid specified")
            return
        # return all the ReviewLink instances, shouldn't be too many
        where = "WHERE revpenid = :1 and modified > :2"
        dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(30))
        rlq = ReviewLink.gql(where, penid, dold)
        rls = rlq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        returnJSON(self.response, rls)


# Find linkages via the review IDs to provide info per review
class FetchReviewLinks(webapp2.RequestHandler):
    def get(self):
        # not looking up account info, nothing really to authorize...
        revidcsv = self.request.get('revids')
        if not revidcsv:
            logging.info("FetchReviewLinks, no revids specified")
            returnJSON(self.response, [])
            return
        revids = [int(n) for n in revidcsv.split(",")]
        where = "WHERE revid IN :1"
        rlq = ReviewLink.gql(where, revids)
        rls = rlq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        returnJSON(self.response, rls)


# This updates corresponding review information.  Helpful and Remember
# data fields are updated from revtag.py
class UpdateReviewLink(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        # always look up by revid. Limits the potential for dupes and
        # helps with consistency if a dupe ever happens
        revid = intz(self.request.get('revid'))
        if not revid:
            self.error(401)
            self.response.out.write("No revid specified")
            return
        rlq = ReviewLink.gql("where revid = :1", revid)
        rls = rlq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(rls) > 0:
            revlink = rls[0]
        else:
            revlink = make_review_link(revid)
        verify_review_link_revpenid(revlink)
        # merge logic is currently client side. Should probably do all kinds
        # of verification here, but trying to save the processing overhead.
        revlink.corresponding = self.request.get('corresponding') or ""
        revlink.modified = nowISO()
        revlink.put()
        returnJSON(self.response, [ revlink ])
        


app = webapp2.WSGIApplication([('/inlinks', FetchLinkActivity),
                               ('/revlinks', FetchReviewLinks),
                               ('/updlink', UpdateReviewLink)], debug=True)


