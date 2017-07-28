import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import memcache
import logging
import moracct
from morutil import *
import pen
import coop
import rev
import mctr
import json
from operator import attrgetter, itemgetter
from cacheman import *

# factored methods for dealing with blocks of membics, like what is fetched
# for a profile.

def append_top20_membics_to_jsoncsv(jstr, membics, pct, pco, sizebound):
    topdict = {}
    if pco.top20s:
        topdict = json.loads(pco.top20s)
        for i in range(50):
            for rt in rev.known_rev_types:
                if rt in topdict and len(topdict[rt]) > i:
                    revid = int(topdict[rt][i])
                    membic = None
                    for recentrev in membics:
                        if recentrev.key().id() == revid:
                            membic = recentrev
                            break;
                    if membic:  # already have it so no need to add it again
                        continue
                    membic = rev.Review.get_by_id(revid)
                    if not membic:  # could be deleted coop membic or somesuch
                        continue
                    jstr = rev.append_review_jsoncsv(jstr, membic)
                    if len(jstr) > sizebound:
                        logging.info(pct + " " + str(pco.key().id()) + 
                                     " exceeded sizebound " + str(sizebound))
                        return jstr
    return jstr


# returns an array of the source object followed by all the membics
def rebuild_membics_block(pct, pgid):
    logging.info("rebuild_membics_block " + pct + " " + str(pgid))
    pco = None
    if pct == "coop":
        pco = coop.Coop.get_by_id(int(pgid))
        if pco and pco.preb and not coop.prebuilt_membics_stale(pco):
            return pco.preb
    elif pct == "pen":
        pco = pen.PenName.get_by_id(int(pgid))
        pen.filter_sensitive_fields(pco)
    if not pco:
        logging.info("rmb " + pct + " " + str(pgid) + " not found")
        return None
    where = "WHERE ctmid = 0 AND penid = :1 ORDER BY modified DESC"
    if pct == "coop":
        where = "WHERE ctmid = :1 ORDER BY modified DESC"
    vq = VizQuery(rev.Review, where, pco.key().id())
    fsz = 100  # 11/30/16 complaint that 50 makes "recent" tab feel lossy
    fmax = fsz
    if pct == "coop":
        fmax = 500
    jstr = ""
    js2 = ""
    membics = vq.fetch(fmax, read_policy=db.EVENTUAL_CONSISTENCY, deadline=60)
    idx = 0  # idx not initialized if enumerate punts due to no membics...
    for idx, membic in enumerate(membics):
        if idx < fsz:
            jstr = rev.append_review_jsoncsv(jstr, membic)
        else:
            js2 = rev.append_review_jsoncsv(js2, membic)
    jstr = append_top20_membics_to_jsoncsv(jstr, membics, pct, pco, 450 * 1024)
    if jstr:
        jstr = "," + jstr;
    if pct == "coop":
        pco.preb = "[" + moracct.obj2JSON(pco) + jstr + "]"
        pco.preb2 = "[" + js2 + "]"
        coop.update_coop_stats(pco, idx)
        # rebuild preb to include updated stats, maybe s1 off by one but ok.
        pco.preb = "[" + moracct.obj2JSON(pco) + jstr + "]"
        mctr.synchronized_db_write(pco)
    jstr = "[" + moracct.obj2JSON(pco) + jstr + "]"
    return jstr


def get_membics_json_for_profile(pct, pgid):
    key = pct + str(pgid)      # e.g. "pen1234" or "coop5678"
    jstr = memcache.get(key)   # grab the prebuilt JSON data
    if not jstr:
        jstr = rebuild_membics_block(pct, pgid) or ""
        if jstr:
            memcache.set(key, jstr)
        else:
            jstr = "[]"
    return jstr


def is_queue_calc_membic(membic):
    if membic["ctmid"] != "0":
        return False
    if membic["srcrev"][0] == "-":  # negative number
        return False
    return True


def get_queuing_vis_date(penid, mpd):  # maxPostsPerDay is 1 or 2
    membics = json.loads(get_membics_json_for_profile("pen", penid))
    if len(membics) > 0:
        membics = membics[1:]  # remove the pen or coop instance
    # logging.info("gqvd " + str(len(membics)) + " membics, mpd: " + str(mpd))
    # If they've created < mpd membics, then there isn't enough to calculate
    # a dispafter date.  But we also want to provide some slack for people
    # who are just getting started, so they can get some membics loaded up
    # onto a page.  They may dominate the main feed slightly at first, but
    # hopefully that will be a good introduction.  Working on the assumption
    # that their first posts will not also be posted through to a theme.  If
    # they are, then they should be familiar with the qeueing concept.
    if len(membics) < 5:
        return ""
    # membics were sorted by modified, need them ordered by creation time
    membics = sorted(membics, key=itemgetter('modhist'), reverse=True)
    # pull any future/theme membics not part of the queuing
    membics = [m for m in membics if is_queue_calc_membic(m)]
    if len(membics) < mpd:
        return ""
    pm = membics[mpd - 1]  # the first or second most recent membic
    # logging.info("Base membic date calcs is rev " + pm["_id"])
    bd = pm["modhist"].split(";")[0]  # base for calcs is creation date
    if "dispafter" in pm and pm["dispafter"] > bd:
        bd = pm["dispafter"]          # if base was queued, queue after that
    # logging.info("Base date is " + bd)
    bd = ISO2dt(bd)
    bd += datetime.timedelta(hours=24)
    return dt2ISO(bd)

