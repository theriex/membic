myopenreviews
=============

This is all source for the site running at http://MyOpenReviews.com
The client is written in JavaScript, the server is written in Python.

Conceptually this is an easy but deep review site with a follower
social model built over an open data platform supporting a community
of connection services.  Things are still pretty formative right now.
Questions and suggestions are welcome.

If you want to build and run locally you will need the Google App
Engine SDK.  To look through the code from the client side, start from
the call to mor.init in docroot/index.html, then from there to
js/mor.js which is organized into (hopefully intuitive) closures for
major functionality.  To look through things from the server side,
start with app.yaml in the top level directory, then from there to the
associated src/py module.

You may notice points in the code marked with "ATTENTION" comments
that show areas in need of help.  It is not necessary to write code to
get involved.  Discussions are welcome.


Uploading and downloading reviews:
---------------------------------

To upload a review, just POST to the /newrev endpoint with the review
fields and authorization parameters.  Something like this:

    params = urllib.urlencode({'am': 'mid',
                               'at': token,
                               'an': username,
                               'penid': penid,
                               'revtype': revtype,
                               'rating': rating,
                               'keywords': keywords,
                               'text': text,
                               'name': name,
                               'title': title,
                               'url': url,
                               'artist': artist,
                               'author': author,
                               'album': album,
                               'year': year})
    data = call_server("/newrev", 'POST', params)

PLEASE do not batch upload!  This is a fledgling site and after
writing about a 1000 reviews the whole site will run out of resources
for the day.  The idea is to upload reviews as things are experienced,
since the social aspects work better that way.

To download reviews, it's probably easiest to use the /srchrevs
endpoint, see app.yaml for details.  Again, please help conserve
resources by pulling only what you need and saving locally whenever
possible.


Connection services:
-------------------

A connection service is essentially a URL where MyOpenReviews POSTs
data when a review is saved.  If you are interested in utilizing this
functionality please get in touch.

