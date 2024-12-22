import config from './config.js';

// Background script for handling auth and points
let authToken = null;
const API_BASE = 'http://localhost:5001';

// Initialize environment variables when extension loads
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed with Associate ID:', config.AMAZON_ASSOCIATE_ID);
});

// Load auth token on startup
chrome.storage.local.get(['authToken'], function(result) {
    if (result.authToken) {
        authToken = result.authToken;
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PURCHASE_COMPLETED' && authToken) {
        const points = Math.floor(message.data.total); // 1 point per dollar
        
        // Send points to backend
        fetch(`${API_BASE}/points/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                points: points,
                orderTotal: message.data.total,
                timestamp: message.data.timestamp
            })
        }).then(response => {
            if (response.ok) {
                // Notify user of points earned
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon48.png',
                    title: 'Points Earned!',
                    message: `You earned ${points} points from your purchase!`
                });
            }
        }).catch(error => {
            console.error('Failed to record points:', error);
        });
    }
});
