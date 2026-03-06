/**
 * Apple Integrations Usage Examples
 *
 * This file demonstrates how to use the Apple Health and Apple Music integrations
 * in various scenarios including web apps, mobile apps, and server-side operations.
 */

import { IntegrationsService } from '../integrations.service';
import { IntegrationProviderName } from '../types';

// Example usage class
export class AppleIntegrationsExamples {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * Example 1: Connect Apple Health from iOS App
   */
  async connectAppleHealthFromiOS(userId: string) {
    try {
      // 1. Initiate connection
      const connection = await this.integrationsService.createConnection(
        IntegrationProviderName.APPLE_HEALTH,
        userId,
      );

      console.log('Apple Health connection initiated:', {
        state: connection.state,
        redirectUrl: connection.redirectUrl,
      });

      // 2. The iOS app would handle the redirectUrl and authorize HealthKit
      // 3. iOS app collects health data and uploads it

      return {
        success: true,
        uploadEndpoint: '/integrations/apple_health/upload',
        instructions:
          'Use the redirectUrl in your iOS app to initiate HealthKit authorization',
      };
    } catch (error) {
      console.error('Apple Health connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 2: Upload Apple Health Data from iOS App
   */
  async uploadAppleHealthData(userId: string, uploadToken: string) {
    const sampleHealthData = {
      workouts: [
        {
          id: 'workout_123',
          workoutType: 'HKWorkoutActivityTypeRunning',
          startDate: '2024-01-15T07:00:00Z',
          endDate: '2024-01-15T07:45:00Z',
          duration: 45, // minutes
          totalEnergyBurned: 350, // calories
          totalDistance: 7500, // meters
          metadata: {
            weather: 'sunny',
            route: 'park_loop',
          },
        },
      ],
      healthMetrics: [
        {
          id: 'weight_123',
          type: 'HKQuantityTypeIdentifierBodyMass',
          value: 72.5,
          unit: 'kg',
          date: '2024-01-15T08:00:00Z',
        },
      ],
      steps: [
        {
          id: 'steps_123',
          date: '2024-01-15',
          stepCount: 12500,
          distance: 9200, // meters
        },
      ],
      heartRate: [
        {
          id: 'hr_123',
          date: '2024-01-15T07:30:00Z',
          value: 165,
          context: 'active',
        },
      ],
      sleep: [
        {
          id: 'sleep_123',
          startDate: '2024-01-14T23:30:00Z',
          endDate: '2024-01-15T06:45:00Z',
          value: 'asleep',
          duration: 435, // minutes
        },
      ],
    };

    try {
      const result = await this.integrationsService.handleAppleHealthUpload(
        userId,
        uploadToken,
        sampleHealthData,
      );

      console.log('Apple Health data uploaded successfully:', result);
      return result;
    } catch (error) {
      console.error('Apple Health upload failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 3: Connect Apple Music from Web App
   */
  async connectAppleMusicFromWeb(userId: string) {
    try {
      // 1. Initiate connection
      const connection = await this.integrationsService.createConnection(
        IntegrationProviderName.APPLE_MUSIC,
        userId,
      );

      console.log('Apple Music connection initiated:', {
        state: connection.state,
        redirectUrl: connection.redirectUrl,
        developerToken: connection.linkToken,
      });

      // 2. Frontend would use MusicKit JS with the developer token
      const musicKitConfig = {
        developerToken: connection.linkToken,
        app: {
          name: 'Traeta',
          build: '1.0.0',
        },
      };

      return {
        success: true,
        authorizationUrl: connection.redirectUrl,
        musicKitConfig,
        instructions:
          'Use MusicKit JS to authorize the user and get music user token',
      };
    } catch (error) {
      console.error('Apple Music connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 4: Complete Apple Music Authorization
   */
  async completeAppleMusicAuthorization(
    userId: string,
    musicUserToken: string,
  ) {
    try {
      const result =
        await this.integrationsService.handleAppleMusicAuthorization(
          userId,
          musicUserToken,
        );

      console.log('Apple Music authorization completed:', result);
      return result;
    } catch (error) {
      console.error('Apple Music authorization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 5: Sync Apple Health Data
   */
  async syncAppleHealth(userId: string) {
    try {
      const result = await this.integrationsService.sync(
        IntegrationProviderName.APPLE_HEALTH,
        userId,
      );

      console.log('Apple Health sync result:', result);
      return result;
    } catch (error) {
      console.error('Apple Health sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 6: Sync Apple Music Data
   */
  async syncAppleMusic(userId: string) {
    try {
      const result = await this.integrationsService.sync(
        IntegrationProviderName.APPLE_MUSIC,
        userId,
      );

      console.log('Apple Music sync result:', result);
      return result;
    } catch (error) {
      console.error('Apple Music sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 7: Check Integration Status
   */
  async checkIntegrationStatus(userId: string) {
    try {
      const appleHealthStatus = await this.integrationsService.status(
        IntegrationProviderName.APPLE_HEALTH,
        userId,
      );

      const appleMusicStatus = await this.integrationsService.status(
        IntegrationProviderName.APPLE_MUSIC,
        userId,
      );

      console.log('Integration statuses:', {
        appleHealth: appleHealthStatus,
        appleMusic: appleMusicStatus,
      });

      return {
        appleHealth: appleHealthStatus,
        appleMusic: appleMusicStatus,
      };
    } catch (error) {
      console.error('Status check failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 8: Get Integration Configuration for Mobile Apps
   */
  async getIntegrationConfigs(userId: string) {
    try {
      const appleHealthConfig =
        await this.integrationsService.getIntegrationConfig(
          IntegrationProviderName.APPLE_HEALTH,
          userId,
        );

      const appleMusicConfig =
        await this.integrationsService.getIntegrationConfig(
          IntegrationProviderName.APPLE_MUSIC,
          userId,
        );

      console.log('Integration configurations:', {
        appleHealth: appleHealthConfig,
        appleMusic: appleMusicConfig,
      });

      return {
        appleHealth: appleHealthConfig,
        appleMusic: appleMusicConfig,
      };
    } catch (error) {
      console.error('Config retrieval failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Example 9: Complete Integration Workflow
   */
  async completeIntegrationWorkflow(userId: string) {
    console.log(`Starting complete integration workflow for user: ${userId}`);

    try {
      // Step 1: Check current status
      const initialStatus = await this.checkIntegrationStatus(userId);
      console.log('Initial status:', initialStatus);

      // Step 2: Connect Apple Health if not connected
      if (!initialStatus.appleHealth?.connected) {
        console.log('Connecting Apple Health...');
        await this.connectAppleHealthFromiOS(userId);
      }

      // Step 3: Connect Apple Music if not connected
      if (!initialStatus.appleMusic?.connected) {
        console.log('Connecting Apple Music...');
        await this.connectAppleMusicFromWeb(userId);
      }

      // Step 4: Sync data from both services
      console.log('Syncing data...');
      const healthSync = await this.syncAppleHealth(userId);
      const musicSync = await this.syncAppleMusic(userId);

      // Step 5: Check final status
      const finalStatus = await this.checkIntegrationStatus(userId);

      return {
        success: true,
        workflow: {
          initialStatus,
          healthSync,
          musicSync,
          finalStatus,
        },
      };
    } catch (error) {
      console.error('Integration workflow failed:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Frontend Integration Examples
 */

// Example: MusicKit JS Integration (for web apps)
export const musicKitWebExample = `
// 1. Include MusicKit JS in your HTML
<script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>

// 2. Configure and authorize
async function connectAppleMusic(developerToken, userId) {
    try {
        // Configure MusicKit
        await MusicKit.configure({
            developerToken: developerToken,
            app: {
                name: 'Traeta',
                build: '1.0.0'
            }
        });

        // Get MusicKit instance
        const music = MusicKit.getInstance();

        // Authorize user
        await music.authorize();

        // Get user token
        const musicUserToken = music.musicUserToken;

        // Send to backend
        const response = await fetch('/integrations/apple_music/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                musicUserToken: musicUserToken
            })
        });

        const result = await response.json();
        console.log('Apple Music connected:', result);

    } catch (error) {
        console.error('Apple Music connection failed:', error);
    }
}
`;

// Example: iOS HealthKit Integration (Swift)
export const healthKitIOSExample = `
// 1. Import HealthKit
import HealthKit

// 2. Request authorization
func requestHealthKitAuthorization() {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    
    let healthStore = HKHealthStore()
    let typesToRead: Set<HKObjectType> = [
        HKObjectType.workoutType(),
        HKObjectType.quantityType(forIdentifier: .stepCount)!,
        HKObjectType.quantityType(forIdentifier: .bodyMass)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    ]
    
    healthStore.requestAuthorization(toShare: nil, read: typesToRead) { success, error in
        if success {
            self.collectAndUploadHealthData()
        }
    }
}

// 3. Collect and upload data
func collectAndUploadHealthData() {
    // Collect workouts, steps, etc.
    // Format data according to API specification
    // Upload to /integrations/apple_health/upload
}
`;

// Example: React Native Integration
export const reactNativeExample = `
// Apple Health (iOS)
import { AppleHealthKit } from 'react-native-health';

const healthKitPermissions = {
    permissions: {
        read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.HeartRate,
        ],
    },
};

AppleHealthKit.initHealthKit(healthKitPermissions, (error) => {
    if (error) {
        console.log('HealthKit init error:', error);
        return;
    }
    
    // Collect and upload data
    collectHealthData();
});

// Apple Music (iOS)
import MusicKit from 'react-native-musickit';

async function connectAppleMusic() {
    try {
        const isAuthorized = await MusicKit.requestAuthorization();
        if (isAuthorized) {
            const userToken = await MusicKit.getUserToken();
            // Send to backend
        }
    } catch (error) {
        console.error('Apple Music error:', error);
    }
}
`;

export default AppleIntegrationsExamples;
