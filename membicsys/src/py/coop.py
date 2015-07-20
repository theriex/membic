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

class Coop(db.Model):
    """ A cooperative theme """
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
    adminlog = db.TextProperty()    #JSON array of action entries
    people = db.TextProperty()      #JSON map of penids to display names
    

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


def pen_role(penid, coop):
    penid = str(penid)
    coop.founders = coop.founders or ""
    if id_in_csv(penid, coop.founders):
        return "Founder"
    coop.moderators = coop.moderators or ""
    if id_in_csv(penid, coop.moderators):
        return "Moderator"
    coop.members = coop.members or ""
    if id_in_csv(penid, coop.members):
        return "Member"
    return "NotFound"


def member_level(penid, coop):
    penid = str(penid)
    coop.founders = coop.founders or ""
    if id_in_csv(penid, coop.founders):
        return 3
    coop.moderators = coop.moderators or ""
    if id_in_csv(penid, coop.moderators):
        return 2
    coop.members = coop.members or ""
    if id_in_csv(penid, coop.members):
        return 1
    return 0


def verify_unique_name(handler, coop):
    coopid = 0
    try:
        coopid = coop.key().id()
    except Exception:
        pass  # just compare to zero if no id because not saved yet
    coops = Coop.gql("WHERE name_c=:1", coop.name_c)
    for sisctm in coops:
        sid = sisctm.key().id()
        if sid != coopid:
            srverr(handler, 409, "Name already in use coop " + str(sid))
            return False
    return True


def read_and_validate_descriptive_fields(handler, coop):
    # name/name_c field has a value and has been set already
    if not verify_unique_name(handler, coop):
        return False;
    coop.description = handler.request.get('description')
    if not coop.description:
        handler.error(400)
        handler.response.out.write("A description is required")
        return False
    coop.calembed = handler.request.get('calembed')
    if coop.calembed and not coop.calembed.startswith("<iframe "):
        handler.error(400)
        handler.response.out.write("Embed code must be an iframe")
        return False
    # picture is uploaded separately
    # frequency not used anymore
    # membership fields are handled separately
    # review postings are handled separately
    return True


def fetch_coop_and_role(handler, pnm):
    coopid = intz(handler.request.get('coopid'))
    if not coopid:
        coopid = intz(handler.request.get('_id'))
    if not coopid:
        handler.error(400)
        handler.response.out.write("No coopid specified")
        return None, ""
    coop = cached_get(coopid, Coop)
    if not coop:
        handler.error(404)
        handler.response.out.write("Cooperative theme" + str(coopid) + 
                                   " not found")
        return None, ""
    role = pen_role(pnm.key().id(), coop)
    return coop, role


def update_coop_admin_log(coop, pnm, action, target, reason):
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
    if not coop.adminlog:
        coop.adminlog = "[]"
    log = coop.adminlog[1:-1].strip()  # strip outer brackets and whitespace
    if log:
        entry += ","
    coop.adminlog = "[" + entry + log + "]"
    
    
def verify_people(coop):
    pdict = {}
    if coop.people:
        pdict = json.loads(coop.people)
    penidcsvs = [coop.founders, coop.moderators, coop.members,
                 coop.seeking, coop.rejects]
    for penidcsv in penidcsvs:
        for penid in csv_list(penidcsv):
            if not penid in pdict:
                pnm = pen.PenName.get_by_id(int(penid))
                if pnm:
                    pdict[penid] = pnm.name
    coop.people = json.dumps(pdict)


