import webapp2
import logging
import datetime
import pen
import coop
from google.appengine.api import memcache
from morutil import *
from cacheman import *
import urllib
import json
from operator import attrgetter, itemgetter

indexHTML = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="$DESCR" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="icon" href="$SITEPIC">
  <link rel="image_src" href="$SITEPIC" />
  <meta property="og:image" content="$SITEPIC" />
  <meta property="twitter:image" content="$SITEPIC" />
  <meta itemprop="image" content="$SITEPIC" />
  <title>$TITLE</title>
  <link href="css/site.css$CACHEPARA" rel="stylesheet" type="text/css" />
  $FEEDLINKS
</head>
<body id="bodyid">

<div id="topsectiondiv">
  <div id="topleftdiv">
    <div id="logodiv">
      <img src="img/membiclogo.png$CACHEPARA" id="logoimg"/></div>
    <div id="topactionsdiv"></div>
  </div> <!-- topleftdiv -->
  <div id="toprightdiv">
    <!-- login has to be an actual form to enable remembered passwords -->
    <div id="logindiv">
      <form id="loginform" method="post" action="redirlogin">
        <div id="loginparaminputs"></div>
        <div id="loginvisualelementsdiv">
          <label for="emailin" class="liflab">Email</label>
          <input type="email" class="lifin" name="emailin" id="emailin" 
                 placeholder="nospam@example.com"/>
          <div class="lifsep"></div>
          <label for="passin" class="liflab">Password</label>
          <!-- no onchange submit for password. breaks autoforms on safari -->
          <input type="password" class="lifin" name="passin" id="passin"/> 
          <div class="lifsep"></div>
          <div id="loginstatformdiv"></div>
          <div class="lifsep"></div>
          <div id="loginbuttonsdiv" class="lifbuttonsdiv">
            <button type="button" id="createAccountButton"
                    onclick="app.login.createAccount();return false;">
              Create Account</button>
            <input value="Sign in" type="submit" class="loginbutton"/>
            <a href="#intro" title="Information"
               onclick="app.layout.displayDoc('docs/about.html');return false;">
              <img id="infoimg" src="img/infotrim.png" style="opacity:0.6"/></a>
          </div>
          <div id="resetpassdiv"></div>
        </div> <!-- loginvisualelementsdiv -->
      </form>
    </div> <!-- logindiv -->
  </div> <!-- toprightdiv -->
</div>

<div id="headingdiv">
  <div id="loginstatdiv"></div>
  <div id="headingdivcontent"></div>
</div>

<div id="sysnoticediv"></div>

<div id="appspacediv">
  <div id="contentdiv">
    <div id="loadstatusdiv">
      Loading Application...
    </div>
    <div id="interimcontentdiv">
      $INTERIMCONT
    </div> <!-- interimcontentdiv -->
  </div> <!-- contentdiv -->

  <div id="bottomnav"> <!-- equivalent links also in docs/about.html -->
    <div id="bottomstatdiv"></div>
    <a href="docs/terms.html" class="footerlink">TERMS</a>
    <a href="docs/privacy.html" class="footerlink">PRIVACY</a>
    <span style="word-spacing:5px;"><a href="docs/howto.html" class="footerlink">HOW TO</a></span>
  </div>
</div>

<div id="xtrabsdiv"></div>
<!-- higher z than content, postioned above -->
<div id="topdiv">  
</div>
<!-- dialog -->
<div id="dlgdiv"></div>
<!-- limited popup form can appear over dialog -->
<div id="modalseparatordiv"></div>
<div id="overlaydiv"></div>

<script src="js/jtmin.js$CACHEPARA"></script>
<script src="js/app.js$CACHEPARA"></script>
<!-- uncomment if compiling <script src="js/compiled.js$CACHEPARA"></script> -->

<script>
  app.refer = "$REFER";
  app.embedded = $EMBED;
  app.vanityStartId = "$VANID";
  app.init();
</script>

<script id="placesapiscript" src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAktj-Nnv7dP6MTCisi6QVBWr-sS5iekXc&libraries=places"></script>

</body>
</html>
"""

noscripthtml = """
      <noscript>
        <p><b>Membic is a JavaScript app, please enable and reload this page.</b></p>
      </noscript>
