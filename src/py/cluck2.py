import webapp2

class MainPage(webapp2.RequestHandler):
  def get(self):
      self.response.headers['Content-Type'] = 'text/plain'
      self.response.out.write("Ain't nobody here at all...")

app = webapp2.WSGIApplication([('/cluck2', MainPage)], debug=True)
