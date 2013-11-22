import webapp2
import datetime
from google.appengine.ext import db
import logging
from pen import PenName
from rel import outbound_relids_for_penid
from rev import Review, review_activity_search
from moracct import MORAccount, dt2ISO, nowISO, ISO2dt, safestr, returnJSON
from statrev import getTitle, getSubkey
from google.appengine.api import mail
from google.appengine.api.logservice import logservice


class ActivityStat(db.Model):
    """ Activity metrics for tracking purposes """
    day = db.StringProperty(required=True)  # yyyy-mm-ddT00:00:00Z
    active = db.IntegerProperty()     # number of pens that logged in
    onerev = db.IntegerProperty()     # num pens that wrote at least one review
    tworev = db.IntegerProperty()     # num pens that wrote at least two reviews
    morev = db.IntegerProperty()      # num pens that wrote 3 or more reviews
    ttlrev = db.IntegerProperty()     # total reviews for the day
    names = db.TextProperty()         # ';' delimited pen names that logged in
    calculated = db.StringProperty()  # iso date when things were tallied up
    logttl = db.IntegerProperty()     # total log requests for the day
    botttl = db.IntegerProperty()     # total bot requests for the day
    logsecure = db.IntegerProperty()  # num requests for secure login page
    logstatic = db.IntegerProperty()  # num requests for statrev pages
    clickthru = db.IntegerProperty()  # num parameterized prof/rev requests
    statrefs = db.TextProperty()      # '#' delimited referrers for statrev reqs
    agents = db.TextProperty()        # '~' delimited accessing agents


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


def pen_stats():
    # calculate day window
    dtnow = datetime.datetime.utcnow()
    isostart = dt2ISO(dtnow - datetime.timedelta(hours=24))
    isostart = isostart[:10] + "T00:00:00Z"
    isoend = dt2ISO(dtnow)
    isoend = isoend[:10] + "T00:00:00Z"
    # init a default stat instance
    stat = ActivityStat(day=isostart)
    stat.active = 0
    stat.onerev = 0
    stat.tworev = 0
    stat.morev = 0
    stat.ttlrev = 0
    stat.names = ""
    # use existing stat if already available
    try:
        where = "WHERE day = :1"
        stats = ActivityStat.gql(where, isostart)
        for existing_stat in stats:
            stat = existing_stat
        if stat.calculated:
            return stats_text(stat)
    except Exception as e:
        logging.info("Existing stat retrieval failed: " + str(e))
    # calculate values for new stat instance
    stat.calculated = dt2ISO(dtnow)
    # do not restrict an upper bound for PenName retrieval, otherwise
    # anyone who has logged after midnight GMT will be excluded and
    # their login may never get counted if they log in again the next
    # day.  If they do not login the next day, they may be double
    # counted, but that's better than missed.
    where = "WHERE modified >= :1"
    pens = PenName.gql(where, isostart)
    for pen in pens:
        stat.active += 1
        where2 = "WHERE modified >= :1 AND modified < :2 AND penid = :3"
        revs = Review.gql(where2, isostart, isoend, pen.key().id())
        revcount = revs.count()
        if revcount > 0:
            stat.onerev += 1
        if revcount > 1:
            stat.tworev += 1
        if revcount > 2:
            stat.morev += 1
        stat.ttlrev += revcount
        if stat.names:
            stat.names += ";"
        stat.names += pen.name
    stat.put()
    return stats_text(stat)


def unix_time(dt):
    se = dt - datetime.datetime.utcfromtimestamp(0)
    return int(round(se.total_seconds()))


def is_known_bot(agentstr):
    bots = ["AhrefsBot", "Baiduspider", "ezooms.bot", 
            "netvibes.com",  # not really a bot, but not a really a hit either
            "AppEngine-Google"]
    for botstr in bots:
        if botstr in agentstr:
            return True
    return False


