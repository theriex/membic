from google.appengine.ext import db
from google.appengine.api import memcache
import logging
from cacheman import *
import moracct
from morutil import *
import rev
import json


class MembicFeed(db.Model):
    """ Transient precomputed query results to save time. """
    revtype = db.StringProperty(required=True)
    feedcsv = db.TextProperty()
    block0 = db.TextProperty()
    block1 = db.TextProperty()
    block2 = db.TextProperty()
    block3 = db.TextProperty()
    block4 = db.TextProperty()
    updated = db.StringProperty(indexed=False)
    rebuilt = db.StringProperty(indexed=False)


revblocksize = 200  # how many reviews to return. cacheable approx quantity
revpoolsize = 1000  # even multiple of blocksize. how many reviews to read
numblocks = revpoolsize / revblocksize


def feedcsventry(review):
    entry = str(review.key().id()) + ":" + str(review.penid) +\
        ":" + str(review.ctmid)
    return entry


def get_cached_feed_pool(revtype):
    blocks = [None for i in range(numblocks)]
    feedcsv = memcache.get(revtype)
    if feedcsv is not None:
        for i in range(numblocks):
            blocks[i] = memcache.get(revtype + "RevBlock" + str(i))
        if None not in blocks:
            return feedcsv, blocks
    return None, blocks


def write_cached_feed_pool(revtype, feedcsv, blocks):
    memcache.set(revtype, feedcsv)
    for i in range(numblocks):
        memcache.set(revtype + "RevBlock" + str(i), blocks[i])


def get_precomp_feed_pool(revtype):
    feedcsv = None
    blocks = [None for i in range(numblocks)]
    vq = VizQuery(MembicFeed, "WHERE revtype = :1", revtype)
    feeds = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
    if len(feeds) > 0 and feeds[0].feedcsv and feeds[0].block0:
        dtnow = datetime.datetime.utcnow()
        thresh = dt2ISO(dtnow - datetime.timedelta(days=5))
        if thresh > feeds[0].rebuilt:
            feedcsv = feeds[0].feedcsv
            blocks[0] = feeds[0].block0
            blocks[1] = feeds[0].block1
            blocks[2] = feeds[0].block2
            blocks[3] = feeds[0].block3
            blocks[4] = feeds[0].block4
    return feedcsv, blocks


def set_mfeed_data(mf, feedcsv, blocks):
    mf.feedcsv = feedcsv
    mf.block0 = blocks[0]
    mf.block1 = blocks[1]
    mf.block2 = blocks[2]
    mf.block3 = blocks[3]
    mf.block4 = blocks[4]


def get_mfeed_stats(mf):
    total = 0
    msg = "mfeed \"" + mf.revtype + "\""
    if mf.feedcsv:
        total += len(mf.feedcsv)
        msg += " feedcsv: " + str(len(mf.feedcsv)) + " (" +\
            str(mf.feedcsv.count(",") + 1) + " entries)"
    blocks = [mf.block0, mf.block1, mf.block2, mf.block3, mf.block4]
    for idx, block in enumerate(blocks):
        if block:
            total += len(block)
            msg += ", block" + str(idx) + ": " + str(len(block))
    msg += ", total: " + str(total)
    return msg


def write_precomp_feed_pool(revtype, feedcsv, blocks, rebuilt=False):
    mf = None
    vq = VizQuery(MembicFeed, "WHERE revtype = :1", revtype)
    feeds = vq.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline = 10)
    if len(feeds) > 0:
        mf = feeds[0]
    else:
        mf = MembicFeed(revtype=revtype)
    set_mfeed_data(mf, feedcsv, blocks)
    ts = nowISO()
    mf.updated = ts
    if rebuilt:
        mf.rebuilt = ts
    try:
        logging.info(get_mfeed_stats(mf))
        mf.put()
    except Exception as e:
        logging.warn("write_precomp_feed_pool clearing after error: " + str(e))
        set_mfeed_data(mf, None, [None for i in range(numblocks)])
        mf.put()
    mf = MembicFeed.get_by_id(mf.key().id())  #force db to read latest
            

def is_future_queued(membic):
    if membic.dispafter and membic.dispafter > nowISO():
        return True
    return False


def get_review_feed_pool(revtype):
    feedcsv, blocks = get_cached_feed_pool(revtype)
    if feedcsv:
        return feedcsv, blocks
    feedcsv, blocks = get_precomp_feed_pool(revtype)
    if feedcsv:
        return feedcsv, blocks
    logging.info("rebuilding feedcsv for " + revtype)
    cacheavail = 1040000  # db limit max 1,048,487 
    feedcsv = ""
    blocks = ["" for i in range(numblocks)]
    bidx = 0
    count = 0
    where = "WHERE ctmid = 0 AND mainfeed = 1"
    if revtype and revtype != "all":
        where += " AND revtype = '" + revtype + "'"
    where += " ORDER BY modhist DESC"
    vq = VizQuery(rev.Review, where)
    reviews = vq.fetch(revpoolsize, read_policy=db.EVENTUAL_CONSISTENCY, 
                       deadline=60)
    for review in reviews:
        if is_future_queued(review):
            continue  # not available for display yet
        entry = feedcsventry(review)
        if csv_contains(entry, feedcsv):
            continue  # already added, probably from earlier srcrev reference
        objson = moracct.obj2JSON(review)
        cacheavail -= len(entry) + len(objson)
        feedcsv = append_to_csv(entry, feedcsv)
        blocks[bidx] = append_to_csv(objson, blocks[bidx])
        count += 1
        if review.srcrev and review.srcrev > 0:  # ensure src included in block
            source = rev.Review.get_by_id(review.srcrev)
            if source:
                entry = feedcsventry(source)
                if not csv_contains(entry, feedcsv):
                    objson = moracct.obj2JSON(source)
                    feedcsv = append_to_csv(entry, feedcsv)
                    cacheavail -= len(entry) + len(objson)
                    blocks[bidx] = append_to_csv(objson, blocks[bidx])
                    count += 1
        if count >= revblocksize:
            bidx += 1
            count = 0
        if cacheavail <= 0:
            break
    for i in range(numblocks):
        blocks[i] = "[" + blocks[i] + "]"
    write_precomp_feed_pool(revtype, feedcsv, blocks, True)
    write_cached_feed_pool(revtype, feedcsv, blocks)
    return feedcsv, blocks


