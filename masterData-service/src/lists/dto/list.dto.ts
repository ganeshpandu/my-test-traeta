import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateListDto {
  @ApiProperty({ example: 'My List', description: 'List name', required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'List icon',
    required: false,
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  file?: Express.Multer.File;
}

export class UpdateListDto extends PartialType(CreateListDto) {}

export class ListFilterDto {
  @ApiPropertyOptional({
    example: 'Groceries',
    description: 'Filter by list name',
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
