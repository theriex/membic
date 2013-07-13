import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized

class ReviewTag(db.Model):
    """ Markings for a review written by someone else """
    penid = db.IntegerProperty(required=True)
    revid = db.IntegerProperty(required=True)
    remembered = db.StringProperty()  # iso date when "remember" toggled on
    forgotten = db.StringProperty()  # iso date when "remember" toggled off
    helpful = db.StringProperty()  # iso date when "helpful" toggled on
    nothelpful = db.StringProperty()  # iso date when "helpful" toggled off


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
        revtag.put()
        returnJSON(self.response, [ revtag ])


class NoteRemember(webapp2.RequestHandler):
    def post(self):
        revtag = fetch_or_create_tag(self)
        if not revtag:
            return
        remember = self.request.get('remember')
        if remember == "yes":
            revtag.remember = nowISO()
            revtag.forget = None
        else:
            revtag.forget = nowISO()
        revtag.put()
        returnJSON(self.response, [ revtag ])


class SearchHelpful(webapp2.RequestHandler):
    def get(self):
        tag_search(self, 'helpful', 'nothelpful')


class SearchRemembered(webapp2.RequestHandler):
    def get(self):
        tag_search(self, 'remembered', 'forgotten')


app = webapp2.WSGIApplication([('/notehelpful', NoteHelpful),
                               ('/srchhelpful', SearchHelpful),
                               ('/noteremem', NoteRemember),
                               ('/srchremem', SearchRemembered)], debug=True)
