# Amazon Referral Link Manager

A Chrome extension that automatically replaces Amazon links with your affiliate links. When you visit any Amazon page, the extension automatically processes all links, replacing any existing affiliate tags with your Amazon Associate ID while maintaining essential URL parameters and removing unnecessary tracking data.

## Core Features

- 🔄 **Automatic Link Processing**
  - Instantly replaces all Amazon links with your affiliate links
  - No buttons or manual intervention needed
  - Works on product pages, search results, and category pages

- 🧹 **Smart URL Cleaning**
  - Preserves essential parameters (node, keywords, product IDs)
  - Removes tracking and unnecessary parameters
  - Maintains clean, functional URLs

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

- 🔍 **Referral Verification**
  - Built-in check button in popup
  - Instantly verifies if your referral is active
  - Clear status messages and feedback

## Technical Implementation

### File Structure
```
extension/
├── manifest.json    # Extension configuration
├── config.js       # Associate ID configuration
├── popup.html      # Extension popup interface
├── popup.js        # Popup logic
└── content.js      # Core link processing
```

### Key Components

#### manifest.json
Essential permissions and configurations:
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": ["*://*.amazon.com/*", "*://*.amazon.in/*", "*://*.amazon.co.uk/*", "*://*.amazon.ca/*"],
  "content_scripts": [{
    "matches": ["*://*.amazon.com/*", "*://*.amazon.in/*", "*://*.amazon.co.uk/*", "*://*.amazon.ca/*"],
    "js": ["config.js", "content.js"],
    "run_at": "document_start"
  }]
}
```

#### config.js
Configuration file for your Associate ID:
```javascript
const config = {
    AMAZON_ASSOCIATE_ID: 'your-associate-id'  // Your Amazon Associate ID
};
window.appConfig = config;
```

#### content.js
Core functionality:
- URL parameter management
- Link detection and processing
- Dynamic content monitoring
- Message handling with popup

#### popup.html/js
User interface:
- Check button for referral verification
- Status message display
- Automatic link updating

## Setup Instructions

1. Configure Associate ID:
   - Open `config.js`
   - Replace 'your-associate-id' with your actual Amazon Associate ID
   - Save the file

2. Load in Chrome:
   - Open Chrome Extensions (chrome://extensions/)
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the extension directory

## How It Works

1. **Initialization**
   - Extension loads on Amazon domains
   - Reads Associate ID from config
   - Sets up page monitors

2. **Link Processing**
   - Detects Amazon links on page
   - Cleans URL parameters
   - Adds your Associate ID
   - Updates link href

3. **Dynamic Updates**
   - Monitors DOM changes
   - Processes new links automatically
   - Updates without page reload

4. **Status Checking**
   - Verifies current page referral
   - Shows success/warning messages
   - Provides instant feedback

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

2. **Search Results**
   - Updates all product links
   - Preserves search parameters
   - Handles pagination

3. **Category Browsing**
   - Updates category links
   - Maintains filters and sorting
   - Processes dynamic loading

## Best Practices

1. **Configuration**
   - Keep Associate ID in config.js
   - Update manifest for new domains
   - Test after configuration changes

2. **Usage**
   - Let automatic updates work
   - Use check button to verify
   - Monitor status messages

3. **Maintenance**
   - Update extension regularly
   - Check for Amazon URL changes
   - Monitor affiliate performance
