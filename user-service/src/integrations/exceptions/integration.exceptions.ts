import { HttpException, HttpStatus } from '@nestjs/common';
import { PROVIDER_NAMINGS } from '../../../constants';

/**
 * Base exception for all integration-related errors
 */
export class IntegrationException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly provider?: string,
    public readonly errorCode?: string,
  ) {
    super(
      {
        statusCode,
        message,
        error: 'Integration Error',
        provider,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

/**
 * Thrown when a provider is not found or not supported
 */
export class ProviderNotFoundException extends IntegrationException {
  constructor(provider: string) {
    super(
      `Integration provider '${PROVIDER_NAMINGS[provider]}' is not supported or not found`,
      HttpStatus.NOT_FOUND,
      provider,
      'PROVIDER_NOT_FOUND',
    );
  }
}

/**
 * Thrown when a user is not connected to a provider
 */
export class ProviderNotConnectedException extends IntegrationException {
  constructor(provider: string) {
    super(
      `User is not connected to ${PROVIDER_NAMINGS[provider]}. Please connect first.`,
      HttpStatus.PRECONDITION_FAILED,
      provider,
      'PROVIDER_NOT_CONNECTED',
    );
  }
}

/**
 * Thrown when OAuth authentication fails
 */
export class OAuthAuthenticationException extends IntegrationException {
  constructor(provider: string, reason?: string) {
    const message = reason
      ? // ? `OAuth authentication failed for ${PROVIDER_NAMINGS[provider]}: ${reason}`
        `${reason}`
      : `OAuth authentication failed for ${PROVIDER_NAMINGS[provider]}`;
    super(message, HttpStatus.BAD_REQUEST, provider, 'OAUTH_AUTH_FAILED');
  }
}

/**
 * Thrown when access token is invalid or expired
 */
export class InvalidTokenException extends IntegrationException {
  constructor(provider: string, message?: string) {
    super(
      message ||
        `Access token for ${PROVIDER_NAMINGS[provider]} is invalid or expired. Please reconnect.`,
      HttpStatus.UNAUTHORIZED,
      provider,
      'INVALID_TOKEN',
    );
  }
}

/**
 * Thrown when refresh token is missing or invalid
 */
export class RefreshTokenException extends IntegrationException {
  constructor(provider: string) {
    super(
      `Unable to refresh access token for ${PROVIDER_NAMINGS[provider]}. Please reconnect.`,
      HttpStatus.UNAUTHORIZED,
      provider,
      'REFRESH_TOKEN_FAILED',
    );
  }
}

/**
 * Thrown when provider API call fails
 */
export class ProviderAPIException extends IntegrationException {
  constructor(provider: string, operation: string, reason?: string) {
    const message = reason
      ? `${PROVIDER_NAMINGS[provider]} API error during ${operation}: ${reason}`
      : `${PROVIDER_NAMINGS[provider]} API error during ${operation}`;
    super(message, HttpStatus.BAD_GATEWAY, provider, 'PROVIDER_API_ERROR');
  }
}

/**
 * Thrown when data sync fails
 */
export class DataSyncException extends IntegrationException {
  constructor(provider: string, reason?: string) {
    const message = reason
      ? `Failed to sync data from ${PROVIDER_NAMINGS[provider]}: ${reason}`
      : `Failed to sync data from ${PROVIDER_NAMINGS[provider]}`;
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      provider,
      'DATA_SYNC_FAILED',
    );
  }
}

/**
 * Thrown when required configuration is missing
 */
export class ConfigurationException extends IntegrationException {
  constructor(provider: string, missingConfig: string) {
    super(
      `Missing required configuration for ${PROVIDER_NAMINGS[provider]}: ${missingConfig}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      provider,
      'MISSING_CONFIGURATION',
    );
  }
}

/**
 * Thrown when callback payload is invalid
 */
export class InvalidCallbackException extends IntegrationException {
  constructor(provider: string, reason: string) {
    super(
      `Invalid callback payload for ${PROVIDER_NAMINGS[provider]}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      provider,
      'INVALID_CALLBACK',
    );
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitException extends IntegrationException {
  constructor(provider: string, retryAfter?: number) {
    const message = retryAfter
      ? `Rate limit exceeded for ${PROVIDER_NAMINGS[provider]}. Retry after ${retryAfter} seconds.`
      : `Rate limit exceeded for ${PROVIDER_NAMINGS[provider]}. Please try again later.`;
    super(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      provider,
      'RATE_LIMIT_EXCEEDED',
    );
  }
}

/**
 * Thrown when user data is not found
 */
export class UserDataNotFoundException extends IntegrationException {
  constructor(provider: string, dataType: string) {
    super(
      `No ${dataType} data found for ${PROVIDER_NAMINGS[provider]}`,
      HttpStatus.NOT_FOUND,
      provider,
      'USER_DATA_NOT_FOUND',
    );
  }
}

/**
 * Thrown when provider requires additional permissions
 */
export class InsufficientPermissionsException extends IntegrationException {
  constructor(provider: string, requiredScopes: string[]) {
    super(
      `Insufficient permissions for ${PROVIDER_NAMINGS[provider]}. Required scopes: ${requiredScopes.join(', ')}`,
      HttpStatus.FORBIDDEN,
      provider,
      'INSUFFICIENT_PERMISSIONS',
    );
  }
}

/**
 * Thrown when upload token is invalid
 */
export class InvalidUploadTokenException extends IntegrationException {
  constructor(provider: string) {
    super(
      `Invalid or expired upload token for ${PROVIDER_NAMINGS[provider]}`,
      HttpStatus.UNAUTHORIZED,
      provider,
      'INVALID_UPLOAD_TOKEN',
    );
  }
}

/**
 * Thrown when data validation fails
 */
export class DataValidationException extends IntegrationException {
  constructor(provider: string, reason: string) {
    super(
      `Data validation failed for ${PROVIDER_NAMINGS[provider]}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      provider,
      'DATA_VALIDATION_FAILED',
    );
  }
}
