import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from morutil import *
# from pen import PenName, authorized
# from revlink import ReviewLink, verify_review_link_revpenid, make_review_link
import json
from cacheman import *


class ReviewTag(db.Model):
    """ Markings for a review written by someone else """
    penid = db.IntegerProperty(required=True)
    revid = db.IntegerProperty(required=True)
    converted = db.IntegerProperty()  # temporary data conversion flag
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
    revlink = ReviewLink.get_by_id(rlid)  #intransaction
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
    verify_review_link_revpenid(revlink)
    revlink.modified = nowISO()
    cached_put(revlink)
    cached_put(dbobj)
    return revlink


def note_review_feedback(revid, add, linkfield, linkvalue, dbobj):
    where = "WHERE revid = :1"
    rlq = ReviewLink.gql(where, revid)
    rls = rlq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=5)
    if len(rls) <= 0:
        revlink = make_review_link(revid)
        cached_put(revlink)
        rls = [ revlink ]
    revlink = update_revlink_and_refobj(rls[0].key().id(), add,
                                        linkfield, linkvalue, dbobj)
    return revlink


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
    pen = cached_get(penid, PenName)
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
            returnJSON(handler.response, [])
            return
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
        self.error(403)
        self.ressponse.out.write("NoteHelpful is going away")
        return
        revtag = fetch_or_create_tag(self)
        if not revtag:
            return
        helpful = self.request.get('helpful')
        if helpful == "yes":
            revtag.helpful = nowISO()
            revtag.nothelpful = None
        else:
            revtag.nothelpful = nowISO()
        revlink = note_review_feedback(revtag.revid, helpful, 
                                       "helpful", revtag.penid, revtag)
        returnJSON(self.response, [ revtag, revlink ])


class NoteRemember(webapp2.RequestHandler):
    def post(self):
        self.error(403)
        self.ressponse.out.write("NoteRemember is going away")
        return
        revtag = fetch_or_create_tag(self)
        if not revtag:
            return
        remember = self.request.get('remember')
        if remember == "yes":
            revtag.remembered = nowISO()
            revtag.forgotten = None
        else:
            revtag.forgotten = nowISO()
        revlink = note_review_feedback(revtag.revid, remember, 
                                       "remembered", revtag.penid, revtag)
        returnJSON(self.response, [ revtag, revlink ])


class SearchHelpful(webapp2.RequestHandler):
    def get(self):
        self.error(403)
        self.ressponse.out.write("SearchHelpful is going away")
        return
        tag_search(self, 'helpful', 'nothelpful')


class SearchRemembered(webapp2.RequestHandler):
    def get(self):
        self.error(403)
        self.ressponse.out.write("SearchRemembered is going away")
        return
        tag_search(self, 'remembered', 'forgotten')


app = webapp2.WSGIApplication([('/notehelpful', NoteHelpful),
                               ('/srchhelpful', SearchHelpful),
                               ('/noteremem', NoteRemember),
                               ('/srchremem', SearchRemembered)], debug=True)
