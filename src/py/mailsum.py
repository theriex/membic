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


class ActivityStat(db.Model):
    """ Activity metrics for tracking purposes """
    day = db.StringProperty(required=True)  # yyyy-mm-ddT00:00:00Z
    active = db.IntegerProperty()  # number of pens that logged in
    onerev = db.IntegerProperty()  # num pens that wrote at least one review
    tworev = db.IntegerProperty()  # num pens that wrote at least two reviews
    morev = db.IntegerProperty()   # 3 or more reviews
    ttlrev = db.IntegerProperty()
    names = db.TextProperty()      # semi delim pen names that logged in
    calculated = db.StringProperty()  # iso date


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
    where = "WHERE modified >= :1 AND modified < :2"
    pens = PenName.gql(where, isostart, isoend)
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
                               ('/emuser', SummaryForUser),
                               ('/activity', UserActivity)], debug=True)

