/**
 * ExMail - Popup Controller
 * Main UI controller for the extension popup
 */

import { formatDate, formatFullDate, getInitials, stringToColor, truncateText, stripHtml, debounce } from '../api/utils.js';

// State
let state = {
    authenticated: false,
    profile: null,
    emails: [],
    currentFilter: 'inbox',
    currentEmail: null,
    composeMode: null, // null, 'new', 'reply', 'forward'
    replyToMessage: null,
    loading: false,
    settings: {
        theme: 'system',
        refreshInterval: 5,
        notificationsEnabled: true
    }
};

// DOM Elements
const elements = {};

/**
 * Initialize the popup
 */
async function init() {
    cacheElements();
    bindEvents();
    await loadSettings();
    applyTheme();
    await checkAuth();
}

/**
 * Cache DOM elements
 */
function cacheElements() {
    elements.loadingScreen = document.getElementById('loading-screen');
    elements.authScreen = document.getElementById('auth-screen');
    elements.mainApp = document.getElementById('main-app');
    elements.signInBtn = document.getElementById('sign-in-btn');

    // Header
    elements.refreshBtn = document.getElementById('refresh-btn');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.searchInput = document.getElementById('search-input');

    // Filters
    elements.filterTabs = document.querySelectorAll('.filter-tab');

    // Email list
    elements.emailList = document.getElementById('email-list');
    elements.emptyState = document.getElementById('empty-state');
    elements.composeBtn = document.getElementById('compose-btn');

    // Email view modal
    elements.emailViewModal = document.getElementById('email-view-modal');
    elements.emailBackBtn = document.getElementById('email-back-btn');
    elements.emailReplyBtn = document.getElementById('email-reply-btn');
    elements.emailForwardBtn = document.getElementById('email-forward-btn');
    elements.emailStarBtn = document.getElementById('email-star-btn');
    elements.emailDeleteBtn = document.getElementById('email-delete-btn');
    elements.emailContent = document.getElementById('email-content');

    // Compose modal
    elements.composeModal = document.getElementById('compose-modal');
    elements.composeTitle = document.getElementById('compose-title');
    elements.composeCloseBtn = document.getElementById('compose-close-btn');
    elements.composeForm = document.getElementById('compose-form');
    elements.composeTo = document.getElementById('compose-to');
    elements.composeSubject = document.getElementById('compose-subject');
    elements.composeBody = document.getElementById('compose-body');
    elements.composeDiscardBtn = document.getElementById('compose-discard-btn');
    elements.composeSendBtn = document.getElementById('compose-send-btn');

    // Settings
    elements.settingsPanel = document.getElementById('settings-panel');
    elements.settingsCloseBtn = document.getElementById('settings-close-btn');
    elements.themeSelect = document.getElementById('theme-select');
    elements.notificationsToggle = document.getElementById('notifications-toggle');
    elements.refreshIntervalSelect = document.getElementById('refresh-interval-select');
    elements.accountEmail = document.getElementById('account-email');
    elements.accountAvatar = document.getElementById('account-avatar');
    elements.signOutBtn = document.getElementById('sign-out-btn');

    // Toast
    elements.toastContainer = document.getElementById('toast-container');
}

/**
 * Bind event listeners
 */
function bindEvents() {
    // Auth
    elements.signInBtn.addEventListener('click', handleSignIn);

    // Header
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.settingsBtn.addEventListener('click', () => showSettings());
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Filters
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => handleFilterChange(tab.dataset.filter));
    });

    // Compose
    elements.composeBtn.addEventListener('click', () => openCompose('new'));
    elements.composeCloseBtn.addEventListener('click', closeCompose);
    elements.composeDiscardBtn.addEventListener('click', closeCompose);
    elements.composeForm.addEventListener('submit', handleSend);

    // Email view
    elements.emailBackBtn.addEventListener('click', closeEmailView);
    elements.emailReplyBtn.addEventListener('click', () => openCompose('reply'));
    elements.emailForwardBtn.addEventListener('click', () => openCompose('forward'));
    elements.emailStarBtn.addEventListener('click', handleStarCurrentEmail);
    elements.emailDeleteBtn.addEventListener('click', handleDeleteCurrentEmail);

    // Settings
    elements.settingsCloseBtn.addEventListener('click', () => hideSettings());
    elements.themeSelect.addEventListener('change', handleThemeChange);
    elements.notificationsToggle.addEventListener('change', handleNotificationsChange);
    elements.refreshIntervalSelect.addEventListener('change', handleRefreshIntervalChange);
    elements.signOutBtn.addEventListener('click', handleSignOut);
}

/**
 * Send message to background script
 */
function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, data }, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Check authentication status
 */
