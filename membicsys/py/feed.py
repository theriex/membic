import logging
logging.basicConfig(level=logging.DEBUG)
import flask
import json
import logging
import py.util as util
import py.dbacc as dbacc

# A feed can be customized via the following URL parameters:
#   ff: Feed Format. Can be "rss" (default), "rdf", "json".
#   ts: Title Specification. String of specification code letters.
#   ds: Description Specification: String of specification code letters.
# The specification code letters are:
#   s: rating stars
#   r: revtype
#   t: title/name
#   k: keywords
#   d: text description
#   v: vertical bar delimiter
# So for example, ts=sdvtvrk puts everything in the title with delimiters.
# Some feeds require a contact email address.  Because email addresses in
# membic are private, the general support email is provided.  Feeds are
# described as public domain in terms of copyright.
class FeedInfo(object):
    baseurl = ""          # e.g. https://membic.org
    nowts = ""            # timestamp for start of processing pass
    dbobj = None          # MUser or Theme instance
    dbtype = ""           # dbobj["dsType"]
    dbid = ""             # dbobj["dsId"]
    feedform = "rss"      # ff parameter
    titlespec = "st"      # ts parameter
    descspec = "dvrk"     # ds parameter
    membics = []
    title = ""
    description = ""
    picurl = ""
    siteurl = ""
    feedurl = ""
    email = "support@membic.org"
    copy = "Public Domain"


def membic_url(fi, membic):
    url = None
    if "url" in membic:
        url = membic["url"]
        # pick up any stray unencoded ampersands and encode for valid xml
        url = url.replace("&amp;", "&");
        url = url.replace("&", "&amp;");
    if not url:  # readers need a url. Use the site url if membic has nothing.
        url = fi.siteurl.replace("&", "&amp;")
    return url


def space_conc(base, txt):
    txt = txt or ""
    if base and txt:
        base += " "
    base += txt
    return base


def htmlquot(txt):
    txt = txt or ""
    return txt.replace("\"", "&quot;")


def membic_stars_text(membic):
    stars = ""
    rating = membic["rating"] or 0
    for i in range(0, int(rating / 20)):
        stars += "*"
    return stars


def membic_detfldval(membic, field):
    val = ""
    if membic["details"] and field in membic["details"]:
        val = membic["details"][field]
    return val


def membic_title(membic):
    nametypes = ["yum", "activity", "other"]
    if membic["revtype"] in nametypes:
        return membic_detfldval(membic, "name")
    return membic_detfldval(membic, "title")


def membic_subkey(membic):
    subkey = ""
    if membic["revtype"] == "book":
        subkey = membic_detfldval(membic, "author")
    if membic["revtype"] == "music":
        subkey = membic_detfldval(membic, "artist")
    return subkey


def membic_text_from_spec(membic, spec):
    txt = ""
    for cc in spec:
        if cc == "s":
            txt = space_conc(txt, membic_stars_text(membic))
        elif cc == "r":
            txt = space_conc(txt, membic["revtype"])
        elif cc == "t":
            txt = space_conc(txt, membic_title(membic))
            txt = space_conc(txt, membic_subkey(membic))
        elif cc == "k":
            txt = space_conc(txt, membic["keywords"])
        elif cc == "d":
            txt = space_conc(txt, membic["text"])
        elif cc == "v":
            txt = space_conc(txt, "|")
    return txt


def rss_content(fi):
    txt = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
    txt += "<rss version=\"2.0\">\n"
    txt += "<channel>\n"
    txt += "<title>" + fi.title + "</title>\n"
    txt += "<link>" + fi.siteurl.replace("&", "&amp;") + "</link>\n"
    txt += "<description><![CDATA[" + fi.description + "]]></description>\n"
    for membic in fi.membics:
        membicurl = membic_url(fi, membic)
        itemtitle = membic_text_from_spec(membic, fi.titlespec)
        itemdesc = membic_text_from_spec(membic, fi.descspec)
        txt += "<item>\n"
        txt += "<title><![CDATA[" + itemtitle + "]]></title>\n"
        txt += "<link><![CDATA[" + membicurl + "]]></link>\n"
        txt += "<guid>Membic" + membic["dsId"] + "</guid>\n"
        txt += "<pubDate>" + membic["modified"] + "</pubDate>\n"  # created
        txt += "<description><![CDATA[" + itemdesc + "]]></description>\n"
        txt += "</item>\n"
    txt += "</channel>\n</rss>\n"
    # Using "xml" rather than "rss+xml" because otherwise mobile Firefox
    # tries to download the contents, which is highly frustrating when you
    # are trying to copy the rss feed url into another app. 19jun17
    ctype = "application/xml; charset=UTF-8"
    return txt, ctype


