import webapp2
import logging
from moracct import safestr
from morutil import *
import rev
import group
from cacheman import *


def getTitle(rev):
    if rev.revtype == "book":
        return rev.title
    if rev.revtype == "movie":
        return rev.title
    if rev.revtype == "video":
        return rev.title
    if rev.revtype == "music":
        return rev.title
    if rev.revtype == "food":
        return rev.name
    if rev.revtype == "drink":
        return rev.name
    if rev.revtype == "activity":
        return rev.name
    if rev.revtype == "other":
        return rev.name
    return "unknown review type"


def getSubkey(rev):
    subkey = ""
    if rev.revtype == "book":
        subkey = rev.author
    if rev.revtype == "music":
        subkey = rev.artist
    return subkey


def rss_title(review):
    title = str(review.rating / 20) + " star " + review.revtype + ": " +\
        getTitle(review) + " " + getSubkey(review)
    return title


def item_url(handler, review):
    url = handler.request.host_url + "?view=group&amp;groupid=" +\
        str(review.grpid) + "&amp;tab=latest&amp;expid=" +\
        str(review.key().id())
    return url


def rss_content(handler, grpid, title, reviews):
    url = "?view=group&amp;groupid=" + str(grpid)
    email = "robot@membic.com"
    # Reviews are written by a pen names, but the site does not tie pen
    # names to people. Copyright of the content of this rss feed is
    # claimed by the site to avoid unwanted content distribution.
    copy = "Copyright SAND Services Inc."
    desc = str(len(reviews)) + " recent membics"
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
        txt += "<rdf:li rdf:resource=\"" + item_url(handler, review) + "\" />\n"
    txt += " </rdf:Seq>\n"
    txt += "</items>\n"
    txt += "</channel>\n"
    for review in reviews:
        revtitle = rss_title(review)
        revurl = item_url(handler, review)
        txt += "<item rdf:about=\"" + revurl + "\">\n"
        txt += "<title><![CDATA[" + revtitle + "]]></title>\n"
        txt += "<link>" + revurl + "</link>\n"
        txt += "<description><![CDATA[" + safestr(review.keywords) + " | "
        txt += safestr(review.text) + "]]></description>\n"
        txt += "<dc:date>" + review.modified + "</dc:date>\n"
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + copy + "</dc:rights>\n"
        txt += "<dc:source>" + revurl + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + revtitle + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + review.modified + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    return txt;


class GroupRSS(webapp2.RequestHandler):
    def get(self):
        grpid = intz(self.request.get('group'))
        grp = group.Group.get_by_id(grpid)
        # Similar to FetchAllReviews except but without extra data checks
        reviews = []
        ckey = "revs" + str(grpid)
        idcsv = memcache.get(ckey)
        if not idcsv:
            grp, idcsv = rev.fetch_revs_for_pg("grpid", grp)
        for revidstr in csv_list(idcsv):
            reviews.append(cached_get(int(revidstr), rev.Review))
        title = grp.name
        content = rss_content(self, grpid, title, reviews)
        ctype = "application/xhtml+xml; charset=UTF-8"
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content);


app = webapp2.WSGIApplication([('/rssgroup', GroupRSS)], debug=True)

