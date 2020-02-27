# Provide an index page for the specified hashtag, or the default page for
# the app.  This page has to be generated dynamically so a static fetch will
# have the appropriate title, description and pic references.

import flask
import json
import logging
import py.util as util
import py.dbacc as dbacc

# This cache bust value is updated via membic/build/cachev.js which keeps
# all the cache bust values updated and in sync across the sourcebase.  Do
# not edit it directly.
cachev = "v=200216"

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
      <ol>
      <li>A link with a reason why it is memorable.
      <li>An <a href="https://github.com/theriex/membic" onclick="window.open('https://github.com/theriex/membic');return false;">open source</a> project available free at membic.org
      <ol>
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


def pub_featurable(entity, obj, vios):
    preb = obj["preb"] or ""
    # logging.debug("pub_featurable " + obj["dsType"] + obj["dsId"] + 
    #               " len(preb): " + str(len(preb)))
    if len(preb) <= 3:
        return False  # Only featuring if have posted Membics
    if util.in_terms_vio(entity, obj["dsId"], vios):
        return False
    if entity == "MUser" and not obj["profpic"]:
        return False  # Need to be able to differentiate featured people
    return True


def json_for_theme_prof(obj, obtype):
    sd = {"instid": obj["dsId"],
          "obtype": obtype,
          "modified": obj["modified"],
          "lastwrite": obj["lastwrite"] or obj["modified"],
          "hashtag": obj["hashtag"]}
    if obtype == "theme":
        if obj["picture"]:
            sd["pic"] = obj["dsId"]
        sd["name"] = obj["name"]
        sd["description"] = obj["description"]
        sd["founders"] = obj["founders"]
        sd["moderators"] = obj["moderators"]
        sd["members"] = obj["members"]
        sd["seeking"] = obj["seeking"]
        sd["rejects"] = obj["rejects"]
    elif obtype == "profile":
        if obj["profpic"]:
            sd["pic"] = obj["dsId"]
        sd["name"] = obj["name"] or sd["hashtag"] or sd["dsId"]
        sd["description"] = obj["aboutme"]
    return json.dumps(sd)


def fetch_recent_themes_and_profiles():
    jtxt = ""
    vios = util.get_connection_service("termsvio")["data"]
    where = "ORDER BY modified DESC LIMIT 50"
    themes = dbacc.query_entity("Theme", where)
    for theme in themes:
        if not pub_featurable("Theme", theme, vios):
            continue
        if jtxt:
            jtxt += ","
        jtxt += json_for_theme_prof(theme, "theme")
    profcount = 0
    where = "ORDER BY lastwrite DESC LIMIT 200"
    musers = dbacc.query_entity("MUser", where)
    for muser in musers:
        if not pub_featurable("MUser", muser, vios):
            continue
        profcount += 1
        if jtxt:
            jtxt += ","
        jtxt += json_for_theme_prof(muser, "profile")
        if profcount >= 50:
            break
    return "[" + jtxt + "]"

    
# cache fetch most recently modified 50 themes and 50 profiles.
def get_recent_themes_and_profiles():
    # Previously cached under "activecontent"
    return fetch_recent_themes_and_profiles()


# Return content and pre-fetch object for recently active themes and profiles
def recent_active_content():
    content = ""
    jtps = get_recent_themes_and_profiles()
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
    # Return as a locally cacheable object for convenience.  By convention
    # non-persistent interim objects like this use a lowercase dsType.
    pfoj = {"dsType":"activetps", "dsId":"411", "modified":dbacc.nowISO(),
            "jtps": ods}
    pfoj = json.dumps(pfoj)
    return content, pfoj


def title_for_membic(membic):
    dets = membic["details"]
    if type(dets) == str:
        dets = json.loads(dets)
    title = ""
    if "title" in dets:
        title = dets["title"]
    elif "name" in dets:
        title = dets["name"]
    return title


def membics_from_prebuilt(obj):
    logmsg = "start.py membics_from_prebuilt " + obj["dsType"] + obj["dsId"]
    html = ""
    mems = obj["preb"] or "[]"
    mems = json.loads(mems)
    if type(mems) != list:
        logging.warning(logmsg + " mems is " + str(type(mems)))
    # logging.debug("membics_from_prebuilt: " + str(mems))
    objidstr = obj["dsId"]
    for idx, membic in enumerate(mems):
        if type(membic) != dict:
            logging.warning(logmsg + " mems[" + str(idx) + "] type " +
                            str(type(membic)) + " value " + str(membic))
        if membic["dsType"] == "Overflow":
            break  # Enough to start with. Client unpacks further on demand.
        rh = revhtml
        rh = rh.replace("$RID", membic["dsId"])
        rh = rh.replace("$RTYPE", membic["revtype"])
        rh = rh.replace("$RURL", membic["url"] or "")
        details = membic["details"]
        rh = rh.replace("$RTIT", title_for_membic(membic))
        rh = rh.replace("$RAT", str(membic["rating"]) or "75")
        rh = rh.replace("$DESCR", membic["text"] or "")
        html += rh
    return html


