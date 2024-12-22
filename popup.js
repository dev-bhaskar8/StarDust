// Load environment variables
// const ASSOCIATE_ID = 'bhaskar0d0-21';

// API endpoints
const API_BASE = 'http://localhost:5001';
const API_ENDPOINTS = {
    LOGIN: `${API_BASE}/auth/login`,
    SIGNUP: `${API_BASE}/auth/signup`,
    POINTS: `${API_BASE}/points`,
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

// Check current page for affiliate ID
async function checkCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showStatus('No active tab found', true);
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'checkReferral',
            associateId: window.appConfig.AMAZON_ASSOCIATE_ID
        });

        if (response && response.hasAffiliate) {
            showStatus('\u2713 Your referral is active on this page');
        } else {
            showStatus('Affiliate ID is not present on this page', true);
        }
    } catch (error) {
        showStatus('Error checking page: ' + error.message, true);
    }
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
        updateStatus('\u2713 Your referral is active on this page', 'success');
    } else {
        updateStatus('\u26A0 Your referral is not active on this page');
    }
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
    
    // Check for reset password token in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token')) {
        showSection('resetPassword');
    }
    
    // Login form
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('showSignup').addEventListener('click', () => showSection('signup'));
    document.getElementById('showForgotPassword').addEventListener('click', () => showSection('forgotPassword'));
    
    // Signup form
    document.getElementById('signupBtn').addEventListener('click', signup);
    document.getElementById('showLogin').addEventListener('click', () => showSection('login'));
    
    // Forgot Password form
    document.getElementById('resetBtn').addEventListener('click', requestPasswordReset);
    document.getElementById('backToLogin').addEventListener('click', () => showSection('login'));
    
    // Reset Password form
    document.getElementById('setPasswordBtn').addEventListener('click', resetPassword);
    
    // Main content
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('checkButton').addEventListener('click', checkCurrentPage);
    
    // Automatically update links when popup opens
    sendMessageToContentScript({
        action: 'updateAssociateId',
        associateId: window.appConfig.AMAZON_ASSOCIATE_ID
    });
});
