import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
import logging
import moracct
import muser
from morutil import *
from cacheman import *
import pen
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
    top20s = db.TextProperty()      # accumulated top 20 reviews of each type
    founders = db.TextProperty()    #CSV of founding member penids
    moderators = db.TextProperty()  #CSV of moderator member penids
    members = db.TextProperty()     #CSV of regular member penids
    seeking = db.TextProperty()     #CSV of member application penids
    rejects = db.TextProperty()     #CSV of rejected member application penids
    adminlog = db.TextProperty()    #JSON array of action entries
    people = db.TextProperty()      #JSON map of penids to display names
    soloset = db.TextProperty()     #JSON settings for solo page display
    keywords = db.TextProperty()    #CSV of custom theme keywords
    preb = db.TextProperty()        #JSON membics for display (from query)
    preb2 = db.TextProperty()       #JSON membics (overflow from preb)
    

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
    solodict = {}
    if coop.soloset:
        solodict = json.loads(coop.soloset)
    if "flags" in solodict:
        flagsdict = solodict["flags"]
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


def verify_soloset(coop, paramjson):
    srvdict = {}
    if coop.soloset:
        srvdict = json.loads(coop.soloset)
    usrdict = {}
    if paramjson and len(paramjson):
        usrdict = json.loads(paramjson)
    usrflags = {}
    if "flags" in usrdict:
        usrflags = usrdict["flags"]
    svrflags = {}
    if "flags" in srvdict:
        svrflags = srvdict["flags"]
    # verify and restore any values that are maintained server side.  always
    # make sure server values are present so they don't get toggled on
    # client side by accident.
    if "mainf" not in svrflags:
        svrflags["mainf"] = ""
    usrflags["mainf"] = svrflags["mainf"]
    # put the data back together
    usrdict["flags"] = usrflags
    coop.soloset = json.dumps(usrdict)
    # logging.info("verify_soloset coop.soloset: " + coop.soloset)


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
    coop.calembed = handler.request.get('calembed')
    if coop.calembed and not coop.calembed.startswith("<iframe "):
        handler.error(400)
        handler.response.out.write("Embed code must be an iframe")
        return False
    verify_soloset(coop, handler.request.get('soloset'))
    coop.keywords = handler.request.get('keywords')
    # picture is uploaded separately
    # frequency not used anymore
    # membership fields are handled separately
    # review postings are handled separately
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


def prebuilt_membics_stale(coop):
    thresh = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(hours=-1))
    if coop.modified > thresh:
        logging.info("coop modified within past hour, slow db, preb NOT stale")
        return False
    solodict = {}
    if coop.soloset:
        solodict = json.loads(coop.soloset)
    if "stats" not in solodict:
        logging.info("stats not in solodict, preb stale")
        return True
    statdict = solodict["stats"]
    if "upd" not in statdict:
        logging.info("upd not in statdict, preb stale")
        return True
    mod = coop.modified
    upd = statdict["upd"]
    if upd[0:16] == mod[0:16]:  # within a minute is equivalent
        return False  # stats are up to date
    logging.info("stats.upd != coop.modified, preb stale")
    return True


def update_coop_stats(coop, count):
    solodict = {}
    if coop.soloset:
        solodict = json.loads(coop.soloset)
    s1 = coop.preb or ""
    s2 = coop.preb2 or ""
    solodict["stats"] = {"mc": count, "s1": len(s1), "s2": len(s2),
                         "upd": nowISO()}  # coop.modified updated on save
    coop.soloset = json.dumps(solodict)


def update_coop_and_bust_cache(coop):
    verify_people(coop)
    coop.preb = None   # force rebuild of prebuilt cached representation
    coop.preb2 = None
    cached_put(coop)
    # force subsequent database retrievals to get the latest version
    Coop.get_by_id(coop.key().id())


def membership_action_allowed(coop, action, pnm, role, seekerpen, seekrole):
    logging.info(coop.name + " " + pnm.name + " (" + role + ") " + action +
                 " " + seekerpen.name + " " + seekrole)
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
    elif action == "reject":
        if role == "Founder":
            return True  # Founders can reject any application for any position
        elif role == "Moderator":
            if seekrole == "Member":
                return True  # Moderators may reject membership applications
    return False


