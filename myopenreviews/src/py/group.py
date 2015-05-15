import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
from moracct import *
from morutil import *
from cacheman import *
import pen
import rev
import json

class Group(db.Model):
    """ A group of pen names and reviews they have shared with the group """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    modified = db.StringProperty()               # iso date
    modhist = db.StringProperty()                # creation date, mod count
    # non-indexed fields
    description = db.TextProperty()
    picture = db.BlobProperty()
    top20s = db.TextProperty()      # accumulated top 20 reviews of each type
    calembed = db.TextProperty()    # embedded calendar html
    founders = db.TextProperty()    #CSV of founding member penids
    moderators = db.TextProperty()  #CSV of moderator member penids
    members = db.TextProperty()     #CSV of regular member penids
    seeking = db.TextProperty()     #CSV of member application penids
    rejects = db.TextProperty()     #CSV of rejected member application penids
    reviews = db.TextProperty()     #CSV of posted revids, max 300
    adminlog = db.TextProperty()    #JSON array of action entries
    people = db.TextProperty()      #JSON map of penids to display names
    city = db.StringProperty(indexed=False)      #not used anymore
    revtypes = db.StringProperty(indexed=False)  #CSV of review types
    revfreq = db.IntegerProperty(indexed=False)  #review every N days
    

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


def elem_count_csv(csv):
    if not csv:
        return 0
    ids = csv.split(",")
    return len(ids)


def pen_role(penid, group):
    penid = str(penid)
    group.founders = group.founders or ""
    if id_in_csv(penid, group.founders):
        return "Founder"
    group.moderators = group.moderators or ""
    if id_in_csv(penid, group.moderators):
        return "Moderator"
    group.members = group.members or ""
    if id_in_csv(penid, group.members):
        return "Member"
    return "NotFound"


def member_level(penid, group):
    penid = str(penid)
    group.founders = group.founders or ""
    if id_in_csv(penid, group.founders):
        return 3
    group.moderators = group.moderators or ""
    if id_in_csv(penid, group.moderators):
        return 2
    group.members = group.members or ""
    if id_in_csv(penid, group.members):
        return 1
    return 0


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


def verify_unique_name(handler, group):
    groupid = 0
    try:
        groupid = group.key().id()
    except Exception:
        pass  # just compare to zero if no id because not saved yet
    groups = Group.gql("WHERE name_c=:1", group.name_c)
    for sisgrp in groups:
        sid = sisgrp.key().id()
        if sid != groupid:
            srverr(handler, 409, "Name already in use group " + str(sid))
            return False
    return True


def read_and_validate_descriptive_fields(handler, group):
    # name/name_c field has a value and has been set already
    if not verify_unique_name(handler, group):
        return False;
    group.description = handler.request.get('description')
    if not group.description:
        handler.error(400)
        handler.response.out.write("A description is required")
        return False
    group.calembed = handler.request.get('calembed')
    if group.calembed and not group.calembed.startswith("<iframe "):
        handler.error(400)
        handler.response.out.write("Embed code must be an iframe")
        return False
    # picture is uploaded separately
    # revtypes not used anymore
    # frequency not used anymore
    # membership fields are handled separately
    # review postings are handled separately
    return True


def fetch_rev_mod_elements(handler, pnm):
    revid = intz(handler.request.get('revid'))
    if not revid:
        handler.error(400)
        handler.response.out.write("No revid specified")
        return 0, None
    review = cached_get(revid, rev.Review)
    if not review:
        handler.error(404)
        handler.response.out.write("Review " + str(revid) + " not found")
        return revid, None
    return revid, review


def fetch_group_and_role(handler, pnm):
    groupid = intz(handler.request.get('groupid'))
    if not groupid:
        groupid = intz(handler.request.get('_id'))
    if not groupid:
        handler.error(400)
        handler.response.out.write("No groupid specified")
        return None, ""
    group = cached_get(groupid, Group)
    if not group:
        handler.error(404)
        handler.response.out.write("Group " + str(groupid) + " not found")
        return None, ""
    role = pen_role(pnm.key().id(), group)
    return group, role


def fetch_group_mod_elements(handler, pnm):
    revid, review = fetch_rev_mod_elements(handler, pnm)
    if not revid or not review:
        return revid, review, None, ""
    group, role = fetch_group_and_role(handler, pnm)
    return revid, review, group, role