def sort_filter_feed(feedcsv, pnm, maxret=revblocksize):
    preferred = []
    normal = []
    background = []
    feedelems = csv_list(feedcsv)
    for elem in feedelems:
        ela = elem.split(":")
        if pnm:
            # skip any membics from blocked pens
            if csv_contains(ela[1], pnm.blocked):
                continue
            # preferred pen membic
            if csv_contains(ela[1], pnm.preferred):
                preferred.append(int(ela[0]))
            # followed theme membic
            elif csv_contains(ela[2], pnm.coops):
                preferred.append(int(ela[0]))
            # background pen membic
            elif csv_contains(ela[1], pnm.background):
                background.append(int(ela[0]))
            # membics from self shouldn't get buried below preferred
            elif str(ela[1]) == str(pnm.key().id()):
                if pnm.preferred:
                    preferred.append(int(ela[0]))
                else:
                    normal.append(int(ela[0]))
            # default
            else:
                normal.append(int(ela[0]))
        else:
            preferred.append(int(ela[0]))
        if len(preferred) >= maxret:
            break
    feedids = preferred[:maxret] + normal[:maxret] + background[:maxret]
    feedids = feedids[:maxret]
    return feedids


def resolve_ids_to_json(feedids, blocks):
    jstr = ""
    for block in blocks:
        # moracct.debuginfo("resolve_ids_to_json block: " + block)
        objs = json.loads(block)
        for obj in objs:
            # moracct.debuginfo("resolve_ids_to_json id: " + obj["_id"])
            # moracct.debuginfo("feedids: " + str(feedids))
            if int(obj["_id"]) in feedids:
                jstr = append_to_csv(json.dumps(obj), jstr)
    return "[" + jstr + "]"


# Return the feedcsv and asociated JSON data blocks from cache.  If
# the cache is partial, clean up and return None, None
def get_feed_cache_elements(ckey):
    feedcsv, blocks = get_cached_feed_pool(ckey)
    if not feedcsv:
        feedcsv, blocks = get_precomp_feed_pool(ckey)
        if feedcsv:
            write_cached_feed_pool(ckey, feedcsv, blocks)
    return feedcsv, blocks
        

def replace_instance_in_json(review, jtxt, remove):
    objs = json.loads(jtxt)
    rt = ""
    for obj in objs:
        idstr = str(review.key().id())
        if obj["_id"] == idstr:
            if not remove:
                moracct.debuginfo("Replaced json for _id " + idstr)
                rt = append_to_csv(moracct.obj2JSON(review), rt)
            else:
                moracct.debuginfo("Removed json for _id " + idstr)
        else:
            rt = append_to_csv(json.dumps(obj), rt)
    return "[" + rt + "]"


def prepend_instance_to_json(review, jtxt):
    # not safe to use prepend_to_csv due to upperbound limit
    jtxt = jtxt or ""
    if jtxt:
        if len(jtxt) > 2:
            jtxt = jtxt[1:-1]  # strip array brackets
        else:
            jtxt = ""
    if jtxt:
        jtxt = "," + jtxt
    jtxt = moracct.obj2JSON(review) + jtxt
    return "[" + jtxt + "]"


# update the cache or ensure it is nuked for rebuild.
def update_feed_cache(ckey, review, addifnew=False):
    moracct.debuginfo("update_feed_cache for " + ckey)
    feedcsv, blocks = get_feed_cache_elements(ckey)
    # moracct.debuginfo("feedcsv: " + str(feedcsv))
    if feedcsv is None:
        moracct.debuginfo("no cache data. rebuild later if needed")
        return  # cache cleared, rebuild later as needed
    entry = feedcsventry(review)
    if csv_contains(entry, feedcsv):
        moracct.debuginfo("updating existing cache entry")
        for i in range(numblocks):  # walk all in case dupe included
            blocks[i] = replace_instance_in_json(review, blocks[i], 
                                                 review.mainfeed <= 0)
    elif review.mainfeed > 0 and addifnew and not is_future_queued(review):
        moracct.debuginfo("prepending new cache entry")
        feedcsv = prepend_to_csv(entry, feedcsv)
        # prepend to first block.  Not worth rebalancing all the blocks.
        blocks[0] = prepend_instance_to_json(review, blocks[0])
    write_precomp_feed_pool(ckey, feedcsv, blocks)
    write_cached_feed_pool(ckey, feedcsv, blocks)


def update_feed_caches(review, addifnew=False):
    update_feed_cache("all", review, addifnew)        # main feed
    update_feed_cache(review.revtype, review, addifnew)  # filtered main feed


def nuke_review_feed_pool(revtype):
    write_precomp_feed_pool(revtype, None, [None, None, None, None, None])
    memcache.delete(revtype)
    for i in range(numblocks):
        memcache.delete(revtype + "RevBlock" + str(i))


def nuke_cached_recent_review_feeds():
    nuke_review_feed_pool("all")
    for rt in rev.known_rev_types:
        nuke_review_feed_pool(rt)

