import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized


class ReviewComment(db.Model):
    """ A Question or Comment on a particular review """
    revid = db.IntegerProperty(required=True)
    revpenid = db.IntegerProperty()    # reviewer pen name id
    cmtpenid = db.IntegerProperty()    # commenter pen name id
    rctype = db.StringProperty()       # question, comment
    rcstat = db.StringProperty()       # pending, accepted, ignored, rejected
    comment = db.TextProperty()        # the question or comment text
    resp = db.TextProperty()           # response text, rejection reason
    modified = db.StringProperty()     # iso date


def comment_access_authorized_pen(handler, penidparamname):
    acc = authenticated(handler.request)
    if not acc:
        self.error(401)
        self.response.out.write("Authentication failed")
        return False
    penid = intz(handler.request.get(penidparamname))
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
        

def fetch_review_comment_for_update(handler, penidparamname):
    pen = comment_access_authorized_pen(self, penidparamname)
    rcid = self.request.get('_id')
    rc = ReviewComment.get_by_id(intz(rcid))
    if not rc:
        self.error(404)
        self.response.out.write("ReviewComment: " + str(rcid) + " not found")
        return False
    if penidparamname == 'revpenid':
        penid = intz(handler.request.get('revpenid'))
        if penid != rc.revpenid:
            handler.error(401)
            handler.response.out.write("revpenid does not match")
            return False
    elif penidparamname == 'cmtpenid':
        penid = intz(handler.request.get('cmtpenid'))
        if penid != rc.cmtpenid:
            handler.error(401)
            handler.response.out.write("cmtpenid does not match")
            return False
    else: # has to be either reviewer or commenter
        return False
    return rc


# This returns true even if the relationship status is "blocked".  If
# it looks like you are following, then you can see comments.
def is_following(originid, relatedid):
    where = "WHERE originid = :1 AND relatedid = :2 LIMIT 1"
    relq = Relationship.gql(where, originid, penid)
    rels = relq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(rels) > 0:
        return rels[0]
    return False


# authparams, penid
# client filters out anything blocked by follow settings
class FetchInboundPendingComments(webapp2.RequestHandler):
    def get(self):
        pen = comment_access_authorized_pen(self, 'penid')
        if not pen:
            return
        where = "WHERE revpenid = :1 AND rcstat = 'pending'" +\
            " ORDER BY modified DESC"
        rcq = ReviewComment.gql(where, pen.key().id())
        rcs = rcq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        returnJSON(self.response, rcs)


# authparams, penid
class FetchOutboundPendingComments(webapp2.RequestHandler):
    def get(self):
        pen = comment_access_authorized_pen(self, 'penid')
        if not pen:
            return
        where = "WHERE cmtpenid = :1" +\
            " AND (rcstat = 'pending' OR rcstat = 'ignored')" +\
            " ORDER BY modified DESC"
        rcq = ReviewComment.gql(where, pen.key().id())
        rcs = rcq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        for rc in rcs:
            if rc.rcstat == "ignored":
                rc.rcstat = "pending"  # harassment control
        returnJSON(self.response, rcs)


# authparams, revid
# if there is an accepted comment from an abusive penname then UI filters it
class FetchReviewAcceptedComments(webapp2.RequestHandler):
    def get(self):
        # not bothering with authorization, public info
        revid = intz(self.request.get('revid'))
        where = "WHERE revid = :1 AND rcstat = 'accepted'" +\
            " ORDER BY modified DESC"
        rcq = ReviewComment.gql(where, revid)
        rcs = rcq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        returnJSON(self.response, rcs)


# authparams, ReviewComment
# Reviewer can update, but not create or delete.  Once a comment is accepted
# it stays around.  Reviewer cannot arbitrarily remove stuff written by 
# other people. 
class UpdateComment(webapp2.RequestHandler):
    def post(self):
        rc = fetch_review_comment_for_update(self, 'revpenid')
        # revid may not be changed
        # revpenid may not be changed
        # cmtpenid may not be changed
        # rctype may not be changed
        status = self.request.get('rcstat')
        if rc.rcstat == 'accepted' and status != 'accepted':
            self.error(401)
            self.response.out.write("Cannot unaccept a comment")
            return
        updaterev = False
        if rc.rcstat != 'accepted' and status == 'accepted':
            updaterev = True
        rc.rcstat = status
        # comment may not be changed
        rc.resp = self.request.get('resp')
        rc.modified = nowISO()
        rc.put()
        retval = [ rc ]
        if updaterev:
            revid = intz(self.request.get('revid'))
            review = Review.get_by_id(revid)
            if review:
                review.modified = nowISO()
                review.put()
                retval = [ rc, review ]
        returnJSON(self.response, retval)


# authparams, ReviewComment
class CreateComment(webapp2.RequestHandler):
    def post(self):
        rc = ReviewComment(revid = intz(self.request.get('revid')))
        review = Review.get_by_id(rc.revid)
        if not review:
            self.error(404)
            self.response.out.write("Review " + str(rc.revid) + " not found")
            return
        rc.revpenid = review.penid
        rc.cmtpenid = intz(self.request.get('cmtpenid'))
        rc.rctype = self.request.get('rctype')
        if rc.rctype == "question":
            if not is_following(rc.cmtpenid, rc.revpenid):
                self.error(401)
                self.response.out.write("Must be following to question")
                return
            if not is_following(rc.revpenid, rc.cmtpenid):
                self.error(401)
                self.response.out.write("Must be following back to question")
                return
        elif rc.rctype == "comment":
            # query matches rev.py GetReviewByKey. No new indexes...
            where = "WHERE penid = :1 AND revtype = :2 AND cankey = :3" +\
                " ORDER BY modified DESC"
            revq = Review.gql(where, rc.cmtpenid, review.revtype, review.cankey)
            revs = revq.fetch(5, read_policy=db.EVENTUAL_CONSISTENCY, 
                              deadline=10)
            if len(reviews) == 0:
                self.error(401)
                self.response.out.write(
                    "You must have a corresponding review to comment")
                return
        else:
            self.error(401)
            self.response.out.write("rctype must be question or comment")
            return
        where = "WHERE revid = :1 AND revpenid = :2 AND cmtpenid = :3" +\
            " AND (rcstat = 'pending' OR rcstat = 'ignored')"
        rcq = ReviewComment.gql(where, rc.revid, rc.revpenid, rc.cmtpenid)
        rcs = rcq.fetch(5, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(rcs) > 0:
            self.error(401)
            self.response.out.write("New " + rc.rctype + 
                                    " not allowed while previous " + 
                                    rcs[0].rctype + " still pending")
            return
        rc.rcstat = "pending"
        rc.comment = self.request.get('comment')
        rc.resp = ""
        rc.modified = nowISO()
        rc.put()
        returnJSON(self.response, [ rc ])


# authparams, ReviewComment
# Only the commenter may delete what they wrote
class DeleteComment(webapp2.RequestHandler):
    def post(self):
        rc = fetch_review_comment_for_update(self, 'cmtpenid')
        rc.delete()
        returnJSON(self.response, [])


app = webapp2.WSGIApplication([('/pendincmt', FetchInboundPendingComments),
                               ('/pendoutcmt', FetchOutboundPendingComments),
                               ('/revcmt', FetchReviewAcceptedComments),
                               ('/updcmt', UpdateComment),
                               ('/crecmt', CreateComment),
                               ('/delcmt', DeleteComment)], debug=True)

