import webapp2
import logging
from rev import Review, review_activity_search
from rel import Relationship
from moracct import MORAccount, nowISO, intz, safestr
from statrev import getTitle, getSubkey


class MailSummaries(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        accs = MORAccount.all()
        for acc in accs:
            modified = False
            if not acc.lastsummary:
                acc.lastsummary = nowISO()
                modified = True
            if not acc.summaryfreq:
                acc.summaryfreq = "weekly"
                acc.summaryflags = ""
                modified = True
            text = acc.username + " mod: " + str(modified) + "\n"
            self.response.out.write(text)
            if modified:
                acc.put()


app = webapp2.WSGIApplication([('/mailsum', MailSummaries)], debug=True)

