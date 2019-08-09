import webapp2
import datetime
from google.appengine.ext import db
import logging
import rev
import coop
import muser
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


class MailNotice(db.Model):
    """ Broadcast email notice tracking to avoid duplicate sends """
    name = db.StringProperty(required=True)  # query access identifier
    subject = db.TextProperty()    # the email subject for ease of reference
    uidcsv = db.TextProperty()     # a csv of MUser ids that were sent to
    lastupd = db.StringProperty()  # isodate of last recorded send


#substrings identifying web crawler agents.  No embedded commas.
bot_ids = ["AhrefsBot", "Baiduspider", "ezooms.bot",
           "netvibes.com", # not really a bot, but not a really a hit either
           "AppEngine-Google", "Googlebot", "YandexImages", "crawler.php"]


# Looking up URL information server side usually fails - either completely,
# or poisonously with bad info.  It is not possible to fill out membic
# details here in any way that is equivalent to what can be done
# interactively.  The mailbody can be garbled HTML, and may include a sig
# that should probably not be globally published.  While it is possible to
# consume lines from the message body guessing if each is describing a
# rating, keywords, or names of themes, that's also a bad idea.  Typos
# degrade search, and automatically posting a highly sketchy membic through
# to a theme makes membic look bad.  The only safe thing to do is a clear
# and reliable mail-in, followed by an interaction.  Accept format:
#     subject: Why this link is important
#     body: first url found gets used
# Anything else that is sent will also be available in their receipt mail for
# reference when they are editing later.
def make_mailin_membic(acc, mailsubj, mailbody):
    murl = ""
    match = re.search(r'https?://\S+', mailbody)
    if match:
        murl = match.group()
    mim = rev.Review(revtype='article',  # most mail-in membics are articles
                     penid=acc.key().id(),
                     ctmid=0,
                     rating=60,  # default to average
                     srcrev=0,
                     mainfeed=0,
                     cankey="",
                     keywords="",
                     text=mailsubj,
                     altkeys="",
                     svcdata="",
                     penname=acc.name,
                     name="",
                     title=murl,
                     url=murl,
                     rurl="",
                     artist="",
                     author="",
                     publisher="",
                     album="",
                     starring="",
                     address="",
                     year="")
    rev.note_modified(mim)  # sets modified, modhist
    rev.set_review_dispafter(mim, acc)  # check queuing
    mim.put()
    return mim;


def send_mailin_receipt(acc, mim, mailsubj, mailbody):
    subj = "Membic created: " + mailsubj
    body = "Membic " + str(mim.key().id()) + " created.\n" +\
           "URL: " + mim.url + "\n" +\
           "Why Memorable: " + mailsubj + "\n" +\
           "\n" +\
           "To add detail or edit, go to https://membic.org?an=" + acc.email +\
           "&at=" + muser.token_for_user(acc) + "\n" +\
           "\n" +\
           "For your reference, here is what you mailed in:\n\n" +\
           mailbody
    muser.mailgun_send(None, acc.email, subj, body)


class MembicSummary(object):
    membicid = 0
    penid = ""
    verb = "created"
    title = ""
    url = ""
    text = ""
    ctmcsv = ""
    def __init__(self, membic, postctms):
        # postctms is a list of {ctmid, name, revid} dicts
        self.membicid = membic.key().id()
        self.penid = str(membic.penid)
        if membic.modified > membic.modhist:
            logging.info("mod: " + membic.modified + ", mhi: " + membic.modhist)
            self.verb = "updated"
        self.title = membic.name or membic.title
        self.url = membic.url
        self.text = membic.text
        self.ctmcsv = ""
        for pc in postctms:
            self.ctmcsv = append_to_csv(pc["ctmid"], self.ctmcsv)


class PostingSummary(object):
    portob = None   # Coop or MUser object
    membics = None  # List of MembicSummary instances for recent posts
    penids = ""     # CSV of penids receiving notices for this theme/profile
    def __init__(self, portob):
        self.portob = portob
        self.membics = []
        self.penids = ""