def update_group_admin_log(group, pnm, action, target, reason):
    edict = {}
    edict["when"] = nowISO()
    edict["penid"] = str(pnm.key().id())
    edict["pname"] = pnm.name
    edict["action"] = action
    edict["targid"] = ""
    edict["tname"] = ""
    if(target):
        edict["targid"] = str(target.key().id())
        edict["tname"] = target.name or target.title
    edict["reason"] = reason or ""
    entry = json.dumps(edict)
    if not group.adminlog:
        group.adminlog = "[]"
    log = group.adminlog[1:-1].strip()  # strip outer brackets and whitespace
    if log:
        entry += ","
    group.adminlog = "[" + entry + log + "]"
    
    
def verify_people(group):
    pdict = {}
    if group.people:
        pdict = json.loads(group.people)
    penidcsvs = [group.founders, group.moderators, group.members,
                 group.seeking, group.rejects]
    for penidcsv in penidcsvs:
        for penid in csv_list(penidcsv):
            if not penid in pdict:
                pnm = pen.PenName.get_by_id(int(penid))
                if pnm:
                    pdict[penid] = pnm.name
    group.people = json.dumps(pdict)


def process_membership_action(group, action, pnm, seekerpen, seekrole, reason):
    seekerid = str(seekerpen.key().id());
    if action == "reject":
        group.seeking = remove_from_csv(seekerid, group.seeking)
        if not csv_contains(seekerid, group.rejects):
            group.rejects = append_to_csv(seekerid, group.rejects)
            update_group_admin_log(group, pnm, "Denied Membership", 
                                   seekerpen, reason)
    elif action == "accept":
        msg = "Accepted new "
        group.seeking = remove_from_csv(seekerid, group.seeking)
        if seekrole == "Moderator":
            group.moderators = remove_from_csv(seekerid, group.moderators)
            group.founders = append_to_csv(seekerid, group.founders)
            msg = msg + "Founder"
        elif seekrole == "Member":
            group.members = remove_from_csv(seekerid, group.members)
            group.moderators = append_to_csv(seekerid, group.moderators)
            msg = msg + "Moderator"
        elif seekrole == "NotFound":
            group.members = append_to_csv(seekerid, group.members)
            msg = msg + "Member"
            update_group_admin_log(group, pnm, msg, seekerpen, "")
    elif action == "demote":
        if csv_contains(seekerid, group.moderators):
            group.moderators = remove_from_csv(seekerid, group.moderators)
            group.members = append_to_csv(seekerid, group.members)
        elif csv_contains(seekerid, group.members):
            group.members = remove_from_csv(seekerid, group.members)
            update_group_admin_log(group, pnm, "Demoted Member", 
                                   seekerpen, reason)
    else:
        logging.info("process_membership_action unknown action: " + action)
        return
    verify_people(group)
    cached_put(group)


