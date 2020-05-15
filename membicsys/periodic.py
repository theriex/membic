""" Start point for periodic work, typical daily summary type stuff """
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=invalid-name
#pylint: disable=missing-function-docstring
#pylint: disable=logging-not-lazy
import logging
import logging.handlers
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s %(module)s %(asctime)s %(message)s',
    handlers=[logging.handlers.TimedRotatingFileHandler(
        "plg_periodic.log", when='D', backupCount=10)])
logger = logging.getLogger(__name__)
import py.util as util
import py.dbacc as dbacc
import datetime
import json


def nd_as_string(nd):
    txt = "notifications_data " + nd["start"] + " to " + nd["end"] + "\n"
    txt += "membics created in this timeframe:\n"
    for key, membic in nd["membics"].items():
        url = membic["url"] or membic["rurl"]
        txt += "    " + membic["dsId"] + ": " + url + "\n"
    txt += "MUsers and Themes associated with these membics:\n"
    for key, src in nd["sources"].items():
        txt += "    " + key + ": " + str(src["membics"].keys()) + "\n"
    txt += "MUsers notified by email:\n"
    for key, muser in nd["musers"].items():
        srcs = [(s["dsType"] + str(s["dsId"])) for s in muser["sources"]]
        txt += "    " + key + ": " + str(srcs) + "\n"
    return txt


def note_source(sources, dsType, dsId, name, membic):
    dk = dsType + str(dsId)
    src = sources.get(dk)
    if not src:
        src = {"dsType":dsType, "dsId":dsId, "name":name, "membics":{}}
    src["membics"][membic["dsId"]] = membic
    sources[dk] = src


def note_follower(musers, src, info, follower):
    if not info["lev"]:
        return  # No longer following, so don't send anything
    mech = info.get("followmech")
    if mech == "RSS":
        return  # Following via webfeed, not email
    mid = follower["dsId"]
    muser = musers.get(mid)
    if not muser:
        muser = {"dsId":mid, "email":follower["email"],
                 "name":follower["name"], "sources":[]}
    muser["sources"].append(src)
    musers[mid] = muser


def source_has_membics_from_others(nd, src, muser):
    if not src:
        return False
    from_others = False
    for mid in src["membics"]:
        membic = nd["membics"][mid]
        if membic["penid"] != muser["dsId"]:
            from_others = True
            break
    return from_others


def find_users_to_notify(nd):
    # preb can be large, so page through.
    where = "WHERE created < \"{}\" ORDER BY created DESC LIMIT 100"
    created = dbacc.nowISO()
    res = ["whatever initial loop value"]
    while len(res) > 0:
        res = dbacc.query_entity("MUser", where.format(created))
        for muser in res:
            created = muser["created"]
            themes = muser.get("themes")
            if themes:
                themes = json.loads(themes)
                for tid, info in themes.items():
                    srcid = "Theme" + tid
                    if tid.startswith("P"):
                        srcid = "MUser" + tid[1:]
                    src = nd["sources"].get(srcid)
                    if source_has_membics_from_others(nd, src, muser):
                        note_follower(nd["musers"], src, info, muser)


# Return a dict with new membics and the users to be emailed.
def fetch_notifications_data(sts, ets):
    nd = {"start":sts, "end":ets, "membics":{}, "sources":{}, "musers":{}}
    where = "WHERE created > \"" + sts + "\" AND created <= \"" + ets + "\""
    where += " AND ctmid = 0 ORDER BY created DESC"
    for membic in dbacc.query_entity("Membic", where):
        nd["membics"][membic["dsId"]] = membic
        note_source(nd["sources"], "MUser", membic["penid"], membic["penname"],
                    membic)
        svcdata = membic.get("svcdata")
        if svcdata:
            svcdata = json.loads(svcdata)
            postctms = svcdata.get("postctms") or []
            for pn in postctms:
                note_source(nd["sources"], "Theme", pn["ctmid"], pn["name"],
                            membic)
    find_users_to_notify(nd)
    logger.info("fetch_notifications_data nd_as_string\n" + nd_as_string(nd))
    return nd


def membic_poster_and_themes(membic):
    names = [membic["penname"]]
    svcdata = membic.get("svcdata")
    if svcdata:
        svcdata = json.loads(svcdata)
        postctms = svcdata.get("postctms") or []
        for pn in postctms:
            names.append(pn["name"])
    return ", ".join(names)


def send_follower_notice(muser, membics):
    subj = "Membic activity summary"
    body = "There are new membics in Profiles and Themes you are following:\n\n"
    for _, membic in membics.items():
        dets = json.loads(membic["details"])
        body += (dets["title"] or dets["name"]) + "\n"
        body += (membic["url"] or "No link provided") + "\n"
        body += membic["text"] + "\n"
        body += membic_poster_and_themes(membic) + "\n\n"
    body += "To unsubscribe from these notices, change your follow settings"
    body += " on https://membic.org\n"
    util.send_mail(muser["email"], subj, body, domain="membic.org")


def send_follower_notifications(nd, mn):
    uids = []
    for uid, muser in nd["musers"].items():
        # might get the same membic from more than one source so consolidate
        membics = {}
        for src in muser["sources"]:
            for membicid, membic in src["membics"].items():
                membics[membicid] = membic
        send_follower_notice(muser, membics)
        uids.append(uid)
    # Send the notifications data summary to support for general checking
    util.send_mail(None, "membic notifications data", nd_as_string(nd),
                   domain="membic.org")
    mn["uidcsv"] = ",".join(uids)
    mn["lastupd"] = dbacc.nowISO()


# Don't particularly care what time the server is using, or what time this
# runs, as long as it is consistent.  Midnight to midnight ISO.
def daily_notices():
    util.is_development_server(verbose=True)
    ets = dbacc.nowISO()[0:10] + "T00:00:00Z"
    sts = dbacc.dt2ISO(dbacc.ISO2dt(ets) + datetime.timedelta(hours=-24))
    notice_name = "Daily Notice " + ets
    notice_subj = "Activity Summary from " + sts + " to " + ets
    mn = dbacc.cfbk("MailNotice", "name", notice_name)
    if mn:
        logger.info(notice_name + " already exists, not resending.")
        return
    nd = fetch_notifications_data(sts, ets)
    mn = dbacc.write_entity({"dsType": "MailNotice",
                             "name": notice_name,
                             "subject": notice_subj})
    send_follower_notifications(nd, mn)
    # note updated uidcsv and last send timestamp
    dbacc.write_entity(mn, vck=mn["modified"])
    logger.info("daily_notices completed " + dbacc.nowISO())


# run it
daily_notices()
