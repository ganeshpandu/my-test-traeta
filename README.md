# Traeta Server

Backend server for the Traeta application, providing third-party integrations and data management.

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. **Install dependencies:**

   ```bash
   cd user-service
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env` (or use the existing `.env` file)
   - Update database credentials and API keys

3. **Start the server:**

   ```bash
   npm run start:dev
   ```

   Server will run on: `http://localhost:3001`

## Third-Party Integrations

This server supports the following third-party integrations:

| Integration           | Status        | Description                            |
| --------------------- | ------------- | -------------------------------------- |
| **Plaid**             | ✅ Active     | Banking and financial transactions     |
| **Strava**            | ✅ Active     | Fitness activities and workouts        |
| **Spotify**           | ✅ Active     | Music streaming and listening history  |
| **Email Scraper**     | ✅ Active     | Gmail integration for travel/food data |
| **Apple Music**       | ✅ Active     | Music library (Mock mode enabled)      |
| **Apple Health**      | ✅ Active     | Health and fitness data from iOS       |
| **Goodreads**         | 🔧 Configured | Book reading data                      |
| **Location Services** | 🔧 Configured | GPS and location tracking              |
| **Contact List**      | 🔧 Configured | Contact synchronization                |

## Testing Guide

### For Manual Testing (Postman)

**📖 Complete Testing Guide:** See [`THIRD_PARTY_INTEGRATION_TESTING_GUIDE.md`](./THIRD_PARTY_INTEGRATION_TESTING_GUIDE.md)

**📦 Postman Collection:** Import [`Traeta_All_Integrations.postman_collection.json`](./Traeta_All_Integrations.postman_collection.json)

### Quick Test for User ID: `0fb333c8-2d66-4106-bd1b-517ce6e72712`

1. **Start the server:**

   ```bash
   cd user-service
   npm run start:dev
   ```

2. **Import Postman Collection:**
   - Open Postman
   - Import `Traeta_All_Integrations.postman_collection.json`
   - The collection has pre-configured variables for your user ID

3. **Test Each Integration:**
   - Follow the numbered folders in the collection
   - Each integration has 3-4 requests (Connect → Callback → Sync → Status)

### Testing Workflow

For OAuth-based integrations (Plaid, Strava, Spotify, Gmail):

```
1. POST /integrations/{provider}/connect
   → Get redirectUrl or linkToken

2. Open redirectUrl in browser
   → Authorize the app
   → Copy the 'code' from redirect URL

3. GET /integrations/{provider}/callback?code=...&state=...
   → Complete authorization and sync data

4. GET /integrations/{provider}/status?userId=...
   → Verify connection status
```

For upload-based integrations (Apple Health, Apple Music):

```
1. GET /integrations/{provider}/config?userId=...
   → Get upload token

2. POST /integrations/{provider}/upload or /callback
   → Upload data with token

3. GET /integrations/{provider}/status?userId=...
   → Verify data was stored
```

## Project Structure

```
traeta-server/
├── user-service/              # Main user service
│   ├── src/
│   │   ├── integrations/      # Third-party integrations
│   │   │   ├── providers/     # Integration providers
│   │   │   ├── integrations.controller.ts
│   │   │   ├── integrations.service.ts
│   │   │   └── types.ts
│   │   ├── users/             # User management
│   │   ├── auth/              # Authentication
│   │   └── main.ts
│   └── package.json
├── masterData-service/        # Master data service
├── libs/                      # Shared libraries
│   └── prisma/               # Database schema
├── .env                       # Environment configuration
└── README.md                  # This file
```

## Environment Variables

Key environment variables (see `.env` file for complete list):

```env
# Database
DATABASE_URL="postgresql://..."

# Server
USER_PORT=3001
NODE_ENV=development

# Plaid
PLAID_CLIENT_ID="..."
PLAID_SECRET="..."
PLAID_ENV="sandbox"

# Strava
STRAVA_CLIENT_ID="..."
STRAVA_CLIENT_SECRET="..."
STRAVA_REDIRECT_URI="http://127.0.0.1:3000/api/integrations/strava/callback"

# Spotify
SPOTIFY_CLIENT_ID="..."
SPOTIFY_CLIENT_SECRET="..."
SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/integrations/spotify/callback"

# Gmail/Email Scraper
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REDIRECT_URI="http://127.0.0.1:3000/integrations/email_scraper/callback"

# Apple Music
APPLE_MUSIC_TEAM_ID="..."
APPLE_MUSIC_KEY_ID="..."
APPLE_MUSIC_PRIVATE_KEY="..."
APPLE_MUSIC_USE_MOCK_DATA="true"  # Set to false for production
```

## API Endpoints

### Integration Endpoints

All integrations follow the same pattern:

- `POST /integrations/{provider}/connect` - Initiate connection
- `GET/POST /integrations/{provider}/callback` - Handle OAuth callback
- `POST /integrations/{provider}/sync` - Manually sync data
- `GET /integrations/{provider}/status` - Check connection status
- `GET /integrations/{provider}/config` - Get integration configuration

### Available Providers

- `plaid` - Banking and financial data
- `strava` - Fitness activities
- `spotify` - Music streaming
- `email_scraper` - Gmail integration
- `apple_music` - Apple Music library
- `apple_health` - iOS health data
- `goodreads` - Reading data
- `location_services` - GPS tracking
- `contact_list` - Contact sync

## Database

The application uses PostgreSQL with Prisma ORM.

### Key Tables

- `User` - User accounts
- `UserIntegration` - Integration connections and tokens
- `UserData` - Synced data from integrations
- `UserDataCategory` - Data categorization

### Running Migrations

```bash
cd libs/prisma
npx prisma migrate dev
```

## Development

### Running in Development Mode

```bash
cd user-service
npm run start:dev
```

### Building for Production

```bash
cd user-service
npm run build
npm run start:prod
```

### Running Tests

```bash
cd user-service
npm run test
```

## Troubleshooting

### Common Issues

1. **"Connection refused" error**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in `.env`

2. **"Invalid redirect URI" error**
   - Update OAuth app settings to match redirect URIs in `.env`
   - Ensure redirect URIs match exactly (including http/https)

3. **"Token not found" error**
   - Complete the OAuth flow (connect → authorize → callback)
   - Check that tokens are being stored in the database

4. **"No data returned" error**
   - Ensure the third-party account has data
   - Check the date range settings (DEFAULT_DAYS variables)

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL="debug"
NODE_ENV=development
```

## Documentation

- **[Third-Party Integration Testing Guide](./THIRD_PARTY_INTEGRATION_TESTING_GUIDE.md)** - Complete guide for testing all integrations
- **[Postman Collection](./Traeta_All_Integrations.postman_collection.json)** - Ready-to-use API collection
- **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Production deployment guide

## Support

For issues or questions:

1. Check the [Testing Guide](./THIRD_PARTY_INTEGRATION_TESTING_GUIDE.md)
2. Review server logs for error details
3. Verify environment variables are set correctly
4. Check third-party provider status pages

## License

Proprietary - All rights reserved

---

**Last Updated:** January 2024  
**Version:** 1.0.0  
**Base URL:** http://localhost:3001
