import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import logging
from rev import Review
from pen import PenName
from moracct import obj2JSON, qres2JSON
from morutil import *
import re
import json
from cacheman import *


html = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="WDYDFun Blog for $PENNAME" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$PENNAME</title>
  <link href="../css/site.css" rel="stylesheet" type="text/css" />
</head>
<body id="bodyid">

<div id="siteproflinkdiv">
  <a href="../#view=profile&profid=$PENID">$PENNAME</a>
  <noscript>
    <p><b>You need to enable Javascript to format this page...
      </b></p>
  </noscript>
</div>

<div id="pendatadiv">
$PENJSON
</div>

<div id="revdatadiv">
$REVDATA
</div>

<script src="../js/jtmin.js"></script>
<script src="../js/amd/blogview.js"></script>
<script src="../js/amd/profile.js"></script>
<script src="../js/amd/review.js"></script>
<script>
  blogview.display();
</script>

</body>
</html>
"""


class BlogViewDisplay(webapp2.RequestHandler):
    def get(self, cpen):
        # Same index retrieval already used by pen.py NewPenName
        pens = PenName.gql("WHERE name_c=:1 LIMIT 1", cpen)
        if pens.count() != 1:
            self.error(404)
            self.response.out.write("Blog identifier " + cpen + " not found")
            return
        pen = pens[0];
        # filter sensitive PenName fields
        pen.mid = 0
        pen.gsid = "0"
        pen.fbid = 0
        pen.twid = 0
        pen.ghid = 0
        pen.abusive = ""
        # retrieve the review data.  Going back 90 days and not
        # filtering out batch updates.  More of an archival display...
        # See how it goes.
        dold = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(90))
        # Same index retrieval already used by rev.py SearchReviews
        where = "WHERE penid = :1 AND modified >= :2 AND modified <= :3" +\
            " ORDER BY modified DESC"
        ckey = "blog" + pen.name_c
        revquery = Review.gql(where, pen.key().id(), dold, nowISO())
        qres = cached_query(ckey, revquery, "", 3000, Review, True)
        revs = qres.objects;
        # write content
        content = html
        content = re.sub('\$PENNAME', pen.name, content)
        content = re.sub('\$PENID', str(pen.key().id()), content)
        content = re.sub('\$PENJSON', obj2JSON(pen), content)
        content = re.sub(', "abusive": ""', '', content)  #bad SEO :-)
        content = re.sub('\$REVDATA', qres2JSON(revs, "", -1, ""), content)
        content = re.sub('\&quot;', "\\\"", content)  #browser interp pre-parse
        self.response.headers['Content-Type'] = 'text/html; charset=UTF-8'
        self.response.out.write(content)
        

app = webapp2.WSGIApplication([('/blogs/(.*)', BlogViewDisplay)],
                              debug=True)

