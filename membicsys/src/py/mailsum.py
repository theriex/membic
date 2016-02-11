import webapp2
import datetime
from google.appengine.ext import db
import logging
import pen
from moracct import MORAccount, safestr, returnJSON, writeJSONResponse
from morutil import *
from google.appengine.api import mail
from google.appengine.api.logservice import logservice
from google.appengine.api import images
from google.appengine.ext.webapp.mail_handlers import BounceNotification
from google.appengine.ext.webapp.mail_handlers import BounceNotificationHandler
import textwrap
from cacheman import *
import re
from google.appengine.runtime.apiproxy_errors import OverQuotaError

class ActivityStat(db.Model):
    """ Activity metrics for tracking purposes """
    day = db.StringProperty(required=True)  # ISO start of day for this stat
    visits = db.IntegerProperty(indexed=False)      # num app initializations
    logins = db.IntegerProperty(indexed=False)      # num logged in app inits
    liupens = db.TextProperty()       # logged in user access: pid-encnm:cnt,...
    posters = db.IntegerProperty(indexed=False)     # num pens posting membics
    postpens = db.TextProperty()      # who posted: penid:encname,...
    membics = db.IntegerProperty(indexed=False)     # num membics posted
    edits = db.IntegerProperty(indexed=False)       # num membics edited
    themeposts = db.IntegerProperty(indexed=False)  # num theme post-throughs
    starred = db.IntegerProperty(indexed=False)     # num membics starred
    remembered = db.IntegerProperty(indexed=False)  # num membics remembered
    responded = db.IntegerProperty(indexed=False)   # num membics responded
    refers = db.TextProperty()        # srcA:3,srcB:12...
    clickthru = db.IntegerProperty(indexed=False)   # num specific requests
    ctreqs = db.TextProperty()        # theme/prof ext acc [t|p]id:count,...
    rssacc = db.TextProperty()        # theme/prof acc rss [t|p]id:count,...
    agents = db.TextProperty()        # CSV of accessing agents


#substrings identifying web crawler agents.  No embedded commas.
bot_ids = ["AhrefsBot", "Baiduspider", "ezooms.bot",
           "netvibes.com", # not really a bot, but not a really a hit either
           "AppEngine-Google", "Googlebot", "YandexImages", "crawler.php"]


def get_activity_stat(sday):
    stat = ActivityStat(day=sday)
    stat.visits = 0
    stat.logins = 0
    stat.posters = 0
    stat.postpens = ""
    stat.membics = 0
    stat.edits = 0
    stat.themeposts = 0
    stat.starred = 0
    stat.remembered = 0
    stat.responded = 0
    stat.refers = ""
    stat.clickthru = 0
    stat.agents = ""
    try:
        where = "WHERE day = :1"
        stats = ActivityStat.gql(where, sday)
        for existing_stat in stats:
            stat = existing_stat
    except Exception as e:
        logging.info("Existing stat retrieval failed: " + str(e))
    return stat


def bump_referral_count(stat, bumpref):
    bumped_existing = False
    refers = stat.refers.split(",")
    for idx, refer in enumerate(refers):
        if bumpref in refer:
            components = refer.split(":")
            count = int(components[1]) + 1
            refers[idx] = bumpref + ":" + str(count)
            stat.refers = ",".join(refers)
            bumped_existing = True
            break
    if not bumped_existing:
        if stat.refers:
            stat.refers += ","
        stat.refers += bumpref + ":1"


def is_content_linkback(val):
    csids = ["youtube.", "vimeo.", "ted.com", "simonsfoundation.org",
             "blueman.com" ]
    for csid in csids:
        if csid in val:
            return True
    return False


