import webapp2
from google.appengine.ext import db
from google.appengine.api import memcache
import logging
from rev import Review
from group import Group
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
  <meta name="description" content="$GROUPNAME" />
  <meta property="og:image" content="$IMGSRC" />
  <meta property="twitter:image" content="$IMGSRC" />
  <meta itemprop="image" content="$IMGSRC" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$GROUPNAME</title>
  <link href="../css/site.css" rel="stylesheet" type="text/css" />
  <link rel="image_src" href="$IMGSRC" />
</head>
<body id="bodyid">

$CONTENT

<script src="../js/jtmin.js"></script>
<script src="../js/amd/groupview.js"></script>
<script src="../js/amd/layout.js"></script>
<script src="../js/amd/profile.js"></script>
<script src="../js/amd/review.js"></script>
<script src="../js/amd/group.js"></script>
<script>
  wdydfunGroupview.display();
</script>

</body>
</html>
"""

bodycontent = """
<div id="groupdescrdiv">
  <a href="../#view=group&groupid=$GROUPID">$GROUPNAME</a>
  <noscript>
    <p><b>You need to enable Javascript to format this page...
      </b></p>
  </noscript>
  <p>WDYDFun static group view</p>
  $GROUPDESCR
</div>

<div id="groupcontentdiv">
</div>

<div id="groupdatadiv">
$GROUPJSON
</div>

<div id="grouprevdatadiv">
$REVDATA
</div>

<div id="referdiv">
$REFER
</div>

<div id="dlgdiv"></div>
"""


def recent_group_reviews(group):
    qres = QueryResult()
    if group.reviews:
        revids = group.reviews.split(",")
        for idx, revid in enumerate(revids):
            rev = cached_get(intz(revid), Review)
            if rev:
                qres.objects.append(rev)
                if idx > 20:
                    break
    return qres


def prepare_content(handler, gcname, content):
    # Same index retrieval used for unique group name checking
    groups = Group.gql("WHERE name_c=:1 LIMIT 1", gcname)
    if groups.count() != 1:
        handler.error(404)
        handler.response.out.write("Group identifier " + gcname + " not found")
        return
    group = groups[0];
    qres = recent_group_reviews(group)
    picurl = "img/emptyprofpic.png"
    if group.picture:
        picurl = "grppic?groupid=" + str(group.key().id())
    # facebook doesn't like "../" relative urls
    if "localhost" in handler.request.url:
        picurl = "../" + picurl
    else:
        picurl = "http://www.wdydfun.com/" + picurl
    content = re.sub('\$GROUPNAME', group.name, content)
    content = re.sub('\$GROUPDESCR', group.description, content)
    content = re.sub('\$IMGSRC', picurl, content)
    content = re.sub('\$GROUPID', str(group.key().id()), content)
    content = re.sub('\$GROUPJSON', obj2JSON(group), content)
    content = re.sub('\$REVDATA', qres2JSON(
            qres.objects, "", -1, ""), content)
    refer = handler.request.referer
    if refer:
        refer = "<img src=\"../bytheimg?grpinqref=" +\
            safeURIEncode(refer) + "\"/>\n"
    else:
        refer = "<img id=\"btwimg\" src=\"../bytheimg?grpinq=" +\
            str(group.key().id()) + "\"/>\n"
    content = re.sub('\$REFER', refer, content)
    content = re.sub('\&quot;', "\\\"", content)  #browser interp pre-parse
    return content


class GroupViewDisplay(webapp2.RequestHandler):
    def get(self, gcname):
        content = html
        content = re.sub('\$CONTENT', bodycontent, content)
        content = prepare_content(self, gcname, content)
        self.response.headers['Content-Type'] = 'text/html; charset=UTF-8'
        self.response.out.write(content)


class EmbedGroupScript(webapp2.RequestHandler):
    def get(self, gcname):
        gcname = gcname[0:gcname.index(".")]  #strip ".js" suffix
        try:
            result = urlfetch.fetch("http://www.wdydfun.com/css/site.css",
                                    method="GET",
                                    allow_truncated=False, 
                                    follow_redirects=True, 
                                    deadline=10, 
                                    validate_certificate=False)
            content = "<style scoped>" + result.content + "</style>"
        except Exception as e:
            logging.info("EmbedGroupScript site.css fetch failed: " + str(e))
            content = "<!-- error fetching site.css -->"
        content += bodycontent
        content = prepare_content(self, gcname, content)
        content = content.replace("\\\"", "\\\\\"")
        content = content.replace("\"", "\\\"")
        content = re.sub('\n', '', content)
        content = "var WDYDFunEmbeddedGroupHTML = \"" + content + "\""
        self.response.headers['Content-Type'] = 'application/javascript; charset=UTF-8'
        self.response.out.write(content)



app = webapp2.WSGIApplication([('/groups/(.*)', GroupViewDisplay),
                               ('/emgroup/([^/]*)', EmbedGroupScript)],
                              debug=True)

