""" Deal with mail-in membics """
#pylint: disable=missing-function-docstring
#pylint: disable=broad-except
#pylint: disable=logging-not-lazy
#pylint: disable=invalid-name
#pylint: disable=unsubscriptable-object
#pylint: disable=line-too-long
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=multiple-imports
import py.mconf as mconf
import logging
import logging.handlers
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s %(module)s %(asctime)s %(message)s',
    handlers=[logging.handlers.TimedRotatingFileHandler(
        mconf.logsdir + "plg_mailins.log", when='D', backupCount=10)])
logger = logging.getLogger(__name__)
import imaplib, smtplib, ssl, textwrap, datetime
import email
from email import policy
import re
import py.dbacc as dbacc
import py.useract as useract
import py.util as util
import json
import sys

MAILINADDR = "me" + "@" + mconf.domain
MAILINPASS = mconf.email["me"]
SITEROOT = "https://" + mconf.domain
SUPPADDR = "support" + "@" + mconf.domain
FWDADDR = "forwarding" + "@" + mconf.domain
FWDPASS = mconf.email["forwarding"]

# The processing here needs to use the same core processing as membicsave.
# Important to set the membic "rurl" field (not the "url" field), so it is
# clear the link page meta info has not been read yet.  The title is set to
# the url in the interim.
def make_mail_in_membic(mimp):
    muser = mimp["muser"]
    membic = {"dsType":"Membic", "ctmid":"", "penid":muser["dsId"],
              "penname":muser["name"], "rurl":mimp["url"], "revtype":"article",
              "details":json.dumps({"title":mimp["url"]}),
              "text":mimp["whymem"]}
    mimp["tags"] = {}
    postctms = []
    for themetag in mimp["themetags"]:
        if themetag.startswith("#"):
            themetag = themetag[1:]
        theme = dbacc.cfbk("Theme", "hashtag", themetag)
        if theme:
            pn = {"ctmid": theme["dsId"], "name": theme["name"], "revid": ""}
            mimp["tags"]["themetag"] = pn
            postctms.append(pn)
        else:
            mimp["tags"]["themetag"] = None
    membic["svcdata"] = json.dumps({"postctms": postctms})
    membic["cankey"] = useract.cankey_for_membic(membic)
    spf = useract.update_membic_and_preb(muser, membic)
    mimp["prebmembic"] = json.loads(json.loads(spf)["preb"])[0]


def ellipsis(text, maxlen=60):
    if len(text) > (maxlen + 3):
        text = text[0:maxlen] + "..."
    return text


def mimp_summary(mimp):
    mid = mimp.get("prebmembic")
    if mid:
        mid = mid["dsId"]
    txt = "From: " + mimp["from"] + ", Membic: " + str(mid)
    for field in ["url", "whymem"]:
        val = mimp.get(field)
        if val:
            txt += ", " + field + ": " + str(val)
    return txt


def confirm_receipt(mimp):
    logger.info("confirm_receipt " + mimp_summary(mimp))
    # send confirmation response letting them know it posted
    subj = "Membic created for " + ellipsis(mimp["url"])
    body = "Mail-In Membic " + mimp["prebmembic"]["dsId"] + " created:\n"
    # reference the original url in case the membic creation process moves
    # the membic url to rurl.
    body += " [url]: " + mimp["url"] + "\n"
    body += "[text]: " + mimp["whymem"] + "\n"
    for tag, pn in mimp["tags"].items():
        stat = "Ignored"
        if pn:
            stat = pn["name"]
        body += "    #" + tag + ": " + stat + "\n"
    body += "\n"
    body += "You can view or edit this membic from your profile at "
    body += util.my_login_url(mimp["muser"], SITEROOT) + "\n\n"
    body += "This message is an automated response to your Mail-In Membic. If you have any questions or concerns, forward this message to " + SUPPADDR + " along with your comments so we can look into it. Thanks for using Membic!\n"
    util.send_mail(mimp["emaddr"], subj, body, domain=mconf.domain,
                   sender="me")
    logging.info("Confirmation email sent")


