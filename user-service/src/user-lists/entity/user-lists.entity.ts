import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Metadata } from '../../../constants';

export class UserListIntegrationRefEntity {
  @ApiProperty()
  userListIntegrationId: string;

  @ApiProperty()
  recSeq: number;

  @ApiProperty()
  recStatus: string;

  @ApiProperty()
  userListId: string;

  @ApiProperty()
  userListRecSeq: number;

  @ApiProperty()
  integrationId: string;

  @ApiProperty()
  integrationRecSeq: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  connectedAt?: Date | null;

  @ApiProperty()
  dataStatus: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdOn: Date;

  @ApiProperty()
  modifiedOn: Date;

  @ApiPropertyOptional()
  modifiedBy?: string | null;
}

export class UserListEntity {
  @ApiProperty()
  userListId: string;

  @ApiProperty()
  recSeq: number;

  @ApiProperty()
  recStatus: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userRecSeq: number;

  @ApiProperty()
  listId: string;

  @ApiProperty()
  listRecSeq: number;

  @ApiPropertyOptional()
  customName?: string | null;

  @ApiProperty()
  dataStatus: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdOn: Date;

  @ApiProperty()
  modifiedOn: Date;

  @ApiPropertyOptional()
  modifiedBy?: string | null;

  @ApiProperty({ type: [UserListIntegrationRefEntity] })
  integrations: UserListIntegrationRefEntity[];
}

export class UserListListEntity {
  @ApiProperty({ type: [UserListEntity] })
  data: UserListEntity[];

  @ApiProperty({
    type: 'object',
    properties: {
      pageNumber: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      totalCount: { type: 'number', example: 100 },
    },
  })
  metadata: Metadata;
}
