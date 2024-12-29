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
    console.log('Updating Amazon link:', url);
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
        
        console.log('Updated URL:', urlObj.toString());
        return urlObj.toString();
    } catch (e) {
        console.error('Error updating URL:', e);
        return url;
    }
}

// Function to update all Amazon links on the page
function updateAllLinks(associateId) {
    console.log('Updating all links with Associate ID:', associateId);
    if (!associateId) {
        console.warn('No Associate ID provided');
        return;
    }
    
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
        console.log('On Amazon page, updating current URL');
        const currentUrl = window.location.href;
        const newUrl = updateAmazonLink(currentUrl, associateId);
        if (currentUrl !== newUrl) {
            window.history.replaceState(null, '', newUrl);
        }
    }
    
    console.log(`Updated ${replacedCount} Amazon links`);
}

// Function to create a hash from string
function createHash(str) {
    console.log('Creating hash from string length:', str.length);
    
    // Convert string to UTF-8 bytes
    const utf8 = new TextEncoder().encode(str);
    
    // Create a more unique hash using a combination of techniques
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    
    for (let i = 0; i < utf8.length; i++) {
        const byte = utf8[i];
        h1 = Math.imul(h1 ^ byte, 2654435761);
        h2 = Math.imul(h2 ^ byte, 1597334677);
    }
    
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    
    const hashValue = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return Math.abs(hashValue).toString(36);
}

// Function to get page content hash
function getPageContentHash() {
    console.log('Creating hash from page content...');
    
    // Get the main content of the page
    const mainContent = document.body.innerText;
    
    // Remove common dynamic elements that might change between refreshes
    const cleanContent = mainContent
        .replace(/\d{2}:\d{2}:\d{2}/g, '') // Remove times
        .replace(/\d{1,2}:\d{2}/g, '')     // Remove times in different format
        .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
        .replace(/[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/g, '') // Remove date formats like "Jan 1, 2024"
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .trim();                           // Remove leading/trailing whitespace
    
    // Find the start and end markers
    const startMarker = "Order placed, thank you! Confirmation will be sent to your email.";
    const endMarker = "Review or edit your recent orders";
    
    const startIndex = cleanContent.indexOf(startMarker);
    const endIndex = cleanContent.indexOf(endMarker);
    
    console.log('Start marker found at:', startIndex);
    console.log('End marker found at:', endIndex);
    
    if (startIndex === -1 || endIndex === -1) {
        console.log('❌ Could not find one or both markers in the page content');
        console.log('Full page content for debugging:');
        console.log('---START OF FULL CONTENT---');
        console.log(cleanContent);
        console.log('---END OF FULL CONTENT---');
        return createHash(cleanContent); // Fallback to full content
    }
    
    // Get content between markers (including the markers)
    const selectedContent = cleanContent.substring(startIndex, endIndex + endMarker.length);
    
    console.log('Content length:', cleanContent.length);
    console.log('Selected content length:', selectedContent.length);
    console.log('Selected content for hashing:');
    console.log('---START OF CONTENT---');
    console.log(selectedContent);
    console.log('---END OF CONTENT---');
    
    return createHash(selectedContent);
}

// Function to check if purchase was already processed
async function isProcessedPurchase(contentHash) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['processedHashes'], function(result) {
            const now = Date.now();
            const oneDayInMs = 24 * 60 * 60 * 1000;
            
            // Initialize or get existing hashes with timestamps
            let processedHashes = result.processedHashes || [];
            
            // Convert old format to new format if needed
            if (processedHashes.length > 0 && typeof processedHashes[0] === 'string') {
                console.log('Converting old hash format to new format with timestamps');
                processedHashes = processedHashes.map(hash => ({
                    hash: hash,
                    timestamp: now
                }));
            }
            
            // Clean up old entries (older than 24 hours)
            const cleanedHashes = processedHashes.filter(entry => {
                const isRecent = (now - entry.timestamp) < oneDayInMs;
                if (!isRecent) {
                    console.log('Removing old hash:', entry.hash, 'from', new Date(entry.timestamp));
                }
                return isRecent;
            });
            
            // Check if this hash was processed recently
            const existingEntry = cleanedHashes.find(entry => entry.hash === contentHash);
            if (existingEntry) {
                const minutesAgo = Math.round((now - existingEntry.timestamp) / 60000);
                console.log(`❌ Points denied: This purchase was already processed ${minutesAgo} minutes ago`);
                resolve(true);
                return;
            }
            
            // Add new hash with timestamp
            cleanedHashes.push({
                hash: contentHash,
                timestamp: now
            });
            console.log('✓ New unique purchase detected with hash:', contentHash);
            
            // Keep only last 1000 entries
            if (cleanedHashes.length > 1000) {
                const removed = cleanedHashes.shift();
                console.log('Removed oldest hash from history:', removed.hash, 'from', new Date(removed.timestamp));
            }
            
            // Store updated hashes
            chrome.storage.sync.set({ processedHashes: cleanedHashes }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error storing processed hashes:', chrome.runtime.lastError);
                    // If sync fails, fall back to local storage
                    chrome.storage.local.set({ processedHashes: cleanedHashes }, () => {
                        console.log('✓ Stored hash in local storage:', contentHash);
                        resolve(false);
                    });
                } else {
                    console.log('✓ Stored hash in sync storage:', contentHash);
                    console.log('Current active hashes:', cleanedHashes.length);
                    cleanedHashes.forEach(entry => {
                        const age = Math.round((now - entry.timestamp) / 60000);
                        console.log(`- Hash: ${entry.hash}, Age: ${age} minutes`);
                    });
                    resolve(false);
                }
            });
        });
    });
}

