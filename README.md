myopenreviews
=============

This is all source for the site running at http://MyOpenReviews.com
The client is written in JavaScript, the server is written in Python.

Conceptually this is an easy but extensive review site with a follower
social model built over an open data platform supporting a community
of connection services.  Things are still pretty formative right now.
Questions and suggestions are welcome.

If you want to build and run locally you will need the Google App
Engine SDK.  To look through the code from the client side, start from
the call to mor.init in docroot/index.html, then from there to js/mor.js
which is organized into (hopefully intuitive) closures for major
functionality.  To look through things from the server side, start
with app.yaml in the top level directory.

At some point (hopefully soon) there will be an example connection
service.  You may also notice points in the code marked with
"ATTENTION" comments that show areas in need of help.  It is not
necessary to write code to get involved.  Discussions are welcome.

cheers,
-ep


