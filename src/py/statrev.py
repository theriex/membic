import webapp2
from google.appengine.ext import db
import logging
from rev import Review
from pen import PenName
from moracct import safestr, intz, safestr
import re
import json
import math


def starsImageHTML(rating):
    imgwidth = 85.0
    imgheight = 15.0
    imgfile = "../img/stars18ptC.png"
    starTitles = [ "No stars", "Half a star", "One star", 
                   "One and a half stars", "Two stars", "Two and a half stars",
                   "Three stars", "Three and a half stars", "Four stars", 
                   "Four and a half stars", "Five stars" ]
    maxstep = len(starTitles) - 1
    if not rating:
        rating = 0
    if rating > 93:   # compensate for floored math
        rating = 100
    step = int(math.floor((rating * maxstep) / 100))
    title = starTitles[step]
    width = int(math.floor(step * (imgwidth / maxstep)))
    logging.info("step: " + str(step));
    logging.info("width: " + str(width));
    html = "<img class=\"starsimg\" src=\"../img/blank.png\"" +\
               " style=\"width:" + str(imgwidth - width) + "px;" +\
                        "height:" + str(imgheight) + "px;\"/>" +\
           "<img class=\"starsimg\" src=\"../img/blank.png\"" +\
               " style=\"width:" + str(width) + "px;" +\
                        "height:" + str(imgheight) + "px;" +\
                        "background:url('" + imgfile + "');\"" +\
               " title=\"" + title + "\" alt=\"" + title + "\"/>"
    return html


def typeImage(revtype):
    if revtype == "book":
        return "TypeBook50.png"
    elif revtype == "movie":
        return "TypeMovie50.png"
    elif revtype == "video":
        return "TypeVideo50.png"
    elif revtype == "music":
        return "TypeSong50.png"
    elif revtype == "food":
        return "TypeFood50.png"
    elif revtype == "drink":
        return "TypeDrink50.png"
    elif revtype == "to do":
        return "TypeActivity50.png"
    return "TypeOther50.png"


def badgeImageHTML(revtype):
    html = "<img class=\"reviewbadge\" src=\"../img/"
    html += typeImage(revtype)
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


def urlImageLink(rev):
    if not rev.url:
        return ""
    index = max(0, rev.url.rfind('.'))
    abbrev = rev.url[index : index + 4]
    html = "<a href=\"" + rev.url + "\""
    html +=  " onclick=\"window.open('" + rev.url + "');return false;\""
    html +=  " title=\"" + rev.url + "\">"
    html +=  "<img class=\"webjump\" src=\"../img/gotolink.png\"/>"
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
        html +=    " src=\"../revpic?revid=" + str(rev.key().id())
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
    subkey = getSubkey(rev)
    if subkey:
        text += " - " + subkey
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


# This was removed because switching the display to the colors every
# person has set leads to an extremely inconsistent viewing
# experience.  It would be great to set the palette to whatever the
# viewer has defined, but they are likely not even logged in.  Going
# with the default colors for now.
# def script_to_set_colors(pen):
#     html = ""
#     if not pen.settings:
#         return html
#     settings = json.loads(pen.settings)
#     if not settings or not settings["colors"]:
#         return html
#     colors = settings["colors"]
#     html += "<script>\n"
#     html += "document.getElementById('bodyid').style.backgroundColor = " +\
#         "\"" + colors["bodybg"] + "\"\n"
#     html += "document.getElementById('bodyid').style.color = " +\
#         "\"" + colors["text"] + "\"\n"
#     html += "rules = document.styleSheets[0].cssRules;\n"
#     html += "for(var i = 0; rules && i < rules.length; i += 1) {\n"
#     html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
#         "A:link\") === 0) {\n"
#     html += "        if(rules[i].style.setProperty) {\n"
#     html += "            rules[i].style.setProperty('color', " +\
#         "\"" + colors["link"] + "\"" + ", null); } }\n"
#     html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
#         "A:visited\") === 0) {\n"
#     html += "        if(rules[i].style.setProperty) {\n"
#     html += "            rules[i].style.setProperty('color', " +\
#         "\"" + colors["link"] + "\"" + ", null); } }\n"
#     html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
#         "A:active\") === 0) {\n"
#     html += "        if(rules[i].style.setProperty) {\n"
#     html += "            rules[i].style.setProperty('color', " +\
#         "\"" + colors["link"] + "\"" + ", null); } }\n"
#     html += "    if(rules[i].cssText && rules[i].cssText.indexOf(\"" +\
#         "A:hover\") === 0) {\n"
#     html += "        if(rules[i].style.setProperty) {\n"
#     html += "            rules[i].style.setProperty('color', " +\
#         "\"" + colors["hover"] + "\"" + ", null); } } }\n"
#     html += "</script>\n"
#     return html


def generalScriptHTML():
    html = ""
    html += "<script>\n"
    html += "if(!(document.styleSheets[0].cssRules)) {\n"
    html += "    document.getElementById('bodyid').style.backgroundImage = "
    html +=          "\"url('../img/blank.png')\" }\n"
    html += "</script>\n"
    return html


