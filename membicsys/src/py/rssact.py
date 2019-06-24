import webapp2
import logging
import moracct
from morutil import *
import mblock
import coop
import muser
from cacheman import *
from mctr import bump_rss_summary
import json
from operator import itemgetter

########################################
# The reviews for the RSS feed are fetched from cache, which means
# they are reconstituted JSON dicts and not databasse instances.
########################################

# Title or description specification code letters:
#   s: rating stars
#   r: revtype
#   t: title/name
#   k: keywords
#   d: text description
#   v: vertical bar delimiter
# So for example, to put everything in the title: ts=sdvtvrk
#
# Some feeds require a contact email address.  Since all email addresses in
# membic are private, the general support email is provided.  Since all
# membics are public, the feed is also public domain in terms of copyright.
class FeedInfo(object):
    baseurl = ""          # e.g. https://membic.org
    srctype = ""          # "profile" or "coop"
    srcdbc = None         # MUser or Coop
    objid = 0             # db obj instance id for easy reference
    dbobj = None
    ftype = "rss"
    titlespec = "st"      # see class comment
    descspec = "dvrk"
    membics = []
    title = ""
    description = ""
    picurl = ""
    humanurl = ""
    feedurl = ""
    email = "support@membic.org"
    copy = "Public Domain"


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


def item_url(finfo, membic):
    url = None
    if "url" in membic:
        url = membic["url"]
        # pick up any stray unencoded ampersands and encode for valid xml
        url = url.replace("&amp;", "&");
        url = url.replace("&", "&amp;");
    if not url:
        url = finfo.humanurl.replace("&", "&amp;")
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


def rdf_content(finfo):
    hurl = finfo.humanurl.replace("&", "&amp;")
    desc = str(len(finfo.membics)) + " recent membics"
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
    txt += "<channel rdf:about=\"" + hurl + "\">\n"
    txt += "<title>" + finfo.title + "</title>\n"
    txt += "<link>" + hurl + "</link>\n"
    txt += "<description>" + finfo.description + "</description>\n"
    txt += "<dc:language>en-us</dc:language>\n"
    txt += "<dc:rights>" + finfo.copy + "</dc:rights>\n"
    txt += "<dc:publisher>" + finfo.email + "</dc:publisher>\n"
    txt += "<dc:creator>" + finfo.email + "</dc:creator>\n"
    txt += "<dc:source>" + hurl + "</dc:source>\n"
    txt += "<dc:title>" + finfo.title + "</dc:title>\n"
    txt += "<dc:type>Collection</dc:type>\n"
    txt += "<syn:updateBase>" + nowISO() + "</syn:updateBase>\n"
    txt += "<syn:updateFrequency>4</syn:updateFrequency>\n"
    txt += "<syn:updatePeriod>hourly</syn:updatePeriod>\n"
    txt += "<items>\n"
    txt += " <rdf:Seq>\n"
    for review in finfo.membics:
        txt += "<rdf:li rdf:resource=\"" + item_url(finfo, review) + "\" />\n"
    txt += " </rdf:Seq>\n"
    txt += "</items>\n"
    txt += "</channel>\n"
    for review in finfo.membics:
        revurl = item_url(finfo, review)
        revtitle = rev_text_from_spec(review, finfo.titlespec)
        revdesc = rev_text_from_spec(review, finfo.descspec)
        txt += "<item rdf:about=\"" + revurl + "\">\n"
        txt += "<title><![CDATA[" + revtitle + "]]></title>\n"
        txt += "<link>" + revurl + "</link>\n"
        txt += "<description><![CDATA[" + revdesc + "]]></description>\n"
        txt += "<dc:date>" + review["modified"] + "</dc:date>\n"
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + finfo.copy + "</dc:rights>\n"
        txt += "<dc:source>" + revurl + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + revtitle + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + review["modified"] + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    ctype = "application/rss+xml; charset=UTF-8"
    return txt, ctype


def rss_content(finfo):
    txt = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
    txt += "<rss version=\"2.0\">\n"
    txt += "<channel>\n"
    txt += "<title>" + finfo.title + "</title>\n"
    txt += "<link>" + finfo.humanurl.replace("&", "&amp;") + "</link>\n"
    txt += "<description><![CDATA[" + finfo.description + "]]></description>\n"
    for membic in finfo.membics:
        itemurl = item_url(finfo, membic)
        itemtitle = rev_text_from_spec(membic, finfo.titlespec)
        itemdesc = rev_text_from_spec(membic, finfo.descspec)
        txt += "<item>\n"
        txt += "<title><![CDATA[" + itemtitle + "]]></title>\n"
        txt += "<link><![CDATA[" + itemurl + "]]></link>\n"
        txt += "<guid>" + str(membic["_id"]) + "</guid>\n"
        txt += "<pubDate>" + membic["modified"] + "</pubDate>\n"
        txt += "<description><![CDATA[" + itemdesc + "]]></description>\n"
        txt += "</item>\n"
    txt += "</channel>\n</rss>\n"
    # Using "xml" rather than "rss+xml" because otherwise mobile Firefox
    # tries to download the contents, which is highly frustrating when you
    # are trying to copy the rss feed url into another app. 19jun17
    ctype = "application/xml; charset=UTF-8"
    return txt, ctype