def log_stats():
    # calculate day window (identical logic as done by pen_stats)
    dtnow = datetime.datetime.utcnow()
    dtend = datetime.datetime(dtnow.year, dtnow.month, dtnow.day)
    dtstart = dtend - datetime.timedelta(hours=24)
    isostart = dt2ISO(dtstart)
    isostart = isostart[:10] + "T00:00:00Z"
    # retrieve existing stats instance already written by pen_stats
    stat = None
    try:
        where = "WHERE day = :1"
        stats = ActivityStat.gql(where, isostart)
        for existing_stat in stats:
            stat = existing_stat
    except Exception as e:
        logging.info("log_stats stat retrieval failed: " + str(e))
        return
    if not stat:
        logging.info("No stat instance available")
        return
    # init the stat fields we are using
    stat.logttl = 0
    stat.botttl = 0
    stat.logsecure = 0
    stat.logstatic = 0
    stat.clickthru = 0
    stat.agents = ""
    # iterate through matching log entries and update the stats
    agents = []
    refers = []
    prevagent = ""
    isbot = False
    for loge in logservice.fetch(start_time=unix_time(dtstart), 
                                 end_time=unix_time(dtend),
                                 minimum_log_level=logservice.LOG_LEVEL_INFO):
        stat.logttl += 1
        agent = loge.user_agent
        if agent != prevagent:
            prevagent = agent
            isbot = is_known_bot(agent)
            if not isbot and not agent in agents:
                agents.append(agent)
        if isbot:
            stat.botttl += 1
        else:  # actual user request
            if loge.resource == "/" and\
                    loge.host == "myopenreviews.appspot.com":
                stat.logsecure += 1
            elif loge.resource.startswith("/statrev/"):
                stat.logstatic += 1
                if loge.referrer and not loge.referrer in refers:
                    refers.append(loge.referrer)
            elif "view=profile&profid=" in loge.resource:
                stat.clickthru += 1
            elif "view=review&penid=" in loge.resource:
                stat.clickthru += 1
    stat.agents = "~".join(agents)
    stat.statrefs = "#".join(refers)
    return stat


def eligible_pen(acc, thresh):
    # eventually this will need to track and test bad email addresses also
    if not acc.email:
        return None
    # work off the most recently accessed pen authorized for this account
    latestpen = None
    where = "WHERE mid = :1 LIMIT 20"
    pens = PenName.gql(where, acc.key().id())
    for pen in pens:
        if not latestpen or latestpen.accessed < pen.accessed:
            latestpen = pen
    if latestpen and latestpen.accessed > thresh:
        if not "sumiflogin" in acc.summaryflags:
            latestpen = None
    return latestpen


def text_stars(review):
    stars = ["    - ",
             "    * ",
             "   ** ",
             "  *** ",
             " **** ",
             "***** "]
    index = review.rating / 20
    return stars[index]


def write_summary_email_body(pen, reviews, tstr, prs):
    body = "Experienced anything worth remembering recently? Your current" +\
        " and future followers would be interested in hearing from you!"
    if prs and len(prs) > 0:
        body = "Thanks for reviewing! Your current and future followers" +\
            " appreciate it."
    body += "\n\n"
    if not reviews or len(reviews) == 0:
        body += "Tragically, none of the people you are following have" +\
            " posted any reviews since " + tstr + ". Please do what you" +\
            " can to help them experience more things."
        return body
    body += "Since " + tstr + ", friends you are following have posted " +\
        str(len(reviews)) + " " +\
        ("reviews" if len(reviews) > 1 else "review") + "."
    body += "  For more details" +\
            " (or to change your account settings)" +\
            " go to http://www.wdydfun.com \n\n"
    revtypes = [["book",     "Books"], 
                ["movie",    "Movies"], 
                ["video",    "Videos"], 
                ["music",    "Music"],
                ["food",     "Food"], 
                ["drink",    "Drinks"], 
                ["activity", "Activities"], 
                ["other",    "Other"]]
    for revtype in revtypes:
        tline = "      -------------- " + revtype[1] + "---------------\n\n"
        wroteHeaderLine = False
        for review in reviews:
            if review.revtype == revtype[0]:
                if not wroteHeaderLine:
                    body += tline
                    wroteHeaderLine = True
                url = "http://www.wdydfun.com/statrev/" + str(review.key().id())
                keywords = safestr(review.keywords)
                if keywords:
                    keywords = "      " + keywords + "\n"
                body += text_stars(review) + getTitle(review) +\
                    " " + getSubkey(review) + "\n"
                body += "      review by " + str(review.penname) +\
                    " " + url + "\n"
                body += "      " + safestr(review.text) + "\n"
                body += keywords
                body += "\n"
    return body