def actionButtonsHTML(penrevparms):
    html = ""
    # Static view statement
    html += "<div id=\"staticsocialrevactdiv\">\n"
    html +=   "<table><tr><td>\n"
    html +=     "<div id=\"statnoticediv\">\n"
    # respond/remember row
    html += "<table class=\"statnoticeactlinktable\" border=\"0\"><tr>\n"
    # respond button
    html += "<td><div id=\"respondbutton\" class=\"buttondiv\">\n"
    html +=   "<table class=\"buttontable\""
    html +=         " onclick=\"javascript:window.location.href="
    html +=                    "'../#command=respond&" + penrevparms
    html +=                    "';return false;\"><tr>\n"
    html +=     "<td><img class=\"navico\" src=\"../img/writereview.png\""
    html +=             " border=\"0\"/></td>\n"
    html +=     "<td class=\"buttontabletexttd\">"
    html +=       "Your review</td>\n"
    html +=   "</tr></table>\n"
    html +=   "</div></td>\n"
    # remember button
    html += "<td><div id=\"rememberbutton\" class=\"buttondiv\">\n"
    html +=   "<table class=\"buttontable\""
    html +=         " onclick=\"javascript:window.location.href="
    html +=                   "'../#command=remember&" + penrevparms
    html +=                   "';return false;\"><tr>\n"
    html +=     "<td><img class=\"navico\" src=\"../img/rememberq.png\""
    html +=             " border=\"0\"/></td>\n"
    html +=     "<td class=\"buttontabletexttd\">"
    html +=       "Remember</td>\n"
    html +=   "</tr></table>\n"
    html +=   "</div></td>\n"
    html += "</tr></table>"
    # sign in button row
    html += "<table class=\"statnoticeactlinktable\" border=\"0\""
    html +=       " style=\"padding-bottom:20px;\"><tr>\n"
    html += "<td colspan=\"2\">"
    html +=   "<div id=\"signinbutton\" class=\"buttondiv\">\n"
    html +=   "<table class=\"buttontable\""
    html +=         " onclick=\"javascript:window.location.href="
    html +=                  "'../#view=review&" + penrevparms
    html +=                  "';return false;\"><tr>\n"
    html +=     "<td><img class=\"navico\" src=\"../img/penname.png\""
    html +=             " border=\"0\"/></td>\n"
    html +=     "<td class=\"buttontabletexttd\">"
    html +=       "View from your pen name</td>\n"
    html +=   "</tr></table>\n"
    html +=  "</div></td>\n"
    html +=  "</tr></table>\n"
    html +=     "</div> <!-- statnoticediv -->\n"
    html +=   "</td></tr></table>\n"
    html += "</div> <!-- statnoticecontainerdiv -->\n"
    return html


