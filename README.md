# StarDust - Amazon Affiliate Link & Purchase Tracking Extension

A Chrome extension that automatically manages Amazon affiliate links and tracks purchases to award Stardust points based on order value.

## Core Features

### 🔄 Affiliate Link Management
- Automatically replaces Amazon links with your affiliate links
- Works across multiple Amazon domains (amazon.com, amazon.in, amazon.co.uk, amazon.ca)
- Smart URL cleaning:
  - Preserves essential parameters (node, keywords, product IDs)
  - Removes tracking and unnecessary parameters
  - Maintains clean, functional URLs
- Dynamic content handling:
  - Monitors page changes using MutationObserver
  - Processes new links added through AJAX or infinite scroll
  - Real-time updates without page refresh

### 💎 Purchase Tracking & Stardust Points System

#### 1. Checkout Page Detection & Monitoring
- Detects when user is on a checkout page
- Extracts and stores:
  - Product descriptions from page text content
  - Order total in USD
  - Session ID and timestamp
- Continuously monitors the page for:
  - New product descriptions
  - Changes in order total
  - Updates stored data when changes are detected

#### 2. Thank You Page Processing
- Detects Amazon thank you pages
- Verifies:
  - Correct affiliate tag
  - Page is fully loaded
  - Purchase hasn't been processed before (using content hash)
- Extracts:
  - Product descriptions from image alt texts
  - Order confirmation content for hashing

#### 3. Purchase Validation
- Matches product descriptions between:
  - Checkout page (stored text content)
  - Thank you page (image alt texts)
- Validates:
  - Session is less than 30 minutes old
  - At least one product description matches
  - Order total is within valid range

#### 4. Stardust Points Calculation
- Awards Stardust points based on order total:
  - 100 points per USD
  - Minimum: 100 points
  - Maximum: 10,000 points
  - Maximum order value: $1,000 USD

## Technical Implementation

### File Structure
```
project/
├── extension/
│   ├── manifest.json    # Extension configuration
│   ├── config.js        # Associate ID configuration
│   ├── popup.html       # Extension popup interface
│   ├── popup.js         # Popup logic
│   └── content.js       # Core functionality
│
├── backend/
│   ├── app.py          # Flask server implementation
│   ├── requirements.txt # Python dependencies
│   ├── .env            # Environment configuration
│   └── .env.example    # Environment template
```

### Security Features
- Prevents duplicate points:
  - Generates unique hash for each purchase
  - Stores processed hashes with timestamps
  - Cleans up old hashes after 24 hours
- Validates affiliate tags
- Enforces session timeouts
- Secure user authentication:
  - JWT token authentication
  - Protected user profiles
  - Points data security

### Content & Data Handling
- URL Parameter Management:
  - Preserved: node, th, keywords, dp, psc
  - Removed: tracking and unnecessary parameters
- Content Matching:
  - Checkout page: Extracts meaningful text content
  - Thank you page: Extracts product descriptions from image alt texts
  - Uses fuzzy matching to validate purchases
- Currency Handling:
  - Supports multiple currencies (INR, USD, EUR, GBP, BRL)
  - Automatically converts to USD for points calculation
  - Uses current exchange rates

### Storage
- Uses chrome.storage.local for:
  - Session data
  - Checkout information
  - Temporary storage
- Uses chrome.storage.sync for:
  - Processed purchase hashes
  - User preferences
  - Long-term data
- Implements fallback mechanisms for storage failures

## Installation & Setup
1. Configure Backend:
   - Install Python dependencies: `pip install -r requirements.txt`
   - Configure environment variables in `.env`
   - Start backend server: `python app.py`

2. Configure Extension:
   - Open `config.js`
   - Set your Amazon Associate ID
   - Update backend URL if needed

3. Load Extension:
   - Open Chrome Extensions (chrome://extensions/)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Development
- Built with vanilla JavaScript
- Uses Chrome Extension Manifest V3
- Implements MutationObserver for dynamic content
- Backend built with Flask
- MongoDB for data storage
- JWT for authentication

## Best Practices
1. Configuration:
   - Keep Associate ID in config.js
   - Secure backend credentials
   - Update manifest for new domains
   - Test after configuration changes

2. Usage:
   - Let automatic updates work
   - Use check button to verify
   - Monitor status messages
   - Keep user logged in

3. Security:
   - Regular security audits
   - Token rotation
   - Secure password storage
   - Rate limiting
   - Input validation