def reject_email(mimp, errtxt):
    logger.info("reject_email " + mimp_summary(mimp))
    if not mimp.get("muser"):
        return  # Not a membic user.  Probably spam.  Ignore.
    subj = "Mail-In Membic failure for " + ellipsis(mimp["subject"])
    body = "Your Mail-In Membic didn't post.\n"
    body += "   [url]: " + str(mimp.get("url")) + "\n"
    body += "[whymem]: " + str(mimp.get("whymem")) + "\n"
    body += "[errmsg]: " + errtxt + "\n\n"
    body += "You sent:\n"
    body += "[subject]: " + mimp["subject"] + "\n"
    body += "[content]: " + mimp["body"] + "\n\n"
    body += "If this error message doesn't make sense to you, please forward this email to " + SUPPADDR + " so we can look into it. You can also create the membic directly from your profile at "
    body += util.my_login_url(mimp["muser"], SITEROOT) + "\n"
    util.send_mail(mimp["emaddr"], subj, body, domain=mconf.domain,
                   sender="me")
    logging.info("Rejection response email sent")


def set_mimp_emaddr_fields(mimp):
    # e.g. "Membic Writer <test@example.com>"
    emaddrs = re.findall(r"\S+@\S+\.\S+", mimp["from"])
    if not emaddrs or len(emaddrs) == 0:
        raise ValueError("No email address found.")
    emaddr = emaddrs[0]
    if emaddr.startswith("<") and emaddr.endswith(">"):
        emaddr = emaddr[1:-1]
    mimp["emaddr"] = emaddr
    mimp["muser"] = dbacc.cfbk("MUser", "email", emaddr)
    if not mimp["muser"]:
        mimp["muser"] = dbacc.cfbk("MUser", "altinmail", emaddr)


def verify_mailin_muser(mimp):
    if not mimp["muser"]:
        raise ValueError("Email address " + mimp["emaddr"] + " not found.")
    # If mailins are explicitely disabled, then continue as if the email
    # address was not found.  Don't email a response back.
    cliset = json.loads(mimp["muser"].get("cliset") or "{}")
    mailins = cliset.get("mailins")
    if mailins and mailins != "enabled":
        mimp["muser"] = None
        raise ValueError("Mail-In Membics disabled")


# mimp = {"from": "Membic User <test@example.com>",
#         "subject": "Reason why memorable #mytheme #othertheme",
#         "body": "Post a link to https://epinova.com when you read this"}
# "ugly html headers <body>example.com</body></html>"
def process_mailin_message(mimp):
    try:
        set_mimp_emaddr_fields(mimp)
        verify_mailin_muser(mimp)
        # e.g. "Reason why memorable #mytheme #othertheme"
        whymem = mimp["subject"]
        themetags = re.findall(r"(#\S+)", whymem)
        for tag in reversed(themetags):
            whymem = whymem.strip()
            if whymem.endswith(tag):
                whymem = whymem[0:-1 * len(tag)]
        mimp["whymem"] = whymem.strip()
        mimp["themetags"] = themetags
        # e.g. "Post a link to https://epinova.com when you read this"
        # The body may be arbitrarily ugly html.  Might include signature
        # lines with irrelevant links.
        body = mimp["body"]
        subcontents = re.findall(r"<body", body, flags=re.IGNORECASE)
        if len(subcontents) > 0:  # trash all headers and associated urls
            body = body.split(subcontents[0])[1]
        urls = re.findall(r"https?://\S+", body, flags=re.IGNORECASE)
        if len(urls) == 0:  # try without prefix
            urls = re.findall(r"\S+\.\S+", body)
        if len(urls) == 0:
            raise ValueError("No URL provided")
        mimp["url"] = urls[0]
        make_mail_in_membic(mimp)
        confirm_receipt(mimp)
    except Exception as e:
        reject_email(mimp, str(e))


# Separate out main body, quoted field info, and any sig from main body.  Set
# the membic being referenced.
def read_body_fields(mimp):
    lines = mimp["body"].split("\n")
    for sec in ["body", "quoted", "sig"]:
        mimp[sec] = ""
    state = "body"
    qpat = r"[^>]*>\s\[(\w+)\]\s(.*)"
    for line in lines:
        if not line.strip():
            continue
        if state in ["body", "quoted"]:
            m = re.match(qpat, line)
            if m:
                state = "quoted"
                if m.group(1) == "dsId":
                    mimp["dsId"] = m.group(2)
            elif state == "quoted":
                state = "sig"
        mimp[state] += line.strip() + "\n"
    # logging.info("read_body_fields")
    # for fld in ["body", "quoted", "sig", "dsId"]:
    #     logging.info("    " + fld + ": " + mimp[fld])
    mimp["membic"] = dbacc.cfbk("Membic", "dsId", mimp["dsId"], required=True)


