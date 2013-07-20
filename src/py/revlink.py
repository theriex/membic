import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized
import json


class ReviewLink(db.Model):
    """ Links from a review to other pens. Kind of an interest graph. """
    revid = db.IntegerProperty(required=True)
    # CSV of some penIds that found this review helpful
    helpful = db.TextProperty()
    # CSV of some penIds that remembered this review
    remembered = db.TextProperty()
    # CSV of revId:penId pairs of corresponding reviews
    corresponding = db.TextProperty()



def set_revlink_attrs(revlink, request):
    """ Set the ReviewLink attributes from the given request """
    revlink.revid = intz(request.get('revid'))
    revlink.helpful = request.get('helpful') or ""
    revlink.remembered = request.get('remembered') or ""
    revlink.corresponding = request.get('corresponding') or ""



class FetchReviewLinks(webapp2.RequestHandler):
    def get(self):
        # doesn't seem worth looking up the account for now
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
            revlink = ReviewLink(revid=revid)
        set_revlink_attrs(revlink, self.request)
        revlink.put()
        returnJSON(self.response, [ revlink ])
        


app = webapp2.WSGIApplication([('/revlinks', FetchReviewLinks),
                               ('/updlink', UpdateReviewLink)], debug=True)


