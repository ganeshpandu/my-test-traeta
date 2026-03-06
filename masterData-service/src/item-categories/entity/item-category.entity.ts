import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Metadata } from '../../../constants';

export class ItemCategoryEntity {
  @ApiProperty({ example: 'listCategoryId', description: 'Item category id' })
  @IsString()
  itemCategoryId: string;

  @ApiProperty({ example: 0, description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'A', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'UUID-of-list', description: 'Parent list id' })
  @IsString()
  listId: string;

  @ApiProperty({ example: 0, description: 'Parent list rec seq' })
  @IsInt()
  @IsOptional()
  listRecSeq?: number | null;

  @ApiProperty({ example: 'Groceries', description: 'Category name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'A', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'system', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class ItemCategoryListEntity {
  @ApiProperty({ type: [ItemCategoryEntity] })
  data: ItemCategoryEntity[];

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
