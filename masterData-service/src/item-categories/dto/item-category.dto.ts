import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
} from 'class-validator';

export class CreateItemCategoryDto {
  @ApiProperty({
    example: 'UUID-of-list',
    description: 'Parent list id',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  listId: string;

  @ApiProperty({
    example: 'Groceries',
    description: 'Category name',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class UpdateItemCategoryDto extends PartialType(CreateItemCategoryDto) {}

export class ItemCategoryFilterDto {
  @ApiPropertyOptional({
    example: 'UUID-of-list',
    description: 'Filter by parent list id',
  })
  @IsOptional()
  @IsString()
  listId?: string;

  @ApiPropertyOptional({
    example: 'Groceries',
    description: 'Filter by category name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

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
}
