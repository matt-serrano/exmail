/**
 * ExMail - Utility Functions
 * Helper functions for email encoding, parsing, and formatting
 */

/**
 * Encode a string to base64url format (RFC 4648)
 * @param {string} str - String to encode
 * @returns {string} Base64url encoded string
 */
export function base64Encode(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a base64url encoded string
 * @param {string} str - Base64url encoded string
 * @returns {string} Decoded string
 */
export function base64Decode(str) {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Create a MIME formatted email message
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email body (plain text)
 * @param {string} [options.from] - Sender email address
 * @param {string} [options.inReplyTo] - Message-ID for replies
 * @param {string} [options.references] - References header for threading
 * @returns {string} Base64url encoded MIME message
 */
export function createMimeMessage({ to, subject, body, from, inReplyTo, references }) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;
  
  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`
  ];
  
  if (from) {
    headers.unshift(`From: ${from}`);
  }
  
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  
  if (references) {
    headers.push(`References: ${references}`);
  }
  
  const message = headers.join('\r\n') + '\r\n\r\n' + body;
  return base64Encode(message);
}

/**
 * Parse email headers from Gmail API payload
 * @param {Object} payload - Gmail message payload
 * @returns {Object} Parsed headers
 */
export function parseEmailHeaders(payload) {
  const headers = {};
  const headerNames = ['From', 'To', 'Subject', 'Date', 'Message-ID', 'References', 'In-Reply-To'];
  
  if (payload.headers) {
    for (const header of payload.headers) {
      if (headerNames.includes(header.name)) {
        headers[header.name.toLowerCase()] = header.value;
      }
    }
  }
  
  return headers;
}

/**
 * Extract email body from Gmail API payload
 * @param {Object} payload - Gmail message payload
 * @returns {Object} Email body with html and plain text
 */
export function extractEmailBody(payload) {
  const result = { html: '', plain: '' };
  
  function processPayload(part) {
    if (part.body && part.body.data) {
      const decoded = base64Decode(part.body.data);
      
      if (part.mimeType === 'text/html') {
        result.html = decoded;
      } else if (part.mimeType === 'text/plain') {
        result.plain = decoded;
      }
    }
    
    if (part.parts) {
      for (const subpart of part.parts) {
        processPayload(subpart);
      }
    }
  }
  
  processPayload(payload);
  
  // If no HTML, convert plain text to HTML
  if (!result.html && result.plain) {
    result.html = result.plain
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
  
  return result;
}

/**
 * Extract sender name and email from From header
 * @param {string} from - From header value
 * @returns {Object} Sender name and email
 */
export function parseSender(from) {
  if (!from) return { name: 'Unknown', email: '' };
  
  const match = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1] || match[2].split('@')[0],
      email: match[2]
    };
  }
  
  return { name: from, email: from };
}

/**
 * Format a timestamp to a human-readable date
 * @param {number|string} timestamp - Unix timestamp or date string
 * @returns {string} Formatted date
 */
export function formatDate(timestamp) {
  const date = new Date(typeof timestamp === 'string' ? timestamp : parseInt(timestamp));
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    // This week - show day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (date.getFullYear() === now.getFullYear()) {
    // This year - show month and day
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // Different year
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric' 
    });
  }
}

/**
 * Format a full date for email view
 * @param {number|string} timestamp - Unix timestamp or date string
 * @returns {string} Full formatted date
 */
export function formatFullDate(timestamp) {
  const date = new Date(typeof timestamp === 'string' ? timestamp : parseInt(timestamp));
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Get initials from a name for avatar
 * @param {string} name - Person's name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate a consistent color from a string (for avatars)
 * @param {string} str - String to generate color from
 * @returns {string} HSL color string
 */
export function stringToColor(str) {
  if (!str) return 'hsl(0, 0%, 50%)';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
