import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsInt,
  Min,
  ValidateIf,
  IsNotEmpty,
  Max,
} from 'class-validator';

export class ReportRequestDto {
  @ApiProperty({ enum: ['monthly', 'yearly'] })
  @IsString()
  @IsIn(['monthly', 'yearly'])
  type: 'monthly' | 'yearly';

  @ApiProperty({ example: 2024, description: 'Selected year' })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiPropertyOptional({ example: 1, description: 'Selected month (1-12)' })
  @ValidateIf((obj: ReportRequestDto) => obj.type === 'monthly')
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
