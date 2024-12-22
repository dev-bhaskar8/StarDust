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

        // Create a promise that will reject after 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Message timeout')), 5000);
        });

        // Send message with timeout
        const messagePromise = new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError });
                } else {
                    resolve(response);
                }
            });
        });

        // Race between timeout and message
        return await Promise.race([messagePromise, timeoutPromise])
            .catch(async (error) => {
                console.error('Error or timeout:', error);
                
                // If error, try reinjecting the content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // Try sending message again after reinjection
                    return await new Promise((resolve) => {
                        chrome.tabs.sendMessage(tab.id, message, (response) => {
                            if (chrome.runtime.lastError) {
                                resolve({ success: false, error: chrome.runtime.lastError });
                            } else {
                                resolve(response);
                            }
                        });
                    });
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    updateStatus('Please refresh the Amazon page and try again');
                    return { success: false };
                }
            });
    } catch (error) {
        console.error('Error:', error);
        updateStatus('An error occurred. Please try again.');
        return { success: false };
    }
}

// Function to update status message
function updateStatus(message, type = 'warning') {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = message;
        statusEl.className = type;
    }
}

// Function to initialize popup
function initializePopup() {
    const replaceButton = document.getElementById('replaceButton');
    const checkButton = document.getElementById('checkButton');
    const referralInput = document.getElementById('referralLink');

    if (!replaceButton || !checkButton || !referralInput) {
        console.error('Required elements not found');
        return;
    }

    // Load saved Associate ID
    chrome.storage.local.get(['associateId'], function(result) {
        if (result.associateId && referralInput) {
            referralInput.value = result.associateId;
        }
    });

    // Handle replace button click
    replaceButton.addEventListener('click', async function() {
        const associateId = referralInput.value.trim();
        if (!associateId) {
            updateStatus('Please enter your Amazon Associate ID');
            return;
        }
        
        // Save the Associate ID
        chrome.storage.local.set({ associateId: associateId });
        
        updateStatus('Updating links...', 'warning');
        const response = await sendMessageToContentScript({
            action: "replaceAmazonLink",
            associateId: associateId
        });

        if (response && response.success) {
            if (response.message === 'URL updated') {
                // Don't update status as page will refresh
                return;
            }
            updateStatus(`Updated ${response.count || 0} links successfully!`, 'success');
        } else {
            updateStatus('Failed to update links. Please try again.');
        }
    });

    // Handle check button click
    checkButton.addEventListener('click', async function() {
        const associateId = referralInput.value.trim();
        if (!associateId) {
            updateStatus('Please enter your Amazon Associate ID');
            return;
        }

        updateStatus('Checking referral...', 'warning');
        const response = await sendMessageToContentScript({
            action: "checkReferral",
            associateId: associateId
        });
        
        if (response && response.hasReferral) {
            updateStatus('✓ Your referral is active on this page', 'success');
        } else {
            updateStatus('⚠ Your referral is not active on this page');
        }
    });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}
