import webapp2
import logging
import datetime
import coop
import muser
import consvc
from google.appengine.api import memcache
from morutil import *
from cacheman import *
import urllib
import json
from operator import attrgetter, itemgetter

# Provide appropriate source for the main page or hashtag specified page.

cachev = "v=190806"

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

  <div id="bottomnav">
    <div id="bottomstatdiv"></div>
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
  app.pfoj = $PREFETCHOBJSON;
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
        <p><b>Membic is a JavaScript app, please enable script and reload.</b></p>
      </noscript>
"""

interimcont = """
<div class="defcontentsdiv" id="membicdefinitiondiv">
  <div class="defcontentinnerdiv">
    <div class="defsyllabicdiv">mem&#x00b7;bic</div>
    <div class="defphoneticdiv">/'mem.b&#x026a;k/</div>
    <div class="defpartofspeachdiv">noun</div>
    <div class="defdefdiv">
      1. A link with a reason why it is memorable.
    </div>
    <div class="sitemetalinksdiv">
      <a href="docs/privacy.html" onclick="app.layout.displayDoc('docs/privacy.html',true);return false;">Privacy</a>
      <a href="docs/terms.html" onclick="app.layout.displayDoc('docs/terms.html',true);return false;">Terms</a>
      <a href="https://membic.wordpress.com" onclick="window.open('https://membic.wordpress.com');return false;">Blog</a>
    </div>
  </div>
</div>

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

tplinkhtml = """
<div class="tplinkdiv" id="tplinkdiv$TPID">
  <div class="tplinkpicdiv"></div>
  <div class="tplinkdescdiv">
    <span class="tplinknamespan"><a href="/$HASHTAG">$NAME</a></span>
    $DESCRIP
  </div>
</div>
"""


def json_for_theme_prof(obj, obtype):
    sd = {"instid": str(obj.key().id()),
          "obtype": obtype,
          "modified": obj.modified,
          "lastwrite": obj.lastwrite or obj.modified,
          "hashtag": obj.hashtag}
    if not sd["hashtag"]:
        sd["hashtag"] = sd["instid"]
    if obtype == "theme":
        if obj.picture:
            sd["pic"] = str(obj.key().id())
        sd["name"] = obj.name
        sd["description"] = obj.description
        sd["founders"] = obj.founders
        sd["moderators"] = obj.moderators
        sd["members"] = obj.members
        sd["seeking"] = obj.seeking
        sd["rejects"] = obj.rejects
    elif obtype == "profile":
        if obj.profpic:
            sd["pic"] = str(obj.key().id())
        sd["name"] = obj.name or sd["hashtag"]
        sd["description"] = obj.aboutme
    return json.dumps(sd)


