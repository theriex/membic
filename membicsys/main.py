""" Main API switchboard with all entrypoints """
#pylint: disable=invalid-name
#pylint: disable=missing-function-docstring
import flask
import py.useract as useract
import py.util as util
import py.start as start
import py.feed as feed

# Create a default entrypoint for the app.
app = flask.Flask(__name__)

######################################################################
#  API:
#

@app.route('/api/version')
def appversion():
    return "2.3"

@app.route('/api/devserver')
def devserver():
    return str(util.is_development_server(verbose=True))

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
def membicsave(): #params an, at, Membic
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

@app.route('/api/jsonget')
def jsonget():  # params: an, at, url
    return util.jsonget()

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

@app.route('/api/supphelp')
def supphelp():
    ## Return an access url for the given email
    return util.secure(util.supphelp)

# ## Send a general notice
# - url: .*/sendnote.*
#   script: src.py.mailsum.app
#   login: admin

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


# Hook for calling the app directly using python on the command line, which
# can be useful for unit testing.  In the deployed app, a WSGI browser
# interface like Gunicorn or Passenger serves the app.
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
