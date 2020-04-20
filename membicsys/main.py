import flask
import py.useract as useract
import py.util as util
import py.start as start
import py.useract as useract
import py.feed as feed

# Create a default entrypoint for the app.
app = flask.Flask(__name__)

######################################################################
#  API:
#

@app.route('/api/version')
def appversion():
    return "2.3"

@app.route('/api/mailpwr', methods=['GET', 'POST'])
def mailpwr():  # params: emailin
    return util.secure(util.mailpwr)

@app.route('/api/recentactive')
def recentactive():
    return start.recentactive()

@app.route('/api/fetchobj')
def fetchobj():  # params: dt (dsType), di (dsId)
    return util.fetchobj()

@app.route('/api/obimg')
def obimg():  # params: dt (dsType), di (dsId)
    return util.obimg()

@app.route('/api/imagerelay')
def imagerelay():  #params: membicId
    return util.imagerelay()

@app.route('/api/uploadimg', methods=['GET', 'POST'])
def uploadimg():  #params: an, at, dsType, dsId, picfilein
    return useract.uploadimg()

@app.route('/api/signin', methods=['GET', 'POST'])
def signin(): #params: emailin, passin, an, at
    return util.secure(util.signin)

@app.route('/api/newacct', methods=['GET', 'POST'])
def newacct(): #params: emailin, passin
    return util.secure(util.newacct)

@app.route('/api/membicsave', methods=['GET', 'POST'])
def membicsave(): #params an, at, Membic(, themecontext)
    return useract.membicsave()

@app.route('/api/accupd', methods=['GET', 'POST'])
def accupd(): #params an, at, MUser update fields
    return useract.accupd()

@app.route('/api/themeupd', methods=['GET', 'POST'])
def themeupd(): #params an, at, Theme update fields
    return useract.themeupd()

@app.route('/api/associate', methods=['GET', 'POST'])
def associate(): #params: an, at, aot, aoi, pid, assoc, fm[, fid, mtok]
    return useract.associate()

@app.route('/api/urlcontents')
def urlcontents():  # params: an, at, url
    return util.urlcontents()

@app.route('/feed/', defaults={'path': ''})
@app.route('/feed/<path:path>')
def webfeed(path):
    return util.secure(lambda: feed.webfeed(path))

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def startpage(path):
    refer = flask.request.referrer or ""
    return util.secure(lambda: start.startpage(path, refer))


########## Admin interfaces
@app.route('/api/prebsweep')
def prebsweep():
    ## Fill any empty/null preb values.
    return util.secure(util.prebsweep)

# @app.route('/api/toklogin', methods=['POST'])
# def toklogin():
#     # Get an access token from native credentials
#     # POST params: emailin, passin
#     # curl --data "emailin=test@example.com&passin=testing" localhost:8080/api/toklogin
#     return useract.secure(useract.toklogin)

# ## Read native credentials and redirect back
# ## POST params: emailin, passin (,returnto, command, view, objid)
# - url: .*/redirlogin.*
#   script: src.py.muser.app

# ## Create a new native account
# ## POST params: user, pass, email
# - url: .*/newacct.*
#   script: src.py.muser.app

# ## Email password reset access link
# ## POST params: email
# - url: .*/mailpwr.*
#   script: src.py.muser.app

# ## Change native account password
# ## POST params: password, authparams
# - url: .*/updacc.*
#   script: src.py.muser.app

# ## Get login account
# ## GET params: authparams
# - url: .*/getacct.*
#   script: src.py.muser.app

# ## Send account activation code
# ## POST params: authparams
# - url: .*/sendcode.*
#   script: src.py.muser.app

# ## Activate account with key/code, or deactivate (status: Inactive)
# ## GET params: key, code, authparams
# - url: .*/activate.*
#   script: src.py.muser.app

# ## Return the public profile information for the given id
# ## GET params: profid
# - url: .*/profbyid.*
#   script: src.py.muser.app

# ## Upload a profile or theme pic (picfor=coop)
# ## POST params: picfilein, instid, authparams (,picfor)
# - url: .*/picupload.*
#   script: src.py.muser.app

# ## Retrieve a profile pic
# ## GET params: profileid
# - url: .*/profpic.*
#   script: src.py.muser.app


# ######################################################################
# ##        Reviews (membics)

# ## Write the given review and associated coop reviews
# ## POST params: authparams, rev, ctmids
# - url: .*/saverev.*
#   script: src.py.rev.app

# ## Remove the posted review from the coop
# ## POST params: authparams, revid, coopid, reason
# - url: .*/remthpost.*
#   script: src.py.rev.app

# ## Upload a review pic
# ## POST params: picfilein, _id, authparams
# ##   _id: The Review instance id
# - url: .*/revpicupload.*
#   script: src.py.rev.app

# ## Retrieve a review pic
# ## GET params: revid
# - url: .*/revpic.*
#   script: src.py.rev.app

# ## Rotate the uploaded pic for a review
# ## POST params: revid, authparams
# - url: .*/rotatepic.*
#   script: src.py.rev.app


# ######################################################################
# ##        Coops

