// Load environment variables

// API endpoints
const API_BASE = 'http://localhost:5001';
const API_ENDPOINTS = {
    LOGIN: `${API_BASE}/auth/login`,
    SIGNUP: `${API_BASE}/auth/signup`,
    POINTS: `${API_BASE}/points`,
    POINTS_ADD: `${API_BASE}/points/add`,
    FORGOT_PASSWORD: `${API_BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE}/auth/reset-password`
};

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const mainContent = document.getElementById('mainContent');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const pointsValue = document.getElementById('pointsValue');
const statusDiv = document.getElementById('status');
const checkButton = document.getElementById('checkButton');

// Helper Functions
function showStatus(message, isError = false) {
    // Remove any existing status messages
    const existingStatus = document.querySelector('.status-message');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Create status message element
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
    
    // Add message text
    const messageText = document.createElement('span');
    messageText.textContent = message;
    statusDiv.appendChild(messageText);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.setAttribute('aria-label', 'Close notification');
    statusDiv.appendChild(closeButton);
    
    // Add to document
    document.body.appendChild(statusDiv);
    
    // Set up close button click handler
    closeButton.addEventListener('click', () => {
        statusDiv.remove();
    });
    
    // Auto remove after 60 seconds
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.remove();
        }
    }, 60000);
}

function showSection(section) {
    console.log(`Showing section: ${section}`);
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    mainContent.style.display = 'none';
    forgotPasswordForm.style.display = 'none';
    resetPasswordForm.style.display = 'none';
    
    if (section === 'login') loginForm.style.display = 'block';
    else if (section === 'signup') signupForm.style.display = 'block';
    else if (section === 'main') mainContent.style.display = 'block';
    else if (section === 'forgotPassword') forgotPasswordForm.style.display = 'block';
    else if (section === 'resetPassword') resetPasswordForm.style.display = 'block';
}

// Function to handle points addition
async function handlePointsAdd(authToken, points) {
    console.log('Attempting to add points:', points);
    try {
        console.log('Making request to:', API_ENDPOINTS.POINTS_ADD);
        const response = await fetch(API_ENDPOINTS.POINTS_ADD, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ points: points })
        });

        console.log('Points add response status:', response.status);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Points add error response:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Points add success response:', data);
        if (data.points !== undefined) {
            pointsValue.textContent = data.points;
            return data;
        } else {
            throw new Error('No points value in response');
        }
    } catch (error) {
        console.error('Points addition error:', error);
        throw new Error(`Failed to add points: ${error.message}`);
    }
}

// Function to check current page for affiliate ID
async function checkCurrentPage() {
    console.log('Checking current page for affiliate ID');
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        try {
            if (!tabs[0]) {
                console.error('No active tab found');
                showStatus('No active tab found', true);
                return;
            }

            const currentTab = tabs[0];
            const isAmazonPage = currentTab.url.includes('amazon.');
            
            if (!isAmazonPage) {
                showStatus('This is not an Amazon page', true);
                return;
            }

            // Try to inject content script if not already present
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    files: ['config.js', 'content.js']
                });
                console.log('Content scripts injected');
            } catch (error) {
                console.log('Content scripts already present or injection failed:', error);
            }

            // Wait a bit for content script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('Sending message to content script');
            const response = await chrome.tabs.sendMessage(currentTab.id, {
                action: 'checkReferral',
                associateId: window.appConfig.AMAZON_ASSOCIATE_ID
            });
            
            console.log('Content script response:', response);
            if (response && response.hasReferral) {
                // Get auth token and award points
                chrome.storage.local.get(['authToken'], async function(result) {
                    console.log('Retrieved auth token:', result.authToken ? 'exists' : 'missing');
                    if (result.authToken) {
                        try {
                            await handlePointsAdd(result.authToken, 1);
                            showStatus('Success! Referral active - Added 1 point', false);
                            await loadUserData(); // Refresh points display
                        } catch (error) {
                            console.error('Error adding points:', error);
                            showStatus(error.message, true);
                        }
                    } else {
                        showStatus('Please log in to add points', true);
                    }
                });
            } else {
                showStatus('This page does not have your referral link', true);
            }
        } catch (error) {
            console.error('Error checking referral link:', error);
            if (error.message.includes('Receiving end does not exist')) {
                showStatus('Please refresh the page and try again', true);
            } else {
                showStatus('Error checking referral link. Is this an Amazon page?', true);
            }
        }
    });
}