def profile_or_theme_for_resp(mimp):
    membic = mimp["membic"]
    ptobj = {"dsType":"MUser", "dsId":membic["penid"]}
    if membic["ctmid"] and int(membic["ctmid"]):
        ptobj = {"dsType":"Theme", "dsId":membic["ctmid"]}
    ptobj = dbacc.cfbk(ptobj["dsType"], "dsId", ptobj["dsId"], required=True)
    return ptobj


def link_for_object(ptobj):
    link = SITEROOT
    if ptobj.get("hashtag"):
        link += "/" + ptobj["hashtag"]
    elif ptobj["dsType"] == "Theme":
        link += "/theme/" + ptobj["dsId"]
    else:
        link += "/profile/" + ptobj["dsId"]
    return link


def append_cred(muser, link, conchar="?"):
    return (link + conchar + "an=" + muser["email"] + "&at=" +
            util.token_for_user(muser))


def verify_following(muser, ptobj):
    themes = json.loads(muser.get("themes") or "{}")
    tid = ptobj["dsId"]
    if ptobj["dsType"] == "MUser":
        tid = "P" + tid
    tdet = themes.get(tid)
    if tdet and tdet.get("lev"):
        return True
    return False


# Responses from a user may be blocked at either the theme or profile level.
# Both audience entries should exist to enable managing blocking, so create
# if needed.
def user_contact_blocked(muser, ptobj, membic):
    # check main contact point theme or profile
    where = ("WHERE srctype=\"" + ptobj["dsType"] + "\" AND srcid=" +
             ptobj["dsId"] + " AND uid=" + muser["dsId"] + " LIMIT 1")
    res = dbacc.query_entity("Audience", where)
    if not res or len(res) < 1:
        res = [dbacc.write_entity({"dsType":"Audience",
                                   "uid":muser["dsId"],
                                   "name":muser["name"],
                                   "srctype":ptobj["dsType"],
                                   "srcid":ptobj["dsId"],
                                   "lev":-1, "mech":"email"})]
    if res[0]["blocked"]:
        return True
    # check profile level if the main contact point was a theme
    if ptobj["dsType"] == "Theme":
        where = ("WHERE srctype=\"MUser\" AND srcid=" + membic["penid"] +
                 " AND uid=" + muser["dsId"] + " LIMIT 1")
        res = dbacc.query_entity("Audience", where)
        if not res or len(res) < 1:
            res = [dbacc.write_entity({"dsType":"Audience",
                                       "uid":muser["dsId"],
                                       "name":muser["name"],
                                       "srctype":"MUser",
                                       "srcid":membic["penid"],
                                       "lev":-1, "mech":"email"})]
        if res[0]["blocked"]:
            return True
    return False


def email_quote_original(mimp, tstamp=True, prefix="> "):
    qt = ""
    if tstamp:
        tstamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        qt = "On " + tstamp + " " + mimp["emaddr"] + " wrote:\n"
    if prefix:
        qt += textwrap.fill(mimp["body"], 76,
                            initial_indent=prefix, subsequent_indent=prefix)
        qt += "\n" + prefix  # replace separator line
    else:
        qt += mimp["body"]
    for secname in ["quoted", "sig"]:
        sec = mimp.get(secname)
        if sec:
            qt += "\n"
            for line in sec.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if prefix and not line.startswith(prefix):
                    line = prefix + line
                qt += line + "\n"
    return qt


