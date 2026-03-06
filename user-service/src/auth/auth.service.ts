//service
import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.config';
import { RefreshDto, SignDto } from './dto/auth.dto';
import {
  ACTIVE_CONDITION,
  MethodNames,
  REC_SEQ,
  Response,
  ActionStatus,
  ADMIN,
  RESPONSE_STATUS,
  EXPIRES_IN,
} from '../../constants';
import { HttpStatus } from '@nestjs/common';
import { RefreshEntity, SignEntity } from './entity/auth.entity';
import { TechvLogger } from 'techvedika-logger';
import { LogType } from '../../constants';
import { PrismaService } from '@traeta/prisma';
import { UserRecord } from 'firebase-admin/auth';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  userId: string;
  phoneNumber?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async verifyUser(signDto: SignDto): Promise<Response<SignEntity | string>> {
    const response: Response<SignEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'verifyUser',
      data: {
        service: AuthService.name,
        method: MethodNames.verifyUser,
      },
      input: signDto,
    });

    try {
      const { idToken } = signDto;

      if (!idToken || idToken === '') {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'No idToken found',
          data: {
            service: AuthService.name,
            method: MethodNames.verifyUser,
          },
          input: signDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      // Verify Firebase ID token
      let decodedToken;
      try {
        decodedToken = await this.firebaseService.auth.verifyIdToken(idToken);
      } catch (firebaseError) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Firebase token verification failed',
          data: {
            service: AuthService.name,
            method: MethodNames.verifyUser,
          },
          error:
            firebaseError instanceof Error
              ? firebaseError.message
              : 'Unknown Firebase error',
        });
        return {
          status: HttpStatus.FORBIDDEN,
          data: 'Invalid or expired Firebase token',
        };
      }
      const { uid } = decodedToken;

      const user = await this.prisma.users.findUnique({
        where: {
          userId_recSeq: { userId: uid, recSeq: REC_SEQ.DEFAULT_RECORD },
          ...ACTIVE_CONDITION,
        },
      });

      if (!user) {
        const userRecord: UserRecord =
          await this.firebaseService.auth.getUser(uid);

        const result = await this.prisma.users.create({
          data: {
            userId: uid,
            phoneNumber: userRecord.phoneNumber,
            ...ACTIVE_CONDITION,
            createdBy: ADMIN,
          },
        });

        const token = this.jwtService.sign(
          {
            userId: result.userId,
            phoneNumber: result.phoneNumber,
          },
          {
            secret: this.configService.get<string>('JWT_SECRET'),
            expiresIn: EXPIRES_IN,
          },
        );

        response.data = {
          user: result,
          token,
        } as SignEntity;
      } else {
        await this.prisma.loginActionHistory.create({
          data: {
            userId: user.userId,
            userRecSeq: user.recSeq || REC_SEQ.DEFAULT_RECORD,
            action: RESPONSE_STATUS.SIGNIN,
            actionStatus: ActionStatus.SUCCESS,
            reason:
              RESPONSE_STATUS.USER +
              RESPONSE_STATUS.SIGNIN +
              RESPONSE_STATUS.SUCCESSFUL,
            createdBy: ADMIN,
          },
        });

        const count = await this.prisma.loginActionHistory.count({
          where: {
            userId: user.userId,
            userRecSeq: user.recSeq || REC_SEQ.DEFAULT_RECORD,
            action: RESPONSE_STATUS.SIGNIN,
            actionStatus: ActionStatus.SUCCESS,
          },
        });

        const token = this.jwtService.sign(
          {
            userId: user.userId,
            phoneNumber: user.phoneNumber,
          },
          {
            secret: this.configService.get<string>('JWT_SECRET'),
            expiresIn: EXPIRES_IN,
          },
        );

        response.data = {
          user,
          token,
          count,
        } as SignEntity;
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'verified user successfully',
        data: {
          service: AuthService.name,
          method: MethodNames.verifyUser,
        },
        output: response.data,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'verified user failed',
        data: {
          service: AuthService.name,
          method: MethodNames.verifyUser,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  refreshToken(refreshTokenDto: RefreshDto): Response<RefreshEntity | string> {
    const response: Response<RefreshEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Refresh Token',
      data: {
        service: AuthService.name,
        method: MethodNames.refreshToken,
      },
      output: response.data,
    });

    try {
      // Validate input explicitly to match test expectations
      if (typeof refreshTokenDto.accessToken === 'undefined') {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Refresh Token failed',
          data: {
            service: AuthService.name,
            method: MethodNames.refreshToken,
          },
          input: refreshTokenDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      if (refreshTokenDto.accessToken === '') {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'No access token',
          data: {
            service: AuthService.name,
            method: MethodNames.refreshToken,
          },
          input: refreshTokenDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.REQUIRED,
        };
      }

      let decoded;
      try {
        decoded = this.jwtService.verify<JwtPayload>(
          refreshTokenDto.accessToken,
          {
            ignoreExpiration: true,
          },
        );
      } catch (firebaseError) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Firebase token verification failed',
          data: {
            service: AuthService.name,
            method: MethodNames.refreshToken,
          },
          error:
            firebaseError instanceof Error
              ? firebaseError.message
              : 'Unknown Firebase error',
        });
        return {
          status: HttpStatus.UNAUTHORIZED,
          data: 'Invalid or expired Firebase token',
        };
      }

      if (!decoded) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Invalid access token',
          data: {
            service: AuthService.name,
            method: MethodNames.refreshToken,
          },
          input: refreshTokenDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.INVALID,
        };
      }

      const newAccessToken = this.jwtService.sign(
        {
          userId: decoded.userId,
          phoneNumber: decoded.phoneNumber ?? undefined,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: EXPIRES_IN,
        },
      );

      response.data = { accessToken: newAccessToken };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Refresh Token successful',
        data: {
          service: AuthService.name,
          method: MethodNames.refreshToken,
        },
        output: response.data,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Refresh Token failed',
        data: {
          service: AuthService.name,
          method: MethodNames.refreshToken,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  logout(logoutDto: RefreshDto): Response<string> {
    const response: Response<string> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Logout',
      data: {
        service: AuthService.name,
        method: MethodNames.logout,
      },
      output: response.data,
    });

    try {
      if (typeof logoutDto.accessToken === 'undefined') {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Logout failed',
          data: {
            service: AuthService.name,
            method: MethodNames.logout,
          },
          input: logoutDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      if (logoutDto.accessToken === '') {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'No access token',
          data: {
            service: AuthService.name,
            method: MethodNames.logout,
          },
          input: logoutDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.REQUIRED,
        };
      }

      const decoded = this.jwtService.verify<JwtPayload>(
        logoutDto.accessToken,
        {
          ignoreExpiration: true,
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        },
      );

      if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Invalid access token',
          data: {
            service: AuthService.name,
            method: MethodNames.logout,
          },
          input: logoutDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.INVALID,
        };
      }
      const uid = decoded.userId;

      response.data =
        RESPONSE_STATUS.USER +
        RESPONSE_STATUS.LOGOUT +
        RESPONSE_STATUS.SUCCESSFUL;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Logout successful',
        data: { service: AuthService.name, method: MethodNames.logout },
        input: { uid },
        output: response.data,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Logout failed',
        data: {
          service: AuthService.name,
          method: MethodNames.logout,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