async function checkAuth() {
    try {
        const response = await sendMessage('checkAuth');

        if (response.authenticated) {
            state.authenticated = true;
            state.profile = response.profile;
            showMainApp();
            await loadEmails();
        } else {
            showAuthScreen();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuthScreen();
    }
}

/**
 * Handle sign in
 */
async function handleSignIn() {
    elements.signInBtn.disabled = true;
    elements.signInBtn.textContent = 'Signing in...';

    try {
        const response = await sendMessage('authenticate');
        state.authenticated = true;
        state.profile = response.profile;
        showMainApp();
        await loadEmails();
    } catch (error) {
        console.error('Sign in failed:', error);
        showToast('Sign in failed. Please try again.', 'error');
    } finally {
        elements.signInBtn.disabled = false;
        elements.signInBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M18.171 8.368h-.671v-.035H10v3.333h4.709A4.998 4.998 0 015 10a5 5 0 015-5c1.275 0 2.434.48 3.317 1.266l2.357-2.357A8.295 8.295 0 0010 1.667a8.333 8.333 0 108.171 6.701z" fill="#FFC107"/>
        <path d="M2.627 6.121l2.74 2.009A4.998 4.998 0 0110 5c1.275 0 2.434.48 3.317 1.266l2.357-2.357A8.295 8.295 0 0010 1.667a8.329 8.329 0 00-7.373 4.454z" fill="#FF3D00"/>
        <path d="M10 18.333a8.294 8.294 0 005.587-2.163l-2.579-2.183A4.963 4.963 0 0110 15a4.998 4.998 0 01-4.701-3.306l-2.72 2.095A8.327 8.327 0 0010 18.333z" fill="#4CAF50"/>
        <path d="M18.171 8.368H17.5v-.035H10v3.333h4.709a5.015 5.015 0 01-1.703 2.321l2.58 2.182c-.182.166 2.747-2.002 2.747-6.17 0-.559-.057-1.104-.162-1.631z" fill="#1976D2"/>
      </svg>
      Sign in with Google
    `;
    }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
    try {
        await sendMessage('signOut');
        state.authenticated = false;
        state.profile = null;
        state.emails = [];
        hideSettings();
        showAuthScreen();
        showToast('Signed out successfully');
    } catch (error) {
        console.error('Sign out failed:', error);
        showToast('Sign out failed', 'error');
    }
}

/**
 * Load emails
 */
async function loadEmails(query = '') {
    state.loading = true;
    showLoadingSkeleton();

    try {
        const response = await sendMessage('listMessages', {
            filter: state.currentFilter,
            maxResults: 20,
            q: query
        });

        state.emails = response.messages || [];
        renderEmailList();
    } catch (error) {
        console.error('Failed to load emails:', error);

        if (error.message === 'AUTH_EXPIRED') {
            showToast('Session expired. Please sign in again.', 'error');
            showAuthScreen();
        } else {
            showToast('Failed to load emails', 'error');
        }
    } finally {
        state.loading = false;
    }
}

/**
 * Handle refresh
 */
async function handleRefresh() {
    elements.refreshBtn.classList.add('loading');
    await loadEmails(elements.searchInput.value);
    elements.refreshBtn.classList.remove('loading');
}

/**
 * Handle search
 */
async function handleSearch(e) {
    const query = e.target.value.trim();
    await loadEmails(query);
}

/**
 * Handle filter change
 */
async function handleFilterChange(filter) {
    if (filter === state.currentFilter) return;

    state.currentFilter = filter;

    // Update active tab
    elements.filterTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    await loadEmails(elements.searchInput.value);
}

/**
 * Show loading skeleton
 */
function showLoadingSkeleton() {
    const skeletons = Array(5).fill('').map(() => `
    <div class="email-skeleton">
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line"></div>
      </div>
    </div>
  `).join('');

    elements.emailList.innerHTML = skeletons;
    elements.emptyState.classList.add('hidden');
}

/**
 * Render email list
 */
function renderEmailList() {
    if (state.emails.length === 0) {
        elements.emailList.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    const html = state.emails.map((email, index) => {
        const initials = getInitials(email.sender?.name || '?');
        const color = stringToColor(email.sender?.email || '');
        const subject = email.headers?.subject || '(no subject)';
        const preview = truncateText(email.snippet || '', 60);
        const time = formatDate(email.internalDate);
        const isUnread = email.isUnread;
        const isStarred = email.isStarred;

        return `
      <div class="email-item ${isUnread ? 'unread' : ''}" 
           data-id="${email.id}" 
           style="animation-delay: ${index * 30}ms">
        <div class="email-avatar" style="background: ${color}">${initials}</div>
        <div class="email-body">
          <div class="email-header">
            <span class="email-sender">${escapeHtml(email.sender?.name || email.sender?.email || 'Unknown')}</span>
            <span class="email-time">${time}</span>
          </div>
          <div class="email-subject">${escapeHtml(subject)}</div>
          <div class="email-preview">${escapeHtml(preview)}</div>
        </div>
        <button class="email-star ${isStarred ? 'starred' : ''}" 
                data-id="${email.id}" 
                data-starred="${isStarred}"
                title="${isStarred ? 'Unstar' : 'Star'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
    `;
    }).join('');

    elements.emailList.innerHTML = html;

    // Bind click events
    elements.emailList.querySelectorAll('.email-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.email-star')) {
                openEmailView(item.dataset.id);
            }
        });
    });

    elements.emailList.querySelectorAll('.email-star').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleToggleStar(btn.dataset.id, btn.dataset.starred === 'true');
        });
    });
}

/**
 * Open email view
 */
async function openEmailView(id) {
    try {
        const email = await sendMessage('getMessage', { id, format: 'full' });
        state.currentEmail = email;

        // Mark as read
        if (email.isUnread) {
            await sendMessage('markAsRead', { id });
            // Update local state
            const localEmail = state.emails.find(e => e.id === id);
            if (localEmail) localEmail.isUnread = false;
        }

        renderEmailView(email);
        elements.emailViewModal.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load email:', error);
        showToast('Failed to load email', 'error');
    }
}

/**
 * Render email view
 */
function renderEmailView(email) {
    const initials = getInitials(email.sender?.name || '?');
    const color = stringToColor(email.sender?.email || '');
    const subject = email.headers?.subject || '(no subject)';
    const date = formatFullDate(email.internalDate);
    const body = email.body?.html || email.body?.plain || email.snippet || '';

    // Update star button
    elements.emailStarBtn.classList.toggle('starred', email.isStarred);
    if (email.isStarred) {
        elements.emailStarBtn.querySelector('svg').style.fill = 'var(--warning)';
    } else {
        elements.emailStarBtn.querySelector('svg').style.fill = 'none';
    }

    elements.emailContent.innerHTML = `
    <div class="email-view-header">
      <h2 class="email-view-subject">${escapeHtml(subject)}</h2>
      <div class="email-view-meta">
        <div class="email-view-avatar" style="background: ${color}">${initials}</div>
        <div class="email-view-info">
          <div class="email-view-sender">${escapeHtml(email.sender?.name || 'Unknown')}</div>
          <div class="email-view-email">${escapeHtml(email.sender?.email || '')}</div>
          <div class="email-view-date">${date}</div>
        </div>
      </div>
    </div>
    <div class="email-view-body">${body}</div>
  `;
}

/**
 * Close email view
 */
function closeEmailView() {
    elements.emailViewModal.classList.add('hidden');
    state.currentEmail = null;

    // Re-render list to reflect any changes
    renderEmailList();
}

/**
 * Handle star current email
 */
async function handleStarCurrentEmail() {
    if (!state.currentEmail) return;

    try {
        await sendMessage('toggleStar', {
            id: state.currentEmail.id,
            isStarred: state.currentEmail.isStarred
        });

        state.currentEmail.isStarred = !state.currentEmail.isStarred;

        // Update local email list
        const email = state.emails.find(e => e.id === state.currentEmail.id);
        if (email) email.isStarred = state.currentEmail.isStarred;

        // Update UI
        elements.emailStarBtn.classList.toggle('starred');
        const svg = elements.emailStarBtn.querySelector('svg');
        svg.style.fill = state.currentEmail.isStarred ? 'var(--warning)' : 'none';

        showToast(state.currentEmail.isStarred ? 'Email starred' : 'Star removed');
    } catch (error) {
        console.error('Failed to toggle star:', error);
        showToast('Failed to update star', 'error');
    }
}

/**
 * Handle delete current email
 */
async function handleDeleteCurrentEmail() {
    if (!state.currentEmail) return;

    try {
        await sendMessage('trashMessage', { id: state.currentEmail.id });

        // Remove from local list
        state.emails = state.emails.filter(e => e.id !== state.currentEmail.id);

        closeEmailView();
        renderEmailList();
        showToast('Email moved to trash');
    } catch (error) {
        console.error('Failed to delete:', error);
        showToast('Failed to delete email', 'error');
    }
}

/**
 * Handle toggle star from list
 */
async function handleToggleStar(id, isCurrentlyStarred) {
    try {
        await sendMessage('toggleStar', { id, isStarred: isCurrentlyStarred });

        // Update local state
        const email = state.emails.find(e => e.id === id);
        if (email) {
            email.isStarred = !isCurrentlyStarred;
        }

        // Update UI
        const starBtn = elements.emailList.querySelector(`.email-star[data-id="${id}"]`);
        if (starBtn) {
            starBtn.classList.toggle('starred');
            starBtn.dataset.starred = (!isCurrentlyStarred).toString();
        }
    } catch (error) {
        console.error('Failed to toggle star:', error);
        showToast('Failed to update star', 'error');
    }
}

/**
 * Open compose modal
 */
function openCompose(mode = 'new') {
    state.composeMode = mode;

    // Reset form
    elements.composeForm.reset();

    if (mode === 'new') {
        elements.composeTitle.textContent = 'New Message';
        elements.composeTo.value = '';
        elements.composeSubject.value = '';
        elements.composeBody.value = '';
        state.replyToMessage = null;
    } else if (mode === 'reply' && state.currentEmail) {
        elements.composeTitle.textContent = 'Reply';
        elements.composeTo.value = state.currentEmail.sender?.email || '';

        const subject = state.currentEmail.headers?.subject || '';
        elements.composeSubject.value = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        elements.composeBody.value = '';
        state.replyToMessage = state.currentEmail;
    } else if (mode === 'forward' && state.currentEmail) {
        elements.composeTitle.textContent = 'Forward';
        elements.composeTo.value = '';

        const subject = state.currentEmail.headers?.subject || '';
        elements.composeSubject.value = subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`;
        elements.composeBody.value = '';
        state.replyToMessage = state.currentEmail;
    }

    elements.composeModal.classList.remove('hidden');
    elements.composeTo.focus();
}

/**
 * Close compose modal
 */
function closeCompose() {
    elements.composeModal.classList.add('hidden');
    state.composeMode = null;
    state.replyToMessage = null;
}

/**
 * Handle send email
 */
async function handleSend(e) {
    e.preventDefault();

    const to = elements.composeTo.value.trim();
    const subject = elements.composeSubject.value.trim();
    const body = elements.composeBody.value.trim();

    if (!to || !body) {
        showToast('Please fill in recipient and message', 'error');
        return;
    }

    elements.composeSendBtn.disabled = true;
    elements.composeSendBtn.innerHTML = `
    <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
    Sending...
  `;

    try {
        if (state.composeMode === 'reply' && state.replyToMessage) {
            await sendMessage('replyToMessage', {
                messageId: state.replyToMessage.id,
                body
            });
        } else if (state.composeMode === 'forward' && state.replyToMessage) {
            await sendMessage('forwardMessage', {
                messageId: state.replyToMessage.id,
                to,
                body
            });
        } else {
            await sendMessage('sendMessage', { to, subject, body });
        }

        closeCompose();
        showToast('Email sent successfully', 'success');

        // Refresh emails if viewing sent
        if (state.currentFilter === 'sent') {
            await loadEmails();
        }
    } catch (error) {
        console.error('Failed to send:', error);
        showToast('Failed to send email', 'error');
    } finally {
        elements.composeSendBtn.disabled = false;
        elements.composeSendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Send
    `;
    }
}

/**
 * Show settings panel
 */
function showSettings() {
    // Update UI with current settings
    elements.themeSelect.value = state.settings.theme;
    elements.notificationsToggle.checked = state.settings.notificationsEnabled;
    elements.refreshIntervalSelect.value = state.settings.refreshInterval.toString();

    // Update account info
    if (state.profile) {
        elements.accountEmail.textContent = state.profile.emailAddress;
        elements.accountAvatar.textContent = getInitials(state.profile.emailAddress.split('@')[0]);
    }

    elements.settingsPanel.classList.remove('hidden');
}

/**
 * Hide settings panel
 */
function hideSettings() {
    elements.settingsPanel.classList.add('hidden');
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const settings = await sendMessage('getSettings');
        state.settings = {
            theme: settings.theme || 'system',
            refreshInterval: settings.refreshInterval || 5,
            notificationsEnabled: settings.notificationsEnabled !== false
        };
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Save settings
 */
async function saveSettings() {
    try {
        await sendMessage('saveSettings', state.settings);
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

/**
 * Handle theme change
 */
function handleThemeChange(e) {
    state.settings.theme = e.target.value;
    applyTheme();
    saveSettings();
}

/**
 * Handle notifications toggle
 */
function handleNotificationsChange(e) {
    state.settings.notificationsEnabled = e.target.checked;
    saveSettings();
}

/**
 * Handle refresh interval change
 */
function handleRefreshIntervalChange(e) {
    state.settings.refreshInterval = parseInt(e.target.value);
    saveSettings();
}

/**
 * Apply theme
 */
function applyTheme() {
    const { theme } = state.settings;

    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

/**
 * Show UI screens
 */
function showLoadingScreen() {
    elements.loadingScreen.classList.remove('hidden');
    elements.authScreen.classList.add('hidden');
    elements.mainApp.classList.add('hidden');
}

function showAuthScreen() {
    elements.loadingScreen.classList.add('hidden');
    elements.authScreen.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
}

function showMainApp() {
    elements.loadingScreen.classList.add('hidden');
    elements.authScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') {
        applyTheme();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', init);
