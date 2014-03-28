import webapp2
from google.appengine.ext import db
import logging
from rev import Review
from pen import PenName
from moracct import safestr, safeURIEncode
from morutil import *
import re
import json
import math
from cacheman import *


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
    # logging.info("step: " + str(step));
    # logging.info("width: " + str(width));
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


def reviewPicHTML(rev):
    html = ""
    if rev.imguri:
        html = "<a href=\"" + rev.url + "\""
        html +=  " onclick=\"window.open('" + rev.url + "');"
        html +=             "return false;\""
        html +=  "><img id=\"reviewimg\" class=\"revimg\""
        html +=       " src=\"" + rev.imguri
        html +=  "\"></a>"
    if rev.revpic:
        html = "<img id=\"reviewimg\" class=\"revimg\""
        html +=    " src=\"../revpic?revid=" + str(rev.key().id())
        html +=  "\"/>"
    return html;


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


def fieldsZip(rev):
    fields = []
    vals = []
    if rev.revtype == "book":
        fields = [ "title", "author", "publisher", "year" ]
        vals = [ rev.title, rev.author, rev.publisher, rev.year ]
    if rev.revtype == "movie":
        fields = [ "title", "year", "starring" ]
        vals = [ rev.title, rev.year, rev.starring ]
    if rev.revtype == "video":
        fields = [ "title", "artist" ]
        vals = [ rev.title, rev.artist ]
    if rev.revtype == "music":
        fields = [ "title", "artist", "album", "year" ]
        vals = [ rev.title, rev.artist, rev.album, rev.year ]
    if rev.revtype == "food":
        fields = [ "name", "address" ]
        vals = [ rev.name, rev.address ]
    if rev.revtype == "drink":
        fields = [ "name", "address" ]
        vals = [ rev.name, rev.address ]
    if rev.revtype == "to do":
        fields = [ "name", "address" ]
        vals = [ rev.name, rev.address ]
    assoc = zip(fields, vals)
    return assoc


def fieldsTable(rev):
    assoc = fieldsZip(rev)
    html = "<table>"
    for av in assoc:
        if av[1]:
            html += "<tr><td><span class=\"secondaryfield\">"
            html +=   av[0][:1].upper() + av[0][1:]
            html +=   "</span></td>"
            html += "<td>" + safestr(av[1]) + "</td></tr>"
    html += "</table>"
    return html


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
    # Turn off the background image since some browsers can't handle it
    # and it doesn't look that great with the ad column anyway.  If 
    # re-enabling, this needs to follow the jt.isLowFuncBrower logic
    html += "document.getElementById('bodyid').style.backgroundImage = "
    html +=          "\"url('../img/blank.png')\";\n"
    html += "if(document.referrer) {\n"
    html += "    var btwimg = document.getElementById('btwimg');\n"
    html += "    if(btwimg) {\n"
    html += "        btwimg.src = \"../bytheimg?statinqref=\" + " 
    html +=          "encodeURIComponent(document.referrer) } }\n"
    html += "</script>\n"
    return html


def actionButtonsHTML(penrevparms):
    html = ""
    # Static view statement
    html += "<div id=\"staticsocialrevactdiv\">\n"
    html +=   "<table><tr><td>\n"
    html +=     "<div id=\"statnoticediv\">\n"
    # helpful, remember row
    html += "<table class=\"statnoticeactlinktable\" border=\"0\"><tr>\n"
    # helpful button
    html += "<td><div id=\"helpfulbutton\" class=\"buttondiv\">\n"
    html +=   "<table class=\"buttontable\""
    html +=         " onclick=\"javascript:window.location.href="
    html +=                  "'../#command=helpful&" + penrevparms
    html +=                  "';return false;\"><tr>\n"
    html +=     "<td><img class=\"navico\" src=\"../img/helpfulq.png\""
    html +=             " border=\"0\"/></td>\n"
    html +=     "<td class=\"buttontabletexttd\">"
    html +=       "Helpful</td>\n"
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
    # respond row
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
    html += "</tr></table>"
    # view from your pen name row
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


