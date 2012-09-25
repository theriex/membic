import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
from moracct import *
import urllib
import json


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
    # one or more id values must be specified for authorized access
    mid = db.IntegerProperty()
    gid = db.IntegerProperty()
    fbid = db.IntegerProperty()
    twid = db.IntegerProperty()
    # these bling field values are nice but not required
    shoutout = db.TextProperty()
    profpic = db.BlobProperty()
    city = db.StringProperty()
    # track last used pen name chosen to select it by default next time
    accessed = db.StringProperty()  # iso date
    modified = db.StringProperty()  # iso date
    # accumulated top 20 reviews of each type stored as JSON
    top20s = db.TextProperty()
    # client settings like skin, keyword overrides etc stored as JSON
    settings = db.TextProperty()
    # counts of inbound and outbound relationships are maintained within
    # the relationship transaction processing
    following = db.IntegerProperty()
    followers = db.IntegerProperty()


def has_top_twenty(pen, revtype):
    """ Return true if the given pen has 20 reviews of the given type """
    if not revtype or not pen or not pen.top20s:
        return False
    t20s = json.loads(pen.top20s)
    for t20list in t20s:
        if t20list.revtype and len(t20list.revtype) >= 20:
            return True
    return False
            

class AuthPenNames(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            # Eventual consistency means it is possible to create a new
            # account but not have it available for authorization yet.
            # Other than that, the most common case is that a token has
            # expired, in which case a 401 error is exactly appropriate.
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        where = "WHERE " + self.request.get('am') + "=:1 LIMIT 20"
        pens = PenName.gql(where, acc._id)
        returnJSON(self.response, pens)


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
        pen.shoutout = ""
        # pen.profpic is uploaded separately during edit
        pen.city = ""
        pen.accessed = nowISO()
        pen.modified = nowISO()
        # pen.top20s is maintained separately as part of reviews
        pen.settings = self.request.get('settings')
        pen.following = 0
        pen.followers = 0
        pen.put()
        returnJSON(self.response, [ pen ])


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
        logging.info("UpdatePenName id: " + id)
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
        # pen.profpic is uploaded separately
        pen.city = self.request.get('city')
        pen.accessed = nowISO()
        pen.modified = nowISO()
        # pen.top20s is maintained separately as part of reviews
        pen.settings = self.request.get('settings')
        # pen.following is NOT modified here.  Don't collide with rel trans
        # pen.followers ditto
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("Authorized access reference required.")
            return
        pen.put()
        returnJSON(self.response, [ pen ])
        

class UploadProfPic(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        profid = self.request.get('_id')
        logging.info("UploadProfPic id: " + profid)
        pen = PenName.get_by_id(int(profid))
        if not pen:
            self.error(404)
            self.response.write("PenName: " + str(profid) + " not found.")
            return
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.write("You may only update your own pen name.")
            return
        upfile = self.request.get("picfilein")
        if upfile:
            pen.profpic = db.Blob(upfile)
            # change profpic to a 160x160 png...
            pen.profpic = images.resize(pen.profpic, 160, 160)
            pen.put()
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.myopenreviews.com#profile"
        redurl = urllib.unquote(redurl)
        redurl = str(redurl)
        logging.info("UploadProfPic redirecting to " + redurl);
        self.redirect(redurl)


class GetProfPic(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profileid');
        pen = PenName.get_by_id(int(profid))
        havepic = pen and pen.profpic
        if not havepic:
            self.error(404)
            self.response.write("Profile pic for PenName: " + str(profid) + 
                                " not found.")
            return
        img = images.Image(pen.profpic)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class SearchPenNames(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        qstr = self.request.get('qstr')
        qstr_c = canonize(qstr)
        time = self.request.get('time')
        t20 = self.request.get('t20')
        cursor = self.request.get('cursor')
        results = []
        pens = PenName.all()
        if cursor:
            pens.with_cursor(start_cursor = cursor)
        maxcheck = 1000
        checked = 0
        cursor = ""
        for pen in pens:
            checked += 1
            matched = False
            # test string match
            if not qstr or not qstr_c or \
                    qstr_c in pen.name_c or \
                    (pen.shoutout and qstr in pen.shoutout) or \
                    (pen.city and qstr_c in pen.city.lower()):
                matched = True
            # test recent access constraint
            if matched and time and pen.accessed < time:
                matched = False
            # test required top 20 review types
            if matched and t20 and not pen.top20s:
                matched = False
            if matched and t20:
                t20s = t20.split(',')
                for value in t20s:
                    if not has_top_twenty(pen, value):
                        matched = False
                        break
            # test not self
            if matched and (acc._id == pen.mid or
                            acc._id == pen.fbid or
                            acc._id == pen.twid or
                            acc._id == pen.gid):
                matched = False
            if matched:
                # filter sensitive fields
                pen.mid = 0;
                pen.gid = 0;
                pen.fbid = 0;
                pen.twid = 0;
                results.append(pen)
            if checked >= maxcheck or len(results) >= 20:
                # hit the max, get return cursor for next fetch
                cursor = pens.cursor()
                break
        returnJSON(self.response, results, cursor, checked)


class GetPenById(webapp2.RequestHandler):
    def get(self):
        penidstr = self.request.get('penid')
        penid = int(penidstr)
        if penid <= 0:
            self.error(400)
            self.response.write("Invalid ID for Pen Name: " + penidstr)
            return
        pen = PenName.get_by_id(int(penid))
        if not pen:
            self.error(404)
            self.response.write("No Pen Name found for id " + penid)
            return
        returnJSON(self.response, [ pen ])


class MakeTestPens(webapp2.RequestHandler):
    def get(self):
        if not self.request.url.startswith('http://localhost'):
            self.error(405)
            self.response.out.write("Test pens are only for local testing")
            return
        count = 0
        while count < 1600:
            count += 1
            name = "Test Pen Name " + str(count)
            logging.info("Creating " + name)
            pen = PenName(name=name, name_c=canonize(name))
            pen.shoutout = "Batch created dummy pen name " + str(count)
            pen.city = "fake city " + str(count)
            pen.accessed = nowISO()
            pen.modified = nowISO()
            pen.settings = ""
            pen.following = 0
            pen.followers = 0
            pen.put()
        self.response.out.write("Test pen names created")


app = webapp2.WSGIApplication([('/mypens', AuthPenNames),
                               ('/newpen', NewPenName),
                               ('/updpen', UpdatePenName),
                               ('/profpicupload', UploadProfPic),
                               ('/profpic', GetProfPic),
                               ('/srchpens', SearchPenNames),
                               ('/penbyid', GetPenById),
                               ('/testpens', MakeTestPens)], debug=True)

