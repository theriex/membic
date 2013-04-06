import webapp2
from google.appengine.ext import db
import logging
from rev import Review
from pen import PenName
from moracct import safestr, intz, safestr
import re
import json


def starsImageHTML(rating):
    width = 0
    title = ""
    if rating < 5:
        width = 0
        title = "No stars"
    elif rating < 15:
        width = 6
        title = "Half a star"
    elif rating < 25:
        width = 12
        title = "One star"
    elif rating < 35:
        width = 18
        title = "One and a half stars"
    elif rating < 45:
        width = 24
        title = "Two stars"
    elif rating < 55:
        width = 30
        title = "Two and a half stars"
    elif rating < 65:
        width = 36
        title = "Three stars"
    elif rating < 75:
        width = 42
        title = "Three and a half stars"
    elif rating < 85:
        width = 48
        title = "Four stars"
    elif rating < 95:
        width = 54
        title = "Four and a half stars"
    else:
        width = 60
        title = "Five stars"
    html = "<img class=\"starsimg\" src=\"../img/blank.png\"" +\
        " style=\"width:" + str(60 - width) + "px;height:13px;\"/>" +\
        "<img class=\"starsimg\" src=\"../img/blank.png\"" +\
        " style=\"width:" + str(width) + "px;height:13px;" +\
        "background:url('../img/ratstar5.png')\"" +\
        " title=\"" + title + "\" alt=\"" + title + "\"/>";
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
        return rev.title
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
    return ""


def urlImageLink(rev):
    if not rev.url:
        return ""
    index = max(0, rev.url.rfind('.'))
    abbrev = rev.url[index : index + 4]
    html = "<a href=\"" + rev.url + "\""
    html +=  " onclick=\"window.open('" + rev.url + "');return false;\""
    html +=  " title=\"" + rev.url + "\">"
    html +=  "<img class=\"webjump\" src=\"../img/wwwico.png\"/>"
    html +=  "<span class=\"webabbrev\">" + abbrev + "</span>"
    html += "</a>"
    return html


def reviewPicHTML(rev):
    html = ""
    if rev.imguri:
        html = "<a href=\"" + rev.url + "\""
        html +=  " onclick=\"window.open('" + rev.url + "');"
        html +=             "return false;\""
        html +=  "><img class=\"revpic\""
        html +=       " style=\"max-width:125px;height:auto;\""
        html +=       " src=\"" + rev.imguri
        html +=  "\"></a>"
    if rev.revpic:
        html = "<img class=\"revpic\""
        html +=    " src=\"revpic?revid=" + str(rev.key().id())
        html +=  "\"/>"
    return html;


def secondaryFieldZip(rev):
    fields = []
    vals = []
    if rev.revtype == "book":
        fields = [ "publisher", "year" ]
        vals = [ rev.publisher, rev.year ]
    if rev.revtype == "movie":
        fields = [ "year", "starring" ]
        vals = [ rev.year, rev.starring ]
    if rev.revtype == "video":
        fields = [ "artist" ]
        vals = [ rev.artist ]
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
    return assoc


def secondaryFields(rev):
    assoc = secondaryFieldZip(rev)
    html = "<table>"
    for av in assoc:
        if av[1]:
            html += "<tr><td><span class=\"secondaryfield\">"
            html +=   av[0][:1].upper() + av[0][1:]
            html +=   "</span></td>"
            html += "<td>" + safestr(av[1]) + "</td></tr>"
    html += "</table>"
    return html


def displayText(text):
    if not text:
        return ""
    text = text.replace("\n", "<br/>")
    return text
    

def descrip(rev):
    revtext = rev.text or ""
    if revtext:
        # strip any newlines or similar annoyances
        revtext = re.sub('\s+', ' ', revtext)
    text = getTitle(rev)
    assoc = secondaryFieldZip(rev)
    for av in assoc:
        if av[1]:
            text += ", " + safestr(av[1])
    text += ". " + revtext
    text += " " + safestr(rev.keywords)
    if len(text) > 150:
        text = text[:150] + "..."
    text = re.sub('\"', '&quot;', text)
    return text


