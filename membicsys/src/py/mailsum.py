import webapp2
import datetime
from google.appengine.ext import db
import logging
import pen
import rev
import moracct
import consvc
from morutil import *
from google.appengine.api import mail
from google.appengine.api.logservice import logservice
from google.appengine.api import images
from google.appengine.ext.webapp.mail_handlers import BounceNotification
from google.appengine.ext.webapp.mail_handlers import BounceNotificationHandler
from google.appengine.ext.webapp.mail_handlers import InboundMailHandler
import textwrap
from cacheman import *
import re
import json
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


def send_pending_membic_mail(pname, pm):
    acc = moracct.MORAccount.get_by_id(pname.mid)
    subj = "Your mail-in membic is pending"
    body = "Click here to post: https://membic.org?am=mid&an=" + acc.email +\
           "&at=" + moracct.newtoken(acc.email, acc.password) +\
           "&view=pen&penid=" + str(pname.key().id()) + "&tab=memo&expid=" +\
           str(pm.key().id()) + "&action=edit\n\n" +\
           "You can see all your pending membics on the memo tab of your " +\
           "profile.\n\n" +\
           "Thanks for posting!\nEric (with help from automation)\n"
    moracct.mailgun_send(None, acc.email, subj, body)


max_pend_membic_rmndr_d = 40

def send_pending_membic_reminder(pm):
    pname = pen.PenName.get_by_id(pm.penid)
    reminder_schedule = [2, 4, 7, 14, 30]
    stash = moracct.safe_json_loads(pname.stash)
    if "mimrem" not in stash:
        stash["mimrem"] = {}
    srk = "mim" + str(pm.key().id())
    remsent = stash["mimrem"].pop(srk, "")  # fetch and remove entry or ""
    modt = ISO2dt(pm.modified)
    thresh = dt2ISO(modt + datetime.timedelta(days=max_pend_membic_rmndr_d))
    now = nowISO()
    if now > thresh:
        return "Too old to remind about"
    prevcount = 0
    for daycount in reminder_schedule:
        ps = dt2ISO(modt + datetime.timedelta(days=prevcount))
        pe = dt2ISO(modt + datetime.timedelta(days=daycount))
        period_active = ps <= now and pe >= now
        reminder_active = ps <= remsent and pe >= remsent
        if period_active and reminder_active:
            return str(daycount) + " day reminder already sent"
        prevount = daycount
    send_pending_membic_mail(pname, pm)
    stash["mimrem"][srk] = now
    pname.stash = json.dumps(stash)
    cached_put(pname)
    return "Sent pending membic reminder"


def make_pending_membic(penid, mailsubj, mailbody, mailto):
    # A mail-in membic is expected to have a url, but it's not required.
    # Not remotely possible to replicate the interactive smarts so don't.
    # Use a clear format for the interactive processing to start from.
    mim = rev.Review(penid=int(penid),
                     revtype='article',  # most mail-in membics are articles
                     ctmid=0,
                     rating=0,
                     srcrev=-101,
                     mainfeed=0,
                     cankey="")
    rev.note_modified(mim)
    mim.keywords = ""
    mim.name = ""
    mim.title = ""
    mim.url = ""
    # Exact text format matched by review.js isMailInMembic
    mim.text = "Mail sent to " + mailto + " received " + mim.modified +\
               "\nSubject: " + mailsubj +\
               "\nBody: " + mailbody
    mim.put()
    # force retrieval to ensure subsequent db queries find the new instance
    mim = rev.Review.get_by_id(mim.key().id())
    # not in top and not in main, so those caches are left intact
    logging.info("Future membic " + str(mim.key().id()) + 
                 " created for PenName " + str(penid))
    send_pending_membic_reminder(mim)
    return "Pending membic created"


def send_theme_post_reminder(pn, mrt, numthemes):
    td = datetime.datetime.utcnow() - ISO2dt(mrt["lastpost"])
    subj = "Read any memorable articles?"
    body = "Hi " + pn.name + ",\n\n"
    body += "You haven't posted to " + mrt["name"]
    if numthemes > 1:
        body += ", or any of your themes,"
    body += " in over " + str(td.days) + " days."
    body += " Read any memorable articles recently?\n\n"
    body += "On your phone:\n"
    body += "1. Add membic.org to your home screen\n"
    body += "2. Copy any article link and paste it to write a membic.\n\n"
    body += "Happy theme building,\nEric (with help from automation)\n"
    acc = moracct.MORAccount.get_by_id(pn.mid)
    logging.info("send_theme_post_reminder " + pn.name + " " + 
                 str(pn.key().id()) + " " + acc.email + ":\nSubject: " +
                 subj + "\nBody: " + body)
    # TODO: Remove this debug line and send to the pen rather than support
    #       after the reminder process verified stable
    body = "PenName " + str(pn.key().id()) + " " + acc.email + "\n" + body
    moracct.mailgun_send(None, "membicsystem@gmail.com", subj, body)