def mail_summaries(freq, thresh, request, response):
    tstr = ISO2dt(thresh).strftime("%d %B %Y")
    subj = "Your wdydfun " + freq + " activity since " + tstr
    logsum = "----------------------------------------\n"
    logsum += "Mail sent for " + freq + " activity since " + tstr + "\n"
    where = "WHERE summaryfreq = :1 AND lastsummary < :2"
    accs = MORAccount.gql(where, freq, thresh)
    for acc in accs:
        logmsg = "username: " + acc.username
        pen = eligible_pen(acc, thresh)
        if pen:
            logmsg += " (" + acc.email + "), pen: " + pen.name
            relids = outbound_relids_for_penid(pen.key().id())
            if len(relids) > 0:
                logmsg += ", following: " + str(len(relids))
                checked, reviews = review_activity_search(thresh, "", relids)
                if len(reviews) > 0 or "sumifnoact" in acc.summaryflags:
                    logmsg += ", reviews: " + str(len(reviews))
                    checked, prs = review_activity_search(
                        thresh, "", [ str(pen.key().id()) ])
                    logmsg += ", reviewed: " + str(len(prs))
                    content = write_summary_email_body(pen, reviews, tstr, prs)
                    if not request.url.startswith('http://localhost'):
                        mail.send_mail(
                            sender="wdydfun support <theriex@gmail.com>",
                            to=acc.email,
                            subject=subj,
                            body=content)
                        logmsg += ", mail sent"
        acc.lastsummary = nowISO()
        acc.put()
        split_output(response, logmsg)
        logsum += logmsg + "\n"
    return logsum


class MailSummaries(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        split_output(self.response, "MailSummaries")
        emsum = "Email summary send processing summary:\n"
        dtnow = datetime.datetime.utcnow()
        split_output(self.response, "---------- daily: ----------")
        emsum += mail_summaries("daily", 
                                dt2ISO(dtnow - datetime.timedelta(hours=24)),
                                self.request, self.response)
        split_output(self.response, "---------- weekly: ----------")
        emsum += mail_summaries("weekly", 
                                dt2ISO(dtnow - datetime.timedelta(7)),
                                self.request, self.response)
        split_output(self.response, "---------- fortnightly: ----------")
        emsum += mail_summaries("fortnightly", 
                                dt2ISO(dtnow - datetime.timedelta(14)),
                                self.request, self.response)
        summary = pen_stats() + "\n" + emsum
        if not self.request.url.startswith('http://localhost'):
            mail.send_mail(
                sender="wdydfun support <theriex@gmail.com>",
                to="theriex@gmail.com",
                subject="wdydfun mail summaries",
                body=summary)


class LogSummaries(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        split_output(self.response, "---------- LogSummaries ----------")
        stat = log_stats()
        if not stat:
            split_output(self.response, "LogSummaries stat retrieval failed.")
            return
        agstr = stat.agents or ""
        refstr = stat.statrefs or ""
        summary = "Log Summary:\n" +\
            "            Total log lines: " + str(stat.logttl) + "\n" +\
            "               Bot requests: " + str(stat.botttl) + "\n" +\
            "     Secure login page hits: " + str(stat.logsecure) + "\n" +\
            "    Static review page hits: " + str(stat.logstatic) + "\n" +\
            "Static review clickthroughs: " + str(stat.clickthru) + "\n" +\
            "Static review referrers:\n" + refstr.replace("#", "\n") +\
            "agents:\n" + agstr.replace("~", "\n")
        split_output(self.response, summary)


class SummaryForUser(webapp2.RequestHandler):
    def get(self):
        username = self.request.get('username')
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write("username: " + username + "\n")
        accs = MORAccount.gql("WHERE username = :1", username)
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(7))
        tstr = ISO2dt(thresh).strftime("%d %B %Y")
        for acc in accs:
            pen = eligible_pen(acc, "2400-01-01T00:00:00Z")
            self.response.out.write("pen: " + pen.name + "\n")
            relids = outbound_relids_for_penid(pen.key().id())
            checked, reviews = review_activity_search(thresh, "", relids)
            checked, prs = review_activity_search(thresh, "", 
                                                  [ str(pen.key().id()) ])
            content = write_summary_email_body(pen, reviews, tstr, prs)
        self.response.out.write(content)


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


app = webapp2.WSGIApplication([('/mailsum', MailSummaries),
                               ('/logsum', LogSummaries),
                               ('/emuser', SummaryForUser),
                               ('/activity', UserActivity)], debug=True)