def content_and_prefetch(obj):
    if obj:
        content = membics_from_prebuilt(obj)
        pfoj = util.safe_JSON(obj)
    else:
        content, pfoj = recent_active_content()
    content += interimcont
    return content, pfoj


def sitepic_for_object(obj):
    img = "/img/membiclogo.png?" + cachev
    if obj and ((obj["dsType"] == "Theme" and obj["picture"]) or
                (obj["dsType"] == "MUser" and obj["profpic"])):
        img = "/api/obimg?" + util.pdtdi(obj)
    return img


def sitetitle_for_object(obj):
    title = "Membic"
    if obj:
        if obj["dsType"] == "Theme":
            title = obj["name"] or "Membic Theme"
            title = title.replace("\"", "'")
        elif obj["dsType"] == "MUser":
            title = obj["name"] or "Membic Profile"
            title = title.replace("\"", "'")
    return title


def sitedescr_for_object(obj):
    descr = "Membic blogs your memorable links."
    if obj:
        if obj["dsType"] == "Theme":
            descr = obj["description"] or "Another Membic Theme"
            descr = descr.replace("\"", "'")
        elif obj["dsType"] == "MUser":
            descr = obj["aboutme"] or "My Membic Link Blog"
            descr = descr.replace("\"", "'")
    return descr


def embed_spec_objson(obj):
    embed = dbacc.reqarg("site", "string")
    if embed and obj:
        embed = "{ctmid:\"" + str(obj.key().id()) +\
                "\", site:\"" + embed + "\"}"
    else:
        embed = "null"
    return embed


def obidstr_or_empty(obj):
    idstr = ""
    if obj:
        idstr = obj["dsId"]
    return idstr


def feed_link(ctm, apptype, feedformat):
    ctmid = ctm["dsId"]
    html = "<link rel=\"alternate\" type=\"" + apptype + "\""
    html += " href=\"" + util.site_home + "/rsscoop?coop=" + ctmid
    if feedformat:
        html += "&format=" + feedformat
    html += "\" />"
    return html


def feedlinks_for_object(obj):
    if not obj or obj["dsType"] != "Theme":
        return ""
    linkhtml = feed_link(obj, "application/rss+xml", "")
    linkhtml += "\n  " + feed_link(obj, "application/json", "json")
    return linkhtml


def write_start_page(obj, refer):
    content, pfoj = content_and_prefetch(obj)
    html = indexHTML
    html = html.replace("$SITEPIC", sitepic_for_object(obj))
    html = html.replace("$TITLE", sitetitle_for_object(obj))
    html = html.replace("$DESCR", sitedescr_for_object(obj))
    html = html.replace("$CACHEPARA", "?" + cachev)
    html = html.replace("$REFER", refer)
    html = html.replace("$EMBED", embed_spec_objson(obj))
    html = html.replace("$VANID", obidstr_or_empty(obj))
    html = html.replace("$INTERIMCONT", noscripthtml + content);
    html = html.replace("$FEEDLINKS", feedlinks_for_object(obj))
    html = html.replace("$PREFETCHOBJSON", pfoj)
    return html


# Aside from the default index page, the following urls are accepted:
#     /?u=1234     Returns start page for MUser 1234
#     /?t=1234     Returns start page for Theme 1234
#     /myhashtag  Returns start page for Theme or MUser #myhashtag
# Subfolders (e.g. "/user/1234") are not used because they mess up relative
# url references and that would make things more error prone.
def start_html_for_path(path, refer):
    if not path or path.startswith("index.htm"):
        obid = dbacc.reqarg("u", "string")
        if obid:
            logging.info("start_html_for_path MUser " + obid)
            return write_start_page(dbacc.cfbk("MUser", "dsId", obid), refer)
        obid = dbacc.reqarg("t", "string")
        if obid:
            logging.info("start_html_for_path Theme " + obid)
            return write_start_page(dbacc.cfbk("Theme", "dsId", obid), refer)
        logging.info("start_html_for_path writing default page")
        return write_start_page(None, refer)
    # dsIds are not unique across object types.  Hashtags are.  It should
    # be possible to have a numeric hashtag.
    hashtag = util.first_group_match("(\w+)", path)
    if hashtag:
        inst = dbacc.cfbk("Theme", "hashtag", hashtag)
        if not inst:
            inst = dbacc.cfbk("MUser", "hashtag", hashtag)
        if not inst:
            return util.srverr("Unknown hashtag: " + hashtag, code="404")
        return write_start_page(inst, refer)
    return util.srverr("start_html_for_path fell through. path: " + path)


##################################################
#
# API entrypoints
#
##################################################

def recentactive():
    content, pfoj = recent_active_content()
    return util.respJSON("[" + pfoj + "]")


# path is everything *after* the root url slash.
def startpage(path, refer):
    path = path or ""
    html = start_html_for_path(path.lower(), refer)
    return util.respond(html)
