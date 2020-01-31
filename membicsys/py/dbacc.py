# For maximum storage flexibility, including possible deployment on standard
# App Engine, queries are limited to no joins and only one inequality
# operation.  All needed joins are precomputed for fast retrieval.

# Base class for all entity objects.  Max 1mb per entity.
class AppEntity(object):

# priv[ate]: authorized access only.  Typically owner personal info.
# req[uired]: Null or empty value disallowed.
# uniq[ue]: No other instances exist with this value
# ind[ex]: Indexed field, used for matching or odering in a query
# str[ing]: ~128char text, truncation ok.  Aliases:
#   email: email address format
#   isod[ate]: ISO date format
#   isomod: ISO date followed by semi followed by int count
# text: long unindexed string (max 1mb), truncation not ok.  Aliases:
#   json: JSON encoded data
#   idcsv: comma separated unique integer ids
#   isodcsv: comma separated ISO date values
#   gencsv: general comma separated values
#   url: a URL
# image: opaque binary image data (max 1mb)
# dbid: an integer database id translated to string for JavaScript access
# int: an actual integer value that JavaScript can handle
class AEFld(object):

class MUser(Entity):
    """ Membic User account. """
    # private auth and setup, see safe_json
    email = AEFld("priv req index email")
    phash = AEFld("priv req string")
    status = AEFld("priv index string")   # Pending|Active|Inactive|Unreachable
    mailbounce = AEFld("priv isodcsv")    # latest bounce first
    actsends = AEFld("priv gencsv")       # latest first, isodate;emaddr vals
    actcode = AEFld("priv string")        # account activation code
    altinmail = AEFld("priv index email") # alt mail-in address
    # public app data
    name = AEFld("string")           # optional but recommended public name
    aboutme = AEFld("text")          # optional description, website link etc.
    hashtag = AEFld("index string")  # personal theme direct access
    profpic = AEFld("image")         # used for theme, and coop posts
    cliset = AEFld("json")           # dict of client settings, see note
    coops = AEFld("json")            # coopid map, see note
    created = AEFld("isodate")       # when the account was first created
    modified = AEFld("isod index")   # when the account was last modified
    lastwrite = AEFld("isod index")  # latest membic/preb rebuild
    preb = AEFld("json")             # membics for display w/opt overflow link
# cliset: {flags:{archived:ISO},
#          embcolors:{link:"#84521a", hover:"#a05705"},
#          maxPostsPerDay:1,
#          ctkeys:{book:"keyword1, keyword2...",
#                  movie:"keyword4, keyword2...",
#                  ...} }
#
# coops: {"coopid":info, "coopid2":info2, ...}
#  info: {lev:N, obtype:str, name:str, hashtag:str, description:str, 
#         picture:idstr, keywords:CSV, inactive:str, 
#         notices:[notice1, notice2..]}
#    lev: -1 (following), 1 (member), 2 (moderator), 3 (founder).
#         Any falsy value for lev means no association.
#    obtype: "MUser" or "Coop"
#    inactive: only included if the Coop is archived
#    notice: {type:"application", lev:int, uid, uname, created:ISO,
#             status:"pending"|"rejected", reason}
# The coops data is cached supplemental data, not authoritative.
# See coop.py process_membership, profile.js verifyMembership


class Theme(Entity):
    """ A cooperative theme. """
    name = AEFld("req string")
    name_c = AEFld("req index unique string")  # canonical name
    modhist = AEFld("isomod index")            # creation date and mod count
    modified = AEFld("isod index")             # when last updated
    lastwrite = AEFld("isod index")            # latest membic/preb rebuild
    hashtag = AEFld("index unique string")     # optional one word name
    description = AEFld("text")  # optional description, site link etc.
    picture = AEFld("image")     # used for theme display
    founders = AEFld("idcsv")    # founding members
    moderators = AEFld("idcsv")  # moderator members
    members = AEFld("idcsv")     # standard members
    seeking = AEFld("idcsv")     # member applications (member ids)
    rejects = AEFld("idcsv")     # rejected applications (member ids)
    adminlog = AEFld("json")     # array of theme admin actions, latest first
    people = AEFld("json")       # map of ids to user names for fast display
    cliset = AEFld("json")       # client settings (like MUser)
    keywords = AEFld("gencsv")   # custom theme keywords
    preb = AEFld("json")         # membics for display w/opt overflow link


