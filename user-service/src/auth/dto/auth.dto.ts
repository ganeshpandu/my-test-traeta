//dto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SignDto {
  @ApiPropertyOptional({ description: 'Method' })
  @IsOptional()
  @IsString()
  method?: 'phone' | 'google';

  @ApiPropertyOptional({ description: 'ID token' })
  @IsOptional()
  @IsString()
  idToken?: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Access token' })
  @IsOptional()
  @IsString()
  accessToken?: string;
}
