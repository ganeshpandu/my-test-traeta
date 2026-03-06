// master-data.entity.ts
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Metadata } from '../../../constants';

export class MasterDataEntity {
  @ApiProperty({ example: 'masterDataId', description: 'Master data id' })
  @IsString()
  masterDataId: string;

  @ApiProperty({ example: 'recSeq', description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'recStatus', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'keyCode', description: 'Key code' })
  @IsString()
  keyCode: string;

  @ApiPropertyOptional({ example: 'value', description: 'Value' })
  @IsOptional()
  @IsString()
  value?: string | null;

  @ApiPropertyOptional({ example: 'parentId', description: 'Parent id' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ example: 'dataStatus', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'createdBy', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class MasterDataListEntity {
  @ApiProperty({ type: [MasterDataEntity] })
  data: MasterDataEntity[];

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
