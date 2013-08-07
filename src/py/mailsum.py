import webapp2
import logging
from rev import Review, review_activity_search
from rel import Relationship
from moracct import MORAccount, dt2ISO, nowISO, intz, safestr
from statrev import getTitle, getSubkey


def split(response, text):
    logging.info("mailsum: " + text)
    response.out.write(text + "\n")


def login_eligible(acc, thresh):
    # eventually this will need to track and test bad email addresses
    if not acc.email:
        return None
    #TODO pens = ???
    #TODO: if not sumiflogin and login within thresh, then return None
    #return pen
    return None


def mail_summaries(freq, thresh, response):
    where = "WHERE summaryfreq = :1 AND lastsummary < :2"
    accs = MORAccount.gql(where, freq, thresh)
    for acc in accs:
        pen = eligible_pen(acc, thresh)
        if pen:
            summary = activity_summary(pen, thresh)
            if summary:
                send_summary(acc, summary)
        acc.lastsummary = nowISO()
        acc.put()
        split("Processed " + acc.username)


class MailSummaries(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        dtnow = datetime.datetime.utcnow()
        mail_summaries("daily", dt2ISO(dtnow - datetime.timedelta(hours=24))
                       self.response)
        mail_summaries("weekly", dt2ISO(dtnow - datetime.timedelta(7))
                       self.response)
        mail_summaries("fortnightly", dt2ISO(dtnow - datetime.timedelta(14))
                       self.response)


app = webapp2.WSGIApplication([('/mailsum', MailSummaries)], debug=True)

