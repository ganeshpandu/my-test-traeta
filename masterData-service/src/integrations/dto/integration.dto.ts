import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateIntegrationDto {
  @ApiProperty({
    example: 'Google Drive',
    description: 'Integration name',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Popularity rank/score',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  popularity?: number;
}

export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {}

export class IntegrationFilterDto {
  @ApiPropertyOptional({
    example: 'Slack',
    description: 'Filter by integration name',
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
