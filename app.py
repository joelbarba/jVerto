#!env/bin/python
from flask import Flask, json, jsonify

STATIC_FOLDER = 'webApp'

app = Flask(__name__, static_folder=STATIC_FOLDER)

@app.route('/test')
def test():
    return "Hello, World!"


@app.route('/')
@app.route('/<path:path>')
def index(path=None):

    if not path:
        return app.send_static_file('views/virtual-phone-app.html')

    return app.send_static_file(path)


@app.route('/profile')
def profile(method=False):
    print('Getting the profile')

    user_data = {}
    user_data['user_id'] = 9999
    user_data['display_name'] = 'Joel'
    user_data['username'] = 'joel.barba'

    return jsonify(user_data)

@app.route('/api/v1/users/9999')
def user(method=False):
    print('Getting the user info')

    user_data = {}
    user_data['user_id'] = 9898
    user_data['display_name'] = 'Joel'
    user_data['username'] = 'joel.barba'
    user_data['caller_id_number_internal'] = 1006

    return jsonify(user_data)



if __name__ == '__main__':
    app.run(debug=True,port=5001)