class RecipientSummary(object):
    penid = ""
    name = ""
    emaddr = ""
    def __init__(self, penid, name="", emaddr=""):
        self.penid = str(penid)
        self.name = name
        self.emaddr = emaddr


def fetch_daily_notice_membics():
    """ Returns a list of recent source membics """
    now = datetime.datetime.utcnow().replace(microsecond=0,second=0,minute=30)
    yesterday = dt2ISO(now - datetime.timedelta(1))
    earliest = dt2ISO(now - datetime.timedelta(6))
    now = dt2ISO(now)
    membics = []
    # Not worth a new index just for this traversal.  Walk using standard:
    where = "WHERE ctmid = 0 AND modified > :1 ORDER BY modified DESC"
    vq = VizQuery(rev.Review, where, earliest)
    ms = vq.fetch(4000, read_policy=db.EVENTUAL_CONSISTENCY, deadline=2000)
    for membic in ms:
        if membic.srcrev < 0:
            continue   # ignore future, batch, deleted etc
        if membic.modified > now:
            continue   # send with tomorrow's notifications
        if membic.dispafter > now:
            continue   # don't notify if still future queued
        if membic.modified < yesterday:  # past normal retrieval window
            if not membic.dispafter:
                continue  # not queued, just old
            if membic.dispafter < yesterday:
                continue  # already notified previously
        svcdata = json.loads(membic.svcdata or "{}")
        postctms = svcdata["postctms"] or []
        membics.append(MembicSummary(membic, postctms))
    times = {"now": now, "since": yesterday, "earliest": earliest}
    return times, membics


# If a membic is posted to more than one theme, that should be shown because
# it's good to know when something is cross posted.
def post_summaries_for_membics(membic_summaries):
    """ Returns a dict of PostingSummary instances accessed by container id """
    pss = {}
    for msum in membic_summaries:
        # logging.info("Building summaries for " + msum.title)
        # logging.info("tids: " + msum.ctmcsv)
        for tidstr in csv_list(msum.ctmcsv):
            if tidstr not in pss:
                theme = coop.Coop.get_by_id(int(tidstr))
                if theme:
                    pss[tidstr] = PostingSummary(theme)
            if tidstr in pss:
                # logging.info("Appending to " + pss[tidstr].portob.name)
                pss[tidstr].membics.append(msum)
        # Add a summary for the profile to notify any direct followers
        if msum.penid not in pss:
            prof = muser.MUser.get_by_id(int(msum.penid))
            if prof:
                pss[msum.penid] = PostingSummary(prof)
        if msum.penid in pss:
            pss[msum.penid].membics.append(msum)
    return pss


# For any given posting id (Coop or MUser id), this will create one summary
# for each recipient that should be notified.
def recipient_summaries_for_posts(pss):
    rss = {}
    for key in pss:
        tp = pss[key]
        if tp.portob.key().kind() == "Coop":
            penids = csv_list(tp.portob.founders)
            penids.extend(csv_list(tp.portob.moderators))
            penids.extend(csv_list(tp.portob.members))
            tp.penids = list_to_csv(penids)
            for penid in penids:
                if penid not in rss:
                    # email and name for stub summary filled out below
                    rss[penid] = RecipientSummary(penid, key)
    # Followers have to be found by iterating through current active users.
    # Go back around 18 months to maximize the chance of pinging stragglers.
    since = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(545))
    where = "WHERE lastwrite > :1 ORDER BY lastwrite DESC"
    vq = VizQuery(muser.MUser, where, since)
    pns = vq.run(read_policy=db.EVENTUAL_CONSISTENCY, deadline=4000, 
                 batch_size=2000)
    for pn in pns:
        penid = str(pn.key().id())
        cd = json.loads(pn.coops or "{}")
        for ctmid in pss:
            if ctmid in cd and cd[ctmid] == -1:  # following theme or profile
                # note penid as theme/profile notice recipient
                pss[ctmid].penids = append_to_csv(penid, pss[ctmid].penids)
                # set overall recipient summary info
                rss[penid] = RecipientSummary(penid, pn.name, pn.email)
        if penid in rss and not rss[penid].emaddr:  # fill out the summary
            rss[penid].emaddr = pn.email
            rss[penid].name = pn.name
    return rss


