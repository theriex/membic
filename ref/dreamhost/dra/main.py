import flask

# Create a default entrypoint for the app.
app = flask.Flask(__name__)

@app.route('/api/version')
def appversion():
    return "1.0"

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def startpage(path):
    return "startpage path: " + str(path)

# Hook for calling the app directly using python on the command line, which
# can be useful for unit testing.  In the deployed app, a WSGI browser
# interface like Gunicorn or Passenger serves the app.
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
