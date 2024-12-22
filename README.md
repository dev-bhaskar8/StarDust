# Amazon Referral Link Manager

A Chrome extension that helps manage and maintain your Amazon Associate referral links while browsing Amazon. This extension automatically processes Amazon product links, replacing existing affiliate tags with your own while maintaining essential URL parameters and cleaning unnecessary tracking data.

## Features

- 🔄 Automatically replaces existing referral links with your Amazon Associate ID
- 🧹 Cleans unnecessary tracking parameters while preserving essential functionality
- ✨ Maintains your referral ID across page navigation
- 🔍 Checks if your referral is active on the current page
- 💾 Saves your Associate ID for convenience
- 🚀 Works on product pages, search results, and category pages
- 🔒 Secure local storage of your Associate ID
- 🎯 Real-time link processing
- 📊 Status feedback for all operations

## Implementation Details

### File Structure
```
amazon-referral-manager/
├── manifest.json        # Extension configuration
├── popup.html          # Extension UI
├── popup.js            # Popup logic and user interaction
├── content.js          # Core link processing
├── styles.css          # UI styling
└── README.md          # Documentation
```

### Core Components

#### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Amazon Referral Link Manager",
  "version": "1.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.amazon.com/*",
    "*://*.amazon.in/*",
    "*://*.amazon.co.uk/*",
    "*://*.amazon.ca/*"
  ]
}
```

#### Popup Interface (popup.html)
```html
<div class="container">
  <input type="text" id="referralLink" placeholder="Enter Amazon Associate ID">
  <button id="replaceButton">Replace with My Referral</button>
  <button id="checkButton">Check Current Page</button>
  <div id="status"></div>
</div>
```

### Key Functions

#### URL Processing
The extension processes URLs in several ways:
1. **Parameter Preservation**:
   ```javascript
   const keepParams = new Set([
     'node',     // Category/browse node ID
     'th',       // Product variation
     'psc',      // Product selection
     'dp',       // Direct product
     'ie',       // Character encoding
     'keywords', // Search keywords
     's',        // Search parameter
     'k',        // Another search parameter
     'i',        // Item parameter
     'pd_rd_i'   // Product ID
   ]);
   ```

2. **Parameter Removal**:
   ```javascript
   const removeParams = new Set([
     'ref',      // Creator referral
     'ref_',     // Additional referral
     'linkCode', // Link type
     'language',
     'pd_rd_w',
     'pd_rd_r',
     'pf_rd_p',
     'pf_rd_r',
     'sprefix',
     'crid',
     '_encoding',
     'linkId',
     'initialIssue',
     'pf_rd_s',
     'pf_rd_t'
   ]);
   ```

#### Link Handling
- **Click Interception**: Uses event capturing to process links before navigation
- **URL Modification**: Maintains essential parameters while adding affiliate tag
- **Navigation Handling**: Prevents default navigation for link processing

## Installation

1. Clone this repository or download the source code:
   ```bash
   git clone https://github.com/yourusername/amazon-referral-manager.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in your Chrome toolbar
2. Enter your Amazon Associate ID in the popup
3. Click "Replace with My Referral" to update the current page
4. Use "Check Current Page" to verify your referral is active

Your Associate ID will be saved, and the extension will automatically maintain your referral as you browse Amazon.

## Technical Implementation

### Storage
- Uses `chrome.storage.local` for persistent Associate ID storage
- Implements in-memory caching for performance
```javascript
chrome.storage.local.get(['associateId'], function(result) {
    if (result.associateId) {
        currentAssociateId = result.associateId;
    }
});
```

### Message Passing
- Content Script to Popup communication
- Asynchronous message handling with timeout protection
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkReferral") {
        const hasReferral = hasAssociateId(window.location.href, request.associateId);
        sendResponse({hasReferral: hasReferral});
    }
});
```

### Error Handling
- Graceful degradation for unsupported pages
- Timeout handling for long operations
- Clear user feedback for all states
```javascript
try {
    // Operation code
} catch (error) {
    console.error('Error:', error);
    updateStatus('An error occurred. Please try again.');
    return { success: false };
}
```

## Supported Amazon Domains

- amazon.in
- amazon.com
- amazon.co.uk
- amazon.ca

## Security Considerations

### Data Storage
- Associate ID stored locally using Chrome's storage API
- No external data transmission
- No tracking or analytics

### URL Processing
- Only processes Amazon domain URLs
- Preserves essential URL parameters
- Removes tracking parameters
- Maintains page functionality

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of:
  - JavaScript (ES6+)
  - Chrome Extension APIs
  - DOM manipulation
  - URL processing
  - Async/await patterns

### Local Development

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the reload button on the extension
4. Test your changes

### Testing Checklist

- [ ] Associate ID storage works
- [ ] Link replacement functions correctly
- [ ] Navigation maintains referral
- [ ] Error handling works as expected
- [ ] Status messages are clear
- [ ] Performance is acceptable

## Debugging

### Common Issues

1. **Links not updating**
   - Check console for errors
   - Verify domain is supported
   - Check Associate ID is set

2. **Extension not loading**
   - Verify manifest.json syntax
   - Check permissions
   - Review Chrome extension logs

3. **Navigation issues**
   - Check click handler registration
   - Verify URL processing
   - Review console for errors

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is not affiliated with, endorsed by, or connected to Amazon. Use it in accordance with Amazon's Associates Program policies and terms of service.

## Version History

- 1.0.0 (Initial Release)
  - Basic link replacement
  - Associate ID storage
  - Status checking

## Future Enhancements

- [ ] Support for additional Amazon domains
- [ ] Analytics dashboard
- [ ] Batch link processing
- [ ] Custom parameter preservation
- [ ] Link history tracking
- [ ] Export/Import settings

## Support

For support, please open an issue in the GitHub repository.
