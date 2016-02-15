membic
======

Welcome to the collaborative memory project! For an in-depth
introductory overview, go to https://membic.com and click the about
link.  In short, membics are bite sized structured summaries of what
you found memorable, and themes are collection of membics devoted to
particular topics of interest.  Themes may have multiple members and
can serve as standalone content collections.  Operationally,
membic.com consists of a pure functional JavaScript web application
supported by a REST API coded in Python and hosted on Google App
Engine.  The app leverages current standard HTML and CSS.  External
supporting technologies are kept to a minimum.


Getting involved:
----------------

Non-technical help welcome! At this phase of the project one of the
greatest things you can do is provide fresh perspective.  The features
are there for advanced users, but any suggestions about how to make
those first steps easier to take can make a real difference.

If you are technical, fresh perspective is still one of the greatest
things you can provide.

In any case, all comments, questions, suggestions, requests are
welcome.  This is a community site that wants your input, whether you
are coming from a technical background or not.  The best way to get
involved is to simply contact theriex either via github or gmail to
say hello.  It would be great to hear any impressions you have of the
site and/or the project.


Code organization:
-----------------

For the web app, you can trace the flow from `index.html` into
`app.js` and/or search the codebase directly for any text that drew
your attention.  The app is pure JavaScript.  For an architecture
overview, see http://sandservices.com/docs/funcjsarch.html

To get into things from the server side REST API, start from
`app.yaml` to see what the endpoints are, then reference the
corresponding `.py` file in `src/py` for the implementation.

For local development, you will need to install the Google App Engine SDK.
  

Using the API:
-------------

Feel free to call the REST API directly, but PLEASE DO NOT BATCH
REQUESTS!  This is a fledgling site and after about a 1000 membics the
whole thing will run out of resources for the day.  Once normal
interactive site use starts approaching half the current limit, the
pipes will be opened up.  In the meantime please help to conserve
resources by pulling only what you need, and caching locally whenever
possible.

The REST API endpoints are defined and documented in `app.yaml`.
Please identify your app in the HTTP headers when calling the API.