def rdf_content(fi):
    surl = fi.siteurl.replace("&", "&amp;")
    desc = str(len(fi.membics)) + " recent membics"
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
    txt += "<channel rdf:about=\"" + surl + "\">\n"
    txt += "<title>" + fi.title + "</title>\n"
    txt += "<link>" + surl + "</link>\n"
    txt += "<description>" + fi.description + "</description>\n"
    txt += "<dc:language>en-us</dc:language>\n"
    txt += "<dc:rights>" + fi.copy + "</dc:rights>\n"
    txt += "<dc:publisher>" + fi.email + "</dc:publisher>\n"
    txt += "<dc:creator>" + fi.email + "</dc:creator>\n"
    txt += "<dc:source>" + surl + "</dc:source>\n"
    txt += "<dc:title>" + fi.title + "</dc:title>\n"
    txt += "<dc:type>Collection</dc:type>\n"
    txt += "<syn:updateBase>" + fi.nowts + "</syn:updateBase>\n"
    txt += "<syn:updateFrequency>4</syn:updateFrequency>\n"
    txt += "<syn:updatePeriod>hourly</syn:updatePeriod>\n"
    txt += "<items>\n"
    txt += " <rdf:Seq>\n"
    for membic in fi.membics:
        txt += "<rdf:li rdf:resource=\"" + membic_url(fi, membic) + "\" />\n"
    txt += " </rdf:Seq>\n"
    txt += "</items>\n"
    txt += "</channel>\n"
    for membic in fi.membics:
        itemurl = membic_url(fi, membic)
        itemtitle = membic_text_from_spec(membic, fi.titlespec)
        itemdesc = membic_text_from_spec(membic, fi.descspec)
        txt += "<item rdf:about=\"" + itemurl + "\">\n"
        txt += "<title><![CDATA[" + itemtitle + "]]></title>\n"
        txt += "<link>" + itemurl + "</link>\n"
        txt += "<description><![CDATA[" + itemdesc + "]]></description>\n"
        txt += "<dc:date>" + membic["modified"] + "</dc:date>\n"  # created
        txt += "<dc:language>en-us</dc:language>\n"
        txt += "<dc:rights>" + fi.copy + "</dc:rights>\n"
        txt += "<dc:source>" + itemurl + "</dc:source>\n"
        txt += "<dc:title><![CDATA[" + itemtitle + "]]></dc:title>\n"
        txt += "<dc:type>text</dc:type>\n"
        txt += "<dcterms:issued>" + membic["modified"] + "</dcterms:issued>\n"
        txt += "</item>\n"
    txt += "</rdf:RDF>\n"
    ctype = "application/rss+xml; charset=UTF-8"
    return txt, ctype


def json_content(fi):
    txt = "{\"version\": \"https://jsonfeed.org/version/1\",\n"
    txt += "\"title\": \"" + htmlquot(fi.title) + "\",\n"
    txt += "\"home_page_url\": \"" + fi.siteurl + "\",\n"
    txt += "\"feed_url\": \"" + fi.feedurl + "\",\n"
    txt += "\"description\": \"" + htmlquot(fi.description) + "\",\n"
    txt += "\"icon\": \"" + fi.picurl + "\",\n"
    items = ""
    for membic in fi.membics:
        if items:
            items += ",\n"
        itemurl = membic_url(fi, membic)
        itemtitle = membic_text_from_spec(membic, fi.titlespec)
        itemdesc = membic_text_from_spec(membic, fi.descspec)
        created = membic["modified"]  # created
        items += "{\"id\": \"Membic" + membic["dsId"] + "\",\n"
        items += "\"url\": \"" + itemurl + "\",\n"
        items += "\"title\": \"" + htmlquot(itemtitle) + "\",\n"
        items += "\"content_text\": \"" + htmlquot(itemdesc) + "\",\n"
        items += "\"date_published\": \"" + created + "\",\n"
        items += "\"date_modified\": \"" + membic["modified"] + "\"}"
    txt += "\"items\": [\n" + items + "]}\n"
    ctype = "application/json; charset=UTF-8"
    return txt, ctype


