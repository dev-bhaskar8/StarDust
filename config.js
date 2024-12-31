// Configuration settings
const config = {
    AMAZON_ASSOCIATE_ID: 'bhaskar0d0-21'  // Your Amazon Associate ID
};

// Store config in Chrome storage
chrome.storage.local.set({ appConfig: config }, function() {
    console.log('Configuration saved to storage');
});
