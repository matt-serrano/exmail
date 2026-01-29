# ExMail - Gmail Without the Tab

<p align="center">
  <img src="icons/icon128.png" alt="ExMail Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Send, read, and manage your Gmail emails directly from your browser toolbar.</strong>
</p>

---

## ✨ Features

- **📧 Full Email Management** - Compose, send, reply, forward, and delete emails
- **🔍 Smart Filters** - Quick access to Inbox, Unread, and Starred messages
- **🔔 Real-time Notifications** - Get notified when new emails arrive
- **🌙 Dark Mode** - Beautiful light and dark themes with system preference support
- **🔒 Secure OAuth2** - Authenticate safely with your Google account
- **⚡ Fast & Lightweight** - No need to open Gmail in a new tab

---

## 📦 Installation

### Step 1: Download the Extension

Clone or download this repository to your local machine:

```bash
git clone https://github.com/yourusername/exmail.git
```

Or download as ZIP and extract it.

### Step 2: Configure Google Cloud Project

Before using ExMail, you need to set up OAuth2 credentials in Google Cloud Console.

#### 2.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "ExMail Extension") and click **Create**

#### 2.2 Enable the Gmail API

1. In your project, go to **APIs & Services** → **Library**
2. Search for **Gmail API**
3. Click on it and press **Enable**

#### 2.3 Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Fill in the required fields:
   - **App name**: ExMail
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
6. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
7. Click **Save and Continue**
8. Add your email as a test user (required for testing)
9. Complete the setup

#### 2.4 Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Chrome Extension** as the application type
4. Name it (e.g., "ExMail Chrome Extension")
5. Get your Extension ID:
   - Open Chrome and go to `chrome://extensions`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked** and select the `exmail` folder
   - Copy the **Extension ID** shown under the extension
6. Paste the Extension ID in the Google Cloud form
7. Click **Create**
8. Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`)

### Step 3: Add Client ID to Extension

1. Open `manifest.json` in the exmail folder
2. Find this line:
   ```json
   "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
   ```
3. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
4. Save the file

### Step 4: Reload the Extension

1. Go to `chrome://extensions`
2. Find ExMail and click the **Reload** button (circular arrow)
3. Click the ExMail icon in your toolbar
4. Click **Sign in with Google** and authorize the extension

---

## 🎮 Usage

### Viewing Emails

- Click the ExMail icon in your Chrome toolbar
- Your recent emails will load automatically
- Use the filter tabs to switch between **Inbox**, **Unread**, and **Starred**
- Click any email to view its full content

### Composing Emails

1. Click the **+** floating button in the bottom right
2. Fill in the recipient, subject, and message
3. Click **Send**

### Replying & Forwarding

1. Open an email by clicking on it
2. Use the action buttons in the header:
   - **↩️ Reply** - Reply to the sender
   - **↪️ Forward** - Forward to someone else

### Managing Emails

- **Star/Unstar**: Click the star icon on any email
- **Delete**: Open an email and click the trash icon
- **Mark as Read**: Emails are automatically marked as read when opened

### Settings

Click the gear icon to access settings:

- **Theme**: Choose Light, Dark, or System (follows OS preference)
- **Notifications**: Enable/disable new email notifications
- **Refresh Interval**: Set how often emails refresh (1-30 minutes)
- **Sign Out**: Log out of your Google account

---

## 🛠️ Technical Details

### Built With

- **Manifest V3** - Latest Chrome extension standard
- **Gmail API** - Official Google API for email
- **OAuth 2.0** - Secure authentication via `chrome.identity`
- **Vanilla JavaScript** - No heavy frameworks, fast and lightweight
- **CSS Custom Properties** - Theming with CSS variables

### Project Structure

```
exmail/
├── manifest.json         # Extension configuration
├── background.js         # Service worker for auth & API
├── api/
│   ├── gmail.js          # Gmail API abstraction
│   └── utils.js          # Helper utilities
├── popup/
│   ├── popup.html        # Main UI structure
│   ├── popup.css         # Styles with themes
│   └── popup.js          # UI controller
├── icons/                # Extension icons
└── README.md             # This file
```

### Permissions Explained

| Permission | Purpose |
|------------|---------|
| `identity` | Google OAuth authentication |
| `storage` | Save user preferences (theme, settings) |
| `alarms` | Schedule periodic email refresh |
| `notifications` | Show new email alerts |

### Gmail API Scopes

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read emails and metadata |
| `gmail.modify` | Star, delete, mark as read |
| `gmail.send` | Send new emails and replies |

---

## 🔧 Troubleshooting

### "Sign in failed" Error

1. Make sure you've added your email as a test user in Google Cloud
2. Verify the Client ID in `manifest.json` is correct
3. Check that the Extension ID matches what you entered in Google Cloud

### Extension Not Loading

1. Ensure Developer mode is enabled in `chrome://extensions`
2. Check for errors by clicking "Errors" button on the extension card
3. Verify all files are present in the folder

### Emails Not Loading

1. Click the refresh button
2. Check if you're signed in (Settings → Account section)
3. Re-authenticate by signing out and signing back in

### OAuth Errors

1. Go to Google Cloud Console → Credentials
2. Verify the Extension ID matches exactly
3. Make sure Gmail API is enabled
4. Check OAuth consent screen is configured

---

## 🔒 Privacy & Security

- ExMail only accesses emails when you explicitly request them
- No data is sent to external servers - all communication is directly with Google
- Your OAuth token is managed securely by Chrome
- No tracking or analytics are included

---

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<p align="center">
  Made with ❤️ for productivity
</p>
