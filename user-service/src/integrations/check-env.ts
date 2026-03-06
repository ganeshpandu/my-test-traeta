#!/usr/bin/env ts-node

/**
 * Environment Variables Checker
 *
 * This script validates that all required environment variables
 * are properly configured for integration testing.
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

interface IntegrationConfig {
  name: string;
  required: string[];
  optional: string[];
  description: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    name: 'Plaid',
    required: ['PLAID_CLIENT_ID', 'PLAID_SECRET'],
    optional: ['PLAID_ENV'],
    description: 'Banking and financial data integration',
  },
  {
    name: 'Strava',
    required: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'],
    optional: ['STRAVA_REDIRECT_URI', 'STRAVA_DEFAULT_DAYS'],
    description: 'Fitness activities and workout data',
  },
  {
    name: 'Spotify',
    required: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    optional: ['SPOTIFY_REDIRECT_URI', 'SPOTIFY_DEFAULT_DAYS'],
    description: 'Music streaming and listening history',
  },
  {
    name: 'Apple Health',
    required: [],
    optional: ['APPLE_HEALTH_DEFAULT_DAYS', 'APPLE_HEALTH_UPLOAD_ENDPOINT'],
    description: 'iOS health and fitness data (device-based)',
  },
  {
    name: 'Apple Music',
    required: [
      'APPLE_MUSIC_TEAM_ID',
      'APPLE_MUSIC_KEY_ID',
      'APPLE_MUSIC_PRIVATE_KEY',
    ],
    optional: ['APPLE_MUSIC_CALLBACK_URL', 'APPLE_MUSIC_DEFAULT_DAYS'],
    description: 'Apple Music library and listening data',
  },
  {
    name: 'Email Scraper',
    required: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET'],
    optional: [
      'GMAIL_REDIRECT_URI',
      'GMAIL_DEFAULT_DAYS',
      'EMAIL_SCRAPER_ENABLED',
    ],
    description: 'Gmail integration for email data extraction',
  },
];

function checkEnvVar(varName: string): {
  exists: boolean;
  value?: string;
  masked?: string;
} {
  const value = process.env[varName];
  if (!value) {
    return { exists: false };
  }

  // Mask sensitive values for display
  const masked =
    value.length > 8
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
      : '***';

  return { exists: true, value, masked };
}

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 ${title}`);
  console.log('='.repeat(60));
}

function printIntegrationStatus(integration: IntegrationConfig) {
  console.log(`\n📱 ${integration.name}`);
  console.log(`   ${integration.description}`);
  console.log('   ' + '-'.repeat(50));

  let allRequiredPresent = true;

  // Check required variables
  if (integration.required.length > 0) {
    console.log('   Required:');
    for (const varName of integration.required) {
      const check = checkEnvVar(varName);
      if (check.exists) {
        console.log(`   ✅ ${varName}: ${check.masked}`);
      } else {
        console.log(`   ❌ ${varName}: NOT SET`);
        allRequiredPresent = false;
      }
    }
  }

  // Check optional variables
  if (integration.optional.length > 0) {
    console.log('   Optional:');
    for (const varName of integration.optional) {
      const check = checkEnvVar(varName);
      if (check.exists) {
        console.log(`   ✅ ${varName}: ${check.masked}`);
      } else {
        console.log(`   ⚪ ${varName}: not set (using defaults)`);
      }
    }
  }

  // Overall status
  if (integration.required.length === 0) {
    console.log('   🟡 No API keys required (device-based integration)');
  } else if (allRequiredPresent) {
    console.log('   🟢 Ready for testing');
  } else {
    console.log('   🔴 Missing required configuration');
  }

  return allRequiredPresent;
}

function generateEnvTemplate() {
  console.log('\n📝 Environment Template (.env file):');
  console.log('-'.repeat(50));

  for (const integration of INTEGRATIONS) {
    if (integration.required.length > 0 || integration.optional.length > 0) {
      console.log(`\n# ${integration.name} - ${integration.description}`);

      for (const varName of integration.required) {
        console.log(`${varName}="your_${varName.toLowerCase()}"`);
      }

      for (const varName of integration.optional) {
        const defaultValue = getDefaultValue(varName);
        console.log(`# ${varName}="${defaultValue}"`);
      }
    }
  }
}

function getDefaultValue(varName: string): string {
  const defaults: Record<string, string> = {
    PLAID_ENV: 'sandbox',
    STRAVA_REDIRECT_URI: 'http://dev.traeta.com/integrations/strava/callback',
    STRAVA_DEFAULT_DAYS: '45',
    SPOTIFY_REDIRECT_URI: 'http://dev.traeta.com/integrations/spotify/callback',
    SPOTIFY_DEFAULT_DAYS: '45',
    APPLE_HEALTH_DEFAULT_DAYS: '45',
    APPLE_HEALTH_UPLOAD_ENDPOINT: '/integrations/apple_health/upload',
    APPLE_MUSIC_CALLBACK_URL:
      'https://dev.traeta.com/integrations/apple_music/callback',
    APPLE_MUSIC_DEFAULT_DAYS: '45',
    GMAIL_REDIRECT_URI:
      'http://dev.traeta.com/integrations/email_scraper/callback',
    GMAIL_DEFAULT_DAYS: '45',
    EMAIL_SCRAPER_ENABLED: 'true',
  };

  return defaults[varName] || 'your_value_here';
}

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  console.log('\n📁 Environment File Status:');
  console.log('-'.repeat(30));

  if (fs.existsSync(envPath)) {
    console.log('✅ .env file exists');
  } else {
    console.log('❌ .env file not found');

    if (fs.existsSync(envExamplePath)) {
      console.log('💡 Found .env.example - copy it to .env and configure');
      console.log('   Command: cp .env.example .env');
    } else {
      console.log('💡 Create a .env file with the template below');
    }
  }
}

function main() {
  printHeader('Integration Environment Checker');

  // Check if .env file exists
  checkEnvFile();

  // Check each integration
  const readyIntegrations: string[] = [];
  const missingIntegrations: string[] = [];

  for (const integration of INTEGRATIONS) {
    const isReady = printIntegrationStatus(integration);

    if (integration.required.length === 0) {
      // Device-based integrations are always "ready"
      readyIntegrations.push(integration.name);
    } else if (isReady) {
      readyIntegrations.push(integration.name);
    } else {
      missingIntegrations.push(integration.name);
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('-'.repeat(20));
  console.log(
    `✅ Ready for testing: ${readyIntegrations.join(', ') || 'None'}`,
  );
  console.log(
    `❌ Missing configuration: ${missingIntegrations.join(', ') || 'None'}`,
  );

  // Show template if needed
  if (missingIntegrations.length > 0) {
    generateEnvTemplate();
  }

  // Next steps
  console.log('\n🚀 Next Steps:');
  console.log('-'.repeat(15));

  if (readyIntegrations.length > 0) {
    console.log('1. Start the server: npm run start:dev');
    console.log('2. Run quick tests: npm run test:integrations:quick');
    console.log('3. Run full tests: npm run test:integrations');
  }

  if (missingIntegrations.length > 0) {
    console.log('1. Configure missing environment variables');
    console.log('2. Restart this check: npm run check-env');
  }

  console.log('\n📚 For detailed setup instructions, see:');
  console.log('   THIRD_PARTY_INTEGRATIONS_README.md');
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔍 Environment Variables Checker

This script validates your integration configuration and shows
which integrations are ready for testing.

Usage:
  npm run check-env

The script will:
- Check for required API keys and secrets
- Show which integrations are properly configured  
- Generate an environment template if needed
- Provide next steps for testing

For setup instructions, see THIRD_PARTY_INTEGRATIONS_README.md
`);
  process.exit(0);
}

// Run the main function
main();