def set_baseurl_for_fi(fi):
    url = flask.request.url
    ucs = url.split("/")[0:3]
    # If flask is being run via proxy within the main web server, then a
    # port may be added which does not correspond to the main site.  The
    # baseurl needs to be valid for building references to images and a link
    # to the profile/theme being summarized, so the port is stripped off.
    # That might break some references on a development server.
    hcs = ucs[2].split(":")
    ucs[2] = hcs[0]
    fi.baseurl = "/".join(ucs)


def set_fi_urls_and_parameters(fi):
    set_baseurl_for_fi(fi)
    refu = fi.dbobj["hashtag"]
    if not refu:
        if fi.dbtype == "Theme":
            refu = "theme/" + fi.dbid
        elif fi.dbtype == "MUser":
            refu = "profile/" + fi.dbid
    fi.siteurl = fi.baseurl + "/" + refu
    fi.feedurl = fi.baseurl + "/feed/" + refu
    args = flask.request.args
    fi.feedform = args.get("ff", fi.feedform)
    fi.titlespec = args.get("ts", fi.titlespec)
    fi.descspec = args.get("ds", fi.descspec)


def set_fi_feed_membics(fi):
    fi.membics = []
    ms = json.loads(fi.dbobj["preb"] or "[]")
    for m in ms:
        if not "revtype" in m:
            continue  # filter out overflows or anything not a membic
        if m["dispafter"] > fi.nowts:
            continue  # filter out anything queued for later 
        # Set the modified timestamp for the feed to be the creation
        # timestamp so membics don't suddently show up again at the top of a
        # feed reader display after being edited.  The created timestamp
        # does not have an appended version number, so readers should be
        # able to parse the time from it.  The preb is already sorted on
        # creation time with the most recent first, so no need to sort.
        m["modified"] = m["created"]
        fi.membics.append(m)


def feed_info_for_object(ob):
    fi = FeedInfo()
    fi.nowts = dbacc.nowISO()
    fi.dbobj = ob;
    fi.dbtype = ob["dsType"]
    fi.dbid = str(ob["dsId"])
    set_fi_urls_and_parameters(fi)
    fi.title = ob["name"] or (fi.dbtype + fi.dbid)
    if fi.dbtype == "Theme":
        fi.description = ob["description"] or ""
    elif fi.dbtype == "MUser":
        fi.description = ob["aboutme"] or ""
    fi.picurl = fi.baseurl + "/api/obimg?dt=" + fi.dbtype + "&di=" + fi.dbid
    set_fi_feed_membics(fi)
    return fi


# The path must be of the format "profile/1234", "theme/1234" or "hashtag".
# These values are a subset of what is understood by start_html_for_path in
# start.py
def feed_object_from_path(path):
    if not path:
        return util.srverr("No path given for RSS content")
    ob = None
    pes = path.split("/")
    if len(pes) > 1:
        if pes[0] == "profile":
            ob = dbacc.cfbk("MUser", "dsId", pes[1], required=True)
        elif pes[0] == "theme":
            ob = dbacc.cfbk("Theme", "dsId", pes[1], required=True)
        else:
            return util.srverr("feed url first part must be profile or theme")
    else:  # find as hashtag
        ob = dbacc.cfbk("Theme", "hashtag", pes[0])
        if not ob:
            ob = dbacc.cfbk("MUser", "hashtag", pes[0])
        if not ob:
            return util.srverr("Unknown feed hashtag: " + path)
    return ob
        

##################################################
#
# API entrypoints
#
##################################################

# The path is everything *after* "/feed/".  Feeds can be customized via URL
# parameters, see the FeedInfo class notes for details.
def webfeed(path):
    path = path or ""
    ob = feed_object_from_path(path.lower())
    fi = feed_info_for_object(ob)
    if fi.feedform == "rss":
        content, ctype = rss_content(fi)
    elif fi.feedform == "rdf":
        content, ctype = rdf_content(fi)
    elif fi.feedform == "json":
        content, ctype = json_content(fi)
    else:
        return util.srverr("Unknown web feed type: " + ftype)
    return util.respond(content, mimetype=ctype)

