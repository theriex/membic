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
import coop
import rev


class PenName(db.Model):
    """ A review author """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    # indexed authentication ids (only mid is currently used)
    mid = db.IntegerProperty()
    gsid = db.StringProperty()      # Google IDs are too big to fit in an int64
    fbid = db.IntegerProperty()
    twid = db.IntegerProperty()
    ghid = db.IntegerProperty()
    # indexed fields
    accessed = db.StringProperty()  # ISO date when last logged in
    modified = db.StringProperty()  # ISO date when last changed
    convidx = db.IntegerProperty()  # Data conversion iteration marker
    # non-indexed fields
    shoutout = db.TextProperty()
    profpic = db.BlobProperty()
    remembered = db.TextProperty()  # CSV of revids for reference
    top20s = db.TextProperty()      # accumulated top 20 reviews of each type
    stash = db.TextProperty()       # precomputed vals, breadcrumbs and such
    settings = db.TextProperty()    # client skin, keyword overrides etc
    preferred = db.TextProperty()   # CSV of penids given priority
    background = db.TextProperty()  # CSV of penids with reduced priority
    blocked = db.TextProperty()     # CSV of penids to be avoided
    coops = db.TextProperty()       # coopids this pen is following


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
    # pen.name handled separately on update only
    pen.mid = intz(request.get('mid'))
    pen.gsid = request.get('gsid') or ""
    pen.fbid = intz(request.get('fbid'))
    pen.twid = intz(request.get('twid'))
    pen.ghid = intz(request.get('ghid'))
    pen.shoutout = request.get('shoutout') or ""
    # pen.profpic is uploaded separately during edit
    pen.accessed = nowISO()
    pen.modified = nowISO()
    # pen.remembered handled separately
    # pen.top20s is maintained separately as part of reviews
    pen.stash = request.get('stash') or ""
    pen.settings = request.get('settings') or ""
    pen.preferred = str(request.get('preferred')) or ""
    pen.background = str(request.get('background')) or ""
    pen.blocked = str(request.get('blocked')) or ""
    pen.coops = str(request.get('coops')) or ""


def gen_password():
    """ Return a vaguely reasonable html safe password you can read """
    size = 16
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' + 'abcdefghijkmnopqrstuvwxyz' +\
        string.digits + '!$^.,'
    pwd = "".join(random.choice(chars) for x in range(size))
    return pwd


def updateable_pen(handler):
    acc = authenticated(handler.request)
    if not acc:
        handler.error(401)  # unauthorized
        handler.response.out.write("Authentication failed")
        return False
    # penid lookup takes precedence so you can find the pen for a coop
    penid = intz(handler.request.get('penid'))
    if not penid:
        penid = intz(handler.request.get('_id'))
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


def filter_sensitive_fields(pen):
    if pen:
        pen.mid = 0
        pen.gsid = "0"
        pen.fbid = 0
        pen.twid = 0
        pen.ghid = 0
        pen.stash = ""


def fetch_pen_by_penid(handler):
    penidstr = handler.request.get('penid')
    penid = intz(penidstr)
    if penid <= 0:
        handler.error(400)
        handler.response.write("Invalid ID for Pen Name: " + penidstr)
        return
    # not caching individual PenNames anymore as these are blockfetched
    # pen = cached_get(intz(penid), PenName)
    pen = PenName.get_by_id(intz(penid))
    if not pen:
        handler.error(404)
        handler.response.write("No Pen Name found for id " + str(penid))
        return
    filter_sensitive_fields(pen)
    return pen


def add_account_info_to_pen_stash(acc, pen):
    ad = {}
    ad["email"] = acc.email
    ad["status"] = acc.status
    ad["invites"] = json.loads(acc.invites or "[]")
    stash = {}
    if pen.stash:
        stash = json.loads(pen.stash)
    stash["account"] = ad
    pen.stash = json.dumps(stash)


