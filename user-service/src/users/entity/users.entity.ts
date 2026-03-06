import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Gender } from '../../../constants';
import type { Gender as PrismaGender } from '@prisma/client';

export class UsersEntity {
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
  dateOfBirth?: Date | string | null;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  gender?: Gender | PrismaGender | null;

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
