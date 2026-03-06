import { ApiProperty } from '@nestjs/swagger';

export class IntegrationErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid provider or userId',
  })
  message: string;

  @ApiProperty({
    description: 'Error type or code',
    example: 'BAD_REQUEST',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2025-01-15T10:30:00.000Z',
    required: false,
  })
  timestamp?: string;

  @ApiProperty({
    description: 'Request path that caused the error',
    example: '/integrations/spotify/connect',
    required: false,
  })
  path?: string;
}
