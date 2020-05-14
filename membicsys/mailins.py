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
    restxt = ""
    muser = dbacc.cfbk("MUser", "email", msg["emaddr"])
    if not muser:
        muser = dbacc.cfbk("MUser", "altinmail", msg["emaddr"])
        if not muser:
            raise ValueError("Email address " + msg["emaddr"] + " not found.")
    msg["userid"] = muser["dsId"]
    membic = {"dsType":"Membic", "ctmid":"", "penid":muser["dsId"],
              "penname":muser["name"], "url":msg["url"], "revtype":"article",
              "text":msg["whymem"], "details":json.dumps({"title":msg["url"]})}
    postctms = []
    for themetag in msg["themetags"]:
        if themetag.startswith("#"):
            themetag = themetag[1:]
        theme = dbacc.cfbk("Theme", "hashtag", themetag)
        if theme:
            restxt += "Posted to " + theme["name"] + " (#" + themetag + ")\n"
            postctms.append({"ctmid": theme["dsId"], "name": theme["name"],
                             "revid": ""})
        else:
            restxt += "No Theme found for #" + themetag + ". Ignored.\n"
    membic["svcdata"] = json.dumps({"postctms": postctms})
    membic["cankey"] = useract.cankey_for_membic(membic)
    useract.update_membic_and_preb(muser, membic)
    return restxt


def ellipsis(text, maxlen=60):
    if len(text) > (maxlen + 3):
        text = text[0:maxlen] + "..."
    return text


def confirm_receipt(restxt, msg):
    logging.info("confirm_receipt " + restxt + " msg: " + str(msg))
    # send confirmation response letting them know it posted
    subj = "Membic added " + ellipsis(msg["url"])
    body = "Membic added: " + msg["url"] + "\n"
    body += msg["whymem"] + "\n"
    body += restxt + "\n"
    util.send_mail(msg["emaddr"], subj, body, domain="membic.org",
                   sender=MAILINADDR.split("@")[0])


def reject_email(msg, errtxt):
    logging.info("reject_email " + errtxt + " msg: " + str(msg))
    if not msg["userid"]:
        return  # Not a membic user.  Probably spam.  Ignore.
    subj = "Mail-In Membic failure for " + ellipsis(msg["url"])
    body = "Your Mail-In Membic didn't post.\n"
    body += "   [url]: " + msg["url"] + "\n"
    body += "[whymem]: " + msg["whymem"] + "\n"
    body += "[errmsg]: " + errtxt + "\n\n"
    body += "You sent:\n"
    body += "[subject]: " + msg["subject"] + "\n"
    body += "[content]: " + msg["body"] + "\n\n"
    body += "If the error message doesn't make sense, please forward this email to support@membic.org along with your questions or comments.\n"
    util.send_mail(msg["emaddr"], subj, body, domain="membic.org",
                   sender=MAILINADDR.split("@")[0])


# msg = {"from": "Eric Parker <eric@epinova.com>",
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
        # e.g. "Eric Parker <eric@epinova.com>"
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
        restxt = make_mail_in_membic(msg)
        confirm_receipt(restxt, msg)
    except Exception as e:
        reject_email(msg, str(e))


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
                process_email_message({"from": msg.get("from"),
                                       "subject": msg.get("subject"),
                                       "body": msg.get_content()})
        msvr.store(mailid, "+FLAGS", "\\Deleted")
        msvr.expunge()
    msvr.close()
    msvr.logout()

process_inbound_mail()
