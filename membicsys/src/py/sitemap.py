import webapp2
import logging
from cacheman import *
from morutil import *
import coop


head = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
  <loc>$DOCROOT/docs/HowToExploreMembicsFromOtherPeople.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/HowToManageMembershipAndPostCollaboratively.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/HowToPostMembicsOrThemesThroughToSocialMedia.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/HowToRememberToRemember.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/HowToUseMembicToManageHelpfulLinksOnYourWebsite.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/about.html</loc>
  <lastmod>2016-11-06</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/howto.html</loc>
  <lastmod>2016-11-04</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/privacy.html</loc>
  <lastmod>2016-07-19</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/terms.html</loc>
  <lastmod>2016-07-19</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/themepage.html</loc>
  <lastmod>2016-08-01</lastmod>
</url>
<url>
  <loc>$DOCROOT/docs/definition.html</loc>
  <lastmod>2016-11-17</lastmod>
</url>
"""

foot = """
</urlset>
"""

def baseStandaloneURL(ctm):
    if ctm.hashtag:
        return "$DOCROOT/" + ctm.hashtag
    return "$DOCROOT/t/" + str(ctm.key().id())
    

class SitemapXML(webapp2.RequestHandler):
    def get(self):
        xml = head
        vq = VizQuery(coop.Coop, "ORDER BY modified DESC")
        ctms = vq.fetch(100, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        for ctm in ctms:
            if not ctm.preb:  #if no pre-built content, then not much to index
                continue
            xml += "<url>"
            xml += "  <loc>" + baseStandaloneURL(ctm) + "</loc>"
            xml += "  <lastmod>" + ctm.modified[0:10] + "</lastmod>"
            xml += "</url>"
            xml += "<url>"
            xml += "  <loc>" + baseStandaloneURL(ctm) + "?tab=top</loc>"
            xml += "  <lastmod>" + ctm.modified[0:10] + "</lastmod>"
            xml += "</url>"
        xml += foot
        xml = xml.replace("$DOCROOT", self.request.host_url)
        self.response.headers['Content-Type'] = 'text/xml'
        self.response.out.write(xml)


app = webapp2.WSGIApplication([('.*/sitemap.xml', SitemapXML)], debug=True)

