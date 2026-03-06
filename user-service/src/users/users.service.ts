import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { UpdateUserDto } from './dto/users.dto';
import {
  MethodNames,
  LogType,
  Response,
  RESPONSE_STATUS,
  ACTIVE_CONDITION,
  REC_SEQ,
  DB_NAME,
  TABLE_NAMES,
  REC_STATUS,
  ADMIN,
} from '../../constants';
import { FirebaseService } from '../firebase/firebase.config';
import { UsersEntity } from './entity/users.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
    private readonly firebaseService: FirebaseService,
  ) { }

  // Add this method to the UsersService class
  private async ensureUserLists(userId: string): Promise<void> {
    try {
      // Get all available lists
      const allLists = await this.prismaService.lists.findMany({
        where: { ...ACTIVE_CONDITION },
      });

      if (!allLists.length) return;

      // Get user's existing lists
      const userLists = await this.prismaService.userLists.findMany({
        where: {
          userId,
          ...ACTIVE_CONDITION,
          list: { ...ACTIVE_CONDITION },
        },
        include: {
          list: true,
        },
      });

      const existingListIds = new Set(userLists.map((ul) => ul.listId));

      // Find lists that need to be created
      const listsToCreate = allLists.filter(
        (list) => !existingListIds.has(list.listId),
      );

      // Create missing user lists
      for (const list of listsToCreate) {
        await this.prismaService.userLists.create({
          data: {
            userId,
            listId: list.listId,
            customName: list.name,
            createdBy: userId,
            modifiedBy: userId,
            ...ACTIVE_CONDITION,
          },
        });
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error ensuring user lists',
        data: {
          service: UsersService.name,
          method: 'ensureUserLists',
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'users',
      data: {
        service: UsersService.name,
        method: MethodNames.update,
      },
      input: updateUserDto,
    });
    try {
      const existingUser = await this.prismaService.users.findUnique({
        where: {
          userId_recSeq: {
            userId: userId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingUser) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'User Not Found',
          data: {
            service: UsersService.name,
            method: MethodNames.update,
          },
          input: updateUserDto,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const existingUsername = await this.prismaService.users.findFirst({
        where: {
          username: updateUserDto.username,
          userId: { not: userId },
          ...ACTIVE_CONDITION,
        },
      });
      if (existingUsername) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Username Already Exists',
          data: {
            service: UsersService.name,
            method: MethodNames.update,
          },
          input: updateUserDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.USERNAME + RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.USERS,
        updateData: { ...updateUserDto, modifiedBy: ADMIN },
        primaryKeyCriteria: { userId: userId },
        requestId: ADMIN,
        username: ADMIN,
      });

      await this.ensureUserLists(userId);

      // Check if profile is complete after update
      const updatedUser = await this.prismaService.users.findUnique({
        where: {
          userId_recSeq: {
            userId: userId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });

      if (updatedUser) {
        const isProfileComplete = !!(
          updatedUser.firstName &&
          updatedUser.lastName &&
          updatedUser.username
        );

        // Update isProfileComplete if it has changed
        if (updatedUser.isProfileComplete !== isProfileComplete) {
          await this.prismaService.users.update({
            where: {
              userId_recSeq: {
                userId: userId,
                recSeq: REC_SEQ.DEFAULT_RECORD,
              },
              ...ACTIVE_CONDITION,
            },
            data: {
              isProfileComplete: isProfileComplete,
            },
          });

          this.loggerInstance.logger(LogType.INFO, {
            message: 'Profile completion status updated',
            data: {
              service: UsersService.name,
              method: MethodNames.update,
              userId: userId,
              isProfileComplete: isProfileComplete,
            },
          });

          // Update the response data with the new isProfileComplete value
          if (updatedStatus.data && typeof updatedStatus.data === 'object') {
            updatedStatus.data.isProfileComplete = isProfileComplete;
          }
        }
      }

      response.data = updatedStatus;
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update',
        data: {
          service: UsersService.name,
          method: MethodNames.update,
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

  async findUnique(userId: string): Promise<Response<UsersEntity | string>> {
    const response: Response<UsersEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'findUnique',
      data: {
        service: UsersService.name,
        method: MethodNames.findUnique,
      },
      input: { userId },
    });
    try {
      const existingUser = await this.prismaService.users.findUnique({
        where: {
          userId_recSeq: {
            userId: userId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        include: {
          avatar: {
            select: {
              masterDataId: true,
              keyCode: true,
              value: true,
            },
          },
        },
      });
      let signedIconUrl;
      try {
        if (
          existingUser.avatar.value &&
          existingUser.avatar.keyCode == 'AVATAR'
        ) {
          signedIconUrl = await this.utilityService.getSignedUrl(
            existingUser.avatar.value,
          );
        }
      } catch (error) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Error generating signed URL for avatar',
          data: {
            service: UsersService.name,
            method: MethodNames.findUnique,
          },
          error:
            error instanceof Error
              ? { message: error.message }
              : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
        });
      }
      if (!existingUser) {
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const user = existingUser
        ? {
          ...existingUser,
          dateOfBirth: existingUser.dateOfBirth
            ? this.utilityService.formatDate(existingUser.dateOfBirth)
            : null,
          avatar: {
            ...existingUser.avatar,
            value: signedIconUrl?.url,
          },
        }
        : existingUser;
      response.data = user as UsersEntity;
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'findUnique',
        data: {
          service: UsersService.name,
          method: MethodNames.findUnique,
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

  async delete(userId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete',
      data: {
        service: UsersService.name,
        method: MethodNames.delete,
      },
      input: { userId },
    });
    try {
      const existingUser = await this.prismaService.users.findUnique({
        where: {
          userId_recSeq: {
            userId: userId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingUser) {
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      if (existingUser.email) {
        try {
          const fbUser = await this.firebaseService.auth.getUserByEmail(
            existingUser.email,
          );
          await this.firebaseService.auth.deleteUser(fbUser.uid);
        } catch (fbErr) {
          const code = (fbErr as { code?: string })?.code;
          if (code !== 'auth/user-not-found') {
            this.loggerInstance.logger(LogType.ERROR, {
              message: 'delete: firebase deleteUser failed',
              data: {
                service: UsersService.name,
                method: MethodNames.delete,
                email: existingUser.email,
              },
              error:
                fbErr instanceof Error
                  ? fbErr.message
                  : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
            });
            return {
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
            };
          }
        }
      }
      await this.prismaService.$transaction(async (tx) => {
        const maxRec = await tx.users.findFirst({
          where: { userId },
          select: { recSeq: true },
          orderBy: { recSeq: 'desc' },
        });
        const nextRecSeq = (maxRec?.recSeq ?? 0) + 1;
        this.loggerInstance.logger(LogType.INFO, {
          message: 'delete: computed nextRecSeq',
          data: { userId, nextRecSeq },
        });

        await tx.users.create({
          data: {
            userId: userId,
            recSeq: nextRecSeq,
            recStatus: REC_STATUS.DELETED,
            email: existingUser.email ? `deleted+${userId}@delete.com` : null,
            phoneNumber: '',
            firstName: null,
            lastName: null,
            username: existingUser.username ? `deleted_${userId}` : null,
            tagline: null,
            dateOfBirth: null,
            gender: null,
            avatarId: null,
            avatarRecSeq: null,
            isProfileComplete: false,
            modifiedBy: ADMIN,
          },
        });
        this.loggerInstance.logger(LogType.INFO, {
          message: 'delete: created archived user',
          data: { userId, nextRecSeq },
        });

        await tx.userIntegrations.updateMany({
          where: { userId, userRecSeq: REC_SEQ.DEFAULT_RECORD },
          data: { userRecSeq: nextRecSeq },
        });
        await tx.oAuthCredentials.updateMany({
          where: { userId, userRecSeq: REC_SEQ.DEFAULT_RECORD },
          data: { userRecSeq: nextRecSeq },
        });
        await tx.userLists.updateMany({
          where: { userId, userRecSeq: REC_SEQ.DEFAULT_RECORD },
          data: { userRecSeq: nextRecSeq },
        });
        await tx.loginActionHistory.updateMany({
          where: { userId, userRecSeq: REC_SEQ.DEFAULT_RECORD },
          data: { userRecSeq: nextRecSeq },
        });
        await tx.locationDataSubmissions.updateMany({
          where: { userId, userRecSeq: REC_SEQ.DEFAULT_RECORD },
          data: { userRecSeq: nextRecSeq },
        });
        this.loggerInstance.logger(LogType.INFO, {
          message: 'delete: moved children to archived recSeq',
          data: { userId, nextRecSeq },
        });

        const integrationsResult = await tx.userIntegrations.updateMany({
          where: {
            userId: userId,
            userRecSeq: nextRecSeq,
            recStatus: REC_STATUS.ACTIVE,
          },
          data: { status: 'DISCONNECTED', recStatus: REC_STATUS.DELETED },
        });
        this.loggerInstance.logger(LogType.INFO, {
          message: 'delete: user integrations updated',
          data: { userId, count: integrationsResult.count },
        });

        await tx.oAuthCredentials.updateMany({
          where: {
            userId: userId,
            userRecSeq: nextRecSeq,
            recStatus: REC_STATUS.ACTIVE,
          },
          data: { recStatus: REC_STATUS.DELETED },
        });

        const userLists = await tx.userLists.findMany({
          where: {
            userId: userId,
            userRecSeq: nextRecSeq,
            recStatus: REC_STATUS.ACTIVE,
          },
          select: { userListId: true },
        });

        if (userLists.length > 0) {
          await tx.listItems.updateMany({
            where: {
              userListId: { in: userLists.map((u) => u.userListId) },
              recStatus: REC_STATUS.ACTIVE,
            },
            data: { recStatus: REC_STATUS.DELETED },
          });
        }

        await tx.userLists.updateMany({
          where: {
            userId: userId,
            userRecSeq: nextRecSeq,
            recStatus: REC_STATUS.ACTIVE,
          },
          data: { recStatus: REC_STATUS.DELETED },
        });

        await tx.locationDataSubmissions.updateMany({
          where: { userId: userId, userRecSeq: nextRecSeq, processed: false },
          data: {
            processed: true,
            processedAt: new Date(),
            recStatus: REC_STATUS.DELETED,
          },
        });

        await tx.users.delete({
          where: {
            userId_recSeq: { userId: userId, recSeq: REC_SEQ.DEFAULT_RECORD },
          },
        });
        this.loggerInstance.logger(LogType.INFO, {
          message: 'delete: deleted original recSeq=0 user',
          data: { userId },
        });
      });
      response.data = RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.DELETE;
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete',
        data: {
          service: UsersService.name,
          method: MethodNames.delete,
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
