console.log('Content script loaded - Version 4');

// Store the Associate ID globally
let currentAssociateId = '';

// Load saved Associate ID on script load
chrome.storage.local.get(['associateId'], function(result) {
    if (result.associateId) {
        currentAssociateId = result.associateId;
        console.log('Loaded Associate ID:', currentAssociateId);
    }
});

// Function to check if URL has specific Associate ID
function hasAssociateId(url, associateId) {
    try {
        const urlObj = new URL(url);
        const currentTag = urlObj.searchParams.get('tag');
        return currentTag === associateId;
    } catch (e) {
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
        
        // Parameters to explicitly remove
        const removeParams = new Set([
            'ref',     // Creator referral
            'ref_',    // Additional referral
            'linkCode',
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
        
        // Copy over only the essential parameters
        for (const [key, value] of existingParams.entries()) {
            if (keepParams.has(key) && !removeParams.has(key)) {
                newParams.set(key, value);
            }
        }
        
        // Add your affiliate tag
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

    return replacedCount;
}

// Function to handle link clicks
function handleLinkClick(event) {
    if (!currentAssociateId) return;

    const link = event.target.closest('a');
    if (!link || !link.href.includes('amazon')) return;

    // Update the link before navigation
    const updatedUrl = updateAmazonLink(link.href, currentAssociateId);
    if (updatedUrl !== link.href) {
        event.preventDefault();
        window.location.href = updatedUrl;
    }
}

// Add click listener to the document
document.addEventListener('click', handleLinkClick, true);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in content script:', request);

    if (request.action === "checkReferral") {
        const hasReferral = hasAssociateId(window.location.href, request.associateId);
        sendResponse({hasReferral: hasReferral});
    }
    else if (request.action === "replaceAmazonLink") {
        try {
            // Store the Associate ID for future use
            currentAssociateId = request.associateId;
            
            // Update the current page URL
            const oldUrl = window.location.href;
            const newUrl = updateAmazonLink(window.location.href, request.associateId);
            console.log('Old URL:', oldUrl);
            console.log('New URL:', newUrl);
            
            if (oldUrl !== newUrl) {
                sendResponse({success: true, message: 'URL updated'});
                window.location.href = newUrl;
            } else {
                // If URL didn't change, just process other links without refresh
                const replacedCount = updateAllLinks(request.associateId);
                console.log('Updated links count:', replacedCount);
                sendResponse({success: true, count: replacedCount});
            }
        } catch (error) {
            console.error('Error processing request:', error);
            sendResponse({success: false, error: error.message});
        }
    }
});
