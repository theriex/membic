import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *


class Request(db.Model):
    """ A request from one pen name to another pen name """
    fromid = db.IntegerProperty(required=True)
    toid = db.IntegerProperty(required=True)
    qtype = db.StringProperty()     # review, share ...
    revtype = db.StringProperty()   # book, movie ...
    keywords = db.StringProperty()  # csv of match keywords for revtype
    modified = db.StringProperty()  # iso date
    status = db.StringProperty()    # open, withdrawn, denied, fulfilled


def find_requests(toid, fromid):
    dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(30))
    matchqual = " and status = 'open' and modified > '" + dold + "'"
    # logging.info("matchqual: " + matchqual)
    if toid > 0:
        where = "WHERE toid = :1" + matchqual
        qry = Request.gql(where, toid)
    elif fromid > 0:
        where = "WHERE fromid = :1" + matchqual
        qry = Request.gql(where, fromid)
    reqs = qry.fetch(100, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    return reqs


class UpdateRequest(webapp2.RequestHandler):
    def post(self):
        toid = intz(self.request.get('toid'))
        fromid = intz(self.request.get('fromid'))
        if not toid or not fromid:
            self.error(412)
            self.response.out.write("Both toid and fromid are required")
            return
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        reqid = self.request.get('_id')
        req = None
        if reqid:
            req = Request.get_by_id(intz(reqid))
            if not req or req.fromid != fromid or req.toid != toid:
                self.error(404)
                self.response.out.write("Request " + reqid + " not found.")
                return
        if not req:
            req = Request(fromid=fromid, toid=toid)
            req.status = 'open'
        else:
            req.status = self.request.get('status')
        req.qtype = self.request.get('qtype')
        req.revtype = self.request.get('revtype')
        req.keywords = self.request.get('keywords')
        req.modified = nowISO()
        req.put()
        returnJSON(self.response, [ req ])


class FindRequests(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        toid = intz(self.request.get('toid'))
        fromid = intz(self.request.get('fromid'))
        reqs = find_requests(toid, fromid)
        returnJSON(self.response, reqs)
    

app = webapp2.WSGIApplication([('/updreq', UpdateRequest),
                               ('/findreqs', FindRequests)], debug=True)

