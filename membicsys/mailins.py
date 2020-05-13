""" Deal with mail-in membics """
#pylint: disable=missing-function-docstring
#pylint: disable=broad-except
#pylint: disable=logging-not-lazy
#pylint: disable=invalid-name
#pylint: disable=unsubscriptable-object
import imaplib
import email
from email import policy
import re
import logging
logging.basicConfig(level=logging.DEBUG)


def make_mail_in_membic(msg):
    print("---------------------------")
    print(msg)


def reject_email(msg, errtxt):
    # probably best to send an email to support
    logging.info(errtxt + " msg: " + str(msg))


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
        return make_mail_in_membic(msg)
    except Exception as e:
        reject_email(msg, str(e))
        return None


def process_inbound_mail():
    """ Read inbound email, create membics and clear from inbox. """
    msvr = imaplib.IMAP4_SSL("imap.dreamhost.com")  # port defaults to 993
    msvr.login("EMAILADDRESS", "PASSWORD")
    msvr.select("inbox")  # case doesn't seem to matter
    _, data = msvr.search(None, "ALL")   # returns list of 32bit mail ids
    # data will look something like [b'1 2 3'], so data[0] is b'1 2 3'
    mailids = data[0].split()   # now have something like [b'1', b'2', b'3']
    for mailid in mailids:
        # fetch 1st param can take a number, a range, or csv of ranges
        _, msgd = msvr.fetch(str(int(mailid)), "(RFC822)")  # raw msg data
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
    msvr.close()
    msvr.logout()

process_inbound_mail()
