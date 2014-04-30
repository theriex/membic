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
from revcmt import ReviewComment

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
    seeking = db.TextProperty()     #CSV of member application penids
    rejects = db.TextProperty()     #CSV of rejected member application penids
    reviews = db.TextProperty()     #CSV of posted revids, max 300
    adminlog = db.TextProperty()    #JSON array of action entries
    modified = db.StringProperty()               # iso date
    

def id_in_csv(idval, csv):
    idval = str(idval)
    csv = csv or ""
    for elem in csv.split(","):
        if idval == elem:
            return elem
    return None


def append_id_to_csv(idval, csv):
    if not csv:
        return str(idval)
    return csv + "," + str(idval)


def remove_id_from_csv(idval, csv):
    if not csv:
        return ""
    ids = csv.split(",")
    try:
        ids.remove(str(idval))
    except Exception:
        pass  # not found is fine, as long as it's not in the list now
    return ",".join(ids)


def pen_role(penid, group):
    penid = str(penid)
    group.founders = group.founders or ""
    if id_in_csv(penid, group.founders):
        return "Founder"
    group.seniors = group.seniors or ""
    if id_in_csv(penid, group.seniors):
        return "Senior"
    group.members = group.members or ""
    if id_in_csv(penid, group.members):
        return "Member"
    return "NotFound"


def is_revtype_match(revtype, group):
    for gtype in group.revtypes.split(","):
        if revtype == gtype:
            return True
    return false


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


def fetch_rev_mod_elements(handler, pen):
    revid = intz(handler.request.get('revid'))
    if not revid:
        handler.error(400)
        handler.response.out.write("No revid specified")
        return 0, None
    rev = cached_get(revid, Review)
    if not rev:
        handler.error(404)
        handler.response.out.write("Review " + str(revid) + " not found")
        return revid, None
    return revid, rev


def fetch_group_and_role(handler, pen):
    groupid = intz(handler.request.get('groupid'))
    if not groupid:
        handler.error(400)
        handler.response.out.write("No groupid specified")
        return None, ""
    group = cached_get(groupid, Group)
    if not group:
        handler.error(404)
        handler.response.out.write("Group " + str(groupid) + " not found")
        return None, ""
    role = pen_role(pen.key().id(), group)
    return group, role


def fetch_group_mod_elements(handler, pen):
    revid, rev = fetch_rev_mod_elements(handler, pen)
    if not revid or not rev:
        return revid, rev, None, ""
    group, role = fetch_group_and_role(handler, pen)
    return revid, rev, group, role


def update_group_admin_log(group, pen, action, targetid, reason):
    entry = "{\"when\":\"" + nowISO() + "\"," +\
        "\"penid\":\"" + str(pen.key().id()) + "\"," +\
        "\"action\":\"" + action + "\"," +\
        "\"target\":\"" + str(targetid) + "\""
    if reason:
        entry += ",\"reason\":\"" + urllib.quote(reason) + "\""
    entry += "}"
    if not group.adminlog:
        group.adminlog = "[]"
    log = group.adminlog[1:-1].strip()  # strip outer brackets and whitespace
    if log:
        entry += ","
    group.adminlog = "[" + entry + log + "]"
    
    
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
                    "Only a Founder may change the group description.")
                return
            group.name = name
            group.name_c = name_c
        else:
            #TODO: verify group name/city combo not already used...
            group = Group(name=name, name_c=name_c)
            group.founders = str(pen.key().id())
        if not read_and_validate_descriptive_fields(self, group):
            return
        group.modified = nowISO()
        update_group_admin_log(group, pen, "Updated Description", "", "")
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