def script_to_set_colors(pen):
    html = ""
    if not pen.settings:
        return html
    settings = json.loads(pen.settings)
    if not settings or not settings["colors"]:
        return html
    colors = settings["colors"]
    html += "<script>\n"
    html += "document.getElementById('bodyid').style.backgroundColor = " +\
        "\"" + colors["bodybg"] + "\"\n"
    html += "document.getElementById('bodyid').style.color = " +\
        "\"" + colors["text"] + "\"\n"
    html += "rules = document.styleSheets[0].cssRules;\n"
    html += "for(var i = 0; rules && i < rules.length; i += 1) {\n"
    html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
        "A:link\") === 0) {\n"
    html += "        if(rules[i].style.setProperty) {\n"
    html += "            rules[i].style.setProperty('color', " +\
        "\"" + colors["link"] + "\"" + ", null); } }\n"
    html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
        "A:visited\") === 0) {\n"
    html += "        if(rules[i].style.setProperty) {\n"
    html += "            rules[i].style.setProperty('color', " +\
        "\"" + colors["link"] + "\"" + ", null); } }\n"
    html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
        "A:active\") === 0) {\n"
    html += "        if(rules[i].style.setProperty) {\n"
    html += "            rules[i].style.setProperty('color', " +\
        "\"" + colors["link"] + "\"" + ", null); } }\n"
    html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
        "A:hover\") === 0) {\n"
    html += "        if(rules[i].style.setProperty) {\n"
    html += "            rules[i].style.setProperty('color', " +\
        "\"" + colors["hover"] + "\"" + ", null); } } }\n"
    html += "</script>\n"
    return html