def fetch_recent_themes_and_profiles(handler):
    jtxt = ""
    vios = consvc.get_connection_service("termsvio").data
    vq = VizQuery(coop.Coop, "ORDER BY modified DESC")
    objs = vq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for obj in objs:
        if not obj.preb or len(obj.preb) < 10:  # no membics
            continue
        if csv_contains(obj.kind() + ":" + str(obj.key().id()), vios):
            continue
        if jtxt:
            jtxt += ","
        jtxt += json_for_theme_prof(obj, "theme")
    vq = VizQuery(muser.MUser, "ORDER BY modified DESC")
    objs = vq.fetch(50, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    for obj in objs:
        if not obj.preb or not len(obj.preb) or obj.preb == "[]":  # no membics
            continue
        if not obj.profpic: # not public facing in any serious way
            continue
        if csv_contains(obj.kind() + ":" + str(obj.key().id()), vios):
            continue
        if jtxt:
            jtxt += ","
        jtxt += json_for_theme_prof(obj, "profile")
    return "[" + jtxt + "]"


# cache fetch most recently modified 50 themes and 50 profiles.
def recent_active_content(handler):
    content = ""
    jtps = memcache.get("activecontent")
    if not jtps:
        jtps = fetch_recent_themes_and_profiles(handler)
        memcache.set("activecontent", jtps)
    ods = json.loads(jtps)
    for od in ods:
        # logging.info(str(od))
        # logging.info(od["obtype"] + od["instid"] + " " + od["hashtag"])
        th = tplinkhtml
        th = th.replace("$TPID", od["instid"])
        th = th.replace("$HASHTAG", od["hashtag"])
        th = th.replace("$NAME", od["name"])
        th = th.replace("$DESCRIP", od["description"])
        content += th
    pfoj = {"obtype":"activetps", "instid":"411", "_id":"411", 
            "modified":nowISO(), "jtps": ods}
    pfoj = json.dumps(pfoj)
    return content, pfoj


def membics_from_prebuilt(obj):
    html = ""
    mems = obj.preb or "[]"
    mems = json.loads(mems)
    objidstr = str(obj.key().id())
    for membic in mems:
        # for themes, the first entry in the preb might the theme itself
        if "revtype" not in membic:
            continue
        # themes have both the source rev and the theme rev, just use theme
        if obj.key().kind() == "Coop" and membic["ctmid"] != objidstr:
            continue
        rh = revhtml
        rh = rh.replace("$RID", membic["_id"])
        rh = rh.replace("$RTYPE", membic["revtype"])
        rh = rh.replace("$RURL", membic["url"] or "")
        rh = rh.replace("$RTIT", membic["title"] or membic["name"])
        rh = rh.replace("$RAT", str(membic["rating"]) or "75")
        rh = rh.replace("$DESCR", membic["text"] or "")
        html += rh
    return html


def content_and_prefetch(handler, obj):
    if obj:
        content = membics_from_prebuilt(obj)
        pfoj = obj2JSON(obj)  # includes all fields (public)
        if obj.key().kind() == "MUser":
            # always return fully filtered account info in document source.
            pfoj = muser.safe_json(obj, "public")
    else:
        content, pfoj = recent_active_content(handler)
    content += interimcont
    return content, pfoj


def sitepic_for_object(obj):
    img = "/img/membiclogo.png?" + cachev
    if obj:
        if obj.key().kind() == "Coop" and obj.picture:
            img = "/ctmpic?coopid=" + str(obj.key().id()) + "&" + cachev
        elif obj.key().kind() == "MUser" and obj.profpic:
            img = "/profpic?profileid=" + str(obj.key().id()) + "&" + cachev
    return img


def sitetitle_for_object(obj):
    title = "Membic"
    if obj:
        if obj.key().kind() == "Coop":
            title = obj.name or "Membic Theme"
            title = title.replace("\"", "'")
        elif obj.key().kind() == "MUser":
            title = obj.name or "Membic Profile"
            title = title.replace("\"", "'")
    return title


def sitedescr_for_object(obj):
    descr = "Membic helps people build reference link pages that can be added to other sites."
    if obj:
        if obj.key().kind() == "Coop":
            descr = obj.description or ""
            descr = descr.replace("\"", "'")
        elif obj.key().kind() == "MUser":
            descr = obj.aboutme or ""
            descr = descr.replace("\"", "'")
    return descr


def embed_spec_objson(handler, obj):
    embed = handler.request.get("site")
    if embed and obj:
        embed = "{coopid:\"" + str(obj.key().id()) +\
                "\", site:\"" + embed + "\"}"
    else:
        embed = "null"
    return embed


def obidstr_or_empty(obj):
    idstr = ""
    if obj:
        idstr = str(obj.key().id())
    return idstr


def feed_link(handler, ctm, apptype, feedformat):
    ctmid = str(ctm.key().id())
    html = "<link rel=\"alternate\" type=\"" + apptype + "\""
    html += " href=\"" + handler.request.host_url + "/rsscoop?coop=" + ctmid
    if feedformat:
        html += "&format=" + feedformat
    html += "\" />"
    return html


def feedlinks_for_object(handler, obj):
    if not obj or obj.key().kind() != "Coop":
        return ""
    linkhtml = feed_link(handler, obj, "application/rss+xml", "")
    linkhtml += "\n  " + feed_link(handler, obj, "application/json", "json")
    return linkhtml


def write_start_page(handler, obj, refer):
    content, pfoj = content_and_prefetch(handler, obj)
    html = indexHTML
    html = html.replace("$SITEPIC", sitepic_for_object(obj))
    html = html.replace("$TITLE", sitetitle_for_object(obj))
    html = html.replace("$DESCR", sitedescr_for_object(obj))
    html = html.replace("$CACHEPARA", "?" + cachev)
    html = html.replace("$REFER", refer or handler.request.referer or "")
    html = html.replace("$EMBED", embed_spec_objson(handler, obj))
    html = html.replace("$VANID", obidstr_or_empty(obj))
    html = html.replace("$INTERIMCONT", noscripthtml + content);
    html = html.replace("$FEEDLINKS", feedlinks_for_object(handler, obj))
    html = html.replace("$PREFETCHOBJSON", pfoj)
    handler.response.headers['Content-Type'] = 'text/html'
    handler.response.out.write(html)


def dbclass_for_obtype(obtype):
    if obtype == "theme" or obtype == "Coop":
        return coop.Coop
    if obtype == "profile" or obtype == "MUser":
        return muser.MUser
    return None


def query_for_hashtag(obtype, hashtag):
    instid = ""
    obj = None
    vq = VizQuery(dbclass_for_obtype(obtype), "WHERE hashtag = :1", hashtag)
    objs = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(objs) > 0:
        instid = str(objs[0].key().id())
        obj = objs[0]
        cache_verify(obj)
    return obtype, instid, obj


def instance_by_hashtag(hashtag):
    if hashtag.startswith("/"):
        hashtag = hashtag[1:]
    obtype = ""  # "theme" or "profile"
    instid = ""  # db object key as a string
    obj = None   # the database object from cache or query
    trans = memcache.get(hashtag)
    if trans:  # have a value like "theme:instid"
        trans = trans.split(":")
        logging.info("cached hashtag value: " + str(trans))
        obtype = trans[0]
        instid = trans[1]
        obj = cached_get(int(instid), dbclass_for_obtype(obtype))
    if not obj:
        obtype, instid, obj = query_for_hashtag("theme", hashtag)
    if not obj:
        obtype, instid, obj = query_for_hashtag("profile", hashtag)
    # hashtag might have been an instid
    if not obj and hashtag.isdigit():
        obj = cached_get(hashtag, dbclass_for_obtype("theme"))
        if obj:
            obtype = "theme"
            instid = hashtag
    if not obj and hashtag.isdigit():
        obj = cached_get(hashtag, dbclass_for_obtype("profile"))
        if obj:
            obtype = "profile"
            instid = hashtag
    if obj:  # note the hashtag translation for subsequent calls
        memcache.set(hashtag, obtype + ":" + instid)
    return obtype, instid, obj


class GetRecentActive(webapp2.RequestHandler):
    def get(self):
        content, pfoj = recent_active_content(self)
        srvJSON(self, "[" + pfoj + "]")


class PermalinkStart(webapp2.RequestHandler):
    def get(self, pt, dbid):
        # logging.info("PermalinkStart " + pt + " " + dbid)
        refer = self.request.get('refer') or ""
        obtype, instid, obj = instance_by_hashtag(dbid)
        if not obj:
            return srverr(self, 404, "No instance found for " + hashtag)
        write_start_page(self, obj, refer)


class IndexPageStart(webapp2.RequestHandler):
    def get(self):
        # logging.info("IndexPageStart")
        refer = self.request.get("refer") or ""
        write_start_page(self, "", refer)


class DefaultStart(webapp2.RequestHandler):
    def get(self, reqdet):
        # logging.info("DefaultStart " + reqdet)
        md = self.request.GET   # all params decoded into a UnicodeMultiDict
        refer = ""
        if "refer" in md and md["refer"]:
            refer = md["refer"]
        # Unpack "view=coop&coopid=idval" or other situations here if needed
        write_start_page(self, "", refer)


class VanityStart(webapp2.RequestHandler):
    def get(self, hashtag):
        # logging.info("VanityStart: " + hashtag)
        refer = self.request.get('refer') or ""
        obtype, instid, obj = instance_by_hashtag(hashtag)
        if not obj:
            return srverr(self, 404, "No instance found for " + hashtag)
        write_start_page(self, obj, refer)


app = webapp2.WSGIApplication([('.*/recentactive', GetRecentActive),
                               ('/([p|t|e])/(\d+).*', PermalinkStart),
                               ('/index.html', IndexPageStart),
                               ('(.*)/', DefaultStart),
                               ('(.*)', VanityStart)],
                              debug=True)
