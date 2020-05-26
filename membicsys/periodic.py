""" Start point for periodic work, typical daily summary type stuff """
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=invalid-name
#pylint: disable=missing-function-docstring
#pylint: disable=logging-not-lazy
#pylint: disable=inconsistent-return-statements
import py.mconf as mconf
import logging
import logging.handlers
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s %(module)s %(asctime)s %(message)s',
    handlers=[logging.handlers.TimedRotatingFileHandler(
        mconf.logsdir + "plg_periodic.log", when='D', backupCount=10)])
import py.util as util
import py.dbacc as dbacc
import datetime
import json
import sys


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
    txt += "Source Followers:\n"
    for key, audchks in nd["srcfs"].items():
        txt += "  " + key + ":\n"
        for ac in audchks:
            txt += "    " + ac["change"]
            for fld in ["uid", "name", "lev", "mech"]:
                txt += " " + str(ac["fra"][fld])
            txt += "\n"
    return txt


def note_source(sources, dsType, dsId, name, membic):
    dk = dsType + str(dsId)
    src = sources.get(dk)
    if not src:
        src = {"dsType":dsType, "dsId":dsId, "name":name, "membics":{},
               "audience":{}}
    src["membics"][membic["dsId"]] = membic
    sources[dk] = src


def note_follower(musers, src, info, follower):
    uid = follower["dsId"]
    mech = info.get("followmech") or "email"
    src["audience"][uid] = {"lev":info["lev"], "mech":mech,
                            "name":follower["name"]}
    if not info["lev"]:
        return  # No longer following, so don't send anything
    if mech == "RSS":
        return  # Following via webfeed, not email
    muser = musers.get(uid)
    if not muser:
        muser = {"dsId":uid, "email":follower["email"],
                 "name":follower["name"], "sources":[]}
    muser["sources"].append(src)
    musers[uid] = muser


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
    nd = {"start":sts, "end":ets,
          "membics":{}, "sources":{}, "musers":{}, "srcfs":{}}
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
    logging.info("fetch_notifications_data nd_as_string\n" + nd_as_string(nd))
    return nd


def follower_record_from_audinf(src, uid, audinf):
    return {"dsType":"Following", "dsId":"", "uid":uid, "name":audinf["name"],
            "srctype":src["dsType"], "srcid":src["dsId"], "lev":audinf["lev"],
            "mech":audinf["mech"], "blocked":"", "modified":""}


def verify_audiences(nd, updates="save"):
    for _, src in nd["sources"].items():
        srcaudchk = []
        for uid, audinf in src["audience"].items():
            changed = ""
            fra = follower_record_from_audinf(src, uid, audinf)
            frecs = dbacc.query_entity(
                "Following", "WHERE uid = " + str(uid) +
                " AND srctype = \"" + src["dsType"] + "\"" +
                " AND srcid = " + src["dsId"] + " LIMIT 1")
            if len(frecs) < 1:
                changed = "  Added"
            else:  # have existing follower record
                fre = frecs[0]
                for fld in ["name", "lev", "mech"]:  # user update fields
                    if fra[fld] != fre[fld]:
                        changed = "Updated"
                        fre[fld] = fra[fld]
                fra = fre
            if changed:  # added or updated
                if updates == "save":
                    fra = dbacc.write_entity(fra, vck=fra["modified"])
            else:
                changed = "     nc"
            srcaudchk.append({"change":changed, "fra":fra})
        nd["srcfs"][src["dsType"] + src["dsId"]] = srcaudchk


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
        body += (membic["url"] or membic["rurl"] or "No link provided") + "\n"
        body += membic["text"] + "\n"
        body += membic_poster_and_themes(membic) + "\n\n"
    body += "To unsubscribe from these notices, change your follow settings"
    body += " on https://membic.org\n"
    # Mail is sent from the default "support" account so that any responses
    # won't get handled by automation.
    util.send_mail(muser["email"], subj, body, domain="membic.org")


def send_audience_change_notices(nd):
    # walk the audience checks in the source followers and if there are
    # changes, send a note to the source membership.  Helpful to know when
    # you've gotten a new follower or one has dropped off.
    logging.info("send_audience_change_notices not implemented yet")


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
    send_audience_change_notices(nd)
    # Send the notifications data summary to support for general checking
    util.send_mail(None, "membic notifications data", nd_as_string(nd),
                   domain="membic.org")
    mn["uidcsv"] = ",".join(uids)
    mn["lastupd"] = dbacc.nowISO()


def preview_daily():
    sts = dbacc.nowISO()[0:10] + "T00:00:00Z"
    ets = dbacc.dt2ISO(dbacc.ISO2dt(sts) + datetime.timedelta(hours=24))
    nd = fetch_notifications_data(sts, ets)
    verify_audiences(nd, updates="discard")
    logging.info("preview_daily nd_as_string\n" + nd_as_string(nd))


# Don't particularly care what time the server is using, or what time this
# runs, as long as it is consistent.  Midnight to midnight ISO.
def daily_notices():
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        return preview_daily()
    logging.info(str(sys.argv))
    logging.info(str(util.envinfo()))
    ets = dbacc.nowISO()[0:10] + "T00:00:00Z"
    sts = dbacc.dt2ISO(dbacc.ISO2dt(ets) + datetime.timedelta(hours=-24))
    notice_name = "Daily Notice " + ets
    notice_subj = "Activity Summary from " + sts + " to " + ets
    mn = dbacc.cfbk("MailNotice", "name", notice_name)
    if mn:
        logging.info(notice_name + " already exists, not resending.")
        return
    nd = fetch_notifications_data(sts, ets)
    verify_audiences(nd)
    mn = dbacc.write_entity({"dsType": "MailNotice",
                             "name": notice_name,
                             "subject": notice_subj})
    send_follower_notifications(nd, mn)
    # note updated uidcsv and last send timestamp
    dbacc.write_entity(mn, vck=mn["modified"])
    logging.info("daily_notices completed " + dbacc.nowISO())


# run it
daily_notices()
