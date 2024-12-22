// Load environment variables
// const ASSOCIATE_ID = 'bhaskar0d0-21';

// Function to send message to content script
async function sendMessageToContentScript(message) {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab) {
            console.error('No active tab found');
            updateStatus('No active tab found');
            return { success: false };
        }

        // Check if URL is an Amazon URL
        const url = new URL(tab.url);
        if (!url.hostname.includes('amazon')) {
            updateStatus('Please navigate to an Amazon page');
            return { success: false };
        }

        console.log('Sending message:', message);
        
        // Send message to content script
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, message, (response) => {
                console.log('Received response:', response);
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError });
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error('Error sending message:', error);
        updateStatus('Error: ' + error.message);
        return { success: false, error: error };
    }
}

// Function to update status message
function updateStatus(message, type = 'warning') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Function to check if current page has our Associate ID
async function checkCurrentPage() {
    console.log('Checking current page...');
    const response = await sendMessageToContentScript({
        action: 'checkReferral',
        associateId: window.appConfig.AMAZON_ASSOCIATE_ID
    });

    console.log('Check response:', response);
    if (response && response.hasReferral) {
        updateStatus('✓ Your referral is active on this page', 'success');
    } else {
        updateStatus('⚠ Your referral is not active on this page');
    }
}

// Function to initialize popup
function initializePopup() {
    console.log('Initializing popup...');
    const checkButton = document.getElementById('checkButton');

    if (!window.appConfig || !window.appConfig.AMAZON_ASSOCIATE_ID) {
        console.error('Associate ID not configured');
        updateStatus('Associate ID not configured');
        return;
    }

    // Save the Associate ID to storage
    chrome.storage.local.set({ 
        associateId: window.appConfig.AMAZON_ASSOCIATE_ID 
    }, function() {
        console.log('Associate ID saved:', window.appConfig.AMAZON_ASSOCIATE_ID);
    });

    // Add click event listener for check button
    checkButton.addEventListener('click', () => {
        console.log('Check button clicked');
        checkCurrentPage();
    });

    // Automatically update links when popup opens
    sendMessageToContentScript({
        action: 'updateAssociateId',
        associateId: window.appConfig.AMAZON_ASSOCIATE_ID
    });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}