# Responses go to whoever wrote the membic, not to all theme members.  The
# author can cc others in their response if they want, but that's a personal
# communication decision.  The incoming response might be from a friend, and
# the content might not be relevant to other theme members.  Keeping comms
# personal is important to avoid sending things people don't want.
#
# The body of the message might potentially be long.  It's expected to be a
# few lines of text, but it could be a pile.  Not truncating for now.  Can
# revisit if needed later, there should not be any dependencies on the text
# being sent, it is just to provide context for the comment.
def forward_response_comment(mimp):
    muser = mimp["muser"]
    membic = mimp["membic"]
    recu = dbacc.cfbk("MUser", "dsId", membic["penid"], required=True)
    # forward to recipient first in case anything goes wrong
    subj = mimp["subject"]
    body = mimp["from"] + " responded to your membic:\n\n"
    body += email_quote_original(mimp, tstamp=False, prefix="") + "\n"
    body += "To respond, simply reply to this message. You can block response notices from " + mimp["emaddr"] + " in your profile audience settings: " + SITEROOT + "/profile/" + str(membic["penid"]) + "?go=audience&uid=" + str(muser["dsId"]) + "\n"
    util.send_mail(recu["email"], subj, body, domain=mconf.domain,
                   sender="forwarding", replyto=muser["email"])
    # let the sender know their response was forwarded
    subj = mimp["subject"]  # "Re: " already in subject
    body = "Your comment has been forwarded to " + recu["name"] + " so they can respond to you directly.\n\n"
    body += email_quote_original(mimp) + "\n"
    util.send_mail(mimp["emaddr"], subj, body, domain=mconf.domain,
                   sender="forwarding")
    logging.info("Response comment forwarded " + str(muser["dsId"]) +
                 "->" + str(recu["dsId"]) + " re: " + membic["dsId"])


def reject_fwd(mimp, error):
    logger.info("reject_fwd " + error["det"] + " " + mimp_summary(mimp))
    if not mimp.get("muser"):
        return  # Ignore email. No response or forwarding.
    subj = "Response forwarding failure for " + ellipsis(mimp["subject"])
    body = "Your Membic response could not be forwarded.\n"
    body += error["err"] + "\n"
    body += error["det"] + "\n\n"
    body += "If something went wrong, please forward this message to " + SUPPADDR + " so we can look into it.\n\n"
    body += email_quote_original(mimp) + "\n"
    util.send_mail(mimp["emaddr"], subj, body, domain=mconf.domain,
                   sender="forwarding")
    logging.info("Response forwarding rejection sent")


# mimp = {"from": "Membic User <test@example.com>",
#         "subject": "Re: title or name from membic with ellipsis if needed...",
#         "body": "Whatever they felt like typing. Ignore any quoted stuff.\n" +
#         "> ...
#         "> [dsId] 16371\n" +    # Sender MUser dsId
#         "> ...
#         "signature and other trailing text to also pass along"}
def process_respfwd_message(mimp):
    try:
        set_mimp_emaddr_fields(mimp)
        # check they have an account
        if not mimp["muser"]:
            reject_fwd(mimp, {"err": "No account found.", "det": "Membic was unable to locate an account for \"" + mimp["emaddr"] + "\". If you have a Membic account, you can add this address to Alt Email in your profile settings, otherwise you are welcome to create an account at " + SITEROOT})
            return
        read_body_fields(mimp)  # sets mimp["membic"]
        if int(mimp["muser"]["dsId"]) == int(mimp["membic"]["penid"]):
            reject_fwd(mimp, {"err": "No self comment.", "det": "You emailed a comment for your own membic. It was not forwarded."})
            return
        ptobj = profile_or_theme_for_resp(mimp)
        # check they are following the theme or profile
        if not verify_following(mimp["muser"], ptobj):
            reject_fwd(mimp, {"err": "Not following.", "det": "To comment, you must be associated with " + ptobj["name"] + ". Choose \"Follow\" in your profile settings: " + append_cred(mimp["muser"], link_for_object(ptobj)) + "&go=settings"})
            return
        # check they are not blocked
        if user_contact_blocked(mimp["muser"], ptobj, mimp["membic"]):
            # Continue as if user was not found.  No email response or forward.
            mimp["muser"] = None
            raise ValueError("User responses blocked.")
        forward_response_comment(mimp)
    except Exception as e:
        reject_fwd(mimp, {"err": "Response forward error.", "det": str(e)})


def echo_test_message(mimp):
    try:
        set_mimp_emaddr_fields(mimp)  # ValueError if unknown
        sctx = ssl.create_default_context()  # validate host and certificates
        # 465: secured with SSL. 587: not secured, but supports STARTTLS
        with smtplib.SMTP_SSL(mconf.email["smtp"], 465, context=sctx) as smtp:
            smtp.login(MAILINADDR, MAILINPASS)
            smtp.sendmail(MAILINADDR, mimp["emaddr"],
                          "Subject: Re: " + mimp["subject"] + "\n\n" +
                          "echo_test received your message:\n\n" +
                          email_quote_original(mimp))
    except Exception as e:
        logging.exception(str(e))


