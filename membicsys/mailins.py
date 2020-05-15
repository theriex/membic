""" Deal with mail-in membics """
#pylint: disable=missing-function-docstring
#pylint: disable=broad-except
#pylint: disable=logging-not-lazy
#pylint: disable=invalid-name
#pylint: disable=unsubscriptable-object
#pylint: disable=line-too-long
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
import imaplib
import email
from email import policy
import re
import logging
logging.basicConfig(level=logging.DEBUG)
import py.dbacc as dbacc
import py.useract as useract
import py.util as util
import json

MAILINADDR, MAILINPASS = "e@b.org", "foo"

# The processing here needs to use the same core processing as membicsave.
def make_mail_in_membic(msg):
    mimres = {}
    muser = dbacc.cfbk("MUser", "email", msg["emaddr"])
    if not muser:
        muser = dbacc.cfbk("MUser", "altinmail", msg["emaddr"])
        if not muser:
            raise ValueError("Email address " + msg["emaddr"] + " not found.")
    mimres["muser"] = muser
    msg["userid"] = muser["dsId"]
    membic = {"dsType":"Membic", "ctmid":"", "penid":muser["dsId"],
              "penname":muser["name"], "url":msg["url"], "revtype":"article",
              "text":msg["whymem"], "details":json.dumps({"title":msg["url"]})}
    mimres["tags"] = {}
    postctms = []
    for themetag in msg["themetags"]:
        if themetag.startswith("#"):
            themetag = themetag[1:]
        theme = dbacc.cfbk("Theme", "hashtag", themetag)
        if theme:
            pn = {"ctmid": theme["dsId"], "name": theme["name"], "revid": ""}
            mimres["tags"]["themetag"] = pn
            postctms.append(pn)
        else:
            mimres["tags"]["themetag"] = None
    membic["svcdata"] = json.dumps({"postctms": postctms})
    membic["cankey"] = useract.cankey_for_membic(membic)
    spf = useract.update_membic_and_preb(muser, membic)
    mimres["prebmembic"] = json.loads(json.loads(spf)["preb"])[0]
    return mimres


def ellipsis(text, maxlen=60):
    if len(text) > (maxlen + 3):
        text = text[0:maxlen] + "..."
    return text


def confirm_receipt(msg, mimres):
    logging.info("confirm_receipt Membic " + mimres["prebmembic"]["dsId"] +
                 " msg: " + str(msg))
    # send confirmation response letting them know it posted
    subj = "Membic created for " + ellipsis(msg["url"])
    body = "Mail-In Membic " + mimres["prebmembic"]["dsId"] + " created:\n"
    # reference the original message url in case the membic creation process
    # moves the membic url to rurl.
    body += " [url]: " + msg["url"] + "\n"
    body += "[text]: " + mimres["prebmembic"]["text"] + "\n"
    for tag, pn in mimres["tags"].items():
        stat = "Ignored"
        if pn:
            stat = pn["name"]
        body += "    #" + tag + ": " + stat + "\n"
    body += "\n"
    body += "You can view or edit this membic from your profile at "
    body += util.my_login_url(mimres["muser"], "https://membic.org") + "\n"
    util.send_mail(msg["emaddr"], subj, body, domain="membic.org",
                   sender=MAILINADDR.split("@")[0])


def reject_email(msg, errtxt):
    logging.info("reject_email " + errtxt + " msg: " + str(msg))
    if not msg["userid"]:
        return  # Not a membic user.  Probably spam.  Ignore.
    muser = dbacc.cfbk("MUser", "dsId", msg["userid"])
    subj = "Mail-In Membic failure for " + ellipsis(msg["url"])
    body = "Your Mail-In Membic didn't post.\n"
    body += "   [url]: " + msg["url"] + "\n"
    body += "[whymem]: " + msg["whymem"] + "\n"
    body += "[errmsg]: " + errtxt + "\n\n"
    body += "You sent:\n"
    body += "[subject]: " + msg["subject"] + "\n"
    body += "[content]: " + msg["body"] + "\n\n"
    body += "If this error message doesn't make sense to you, please forward this email to support@membic.org so we can look into it. You can also create the membic directly from your profile at "
    body += util.my_login_url(muser, "https://membic.org") + "\n"
    util.send_mail(msg["emaddr"], subj, body, domain="membic.org",
                   sender=MAILINADDR.split("@")[0])


