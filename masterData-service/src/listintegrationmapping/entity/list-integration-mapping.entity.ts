import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { Metadata } from '../../../constants';

export class ListIntegrationMappingEntity {
  @ApiProperty({
    example: 'listIntegrationMappingId',
    description: 'Mapping id',
  })
  @IsString()
  listIntegrationMappingId: string;

  @ApiProperty({ example: 0, description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'A', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'list-uuid', description: 'List id' })
  @IsString()
  listId: string;

  @ApiProperty({ example: 0, description: 'List record sequence' })
  @IsInt()
  listRecSeq: number;

  @ApiProperty({ example: 'integration-uuid', description: 'Integration id' })
  @IsString()
  integrationId: string;

  @ApiProperty({ example: 0, description: 'Integration record sequence' })
  @IsInt()
  integrationRecSeq: number;

  @ApiProperty({ example: 'A', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'system', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class ListIntegrationMappingListEntity {
  @ApiProperty({ type: [ListIntegrationMappingEntity] })
  data: ListIntegrationMappingEntity[];

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