class Membic(Entity):
    """ A URL with a reason why it's memorable. """
    revtype = AEFld("req index string")   # book, movie, music...
    penid = AEFld("req index dbid")       # who wrote this membic
    ctmid = AEFld("req index dbid")       # Theme id, or 0 if source membic
    rating = AEFld("req index int")       # 0-100
    srcrev = AEFld("req index dbid")      # source membic, see note
    cankey = AEFld("req index string")    # alt key, see note
    modified = AEFld("isod index")        # ISO date
    modhist = AEFld("isomod index")       # creation date and mod count
    # non-indexed fields:
    text = AEFld("text")                  # why this link is memorable
    keywords = AEFld("gencsv")            # keywords for this membic
    svcdata = AEFld("json")               # pic src, other info, see note
    revpic = AEFld("image")               # pic, if uploaded
    imguri = AEFld("url")                 # external pic for membic
    icdata = AEFld("image")               # secure relay ext pic cache data
    icwhen = AEFld("isodate")             # when icdata last pulled
    dispafter = AEFld("isodate")          # visibility queued until
    penname = AEFld("string")             # author name for easy UI ref
    reacdat = AEFld("json")               # reaction data, see note
    # type-specific non-indexed fields
    name = AEFld("string")                # yum, activity, other
    title = AEFld("string")               # book, movie, video, music
    url = AEFld("url")                    # canonical URL for item
    rurl = AEFld("url")                   # original read URL
    artist = AEFld("string")              # video, music
    author = AEFld("string")              # book
    publisher = AEFld("string")           # book
    album = AEFld("string")               # music
    starring = AEFld("string")            # movie
    address = AEFld("string")             # yum, activity
    year = AEFld("string")                # values like "80's" are ok
# srcrev is heavily utilized in different contexts:
#   - if this membic is a Theme post (ctmid is filled in), srcrev holds the
#     id of the original membic.
#   - if this membic was created directly from another membic, srcrev holds
#     the id of the membic this was created from.
#   - negative srcrev values indicate special handling:
#       -101: Future review (placeholder for later writeup)
#       -202: Batch update (no longer supported, originally for music import)
#       -604: Marked as deleted
# cankey (canonical key): 
#   alternate index based on collapsed review field info.  Can be used to
#   group multiple membics for the same thing within a theme, or for search.
#   The value is maintained server-side for consistency.  Multiple membics
#   with the same cankey/penid/ctmid are allowed but discouraged.
# svcdata:
#   Client setting of picdisp:sitepic|upldpic|nopic. On update, the server
#   writes a postctms dictionary field with info on the themes the membic
#   was posted through to.
# reacdat:
#   Server maintained reaction data from other users.  For example a user
#   might mark the membic as helpful or remembered.  Or they might select
#   from a scalar view of emoticons to rate it.  Or flag as inappropriate.


class Overflow(Entity):
    """ MUser/Theme.preb overflow container. """
    dbkind = AEFld("req index string")
    dbkeyid = AEFld("req index dbid")
    overcount = AEFld("req int")
    preb = AEFld("json")         # membics for display w/opt overflow link


class MailNotice(db.Model):
    """ Broadcast email notice tracking to avoid duplicate sends. """
    name = AEFld("req index string")  # query access identifier
    subject = AEFld("string")         # the email subject for ease of reference
    uidcsv = AEFld("idcsv")           # MUser ids that were sent to
    lastupd = AEFld("isodate")        # last recorded send


# Updated by cron job once per day.  Used for general reporting/history.
class ActivitySummary
    """ Daily summary activity information by profile/theme. """
    refp = AEFld("req index string")  # e.g. MUSer1234 or Theme4567
    tstart = AEFld("req index isod")  # daily summary start time
    tuntil = AEFld("req index isod")  # daily summary end time
    reqbyid = AEFld("req int")        # count of external requests via id
    reqbyht = AEFld("req int")        # count of external requests via hashtag
    reqbypm = AEFld("req int")        # count of external requests via params
    reqbyrs = AEFld("req int")        # count of requests via RSS
    reqdets = AEFld("json")           # dict of supplemental info, see note
    created = AEFld("req int")        # how many new membics were created
    edited = AEFld("req int")         # how many existing membics were edited
    removed = AEFld("req int")        # deleted if MUser, removed if Theme
# reqdets (request details dictionary):
#   - How many of the requests were from known crawler programs
#   - Map of known (signed in via cookie) users, each with counts and names.
#   - Map of referering urls with counts for each
#   - Map of user agent strings with counts for each


class ConnectionService(Entity):
    """ Connection tokens and info for supporting services. """
    name = AEFld("req unique index string")   # service name
    ckey = AEFld("string")                    # key e.g. oauth1 consumer key
    secret = AEFld("string")                  # e.g. oauth1 consumer secret
    data = AEFld("text")                      # service-specific data

