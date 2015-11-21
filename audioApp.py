from flask import (Flask, session, render_template, request, redirect,
                   url_for, make_response, Blueprint, current_app, jsonify, flash, json)
import requests
import json
from datetime import datetime, timedelta
from flask.ext.cors import CORS, cross_origin
from flask_oauth2_login import GoogleLogin
from flask_oauthlib.client import OAuth
from flask.ext.pymongo import PyMongo

    

# Converting to JSON with bson.json_util of pymongo


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
mongo = PyMongo(app)



@app.route('/', methods=['GET'])
@cross_origin()
def index():

    # if auth_tok is in session already..
    if 'google_token' in session:
        print repr(session)
        auth_tok = session['google_token']
	me = session['message']
	print repr(me)
        flash("Welcome" + " " + me.get('name') + "!")
        

    else:
	session['message'] = {'email':''}
        auth_tok = {'access_token': '', 'refresh_token': ''}
     
    return render_template('index.html', access_token=auth_tok,
                           refresh_token=auth_tok, session=session['message'],  
                           config=current_app.config)


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


@app.route('/login')
def login():
    return google.authorize(callback=url_for('authorized', _external=True))


@app.route('/logout')
def logout():
    session.pop('google_token', None)
    session.pop('message', None)
    return redirect(url_for('index'))


@app.route('/login/authorized')
def authorized():
    
    resp = google.authorized_response()
    if resp is None:
        return 'Access denied: reason=%s error=%s' % (
            request.args['error_reason'],
            request.args['error_description']
        )
    session['google_token'] = (resp['access_token'], '')
    me = google.get('userinfo')
    # user profiles record
    # mongo.db.users.save(jsonify(me.data))
    userdata = jsonify({"data": me.data})
    message=json.dumps(me.data)
    session['message'] = me.data
    # flash("Welcome" + me.data.get('name'))

    # return render_template('index.html', user_data=userdata.data, config=app.config, access_token = session['google_token'])
    # return jsonify({"data": me.data})
    return redirect(url_for('index'))



@google.tokengetter
def get_google_oauth_token():
    return session.get('google_token')


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
