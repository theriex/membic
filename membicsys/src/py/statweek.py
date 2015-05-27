import webapp2
import datetime
from google.appengine.ext import db
import logging
import json
from rev import Review, batch_flag_attrval
from morutil import *
from group import Group


class Week(db.Model):
    """ An overview of reviews for the week """
    # e.g. start: 2013-02-04.  Stats run from Monday through Sunday so
    # weekend days are contiguous.  Same as python weekday 0-6.
    start = db.StringProperty(required=True)
    # each day is a JSON object with a total and time periods of
    # "00to04", "04to08", "08to12", "12to16", "16to20", "20to00".
    # Each time period has an array of review Ids that were modified
    # during that time.  Time periods are written to the db when
    # fetched, future time periods are undefined.
    monday = db.TextProperty()
    tuesday = db.TextProperty()
    wednesday = db.TextProperty()
    thursday = db.TextProperty()
    friday = db.TextProperty()
    saturday = db.TextProperty()
    sunday = db.TextProperty()
    modified = db.StringProperty()  # iso date


days = [ "monday", "tuesday", "wednesday", "thursday", "friday",
         "saturday", "sunday" ]

blocks = [ "00to04", "04to08", "08to12", "12to16", "16to20", "20to00" ]


def fetch_reviews(start, end):
    result = []
    revquery = Review.gql("WHERE modified >= :1 AND modified < :2", 
                          dt2ISO(start), dt2ISO(end))
    #if this max is exceeded, subdivide blocks, and/or filter types, and/or...
    reviews = revquery.fetch(1000, read_policy=db.EVENTUAL_CONSISTENCY, 
                             deadline = 10)
    for review in reviews:
        if (not (review.svcdata and 
                 batch_flag_attrval(review) in review.svcdata)):
            result.append(str(review.key().id()))
    return result


def verify_hour_blocks(now, daystart, jsonval):
    day = {}
    if jsonval:
        day = json.loads(jsonval)
    day["total"] = 0  #add it up again
    # logging.info("verify_hour_blocks " + str(day))
    for index, blockstr in enumerate(blocks):
        start = daystart + datetime.timedelta(0, index * 4 * 60 * 60)
        end = start + datetime.timedelta(0, 4 * 60 * 60)
        # logging.info(" vhb" + str(index) + " " + blockstr)
        if start < now:  #not a future time block
            revids = getattr(day, blockstr, None)
            # logging.info("    day " + str(daystart) + ": " + str(revids));
            if revids is None or end > now:
                revids = fetch_reviews(start, end)
                day.update({ blockstr: revids })
            day["total"] += len(revids)
    return json.dumps(day, True)


def have_hour_blocks(dayjson):
    for blockstr in blocks:
        if not blockstr in dayjson:
            return False
    return True


def verify_day_fields(week):
    updated = False
    now = datetime.datetime.utcnow()
    ws = datetime.datetime.strptime(week.start, "%Y-%m-%d")
    for index, daystr in enumerate(days):
        dstart = ws + datetime.timedelta(index)
        dend = ws + datetime.timedelta(index + 1)
        if dstart < now:  #not a future day...
            dayval = getattr(week, daystr, None)
            # logging.info("verify_day_fields dayval: " + str(dayval))
            if not dayval or not have_hour_blocks(dayval) or dend > now:  
                # rebuld the the dayval and hour blocks
                updated = True
                summary = verify_hour_blocks(now, dstart, dayval)
                setattr(week, daystr, summary)
    if updated:
        week.modified = nowISO()
        week.put()  #nocache
    return week


def get_stats_for_week(start):
    startstr = str(start.year) + "-" + str(start.month).rjust(2, '0') +\
        "-" + str(start.day).rjust(2, '0')
    # logging.info("startstr: " + startstr)
    query = Week.gql("WHERE start = :1", startstr)
    weeks = query.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY,
                        deadline=10)
    week = None
    if len(weeks) > 0:
        week = weeks[0]
    else:
        week = Week(start=startstr)
    return verify_day_fields(week)


def get_stats():
    result = []
    start = datetime.datetime.utcnow()
    # adjust start to nearest previous Monday
    start = start - datetime.timedelta(start.weekday())
    result.append(get_stats_for_week(start))
    for i in range(4):
        start = start + datetime.timedelta(-7)
        result.append(get_stats_for_week(start))
    return result


def list_groups():
    result = ""
    groups = Group.all()
    groups.order('-modified')
    checked = 0
    for group in groups:
        checked += 1
        if checked > 100:
            break
        result += "<li><a href=\"groups/" + group.name_c + "\">" +\
            group.name + "</a>\n"
    if result:
        result = "\n<div class=\"statsecdiv\">Groups:</div>" +\
            "<ul class=\"statseclist\">\n" + result + "</ul>\n"
    return result


htmlheader = """
<!doctype html>
<html itemscope="itemscope" itemtype="https://schema.org/WebPage"
      xmlns="https://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="robots" content="noodp" />
  <meta name="description" content="Membic groups and weekly activity" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Membic Groups and Weekly Review Activity</title>
  <link href="css/site.css" rel="stylesheet" type="text/css" />
</head>
<body id="bodyid">
"""


def get_stats_html(result):
    html = htmlheader
    html += "<div id=\"appspacediv\">"
    html += "<div id=\"contentdiv\">"
    html += list_groups()
    html += "\n<div class=\"statsecdiv\">Weekly stats:</div>\n" +\
        "<ul class=\"statseclist\">\n"
    for week in result:
        html += "<li>" + week.start + " (modified " + week.modified + ")"
        html += "<table border=\"1\"><tr>"
        for daystr in days:
            dayobj = {}
            dayval = getattr(week, daystr, None)
            if dayval:
                dayobj = json.loads(dayval)
            html += "\n  <td valign=\"top\"><em>" + daystr + "</em>"
            if "total" in dayobj:
                html += "&nbsp;(" + str(dayobj["total"]) + "&nbsp;reviews)"
            html += "<ul class=\"statblockul\">"
            for blockstr in blocks:
                if blockstr in dayobj:
                    html += "\n    <li>" + blockstr + "<ul class=\"statidul\">"
                    for revid in dayobj[blockstr]:
                        html += "\n      <li><a href=\"revdisp/" + revid + "\">"
                        html += revid + "</a></li>"
                    html += "</ul></li>"
            html += "</ul></td>"
        html += "</tr></table></li>"
    html += "\n</ul>"
    html += "\n</div>"
    html += "\n</div>"
    html += "\n</body>"
    html += "\n</html>\n"
    return html


class GetStats(webapp2.RequestHandler):
    def get(self):
        result = get_stats()
        html = get_stats_html(result)
        self.response.headers['Content-Type'] = "text/html; charset=UTF-8"
        self.response.out.write(html);


class DisplayReview(webapp2.RequestHandler):
    def get(self, revid):
        review = cached_get(intz(revid), Review)
        if not review:
            self.error(404)
            self.response.out.write("Review " + revid + " not found")
            return
        url = "?view=pen&penid=" + str(review.penid) +\
            "&tab=recent&expid=" + str(revid)
        self.redirect(url)


app = webapp2.WSGIApplication([('/stats', GetStats),
                               ('/revdisp/(\d+)', DisplayReview)], debug=True)