def revhtml(rev, pen):
    """ dump a static viewable review without requiring login """
    penrevparms = "penid=" + str(rev.penid) + "&revid=" + str(rev.key().id())
    subkey = getSubkey(rev)
    timg = "../img/" + typeImage(rev.revtype)
    rdesc = descrip(rev)
    # HTML head copied from index.html...
    html = "<!doctype html>\n"
    html += "<html itemscope=\"itemscope\""
    html +=      " itemtype=\"http://schema.org/WebPage\""
    html +=      " xmlns=\"http://www.w3.org/1999/xhtml\">\n"
    html += "<head>\n"
    html +=   "<meta http-equiv=\"Content-Type\""
    html +=        " content=\"text/html; charset=UTF-8\" />\n"
    html +=   "<meta name=\"description\" content=\"" + rdesc + "\" />\n"
    html +=   "<meta property=\"og:image\" content=\"" + timg + "\" />\n"
    html +=   "<meta property=\"twitter:image\" content=\"" + timg + "\" />\n"
    html +=   "<meta itemprop=\"image\" content=\"" + timg + "\" />\n"
    html +=   "<meta itemprop=\"description\" content=\"" + rdesc + "\" />\n"
    html +=   "<title>" + getTitle(rev)
    if subkey:
        html += " - " + subkey
    html +=   "</title>\n"
    html +=   "<link href=\"../css/mor.css\" rel=\"stylesheet\""
    html +=        " type=\"text/css\" />\n"
    html +=   "<link rel=\"image_src\""
    html +=        " href=\"" + timg + "\" />\n"
    html += "</head>\n"
    html += "<body id=\"bodyid\">\n"
    # HTML content from index.html...
    # html += "<div id=\"mascotdivstatic\">\n"
    # html += "<img src=\"../img/remo.png\" class=\"mascotimg\"/>\n"
    # html += "</div>\n"
    # watch the height on this next div, overflow causes major ad placement skew
    html += "<div id=\"topsectiondiv\" style=\"height:130px;\">\n"
    html += "  <div id=\"logodiv\" style=\"width:260px;\">\n"
    html += "    <img src=\"../img/logoMOR.png\" id=\"logoimg\" border=\"0\"\n"
    html += "         onclick=\"mor.profile.display();return false;\"\n"
    html += "         style=\"width:260px;height:120px;\"/>\n"
    html += "  </div>\n"
    html += "  <div id=\"topworkdiv\">\n"
    html += "    <div id=\"slidesdiv\" style=\"height:120px;\">\n"
    html += "      <img src=\"../img/slides/slogan.png\""
    html +=           " class=\"slideimg\"/>\n"
    html += "    </div>\n"
    html += "  </div>\n"
    html += "</div>\n"
    # Specialized class for content area, left spacing used by ads..
    html += "<div id=\"appspacedivstatic\">\n"
    # older android browser won't keep divs on same line..
    html += "<table id=\"forceAdsSameLineTable\">"
    html += " <tr>"
    html += "  <td valign=\"top\" align=\"left\">"

    # This is a public facing page, not a logged in page, so show some
    # ads to help pay for hosting service. Yeah right. 
    html += "<div id=\"adreservespace\" style=\""
    html +=   "width:170px;height:610px;"
    html +=   "background:#fffffc;"
    html +=   "padding:8px 0px 0px 8px;"
    # html +=   "border:1px solid #666;"
    html +=   "border-radius:5px;"
    html +=   "margin:20px 0px 0px 0px;"
    html += "\">\n"
    html += "<div id=\"morgoogleads\">\n"
    # start of code copied from adsense.
    html += "<script type=\"text/javascript\"><!--\n"
    html += "google_ad_client = \"ca-pub-3945939102920673\";\n"
    html += "/* staticrev */\n"
    html += "google_ad_slot = \"4121889143\";\n"
    html += "google_ad_width = 160;\n"
    html += "google_ad_height = 600;\n"
    html += "//-->\n"
    html += "</script>\n"
    html += "<script type=\"text/javascript\" "
    html += "src=\"http://pagead2.googlesyndication.com/pagead/show_ads.js\">\n"
    html += "</script>\n"
    # end of code copied from adsense
    html += "</div>\n"
    html += "</div>\n"

    html += "  </td><td valign=\"top\">"
    # general content area from index.html
    html +=   "<div id=\"contentdiv\" class=\"statrevcontent\">\n"
    # HTML adapted from profile.js displayProfileHeading
    html +=     "<div id=\"centerhdivstatic\">\n"
    html +=       "<span id=\"penhnamespan\">"
    html +=       "<a href=\"../#view=profile&profid=" + str(rev.penid)
    html +=                "\" title=\"Show profile for " + pen.name
    html +=                "\">" + pen.name + "</a>"
    html +=       "</span>\n"
    html +=       "<span id=\"penhbuttonspan\"> </span>\n"
    html +=     "</div>"

    # HTML copied from review.js displayReviewForm
    html +=     "<div class=\"formstyle\">\n"
    html +=       "<table class=\"revdisptable\" border=\"0\">\n"
    html +=         "<tr>\n"
    html +=           "<td class=\"starstd\">\n"
    html +=             "<span id=\"stardisp\">\n"
    html +=               starsImageHTML(rev.rating)
    html +=             "</span>\n" 
    html +=                "&nbsp;" + badgeImageHTML(rev.revtype)
    html +=             "</td>\n"
    html +=           "<td><span class=\"revtitle\">" + getTitle(rev)
    html +=             "</span></td>\n"
    if subkey:
        html += "<td><span class=\"revauthor\">" + subkey + "</span></td>\n"
    html +=           "<td>" + urlImageLink(rev) + "</td>\n"
    html +=         "</tr>\n"
    html +=         "<tr><td colspan=\"4\" class=\"textareatd\">\n"
    html +=           "<div id=\"reviewtext\" class=\"shoutoutstatic\">\n"
    html +=             displayText(rev.text) + "</div>\n"
    html +=         "</td></tr>\n"
    html +=         "<tr>\n"
    html +=           "<td rowspan=\"2\" valign=\"top\">"
    html +=               reviewPicHTML(rev) + "</td>\n"
    html +=           "<td colspan=\"2\">\n"
    html +=             "<table class=\"subtable\" width=\"100%\"><tr>\n"
    html +=               "<td valign=\"top\">"
    html +=                   secondaryFields(rev) + "</td>\n"
    html +=               "<td valign=\"top\">"
    html +=                   "<div class=\"csvstrdiv\">"
    html +=                       safestr(rev.keywords) + "</div></td>\n"
    html +=             "</tr></table></td>\n"
    html +=         "</tr><tr>\n"
    html +=           "<!-- image continues into this row -->\n"
    html +=           "<td colspan=\"2\" align=\"left\">\n"
    html +=               actionButtonsHTML(penrevparms) + "</td>\n"
    html +=         "</tr>\n"
    html +=       "</table>\n"
    html +=     "</div> <!-- formstyle -->\n"
    html +=   "</div> <!-- contentdiv -->\n"
    html += "</div> <!-- statrevactdiv -->\n"
    html += "  </td></tr></table> <!-- forceAdsSameLineTable -->"
    html += "</div> <!-- appspacedivstatic -->\n"
    html += generalScriptHTML()
    html += "</body>\n"
    html += "</html>\n"
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