class UpdateDescription(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:
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
            if pen_role(pnm.key().id(), group) != "Founder":
                self.error(400)
                self.response.out.write(
                    "Only a Founder may change the group description.")
                return
            group.name = name
            group.name_c = name_c
        else:
            group = Group(name=name, name_c=name_c)
            group.founders = str(pnm.key().id())
        if not read_and_validate_descriptive_fields(self, group):
            return
        group.modified = nowISO()
        update_group_admin_log(group, pnm, "Updated Description", "", "")
        group.people = ""   # have to rebuild sometime and this is a good time
        verify_people(group)
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
            pnm = rev.review_modification_authorized(self)
            if pnm and pen_role(pnm.key().id(), group) == "Founder":
                errmsg = "Picture file not provided"
                upfile = self.request.get("picfilein")
                if upfile:
                    errmsg = "Picture upload failed"
                    try:
                        group.picture = db.Blob(upfile)
                        group.picture = images.resize(group.picture, 160, 160)
                        update_group_admin_log(group, pnm, "Uploaded Picture", 
                                               "", "")
                        verify_people(group)
                        cached_put(group)
                        errmsg = ""
                    except Exception as e:
                        errmsg = "Picture upload failed: " + str(e)
        redurl = self.request.get('returnto')
        if not redurl:
            redurl = "http://www.fgfweb.com#group"
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
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        revid, review, group, role = fetch_group_mod_elements(self, pnm)
        if review is None or group is None:
            return   #error already reported
        if review.penid != pnm.key().id():
            self.error(400)
            self.response.out.write("You may only post your own review")
            return;
        if role != "Founder" and role != "Moderator" and role != "Member":
            self.error(400)
            self.response.out.write("You are not a member of this group")
            return
        if not is_revtype_match(review.revtype, group):
            self.error(400)
            self.response.out.write(review.revtype + " is not an accepted type")
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
        verify_people(group)
        cached_put(group)
        returnJSON(self.response, [ group ])


class ApplyForMembership(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pnm)
        if not group:
            return   #error already reported
        penid = pnm.key().id()
        action = self.request.get('action')
        if action == "apply":
            if role != "Founder" and not id_in_csv(penid, group.seeking):
                group.seeking = append_id_to_csv(penid, group.seeking)
                verify_people(group)
                cached_put(group)
        if action == "withdraw":
            group.seeking = remove_id_from_csv(pnm.key().id(), group.seeking)
            verify_people(group)
            cached_put(group)
        returnJSON(self.response, [ group ])


class ProcessMembership(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pnm)
        if not group:
            return   #error already reported
        action = self.request.get('action')
        if not action or action not in ['reject', 'accept', 'demote']:
            return srverr(self, 400, "Valid action required")
        reason = self.request.get('reason')
        if not reason and (action == "reject" or action == "demote"):
            return srverr(self, 400, "Rejection reason required")
        seekerid = self.request.get('seekerid')
        if not seekerid:
            return srverr(self, 400, "No seekerid specified")
        seekrole = pen_role(seekerid, group)
        if not (role == "Founder" or 
                (role == "Moderator" and 
                 ((action == "accept" and seekrole == "NotFound") or
                  (action != "accept" and seekrole == "Member")))):
            return srverr(self, 400, "Processing not authorized")
        seekerpen = pen.PenName.get_by_id(int(seekerid))
        if not seekerpen:
            return srverr(self, 400, "No seeker PenName " + seekerid)
        #if seeker not found, treat as already processed rather than error
        if action == "demote" or csv_contains(seekerid, group.seeking):
            process_membership_action(group, action, pnm, 
                                      seekerpen, seekrole, reason)
        returnJSON(self.response, [ group ])


class MembershipRejectAck(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        group, role = fetch_group_and_role(self, pnm)
        if not group:
            return   #error already reported
        group.rejects = remove_id_from_csv(pnm.key().id(), group.rejects)
        verify_people(group)
        cached_put(group)
        returnJSON(self.response, [ group ])


class GetGroupByName(webapp2.RequestHandler):
    def get(self):
        namestr = self.request.get('groupname')
        if not namestr:
            self.error(400)
            self.response.write("groupname required for fetch")
            return
        namestr = canonize(namestr)
        gquery = Group.gql("WHERE name_c=:1", namestr)
        groups = gquery.fetch(10, read_policy=db.EVENTUAL_CONSISTENCY,
                              deadline=10)
        returnJSON(self.response, groups)


class GetGroupStats(webapp2.RequestHandler):
    def get(self):
        stat = {'total': 0, 'totalmem': 0, 'totalrev': 0,
                'memmax': 0, 'memwin': "", 'revmax': 0, 'revwin': ""}
        groups = Group.all()
        for group in groups:
            stat['total'] += 1
            memcount = elem_count_csv(group.founders) +\
                elem_count_csv(group.moderators) +\
                elem_count_csv(group.members)
            if memcount > stat['memmax']:
                stat['memmax'] = memcount
                stat['memwin'] = group.name
            stat['totalmem'] += memcount
            revcount = elem_count_csv(group.reviews)
            stat['totalrev'] += revcount
            if revcount > stat['revmax']:
                stat['revmax'] = revcount
                stat['revwin'] = group.name
        writeJSONResponse(json.dumps(stat), self.response)        


class SearchGroups(webapp2.RequestHandler):
    def get(self):
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        qstr = self.request.get('qstr')
        qstr_c = canonize(qstr)
        cursor = self.request.get('cursor')
        results = []
        groups = Group.all()
        groups.order('-modified')
        if cursor:
            groups.with_cursor(start_cursor = cursor)
        maxcheck = 1000
        checked = 0
        cursor = ""
        for group in groups:
            checked += 1
            if not qstr or not qstr_c or qstr_c in group.name_c or\
                    (group.description and qstr in group.description) or\
                    (group.city and qstr_c in group.city.lower()):
                results.append(group)
            if checked >= maxcheck or len(results) >= 20:
                # hit the max, get return cursor for next fetch
                cursor = groups.cursor()
                break
        returnJSON(self.response, results, cursor, checked)


app = webapp2.WSGIApplication([('/grpdesc', UpdateDescription),
                               ('/grpbyid', GetGroupById),
                               ('/grppicupload', UploadGroupPic),
                               ('/grppic', GetGroupPic),
                               ('/grprev', PostReview),
                               ('/grpmemapply', ApplyForMembership),
                               ('/grpmemprocess', ProcessMembership),
                               ('/grprejok', MembershipRejectAck),
                               ('/grpbyname', GetGroupByName),
                               ('/grpstats', GetGroupStats),
                               ('/srchgroups', SearchGroups),
                               ], debug=True)

