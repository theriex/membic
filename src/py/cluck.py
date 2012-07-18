import webapp2

class MainPage(webapp2.RequestHandler):
  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write("Ain't nobody here but us chickens...")

app = webapp2.WSGIApplication([('/cluck', MainPage)], debug=True)