def json_content(finfo):
    txt = "{\"version\": \"https://jsonfeed.org/version/1\",\n"
    txt += "\"title\": \"" + htmlquot(finfo.title) + "\",\n"
    txt += "\"home_page_url\": \"" + finfo.humanurl + "\",\n"
    txt += "\"feed_url\": \"" + finfo.feedurl + "\",\n"
    txt += "\"description\": \"" + htmlquot(finfo.description) + "\",\n"
    txt += "\"icon\": \"" + finfo.picurl + "\",\n"
    items = ""
    for membic in finfo.membics:
        if items:
            items += ",\n"
        itemurl = item_url(finfo, membic)
        itemtitle = rev_text_from_spec(membic, finfo.titlespec)
        itemdesc = rev_text_from_spec(membic, finfo.descspec)
        created = membic["modhist"].split(";")[0]
        items += "{\"id\": \"" + str(membic["_id"]) + "\",\n"
        items += "\"url\": \"" + itemurl + "\",\n"
        items += "\"title\": \"" + htmlquot(itemtitle) + "\",\n"
        items += "\"content_text\": \"" + htmlquot(itemdesc) + "\",\n"
        items += "\"date_published\": \"" + created + "\",\n"
        items += "\"date_modified\": \"" + membic["modified"] + "\"}"
    txt += "\"items\": [\n" + items + "]}\n"
    ctype = "application/json; charset=UTF-8"
    return txt, ctype


def init_feed_info_membics (finfo):
    if not finfo.dbobj:
        return
    membics = []
    revs = json.loads(finfo.dbobj.preb or "[]")
    for rev in revs:
        # filter out anything that is not a review instance
        if not "revtype" in rev:
            continue
        # filter out any supporting source reviews
        if finfo.srctype == "coop" and str(rev["ctmid"]) == "0":
            continue
        # filter out any reviews that are queued for later
        if "dispafter" in rev and rev["dispafter"] > nowISO():
            continue
        # set the modified timestamp from the modhist timestamp so that
        # edited membics keep the same timestamp that was used when any
        # readers first looked at the RSS.
        rev["modified"] = rev["modhist"][0:20]
        membics.append(rev)
    membics = sorted(membics, key=itemgetter('modhist'), reverse=True)
    finfo.membics = membics


def get_feed_info (handler):
    finfo = FeedInfo()
    finfo.baseurl = handler.request.host_url
    finfo.srctype = "coop"
    finfo.srcdbc = coop.Coop
    finfo.objid = intz(handler.request.get(finfo.srctype))
    if not finfo.objid:
        finfo.srctype = "profile"
        finfo.srcdbc = muser.MUser
        finfo.objid = intz(handler.request.get(finfo.srctype))
    finfo.dbobj = cached_get(finfo.objid, finfo.srcdbc)
    ff = handler.request.get("format")
    if ff:  # feed format other than rss specified, use that
        finfo.ftype = ff
    ts = handler.request.get("ts")
    ds = handler.request.get("ds")
    if ts or ds:  # alternate formatting specified
        finfo.titlespec = ts
        finfo.descspec = ds
    init_feed_info_membics(finfo)
    finfo.title = finfo.dbobj.name or str(finfo.objid)
    finfo.description = "Not available"
    if finfo.srctype == "profile":
        finfo.description = finfo.dbobj.aboutme or ""
        finfo.picurl = finfo.baseurl + "/profipic?profid=" + str(finfo.objid)
    elif finfo.srctype == "coop":
        finfo.description = finfo.dbobj.description or ""
        finfo.picurl = finfo.baseurl + "/ctmpic?coopid=" + str(finfo.objid)
    finfo.humanurl = finfo.baseurl + "/" + str(finfo.objid)
    finfo.feedurl = finfo.baseurl + "/rssfeed?" + finfo.srctype +\
                    "=" + str(finfo.objid) + "&format=" + finfo.ftype +\
                    "&ts=" + finfo.titlespec + "&ds=" + finfo.descspec
    return finfo
    

class RSSFeed(webapp2.RequestHandler):
    def get(self):
        finfo = get_feed_info(self)
        if finfo.ftype == "rss":
            content, ctype = rss_content(finfo)
        elif finfo.ftype == "rdf":
            content, ctype = rdf_content(finfo)
        elif finfo.ftype == "json":
            content, ctype = json_content(finfo)
        else:
            return srverr(self, 403, "Unknown feed format: " + finfo.ftype)
        self.response.headers['Content-Type'] = ctype
        self.response.out.write(content)
        if finfo.srctype == "coop":
            bump_rss_summary(finfo.dbobj, self.request)


app = webapp2.WSGIApplication([('.*/rssfeed', RSSFeed)], debug=True)

