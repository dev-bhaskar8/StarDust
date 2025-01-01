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
    
    // Find the start and end markers
    const startMarker = "Order placed, thank you! Confirmation will be sent to your email.";
    const endMarker = "Review or edit your recent orders";
    
    // Find the HTML section between markers
    const startTextNodes = document.evaluate(
        "//text()[contains(., 'Order placed, thank you!')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    );
    const endTextNodes = document.evaluate(
        "//text()[contains(., 'Review or edit your recent orders')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    );

    const startNode = startTextNodes.singleNodeValue;
    const endNode = endTextNodes.singleNodeValue;

    if (!startNode || !endNode) {
        console.log('❌ Could not find one or both markers in the page content');
        return createHash(document.body.innerText); // Fallback to full text content
    }

    // Find common parent that contains both nodes
    let startParent = startNode.parentElement;
    let endParent = endNode.parentElement;
    let commonParent = startParent;
    
    while (commonParent && !commonParent.contains(endParent)) {
        commonParent = commonParent.parentElement;
    }

    if (commonParent) {
        console.log('Found common parent:', commonParent.tagName);
        
        // Extract all text content and hrefs
        let contentToHash = '';
        
        // Get all text nodes
        const textWalker = document.createTreeWalker(
            commonParent,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let textNode;
        while (textNode = textWalker.nextNode()) {
            const text = textNode.textContent.trim();
            if (text) {
                contentToHash += text + '\n';
            }
        }
        
        // Get all hrefs
        const links = commonParent.getElementsByTagName('a');
        for (const link of links) {
            const href = link.getAttribute('href');
            if (href) {
                contentToHash += href + '\n';
            }
        }

        console.log('Content for hashing:');
        console.log('---START OF CONTENT---');
        console.log(contentToHash);
        console.log('---END OF CONTENT---');

        // Clean the content before hashing
        const cleanContent = contentToHash
            .replace(/\d{2}:\d{2}:\d{2}/g, '') // Remove times
            .replace(/\d{1,2}:\d{2}/g, '')     // Remove times in different format
            .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
            .replace(/[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/g, '') // Remove date formats like "Jan 1, 2024"
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim();                           // Remove leading/trailing whitespace

        return createHash(cleanContent);
    }

    console.log('❌ Could not find common parent containing both markers');
    return createHash(document.body.innerText); // Fallback to full text content
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

// Helper to generate session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Function to extract order total and convert to USD
function getOrderTotal() {
    const html = document.body.innerHTML;
    console.log('Searching for order total in HTML...');
    
    // More comprehensive price patterns
    const patterns = [
        // Standard format with currency first
        /((?:₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£|R\$)\s*[\d,]+(?:\.\d{2})?)/ig,
        
        // Format with currency after amount
        /([\d,]+(?:\.\d{2})?\s*(?:₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£|R\$))/ig,
        
        // Format without decimals
        /((?:₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£|R\$)\s*[\d,]+)(?!\.\d)/ig
    ];

    // Look for these keywords near the price
    const priceContexts = [
        /Order\s+Total/i,
        /Grand\s+Total/i,
        /Amount\s+Payable/i,
        /Total\s+Amount/i,
        /Final\s+Total/i,
        /Place\s+your\s+order/i
    ];

    let bestMatch = null;
    let bestContext = 0;

    for (const pattern of patterns) {
        const matches = Array.from(html.matchAll(pattern));
        for (const match of matches) {
            // Check how many price contexts are near this price
            const surroundingText = html.substring(
                Math.max(0, match.index - 100),
                Math.min(html.length, match.index + 100)
            );
            
            const contextMatches = priceContexts.filter(ctx => 
                ctx.test(surroundingText)
            ).length;

            if (contextMatches > bestContext) {
                bestMatch = match[0];
                bestContext = contextMatches;
            }
        }
    }

    if (!bestMatch) {
        console.log('Could not find order total in HTML');
        return null;
    }

    console.log('Found best price match:', bestMatch, 'with context score:', bestContext);

    // Extract currency and amount
    const currencyPattern = /(₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£|R\$)\s*([\d,]+(?:\.\d{2})?)|(\d[\d,]+(?:\.\d{2})?)\s*(₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£|R\$)/;
    const currencyMatch = bestMatch.match(currencyPattern);
    
    if (!currencyMatch) {
        console.log('Could not parse price format:', bestMatch);
        return null;
    }

    let currency = currencyMatch[1] || currencyMatch[4];
    const amount = parseFloat((currencyMatch[2] || currencyMatch[3]).replace(/,/g, ''));

    // Normalize currency symbols
    const currencyMap = {
        '₹': 'INR',
        'Rs.': 'INR',
        'Rs': 'INR',
        'INR': 'INR',
        '$': 'USD',
        'USD': 'USD',
        '€': 'EUR',
        'EUR': 'EUR',
        '£': 'GBP',
        'GBP': 'GBP',
        'R$': 'BRL'
    };

    currency = currencyMap[currency] || currency;

    // Convert to USD
    const rates = {
        'INR': 0.012,
        'USD': 1,
        'EUR': 1.09,
        'GBP': 1.27,
        'BRL': 0.20
    };

    const rate = rates[currency] || 1;
    const usdAmount = amount * rate;
    console.log(`Found ${amount} ${currency}, converted to ${usdAmount} USD`);
    return usdAmount;
}

// Function to extract product descriptions from current page
function extractPageAsins() {
    const productDescriptions = new Set();
    console.log('=== Starting Description Extraction ===');
    console.log('Current URL:', window.location.href);
    
    if (window.location.href.includes('/thankyou')) {
        console.log('✓ Confirmed on thank you page');
        console.log('Document ready state:', document.readyState);
        
        // For thank you page, get alt text from product images
        const images = document.querySelectorAll('img');
        console.log(`Found ${images.length} total images on page`);
        
        // Debug all images first
        images.forEach((img, index) => {
            console.log(`\nImage ${index + 1}/${images.length}:`);
            console.log('- src:', img.src || 'no src');
            console.log('- alt:', img.alt || 'no alt');
            console.log('- width:', img.width);
            console.log('- height:', img.height);
            console.log('- class:', img.className || 'no class');
            console.log('- parent:', img.parentElement ? img.parentElement.tagName : 'no parent');
        });
        
        // Now process images for product descriptions
        let productImageCount = 0;
        images.forEach((img, index) => {
            const src = img.src || '';
            const altText = img.alt ? img.alt.trim() : '';
            
            console.log(`\nProcessing image ${index + 1}/${images.length} for product info:`);
            
            // Check if this is a product image with meaningful alt text
            if (src.includes('/images/I/') || src.includes('images/P/')) {
                console.log('✓ Found Amazon product image URL');
                productImageCount++;
                
                if (altText) {
                    console.log('- Alt text found:', altText);
                    if (altText.length > 10) {
                        productDescriptions.add(altText.toLowerCase());
                        console.log('✓ Added product description from alt text');
                    } else {
                        console.log('✗ Alt text too short (<=10 chars)');
                    }
                } else {
                    console.log('✗ No alt text found');
                }
            } else {
                console.log('✗ Not an Amazon product image URL');
            }
        });
        
        console.log(`\nSummary: Found ${productImageCount} Amazon product images out of ${images.length} total images`);
    } else {
        console.log('On checkout page - looking for text content');
        // For checkout page, get all text content
        const textContent = document.body.innerText;
        
        // Split into lines and process each line
        const lines = textContent.split('\n');
        console.log('Found total lines:', lines.length);
        
        lines.forEach((line, index) => {
            line = line.trim();
            // Look for lines that might be product descriptions (longer than 10 chars)
            if (line.length > 10) {
                productDescriptions.add(line.toLowerCase());
                console.log(`Line ${index + 1}: Added description:`, line);
            }
        });
    }

    const descriptions = Array.from(productDescriptions);
    console.log('\n=== Description Extraction Summary ===');
    console.log('Total unique descriptions found:', descriptions.length);
    if (descriptions.length > 0) {
        console.log('All descriptions:');
        descriptions.forEach((desc, index) => {
            console.log(`${index + 1}. ${desc}`);
        });
    } else {
        console.log('No descriptions found!');
    }
    console.log('=====================================');
    return descriptions;
}

// Function to validate purchase by matching descriptions
function validatePurchase(thankYouDescriptions, checkoutDescriptions) {
    console.log('Validating purchase with descriptions');
    console.log('Thank you descriptions:', thankYouDescriptions);
    console.log('Checkout descriptions:', checkoutDescriptions);

    // Find matching descriptions
    const matches = [];
    for (const thankYouDesc of thankYouDescriptions) {
        for (const checkoutDesc of checkoutDescriptions) {
            // Check if checkout description contains the thank you description or vice versa
            if (checkoutDesc.includes(thankYouDesc) || thankYouDesc.includes(checkoutDesc)) {
                matches.push({
                    thankYou: thankYouDesc,
                    checkout: checkoutDesc
                });
                console.log('Found matching description:', {
                    thankYou: thankYouDesc,
                    checkout: checkoutDesc
                });
            }
        }
    }

    console.log('Total matches found:', matches.length);
    
    return {
        isValid: matches.length > 0,
        matches,
        matchCount: matches.length
    };
}

// Function to calculate points from order total
function calculatePoints(orderTotal) {
    const MIN_POINTS = 100;
    const MAX_POINTS = 10000; // $100 worth of points
    const POINTS_PER_USD = 100;
    const MAX_ORDER_VALUE = 1000; // $1000 max order value

    // Validate order total
    if (!orderTotal || orderTotal < 0 || orderTotal > MAX_ORDER_VALUE) {
        console.log('Invalid order total, using minimum points');
        return MIN_POINTS;
    }

    // Calculate points with bounds
    const calculatedPoints = Math.round(orderTotal * POINTS_PER_USD);
    const finalPoints = Math.min(Math.max(calculatedPoints, MIN_POINTS), MAX_POINTS);
    
    console.log(`Calculated points: ${calculatedPoints}, Final points after bounds: ${finalPoints}`);
    return finalPoints;
}

// Function to store checkout data
function storeCheckoutData() {
    console.log('=== Storing Checkout Data ===');
    const descriptions = extractPageAsins(); // This now returns descriptions
    console.log('Found descriptions on checkout page:', descriptions);
    
    const orderTotal = getOrderTotal();
    console.log('Found order total:', orderTotal);
    
    const sessionData = {
        descriptions, // Store descriptions instead of ASINs
        orderTotal,
        timestamp: Date.now(),
        sessionId: generateSessionId(),
        url: window.location.href
    };
    console.log('Created session data:', sessionData);

    chrome.storage.local.set({ 
        'checkoutData': sessionData,
        'lastCheckoutTimestamp': Date.now()
    }, () => {
        console.log('✓ Successfully stored checkout data');
        console.log('=== Checkout Data Storage Complete ===');
    });

    // Set up continuous monitoring for new descriptions and order total
    const observer = new MutationObserver(() => {
        const newDescriptions = extractPageAsins();
        const newOrderTotal = getOrderTotal();
        let shouldUpdate = false;
        let updateMessage = [];

        // Check if we found new descriptions
        if (newDescriptions.length > sessionData.descriptions.length) {
            shouldUpdate = true;
            updateMessage.push(`New descriptions found (${sessionData.descriptions.length} -> ${newDescriptions.length})`);
        }

        // Check if order total changed or was found
        if (newOrderTotal !== sessionData.orderTotal) {
            if (!sessionData.orderTotal && newOrderTotal) {
                updateMessage.push(`Order total found: ${newOrderTotal} USD`);
                shouldUpdate = true;
            } else if (sessionData.orderTotal !== newOrderTotal) {
                updateMessage.push(`Order total changed: ${sessionData.orderTotal} -> ${newOrderTotal} USD`);
                shouldUpdate = true;
            }
        }

        if (shouldUpdate) {
            console.log('Updating checkout data:', updateMessage.join(', '));
            
            // Update session data
            sessionData.descriptions = newDescriptions;
            sessionData.orderTotal = newOrderTotal;
            sessionData.timestamp = Date.now();

            // Store updated data
            chrome.storage.local.set({ 
                'checkoutData': sessionData,
                'lastCheckoutTimestamp': Date.now()
            }, () => {
                console.log('✓ Updated checkout data');
                console.log('Current descriptions:', newDescriptions);
                console.log('Current order total:', newOrderTotal);
            });
        }
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });

    // Store observer reference to disconnect later if needed
    window.asinObserver = observer;
}

// Function to validate and process purchase
function validateAndProcessPurchase(thankYouDescriptions, contentHash) {
    console.log('=== Starting Purchase Validation ===');
    console.log('Thank you page descriptions:', thankYouDescriptions);
    console.log('Content hash:', contentHash);
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['checkoutData', 'lastCheckoutTimestamp'], function(result) {
            const MAX_SESSION_AGE = 30 * 60 * 1000; // 30 minutes
            const now = Date.now();
            
            console.log('Retrieved checkout data:', result.checkoutData);
            console.log('Last checkout timestamp:', new Date(result.lastCheckoutTimestamp));
            
            if (!result.checkoutData || !result.lastCheckoutTimestamp) {
                console.log('❌ No checkout data found');
                resolve(false);
                return;
            }
            
            const sessionAge = now - result.lastCheckoutTimestamp;
            console.log('Session age:', Math.round(sessionAge / 1000), 'seconds');
            
            if (sessionAge > MAX_SESSION_AGE) {
                console.log('❌ Session expired. Age:', Math.round(sessionAge / 60000), 'minutes');
                resolve(false);
                return;
            }

            const checkoutData = result.checkoutData;
            console.log('Validating purchase with checkout data:', checkoutData);
            
            // Use descriptions instead of ASINs for validation
            const validation = validatePurchase(thankYouDescriptions, checkoutData.descriptions);
            console.log('Validation result:', validation);
            
            if (!validation.isValid) {
                console.log('❌ Purchase validation failed');
                console.log('Checkout descriptions:', checkoutData.descriptions);
                console.log('Thank you descriptions:', thankYouDescriptions);
                console.log('Matches found:', validation.matches);
                console.log('Match count:', validation.matchCount);
                resolve(false);
                return;
            }

            const points = calculatePoints(checkoutData.orderTotal);
            console.log('✓ Purchase validated successfully');
            console.log('Order total (USD):', checkoutData.orderTotal);
            console.log('Points awarded:', points);
            
            // Send purchase message with points
            sendPurchaseMessage(contentHash, points);
            
            // Clear checkout data
            chrome.storage.local.remove(['checkoutData', 'lastCheckoutTimestamp'], () => {
                console.log('✓ Cleared checkout data');
                console.log('=== Purchase Validation Complete ===');
            });
            
            resolve(true);
        });
    });
}

// Modify trackPurchase function to handle observer cleanup
async function trackPurchase() {
    console.log('=== Starting Purchase Check ===');
    console.log('Current URL:', window.location.href);
    
    // Clean up any existing observer
    if (window.asinObserver) {
        console.log('Cleaning up previous ASIN observer');
        window.asinObserver.disconnect();
        window.asinObserver = null;
    }
    
    const currentUrl = window.location.href;
    
    // Check thank you page first (more specific patterns)
    const isThankYouPage = currentUrl.includes('/gp/buy/thankyou') || 
                          currentUrl.includes('/buy/thankyou') ||
                          currentUrl.includes('/thankyou/handlers/display.html') ||
                          currentUrl.includes('/apay/thank-you');

    // Only check for checkout if it's not a thank you page
    const isCheckoutPage = !isThankYouPage && (
        currentUrl.includes('/gp/buy/spc/') || 
        currentUrl.includes('/gp/buy/payselect/') ||
        currentUrl.includes('/checkout/') ||
        currentUrl.includes('/buy/') ||
        currentUrl.includes('/payment/') ||
        currentUrl.includes('/order/')
    );

    console.log('Page type:', isThankYouPage ? 'Thank You' : isCheckoutPage ? 'Checkout' : 'Other');

    // Store ASINs and total for checkout pages
    if (isCheckoutPage) {
        console.log('Processing checkout page...');
        console.log('URL patterns matched:', {
            buySpc: currentUrl.includes('/gp/buy/spc/'),
            buyPayselect: currentUrl.includes('/gp/buy/payselect/'),
            checkout: currentUrl.includes('/checkout/'),
            buy: currentUrl.includes('/buy/'),
            payment: currentUrl.includes('/payment/'),
            order: currentUrl.includes('/order/')
        });
        storeCheckoutData();
        return;
    }
    
    if (isThankYouPage) {
        console.log('Processing thank you page...');
        
        try {
            // Check affiliate tag
            const urlObj = new URL(currentUrl);
            const currentTag = urlObj.searchParams.get('tag');
            console.log('Found affiliate tag:', currentTag);
            console.log('Expected affiliate tag:', window.appConfig.AMAZON_ASSOCIATE_ID);
            
            if (currentTag !== window.appConfig.AMAZON_ASSOCIATE_ID) {
                console.log('❌ Points denied: Wrong affiliate tag');
                return;
            }
            console.log('✓ Affiliate tag verified');

            // Check page load
            console.log('Page ready state:', document.readyState);
            if (document.readyState !== 'complete') {
                console.log('❌ Points denied: Page not ready');
                return;
            }
            console.log('✓ Page fully loaded');

            // Get ASINs and descriptions first
            console.log('Extracting descriptions from thank you page...');
            const thankYouDescriptions = extractPageAsins();
            console.log('Found descriptions:', thankYouDescriptions);

            // Get content hash
            console.log('Generating content hash...');
            const contentHash = getPageContentHash();
            console.log('Generated hash:', contentHash);

            // Check for duplicate
            console.log('Checking if purchase was already processed...');
            const isProcessed = await isProcessedPurchase(contentHash);
            if (isProcessed) {
                console.log('❌ Points denied: Duplicate purchase');
                return;
            }
            console.log('✓ New unique purchase');

            // Validate and process
            console.log('Starting purchase validation...');
            const success = await validateAndProcessPurchase(thankYouDescriptions, contentHash);
            if (!success) {
                console.log('❌ Purchase processing failed');
            } else {
                console.log('✓ Purchase successfully processed');
            }
        } catch (error) {
            console.error('❌ Error processing purchase:', error);
            console.error('Error stack:', error.stack);
        }
    }
    console.log('=== Purchase Check Complete ===');
}

// Update sendPurchaseMessage to include points
function sendPurchaseMessage(purchaseHash, points = 100) {
    chrome.runtime.sendMessage({
        type: 'PURCHASE_COMPLETED',
        data: {
            timestamp: Date.now(),
            points: points,
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
                    points: points,
                    affiliateTag: window.appConfig.AMAZON_ASSOCIATE_ID,
                    purchaseHash: purchaseHash,
                    url: window.location.href
                }
            }).catch(retryError => {
                console.error('Error sending message (retry):', retryError);
            });
        }, 2000);
    });
    console.log('Purchase completion message sent with points:', points);
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
