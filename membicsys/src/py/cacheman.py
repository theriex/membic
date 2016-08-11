from google.appengine.api import memcache
from google.appengine.ext import db
import pickle
import logging
from morutil import *


# Notes on caching:

# A changed instance may still show up in cached searches, in the
# cached order, even if the instance no longer matches the WHERE
# condition of the search.  There is no automatic reset because
# cached_put is not aware of QueryCache instances and therefore cannot
# invalidate them.

# Because of database query latency, the client already sanity checks
# its own cache to fill out anything recent that doesn't show up in
# the search results.  That provides some flexibility for longer
# search caching times, but things still need to look ok with a hard
# reload.  The solution is for time sensitive server endpoints to
# provide for optionally resetting the QueryCache.  Alternatively the
# client can simply change the WHERE clause to trigger creation of a
# new query, leaving the old one to be garbage collected.  It's better
# to have long cache times (like an hour) and hard resets as needed.


# Write the given instance to the db, then memcache it.  Objects are
# cache keyed using classname + id (e.g. Review234568912345963002) 
def cached_put(instance):
    instance.put()
    key = instance.key().kind() + str(instance.key().id())
    memcache.set(key, pickle.dumps(instance))

# If the given instance is not already cached, then cache it, but do
# not overwrite an existing cache entry.  Useful when you want to
# verify an instance is cached, but you might have an older copy.
def cache_verify(instance):
    key = instance.key().kind() + str(instance.key().id())
    entry = memcache.get(key)
    if not entry:
        memcache.set(key, pickle.dumps(instance))
    return entry or instance


# Read the given instance from memcache if available, otherwise fetch
# it from the database
def cached_get(idval, dbclass):
    key = dbclass.kind() + str(idval)
    instance = memcache.get(key)
    if instance:
        # logging.info("cached_get " + key + " retrieved from cache")
        instance = pickle.loads(instance)
        return instance
    # logging.info("cached_get pulling " + key + " from db...")
    instance = dbclass.get_by_id(intz(idval))
    if instance:
        # logging.info("cached_get cached " + key)
        memcache.set(key, pickle.dumps(instance))
    return instance


# Null out the cache reference for this ID, and remove it from the db.
def cached_delete(idval, dbclass):
    key = dbclass.kind() + str(idval)
    instance = memcache.get(key)
    if instance:
        memcache.set(key, "")
    instance = dbclass.get_by_id(intz(idval))
    if instance:
        instance.delete()
    

# return the value of the given field regardless of whether inst is a
# cached dict representation or an instance of db.Model.
def attracc(inst, field, defaultval):
    if isinstance(inst, dict):
        return inst[field]
    if isinstance(inst, db.Model):
        return getattr(inst, field)
    return defaultval


# set the value of the given field regardless of whether inst is a
# cached dict representation or an instance of db.Model.
def attrset(inst, field, val):
    if isinstance(inst, dict):
        inst[field] = val
    elif isinstance(inst, db.Model):
        setattr(inst, field, val)


def visible_get_instance(dbclass, idval):
    logging.info("DBVG " + str(dbclass) + " " + str(idval))
    return dbclass.get_by_id(int(idval))


class VizQuery(object):
    dboc = None
    where = ""
    wags = None
    gql = None
    def __init__(self, dboc, where, *args):
        self.dboc = dboc
        self.where = where
        self.wags = args
        self.gql = dboc.gql(where, *args)
    def __str__(self):
        return str(self.dboc) + " " + self.where + " " + str(self.wags)
    def cursor(self):
        return self.gql.cursor()
    def with_cursor(self, **kwargs):
        return self.gql.with_cursor(**kwargs)
    def run(self, **kwargs):
        logging.info("DBVQR " + str(self) + " " + str(kwargs))
        return self.gql.run(**kwargs)
    def fetch(self, *args, **kwargs):
        logging.info("DBVQF " + str(self) + " " + str(args) + " " + str(kwargs))
        return self.gql.fetch(*args, **kwargs)


class QueryCache(object):
    def __init__(self):
        self.idvals = []
        self.started = ""
        self.cursor = ""


class QueryResult(object):
    def __init__(self):
        self.objects = []
        self.cursor = ""
        self.qcstart = ""


# Search the cache, falling back to the database as needed.
#   ckey: a string unique to the search to be cached
#   query: gql query object for WHERE clause
#   cursor: "cache" + offset, or db access value (value is opaque to caller)
#   fetchmax: Any chunk value, value may not vary for any given WHERE
#   dbclass: The db.Model whose instances are being searched (e.g. Review)
def cached_query(ckey, query, cursor, fetchmax, dbclass, logit):
    if logit:
        logging.info("cached_query ckey: " + ckey)
    # get the QueryCache we are working with
    qc = memcache.get(ckey)
    if qc:
        qc = pickle.loads(qc)
    else:
        qc = QueryCache()
    qres = QueryResult()
    qres.qcstart = qc.started
    # Have previous QueryCache, return from cache if adequate.  Cached
    # results may be empty, it is the responsibility of the caller to
    # bust the cache after adding a new instance.
    if qc.started:
        offset = 0
        if cursor and cursor.startswith("cache"):
            offset = int(cursor[len("cache"):])
        endidx = offset + fetchmax
        if endidx <= len(qc.idvals) or not qc.cursor:
            if logit:
                logging.info("Query results retrieved from cache")
            idvals = qc.idvals[offset:endidx]
            for idval in idvals:
                qres.objects.append(cached_get(idval, dbclass))
            if qc.cursor:
                qres.cursor = "cache" + str(endidx)
            return qres;
    # No previous QueryCache, or need more values from the db
    if not qc.started:
        if logit:
            logging.info("Creating new query cache")
        qc.started = nowISO()
    else:
        if logit:
            logging.info("Fetching and caching more db values")
        assert qc.cursor
        query.with_cursor(start_cursor = qc.cursor)
    qres.objects = query.fetch(fetchmax, 
                               read_policy=db.EVENTUAL_CONSISTENCY,
                               deadline=10)
    if logit:
        logging.info("cached_query found " + str(len(qres.objects)))
    for obj in qres.objects:
        cached_put(obj)
        qc.idvals.append(obj.key().id())
    if len(qres.objects) >= fetchmax:
        qc.cursor = query.cursor()
        qres.cursor = "cache" + str(len(qc.idvals))
    memcache.set(ckey, pickle.dumps(qc))
    return qres


def reset_cached_query(ckey):
    logging.info("reset_cached_query " + ckey)
    qc = memcache.get(ckey)
    if qc:
        qc = pickle.loads(qc)
        qc.started = False
        qc.idvals = []
        qc.cursor = ""
        memcache.set(ckey, pickle.dumps(qc))


def bust_cache_key(ckey):
    logging.info("bust_cache_key " + ckey)
    memcache.set(ckey, "")


