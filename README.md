myopenreviews
=============

MyOpenReviews is a platform for social review sharing.  The goal is to
enable sharing of detailed impressions withough requiring a dossier of
personal details.  The source is provided so you can see how things
work, help make things work better, and see how to use the API to
build applications.

The main web app is http://www.wdydfun.com (what did you do fun) which
is a single page javascript application.  There is also some separate
applescript for interfacing directly with iTunes.  The REST API is
implemented in Python and hosted on Google App Engine.


Getting involved:
----------------

All comments, questions, suggestions, requests are welcome.  The goal
is to make this a community site that wants your input, whether you
are coming from a technical background or not.

Currently the best way to get involved is to contact theriex over at gmail.


Code organization:
-----------------

For the REST API, start from `app.yaml` and then reference the
corresponding `.py` file in `src/py`.  The js flow starts from
`index.html` and the core supporting modules are in `docroot/js/amd`.

GIMP workfiles for images are in `src/imgsrc`, `docroot/docs` is for
supporting static HTML for the site. 

For local development, download the Google App Engine SDK.


Using the API:
-------------

Feel free to call the REST API directly, but PLEASE DO NOT BATCH
REQUESTS!  This is a fledgling site and after writing about a 1000
reviews the whole site will run out of resources for the day.  Once
normal interactive site use starts approaching half the current limit,
that's the time to open the pipes.  In the meantime please help to
conserve resources by pulling only what you need, and caching locally
whenever possible.

The API consists of HTTP GET/POST calls that generally return JSON.
Available endpoints are defined and documented in `app.yaml`.


Connectors:
----------

MyOpenReviews exists as a supplemental interface between
content sites and social sites.  To work smoothly, it makes
use of APIs for *inbound* and *outbound* connectors.  The connectors
are organized by API provider in `docroot/js/amd/ext`.  New and
improved connectors are always welcome.  This project can never be too
connected or too smooth.  To build a new connector, it's easiest to
model an existing one.

Note that MyOpenReviews adheres to all terms of use for all APIs, and
respects API providers.  When you are working with an API please

1. Make sure all use is allowed by the API provider

2. Provide attribution when appropriate and respect marks

3. Generally try and give back.  For an inbound connection, link back
to where the content can be found, and post back review information if
that's reasonable.  For an outbound connection, send only compatible,
desirable, and expected content.

Respect users and make their lives better.

MyOpenReviews does not provide media for review, nor does it support
general social conversation, so it can't integrate with external APIs
expecting those kinds of interactions.


Applications:
------------

The MyOpenReviews REST API is available for use by applications as
described above.  Please identify your app in the HTTP headers when
calling the API.  

Get in touch if you want MyOpenReviews to have a link to your app or
have other integration ideas.


