# Third-Party Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing all third-party integrations in the Traeta application using Postman. Since you don't have a frontend, this guide will help you manually test the complete OAuth flow and data synchronization for each integration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Available Integrations](#available-integrations)
3. [Common Integration Flow](#common-integration-flow)
4. [Testing Each Integration](#testing-each-integration)
   - [Plaid (Banking)](#1-plaid-banking)
   - [Strava (Fitness)](#2-strava-fitness)
   - [Spotify (Music)](#3-spotify-music)
   - [Email Scraper (Gmail)](#4-email-scraper-gmail)
   - [Apple Music](#5-apple_music)
   - [Apple Health](#6-apple_health)
   - [Goodreads](#7-goodreads)
   - [Location Services](#8-location-services)
   - [Contact List](#9-contact-list)
5. [Complete Testing Workflow](#complete-testing-workflow-for-your-user)
6. [Connection Status Flows Summary](#connection-status-flows-summary)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Setup

1. **Start the User Service**

   ```bash
   cd user-service
   npm install
   npm run start:dev
   ```

   Server will run on: `http://localhost:3001`

2. **Verify Server is Running**
   ```
   GET http://localhost:3001
   ```

### Test User Information

- **User ID**: `0fb333c8-2d66-4106-bd1b-517ce6e72712`
- **Base URL**: `http://localhost:3001`

### Environment Variables

Ensure your `.env` file has all required credentials configured. The server already has the following integrations configured:

- ✅ Plaid (Sandbox mode)
- ✅ Strava
- ✅ Spotify
- ✅ Gmail/Email Scraper
- ✅ Apple Music (Mock mode enabled)
- ✅ Apple Health

---

## Available Integrations

| Integration       | Provider Name       | OAuth Type         | Data Categories       |
| ----------------- | ------------------- | ------------------ | --------------------- |
| Plaid             | `plaid`             | Link Token         | Banking, Transactions |
| Strava            | `strava`            | OAuth 2.0          | Fitness Activities    |
| Spotify           | `spotify`           | OAuth 2.0          | Music, Playlists      |
| Email Scraper     | `gmail_scraper`     | OAuth 2.0 (Google) | Emails, Travel, Food  |
| Apple Music       | `apple_music`       | MusicKit           | Music Library         |
| Apple Health      | `apple_health`      | Upload Token       | Health Data           |
| Goodreads         | `goodreads`         | OAuth 1.0          | Books, Reading        |
| Location Services | `location_services` | Upload Token       | GPS, Location         |
| Contact List      | `contact_list`      | Upload Token       | Contacts              |

---

## Common Integration Flow

All OAuth-based integrations follow this pattern:

```
1. Connect → Get redirectUrl or linkToken
2. Authorize → User authorizes in browser
3. Callback → Exchange code for tokens
4. Sync → Fetch and store user data
5. Status → Check connection status
```

### Standard Endpoints

For any `{provider}`:

1. **Connect**: `POST /integrations/{provider}/connect`
2. **Callback**: `GET/POST /integrations/{provider}/callback`
3. **Sync**: `POST /integrations/{provider}/sync`
4. **Status**: `GET /integrations/{provider}/status?userId={userId}`
5. **Config**: `GET /integrations/{provider}/config?userId={userId}`

---

## Testing Each Integration

## 1. Plaid (Banking)

### Step 1: Create Connection

**Request:**

```http
POST http://localhost:3001/integrations/plaid/connect
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Response:**

```json
{
  "linkToken": "link-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "state": "plaid-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

### Step 2: Open Plaid Link (Browser)

Since you don't have a frontend, you'll need to:

1. **Option A - Use Plaid's Test Page:**
   - Go to: https://plaid.com/docs/link/test-mode/
   - Paste your `linkToken`
   - Complete the flow
   - Copy the `public_token` from the result

2. **Option B - Use Postman's Visualizer:**
   - Create a new request in Postman
   - Use the following Pre-request Script:
   ```javascript
   // This will open Plaid Link in a new window
   const linkToken = pm.response.json().linkToken;
   console.log("Link Token:", linkToken);
   ```

### Step 3: Exchange Public Token

**Request:**

```http
POST http://localhost:3001/integrations/plaid/callback
Content-Type: application/json

{
  "public_token": "public-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "state": "plaid-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

**Response:**

```json
{
  "ok": true,
  "isConnected": true,
  "message": "Integration connected and data synced successfully",
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "integration": {
      "provider": "plaid",
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "accounts": [...],
      "transactions": [...]
    }
  }
}
```

### Step 4: Manual Sync (Optional)

**Request:**

```http
POST http://localhost:3001/integrations/plaid/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 5: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/plaid/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before OAuth flow):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful OAuth and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "institutionName": "Chase",
    "accountsCount": 2
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. User needs to complete Steps 1-3 (Connect → Authorize → Callback)
3. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/plaid/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest data from Plaid API
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/plaid/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Banking": [...],
        "Travel": [...],
        "Food": [...]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/plaid/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat OAuth flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

---

## 2. Strava (Fitness)

### Step 1: Create Connection

**Request:**

```http
POST http://localhost:3001/integrations/strava/connect
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Response:**

```json
{
  "redirectUrl": "https://www.strava.com/oauth/authorize?client_id=179301&redirect_uri=http://127.0.0.1:3000/api/integrations/strava/callback&response_type=code&scope=read,activity:read_all&state=strava-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "state": "strava-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

### Step 2: Authorize in Browser

1. Copy the `redirectUrl` from the response
2. Paste it in your browser
3. Log in to Strava (or create a test account)
4. Click "Authorize"
5. You'll be redirected to: `http://127.0.0.1:3000/api/integrations/strava/callback?state=...&code=...&scope=...`
6. Copy the `code` parameter from the URL

### Step 3: Complete Callback

**Request:**

```http
POST http://localhost:3001/integrations/strava/callback
Content-Type: application/json

{
  "code": "COPIED_CODE_HERE",
  "state": "strava-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

**Response:**

```json
{
  "ok": true,
  "isConnected": true,
  "message": "Integration connected and data synced successfully",
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
      "firstName": "John",
      "lastName": "Doe"
    },
    "integration": {
      "provider": "strava",
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "Fitness": [
        {
          "activityId": "12345678",
          "name": "Morning Run",
          "type": "Run",
          "distance": 5000,
          "duration": 1800,
          "startDate": "2024-01-15T07:00:00Z"
        }
      ]
    }
  }
}
```

### Step 4: Manual Sync

**Request:**

```http
POST http://localhost:3001/integrations/strava/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 5: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/strava/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before OAuth flow):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful OAuth and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "athleteId": "12345678",
    "athleteName": "John Doe",
    "activitiesCount": 25
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. User needs to complete Steps 1-3 (Connect → Authorize in Browser → Callback)
3. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/strava/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest activities from Strava API
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/strava/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Fitness": [
          {
            "activityId": "12345678",
            "name": "Morning Run",
            "type": "Run",
            "distance": 5000,
            "duration": 1800,
            "startDate": "2024-01-15T07:00:00Z"
          }
        ]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/strava/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat OAuth flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

---

## 3. Spotify (Music)

### Step 1: Create Connection

**Request:**

```http
POST http://localhost:3001/integrations/spotify/connect
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Response:**

```json
{
  "redirectUrl": "https://accounts.spotify.com/authorize?client_id=9f05cdbee1b44e398bddb32a222c87ef&redirect_uri=http://127.0.0.1:3000/integrations/spotify/callback&response_type=code&scope=user-read-recently-played%20user-library-read%20playlist-read-private%20user-top-read&state=spotify-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "state": "spotify-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

### Step 2: Authorize in Browser

1. Copy the `redirectUrl`
2. Open in browser
3. Log in to Spotify
4. Click "Agree"
5. Copy the `code` from the redirect URL

### Step 3: Complete Callback

**Request:**

```http
POST http://localhost:3001/integrations/spotify/callback
Content-Type: application/json

{
  "code": "COPIED_CODE_HERE",
  "state": "spotify-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

**Response:**

```json
{
  "ok": true,
  "isConnected": true,
  "message": "Integration connected successfully"
}
```

### Step 4: Manual Sync

**Request:**

```http
POST http://localhost:3001/integrations/spotify/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 5: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/spotify/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before OAuth flow):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful OAuth and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "userId": "spotify_user_123",
    "displayName": "John Doe",
    "tracksCount": 150
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. User needs to complete Steps 1-3 (Connect → Authorize in Browser → Callback)
3. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/spotify/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest tracks, playlists from Spotify API
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/spotify/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Music": [
          {
            "trackId": "spotify:track:xxxxx",
            "trackName": "Song Name",
            "artistName": "Artist Name",
            "playedAt": "2024-01-15T09:00:00Z"
          }
        ]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/spotify/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat OAuth flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

---

## 4. Email Scraper (Gmail)

The Email Scraper uses the Google Gmail API to fetch metadata from your inbox to identify travel, food, and shopping transactions.

### Flow A: Metadata Flow (Default & Recommended)

This flow uses the `https://www.googleapis.com/auth/gmail.metadata` scope, which only allows access to email headers (From, To, Subject, Date) and labels. It is more privacy-focused and does not allow reading the full body of emails.

#### Step 1: Create Connection

**Request:**

```http
POST http://localhost:3001/integrations/gmail_scraper/connect
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Response:**

```json
{
  "provider": "gmail_scraper",
  "redirectUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&response_type=code&redirect_uri=...&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.metadata+openid+email+profile&access_type=offline&prompt=consent&state=email-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "state": "email-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

#### Step 2: Authorize in Browser

1. Copy the `redirectUrl`
2. Open in browser
3. Log in to Google
4. Grant **Gmail Metadata** permissions
5. Copy the `code` from the redirect URL

#### Step 3: Complete Callback

**Request:**

```http
POST http://localhost:3001/integrations/gmail_scraper/callback
Content-Type: application/json

{
  "code": "COPIED_CODE_HERE",
  "state": "email-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

**Response:**

```json
{
  "ok": true,
  "isConnected": true,
  "message": "Gmail sync started. You may proceed with other integrations"
}
```

*Note: The sync happens in the background. You can check the status to see when it's finished.*

---

### Flow B: Readonly Flow (Backup/Scraping Flow)

This flow uses the `https://www.googleapis.com/auth/gmail.readonly` scope, which allows full access to read email content. This is kept as a backup flow for deeper scraping if required.

**Important:** The current production code is configured to enforce the `metadata` scope for privacy compliance. If you attempt to connect using `readonly` scope, the server will reject it with a `Permissions mismatched` error unless specifically reconfigured.

#### Step 1: Create Connection (Manual Override)

To test this flow, you would manually initiate the OAuth flow with the `readonly` scope:
`scope=https://www.googleapis.com/auth/gmail.readonly`

#### Step 2: Complete Callback

If the server were configured to accept `readonly`, the response would include full user data sync details:

**Expected Response (If enabled):**

```json
{
  "ok": true,
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "provider": "gmail_scraper",
  "syncedAt": "2024-01-15T10:30:00.000Z",
  "userData": {
    "categories": {
      "Travel": [...],
      "Food": [...],
      "Shopping": [...],
      "Events": [...]
    }
  }
}
```

---

### Step 4: Manual Sync (Optional)

**Request:**

```http
POST http://localhost:3001/integrations/gmail_scraper/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 5: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/gmail_scraper/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before OAuth flow):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful OAuth and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "emailAddress": "user@gmail.com",
    "emailsScanned": 500,
    "categoriesFound": ["Travel", "Food", "Shopping", "Events"]
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. User needs to complete Steps 1-3 (Connect → Authorize in Browser → Callback)
3. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/gmail_scraper/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest emails from Gmail API
- Scrapes and categorizes data (Travel, Food, Shopping, Events)
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/gmail_scraper/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Travel": [...],
        "Food": [...],
        "Shopping": [...],
        "Events": [...]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/gmail_scraper/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat OAuth flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

---

## 5. Apple Music

**Note:** Apple Music is currently running in **MOCK MODE** (`APPLE_MUSIC_USE_MOCK_DATA=true`), which means it will return sample data without requiring a real Apple Music subscription.

### Step 1: Get Configuration

**Request:**

```http
GET http://localhost:3001/integrations/apple_music/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response:**

```json
{
  "teamId": "5MD3M5T2UA",
  "keyId": "CF694L2VT9",
  "developerToken": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkNGNjk0TDJWVDkifQ...",
  "uploadToken": "apple_music-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "mockMode": true
}
```

### Step 2: Simulate Authorization (Mock Mode)

**Request:**

```http
POST http://localhost:3001/integrations/apple_music/callback
Content-Type: application/json

{
  "music_user_token": "mock-music-user-token-12345",
  "state": "apple_music-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

**Response:**

```json
{
  "ok": true,
  "isConnected": true,
  "message": "Integration connected and data synced successfully",
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
      "firstName": "John",
      "lastName": "Doe"
    },
    "integration": {
      "provider": "apple_music",
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "Music": [
        {
          "trackId": "mock-track-1",
          "trackName": "Sample Song 1",
          "artistName": "Sample Artist",
          "playedAt": "2024-01-15T09:00:00Z"
        }
      ]
    }
  }
}
```

### Step 3: Manual Sync

**Request:**

```http
POST http://localhost:3001/integrations/apple_music/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 4: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/apple_music/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before authorization):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful authorization and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "mockMode": true,
    "tracksCount": 50,
    "playlistsCount": 10
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. Get config (Step 1)
3. Simulate authorization with callback (Step 2)
4. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/apple_music/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest music library from Apple Music API (or mock data)
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/apple_music/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Music": [
          {
            "trackId": "apple:track:xxxxx",
            "trackName": "Song Name",
            "artistName": "Artist Name",
            "albumName": "Album Name"
          }
        ]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/apple_music/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat authorization flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

**Note:** In mock mode, the authorization is simulated and doesn't require real Apple Music credentials.

---

## 6. Apple Health

Apple Health uses an upload token system since data comes directly from iOS devices.

### Step 1: Get Configuration

**Request:**

```http
GET http://localhost:3001/integrations/apple_health/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response:**

```json
{
  "uploadToken": "apple_health-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "uploadEndpoint": "/integrations/apple_health/upload"
}
```

### Step 2: Upload Health Data

**Request:**

```http
POST http://localhost:3001/integrations/apple_health/upload
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "uploadToken": "apple_health-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "healthData": {
    "workouts": [
      {
        "workoutType": "Running",
        "startDate": "2024-01-15T07:00:00Z",
        "endDate": "2024-01-15T07:30:00Z",
        "duration": 1800,
        "distance": 5000,
        "calories": 300
      }
    ],
    "steps": [
      {
        "date": "2024-01-15",
        "count": 10000
      }
    ],
    "heartRate": [
      {
        "timestamp": "2024-01-15T07:15:00Z",
        "bpm": 145
      }
    ]
  }
}
```

**Response:**

```json
{
  "ok": true,
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "provider": "apple_health",
  "syncedAt": "2024-01-15T10:30:00.000Z",
  "userData": {
    "categories": {
      "Health": [...],
      "Fitness": [...]
    }
  }
}
```

### Step 3: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/apple_health/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before data upload):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful data upload):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "workoutsCount": 15,
    "stepsRecordsCount": 30,
    "heartRateRecordsCount": 100
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. Get config to obtain upload token (Step 1)
3. Upload health data (Step 2)
4. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch cached health data:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/apple_health/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- For Apple Health, this fetches the latest uploaded data from database
- Returns comprehensive user data
- Time: 100-500ms
- Use case: User clicks "Refresh", First load

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/apple_health/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Health": [
          {
            "type": "workout",
            "activityType": "Running",
            "duration": 1800,
            "calories": 250,
            "startDate": "2024-01-15T07:00:00Z"
          }
        ]
      }
    }
  }
}
```

**To Upload New Health Data:**

You can still upload new health data using the upload token:

```http
POST http://localhost:3001/integrations/apple_health/callback
Content-Type: application/json

{
  "uploadToken": "apple_health-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "healthData": {
    "workouts": [...],
    "steps": [...],
    "heartRate": [...]
  }
}
```

**Summary:**

- ✅ Use `/data` endpoint to fetch health data
- ✅ Use `forceSync=true` for latest uploaded data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Upload new data using the upload token endpoint
- ✅ Automatic deduplication handled by database

**Note:** Apple Health uses an upload token system instead of OAuth, as data comes directly from iOS devices.

---

## 7. Goodreads

### Step 1: Create Connection

**Request:**

```http
POST http://localhost:3001/integrations/goodreads/connect
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Response:**

```json
{
  "redirectUrl": "https://www.goodreads.com/oauth/authorize?oauth_token=xxxxx",
  "state": "goodreads-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

### Step 2: Authorize in Browser

1. Copy the `redirectUrl` from the response
2. Paste it in your browser
3. Log in to Goodreads
4. Click "Allow"
5. Copy the `oauth_token` and `oauth_verifier` from the redirect URL

### Step 3: Complete Callback

**Request:**

```http
GET http://localhost:3001/integrations/goodreads/callback?oauth_token=COPIED_TOKEN&oauth_verifier=COPIED_VERIFIER&state=goodreads-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890
```

**Response:**

```json
{
  "ok": true,
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "provider": "goodreads",
  "syncedAt": "2024-01-15T10:30:00.000Z",
  "userData": {
    "categories": {
      "Books": [
        {
          "bookId": "12345",
          "title": "Book Title",
          "author": "Author Name",
          "status": "read",
          "rating": 5
        }
      ]
    }
  }
}
```

### Step 4: Manual Sync

**Request:**

```http
POST http://localhost:3001/integrations/goodreads/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

### Step 5: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/goodreads/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before OAuth flow):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful OAuth and sync):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "userId": "goodreads_user_123",
    "userName": "John Doe",
    "booksCount": 45
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. User needs to complete Steps 1-3 (Connect → Authorize in Browser → Callback)
3. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch and sync data automatically:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/goodreads/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches latest books, shelves from Goodreads API
- Syncs to database (automatic deduplication)
- Returns comprehensive user data
- Time: 2-15 seconds
- Use case: User clicks "Refresh", First load, Latest data needed

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/goodreads/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Skips API call
- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Books": [
          {
            "bookId": "12345",
            "title": "Book Title",
            "author": "Author Name",
            "shelf": "currently-reading",
            "rating": 4
          }
        ]
      }
    }
  }
}
```

**Alternative: Manual Sync Endpoint**

You can still use the traditional sync endpoint:

```http
POST http://localhost:3001/integrations/goodreads/sync
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
}
```

**Summary:**

- ✅ No need to repeat OAuth flow
- ✅ Use `/data` endpoint for automatic fetch + sync
- ✅ Use `forceSync=true` for fresh data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Automatic deduplication handled by database

**Note:** Goodreads uses OAuth 1.0, which requires both `oauth_token` and `oauth_verifier` from the callback.

---

## 8. Location Services

### Step 1: Get Configuration

**Request:**

```http
GET http://localhost:3001/integrations/location_services/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response:**

```json
{
  "uploadToken": "location-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "uploadEndpoint": "/integrations/location_services/upload"
}
```

### Step 2: Upload Location Data

**Request:**

```http
POST http://localhost:3001/integrations/location_services/upload
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "uploadToken": "location-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "locationData": [
    {
      "timestamp": "2024-01-15T10:00:00Z",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 10
    },
    {
      "timestamp": "2024-01-15T11:00:00Z",
      "latitude": 37.7849,
      "longitude": -122.4094,
      "accuracy": 15
    }
  ]
}
```

**Response:**

```json
{
  "ok": true,
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "provider": "location_services",
  "syncedAt": "2024-01-15T10:30:00.000Z",
  "userData": {
    "categories": {
      "Location": [
        {
          "timestamp": "2024-01-15T10:00:00Z",
          "latitude": 37.7749,
          "longitude": -122.4194,
          "accuracy": 10
        }
      ]
    }
  }
}
```

### Step 3: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/location_services/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before data upload):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful data upload):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "locationPointsCount": 150,
    "lastLocationTimestamp": "2024-01-15T11:00:00Z"
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. Get config to obtain upload token (Step 1)
3. Upload location data (Step 2)
4. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected, you can use the `/data` endpoint to fetch cached location data:

**Option 1: Fresh Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/location_services/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- For Location Services, this fetches the latest uploaded data from database
- Returns comprehensive user data
- Time: 100-500ms
- Use case: User clicks "Refresh", First load

**Option 2: Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/location_services/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Fetches from database only
- Returns cached data
- Time: 100-300ms
- Use case: Dashboard load, Quick view

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z"
    },
    "syncedData": {
      "categories": {
        "Location": [
          {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "timestamp": "2024-01-15T10:00:00Z",
            "accuracy": 10
          }
        ]
      }
    }
  }
}
```

**To Upload New Location Data:**

You can still upload new location data using the upload token:

```http
POST http://localhost:3001/integrations/location_services/callback
Content-Type: application/json

{
  "uploadToken": "location_services-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "locationData": [
    {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "timestamp": "2024-01-15T10:00:00Z",
      "accuracy": 10
    }
  ]
}
```

**Summary:**

- ✅ Use `/data` endpoint to fetch location data
- ✅ Use `forceSync=true` for latest uploaded data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Upload new data using the upload token endpoint
- ✅ Automatic deduplication handled by database

**Note:** Location Services uses an upload token system as data comes directly from mobile devices.

---

## 9. Contact List

### Step 1: Get Configuration

**Request:**

```http
GET http://localhost:3001/integrations/contact_list/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response:**

```json
{
  "uploadToken": "contact-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "uploadEndpoint": "/integrations/contact_list/upload"
}
```

### Step 2: Upload Contacts

**Request:**

```http
POST http://localhost:3001/integrations/contact_list/upload
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "uploadToken": "contact-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "contacts": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+0987654321"
    }
  ]
}
```

**Response:**

```json
{
  "ok": true,
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "provider": "contact_list",
  "syncedAt": "2024-01-15T10:30:00.000Z",
  "userData": {
    "categories": {
      "Contacts": [
        {
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "+1234567890"
        }
      ]
    }
  }
}
```

### Step 3: Check Status

**Request:**

```http
GET http://localhost:3001/integrations/contact_list/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

**Response (connected=false - Before data upload):**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Response (connected=true - After successful data upload):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "contactsCount": 50,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

### Testing Flow Summary

**Flow 1: User Not Connected (connected=false)**

1. Check status → `connected: false`
2. Get config to obtain upload token (Step 1)
3. Upload contacts (Step 2)
4. Check status again → `connected: true`

**Flow 2: User Already Connected (connected=true)**

When a user is already connected (`connected: true`), you can fetch their contact data using the `/data` endpoint:

**Option 1: Fetch Latest Uploaded Data (forceSync=true)**

```http
GET http://localhost:3001/integrations/contact_list/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=true
```

- Fetches the latest uploaded contact data from the database
- Takes ~100-500ms
- Use when: User wants to see their current contacts

**Option 2: Fetch Cached Data (forceSync=false)**

```http
GET http://localhost:3001/integrations/contact_list/data?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712&forceSync=false
```

- Returns cached contact data from database
- Takes ~100-300ms
- Use when: Dashboard loads, quick views

**Response:**

```json
{
  "ok": true,
  "data": {
    "user": {
      "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"
    },
    "integration": {
      "connected": true,
      "lastSyncedAt": "2024-01-15T10:30:00.000Z",
      "details": {
        "contactsCount": 50,
        "lastUpdated": "2024-01-15T10:30:00.000Z"
      }
    },
    "syncedData": {
      "categories": {
        "Contacts": [
          {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+1234567890",
            "listItemId": "contact-123",
            "timestamp": "2024-01-15T10:30:00.000Z"
          },
          {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "+0987654321",
            "listItemId": "contact-456",
            "timestamp": "2024-01-15T10:30:00.000Z"
          }
        ]
      }
    }
  }
}
```

**To Upload New Contacts:**

You can also upload new contacts directly using the upload token:

```http
POST http://localhost:3001/integrations/contact_list/upload
Content-Type: application/json

{
  "userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712",
  "uploadToken": "contact-upload-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890",
  "contacts": [
    {
      "name": "New Contact",
      "email": "new@example.com",
      "phone": "+1122334455"
    }
  ]
}
```

**Summary:**

- ✅ Use `/data` endpoint to fetch contact data
- ✅ Use `forceSync=true` for latest uploaded data
- ✅ Use `forceSync=false` for fast cached data
- ✅ Upload new data using the upload token endpoint
- ✅ Automatic deduplication handled by database constraints

**Note:** Contact List uses an upload token system as data comes directly from mobile devices.

---

## Complete Testing Workflow for Your User

Here's the recommended order to test all integrations for user `0fb333c8-2d66-4106-bd1b-517ce6e72712`:

### 1. Test Plaid (Banking)

```http
POST http://localhost:3001/integrations/plaid/connect
Content-Type: application/json

{"userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"}
```

### 2. Test Strava (Fitness)

```http
POST http://localhost:3001/integrations/strava/connect
Content-Type: application/json

{"userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"}
```

### 3. Test Spotify (Music)

```http
POST http://localhost:3001/integrations/spotify/connect
Content-Type: application/json

{"userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"}
```

### 4. Test Email Scraper (Gmail)

```http
POST http://localhost:3001/integrations/gmail_scraper/connect
Content-Type: application/json

{"userId": "0fb333c8-2d66-4106-bd1b-517ce6e72712"}
```

### 5. Test Apple Music (Mock Mode)

```http
GET http://localhost:3001/integrations/apple_music/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

Then:

```http
POST http://localhost:3001/integrations/apple_music/callback
Content-Type: application/json

{
  "music_user_token": "mock-token-12345",
  "state": "apple_music-0fb333c8-2d66-4106-bd1b-517ce6e72712-1234567890"
}
```

### 6. Test Apple Health

```http
GET http://localhost:3001/integrations/apple_health/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

Then upload sample data using the upload endpoint.

---

## Connection Status Flows Summary

This section provides a comprehensive overview of the connection status flows for all third-party integrations, showing both `connected=false` and `connected=true` scenarios.

### OAuth-Based Integrations (Plaid, Strava, Spotify, Email Scraper, Goodreads)

#### When User is NOT Connected (connected=false)

**Status Check Response:**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Required Actions:**

1. Call `/connect` endpoint to initiate OAuth flow
2. User authorizes in browser
3. Call `/callback` endpoint with authorization code
4. System automatically syncs initial data
5. Status changes to `connected: true`

#### When User IS Connected (connected=true)

**Status Check Response Example (varies by provider):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    // Provider-specific details
  }
}
```

**Available Actions:**

1. Call `/sync` endpoint to refresh data (no re-authorization needed)
2. OAuth tokens are automatically refreshed when expired
3. Can check status anytime to verify connection

---

### Upload Token-Based Integrations (Apple Health, Location Services, Contact List)

#### When User is NOT Connected (connected=false)

**Status Check Response:**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Required Actions:**

1. Call `/config` endpoint to get upload token
2. Upload data using `/upload` endpoint with the token
3. Status changes to `connected: true`

#### When User IS Connected (connected=true)

**Status Check Response Example (varies by provider):**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    // Provider-specific details
  }
}
```

**Available Actions:**

1. Continue uploading new data using the same upload token
2. Data is appended/merged with existing records
3. No re-initialization needed

---

### MusicKit-Based Integration (Apple Music)

#### When User is NOT Connected (connected=false)

**Status Check Response:**

```json
{
  "connected": false,
  "lastSyncedAt": null,
  "details": null
}
```

**Required Actions:**

1. Call `/config` endpoint to get developer token and upload token
2. User authorizes via MusicKit (or mock in development)
3. Call `/callback` endpoint with music user token
4. Status changes to `connected: true`

#### When User IS Connected (connected=true)

**Status Check Response:**

```json
{
  "connected": true,
  "lastSyncedAt": "2024-01-15T10:30:00.000Z",
  "details": {
    "mockMode": true,
    "tracksCount": 50,
    "playlistsCount": 10
  }
}
```

**Available Actions:**

1. Call `/sync` endpoint to refresh music data
2. No re-authorization needed

---

### Quick Status Check for All Integrations

To check the connection status for all integrations at once, call the status endpoint for each provider:

```http
# Plaid
GET http://localhost:3001/integrations/plaid/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Strava
GET http://localhost:3001/integrations/strava/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Spotify
GET http://localhost:3001/integrations/spotify/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Email Scraper
GET http://localhost:3001/integrations/gmail_scraper/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Apple Music
GET http://localhost:3001/integrations/apple_music/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Apple Health
GET http://localhost:3001/integrations/apple_health/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Goodreads
GET http://localhost:3001/integrations/goodreads/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Location Services
GET http://localhost:3001/integrations/location_services/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712

# Contact List
GET http://localhost:3001/integrations/contact_list/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

### Integration Status Summary Table

| Integration       | Auth Type    | connected=false Action            | connected=true Action   |
| ----------------- | ------------ | --------------------------------- | ----------------------- |
| Plaid             | OAuth 2.0    | Complete OAuth flow               | Call sync endpoint      |
| Strava            | OAuth 2.0    | Complete OAuth flow               | Call sync endpoint      |
| Spotify           | OAuth 2.0    | Complete OAuth flow               | Call sync endpoint      |
| Email Scraper     | OAuth 2.0    | Complete OAuth flow               | Call sync endpoint      |
| Goodreads         | OAuth 1.0    | Complete OAuth flow               | Call sync endpoint      |
| Apple Music       | MusicKit     | Get config + authorize + callback | Call sync endpoint      |
| Apple Health      | Upload Token | Get config + upload data          | Continue uploading data |
| Location Services | Upload Token | Get config + upload data          | Continue uploading data |
| Contact List      | Upload Token | Get config + upload data          | Continue uploading data |

---

## Troubleshooting

### Common Issues

#### 1. "Invalid state parameter"

- **Cause**: The state parameter doesn't match or has expired
- **Solution**: Generate a new connection and use the fresh state value

#### 2. "Token not found"

- **Cause**: User hasn't completed the OAuth flow
- **Solution**: Complete the connect → authorize → callback flow first

#### 3. "Redirect URI mismatch"

- **Cause**: The redirect URI in your OAuth app doesn't match the one in `.env`
- **Solution**: Update your OAuth app settings or `.env` file to match

#### 4. "No data returned"

- **Cause**: The third-party account has no data in the requested time range
- **Solution**:
  - For Strava: Add some activities to your account
  - For Spotify: Listen to some music
  - For Gmail: Ensure you have emails in the last 90 days

#### 5. "Connection timeout"

- **Cause**: Third-party API is slow or down
- **Solution**: Wait and retry, or check the provider's status page

### Debug Endpoints

Check if the server is running:

```http
GET http://localhost:3001
```

Check integration status:

```http
GET http://localhost:3001/integrations/{provider}/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712
```

### Logs

Check the server console for detailed logs. The application logs all integration activities with timestamps and error details.

---

## Quick Reference: All Endpoints

### For User: `0fb333c8-2d66-4106-bd1b-517ce6e72712`

| Integration   | Connect Endpoint                                                                    | Status Endpoint                                                                      |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Plaid         | `POST /integrations/plaid/connect`                                                  | `GET /integrations/plaid/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`         |
| Strava        | `POST /integrations/strava/connect`                                                 | `GET /integrations/strava/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`        |
| Spotify       | `POST /integrations/spotify/connect`                                                | `GET /integrations/spotify/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`       |
| Email Scraper | `POST /integrations/gmail_scraper/connect`                                          | `GET /integrations/gmail_scraper/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712` |
| Apple Music   | `GET /integrations/apple_music/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`  | `GET /integrations/apple_music/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`   |
| Apple Health  | `GET /integrations/apple_health/config?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712` | `GET /integrations/apple_health/status?userId=0fb333c8-2d66-4106-bd1b-517ce6e72712`  |

---

## Data Storage

All synced data is stored in the database with the following structure:

- **User Integration Tokens**: Encrypted OAuth tokens
- **User Data**: Categorized data (Travel, Food, Music, Fitness, etc.)
- **Sync History**: Timestamps and sync status
- **Metadata**: Provider-specific information

You can query the database directly to verify data storage:

```sql
-- Check user integrations
SELECT * FROM "UserIntegration" WHERE "userId" = '0fb333c8-2d66-4106-bd1b-517ce6e72712';

-- Check user data
SELECT * FROM "UserData" WHERE "userId" = '0fb333c8-2d66-4106-bd1b-517ce6e72712';
```

---

## Next Steps

1. **Test each integration** following the steps above
2. **Verify data storage** in the database
3. **Check sync status** using the status endpoints
4. **Re-sync data** using the sync endpoints when needed
5. **Monitor logs** for any errors or issues

For production deployment, remember to:

- Update redirect URIs to production URLs
- Switch from sandbox to production mode (Plaid)
- Disable mock mode (Apple Music)
- Set up proper error monitoring
- Implement webhook handlers for real-time updates

---

## Support

If you encounter any issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure the database is running and accessible
4. Check that third-party credentials are valid
5. Review the provider's API documentation for any changes

---

**Last Updated**: January 2024
**Server Version**: 1.0.0
**Base URL**: http://localhost:3001