# ## Create a new coop or update a coop description
# ## POST params: penid, coop, authparams
# - url: .*/ctmdesc.*
#   script: src.py.coop.app

# ## Return the coop for the given id
# ## GET params: coopid
# - url: .*/ctmbyid.*
#   script: src.py.coop.app

# ## Retrieve a coop pic
# ## GET params: coopid
# - url: .*/ctmpic.*
#   script: src.py.coop.app

# ## Apply for next level coop membership
# ## POST params: action (apply/withdraw), penid, coopid, authparams
# - url: .*/ctmmemapply.*
#   script: src.py.coop.app

# ## Process membership application: reject, ignore, accept
# ## POST params: action, penid, coopid, seekerid, authparams
# - url: .*/ctmmemprocess.*
#   script: src.py.coop.app

# ## Fetch general coop statistics
# ## GET params: none
# - url: .*/ctmstats.*
#   script: src.py.coop.app

# ## Note membership invite for a cooperative theme
# ## POST params: penid, coopid, email, authparams
# - url: .*/invitebymail.*
#   script: src.py.coop.app

# ## Retrieve Overflow for Coop or MUser
# ## GET params: overid
# - url: .*/ovrfbyid.*
#   script: src.py.ovrf.app



# ######################################################################
# ##        Connection Services

# ## Return a signed OAuth request given the specified parameters
# ## POST params: name, posturl, headparams, contentparams
# - url: .*/oa1call.*
#   script: src.py.consvc.app

# ## Return the specified JSON endpoint call results
# ## GET params: geturl
# - url: .*/jsonget.*
#   script: src.py.consvc.app

# ## Undecorated return endpoint for Twitter to callback
# ## GET params: oauth token info
# - url: .*/twtok
#   script: src.py.consvc.app

# ## Fetch an access token for GitHub
# ## GET params: code, state
# - url: .*/githubtok.*
#   script: src.py.consvc.app

# ## GitHub authentication callback endpoint
# ## GET params: code, state
# - url: .*/githubcb.*
#   script: src.py.consvc.app

# ## Fetch info from Amazon
# ## GET params: asin, authparams
# - url: .*/amazoninfo.*
#   script: src.py.consvc.app

# ## Fetch search results from Amazon
# ## GET params: revtype, title, authparams
# - url: .*/amazonsearch.*
#   script: src.py.consvc.app

# ## Fetch the contents of the given URL
# ## GET params: url, authparams
# - url: .*/urlcontents.*
#   script: src.py.consvc.app


# ######################################################################
# # Summaries and stats

# ## Bump counter for profile or theme
# ## POST params: ctype, parentid, field [, penid, name, refer]
# - url: .*/bumpmctr.*
#   script: src.py.mctr.app

# ## Fetch counters for profile or theme
# ## GET params: authparams, ctype, parentid
# - url: .*/getmctrs.*
#   script: src.py.mctr.app

# ## Fetch RSS feed content for the specified coop
# ## GET params: coop=instid or profile=instid
# - url: .*/rssfeed.*
#   script: src.py.rssact.app

# ## Fetch the sitemap for indexing crawler reference
# - url: .*/sitemap.xml
#   script: src.py.sitemap.app


# ######################################################################
# # General config and administration

# ## Inbound email handler
# - url: /_ah/mail/.+
#   script: src.py.mailsum.app
#   login: admin

# ## Email bounce handler
# - url: /_ah/bounce
#   script: src.py.mailsum.app
#   login: admin

# ## Nightly periodic processing, reminders and such.
# - url: .*/periodic.*
#   script: src.py.mailsum.app
#   login: admin

# ## Send a general notice
# - url: .*/sendnote.*
#   script: src.py.mailsum.app
#   login: admin

# ## Tech support help for ?user=email
# - url: .*/supphelp.*
#   script: src.py.mailsum.app
#   login: admin

# ## Return automated agents whose use of the site should not be counted.
# - url: .*/botids.*
#   script: src.py.mailsum.app

# ## Structural static directories
# - url: .*/img/
#   static_dir: docroot/img/
# - url: .*/css/
#   static_dir: docroot/css/
# - url: .*/docs/
#   static_dir: docroot/docs/
# - url: .*/js/
#   static_dir: docroot/js/

# ## Various flavors of start page requests:
# ## Direct request for a pen name (p) or theme (t) permalink
# - url: /[p|t|e]/\d+.*
#   script: src.py.start.app
# ## The index page
# - url: /index.html
#   script: src.py.start.app
# ## Anything else ending with a slash also goes to the start page
# - url: .*/
#   script: src.py.start.app
# ## Vanity theme access
# - url: /\w+
#   script: src.py.start.app
# ## Fetch a summary of recently updated profiles and themes
# - url: .*/recentactive.*
#   script: src.py.start.app


# ## Catchall is to look for a static file off docroot
# - url: /
#   static_dir: docroot



# End of API
######################################################################

# Hook for calling the app directly using python on the command line, which
# can be useful for unit testing.  In the deployed app, a WSGI browser
# interface like Gunicorn or Passenger serves the app.
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)

