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


MAILINADDR = "me" + "@" + mconf.domain
MAILINPASS = mconf.email["me"]
SITEROOT = "https://" + mconf.domain
SUPPADDR = "support" + "@" + mconf.domain

# The processing here needs to use the same core processing as membicsave.
def make_mail_in_membic(mimp):
    muser = mimp["muser"]
    membic = {"dsType":"Membic", "ctmid":"", "penid":muser["dsId"],
              "penname":muser["name"], "url":mimp["url"], "revtype":"article",
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
    muser = dbacc.cfbk("MUser", "email", emaddr)
    if not muser:
        muser = dbacc.cfbk("MUser", "altinmail", emaddr)
        if not muser:
            raise ValueError("Email address " + emaddr + " not found.")
    # If mailins are explicitely disabled, then continue as if the email
    # address was not found.  Don't email a response back.
    cliset = json.loads(muser.get("cliset", "{}"))
    mailins = cliset.get("mailins")
    if mailins and mailins != "enabled":
        raise ValueError("Mail-In Membics disabled")
    mimp["muser"] = muser


# mimp = {"from": "Membic User <test@example.com>",
#         "subject": "Reason why memorable #mytheme #othertheme",
#         "body": "Post a link to https://epinova.com when you read this"}
# "ugly html headers <body>example.com</body></html>"
def process_email_message(mimp):
    try:
        set_mimp_emaddr_fields(mimp)  # ValueError if unknown
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


def email_quote_original(mimp):
    tstamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    qt = "On " + tstamp + " " + mimp["emaddr"] + " wrote:\n"
    qt += textwrap.fill(mimp["body"], 76,
                        initial_indent="> ", subsequent_indent="> ")
    return qt


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
# original sending address.  Why mail-ins are not enabled by default.
def find_from_address(msg):
    sender = msg.get("X-Google-Original-From")
    if not sender:
        sender = msg.get("From")
    return sender


def process_inbound_mail():
    """ Read inbound email, create membics and clear from inbox. """
    try:
        msvr = imaplib.IMAP4_SSL(mconf.email["imap"])  # port defaults to 993
        msvr.login(MAILINADDR, MAILINPASS)
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
                    mimp = {"from": find_from_address(msg),
                            "subject": msg.get("subject"),
                            "body": msg.get_content()}
                    process_email_message(mimp)
            msvr.store(mailid, "+FLAGS", "\\Deleted")
            msvr.expunge()
        msvr.close()
        msvr.logout()
        logger.info("process_inbound_mail completed")
    except Exception as e:
        logging.exception("process_inbound_mail failed " + str(e))


process_inbound_mail()
