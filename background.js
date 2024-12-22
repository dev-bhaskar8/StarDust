import config from './config.js';

// Initialize environment variables when extension loads
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed with Associate ID:', config.AMAZON_ASSOCIATE_ID);
});
