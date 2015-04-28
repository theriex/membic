import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
from moracct import *
from morutil import *
import urllib
import json
import string
import random
from cacheman import *
import group


class PenName(db.Model):
    """ A review author """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    # one or more id values must be specified for authorized access
    mid = db.IntegerProperty()
    gsid = db.StringProperty()      # Google IDs are too big to fit in an int64
    fbid = db.IntegerProperty()
    twid = db.IntegerProperty()
    ghid = db.IntegerProperty()
    # detail fields
    shoutout = db.TextProperty()
    profpic = db.BlobProperty()
    city = db.StringProperty(indexed=False)
    accessed = db.StringProperty()  # ISO date when last logged in
    modified = db.StringProperty()  # ISO date when last changed
    remembered = db.TextProperty()  # CSV of revids for reference
    top20s = db.TextProperty()      # accumulated top 20 reviews of each type
    stash = db.TextProperty()       # precomputed vals, breadcrumbs and such
    settings = db.TextProperty()    # client skin, keyword overrides etc
    preferred = db.TextProperty()   # CSV of penids given priority
    background = db.TextProperty()  # CSV of penids with reduced priority
    blocked = db.TextProperty()     # CSV of penids to be avoided
    abusive = db.TextProperty()     # penids flagged for harassment (old)
    groups = db.TextProperty()      # groupids this pen is following
    # counts of inbound and outbound relationships are maintained within
    # the relationship transaction processing.  These are going away
    following = db.IntegerProperty()
    followers = db.IntegerProperty()


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
    pen.groups = request.get('groups') or ""
    pen.stash = request.get('stash') or ""
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
    if not acc:  # authentication failed
        return None, None
    # If 3rd party auth, acc is a newly minted account instance with the
    # id filled out to a temporary value. 
    penid = request.get('penid')
    pen = cached_get(intz(penid), PenName)
    if not pen:
        return None, None
    authok = authorized(acc, pen)
    if not authok:
        return None, None
    acc._id = None  # reset to differentiate between new and existing instance
    # They are authorized for the given pen.  Good enough to fill out email.
    if pen.mid:
        acc = MORAccount.get_by_id(pen.mid)  #nocache
    else:
        where = "WHERE authsrc=:1 LIMIT 1"
        accounts = MORAccount.gql(where, acc.authsrc)
        found = accounts.count()
        if found:
            acc = accounts[0]
    return acc, pen


def matched_pen(acc, pen, qstr_c, time, t20, lurkers):
    matched = False
    # test string match
    if not qstr_c or \
            qstr_c in pen.name_c or \
            (pen.shoutout and qstr in pen.shoutout) or \
            (pen.city and qstr_c in pen.city.lower()):
        matched = True
    # test not self
    if matched and acc and (acc._id == pen.mid or      #int compare
                            acc._id == pen.fbid or     #int compare
                            acc._id == pen.twid or     #int compare
                            acc._id == pen.ghid or     #int compare
                            acc._id == pen.gsid):      #string compare
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
    return matched


def updateable_pen(handler):
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)  # unauthorized
        handler.response.out.write("Authentication failed")
        return False
    penid = intz(handler.request.get('_id'))
    if not penid:
        penid = intz(handler.request.get('penid'))
    pen = cached_get(penid, PenName)
    if not pen:
        handler.error(404)  # not found
        handler.response.out.write("PenName id: " + str(penid) + " not found.")
        return False
    authok = authorized(acc, pen)
    if not authok:
        handler.error(403)  # forbidden
        handler.response.out.write("Not your Pen Name.")
        return False
    return pen


def fetch_pen_by_penid(handler):
    penidstr = handler.request.get('penid')
    penid = intz(penidstr)
    if penid <= 0:
        handler.error(400)
        handler.response.write("Invalid ID for Pen Name: " + penidstr)
        return
    pen = cached_get(intz(penid), PenName)
    if not pen:
        handler.error(404)
        handler.response.write("No Pen Name found for id " + str(penid))
        return
    # filter sensitive fields
    pen.mid = 0
    pen.gsid = "0"
    pen.fbid = 0
    pen.twid = 0
    pen.ghid = 0
    pen.abusive = ""
    return pen


