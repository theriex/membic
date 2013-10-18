import webapp2
import datetime
import logging
from pen import PenName
from rel import outbound_relids_for_penid
from rev import review_activity_search
from moracct import MORAccount, dt2ISO, nowISO, ISO2dt, safestr
from statrev import getTitle, getSubkey
from google.appengine.api import mail


def split(response, text):
    logging.info("mailsum: " + text)
    response.out.write(text + "\n")


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
    else:
        body += "Since " + tstr + ", friends you are following have posted " +\
            str(len(reviews)) + " " +\
            ("reviews" if len(reviews) > 1 else "review") + "."
    body += "  For more details" +\
            " (or to change your summary email preferences)" +\
            " go to http://www.wdydfun.com \n\n"
    for review in reviews:
        body += str(review.penname) + " reviewed a " +\
            str(review.rating / 20) + " star " + review.revtype + ": " +\
            getTitle(review) + " " + getSubkey(review) +\
            "\n" +\
            safestr(review.keywords) + " | " + safestr(review.text) +\
            "\n" +\
            "http://www.wdydfun.com/statrev/" + str(review.key().id()) +\
            "\n\n"
    return body


def mail_summaries(freq, thresh, request, response):
    tstr = ISO2dt(thresh).strftime("%d %B %Y")
    subj = "Your wdydfun " + freq + " activity since " + tstr
    logsum = "Mail sent for " + freq + " activity since " + tstr + "\n"
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
        split(response, logmsg)
        logsum += logmsg + "\n"
    if not request.url.startswith('http://localhost'):
        mail.send_mail(
            sender="wdydfun support <theriex@gmail.com>",
            to="theriex@gmail.com",
            subject="wdydfun " + freq + " mail summaries",
            body=logsum)


class MailSummaries(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        split(self.response, "MailSummaries")
        dtnow = datetime.datetime.utcnow()
        split(self.response, "---------- daily: ----------")
        mail_summaries("daily", dt2ISO(dtnow - datetime.timedelta(hours=24)),
                       self.request, self.response)
        split(self.response, "---------- weekly: ----------")
        mail_summaries("weekly", dt2ISO(dtnow - datetime.timedelta(7)),
                       self.request, self.response)
        split(self.response, "---------- fortnightly: ----------")
        mail_summaries("fortnightly", dt2ISO(dtnow - datetime.timedelta(14)),
                       self.request, self.response)


app = webapp2.WSGIApplication([('/mailsum', MailSummaries)], debug=True)

