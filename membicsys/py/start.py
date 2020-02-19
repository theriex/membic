# Provide an index page for the specified hashtag, or the default page for
# the app.  This page has to be generated dynamically so a static fetch will
# have the appropriate title, description and pic references.

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

# TODO: remaining conversion requires .preb populated...
