# Google OAuth Scopes for Google Workspace Agent

Use these scopes when generating a refresh token in [OAuth Playground](https://developers.google.com/oauthplayground).

## All Required Scopes

```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/presentations
```

## Scopes by Service

### Gmail (6 tools: send, draft, search, list, get, delete)
```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.send
```

### Calendar (5 tools: create, list, update, delete, find slots)
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

### Drive (7 tools: list, search, upload, download, share, create folder, delete)
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
```

### Docs (3 tools: create, get, update)
```
https://www.googleapis.com/auth/documents
```

### Sheets (4 tools: create, get, update, append)
```
https://www.googleapis.com/auth/spreadsheets
```

### Slides (2 tools: create, get)
```
https://www.googleapis.com/auth/presentations
```

## Quick Setup Steps

1. Go to [OAuth Playground](https://developers.google.com/oauthplayground)
2. Click ⚙️ (Settings) → Check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In the left panel, find and select each scope listed above under:
   - **Gmail API v1**
   - **Google Calendar API v3**
   - **Google Drive API v3**
   - **Google Docs API v1**
   - **Google Sheets API v4**
   - **Google Slides API v1**
5. Click "Authorize APIs" → Sign in
6. Click "Exchange authorization code for tokens"
7. Copy the Refresh Token to your `.env.local`:
   ```
   GOOGLE_REFRESH_TOKEN=1//your-new-refresh-token
   ```

## Preventing Token Expiration

If your tokens expire every 7 days, your Google Cloud project is in "Testing" mode.

To fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → OAuth consent screen**
3. Click **"Publish App"** to move to Production mode

Production refresh tokens don't expire unless unused for 6 months.