def already_reminded(pn, mrt):
    # reminders are relative to your last post, not your last access.
    # logging in is much better than not logging in, but this is about
    # theme content irrespective of browsing.
    now = nowISO()
    dtacc = ISO2dt(mrt["lastpost"])
    schedule = [7, 14, 30, 60]
    thresh = dt2ISO(dtacc + datetime.timedelta(schedule[-1] + 2))
    if thresh < now:
        return "Outside schedule bounds"
    for days in schedule:
        rtag = "reminder" + str(days)
        if rtag in mrt and mrt[rtag] < mrt["lastpost"]:
            mrt[rtag] = ""  # reset due to more recent account access
    for days in schedule:
        thresh = dt2ISO(dtacc + datetime.timedelta(days))
        if thresh > now:
            return str(days) + " day reminder not due yet"
        if rtag not in mrt or not mrt[rtag]:
            mrt[rtag] = now  # note we are sending this reminder
            return False     # go send it
        # otherwise check if the next one is due..
    return "Past reminder schedule"
    

def send_reminders(pn):
    settings = moracct.safe_json_loads(pn.settings)
    if "contactprefs" in settings:
        prefs = settings["contactprefs"]
        if "reminders" in prefs and prefs["reminders"] == "no":
            return "Reminders disabled"
    stash = moracct.safe_json_loads(pn.stash)
    mrt = None
    numthemes = 0
    for key in stash.keys():
        if key.startswith("ctm"):
            theme = stash[key]
            if theme["lastpost"]:
                numthemes += 1
                if not mrt or theme["lastpost"] < mrt["lastpost"]:
                    mrt = theme
    if not mrt:
        return "No theme posts"
    rem = already_reminded(pn, mrt)
    if rem:
        return rem
    logging.info("send_reminders reminding " + pn.name)
    send_theme_post_reminder(pn, mrt, numthemes)
    pn.stash = json.dumps(stash)  # capture any reminder notes
    cached_put(pn)
    return "Sent reminder"
    

def remind_offline_pens():
    offmin = 4      # min days offline to qualify for a reminder
    offmax = 100    # max days offline before considered dead
    mfetch = 500    # max size of reminder pool
    dtnow = datetime.datetime.utcnow()
    threshmin = dt2ISO(dtnow - datetime.timedelta(offmin))
    threshmax = dt2ISO(dtnow - datetime.timedelta(offmax))
    stat = "Checking offline between " + threshmin + " and " + threshmax + "\n"
    vq = VizQuery(pen.PenName, "WHERE accessed < :1 ORDER BY accessed DESC",
                  threshmin)
    pns = vq.fetch(mfetch, read_policy=db.EVENTUAL_CONSISTENCY, deadline=180)
    for idx, pn in enumerate(pns):
        # logging.info("remind_offline_pens: " + pn.name);
        if pn.accessed < threshmax:
            break  # this pen and everyone else following is gone
        stat += str(pn.key().id()) + " " + pn.name + ": " +\
                send_reminders(pn) + "\n"
    return stat


def remind_pending_membics():
    stat = ""
    delta = datetime.timedelta(days=max_pend_membic_rmndr_d)
    modthresh = dt2ISO(datetime.datetime.utcnow() - delta)
    where = "WHERE srcrev = -101 AND modified > :1 ORDER BY modified DESC"
    vq = VizQuery(rev.Review, where, modthresh)
    ms = vq.fetch(500, read_policy=db.EVENTUAL_CONSISTENCY, deadline=180)
    for membic in ms:
        stat += str(membic.key().id()) + ": " +\
                send_pending_membic_reminder(membic) + "\n"
    return stat


def note_inbound_mail(message):
    mailfrom = message.sender
    mailto = message.to
    mailsubj = ""
    if hasattr(message, "subject"):
        mailsubj = message.subject
    mailbody = ""
    for bodtype, body in message.bodies():
        if bodtype == 'text/html':
            mailbody = body.decode()
        if mailbody:
            break
    logging.info("Received mail from " + mailfrom + " to " + mailto +
                 " subject: " + mailsubj[0:512] + 
                 "\nbody: " + mailbody[0:512])
    return mailfrom, mailto, mailsubj, mailbody


