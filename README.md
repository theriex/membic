myopenreviews
=============

Welcome to the sourcebase for http://www.myopenreviews.com.  The site
is written in JavaScript, and the REST API is implemented in Python.
The site is hosted on Google App Engine.


Getting involved:
----------------

All comments, questions, suggestions, requests are welcome.  This is a
community site that wants your input, whether you have any technical
experience or not.

* If you have testing, graphics, UX, legal, marketing or other skills,
feel free to get involved however you think is best.  Get in touch if
you have any questions.

* If you have programming skills, feel free to review code, fix anything
broken, address any of the areas marked "ATTENTION", write a connector
(see below) or whatever you think is best.  Get in touch if you have
any questions.

![alt text](https://myopenreviews.appspot.com/img/remo.png "Thanks for being part of the MyOpenReviews community!")


Code organization:
-----------------

For the REST API, start from `app.yaml` and then reference the
corresponding `.py` file in `src/py`.  The js flow starts from
`index.html` and the core supporting modules are in `docroot/js/amd`.

GIMP workfiles for images are in `src/imgsrc`, `docroot/docs` is for
supporting static HTML for the site. 

For local development download the Google App Engine SDK.  Under the
"Extra Flags" setting for the app, include `--high_replication` for
the relationship updates to work.


Using the API:
-------------

Feel free to call the REST API directly from whatever cool interface
you are working on (whether it is part of MyOpenReviews or not), but
PLEASE DO NOT BATCH REQUESTS!  This is a fledgling site and after
writing about a 1000 reviews the whole site will run out of resources
for the day.  Once normal interactive site starts approaching half the
current limit, the plan is to open the pipes.  In the meantime please
help to conserve resources by pulling only what you need and caching
locally whenever possible.


Connectors:
----------

MyOpenReviews exists as a convenient supplemental interface between
your content sites and your social sites.  To work smoothly, it makes
use of APIs for *inbound* and *outbound* connectors.  The connectors
are organized by API provider in `docroot/js/amd/ext`.  New and
improved connectors are always welcome.  This site can never be too
connected or too smooth.  To build a new connector, just model an
existing one.

Note that MyOpenReviews adheres to all terms of use for all APIs, and
respects API providers, returning value when possible.  When you are
working with an API please

1. Make sure all use is allowed by the API provider

2. Provide attribution when appropriate and respect marks

3. Generally try and give back.  For an inbound connection, link back
to where the content can be found, and if reasonable post review
information back.  For an outbound connection, make sure what is being
posted is compatible and desirable.

Big bonus points for respecting the MyOpenReviews user and making
their life as easy as possible. 

Note that MyOpenReviews does not itself provide media for review, nor
does it support general social conversation, so any API relating to
either of those things cannot be utilized.


Applications:
------------

The MyOpenReviews REST API is available for use by applications as
described above.  Please identify your app in the HTTP headers when
calling the API.  

Get in touch if you want MyOpenReviews to have a link to your app.


Other sites:
-----------

Get in touch.  MyOpenReviews is not the single solution for every
person's every need, and moving smoothly between communities is good
for everyone.

