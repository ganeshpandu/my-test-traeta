import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
} from 'class-validator';

export class CreateListItemDto {
  @ApiProperty({
    example: 'uuid-of-list',
    description: 'Foreign key: Lists.listId',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  listId: string;

  @ApiPropertyOptional({
    example: 'uuid-of-userlist',
    description: 'Foreign key: UserLists.userListId',
  })
  @IsOptional()
  @IsString()
  userListId?: string | null;

  @ApiPropertyOptional({
    example: 'uuid-of-category',
    description: 'Foreign key: ItemCategories.categoryId',
  })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({
    example: 'Buy milk',
    description: 'Item title (max 50 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string | null;

  @ApiPropertyOptional({
    example: '2 liters whole milk',
    description: 'Notes (max 50 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether item is starred',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  })
  starred?: boolean;

  @ApiPropertyOptional({
    example: {
      priority: 'high',
      startTime: '2025-10-22T12:00:00',
      endTime: '2025-10-22T12:00:00',
    },
    description: 'Arbitrary attributes as JSON',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return {};
    return typeof value === 'string' ? JSON.parse(value) : value;
  })
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Array of files to upload',
  })
  @Transform(({ value }) => {
    if (!value) return null;
    return value;
  })
  @IsOptional()
  images?: any[];

  @ApiPropertyOptional({
    example: { title: 'string' },
    description: 'Attribute data types as JSON',
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => (value ? JSON.parse(value) : null))
  attributeDataType?: Record<string, any> | null;

  @ApiPropertyOptional({
    example: { qty: 'pcs' },
    description: 'Units as JSON',
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => (value ? JSON.parse(value) : null))
  unit?: Record<string, any> | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether item is custom',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  })
  isCustom?: boolean;
}

export class UpdateListItemDto extends PartialType(CreateListItemDto) {}

export class CreateListItemsBulkDto {
  @ApiProperty({ type: [CreateListItemDto] })
  items!: CreateListItemDto[];
}

export class ListItemFilterDto {
  @ApiProperty({
    example: 'uuid-of-userlist',
    description: 'Filter by userListId',
  })
  @IsString()
  userListId: string;

  @ApiProperty({
    example: 'uuid-of-list',
    description: 'Filter by listId',
  })
  @IsString()
  listId: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by starred' })
  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  @ApiPropertyOptional({
    example: '2025-10-22T12:00:00',
    description: 'Filter by startTime',
  })
  @IsOptional()
  @IsString()
  startTime?: string | null;

  @ApiPropertyOptional({
    example: '2025-10-22T12:00:00',
    description: 'Filter by endTime',
  })
  @IsOptional()
  @IsString()
  endTime?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
  })
  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page for pagination',
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 330,
    description: 'Timezone offset in minutes',
  })
  @IsOptional()
  @IsNumber()
  timezoneOffsetMinutes?: number;

  @ApiPropertyOptional({
    example: 'Asia/Kolkata',
    description: 'Timezone name',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ListItemsByDateFilterDto {
  @ApiProperty({
    example: 'uuid-of-userlist',
    description: 'Filter by userListId',
  })
  @IsString()
  @IsNotEmpty()
  userListId: string;

  @ApiProperty({
    example: 'uuid-of-list',
    description: 'Filter by listId',
  })
  @IsString()
  @IsNotEmpty()
  listId: string;

  @ApiProperty({
    example: '2025-10-22T12:00:00',
    description: 'Filter by startTime',
  })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    example: '2025-10-22T12:00:00',
    description: 'Filter by endTime',
  })
  @IsString()
  @IsNotEmpty()
  endTime: string;
}

export class DeleteListItemDto {
  @ApiProperty({
    example: ['uuid1', 'uuid2'],
    description: 'Array of list item ids to delete',
  })
  @IsNotEmpty()
  listItemIds: string[];
}
