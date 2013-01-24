import webapp2
from google.appengine.ext import db
import logging
from rev import Review
from pen import PenName


def starsImageHTML(rating):
    img = ""
    title = ""
    if rating < 5:
        img = "ratstar0.png"
        title = "No stars"
    elif rating < 15:
        img = "ratstar05.png"
        title = "Half a star"
    elif rating < 25:
        img = "ratstar1.png"
        title = "One star"
    elif rating < 35:
        img = "ratstar15.png"
        title = "One and a half stars"
    elif rating < 45:
        img = "ratstar2.png"
        title = "Two stars"
    elif rating < 55:
        img = "ratstar25.png"
        title = "Two and a half stars"
    elif rating < 65:
        img = "ratstar3.png"
        title = "Three stars"
    elif rating < 75:
        img = "ratstar35.png"
        title = "Three and a half stars"
    elif rating < 85:
        img = "ratstar4.png"
        title = "Four stars"
    elif rating < 95:
        img = "ratstar45.png"
        title = "Four and a half stars"
    else:
        img = "ratstar5.png"
        title = "Five stars"
    html = "<img class=\"starsimg\" src=\"../img/" + img + "\""
    html +=    " title=\"" + title + "\" alt=\"" + title + "\"/>"
    return html


def badgeImageHTML(revtype):
    html = "<img class=\"reviewbadge\" src=\"../img/"
    if revtype == "book":
        html += "TypeBook50.png"
    elif revtype == "movie":
        html += "TypeMovie50.png"
    elif revtype == "video":
        html += "TypeVideo50.png"
    elif revtype == "music":
        html += "TypeSong50.png"
    elif revtype == "food":
        html += "TypeFood50.png"
    elif revtype == "drink":
        html += "TypeDrink50.png"
    elif revtype == "to do":
        html += "TypeBucket50.png"
    elif revtype == "other":
        html += "TypeOther50.png"
    html += "\" title=\"" + revtype + "\" alt=\"" + revtype + "\"/>"
    return html


def getTitle(rev):
    if rev.revtype == "book":
        return rev.title
    if rev.revtype == "movie":
        return rev.title
    if rev.revtype == "video":
        return rev.url
    if rev.revtype == "music":
        return rev.title
    if rev.revtype == "food":
        return rev.name
    if rev.revtype == "drink":
        return rev.name
    if rev.revtype == "to do":
        return rev.name
    if rev.revtype == "other":
        return rev.name
    return "unknown review type"


def getSubkey(rev):
    if rev.revtype == "book":
        return rev.author
    if rev.revtype == "music":
        return rev.artist
    if rev.revtype == "other":
        return rev.type
    return ""


def urlImageLink(rev):
    if not rev.url or rev.revtype == "video":
        return ""
    html = "<a href=\"" + rev.url + "\""
    html +=  " onclick=\"window.open('" + rev.url + "');return false;\""
    html +=  " title=\"" + rev.url + "\">"
    html +=  "<img class=\"webjump\" src=\"../img/wwwico.png\"/></a>"
    return html


def reviewPicHTML(rev):
    if not rev.revpic:
        return ""
    html = "<img class=\"revpic\""
    html +=    " src=\"revpic?revid=" + rev.key().id()
    html +=  "\"/>"
    return html;


def secondaryFields(rev):
    fields = []
    vals = []
    if rev.revtype == "book":
        fields = [ "publisher", "year" ]
        vals = [ rev.publisher, rev.year ]
    if rev.revtype == "movie":
        fields = [ "year", "starring" ]
        vals = [ rev.year, rev.starring ]
    if rev.revtype == "video":
        fields = [ "title", "artist" ]
        vals = [ rev.title, rev.artist ]
    if rev.revtype == "music":
        fields = [ "album", "year" ]
        vals = [ rev.album, rev.year ]
    if rev.revtype == "food":
        fields = [ "address" ]
        vals = [ rev.address ]
    if rev.revtype == "drink":
        fields = [ "address" ]
        vals = [ rev.address ]
    if rev.revtype == "to do":
        fields = [ "address" ]
        vals = [ rev.address ]
    assoc = zip(fields, vals)
    html = "<table>"
    for av in assoc:
        html += "<tr><td><span class=\"secondaryfield\">"
        html +=   av[0][:1].upper() + av[0][1:]
        html +=   "</span></td>"
        html += "<td>" + av[1] + "</td></tr>"
    html += "</table>"
    return html


def displayText(text):
    if not text:
        return ""
    text = text.replace("\n", "<br/>")
    return text
    

