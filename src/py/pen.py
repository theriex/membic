import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *


class PenName(db.Model):
    """ A review author """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    # one or more id values must be specified
    mid = db.IntegerProperty()
    gid = db.IntegerProperty()
    fbid = db.IntegerProperty()
    twid = db.IntegerProperty()
    # bling field values are nice but not required
    shoutout = db.TextProperty()
    profpic = db.BlobProperty()
    city = db.StringProperty()
    # track last used pen name chosen to select it by default next time
    accessed = db.StringProperty()  # iso date
    modified = db.StringProperty()  # iso date
    # client settings like skin, keyword overrides etc stored as JSON
    settings = db.TextProperty()


class AuthPenNames(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request);
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        where = "WHERE " + self.request.get('am') + "=:1 LIMIT 20"
        pens = PenName.gql(where, acc._id)
        returnJSON(pens, self.response)


class NewPenName(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request);
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        name = self.request.get('name')
        name_c = canonize(name)
        if not name_c:
            self.error(401)
            self.response.out.write("Invalid value for name")
            return
        pens = PenName.gql("WHERE name_c=:1 LIMIT 1", name_c)
        found = pens.count()
        if found:
            self.error(412)
            self.response.out.write("That pen name is already taken")
            return
        pen = PenName(name=name, name_c=name_c)
        setattr(pen, self.request.get('am'), acc._id)
        pen.accessed = nowISO()
        pen.modified = nowISO()
        pen.put()
        returnJSON([ pen ], self.response)
        

app = webapp2.WSGIApplication([('/mypens', AuthPenNames),
                               ('/newpen', NewPenName)], debug=True)

