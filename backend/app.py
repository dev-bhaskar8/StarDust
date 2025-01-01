from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import bcrypt
import os
from dotenv import load_dotenv
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

# Email Configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL')

def send_reset_email(email, reset_token):
    try:
        # Validate required environment variables
        if not all([SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL]):
            print("Missing required SMTP configuration")
            return False

        msg = MIMEMultipart('alternative')
        msg['From'] = f"Amazon Affiliate Manager <{SMTP_FROM_EMAIL}>"
        msg['To'] = email
        msg['Subject'] = 'Reset Your Password - Amazon Affiliate Manager'
        # Add additional headers to improve deliverability
        msg['Message-ID'] = f"<{secrets.token_hex(16)}@amazonaffiliate.local>"
        msg['Date'] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S %z")
        
        # Create the reset link using FRONTEND_URL or fallback
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        # Plain text version
        text_body = f'''Hello,

You have requested to reset your password for your Amazon Affiliate Manager account.

To reset your password, please click on the following link:
{reset_link}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
Amazon Affiliate Manager Team'''

        # HTML version
        html_body = f'''
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; 
                  text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You have requested to reset your password for your Amazon Affiliate Manager account.</p>
        <p>Please click the button below to reset your password. This link will expire in 1 hour for security reasons.</p>
        <p><a href="{reset_link}" class="button">Reset Password</a></p>
        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;"><small>{reset_link}</small></p>
        <div class="footer">
            <p>If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
            <p>Best regards,<br>Amazon Affiliate Manager Team</p>
        </div>
    </div>
</body>
</html>'''

        # Attach both versions
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

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
    
    access_token = create_access_token(identity=email)
    return jsonify({
        'token': access_token,
        'points': user.get('points', 0)
    }), 200

@app.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'message': 'Email is required'}), 400
        
        print(f"Received forgot password request for email: {email}")
        user = users.find_one({'email': email})
        if not user:
            print(f"No user found with email: {email}")
            # For security reasons, still return success even if email doesn't exist
            return jsonify({'message': 'If the email exists, a reset link will be sent'}), 200
        
        print("Generating reset token...")
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        reset_expiry = datetime.utcnow() + timedelta(hours=1)
        
        print("Saving reset token to database...")
        # Save reset token to user document
        users.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'reset_token': reset_token,
                    'reset_token_expires': reset_expiry
                }
            }
        )
        
        print("Attempting to send reset email...")
        # Send reset email
        if send_reset_email(email, reset_token):
            print("Reset email sent successfully")
            return jsonify({'message': 'Reset link has been sent to your email'}), 200
        else:
            print("Failed to send reset email")
            return jsonify({'message': 'Failed to send reset email. Please try again later.'}), 500
            
    except Exception as e:
        print(f"Error in forgot_password: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'message': 'An error occurred. Please try again later.'}), 500

@app.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'message': 'Token and new password are required'}), 400
    
    user = users.find_one({
        'reset_token': token,
        'reset_token_expires': {'$gt': datetime.utcnow()}
    })
    
    if not user:
        return jsonify({'message': 'Invalid or expired reset token'}), 400
    
    # Hash new password and update user
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    users.update_one(
        {'_id': user['_id']},
        {
            '$set': {'password': hashed},
            '$unset': {'reset_token': '', 'reset_token_expires': ''}
        }
    )
    
    return jsonify({'message': 'Password reset successful'}), 200

@app.route('/points', methods=['GET'])
@jwt_required()
def get_points():
    try:
        current_user = get_jwt_identity()
        user = users.find_one({'email': current_user})
        
        if not user:
            return jsonify({'message': 'User not found'}), 404
            
        return jsonify({'points': user.get('points', 0)}), 200
        
    except Exception as e:
        print(f"Error in get_points: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500

@app.route('/points/add', methods=['POST'])
@jwt_required()
def add_points():
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        points_to_add = data.get('points', 0)

        if not isinstance(points_to_add, (int, float)) or points_to_add <= 0:
            return jsonify({'message': 'Invalid points value'}), 400

        user = users.find_one({'email': current_user})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        current_points = user.get('points', 0)
        new_points = current_points + points_to_add

        users.update_one(
            {'email': current_user},
            {'$set': {'points': new_points}}
        )

        return jsonify({'points': new_points}), 200

    except Exception as e:
        print(f"Error in add_points: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500

@app.route('/admin/points/<email>', methods=['GET'])
def admin_get_points(email):
    try:
        # Only allow access from localhost for security
        if request.remote_addr not in ['127.0.0.1', 'localhost']:
            return jsonify({'message': 'Access denied'}), 403
            
        user = users.find_one({'email': email})
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        return jsonify({
            'email': email,
            'points': user.get('points', 0)
        }), 200
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/wallet', methods=['GET'])
@jwt_required()
def get_wallet():
    try:
        current_user = get_jwt_identity()
        user = users.find_one({'email': current_user})
        
        if not user:
            return jsonify({'message': 'User not found'}), 404
            
        return jsonify({'wallet': user.get('wallet_address', '')}), 200
        
    except Exception as e:
        print(f"Error in get_wallet: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500

@app.route('/wallet', methods=['POST'])
@jwt_required()
def save_wallet():
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        wallet = data.get('wallet')
        
        if not wallet:
            return jsonify({'message': 'Wallet address is required'}), 400
            
        # Update user's wallet address
        result = users.update_one(
            {'email': current_user},
            {'$set': {'wallet_address': wallet}}
        )
        
        if result.modified_count == 0:
            return jsonify({'message': 'User not found or no changes made'}), 404
            
        return jsonify({'message': 'Wallet address saved successfully'}), 200
        
    except Exception as e:
        print(f"Error in save_wallet: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