def error_check_recipient_fields(recip):
    if not recip.emaddr:
        acc = muser.MUser.get_by_id(int(recip.penid))
        if not acc:
            return "No MUser found for penid " + recip.penid
        recip.emaddr = acc.email
    return None


def summary_url(ts):
    # The standalone URL won't have the login or top controls so use
    # the parameterized form.
    ptid = str(ts.portob.key().id())
    url = "https://membic.org?view=coop&coopid=" + ptid
    if ts.portob.key().kind() == "MUser":
        url = "https://membic.org?view=profile&profid=" + ptid
    return url


def send_recent_membics_notice(recip, pss):
    # These notice emails may be forwarded, so don't include any access token
    subj = "New Membics you are following"
    head = "Hi " + recip.name + ",\n\n"
    head += "There are new membics posted to themes and profiles you are following:\n\n"
    body = ""
    tcount = 0
    mcount = 0
    for tskey in pss:
        ttb = ""
        ts = pss[tskey]
        for ms in ts.membics:
            if ms.penid in ts.penids and ms.penid != recip.penid:
                mcount += 1
                if not ttb:
                    tcount += 1
                    ttb = ts.portob.name + " (" + summary_url(ts) + ")\n\n"
                if ms.verb == "updated":
                    ttb += "(Updated) "
                ttb += ms.title + "\n"
                if ms.url:
                    ttb += ms.url + "\n"
                ttb += ms.text + "\n\n"
        body += ttb  # append theme summary text (if any created)
    if not body:
        return recip.name + ": No notices\n"
    # Theme notice email might be forwarded so no tokens in the url
    foot = "You are receiving this notice because you are following profiles and themes on https://membic.org.  If you feel you have received this notice in error, or to report any problems with the content, please forward this notice and your comments to support@membic.org\n\n"
    try:
        muser.mailgun_send(None, recip.emaddr, subj, head + body + foot)
    except Exception as e:
        logging.warn("send_recent_membics_notice to " + recip.emaddr +
                     " failed: " + str(e) + ". subj: " + subj + 
                     ", body: " + body)
    return recip.name + ": " + str(mcount) + " notices, " +\
        str(tcount) + " themes\n"
        

def stat_summary_of_post_summaries(pss):
    stat = "Postings (indexed by Coop/MUser id):\n"
    for key in pss:
        ps = pss[key]
        stat += "  " + ps.portob.name + ": " + str(len(ps.membics)) + "\n"
        for membic in ps.membics:
            stat += "  - " + membic.url + "\n"
            stat += "    " + membic.text + "\n"
    return stat


def stat_summary_of_recipient_summaries(rss):
    stat = "Recipients (indexed by MUser id):\n"
    for key in rss:
        rs = rss[key]
        stat += "  " + rs.emaddr + " " + rs.name + "\n"
    return stat


def recent_membic_notices():
    times, ms = fetch_daily_notice_membics()  # build MembicSummary list
    stat = str(len(ms)) + " membics since yesterday " + times["since"] + "\n"
    if len(ms):
        pss = post_summaries_for_membics(ms)
        stat += stat_summary_of_post_summaries(pss)
        rss = recipient_summaries_for_posts(pss)
        stat += stat_summary_of_recipient_summaries(rss)
        for key in rss:
            recip = rss[key]
            err = error_check_recipient_fields(recip)
            if err:
                stat += err + "\n"
                continue
            stat += send_recent_membics_notice(recip, pss)
    return stat


def note_inbound_mail(message):
    mailfrom = message.sender
    mailto = message.to
    mailsubj = ""
    if hasattr(message, "subject"):
        mailsubj = message.subject
    textbody = ""
    htmlbody = ""
    for bodtype, body in message.bodies():
        # HTML bodies are returned first, then plain text bodies.  Docs say
        # to decode if bodtype == 'text/html' but apparently plain text also
        # needs to be decoded.
        if bodtype == 'text/html':
            textbody = body.decode()
        elif bodtype == 'text/plain':
            htmlbody = body.decode()
    mailbody = textbody or htmlbody
    logging.info("Received mail from " + mailfrom + " to " + mailto +
                 " subject: " + mailsubj[0:512] + 
                 "\nbody: " + mailbody[0:512])
    return mailfrom, mailto, mailsubj, mailbody


