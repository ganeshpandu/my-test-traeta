//entity
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../../../constants';

export class Users {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  recSeq: number;

  @ApiProperty()
  recStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  email?: string | null;

  @ApiProperty()
  phoneNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  username?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  tagline?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  dateOfBirth?: Date | null;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  gender?: Gender | null;

  @ApiPropertyOptional()
  @IsOptional()
  avatarId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  avatarRecSeq?: number | null;

  @ApiProperty()
  isProfileComplete: boolean;

  @ApiProperty()
  dataStatus: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdOn: Date;

  @ApiProperty()
  modifiedOn: Date;

  @ApiPropertyOptional()
  @IsOptional()
  modifiedBy?: string | null;
}

export class SignEntity {
  @ApiProperty({ type: () => Users })
  @Type(() => Users)
  user: Users;

  @ApiProperty()
  token: string;

  @ApiPropertyOptional()
  @IsOptional()
  count?: number;
}

export class RefreshEntity {
  @ApiProperty()
  accessToken: string;
}
