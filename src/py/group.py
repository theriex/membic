import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
from moracct import *
from morutil import *
from cacheman import *
from rev import Review, review_modification_authorized

class Group(db.Model):
    """ A group of pen names and reviews they have shared with the group """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    city = db.StringProperty(indexed=False)      #loose CSV of city names
    description = db.TextProperty()
    picture = db.BlobProperty()
    revtypes = db.StringProperty(indexed=False)  #CSV of review types
    revfreq = db.IntegerProperty(indexed=False)  #review every N days
    founders = db.TextProperty()    #CSV of founding member penids
    seniors = db.TextProperty()     #CSV of senior member penids
    members = db.TextProperty()     #CSV of regular member penids
    reviews = db.TextProperty()     #CSV of posted revids, max 300
    modified = db.StringProperty()               # iso date
    

def pen_role(penid, group):
    penid = str(penid)
    group.founders = group.founders or ""
    for pid in group.founders.split(","):
        logging.info("comparing " + penid + " to " + pid)
        if pid == penid:
            return "Founder"
    group.seniors = group.seniors or ""
    for pid in group.seniors.split(","):
        if pid == penid:
            return "Senior"
    group.members = group.members or ""
    for pid in group.members.split(","):
        if pid == penid:
            return "Member"
    return "NotFound"


def city_match(grpA, grpB):
    acs = grpA.city.split(",")
    bcs = grpB.city.split(",")
    for i in range(len(acs)):
        acs[i] = canonize(acs[i])
    for i in range(len(bcs)):
        bcs[i] = canonize(bcs[i])
    for ac in acs:
        for bc in bcs:
            if ac and bc and ac == bc:
                return True
    return False


def verify_name_and_city_unique(handler, group):
    groups = Group.gql("WHERE name_c=:1", group.name_c)
    for sisgrp in groups:
        if sisgrp.key().id() != group.key().id():
            if not sisgrp.city or city_match(group, sisgrp):
                msg = "City conflicts with sister group: " + str(sisgrp.city)
                if not sisgrp.city:
                    msg = "Already exists a global group with this name"
                handler.error(400)
                handler.response.out.write(msg)
                return False
    return True


def revtypes_valid(handler, group):
    if not group.revtypes:
        handler.error(400)
        handler.response.out.write("One or more review types are required")
        return False
    vts = ["book", "movie", "video", "music", 
           "food", "drink", "activity", "other"]
    rts = group.revtypes.split(",")
    for rt in rts:
        if not rt in vts:
            handler.error(400)
            handler.response.out.write(
                "\"" + rt + "\" is not a valid review type.")
            return False
    return True


def read_and_validate_descriptive_fields(handler, group):
    # name/name_c field has a value and has been set already
    group.city = handler.request.get('city')
    if not verify_name_and_city_unique(handler, group):
        return False;
    group.description = handler.request.get('description')
    if not group.description:
        handler.error(400)
        handler.response.out.write("A description is required")
        return False
    # picture is uploaded separately
    group.revtypes = handler.request.get('revtypes')
    if not revtypes_valid(handler, group):
        return False
    group.revfreq = intz(handler.request.get('revfreq'))
    if group.revfreq < 14 or group.revfreq > 365:
        handler.error(400)
        handler.response.out.write("Review frequency " + str(frequency) + 
                                   " not between 14 and 365.")
        return False
    # membership fields are handled separately
    # review postings are handled separately
    return True


class UpdateDescription(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:
            return
        name = self.request.get('name')
        name_c = canonize(name)
        if not name_c:
            self.error(401)
            self.response.out.write("Invalid value for name")
            return
        grpid = self.request.get('_id')
        if grpid:
            group = cached_get(intz(grpid), Group)
            if not group:
                self.error(404)
                self.response.out.write("Group " + grpid + " not found")
                return
            if pen_role(pen.key().id(), group) != "Founder":
                self.error(400)
                self.response.out.write(
                    "Only a Founder can change the group description.")
                return
            group.name = name
            group.name_c = name_c
        else:
            group = Group(name=name, name_c=name_c)
            group.founders = str(pen.key().id())
        if not read_and_validate_descriptive_fields(self, group):
            return
        group.modified = nowISO()
        cached_put(group)
        # not storing any precomputed group queries, so no cache keys to bust
        returnJSON(self.response, [ group ])


class GetGroupById(webapp2.RequestHandler):
    def get(self):
        groupidstr = self.request.get('groupid')
        groupid = intz(groupidstr)
        if groupid <= 0:
            self.error(400)
            self.response.write("Invalid ID for Group: " + groupidstr)
            return
        group = cached_get(groupid, Group)
        if not group:
            self.error(404)
            self.response.write("No Group found for id " + groupidstr)
            return
        returnJSON(self.response, [ group ])


app = webapp2.WSGIApplication([('/grpdesc', UpdateDescription),
                               ('/grpbyid', GetGroupById)], debug=True)

