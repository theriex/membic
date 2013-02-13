import webapp2
import logging
from rev import Review, review_activity_search
from rel import Relationship
from moracct import nowISO
from statrev import getTitle, getSubkey


def rss_title(review):
    title = "(" + str(review.rating / 20) + " star " + review.revtype + ")"
    title += " " + getTitle(review) + " " + getSubkey(review)
    return title

def item_url(review):
    url = "http://www.myopenreviews.com/statrev/" + str(review.key().id())
    return url


def rss_content(penid, reviews, checked, following):
    url = "http://www.myopenreviews.com/rssact?pen=" + str(penid)
    email = "robot@myopenreviews.com"
    title = "MyOpenReviews Activity Feed"
    #The content of each review was created by the pen name, but that
    #is not tied to any particular person and there needs to be some
    #kind of recourse against unintended content distribution so
    copy = "Copyright SAND Services Inc."
    desc = "Following " + str(following) + ", " + str(len(reviews)) +\
        " reviews, " + str(checked) + " checked."
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
        txt += "<item rdf:about=\"" + item_url(review) + "\">\n"
        txt += "<title><![CDATA[" + rss_title(review) + "]]></title>\n"
        txt += "<link>" + item_url(review) + "</link>\n"
        txt += "<description><![CDATA[" + review.text + "\n"
        txt += review.keywords + "]]></description>\n"
        txt += "<dc:date>" + review.modified + "</dc:date>\n"
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + copy + "</dc:rights>\n"
        txt += "<dc:source>" + item_url(review) + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + rss_title(review) + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + review.modified + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    return txt;


class ActivityRSS(webapp2.RequestHandler):
    def get(self):
        penid = int(self.request.get('pen'))
        where = "WHERE originid = :1 LIMIT 300"
        rels = Relationship.gql(where, penid)
        relids = []
        for rel in rels:
            relids.append(str(rel.relatedid))
        checked, reviews = review_activity_search("", "", relids)
        content = rss_content(penid, reviews, checked, len(relids))
        #heard there were potential issues with "application/rss+xml"
        #so modeled what craigslist is doing..
        ctype = "application/xhtml+xml; charset=UTF-8"
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content);


app = webapp2.WSGIApplication([('/rssact', ActivityRSS)], debug=True)

