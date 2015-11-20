from flask import (Flask, session, render_template, request, redirect,
                   url_for, make_response, Blueprint, current_app)
import requests
import json
from datetime import datetime, timedelta
from flask.ext.cors import CORS, cross_origin
from flask_oauthlib.client import OAuth


app = Flask(__name__)
app.config.from_pyfile('config.py')
oauth = OAuth(app)
google = oauth.remote_app(
    'google',
    consumer_key=app.config.get('GOOGLE_ID'),
    consumer_secret=app.config.get('GOOGLE_SECRET'),
    request_token_params={
        'scope': 'email'
    },
    base_url='https://www.googleapis.com/oauth2/v1/',
    request_token_url=None,
    access_token_method='POST',
    access_token_url='https://accounts.google.com/o/oauth2/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
)
CORS(app, allow_headers=('Content-Type', 'Authorization'))


@app.route('/', methods=['GET'])
@cross_origin()
def index():

    # if auth_tok is in session already..
    if 'auth_tok' in session:
        auth_tok = session['auth_tok']

        # check if it has expired
        oauth_token_expires_in_endpoint = current_app.config.get(
            'SWTSTORE_URL')+'/oauth/token-expires-in'
        resp = requests.get(oauth_token_expires_in_endpoint)
        expires_in = json.loads(resp.text)['expires_in']

        # added for backwared compatibility. previous session stores did not
        # have issued key
        try:
            check = datetime.utcnow() - auth_tok['issued']

            if check > timedelta(seconds=expires_in):
                # TODO: try to refresh the token before signing out the user
                auth_tok = {'access_token': '', 'refresh_token': ''}
            else:
                """access token did not expire"""
                pass

        # if issued key is not there, reset the session
        except KeyError:
            auth_tok = {'access_token': '', 'refresh_token': ''}

    else:
        auth_tok = {'access_token': '', 'refresh_token': ''}

    # print 'existing tokens'
    # print auth_tok
    # payload = {'what': 'audio-tagger',
    #        'access_token': auth_tok['access_token']}
    # req = requests.get(current_app.config.get(
    #    'SWTSTORE_URL', 'SWTSTORE_URL') + '/api/sweets/q', params=payload)
    # sweets = req.json()
    return render_template('index.html', access_token=auth_tok['access_token'],
                           refresh_token=auth_tok['refresh_token'],
                           config=current_app.config,
                           url=request.args.get('where'))


@app.route('/authenticate', methods=['GET'])
def authenticateWithOAuth():
    auth_tok = None
    code = request.args.get('code')

    # prepare the payload
    payload = {
        'scopes': 'email context',
        'client_secret': current_app.config.get('APP_SECRET'),
        'code': code,
        'redirect_uri': current_app.config.get('REDIRECT_URI'),
        'grant_type': 'authorization_code',
        'client_id': current_app.config.get('APP_ID')
    }

    # token exchange endpoint
    oauth_token_x_endpoint = current_app.config.get(
        'SWTSTORE_URL', 'SWTSTORE_URL') + '/oauth/token'
    resp = requests.post(oauth_token_x_endpoint, data=payload)
    auth_tok = json.loads(resp.text)

    if 'error' in auth_tok:
        return make_response(auth_tok['error'], 200)

    # set sessions etc
    session['auth_tok'] = auth_tok
    session['auth_tok']['issued'] = datetime.utcnow()
    return redirect(url_for('index'))


@app.route('/admin', methods=['GET', 'POST'])
@cross_origin()
def admin():
    return render_template('admin.html')


@app.route('/signup', methods=['POST'])
@cross_origin()
def signup():
    station = request.form.get('radiostation')
    owner = request.form.get('firstname') + ' ' + request.form.get('lastname')
    owneremail = request.form.get('email')
    payload = {
        'who': 'salus.sage@gmail.com',
        'what': 'confirmed-radio-account',
        'where': 'http://pantoto.org',
        'how': {'how.radioStation': station, 'how.ownerName': owner,
                 'how.owneremail': owneremail}
        }
    signupEndpoint = current_app.config.get('SWTSTORE_URL',
                                            'SWTSTORE_URL')+'/api/sweets'+'?access_token=3fuJAPRXU4c8RdHVk9mYetE6d3tIOq'
    print(payload, signupEndpoint)
    requests.post(signupEndpoint, data=[payload])
    return redirect(url_for('admin'))

if __name__ == '__main__':
    # app = create_app()
    app.run(debug=app.config.get('DEBUG'),
            host=app.config.get('HOST'))
