import webapp2
import logging
from rel import outbound_relids_for_penid
from rev import review_activity_search
from moracct import safestr
from morutil import *
from statrev import getTitle, getSubkey
from blogview import fetch_blog_reviews
from pen import PenName


def rss_title(review, checked):
    title = str(review.rating / 20) + " star " + review.revtype + ": " +\
        getTitle(review) + " " + getSubkey(review)
    if checked:
        title = unicode(review.penname) + " reviewed a " + title
    return title

def item_url(review):
    url = "http://www.wdydfun.com/statrev/" + str(review.key().id())
    return url


def rss_content(penid, title, reviews, checked, following):
    url = "http://www.wdydfun.com/rssact?pen=" + str(penid)
    email = "robot@wdydfun.com"
    # Reviews are written by a pen names, but the site does not tie pen
    # names to people. Copyright of the content of this rss feed is
    # claimed by the site to avoid unintended content distribution.
    copy = "Copyright SAND Services Inc."
    desc = str(len(reviews)) + " reviews"
    if checked:
        desc = "Following " + str(following) + ", " + desc + ", " +\
            str(checked) + " checked."
    txt = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
    txt += "\n"
    txt += "<rdf:RDF\n"
    txt += " xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"\n"
    txt += " xmlns=\"http://purl.org/rss/1.0/\"\n"
    txt += " xmlns:ev=\"http://purl.org/rss/1.0/modules/event/\"\n"
    txt += " xmlns:content=\"http://purl.org/rss/1.0/modules/content/\"\n"
    txt += " xmlns:taxo=\"http://purl.org/rss/1.0/modules/taxonomy/\"\n"
    txt += " xmlns:dc=\"http://purl.org/dc/elements/1.1/\"\n"
    txt += " xmlns:syn=\"http://purl.org/rss/1.0/modules/syndication/\"\n"
    txt += " xmlns:dcterms=\"http://purl.org/dc/terms/\"\n"
    txt += " xmlns:admin=\"http://webns.net/mvcb/\"\n"
    txt += ">\n"
    txt += "\n"
    txt += "<channel rdf:about=\"" + url + "\">\n"
    txt += "<title>" + title + "</title>\n"
    txt += "<link>" + url + "</link>\n"
    txt += "<description>" + desc + "</description>\n"
    txt += "<dc:language>en-us</dc:language>\n"
    txt += "<dc:rights>" + copy + "</dc:rights>\n"
    txt += "<dc:publisher>" + email + "</dc:publisher>\n"
    txt += "<dc:creator>" + email + "</dc:creator>\n"
    txt += "<dc:source>" + url + "</dc:source>\n"
    txt += "<dc:title>" + title + "</dc:title>\n"
    txt += "<dc:type>Collection</dc:type>\n"
    txt += "<syn:updateBase>" + nowISO() + "</syn:updateBase>\n"
    txt += "<syn:updateFrequency>4</syn:updateFrequency>\n"
    txt += "<syn:updatePeriod>hourly</syn:updatePeriod>\n"
    txt += "<items>\n"
    txt += " <rdf:Seq>\n"
    for review in reviews:
        txt += "<rdf:li rdf:resource=\"" + item_url(review) + "\" />\n"
    txt += " </rdf:Seq>\n"
    txt += "</items>\n"
    txt += "</channel>\n"
    for review in reviews:
        revtitle = rss_title(review, checked)
        txt += "<item rdf:about=\"" + item_url(review) + "\">\n"
        txt += "<title><![CDATA[" + revtitle + "]]></title>\n"
        txt += "<link>" + item_url(review) + "</link>\n"
        txt += "<description><![CDATA[" + safestr(review.keywords) + " | "
        txt += safestr(review.text) + "]]></description>\n"
        txt += "<dc:date>" + review.modified + "</dc:date>\n"
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + copy + "</dc:rights>\n"
        txt += "<dc:source>" + item_url(review) + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + revtitle + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + review.modified + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    return txt;


class ActivityRSS(webapp2.RequestHandler):
    def get(self):
        penid = intz(self.request.get('pen'))
        relids = outbound_relids_for_penid(penid)
        checked, reviews = review_activity_search("", "", relids)
        title = "wdydfun reviews from friends"
        content = rss_content(penid, title, reviews, checked, len(relids))
        #heard there were potential issues with "application/rss+xml"
        #so modeled what craigslist is doing..
        ctype = "application/xhtml+xml; charset=UTF-8"
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content);


class PenNameRSS(webapp2.RequestHandler):
    def get(self):
        penid = intz(self.request.get('pen'))
        pen = PenName.get_by_id(penid);
        reviews = fetch_blog_reviews(pen);
        title = "wdydfun reviews from " + pen.name
        content = rss_content(penid, title, reviews, 0, 0)
        ctype = "application/xhtml+xml; charset=UTF-8"
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content);


app = webapp2.WSGIApplication([('/rssact', ActivityRSS),
                               ('/rsspen', PenNameRSS)], debug=True)

