import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { Metadata } from '../../../constants';

export class ListEntity {
  @ApiProperty({ example: 'listId', description: 'List id' })
  @IsString()
  listId: string;

  @ApiProperty({ example: 'My List', description: 'List name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 0, description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'A', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'A', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'system', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class ListListEntity {
  @ApiProperty({ type: [ListEntity] })
  data: ListEntity[];

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
