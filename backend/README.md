# Amazon Affiliate Manager Backend

This is the backend server for the Amazon Affiliate Manager Chrome extension. It handles user authentication and points management.

## Setup Instructions

1. Install MongoDB
```bash
# For macOS using Homebrew
brew tap mongodb/brew
brew install mongodb-community
```

2. Start MongoDB
```bash
brew services start mongodb-community
```

3. Create Python virtual environment and install dependencies
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. Set up environment variables
```bash
cp .env.example .env
# Edit .env file with your configuration
```

5. Run the server
```bash
python app.py
```

The server will start on http://localhost:5000

## API Endpoints

### Authentication
- POST /auth/signup - Create new user account
- POST /auth/login - Login and get JWT token

### Points Management
- GET /points - Get user's current points
- POST /points/add - Add points for a purchase

## Environment Variables

- `MONGO_URI`: MongoDB connection string (default: mongodb://localhost:27017/)
- `JWT_SECRET_KEY`: Secret key for JWT token generation (change in production)