def revhtml(rev, pen):
    """ dump a static viewable review without requiring login """
    penrevparms = "penid=" + str(rev.penid) + "&revid=" + str(rev.key().id())
    # HTML copied from index.html...
    html = "<!doctype html>"
    html += "<html itemscope=\"itemscope\""
    html +=      " itemtype=\"http://schema.org/WebPage\""
    html +=      " xmlns=\"http://www.w3.org/1999/xhtml\">"
    html += "<head>"
    html +=   "<meta http-equiv=\"Content-Type\""
    html +=        " content=\"text/html; charset=UTF-8\" />"
    html +=   "<meta name=\"description\" content=\"" + descrip(rev) + "\" />"
    html +=   "<title>My Open Reviews</title>"
    html +=   "<link href=\"../css/mor.css\" rel=\"stylesheet\""
    html +=        " type=\"text/css\" />"
    html += "</head>"
    html += "<body id=\"bodyid\">"
    html += "<div id=\"logodiv\">"
    html +=   "<img src=\"../img/remo.png\" border=\"0\"/>"
    html += "</div>"
    html += "<div id=\"titlediv\"> "
    html +=   "<span id=\"logotitle\">MyOpenReviews</span>"
    html += "</div>"
    # Specialized class for content area, left spacing used by ads..
    html += "<div id=\"noleftappspacediv\">"
    html +=   "<div id=\"contentdiv\" class=\"mtext\""
    html +=       " style=\"padding:30px 0px 0px 0px;\">"
    
    # This is a public facing page, not a logged in page, so show some
    # ads to help pay for hosting service. Yeah right. Try anyway.
    html += "<div id=\"morgoogleads\" style=\""
    html +=   "width:165px;height:610px;float:left;background:#eeeeff;"
    html +=   "border: 1px solid #666666; border-radius:10px;"
    html += "\">"
    # start of code copied from adsense.  Despite setting an explicit
    # size and copying the settings exactly from the ad generator, the
    # iframe that gets inserted partially overlaps the review image.
    # ATTENTION: Figure out a way to mitigate this effect.
    html += "<script type=\"text/javascript\"><!--"
    html += "google_ad_client = \"ca-pub-3945939102920673\";"
    html += "/* staticrev */"
    html += "google_ad_slot = \"4121889143\";"
    html += "google_ad_width = 160;"
    html += "google_ad_height = 600;"
    html += "//-->"
    html += "</script>"
    html += "<script type=\"text/javascript\""
    html += "src=\"http://pagead2.googlesyndication.com/pagead/show_ads.js\">"
    html += "</script>"
    # end of code copied from adsense
    html += "</div>"

    # HTML copied from review.js displayReviewForm
    html +=     "<div class=\"formstyle\">"
    html +=       "<table class=\"revdisptable\" border=\"0\">";
    html +=         "<tr>"
    html +=           "<td class=\"starstd\">"
    html +=             "<span id=\"stardisp\">" + starsImageHTML(rev.rating)
    html +=             "</span>&nbsp;" + badgeImageHTML(rev.revtype) + "</td>"
    html +=           "<td><span class=\"revtitle\">" + getTitle(rev)
    html +=             "</span></td>"
    html +=           "<td><span class=\"revauthor\">" + getSubkey(rev)
    html +=             "</span></td>"
    html +=           "<td>" + urlImageLink(rev) + "</td>"
    html +=         "</tr>"
    html +=         "<tr><td colspan=\"4\">"
    html +=           "<div id=\"reviewtext\" class=\"shoutout\""
    html +=               " style=\"width:600px;\">"
    html +=             displayText(rev.text) + "</div>"
    html +=         "</td></tr>"
    html +=         "<tr>"
    html +=           "<td>" + reviewPicHTML(rev) + "</td>"
    html +=           "<td valign=\"top\">"
    html +=             "<div class=\"scvstrdiv\">" + safestr(rev.keywords)
    html +=             "</div></td>"
    html +=           "<td valign=\"top\">" + secondaryFields(rev) + "</td>"
    html +=         "</tr>"
    html +=       "</table>"
    html +=     "</div>"  #formstyle
    html +=   "</div>"  #contentdiv
    # Static view statement
    html +=   "<div id=\"statnoticecontainerdiv\""
    html +=       " style=\"width:85%;padding:20px 50px;\">"
    html +=     "<table class=\"revdisptable\"><tr><td>"
    html +=     "<div id=\"statnoticediv\">"
    html += "<a href=\"http://www.myopenreviews.com/#view=review&" + penrevparms
    html += "\">This review</a> was shared by "
    html += "<a href=\"http://www.myopenreviews.com/#view=profile&profid="
    html += str(rev.penid) + "\">" + pen.name + "</a>"
    html += "<br/>"
    html += "<div id=\"statrevactdiv\">"
    html += "<a href=\"../#command=respond&" + penrevparms
    html +=     "\">Edit your corresponding review</a>"
    html += " &nbsp; &nbsp; &nbsp; "
    html += "<a href=\"../#command=remember&" + penrevparms
    html +=     "\">Remember this review</a>"
    html += "</div>"
    html +=     "</div></td></tr></table>"
    html +=   "</div>"
    html += "</div>"  #noleftappspacediv
    # HTML copied from login.js updateAuthentDisplay
    # No dynamic resizing via script, so just pick a reasonable top width
    html += "<div id=\"topdiv\" style=\"width:90%;\">"
    html +=   "<div id=\"topnav\">"
    html +=     "<table id=\"navdisplaytable\" border=\"0\" width=\"50%\">"
    html +=       "<tr>"
    html +=         "<td style=\"height:14px;\"></td>"
    html +=         "<td style=\"width:40px;\"></td>"
    html +=         "<td rowspan=\"2\" style=\"vertical-align:top;\">"
    html +=           "<div id=\"centerhdiv\">"
    # HTML copied from profile.js displayVisitProfileHeading
    html +=             "<div id=\"profhdiv\">"
    html +=               "<span id=\"penhnamespan\">"
    html +=               "<a href=\"../#view=profile&profid=" + str(rev.penid)
    html +=                        "\" title=\"Show profile for " + pen.name
    html +=                        "\">" + pen.name + "</a>"
    html +=               "</span>"
    html +=               "<span id=\"penhbuttonspan\"> </span>"
    html +=             "</div>"
    html +=           "</div></td>"
    html +=       "</tr>"
    html +=       "<tr>"
    html +=         "<td><div id=\"homepenhdiv\"></div></td>"
    html +=       "</tr>"
    html +=       "</table></div>"
    html +=   "</div>"
    html += "</div>"
    html += script_to_set_colors(pen)
    html += "</body>"
    html += "</html>"
    return html;


class StaticReviewDisplay(webapp2.RequestHandler):
    def get(self, revid):
        review = Review.get_by_id(intz(revid))
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

