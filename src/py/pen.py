import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
from moracct import *
import urllib
import json
import string
import random


class PenName(db.Model):
    """ A review author """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    # one or more id values must be specified for authorized access
    mid = db.IntegerProperty()
    #Google IDs are too big to fit in an int64
    gsid = db.StringProperty()
    fbid = db.IntegerProperty()
    twid = db.IntegerProperty()
    ghid = db.IntegerProperty()
    # these bling field values are nice but not required
    shoutout = db.TextProperty()
    profpic = db.BlobProperty()
    city = db.StringProperty()
    # track last used pen name chosen to select it by default next time
    accessed = db.StringProperty()  # iso date
    modified = db.StringProperty()  # iso date
    # accumulated top 20 reviews of each type stored as JSON
    top20s = db.TextProperty()
    # remembered or marked reviews stored as JSON
    revmem = db.TextProperty()
    # client settings like skin, keyword overrides etc stored as JSON
    settings = db.TextProperty()
    # counts of inbound and outbound relationships are maintained within
    # the relationship transaction processing
    following = db.IntegerProperty()
    followers = db.IntegerProperty()
    # csv of penids flagged for harassment
    abusive = db.TextProperty()


def authorized(acc, pen):
    matched = False
    if acc._id == pen.mid or acc._id == pen.gsid or \
            acc._id == pen.fbid or acc._id == pen.twid or acc._id == pen.ghid:
        matched = True
    return matched


def has_top_twenty(pen, revtype):
    """ Return true if the given pen has 20 reviews of the given type """
    if not revtype or not pen or not pen.top20s:
        return False
    t20s = json.loads(pen.top20s)
    if not revtype in t20s:
        return False
    if t20s[revtype] and len(t20s[revtype]) >= 20:
        return True
    return False


def set_pen_attrs(pen, request):
    """ Set pen attributes handled the same way for both create and modify """
    pen.mid = intz(request.get('mid'))
    pen.gsid = request.get('gsid') or ""
    pen.fbid = intz(request.get('fbid'))
    pen.twid = intz(request.get('twid'))
    pen.ghid = intz(request.get('ghid'))
    pen.shoutout = request.get('shoutout') or ""
    # pen.profpic is uploaded separately during edit
    pen.city = request.get('city') or ""
    pen.accessed = nowISO()
    pen.modified = nowISO()
    # pen.top20s is maintained separately as part of reviews
    pen.revmem = request.get('revmem') or ""
    pen.settings = request.get('settings') or ""
    pen.abusive = request.get('abusive') or ""
    pen.abusive = str(pen.abusive)


def gen_password():
    """ Return a vaguely reasonable html safe password you can read """
    size = 16
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' + 'abcdefghijkmnopqrstuvwxyz' +\
        string.digits + '!$^.,'
    pwd = "".join(random.choice(chars) for x in range(size))
    return pwd


def native_account_for_pen(request):
    """ Get the authorized pen, then return the native account for it """
    acc = authenticated(request)
    if not acc:
        return None, None
    penid = request.get('penid')
    pen = PenName.get_by_id(intz(penid))
    if not pen:
        return None, None
    authok = authorized(acc, pen)
    if not authok:
        return None, None
    # They are authorized for the given pen.  Good enough to fill out email.
    if pen.mid:
        acc = MORAccount.get_by_id(pen.mid)
    else:
        uname = acc.username
        passw = gen_password()
        acc = MORAccount(username=uname, password=passw)
    return acc, pen


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
        if self.request.get('format') == "record":
            result = ""
            for pen in pens:
                result += "penid: " + str(pen.key().id()) +\
                        ", name: " + pen.name + "\n"
            writeTextResponse(result, self.response)
        else:
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
        set_pen_attrs(pen, self.request)
        setattr(pen, self.request.get('am'), acc._id)
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
        pen = PenName.get_by_id(intz(id))
        if not pen:
            self.error(404)
            self.response.out.write("PenName id: " + str(id) + " not found.")
            return
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("You may only update your own pen name.")
            return
        set_pen_attrs(pen, self.request)
        pen.name = name;
        pen.name_c = name_c;
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
        errmsg = "You are not authorized to update this profile pic"
        acc = authenticated(self.request)
        if acc:
            errmsg = "Could not find pen name for pic attachment"
            profid = self.request.get('_id')
            logging.info("UploadProfPic profid: " + profid)
            pen = PenName.get_by_id(intz(profid))
            if pen:
                errmsg = "You may only update your own pen name"
                authok = authorized(acc, pen)
                if authok:
                    errmsg = "Profile picture file not found"
                    upfile = self.request.get("picfilein")
                    if upfile:
                        errmsg = "Profile picture upload failure"
                        try:
                            pen.profpic = db.Blob(upfile)
                            # change profpic to max 160x160 png...
                            pen.profpic = images.resize(pen.profpic, 160, 160)
                            pen.put()
                            errmsg = ""
                        except Exception as e:
                            errmsg = "Profile picture upload failed: " + str(e)
        redurl = self.request.get('returnto')
        if not redurl:
            logging.info("UploadProfPic using default returnto");
            redurl = "http://www.wdydfun.com#profile"
        redurl = urllib.unquote(redurl)
        redurl = str(redurl)
        if errmsg:
            redurl += "&action=profpicupload&errmsg=" + errmsg
        logging.info("UploadProfPic redirecting to " + redurl);
        self.redirect(redurl)


