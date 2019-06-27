import webapp2
from google.appengine.ext import db
import logging
import cacheman

class Overflow(db.Model):
    """ MUser/Coop.preb overflow container """
    dbkind = db.StringProperty(required=True)
    dbkeyid = db.IntegerProperty(required=True)
    overcount = db.IntegerProperty(required=True)
    preb = db.TextProperty()


# Called to get an instance while iterating through reviews, so retrieved
# instance is about to be updated.  No sense doing any caching.
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
        morutil.srvObjs(self.response, [ over ])


app = webapp2.WSGIApplication([('.*/ovrfbyid', GetOverflow)], debug=True)

