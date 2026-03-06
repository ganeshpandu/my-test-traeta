import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Metadata } from '../../../constants';

export class ListItemEntity {
  @ApiProperty({ example: 'listItemId', description: 'List item id' })
  @IsString()
  listItemId: string;

  @ApiProperty({ example: 0, description: 'Record sequence' })
  @IsInt()
  recSeq: number;

  @ApiProperty({ example: 'A', description: 'Record status' })
  @IsString()
  recStatus: string;

  @ApiProperty({ example: 'listId', description: 'FK: Lists.listId' })
  @IsString()
  listId: string;

  @ApiProperty({ example: 0, description: 'FK: Lists.recSeq' })
  @IsInt()
  listRecSeq: number;

  @ApiPropertyOptional({
    example: 'listCategoryId',
    description: 'FK: ItemCategories.listCategoryId',
  })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 0, description: 'FK: ItemCategories.recSeq' })
  @IsOptional()
  @IsInt()
  categoryRecSeq?: number | null;

  @ApiPropertyOptional({
    example: 'userListId',
    description: 'FK: UserLists.userListId',
  })
  @IsOptional()
  @IsString()
  userListId?: string | null;

  @ApiPropertyOptional({ example: 0, description: 'FK: UserLists.recSeq' })
  @IsOptional()
  @IsInt()
  userListRecSeq?: number | null;

  @ApiPropertyOptional({ example: 'Buy milk', description: 'Title' })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ example: '2 liters', description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ example: false, description: 'Starred flag' })
  @IsBoolean()
  starred: boolean;

  @ApiProperty({ example: 'A', description: 'Data status' })
  @IsString()
  dataStatus: string;

  @ApiProperty({ example: 'system', description: 'Created by' })
  @IsString()
  createdBy: string;
}

export class ListItemListEntity {
  @ApiProperty({ type: [ListItemEntity] })
  data: ListItemEntity[];

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
