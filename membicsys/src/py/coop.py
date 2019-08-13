import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import memcache
import logging
import muser
from morutil import *
from cacheman import *
import rev
import json
import re

class Coop(db.Model):
    """ A cooperative theme """
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)
    modified = db.StringProperty()               # iso date
    modhist = db.StringProperty()                # creation date, mod count
    hashtag = db.StringProperty()
    lastwrite = db.StringProperty() # isodate (latest membic/preb rebuild)
    # non-indexed fields
    description = db.TextProperty()
    picture = db.BlobProperty()
    founders = db.TextProperty()    #CSV of founding member penids
    moderators = db.TextProperty()  #CSV of moderator member penids
    members = db.TextProperty()     #CSV of regular member penids
    seeking = db.TextProperty()     #CSV of member application penids
    rejects = db.TextProperty()     #CSV of rejected member application penids
    adminlog = db.TextProperty()    #JSON array of action entries
    people = db.TextProperty()      #JSON map of penids to display names
    cliset = db.TextProperty()      #JSON dict of client settings.  See MUser.
    keywords = db.TextProperty()    #CSV of custom theme keywords
    preb = db.TextProperty()        #JSON membics for display (from query)
    

def user_role(userid, coop):
    userid = str(userid)
    coop.founders = coop.founders or ""
    if id_in_csv(userid, coop.founders):
        return "Founder"
    coop.moderators = coop.moderators or ""
    if id_in_csv(userid, coop.moderators):
        return "Moderator"
    coop.members = coop.members or ""
    if id_in_csv(userid, coop.members):
        return "Member"
    return "Follower"


def member_level(penid, coop):
    penid = str(penid)
    founders = attracc(coop, "founders", "")
    if id_in_csv(penid, founders):
        return 3
    moderators = attracc(coop, "moderators", "")
    if id_in_csv(penid, moderators):
        return 2
    members = attracc(coop, "members", "")
    if id_in_csv(penid, members):
        return 1
    return 0


def verify_unique_name(handler, coop):
    coopid = 0
    try:
        coopid = coop.key().id()
    except Exception:
        pass  # just compare to zero if no id because not saved yet
    vq = VizQuery(Coop, "WHERE name_c=:1", coop.name_c)
    coops = vq.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for sisctm in coops:
        sid = sisctm.key().id()
        if sid != coopid:
            srverr(handler, 409, "Name already in use coop " + str(sid))
            return False
    return True


def is_valid_hashtag(hashtag):
    # alphabetic character, followed by alphabetic chars or numbers
    #   1. start of string
    #   2. not a non-alphanumeric, not a number and not '_'
    #   3. any alphanumeric character.  Underscores ok.
    #   4. continue to end of string
    return re.match(r"\A[^\W\d_][\w]*\Z", hashtag)


