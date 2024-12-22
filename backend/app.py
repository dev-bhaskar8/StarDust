from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import bcrypt
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')  # Change in production
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
jwt = JWTManager(app)

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client['amazon_affiliate']
users = db.users

@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400
    
    if users.find_one({'email': email}):
        return jsonify({'message': 'Email already exists'}), 400
    
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    user = {
        'email': email,
        'password': hashed,
        'points': 0,
        'created_at': datetime.utcnow()
    }
    
    result = users.insert_one(user)
    return jsonify({
        'message': 'User created successfully',
        'user_id': str(result.inserted_id)
    }), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    user = users.find_one({'email': email})
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password']):
        return jsonify({'message': 'Invalid email or password'}), 401
    
    access_token = create_access_token(identity=str(user['_id']))
    return jsonify({
        'token': access_token,
        'points': user.get('points', 0)
    }), 200

@app.route('/points', methods=['GET'])
@jwt_required()
def get_points():
    try:
        user_id = ObjectId(get_jwt_identity())
        user = users.find_one({'_id': user_id})
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        return jsonify({'points': user.get('points', 0)}), 200
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/points/add', methods=['POST'])
@jwt_required()
def add_points():
    try:
        user_id = ObjectId(get_jwt_identity())
        data = request.get_json()
        points = data.get('points', 0)
        
        if points <= 0:
            return jsonify({'message': 'Invalid points value'}), 400
        
        result = users.update_one(
            {'_id': user_id},
            {'$inc': {'points': points}}
        )
        
        if result.modified_count == 0:
            return jsonify({'message': 'Failed to update points'}), 400
        
        user = users.find_one({'_id': user_id})
        return jsonify({
            'message': 'Points added successfully',
            'points': user.get('points', 0)
        }), 200
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