def process_membership_action(coop, action, pnm, seekerpen, seekrole, reason):
    # Caller has determined the action is allowed, just process if possible
    seekerid = str(seekerpen.key().id());
    if action == "reject":
        coop.seeking = remove_from_csv(seekerid, coop.seeking)
        if not csv_contains(seekerid, coop.rejects):
            coop.rejects = append_to_csv(seekerid, coop.rejects)
            applicrole = "Member"
            if seekrole == "Member":
                applicrole = "Moderator"
            elif seekrole == "Moderator":
                applicrole = "Founder"
            update_coop_admin_log(coop, pnm, 
                                  "Rejected " + applicrole + " application", 
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
    update_coop_and_bust_cache(coop)


def remove_invites_for_coop(coopid, invites_json):
    invites_json = invites_json or "[]"
    invites = json.loads(invites_json)
    filtered = [ivt for ivt in invites if str(ivt["coopid"]) != str(coopid)]
    return json.dumps(filtered)


def add_invite_for_coop(coop, pen, invtoken, invites_json):
    invites_json = invites_json or "[]"
    invites = json.loads(invites_json)
    invites.append({"coopid": str(coop.key().id()), "coopname": coop.name,
                    "penid": str(pen.key().id()), "penname": pen.name,
                    "invited": nowISO(), "invtok": invtoken})
    return json.dumps(invites)


def find_invite_for_coop(coopid, ipid, invites_json):
    invites_json = invites_json or "[]"
    invites = json.loads(invites_json)
    for invite in invites:
        if invite["coopid"] == str(coopid) and invite["penid"] == str(ipid):
            return invite
    return None


def mail_invite_notice(handler, pnm, coop, acc, invacc, invtoken):
    subj = "Invitation from " + pnm.name + " for " + coop.name
    accinfo = ""
    if invacc.status == "Invited":
        accinfo = "To make getting started as easy as possible, an account has been created for you:\n\n" +\
            "    email: " + invacc.email + "\n" +\
            "    password: " + invacc.password + "\n\n" +\
            "The link above will automatically log you in and activate your account. After you create a pen name, your membership will be processed. You can change your password from your profile settings if you want.\n\n"
    elif invacc.status != "Active":
        accinfo += "The link above will activate your account and process your membership.\n\n"
    content = pnm.name + " (" + acc.email + ") has invited you to join \"" +\
        coop.name + "\". You should receive mail from them directly with more details. To accept their invitation, use this link:\n\n" +\
        "https://membic.org/acceptinvite?coopid=" + str(coop.key().id()) + "&accountemail=" + invacc.email + "&invitetoken=" + invtoken + "\n\n" +\
        accinfo +\
        "This email was generated by request from " + pnm.name + " (" + acc.email + "). Please contact them directly if you have any questions.\n\n"
    logging.info("Invite link sent to " + invacc.email + ":\n" +
                 "subject: " + subj + "\n" +
                 content)
    moracct.mailgun_send(handler, invacc.email, subj, content)


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
        logging.warn("notice_for_user did not find Coop " + coopkey + " (" +
                     coop.name + ") in MUser " + str(acc.key().id()))
        return acc
    coopinfo = coopsdict[coopkey]
    resnotices = []
    notices = []
    if "notices" in coopinfo:
        notices = coopinfo["notices"]
    for notice in notices:
        if notice["uid"] != updnotice["uid"]:
            resnotices.append(notice)
    # existing notice (if any) now removed, check if adding new
    if action == "add" or action == "replace":
        resnotices.append(updnotice)
    coopinfo["notices"] = resnotices
    acc.coops = json.dumps(coopsdict)
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
              "uid":seekid, "created":nowISO(), "status":"pending"}
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
        acc = notice_for_user(coop, "remove", notice, acc)
        notices_for_users(coop, "remove", notice, coop.founders)
    elif action == "reject":  # acc is founder
        coop.seeking = remove_id_from_csv(seekid, coop.seeking)
        coop.rejects = append_id_to_csv(seekid, coop.rejects)
        cached_put(coop)
        notices_for_users(coop, "remove", notice, coop.founders)
        seekacc = muser.MUser.get_by_id(int(seekid))
        notice["status"] = "rejected"
        acc = notice_for_user(coop, "replace", notice, seekacc)
    elif action == "accrej":  # acc is applicant seeking membership
        coop.rejects = remove_id_from_csv(pnm.key().id(), coop.rejects)
        cached_put(coop)
        acc = notice_for_user(coop, "remove", notice, acc)
    elif action == "demote":  # acc is founder or resigning member
        targacc = muser.MUser.get_by_id(int(seekid))
        update_membership(targacc, notice["lev"] - 2, coop)
        msg = "Demoted membership to " + user_role(seekid, coop)
        update_coop_admin_log(coop, acc, msg, seekacc, reason)
        cached_put(coop)
        # no notices to clear or create when demoting/resigning
    return coop, acc


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
            if user_role(pnm.key().id(), coop) != "Founder":
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
        update_coop_and_bust_cache(coop)
        moracct.returnJSON(self.response, [ coop ])


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
            self.error(404)
            self.response.out.write("Pic for coop " + str(coopid) + 
                                    " not found.")
            return
        img = images.Image(coop.picture)
        # social net min size constraint is 200x200.  Anything below
        # that and the image won't show, which is bad for sharing
        # themes.  By default, resize chooses the widest dimension,
        # which can cause the short dimension to dip below the
        # minimum.  Using crop_to_fit instructs the scaling to use the
        # less restricting dimension and then chop off the extra.
        # Might lead to some interesting rendering, but at least it
        # will be accepted by the big socnets.
        img.resize(width=200, height=200, crop_to_fit=True)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


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


