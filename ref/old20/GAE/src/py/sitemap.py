import webapp2
import logging
import start
import json


head = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
  <loc>$DOCROOT/docs/privacy.html</loc>
  <lastmod>2017-05-30</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/terms.html</loc>
  <lastmod>2017-05-20</lastmod>
</url>
"""

foot = """
</urlset>
"""

class SitemapXML(webapp2.RequestHandler):
    def get(self):
        xml = head
        ods = json.loads(start.get_recent_themes_and_profiles())
        for od in ods:
            hashtag = od["hashtag"] or od["instid"]
            xml += "<url>"
            xml += "  <loc>$DOCROOT/" + hashtag + "</loc>"
            xml += "  <lastmod>" + od["modified"][0:10] + "</lastmod>"
            xml += "</url>"
        xml += foot
        xml = xml.replace("$DOCROOT", self.request.host_url)
        self.response.headers['Content-Type'] = 'text/xml'
        self.response.out.write(xml)
            

app = webapp2.WSGIApplication([('.*/sitemap.xml', SitemapXML)], debug=True)

