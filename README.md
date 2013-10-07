myopenreviews
=============

MyOpenReviews is a platform for social review sharing.  Easily create
a nice review and post it through to your social networks, while
keeping all your reviews organized and following reviews from others
whose tastes you trust.  Privacy is respected through use of pen names.

The source and API is provided so you can see how things work, and
help improve it.

The main web app is http://www.wdydfun.com (what did you do fun).  It
consists of a javascript web application communicating with a Python Google App
Engine server.


Getting involved:
----------------

All comments, questions, suggestions, requests are welcome.  This is a
community site that wants your input, whether you are coming from a
technical background or not.

Currently the best way to get involved is to contact theriex over at gmail.


Code organization:
-----------------

For the javascript web app, you can trace the flow from `index.html`
into `app.js` and/or search the codebase for points of interest.  The
app is written in pure javascript following the functional javascript
architecture: http://sandservices.com/docs/funcjsarch.html

For the server side REST API, start from `app.yaml` and then reference the
corresponding `.py` file in `src/py`. 

For local development, you will need to install the Google App Engine SDK.

`docroot`

  `css`: site.css

  `docs`: supporting static HTML for the site

  `downloads`: other standalone apps and add-ons

  `js`: top level javascript files

    `amd`: app javascript modules

      `ext`: javascript modules for app extensions (third party integration)

  `img`: supporting graphics

`src`

  `build`: deployment minification, not required for local development

  `imgsrc`: GIMP workfiles for site graphics

  `py`: server processing modules
  

Using the API:
-------------

Feel free to call the REST API directly, but PLEASE DO NOT BATCH
REQUESTS!  This is a fledgling site and after writing about a 1000
reviews the whole thing will run out of resources for the day.  Once
normal interactive site use starts approaching half the current limit,
the pipes will be opened up.  In the meantime please help to conserve
resources by pulling only what you need, and caching locally whenever
possible.

The REST API endpoints are defined and documented in `app.yaml`.


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

It would be great to hear about anything you are working on.  Ideas
are welcome also, feel free to post those on the issues board.