def verify_valid_unique_hashtag(handler, coop):
    if not coop.hashtag:
        return True
    coop.hashtag = coop.hashtag.lower()
    if not is_valid_hashtag(coop.hashtag):
        return srverr(handler, 400, "Invalid hashtag.")
    coopid = 0
    try:
        coopid = coop.key().id()
    except Exception:
        pass
    vq = VizQuery(Coop, "WHERE hashtag = :1", coop.hashtag)
    coops = vq.fetch(2, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for sisctm in coops:
        sid = sisctm.key().id()
        if sid != coopid:
            srverr(handler, 409, "Hashtag already in use")
            return False
    return True


def has_flag(coop, flagname):
    clidict = {}
    if coop.cliset:
        clidict = json.loads(coop.cliset)
    if "flags" in clidict:
        flagsdict = clidict["flags"]
        if flagname in flagsdict:
            return flagsdict[flagname]
    return False


# The MUser must be at least following the Coop to apply for membership, and
# at least have been a member at some point in order to post.  So any Coop
# being processed will have an entry accessible by its key.
def update_acc_coops(acc, key, field, val):
    coops = json.loads(acc.coops)
    entry = coops[key]
    entry[field] = val
    acc.coops = json.dumps(coops)


# Verify the acc may write, and reflect involuntary downleveling as needed.
# Voluntary upleveling and downleveling is handled via client request
# (e.g. follow, stop following, apply, resign, archive the theme etc).
# Involuntary downleveling is when you got demoted, or someone else archived
# the theme.  The acc must already have a corresponding coops entry, and
# is written to the db by the caller.
def may_write_review(acc, coop):
    if not coop:
        logging.info("coop.may_write_review: no Coop given")
        return False
    kind = coop.key().kind()
    if kind != "Coop":
        logging.info("coop.may_write_review: " + kind + " is not a Coop")
        return False
    coopdesc = "Coop " + str(coop.key().id()) + " " + coop.name
    archflag = has_flag(coop, "archived")
    if archflag:
        update_acc_coops(acc, str(coop.key().id()), "inactive", archflag)
        logging.info("coop.may_write_review: archived " + coopdesc)
        return False
    level = member_level(acc.key().id(), coop)
    if not level:  # leave them following the theme
        update_acc_coops(acc, str(coop.key().id()), "lev", -1)
        logging.info("coop.may_write_review: not a member " + coopdesc)
        return False
    return True


def read_and_validate_descriptive_fields(handler, coop):
    # name/name_c field has a value and has been set already
    if not verify_unique_name(handler, coop):
        return False
    coop.hashtag = handler.request.get('hashtag')
    if not verify_valid_unique_hashtag(handler, coop):
        return False
    coop.description = handler.request.get('description')
    if not coop.description:
        handler.error(400)
        handler.response.out.write("A description is required")
        return False
    coop.cliset = handler.request.get('cliset')
    coop.keywords = handler.request.get('keywords')
    # picture is uploaded separately
    # membership, adminlog, people handled separately
    # review posting fields are handled separately
    return True


def fetch_coop_and_role(handler, acc):
    coopid = intz(handler.request.get('coopid'))
    if not coopid:
        coopid = intz(handler.request.get('instid'))
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
    role = user_role(acc.key().id(), coop)
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
    logentries = json.loads(coop.adminlog or "[]")
    while len(logentries) and logentries[0]["action"] == action:
        logentries = logentries[1:]
    logentries.insert(0, edict)
    coop.adminlog = json.dumps(logentries)
    
    
def verify_people(coop):
    pdict = {}
    if coop.people:
        pdict = json.loads(coop.people)
    penidcsvs = [coop.founders, coop.moderators, coop.members]
    for penidcsv in penidcsvs:
        for penid in csv_list(penidcsv):
            if not penid in pdict:
                acc = muser.MUser.get_by_id(int(penid))
                if acc:
                    pdict[penid] = acc.name
    coop.people = json.dumps(pdict)


def update_membership(seekacc, level, coop):
    seekid = str(seekacc.key().id())
    if level > 0:  # make sure we have their name cached if member
        pdict = coop.people or "{}"
        pdict = json.loads(pdict)
        pdict[seekid] = seekacc.name
        coop.people = json.dumps(pdict)
    coop.founders = remove_id_from_csv(seekid, coop.founders)
    coop.moderators = remove_id_from_csv(seekid, coop.moderators)
    coop.members = remove_id_from_csv(seekid, coop.members)
    coop.seeking = remove_id_from_csv(seekid, coop.seeking)
    coop.rejects = remove_id_from_csv(seekid, coop.rejects)
    if level == 3:
        coop.founders = append_id_to_csv(seekid, coop.founders)
    elif level == 2:
        coop.moderators = append_id_to_csv(seekid, coop.moderators)
    elif level == 1:
        coop.members = append_id_to_csv(seekid, coop.members)
    else:
        level = -1
    update_acc_coops(seekacc, str(coop.key().id()), "lev", level)


def notice_for_user(coop, action, updnotice, acc):
    coopsdict = json.loads(acc.coops or "{}")
    coopkey = str(coop.key().id())
    if coopkey not in coopsdict:
        # should never happen as the user was already at least following
        logging.warn("notice_for_user did not find Coop " + coopkey + " (" +
                     coop.name + ") in MUser " + str(acc.key().id()))
        return acc
    # logging.info("notice_for_user " + action + " " + str(updnotice))
    resnotices = []
    notices = []
    if "notices" in coopsdict[coopkey]:
        notices = coopsdict[coopkey]["notices"]
    for notice in notices:  # copy all unrelated notices
        if notice["uid"] != updnotice["uid"]:
            resnotices.append(notice)
    # existing notice (if any) now removed, check if adding new
    if action == "add" or action == "replace":
        resnotices.append(updnotice)
    coopsdict[coopkey]["notices"] = resnotices
    acc.coops = json.dumps(coopsdict)
    # logging.info("notice_for_user result coops: " + acc.coops)
    cached_put(acc)
    return acc
    

def notices_for_users(coop, action, notice, accids):
    for accid in csv_list(accids):
        acc = muser.MUser.get_by_id(int(accid))
        if not acc:
            logging.warn("notices_for_users Coop " + str(coop.key().id()) +
                         " no MUser for " + accid)
            continue
        notice_for_user(coop, action, notice, acc)


# Process membership action, caller has authorized and validated
def process_membership(action, seekid, reason, coop, acc):
    notice = {"type":"application", "lev":member_level(seekid, coop) + 1,
              "uid":str(seekid), "created":nowISO(), "status":"pending"}
    if action == "apply":  # acc is applicant seeking membership
        notice["uname"] = acc.name
        coop.seeking = append_id_to_csv(seekid, coop.seeking)
        cached_put(coop)
        acc = notice_for_user(coop, "add", notice, acc)
        notices_for_users(coop, "add", notice, coop.founders)
    elif action == "withdraw":  # acc is applicant seeking membership
        coop.seeking = remove_id_from_csv(seekid, coop.seeking)
        cached_put(coop)
        acc = notice_for_user(coop, "remove", notice, acc)
        notices_for_users(coop, "remove", notice, coop.founders)
    elif action == "accept":  # acc is founder
        seekacc = muser.MUser.get_by_id(int(seekid))
        update_membership(seekacc, notice["lev"], coop)  # clears seeking
        msg = "Promoted membership to " + user_role(seekid, coop)
        update_coop_admin_log(coop, acc, msg, seekacc, reason)
        cached_put(coop)
        notice_for_user(coop, "remove", notice, seekacc)
        notices_for_users(coop, "remove", notice, coop.founders)
        acc = cached_get(acc.key().id(), muser.MUser)
    elif action == "reject":  # acc is founder
        coop.seeking = remove_id_from_csv(seekid, coop.seeking)
        coop.rejects = append_id_to_csv(seekid, coop.rejects)
        cached_put(coop)
        notices_for_users(coop, "remove", notice, coop.founders)
        seekacc = muser.MUser.get_by_id(int(seekid))
        notice["status"] = "rejected"
        notice["reason"] = reason
        notice_for_user(coop, "replace", notice, seekacc)
        acc = cached_get(acc.key().id(), muser.MUser)
    elif action == "accrej":  # acc is applicant seeking membership
        coop.rejects = remove_id_from_csv(seekid, coop.rejects)
        cached_put(coop)
        acc = notice_for_user(coop, "remove", notice, acc)
    elif action == "demote":  # acc is founder or resigning member
        targacc = muser.MUser.get_by_id(int(seekid))
        update_membership(targacc, notice["lev"] - 2, coop)
        msg = "Reduced membership to " + user_role(seekid, coop)
        update_coop_admin_log(coop, acc, msg, targacc, reason)
        cached_put(coop)
        # no notices to clear or create when demoting/resigning
    return coop, acc


class UpdateDescription(webapp2.RequestHandler):
    def post(self):
        acc = muser.authenticated(self.request)
        if not acc:
            return  # error already reported
        name = self.request.get('name')
        name_c = canonize(name)
        if not name_c:
            return srverr(self, 400, "Invalid value for name")
        coop = Coop(name=name, name_c=name_c)
        role = "Founder"
        ctmid = intz(self.request.get("instid"))
        if not ctmid:
            coop.founders = str(acc.key().id())
        else:  # modifying existing Coop
            coop, role = fetch_coop_and_role(self, acc)
            if not coop:
                return   #error already reported
            if role != "Founder":
                return srverr(self, 400, "Only Founders may change description")
        if not read_and_validate_descriptive_fields(self, coop):
            return  # error already reported
        coop.modified = nowISO()
        update_coop_admin_log(coop, acc, "Updated Description", "", "")
        verify_people(coop)
        cached_put(coop)
        memcache.set("activecontent", "")  # force theme/profile refetch
        srvObjs(self, [ coop ])


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
        srvObjs(self, [ coop ])


class GetCoopPic(webapp2.RequestHandler):
    def get(self):
        coopid = self.request.get('coopid')
        if not coopid:
            return srverr(self, 400, "Theme id required for pic")
        coop = cached_get(intz(coopid), Coop)
        havepic = coop and coop.picture
        if not havepic:
            return srverr(self, 404, "No picture found for Coop " + str(coopid))
        srvImg(self, coop.picture)


class ApplyForMembership(webapp2.RequestHandler):
    def post(self):
        acc = muser.authenticated(self.request)
        if not acc:
            return  # error already reported
        coop, role = fetch_coop_and_role(self, acc)
        if not coop:
            return   #error already reported
        action = self.request.get('action')
        if not action or action not in ["apply", "withdraw", "accrej"]:
            return srverr(self, 400, "Invalid application action " + action)
        accid = acc.key().id()
        if action == "apply":
            if role == "Founder":
                return srverr(self, 400, "You are already a Founder")
            if id_in_csv(accid, coop.seeking):
                return srverr(self, 400, "You are already seeking membership")
            if id_in_csv(accid, coop.rejects):
                return srverr(self, 400, "Your membership was rejected")
        coop, acc = process_membership(action, accid, "", coop, acc)
        srvObjs(self, [coop, acc])


class ProcessMembership(webapp2.RequestHandler):
    def post(self):
        acc = muser.authenticated(self.request)
        if not acc:
            return  # error already reported
        coop, role = fetch_coop_and_role(self, acc)
        if not coop:
            return   #error already reported
        action = self.request.get('action')
        if not action or action not in ["reject", "accept", "demote"]:
            return srverr(self, 400, "Invalid membership action " + action)
        seekerid = self.request.get('seekerid')
        if not seekerid:
            return srverr(self, 400, "No seekerid specified")
        seekerid = int(seekerid)
        accid = acc.key().id()
        if action in ["reject", "accept"] and role != "Founder":
            return srverr(self, 400, "Only founders may reject or accept")
        if action == "demote" and role != "Founder" and seekerid != accid:
            return srverr(self, 400, "Cannot demote, not Founder and not self")
        reason = self.request.get('reason') or ""
        if not reason and (action == "reject" or 
                           (action == "demote" and seekerid != accid)):
            return srverr(self, 400, "Reason required to reject or demote")
        coop, acc = process_membership(action, seekerid, reason, coop, acc)
        srvObjs(self, [coop, acc])


app = webapp2.WSGIApplication([('.*/ctmdesc', UpdateDescription),
                               ('.*/ctmbyid', GetCoopById),
                               ('.*/ctmpic', GetCoopPic),
                               ('.*/ctmmemapply', ApplyForMembership),
                               ('.*/ctmmemprocess', ProcessMembership)], 
                              debug=True)