// Authentication Functions
async function login() {
    console.log('Attempting login');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        console.log('Making login request to:', API_ENDPOINTS.LOGIN);
        const response = await fetch(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);
        const data = await response.json();
        if (response.ok) {
            console.log('Login successful');
            chrome.storage.local.set({ authToken: data.token });
            showSection('main');
            loadUserData();
            updateAssociateId();
        } else {
            console.error('Login failed:', data);
            showStatus(data.message || 'Login failed', true);
        }
    } catch (error) {
        console.error('Network error during login:', error);
        showStatus('Network error', true);
    }
}

async function signup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const response = await fetch(API_ENDPOINTS.SIGNUP, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            showStatus('Account created! Please login.');
            showSection('login');
        } else {
            showStatus(data.message || 'Signup failed', true);
        }
    } catch (error) {
        showStatus('Network error', true);
    }
}

// Password Reset Functions
async function requestPasswordReset() {
    const email = document.getElementById('forgotEmail').value;
    
    try {
        const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        if (response.ok) {
            showStatus('Password reset link sent to your email');
            showSection('login');
        } else {
            showStatus(data.message || 'Failed to send reset link', true);
        }
    } catch (error) {
        showStatus('Network error', true);
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showStatus('Passwords do not match', true);
        return;
    }
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        const response = await fetch(API_ENDPOINTS.RESET_PASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: newPassword })
        });
        
        const data = await response.json();
        if (response.ok) {
            showStatus('Password reset successful');
            showSection('login');
        } else {
            showStatus(data.message || 'Failed to reset password', true);
        }
    } catch (error) {
        showStatus('Network error', true);
    }
}

function logout() {
    chrome.storage.local.remove(['authToken'], function() {
        showSection('login');
    });
}

// Update Associate ID from config
function updateAssociateId() {
    const associateId = window.appConfig.AMAZON_ASSOCIATE_ID;
    chrome.storage.local.set({ associateId }, function() {
        console.log('Associate ID updated from config:', associateId);
    });
}

// Points Management
async function loadUserData() {
    try {
        const token = await new Promise(resolve => {
            chrome.storage.local.get(['authToken'], result => resolve(result.authToken));
        });
        
        if (!token) return;
        
        const response = await fetch(API_ENDPOINTS.POINTS, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            pointsValue.textContent = data.points;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status
    chrome.storage.local.get(['authToken'], function(result) {
        if (result.authToken) {
            showSection('main');
            loadUserData();
        } else {
            showSection('login');
        }
    });

    // Login form event listeners
    document.getElementById('loginBtn')?.addEventListener('click', login);
    document.getElementById('signupBtn')?.addEventListener('click', signup);
    document.getElementById('showSignup')?.addEventListener('click', () => showSection('signup'));
    document.getElementById('showLogin')?.addEventListener('click', () => showSection('login'));
    document.getElementById('showForgotPassword')?.addEventListener('click', () => showSection('forgotPassword'));
    document.getElementById('forgotPasswordBtn')?.addEventListener('click', requestPasswordReset);
    document.getElementById('resetPasswordBtn')?.addEventListener('click', resetPassword);
    document.getElementById('logoutButton')?.addEventListener('click', logout);
    
    // Add event listener for page check button
    document.getElementById('checkButton')?.addEventListener('click', checkCurrentPage);
});

// Listen for points updates from background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'POINTS_UPDATED' && message.points !== undefined) {
        pointsValue.textContent = message.points;
    }
});
