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


def update_coop_and_bust_cache(coop):
    verify_people(coop)
    cached_put(coop)
    # force subsequent database retrievals to get the latest version
    Coop.get_by_id(coop.key().id())
    # nuke blockfetch cached version to avoid stale data being returned
    memcache.set("coop" + str(coop.key().id()), "")


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
            update_coop_admin_log(coop, pnm, "Rejected " + seekrole, 
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
        "https://membicsys.appspot.com/acceptinvite?coopid=" + str(coop.key().id()) + "&accountemail=" + invacc.email + "&invitetoken=" + invtoken + "\n\n" +\
        accinfo +\
        "This email was generated by request from " + pnm.name + " (" + acc.email + "). Please contact them directly if you have any questions.\n\n"
    logging.info("Invite link sent to " + invacc.email + ":\n" +
                 "subject: " + subj + "\n" +
                 content)
    if not handler.request.host_url.startswith('http://localhost'):
        mail.send_mail(sender="Membic Support <" + suppemail() + ">",
                       to=invacc.email,
                       subject=subj,
                       body=content)


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
        update_coop_and_bust_cache(coop)
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
            if role != "Founder"\
                    and not id_in_csv(penid, coop.seeking)\
                    and not id_in_csv(penid, coop.rejects):
                coop.seeking = append_id_to_csv(penid, coop.seeking)
                update_coop_and_bust_cache(coop)
        elif action == "withdraw":
            coop.seeking = remove_id_from_csv(pnm.key().id(), coop.seeking)
            update_coop_and_bust_cache(coop)
        elif action == "accrej":
            coop.rejects = remove_id_from_csv(pnm.key().id(), coop.rejects)
            update_coop_and_bust_cache(coop)
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


class InviteByMail(webapp2.RequestHandler):
    def post(self):
        acc = authenticated(self.request)
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
        email = normalize_email(email)
        if not valid_email_address(email):
            return srverr(self, 400, "Invalid email address")
        invacc = None
        where = "WHERE email = :1 LIMIT 1"
        accounts = MORAccount.gql(where, email)
        found = accounts.count()
        if found:
            invacc = accounts[0]
        else:
            pwd = random_alphanumeric(18)
            invacc = MORAccount(email=email, password=pwd)
            invacc.modified = nowISO()
            invacc.status = "Invited"
            invacc.mailbounce = ""
        invacc.invites = invacc.invites or "[]"
        invacc.invites = remove_invites_for_coop(coop.key().id(), 
                                                 invacc.invites)
        invtoken = random_alphanumeric(40)
        invacc.invites = add_invite_for_coop(coop, pnm, invtoken, 
                                             invacc.invites)
        invacc.put();  #nocache
        invacc = MORAccount.get_by_id(invacc.key().id())
        mail_invite_notice(self, pnm, coop, acc, invacc, invtoken)
        writeJSONResponse("[{\"email\":\"" + email + "\"}]", self.response)


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
        where = "WHERE email = :1 LIMIT 1"
        accounts = MORAccount.gql(where, emaddr)
        if not accounts.count():
            return srverr(self, 404, "No account found for " + emaddr)
        acc = accounts[0]
        if acc.status != "Active":
            acc.status = "Active"
            acc.put()
            acc = MORAccount.get_by_id(acc.key().id())
        redurl = make_redirect_url_base("", self.request.url)
        redurl += login_token_parameters(acc.email, acc.password)
        self.redirect(str(redurl))
    def post(self):
        acc = authenticated(self.request)
        if not acc or acc.status != "Active":
            return srverr(self, 403, "Your account must active before you can accept membership.")
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
        acc = MORAccount.get_by_id(acc.key().id())
        returnJSON(self.response, updobjs)


app = webapp2.WSGIApplication([('.*/ctmdesc', UpdateDescription),
                               ('.*/ctmbyid', GetCoopById),
                               ('.*/ctmpic', GetCoopPic),
                               ('.*/ctmmemapply', ApplyForMembership),
                               ('.*/ctmmemprocess', ProcessMembership),
                               ('.*/ctmstats', GetCoopStats),
                               ('.*/invitebymail', InviteByMail),
                               ('.*/acceptinvite', AcceptInvitation)], 
                              debug=True)