def acc_for_mailin_address(emaddr):
    # emaddr = "Some Person <whoever@example.com>"
    match = re.search(r'[\w.-]+@[\w.-]+', emaddr)
    if match:
        emaddr = match.group()
    else:
        return None
    emaddr = muser.normalize_email(emaddr)
    # search actual accounts first.  No hijacking by listing an authorized
    # mail-in address for an account that exists separately.
    acc = muser.account_from_email(emaddr)
    if not acc:
        logging.info("No match on MUser.email " + emaddr)
        where = "WHERE altinmail=:1 LIMIT 1"
        vq = VizQuery(muser.MUser, where, emaddr)
        qres = cached_query(emaddr, vq, "", 1, muser.MUser, True)
        if len(qres.objects) > 0:
            acc = qres.objects[0]
    return acc


def get_mail_notice(mnm):
    vq = VizQuery(MailNotice, "WHERE name = :1 LIMIT 1", mnm)
    qres = cached_query(mnm, vq, "", 1, MailNotice, False)
    for mno in qres.objects:
        return mno
    # no existing mail notice with the given name, create one for use
    mno = MailNotice(name=mnm, subject="", uidcsv="", lastupd=nowISO())
    cached_put(mno)
    reset_cached_query(mnm)
    return mno


class ReturnBotIDs(webapp2.RequestHandler):
    def get(self):
        csv = ",".join(bot_ids)
        srvJSON(self, "[{\"botids\":\"" + csv +  "\"}]")


class PeriodicProcessing(webapp2.RequestHandler):
    # Normally called from cron.yaml 30 minutes before quota reset. That
    # might look like an odd time from the local server perspective, but
    # since this is a query load it makes sense to be close to reset.
    def get(self):
        body = "Periodic processing status messages:\n"
        body += "---- Recent membic notifications: ----\n"
        body += recent_membic_notices()
        # mail the accumulated messages to support
        subj = "PeriodicProcessing status messages"
        try:
            muser.mailgun_send(None, "membicsystem@gmail.com", subj, body)
        except:
            logging.info(subj + "\n\n" + body)
            raise
        body += "\nPeriodicProcessing completed."
        srvText(self, body)


class SendNotices(webapp2.RequestHandler):
    def get(self):
        mno = get_mail_notice("muserconversion")
        prevrecips = []
        newrecips = []
        mno.subject = "Your membic.org account has been converted"
        msgbody = """
Hi $NAME,

Your existing account on membic.org has been converted as part of increased performance and security updates.  There have been no issues reported, but you are invited to update your password just for good measure.  To update your password, go to https://membic.org?an=$EMAIL&at=$TOKEN and click the settings icon, then select Personal Info.

While you are visiting, you can find info on cool ways to use membic.org off the Themes page by clicking "more info".  I hope you will find the updated site to be the perfect solution for tracking your memorable links, both on your own and collaboratively.  If you have any questions/concerns/suggestions, just reply to this email.

Thanks for supporting this open source project,
Eric

"""
        vq = VizQuery(muser.MUser, "")
        users = vq.run(read_policy=db.EVENTUAL_CONSISTENCY, deadline=60,
                       batch_size=1000)
        for user in users:
            body = msgbody
            body = body.replace("$NAME", user.name)
            body = body.replace("$EMAIL", user.email)
            body = body.replace("$TOKEN", muser.token_for_user(user))
            uid = str(user.key().id())
            if csv_contains(uid, mno.uidcsv):
                prevrecips.append(user.email + "(" + uid + ")")
                continue  # already sent
            muser.mailgun_send(self, user.email, mno.subject, body)
            mno.uidcsv = append_id_to_csv(uid, mno.uidcsv)
            cached_put(mno)  # remember we sent it in case anything happens
            newrecips.append(user.email + "(" + uid + ")")
        srvText(self, "SendNotices " + mno.name + " " + str(len(newrecips)) +
                " emails sent: " + ", ".join(newrecips) +
                "\nPreviously sent: " + ", ".join(prevrecips))


