// Load environment variables
// const ASSOCIATE_ID = 'bhaskar0d0-21';

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
const scanCartButton = document.getElementById('scanCartButton');

// Helper Functions
function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
    statusDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

function showSection(section) {
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
    try {
        const response = await fetch(API_ENDPOINTS.POINTS_ADD, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ points: points })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
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
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        try {
            if (!tabs[0]) {
                showStatus('No active tab found', true);
                return;
            }

            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'checkReferral',
                associateId: window.appConfig.AMAZON_ASSOCIATE_ID
            });
            
            if (response && response.hasReferral) {
                // Get auth token and award points
                chrome.storage.local.get(['authToken'], async function(result) {
                    if (result.authToken) {
                        try {
                            await handlePointsAdd(result.authToken, 1);
                            showStatus('✅ Referral active! Added 1 point!', false);
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
                showStatus('❌ This page does not have your referral link', true);
            }
        } catch (error) {
            showStatus('Error checking referral link', true);
            console.error('Error:', error);
        }
    });
}

// Function to scan for cart page
async function scanCartPage() {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        try {
            if (!tabs[0]) {
                showStatus('No active tab found', true);
                return;
            }

            const currentUrl = tabs[0].url;
            if (currentUrl.includes('/gp/buy/spc/handlers/display.html')) {
                // Get auth token and award points
                chrome.storage.local.get(['authToken'], async function(result) {
                    if (result.authToken) {
                        try {
                            await handlePointsAdd(result.authToken, 1);
                            showStatus('✅ Cart page found! Added 1 point!', false);
                            await loadUserData(); // Refresh points display
                            // Trigger cart page scan in content script
                            chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_CART_PAGE' });
                        } catch (error) {
                            console.error('Error adding points:', error);
                            showStatus(error.message, true);
                        }
                    } else {
                        showStatus('Please log in to add points', true);
                    }
                });
            } else {
                showStatus('❌ This is not the Amazon cart page', true);
            }
        } catch (error) {
            showStatus('Error scanning cart page', true);
            console.error('Error:', error);
        }
    });
}

// Authentication Functions
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            chrome.storage.local.set({ authToken: data.token });
            showSection('main');
            loadUserData();
            updateAssociateId();
        } else {
            showStatus(data.message || 'Login failed', true);
        }
    } catch (error) {
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

// Function to send message to content script
async function sendMessageToContentScript(message) {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab) {
            console.error('No active tab found');
            updateStatus('No active tab found');
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

// Forgot Password Functions
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
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showStatus('Passwords do not match', true);
        return;
    }
    
    try {
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
    
    // Add event listeners for page check buttons
    document.getElementById('checkButton')?.addEventListener('click', checkCurrentPage);
    document.getElementById('scanCartButton')?.addEventListener('click', scanCartPage);
});
