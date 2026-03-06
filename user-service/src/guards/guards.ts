import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  userId: string;
  phoneNumber?: string | null;
  email?: string | null;
}
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: {
          uid: string;
          userId: string;
          phoneNumber?: string | null;
          email?: string | null;
        };
      }
    >();

    const rawHeader =
      req.headers['authorization'] ?? req.headers['access_token'];
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('No access token provided');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const accessSecret = this.configService.get<string>('JWT_SECRET');

    const verifyToken = (secret?: string) => {
      if (!secret) return undefined;
      try {
        return this.jwtService.verify<JwtPayload>(token, { secret });
      } catch {
        return undefined;
      }
    };

    const decoded = verifyToken(accessSecret);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      throw new UnauthorizedException('Unauthorized');
    }

    req.user = {
      uid: decoded.userId,
      userId: decoded.userId,
      phoneNumber: decoded.phoneNumber ?? null,
      email: decoded.email ?? null,
    };

    return true;
  }
}