# Unfortunately it is not possible to just get("from") and have things work.
# 15may20 Sending mail via Thunderbird 68.8 using foo@gmail.com account, with
# bar@example.com as the default identity, and sending as baz@other.org.
# Dumping msg.items() shows:
#    Return-Path: <foo@gmail.com>
#    Sender: Account Email <foo@gmail.com>
#    From: Default Identity <bar.example.com>
#    X-Google-Original-From: Sending Address <baz.other.org>
# As the headers show, "From" is the worst possible choice out of the three
# options: it is an arbitrary identity, but not the chosen send address.
# Apparently this is what Google does when the sending address is not set up
# as an "account you own", and that setup may not be possible if
# baz@other.org simply forwards to foo@gmail.com.  In terms of mail-in
# membics, the only reasonable choice in this case is to go with the
# original sending address.
def find_from_address(msg):
    sender = msg.get("X-Google-Original-From")
    if not sender:
        sender = msg.get("From")
    # If someone spoofs the sender address to be from the site itself, the
    # processing could be left chasing it's own tail.  Disallow.
    if sender and re.search(mconf.domain, sender, re.IGNORECASE):
        raise ValueError("Email automation may not originate from " +
                         mconf.domain)
    return sender


def get_from_subject_body(msg):
    mimp = {"from": find_from_address(msg),
            "subject": msg.get("subject"),
            "body": None}
    try:
        mimp["body"] = msg.get_content()
    except Exception as e:
        # 08jun20 python-3.8.2/lib/python3.8/email/contentmanager.py KeyError
        # 'multipart/alternative' in get_content.  Recover by walking.
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                # Expecting most email will have a plain text component if
                # it was written in a standard email client.
                mimp["body"] = part.get_payload()
        if not mimp["body"]:  # couldn't recover
            logging.exception("get_content failure " + str(e) + " from: " +
                              mimp["from"] +", subject: " + mimp["subject"])
            logging.info("start of message parts walk:")
            for part in msg.walk():
                logging.info("gfsb walk part " + part.get_content_type() +
                             ": " + str(part))
            logging.info("end of message parts walk:")
            mimp = None
    return mimp


def process_mailbox(dets):
    """ Read mailbox messages, process each, clear from inbox. """
    logpre = "process_mailbox " + dets["task"] + " "
    logging.info(logpre + "started")
    try:
        msvr = imaplib.IMAP4_SSL(mconf.email["imap"])  # port defaults to 993
        msvr.login(dets["addr"], dets["pwd"])
        msvr.select("inbox")  # case doesn't seem to matter
        _, data = msvr.search(None, "ALL")   # returns list of 32bit mail ids
        # data will look something like [b'1 2 3'], so data[0] is b'1 2 3'
        mailids = data[0].split()   # now have something like [b'1', b'2', b'3']
        # Traverse in reverse order since deleting, otherwise ids change.
        for mailid in reversed(mailids):
            logger.info("Processing mailid " + str(mailid))
            # fetch 1st param can take a number, a range, or csv of ranges
            _, msgd = msvr.fetch(mailid, "(RFC822)")  # raw msg data
            # e.g. len(msgd) 2, msgd[0]: msg content, msgd[1]: closing paren
            for response_part in msgd:
                if isinstance(response_part, tuple):  # have content
                    # e.g. response_part[0]: "RFC822", [1]: binary text content
                    # parse method recommends always specifying policy
                    msg = email.message_from_bytes(response_part[1],
                                                   policy=policy.SMTP)
                    mimp = get_from_subject_body(msg)
                    dets["func"](mimp)
            msvr.store(mailid, "+FLAGS", "\\Deleted")
            msvr.expunge()
        msvr.close()
        msvr.logout()
        logger.info(logpre + "completed")
    except Exception as e:
        logging.exception(logpre + "failed " + str(e))


def run_check():
    for arg in sys.argv:
        logging.info(arg)
    if len(sys.argv) < 2 or sys.argv[1] != "run":
        logging.info("No \"run\" command line argument so not running.")
        return
    process_mailbox({"task":"mailin", "addr":MAILINADDR, "pwd":MAILINPASS,
                     "func":process_mailin_message})
    process_mailbox({"task":"respfwd", "addr":FWDADDR, "pwd":FWDPASS,
                     "func":process_respfwd_message})


run_check()
