import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Response } from '../../constants';
import { PrismaService } from '@traeta/prisma';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';

interface UpdateEntityInput {
  dbname: string;
  tablename: string;
  updateData: Record<string, any>;
  primaryKeyCriteria: Partial<Record<string, any>>;
  requestId: string;
  username: string;
}

interface UpdateEntityDbResponseRow {
  response: { status: number; message: unknown } | null;
}

@Injectable()
export class UtilityService {
  private storage: Storage;
  private bucketName: string;
  constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
    const cred = this.configService.get<string>('GCP_CREDENTIALS');
    if (!cred) {
      throw new Error('GCP_CREDENTIALS environment variable is not set');
    }
    const credentials = JSON.parse(cred);
    this.storage = new Storage({
      projectId: this.configService.get<string>('GCS_PROJECT_ID'),
      credentials: credentials,
    });
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME')!;
  }

  buildFilter(
    rawFilter: Record<string, any>,
    excludeKeys: string[],
  ): Record<string, any> {
    const filters: Record<string, any> = {};
    for (const key in rawFilter) {
      if (
        Object.prototype.hasOwnProperty.call(rawFilter, key) &&
        !excludeKeys.includes(key) &&
        rawFilter[key] !== undefined &&
        rawFilter[key] !== null &&
        rawFilter[key] !== ''
      ) {
        const value = (rawFilter as Record<string, unknown>)[key];
        filters[key] = Array.isArray(value) ? { in: value } : value;
      }
    }
    return filters;
  }

  async updateEntity(
    updateEntityInput: UpdateEntityInput,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    try {
      const data = await this.prisma.$queryRawUnsafe<
        UpdateEntityDbResponseRow[]
      >(
        `
        SELECT updateEntity(
          $1::text,
          $2::text,
          $3::jsonb,
          $4::jsonb,
          $5::text,
          $6::text
        ) AS response
      `,
        updateEntityInput.dbname,
        updateEntityInput.tablename,
        JSON.stringify(updateEntityInput.updateData),
        JSON.stringify(updateEntityInput.primaryKeyCriteria),
        updateEntityInput.requestId,
        updateEntityInput.username,
      );

      // Our function returns a JSONB object {status, message}
      const responsePart = data[0]?.response;

      if (!responsePart || typeof responsePart.status !== 'number') {
        response.status = HttpStatus.INTERNAL_SERVER_ERROR;
        response.data = 'Unexpected response from updateEntity';
        return response;
      }

      response.status = responsePart.status as HttpStatus;
      if (responsePart.status === 400 || responsePart.status === 500) {
        response.data = String(responsePart.message);
      } else {
        // message holds the updated row JSON
        const parsedMessage: unknown =
          typeof responsePart.message === 'string'
            ? (JSON.parse(responsePart.message) as unknown)
            : responsePart.message;
        response.data = parsedMessage;
      }

      return response;
    } catch (error) {
      response.status = HttpStatus.INTERNAL_SERVER_ERROR;
      response.data = (error as Error).message;
      return response;
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileName = `${uuid.v4()}-${path.basename(file.originalname)}`;
    const blob = bucket.file(fileName);

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    return fileName;
  }

  async getSignedUrl(fileName: string, expiresInMinutes = 15): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000, // URL expires in 15 minutes by default
      });

      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }
}