# msg = {"from": "Membic User <test@example.com>",
#        "subject": "Reason why memorable #mytheme #othertheme",
#        "body": "Post a link to https://epinova.com when you read this"}
# "ugly html headers <body>example.com</body></html>"
def process_email_message(msg):
    # initialize result fields to normalize error handling
    msg["emaddr"] = ""
    msg["whymem"] = ""
    msg["themetags"] = []
    msg["url"] = ""
    msg["userid"] = ""
    try:
        # e.g. "Membic Writer <test@example.com>"
        emaddrs = re.findall(r"\S+@\S+\.\S+", msg["from"])
        if not emaddrs or len(emaddrs) == 0:
            raise ValueError("No email address found.")
        emaddr = emaddrs[0]
        if emaddr.startswith("<") and emaddr.endswith(">"):
            emaddr = emaddr[1:-1]
        msg["emaddr"] = emaddr
        # e.g. "Reason why memorable #mytheme #othertheme"
        whymem = msg["subject"]
        themetags = re.findall(r"(#\S+)", whymem)
        for tag in reversed(themetags):
            whymem = whymem.strip()
            if whymem.endswith(tag):
                whymem = whymem[0:-1 * len(tag)]
        msg["whymem"] = whymem.strip()
        msg["themetags"] = themetags
        # e.g. "Post a link to https://epinova.com when you read this"
        # The body may be arbitrarily ugly html.  Might include signature
        # lines with irrelevant links.
        body = msg["body"]
        subcontents = re.findall(r"<body", body, flags=re.IGNORECASE)
        if len(subcontents) > 0:  # trash all headers and associated urls
            body = body.split(subcontents[0])[1]
        urls = re.findall(r"https?://\S+", body, flags=re.IGNORECASE)
        if len(urls) == 0:  # try without prefix
            urls = re.findall(r"\S+\.\S+", body)
        if len(urls) == 0:
            raise ValueError("No URL provided")
        msg["url"] = urls[0]
        mimres = make_mail_in_membic(msg)
        confirm_receipt(msg, mimres)
    except Exception as e:
        reject_email(msg, str(e))


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
    msvr = imaplib.IMAP4_SSL("imap.dreamhost.com")  # port defaults to 993
    msvr.login(MAILINADDR, MAILINPASS)
    msvr.select("inbox")  # case doesn't seem to matter
    _, data = msvr.search(None, "ALL")   # returns list of 32bit mail ids
    # data will look something like [b'1 2 3'], so data[0] is b'1 2 3'
    mailids = data[0].split()   # now have something like [b'1', b'2', b'3']
    for mailid in mailids:
        # fetch 1st param can take a number, a range, or csv of ranges
        _, msgd = msvr.fetch(mailid, "(RFC822)")  # raw msg data
        # e.g. len(msgd) 2, msgd[0]: msg content, msgd[1]: closing paren
        for response_part in msgd:
            if isinstance(response_part, tuple):  # have content
                # e.g. response_part[0]: RFC822 id, [1]: binary text content
                # Convenience parse method recommends always specifying policy
                msg = email.message_from_bytes(response_part[1],
                                               policy=policy.SMTP)
                process_email_message({"from": find_from_address(msg),
                                       "subject": msg.get("subject"),
                                       "body": msg.get_content()})
        msvr.store(mailid, "+FLAGS", "\\Deleted")
        msvr.expunge()
    msvr.close()
    msvr.logout()

process_inbound_mail()
