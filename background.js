/**
 * ExMail - Background Service Worker
 * Handles OAuth2 authentication, Gmail API calls, and notifications
 */

import { gmailAPI } from './api/gmail.js';

// Constants
const REFRESH_ALARM_NAME = 'exmail-refresh';
const DEFAULT_REFRESH_INTERVAL = 5; // minutes
const NOTIFICATION_ID_PREFIX = 'exmail-new-';

// State
let lastKnownMessageIds = new Set();
let isInitialized = false;

/**
 * Initialize the extension
 */
async function initialize() {
    if (isInitialized) return;

    try {
        // Load settings
        const settings = await chrome.storage.local.get(['refreshInterval', 'notificationsEnabled']);
        const refreshInterval = settings.refreshInterval || DEFAULT_REFRESH_INTERVAL;

        // Set up refresh alarm
        await setupRefreshAlarm(refreshInterval);

        // Try to authenticate silently
        await authenticateSilently();

        isInitialized = true;
        console.log('ExMail initialized');
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
}

/**
 * Set up the refresh alarm
 * @param {number} intervalMinutes - Refresh interval in minutes
 */
async function setupRefreshAlarm(intervalMinutes) {
    await chrome.alarms.clear(REFRESH_ALARM_NAME);
    await chrome.alarms.create(REFRESH_ALARM_NAME, {
        periodInMinutes: intervalMinutes
    });
}

/**
 * Authenticate silently (non-interactive)
 * @returns {Promise<string|null>} Access token or null
 */
async function authenticateSilently() {
    try {
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });

        if (token) {
            gmailAPI.setAccessToken(token);
            return token;
        }
    } catch (error) {
        console.log('Silent auth failed:', error.message);
    }
    return null;
}

/**
 * Authenticate interactively (with user consent)
 * @returns {Promise<string>} Access token
 */
async function authenticateInteractive() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (token) {
                gmailAPI.setAccessToken(token);
                resolve(token);
            } else {
                reject(new Error('Failed to get auth token'));
            }
        });
    });
}

/**
 * Sign out and revoke token
 */
async function signOut() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, async (token) => {
            if (token) {
                // Revoke the token
                try {
                    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
                } catch (e) {
                    console.log('Revoke request failed:', e);
                }

                // Remove cached token
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    gmailAPI.setAccessToken(null);
                    lastKnownMessageIds.clear();
                    resolve();
                });
            } else {
                gmailAPI.setAccessToken(null);
                resolve();
            }
        });
    });
}

/**
 * Check for new emails and send notifications
 */
async function checkForNewEmails() {
    try {
        const token = await authenticateSilently();
        if (!token) return;

        const settings = await chrome.storage.local.get(['notificationsEnabled']);
        if (settings.notificationsEnabled === false) return;

        const { messages } = await gmailAPI.listMessages({
            filter: 'unread',
            maxResults: 10
        });

        const currentIds = new Set(messages.map(m => m.id));

        // Find new messages
        if (lastKnownMessageIds.size > 0) {
            for (const message of messages) {
                if (!lastKnownMessageIds.has(message.id)) {
                    // New message!
                    await showNotification(message);
                }
            }
        }

        lastKnownMessageIds = currentIds;
    } catch (error) {
        console.error('Failed to check for new emails:', error);
    }
}

/**
 * Show a notification for a new message
 * @param {Object} message - Message object
 */
async function showNotification(message) {
    const notificationId = `${NOTIFICATION_ID_PREFIX}${message.id}`;

    await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: message.sender?.name || 'New Email',
        message: message.headers?.subject || message.snippet || 'You have a new email',
        priority: 2
    });
}

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request)
        .then(sendResponse)
        .catch(error => {
            console.error('Message handler error:', error);
            sendResponse({ error: error.message });
        });

    return true; // Keep channel open for async response
});

/**
 * Process incoming messages
 * @param {Object} request - Message request
 * @returns {Promise<Object>} Response
 */
async function handleMessage(request) {
    const { action, data } = request;

    switch (action) {
        case 'authenticate':
            const token = await authenticateInteractive();
            const profile = await gmailAPI.getProfile();
            return { success: true, profile };

        case 'signOut':
            await signOut();
            return { success: true };

        case 'checkAuth':
            const authToken = await authenticateSilently();
            if (authToken) {
                const profile = await gmailAPI.getProfile();
                return { authenticated: true, profile };
            }
            return { authenticated: false };

        case 'getProfile':
            return await gmailAPI.getProfile();

        case 'listMessages':
            return await gmailAPI.listMessages(data);

        case 'getMessage':
            return await gmailAPI.getMessage(data.id, data.format);

        case 'sendMessage':
            return await gmailAPI.sendMessage(data);

        case 'replyToMessage':
            return await gmailAPI.replyToMessage(data.messageId, data.body);

        case 'forwardMessage':
            return await gmailAPI.forwardMessage(data.messageId, data.to, data.body);

        case 'trashMessage':
            return await gmailAPI.trashMessage(data.id);

        case 'deleteMessage':
            return await gmailAPI.deleteMessage(data.id);

        case 'toggleStar':
            return await gmailAPI.toggleStar(data.id, data.isStarred);

        case 'markAsRead':
            return await gmailAPI.markAsRead(data.id);

        case 'markAsUnread':
            return await gmailAPI.markAsUnread(data.id);

        case 'getSettings':
            return await chrome.storage.local.get([
                'theme',
                'refreshInterval',
                'notificationsEnabled'
            ]);

        case 'saveSettings':
            await chrome.storage.local.set(data);
            if (data.refreshInterval) {
                await setupRefreshAlarm(data.refreshInterval);
            }
            return { success: true };

        case 'refreshEmails':
            await checkForNewEmails();
            return { success: true };

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM_NAME) {
        checkForNewEmails();
    }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith(NOTIFICATION_ID_PREFIX)) {
        // Open the popup
        chrome.action.openPopup?.() || chrome.windows.create({
            url: chrome.runtime.getURL('popup/popup.html'),
            type: 'popup',
            width: 400,
            height: 600
        });
    }
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
    initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    initialize();
});

// Initialize now (for service worker wake-ups)
initialize();
