""" Main API switchboard with all entrypoints """
#pylint: disable=invalid-name
#pylint: disable=missing-function-docstring
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=ungrouped-imports
import py.mconf as mconf
import logging
import logging.handlers
# logging may or may not have been set up, depending on environment.
logging.basicConfig(level=logging.INFO)
# Tune logging so it works the way it should, even if set up elsewhere
handler = logging.handlers.TimedRotatingFileHandler(
    mconf.logsdir + "plg_application.log", when='D', backupCount=10)
handler.setFormatter(logging.Formatter(
    '%(levelname)s %(module)s %(asctime)s %(message)s'))
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(handler)
import flask
import py.useract as useract
import py.util as util
import py.start as start
import py.feed as feed
import py.irsp as irsp

# Create a default entrypoint for the app.
app = flask.Flask(__name__)

######################################################################
#  API:
#

@app.route('/api/version')
def appversion():
    return "2.3"

@app.route('/api/envinfo')
def envinfo():
    return str(util.envinfo())

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
def associate(): #params: an, at, aot, aoi, pid, assoc, fm
    return useract.associate()

@app.route('/api/audinf')
def audinf(): #params: an, at, dsType, dsId
    return useract.audinf()

@app.route('/api/audblock', methods=['GET', 'POST'])
def audblock(): #params: an, at, srctype, srcid, uid, blocked
    return useract.audblock()

@app.route('/api/fmkuser', methods=['GET', 'POST'])
def fmkuser(): #params: an, at, name, email
    return useract.fmkuser()

@app.route('/api/mshare', methods=['GET', 'POST'])
def mshare(): #params: an, at, mid, sendto, subj, body
    return useract.mshare()

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

@app.route('/irsp/', defaults={'path': ''})
@app.route('/irsp/<path:path>')
def rspg(path):
    return util.secure(lambda: irsp.rspg(path))

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def startpage(path):
    refer = flask.request.referrer or ""
    return util.secure(lambda: start.startpage(path, refer))


########## Admin interfaces
@app.route('/api/uncache')
def uncache():
    ## Unsecured, called from mailins
    return util.uncache()

@app.route('/api/prebsweep')
def prebsweep():
    ## Fill any empty/null preb values.
    return util.secure(util.prebsweep)

@app.route('/api/chgtkw')
def chgtkw():
    ## Change a theme keyword and update all membics using it.
    return util.secure(useract.chgtkw)

@app.route('/api/rebmembic')
def rebmembic():
    ## Rebuild the given membicid as if it was being updated
    return util.secure(useract.rebmembic)

@app.route('/api/supphelp')
def supphelp():
    ## Return an access url for the given email
    return util.secure(util.supphelp)


# Hook for calling the app directly using python on the command line, which
# can be useful for unit testing.  In the deployed app, a WSGI browser
# interface like Gunicorn or Passenger serves the app.
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
