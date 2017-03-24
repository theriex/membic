import webapp2
import datetime
from google.appengine.ext import db
import logging
import pen
import rev
import moracct
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
        descr = message.subject
        url = ""
        for bodtype, body in message.bodies():
            if not url:
                if bodtype == 'text/html':
                    body = body.decode()
                if not url:
                    mo = re.search(r"https?://.*", body)
                    if mo:
                        url = mo.group()
        if not url:
            logging.warn("Mail-in membic from " + emaddr + 
                         " with no url ignored.")
            return
        if not descr:
            logging.warn("Mail-in membic from " + emaddr + 
                         " with no description ignored.")
            return
        vq = VizQuery(moracct.MORAccount, "WHERE email=:1 LIMIT 1", emaddr)
        found = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(found) == 0:
            logging.warn("Mail-in membic: No account found for " + emaddr)
            return
        acc = found[0]
        vq = VizQuery(pen.PenName, "WHERE mid=:1 LIMIT 1", acc.key().id())
        found = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(found) == 0:
            logging.warn("Mail-in membic: No PenName found for " + emaddr)
            return
        pn = found[0]
        mim = rev.Review(penid=pn.key().id(), 
                         revtype='article',
                         ctmid=0,
                         rating=0,
                         srcrev=-101,
                         mainfeed=0,
                         cankey="")
        rev.note_modified(mim)
        mim.keywords = ""
        mim.text = descr
        mim.penname = pn.name
        mim.name = ""
        mim.title = ""
        mim.url = url
        mim.put()
        # force retrieval to ensure subsequent db queries find it
        mim = rev.Review.get_by_id(mim.key().id())
        # not in top and not in main, so those caches are left intact
        logging.info("Successfully recorded new mail-in membic " + 
                     str(mim.key().id()) + " from " + emaddr +
                     " url: " + mim.url + ", text: " + mim.text)



app = webapp2.WSGIApplication([('.*/botids', ReturnBotIDs),
                               ('.*/activity', UserActivity),
                               ('/_ah/bounce', BounceHandler),
                               ('/_ah/mail/.+', InMailHandler)], debug=True)

