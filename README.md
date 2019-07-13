membic
======

membic: A link with a reason why it is memorable

This project is hosted at https://membic.org


Getting involved:
----------------

Comments, questions, suggestions, requests and help are welcome.  Contact
theriex via github or gmail.


Code organization:
-----------------

This is a pure JavaScript webapp supported by a REST API that is coded in
Python on Google App Engine. `app.yaml` routes index requests to `start.py`
which returns initial page content, which in turn calls the `init` method in
`app.js`.

For local development, you will need to install the Google App Engine SDK.

  
Using the API:
-------------

You can call the REST API directly, but please take it easy.  This is a
fledgling site and after about a 1000 membics the whole thing will run out
of resources for the day.  Once normal interactive site use approaches half
the current limit, it will be time to take this project to the next level.
In the meantime please help to conserve resources by pulling only what you
need, and caching locally whenever possible.