def find_auth_pens(handler):
    # logging.info("pen.py AuthPenNames start...")
    acc = authenticated(handler.request)
    # logging.info("pen.py AuthPenNames acc: " + str(acc))
    if not acc:
        # Eventual consistency means it is possible to create a new
        # account but not have it available for authorization yet.
        # Other than that, the most common case is that a token has
        # expired, in which case a 401 error is exactly appropriate.
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return
    where = "WHERE " + handler.request.get('am') + "=:1 LIMIT 20"
    # logging.info("pen.py AuthPenNames " + where)
    pq = PenName.gql(where, acc._id)
    pens = pq.fetch(10, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    return pens


class AuthPenNames(webapp2.RequestHandler):
    def get(self):
        find_auth_pens(self)
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
        cached_put(pen)
        returnJSON(self.response, [ pen ])


class UpdatePenName(webapp2.RequestHandler):
    def post(self):
        pen = updateable_pen(self)
        if not pen:
            return
        name = self.request.get('name')
        name_c = canonize(name)
        if not name_c:
            self.error(401)
            self.response.out.write("Invalid value for name")
            return
        logging.info("UpdatePenName id: " + str(pen.key().id()))
        set_pen_attrs(pen, self.request)
        pen.name = name;
        pen.name_c = name_c;
        # pen.following is NOT modified here.  Don't collide with rel trans
        # pen.followers ditto
        # possible authorization was changed in the params
        acc = authenticated(self.request)
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("Authorized access reference required.")
            return
        cached_put(pen)
        returnJSON(self.response, [ pen ])
        

class UploadPic(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write('Ready')
    def post(self):
        pen = updateable_pen(self)
        if not pen:
            return
        updobj = pen
        picfor = self.request.get('picfor')
        if picfor == "group":
            grp, role = group.fetch_group_and_role(self, pen)
            if not grp:
                return
            if not role or role != "Founder":
                self.error(403)  #forbidden
                self.response.out.write("Only founders may upload a group pic")
                return
            updobj = grp
        upfile = self.request.get("picfilein")
        if not upfile:
            self.error(400)  # bad request
            self.response.out.write("No picture file received")
            return
        try:
            # resize images to max 160 x 160 px
            if picfor == "group":
                grp.picture = db.Blob(upfile)
                grp.picture = images.resize(pen.profpic, 160, 160)
                grp.modified = nowISO()
                cached_put(grp)
            else:
                pen.profpic = db.Blob(upfile)
                pen.profpic = images.resize(pen.profpic, 160, 160)
                pen.modified = nowISO()
                cached_put(pen)
        except Exception as e:
            self.error(500)
            self.response.out.write("Profile picture upload failed: " + str(e))
            return
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("Done: " + pen.modified)


class GetProfPic(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profileid')
        pen = cached_get(intz(profid), PenName)
        havepic = pen and pen.profpic
        if not havepic:
            self.error(404)
            self.response.out.write("Profile pic for PenName: " + str(profid) + 
                                    " not found.")
            return
        img = images.Image(pen.profpic)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class ToggleRemember(webapp2.RequestHandler):
    def get(self):
        pen = updateable_pen(self)
        if not pen:
            return
        revid = self.request.get('revid')
        if not revid:
            self.error(401)
            self.response.out.write("Review: " + revid + " not found.")
            return
        if csv_contains(revid, pen.remembered):
            pen.remembered = remove_from_csv(revid, pen.remembered)
        else:
            pen.remembered = prepend_to_csv(revid, pen.remembered)
            try:
                review = cached_get(int(revid), Review)
                penid = str(pen.key().id())
                if not csv_contains(penid, review.remembered):
                    review.remembered = prepend_to_csv(penid, review.remembered)
                    cached_put(review)
            except Exception as e:
                logging.info("Failed remembered backlink from Review " + revid +
                             " to PenName " + str(pen.key().id()))
        cached_put(pen)
        returnJSON(self.response, [ pen ])


class SearchPenNames(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        qstr = self.request.get('qstr')
        qstr_c = "" or canonize(qstr)
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
            if matched_pen(acc, pen, qstr_c, time, t20, lurkers):
                # filter sensitive fields
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
        pen = fetch_pen_by_penid(self)
        if not pen:
            return
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
            self.response.out.write("Existing email may not be overwritten")
            # edit the native account and set the email there, this is only
            # for filling out email where there wasn't any previously
            return
        emaddr = self.request.get('email')
        if not emaddr:
            self.error(401)
            self.response.out.write("No email address specified")
            return
        acc.email = normalize_email(emaddr)
        if not valid_new_email_address(self, emaddr):
            # error 422
            return;
        try:  # just in case anything goes wrong in the transaction
            acc.password = gen_password()  # replace previous token value
            acc.put()  #nocache
            pen.mid = acc.key().id()
            pen.modified = nowISO()
            pen.accessed = nowISO()
            cached_put(pen)
            returnJSON(self.response, [ pen ])
        except Exception as e:
            self.error(409)  #Conflict
            self.response.out.write("Update conflict: " + str(e) + 
                                    "\nPlease contact support." +
                                    "\naccount: " + str(acc._id) +
                                    "\npen: " + str(pen.key().id()))
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
            pen = cached_get(intz(penid), PenName)
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
            cached_put(pen)
        except Exception as e2:
            self.error(412)  #precondition failed
            self.response.out.write("Update failed: " + str(e2))
            return
        returnJSON(self.response, [ pen ])
            

class WalkPens(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        # pens = PenName.all()
        # pens.order('-modified')
        # for pen in pens:
        #     self.response.out.write(pen.name + "\n")
        self.response.out.write("Walk completed")


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
            pen.stash = ""
            pen.following = 0
            pen.followers = 0
            cached_put(pen)
        self.response.out.write("Test pen names created")


app = webapp2.WSGIApplication([('/mypens', AuthPenNames),
                               ('/newpen', NewPenName),
                               ('/updpen', UpdatePenName),
                               ('/picupload', UploadPic),
                               ('/profpic', GetProfPic),
                               ('/togremember', ToggleRemember),
                               ('/srchpens', SearchPenNames),
                               ('/penbyid', GetPenById),
                               ('/acctinfo', GetInfoForAccount),
                               ('/penmail', SetEmailFromPen),
                               ('/penacc', PenAccessed),
                               ('/penwalk', WalkPens),
                               ('/testpens', MakeTestPens)], debug=True)

