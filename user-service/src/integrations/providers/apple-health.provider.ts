import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechvLogger } from 'techvedika-logger';
import {
  IntegrationProvider,
  IntegrationProviderName,
  ConnectResponse,
  CallbackPayload,
} from '../types';
import { IntegrationPersistence } from '../persistence';
import { PrismaService } from '@traeta/prisma';
import { TokenStore } from '../token-store';
import {
  ConfigurationException,
  InvalidCallbackException,
  InvalidTokenException,
  DataSyncException,
} from '../exceptions/integration.exceptions';
import {
  DATA_TYPE,
  REC_SEQ,
  STATUS,
  LogType,
  MethodNames,
  METERS_PER_MILE,
  YARDS_PER_METER,
} from '../../../constants';

interface AppleHealthData {
  workouts?: AppleHealthWorkout[];
  healthMetrics?: AppleHealthMetric[];
  steps?: AppleHealthSteps[];
  heartRate?: AppleHealthHeartRate[];
  sleep?: AppleHealthSleep[];
  distanceWalkingRunning?: AppleHealthMiles[];
}

interface AppleHealthWorkout {
  id: string;
  workoutType: string;
  workoutActivityType: string;
  date: string;
  startDateTime: string;
  endDateTime: string;
  totalEnergyBurned?: number; // calories
  totalDistance?: number; // in meters
  metadata?: Record<string, any>;
}

interface AppleHealthMetric {
  id: string;
  type: string; // weight, height, body_fat_percentage, etc.
  value: number;
  unit: string;
  startDateTime: string;
  endDateTime: string;
}

interface AppleHealthSteps {
  id: string;
  startDateTime: string;
  endDateTime: string;
  value: number;
  distance?: number; // in meters
}

interface AppleHealthHeartRate {
  id: string;
  startDateTime: string;
  endDateTime: string;
  value: number; // BPM
  context?: string; // resting, active, etc.
}

interface AppleHealthSleep {
  id: string;
  type: string; // SLEEP_ASLEEP, SLEEP_REM, SLEEP_DEEP, etc.
  value: number; // duration value
  unit: string; // MINUTE, HOUR, etc.
  startDateTime: string;
  endDateTime: string;
}

interface AppleHealthMiles {
  id: string;
  startDateTime: string;
  endDateTime: string;
  value: number; // in meters
}

const truncateToTwoDecimals = (
  value: number | undefined,
): number | undefined => {
  if (typeof value !== 'number') {
    return undefined;
  }
  return Math.trunc(value * 1000) / 1000;
};

@Injectable()
export class AppleHealthProvider implements IntegrationProvider {
  public readonly name = IntegrationProviderName.APPLE_HEALTH;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getDefaultDays(): number {
    const days = this.configService.get<string>('APPLE_HEALTH_DEFAULT_DAYS');
    return days ? Number(days) : 30;
  }

  private getUploadEndpoint(): string | undefined {
    return this.configService.get<string>('APPLE_HEALTH_UPLOAD_ENDPOINT');
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    try {
      // Validate configuration
      const uploadEndpoint = this.getUploadEndpoint();
      if (!uploadEndpoint) {
        throw new ConfigurationException(
          IntegrationProviderName.APPLE_HEALTH,
          'Apple Health upload endpoint is not configured',
        );
      }

      // Apple Health uses device-based authorization
      // We generate a session token for secure data upload from the iOS app
      const state = `apple-health-${userId}-${Date.now()}`;

      // Create a temporary upload token for the mobile app to use
      const uploadToken = this.generateUploadToken(userId);

      await this.persistence.ensureIntegration('apple_health');

      // Store the upload token temporarily
      await this.tokens.set(userId, 'apple_health', {
        accessToken: uploadToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      });

      return {
        provider: this.name,
        state,
        // Return upload endpoint and token for mobile app
        redirectUrl: `applehealth://connect?uploadEndpoint=${encodeURIComponent(uploadEndpoint)}&uploadToken=${uploadToken}&userId=${userId}`,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create Apple Health connection',
        data: {
          service: AppleHealthProvider.name,
          method: MethodNames.createConnection,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (error instanceof ConfigurationException) {
        throw error;
      }

      throw new ConfigurationException(
        IntegrationProviderName.APPLE_HEALTH,
        `Failed to create connection: ${error.message}`,
      );
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Apple Health callback payload received',
      data: {
        service: AppleHealthProvider.name,
        method: MethodNames.handleCallback,
        provider: this.name,
      },
    });

    const { state, healthData, uploadToken } = payload;

    if (!state || !uploadToken) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_HEALTH,
        'Missing required callback parameters: state and uploadToken are required',
      );
    }

