import { Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { REC_SEQ, PROVIDER_NAMINGS } from '../../constants';

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  altitude?: number;
  speed?: number;
}

export interface LocationDataPayload {
  locations: LocationData[];
  submittedAt?: Date;
}

/**
 * Database-backed storage for location data submitted by clients
 * Stores location data in the LocationDataSubmissions table until processed by sync
 */
@Injectable()
export class LocationDataStore {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get unprocessed location data for a user and provider
   */
  async get(
    userId: string,
    provider: string,
  ): Promise<LocationDataPayload | null> {
    // Get the integration ID for the provider
    const integration = await this.prisma.integrations.findFirst({
      where: { name: provider },
    });

    if (!integration) {
      return null;
    }

    // Find the most recent unprocessed submission
    const submission = await this.prisma.locationDataSubmissions.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: integration.recSeq,
        processed: false,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    if (!submission) {
      return null;
    }

    // Parse the JSON data
    const locationData = submission.locationData as any;

    return {
      locations: Array.isArray(locationData) ? locationData : [],
      submittedAt: submission.submittedAt,
    };
  }

  /**
   * Store location data for a user and provider
   */
  async set(
    userId: string,
    provider: string,
    data: LocationDataPayload,
  ): Promise<void> {
    // Get the integration ID for the provider
    const integration = await this.prisma.integrations.findFirst({
      where: { name: provider },
    });

    if (!integration) {
      throw new Error(`Integration not found: ${PROVIDER_NAMINGS[provider]}`);
    }

    // Store the location data
    await this.prisma.locationDataSubmissions.create({
      data: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: integration.recSeq,
        locationData: data.locations as any,
        submittedAt: data.submittedAt || new Date(),
        processed: false,
      },
    });
  }

  /**
   * Mark location data as processed
   */
  async markProcessed(userId: string, provider: string): Promise<void> {
    // Get the integration ID for the provider
    const integration = await this.prisma.integrations.findFirst({
      where: { name: provider },
    });

    if (!integration) {
      return;
    }

    // Mark all unprocessed submissions as processed
    await this.prisma.locationDataSubmissions.updateMany({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: integration.recSeq,
        processed: false,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Delete processed location data (cleanup)
   */
  async deleteProcessed(userId: string, provider: string): Promise<void> {
    // Get the integration ID for the provider
    const integration = await this.prisma.integrations.findFirst({
      where: { name: provider },
    });

    if (!integration) {
      return;
    }

    // Delete processed submissions older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await this.prisma.locationDataSubmissions.deleteMany({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: integration.recSeq,
        processed: true,
        processedAt: {
          lt: sevenDaysAgo,
        },
      },
    });
  }
}