def revhtml(rev, pen, refer):
    """ dump a static viewable review without requiring login """
    subkey = getSubkey(rev)
    timg = "../img/" + typeImage(rev.revtype)
    simg = timg[0:-6] + "Pic2.png"
    rdesc = descrip(rev)
    revidstr = str(rev.key().id())
    # People are not here to study this page.  Whether they know about
    # wdydfun or not, the next logical step is always to switch from
    # the static to the dynamic display.
    penrevparms = "penid=" + str(rev.penid) + "&revid=" + revidstr
    revurl = "../?view=review&" + penrevparms
    # profurl = "../?view=profile&profid=" + str(rev.penid)
    blogurl = "../blogs/" + pen.name_c
    # HTML head copied from index.html...
    html = "<!doctype html>\n"
    html += "<html itemscope=\"itemscope\""
    html +=      " itemtype=\"http://schema.org/WebPage\""
    html +=      " xmlns=\"http://www.w3.org/1999/xhtml\">\n"
    html += "<head>\n"
    html +=   "<meta http-equiv=\"Content-Type\""
    html +=        " content=\"text/html; charset=UTF-8\" />\n"
    html +=   "<meta name=\"description\" content=\"" + rdesc + "\" />\n"
    html +=   "<meta property=\"og:image\" content=\"" + simg + "\" />\n"
    html +=   "<meta property=\"twitter:image\" content=\"" + simg + "\" />\n"
    html +=   "<meta itemprop=\"image\" content=\"" + simg + "\" />\n"
    html +=   "<meta itemprop=\"description\" content=\"" + rdesc + "\" />\n"
    html +=   "<title>" + getTitle(rev)
    if subkey:
        html += " - " + subkey
    html +=   "</title>\n"
    html +=   "<link href=\"../css/site.css\" rel=\"stylesheet\""
    html +=        " type=\"text/css\" />\n"
    html +=   "<link rel=\"image_src\""
    html +=        " href=\"" + simg + "\" />\n"
    html += "</head>\n"
    html += "<body id=\"bodyid\">\n"
    # HTML content adapted from index.html...
    html += "<div id=\"staticlogodiv\">\n"
    html += "  <img src=\"../img/wdydfun.png\" id=\"logoimg\"\n"
    html += "       border=\"0\"\n"
    html += "       onclick=\"window.location.href='" + revurl + "';"
    html +=                  "return false;\""
    html += "       style=\"width:243px;height:120px;\"/>\n"
    html += "</div>\n"
    html += "<div id=\"contentdiv\" class=\"statrevcontent\">\n"
    # HTML adapted from profile.js displayProfileHeading
    html +=   "<div id=\"centerhdiv\">\n"
    html +=     "<span id=\"penhnamespan\">"
    html +=       "<a href=\"" + blogurl + "\""
    html +=         " title=\"Show blog for " + pen.name + "\""
    html +=         " onclick=\"window.location.href='" + blogurl + "';"
    html +=                    "return false;\""
    html +=         ">" + pen.name + "</a>"
    html +=     "</span>\n"
    html +=     "<span id=\"penhbuttonspan\">"
    html +=       "<a href=\"" + revurl + "\""
    html +=         " title=\"View from your pen name\""
    html +=         " onclick=\"window.location.href='" + revurl + "';"
    html +=                    "return false;\""
    html +=       "><img class=\"navico\" src=\"../img/penname.png\"/></a>"
    html +=     "</span>\n"
    html +=   "</div>"
    # HTML copied/adapted from review.js displayReviewForm
    html +=   "<div class=\"formstyle\" id=\"revdispdiv\"\n>"
    html +=     "<div id=\"revformstarsdiv\" style=\"width:90%;\">\n"
    html +=       "<div id=\"revformstarscontent\">\n"
    html +=         "<div id=\"rfsjumpdiv\" style=\"float:right;\">\n"
    html +=           urlImageLink(rev)
    html +=         "</div>\n"
    html +=         "<div id=\"rfsratediv\">\n"
    html +=           "<span id=\"stardisp\">\n"
    html +=             starsImageHTML(rev.rating)
    html +=           "</span>\n" 
    html +=           "&nbsp;" + badgeImageHTML(rev.revtype)
    html +=         "</div>\n"
    html +=       "</div>\n"
    html +=     "</div>\n"  #revformstarsdiv
    html +=     "<div id=\"revformfieldsdiv\">\n"
    html +=       fieldsTable(rev)
    html +=     "</div>\n"
    html +=     "<div class=\"shoutoutstatic\" style=\"width:90%;\">\n"
    html +=       displayText(rev.text)
    html +=     "</div>\n"
    html +=     "<div id=\"revformkeywareadiv\">\n"
    html +=       "<div class=\"csvstrdiv\">\n"
    html +=         safestr(rev.keywords)
    html +=       "</div>\n"
    html +=     "</div>\n"
    html +=     "<div id=\"revformimagediv\">\n"
    html +=       reviewPicHTML(rev)
    html +=     "</div>\n"
    html +=   "</div>\n"
    # This is a public facing page, not a logged in page, so show some
    # ads to help pay for hosting. As if anyone ever clicks...
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
    # referral tracking
    if refer:
        html += "<img src=\"../bytheimg?statinqref=" + safeURIEncode(refer) +\
            "\"/>\n"
    else: #use img with id and try find referrer via script
        html += "<img id=\"btwimg\" src=\"../bytheimg?statinq=" + revidstr +\
            "\"/>\n"
    html += generalScriptHTML()
    html += "</body>\n"
    html += "</html>\n"
    return html;


class StaticReviewDisplay(webapp2.RequestHandler):
    def get(self, revid):
        review = cached_get(intz(revid), Review)
        if not review:
            self.error(404)
            self.response.out.write("Review " + revid + " not found")
            return
        pen = cached_get(review.penid, PenName)
        if not pen:
            self.error(404)
            self.response.out.write("PenName " + review.penid + " not found")
            return
        logging.info("request: " + str(self.request))
        html = revhtml(review, pen, self.request.referer);
        self.response.headers['Content-Type'] = "text/html; charset=UTF-8";
        self.response.out.write(html);


app = webapp2.WSGIApplication([('/statrev/(\d+)', StaticReviewDisplay)],
                              debug=True)