def membership_action_allowed(coop, action, pnm, role, seekerpen, seekrole):
    if action == "demote":
        if seekerpen.key().id() == pnm.key().id():
            return True   # You can always resign
        elif role == "Founder":
            if seekrole != "Founder":
                return True  # Founders can demote anyone except other Founders
        elif role == "Moderator":
            if seekrole == "Member":
                return True  # Moderators may remove problematic members
    elif action == "accept":
        if role == "Founder":
            return True  # Founders can accept anyone to any position
        elif role == "Moderator":
            if seekrole == "NotFound":
                return True  # Moderators may accept new members
        # allow for taking over if all positions vacated:
        if not coop.founders:
            if seekrole == "Founder":
                return True;  # Congrats, the position is yours
            if seekrole == "Moderator":
                return True;  # No founder to approve, so auto ok
            if not coop.moderators:
                return True;  # No founders or moderators, join the anarchy
    return False


def process_membership_action(coop, action, pnm, seekerpen, seekrole, reason):
    # Caller has determined the action is allowed, just process if possible
    seekerid = str(seekerpen.key().id());
    if action == "reject":
        coop.seeking = remove_from_csv(seekerid, coop.seeking)
        if not csv_contains(seekerid, coop.rejects):
            coop.rejects = append_to_csv(seekerid, coop.rejects)
            update_coop_admin_log(coop, pnm, "Denied Membership", 
                                   seekerpen, reason)
    elif action == "accept":
        msg = "Accepted new "
        coop.seeking = remove_from_csv(seekerid, coop.seeking)
        if seekrole == "Moderator":
            coop.moderators = remove_from_csv(seekerid, coop.moderators)
            coop.founders = append_to_csv(seekerid, coop.founders)
            msg = msg + "Founder"
        elif seekrole == "Member":
            coop.members = remove_from_csv(seekerid, coop.members)
            coop.moderators = append_to_csv(seekerid, coop.moderators)
            msg = msg + "Moderator"
        elif seekrole == "NotFound":
            coop.members = append_to_csv(seekerid, coop.members)
            msg = msg + "Member"
            update_coop_admin_log(coop, pnm, msg, seekerpen, "")
    elif action == "demote":
        msg = "Demoted "
        if seekerpen.key().id() == pnm.key().id():
            msg = "Resigned as "
        if csv_contains(seekerid, coop.founders):
            coop.founders = remove_from_csv(seekerid, coop.founders)
            coop.moderators = append_to_csv(seekerid, coop.moderators)
            update_coop_admin_log(coop, pnm, msg + "Founder",
                                  seekerpen, reason)
        elif csv_contains(seekerid, coop.moderators):
            coop.moderators = remove_from_csv(seekerid, coop.moderators)
            coop.members = append_to_csv(seekerid, coop.members)
            update_coop_admin_log(coop, pnm, msg + "Moderator",
                                  seekerpen, reason)
        elif csv_contains(seekerid, coop.members):
            coop.members = remove_from_csv(seekerid, coop.members)
            update_coop_admin_log(coop, pnm, msg + "Member",
                                  seekerpen, reason)
    else:
        logging.info("process_membership_action unknown action: " + action)
        return
    verify_people(coop)
    cached_put(coop)
    Coop.get_by_id(coop.key().id())


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
        ctmid = self.request.get('_id')
        if ctmid:
            coop = cached_get(intz(ctmid), Coop)
            if not coop:
                self.error(404)
                self.response.out.write("Cooperative Theme " + ctmid + 
                                        " not found")
                return
            if pen_role(pnm.key().id(), coop) != "Founder":
                self.error(400)
                self.response.out.write(
                    "Only a Founder may change the theme description.")
                return
            coop.name = name
            coop.name_c = name_c
        else:
            coop = Coop(name=name, name_c=name_c)
            coop.founders = str(pnm.key().id())
        if not read_and_validate_descriptive_fields(self, coop):
            return
        coop.modified = nowISO()
        update_coop_admin_log(coop, pnm, "Updated Description", "", "")
        coop.people = ""   # have to rebuild sometime and this is a good time
        verify_people(coop)
        cached_put(coop)
        Coop.get_by_id(coop.key().id())
        # not storing any precomputed coop queries, so no cache keys to bust
        returnJSON(self.response, [ coop ])