# Translate and collect referral URLs into series identifiers
def bump_referral(stat, entry, val):
    if "facebook" in val:
        bump_referral_count(stat, entry + "FB")
    elif "twitter" in val or "/t.co/" in val:
        bump_referral_count(stat, entry + "TW")
    elif "plus.google" in val:
        bump_referral_count(stat, entry + "GP")
    elif "google" in val:
        bump_referral_count(stat, entry + "SE")  # Search Engine
    elif "craigslist" in val:
        if "/act/" in val:
            bump_referral_count(stat, entry + "CLact")
        elif "/cps/" in val:
            bump_referral_count(stat, entry + "CLcps")
        else:
            bump_referral_count(stat, entry + "CL")
    elif "membic.com" in val:
        bump_referral_count(stat, entry + "Mbic")
    elif "membicsys.appspot.com" in val:
        bump_referral_count(stat, entry + "Spot")
    elif "mail." in val:
        bump_referral_count(stat, entry + "Mail")
    elif "sandservices.com" in val:
        bump_referral_count(stat, entry + "SSI")
    elif is_content_linkback(val):
        bump_referral_count(stat, entry + "ContLB")
    elif "membic" not in val:
        # Write the whole url (without colons) as the identifier, thus
        # causing the activity display to get real ugly.  Then write
        # more logic in this method and fix the data to match.
        ident = re.sub(":", "_", val)
        bump_referral_count(stat, entry + ident)


def is_known_bot(agentstr):
    for botsig in bot_ids:
        if botsig in agentstr:
            return True
    return False


def note_agent(stat, request):
    agentstr = request.headers.get('User-Agent') or ""
    agentstr = agentstr[:255]  #These CAN grow huge
    if is_known_bot(agentstr):
        return  #No reason to note known bots
    #An agent string can have pretty much any unicode character in it
    #except for reserved separators. For general information purposes,
    #dealing with these strings in CSV format is easiest.  Pretty sure
    #that commas are not allowed, but replace if found.
    agentstr = agentstr.replace(",", ";");
    if agentstr not in stat.agents:
        if stat.agents:
            stat.agents += ", "
        stat.agents += agentstr


def get_current_stat():
    sday = dt2ISO(datetime.datetime.utcnow())[:10] + "T00:00:00Z"
    stat = get_activity_stat(sday)
    return stat


def css_summary_requested(coop, request):
    stat = get_current_stat()
    note_agent(stat, request)
    stat.rssacc = csv_increment("t" + str(coop.key().id()), stat.rssacc)
    try:
        stat.put()  #nocache
    except Exception as e:
        logging.info("Logging of css access failed: " + str(e))


def btw_activity(handler, src, request):
    stat = get_current_stat()
    note_agent(stat, request)
    val = request.get("clickthrough")
    if val:  # Somebody accessed the site through a permalink.
        stat.clickthru += 1
        stat.ctreqs = csv_increment(val, stat.ctreqs)
    val = request.get("referral")
    if val:  # Somebody clicked on a link to the core application.
             # Note for possible linkback.
        bump_referral(stat, "core", val)
    try:
        stat.put()  #nocache
    except OverQuotaError as oqe:
        srverr(handler, 503, "stat put failure, database writes over quota")


def note_review_update(is_edit, penid, penname, ctmid, srcrev):
    stat = get_current_stat()
    modified = False
    pstamp = str(penid) + ":" + safestr(penname)
    if not csv_contains(pstamp, stat.postpens):
        modified = True
        stat.postpens = prepend_to_csv(pstamp, stat.postpens)
        stat.posters += 1
    if not ctmid:
        if is_edit:
            modified = True
            stat.edits += 1
        else: # new membic being created
            modified = True
            stat.membics += 1
            if srcrev:
                stat.responded += 1
    elif not is_edit:  # has ctmid, and not editing 
        modified = True
        stat.themeposts += 1
    if modified:
        try:
            stat.put()  #nocache
        except OverQuotaError as oqe:
            srverr(handler, 503, "rev stat put failure, db writes over quota")


def bump_starred():
    stat = get_current_stat()
    stat.starred += 1
    try:
        stat.put()  #nocache
    except OverQuotaError as oqe:
        srverr(handler, 503, "starred stat put failure, db writes over quota")


def bump_remembered():
    stat = get_current_stat()
    stat.remembered += 1
    try:
        stat.put()  #nocache
    except OverQuotaError as oqe:
        srverr(handler, 503, "remembered stat put failure, db write quota")


def split_output(response, text):
    logging.info("mailsum: " + text)
    response.out.write(text + "\n")


