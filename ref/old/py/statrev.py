import webapp2
from google.appengine.ext import db
import logging
from rev import Review
from pen import PenName
from group import Group
from moracct import obj2JSON, qres2JSON, safestr, safeURIEncode
from morutil import *
import re
import json
import math
from cacheman import *


html = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="$REVDESC" />
  <meta property="og:image" content="$IMGSRC" />
  <meta property="twitter:image" content="$IMGSRC" />
  <meta itemprop="image" content="$IMGSRC" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$REVTITLE</title>
  <link href="../css/site.css" rel="stylesheet" type="text/css" />
  <link rel="image_src" href="$IMGSRC" />
</head>
<body id="bodyid">

<div id="siteproflinkdiv">
  <a href="../#view=pen&penid=$PENID">$PENNAME</a>
  <noscript>
    <p><b>You need to enable Javascript to format this page...
      </b></p>
  </noscript>
</div>

<div id="revcontentdiv">
$GRPLINKS
</div>

<div id="pendatadiv">
$PENJSON
</div>

<div id="revdatadiv">
$REVJSON
</div>

<div id="groupdatadiv">
$GRPSJSON
</div>

<div id="referdiv">
$REFER
</div>

<div id="dlgdiv"></div>

<div id="adoutercontainerdiv" class="mobileadspacediv">
  <div id="morgoogleads">
  </div>
</div>

<script src="../js/jtmin.js"></script>
<script src="../js/amd/statrev.js"></script>
<script src="../js/amd/layout.js"></script>
<script src="../js/amd/profile.js"></script>
<script src="../js/amd/review.js"></script>
<script src="../js/amd/lcs.js"></script>
<script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js\"></script>
<script>
  statrev.display();
</script>

</body>
</html>
"""


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


def extract_array_field_value(field, datastr):
    field = field + "\":["
    if not datastr or not field in datastr:
        return []
    datastr = datastr[datastr.index(field) + len(field):]
    datastr = datastr[:datastr.index("]")]
    if "," in datastr:
        datastr = datastr.split(",")
    else:
        datastr = [ datastr ]
    return datastr


def write_group_content(content, review):
    groups = []
    gids = extract_array_field_value("postedgroups", review.svcdata)
    for idx, grpid in enumerate(gids):
        grpid = grpid[1:len(grpid) - 1]  # strip quotes
        group = cached_get(intz(grpid), Group)
        if group:
            groups.append(group)
    content = re.sub('\$GRPSJSON', qres2JSON(groups, "", -1, ""), content)
    linkhtml = ""
    for group in groups:
        linkhtml += "<a href=\"../groups/" + canonize(group.name) + "\">" +\
            group.name + "</a>\n"
    content = re.sub('\$GRPLINKS', linkhtml, content)
    return content


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
        # filter sensitive PenName fields
        pen.mid = 0
        pen.gsid = "0"
        pen.fbid = 0
        pen.twid = 0
        pen.ghid = 0
        pen.abusive = ""
        # write content
        logging.info("request: " + str(self.request))
        revtitle = review.title;
        if not revtitle:
            revtitle = review.name;
        rdesc = descrip(review)
        timg = "../img/" + typeImage(review.revtype)
        simg = timg[0:-6] + "Pic2.png"
        content = html
        content = write_group_content(content, review)
        content = re.sub('\$REVDESC', rdesc, content)
        content = re.sub('\$IMGSRC', simg, content)
        content = re.sub('\$PENNAME', pen.name, content)
        content = re.sub('\$REVTITLE', revtitle, content)
        content = re.sub('\$PENID', str(pen.key().id()), content)
        content = re.sub('\$PENJSON', obj2JSON(pen), content)
        content = re.sub(', "abusive": ""', '', content)  #ugly field name 2 C
        content = re.sub('\$REVJSON', obj2JSON(review), content)
        refer = self.request.referer
        if refer:
            refer = "<img src=\"../bytheimg?statinqref=" +\
                safeURIEncode(refer) + "\"/>\n"
        else:
            refer = "<img id=\"btwimg\" src=\"../bytheimg?statinq=" +\
                str(review.key().id()) + "\"/>\n"
        content = re.sub('\$REFER', refer, content)
        content = re.sub('\&quot;', "\\\"", content)  #browser interp pre-parse
        self.response.headers['Content-Type'] = "text/html; charset=UTF-8";
        self.response.out.write(content);


app = webapp2.WSGIApplication([('/statrev/(\d+)', StaticReviewDisplay)],
                              debug=True)

