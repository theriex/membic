import webapp2
from google.appengine.ext import db
import logging
from cacheman import *
import morutil

class Overflow(db.Model):
    """ MUser/Coop.preb overflow container """
    dbkind = db.StringProperty(required=True)
    dbkeyid = db.IntegerProperty(required=True)
    overcount = db.IntegerProperty(required=True)
    preb = db.TextProperty()


# Called to get an instance while iterating through reviews.  Since the
# retrieved instance is about to be updated, there is no sense doing any
# caching.  Amazingly, this type of query falls under access that Datastore
# automatically builds indexes for, so there is no need to declare this in
# index.yaml.  If there was an ORDER BY added then it would not work.
def get_overflow(kind, instid, count):
    where = "WHERE dbkind = :1 AND dbkeyid = :2 and overcount = :3"
    vq = VizQuery(Overflow, where, kind, instid, count)
    overs = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
    if len(overs) > 0:
        return overs[0]
    overflow = Overflow(dbkind=kind, dbkeyid=instid, overcount=count)
    overflow.put()
    return overflow


class GetOverflow(webapp2.RequestHandler):
    def get(self):
        overid = self.request.get('overid')
        over = cached_get(intz(overid), Overflow)
        morutil.srvObjs(self, [ over ])


app = webapp2.WSGIApplication([('.*/ovrfbyid', GetOverflow)], debug=True)

