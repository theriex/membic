import webapp2
import datetime
from google.appengine.ext import db
import logging
import json
from rev import Review
from moracct import nowISO, dt2ISO

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
        result.append(str(review.key().id()))
    return result


def verify_hour_blocks(now, daystart, jsonval):
    day = {}
    if jsonval:
        day = json.loads(jsonval)
    day["total"] = 0  #add it up again
    for index, blockstr in enumerate(blocks):
        start = daystart + datetime.timedelta(0, index * 4 * 60 * 60)
        end = start + datetime.timedelta(0, 4 * 60 * 60)
        if start < now:  #not a future time block
            revids = getattr(day, blockstr, None)
            if revids is None or end > now:
                revids = fetch_reviews(start, end)
                day.update({ blockstr: revids })
            day["total"] += len(revids)
    return json.dumps(day, True)


def verify_day_fields(week):
    updated = False
    now = datetime.datetime.utcnow()
    ws = datetime.datetime.strptime(week.start, "%Y-%m-%d")
    for index, daystr in enumerate(days):
        dstart = ws + datetime.timedelta(index)
        dend = ws + datetime.timedelta(index + 1)
        if dstart < now:  #not a future day...
            dayval = getattr(week, daystr, None)
            if not dayval or dend > now:  #no value or not ended yet
                updated = True
                summary = verify_hour_blocks(now, dstart, dayval)
                setattr(week, daystr, summary)
    if updated:
        week.modified = nowISO()
        week.put()
    return week


def get_stats_for_week(start):
    startstr = str(start.year) + "-" + str(start.month).rjust(2, '0') +\
        "-" + str(start.day).rjust(2, '0')
    logging.info("startstr: " + startstr)
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
    # add stats for previous weeks
    for i in range(4):
        start = start + datetime.timedelta(-7 * (i + 1))
        result.append(get_stats_for_week(start))
    return result


def get_stats_html(result):
    html = "<!doctype html>"
    html += "<html itemscope=\"itemscope\""
    html +=      " itemtype=\"http://schema.org/WebPage\""
    html +=      " xmlns=\"http://www.w3.org/1999/xhtml\">"
    html += "<head>"
    html +=   "<meta http-equiv=\"Content-Type\""
    html +=        " content=\"text/html; charset=UTF-8\" />"
    html +=   "<meta name=\"description\" content=\"Review activity\" />"
    html +=   "<title>My Open Reviews Review Activity</title>"
    html += "</head>"
    html += "<body>"
    html += "stats: <ul>"
    for week in result:
        html += "<li>" + week.start + " (modified " + week.modified + ")<ul>"
        for daystr in days:
            dayobj = {}
            dayval = getattr(week, daystr, None)
            if dayval:
                dayobj = json.loads(dayval)
            html += "<li>" + daystr
            if "total" in dayobj:
                html += " " + str(dayobj["total"])
            html += "<ul>"
            for blockstr in blocks:
                if blockstr in dayobj:
                    html += "<li>" + blockstr + "<ul>"
                    for revid in dayobj[blockstr]:
                        html += "<li><a href=\"statrev/" + revid + "\">"
                        html += "Review " + revid + "</a></li>"
                    html += "</ul></li>"
            html += "</ul></li>"
        html += "</ul></li>"
    html += "</ul>"
    html += "</body>"
    html += "</html>"
    return html


class GetStats(webapp2.RequestHandler):
    def get(self):
        result = get_stats()
        html = get_stats_html(result)
        self.response.headers['Content-Type'] = "text/html; charset=UTF-8";
        self.response.out.write(html);


app = webapp2.WSGIApplication([('/stats', GetStats)], debug=True)