class GetCoopById(webapp2.RequestHandler):
    def get(self):
        coopidstr = self.request.get('coopid')
        coopid = intz(coopidstr)
        if coopid <= 0:
            self.error(400)
            self.response.write("Invalid ID for Coop: " + coopidstr)
            return
        coop = cached_get(coopid, Coop)
        if not coop:
            self.error(404)
            self.response.write("No Coop found for id " + coopidstr)
            return
        returnJSON(self.response, [ coop ])


class GetCoopPic(webapp2.RequestHandler):
    def get(self):
        coopid = self.request.get('coopid')
        coop = cached_get(intz(coopid), Coop)
        havepic = coop and coop.picture
        if not havepic:
            self.error(404)
            self.response.out.write("Pic for coop " + str(coopid) + 
                                    " not found.")
            return
        img = images.Image(coop.picture)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class ApplyForMembership(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        coop, role = fetch_coop_and_role(self, pnm)
        if not coop:
            return   #error already reported
        penid = pnm.key().id()
        action = self.request.get('action')
        if action == "apply":
            if role != "Founder" and not id_in_csv(penid, coop.seeking):
                coop.seeking = append_id_to_csv(penid, coop.seeking)
                verify_people(coop)
                cached_put(coop)
                Coop.get_by_id(coop.key().id())
        if action == "withdraw":
            coop.seeking = remove_id_from_csv(pnm.key().id(), coop.seeking)
            verify_people(coop)
            cached_put(coop)
            Coop.get_by_id(coop.key().id())
        returnJSON(self.response, [ coop ])


class ProcessMembership(webapp2.RequestHandler):
    def post(self):
        pnm = rev.review_modification_authorized(self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        coop, role = fetch_coop_and_role(self, pnm)
        if not coop:
            return   #error already reported
        action = self.request.get('action')
        if not action or action not in ['reject', 'accept', 'demote']:
            return srverr(self, 400, "Valid action required")
        seekerid = self.request.get('seekerid')
        if not seekerid:
            return srverr(self, 400, "No seekerid specified")
        penid = str(pnm.key().id())
        reason = self.request.get('reason')
        if not reason and (action == "reject" or 
                           (action == "demote" and seekerid != penid)):
            return srverr(self, 400, "Rejection reason required")
        seekrole = pen_role(seekerid, coop)
        seekerpen = pen.PenName.get_by_id(int(seekerid))
        if not seekerpen:
            return srverr(self, 400, "No seeker PenName " + seekerid)
        if not membership_action_allowed(coop, action, pnm, role,
                                         seekerpen, seekrole):
            return srverr(self, 400, "Membership modification not authorized")
        if action == "demote" or csv_contains(seekerid, coop.seeking):
            process_membership_action(coop, action, pnm, 
                                      seekerpen, seekrole, reason)
        else:
            return srverr(self, 400, "Membership changed already")
        returnJSON(self.response, [ coop ])


class GetCoopStats(webapp2.RequestHandler):
    def get(self):
        stat = {'total': 0, 'totalmem': 0, 'memmax': 0, 'memwin': ""}
        coops = Coop.all()
        for coop in coops:
            stat['total'] += 1
            memcount = elem_count_csv(coop.founders) +\
                elem_count_csv(coop.moderators) +\
                elem_count_csv(coop.members)
            if memcount > stat['memmax']:
                stat['memmax'] = memcount
                stat['memwin'] = coop.name
            stat['totalmem'] += memcount
        writeJSONResponse(json.dumps(stat), self.response)        


app = webapp2.WSGIApplication([('/ctmdesc', UpdateDescription),
                               ('/ctmbyid', GetCoopById),
                               ('/ctmpic', GetCoopPic),
                               ('/ctmmemapply', ApplyForMembership),
                               ('/ctmmemprocess', ProcessMembership),
                               ('/ctmstats', GetCoopStats),
                               ], debug=True)

