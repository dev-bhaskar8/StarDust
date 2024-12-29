// Background script for handling auth and points
let authToken = null;
const API_BASE = 'http://localhost:5001';
const ASSOCIATE_ID = 'bhaskar0d0-21';

// Initialize environment variables when extension loads
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed with Associate ID:', ASSOCIATE_ID);
    // Initialize empty purchase history if not exists
    chrome.storage.local.get(['processedPurchases'], function(result) {
        if (!result.processedPurchases) {
            chrome.storage.local.set({ processedPurchases: [] });
        }
    });
});

// Load auth token on startup
chrome.storage.local.get(['authToken'], function(result) {
    if (result.authToken) {
        authToken = result.authToken;
    }
});

// Function to check if purchase has been processed before
async function isPurchaseProcessed(purchaseHash) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['processedPurchases'], function(result) {
            const processedPurchases = result.processedPurchases || [];
            const isProcessed = processedPurchases.includes(purchaseHash);
            console.log('Checking purchase hash:', purchaseHash);
            console.log('Processed purchases:', processedPurchases);
            console.log('Is already processed:', isProcessed);
            resolve(isProcessed);
        });
    });
}

// Function to mark purchase as processed
async function markPurchaseProcessed(purchaseHash) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['processedPurchases'], function(result) {
            let processedPurchases = result.processedPurchases || [];
            
            // Double check to prevent duplicates
            if (processedPurchases.includes(purchaseHash)) {
                console.log('Purchase hash already exists:', purchaseHash);
                resolve(false);
                return;
            }

            // Add new hash
            processedPurchases.push(purchaseHash);
            
            // Keep only the last 1000 purchases
            if (processedPurchases.length > 1000) {
                processedPurchases = processedPurchases.slice(-1000);
            }

            // Store updated list
            chrome.storage.local.set({ processedPurchases }, () => {
                console.log('Stored new purchase hash:', purchaseHash);
                console.log('Updated processed purchases:', processedPurchases);
                resolve(true);
            });
        });
    });
}

// Function to update points in popup
async function updatePopupPoints() {
    try {
        if (!authToken) return;
        
        const response = await fetch(`${API_BASE}/points`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Send message to all extension views to update points
            chrome.runtime.sendMessage({
                type: 'POINTS_UPDATED',
                points: data.points
            }).catch(() => {
                // Ignore errors if popup is not open
            });
        }
    } catch (error) {
        console.error('Error updating points:', error);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Received message in background:', message);
    
    if (message.type === 'PURCHASE_COMPLETED') {
        console.log('Processing purchase completion with affiliate tag:', message.data.affiliateTag);
        
        // Verify affiliate tag matches our config
        if (message.data.affiliateTag !== ASSOCIATE_ID) {
            console.error('Affiliate tag mismatch:', message.data.affiliateTag, '!=', ASSOCIATE_ID);
            sendResponse({ success: false, error: 'Affiliate tag mismatch' });
            return;
        }

        // Process the purchase asynchronously
        (async () => {
            try {
                // First check if already processed
                const isProcessed = await isPurchaseProcessed(message.data.purchaseHash);
                if (isProcessed) {
                    console.log('Purchase already processed:', message.data.purchaseHash);
                    sendResponse({ success: false, error: 'Purchase already processed' });
                    return;
                }

                // Try to mark as processed
                const stored = await markPurchaseProcessed(message.data.purchaseHash);
                if (!stored) {
                    console.log('Failed to store purchase hash - already exists');
                    sendResponse({ success: false, error: 'Purchase already processed' });
                    return;
                }

                // Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon48.png',
                    title: 'Points Awarded!',
                    message: 'You earned 100 points for your purchase. Thank you for shopping!'
                });

                // Send points to backend
                const response = await fetch(`${API_BASE}/points/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        points: message.data.points,
                        timestamp: message.data.timestamp,
                        affiliateTag: message.data.affiliateTag,
                        purchaseHash: message.data.purchaseHash
                    })
                });

                if (response.ok) {
                    // Update points display in popup
                    await updatePopupPoints();
                    sendResponse({ success: true });
                } else {
                    console.error('Failed to record points:', response.status);
                    sendResponse({ success: false, error: 'Failed to record points' });
                }
            } catch (error) {
                console.error('Failed to process purchase:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        // Return true to indicate we'll send a response asynchronously
        return true;
    }
});