# This is a form submission endpoint, so always redirect back to the app.
class UploadGroupPic(webapp2.RequestHandler):
    def post(self):
        errmsg = "Could not find group"
        groupid = self.request.get('_id')
        group = cached_get(intz(groupid), Group)
        if group:
            errmsg = "You are not authorized to update this group pic"
            pen = review_modification_authorized(self)
            if pen and pen_role(pen.key().id(), group) == "Founder":
                errmsg = "Picture file not provided"
                upfile = self.request.get("picfilein")
                if upfile:
                    errmsg = "Picture upload failed"
                    try:
                        group.picture = db.Blob(upfile)
                        group.picture = images.resize(group.picture, 160, 160)
                        update_group_admin_log(group, pen, "Uploaded Picture", 
                                               "", "")
                        cached_put(group)
                        errmsg = ""
                    except Exception as e:
                        errmsg = "Picture upload failed: " + str(e)
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.wdydfun.com#group"
        redurl = urllib.unquote(redurl)
        redurl = str(redurl)
        if errmsg:
            redurl += "&action=grppicupload&errmsg=" + errmsg
        logging.info("UploadGroupPic redirecting to " + redurl)
        self.redirect(redurl)


class GetGroupPic(webapp2.RequestHandler):
    def get(self):
        groupid = self.request.get('groupid')
        group = cached_get(intz(groupid), Group)
        havepic = group and group.picture
        if not havepic:
            self.error(404)
            self.response.out.write("Pic for group " + str(groupid) + 
                                    " not found.")
            return
        img = images.Image(group.picture)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class PostReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        revid, rev, group, role = fetch_group_mod_elements(self, pen)
        if rev is None or group is None:
            return   #error already reported
        if rev.penid != pen.key().id():
            self.error(400)
            self.response.out.write("You may only post your own review")
            return;
        if role != "Founder" and role != "Senior" and role != "Member":
            self.error(400)
            self.response.out.write("You are not a member of this group")
            return
        if not is_revtype_match(rev.revtype, group):
            self.error(400)
            self.response.out.write(rev.revtype + " is not an accepted type")
            return
        # add the review to the group, most recently posted first
        if not group.reviews or group.reviews == str(revid):
            group.reviews = str(revid)
        else:
            revids = group.reviews.split(",")
            try: 
                revids.remove(str(revid))
            except Exception:
                pass
            revids.insert(0, str(revid))    # most recently posted first
            group.reviews = ",".join(revids)
        cached_put(group)
        returnJSON(self.response, [ group ])