def stats_text(stat):
    text = stat.day[:10] + " active: " + str(stat.active) +\
        ", onerev: " + str(stat.onerev) +\
        ", tworevs: " + str(stat.tworev) +\
        ", more: " + str(stat.morev) +\
        ", ttlrevs: " + str(stat.ttlrev) +\
        "\n" + stat.names + "\n"
    return text


def eligible_pen(acc, thresh):
    if not acc.email:
        return None, "No email address"
    if acc.mailbounce and "," in acc.mailbounce:
        bouncedates = acc.mailbounce.split(",")
        if bouncedates[-1] < acc.modified:
            #account modified after latest bounce, email might be fixed...
            acc.mailbounce = ""   #caller writes updated account
        else:
            return None, " (" + acc.email + ") bounced " + bouncedates[-1]
    # work off the most recently accessed pen authorized for this account
    latestpen = None
    where = "WHERE mid = :1 LIMIT 20"
    pens = pen.PenName.gql(where, acc.key().id())
    for pen in pens:
        if not latestpen or latestpen.accessed < pen.accessed:
            latestpen = pen
    reason = ""
    if latestpen and latestpen.accessed > thresh:
        if not "sumiflogin" in acc.summaryflags:
            reason = latestpen.name + " accessed since " + thresh
            latestpen = None
    return latestpen, reason


def text_stars(review):
    stars = ["    -",
             "    *",
             "   **",
             "  ***",
             " ****",
             "*****"]
    index = review.rating / 20
    return stars[index]


class ReturnBotIDs(webapp2.RequestHandler):
    def get(self):
        csv = ",".join(bot_ids)
        writeJSONResponse("[{\"botids\":\"" + csv +  "\"}]", self.response)


class UserActivity(webapp2.RequestHandler):
    def get(self):
        daysback = 70  # 10 weeks back
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(daysback))
        where = "WHERE day > :1"
        statquery = ActivityStat.gql(where, thresh)
        stats = statquery.run(read_policy=db.EVENTUAL_CONSISTENCY,
                              batch_size=daysback)
        returnJSON(self.response, stats)


# Handler from retired "bytheimg" endpoint. Leaving the code here for
# reference in case that's needed again.
class ByTheImg(webapp2.RequestHandler):
    """ alternative approach when XMLHttpRequest is a hassle """
    def get(self):
        btw_activity(self, "/bytheimg", self.request)
        # hex values for a 4x4 transparent PNG created with GIMP:
        imgstr = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x04\x00\x00\x00\x04\x08\x06\x00\x00\x00\xa9\xf1\x9e\x7e\x00\x00\x00\x06\x62\x4b\x47\x44\x00\xff\x00\xff\x00\xff\xa0\xbd\xa7\x93\x00\x00\x00\x09\x70\x48\x59\x73\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07\x74\x49\x4d\x45\x07\xdd\x0c\x02\x11\x32\x1f\x70\x11\x10\x18\x00\x00\x00\x0c\x69\x54\x58\x74\x43\x6f\x6d\x6d\x65\x6e\x74\x00\x00\x00\x00\x00\xbc\xae\xb2\x99\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa0\x1c\x00\x00\x00\x44\x00\x01\x06\xc0\x57\xa2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"
        img = images.Image(imgstr)
        img.resize(width=4, height=4)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)


class BounceHandler(BounceNotificationHandler):
  def receive(self, notification):  # BounceNotification class instance
      logging.info("BouncedEmailHandler called")
      emaddr = notification.original['to']
      logging.info("BouncedEmailHandler emaddr: " + emaddr)
      # this uses the same access indexing as moracct.py MailCredentials
      where = "WHERE email=:1 LIMIT 9"
      accounts = MORAccount.gql(where, emaddr)
      for account in accounts:
          bouncestr = nowISO()
          if account.mailbounce:
              bouncestr = account.mailbounce + "," + bouncestr
          account.mailbounce = bouncestr
          account.put()


app = webapp2.WSGIApplication([('.*/botids', ReturnBotIDs),
                               ('.*/activity', UserActivity),
                               ('/_ah/bounce', BounceHandler)], debug=True)