def find_penid_from_consvc(emaddr):
    svc = consvc.get_connection_service("MailIn")
    empens = csv_list(svc.data)
    for empen in empens:
        empen = empen.strip()
        address, penid = empen.split(":")
        if address == emaddr:
            return penid
    logging.info("No MailIn ConnectionService mapping for " + emaddr)
    return None


def find_penid_from_email(emaddr):
    account = get_cached_instance(emaddr)
    if not account or not isinstance(account, moracct.MORAccount):
        account = None
        vq = VizQuery(moracct.MORAccount, "WHERE email=:1 LIMIT 1", emaddr)
        accounts = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(accounts) > 0:
            account = accounts[0]
    if not account:
        logging.info("No account found for " + emaddr)
        return None
    # similar logic to pen.find_auth_pens
    if account.lastpen:
        return account.lastpen
    account._id = account.key().id() # normalized id access
    pens = pen.query_for_auth_pens(account, "mid")
    if not pens or len(pens) == 0:
        logging.info("No PenName found for " + emaddr)
        return None
    return pens[0].key().id()


def find_penid_for_email_address(emaddr):
    # emaddr = "Some Person <whoever@example.com>"
    match = re.search(r'[\w.-]+@[\w.-]+', emaddr)
    if match:
        emaddr = match.group()
    else:
        return None
    emaddr = moracct.normalize_email(emaddr)
    # search individual accounts first, no hijacking addresses via mappings.
    penid = find_penid_from_email(emaddr) or find_penid_from_consvc(emaddr)
    return penid


class ReturnBotIDs(webapp2.RequestHandler):
    def get(self):
        csv = ",".join(bot_ids)
        moracct.writeJSONResponse("[{\"botids\":\"" + csv +  "\"}]", 
                                  self.response)


class UserActivity(webapp2.RequestHandler):
    def get(self):
        daysback = 70  # 10 weeks back
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(daysback))
        vq = VizQuery(ActivityStat, "WHERE day > :1", thresh)
        stats = vq.run(read_policy=db.EVENTUAL_CONSISTENCY,
                       batch_size=daysback)
        moracct.returnJSON(self.response, stats)


class PeriodicProcessing(webapp2.RequestHandler):
    def get(self):
        body = "Periodic processing status messages:\n"
        body += "---- Offline pen reminders: ----\n"
        body += remind_offline_pens()
        body += "---- Pending membic reminders: ----\n"
        body += remind_pending_membics()
        subj = "PeriodicProcessing status messages"
        moracct.mailgun_send(None, "membicsystem@gmail.com", subj, body)
        body += "\nPeriodicProcessing completed."
        moracct.writeTextResponse(body, self.response)


class BounceHandler(BounceNotificationHandler):
  def receive(self, notification):  # BounceNotification class instance
      logging.info("BouncedEmailHandler called")
      emaddr = notification.original['to']
      logging.info("BouncedEmailHandler emaddr: " + emaddr)
      # this uses the same access indexing as moracct.py MailCredentials
      vq = VizQuery(moracct.MORAccount, "WHERE email=:1 LIMIT 9", emaddr)
      accounts = vq.fetch(9, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
      for account in accounts:
          bouncestr = nowISO()
          if account.mailbounce:
              bouncestr = account.mailbounce + "," + bouncestr
          account.mailbounce = bouncestr
          account.put()


class InMailHandler(InboundMailHandler):
    def receive(self, message):
        mailfrom, mailto, mailsubj, mailbody = note_inbound_mail(message)
        if not mailsubj and not mailbody:
            logging.info("No subject or body, nothing to make a membic out of.")
            return
        # if needed, potentially reject anything too wordy at this point
        penid = find_penid_for_email_address(mailfrom)
        if not penid:
            return    # lookup failures already logged
        logging.info("Mail from " + mailfrom + " mapped to pen " + str(penid))
        stat = make_pending_membic(penid, mailsubj, mailbody, mailto)
        logging.info("InMailHandler: " + stat)


app = webapp2.WSGIApplication([('.*/botids', ReturnBotIDs),
                               ('.*/activity', UserActivity),
                               ('.*/periodic', PeriodicProcessing),
                               ('/_ah/bounce', BounceHandler),
                               ('/_ah/mail/.+', InMailHandler)], debug=True)

