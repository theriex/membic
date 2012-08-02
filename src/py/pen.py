import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *


def authorized(acc, pen):
    matched = False
    if acc._id == pen.mid or acc._id == pen.gid or \
            acc.id == pen.fbid or acc.id == pen.twid:
        matched = True
    return matched


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
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        where = "WHERE " + self.request.get('am') + "=:1 LIMIT 20"
        pens = PenName.gql(where, acc._id)
        returnJSON(pens, self.response)


class NewPenName(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
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


class UpdatePenName(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
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
        id = self.request.get('_id')
        logging.info("UpdatePenName id: " + id);
        pen = PenName.get_by_id(int(id))
        if not pen:
            self.error(404)
            self.response.out.write("PenName id: " + str(id) + " not found.")
            return
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("You may only update your own pen name.")
            return
        pen.name = name;
        pen.name_c = name_c;
        pen.mid = intz(self.request.get('mid'))
        pen.gid = intz(self.request.get('gid'))
        pen.fbid = intz(self.request.get('fbid'))
        pen.twid = intz(self.request.get('twid'))
        pen.shoutout = self.request.get('shoutout')
        #figure out how to do this
        #pen.profpic = self.request.get('profpic')
        pen.city = self.request.get('city')
        pen.settings = self.request.get('settings')
        pen.accessed = nowISO()
        pen.modified = nowISO()
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("Authorized access reference required.")
            return
        pen.put()
        returnJSON([ pen ], self.response)
        

app = webapp2.WSGIApplication([('/mypens', AuthPenNames),
                               ('/newpen', NewPenName),
                               ('/updpen', UpdatePenName)], debug=True)