    // Extract userId from state format: "apple-health-<userId>-<ts>"
    // Remove "apple-health-" prefix and "-<timestamp>" suffix
    if (!state.startsWith('apple-health-')) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_HEALTH,
        'Invalid state format: unable to extract userId',
      );
    }

    const stateWithoutPrefix = state.replace(/^apple-health-/, '');
    const lastDashIndex = stateWithoutPrefix.lastIndexOf('-');
    const userId =
      lastDashIndex > 0
        ? stateWithoutPrefix.substring(0, lastDashIndex)
        : stateWithoutPrefix;
    if (!userId) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_HEALTH,
        'Invalid state format: unable to extract userId',
      );
    }

    // Verify upload token
    const storedToken = await this.tokens.get(userId, 'apple_health');
    if (!storedToken || storedToken.accessToken !== uploadToken) {
      throw new InvalidTokenException(IntegrationProviderName.APPLE_HEALTH);
    }

    // Check token expiry
    const now = Math.floor(Date.now() / 1000);
    if (storedToken.expiresAt && storedToken.expiresAt < now) {
      throw new InvalidTokenException(IntegrationProviderName.APPLE_HEALTH);
    }

    // Process health data if provided
    if (healthData) {
      await this.processHealthData(userId, healthData as AppleHealthData);
    }

    // Mark as connected
    const integration =
      await this.persistence.ensureIntegration('apple_health');
    await this.persistence.markConnected(userId, integration.integrationId);

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Apple Health connected successfully',
      data: {
        service: AppleHealthProvider.name,
        method: MethodNames.handleCallback,
        userId,
        provider: this.name,
      },
    });
  }

  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    try {
      // For Apple Health, sync is typically initiated by the mobile app
      // This method can be used to trigger a sync request or process uploaded data

      const integration =
        await this.persistence.ensureIntegration('apple_health');
      const defaultDays = this.getDefaultDays();
      const sinceDate =
        (await this.persistence.getLastSyncedAt(
          userId,
          integration.integrationId,
        )) ?? new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);

      // Check if there's any pending data to process
      // In a real implementation, you might check for uploaded files or queued data

      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        },
      });

      if (link) {
        await this.persistence.markSynced(link.userIntegrationId);
      }

      return {
        ok: true,
        syncedAt: new Date(),
        details: {
          message: 'Apple Health sync completed',
          since: sinceDate,
          note: 'Data sync is typically initiated from the iOS app',
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Apple Health sync failed',
        data: {
          service: AppleHealthProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (error instanceof DataSyncException) {
        throw error;
      }

      throw new DataSyncException(
        IntegrationProviderName.APPLE_HEALTH,
        `Failed to sync Apple Health data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration =
      await this.persistence.ensureIntegration('apple_health');
    const link = await this.db.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
      },
    });

    const history = link
      ? await this.db.userIntegrationHistory.findFirst({
          where: {
            userIntegrationId: link.userIntegrationId,
            userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          },
        })
      : null;

    const isConnected = !!link && link.status === STATUS.CONNECTED;

    // Generate a fresh upload token for connected users
    let uploadToken: string | undefined;
    if (isConnected) {
      uploadToken = this.generateUploadToken(userId);
      await this.tokens.set(userId, 'apple_health', {
        accessToken: uploadToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      });
    }

    return {
      connected: isConnected,
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {
        uploadToken: uploadToken, // Include token for connected users
      },
    };
  }

  // Method to handle direct data upload from mobile app
  async handleDataUpload(
    userId: string,
    uploadToken: string,
    healthData: AppleHealthData,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      // Verify upload token
      const storedToken = await this.tokens.get(userId, 'apple_health');
      if (!storedToken || storedToken.accessToken !== uploadToken) {
        throw new InvalidTokenException(IntegrationProviderName.APPLE_HEALTH);
      }

      // Check token expiry
      const now = Math.floor(Date.now() / 1000);
      if (storedToken.expiresAt && storedToken.expiresAt < now) {
        throw new InvalidTokenException(IntegrationProviderName.APPLE_HEALTH);
      }

      await this.processHealthData(userId, healthData);

      // Mark as connected and synced
      const integration =
        await this.persistence.ensureIntegration('apple_health');

      // Ensure user is marked as connected
      await this.persistence.markConnected(userId, integration.integrationId);

      // Now mark as synced
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        },
      });

      if (link) {
        await this.persistence.markSynced(link.userIntegrationId);
      }

      return {
        ok: true,
        message:
          'Health data uploaded successfully (duplicates skipped/updated)',
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to upload Apple Health data',
        data: {
          service: AppleHealthProvider.name,
          method: MethodNames.handleDataUpload,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (error instanceof InvalidTokenException) {
        throw error;
      }

      throw new DataSyncException(
        IntegrationProviderName.APPLE_HEALTH,
        `Failed to upload health data: ${error.message}`,
      );
    }
  }

  private generateUploadToken(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `ah_${userId}_${timestamp}_${random}`;
  }

  private async processHealthData(
    userId: string,
    healthData: AppleHealthData,
  ): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Processing health data',
      data: {
        service: AppleHealthProvider.name,
        method: MethodNames.processHealthData,
        userId,
        provider: this.name,
      },
    });

    // Process workouts
    if (healthData.workouts && healthData.workouts.length > 0) {
      await this.processWorkouts(userId, healthData.workouts);
    }

    // Process health metrics (weight, height, etc.)
    if (healthData.healthMetrics && healthData.healthMetrics.length > 0) {
      await this.processHealthMetrics(userId, healthData.healthMetrics);
    }

    // Process steps data
    if (healthData.steps && healthData.steps.length > 0) {
      await this.processStepsData(userId, healthData.steps);
    }

    // Process heart rate data
    if (healthData.heartRate && healthData.heartRate.length > 0) {
      await this.processHeartRateData(userId, healthData.heartRate);
    }

    // Process sleep data
    if (healthData.sleep && healthData.sleep.length > 0) {
      await this.processSleepData(userId, healthData.sleep);
    }

    //Miles
    if (
      healthData.distanceWalkingRunning &&
      healthData.distanceWalkingRunning.length > 0
    ) {
      await this.processMilesData(userId, healthData.distanceWalkingRunning);
    }
  }

  private async processWorkouts(
    userId: string,
    workouts: AppleHealthWorkout[],
  ): Promise<void> {
    for (const workout of workouts) {
      const categoryName = this.mapWorkoutType(workout.workoutActivityType);
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(
          userId,
          'Activity',
          categoryName,
        );

      const startDateTime = new Date(
        workout.startDateTime +
          (workout.startDateTime.endsWith('Z') ? '' : 'Z'),
      );
      const endDateTime = new Date(
        workout.endDateTime + (workout.endDateTime.endsWith('Z') ? '' : 'Z'),
      );

      const startTimeIso = startDateTime.toISOString();
      const endTimeIso = endDateTime.toISOString();

      const date = startDateTime.toISOString().split('T')[0];
      const durationMs = endDateTime.getTime() - startDateTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((durationMs % (1000 * 60)) / 1000);
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
      const duration = parts.join(' ');

      const baseMiles =
        categoryName.toLowerCase() !== 'swim'
          ? workout.totalDistance / METERS_PER_MILE
          : 0;
      const baseYards =
        categoryName.toLowerCase() === 'swim'
          ? workout.totalDistance * YARDS_PER_METER
          : 0;
      const miles = truncateToTwoDecimals(baseMiles);
      const yards = truncateToTwoDecimals(baseYards);
      const distance = categoryName.toLowerCase() === 'swim' ? yards : miles;

      // const distance = workout.totalDistance ? parseFloat((workout.totalDistance / 1609.344).toFixed(2)) : 0;
      if (['Run', 'Bike', 'Swim', 'Hike', 'Walk'].includes(categoryName)) {
        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          category?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          `${distance} ${categoryName === 'Swim' ? 'yards' : 'miles'}`,
          {
            ...(categoryName === 'Swim'
              ? { yards: distance }
              : { miles: distance }),
            date: date,
            startTime: startTimeIso,
            endTime: endTimeIso,
            activityDuration: duration,
            elapsedDuration: duration,
            calories: workout.totalEnergyBurned ?? null,
            workoutType: workout.workoutType,
            metadata: workout.metadata ?? {},
            external: {
              provider: 'apple_health',
              id: workout.id,
              type: 'workout',
            },
          },
          {
            ...(categoryName === 'Swim'
              ? { yards: DATA_TYPE.NUMBER }
              : { miles: DATA_TYPE.NUMBER }),
            date: DATA_TYPE.STRING,
            startTime: DATA_TYPE.STRING,
            endTime: DATA_TYPE.STRING,
            activityDuration: DATA_TYPE.STRING,
            elapsedDuration: DATA_TYPE.STRING,
            address: DATA_TYPE.STRING,
            images: DATA_TYPE.STRING_ARRAY,
            calories: DATA_TYPE.NUMBER,
            distance: DATA_TYPE.NUMBER,
            workoutType: DATA_TYPE.STRING,
            metadata: {},
            external: {
              provider: DATA_TYPE.STRING,
              id: DATA_TYPE.STRING,
              type: DATA_TYPE.STRING,
            },
          },
          userId,
        );
      } else {
        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          category?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          `${duration}`,
          {
            date: date,
            startTime: startTimeIso,
            endTime: endTimeIso,
            activityDuration: duration,
            elapsedDuration: duration,
            address: '',
            images: [],
            calories: workout.totalEnergyBurned ?? null,
            workoutType: workout.workoutType,
            metadata: workout.metadata ?? {},
            external: {
              provider: 'apple_health',
              id: workout.id,
              type: 'workout',
            },
          },
          {
            date: DATA_TYPE.STRING,
            startTime: DATA_TYPE.STRING,
            endTime: DATA_TYPE.STRING,
            activityDuration: DATA_TYPE.STRING,
            elapsedDuration: DATA_TYPE.STRING,
            address: DATA_TYPE.STRING,
            images: DATA_TYPE.STRING_ARRAY,
            calories: DATA_TYPE.NUMBER,
            distance: DATA_TYPE.NUMBER,
            workoutType: DATA_TYPE.STRING,
            metadata: {},
            external: {
              provider: DATA_TYPE.STRING,
              id: DATA_TYPE.STRING,
              type: DATA_TYPE.STRING,
            },
          },
          userId,
        );
      }
    }
  }

  private async processHealthMetrics(
    userId: string,
    metrics: AppleHealthMetric[],
  ): Promise<void> {
    for (const metric of metrics) {
      const categoryName = this.mapMetricType(metric.type);
      if (categoryName === 'VO2 Max') {
        const { list, userList, category } =
          await this.persistence.ensureListAndCategoryForUser(
            userId,
            'Health',
            categoryName,
          );

        const date = new Date(
          metric.startDateTime +
            (metric.startDateTime.endsWith('Z') ? '' : 'Z'),
        );

        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          category?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          `${metric.value} ${categoryName}`,
          {
            vo2max: metric.value,
            date: date,
            external: {
              provider: 'apple_health',
              id: metric.id,
              type: 'metric',
            },
          },
          {
            vo2max: DATA_TYPE.NUMBER,
            date: DATA_TYPE.STRING,
            external: {
              provider: DATA_TYPE.STRING,
              id: DATA_TYPE.STRING,
              type: DATA_TYPE.STRING,
            },
          },
          userId,
        );
      }
    }
  }

  private async processStepsData(
    userId: string,
    stepsData: AppleHealthSteps[],
  ): Promise<void> {
    for (const steps of stepsData) {
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(
          userId,
          'Health',
          'Steps',
        );

      const date = new Date(
        steps.startDateTime + (steps.startDateTime.endsWith('Z') ? '' : 'Z'),
      );

      await this.persistence.upsertListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${steps.value} steps`,
        {
          steps: steps.value,
          date: date,
          distance: steps.distance ? steps.distance / 1609.344 : 0, // meters to miles
          external: { provider: 'apple_health', id: steps.id, type: 'steps' },
        },
        {
          steps: DATA_TYPE.NUMBER,
          date: DATA_TYPE.STRING,
          distance: DATA_TYPE.NUMBER,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processHeartRateData(
    userId: string,
    heartRateData: AppleHealthHeartRate[],
  ): Promise<void> {
    for (const hr of heartRateData) {
      const categoryName = 'Heart Rate';
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(
          userId,
          'Health',
          categoryName,
        );

      const date = new Date(
        hr.startDateTime + (hr.startDateTime.endsWith('Z') ? '' : 'Z'),
      );

      await this.persistence.upsertListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${hr.value} bpm`,
        {
          bpm: hr.value,
          date: date,
          context: hr.context ?? null,
          external: { provider: 'apple_health', id: hr.id, type: 'heart_rate' },
        },
        {
          bpm: DATA_TYPE.NUMBER,
          date: DATA_TYPE.STRING,
          context: DATA_TYPE.STRING,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processSleepData(
    userId: string,
    sleepData: AppleHealthSleep[],
  ): Promise<void> {
    for (const sleep of sleepData) {
      const categoryName = 'Sleep';
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(
          userId,
          'Health',
          categoryName,
        );

      const date = new Date(
        sleep.startDateTime + (sleep.startDateTime.endsWith('Z') ? '' : 'Z'),
      );
      const sleepType = this.mapSleepType(sleep.type);
      const durationMinutes =
        sleep.unit === 'HOUR' ? sleep.value * 60 : sleep.value;
      const durationFormatted = this.formatDuration(durationMinutes);

      await this.persistence.upsertListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        durationFormatted,
        {
          duration: durationMinutes,
          // durationMinutes: durationMinutes,
          date: date,
          sleepType: sleepType,
          sleep: durationMinutes,
          external: { provider: 'apple_health', id: sleep.id, type: 'sleep' },
        },
        {
          duration: DATA_TYPE.NUMBER,
          // durationMinutes: DATA_TYPE.NUMBER,
          date: DATA_TYPE.STRING,
          sleepType: DATA_TYPE.STRING,
          sleep: DATA_TYPE.NUMBER,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processMilesData(
    userId: string,
    milesData: AppleHealthMiles[],
  ) {
    for (const miles of milesData) {
      const categoryName = 'Miles';
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(
          userId,
          'Health',
          categoryName,
        );

      const value = miles.value / 1609.344;
      const date = new Date(
        miles.startDateTime + (miles.startDateTime.endsWith('Z') ? '' : 'Z'),
      );

      await this.persistence.upsertListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${value} miles`,
        {
          miles: value,
          date: date,
          external: { provider: 'apple_health', id: miles.id, type: 'miles' },
        },
        {
          miles: DATA_TYPE.NUMBER,
          date: DATA_TYPE.STRING,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private mapWorkoutType(workoutType: string): string {
    if (!workoutType) return 'Other';

    const normalized = workoutType.trim().toLowerCase();

    // Maps categories → arrays of possible identifiers
    const categories: Record<string, string[]> = {
      Run: [
        'run',
        'running',
        'running_treadmill',
        'hkworkoutactivitytyperunning',
      ],
      Walk: ['walk', 'walking', 'hkworkoutactivitytypewalking'],
      Bike: [
        'bike',
        'cycling',
        'cycle',
        'biking',
        'hkworkoutactivitytypecycling',
      ],
      Swim: [
        'swim',
        'swimming',
        'swimming_open_water',
        'open_water',
        'hkworkoutactivitytypeswimming',
      ],
      Strength: [
        'strength',
        'strength_training',
        'weight_training',
        'hkworkoutactivitytypestrengthtraining',
      ],
      Hike: ['hike', 'hiking', 'hkworkoutactivitytypehiking'],
      Tennis: ['tennis', 'hkworkoutactivitytypetennis'],
      Yoga: ['yoga'],
      GroupSport: [
        'soccer',
        'cricket',
        'basketball',
        'volleyball',
        'football',
        'rugby',
        'hockey',
        'badminton',
        'american_football',
        'american football',
        'americanfootball',
        'golf',
        'paddling',
        'rowing',
        'squash',
        'lacrosse',
        'baseball',
        'martial_arts',
        'martial arts',
        'martialarts',
        'kickboxing',
        'boxing',
        'racquetball',
        'table_tennis',
        'table tennis',
        'tabletennis',
        'netball',
        'trapski',
        'skateboarding',
        'skating',
        'crossfit',
        'crossfit_wod',
        'crossfitwod',
        'gymnastics',
        'crossfit wod',
        'pickleball',
      ],
      Other: ['other'],
    };

    // Try to match
    for (const category of Object.keys(categories)) {
      const matchList = categories[category];
      if (matchList.some((key) => normalized.includes(key))) {
        return category === 'GroupSport' ? 'Group Sport' : category;
      }
    }

    return 'Other';
  }

  private mapMetricType(metricType: string): string {
    const typeMap: Record<string, string> = {
      HKQuantityTypeIdentifierBodyMass: 'Weight',
      HKQuantityTypeIdentifierHeight: 'Height',
      HKQuantityTypeIdentifierBodyFatPercentage: 'Body Fat',
      HKQuantityTypeIdentifierLeanBodyMass: 'Lean Body Mass',
      HKQuantityTypeIdentifierBodyMassIndex: 'BMI',
      HKQuantityTypeIdentifierBloodPressureSystolic:
        'Blood Pressure (Systolic)',
      HKQuantityTypeIdentifierBloodPressureDiastolic:
        'Blood Pressure (Diastolic)',
      HKQuantityTypeIdentifierRestingHeartRate: 'Resting Heart Rate',
      HKQuantityTypeIdentifierVO2Max: 'VO2 Max',
    };

    return typeMap[metricType] || 'Other Health Metric';
  }

  private mapSleepType(sleepType: string): string {
    const typeMap: Record<string, string> = {
      SLEEP_ASLEEP: 'Asleep',
      SLEEP_AWAKE: 'Awake',
      SLEEP_REM: 'REM',
      SLEEP_DEEP: 'Deep Sleep',
      SLEEP_CORE: 'Core Sleep',
      SLEEP_IN_BED: 'In Bed',
    };

    return typeMap[sleepType] || sleepType.replace(/_/g, ' ');
  }

  private formatDuration(minutes: number): string {
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Disconnecting Apple Health',
      data: {
        service: AppleHealthProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    // Note: Apple Health is a device-based integration that doesn't use OAuth
    // Data is uploaded directly from the user's iOS device using HealthKit
    // There are no tokens to revoke with Apple - the user controls access through iOS settings

    // Delete temporary upload tokens from our system
    await this.tokens.delete(userId, 'apple_health');

    // Mark user integration as disconnected
    const integration =
      await this.persistence.ensureIntegration('apple_health');
    const link = await this.db.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
      },
    });

    if (link) {
      await this.db.userIntegrations.update({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: link.userIntegrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
        },
        data: { status: STATUS.DISCONNECTED },
      });
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Apple Health disconnect completed',
      data: {
        service: AppleHealthProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }
}
