console.log('Content script loaded - Version 7');

// Store the Associate ID globally
let currentAssociateId = '';

// Function to check if URL has specific Associate ID
function hasAssociateId(url, associateId) {
    try {
        const urlObj = new URL(url);
        const currentTag = urlObj.searchParams.get('tag');
        console.log('Checking tag:', currentTag, 'against:', associateId);
        return currentTag === associateId;
    } catch (e) {
        console.error('Error checking Associate ID:', e);
        return false;
    }
}

// Function to update Amazon URL with new Associate ID and clean tracking
function updateAmazonLink(url, associateId) {
    try {
        const urlObj = new URL(url);
        const newParams = new URLSearchParams();
        
        // Get existing parameters
        const existingParams = new URLSearchParams(urlObj.search);
        
        // List of essential parameters to keep
        const keepParams = new Set([
            'node',    // Category/browse node ID
            'th',      // Product variation
            'psc',     // Product selection
            'dp',      // Direct product
            'ie',      // Character encoding
            'keywords', // Search keywords
            's',       // Search parameter
            'k',       // Another search parameter
            'i',       // Item parameter
            'pd_rd_i'  // Product ID
        ]);
        
        // Copy over only the essential parameters
        for (const [key, value] of existingParams.entries()) {
            if (keepParams.has(key)) {
                newParams.set(key, value);
            }
        }
        
        // Add affiliate tag
        newParams.set('tag', associateId);
        
        // Reconstruct URL with only essential parameters
        urlObj.search = newParams.toString();
        
        return urlObj.toString();
    } catch (e) {
        console.error('Error updating URL:', e);
        return url;
    }
}

// Function to update all Amazon links on the page
function updateAllLinks(associateId) {
    if (!associateId) return;
    
    const links = document.getElementsByTagName('a');
    let replacedCount = 0;

    for (let link of links) {
        if (link.href.includes('amazon')) {
            const oldHref = link.href;
            link.href = updateAmazonLink(link.href, associateId);
            if (oldHref !== link.href) {
                replacedCount++;
            }
        }
    }
    
    // If we're on an Amazon page, update the current URL
    if (window.location.href.includes('amazon')) {
        const currentUrl = window.location.href;
        const newUrl = updateAmazonLink(currentUrl, associateId);
        if (currentUrl !== newUrl) {
            window.history.replaceState(null, '', newUrl);
        }
    }
    
    console.log(`Updated ${replacedCount} Amazon links`);
}

// Points System Integration
function trackPurchase() {
    // Only run on order confirmation pages
    if (window.location.pathname.includes('/gp/buy/thankyou') || 
        window.location.pathname.includes('/gp/buy/spc/thankyou')) {
        
        // Get order total
        const orderTotalElement = document.querySelector('.grand-total-price');
        if (orderTotalElement) {
            const total = parseFloat(orderTotalElement.textContent.replace(/[^0-9.]/g, ''));
            
            // Send message to background script
            chrome.runtime.sendMessage({
                type: 'PURCHASE_COMPLETED',
                data: {
                    total: total,
                    timestamp: Date.now()
                }
            });
        }
    }
}

// Add purchase tracking without affecting link conversion
document.addEventListener('DOMContentLoaded', function() {
    trackPurchase();
});

// Initialize: Load Associate ID and set up observers
chrome.storage.local.get(['associateId'], function(result) {
    if (result.associateId) {
        currentAssociateId = result.associateId;
        console.log('Loaded Associate ID:', currentAssociateId);
        
        // Update links immediately
        updateAllLinks(currentAssociateId);
        
        // Set up a MutationObserver to handle dynamically added links
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    updateAllLinks(currentAssociateId);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Received message:', request);
        
        if (request.action === "updateAssociateId") {
            currentAssociateId = request.associateId;
            updateAllLinks(currentAssociateId);
            sendResponse({status: "success"});
        }
        else if (request.action === "checkReferral") {
            console.log('Checking referral for:', request.associateId);
            const hasReferral = hasAssociateId(window.location.href, request.associateId);
            console.log('Has referral:', hasReferral);
            sendResponse({hasReferral: hasReferral});
        }
        return true; // Keep the message channel open for async response
    }
);
