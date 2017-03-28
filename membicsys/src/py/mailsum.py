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


def make_future_membic(penid, url, txt1, txt2):
    mim = rev.Review(penid=int(penid),
                     revtype='article',
                     ctmid=0,
                     rating=0,
                     srcrev=-101,
                     mainfeed=0,
                     cankey="")
    rev.note_modified(mim)
    mim.keywords = ""
    mim.name = ""
    mim.title = ""
    mim.url = url
    # if both txt1 and txt2 still have values, then neither had just the
    # url. Use the shorter one for the title and the other for the description.
    if txt1 and txt2:
        if len(txt2) > len(txt1):
            mim.name = txt1
            mim.title = txt1
            mim.text = txt2
        else:
            mim.name = txt2
            mim.title = txt2
            mim.text = txt1
    # otherwise put whatever text is available in the description.
    else:
        mim.text = txt1 or txt2
    mim.put()
    # force retrieval to ensure subsequent db queries find the new instance
    mim = rev.Review.get_by_id(mim.key().id())
    # not in top and not in main, so those caches are left intact
    logging.info("New future membic created for PenName " + str(penid) +
                 " url: " + url + ", title: " + mim.title + 
                 ", text: " + mim.text)


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
    # cannot replicate the interactive smarts, so make a future membic
    # that can be fleshed out next time they are online.
    def receive(self, message):
        emaddr = message.sender
        subj = ""
        if hasattr(message, "subject"):
            subj = message.subject
        body = ""
        for bodtype, body in message.bodies():
            if bodtype == 'text/html':
                body = body.decode()
            if body:
                break
        url = ""
        # Can't match on beginning of line because there might be some space
        # or other prefixing there and this should be forgiving. Example:
        # "check out http://membic.com it totally rocks!"
        # Do want to pull the url out if found though, otherwise the user
        # would need to edit it out manually later.
        rem = re.compile("https?://[^\s$]*")
        mo = rem.search(subj)
        if mo:
            url = mo.group()
            subj = "".join(rem.split(subj)).strip()
        if not url:
            mo = rem.search(body)
            if mo:
                url = mo.group()
                body = "".join(rem.split(body)).strip()
        if not (url or subj or body):
            logging.warn("Mail-in membic from " + emaddr + 
                         " with no content ignored.")
            return
        svc = consvc.get_connection_service("MailIn")
        empens = csv_list(svc.data)
        accepted = False
        for empen in empens:
            address, penid = empen.split(":")
            if address == emaddr:
                accepted = True
                logging.info("Mail-in membic from " + address + 
                             " mapped to PenName " + penid + ". " + url +
                             ", subj: " + subj + ", body: " + body)
                make_future_membic(penid, url, subj, body)
                break
        if not accepted:
            logging.info("No mail-in mapping for " + emaddr);


app = webapp2.WSGIApplication([('.*/botids', ReturnBotIDs),
                               ('.*/activity', UserActivity),
                               ('/_ah/bounce', BounceHandler),
                               ('/_ah/mail/.+', InMailHandler)], debug=True)

