""" Interactive response page for fast site actions """
#pylint: disable=missing-function-docstring
#pylint: disable=logging-not-lazy
#pylint: disable=invalid-name
import logging
import urllib.parse     # to be able to use urllib.parse.quote
import py.util as util
import py.dbacc as dbacc
import py.useract as useract

RESPHTML = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="Membic Share Response Page" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="icon" href="/img/membiclogo.png">
  <link rel="image_src" href="/img/membiclogo.png" />
  <meta property="og:image" content="/img/membiclogo.png" />
  <meta property="twitter:image" content="/img/membiclogo.png" />
  <meta itemprop="image" content="/img/membiclogo.png" />
  <title>Membic Response</title>
<link href="/css/site.css?v=201120" rel="stylesheet" type="text/css">
<style type="text/css">
$PAGECSS
</style>
</head>
<body id="bodyid">

<div id="msgcontdiv">
  <div id="pcdpicdiv">
    <a href="https://membic.org">
      <img id="pcdpicimg" src="/img/membiclogo.png"></a></div>
  <div id="pcddescrdiv">
    <div id="pcdnamediv">
      <span class="penfont" id="pcdnamespan">Membic</span></div>
    <div id="pcdshoutdiv">
      <span class="descrspan" style="font-size:large;" id="pcddescrspan">
        $PAGEMSG
      </span></div>
  </div>
</div>

<script src="/js/jtmin.js"></script>
<script>
$PAGEJS
</script>
</body>
</html>
"""

PAGECSS = """
"""

PAGEJS = """
"""

def email_block_link(_ignore_path_arg):
    msid = str(dbacc.reqarg("msid", "dbid", required=True))
    em = dbacc.reqarg("em", "string", required=True)
    logging.info("irsp.email_block_link msid: " + msid + ", em:" + em)
    membic = dbacc.cfbk("Membic", "dsId", msid, required=True)
    muser = dbacc.cfbk("MUser", "email", em, required=True)
    subj = "Block membic share email from " + membic["penname"]
    body = ("To block " + membic["penname"] +
            " from sending you email via membic share, click this link:\n" +
            util.site_home() + "/irsp/bconf?msid=" + msid +
            "&sid=" + membic["penid"] +
            "&an=" + urllib.parse.quote(muser["email"]) +
            "&at=" + util.token_for_user(muser))
    if muser["status"] == "Pending":
        body += "&actcode=" + muser["actcode"]
    body += ("\n\nIf you did not want to block " + membic["penname"] +
             ", you can ignore this message. If you want to unblock " +
             membic["penname"] + " later, visit their profile at " +
             util.site_home() + "/profile/" + membic["penid"] +
             " and click the settings button. For any other questions or " +
             "concerns, just reply to this message.\n")
    util.send_mail(muser["email"], subj, body)
    return ("Membic support just sent a block confirmation to you at " +
            muser["email"] + ".")


def confirm_block(_ignore_path_arg):
    muser, _ignore_srvtok = util.authenticate()
    util.verify_active_account(muser)
    msid = str(dbacc.reqarg("msid", "dbid", required=True))
    membic = dbacc.cfbk("Membic", "dsId", msid, required=True)
    sender = dbacc.cfbk("MUser", "dsId", membic["penid"], required=True)
    logging.info("irsp.confirm_block " + muser["email"] + " blocked " +
                 sender["email"] + " from Membic " + msid + " " +
                 membic["text"][0:50] + "...")
    useract.update_association(muser, sender, muser,
                               {"assoc":"Blocking", "fm":"email"})
    return (sender["name"] + " (" + sender["email"] + ") has been blocked " +
            "from sending you any further email via membic share.")


def unknown_response(path):
    return "Unknown response request: " + path


##################################################
#
# API entrypoints
#
##################################################

# Write a response page for a site action.  When someone wants to block
# further email sends from someone, or otherwise directly and
# transcationally interact with the system via an email link, making them
# wait for supporting code+data to load will discourage them from
# interacting in the future.  This is for fast and simple handling with bare
# minimum overhead.
def rspg(path):
    try:
        path = path or ""
        ropts = {"block": email_block_link,
                 "bconf": confirm_block}
        respf = ropts.get(path, unknown_response)
        respmsg = respf(path)
        content = RESPHTML
        content = content.replace("$PAGECSS", PAGECSS)
        content = content.replace("$PAGEMSG", respmsg)
        content = content.replace("$PAGEJS", PAGEJS)
    except ValueError as e:
        return util.srverr("Interactive response error: " + str(e))
    return util.respond(content)