async function trackPurchase() {
    console.log('=== Starting Purchase Check ===');
    
    // Check for all variations of thank you page URLs
    const isThankYouPage = window.location.href.includes('/gp/buy/thankyou') || 
                          window.location.href.includes('/gp/buy/thankyou/handlers/display.html') ||
                          window.location.href.includes('/apay/thank-you');
    
    if (isThankYouPage) {
        console.log('✓ Valid thank you page detected:', window.location.href);
        
        // First check if our affiliate tag is present
        try {
            const urlObj = new URL(window.location.href);
            const currentTag = urlObj.searchParams.get('tag');
            console.log('Checking affiliate tag:', currentTag);
            
            if (currentTag !== window.appConfig.AMAZON_ASSOCIATE_ID) {
                console.log('❌ Points denied: Purchase made without our affiliate tag');
                return;
            }
            console.log('✓ Valid affiliate tag found');

            // Check if page is fully loaded
            if (document.readyState !== 'complete') {
                console.log('❌ Points denied: Page not fully loaded yet');
                return;
            }
            console.log('✓ Page fully loaded');

            // Get content hash
            const contentHash = getPageContentHash();
            console.log('Generated content hash:', contentHash);

            // Check if this purchase was already processed
            const isProcessed = await isProcessedPurchase(contentHash);
            if (isProcessed) {
                console.log('❌ Points denied: Purchase already processed');
                return;
            }
            console.log('✓ Purchase is unique and eligible for points');
            
            console.log('✓ Awarding points for purchase with hash:', contentHash);
            sendPurchaseMessage(contentHash);
        } catch (error) {
            console.error('❌ Error processing purchase:', error);
        }
    } else {
        console.log('❌ Not on thank you page. Current URL:', window.location.href);
    }
    console.log('=== Purchase Check Complete ===');
}

// Helper function to send purchase message
function sendPurchaseMessage(purchaseHash) {
    chrome.runtime.sendMessage({
        type: 'PURCHASE_COMPLETED',
        data: {
            timestamp: Date.now(),
            points: 100,
            affiliateTag: window.appConfig.AMAZON_ASSOCIATE_ID,
            purchaseHash: purchaseHash,
            url: window.location.href
        }
    }).then(response => {
        console.log('Background script response:', response);
    }).catch(error => {
        // If there's an error, try sending the message again after a short delay
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'PURCHASE_COMPLETED',
                data: {
                    timestamp: Date.now(),
                    points: 100,
                    affiliateTag: window.appConfig.AMAZON_ASSOCIATE_ID,
                    purchaseHash: purchaseHash,
                    url: window.location.href
                }
            }).catch(retryError => {
                console.error('Error sending message (retry):', retryError);
            });
        }, 2000);
    });
    console.log('Purchase completion message sent');
}

// Only run on complete page load
window.addEventListener('load', function() {
    console.log('Window Loaded - Running purchase tracking');
    // Wait for any dynamic content to load
    setTimeout(() => {
        if (document.readyState === 'complete') {
            trackPurchase();
        }
    }, 2000);
});

// Initialize: Load Associate ID and set up observers
chrome.storage.local.get(['associateId'], function(result) {
    console.log('Loading Associate ID from storage');
    if (result.associateId) {
        currentAssociateId = result.associateId;
        console.log('Loaded Associate ID:', currentAssociateId);
        
        // Update links immediately
        updateAllLinks(currentAssociateId);
        
        // Set up a MutationObserver to handle dynamically added links
        console.log('Setting up MutationObserver');
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
    } else {
        console.warn('No Associate ID found in storage');
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Received message:', message);
    if (message.action === 'updateAssociateId') {
        console.log('Updating Associate ID to:', message.associateId);
        currentAssociateId = message.associateId;
        updateAllLinks(currentAssociateId);
        sendResponse({status: "success"});
    } else if (message.action === 'checkReferral') {
        console.log('Checking referral for:', message.associateId);
        const currentUrl = window.location.href;
        console.log('Current URL:', currentUrl);
        const hasReferral = hasAssociateId(currentUrl, message.associateId);
        console.log('Has referral:', hasReferral);
        sendResponse({hasReferral: hasReferral});
        return true; // Keep the message channel open
    }
    return true; // Keep the message channel open for async response
});