class RemoveReview(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        revid, rev, group, role = fetch_group_mod_elements(self, pen)
        if rev is None or group is None:
            return   #error already reported
        if role != "Founder" and role != "Senior":
            if rev.penid != pen.key().id():
                self.error(400)
                self.response.out.write("Not authorized to remove reviews")
                return
        # leave a comment for owner if not your review
        if rev.penid != pen.key().id():
            reason = self.request.get('reason')
            if not reason or len(reason.strip()) == 0:
                self.error(400)
                self.response.out.write("Removal reason required")
                return
            rc = ReviewComment(revid=revid)
            rc.revpenid = rev.penid
            rc.cmtpenid = pen.key().id()
            rc.rctype = "comment"
            rc.rcstat = "pending"
            rc.comment = reason
            rc.resp = ""
            rc.modified = nowISO()
            rc.put()
        # remove the revid from the group
        group.reviews = remove_id_from_csv(revid, group.reviews)
        update_group_admin_log(group, pen, "Removed Review", revid, reason)
        cached_put(group)
        returnJSON(self.response, [ group ])


class ApplyForMembership(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        penid = pen.key().id()
        if role != "Founder" and not id_in_csv(penid, group.seeking):
            group.seeking = append_id_to_csv(penid, group.seeking)
            cached_put(group)
        returnJSON(self.response, [ group ])


class WithdrawMembershipSeek(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        group.seeking = remove_id_from_csv(pen.key().id(), group.seeking)
        cached_put(group)
        returnJSON(self.response, [ group ])


class DenyMembershipSeek(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        seekerid = intz(self.request.get('seekerid'))
        if not seekerid:
            self.error(400)
            self.response.out.write("No seekerid specified")
            return
        reason = self.request.get("reason")
        #possible seek was withdrawn or rejected by someone else already
        #in which case treat as succeeded so the app can continue ok
        if id_in_csv(seekerid, group.seeking):
            seekrole = pen_role(seekerid, group)
            if role == "Founder" or (role == "Senior" and 
                                     seekrole == "NotFound"):
                group.seeking = remove_id_from_csv(seekerid, group.seeking)
                if not id_in_csv(seekerid, group.rejects):
                    group.rejects = append_id_to_csv(seekerid, group.rejects)
                update_group_admin_log(group, pen, "Denied Membership", 
                                       seekerid, reason)
                cached_put(group)
        returnJSON(self.response, [ group ])


class AcceptMembershipSeek(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        seekerid = intz(self.request.get('seekerid'))
        if not seekerid:
            self.error(400)
            self.response.out.write("No seekerid specified")
            return
        #possible the application was withdrawn or accepted by someone else
        #in the interim, or this is a spurious call. Either way fail.
        if not id_in_csv(seekerid, group.seeking):
            self.error(400)
            self.response.out.write("Pen " + str(seekerid) + 
                                    " is not seeking membership.")
            return
        seekrole = pen_role(seekerid, group)
        if not (role == "Founder" or (role == "Senior" and 
                                      seekrole == "NotFound")):
            self.error(400)
            self.response.out.write("Not authorized to accept membership")
            return;
        group.seeking = remove_id_from_csv(seekerid, group.seeking)
        if seekrole == "Senior":
            group.seniors = remove_id_from_csv(seekerid, group.seniors)
            if not id_in_csv(seekerid, group.founders):
                group.founders = append_id_to_csv(seekerid, group.founders)
        elif seekrole == "Member":
            group.members = remove_id_from_csv(seekerid, group.members)
            if not id_in_csv(seekerid, group.seniors):
                group.seniors = append_id_to_csv(seekerid, group.seniors)
        elif seekrole == "NotFound" and not id_in_csv(seekerid, group.members):
            group.members = append_id_to_csv(seekerid, group.members)
        update_group_admin_log(group, pen, "Accepted Member", seekerid, "")
        cached_put(group)
        returnJSON(self.response, [ group ])



class MembershipRejectAck(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        group.rejects = remove_id_from_csv(pen.key().id(), group.rejects)
        cached_put(group)
        returnJSON(self.response, [ group ])


# Resign from a group or remove another member. The group is deleted
# when the last founder leaves.  Need to be able to re-use the names
# without it being a hassle.
class RemoveMember(webapp2.RequestHandler):
    def post(self):
        pen = review_modification_authorized(self)
        if not pen:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pen)
        if not group:
            return   #error already reported
        removeid = intz(self.request.get('removeid'))
        if not removeid:
            self.error(400)
            self.response.out.write("No removeid specified")
            return
        resigning = removeid == pen.key().id()
        if resigning and role == "Founder" and not "," in group.founders:
            cached_delete(group.key().id(), Group)
            returnJSON(self.response, [])
            return
        remlev = pen_role(removeid, group)
        authorized = (remlev != "Founder" and 
                      (role == "Founder" or 
                       (role == "Senior" and remlev == "Member")))
        if not resigning and not authorized:
            self.error(400)
            self.response.out.write("Not authorized to remove member")
            return
        reason = self.request.get('reason')
        if not reason and pen.key().id() != removeid:
            self.error(400)
            self.response.out.write("A reason is required")
            return
        group.founders = remove_id_from_csv(removeid, group.founders)
        group.seniors = remove_id_from_csv(removeid, group.seniors)
        group.members = remove_id_from_csv(removeid, group.members)
        action = "Removed Member"
        if pen.key().id() == removeid:
            action = "Resigned"
        update_group_admin_log(group, pen, action, removeid, reason)
        cached_put(group)
        returnJSON(self.response, [ group ])


app = webapp2.WSGIApplication([('/grpdesc', UpdateDescription),
                               ('/grpbyid', GetGroupById),
                               ('/grppicupload', UploadGroupPic),
                               ('/grppic', GetGroupPic),
                               ('/grprev', PostReview),
                               ('/grpremrev', RemoveReview),
                               ('/grpmemapply', ApplyForMembership),
                               ('/grpmemwithdraw', WithdrawMembershipSeek),
                               ('/grpmemrej', DenyMembershipSeek),
                               ('/grpmemyes', AcceptMembershipSeek),
                               ('/grprejok', MembershipRejectAck),
                               ('/grpmemremove', RemoveMember)
                               ], debug=True)