# sweep users first so themes are latest
class SweepPrebuilt(webapp2.RequestHandler):
    def get(self):
        maxPerSweep = 20  # run repeatedly to get everything, db quotas...
        msgs = []
        clear = False
        vq = VizQuery(muser.MUser, "")
        users = vq.run(read_policy=db.STRONG_CONSISTENCY, deadline=60,
                       batch_size=1000)
        for user in users:
            if len(msgs) > maxPerSweep:
                break
            if clear and user.preb:
                user.preb = ""
                msgs.append("Cleared MUser.preb " + str(user.key().id()) +
                            " " + user.email)
                cached_put(user)
            elif not clear and not user.preb:
                rev.rebuild_prebuilt(user, None)
                msgs.append("Rebuilt MUser.preb " + str(user.key().id()) +
                            " " + user.email)
        vq = VizQuery(coop.Coop, "")
        themes = vq.run(read_policy=db.STRONG_CONSISTENCY, deadline=60,
                        batch_size=1000)
        for theme in themes:
            if len(msgs) > maxPerSweep:
                break
            if clear and theme.preb:
                theme.preb = ""
                msgs.append("Cleared Coop.preb " + str(theme.key().id()) +
                            " " + theme.name)
                cached_put(theme)
            elif not clear and not theme.preb:
                rev.rebuild_prebuilt(theme, None)
                msgs.append("Rebuilt Coop.preb " + str(theme.key().id()) +
                            " " + theme.name)
        if len(msgs) > maxPerSweep:
            msgs.append("SweepPrebuilt pass completed, run again")
        else:
            msgs.append("SweepPrebuilt completed")
        srvText(self, "\n".join(msgs))


class TechSupportHelp(webapp2.RequestHandler):
    def get(self):
        emaddr = self.request.get("user") or ""
        suppurl = "No user found, emaddr: " + emaddr
        acc = None
        if emaddr:
            if "." in emaddr:  # @ may be escaped, look for domain dot
                acc = muser.account_from_email(emaddr)
            else:  # try looking up by id
                acc = muser.MUser.get_by_id(int(emaddr))
        if acc:
            suppurl = "https://membic.org?an=" + acc.email + "&at="
            suppurl += muser.token_for_user(acc)
        srvText(self, suppurl)


class BounceHandler(BounceNotificationHandler):
  def receive(self, notification):  # BounceNotification class instance
      emaddr = notification.original['to']
      logging.warn("Email bounce emaddr: " + emaddr)
      acc = muser.account_from_email(emaddr)
      if not acc:
          logging.info("No bounce account. notification: " + str(notification))
      else:
          if acc.mailbounce:
              acc.mailbounce += ","
          acc.mailbounce += nowISO()
          account.put()


class InMailHandler(InboundMailHandler):
    def receive(self, message):
        mailfrom, mailto, mailsubj, mailbody = note_inbound_mail(message)
        if not mailfrom:
            logging.info("No mailfrom found, nothing to do")
            return
        acc = acc_for_mailin_address(mailfrom)
        if not acc:
            logging.warn("InMailHandler apparent spam from " + mailfrom)
            return
        mim = make_mailin_membic(acc, mailsubj, mailbody)
        rev.rebuild_prebuilt(acc, mim)
        send_mailin_receipt(acc, mim, mailsubj, mailbody)


app = webapp2.WSGIApplication([('.*/botids', ReturnBotIDs),
                               ('.*/periodic', PeriodicProcessing),
                               ('.*/sendnote', SendNotices),
                               ('.*/prebsweep', SweepPrebuilt),
                               ('.*/supphelp', TechSupportHelp),
                               ('/_ah/bounce', BounceHandler),
                               ('/_ah/mail/.+', InMailHandler)], debug=True)

