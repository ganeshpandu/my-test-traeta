import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Metadata } from '../../../constants';

export class IntegrationEntity {
  @ApiProperty({ example: 'integrationId', description: 'Integration id' })
  @IsString()
  integrationId: string;

  @ApiProperty({ example: 0, description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'A', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'Google Drive', description: 'Integration name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 10, description: 'Popularity rank/score' })
  @IsOptional()
  @IsInt()
  popularity?: number | null;

  @ApiProperty({ example: 'A', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'system', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class IntegrationListEntity {
  @ApiProperty({ type: [IntegrationEntity] })
  data: IntegrationEntity[];

  @ApiProperty({
    type: 'object',
    properties: {
      pageNumber: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      totalCount: { type: 'number', example: 100 },
    },
  })
  metadata: Metadata;
}
