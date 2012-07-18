import webapp2
import datetime
from google.appengine.ext import db
import logging

class MORAccount(db.Model):
    """ An account used for local (as opposed to 3rd party) authentication """
    username = db.StringProperty(required=True)
    password = db.StringProperty(required=True)
    email = db.EmailProperty()
    modified = db.DateProperty()


class WriteAccount(webapp2.RequestHandler):
    def post(self):
        acct = MORAccount(username=self.request.get('user'), 
                          password=self.request.get('pass'))
        email = self.request.get('email')
        if email:
            acct.email = email
        acct.modified = datetime.datetime.now().date()
        acct.put()
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write("[{\"mid\":\"12345678\"}]")


class GetToken(webapp2.RequestHandler):
    def get(self):
        username = self.request.get('user')
        password = self.request.get('pass')
        where = "WHERE username=:1 AND password=:2 LIMIT 1"
        accounts = MORAccount.gql(where, username, password)
        found = accounts.count()
        logging.info("found " + str(found) + " for " + username)
        if found:
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write("[{\"mid\":\"12345678\"}]")
        else:
            self.error(401)
            self.response.out.write("No match for those credentials")


app = webapp2.WSGIApplication([('/newacct', WriteAccount),
                               ('/login', GetToken)], debug=True)

