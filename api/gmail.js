/**
 * ExMail - Gmail API Module
 * Abstraction layer for Gmail API operations
 */

import { createMimeMessage, parseEmailHeaders, extractEmailBody, parseSender, base64Encode } from './utils.js';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Gmail API client class
 */
class GmailAPI {
    constructor() {
        this.accessToken = null;
    }

    /**
     * Set the access token for API calls
     * @param {string} token - OAuth access token
     */
    setAccessToken(token) {
        this.accessToken = token;
    }

    /**
     * Make an authenticated API request
     * @param {string} endpoint - API endpoint (relative to base)
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} API response
     */
    async request(endpoint, options = {}) {
        if (!this.accessToken) {
            throw new Error('No access token available. Please sign in.');
        }

        const url = `${GMAIL_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw new Error('AUTH_EXPIRED');
            }

            throw new Error(error.error?.message || `API Error: ${response.status}`);
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    /**
     * Get user's Gmail profile
     * @returns {Promise<Object>} User profile
     */
    async getProfile() {
        return this.request('/profile');
    }

    /**
     * List messages with optional filter
     * @param {Object} options - List options
     * @param {string} [options.filter='inbox'] - Filter type: inbox, unread, starred, sent
     * @param {number} [options.maxResults=20] - Maximum results to return
     * @param {string} [options.pageToken] - Page token for pagination
     * @param {string} [options.q] - Custom query string
     * @returns {Promise<Object>} Messages list with pagination
     */
    async listMessages({ filter = 'inbox', maxResults = 20, pageToken, q } = {}) {
        const params = new URLSearchParams();
        params.set('maxResults', maxResults.toString());

        if (pageToken) {
            params.set('pageToken', pageToken);
        }

        // Build query based on filter
        let query = q || '';

        switch (filter) {
            case 'inbox':
                params.set('labelIds', 'INBOX');
                break;
            case 'unread':
                params.set('labelIds', 'INBOX');
                query = 'is:unread ' + query;
                break;
            case 'starred':
                params.set('labelIds', 'STARRED');
                break;
            case 'sent':
                params.set('labelIds', 'SENT');
                break;
            default:
                params.set('labelIds', 'INBOX');
        }

        if (query.trim()) {
            params.set('q', query.trim());
        }

        const response = await this.request(`/messages?${params.toString()}`);

        // Fetch details for each message
        const messages = response.messages || [];
        const detailedMessages = await Promise.all(
            messages.map(msg => this.getMessage(msg.id, 'metadata'))
        );

        return {
            messages: detailedMessages,
            nextPageToken: response.nextPageToken,
            resultSizeEstimate: response.resultSizeEstimate
        };
    }

    /**
     * Get a specific message
     * @param {string} id - Message ID
     * @param {string} [format='full'] - Format: full, metadata, minimal
     * @returns {Promise<Object>} Message details
     */
    async getMessage(id, format = 'full') {
        const params = new URLSearchParams({ format });
        const response = await this.request(`/messages/${id}?${params.toString()}`);

        // Parse the message into a more usable format
        const headers = parseEmailHeaders(response.payload || {});
        const sender = parseSender(headers.from);

        const parsed = {
            id: response.id,
            threadId: response.threadId,
            labelIds: response.labelIds || [],
            snippet: response.snippet,
            internalDate: response.internalDate,
            headers,
            sender,
            isUnread: response.labelIds?.includes('UNREAD'),
            isStarred: response.labelIds?.includes('STARRED'),
            isInbox: response.labelIds?.includes('INBOX')
        };

        // Include body for full format
        if (format === 'full' && response.payload) {
            parsed.body = extractEmailBody(response.payload);
        }

        return parsed;
    }

    /**
     * Send a new email
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email
     * @param {string} options.subject - Email subject
     * @param {string} options.body - Email body
     * @param {string} [options.threadId] - Thread ID for replies
     * @param {string} [options.inReplyTo] - Message-ID for replies
     * @param {string} [options.references] - References header
     * @returns {Promise<Object>} Sent message
     */
    async sendMessage({ to, subject, body, threadId, inReplyTo, references }) {
        const raw = createMimeMessage({ to, subject, body, inReplyTo, references });

        const payload = { raw };
        if (threadId) {
            payload.threadId = threadId;
        }

        return this.request('/messages/send', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    /**
     * Reply to an existing message
     * @param {string} messageId - Original message ID
     * @param {string} body - Reply body
     * @returns {Promise<Object>} Sent reply
     */
    async replyToMessage(messageId, body) {
        // First get the original message
        const original = await this.getMessage(messageId, 'full');

        const subject = original.headers.subject?.startsWith('Re:')
            ? original.headers.subject
            : `Re: ${original.headers.subject || ''}`;

        // Reply to the sender
        const to = original.headers.from;

        return this.sendMessage({
            to,
            subject,
            body,
            threadId: original.threadId,
            inReplyTo: original.headers['message-id'],
            references: original.headers.references
                ? `${original.headers.references} ${original.headers['message-id']}`
                : original.headers['message-id']
        });
    }

    /**
     * Forward a message
     * @param {string} messageId - Original message ID
     * @param {string} to - Forward to email
     * @param {string} [additionalBody=''] - Additional message to include
     * @returns {Promise<Object>} Sent forward
     */
    async forwardMessage(messageId, to, additionalBody = '') {
        const original = await this.getMessage(messageId, 'full');

        const subject = original.headers.subject?.startsWith('Fwd:')
            ? original.headers.subject
            : `Fwd: ${original.headers.subject || ''}`;

        // Build forwarded message body
        const originalBody = original.body?.plain || original.snippet || '';
        const forwardedContent = `
${additionalBody}

---------- Forwarded message ---------
From: ${original.headers.from}
Date: ${original.headers.date}
Subject: ${original.headers.subject}
To: ${original.headers.to}

${originalBody}
    `.trim();

        return this.sendMessage({
            to,
            subject,
            body: forwardedContent
        });
    }

    /**
     * Move a message to trash
     * @param {string} id - Message ID
     * @returns {Promise<Object>} Updated message
     */
    async trashMessage(id) {
        return this.request(`/messages/${id}/trash`, {
            method: 'POST'
        });
    }

    /**
     * Permanently delete a message
     * @param {string} id - Message ID
     * @returns {Promise<void>}
     */
    async deleteMessage(id) {
        return this.request(`/messages/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Modify message labels
     * @param {string} id - Message ID
     * @param {string[]} [addLabelIds=[]] - Labels to add
     * @param {string[]} [removeLabelIds=[]] - Labels to remove
     * @returns {Promise<Object>} Updated message
     */
    async modifyLabels(id, addLabelIds = [], removeLabelIds = []) {
        return this.request(`/messages/${id}/modify`, {
            method: 'POST',
            body: JSON.stringify({ addLabelIds, removeLabelIds })
        });
    }

    /**
     * Mark message as read
     * @param {string} id - Message ID
     * @returns {Promise<Object>} Updated message
     */
    async markAsRead(id) {
        return this.modifyLabels(id, [], ['UNREAD']);
    }

    /**
     * Mark message as unread
     * @param {string} id - Message ID
     * @returns {Promise<Object>} Updated message
     */
    async markAsUnread(id) {
        return this.modifyLabels(id, ['UNREAD'], []);
    }

    /**
     * Star a message
     * @param {string} id - Message ID
     * @returns {Promise<Object>} Updated message
     */
    async starMessage(id) {
        return this.modifyLabels(id, ['STARRED'], []);
    }

    /**
     * Unstar a message
     * @param {string} id - Message ID
     * @returns {Promise<Object>} Updated message
     */
    async unstarMessage(id) {
        return this.modifyLabels(id, [], ['STARRED']);
    }

    /**
     * Toggle star on a message
     * @param {string} id - Message ID
     * @param {boolean} isCurrentlyStarred - Current star state
     * @returns {Promise<Object>} Updated message
     */
    async toggleStar(id, isCurrentlyStarred) {
        return isCurrentlyStarred ? this.unstarMessage(id) : this.starMessage(id);
    }
}

// Export singleton instance
export const gmailAPI = new GmailAPI();
export default gmailAPI;