class GetCoopStats(webapp2.RequestHandler):
    def get(self):
        ctms = []
        coops = Coop.all()
        for coop in coops:
            ctms.append({"ctmid": str(coop.key().id()),
                         "name": coop.name,
                         "description": coop.description,
                         "modified": coop.modified,
                         "founders": coop.founders,
                         "moderators": coop.moderators,
                         "members": coop.members,
                         "soloset": coop.soloset,
                         "top20s": coop.top20s})
        moracct.writeJSONResponse(json.dumps(ctms), self.response)


class InviteByMail(webapp2.RequestHandler):
    def post(self):
        acc = moracct.authenticated(self.request)
        if not acc or acc.status != "Active":
            return srverr(self, 403, "Your account must be active to invite others.")
        pnm = rev.acc_review_modification_authorized(acc, self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        coop, role = fetch_coop_and_role(self, pnm)
        if not coop:
            return   #error already reported
        if role != "Founder" and role != "Moderator":
            return srverr(self, 403, "You must be a Founder or Moderator to invite others.")
        email = self.request.get('email')
        if not email:
            return srverr(self, 400, "No email specified")
        email = moracct.normalize_email(email)
        if not moracct.valid_email_address(email):
            return srverr(self, 400, "Invalid email address")
        invacc = None
        vq = VizQuery(moracct.MORAccount, "WHERE email = :1 LIMIT 1", email)
        accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(accounts) > 0:
            invacc = accounts[0]
        else:
            pwd = moracct.random_alphanumeric(18)
            invacc = moracct.MORAccount(email=email, password=pwd)
            invacc.modified = nowISO()
            invacc.status = "Invited"
            invacc.mailbounce = ""
        invacc.invites = invacc.invites or "[]"
        invacc.invites = remove_invites_for_coop(coop.key().id(), 
                                                 invacc.invites)
        invtoken = moracct.random_alphanumeric(40)
        invacc.invites = add_invite_for_coop(coop, pnm, invtoken, 
                                             invacc.invites)
        invacc.put();  #nocache
        invacc = moracct.MORAccount.get_by_id(invacc.key().id())
        mail_invite_notice(self, pnm, coop, acc, invacc, invtoken)
        moracct.writeJSONResponse("[{\"email\":\"" + email + "\"}]", 
                                  self.response)


class AcceptInvitation(webapp2.RequestHandler):
    # Two stage invite acceptance.  Following the invite link results
    # in a GET call which checks whether a login token can be
    # automatically generated and the account activated.  After
    # logging into the site, profile membership processing results in
    # a POST which updates the coop membership and clears the invite.
    def get(self):
        coopid = self.request.get('coopid')
        emaddr = self.request.get('accountemail')
        token = self.request.get('invitetoken')
        vq = VizQuery(moracct.MORAccount, "WHERE email = :1 LIMIT 1", emaddr)
        accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(accounts) == 0:
            return srverr(self, 404, "No account found for " + emaddr)
        acc = accounts[0]
        if acc.status != "Active":
            acc.status = "Active"
            acc.put()
            acc = moracct.MORAccount.get_by_id(acc.key().id())
        redurl = moracct.make_redirect_url_base("", self.request.url)
        redurl += moracct.login_token_parameters(acc.email, acc.password)
        self.redirect(str(redurl))
    def post(self):
        acc = moracct.authenticated(self.request)
        if not acc or acc.status != "Active":
            return srverr(self, 403, "Your account must be active before you can accept membership.")
        pnm = rev.acc_review_modification_authorized(acc, self)
        if not pnm:  #penid did not match a pen the caller controls
            return   #error already reported
        coop, role = fetch_coop_and_role(self, pnm)
        if not coop:
            return   #error already reported
        ipid = int(self.request.get('inviterpenid'))
        coopid = coop.key().id()
        invite = find_invite_for_coop(coopid, ipid, acc.invites)
        if not invite:
            return srverr(self, 404, "Invitation not found")
        updobjs = []
        action = self.request.get('action')
        if action == "Accept":
            invpen = cached_get(ipid, pen.PenName)
            process_membership_action(coop, "accept", invpen, pnm, "NotFound",
                                      "Membership invitation accepted");
            if not csv_contains(str(coopid), pnm.coops):
                pnm.coops = append_to_csv(str(coopid), pnm.coops)
                cached_put(pnm)
                pnm = pen.PenName.get_by_id(pnm.key().id())
            updobjs = [ pnm, coop ]
        acc.invites = remove_invites_for_coop(coopid, acc.invites)
        acc.put()
        acc = moracct.MORAccount.get_by_id(acc.key().id())
        moracct.returnJSON(self.response, updobjs)


app = webapp2.WSGIApplication([('.*/ctmdesc', UpdateDescription),
                               ('.*/ctmbyid', GetCoopById),
                               ('.*/ctmpic', GetCoopPic),
                               ('.*/ctmmemapply', ApplyForMembership),
                               ('.*/ctmmemprocess', ProcessMembership),
                               ('.*/ctmstats', GetCoopStats),
                               ('.*/invitebymail', InviteByMail),
                               ('.*/acceptinvite', AcceptInvitation)], 
                              debug=True)

