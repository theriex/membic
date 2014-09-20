import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import logging
from rev import Review
from pen import PenName
from moracct import obj2JSON, qres2JSON, safeURIEncode
from morutil import *
import re
import json
from cacheman import *
from google.appengine.api import urlfetch


html = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="$PAGEDESCR" />
  <meta property="og:image" content="$IMGSRC" />
  <meta property="twitter:image" content="$IMGSRC" />
  <meta itemprop="image" content="$IMGSRC" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$PENNAME</title>
  <link href="../css/site.css" rel="stylesheet" type="text/css" />
  <link rel="image_src" href="$IMGSRC" />
</head>
<body id="bodyid">

$CONTENT

<script src="../js/jtmin.js"></script>
<script src="../js/amd/blogview.js"></script>
<script src="../js/amd/layout.js"></script>
<script src="../js/amd/profile.js"></script>
<script src="../js/amd/review.js"></script>
<script src="../js/amd/pen.js"></script>
<script src="../js/amd/lcs.js"></script>
<script>
  fgfwebLogview.display();
</script>

</body>
</html>
"""

bodycontent = """
<div id="siteproflinkdiv">
  <a href="../#view=profile&profid=$PENID">$PENNAME</a>
  <noscript>
    <p><b>You need to enable Javascript to format this page...
      </b></p>
  </noscript>
</div>

<div id="profcontentdiv">
</div>

<div id="pendatadiv">
$PENJSON
</div>

<div id="revdatadiv">
$REVDATA
</div>

<div id="referdiv">
$REFER
</div>

<div id="dlgdiv"></div>
"""


def fetch_blog_reviews(pen):
    # retrieve the review data, not filtering out batch updates
    dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(365*2))
    # Same index retrieval already used by rev.py SearchReviews
    where = "WHERE penid = :1 AND modified >= :2 AND modified <= :3" +\
        " ORDER BY modified DESC"
    ckey = "blog" + pen.name_c
    revquery = Review.gql(where, pen.key().id(), dold, nowISO())
    # Return just enough results for an RSS feed to note updates, but
    # not so many that it takes any significant time to retrieve,
    # cache and return the results.  Client requests more to fill.
    qres = cached_query(ckey, revquery, "", 20, Review, True)
    return qres;


def make_page_desc(handler, pen):
    descr = "Recent reviews from " + pen.name
    # the hash tag part of the url is not passed to the server
    t20type = handler.request.get('type')
    if t20type and t20type != "recent":
        descr = "Top " + t20type + " reviews from " + pen.name
    return descr


def prepare_content(handler, cpen, content):
    # Same index retrieval already used by pen.py NewPenName
    pens = PenName.gql("WHERE name_c=:1 LIMIT 1", cpen)
    if pens.count() != 1:
        handler.error(404)
        handler.response.out.write("Blog identifier " + cpen + " not found")
        return
    pen = pens[0];
    # filter sensitive PenName fields
    pen.mid = 0
    pen.gsid = "0"
    pen.fbid = 0
    pen.twid = 0
    pen.ghid = 0
    pen.abusive = ""
    # retrieve reviews
    qres = fetch_blog_reviews(pen)
    # write content
    picurl = "img/emptyprofpic.png"
    if pen.profpic:
        picurl = "profpic?profileid=" + str(pen.key().id())
    # facebook doesn't like "../" relative urls
    if "localhost" in handler.request.url:
        picurl = "../" + picurl
    else:
        picurl = "http://www.fgfweb.com/" + picurl
    content = re.sub('\$PENNAME', pen.name, content)
    content = re.sub('\$PAGEDESCR', make_page_desc(handler, pen), content)
    content = re.sub('\$IMGSRC', picurl, content)
    content = re.sub('\$PENID', str(pen.key().id()), content)
    content = re.sub('\$PENJSON', obj2JSON(pen), content)
    content = re.sub(', "abusive": ""', '', content)  #bad SEO :-)
    content = re.sub('\$REVDATA', qres2JSON(
            qres.objects, "", -1, ""), content)
    refer = handler.request.referer
    if refer:
        refer = "<img src=\"../bytheimg?bloginqref=" +\
            safeURIEncode(refer) + "\"/>\n"
    else:
        refer = "<img id=\"btwimg\" src=\"../bytheimg?bloginq=" +\
            str(pen.key().id()) + "\"/>\n"
    content = re.sub('\$REFER', refer, content)
    content = re.sub('\&quot;', "\\\"", content)  #browser interp pre-parse
    return content


class BlogViewDisplay(webapp2.RequestHandler):
    def get(self, cpen, revtype):
        if revtype:
            self.redirect(re.sub("\/" + revtype, "?type=" + revtype,
                                 self.request.url))
            return
        content = html
        content = re.sub('\$CONTENT', bodycontent, content)
        content = prepare_content(self, cpen, content)
        self.response.headers['Content-Type'] = 'text/html; charset=UTF-8'
        self.response.out.write(content)


class EmbedBlogScript(webapp2.RequestHandler):
    def get(self, pname):
        pname = pname[0:pname.index(".")]  #strip ".js" suffix
        try:
            result = urlfetch.fetch("http://www.fgfweb.com/css/site.css",
                                    method="GET",
                                    allow_truncated=False, 
                                    follow_redirects=True, 
                                    deadline=10, 
                                    validate_certificate=False)
            content = "<style scoped>" + result.content + "</style>"
        except Exception as e:
            logging.info("EmbedBlogScript site.css fetch failed: " + str(e))
            content = "<!-- error fetching site.css -->"
        content += bodycontent
        content = prepare_content(self, pname, content)
        content = content.replace("\\\"", "\\\\\"")
        content = content.replace("\"", "\\\"")
        content = re.sub('\n', '', content)
        content = "var FGFwebEmbeddedBlogHTML = \"" + content + "\""
        self.response.headers['Content-Type'] = 'application/javascript; charset=UTF-8'
        self.response.out.write(content)


app = webapp2.WSGIApplication([('/blogs/([^/]*)/?(.*)', BlogViewDisplay),
                               ('/emblog/([^/]*)', EmbedBlogScript)],
                              debug=True)