class GetProfPic(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profileid');
        pen = PenName.get_by_id(intz(profid))
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
        lurkers = self.request.get('lurkers')
        cursor = self.request.get('cursor')
        results = []
        pens = PenName.all()
        pens.order('-modified')
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
            # test not self
            if matched and (acc._id == pen.mid or      #int comparison
                            acc._id == pen.fbid or     #int comparison
                            acc._id == pen.twid or     #int comparison
                            acc._id == pen.ghid or     #int comparison
                            acc._id == pen.gsid):      #string comparison
                matched = False
            # test recent access constraint
            if matched and time and pen.accessed < time:
                matched = False
            # test they have reviewed something if lurkers not desired
            if matched and not lurkers and not pen.top20s:
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
            # filter sensitive fields
            if matched:
                pen.mid = 0
                pen.gsid = "0"
                pen.fbid = 0
                pen.twid = 0
                pen.ghid = 0
                pen.abusive = ""
                results.append(pen)
            if checked >= maxcheck or len(results) >= 20:
                # hit the max, get return cursor for next fetch
                cursor = pens.cursor()
                break
        returnJSON(self.response, results, cursor, checked)


class GetPenById(webapp2.RequestHandler):
    def get(self):
        penidstr = self.request.get('penid')
        penid = intz(penidstr)
        if penid <= 0:
            self.error(400)
            self.response.write("Invalid ID for Pen Name: " + penidstr)
            return
        pen = PenName.get_by_id(intz(penid))
        if not pen:
            self.error(404)
            self.response.write("No Pen Name found for id " + str(penid))
            return
        # filter sensitive fields
        pen.mid = 0
        pen.gsid = "0"
        pen.fbid = 0
        pen.twid = 0
        pen.ghid = 0
        pen.abusive = ""
        returnJSON(self.response, [ pen ])


class GetInfoForAccount(webapp2.RequestHandler):
    def get(self):
        acc, pen = native_account_for_pen(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authorization failed")
            return
        jsontxt = "{"
        jsontxt += "\"hasEmail\":"
        if acc.email:
            jsontxt += "true"
        else:
            jsontxt += "false"
        jsontxt += "}"
        jsontxt = "[" + jsontxt + "]"
        writeJSONResponse(jsontxt, self.response)


class SetEmailFromPen(webapp2.RequestHandler):
    def post(self):
        acc, pen = native_account_for_pen(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authorization failed")
            return
        if acc.email:
            self.error(409)  #Conflict
            self.response.out.write("Existing email cannot be overwritten")
            return
        emaddr = self.request.get('email')
        if not emaddr:
            self.error(401)
            self.response.out.write("No email address specified")
            return
        acc.email = emaddr
        # if the generated account username already exists, or something
        # else goes wrong transactionally then this could fail.  Unlikely
        # and not automatically recoverable so just error out.
        try:
            acc.put()
            pen.mid = acc.key().id()
            pen.modified = nowISO()
            pen.accessed = nowISO()
            pen.put()
            returnJSON(self.response, [ pen ])
        except Exception as e:
            self.error(409)  #Conflict
            self.response.out.write("Update conflict: " + str(e))
            return


class PenAccessed(webapp2.RequestHandler):
    """ Note the given pen name was accessed. """
    def post(self):
        # Do NOT update any other fields here (race conditions)
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        penid = self.request.get('penid')
        try:
            pen = PenName.get_by_id(intz(penid))
        except Exception as e:
            self.error(400)
            self.response.out.write("Bad penid " + str(penid) + ". " + str(e))
            return
        if not pen:
            self.error(404)
            self.response.out.write("PenName id: " + str(id) + " not found.")
            return
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("You may only update your own pen name.")
            return
        pen.accessed = nowISO()
        try:
            pen.put()
        except Exception as e2:
            self.error(412)  #precondition failed
            self.response.out.write("Update failed: " + str(e2))
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
            pen.revmem = ""
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
                               ('/acctinfo', GetInfoForAccount),
                               ('/penmail', SetEmailFromPen),
                               ('/penacc', PenAccessed),
                               ('/testpens', MakeTestPens)], debug=True)

