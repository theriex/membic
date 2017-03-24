import webapp2
import logging
import moracct
from morutil import *
import rev
import coop
from cacheman import *
from mctr import bump_rss_summary
import json

########################################
# The reviews for the RSS feed are fetched from cache, which means
# they are reconstituted JSON dicts and not databasse instances.
########################################

def revtxt_title(review):
    names = ["yum", "activity", "other"]
    if review["revtype"] in names:
        return moracct.safestr(review["name"])
    return moracct.safestr(review["title"])


def revtxt_subkey(review):
    subkey = ""
    if review["revtype"] == "book":
        subkey = moracct.safestr(review["author"])
    if review["revtype"] == "music":
        subkey = moracct.safestr(review["artist"])
    return subkey


def revtxt_stars(review):
    stars = ""
    rating = review["rating"] or 0
    for i in range(0, rating / 20):
        stars += "*"
    return stars


def item_url(handler, review):
    url = None
    if "url" in review:
        url = review["url"]
        # pick up any stray unencoded ampersands and encode for valid xml
        url = url.replace("&amp;", "&");
        url = url.replace("&", "&amp;");
    if not url:
        url = handler.request.host_url + "?view=coop&amp;coopid=" +\
            str(review["ctmid"]) + "&amp;tab=latest&amp;expid=" +\
            str(review["_id"])
    return url


def space_conc(base, txt):
    txt = txt or ""
    if base and txt:
        base += " "
    base += txt
    return base


def rev_text_from_spec(review, spec):
    txt = ""
    for cc in spec:
        if cc == "s":
            txt = space_conc(txt, revtxt_stars(review))
        elif cc == "r":
            txt = space_conc(txt, review["revtype"])
        elif cc == "t":
            txt = space_conc(txt, revtxt_title(review))
            txt = space_conc(txt, revtxt_subkey(review))
        elif cc == "k":
            txt = space_conc(txt, moracct.safestr(review["keywords"]))
        elif cc == "d":
            txt = space_conc(txt, moracct.safestr(review["text"]))
        elif cc == "v":
            txt = space_conc(txt, "|")
    return txt


def title_spec_and_desc_spec(handler):
    # Title or description specification elements:
    #   s: rating stars
    #   r: revtype
    #   t: title/name
    #   k: keywords
    #   d: text description
    #   v: vertical bar delimiter
    # So for example, to put everything in the title: ts=sdvtvrk
    ts = handler.request.get("ts")
    ds = handler.request.get("ds")
    if not ts and not ds:
        ts = "st"
        ds = "dvrk"
    return ts, ds


def rss_content(handler, ctmid, title, reviews):
    url = "https://membic.com?view=coop&amp;coopid=" + str(ctmid)
    email = "membicsystem@gmail.com"
    ts, ds = title_spec_and_desc_spec(handler)
    # Reviews are written by a pen names, but the site does not tie pen
    # names to people. Copyright of the content of this rss feed is
    # claimed by the site to help avoid unwanted content distribution.
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
        revurl = item_url(handler, review)
        revtitle = rev_text_from_spec(review, ts)
        revdesc = rev_text_from_spec(review, ds)
        txt += "<item rdf:about=\"" + revurl + "\">\n"
        txt += "<title><![CDATA[" + revtitle + "]]></title>\n"
        txt += "<link>" + revurl + "</link>\n"
        txt += "<description><![CDATA[" + revdesc + "]]></description>\n"
        txt += "<dc:date>" + review["modified"] + "</dc:date>\n"
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + copy + "</dc:rights>\n"
        txt += "<dc:source>" + revurl + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + revtitle + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + review["modified"] + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    return txt;


class CoopRSS(webapp2.RequestHandler):
    def get(self):
        ctmid = intz(self.request.get('coop'))
        ctm = coop.Coop.get_by_id(ctmid)
        # Similar to rev.py FetchAllReviews but without extra data checks
        key = "coop" + str(ctmid)
        jstr = memcache.get(key)
        if not jstr:
            jstr = rev.rebuild_reviews_block(self, "coop", ctmid)
            memcache.set(key, jstr)
        reviews = json.loads(jstr)
        filtered = []
        latest = nowISO()
        for review in reviews:
            # filter out the instance object and anything else non-review
            if not "ctmid" in review:
                continue
            # filter out any supporting source reviews
            if str(review["ctmid"]) == "0":
                continue
            # filter out any reviews that are future queued
            if "dispafter" in review and review["dispafter"] > nowISO():
                continue
            # stop if this review is newer than the last one, since that
            # means we are out of the recent list and into the top20s
            if review["modhist"] > latest:
                break
            filtered.append(review)
            latest = review["modhist"]
        title = ctm.name
        content = rss_content(self, ctmid, title, filtered)
        ctype = "application/rss+xml; charset=UTF-8"
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content)
        bump_rss_summary(ctm, self.request)


app = webapp2.WSGIApplication([('.*/rsscoop', CoopRSS)], debug=True)

