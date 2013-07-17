import webapp2
import datetime
from google.appengine.ext import db
import logging
from moracct import *
from pen import PenName, authorized
import json


class ReviewLink(db.Model):
    """ Links from a review to other pens. Kind of an interest graph. """
    revid = db.IntegerProperty(required=True)
    # CSV of some penIds that found this review helpful
    helpful = db.TextProperty()
    # CSV of some penIds that remembered this review
    remembered = db.TextProperty()
    # CSV of revId:penId pairs of corresponding reviews
    corresponding = db.TextProperty()

