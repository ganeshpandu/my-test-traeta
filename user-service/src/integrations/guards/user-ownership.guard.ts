import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Guard to ensure users can only access their own data
 * Validates that the userId in the request matches the authenticated user's uid
 */
@Injectable()
export class UserOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authenticatedUser = request.user;

    if (!authenticatedUser || !authenticatedUser.uid) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract userId from body or query params
    const userId = request.body?.userId || request.query?.userId;

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // Verify that the userId matches the authenticated user's uid
    if (userId !== authenticatedUser.uid) {
      throw new ForbiddenException(
        'You are not authorized to access this resource',
      );
    }

    return true;
  }
}
