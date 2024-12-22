# Amazon Referral Link Manager

A Chrome extension that automatically replaces Amazon links with your affiliate links while rewarding users with points. When you visit any Amazon page, the extension automatically processes all links, replacing any existing affiliate tags with your Amazon Associate ID while maintaining essential URL parameters and removing unnecessary tracking data. Users earn points for their purchases through these affiliate links.

## Core Features

- 🔄 **Automatic Link Processing**
  - Instantly replaces all Amazon links with your affiliate links
  - No buttons or manual intervention needed
  - Works on product pages, search results, and category pages
  - Seamless integration with points tracking system

- 🧹 **Smart URL Cleaning**
  - Preserves essential parameters (node, keywords, product IDs)
  - Removes tracking and unnecessary parameters
  - Maintains clean, functional URLs
  - Ensures accurate purchase tracking for points

- 🌐 **Multi-Domain Support**
  - Works across multiple Amazon domains:
    - amazon.com
    - amazon.in
    - amazon.co.uk
    - amazon.ca

- ✨ **Dynamic Content Handling**
  - Monitors page changes using MutationObserver
  - Processes new links added through AJAX or infinite scroll
  - Real-time updates without page refresh
  - Instant points balance updates

- 🔍 **Referral Verification**
  - Built-in check button in popup
  - Instantly verifies if your referral is active
  - Clear status messages and feedback
  - Points transaction history

- 💎 **Points & Rewards System**
  - Earn points on every purchase through affiliate links
  - Real-time points balance tracking
  - Points awarded based on cart total
  - Secure points storage and management
  - Transaction history and analytics

- 🔐 **User Authentication**
  - Secure email-based registration
  - JWT token authentication
  - Password reset functionality
  - Protected user profiles and points data

## Technical Implementation

### File Structure
```
project/
├── extension/
│   ├── manifest.json    # Extension configuration
│   ├── config.js        # Associate ID configuration
│   ├── popup.html       # Extension popup interface
│   ├── popup.js         # Popup logic
│   └── content.js       # Core link processing
│
├── backend/
│   ├── app.py          # Flask server implementation
│   ├── requirements.txt # Python dependencies
│   ├── .env            # Environment configuration
│   └── .env.example    # Environment template
```

### Key Components

#### manifest.json
Essential permissions and configurations:
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage", "tabs", "notifications"],
  "host_permissions": [
    "*://*.amazon.com/*", 
    "*://*.amazon.in/*", 
    "*://*.amazon.co.uk/*", 
    "*://*.amazon.ca/*",
    "http://localhost:5001/*"
  ],
  "content_scripts": [{
    "matches": ["*://*.amazon.com/*", "*://*.amazon.in/*", "*://*.amazon.co.uk/*", "*://*.amazon.ca/*"],
    "js": ["config.js", "content.js"],
    "run_at": "document_start"
  }]
}
```

#### config.js
Configuration file for your Associate ID and backend URL:
```javascript
const config = {
    AMAZON_ASSOCIATE_ID: 'your-associate-id',  // Your Amazon Associate ID
    BACKEND_URL: 'http://localhost:5001'       // Backend server URL
};
window.appConfig = config;
```

#### content.js
Core functionality:
- URL parameter management
- Link detection and processing
- Dynamic content monitoring
- Message handling with popup
- Purchase detection for points
- Authentication state management

#### popup.html/js
User interface:
- Check button for referral verification
- Status message display
- Automatic link updating
- Points balance display
- Login/Registration forms
- Transaction history

#### Backend (app.py)
Server implementation:
- User authentication endpoints
- Points management system
- MongoDB integration
- JWT token handling
- Email services for password reset

## Setup Instructions

1. Configure Associate ID:
   - Open `config.js`
   - Replace 'your-associate-id' with your actual Amazon Associate ID
   - Update BACKEND_URL if needed
   - Save the file

2. Backend Setup:
   - Install Python dependencies: `pip install -r requirements.txt`
   - Copy `.env.example` to `.env`
   - Configure environment variables:
     - MongoDB connection string
     - JWT secret key
     - SMTP settings for emails
     - Associate ID

3. Load Extension in Chrome:
   - Open Chrome Extensions (chrome://extensions/)
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the extension directory

4. Start Backend Server:
   ```bash
   python app.py
   ```

## How It Works

1. **Initialization**
   - Extension loads on Amazon domains
   - Reads Associate ID from config
   - Sets up page monitors
   - Checks authentication status

2. **Link Processing**
   - Detects Amazon links on page
   - Cleans URL parameters
   - Adds your Associate ID
   - Updates link href
   - Prepares for purchase tracking

3. **Dynamic Updates**
   - Monitors DOM changes
   - Processes new links automatically
   - Updates without page reload
   - Syncs points balance

4. **Status Checking**
   - Verifies current page referral
   - Shows success/warning messages
   - Displays points balance
   - Updates transaction history

5. **Points System**
   - Detects successful purchases
   - Calculates points based on cart total
   - Updates user's points balance
   - Records transaction details

6. **Authentication Flow**
   - User registration with email
   - Secure password handling
   - JWT token management
   - Password reset process

## URL Parameter Handling

### Preserved Parameters
- node (Category/browse node ID)
- th (Product variation)
- keywords (Search terms)
- dp (Direct product)
- psc (Product selection)

### Removed Parameters
- ref (Creator referral)
- ref_ (Additional referral)
- linkCode
- pd_rd_* (Product discovery)
- pf_rd_* (Page flow)
- Other tracking parameters

## Usage Examples

1. **Product Pages**
   - Opens Amazon product page
   - Automatically updates product link
   - Maintains essential parameters
   - Tracks potential purchase

2. **Search Results**
   - Updates all product links
   - Preserves search parameters
   - Handles pagination
   - Monitors product clicks

3. **Category Browsing**
   - Updates category links
   - Maintains filters and sorting
   - Processes dynamic loading
   - Tracks browsing patterns

4. **Points Management**
   - View current points balance
   - Check transaction history
   - Monitor pending points
   - Track purchase status

## Best Practices

1. **Configuration**
   - Keep Associate ID in config.js
   - Secure backend credentials
   - Update manifest for new domains
   - Test after configuration changes

2. **Usage**
   - Let automatic updates work
   - Use check button to verify
   - Monitor status messages
   - Keep user logged in

3. **Maintenance**
   - Update extension regularly
   - Check for Amazon URL changes
   - Monitor affiliate performance
   - Backup points database
   - Monitor authentication logs

4. **Security**
   - Regular security audits
   - Token rotation
   - Secure password storage
   - Rate limiting
   - Input validation
