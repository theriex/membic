import webapp2
from google.appengine.ext import db
from google.appengine.api import images
import logging
from moracct import *

class ConnectionService(db.Model):
    """ Connect a review update to another site """
    # Unique name of this connection service
    name = db.StringProperty(required=True)
    # Canonized name used to avoid duplicates
    name_c = db.StringProperty(required=True)
    # The pen name authorized to update this connection service instance
    authpenid = db.IntegerProperty(required=True)
    # "released" if ready for all users, otherwise only authpenid sees it
    devstatus = db.TextProperty()
    # penid:revtype:cankey is encrypted with this and passed as consvctoken
    tokenpass = db.TextProperty()
    # Brief plain text description of the service
    description = db.TextProperty()
    # Graphic indicator for the service
    icon = db.BlobProperty()
    # Where updated review data should be POSTed. 
    posturl = db.StringProperty()
    # The URL made available for the user to click if the POST failed
    failurl = db.StringProperty()
    # CSV of domains (e.g. www.wherever.ext) this svc can parse into reviews
    domainread = db.StringProperty()
    # Where MyOpenReviews can POST a URL and get back review JSON
    domainparse = db.StringProperty()


class GetConnectionServices(webapp2.RequestHandler):
    def get(self):
        cursor = self.request.get('cursor')
        results = []
        consvcs = ConnectionService.all()
        if cursor:
            consvcs.with_cursor(start_cursor = cursor)
        maxcheck = 20
        checked = 0
        for consvc in consvcs:
            checked += 1
            # filter sensitive fields
            authpenid = 0
            tokenpass = ""
            results.append(consvc)
            if checked >= maxcheck or len(results) >= 20:
                # hit the max, get return cursor for next fetch
                cursor = consvcs.cursor()
                break
        returnJSON(self.response, results, cursor, checked)


app = webapp2.WSGIApplication([('/consvcs', GetConnectionServices)], 
                              debug=True)