def find_auth_pens(handler):
    acc = authenticated(handler.request)
    if not acc:
        # Eventual consistency means it is possible to create a new
        # account but not have it available for authorization yet.
        # Other than that, the most common case is that a token has
        # expired, in which case a 401 error is exactly appropriate.
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return
    where = "WHERE " + handler.request.get('am') + "=:1 LIMIT 20"
    pq = PenName.gql(where, acc._id)
    pens = pq.fetch(10, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    return pens


def reflect_pen_name_change(pen, prev_name):
    penid = str(pen.key().id())
    for ctmid in csv_list(pen.coops):
        ctm = coop.Coop.get_by_id(int(ctmid))
        if ctm.people:
            pdict = json.loads(ctm.people)
            if penid in pdict:
                pdict[penid] = pen.name
            ctm.people = json.dumps(pdict)
            cached_put(ctm)
            memcache.delete("coop" + ctmid)
            # force updated info retrieval for any subsequent call
            ctm = coop.Coop.get_by_id(int(ctmid))
    # update recent reviews using same index as rev.py rebuild_reviews_block
    where = "WHERE ctmid = 0 AND penid = :1 ORDER BY modified DESC"
    rq = rev.Review.gql(where, int(penid))
    revs = rq.fetch(300, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for review in revs:
        review.penname = pen.name
        review.put()
        # force updated info retrieval for any subsequent db access
        review = rev.Review.get_by_id(review.key().id())
    rev.nuke_cached_recent_review_feeds()


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
        cached_put(pen)
        try:
            add_account_info_to_pen_stash(acc, pen)
        except Exception as e:
            logging.info("Account info stash failure for new pen " + str(e))
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
        prev_name = pen.name
        pen.name = name;
        pen.name_c = name_c;
        # possible authorization was changed in the params
        acc = authenticated(self.request)
        authok = authorized(acc, pen)
        if not authok:
            self.error(401)
            self.response.out.write("Authorized access reference required.")
            return
        cached_put(pen)
        # force updated info retrieval for any subsequent call
        pen = PenName.get_by_id(pen.key().id())
        if prev_name != pen.name:
            reflect_pen_name_change(pen, prev_name)
        try:
            add_account_info_to_pen_stash(acc, pen)
        except Exception as e:
            logging.info("Account info stash failure for updated pen " + str(e))
        returnJSON(self.response, [ pen ])
        

class UploadPic(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write('Ready')
    def post(self):
        pen = updateable_pen(self)
        if not pen:
            return
        updobj = pen  # default is uploading a pic for your profile
        picfor = self.request.get('picfor') or "pen"
        if picfor == "coop":
            ctm, role = coop.fetch_coop_and_role(self, pen)
            if not ctm:
                return  # error already reported
            if not role or role != "Founder":
                return srverr(self, 403, "Only founders may upload a coop pic")
            updobj = ctm
        upfile = self.request.get("picfilein")
        if not upfile:
            return srverr(self, 400, "No picture file received")
        logging.info("Pic upload for " + picfor + " " + str(updobj.key().id()))
        try:
            # resize images to max 160 x 160 px
            if picfor == "coop":
                ctm.picture = db.Blob(upfile)
                ctm.picture = images.resize(ctm.picture, 160, 160)
                ctm.modified = nowISO()
                cached_put(ctm)
            else:
                pen.profpic = db.Blob(upfile)
                pen.profpic = images.resize(pen.profpic, 160, 160)
                pen.modified = nowISO()
                cached_put(pen)
        except Exception as e:
            return srverr(self, 500, "Profile picture upload failed: " + str(e))
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("Done: " + pen.modified)


class GetProfPic(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profileid')
        pen = cached_get(intz(profid), PenName)
        img = None
        if pen and pen.profpic:
            img = images.Image(pen.profpic)
            img.resize(width=160, height=160)
            img = img.execute_transforms(output_encoding=images.PNG)
        if not img:  # probably legacy account with no image set yet
            # hex values for a 4x4 transparent PNG created with GIMP:
            imgstr = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e\x7e\x00\x00\x00\x06\x62\x4b\x47\x44\x00\xff\x00\xff\x00\xff\xa0\xbd\xa7\x93\x00\x00\x00\x09\x70\x48\x59\x73\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07\x74\x49\x4d\x45\x07\xdd\x0c\x02\x11\x32\x1f\x70\x11\x10\x18\x00\x00\x00\x0c\x69\x54\x58\x74\x43\x6f\x6d\x6d\x65\x6e\x74\x00\x00\x00\x00\x00\xbc\xae\xb2\x99\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa0\x1c\x00\x00\x00\x44\x00\x01\x06\xc0\x57\xa2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"
            img = images.Image(imgstr)
            img.resize(width=4, height=4)
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
                review = cached_get(int(revid), rev.Review)
                penid = str(pen.key().id())
                if not csv_contains(penid, review.remembered):
                    review.remembered = prepend_to_csv(penid, review.remembered)
                    cached_put(review)
                    update_review_feed_entry(review)
            except Exception as e:
                logging.info("Failed remembered backlink from Review " + revid +
                             " to PenName " + str(pen.key().id()))
        cached_put(pen)
        returnJSON(self.response, [ pen ])


class GetPenById(webapp2.RequestHandler):
    def get(self):
        pen = fetch_pen_by_penid(self)
        if not pen:
            return
        returnJSON(self.response, [ pen ])


app = webapp2.WSGIApplication([('.*/newpen', NewPenName),
                               ('.*/updpen', UpdatePenName),
                               ('.*/picupload', UploadPic),
                               ('.*/profpic', GetProfPic),
                               ('.*/togremember', ToggleRemember),
                               ('.*/penbyid', GetPenById)], debug=True)