"""

interimcont = """
<div class="defcontentsdiv">
  <div class="defcontentinnerdiv">
    <div class="defsyllabicdiv">mem&#x00b7;bic</div>
    <div class="defphoneticdiv">/'mem.b&#x026a;k/</div>
    <div class="defpartofspeachdiv">noun</div>
    <div class="defdefdiv">
      1. A link with a reason why it is memorable.
    </div>
  </div>
</div>

<p>Visit the <a href="https://membic.wordpress.com/">Membic Blog</a> for
details or the 
<a href="https://membic.wordpress.com/2016/02/17/introducing-membic"
         onclick="window.open('https://membic.wordpress.com/2016/02/17/introducing-membic');return false;">
        Introduction</a>.
       <br/>
"""


revhtml = """
<div id="pcd$RIDfpdiv" class="fpdiv">
  <div id="pcd$RID" class="fparevdiv">
    <div class="fpinrevdiv">
      <div class="fptitlediv">$RTYPE <a href="$RURL" onclick="window.open('$RURL');return false;">$RTIT</a> &nbsp; $RAT </div>
      <div class="fpbodydiv">
        <div id="pcd$RIDdescrdiv" class="fpdescrdiv">$DESCR</div></div>
    </div>
  </div>
</div>
"""


def theme_static_content(handler, ctm):
    if not ctm.preb:
        return ""
    html = ""
    count = 0
    tabname = handler.request.get("tab")
    tabname = tabname or "search"  # latest|top|search
    objs = json.loads(ctm.preb)
    # first obj is the coop, then the latest N most recent revs, then top20s
    objs = objs[1:]  # trim to just revs
    if tabname == "latest":
        objs = sorted(objs, key=itemgetter('modified'), reverse=True)
    else:
        objs = sorted(objs, key=itemgetter('rating', 'modified'), reverse=True)
    # it is possible to have two separate reviews for the same thing, so hide
    # anything that has the same cankey as the one just output.
    prevcankey = ""
    if tabname == "top":
        html += "<ol>\n"
    for obj in objs:
        if "revtype" in obj and obj["ctmid"] and obj["cankey"] != prevcankey:
            prevcankey = obj["cankey"]
            rh = revhtml
            rh = rh.replace("$RID", obj["_id"])
            rh = rh.replace("$RTYPE", obj["revtype"])
            rh = rh.replace("$RURL", obj["url"])
            rh = rh.replace("$RTIT", obj["title"] or obj["name"])
            rh = rh.replace("$RAT", str(obj["rating"]))
            rh = rh.replace("$DESCR", obj["text"])
            if tabname == "top":
                html += "<li>"
            html += rh
            count += 1
    if tabname == "top":
        html += "<ol>\n"
    else:
        count = 0  # only relevant if displaying top so you have the N
    return html, count


def feed_link(handler, ctm, apptype, feedformat):
    ctmid = str(ctm.key().id())
    html = "<link rel=\"alternate\" type=\"" + apptype + "\""
    html += " href=\"" + handler.request.host_url + "/rsscoop?coop=" + ctmid
    if feedformat:
        html += "&format=" + feedformat
    html += "\" />"
    return html


def feedlinks_for_theme(handler, ctm):
    linkhtml = feed_link(handler, ctm, "application/rss+xml", "")
    linkhtml += "\n  " + feed_link(handler, ctm, "application/json", "json")
    return linkhtml


def spdet(handler, dbclass, dbid, cachev):
    title = "Membic"
    descr = "Membic helps people track and share resource links that are worth remembering. People use membic themes to make resource pages for their sites."
    img = ""
    content = interimcont
    count = 0
    feedlinks = ""
    if dbclass == "pen":
        pnm = pen.PenName.get_by_id(dbid)
        if pnm:
            descr = "Membic profile for " + pnm.name
            descr = descr.replace("\"", "'")
            title = descr
            img = "/profpic?profileid=" + str(dbid)
    elif dbclass == "coop" or dbclass == "embed":
        ctm = coop.Coop.get_by_id(dbid)
        if ctm:
            title = ctm.name
            title = title.replace("\"", "'")
            descr = ctm.description
            descr = descr.replace("\"", "'")
            img = "/ctmpic?coopid=" + str(dbid)
            try:
                content, count = theme_static_content(handler, ctm)
            except Exception as e:
                logging.info("theme_static_content failed: " + str(e))
            if count > 1:
                title = "Top " + str(count) + " " + title
                descr = "Top " + str(count) + " " + descr
            feedlinks = feedlinks_for_theme(handler, ctm)
    if not img:
        img = "/img/membiclogo.png?" + cachev
    else:
        img += "&" + cachev
    return title, descr, img, content, feedlinks


def start_page_html(handler, dbclass, dbid, refer):
    # logging.info("----------------------------------------")
    # logging.info("start_page_html " + dbclass + str(dbid) + " " + refer)
    # logging.info("----------------------------------------")
    cachev = "v=181127"
    title, descr, img, content, feedlinks = spdet(handler, dbclass, dbid,
                                                  cachev)
    embed = "null"
    if dbclass == "embed":
        embed = "{coopid:" + str(dbid) + "}"
    # social nets require a full URL to fetch the image
    img = handler.request.host_url + img;
    html = indexHTML
    html = html.replace("$SITEPIC", img)
    html = html.replace("$TITLE", title)
    html = html.replace("$DESCR", descr)
    html = html.replace("$CACHEPARA", "?" + cachev)
    html = html.replace("$REFER", refer or handler.request.referer or "")
    html = html.replace("$EMBED", embed)
    html = html.replace("$VANID", str(dbid))
    html = html.replace("$INTERIMCONT", noscripthtml + content);
    html = html.replace("$FEEDLINKS", feedlinks)
    handler.response.headers['Content-Type'] = 'text/html'
    handler.response.out.write(html)


def coopid_for_hashtag(hashtag):
    if hashtag.startswith("/"):
        hashtag = hashtag[1:]
    coopid = memcache.get(hashtag)
    if not coopid:
        vq = VizQuery(coop.Coop, "WHERE hashtag = :1", hashtag)
        themes = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(themes) == 0:
            return 0
        coopid = str(themes[0].key().id())
        memcache.set(hashtag, coopid)
    return int(coopid)


class PermalinkStart(webapp2.RequestHandler):
    def get(self, pt, dbid):
        # logging.info("PermalinkStart " + pt + " " + dbid)
        refer = self.request.get('refer') or ""
        if pt == "t":
            return start_page_html(self, "coop", int(dbid), refer)
        if pt == "e":
            refer = refer or self.request.get('site') or ""
            return start_page_html(self, "embed", int(dbid), refer)
        if pt == "p":
            return start_page_html(self, "pen", int(dbid), refer)
        return srverr(self, 404, "Unknown permalink " + pt + ": " + dbid)


class IndexPageStart(webapp2.RequestHandler):
    def get(self):
        # logging.info("IndexPageStart")
        return start_page_html(self, "", 0, "")


class DefaultStart(webapp2.RequestHandler):
    def get(self, reqdet):
        # logging.info("DefaultStart " + reqdet)
        md = self.request.GET   # all params decoded into a UnicodeMultiDict
        if "mf" not in md or md["mf"] != "true":  # not a membic frame
            return start_page_html(self, "", 0, "")
        hashtag = None
        refer = ""
        if md["ref"]:
            refer = md["ref"]
        if md["det"]:
            det = md["det"]
            if det and len(det) > 1 and coop.is_valid_hashtag(det[1:]):
                hashtag = det
            elif "?" in det:
                params = det.split("?")[1].split("&")
                for param in params:
                    if param.startswith("r="):
                        refer = urllib.unquote(param[2:])
                    elif param.startswith("d="):
                        hashtag = urllib.unquote(param[2:])
            if not hashtag or len(hashtag) <= 1:
                logging.info("No hashtag found: " + str(md))
                return start_page_html(self, "", 0, refer)
            url = "https://membic.org" + hashtag
            if refer:
                url += "?refer=" + urllib.quote(refer)
            logging.info("redirect url: " + url)
            self.redirect(str(url))


class VanityStart(webapp2.RequestHandler):
    def get(self, hashtag):
        # logging.info("VanityStart: " + hashtag)
        refer = self.request.get('refer') or ""
        coopid = coopid_for_hashtag(hashtag)
        if not coopid:
            return srverr(self, 404, "No theme found for " + hashtag)
        return start_page_html(self, "coop", int(coopid), refer)


app = webapp2.WSGIApplication([('/([p|t|e])/(\d+).*', PermalinkStart),
                               ('/index.html', IndexPageStart),
                               ('(.*)/', DefaultStart),
                               ('(.*)', VanityStart)],
                              debug=True)
