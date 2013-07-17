import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized
from revlink import ReviewLink
import json


class ReviewTag(db.Model):
    """ Markings for a review written by someone else """
    penid = db.IntegerProperty(required=True)
    revid = db.IntegerProperty(required=True)
    remembered = db.StringProperty()  # iso date when "remember" toggled on
    forgotten = db.StringProperty()  # iso date when "remember" toggled off
    helpful = db.StringProperty()  # iso date when "helpful" toggled on
    nothelpful = db.StringProperty()  # iso date when "helpful" toggled off


# https://developers.google.com/appengine/docs/python/datastore/functions
# says @db.transactional is equivalent to run_in_transaction, which
# will retry up to 3x on commit failure.  So a failure in this case
# should be unusual and goes all the way back to the client as an error.
@db.transactional(xg=True)
def update_revlink_and_refobj(rlid, add, linkfield, linkvalue, dbobj):
    linkvalue = str(linkvalue)
    revlink = ReviewLink.get_by_id(rlid)
    arr = getattr(revlink, linkfield)
    if arr:
        arr = arr.split(',')
    else:
        arr = []
    arr = [x for x in arr if x != linkvalue]     # remove if existing
    if add == "yes":
        arr.insert(0, linkvalue)                 # prepend update value
    arr = ",".join(arr)
    setattr(revlink, linkfield, arr)
    revlink.put()
    dbobj.put()


def note_review_feedback(revid, add, linkfield, linkvalue, dbobj):
    where = "WHERE revid = :1"
    rlq = ReviewLink.gql(where, revid)
    rls = rlq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=5)
    if len(rls) <= 0:
        revlink = ReviewLink(revid=revid)
        revlink.put()
        rls = [ revlink ]
    update_revlink_and_refobj(rls[0].key().id(), add,
                              linkfield, linkvalue, dbobj)


def fetch_or_create_tag_authorized(penid, revid):
    where = "WHERE penid = :1 AND revid = :2"
    rtquery = ReviewTag.gql(where, penid, revid)
    rts = rtquery.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(rts) > 0:
        return rts[0]
    rt = ReviewTag(penid=penid, revid=revid)
    rt.remembered = None
    rt.forgotten = None
    rt.helpful = None
    rt.nothelpful = None
    return rt


def fetch_or_create_tag(handler):
    """ Provide an existing or new ReviewTag to the authorized caller """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return None
    penid = intz(handler.request.get('penid'))
    pen = PenName.get_by_id(penid)
    if not pen:
        handler.error(404)
        handler.response.out.write("Pen " + str(penid) + " not found.")
        return None
    authok = authorized(acc, pen)
    if not authok:
        handler.error(401)
        handler.response.out.write("Not authorized to modify pen " + str(penid))
        return None
    # Could check to ensure we are not fetching ReviewTag for a review 
    # written by the same penid, but liking or remembering your own review
    # doesn't really do any harm, it just looks stupid.  Not worth the fetch.
    revid = intz(handler.request.get('revid'))
    return fetch_or_create_tag_authorized(penid, revid)


def tag_search_by_id(handler, posfield, negfield, matchfield, matchval):
    retmax = 200
    penids = []
    where = "WHERE " + matchfield + " = :1"
    where += " AND " + posfield + " > '2012-10-04T00:00:00Z'"
    where += " AND " + negfield + " = null"
    if matchfield == "revid":
        penids = handler.request.get('penids')
        if not penids:
            return JSON(handler.response, [])
        penids = penids.split(",")
        where += " AND penid IN :2"
    where += " ORDER BY " + posfield + " DESC"
    logging.info("tag_search_by_id " + where)
    if matchfield == "revid":
        rtquery = ReviewTag.gql(where, matchval, penids)
    else:
        rtquery = ReviewTag.gql(where, matchval)
    revtags = rtquery.fetch(retmax, read_policy=db.EVENTUAL_CONSISTENCY,
                            deadline=10)
    returnJSON(handler.response, revtags)


def tag_search(handler, posfield, negfield):
    """ Search by penid or revid for posfield, most recent first """
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return
    penid = intz(handler.request.get('penid'))
    revid = intz(handler.request.get('revid'))
    if penid:
        tag_search_by_id(handler, posfield, negfield, 'penid', penid)
    else:
        tag_search_by_id(handler, posfield, negfield, 'revid', revid)


class NoteHelpful(webapp2.RequestHandler):
    def post(self):
        revtag = fetch_or_create_tag(self)
        if not revtag:
            return
        helpful = self.request.get('helpful')
        if helpful == "yes":
            revtag.helpful = nowISO()
            revtag.nothelpful = None
        else:
            revtag.nothelpful = nowISO()
        note_review_feedback(revtag.revid, helpful, 
                             "helpful", revtag.penid, revtag)
        returnJSON(self.response, [ revtag ])


class NoteRemember(webapp2.RequestHandler):
    def post(self):
        revtag = fetch_or_create_tag(self)
        if not revtag:
            return
        remember = self.request.get('remember')
        if remember == "yes":
            revtag.remembered = nowISO()
            revtag.forgotten = None
        else:
            revtag.forgotten = nowISO()
        note_review_feedback(revtag.revid, remember, 
                             "remembered", revtag.penid, revtag)
        returnJSON(self.response, [ revtag ])


class SearchHelpful(webapp2.RequestHandler):
    def get(self):
        tag_search(self, 'helpful', 'nothelpful')


class SearchRemembered(webapp2.RequestHandler):
    def get(self):
        tag_search(self, 'remembered', 'forgotten')


class ConvertPenRemember(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write("Pen names with remember data:\n")
        pens = PenName.all()
        for pen in pens:
            if pen.revmem:
                penid = pen.key().id()
                statline = str(penid) + " " + pen.name + ": " + pen.revmem
                self.response.out.write(statline)
                remobj = json.loads(pen.revmem)
                if "remembered" in remobj:
                    for revid in remobj["remembered"]:
                        revid = int(revid)
                        revtag = fetch_or_create_tag_authorized(penid, revid)
                        revtag.remembered = nowISO()
                        revtag.forgotten = None
                        revtag.put()
                        self.response.out.write("\n    " + str(revid))
                    


app = webapp2.WSGIApplication([('/notehelpful', NoteHelpful),
                               ('/srchhelpful', SearchHelpful),
                               ('/noteremem', NoteRemember),
                               ('/srchremem', SearchRemembered)], debug=True)