def revhtml(rev, pen):
    """ dump a static viewable review without requiring login """
    html = "<!doctype html>"
    html += "<html itemscope=\"itemscope\""
    html +=      " itemtype=\"http://schema.org/WebPage\""
    html +=      " xmlns=\"http://www.w3.org/1999/xhtml\">"
    html += "<head>"
    html +=   "<meta http-equiv=\"Content-Type\""
    html +=        " content=\"text/html; charset=UTF-8\" />"
    html +=   "<meta name=\"description\" content=\"" + rev.revtype
    html +=                                         " Review\" />"
    html +=   "<title>My Open Reviews</title>"
    html +=   "<link href=\"../css/mor.css\" rel=\"stylesheet\""
    html +=        " type=\"text/css\" />"
    html += "</head>"
    html += "<body>"
    html += "<div id=\"logodiv\">"
    html +=   "<img src=\"../img/remo.png\" border=\"0\"/>"
    html += "</div>"
    html += "<div id=\"titlediv\"> "
    html +=   "<span id=\"logotitle\">MyOpenReviews</span>"
    html += "</div>"
    html += "<div id=\"appspacediv\">"
    html +=   "<div id=\"contentdiv\" class=\"mtext\">"

    html += "<div id=\"morgoogleads\""
    html +=     " style=\"width:130px;height:610px;float:left;\">"
    html +=  "<script type=\"text/javascript\"><!--"
    html +=  "google_ad_client = \"ca-pub-3945939102920673\";"
    html +=  "/* 120x600, MS tower 2/29/08 */"
    html +=  "google_ad_slot = \"3622583892\";"
    html +=  "google_ad_width = 120;"
    html +=  "google_ad_height = 600;"
    html +=  "//-->"
    html +=  "</script>"
    html +=  "<script type=\"text/javascript\""
    html +=  "src=\"http://pagead2.googlesyndication.com/pagead/show_ads.js\">"
    html +=  "</script>"
    html += "</div>"

    html +=     "<div class=\"formstyle\">" 
    html +=       "<table class=\"revdisptable\" border=\"0\">";
    html +=         "<tr>"
    html +=           "<td style=\"text-align:right\">"
    html +=             "<span id=\"stardisp\">" + starsImageHTML(rev.rating)
    html +=             "</span>&nbsp;" + badgeImageHTML(rev.revtype) + "</td>"
    html +=           "<td><span class=\"revtitle\">" + getTitle(rev)
    html +=             "</span></td>"
    html +=           "<td><span class=\"revauthor\">" + getSubkey(rev)
    html +=             "</span></td>"
    html +=           "<td>" + urlImageLink(rev) + "</td>"
    html +=         "</tr>"
    html +=         "<tr>"
    html +=           "<td>" + reviewPicHTML(rev) + "</td>"
    html +=           "<td valign=\"top\">"
    html +=             "<div class=\"scvstrdiv\">" + rev.keywords
    html +=             "</div></td>"
    html +=           "<td valign=\"top\">" + secondaryFields(rev) + "</td>"
    html +=         "</tr>"
    html +=         "<tr><td colspan=\"4\">"
    html +=           "<div id=\"reviewtext\" class=\"shoutout\""
    html +=               " style=\"width:600px;\">"
    html +=             displayText(rev.text) + "</div>"
    html +=         "</td></tr>"
    #ATTENTION: Add response and remember buttons once implemented in js...
    html +=       "</table>"
    html +=     "</div>"
    html +=   "</div>"
    html += "</div>"
    # No dynamic resizing via script, so just pick a reasonable top width
    html += "<div id=\"topdiv\" style=\"width:600px;\">"
    html +=   "<div id=\"topnav\">"
    html +=     "<table id=\"navdisplaytable\">"
    html +=       "<tr>"
    html +=         "<td></td>"
    html +=         "<td rowspan=\"2\">"
    # The height of the pen name may appear different because the content
    # of the table is not as tall.  Not worth worrying about.
    html +=           "<div id=\"profhdiv\">"
    html +=             "<span id=\"penhnamespan\">"
    html +=               "<a href=\"../#view=profile&profid=" + str(rev.penid)
    html +=                        "\" title=\"Show profile for " + pen.name
    html +=                        "\">" + pen.name + "</a>"
    html +=             "</span>"
    html +=             "<span id=\"penhbuttonspan\"> </span>"
    html +=           "</div></td>"
    html +=         "<td>"
    html +=           "<div id=\"accountdiv\"> </div> </td>"
    html +=       "</tr>"
    html +=       "<tr>"
    html +=         "<td><div id=\"acthdiv\"></div></td>"
    html +=         "<td><div id=\"revhdiv\"></div></td>"
    html +=       "</tr>"
    html +=     "</table>"
    html +=   "</div>"
    html += "</div>"
    html += "</body>"
    html += "</html>"
    return html;


class StaticReviewDisplay(webapp2.RequestHandler):
    def get(self, revid):
        review = Review.get_by_id(int(revid))
        if not review:
            self.error(404)
            self.response.out.write("Review " + revid + " not found")
            return
        pen = PenName.get_by_id(review.penid)
        if not pen:
            self.error(404)
            self.response.out.write("PenName " + review.penid + " not found")
            return
        html = revhtml(review, pen);
        self.response.headers['Content-Type'] = "text/html; charset=UTF-8";
        self.response.out.write(html);


app = webapp2.WSGIApplication([('/statrev/(\d+)', StaticReviewDisplay)],
                              debug=True)

