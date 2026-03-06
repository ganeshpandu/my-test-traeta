// master-data.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMasterDataDto {
  @ApiProperty({ example: 'keyCode', description: 'Key code', required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  keyCode: string;

  @ApiPropertyOptional({
    example: 'value',
    description: 'Value',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  value?: string;

  @ApiPropertyOptional({
    example: 'parentId',
    description: 'Parent id',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Avatar',
    required: false,
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  file?: Express.Multer.File;
}

export class UpdateMasterDataDto extends PartialType(CreateMasterDataDto) {}

export class MasterDataFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
