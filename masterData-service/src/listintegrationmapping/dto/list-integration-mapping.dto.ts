import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateListIntegrationMappingDto {
  @ApiProperty({ description: 'List ID', example: 'list-uuid' })
  @IsString()
  listId: string;

  @ApiProperty({ description: 'Integration ID', example: 'integration-uuid' })
  @IsString()
  integrationId: string;
}

export class UpdateListIntegrationMappingDto extends PartialType(
  CreateListIntegrationMappingDto,
) {}

export class ListIntegrationMappingFilterDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsInt()
  pageNumber?: number;

  @ApiPropertyOptional({ description: 'Page size', example: 10 })
  @IsOptional()
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by listId',
    example: 'list-uuid',
  })
  @IsOptional()
  @IsString()
  listId?: string;

  @ApiPropertyOptional({
    description: 'Filter by integrationId',
    example: 'integration-uuid',
  })
  @IsOptional()
  @IsString()
  integrationId?: string;
}
